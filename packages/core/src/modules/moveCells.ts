import _ from "lodash";

import { Context, getFlowdata } from "../context";
import {
  colLocation,
  colLocationByIndex,
  mousePosition,
  rowLocation,
  rowLocationByIndex,
} from "./location";
import { hasPartMC } from "./validation";
import { locale } from "../locale";
import { getBorderInfoCompute } from "./border";
import { normalizeSelection } from "./selection";
import { getSheetIndex, isAllowEdit } from "../utils";
import { Cell, GlobalCache } from "../types";
import { reconcileSpillsAfterMove } from "./spill";
import { CFSplitRange } from "./ConditionFormat";
import { adjustReferences, recalcAfterStructuralChange } from "./refAdjust";
import { expandRowsAndColumns } from "./sheet";

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
  e: MouseEvent,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
  container: HTMLDivElement
) {
  const rect = container.getBoundingClientRect();
  const x = e.pageX - rect.left - ctx.rowHeaderWidth + scrollbarX.scrollLeft;
  const y = e.pageY - rect.top - ctx.columnHeaderHeight + scrollbarY.scrollTop;

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
    return;
  }

  globalCache.dragCellStartPos = { x: e.pageX, y: e.pageY };
  ctx.luckysheet_cell_selected_move = true;
  ctx.luckysheet_scroll_status = true;

  let {
    row: [row_pre, row, row_index],
    column: [col_pre, col, col_index],
  } = getCellLocationByMouse(ctx, e, scrollbarX, scrollbarY, container);

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
  const [x, y] = mousePosition(e.pageX, e.pageY, ctx);

  const rect = container.getBoundingClientRect();
  const winH = rect.height - 20 * ctx.zoomRatio;
  const winW = rect.width - 60 * ctx.zoomRatio;

  const { row: rowL, column } = getCellLocationByMouse(
    ctx,
    e,
    scrollbarX,
    scrollbarY,
    container
  );
  let [row_pre, row] = rowL;
  let [col_pre, col] = column;
  const row_index = rowL[2];
  const col_index = column[2];

  const row_index_original = ctx.luckysheet_cell_selected_move_index[0];
  const col_index_original = ctx.luckysheet_cell_selected_move_index[1];
  if (ctx.luckysheet_select_save == null) return;
  let row_s =
    ctx.luckysheet_select_save[0].row[0] - row_index_original + row_index;
  let row_e =
    ctx.luckysheet_select_save[0].row[1] - row_index_original + row_index;

  let col_s =
    ctx.luckysheet_select_save[0].column[0] - col_index_original + col_index;
  let col_e =
    ctx.luckysheet_select_save[0].column[1] - col_index_original + col_index;

  if (row_s < 0 || y < 0) {
    row_s = 0;
    row_e =
      ctx.luckysheet_select_save[0].row[1] -
      ctx.luckysheet_select_save[0].row[0];
  }

  if (col_s < 0 || x < 0) {
    col_s = 0;
    col_e =
      ctx.luckysheet_select_save[0].column[1] -
      ctx.luckysheet_select_save[0].column[0];
  }

  if (row_e >= ctx.visibledatarow.length - 1 || y > winH) {
    row_s =
      ctx.visibledatarow.length -
      1 -
      ctx.luckysheet_select_save[0].row[1] +
      ctx.luckysheet_select_save[0].row[0];
    row_e = ctx.visibledatarow.length - 1;
  }

  if (col_e >= ctx.visibledatacolumn.length - 1 || x > winW) {
    col_s =
      ctx.visibledatacolumn.length -
      1 -
      ctx.luckysheet_select_save[0].column[1] +
      ctx.luckysheet_select_save[0].column[0];
    col_e = ctx.visibledatacolumn.length - 1;
  }

  col_pre = col_s - 1 === -1 ? 0 : ctx.visibledatacolumn[col_s - 1];
  col = ctx.visibledatacolumn[col_e];
  row_pre = row_s - 1 === -1 ? 0 : ctx.visibledatarow[row_s - 1];
  row = ctx.visibledatarow[row_e];

  const ele = document.getElementById("fortune-cell-selected-move");
  if (ele == null) return;
  ele.style.left = `${col_pre}px`;
  ele.style.top = `${row_pre}px`;
  ele.style.width = `${col - col_pre - 2}px`;
  ele.style.height = `${row - row_pre - 2}px`;
  ele.style.display = "block";
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
  const ele = document.getElementById("fortune-cell-selected-move");
  if (ele != null) ele.style.display = "none";
  if (globalCache.dragCellStartPos != null) {
    globalCache.dragCellStartPos = undefined;
    return;
  }

  const [x, y] = mousePosition(e.pageX, e.pageY, ctx);

  // if (
  //   !checkProtectionLockedRangeList(
  //     ctx.luckysheet_select_save,
  //     ctx.currentSheetIndex
  //   )
  // ) {
  //   return;
  // }

  const rect = container.getBoundingClientRect();
  const winH = rect.height - 20 * ctx.zoomRatio;
  const winW = rect.width - 60 * ctx.zoomRatio;

  const {
    row: [, , row_index],
    column: [, , col_index],
  } = getCellLocationByMouse(ctx, e, scrollbarX, scrollbarY, container);

  const allowEdit = isAllowEdit(ctx, [
    {
      row: [row_index, row_index],
      column: [col_index, col_index],
    },
  ]);
  if (!allowEdit) return;

  const row_index_original = ctx.luckysheet_cell_selected_move_index[0];
  const col_index_original = ctx.luckysheet_cell_selected_move_index[1];

  if (row_index === row_index_original && col_index === col_index_original) {
    return;
  }

  const d = getFlowdata(ctx);
  if (d == null || ctx.luckysheet_select_save == null) return;
  const last =
    ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];

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
    // if (isEditMode()) {
    //   alert(locale_drag.noMerge);
    // } else {
    // drag.info(
    //   '<i class="fa fa-exclamation-triangle"></i>',
    throw new Error(locale_drag.noMerge);
    // );
    // }
    // return;
  }

  let row_s = last.row[0] - row_index_original + row_index;
  let row_e = last.row[1] - row_index_original + row_index;
  let col_s = last.column[0] - col_index_original + col_index;
  let col_e = last.column[1] - col_index_original + col_index;

  // if (
  //   !checkProtectionLockedRangeList(
  //     [{ row: [row_s, row_e], column: [col_s, col_e] }],
  //     ctx.currentSheetIndex
  //   )
  // ) {
  //   return;
  // }

  if (row_s < 0 || y < 0) {
    row_s = 0;
    row_e = last.row[1] - last.row[0];
  }

  if (col_s < 0 || x < 0) {
    col_s = 0;
    col_e = last.column[1] - last.column[0];
  }

  if (row_e >= ctx.visibledatarow.length - 1 || y > winH) {
    row_s = ctx.visibledatarow.length - 1 - last.row[1] + last.row[0];
    row_e = ctx.visibledatarow.length - 1;
  }

  if (col_e >= ctx.visibledatacolumn.length - 1 || x > winW) {
    col_s = ctx.visibledatacolumn.length - 1 - last.column[1] + last.column[0];
    col_e = ctx.visibledatacolumn.length - 1;
  }

  // 替换的位置包含部分单元格
  if (hasPartMC(ctx, cfg, row_s, row_e, col_s, col_e)) {
    // if (isEditMode()) {
    //   alert(locale_drag.noMerge);
    // } else {
    // tooltip.info(
    //   '<i class="fa fa-exclamation-triangle"></i>',
    throw new Error(locale_drag.noMerge);
    // );
    // }
    // return;
  }

  // move cells, formats, merges, borders, validation, links and CF, and
  // rewrite every reference to the moved cells (Excel semantics)
  moveCellRange(
    ctx,
    {
      sheetId: ctx.currentSheetId,
      range: {
        row: [last.row[0], last.row[1]],
        column: [last.column[0], last.column[1]],
      },
    },
    { sheetId: ctx.currentSheetId, row: row_s, column: col_s }
  );

  let rf;
  if (
    ctx.luckysheet_select_save[0].row_focus ===
    ctx.luckysheet_select_save[0].row[0]
  ) {
    rf = row_s;
  } else {
    rf = row_e;
  }

  let cf;
  if (
    ctx.luckysheet_select_save[0].column_focus ===
    ctx.luckysheet_select_save[0].column[0]
  ) {
    cf = col_s;
  } else {
    cf = col_e;
  }

  last.row = [row_s, row_e];
  last.column = [col_s, col_e];
  last.row_focus = rf;
  last.column_focus = cf;
  ctx.luckysheet_select_save = normalizeSelection(ctx, [last]);

  // selectHightlightShow();

  // $("#luckysheet-sheettable").css("cursor", "default");
  // clearTimeout(ctx.countfuncTimeout);
  // ctx.countfuncTimeout = setTimeout(function () {
  //   countfunc();
  // }, 500);
}
