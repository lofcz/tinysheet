/**
 * Sheet-structure writers: column widths, row heights, hidden rows and
 * columns, merges and sheet views (freeze panes, gridlines, zoom).
 */
import type ExcelJS from "@protobi/exceljs";
import type { SheetExportContext } from "./buildWorkbook";
import { pxToExcelWidth, pxToPoints } from "../common/units";
import { cellAddress } from "../common/formulaText";

const DEFAULT_COLUMN_WIDTH_PX = 73;

export function writeColumnsAndRows(ctx: SheetExportContext) {
  const { sheet, worksheet, options } = ctx;
  const config = sheet.config || {};
  // TinySheet draws columns without a width at the workbook default (73px),
  // whatever width the sheet was imported with.
  const defaultWidth = options.defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH_PX;
  worksheet.properties.defaultColWidth = pxToExcelWidth(defaultWidth);

  Object.keys(config.columnlen || {}).forEach((key) => {
    const px = Number(config.columnlen[key]);
    if (!Number.isFinite(px)) return;
    worksheet.getColumn(Number(key) + 1).width = pxToExcelWidth(px);
  });
  Object.keys(config.rowlen || {}).forEach((key) => {
    const px = Number(config.rowlen[key]);
    if (!Number.isFinite(px)) return;
    worksheet.getRow(Number(key) + 1).height = pxToPoints(px);
  });
  Object.keys(config.colhidden || {}).forEach((key) => {
    worksheet.getColumn(Number(key) + 1).hidden = true;
  });
  Object.keys(config.rowhidden || {}).forEach((key) => {
    const row = worksheet.getRow(Number(key) + 1);
    row.hidden = true;
    // ExcelJS drops rows without cells or a height.
    if (!row.height) {
      row.height = pxToPoints(Number(sheet.defaultRowHeight) || 19);
    }
  });
}

export function writeMerges(ctx: SheetExportContext) {
  const merges = ctx.sheet.config?.merge;
  if (!merges) return;
  Object.values<any>(merges).forEach((m) => {
    if (!m || m.rs == null || m.cs == null) return;
    if (m.rs <= 1 && m.cs <= 1) return;
    try {
      ctx.worksheet.mergeCells(m.r + 1, m.c + 1, m.r + m.rs, m.c + m.cs);
    } catch (e) {
      // Overlapping merges are invalid in Excel: keep the first one.
    }
  });
}

/** Number of frozen rows and columns of a TinySheet `frozen` setting. */
export function frozenSplit(frozen: any): { xSplit: number; ySplit: number } {
  if (!frozen?.type) return { xSplit: 0, ySplit: 0 };
  const rowFocus = Number(frozen.range?.row_focus ?? 0);
  const colFocus = Number(frozen.range?.column_focus ?? 0);
  switch (frozen.type) {
    case "row":
      return { xSplit: 0, ySplit: 1 };
    case "column":
      return { xSplit: 1, ySplit: 0 };
    case "both":
      return frozen.range
        ? { xSplit: colFocus + 1, ySplit: rowFocus + 1 }
        : { xSplit: 1, ySplit: 1 };
    case "rangeRow":
      return { xSplit: 0, ySplit: rowFocus + 1 };
    case "rangeColumn":
      return { xSplit: colFocus + 1, ySplit: 0 };
    case "rangeBoth":
      return { xSplit: colFocus + 1, ySplit: rowFocus + 1 };
    default:
      return { xSplit: 0, ySplit: 0 };
  }
}

export function writeSheetViews(ctx: SheetExportContext) {
  const { sheet, worksheet } = ctx;
  const view: Partial<ExcelJS.WorksheetView> & Record<string, any> = {};
  const { xSplit, ySplit } = frozenSplit(sheet.frozen);
  if (xSplit > 0 || ySplit > 0) {
    Object.assign(view, {
      state: "frozen",
      xSplit,
      ySplit,
      topLeftCell: cellAddress(ySplit, xSplit),
    });
  } else {
    view.state = "normal";
  }
  const grid = sheet.showGridLines;
  if (grid === 0 || grid === "0" || grid === false) view.showGridLines = false;
  if (sheet.showRowColHeaders === false) view.showRowColHeaders = false;
  if (sheet.rightToLeft) view.rightToLeft = true;
  const zoom = Number(sheet.zoomRatio);
  if (Number.isFinite(zoom) && zoom > 0 && zoom !== 1) {
    view.zoomScale = Math.max(10, Math.min(400, Math.round(zoom * 100)));
  }
  if (Number(sheet.status) === 1) view.tabSelected = true;
  const sel = sheet.luckysheet_select_save?.[0];
  if (sel?.row?.length && sel?.column?.length) {
    view.activeCell = cellAddress(sel.row[0], sel.column[0]);
  }
  worksheet.views = [view as ExcelJS.WorksheetView];
}
