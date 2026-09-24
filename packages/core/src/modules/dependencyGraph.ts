/* eslint-disable max-classes-per-file */
import type { Context } from "../context";
import type {
  FormulaCellInfo,
  FormulaCellInfoMap,
  FormulaDependency,
} from "../types";

/**
 * Incremental dependency graph used by the recalculation engine.
 *
 * Nodes are formula cells, keyed like `formulaCellInfoMap` (`r{r}c{c}i{id}`).
 * The graph keeps a reverse index "cell -> formulas that read it":
 *
 * - single-cell references live in a per-sheet `Map<cellIndex, Set<key>>`;
 * - multi-cell ranges are de-duplicated (`SUM(A1:A5000)` referenced by 10k
 *   formulas is stored once) and registered in fixed-size row/column buckets,
 *   so finding the ranges that contain a cell costs one bucket lookup plus a
 *   containment test on the few ranges in it. Very large ranges (whole
 *   columns, huge blocks) go to a short per-sheet list scanned linearly.
 *
 * Recalculation walks this index from the changed cells (dirty-set
 * propagation), orders the affected formulas topologically with an iterative
 * DFS, and reports formulas that sit on a cycle instead of looping forever.
 *
 * This module is pure data-structure code: it knows nothing about the
 * context, parsing or evaluation (see formulaHelper.ts for the glue).
 */

const DRAFT_STATE = Symbol.for("immer-state");

/**
 * Latest value of a possibly-immer-draft object, *without* creating child
 * drafts. Reading a big sheet through a draft creates a proxy per row/cell
 * touched (and makes the final produce() walk them); formula evaluation only
 * reads, so it peeks at the draft's current copy (or its base) instead.
 * The result is READ-ONLY: never write through it. Falls back to the value
 * itself for plain objects or an unknown immer version.
 */
export function peek<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  const state = (value as any)[DRAFT_STATE];
  if (state == null || typeof state !== "object") return value;
  const latest = state.copy_ ?? state.base_;
  return latest == null ? value : latest;
}

/** Read-only cell lookup that does not create immer drafts. */
export function peekCell(data: any, r: number, c: number) {
  return peek(peek(peek(data)?.[r])?.[c]);
}

/* Draft-free, memoised sheet lookups */

const sheetIndexCache = new Map<string, number>();
const sheetNameCache = new Map<string, number>();

/**
 * `getSheetIndex` with a validated memo: the remembered position is checked
 * against the current sheet list, so reordering/deleting sheets is safe.
 */
export function getSheetIndexCached(ctx: Context, id: string | undefined) {
  if (id == null) return null;
  const files = peek(peek(ctx).luckysheetfile);
  if (!files) return null;
  const cached = sheetIndexCache.get(id);
  if (cached != null && peek(files[cached])?.id === id) return cached;
  for (let i = 0; i < files.length; i += 1) {
    if (peek(files[i])?.id === id) {
      sheetIndexCache.set(id, i);
      return i;
    }
  }
  return null;
}

export function getSheetIdByNameCached(ctx: Context, name: string) {
  const files = peek(peek(ctx).luckysheetfile);
  if (!files) return null;
  const cached = sheetNameCache.get(name);
  if (cached != null && peek(files[cached])?.name === name) {
    return peek(files[cached]).id;
  }
  for (let i = 0; i < files.length; i += 1) {
    const file = peek(files[i]);
    if (file?.name === name) {
      sheetNameCache.set(name, i);
      return file.id;
    }
  }
  return null;
}

/** READ-ONLY view of a sheet (see `peek`). */
export function peekSheet(ctx: Context, id: string | undefined) {
  const idx = getSheetIndexCached(ctx, id);
  if (idx == null) return null;
  return peek(peek(peek(ctx).luckysheetfile)[idx]);
}

/** READ-ONLY view of a sheet's cell matrix (see `peek`). */
export function getSheetDataCached(ctx: Context, id: string | undefined) {
  return peek(peekSheet(ctx, id)?.data);
}

/** Column stride of the numeric cell index (`r * COL_STRIDE + c`). */
export const COL_STRIDE = 1 << 20;

const ROW_BLOCK = 64;
const COL_BLOCK = 16;
const BUCKET_STRIDE = COL_STRIDE / COL_BLOCK;
/** Ranges spanning more buckets than this are kept in the `large` list. */
const MAX_BUCKETS_PER_RANGE = 256;

export const SHEET_NONE = 0;
/** Only formulas that may depend on other sheets (or are volatile) are indexed. */
export const SHEET_CROSS = 1;
/** Every formula of the sheet is indexed. */
export const SHEET_FULL = 2;
export type SheetState = 0 | 1 | 2;

const VOLATILE_RE =
  /(?:^|[^A-Za-z0-9_.])(?:NOW|TODAY|RAND|RANDBETWEEN|RANDARRAY|OFFSET|INDIRECT|CELL|SUBTOTAL)\s*\(/i;

/**
 * Volatile functions are recalculated on every recalculation pass, like in
 * Excel. OFFSET and INDIRECT are included because their precedents cannot be
 * known statically, CELL and SUBTOTAL because they read formats / hidden rows
 * (same list as formulaFunctions.isVolatileFormula, plus NOW/TODAY/RAND*).
 */
export function isVolatileFormula(f: string) {
  return VOLATILE_RE.test(f);
}

/**
 * Whether a formula can read cells of another sheet (or must be indexed for
 * another reason). Formulas without a sheet qualifier only read their own
 * sheet, so they are irrelevant when other sheets change.
 */
export function isCrossSheetCandidate(f: string) {
  return f.indexOf("!") > -1 || isVolatileFormula(f);
}

export function formulaKey(r: number, c: number, id: string) {
  return `r${r}c${c}i${id}`;
}

export function cellIndex(r: number, c: number) {
  return r * COL_STRIDE + c;
}

type RangeEntry = {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
  rangeKey: string;
  formulas: Set<string>;
  /** bucket ids this range is registered in, or null when in `large` */
  buckets: number[] | null;
};

class SheetDependencies {
  /** single-cell readers; a plain key while there is only one (saves GC) */
  cells = new Map<number, string | Set<string>>();

  ranges = new Map<string, RangeEntry>();

  buckets = new Map<number, RangeEntry[]>();

  large: RangeEntry[] = [];

  /** formula nodes located in this sheet */
  nodes = new Set<string>();

  add(dep: FormulaDependency, key: string) {
    const [r0, r1] = dep.row;
    const [c0, c1] = dep.column;
    if (r0 === r1 && c0 === c1) {
      const idx = cellIndex(r0, c0);
      const cur = this.cells.get(idx);
      if (cur === undefined) {
        this.cells.set(idx, key);
      } else if (typeof cur === "string") {
        if (cur !== key) this.cells.set(idx, new Set([cur, key]));
      } else {
        cur.add(key);
      }
      return;
    }
    const rangeKey = `${r0}_${r1}_${c0}_${c1}`;
    let entry = this.ranges.get(rangeKey);
    if (!entry) {
      entry = { r0, r1, c0, c1, rangeKey, formulas: new Set(), buckets: null };
      const rb0 = Math.floor(r0 / ROW_BLOCK);
      const rb1 = Math.floor(r1 / ROW_BLOCK);
      const cb0 = Math.floor(c0 / COL_BLOCK);
      const cb1 = Math.floor(c1 / COL_BLOCK);
      if ((rb1 - rb0 + 1) * (cb1 - cb0 + 1) > MAX_BUCKETS_PER_RANGE) {
        this.large.push(entry);
      } else {
        entry.buckets = [];
        for (let rb = rb0; rb <= rb1; rb += 1) {
          for (let cb = cb0; cb <= cb1; cb += 1) {
            const b = rb * BUCKET_STRIDE + cb;
            entry.buckets.push(b);
            const list = this.buckets.get(b);
            if (list) list.push(entry);
            else this.buckets.set(b, [entry]);
          }
        }
      }
      this.ranges.set(rangeKey, entry);
    }
    entry.formulas.add(key);
  }

  remove(dep: FormulaDependency, key: string) {
    const [r0, r1] = dep.row;
    const [c0, c1] = dep.column;
    if (r0 === r1 && c0 === c1) {
      const idx = cellIndex(r0, c0);
      const cur = this.cells.get(idx);
      if (cur === key) {
        this.cells.delete(idx);
      } else if (cur !== undefined && typeof cur !== "string") {
        cur.delete(key);
        if (cur.size === 1) this.cells.set(idx, cur.values().next().value!);
      }
      return;
    }
    const rangeKey = `${r0}_${r1}_${c0}_${c1}`;
    const entry = this.ranges.get(rangeKey);
    if (!entry) return;
    entry.formulas.delete(key);
    if (entry.formulas.size > 0) return;
    this.ranges.delete(rangeKey);
    if (entry.buckets == null) {
      this.large = this.large.filter((e) => e !== entry);
      return;
    }
    for (let i = 0; i < entry.buckets.length; i += 1) {
      const b = entry.buckets[i];
      const list = this.buckets.get(b);
      if (list) {
        const pos = list.indexOf(entry);
        if (pos > -1) list.splice(pos, 1);
        if (list.length === 0) this.buckets.delete(b);
      }
    }
  }

  /** Calls `fn` for every formula key that reads cell (r, c). May repeat keys. */
  forEachDependent(r: number, c: number, fn: (key: string) => void) {
    const cur = this.cells.get(cellIndex(r, c));
    if (typeof cur === "string") fn(cur);
    else if (cur !== undefined) cur.forEach((k) => fn(k));
    const list = this.buckets.get(
      Math.floor(r / ROW_BLOCK) * BUCKET_STRIDE + Math.floor(c / COL_BLOCK)
    );
    if (list) {
      for (let i = 0; i < list.length; i += 1) {
        const e = list[i];
        if (r >= e.r0 && r <= e.r1 && c >= e.c0 && c <= e.c1) {
          e.formulas.forEach(fn);
        }
      }
    }
    for (let i = 0; i < this.large.length; i += 1) {
      const e = this.large[i];
      if (r >= e.r0 && r <= e.r1 && c >= e.c0 && c <= e.c1) {
        e.formulas.forEach(fn);
      }
    }
  }
}

export type RecalcOrder = {
  /** formula keys in evaluation order (precedents first) */
  order: string[];
  /** formula keys found on a reference cycle */
  cyclic: Set<string>;
};

export class DependencyGraph {
  /**
   * The `formulaCache.formulaCellInfoMap` object current when the graph was
   * created. It only serves as an invalidation token: code that sets
   * `formulaCellInfoMap = null` (row/column ops, undo) forces a rebuild.
   */
  token: FormulaCellInfoMap;

  /** formula nodes by key */
  nodes = new Map<string, FormulaCellInfo>();

  /** sheet ids + names at build time; a change means rename/add/delete */
  signature: string;

  sheets = new Map<string, SheetDependencies>();

  sheetState = new Map<string, SheetState>();

  volatile = new Set<string>();

  /** formula keys detected on a reference cycle by the latest passes */
  circular = new Set<string>();

  /**
   * Per sheet: cell indexes present in the sheet's calcChain, and the
   * calcChain length when the set was last in sync (used to detect outside
   * replacement of the array).
   */
  chain = new Map<string, { cells: Set<number>; length: number }>();

  constructor(token: FormulaCellInfoMap, signature: string) {
    this.token = token;
    this.signature = signature;
  }

  getState(sheetId: string): SheetState {
    return this.sheetState.get(sheetId) ?? SHEET_NONE;
  }

  private sheet(sheetId: string) {
    let s = this.sheets.get(sheetId);
    if (!s) {
      s = new SheetDependencies();
      this.sheets.set(sheetId, s);
    }
    return s;
  }

  hasNode(key: string) {
    return this.nodes.has(key);
  }

  /** `volatile` defaults to testing the formula text (isVolatileFormula). */
  setNode(info: FormulaCellInfo, volatile?: boolean) {
    const { key } = info;
    if (this.nodes.has(key)) this.removeNode(key);
    this.nodes.set(key, info);
    this.sheet(info.id).nodes.add(key);
    const deps = info.formulaDependency;
    for (let i = 0; i < deps.length; i += 1) {
      const dep = deps[i];
      if (dep.sheetId != null) this.sheet(dep.sheetId).add(dep, key);
    }
    if (
      volatile ??
      (info.calc_funcStr.indexOf("(") > -1 &&
        isVolatileFormula(info.calc_funcStr))
    ) {
      this.volatile.add(key);
    }
  }

  removeNode(key: string) {
    const info = this.nodes.get(key);
    if (!info) return;
    this.nodes.delete(key);
    this.sheets.get(info.id)?.nodes.delete(key);
    const deps = info.formulaDependency;
    for (let i = 0; i < deps.length; i += 1) {
      const dep = deps[i];
      if (dep.sheetId != null) this.sheets.get(dep.sheetId)?.remove(dep, key);
    }
    this.volatile.delete(key);
    this.circular.delete(key);
  }

  /** Forget every node of a sheet so it gets rebuilt lazily. */
  invalidateSheet(sheetId: string) {
    const s = this.sheets.get(sheetId);
    if (s) Array.from(s.nodes).forEach((key) => this.removeNode(key));
    this.sheetState.delete(sheetId);
    this.chain.delete(sheetId);
  }

  forEachDependent(
    sheetId: string,
    r: number,
    c: number,
    fn: (key: string) => void
  ) {
    this.sheets.get(sheetId)?.forEachDependent(r, c, fn);
  }

  dependentsOfNode(key: string) {
    const info = this.nodes.get(key);
    const out: string[] = [];
    if (!info) return out;
    this.forEachDependent(info.id, info.r, info.c, (k) => {
      out.push(k);
    });
    return out;
  }

  /**
   * Topologically orders every formula reachable from `roots` through the
   * dependents relation. Iterative DFS (no recursion limit on long chains);
   * back edges mark the formulas on the cycle as circular and are otherwise
   * ignored, so evaluation always terminates.
   *
   * `beforeVisit(key)` runs before a node's dependents are collected (used to
   * lazily index a sheet on first touch). `origin` is the edited cell itself:
   * it is never re-evaluated; reaching it again means a cycle through it.
   */
  order(
    roots: Iterable<string>,
    beforeVisit?: (key: string) => void,
    origin?: string
  ): RecalcOrder {
    const DONE = 2;
    const ACTIVE = 1;
    const state = new Map<string, number>();
    const post: string[] = [];
    const cyclic = new Set<string>();
    const stackKeys: string[] = [];
    const stackChildren: string[][] = [];
    const stackPos: number[] = [];
    const stackIndex = new Map<string, number>();

    const push = (key: string) => {
      beforeVisit?.(key);
      state.set(key, ACTIVE);
      stackIndex.set(key, stackKeys.length);
      stackKeys.push(key);
      stackChildren.push(this.dependentsOfNode(key));
      stackPos.push(0);
    };
    const markCycle = (fromIndex: number) => {
      for (let i = fromIndex; i < stackKeys.length; i += 1) {
        cyclic.add(stackKeys[i]);
      }
    };

    const rootIt = roots[Symbol.iterator]();
    for (let next = rootIt.next(); !next.done; next = rootIt.next()) {
      const root = next.value;
      if (root === origin) {
        // the origin reads itself
        cyclic.add(root);
      } else if (!state.has(root) && this.nodes.has(root)) {
        push(root);
        while (stackKeys.length > 0) {
          const top = stackKeys.length - 1;
          const children = stackChildren[top];
          if (stackPos[top] < children.length) {
            const child = children[stackPos[top]];
            stackPos[top] += 1;
            if (child === origin) {
              markCycle(0);
              cyclic.add(child);
            } else {
              const s = state.get(child);
              if (s === undefined) {
                if (this.nodes.has(child)) push(child);
              } else if (s === ACTIVE) {
                markCycle(stackIndex.get(child)!);
              }
            }
          } else {
            const key = stackKeys.pop()!;
            stackChildren.pop();
            stackPos.pop();
            stackIndex.delete(key);
            state.set(key, DONE);
            post.push(key);
          }
        }
      }
    }
    post.reverse();
    return { order: post, cyclic };
  }
}
