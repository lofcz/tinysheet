/**
 * Excel's View › Show options (Gridlines, Headings, Formula Bar), Zoom to
 * Selection and the sheet direction (right-to-left).
 *
 * Gridlines and headings are per sheet (`sheet.showGridLines`,
 * `sheet.showRowColHeaders`) and round-trip through xlsx `sheetView`; the
 * formula bar is a workbook (application) setting kept on the context.
 * Headings are hidden by drawing them HIDDEN_HEADER_SIZE px wide/high (the
 * DOM headers subtract 1.5 px, so they end up 0.5 px): the React layer puts
 * the configured sizes back when they are shown again.
 */
import type { Context } from "../context";
import type { Sheet } from "../types";
import { getSheetIndex } from "../utils";
import { MAX_ZOOM_RATIO, MIN_ZOOM_RATIO } from "./zoom";

/** Header size (px) while View › Headings is off. */
export const HIDDEN_HEADER_SIZE = 2;

function sheetOf(ctx: Context, sheetId?: string): Sheet | null {
  const i = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  return i == null ? null : ctx.luckysheetfile[i];
}

/** Does the sheet show gridlines (0, false and "0" hide them)? */
export function sheetShowsGridLines(
  sheet?: Pick<Sheet, "showGridLines"> | null
) {
  const v = sheet?.showGridLines as unknown;
  return !(v === 0 || v === false || v === "0" || v === "false");
}

export function setShowGridLines(
  ctx: Context,
  show: boolean,
  sheetId: string = ctx.currentSheetId
) {
  const sheet = sheetOf(ctx, sheetId);
  if (!sheet) return;
  sheet.showGridLines = show ? 1 : 0;
  if (sheetId === ctx.currentSheetId) ctx.showGridLines = show;
}

/** Does the sheet show its row and column headings? */
export function sheetShowsHeadings(
  sheet?: Pick<Sheet, "showRowColHeaders"> | null
) {
  return sheet?.showRowColHeaders !== false;
}

export function setShowHeadings(
  ctx: Context,
  show: boolean,
  sheetId: string = ctx.currentSheetId
) {
  const sheet = sheetOf(ctx, sheetId);
  if (!sheet) return;
  if (show) delete sheet.showRowColHeaders;
  else sheet.showRowColHeaders = false;
  if (!show && sheetId === ctx.currentSheetId) {
    ctx.rowHeaderWidth = HIDDEN_HEADER_SIZE;
    ctx.columnHeaderHeight = HIDDEN_HEADER_SIZE;
  }
}

/** View › Formula Bar (a workbook-wide setting, like Excel's). */
export function setShowFormulaBar(ctx: Context, show: boolean) {
  ctx.hideFormulaBar = !show;
}

/**
 * Right-to-left sheet direction (xlsx `sheetView rightToLeft`). Stored and
 * exported; the grid itself is still drawn left-to-right.
 */
export function setSheetRightToLeft(
  ctx: Context,
  rtl: boolean,
  sheetId: string = ctx.currentSheetId
) {
  const sheet = sheetOf(ctx, sheetId);
  if (!sheet) return;
  if (rtl) sheet.rightToLeft = true;
  else delete sheet.rightToLeft;
}

/**
 * The zoom at which the selection fills the visible cell area (Excel's
 * Zoom to Selection), clamped to the supported range; null without a
 * selection or sizes.
 */
export function zoomForSelection(ctx: Context): number | null {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel || !ctx.visibledatarow?.length || !ctx.visibledatacolumn?.length) {
    return null;
  }
  const zoom = ctx.zoomRatio || 1;
  const [r1, r2] = sel.row;
  const [c1, c2] = sel.column;
  const rows = ctx.visibledatarow;
  const cols = ctx.visibledatacolumn;
  const top = r1 > 0 ? rows[r1 - 1] : 0;
  const left = c1 > 0 ? cols[c1 - 1] : 0;
  const bottom = rows[Math.min(r2, rows.length - 1)];
  const right = cols[Math.min(c2, cols.length - 1)];
  const w = (right - left) / zoom;
  const h = (bottom - top) / zoom;
  if (!(w > 0) || !(h > 0)) return null;
  // leave room for the scrollbars
  const areaW = Math.max(ctx.cellmainWidth - 20, 1);
  const areaH = Math.max(ctx.cellmainHeight - 20, 1);
  const fit = Math.min(areaW / w, areaH / h);
  const clamped = Math.min(MAX_ZOOM_RATIO, Math.max(MIN_ZOOM_RATIO, fit));
  return Math.floor(clamped * 100) / 100;
}

/** Scroll the selection's top-left cell to the top-left of the window. */
export function scrollSelectionIntoCorner(ctx: Context) {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return;
  ctx.scrollTop =
    sel.row[0] > 0 ? (ctx.visibledatarow[sel.row[0] - 1] ?? 0) : 0;
  ctx.scrollLeft =
    sel.column[0] > 0 ? (ctx.visibledatacolumn[sel.column[0] - 1] ?? 0) : 0;
}

/**
 * Zoom so the selection fills the window and scroll it to the top-left
 * corner. Returns the new zoom, or null when there was nothing to do.
 */
export function zoomToSelection(ctx: Context): number | null {
  const next = zoomForSelection(ctx);
  const sheet = sheetOf(ctx);
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (next == null || !sheet || !sel) return null;
  const zoom = ctx.zoomRatio || 1;
  const top = sel.row[0] > 0 ? ctx.visibledatarow[sel.row[0] - 1] : 0;
  const left = sel.column[0] > 0 ? ctx.visibledatacolumn[sel.column[0] - 1] : 0;
  sheet.zoomRatio = next;
  ctx.zoomRatio = next;
  ctx.scrollTop = Math.round((top / zoom) * next);
  ctx.scrollLeft = Math.round((left / zoom) * next);
  return next;
}
