/**
 * Row/column pixel geometry of any sheet at 100% zoom, for objects stored in
 * sheet pixels (charts, note boxes) that must follow their cells when rows,
 * columns or cells move.
 *
 * The current sheet uses the laid-out `visibledatarow` / `visibledatacolumn`
 * arrays (they include auto-sized columns); other sheets are computed from
 * their config (row heights, column widths, hidden rows/columns), the same
 * way the layout is.
 */
import type { Context } from "../context";
import type { Sheet } from "../types";

function sheetOf(ctx: Context, sheetId: string): Sheet | undefined {
  return ctx.luckysheetfile?.find((s) => s.id === sheetId);
}

function configOf(ctx: Context, sheetId: string) {
  if (sheetId === ctx.currentSheetId && ctx.config) return ctx.config;
  return sheetOf(ctx, sheetId)?.config ?? {};
}

function defaultRowHeight(ctx: Context) {
  return ctx.defaultrowlen || 19;
}

function defaultColumnWidth(ctx: Context) {
  return ctx.defaultcollen || 73;
}

/** Height of row `r` (grid line included); 0 when hidden. */
export function rowHeightPx(ctx: Context, sheetId: string, r: number) {
  const cfg = configOf(ctx, sheetId);
  if (cfg.rowhidden?.[r] != null) return 0;
  const len = Number(cfg.rowlen?.[r]) || defaultRowHeight(ctx);
  return len + 1;
}

/** Width of column `c` (grid line included); 0 when hidden. */
export function columnWidthPx(ctx: Context, sheetId: string, c: number) {
  const cfg = configOf(ctx, sheetId);
  if (cfg.colhidden?.[c] != null) return 0;
  const len = Number(cfg.columnlen?.[c]) || defaultColumnWidth(ctx);
  return len + 1;
}

/** Top edge of row `r` in sheet pixels at 100% zoom. */
export function rowTopPx(ctx: Context, sheetId: string, r: number) {
  if (r <= 0) return 0;
  if (sheetId === ctx.currentSheetId) {
    const v = ctx.visibledatarow?.[r - 1];
    if (v != null) return v / (ctx.zoomRatio || 1);
  }
  let top = 0;
  for (let i = 0; i < r; i += 1) top += rowHeightPx(ctx, sheetId, i);
  return top;
}

/** Left edge of column `c` in sheet pixels at 100% zoom. */
export function columnLeftPx(ctx: Context, sheetId: string, c: number) {
  if (c <= 0) return 0;
  if (sheetId === ctx.currentSheetId) {
    const v = ctx.visibledatacolumn?.[c - 1];
    if (v != null) return v / (ctx.zoomRatio || 1);
  }
  let left = 0;
  for (let i = 0; i < c; i += 1) left += columnWidthPx(ctx, sheetId, i);
  return left;
}

/** Size of `count` freshly inserted rows or columns (default size). */
export function insertedSizePx(
  ctx: Context,
  axis: "row" | "column",
  count: number
) {
  const one =
    axis === "row" ? defaultRowHeight(ctx) + 1 : defaultColumnWidth(ctx) + 1;
  return one * count;
}
