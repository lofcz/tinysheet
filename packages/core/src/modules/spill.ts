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
import { getSheetDataCached, peek, peekCell } from "./dependencyGraph";
// eslint-disable-next-line import/no-cycle
import { insertRowCol } from "./rowcol";

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

  const anchors = new Map<number, Anchor>();
  const ghosts: { r: number; c: number; ar: number; ac: number }[] = [];
  const pastedFormulas: { r: number; c: number }[] = [];
  const taggedFormulas: { r: number; c: number }[] = [];
  for (let r = 0; r < view.length; r += 1) {
    const row = peek(view[r]);
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = peek(row[c]) as SpillCell | null;
      if (cell) {
        if (cell.f) {
          // a formula never is a spilled cell
          if (cell.spillFrom) taggedFormulas.push({ r, c });
          if (cell.spill) {
            anchors.set(cellKey(r, c), {
              r,
              c,
              rs: cell.spill.rs,
              cs: cell.spill.cs,
              blocked: !!cell.spill.blocked,
            });
          } else if (Array.isArray(cell.v) && inRanges(pasted, r, c)) {
            // a formula copied without evaluating it in place (fill)
            pastedFormulas.push({ r, c });
          }
        } else if (cell.spillFrom) {
          ghosts.push({
            r,
            c,
            ar: r - cell.spillFrom.dr,
            ac: c - cell.spillFrom.dc,
          });
        }
      }
    }
  }

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
export function onSpillStructureChange(ctx: Context, id: string | undefined) {
  // growing a sheet for a spill only appends rows / columns at its edge
  if (id == null || isGrowingSheet(ctx)) return;
  forgetDynamicDependencies(ctx, id);
  reconcileSpills(ctx, id, { all: true });
  const idx = getSheetIndex(ctx, id);
  const name = (idx == null ? "" : ctx.luckysheetfile[idx].name ?? "")
    .toLowerCase()
    .replace(/'/g, "''");
  if (!name) return;
  ctx.luckysheetfile.forEach((file) => {
    if (file.id == null || file.id === id) return;
    const view = getSheetDataCached(ctx, file.id);
    const cells: { r: number; c: number }[] = [];
    (peek(file.calcChain) ?? []).forEach((item: any) => {
      const it = peek(item);
      const cell = peekCell(view, it.r, it.c) as SpillCell | null;
      if (cell?.spill && cell.f?.toLowerCase().includes(name)) {
        cells.push({ r: it.r, c: it.c });
      }
    });
    if (cells.length > 0) {
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
