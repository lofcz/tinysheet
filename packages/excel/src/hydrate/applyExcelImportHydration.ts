import {
  api,
  Context,
  Sheet,
} from "@lofcz/tinysheet-core";
import {
  ChartCellResolver,
  ChartCellValue,
  parseChartNumber,
  refreshSheetChartImages,
} from "../chart";
import { getcellrange } from "../common/method";
import type { ExcelImportResult } from "../parse/types";

function normalizeReference(reference: string) {
  let normalized = reference.replace(/\$/g, "");
  normalized = normalized.replace(/^'([^']+)'!/, "$1!");
  return normalized;
}

function cellToChartValue(cell: any): ChartCellValue {
  if (cell == null) {
    return { display: "", numeric: null };
  }

  if (typeof cell !== "object") {
    const display = String(cell);
    const numeric = parseChartNumber(display);
    return { display, numeric: isNaN(numeric) ? null : numeric };
  }

  const display =
    cell.m != null && cell.m !== ""
      ? String(cell.m)
      : cell.v != null && cell.v !== ""
        ? String(cell.v)
        : "";
  const numeric =
    cell.v != null && cell.v !== "" ? parseChartNumber(cell.v) : null;

  return {
    display,
    numeric: numeric != null && !isNaN(numeric) ? numeric : null,
  };
}

export function createContextChartCellResolver(
  ctx: Context,
  sheet: Sheet
): ChartCellResolver {
  const sheetList: Record<string, string> = {};
  for (const item of ctx.luckysheetfile) {
    if (item.name != null && item.id != null) {
      sheetList[item.name] = item.id;
    }
  }

  return (reference: string) => {
    if (reference == null || reference === "") {
      return [];
    }

    const range = getcellrange(
      normalizeReference(reference),
      sheetList,
      sheet.id
    );
    if (range == null) {
      return [];
    }

    const targetIndex = ctx.luckysheetfile.findIndex(
      (item) => item.id === range.sheetIndex
    );
    const target =
      targetIndex >= 0 ? ctx.luckysheetfile[targetIndex] : sheet;
    const data = target.data;
    const values: ChartCellValue[] = [];

    for (let r = range.row[0]; r <= range.row[1]; r++) {
      for (let c = range.column[0]; c <= range.column[1]; c++) {
        values.push(cellToChartValue(data?.[r]?.[c]));
      }
    }

    return values;
  };
}

/**
 * Apply import hydration on a live workbook draft:
 * column/row sizes → formula calculation → chart SVG refresh.
 * Intended to run inside a single Workbook setContext.
 */
export function applyExcelImportHydration(
  ctx: Context,
  result: ExcelImportResult
): void {
  for (const size of result.sizing) {
    if (size.columnlen && Object.keys(size.columnlen).length > 0) {
      api.setColumnWidth(ctx, size.columnlen, { id: size.id });
    }
    if (size.rowlen && Object.keys(size.rowlen).length > 0) {
      api.setRowHeight(ctx, size.rowlen, { id: size.id });
    }
  }

  api.calculateFormula(ctx);

  for (const sheet of ctx.luckysheetfile) {
    if (sheet.images == null || !Array.isArray(sheet.images)) {
      continue;
    }

    const resolver = createContextChartCellResolver(ctx, sheet);
    sheet.images = refreshSheetChartImages(sheet.images as any, resolver) as any;

    if (sheet.id === ctx.currentSheetId) {
      ctx.insertedImgs = sheet.images as any;
    }
  }
}
