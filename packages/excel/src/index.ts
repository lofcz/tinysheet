export { parseExcel } from "./parse/parseExcel";
export type { ExcelImportResult, ExcelImportSizing } from "./parse/types";

export { applyExcelImport } from "./hydrate/applyExcelImport";
export type { ExcelImportWorkbook } from "./hydrate/applyExcelImport";
export { applyExcelImportHydration } from "./hydrate/applyExcelImportHydration";

export {
  refreshSheetChartImages,
  resolveChartSpecToSeries,
  renderChartSvgFromSeries,
  parseChartNumber,
} from "./chart";
export type {
  FortuneChartSpec,
  FortuneChartSeriesSpec,
  ChartCellResolver,
  ChartCellValue,
  ChartSeriesPoint,
} from "./chart";

/** @deprecated Prefer parseExcel + applyExcelImport */
export { transformExcelToFortune } from "./compat/transformExcelToFortune";
export { transformFortuneToExcel } from "./common/Transform";

export { IFileType } from "./common/ICommon";

// Optional React toolbar helpers (peer: react)
export * from "./common/ToolbarItem";
export * from "./common/FortuneExcelHelper";
