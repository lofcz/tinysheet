import type { Context } from "@lofcz/tinysheet-core";
import type { ExcelImportResult } from "../parse/types";
import { applyExcelImportHydration } from "./applyExcelImportHydration";

export type ExcelImportWorkbook = {
  setContext: (recipe: (ctx: Context) => void) => void;
};

/**
 * Hydrate a mounted Workbook from a prior parseExcel result in one setContext.
 */
export function applyExcelImport(
  workbook: ExcelImportWorkbook,
  result: ExcelImportResult
): void {
  workbook.setContext((ctx) => {
    applyExcelImportHydration(ctx, result);
  });
}
