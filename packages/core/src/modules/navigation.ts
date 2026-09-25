/**
 * Excel-style keyboard navigation and selection helpers.
 *
 * The pure helpers at the top (edge finding, current region, last used cell,
 * moving inside a selection) take plain callbacks so they can be unit-tested
 * without a full context. The context-aware helpers below them read the
 * current sheet, respect hidden rows/columns and merged cells, update
 * `ctx.luckysheet_select_save` and scroll the active cell into view.
 */
import _ from "lodash";
import { Context, getFlowdata } from "../context";
import type { Cell, CellMatrix, Selection } from "../types";
import { getSheetIndex } from "../utils";
import { cellFocus } from "./dataVerification";
import { normalizeSelection, scrollToHighlightCell } from "./selection";

export type NavDirection = "up" | "down" | "left" | "right";

export type SimpleRange = { row: [number, number]; column: [number, number] };

export type MergeMap = Record<
  string,
  { r: number; c: number; rs: number; cs: number }
>;

/* ------------------------------------------------------------------------ */
/* Pure helpers                                                              */
/* ------------------------------------------------------------------------ */

/** Whether a cell holds content (a value, a formula or rich text). */
export function cellHasValue(cell: Cell | null | undefined): boolean {
  if (cell == null) return false;
  if (cell.f != null && cell.f !== "") return true;
  if (cell.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    return cell.ct.s.some(
      (seg: { v?: unknown }) => seg?.v != null && seg.v !== ""
    );
  }
  return cell.v != null && cell.v !== "";
}

/**
 * Next index along an axis, skipping hidden rows/columns.
 * Returns null when there is no visible index in that direction.
 */
export function nextVisibleIndex(
  pos: number,
  dir: 1 | -1,
  length: number,
  isHidden?: (i: number) => boolean
): number | null {
  let i = pos + dir;
  while (i >= 0 && i < length) {
    if (!isHidden?.(i)) return i;
    i += dir;
  }
  return null;
}

/**
 * Excel's Ctrl+Arrow rule along one axis.
 *
 * - From a filled cell whose neighbour is filled: go to the last filled cell
 *   before the next blank.
 * - Otherwise (current or neighbour blank): go to the next filled cell, or to
 *   the sheet edge when there is none.
 *
 * Hidden rows/columns are skipped entirely.
 */
export function findDataEdge(
  pos: number,
  dir: 1 | -1,
  length: number,
  isFilled: (i: number) => boolean,
  isHidden?: (i: number) => boolean
): number {
  const next = nextVisibleIndex(pos, dir, length, isHidden);
  if (next == null) return pos;

  let cur = next;
  if (isFilled(pos) && isFilled(next)) {
    for (;;) {
      const n = nextVisibleIndex(cur, dir, length, isHidden);
      if (n == null || !isFilled(n)) return cur;
      cur = n;
    }
  }
  for (;;) {
    if (isFilled(cur)) return cur;
    const n = nextVisibleIndex(cur, dir, length, isHidden);
    if (n == null) return cur;
    cur = n;
  }
}

/**
 * The "current region" around (r, c): the smallest rectangle bounded by
 * blank rows and columns (diagonal neighbours count), like Excel's
 * Ctrl+Shift+* / first Ctrl+A. Returns null when the cell and all its
 * neighbours are blank.
 */
export function getCurrentRegion(
  isFilled: (row: number, col: number) => boolean,
  r: number,
  c: number,
  rowCount: number,
  colCount: number
): SimpleRange | null {
  let r1 = r;
  let r2 = r;
  let c1 = c;
  let c2 = c;

  const rowHasData = (row: number, from: number, to: number) => {
    for (
      let col = Math.max(0, from);
      col <= Math.min(colCount - 1, to);
      col += 1
    ) {
      if (isFilled(row, col)) return true;
    }
    return false;
  };
  const colHasData = (col: number, from: number, to: number) => {
    for (
      let row = Math.max(0, from);
      row <= Math.min(rowCount - 1, to);
      row += 1
    ) {
      if (isFilled(row, col)) return true;
    }
    return false;
  };

  let changed = true;
  while (changed) {
    changed = false;
    if (r1 > 0 && rowHasData(r1 - 1, c1 - 1, c2 + 1)) {
      r1 -= 1;
      changed = true;
    }
    if (r2 < rowCount - 1 && rowHasData(r2 + 1, c1 - 1, c2 + 1)) {
      r2 += 1;
      changed = true;
    }
    if (c1 > 0 && colHasData(c1 - 1, r1 - 1, r2 + 1)) {
      c1 -= 1;
      changed = true;
    }
    if (c2 < colCount - 1 && colHasData(c2 + 1, r1 - 1, r2 + 1)) {
      c2 += 1;
      changed = true;
    }
  }

  if (r1 === r2 && c1 === c2 && !isFilled(r, c)) return null;
  return { row: [r1, r2], column: [c1, c2] };
}

/**
 * Ctrl+End target: the intersection of the last row and the last column that
 * contain data. Returns [0, 0] for an empty sheet.
 */
export function getLastUsedCell(data: CellMatrix): [number, number] {
  let lastRow = 0;
  let lastCol = 0;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      if (cellHasValue(row[c])) {
        if (r > lastRow) lastRow = r;
        if (c > lastCol) lastCol = c;
      }
    }
  }
  return [lastRow, lastCol];
}

/**
 * Next active cell inside a multi-cell selection (Enter/Tab in Excel):
 * Enter walks down each column and wraps to the next column, Tab walks right
 * along each row and wraps to the next row; Shift reverses. Cells for which
 * `skip` returns true (hidden, or covered by a merge) are stepped over.
 */
export function nextCellInRange(
  range: SimpleRange,
  r: number,
  c: number,
  dir: NavDirection,
  skip?: (row: number, col: number) => boolean
): [number, number] {
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;
  const total = (r2 - r1 + 1) * (c2 - c1 + 1);
  let row = r;
  let col = c;
  for (let i = 0; i < total; i += 1) {
    if (dir === "down") {
      row += 1;
      if (row > r2) {
        row = r1;
        col = col + 1 > c2 ? c1 : col + 1;
      }
    } else if (dir === "up") {
      row -= 1;
      if (row < r1) {
        row = r2;
        col = col - 1 < c1 ? c2 : col - 1;
      }
    } else if (dir === "right") {
      col += 1;
      if (col > c2) {
        col = c1;
        row = row + 1 > r2 ? r1 : row + 1;
      }
    } else {
      col -= 1;
      if (col < c1) {
        col = c2;
        row = row - 1 < r1 ? r2 : row - 1;
      }
    }
    if (!skip?.(row, col)) return [row, col];
  }
  return [r, c];
}

/** Grows a range until it fully contains every merged block it touches. */
export function expandRangeForMerges(
  range: SimpleRange,
  merges: MergeMap | undefined
): SimpleRange {
  const out: SimpleRange = {
    row: [range.row[0], range.row[1]],
    column: [range.column[0], range.column[1]],
  };
  if (!merges) return out;
  const list = Object.values(merges);
  if (list.length === 0) return out;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length; i += 1) {
      const m = list[i];
      const mr2 = m.r + m.rs - 1;
      const mc2 = m.c + m.cs - 1;
      const intersects =
        m.r <= out.row[1] &&
        mr2 >= out.row[0] &&
        m.c <= out.column[1] &&
        mc2 >= out.column[0];
      if (intersects) {
        const r1 = Math.min(out.row[0], m.r);
        const r2 = Math.max(out.row[1], mr2);
        const c1 = Math.min(out.column[0], m.c);
        const c2 = Math.max(out.column[1], mc2);
        if (
          r1 !== out.row[0] ||
          r2 !== out.row[1] ||
          c1 !== out.column[0] ||
          c2 !== out.column[1]
        ) {
          out.row = [r1, r2];
          out.column = [c1, c2];
          changed = true;
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Context helpers                                                           */
/* ------------------------------------------------------------------------ */

export type SheetNavInfo = {
  data: CellMatrix;
  rows: number;
  cols: number;
  merges: MergeMap;
  isRowHidden: (r: number) => boolean;
  isColHidden: (c: number) => boolean;
  /** Merge block containing (r, c), or the single cell. */
  blockAt: (r: number, c: number) => SimpleRange;
  isFilled: (r: number, c: number) => boolean;
  frozenRows: number;
  frozenCols: number;
};

export function getSheetNavInfo(ctx: Context): SheetNavInfo | null {
  const data = getFlowdata(ctx);
  if (!data || data.length === 0) return null;
  const idx = getSheetIndex(ctx, ctx.currentSheetId);
  const sheet = idx == null ? null : ctx.luckysheetfile[idx];
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const rowhidden = ctx.config?.rowhidden ?? {};
  const colhidden = ctx.config?.colhidden ?? {};
  const merges = (ctx.config?.merge ?? {}) as MergeMap;

  const blockAt = (r: number, c: number): SimpleRange => {
    const mc = data[r]?.[c]?.mc;
    if (mc) {
      const m = merges[`${mc.r}_${mc.c}`];
      if (m) {
        return {
          row: [m.r, m.r + m.rs - 1],
          column: [m.c, m.c + m.cs - 1],
        };
      }
    }
    return { row: [r, r], column: [c, c] };
  };

  const isFilled = (r: number, c: number) => {
    const cell = data[r]?.[c];
    if (cell?.mc && (cell.mc.r !== r || cell.mc.c !== c)) {
      return cellHasValue(data[cell.mc.r]?.[cell.mc.c]);
    }
    return cellHasValue(cell);
  };

  let frozenRows = 0;
  let frozenCols = 0;
  const frozen = sheet?.frozen;
  if (frozen) {
    const rf = frozen.range?.row_focus ?? 0;
    const cf = frozen.range?.column_focus ?? 0;
    if (["row", "both", "rangeRow", "rangeBoth"].includes(frozen.type)) {
      frozenRows = rf + 1;
    }
    if (["column", "both", "rangeColumn", "rangeBoth"].includes(frozen.type)) {
      frozenCols = cf + 1;
    }
  }

  return {
    data,
    rows,
    cols,
    merges,
    isRowHidden: (r) => rowhidden[r] != null,
    isColHidden: (c) => colhidden[c] != null,
    blockAt,
    isFilled,
    frozenRows,
    frozenCols,
  };
}

function lastSelection(ctx: Context): Selection | undefined {
  return ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
}

/** Active cell (focus) of the last selection. */
export function getActiveCell(ctx: Context): [number, number] | null {
  const last = lastSelection(ctx);
  if (!last) return null;
  const r = last.row_focus ?? last.row[0];
  const c = last.column_focus ?? last.column[0];
  if (_.isNil(r) || _.isNil(c)) return null;
  return [r, c];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Replaces the selection with `range` (expanded to cover merges) and makes
 * (focusR, focusC) the active cell; scrolls `scrollTo` (default: the active
 * cell) into view.
 */
export function setSelectionRange(
  ctx: Context,
  range: SimpleRange,
  focusR: number,
  focusC: number,
  options: {
    scrollTo?: [number, number];
    rowSelect?: boolean;
    columnSelect?: boolean;
  } = {}
) {
  const info = getSheetNavInfo(ctx);
  if (!info) return;
  const expanded = expandRangeForMerges(
    {
      row: [
        clamp(Math.min(range.row[0], range.row[1]), 0, info.rows - 1),
        clamp(Math.max(range.row[0], range.row[1]), 0, info.rows - 1),
      ],
      column: [
        clamp(Math.min(range.column[0], range.column[1]), 0, info.cols - 1),
        clamp(Math.max(range.column[0], range.column[1]), 0, info.cols - 1),
      ],
    },
    info.merges
  );
  const block = info.blockAt(focusR, focusC);
  const sel: Selection = {
    row: expanded.row,
    column: expanded.column,
    row_focus: block.row[0],
    column_focus: block.column[0],
  };
  if (options.rowSelect) sel.row_select = true;
  if (options.columnSelect) sel.column_select = true;
  ctx.luckysheet_select_status = false;
  ctx.luckysheet_select_save = normalizeSelection(ctx, [sel]);
  const [sr, sc] = options.scrollTo ?? [block.row[0], block.column[0]];
  scrollToHighlightCell(ctx, sr, sc);
}

/** Makes (r, c) the only selected cell (the whole merge when merged). */
export function setActiveCell(ctx: Context, r: number, c: number) {
  const info = getSheetNavInfo(ctx);
  if (!info) return;
  const row = clamp(r, 0, info.rows - 1);
  const col = clamp(c, 0, info.cols - 1);
  const block = info.blockAt(row, col);
  setSelectionRange(ctx, block, block.row[0], block.column[0]);
  cellFocus(ctx, block.row[0], block.column[0], false);
}

const DIRS: Record<NavDirection, { axis: "row" | "col"; dir: 1 | -1 }> = {
  up: { axis: "row", dir: -1 },
  down: { axis: "row", dir: 1 },
  left: { axis: "col", dir: -1 },
  right: { axis: "col", dir: 1 },
};

/** Arrow key: moves the active cell one visible cell, stepping over merges. */
export function moveActiveCell(ctx: Context, direction: NavDirection) {
  const info = getSheetNavInfo(ctx);
  const active = getActiveCell(ctx);
  if (!info || !active) return;
  const { axis, dir } = DIRS[direction];
  const block = info.blockAt(active[0], active[1]);
  if (axis === "row") {
    const from = dir > 0 ? block.row[1] : block.row[0];
    const next = nextVisibleIndex(from, dir, info.rows, info.isRowHidden);
    setActiveCell(ctx, next ?? active[0], active[1]);
  } else {
    const from = dir > 0 ? block.column[1] : block.column[0];
    const next = nextVisibleIndex(from, dir, info.cols, info.isColHidden);
    setActiveCell(ctx, active[0], next ?? active[1]);
  }
}

/**
 * The anchor block (active cell, or its merge) and the moving edge of the
 * selection along an axis. Keyboard extension keeps the anchor fixed and moves
 * the opposite edge, like Excel.
 */
function getMovingEdge(
  info: SheetNavInfo,
  sel: Selection,
  axis: "row" | "col",
  dir: 1 | -1
) {
  const rf = sel.row_focus ?? sel.row[0];
  const cf = sel.column_focus ?? sel.column[0];
  const anchor = info.blockAt(rf, cf);
  const [lo, hi] = axis === "row" ? sel.row : sel.column;
  const [alo, ahi] = axis === "row" ? anchor.row : anchor.column;
  let edge: number;
  if (lo === alo && hi === ahi) edge = dir > 0 ? hi : lo;
  else if (lo < alo) edge = lo;
  else edge = hi;
  return { anchor, edge, rf, cf };
}

function extendSelectionTo(
  ctx: Context,
  info: SheetNavInfo,
  sel: Selection,
  axis: "row" | "col",
  newEdge: number,
  anchor: SimpleRange,
  rf: number,
  cf: number
) {
  const range: SimpleRange =
    axis === "row"
      ? {
          row: [
            Math.min(anchor.row[0], newEdge),
            Math.max(anchor.row[1], newEdge),
          ],
          column: [sel.column[0], sel.column[1]],
        }
      : {
          row: [sel.row[0], sel.row[1]],
          column: [
            Math.min(anchor.column[0], newEdge),
            Math.max(anchor.column[1], newEdge),
          ],
        };
  const scrollTo: [number, number] =
    axis === "row" ? [newEdge, -1] : [-1, newEdge];
  setSelectionRange(ctx, range, rf, cf, {
    scrollTo,
    rowSelect: sel.row_select,
    columnSelect: sel.column_select,
  });
}

/** Shift+Arrow: grows/shrinks the selection by one visible row/column. */
export function extendSelection(ctx: Context, direction: NavDirection) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  if (!info || !sel) return;
  const { axis, dir } = DIRS[direction];
  const { anchor, edge, rf, cf } = getMovingEdge(info, sel, axis, dir);
  const next = nextVisibleIndex(
    edge,
    dir,
    axis === "row" ? info.rows : info.cols,
    axis === "row" ? info.isRowHidden : info.isColHidden
  );
  if (next == null) return;
  extendSelectionTo(ctx, info, sel, axis, next, anchor, rf, cf);
}

/**
 * Ctrl+Arrow (and Ctrl+Shift+Arrow with `extend`): jump to the edge of the
 * current data region.
 */
export function moveToDataEdge(
  ctx: Context,
  direction: NavDirection,
  extend = false
) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  const { axis, dir } = DIRS[direction];
  const length = axis === "row" ? info.rows : info.cols;
  const isHidden = axis === "row" ? info.isRowHidden : info.isColHidden;

  if (extend) {
    const { anchor, edge, rf, cf } = getMovingEdge(info, sel, axis, dir);
    const target = findDataEdge(
      edge,
      dir,
      length,
      (i) => (axis === "row" ? info.isFilled(i, cf) : info.isFilled(rf, i)),
      isHidden
    );
    extendSelectionTo(ctx, info, sel, axis, target, anchor, rf, cf);
    return;
  }

  const [r, c] = active;
  const block = info.blockAt(r, c);
  if (axis === "row") {
    const from = dir > 0 ? block.row[1] : block.row[0];
    const target = findDataEdge(
      from,
      dir,
      length,
      (i) => info.isFilled(i, c),
      isHidden
    );
    setActiveCell(ctx, target, c);
  } else {
    const from = dir > 0 ? block.column[1] : block.column[0];
    const target = findDataEdge(
      from,
      dir,
      length,
      (i) => info.isFilled(r, i),
      isHidden
    );
    setActiveCell(ctx, r, target);
  }
}

function firstVisible(
  length: number,
  isHidden: (i: number) => boolean,
  from = 0
) {
  for (let i = Math.max(0, from); i < length; i += 1) {
    if (!isHidden(i)) return i;
  }
  return Math.max(0, from);
}

function lastVisibleAtOrBefore(pos: number, isHidden: (i: number) => boolean) {
  for (let i = pos; i >= 0; i -= 1) {
    if (!isHidden(i)) return i;
  }
  return pos;
}

/** Home: first column of the row. Shift extends. */
export function moveHome(ctx: Context, extend = false) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  const col = firstVisible(info.cols, info.isColHidden);
  if (extend) {
    const { anchor, rf, cf } = getMovingEdge(info, sel, "col", -1);
    extendSelectionTo(ctx, info, sel, "col", col, anchor, rf, cf);
  } else {
    setActiveCell(ctx, active[0], col);
  }
}

/**
 * Ctrl+Home: the top-left cell (the first cell below/right of frozen panes,
 * like Excel). Ctrl+Shift+Home extends the selection to it.
 */
export function moveToSheetStart(ctx: Context, extend = false) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  if (!info || !sel) return;
  const r = firstVisible(info.rows, info.isRowHidden, info.frozenRows);
  const c = firstVisible(info.cols, info.isColHidden, info.frozenCols);
  if (extend) {
    const rf = sel.row_focus ?? sel.row[0];
    const cf = sel.column_focus ?? sel.column[0];
    const anchor = info.blockAt(rf, cf);
    setSelectionRange(
      ctx,
      {
        row: [Math.min(r, anchor.row[0]), Math.max(r, anchor.row[1])],
        column: [Math.min(c, anchor.column[0]), Math.max(c, anchor.column[1])],
      },
      rf,
      cf,
      { scrollTo: [r, c] }
    );
  } else {
    setActiveCell(ctx, r, c);
  }
}

/** Ctrl+End: the last used cell. Ctrl+Shift+End extends the selection. */
export function moveToLastUsedCell(ctx: Context, extend = false) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  if (!info || !sel) return;
  const [lr, lc] = getLastUsedCell(info.data);
  const r = lastVisibleAtOrBefore(lr, info.isRowHidden);
  const c = lastVisibleAtOrBefore(lc, info.isColHidden);
  if (extend) {
    const rf = sel.row_focus ?? sel.row[0];
    const cf = sel.column_focus ?? sel.column[0];
    const anchor = info.blockAt(rf, cf);
    setSelectionRange(
      ctx,
      {
        row: [Math.min(r, anchor.row[0]), Math.max(r, anchor.row[1])],
        column: [Math.min(c, anchor.column[0]), Math.max(c, anchor.column[1])],
      },
      rf,
      cf,
      { scrollTo: [r, c] }
    );
  } else {
    setActiveCell(ctx, r, c);
  }
}

function offsetOf(sizes: number[], i: number) {
  return i <= 0 ? 0 : (sizes[i - 1] ?? 0);
}

/**
 * PageDown/PageUp (axis "row") and Alt+PageDown/PageUp (axis "col"): move the
 * active cell and the viewport by one screen. Shift extends the selection.
 */
export function moveByPage(
  ctx: Context,
  axis: "row" | "col",
  dir: 1 | -1,
  extend = false
) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  const sizes = axis === "row" ? ctx.visibledatarow : ctx.visibledatacolumn;
  const length = axis === "row" ? info.rows : info.cols;
  const isHidden = axis === "row" ? info.isRowHidden : info.isColHidden;
  const frozenCount = axis === "row" ? info.frozenRows : info.frozenCols;
  const frozenPx = frozenCount > 0 ? offsetOf(sizes, frozenCount) : 0;
  const viewport = axis === "row" ? ctx.cellmainHeight : ctx.cellmainWidth;
  const page = viewport > 0 ? Math.max(20, viewport - frozenPx) : 400;

  let from: number;
  let anchorInfo: ReturnType<typeof getMovingEdge> | null = null;
  if (extend) {
    anchorInfo = getMovingEdge(info, sel, axis, dir);
    from = anchorInfo.edge;
  } else {
    from = axis === "row" ? active[0] : active[1];
  }

  // Like Excel: scroll by the rows (columns) that fill the window, keeping
  // the window aligned to them, and move the active cell by as many, so it
  // stays where it was on screen.
  const scroll = axis === "row" ? ctx.scrollTop : ctx.scrollLeft;
  let target: number;
  let nextScroll = scroll;
  if (!sizes || sizes.length === 0) {
    target = clamp(from + dir * 20, 0, length - 1);
  } else {
    // the first row of the scrolling pane in the window, and how many fit
    const start = scroll + frozenPx;
    const first = clamp(_.sortedLastIndex(sizes, start), 0, length - 1);
    // down: the rows from the top of the window; up: the rows that fill
    // the window above it
    const top = offsetOf(sizes, first);
    const fit = Math.max(
      1,
      dir > 0
        ? _.sortedLastIndex(sizes, top + page) - first
        : top - page <= 0
          ? first
          : first - (_.sortedIndex(sizes, top - page) + 1)
    );
    const nextFirst = clamp(first + dir * fit, frozenCount, length - 1);
    nextScroll = Math.max(0, offsetOf(sizes, nextFirst) - frozenPx);
    target = clamp(from + (nextFirst - first || dir * fit), 0, length - 1);
  }
  if (isHidden(target)) {
    target =
      nextVisibleIndex(target, dir, length, isHidden) ??
      nextVisibleIndex(target, dir > 0 ? -1 : 1, length, isHidden) ??
      from;
  }

  if (axis === "row") {
    ctx.scrollTop = nextScroll;
  } else {
    ctx.scrollLeft = nextScroll;
  }

  if (extend && anchorInfo) {
    extendSelectionTo(
      ctx,
      info,
      sel,
      axis,
      target,
      anchorInfo.anchor,
      anchorInfo.rf,
      anchorInfo.cf
    );
  } else if (axis === "row") {
    setActiveCell(ctx, target, active[1]);
  } else {
    setActiveCell(ctx, active[0], target);
  }
}

/**
 * Enter / Tab inside a multi-cell selection: moves the active cell within the
 * selection (wrapping) and keeps the selection. Returns false when the
 * selection is a single cell (or merge), so the caller moves normally.
 */
export function moveWithinSelection(
  ctx: Context,
  direction: NavDirection
): boolean {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return false;
  const range: SimpleRange = {
    row: [sel.row[0], sel.row[1]],
    column: [sel.column[0], sel.column[1]],
  };
  const block = info.blockAt(active[0], active[1]);
  if (
    block.row[0] <= range.row[0] &&
    block.row[1] >= range.row[1] &&
    block.column[0] <= range.column[0] &&
    block.column[1] >= range.column[1]
  ) {
    return false;
  }
  const skip = (r: number, c: number) => {
    if (info.isRowHidden(r) || info.isColHidden(c)) return true;
    const b = info.blockAt(r, c);
    return b.row[0] !== r || b.column[0] !== c;
  };
  const [nr, nc] = nextCellInRange(
    range,
    active[0],
    active[1],
    direction,
    skip
  );
  sel.row_focus = nr;
  sel.column_focus = nc;
  normalizeSelection(ctx, ctx.luckysheet_select_save);
  scrollToHighlightCell(ctx, nr, nc);
  return true;
}

/**
 * Enter/Tab outside of edit mode (or after committing an edit). Inside a
 * multi-cell selection the active cell wraps within it. Otherwise, like
 * Excel, Enter after a run of Tabs goes to the next row of the column where
 * the run started.
 */
export function moveAfterEnter(ctx: Context, direction: NavDirection) {
  if (moveWithinSelection(ctx, direction)) {
    ctx.tabReturn = undefined;
    return;
  }
  const active = getActiveCell(ctx);
  const tr = ctx.tabReturn;
  const inRun =
    !!tr && !!active && tr.at[0] === active[0] && tr.at[1] === active[1];
  ctx.tabReturn = undefined;
  if (direction === "left" || direction === "right") {
    const startCol = inRun ? tr!.col : active?.[1];
    moveActiveCell(ctx, direction);
    const now = getActiveCell(ctx);
    if (now && startCol != null) ctx.tabReturn = { col: startCol, at: now };
    return;
  }
  if (direction === "down" && inRun && active && tr!.col !== active[1]) {
    const info = getSheetNavInfo(ctx);
    if (info) {
      const block = info.blockAt(active[0], active[1]);
      const next = nextVisibleIndex(
        block.row[1],
        1,
        info.rows,
        info.isRowHidden
      );
      setActiveCell(ctx, next ?? active[0], tr!.col);
      return;
    }
  }
  moveActiveCell(ctx, direction);
}

/**
 * End, Enter: the last filled cell of the active row (the row's last column
 * when it is empty right of the active cell), like Excel's End mode.
 */
export function moveToRowEnd(ctx: Context, extend = false) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  let col = active[1];
  for (let c = info.cols - 1; c > active[1]; c -= 1) {
    if (!info.isColHidden(c) && info.isFilled(active[0], c)) {
      col = c;
      break;
    }
  }
  if (extend) {
    const { anchor, rf, cf } = getMovingEdge(info, sel, "col", 1);
    extendSelectionTo(ctx, info, sel, "col", col, anchor, rf, cf);
  } else {
    setActiveCell(ctx, active[0], col);
  }
}

/** Ctrl+A: the current data region first, the whole sheet second. */
export function selectCurrentRegionOrAll(ctx: Context) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  const selectAllCells = () => {
    ctx.luckysheet_select_status = false;
    ctx.luckysheet_select_save = normalizeSelection(ctx, [
      {
        row: [0, info.rows - 1],
        column: [0, info.cols - 1],
        row_focus: active[0],
        column_focus: active[1],
        row_select: true,
        column_select: true,
      },
    ]);
  };
  const region = getCurrentRegion(
    info.isFilled,
    active[0],
    active[1],
    info.rows,
    info.cols
  );
  if (!region) {
    selectAllCells();
    return;
  }
  const expanded = expandRangeForMerges(region, info.merges);
  const isWholeSheet =
    expanded.row[0] === 0 &&
    expanded.column[0] === 0 &&
    expanded.row[1] === info.rows - 1 &&
    expanded.column[1] === info.cols - 1;
  const alreadySelected =
    (ctx.luckysheet_select_save?.length ?? 0) === 1 &&
    sel.row[0] === expanded.row[0] &&
    sel.row[1] === expanded.row[1] &&
    sel.column[0] === expanded.column[0] &&
    sel.column[1] === expanded.column[1];
  if (isWholeSheet || alreadySelected) {
    selectAllCells();
    return;
  }
  setSelectionRange(ctx, expanded, active[0], active[1], {
    scrollTo: active,
  });
}

/** Shift+Space: select the entire rows of the current selection. */
export function selectEntireRows(ctx: Context) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  setSelectionRange(
    ctx,
    { row: [sel.row[0], sel.row[1]], column: [0, info.cols - 1] },
    active[0],
    active[1],
    { scrollTo: [active[0], -1], rowSelect: true }
  );
}

/** Ctrl+Space: select the entire columns of the current selection. */
export function selectEntireColumns(ctx: Context) {
  const info = getSheetNavInfo(ctx);
  const sel = lastSelection(ctx);
  const active = getActiveCell(ctx);
  if (!info || !sel || !active) return;
  setSelectionRange(
    ctx,
    { row: [0, info.rows - 1], column: [sel.column[0], sel.column[1]] },
    active[0],
    active[1],
    { scrollTo: [-1, active[1]], columnSelect: true }
  );
}

/** Ctrl+Backspace: bring the active cell back into view. */
export function scrollToActiveCell(ctx: Context) {
  const active = getActiveCell(ctx);
  if (!active) return;
  scrollToHighlightCell(ctx, active[0], active[1]);
}

/** Ctrl+PageDown / Ctrl+PageUp: activate the next / previous visible sheet. */
export function switchSheet(ctx: Context, dir: 1 | -1): boolean {
  const sheets = _.sortBy(
    ctx.luckysheetfile.filter((s) => s.hide !== 1),
    (s) => s.order ?? 0
  );
  const i = sheets.findIndex((s) => s.id === ctx.currentSheetId);
  if (i < 0) return false;
  const next = sheets[i + dir];
  if (!next?.id) return false;
  if (ctx.sheetScrollRecord) {
    ctx.sheetScrollRecord[ctx.currentSheetId] = {
      scrollLeft: ctx.scrollLeft,
      scrollTop: ctx.scrollTop,
      luckysheet_select_status: ctx.luckysheet_select_status,
      luckysheet_select_save: ctx.luckysheet_select_save,
      luckysheet_selection_range: ctx.luckysheet_selection_range,
    };
  }
  ctx.dataVerificationDropDownList = false;
  ctx.currentSheetId = next.id;
  ctx.zoomRatio = next.zoomRatio || 1;
  return true;
}
