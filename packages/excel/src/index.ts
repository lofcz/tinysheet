export { parseExcel } from "./parse/parseExcel";
export type { ParseExcelOptions } from "./parse/parseExcel";
export type { ExcelImportResult, ExcelImportSizing } from "./parse/types";

export { applyExcelImport } from "./hydrate/applyExcelImport";
export type { ExcelImportWorkbook } from "./hydrate/applyExcelImport";
export { applyExcelImportHydration } from "./hydrate/applyExcelImportHydration";

// xlsx export (pure: sheets in, bytes out) and its extension points.
export {
  exportToXlsx,
  buildExcelWorkbook,
  buildExcelWorkbookWithInfo,
  sheetCellMatrix,
  sheetExportFeatures,
  workbookExportFeatures,
  registerSheetExportFeature,
  registerWorkbookExportFeature,
} from "./ToExcel/buildWorkbook";
export type {
  XlsxExportOptions,
  SheetExportContext,
  WorkbookExportContext,
  SheetExportFeature,
  WorkbookExportFeature,
} from "./ToExcel/buildWorkbook";
export { postProcessXlsx } from "./ToExcel/postProcess";
export type { XlsxPostProcessInfo } from "./ToExcel/postProcess";
// Zip post-processors: the extension hook for parts ExcelJS cannot write.
export {
  xlsxPostProcessors,
  registerXlsxPostProcessor,
  runXlsxPostProcessors,
  createPostProcessContext,
} from "./ToExcel/postProcessors";
export type {
  XlsxPostProcessor,
  XlsxPostProcessorFn,
  XlsxPostProcessContext,
  XlsxWorksheetPart,
  RegisterXlsxPostProcessorOptions,
  RunXlsxPostProcessorsInput,
} from "./ToExcel/postProcessors";
export {
  WORKSHEET_CHILD_ORDER,
  addContentTypeDefault,
  addContentTypeOverride,
  addExtension,
  addRelationship,
  ensureNamespace,
  findElement,
  insertWorksheetElement,
  parseRelationships,
  relativeTarget,
  relsPathFor,
  resolveTarget,
  setTagAttr,
  tagAttr,
} from "./ToExcel/xlsxParts";
export type { SheetExportOptions } from "./ToExcel/ExcelFile";

// xlsx import extension points.
export {
  sheetImportFeatures,
  workbookImportFeatures,
  registerSheetImportFeature,
  registerWorkbookImportFeature,
  partRelationships,
} from "./ToFortuneSheet/importFeatures";
export type {
  SheetImportContext,
  WorkbookImportContext,
  SheetImportFeature,
  WorkbookImportFeature,
} from "./ToFortuneSheet/importFeatures";

// Formula text helpers (future-function prefixes, shared-formula shifting).
export {
  toExcelFormula,
  fromExcelFormula,
  shiftFormula,
} from "./common/formulaText";

// CSV / TSV
export {
  parseCsv,
  csvToSheet,
  parseCsvText,
  sniffDelimiter,
  decodeCsvBytes,
  normalizeLocaleInput,
  sheetToCsv,
  sheetToCsvBytes,
  cellCsvText,
  exportCsv,
} from "./csv";
export type {
  CsvParseOptions,
  CsvExportOptions,
  CsvDelimiter,
  CsvEncoding,
  CsvDateOrder,
} from "./csv";

export {
  refreshSheetChartImages,
  resolveChartSpecToSeries,
  renderChartSvgFromSeries,
  parseChartNumber,
  computeAxisScale,
  computeNiceAxisMax,
  formatAxisTick,
  DEFAULT_CHART_COLORS,
  importChartXml,
  addChartsToXlsx,
  chartToXml,
} from "./chart";
export type {
  ImportedChart,
  ImportChartOptions,
  FortuneChartSpec,
  FortuneChartSeriesSpec,
  FortuneChartValueAxis,
  ChartCellResolver,
  ChartCellValue,
  ChartSeriesPoint,
  ChartRenderOptions,
  AxisScale,
  AxisScaleOverrides,
} from "./chart";

/** @deprecated Prefer parseExcel + applyExcelImport */
export { transformExcelToFortune } from "./compat/transformExcelToFortune";
export { transformFortuneToExcel } from "./common/Transform";

export { IFileType } from "./common/ICommon";

// Optional React toolbar helpers (peer: react)
export * from "./common/ToolbarItem";
export * from "./common/FortuneExcelHelper";
