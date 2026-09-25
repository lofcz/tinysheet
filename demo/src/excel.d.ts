/*
 * The part of @lofcz/tinysheet-excel the demo's File menu uses, under the
 * "demo-excel" alias (demo/rsbuild.config.ts). Declared here so the strict
 * type-check of the demo does not pull in the excel package's sources,
 * which are checked with relaxed settings (tsconfig.excel.json).
 */
declare module "demo-excel" {
  import type { Sheet } from "@lofcz/tinysheet-core";

  export type ExcelImportResult = { sheets: Sheet[]; sizing: unknown[] };
  export function parseExcel(
    input: File | Blob | ArrayBuffer,
    fileName?: string
  ): Promise<ExcelImportResult>;
  export function applyExcelImport(
    workbook: { setContext: (recipe: (ctx: any) => void) => void },
    result: ExcelImportResult
  ): void;
  export function parseCsv(
    file: Blob
  ): Promise<{ sheet: Partial<Sheet>; delimiter: string }>;
  export function exportToXlsx(sheets: Sheet[]): Promise<Uint8Array>;
  export function exportCsv(sheet: Sheet): Blob;
}
