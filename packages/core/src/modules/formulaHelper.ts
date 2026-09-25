import _ from "lodash";
import {
  CellMatrix,
  columnCharToIndex,
  Context,
  execfunction,
  FormulaCell,
  FormulaCellInfo,
  FormulaDependency,
  getcellrange,
  iscelldata,
  execFunctionGroup,
  groupValuesRefresh,
  settleSpillGrowth,
} from "..";
import {
  cancelRecalc,
  deferRecalc,
  getRecalcBudget,
  hasPendingRecalc,
  recalcNow,
  recalcDeadline,
  advanceRecalc,
  recalcQueue,
  setRecalcQueueToken,
  withoutRecalcSlicing,
} from "./recalcScheduler";
import {
  cellIndex,
  DependencyGraph,
  formulaKey,
  isCrossSheetCandidate,
  isVolatileFormula,
  getSheetDataCached,
  getSheetIdByNameCached,
  getSheetIndexCached,
  peek,
  peekCell,
  peekSheet,
  SHEET_CROSS,
  SHEET_FULL,
  SheetState,
} from "./dependencyGraph";
import {
  getFormulaDependencies,
  isVolatileFormula as isWorkbookVolatileFormula,
  runSpillPropagation,
  takeSpillChanges,
} from "./formulaFunctions";
import { formulaUsesNames } from "./names";

/** Graph node: FormulaCellInfo plus the formula's literal references. */
type GraphFormulaInfo = FormulaCellInfo & {
  staticDependency?: FormulaDependency[];
};

/* ------------------------------------------------------------------------ */
/* Sheet lookups                                                            */
/* ------------------------------------------------------------------------ */

export {
  peek,
  peekCell,
  getSheetIndexCached,
  getSheetIdByNameCached,
  getSheetDataCached,
};

/**
 * Callers pass `data` for the current sheet (it may be a working matrix that
 * differs from `luckysheetfile`); other sheets are read from the workbook.
 * READ-ONLY.
 */
function sheetData(ctx: Context, id: string, data?: CellMatrix | null) {
  if (data && id === ctx.currentSheetId) return peek(data);
  return getSheetDataCached(ctx, id);
}

function isUsedCell(cell: any) {
  const c = peek(cell);
  return c != null && ((c.v != null && c.v !== "") || c.f != null);
}

/**
 * Rows / columns (counts) of a sheet that hold values, used to bound
 * whole-column and whole-row references (`A:A`, `1:3`) instead of reading
 * every allocated row. Cells computed in the current pass count as used.
 * At least one row/column is kept so the range is never empty. The data
 * scan is memoised for the duration of a recalculation pass only.
 */
export function getUsedExtent(
  ctx: Context,
  id: string,
  data: any,
  needCols: boolean
) {
  const fc = ctx.formulaCache;
  const d = peek(data);
  const totalRows = d?.length ?? 0;
  const totalCols = peek(d?.[0])?.length ?? 0;
  let base = fc.recalcDepth > 0 ? fc.usedExtentCache.get(id) : undefined;
  if (base == null) {
    let rows = 0;
    for (let r = totalRows - 1; r >= 0 && rows === 0; r -= 1) {
      const row = peek(d[r]);
      if (row) {
        for (let c = 0; c < row.length; c += 1) {
          if (isUsedCell(row[c])) {
            rows = r + 1;
            break;
          }
        }
      }
    }
    base = { rows, cols: -1 };
  }
  if (needCols && base.cols < 0) {
    let cols = 0;
    for (let r = 0; r < base.rows; r += 1) {
      const row = peek(d[r]);
      if (row) {
        for (let c = row.length - 1; c >= cols; c -= 1) {
          if (isUsedCell(row[c])) {
            cols = c + 1;
            break;
          }
        }
      }
    }
    base = { rows: base.rows, cols };
  }
  if (fc.recalcDepth > 0) fc.usedExtentCache.set(id, base);
  const overlay = fc.getGlobalExtent(id);
  const rows = Math.max(base.rows, overlay?.rows ?? 0, 1);
  const cols = Math.max(base.cols, overlay?.cols ?? 0, 1);
  return {
    rows: Math.min(rows, totalRows),
    cols: Math.min(cols, totalCols),
  };
}

function isFormulaText(f: any): f is string {
  return typeof f === "string" && f.length > 1 && f.charAt(0) === "=";
}

/* ------------------------------------------------------------------------ */
/* Graph lifecycle                                                          */
/* ------------------------------------------------------------------------ */

function sheetSignature(ctx: Context) {
  const files = peek(peek(ctx).luckysheetfile);
  if (!files) return "";
  let sig = "";
  for (let i = 0; i < files.length; i += 1) {
    const file = peek(files[i]);
    sig += `${file?.id}\u0001${file?.name}\u0002`;
  }
  return sig;
}

/**
 * Returns the dependency graph, (re)creating it when it was invalidated:
 * `formulaCellInfoMap` set to null / replaced (row/column insert & delete,
 * undo of structural changes) or a sheet was added, removed or renamed.
 * Creating it is O(1); sheets are indexed lazily on first use.
 */
export function getDependencyGraph(ctx: Context): DependencyGraph {
  const fc = ctx.formulaCache;
  const sig = sheetSignature(ctx);
  let graph = fc.dependencyGraph;
  if (
    graph == null ||
    fc.formulaCellInfoMap == null ||
    graph.token !== fc.formulaCellInfoMap ||
    graph.signature !== sig
  ) {
    const map = {};
    fc.formulaCellInfoMap = map;
    // cached text -> range resolutions may hold stale sheet ids / extents
    fc.cellTextToIndexList = {};
    graph = new DependencyGraph(map, sig);
    fc.dependencyGraph = graph;
  }
  return graph;
}

/** Drop the whole graph; it is rebuilt lazily on the next recalculation. */
export function invalidateDependencyGraph(ctx: Context) {
  ctx.formulaCache.formulaCellInfoMap = null;
}

/* ------------------------------------------------------------------------ */
/* Dependency extraction                                                    */
/* ------------------------------------------------------------------------ */

const SINGLE_REF = /^\$?([A-Za-z]+)\$?([0-9]+)$/;
const RANGE_REF = /^\$?([A-Za-z]+)\$?([0-9]+):\$?([A-Za-z]+)\$?([0-9]+)$/;

// characters that end a reference token: operators, separators, brackets,
// whitespace, @ ("." too, like the historical splitter)
const SEPARATOR = new Uint8Array(128);
",()=+-./*%&^><;{}@ \t\r\n".split("").forEach((ch) => {
  SEPARATOR[ch.charCodeAt(0)] = 1;
});
const CH_DQUOTE = 34; // "
const CH_SQUOTE = 39; // '
const CH_BANG = 33; // !
const CH_EQ = 61; // =

/** Advance past a quoted run starting at `i` (doubled quote = escape). */
function skipQuoted(f: string, i: number, quote: number) {
  let j = i + 1;
  while (j < f.length) {
    if (f.charCodeAt(j) !== quote) j += 1;
    else if (f.charCodeAt(j + 1) === quote) j += 2;
    else return j + 1;
  }
  return j;
}

/**
 * Split a formula into candidate reference tokens in one pass, skipping
 * string literals and keeping quoted sheet names ('1-2'!A1) intact.
 */
function forEachReferenceToken(f: string, fn: (token: string) => void) {
  const n = f.length;
  let start = -1;
  let i = 0;
  while (i <= n) {
    const ch = i < n ? f.charCodeAt(i) : -1;
    if (ch === CH_SQUOTE) {
      // quoted sheet name: part of the current token
      if (start === -1) start = i;
      i = skipQuoted(f, i, CH_SQUOTE);
    } else if (
      ch === -1 ||
      ch === CH_DQUOTE ||
      (ch < 128 && SEPARATOR[ch] === 1) ||
      (ch === CH_BANG && f.charCodeAt(i + 1) === CH_EQ)
    ) {
      if (start > -1 && i - start > 1) fn(f.slice(start, i));
      start = -1;
      // skip string literals entirely
      i = ch === CH_DQUOTE ? skipQuoted(f, i, CH_DQUOTE) : i + 1;
    } else {
      if (start === -1) start = i;
      i += 1;
    }
  }
}

/** Every cell/range reference literally written in a formula. */
function extractReferences(
  ctx: Context,
  calc_funcStr: string,
  id: string,
  data?: CellMatrix | null
) {
  const formulaDependency: FormulaDependency[] = [];
  // plain A1 / A1:B2 references of the formula's own sheet are parsed
  // directly (same result as iscelldata + getcellrange, without the regex
  // replaces and without growing cellTextToIndexList)
  const ownSheetOk =
    getSheetIndexCached(ctx, id) != null && sheetData(ctx, id, data) != null;
  let needParser = false;
  forEachReferenceToken(calc_funcStr, (token) => {
    // A1# (spill reference) depends on the anchor A1
    const t =
      token.charAt(token.length - 1) === "#" ? token.slice(0, -1) : token;
    const first = t.charCodeAt(0);
    // a token starting with a digit can only be a row range like 1:3
    if (first >= 48 && first <= 57 && t.indexOf(":") === -1) return;
    const single = ownSheetOk ? SINGLE_REF.exec(t) : null;
    const range = ownSheetOk && !single ? RANGE_REF.exec(t) : null;
    if (single) {
      const r = parseInt(single[2], 10) - 1;
      const c = columnCharToIndex(single[1]);
      formulaDependency.push({ row: [r, r], column: [c, c], sheetId: id });
    } else if (range) {
      const r0 = parseInt(range[2], 10) - 1;
      const r1 = parseInt(range[4], 10) - 1;
      const c0 = columnCharToIndex(range[1]);
      const c1 = columnCharToIndex(range[3]);
      if (r0 <= r1 && c0 <= c1) {
        formulaDependency.push({
          row: [r0, r1],
          column: [c0, c1],
          sheetId: id,
        });
      }
    } else {
      // sheet-qualified references, whole rows / columns
      const dep = iscelldata(t)
        ? getcellrange(ctx, t, id, data || undefined)
        : null;
      if (!_.isNil(dep)) formulaDependency.push(dep);
      else if (t.indexOf("!") > -1) needParser = true;
    }
  });
  if (needParser) {
    // forms the scanner does not resolve (e.g. Sheet2!A:A): ask the parser
    // eslint-disable-next-line no-use-before-define
    formulaDependency.push(...referencesFromParser(ctx, calc_funcStr, id));
  }
  return formulaDependency;
}

/** References of a formula as reported by the grammar (AST based). */
function referencesFromParser(ctx: Context, f: string, id: string) {
  const out: FormulaDependency[] = [];
  let refs: any[] | undefined;
  try {
    refs = ctx.formulaCache.parser.getReferences?.(
      f.charAt(0) === "=" ? f.slice(1) : f
    );
  } catch {
    return out; // syntax error: the formula evaluates to an error anyway
  }
  (refs || []).forEach((ref) => {
    const sheetId =
      ref.sheetName == null
        ? id
        : getSheetIdByNameCached(ctx, String(ref.sheetName));
    if (sheetId == null) return;
    const d = getSheetDataCached(ctx, sheetId);
    const rows = d?.length ?? 0;
    const cols = peek(d?.[0])?.length ?? 0;
    const row: [number, number] =
      ref.startRow === -1 ? [0, rows - 1] : [ref.startRow, ref.endRow];
    const column: [number, number] =
      ref.startColumn === -1 ? [0, cols - 1] : [ref.startColumn, ref.endColumn];
    if (row[0] <= row[1] && column[0] <= column[1]) {
      out.push({ row, column, sheetId });
    }
  });
  return out;
}

export function buildFormulaCellInfo(
  ctx: Context,
  r: number,
  c: number,
  id: string,
  calc_funcStr: string,
  data?: CellMatrix | null
): GraphFormulaInfo {
  const staticDependency = extractReferences(ctx, calc_funcStr, id, data);
  const info: GraphFormulaInfo = {
    formulaDependency: staticDependency,
    staticDependency,
    calc_funcStr,
    key: formulaKey(r, c, id),
    r,
    c,
    id,
    parents: {},
    chidren: {},
    color: "w",
  };
  // + references resolved at run time by formulaFunctions.ts (INDIRECT /
  // OFFSET targets, the spill rectangle of a dynamic-array anchor)
  info.formulaDependency = getFormulaDependencies(ctx, info);
  return info;
}

function isVolatile(f: string) {
  return isVolatileFormula(f) || isWorkbookVolatileFormula(f);
}

function registerFormula(
  ctx: Context,
  graph: DependencyGraph,
  r: number,
  c: number,
  id: string,
  f: string,
  data?: CellMatrix | null
) {
  const info = buildFormulaCellInfo(ctx, r, c, id, f, data);
  graph.setNode(info, isVolatile(f));
  return info;
}

function sameDependencies(a: FormulaDependency[], b: FormulaDependency[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.sheetId !== y.sheetId ||
      x.row[0] !== y.row[0] ||
      x.row[1] !== y.row[1] ||
      x.column[0] !== y.column[0] ||
      x.column[1] !== y.column[1]
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Re-merge a node's run-time dependencies after it was evaluated (an
 * INDIRECT target or spill size may have changed) and re-index it if needed.
 */
function refreshDynamicDependencies(
  ctx: Context,
  graph: DependencyGraph,
  info: GraphFormulaInfo
) {
  const deps = getFormulaDependencies(ctx, {
    ...info,
    formulaDependency: info.staticDependency ?? info.formulaDependency,
  });
  if (sameDependencies(deps, info.formulaDependency)) return;
  graph.setNode(
    { ...info, formulaDependency: deps },
    isVolatile(info.calc_funcStr)
  );
}

/* ------------------------------------------------------------------------ */
/* calcChain membership (O(1) instead of scanning the array)                */
/* ------------------------------------------------------------------------ */

function syncChain(ctx: Context, graph: DependencyGraph, id: string) {
  const sheet = peekSheet(ctx, id);
  if (sheet == null) return null;
  const chain = peek(sheet.calcChain);
  const length = chain?.length ?? 0;
  let entry = graph.chain.get(id);
  if (entry == null || entry.length !== length) {
    const cells = new Set<number>();
    for (let i = 0; i < length; i += 1) {
      const item = peek(chain![i]);
      if (item) cells.add(cellIndex(item.r, item.c));
    }
    entry = { cells, length };
    graph.chain.set(id, entry);
  }
  return entry;
}

export function isInCalcChain(ctx: Context, r: number, c: number, id: string) {
  const entry = syncChain(ctx, getDependencyGraph(ctx), id);
  return !!entry?.cells.has(cellIndex(r, c));
}

/** Record that (r, c) was appended to / removed from the sheet's calcChain. */
export function noteCalcChainChange(
  ctx: Context,
  r: number,
  c: number,
  id: string,
  added: boolean
) {
  const graph = getDependencyGraph(ctx);
  const entry = graph.chain.get(id);
  if (!entry) return;
  const sheet = peekSheet(ctx, id);
  if (sheet == null) return;
  if (added) entry.cells.add(cellIndex(r, c));
  else entry.cells.delete(cellIndex(r, c));
  entry.length = peek(sheet.calcChain)?.length ?? 0;
}

/* ------------------------------------------------------------------------ */
/* Lazy per-sheet indexing                                                  */
/* ------------------------------------------------------------------------ */

function ensureSheetIndexed(
  ctx: Context,
  graph: DependencyGraph,
  id: string,
  target: SheetState,
  data?: CellMatrix | null
) {
  if (graph.getState(id) >= target) return;
  const file = peekSheet(ctx, id);
  if (file == null) return;
  graph.sheetState.set(id, target);
  const d = sheetData(ctx, id, data);
  const chain = peek(file.calcChain);
  const length = chain?.length ?? 0;
  const cells = new Set<number>();
  for (let i = 0; i < length; i += 1) {
    const item = peek(chain![i]);
    if (item) {
      const { r, c } = item;
      cells.add(cellIndex(r, c));
      const key = formulaKey(r, c, id);
      if (!graph.hasNode(key)) {
        const f = peekCell(d, r, c)?.f;
        if (
          isFormulaText(f) &&
          (target === SHEET_FULL ||
            isCrossSheetCandidate(f) ||
            formulaUsesNames(ctx, f, id))
        ) {
          registerFormula(ctx, graph, r, c, id, f, d);
        }
      }
    }
  }
  graph.chain.set(id, { cells, length });
}

/**
 * Index what is needed to find the dependents of cells in `sheetIds`: those
 * sheets fully, every other sheet only for cross-sheet/volatile formulas.
 */
function ensureIndexedFor(
  ctx: Context,
  graph: DependencyGraph,
  sheetIds: Set<string>,
  data?: CellMatrix | null
) {
  const files = peek(peek(ctx).luckysheetfile);
  for (let i = 0; i < files.length; i += 1) {
    const { id } = peek(files[i]);
    if (id != null) {
      ensureSheetIndexed(
        ctx,
        graph,
        id,
        sheetIds.has(id) ? SHEET_FULL : SHEET_CROSS,
        data
      );
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Public registration API (unchanged signatures)                           */
/* ------------------------------------------------------------------------ */

function registerCellInGraph(
  ctx: Context,
  graph: DependencyGraph,
  formulaCell: FormulaCell,
  data?: CellMatrix | null
) {
  const { r, c, id } = formulaCell;
  const state = graph.getState(id);
  const key = formulaKey(r, c, id);
  if (state === 0) {
    // sheet not indexed yet: it will be read from the data when needed
    return;
  }
  const d = data ? peek(data) : getSheetDataCached(ctx, id);
  const f = peekCell(d, r, c)?.f;
  if (
    !isFormulaText(f) ||
    (state === SHEET_CROSS &&
      !isCrossSheetCandidate(f) &&
      !formulaUsesNames(ctx, f, id))
  ) {
    graph.removeNode(key);
    return;
  }
  const existing = graph.nodes.get(key);
  if (existing && existing.calc_funcStr === f) {
    // same formula: only run-time references (INDIRECT, spill) may differ
    refreshDynamicDependencies(ctx, graph, existing);
    return;
  }
  registerFormula(ctx, graph, r, c, id, f, d);
}

/**
 * Re-read the formula of one cell and update its dependency edges.
 * Make sure this runs *after* the cell modification.
 */
export function setFormulaCellInfo(
  ctx: Context,
  formulaCell: FormulaCell,
  data?: CellMatrix
) {
  const graph = getDependencyGraph(ctx);
  registerCellInGraph(ctx, graph, formulaCell, data);
}

/** Batch version of setFormulaCellInfo (lazy: no-op for unindexed sheets). */
export function setFormulaCellInfoList(
  ctx: Context,
  cells: FormulaCell[] | undefined | null,
  data?: CellMatrix
) {
  if (!cells || cells.length === 0) return;
  const graph = getDependencyGraph(ctx);
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (cell && graph.getState(cell.id) !== 0) {
      registerCellInGraph(ctx, graph, cell, data);
    }
  }
}

/** Forget the formula node at (r, c) (the formula is being removed). */
export function removeFormulaNode(
  ctx: Context,
  r: number,
  c: number,
  id: string
) {
  const graph = ctx.formulaCache.dependencyGraph;
  if (graph && graph.token === ctx.formulaCache.formulaCellInfoMap) {
    graph.removeNode(formulaKey(r, c, id));
  }
}

/** Formula cells found on a reference cycle during recalculation. */
export function getCircularReferences(ctx: Context) {
  const graph = ctx.formulaCache.dependencyGraph;
  if (!graph) return [];
  const out: { r: number; c: number; id: string }[] = [];
  graph.circular.forEach((key) => {
    const info = graph.nodes.get(key);
    if (info) out.push({ r: info.r, c: info.c, id: info.id });
  });
  return out;
}

/* ------------------------------------------------------------------------ */
/* Recalculation                                                            */
/* ------------------------------------------------------------------------ */

function currentFormula(
  ctx: Context,
  info: FormulaCellInfo,
  data?: CellMatrix | null
) {
  const f = peekCell(sheetData(ctx, info.id, data), info.r, info.c)?.f;
  if (f !== info.calc_funcStr && data && info.id === ctx.currentSheetId) {
    // `data` may be a working copy for another sheet (cross-sheet paste)
    const f2 = peekCell(getSheetDataCached(ctx, info.id), info.r, info.c)?.f;
    if (f2 === info.calc_funcStr) return f2;
  }
  return f;
}

/**
 * Evaluates the formulas of `order` in turn. With a `deadline`
 * (performance.now()) it stops once that has passed and returns how many
 * were evaluated (the caller queues the rest); otherwise all of them.
 */
export function executeAffectedFormulas(
  ctx: Context,
  graph: DependencyGraph,
  order: readonly string[],
  data?: CellMatrix | null,
  deadline?: number | null,
  from = 0
): number {
  const fc = ctx.formulaCache;
  for (let i = from; i < order.length; i += 1) {
    // checked every 16 formulas: reading the clock costs too
    if (
      deadline != null &&
      i > from &&
      ((i - from) & 15) === 0 &&
      recalcNow() >= deadline
    ) {
      return i;
    }
    let info: FormulaCellInfo | undefined = graph.nodes.get(order[i]);
    if (info) {
      // self-healing: the cell may have been overwritten without the graph
      // being told (e.g. API writes); never resurrect a removed formula
      const f = currentFormula(ctx, info, data);
      if (f !== info.calc_funcStr) {
        if (isFormulaText(f)) {
          info = registerFormula(
            ctx,
            graph,
            info.r,
            info.c,
            info.id,
            f,
            sheetData(ctx, info.id, data)
          );
        } else {
          graph.removeNode(info.key);
          info = undefined;
        }
      }
    }
    if (info) {
      const { r, c, id } = info;
      // skip the calcChain insert (and its draft reads) when already there
      const inChain = !!syncChain(ctx, graph, id)?.cells.has(cellIndex(r, c));
      const v = execfunction(
        ctx,
        info.calc_funcStr,
        r,
        c,
        id,
        undefined,
        false,
        inChain
      );
      refreshDynamicDependencies(ctx, graph, info);
      ctx.groupValuesRefreshData.push({
        r,
        c,
        v: v[1],
        f: v[2],
        spe: v[3],
        id,
      });
      fc.setGlobalCell(r, c, id, { v: v[1], f: v[2] });
    }
  }
  return order.length;
}

export type ChangedCell = { r: number; c: number; id: string };

/**
 * Recalculate every formula that (transitively) depends on `changed`, plus
 * volatile formulas and their dependents, in topological order.
 *
 * `origin` is the single edited cell of an interactive edit: its new value is
 * already known and it is never re-evaluated. When the edit entered a formula,
 * pass it as `originFormula` so its new references are indexed before
 * propagation (which lets cycles through it be detected).
 */
export function recalculate(
  ctx: Context,
  changed: ChangedCell[],
  data: CellMatrix | null | undefined,
  options: {
    origin?: ChangedCell;
    originFormula?: string;
    isForce?: boolean;
  } = {}
) {
  const { origin, originFormula, isForce } = options;
  const graph = getDependencyGraph(ctx);

  const touched = new Set<string>();
  for (let i = 0; i < changed.length; i += 1) touched.add(changed[i].id);
  if (isForce) {
    ctx.luckysheetfile.forEach((f) => {
      if (f.id != null) touched.add(f.id);
    });
  }
  ensureIndexedFor(ctx, graph, touched, data);

  let originKey: string | undefined;
  if (origin) {
    originKey = formulaKey(origin.r, origin.c, origin.id);
    if (isFormulaText(originFormula)) {
      registerFormula(
        ctx,
        graph,
        origin.r,
        origin.c,
        origin.id,
        originFormula,
        sheetData(ctx, origin.id, data)
      );
    }
  }

  let roots: string[];
  if (isForce) {
    roots = Array.from(graph.nodes.keys());
  } else {
    roots = [];
    const push = (k: string) => {
      roots.push(k);
    };
    for (let i = 0; i < changed.length; i += 1) {
      const cell = changed[i];
      graph.forEachDependent(cell.id, cell.r, cell.c, push);
    }
    graph.volatile.forEach(push);
  }

  const beforeVisit = (key: string) => {
    // reaching a formula of a partially indexed sheet: its same-sheet
    // dependents are not indexed yet
    const info = graph.nodes.get(key);
    if (info && graph.getState(info.id) !== SHEET_FULL) {
      ensureSheetIndexed(ctx, graph, info.id, SHEET_FULL, data);
    }
  };

  const { order, cyclic } = graph.order(roots, beforeVisit, originKey);

  for (let i = 0; i < order.length; i += 1) graph.circular.delete(order[i]);
  if (originKey) graph.circular.delete(originKey);
  cyclic.forEach((key) => {
    if (key !== originKey || isFormulaText(originFormula)) {
      graph.circular.add(key);
    }
  });

  const fc = ctx.formulaCache;
  // everything is recalculated: a queued remainder is obsolete
  if (isForce) cancelRecalc(ctx);
  // a top-level recalculation may stop at the slice deadline and queue the
  // rest (recalcScheduler.ts)
  const deadline = fc.recalcDepth === 0 ? recalcDeadline(ctx) : null;
  if (fc.recalcDepth === 0) fc.usedExtentCache.clear();
  fc.recalcDepth += 1;
  let done = order.length;
  try {
    done = executeAffectedFormulas(ctx, graph, order, data, deadline);
  } finally {
    fc.recalcDepth -= 1;
  }
  if (done < order.length) deferRecalc(ctx, order.slice(done));
}

const KEY_RE = /^r\d+c\d+i(.*)$/s;

/**
 * Evaluate the next slice of a queued recalculation (see
 * recalcScheduler.ts): formulas in order until the slice budget is spent
 * (or all of them with `unlimited`), then what their results set off (spill
 * changes, sheet growth). Results are queued in groupValuesRefreshData like
 * those of execFunctionGroup. Updates `ctx.recalcProgress`.
 */
export function runRecalcSlice(ctx: Context, unlimited = false) {
  if (!hasPendingRecalc(ctx)) {
    if (ctx.recalcProgress !== undefined) ctx.recalcProgress = undefined;
    return;
  }
  const fc = ctx.formulaCache;
  const queue = recalcQueue(ctx)!;
  const graph = getDependencyGraph(ctx);
  if (graph.token !== queue.token) {
    // the graph was rebuilt since the keys were queued: index their sheets
    const ids = new Set<string>();
    for (let i = queue.from; i < queue.keys.length; i += 1) {
      const m = KEY_RE.exec(queue.keys[i]);
      if (m) ids.add(m[1]);
    }
    ids.forEach((id) => ensureSheetIndexed(ctx, graph, id, SHEET_FULL));
    setRecalcQueueToken(ctx, graph.token);
  }
  if (!ctx.groupValuesRefreshData) ctx.groupValuesRefreshData = [];
  fc.execFunctionGlobalData = null;
  const deadline = unlimited ? null : recalcNow() + getRecalcBudget();
  if (fc.recalcDepth === 0) fc.usedExtentCache.clear();
  fc.recalcDepth += 1;
  let reached = queue.keys.length;
  try {
    reached = executeAffectedFormulas(
      ctx,
      graph,
      queue.keys,
      undefined,
      deadline,
      queue.from
    );
  } finally {
    fc.recalcDepth -= 1;
  }
  advanceRecalc(ctx, reached - queue.from);
  // cells whose spilled value changed, spills past the sheet edge
  const spillChanges = takeSpillChanges(ctx);
  if (spillChanges) {
    runSpillPropagation(ctx, () => {
      fc.execFunctionExist = spillChanges;
      execFunctionGroup(ctx, null as any, null as any, null);
    });
  }
  settleSpillGrowth(ctx);
  fc.execFunctionGlobalData = null;
}

/**
 * Finish a queued (time-sliced) recalculation right away, so the cells hold
 * their final values. `ctx` is a context being updated (an immer draft) or
 * a mutable context; results are applied with groupValuesRefresh.
 */
export function flushRecalc(ctx: Context) {
  withoutRecalcSlicing(() => {
    let guard = 0;
    while (hasPendingRecalc(ctx) && guard < 1000) {
      guard += 1;
      runRecalcSlice(ctx, true);
      groupValuesRefresh(ctx);
    }
  });
  if (ctx.recalcProgress !== undefined) ctx.recalcProgress = undefined;
}
