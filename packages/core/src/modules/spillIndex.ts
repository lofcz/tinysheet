/**
 * The spill anchor index: per sheet, the cells holding a spill anchor, so
 * that inserting or deleting rows and columns (spill.ts,
 * onSpillStructureChange) looks at the anchors and their rectangles instead
 * of scanning the whole sheet.
 */
import type { Context } from "../context";
import type { CellMatrix } from "../types";
import {
  getSheetDataCached,
  peek,
  peekCell,
  peekSheet,
} from "./dependencyGraph";

type RangeLike = { row: number[]; column: number[] };
type SpillInfo = { rs: number; cs: number; blocked?: boolean };

const STRIDE = 1 << 20;

function cellKey(r: number, c: number) {
  return r * STRIDE + c;
}

/** A spill anchor: its cell and the size of its spill. */
export type SpillAnchor = {
  r: number;
  c: number;
  rs: number;
  cs: number;
  blocked: boolean;
};

/** Rows or columns inserted (before `index`) or deleted ([start, end]). */
export type SpillStructureChange =
  | { type: "row" | "column"; insert: true; index: number; count: number }
  | { type: "row" | "column"; insert: false; start: number; end: number };

export type SheetAnchorIndex = {
  token: unknown;
  anchors: Map<number, SpillAnchor>;
};

/** Token of an index being rebuilt. */
export const PENDING_INDEX = {};

/**
 * Per formula cache (i.e. per workbook), per sheet: the spill anchors, kept
 * up to date by the spill engine as it writes and clears spills
 * (noteSpillAnchor). An index is trusted while the dependency graph it was
 * built with is current; otherwise it is rebuilt from the sheet's formula
 * cells (calcChain). Entries are checked against the cells when used.
 */
const indexesByCache = new WeakMap<object, Map<string, SheetAnchorIndex>>();

let fullStructureScan = false;

export function isSpillStructureFullScan() {
  return fullStructureScan;
}

/** Tests: scan the whole sheet after row/column changes, as before. */
export function setSpillStructureFullScan(on: boolean) {
  fullStructureScan = on;
}

export function anchorIndexes(ctx: Context) {
  const fc = ctx.formulaCache as unknown as object | undefined;
  if (!fc || typeof fc !== "object") return null;
  let m = indexesByCache.get(fc);
  if (!m) {
    m = new Map();
    indexesByCache.set(fc, m);
  }
  return m;
}

export function graphToken(ctx: Context): unknown {
  return ctx.formulaCache?.formulaCellInfoMap ?? null;
}

/** The spill engine wrote (or, with no `spill`, cleared) the spill of (r, c). */
export function noteSpillAnchor(
  ctx: Context,
  id: string,
  r: number,
  c: number,
  spill?: { rs: number; cs: number; blocked?: boolean } | null
) {
  const index = anchorIndexes(ctx)?.get(id);
  if (!index) return;
  const key = cellKey(r, c);
  if (spill) {
    index.anchors.set(key, {
      r,
      c,
      rs: spill.rs,
      cs: spill.cs,
      blocked: !!spill.blocked,
    });
  } else {
    index.anchors.delete(key);
  }
}

/**
 * Forget the anchor index of a sheet (or of every sheet): its cells changed
 * without going through the spill engine (undo/redo, collaboration).
 */
export function invalidateSpillAnchors(ctx: Context, id?: string) {
  const m = anchorIndexes(ctx);
  if (!m) return;
  if (id == null) m.clear();
  else m.delete(id);
}

/**
 * The spill anchors of a sheet, in reading order: from its anchor index when
 * that is current, otherwise from its formula cells (which also rebuilds the
 * index). Only anchors whose cell still holds the spill are returned.
 */
export function spillAnchorsOf(ctx: Context, id: string): SpillAnchor[] {
  const view = getSheetDataCached(ctx, id) as CellMatrix | null;
  if (!view) return [];
  const indexes = anchorIndexes(ctx);
  const token = graphToken(ctx);
  let index = indexes?.get(id);
  if (!index || token == null || index.token !== token) {
    const anchors = new Map<number, SpillAnchor>();
    const chain = peek(peekSheet(ctx, id)?.calcChain) ?? [];
    for (let i = 0; i < chain.length; i += 1) {
      const it = peek(chain[i]);
      const cell =
        it &&
        (peekCell(view, it.r, it.c) as {
          f?: string;
          spill?: SpillInfo;
        } | null);
      if (cell?.f && cell.spill) {
        anchors.set(cellKey(it.r, it.c), {
          r: it.r,
          c: it.c,
          rs: cell.spill.rs,
          cs: cell.spill.cs,
          blocked: !!cell.spill.blocked,
        });
      }
    }
    index = { token, anchors };
    if (indexes && token != null) indexes.set(id, index);
  }
  const out: SpillAnchor[] = [];
  index.anchors.forEach((a, key) => {
    const cell = peekCell(view, a.r, a.c) as {
      f?: string;
      spill?: SpillInfo;
    } | null;
    const sp = cell?.f ? cell.spill : undefined;
    if (!sp) {
      index!.anchors.delete(key);
      return;
    }
    out.push({ r: a.r, c: a.c, rs: sp.rs, cs: sp.cs, blocked: !!sp.blocked });
  });
  out.sort((x, y) => x.r - y.r || x.c - y.c);
  return out;
}

/** Where rows (or columns) [lo, hi] are after `change`; null if all gone. */
function mapSpan(
  lo: number,
  hi: number,
  change: SpillStructureChange
): [number, number] | null {
  if (change.insert) {
    const { index, count } = change;
    if (hi < index) return [lo, hi];
    if (lo >= index) return [lo + count, hi + count];
    return [lo, hi + count];
  }
  const { start, end } = change as Extract<
    SpillStructureChange,
    { insert: false }
  >;
  const n = end - start + 1;
  const map = (p: number, deleted: number) => {
    if (p < start) return p;
    if (p > end) return p - n;
    return deleted;
  };
  const a = map(lo, start);
  const b = map(hi, start - 1);
  return b >= a ? [a, b] : null;
}

/** The image of an anchor's rectangle after `change`. */
export function mapRect(
  a: SpillAnchor,
  change: SpillStructureChange
): RangeLike | null {
  const rs = a.blocked ? 1 : a.rs;
  const cs = a.blocked ? 1 : a.cs;
  let row: [number, number] | null = [a.r, a.r + rs - 1];
  let column: [number, number] | null = [a.c, a.c + cs - 1];
  if (change.type === "row") row = mapSpan(row[0], row[1], change);
  else column = mapSpan(column[0], column[1], change);
  return row && column ? { row, column } : null;
}
