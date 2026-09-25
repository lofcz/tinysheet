/**
 * AutoFit column width / row height (double-click a header border, or the
 * context menu), and automatic row growth for wrapped text.
 *
 * Follows Excel:
 * - the displayed (formatted) text is measured with the cell's font, size,
 *   weight and rotation;
 * - merged cells are ignored, and so are hidden rows (column autofit) and
 *   hidden columns (row autofit);
 * - an empty column / row goes back to the default size;
 * - autofit clears the "custom size" flag, and rows with a custom height are
 *   never grown or shrunk automatically.
 */
import _ from "lodash";
import { Context } from "../context";
import { Cell, CellMatrix, Sheet } from "../types";
import { getSheetIndex } from "../utils";
import { isInlineStringCell } from "./inline-string";
import { getCellTextInfo } from "./text";

/** Horizontal padding Excel leaves around autofitted text. */
const WIDTH_PADDING = 6;
const MIN_ROW_HEIGHT = 1;
const MAX_ROW_HEIGHT = 545;
const MAX_COL_WIDTH = 2038;

export type AutofitMeasure = {
  /** Unzoomed text width of a cell (no wrapping). */
  width: (cell: Cell, r: number, c: number) => number;
  /** Unzoomed text height of a cell laid out in a column `colWidth` wide. */
  height: (cell: Cell, r: number, c: number, colWidth: number) => number;
};

let offscreen: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(
  renderCtx?: CanvasRenderingContext2D | null
): CanvasRenderingContext2D | null {
  if (renderCtx) return renderCtx;
  if (offscreen === undefined) {
    try {
      offscreen =
        typeof document === "undefined"
          ? null
          : document.createElement("canvas").getContext("2d");
    } catch (e) {
      offscreen = null;
    }
  }
  return offscreen;
}

/** Text measurement backed by the canvas layout engine. */
export function canvasAutofitMeasure(
  ctx: Context,
  renderCtx?: CanvasRenderingContext2D | null
): AutofitMeasure | null {
  const canvas = getMeasureContext(renderCtx);
  if (!canvas) return null;
  const zoom = ctx.zoomRatio || 1;
  return {
    width: (cell, r, c) => {
      const info = getCellTextInfo(cell, canvas, ctx, { r, c });
      return (info?.textWidthAll ?? 0) / zoom;
    },
    height: (cell, r, c, colWidth) => {
      const info = getCellTextInfo(cell, canvas, ctx, {
        r,
        c,
        cellWidth: colWidth * zoom - 2,
      });
      return ((info?.textHeightAll ?? 0) + 2) / zoom;
    },
  };
}

function hasContent(cell: Cell | null | undefined): cell is Cell {
  if (!cell) return false;
  if (isInlineStringCell(cell)) return true;
  const shown = cell.m ?? cell.v;
  return shown != null && `${shown}` !== "";
}

function getSheet(ctx: Context, sheetId?: string): Sheet | null {
  const index = getSheetIndex(ctx, sheetId || ctx.currentSheetId);
  return index == null ? null : ctx.luckysheetfile[index];
}

function defaultRowHeight(ctx: Context, sheet: Sheet) {
  return sheet.defaultRowHeight || ctx.defaultrowlen || 19;
}

function defaultColWidth(ctx: Context, sheet: Sheet) {
  return sheet.defaultColWidth || ctx.defaultcollen || 73;
}

/** Best width for column `c`, or the default width for an empty column. */
export function getAutofitColumnWidth(
  ctx: Context,
  c: number,
  measure: AutofitMeasure,
  sheetId?: string
): number {
  const sheet = getSheet(ctx, sheetId);
  if (!sheet?.data) return ctx.defaultcollen;
  const d: CellMatrix = sheet.data;
  const hidden = sheet.config?.rowhidden || {};
  let best = 0;
  for (let r = 0; r < d.length; r += 1) {
    if (hidden[r] != null) continue;
    const cell = d[r]?.[c];
    if (!hasContent(cell) || cell.mc) continue;
    best = Math.max(best, measure.width(cell, r, c));
  }
  if (best <= 0) return defaultColWidth(ctx, sheet);
  return Math.min(MAX_COL_WIDTH, Math.ceil(best + WIDTH_PADDING));
}

/** Best height for row `r`, or the default height for an empty row. */
export function getAutofitRowHeight(
  ctx: Context,
  r: number,
  measure: AutofitMeasure,
  sheetId?: string
): number {
  const sheet = getSheet(ctx, sheetId);
  const base = sheet ? defaultRowHeight(ctx, sheet) : ctx.defaultrowlen;
  const row = sheet?.data?.[r];
  if (!sheet || !row) return base;
  const cfg = sheet.config || {};
  const hidden = cfg.colhidden || {};
  let best = 0;
  for (let c = 0; c < row.length; c += 1) {
    if (hidden[c] != null) continue;
    const cell = row[c];
    if (!hasContent(cell) || cell.mc) continue;
    const colWidth = cfg.columnlen?.[c] ?? defaultColWidth(ctx, sheet);
    best = Math.max(best, measure.height(cell, r, c, colWidth));
  }
  return Math.min(
    MAX_ROW_HEIGHT,
    Math.max(MIN_ROW_HEIGHT, base, Math.ceil(best))
  );
}

function syncConfig(ctx: Context, sheet: Sheet) {
  if (sheet.id === ctx.currentSheetId) ctx.config = sheet.config!;
}

/** Fit the width of each column in `columns` to its content. */
export function autofitColumns(
  ctx: Context,
  columns: number[],
  options: {
    sheetId?: string;
    measure?: AutofitMeasure | null;
    renderCtx?: CanvasRenderingContext2D | null;
  } = {}
) {
  const sheet = getSheet(ctx, options.sheetId);
  const measure =
    options.measure || canvasAutofitMeasure(ctx, options.renderCtx);
  if (!sheet || !measure) return;
  sheet.config ||= {};
  const cfg = sheet.config;
  const def = defaultColWidth(ctx, sheet);
  _.uniq(columns).forEach((c) => {
    if (cfg.colhidden?.[c] != null) return;
    const width = getAutofitColumnWidth(ctx, c, measure, sheet.id);
    cfg.columnlen ||= {};
    if (width === def) delete cfg.columnlen[c];
    else cfg.columnlen[c] = width;
    if (cfg.customWidth) delete cfg.customWidth[c];
  });
  syncConfig(ctx, sheet);
}

/** Fit the height of each row in `rows` to its content. */
export function autofitRows(
  ctx: Context,
  rows: number[],
  options: {
    sheetId?: string;
    measure?: AutofitMeasure | null;
    renderCtx?: CanvasRenderingContext2D | null;
  } = {}
) {
  const sheet = getSheet(ctx, options.sheetId);
  const measure =
    options.measure || canvasAutofitMeasure(ctx, options.renderCtx);
  if (!sheet || !measure) return;
  sheet.config ||= {};
  const cfg = sheet.config;
  const def = defaultRowHeight(ctx, sheet);
  _.uniq(rows).forEach((r) => {
    if (cfg.rowhidden?.[r] != null) return;
    const height = getAutofitRowHeight(ctx, r, measure, sheet.id);
    cfg.rowlen ||= {};
    if (height === def) delete cfg.rowlen[r];
    else cfg.rowlen[r] = height;
    if (cfg.customHeight) delete cfg.customHeight[r];
  });
  syncConfig(ctx, sheet);
}

/**
 * The rows / columns an autofit started on header `index` applies to: every
 * selected entire row / column when `index` is part of that selection
 * (Excel's multi-column autofit), otherwise just `index`.
 */
export function getAutofitTargets(
  ctx: Context,
  type: "row" | "column",
  index: number
): number[] {
  const sels = (ctx.luckysheet_select_save || []).filter((s) =>
    type === "row" ? s.row_select : s.column_select
  );
  const span = (s: { row: number[]; column: number[] }) =>
    type === "row" ? s.row : s.column;
  const hit = sels.some((s) => index >= span(s)[0] && index <= span(s)[1]);
  if (!hit) return [index];
  const out: number[] = [];
  sels.forEach((s) => {
    for (let i = span(s)[0]; i <= span(s)[1]; i += 1) out.push(i);
  });
  return _.uniq(out);
}

/**
 * After editing (r, c): rows without a custom height follow their wrapped
 * content, growing and shrinking like Excel.
 */
export function autoGrowRowAfterEdit(
  ctx: Context,
  r: number,
  c: number,
  options: {
    sheetId?: string;
    measure?: AutofitMeasure | null;
    renderCtx?: CanvasRenderingContext2D | null;
  } = {}
) {
  const sheet = getSheet(ctx, options.sheetId);
  const cell = sheet?.data?.[r]?.[c];
  if (!sheet || sheet.config?.customHeight?.[r]) return;
  const wraps =
    cell != null && (`${cell.tb}` === "2" || isInlineStringCell(cell));
  // only rows that hold wrapped text change on their own
  if (!wraps && sheet.config?.rowlen?.[r] == null) return;
  if (!wraps) {
    const row = sheet.data?.[r] || [];
    const anyWrap = row.some(
      (x) => x != null && (`${x.tb}` === "2" || isInlineStringCell(x))
    );
    if (!anyWrap) return;
  }
  const measure =
    options.measure || canvasAutofitMeasure(ctx, options.renderCtx);
  if (!measure) return;
  sheet.config ||= {};
  const cfg = sheet.config;
  const height = getAutofitRowHeight(ctx, r, measure, sheet.id);
  cfg.rowlen ||= {};
  if (height === defaultRowHeight(ctx, sheet)) delete cfg.rowlen[r];
  else cfg.rowlen[r] = height;
  syncConfig(ctx, sheet);
}
