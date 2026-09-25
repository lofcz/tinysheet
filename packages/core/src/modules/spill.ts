/**
 * Dynamic-array spill: keeping spills right when cells move, growing the
 * sheet for spills past its edge, and queries for the spill UI.
 *
 * formulaFunctions.ts writes a spill while its anchor is evaluated: the anchor
 * holds the formula and `spill: { rs, cs, blocked? }`, the other cells of the
 * rectangle hold plain values tagged `spillFrom: { dr, dc }`. Operations that
 * move cells around (inserting or deleting rows and columns, sorting, fill,
 * paste, cut and drag-moving cells) know nothing about that, so they call
 * `reconcileSpills` afterwards, which
 *
 * - clears spilled cells whose anchor is gone or no longer covers them (an
 *   anchor on a deleted row, spilled cells sorted away from their anchor),
 * - turns copies of spilled cells that were pasted or filled without their
 *   anchor into plain values (like Excel, copying spilled cells copies
 *   values; the `spillFrom` tag never travels with a copy),
 * - re-evaluates the anchors that were touched (moved, copied, adjusted,
 *   overlapped, or whose rectangle has holes), so they spill afresh from
 *   where they are now, and recalculates the dependents of all of this.
 *
 * It does not scan the whole sheet for that (except after rows or columns
 * moved): see `scanSpillCells`.
 *
 * Undo and redo need nothing here: spills live in the cell data, so the
 * history patches restore them exactly, and the anchor's dependency on its
 * spill area is derived from that data (formulaFunctions.ts).
 */
import _ from "lodash";
import type { Context } from "../context";
import { getFlowdata } from "../context";
import type { CellMatrix } from "../types";
import { getSheetIndex } from "../utils";
import { execfunction, execFunctionGroup, groupValuesRefresh } from "./formula";
import {
  forgetDynamicDependencies,
  isGhostOf,
  isGrowingSheet,
  isRecalculating,
  SpillCell,
  takeSpillGrowthRequests,
  withoutSpillGrowth,
} from "./formulaFunctions";
import {
  getSheetDataCached,
  peek,
  peekCell,
  peekSheet,
} from "./dependencyGraph";
// eslint-disable-next-line import/no-cycle
import { insertRowCol } from "./rowcol";
import {
  anchorIndexes,
  graphToken,
  isSpillStructureFullScan,
  mapRect,
  PENDING_INDEX,
  SheetAnchorIndex,
  SpillAnchor,
  spillAnchorsOf,
  SpillStructureChange,
} from "./spillIndex";

export {
  invalidateSpillAnchors,
  noteSpillAnchor,
  setSpillStructureFullScan,
  spillAnchorsOf,
} from "./spillIndex";
export type { SpillAnchor, SpillStructureChange } from "./spillIndex";

type RangeLike = { row: number[]; column: number[] };
type ChangedCell = { r: number; c: number; i: string };

export type SpillReconcileOptions = {
  /**
   * Regions just written by a paste, fill or move: copies of spilled cells
   * found there become plain values, and formulas there are re-spilled.
   */
  pasted?: RangeLike[] | null;
  /** Other regions whose content changed (sort range, cut source). */
  changed?: RangeLike[] | null;
  /** Re-spill every anchor of the sheet (rows or columns moved). */
  all?: boolean;
  /**
   * With `all`: regions known to hold every spilled cell of the sheet (the
   * rectangles of its anchors, see onSpillStructureChange), so the sheet is
   * not scanned as a whole.
   */
  scope?: RangeLike[] | null;
};

/** Sheet limits (Excel's grid). */
export const SPILL_MAX_ROWS = 1048576;
export const SPILL_MAX_COLS = 16384;
/** A sheet grows by whole chunks of rows / columns for a spill. */
const GROW_ROWS_CHUNK = 100;
const GROW_COLS_CHUNK = 10;

const STRIDE = 1 << 20;

function cellKey(r: number, c: number) {
  return r * STRIDE + c;
}

function inRanges(
  ranges: RangeLike[] | null | undefined,
  r: number,
  c: number
) {
  if (!ranges) return false;
  for (let i = 0; i < ranges.length; i += 1) {
    const g = ranges[i];
    if (
      g &&
      r >= g.row[0] &&
      r <= g.row[1] &&
      c >= g.column[0] &&
      c <= g.column[1]
    ) {
      return true;
    }
  }
  return false;
}

function rectTouches(
  ranges: RangeLike[] | null | undefined,
  r: number,
  c: number,
  rs: number,
  cs: number
) {
  if (!ranges) return false;
  for (let i = 0; i < ranges.length; i += 1) {
    const g = ranges[i];
    if (
      g &&
      r <= g.row[1] &&
      r + rs - 1 >= g.row[0] &&
      c <= g.column[1] &&
      c + cs - 1 >= g.column[0]
    ) {
      return true;
    }
  }
  return false;
}

/** Remove a spilled value from a cell, keeping the cell's own formatting. */
function clearSpilledCell(data: CellMatrix, r: number, c: number) {
  const cell = data[r]?.[c] as SpillCell | null | undefined;
  if (!cell) return;
  delete cell.v;
  delete cell.m;
  delete cell.spillFrom;
  if (cell.ct && (!cell.ct.fa || cell.ct.fa === "General")) delete cell.ct;
  if (_.isEmpty(cell)) data[r][c] = null;
}

type Anchor = {
  r: number;
  c: number;
  rs: number;
  cs: number;
  blocked: boolean;
};

/** Whether every cell of an anchor's rectangle is one of its spilled cells. */
function isIntact(view: CellMatrix, a: Anchor) {
  if (a.r + a.rs > view.length) return false;
  for (let i = 0; i < a.rs; i += 1) {
    const row = peek(view[a.r + i]);
    if (!row || a.c + a.cs > row.length) return false;
    for (let j = 0; j < a.cs; j += 1) {
      if (i === 0 && j === 0) continue;
      const cell = peek(row[a.c + j]) as SpillCell | null;
      if (!isGhostOf(cell, a.r + i, a.c + j, a.r, a.c)) return false;
    }
  }
  return true;
}

/**
 * Evaluate formula cells again (in place) and recalculate what depends on
 * them and on `changed`.
 */
function reevaluate(
  ctx: Context,
  id: string,
  cells: { r: number; c: number }[],
  changed: ChangedCell[]
) {
  const fc = ctx.formulaCache;
  const data = getFlowdata(ctx, id);
  if (data) {
    cells.forEach(({ r, c }) => {
      const cell = data[r]?.[c] as SpillCell | null;
      if (!cell?.f) return;
      const v = execfunction(ctx, cell.f, r, c, id);
      ctx.groupValuesRefreshData.push({ r, c, v: v[1], f: v[2], id });
      fc.setGlobalCell(r, c, id, { v: v[1], f: v[2] });
      changed.push({ r, c, i: id });
    });
  }
  if (changed.length === 0) return;
  fc.execFunctionExist = _.uniqBy(changed, (x) => `${x.r}_${x.c}_${x.i}`);
  // @ts-ignore
  execFunctionGroup(ctx, null, null, null, id);
}

type Ghost = { r: number; c: number; ar: number; ac: number };

/** The spill-related cells `reconcileSpills` works on (see scanSpillCells). */
export type SpillScan = {
  anchors: Map<number, Anchor>;
  ghosts: Ghost[];
  /** Formulas copied into a pasted region without being evaluated there. */
  pastedFormulas: { r: number; c: number }[];
  /** Formula cells wrongly carrying a `spillFrom` tag. */
  taggedFormulas: { r: number; c: number }[];
  /** Number of cells looked at. */
  visited: number;
};

/**
 * Collect the anchors, spilled cells and stray formulas `reconcileSpills`
 * works on.
 *
 * With `all` (rows or columns moved) or `full`, every cell of the sheet is
 * looked at. Otherwise only the cells that can matter are: the regions the
 * operation wrote or changed, the formula cells the engine knows (`chain`,
 * the sheet's calcChain, from which the dependency graph is indexed) and the
 * rectangles of the anchors found there. Spilled cells elsewhere belong to
 * anchors the operation did not touch, which leave them alone, so both give
 * the same result as long as the sheet was reconciled before the operation.
 */
export function scanSpillCells(
  view: CellMatrix,
  options: SpillReconcileOptions,
  chain: { r: number; c: number }[] | null | undefined,
  full = false
): SpillScan {
  const { pasted, changed, all } = options;
  const out: SpillScan = {
    anchors: new Map(),
    ghosts: [],
    pastedFormulas: [],
    taggedFormulas: [],
    visited: 0,
  };
  const pending: Anchor[] = [];
  const visit = (r: number, c: number, cell: SpillCell | null) => {
    out.visited += 1;
    if (!cell) return;
    if (cell.f) {
      // a formula never is a spilled cell
      if (cell.spillFrom) out.taggedFormulas.push({ r, c });
      if (cell.spill) {
        const a: Anchor = {
          r,
          c,
          rs: cell.spill.rs,
          cs: cell.spill.cs,
          blocked: !!cell.spill.blocked,
        };
        out.anchors.set(cellKey(r, c), a);
        pending.push(a);
      } else if (Array.isArray(cell.v) && inRanges(pasted, r, c)) {
        // a formula copied without evaluating it in place (fill)
        out.pastedFormulas.push({ r, c });
      }
    } else if (cell.spillFrom) {
      out.ghosts.push({
        r,
        c,
        ar: r - cell.spillFrom.dr,
        ac: c - cell.spillFrom.dc,
      });
    }
  };

  if (all || full) {
    for (let r = 0; r < view.length; r += 1) {
      const row = peek(view[r]);
      if (!row) continue;
      for (let c = 0; c < row.length; c += 1) {
        visit(r, c, peek(row[c]) as SpillCell | null);
      }
    }
    return out;
  }

  const seen = new Set<number>();
  const visitOnce = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= view.length) return;
    const key = cellKey(r, c);
    if (seen.has(key)) return;
    seen.add(key);
    visit(r, c, peekCell(view, r, c) as SpillCell | null);
  };
  const visitRect = (r0: number, c0: number, r1: number, c1: number) => {
    const rEnd = Math.min(r1, view.length - 1);
    for (let r = Math.max(r0, 0); r <= rEnd; r += 1) {
      const row = peek(view[r]);
      if (!row) continue;
      const cEnd = Math.min(c1, row.length - 1);
      for (let c = Math.max(c0, 0); c <= cEnd; c += 1) visitOnce(r, c);
    }
  };
  const regions = [...(pasted ?? []), ...(changed ?? [])].filter(Boolean);
  regions.forEach((g) => {
    visitRect(g.row[0], g.column[0], g.row[1], g.column[1]);
  });
  // Cells spilled by an anchor that sat in a region before the operation
  // (cut, moved, sorted or overwritten) can lie outside every region: they
  // are reached from the regions' bottom and right edges, going down and
  // right through cells spilled from an anchor inside a region (a spill
  // rectangle grows down and right from its anchor).
  const cols = peek(view[0])?.length ?? 0;
  const flood: number[] = [];
  regions.forEach((g) => {
    const below = g.row[1] + 1;
    const right = g.column[1] + 1;
    if (below < view.length) {
      const cEnd = Math.min(right, cols - 1);
      for (let c = Math.max(g.column[0], 0); c <= cEnd; c += 1) {
        flood.push(below, c);
      }
    }
    if (right < cols) {
      const rEnd = Math.min(g.row[1], view.length - 1);
      for (let r = Math.max(g.row[0], 0); r <= rEnd; r += 1) {
        flood.push(r, right);
      }
    }
  });
  while (flood.length > 0) {
    const c = flood.pop()!;
    const r = flood.pop()!;
    if (r >= view.length || seen.has(cellKey(r, c))) continue;
    const cell = peekCell(view, r, c) as SpillCell | null;
    const from = cell && !cell.f ? cell.spillFrom : null;
    if (from && inRanges(regions, r - from.dr, c - from.dc)) {
      visitOnce(r, c);
      flood.push(r + 1, c, r, c + 1);
    }
  }
  (chain ?? []).forEach((item) => {
    const it = peek(item);
    if (it) visitOnce(it.r, it.c);
  });
  // the anchors of the spilled cells found, and the spilled cells of every
  // anchor found (which may point at further anchors)
  let ghostsDone = 0;
  while (pending.length > 0 || ghostsDone < out.ghosts.length) {
    while (ghostsDone < out.ghosts.length) {
      const g = out.ghosts[ghostsDone];
      ghostsDone += 1;
      visitOnce(g.ar, g.ac);
    }
    const a = pending.pop();
    if (a) visitRect(a.r, a.c, a.r + a.rs - 1, a.c + a.cs - 1);
  }
  // reading order, as a full scan finds them
  const byPosition = (
    x: { r: number; c: number },
    y: { r: number; c: number }
  ) => x.r - y.r || x.c - y.c;
  out.ghosts.sort(byPosition);
  out.pastedFormulas.sort(byPosition);
  out.taggedFormulas.sort(byPosition);
  return out;
}

type ScanVerifier = (restricted: SpillScan, full: SpillScan) => void;
let scanVerifier: ScanVerifier | null = null;

/**
 * Tests: have every `reconcileSpills` also scan the whole sheet and hand
 * both scans to `fn` (null turns it off).
 */
export function setSpillScanVerifier(fn: ScanVerifier | null) {
  scanVerifier = fn;
}

/**
 * Bring the spills of a sheet back in line with its cells after an operation
 * moved or copied cells (see the module comment). Applies all pending value
 * writes first, and leaves none behind.
 */
export function reconcileSpills(
  ctx: Context,
  id: string | undefined,
  options: SpillReconcileOptions = {}
) {
  if (id == null || getSheetIndex(ctx, id) == null) return;
  if (!ctx.groupValuesRefreshData) ctx.groupValuesRefreshData = [];
  const fc = ctx.formulaCache;
  // the sheet data is the truth from here on
  groupValuesRefresh(ctx);
  fc.execFunctionGlobalData = null;

  const { pasted, changed: changedRanges, all } = options;
  const view = getSheetDataCached(ctx, id) as CellMatrix | null;
  if (!view) return;

  const chain = peek(peekSheet(ctx, id)?.calcChain);
  // all anchors re-spill; with a scope only its regions (plus the formula
  // cells and the anchors' rectangles) are looked at
  const scanOptions: SpillReconcileOptions =
    all && options.scope ? { changed: options.scope } : options;
  const scan = scanSpillCells(view, scanOptions, chain);
  if (scanVerifier)
    scanVerifier(scan, scanSpillCells(view, scanOptions, chain, true));
  const { anchors, ghosts, pastedFormulas, taggedFormulas } = scan;

  const respill = new Set<number>();
  anchors.forEach((a, key) => {
    if (
      all ||
      a.blocked ||
      inRanges(pasted, a.r, a.c) ||
      inRanges(changedRanges, a.r, a.c) ||
      rectTouches(pasted, a.r, a.c, a.rs, a.cs) ||
      rectTouches(changedRanges, a.r, a.c, a.rs, a.cs) ||
      !isIntact(view, a)
    ) {
      respill.add(key);
    }
  });

  if (
    ghosts.length === 0 &&
    respill.size === 0 &&
    pastedFormulas.length === 0 &&
    taggedFormulas.length === 0
  ) {
    return;
  }

  const data = getFlowdata(ctx, id)!;
  const changed: ChangedCell[] = [];
  taggedFormulas.forEach(({ r, c }) => {
    delete (data[r][c] as SpillCell).spillFrom;
  });
  ghosts.forEach((g) => {
    const akey = cellKey(g.ar, g.ac);
    const a = anchors.get(akey);
    const covered =
      !!a &&
      !a.blocked &&
      g.r - a.r < a.rs &&
      g.c - a.c < a.cs &&
      (g.r !== a.r || g.c !== a.c);
    if (covered && !respill.has(akey)) return; // a live spilled cell
    if (!covered && inRanges(pasted, g.r, g.c)) {
      // a copy of a spilled cell, pasted without its anchor: a plain value
      delete (data[g.r][g.c] as SpillCell).spillFrom;
      return;
    }
    // spilled by an anchor that is gone, moved, or spills again below
    clearSpilledCell(data, g.r, g.c);
    changed.push({ r: g.r, c: g.c, i: id });
  });

  const cells: { r: number; c: number }[] = [];
  respill.forEach((key) => {
    const a = anchors.get(key)!;
    delete (data[a.r][a.c] as SpillCell).spill;
    cells.push({ r: a.r, c: a.c });
  });
  cells.push(...pastedFormulas);
  cells.sort((x, y) => x.r - y.r || x.c - y.c);
  reevaluate(ctx, id, cells, changed);
  groupValuesRefresh(ctx);
  fc.execFunctionGlobalData = null;
}

/**
 * After rows or columns of sheet `id` were inserted or deleted: every anchor
 * of the sheet spills again from where it is now (its formula may have been
 * adjusted too), spilled cells cut off from their anchor are cleared, and
 * anchors on other sheets whose formulas mention this sheet are re-spilled.
 */
export function onSpillStructureChange(
  ctx: Context,
  id: string | undefined,
  change?: SpillStructureChange,
  before?: SpillAnchor[] | null
) {
  // growing a sheet for a spill only appends rows / columns at its edge
  if (id == null || isGrowingSheet(ctx)) return;
  forgetDynamicDependencies(ctx, id);
  // Every spilled cell lay in the rectangle of an anchor before the change
  // (the sheet was reconciled), so the images of those rectangles hold every
  // spilled cell now: only they are looked at, not the whole sheet.
  const scope =
    change && before && !isSpillStructureFullScan()
      ? before
          .map((a) => mapRect(a, change))
          .filter((g): g is RangeLike => g != null)
      : null;
  // the anchor index of the sheet is rebuilt by the re-spills (noteSpillAnchor)
  const indexes = anchorIndexes(ctx);
  const rebuilt: SheetAnchorIndex = {
    token: PENDING_INDEX,
    anchors: new Map(),
  };
  indexes?.set(id, rebuilt);
  reconcileSpills(ctx, id, { all: true, scope });
  if (indexes?.get(id) === rebuilt) {
    const token = graphToken(ctx);
    if (token != null) rebuilt.token = token;
    else indexes.delete(id);
  }
  const idx = getSheetIndex(ctx, id);
  const name = (idx == null ? "" : ctx.luckysheetfile[idx].name ?? "")
    .toLowerCase()
    .replace(/'/g, "''");
  if (!name) return;
  ctx.luckysheetfile.forEach((file) => {
    if (file.id == null || file.id === id) return;
    const view = getSheetDataCached(ctx, file.id);
    const cells: { r: number; c: number }[] = [];
    spillAnchorsOf(ctx, file.id).forEach((a) => {
      const cell = peekCell(view, a.r, a.c) as SpillCell | null;
      if (cell?.f?.toLowerCase().includes(name)) {
        cells.push({ r: a.r, c: a.c });
      }
    });
    if (cells.length > 0) {
      cells.sort((x, y) => x.r - y.r || x.c - y.c);
      reconcileSpills(ctx, file.id, {
        changed: cells.map(({ r, c }) => ({ row: [r, r], column: [c, c] })),
      });
    }
  });
}

/** Insert rows / columns at the bottom / right edge of a sheet. */
function growSheet(
  ctx: Context,
  id: string,
  type: "row" | "column",
  current: number,
  needed: number
) {
  const cap = type === "row" ? SPILL_MAX_ROWS : SPILL_MAX_COLS;
  const chunk = type === "row" ? GROW_ROWS_CHUNK : GROW_COLS_CHUNK;
  const extra = needed - current;
  const chunked = Math.min(Math.ceil(extra / chunk) * chunk, cap - current);
  const counts = _.uniq([chunked, extra]).filter((n) => n >= extra);
  for (let i = 0; i < counts.length; i += 1) {
    try {
      insertRowCol(
        ctx,
        {
          type,
          index: Math.max(current - 1, 0),
          count: counts[i],
          direction: "rightbottom",
          id,
        },
        false
      );
      return true;
    } catch (e) {
      // over the sheet size limit of insertRowCol: try the exact size
    }
  }
  return false;
}

/**
 * Called when a top-level recalculation ends: grows sheets for spills that
 * ran past their edge (up to Excel's 1,048,576 rows and 16,384 columns, in
 * chunks, through insertRowCol) and evaluates those anchors again. When a
 * sheet cannot grow, the anchor keeps showing #SPILL!.
 */
export function settleSpillGrowth(ctx: Context) {
  if (isRecalculating(ctx) || isGrowingSheet(ctx)) return;
  const requests = takeSpillGrowthRequests(ctx);
  if (!requests) return;
  withoutSpillGrowth(ctx, () => {
    _.forEach(_.groupBy(requests, "id"), (reqs, id) => {
      const data = getFlowdata(ctx, id);
      if (!data) return;
      const rows = data.length;
      const cols = data[0]?.length ?? 0;
      const needRows = _.max(reqs.map((q) => q.rows)) ?? 0;
      const needCols = _.max(reqs.map((q) => q.cols)) ?? 0;
      let ok = true;
      if (needRows > rows) ok = growSheet(ctx, id, "row", rows, needRows);
      if (ok && needCols > cols) {
        ok = growSheet(ctx, id, "column", cols, needCols);
      }
      if (!ok) return;
      _.uniqBy(reqs, (q) => `${q.r}_${q.c}`).forEach((q) => {
        const cell = getFlowdata(ctx, id)?.[q.r]?.[q.c] as SpillCell | null;
        // the anchor may still be on its way into the cell (cell editor)
        if (cell?.f != null && cell.f !== q.f) return;
        const v = execfunction(ctx, q.f, q.r, q.c, id, undefined, true);
        ctx.groupValuesRefreshData.push({
          r: q.r,
          c: q.c,
          v: v[1],
          f: v[2],
          id,
        });
        ctx.formulaCache.setGlobalCell(q.r, q.c, id, { v: v[1], f: v[2] });
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Queries for the UI
// ---------------------------------------------------------------------------

export type SpillRangeInfo = {
  /** The anchor (formula) cell. */
  r: number;
  c: number;
  /** Size of the spill (the size it needs when blocked). */
  rs: number;
  cs: number;
  /** The spill is blocked: the anchor shows #SPILL!. */
  blocked: boolean;
};

/**
 * The spill range the cell (r, c) belongs to (as anchor or as spilled cell),
 * or null.
 */
export function getSpillRange(
  ctx: Context,
  r: number,
  c: number,
  id: string = ctx.currentSheetId
): SpillRangeInfo | null {
  const view = getSheetDataCached(ctx, id);
  if (!view || r == null || c == null) return null;
  let cell = peekCell(view, r, c) as SpillCell | null;
  let ar = r;
  let ac = c;
  if (!cell?.f && cell?.spillFrom) {
    ar = r - cell.spillFrom.dr;
    ac = c - cell.spillFrom.dc;
    cell = peekCell(view, ar, ac) as SpillCell | null;
  }
  const sp = cell?.f ? cell.spill : undefined;
  if (!sp) return null;
  if (r - ar >= sp.rs || c - ac >= sp.cs) return null;
  if ((r !== ar || c !== ac) && sp.blocked) return null;
  return { r: ar, c: ac, rs: sp.rs, cs: sp.cs, blocked: !!sp.blocked };
}

/**
 * The formula of the anchor that spilled into (r, c), for a spilled cell
 * (not the anchor itself); null otherwise. The formula bar shows it greyed
 * out, like Excel.
 */
export function getSpilledCellFormula(
  ctx: Context,
  r: number,
  c: number,
  id: string = ctx.currentSheetId
): string | null {
  const range = getSpillRange(ctx, r, c, id);
  if (!range || (range.r === r && range.c === c)) return null;
  const anchor = peekCell(getSheetDataCached(ctx, id), range.r, range.c);
  return anchor?.f ?? null;
}

/**
 * The cells that keep the anchor at (r, c) from spilling ("Spill range isn't
 * blank"), in reading order. Empty when the anchor is not blocked by cells
 * (e.g. it is not blocked at all).
 */
export function getSpillObstructingCells(
  ctx: Context,
  r: number,
  c: number,
  id: string = ctx.currentSheetId
): { r: number; c: number }[] {
  const range = getSpillRange(ctx, r, c, id);
  if (!range?.blocked || range.r !== r || range.c !== c) return [];
  const view = getSheetDataCached(ctx, id);
  const out: { r: number; c: number }[] = [];
  for (let i = 0; i < range.rs; i += 1) {
    for (let j = 0; j < range.cs; j += 1) {
      if (i === 0 && j === 0) continue;
      const cell = peekCell(view, r + i, c + j) as SpillCell | null;
      if (
        cell &&
        (cell.f != null ||
          cell.mc != null ||
          cell.spillFrom != null ||
          (cell.v != null && cell.v !== "") ||
          (cell.ct?.t === "inlineStr" && !_.isEmpty(cell.ct.s)))
      ) {
        out.push({ r: r + i, c: c + j });
      }
    }
  }
  return out;
}

/**
 * After cells moved from `source` to `target` (cut/paste, possibly across
 * sheets): the target holds pasted content, the source is changed.
 */
export function reconcileSpillsAfterMove(
  ctx: Context,
  source: { sheetId: string; range: RangeLike },
  target: { sheetId: string; range: RangeLike }
) {
  if (source.sheetId !== target.sheetId) {
    reconcileSpills(ctx, source.sheetId, { changed: [source.range] });
    reconcileSpills(ctx, target.sheetId, { pasted: [target.range] });
  } else {
    reconcileSpills(ctx, target.sheetId, {
      pasted: [target.range],
      changed: [source.range],
    });
  }
}
