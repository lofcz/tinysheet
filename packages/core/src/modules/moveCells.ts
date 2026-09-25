import _ from "lodash";
import { checkProtection } from "./protection";

import { Context, getFlowdata } from "../context";
import {
  colLocation,
  colLocationByIndex,
  getGridPoint,
  rowLocation,
  rowLocationByIndex,
} from "./location";
import { hasPartMC } from "./validation";
import { locale } from "../locale";
import { getBorderInfoCompute } from "./border";
import { normalizeSelection } from "./selection";
import { getSheetIndex, isAllowEdit } from "../utils";
import { Cell, GlobalCache, Sheet } from "../types";
import { reconcileSpillsAfterMove } from "./spill";
import { CFSplitRange } from "./ConditionFormat";
import { adjustReferences, recalcAfterStructuralChange } from "./refAdjust";
import { expandRowsAndColumns } from "./sheet";
// eslint-disable-next-line import/no-cycle
import { deleteCells, insertCells } from "./shiftCells";
// eslint-disable-next-line import/no-cycle
import { pasteSpecial } from "./pasteSpecial";
// names, tables, charts and note boxes follow moved cells (reference
// adjusters registered by modelSync)
import "./modelSync";

/* -------------------------------------------------------------------------- */
/*                   Moving a block of cells (cut/paste, drag)                */
/* -------------------------------------------------------------------------- */

type Rect = { row: [number, number]; column: [number, number] };

function rectContains(outer: Rect, r: number, c: number) {
  return (
    r >= outer.row[0] &&
    r <= outer.row[1] &&
    c >= outer.column[0] &&
    c <= outer.column[1]
  );
}

function rectsIntersect(a: Rect, b: Rect) {
  return (
    a.row[0] <= b.row[1] &&
    b.row[0] <= a.row[1] &&
    a.column[0] <= b.column[1] &&
    b.column[0] <= a.column[1]
  );
}

/** `rect` minus `hole`, as up to four rectangles. */
export function subtractRect(rect: Rect, hole: Rect): Rect[] {
  if (!rectsIntersect(rect, hole)) return [rect];
  const out: Rect[] = [];
  const top = Math.max(rect.row[0], hole.row[0]);
  const bottom = Math.min(rect.row[1], hole.row[1]);
  if (rect.row[0] < hole.row[0]) {
    out.push({ row: [rect.row[0], hole.row[0] - 1], column: rect.column });
  }
  if (rect.row[1] > hole.row[1]) {
    out.push({ row: [hole.row[1] + 1, rect.row[1]], column: rect.column });
  }
  if (rect.column[0] < hole.column[0]) {
    out.push({
      row: [top, bottom],
      column: [rect.column[0], hole.column[0] - 1],
    });
  }
  if (rect.column[1] > hole.column[1]) {
    out.push({
      row: [top, bottom],
      column: [hole.column[1] + 1, rect.column[1]],
    });
  }
  return out;
}

/** Whether a merged area is cut (partly covered) by `rect`. */
export function rangeCutsMerge(
  merge: Record<string, { r: number; c: number; rs: number; cs: number }>,
  rect: Rect
) {
  return _.some(merge, (mc) => {
    const m: Rect = {
      row: [mc.r, mc.r + mc.rs - 1],
      column: [mc.c, mc.c + mc.cs - 1],
    };
    if (!rectsIntersect(m, rect)) return false;
    return !(
      rectContains(rect, m.row[0], m.column[0]) &&
      rectContains(rect, m.row[1], m.column[1])
    );
  });
}

/** The live config of a sheet (ctx.config for the current sheet). */
export function liveSheetConfig(ctx: Context, sheetId: string) {
  const file = ctx.luckysheetfile[getSheetIndex(ctx, sheetId) as number];
  if (sheetId === ctx.currentSheetId) {
    if (ctx.config == null) ctx.config = file.config || {};
    return ctx.config;
  }
  if (file.config == null) file.config = {};
  return file.config;
}

/** Remove the borders of `rect` from a border list. */
export function stripBorders(borderInfo: any[] | undefined, rect: Rect) {
  if (!borderInfo || borderInfo.length === 0) return borderInfo;
  const out: any[] = [];
  borderInfo.forEach((b) => {
    if (b.rangeType === "cell") {
      if (!rectContains(rect, b.value.row_index, b.value.col_index)) {
        out.push(b);
      }
    } else if (b.rangeType === "range") {
      let ranges: Rect[] = [];
      (b.range || []).forEach((r: Rect) => {
        ranges = ranges.concat(subtractRect(r, rect));
      });
      if (ranges.length > 0) out.push({ ...b, range: ranges });
    } else {
      out.push(b);
    }
  });
  return out;
}

/** Border entries reproducing computed borders `bd` at (r, c). */
export function borderEntriesForCell(bd: any, r: number, c: number) {
  const out: any[] = [];
  if (!bd) return out;
  if (bd.l || bd.r || bd.t || bd.b) {
    out.push({
      rangeType: "cell",
      value: { row_index: r, col_index: c, l: bd.l, r: bd.r, t: bd.t, b: bd.b },
    });
  }
  if (bd.s) {
    out.push({
      rangeType: "range",
      borderType: "border-slash",
      color: bd.s.color,
      style: bd.s.style,
      range: [{ row: [r, r], column: [c, c] }],
    });
  }
  return out;
}

/** Rows hidden by a sheet's AutoFilter columns. */
function filterHiddenRows(filter: Record<string, any> | undefined) {
  const rows = new Set<number>();
  _.forEach(filter, (item) => {
    _.forEach(item?.rowhidden, (__, r) => rows.add(Number(r)));
  });
  return rows;
}

/** ctx keeps a live copy of the current sheet's AutoFilter. */
function syncLiveFilter(ctx: Context, file: Sheet) {
  if (file.id !== ctx.currentSheetId) return;
  ctx.luckysheet_filter_save = file.filter_select;
  ctx.filter = file.filter ?? {};
}

/** Removes a sheet's AutoFilter, showing the rows it hid. */
function dropAutoFilter(file: Sheet, cfg: Record<string, any>) {
  const hidden = filterHiddenRows(file.filter);
  if (hidden.size > 0 && cfg.rowhidden) {
    cfg.rowhidden = _.omit(cfg.rowhidden, [...hidden].map(String));
  }
  file.filter_select = undefined;
  file.filter = undefined;
}

/**
 * Excel moves the AutoFilter with its data: when the moved block contains
 * the source sheet's whole filter range, the range, every column's criteria
 * and the rows they hide go to the destination (a destination sheet keeps
 * its own AutoFilter unless the block overwrites it: one per sheet).
 */
function moveAutoFilter(
  ctx: Context,
  srcFile: Sheet,
  dstFile: Sheet,
  srcCfg: Record<string, any>,
  dstCfg: Record<string, any>,
  range: Rect,
  dest: Rect,
  dr: number,
  dc: number
) {
  const sel = srcFile.filter_select;
  if (!sel?.row || !sel?.column) return;
  const rect: Rect = {
    row: [sel.row[0], sel.row[1]],
    column: [sel.column[0], sel.column[1]],
  };
  if (
    !rectContains(range, rect.row[0], rect.column[0]) ||
    !rectContains(range, rect.row[1], rect.column[1])
  ) {
    return;
  }
  const sameSheet = srcFile === dstFile;
  if (
    !sameSheet &&
    dstFile.filter_select?.row &&
    dstFile.filter_select.column
  ) {
    const other: Rect = {
      row: [dstFile.filter_select.row[0], dstFile.filter_select.row[1]],
      column: [
        dstFile.filter_select.column[0],
        dstFile.filter_select.column[1],
      ],
    };
    if (!rectsIntersect(other, dest)) {
      // the destination keeps its AutoFilter; this one goes away
      dropAutoFilter(srcFile, srcCfg);
      syncLiveFilter(ctx, srcFile);
      return;
    }
    dropAutoFilter(dstFile, dstCfg);
  }
  const hidden = filterHiddenRows(srcFile.filter);
  const next: Rect = {
    row: [rect.row[0] + dr, rect.row[1] + dr],
    column: [rect.column[0] + dc, rect.column[1] + dc],
  };
  let filter: Record<string, any> | undefined;
  if (srcFile.filter) {
    filter = {};
    _.forEach(srcFile.filter, (item, key) => {
      if (!item) return;
      const rowhidden: Record<string, number> = {};
      _.forEach(item.rowhidden, (v, r) => {
        rowhidden[Number(r) + dr] = v as number;
      });
      filter![key] = {
        ...item,
        rowhidden,
        cindex: item.cindex + dc,
        str: next.row[0],
        edr: next.row[1],
        stc: next.column[0],
        edc: next.column[1],
      };
    });
  }
  if (hidden.size > 0 && (dr !== 0 || !sameSheet)) {
    // the rows hidden by the filter move with it
    srcCfg.rowhidden = _.omit(srcCfg.rowhidden || {}, [...hidden].map(String));
    const moved: Record<string, number> = {};
    hidden.forEach((r) => {
      moved[r + dr] = 0;
    });
    dstCfg.rowhidden = { ...(dstCfg.rowhidden || {}), ...moved };
  }
  srcFile.filter_select = undefined;
  srcFile.filter = undefined;
  dstFile.filter_select = { row: next.row, column: next.column };
  dstFile.filter = filter;
  syncLiveFilter(ctx, srcFile);
  syncLiveFilter(ctx, dstFile);
}

export type MoveSource = { sheetId: string; range: Rect };
export type MoveTarget = { sheetId: string; row: number; column: number };

/**
 * Move a block of cells, like Excel's cut/paste or drag-and-drop: values,
 * formulas (text unchanged), formats, merges, borders, comments, data
 * validation, hyperlinks and conditional-format ranges go to the target, the
 * source becomes empty, and every reference in the workbook that pointed
 * inside the block now points at its new location (references to the
 * overwritten target cells become #REF!).
 *
 * Throws Error("partMC") when the source or the target would cut a merged
 * area. Returns false when nothing was moved.
 */
export function moveCellRange(
  ctx: Context,
  source: MoveSource,
  target: MoveTarget
) {
  const srcIdx = getSheetIndex(ctx, source.sheetId);
  const dstIdx = getSheetIndex(ctx, target.sheetId);
  if (srcIdx == null || dstIdx == null) return false;
  const srcFile = ctx.luckysheetfile[srcIdx];
  const dstFile = ctx.luckysheetfile[dstIdx];
  const srcData = srcFile.data;
  const dstData = dstFile.data;
  if (!srcData || !dstData) return false;

  const range: Rect = {
    row: [source.range.row[0], source.range.row[1]],
    column: [source.range.column[0], source.range.column[1]],
  };
  const h = range.row[1] - range.row[0] + 1;
  const w = range.column[1] - range.column[0] + 1;
  const dr = target.row - range.row[0];
  const dc = target.column - range.column[0];
  const dest: Rect = {
    row: [target.row, target.row + h - 1],
    column: [target.column, target.column + w - 1],
  };
  const sameSheet = source.sheetId === target.sheetId;
  if (sameSheet && dr === 0 && dc === 0) return false;
  if (target.row < 0 || target.column < 0) return false;
  if (
    !checkProtection(ctx, "editCells", [range], source.sheetId) ||
    !checkProtection(ctx, "editCells", [dest], target.sheetId)
  ) {
    return false;
  }

  const srcCfg = liveSheetConfig(ctx, source.sheetId);
  const dstCfg = sameSheet ? srcCfg : liveSheetConfig(ctx, target.sheetId);
  if (
    rangeCutsMerge(srcCfg.merge || {}, range) ||
    rangeCutsMerge(dstCfg.merge || {}, dest)
  ) {
    throw new Error("partMC");
  }

  // grow the target sheet when needed
  const addr = dest.row[1] - dstData.length + 1;
  const addc = dest.column[1] - (dstData[0]?.length ?? 0) + 1;
  if (addr > 0 || addc > 0) {
    expandRowsAndColumns(dstData, Math.max(addr, 0), Math.max(addc, 0));
  }

  // 1. references everywhere (moved formulas are rewritten in place)
  adjustReferences(ctx, {
    type: "move",
    sheetId: source.sheetId,
    range,
    toSheetId: target.sheetId,
    toRow: target.row,
    toColumn: target.column,
  });

  // 2. snapshot the source block
  const cells: (Cell | null)[][] = [];
  for (let i = 0; i < h; i += 1) {
    const row: (Cell | null)[] = [];
    for (let j = 0; j < w; j += 1) {
      const cell = srcData[range.row[0] + i]?.[range.column[0] + j];
      row.push(cell == null ? null : _.cloneDeep(cell));
    }
    cells.push(row);
  }
  const borders = getBorderInfoCompute(
    ctx,
    source.sheetId === ctx.currentSheetId ? undefined : source.sheetId
  );
  const takeKeyed = (obj: Record<string, any> | undefined) => {
    const moved: Record<string, any> = {};
    if (!obj) return moved;
    Object.keys(obj).forEach((key) => {
      const [r, c] = key.split("_").map(Number);
      if (rectContains(range, r, c)) {
        moved[`${r + dr}_${c + dc}`] = obj[key];
        delete obj[key];
      }
    });
    return moved;
  };
  const movedDV = takeKeyed(srcFile.dataVerification);
  const movedLinks = takeKeyed(srcFile.hyperlink);
  const srcMerges: any[] = [];
  _.forEach(srcCfg.merge, (mc, key) => {
    if (rectContains(range, mc.r, mc.c)) {
      srcMerges.push(mc);
      delete srcCfg.merge![key];
    }
  });

  // 3. clear the source
  for (let r = range.row[0]; r <= range.row[1]; r += 1) {
    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      if (srcData[r]) srcData[r][c] = null;
    }
  }
  srcCfg.borderInfo = stripBorders(srcCfg.borderInfo, range);

  // 4. write the target
  _.forEach(dstCfg.merge, (mc, key) => {
    if (rectContains(dest, mc.r, mc.c)) delete dstCfg.merge![key];
  });
  const dropKeyed = (obj: Record<string, any> | undefined) => {
    if (!obj) return;
    Object.keys(obj).forEach((key) => {
      const [r, c] = key.split("_").map(Number);
      if (rectContains(dest, r, c)) delete obj[key];
    });
  };
  dropKeyed(dstFile.dataVerification);
  dropKeyed(dstFile.hyperlink);
  dstCfg.borderInfo = stripBorders(dstCfg.borderInfo, dest);

  for (let i = 0; i < h; i += 1) {
    for (let j = 0; j < w; j += 1) {
      const cell = cells[i][j];
      if (cell?.mc) {
        cell.mc = { ...cell.mc, r: cell.mc.r + dr, c: cell.mc.c + dc };
      }
      const r = dest.row[0] + i;
      const c = dest.column[0] + j;
      dstData[r][c] = cell;
      const entries = borderEntriesForCell(
        borders[`${range.row[0] + i}_${range.column[0] + j}`],
        r,
        c
      );
      if (entries.length > 0) {
        dstCfg.borderInfo = [...(dstCfg.borderInfo || []), ...entries];
      }
    }
  }
  if (srcMerges.length > 0) {
    if (!dstCfg.merge) dstCfg.merge = {};
    srcMerges.forEach((mc) => {
      const next = { ...mc, r: mc.r + dr, c: mc.c + dc };
      dstCfg.merge![`${next.r}_${next.c}`] = next;
    });
  }
  if (!_.isEmpty(movedDV)) {
    dstFile.dataVerification = {
      ...(dstFile.dataVerification || {}),
      ...movedDV,
    };
  }
  if (!_.isEmpty(movedLinks)) {
    dstFile.hyperlink = { ...(dstFile.hyperlink || {}), ...movedLinks };
  }

  // conditional formats: the moved part of a rule goes with the cells
  const srcCF = srcFile.luckysheet_conditionformat_save;
  if (srcCF && srcCF.length > 0) {
    const carried: any[] = [];
    srcFile.luckysheet_conditionformat_save = srcCF
      .map((rule: any) => {
        let rest: any[] = [];
        let moved: any[] = [];
        (rule.cellrange || []).forEach((cr: Rect) => {
          if (sameSheet) {
            rest = rest.concat(CFSplitRange(cr, range, dest, "allPart"));
          } else {
            rest = rest.concat(CFSplitRange(cr, range, dest, "restPart"));
            moved = moved.concat(CFSplitRange(cr, range, dest, "operatePart"));
          }
        });
        if (moved.length > 0) {
          carried.push({ ..._.cloneDeep(rule), cellrange: moved });
        }
        return { ...rule, cellrange: rest };
      })
      .filter((rule: any) => rule.cellrange.length > 0);
    if (carried.length > 0) {
      dstFile.luckysheet_conditionformat_save = [
        ...(dstFile.luckysheet_conditionformat_save || []),
        ...carried,
      ];
    }
  }

  // the AutoFilter moves with its data (Excel)
  moveAutoFilter(ctx, srcFile, dstFile, srcCfg, dstCfg, range, dest, dr, dc);

  // keep the workbook copies of the live configs in sync
  srcFile.config = srcCfg;
  dstFile.config = dstCfg;

  recalcAfterStructuralChange(ctx);
  // formulas moved with the block spill again from their new anchors
  reconcileSpillsAfterMove(
    ctx,
    { sheetId: source.sheetId, range },
    { sheetId: target.sheetId, range: dest }
  );
  return true;
}

const dragCellThreshold = 8;

function getCellLocationByMouse(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLDivElement,
  clamp = false
) {
  // past the grid's edge (auto-scrolling): the last visible row / column
  const anchor = _.last(ctx.luckysheet_select_save);
  const { x, y } = getGridPoint(
    ctx,
    globalCache.freezen?.[ctx.currentSheetId],
    e,
    container,
    { clamp, anchorRow: anchor?.row_focus, anchorCol: anchor?.column_focus }
  );

  return {
    row: rowLocation(y, ctx.visibledatarow),
    column: colLocation(x, ctx.visibledatacolumn),
  };
}

export function onCellsMoveStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
  container: HTMLDivElement
) {
  // if (isEditMode() || ctx.allowEdit === false) {
  const allowEdit = isAllowEdit(ctx);
  if (allowEdit === false) {
    // 此模式下禁用选区拖动
    checkProtection(ctx, "editCells");
    return;
  }

  globalCache.dragCellStartPos = { x: e.pageX, y: e.pageY };
  ctx.luckysheet_cell_selected_move = true;
  ctx.luckysheet_scroll_status = true;

  let {
    row: [row_pre, row, row_index],
    column: [col_pre, col, col_index],
  } = getCellLocationByMouse(ctx, globalCache, e, container);

  const range = _.last(ctx.luckysheet_select_save);
  if (range == null) return;

  if (row_index < range.row[0]) {
    [row_index] = range.row;
  } else if (row_index > range.row[1]) [, row_index] = range.row;
  if (col_index < range.column[0]) {
    [col_index] = range.column;
  } else if (col_index > range.column[1]) [, col_index] = range.column;
  [row_pre, row] = rowLocationByIndex(row_index, ctx.visibledatarow);
  [col_pre, col] = colLocationByIndex(col_index, ctx.visibledatacolumn);

  ctx.luckysheet_cell_selected_move_index = [row_index, col_index];

  const ele = document.getElementById("fortune-cell-selected-move");
  if (ele == null) return;
  ele.style.left = `${col_pre}px`;
  ele.style.top = `${row_pre}px`;
  ele.style.width = `${col - col_pre - 1}px`;
  ele.style.height = `${row - row_pre - 1}px`;
  ele.style.display = "block";

  e.stopPropagation();
}

/** What a drag of the selection's border does on release (Excel). */
export type CellsDragMode = "move" | "copy" | "insert" | "insertCopy";

/** Ctrl (Cmd on Mac) copies, Shift inserts, both insert a copy. */
export function cellsDragMode(e: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): CellsDragMode {
  const copy = e.ctrlKey || e.metaKey;
  if (e.shiftKey) return copy ? "insertCopy" : "insert";
  return copy ? "copy" : "move";
}

type CellsDrop = {
  /** where the block's top-left cell goes */
  row: number;
  column: number;
  /** Shift: the cells at the target shift down or right to make room */
  shift?: "down" | "right";
};

/**
 * Where a drag of the selection's border drops the block. A plain move or
 * copy keeps the block's offset to the grabbed cell; Shift inserts at the
 * row or column boundary nearest the pointer (Excel's I-beam: a horizontal
 * one shifts cells down, a vertical one shifts them right).
 */
function cellsDropTarget(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLDivElement,
  insert: boolean
): CellsDrop | null {
  const last = _.last(ctx.luckysheet_select_save);
  if (last == null) return null;
  const {
    row: [row_pre, row, row_index],
    column: [col_pre, col, col_index],
  } = getCellLocationByMouse(ctx, globalCache, e, container, true);
  const { x, y } = getGridPoint(
    ctx,
    globalCache.freezen?.[ctx.currentSheetId],
    e,
    container,
    { clamp: true, anchorRow: last.row_focus, anchorCol: last.column_focus }
  );
  const [row_original, col_original] = ctx.luckysheet_cell_selected_move_index;
  const h = last.row[1] - last.row[0];
  const w = last.column[1] - last.column[0];
  const maxRow = ctx.visibledatarow.length - 1;
  const maxCol = ctx.visibledatacolumn.length - 1;
  const clampTo = (v: number, size: number, max: number) =>
    Math.min(Math.max(v, 0), Math.max(0, max - size));
  const moveRow = clampTo(last.row[0] - row_original + row_index, h, maxRow);
  const moveCol = clampTo(last.column[0] - col_original + col_index, w, maxCol);
  if (!insert) return { row: moveRow, column: moveCol };
  const toTop = y - row_pre;
  const toBottom = row - y;
  const toLeft = x - col_pre;
  const toRight = col - x;
  if (Math.min(toTop, toBottom) <= Math.min(toLeft, toRight)) {
    const boundary = toTop <= toBottom ? row_index : row_index + 1;
    return {
      row: Math.min(Math.max(boundary, 0), maxRow),
      column: moveCol,
      shift: "down",
    };
  }
  const boundary = toLeft <= toRight ? col_index : col_index + 1;
  return {
    row: moveRow,
    column: Math.min(Math.max(boundary, 0), maxCol),
    shift: "right",
  };
}

/** Hide the outline a drag of the selection's border shows. */
function hideCellsMoveOutline() {
  const ele = document.getElementById("fortune-cell-selected-move");
  if (ele == null) return;
  ele.style.display = "none";
  delete ele.dataset.mode;
}

export function onCellsMove(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
  container: HTMLDivElement
) {
  if (!ctx.luckysheet_cell_selected_move) return;
  if (globalCache.dragCellStartPos != null) {
    const deltaX = Math.abs(globalCache.dragCellStartPos.x - e.pageX);
    const deltaY = Math.abs(globalCache.dragCellStartPos.y - e.pageY);
    if (deltaX < dragCellThreshold && deltaY < dragCellThreshold) {
      return;
    }
    globalCache.dragCellStartPos = undefined;
  }
  const last = _.last(ctx.luckysheet_select_save);
  if (last == null) return;
  const mode = cellsDragMode(e);
  const drop = cellsDropTarget(
    ctx,
    globalCache,
    e,
    container,
    mode === "insert" || mode === "insertCopy"
  );
  if (drop == null) return;
  const h = last.row[1] - last.row[0];
  const w = last.column[1] - last.column[0];
  // the sheet px where row / column `i` starts
  const start = (edges: number[], i: number) =>
    i <= 0 ? 0 : (edges[Math.min(i, edges.length) - 1] ?? 0);
  const rows = ctx.visibledatarow;
  const cols = ctx.visibledatacolumn;

  const ele = document.getElementById("fortune-cell-selected-move");
  if (ele == null) return;
  ele.dataset.mode = mode;
  let left = start(cols, drop.column);
  let top = start(rows, drop.row);
  let width = start(cols, drop.column + w + 1) - left - 2;
  let height = start(rows, drop.row + h + 1) - top - 2;
  // Shift: a line (Excel's I-beam) where the cells are inserted
  if (drop.shift === "down") {
    top -= 1;
    height = 0;
  } else if (drop.shift === "right") {
    left -= 1;
    width = 0;
  }
  ele.style.left = `${left}px`;
  ele.style.top = `${top}px`;
  ele.style.width = `${Math.max(0, width)}px`;
  ele.style.height = `${Math.max(0, height)}px`;
  ele.style.display = "block";
}

/** Esc during a drag of the selection's border: nothing moves (Excel). */
export function cancelCellsMove(ctx: Context, globalCache: GlobalCache) {
  if (!ctx.luckysheet_cell_selected_move) return false;
  ctx.luckysheet_cell_selected_move = false;
  globalCache.dragCellStartPos = undefined;
  hideCellsMoveOutline();
  return true;
}

/** Copy `source` (formulas with adjusted references) to (row, column). */
function copyCellRange(
  ctx: Context,
  source: Rect,
  row: number,
  column: number
) {
  const saved = ctx.luckysheet_copy_save;
  const savedSelection = ctx.luckysheet_select_save;
  ctx.luckysheet_copy_save = {
    dataSheetId: ctx.currentSheetId,
    copyRange: [{ row: [...source.row], column: [...source.column] }],
    RowlChange: false,
    HasMC: false,
  };
  ctx.luckysheet_select_save = [{ row: [row, row], column: [column, column] }];
  try {
    return pasteSpecial(ctx);
  } finally {
    ctx.luckysheet_copy_save = saved;
    ctx.luckysheet_select_save = savedSelection;
  }
}

/**
 * Shift+drag: insert the block at `drop`, shifting the cells there down or
 * right. A move also closes the gap it leaves when it stays in its own
 * columns (shift down) or rows (shift right), like Excel's Insert Cut
 * Cells. Returns where the block ends up, or null when nothing changed.
 */
function insertCellRange(
  ctx: Context,
  source: Rect,
  drop: CellsDrop,
  copy: boolean
): Rect | null {
  const h = source.row[1] - source.row[0] + 1;
  const w = source.column[1] - source.column[0] + 1;
  const down = drop.shift === "down";
  const target: Rect = {
    row: [drop.row, drop.row + h - 1],
    column: [drop.column, drop.column + w - 1],
  };
  // the band the insert shifts (columns for down, rows for right)
  const band = down ? "column" : "row";
  const along = down ? "row" : "column";
  const size = down ? h : w;
  const at = down ? drop.row : drop.column;
  const sameBand =
    source[band][0] === target[band][0] && source[band][1] === target[band][1];
  const bandsOverlap =
    source[band][0] <= target[band][1] && target[band][0] <= source[band][1];
  // the insert would split the block
  if (bandsOverlap && !sameBand && source[along][1] >= at) return null;
  // dropped onto itself
  if (
    !copy &&
    sameBand &&
    at >= source[along][0] &&
    at <= source[along][1] + 1
  ) {
    return null;
  }
  if (!insertCells(ctx, target, down ? "down" : "right")) return null;
  // the insert pushed the block itself when it lies past the boundary
  const src: Rect = { row: [...source.row], column: [...source.column] };
  if (sameBand && src[along][0] >= at) {
    src[along] = [src[along][0] + size, src[along][1] + size];
  }
  if (copy) {
    copyCellRange(ctx, src, target.row[0], target.column[0]);
    return target;
  }
  moveCellRange(
    ctx,
    { sheetId: ctx.currentSheetId, range: src },
    {
      sheetId: ctx.currentSheetId,
      row: target.row[0],
      column: target.column[0],
    }
  );
  if (!sameBand) return target;
  deleteCells(ctx, src, down ? "up" : "left");
  if (src[along][1] < at) {
    target[along] = [target[along][0] - size, target[along][1] - size];
  }
  return target;
}

export function onCellsMoveEnd(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
  container: HTMLDivElement
) {
  // 改变选择框的位置并替换目标单元格
  if (!ctx.luckysheet_cell_selected_move) return;
  ctx.luckysheet_cell_selected_move = false;
  hideCellsMoveOutline();
  if (globalCache.dragCellStartPos != null) {
    globalCache.dragCellStartPos = undefined;
    return;
  }

  // Excel reads the modifiers on release: Ctrl copies, Shift inserts
  const mode = cellsDragMode(e);
  const insert = mode === "insert" || mode === "insertCopy";
  const copy = mode === "copy" || mode === "insertCopy";
  // released past the grid's edge: the last visible row / column
  const drop = cellsDropTarget(ctx, globalCache, e, container, insert);
  const d = getFlowdata(ctx);
  if (drop == null || d == null || ctx.luckysheet_select_save == null) return;
  const last =
    ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];

  const allowEdit = isAllowEdit(ctx, [
    { row: [drop.row, drop.row], column: [drop.column, drop.column] },
  ]);
  if (!allowEdit) return;

  const h = last.row[1] - last.row[0];
  const w = last.column[1] - last.column[0];
  if (!insert && drop.row === last.row[0] && drop.column === last.column[0]) {
    return;
  }

  const cfg = ctx.config;
  if (cfg.merge == null) {
    cfg.merge = {};
  }
  if (cfg.rowlen == null) {
    cfg.rowlen = {};
  }
  const { drag: locale_drag } = locale(ctx);

  // 选区包含部分单元格
  if (
    hasPartMC(
      ctx,
      cfg,
      last.row[0],
      last.row[1],
      last.column[0],
      last.column[1]
    )
  ) {
    throw new Error(locale_drag.noMerge);
  }

  const source: Rect = {
    row: [last.row[0], last.row[1]],
    column: [last.column[0], last.column[1]],
  };
  let placed: Rect | null = {
    row: [drop.row, drop.row + h],
    column: [drop.column, drop.column + w],
  };

  // 替换的位置包含部分单元格
  if (
    !insert &&
    hasPartMC(
      ctx,
      cfg,
      placed.row[0],
      placed.row[1],
      placed.column[0],
      placed.column[1]
    )
  ) {
    throw new Error(locale_drag.noMerge);
  }

  try {
    if (insert) {
      placed = insertCellRange(ctx, source, drop, copy);
    } else if (copy) {
      if (!copyCellRange(ctx, source, drop.row, drop.column)) placed = null;
    } else {
      // move cells, formats, merges, borders, validation, links and CF,
      // and rewrite every reference to the moved cells (Excel semantics)
      moveCellRange(
        ctx,
        { sheetId: ctx.currentSheetId, range: source },
        { sheetId: ctx.currentSheetId, row: drop.row, column: drop.column }
      );
    }
  } catch (err: any) {
    if (err?.message === "partMC") throw new Error(locale_drag.noMerge);
    throw err;
  }
  if (placed == null) return;

  const sel = ctx.luckysheet_select_save[0];
  const rf = sel.row_focus === sel.row[0] ? placed.row[0] : placed.row[1];
  const cf =
    sel.column_focus === sel.column[0] ? placed.column[0] : placed.column[1];

  last.row = placed.row;
  last.column = placed.column;
  last.row_focus = rf;
  last.column_focus = cf;
  ctx.luckysheet_select_save = normalizeSelection(ctx, [last]);
}
