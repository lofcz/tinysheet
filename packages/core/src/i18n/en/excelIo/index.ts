import type { BaseTranslation } from "typesafe-i18n";

const en = {
  importTooltip: "Import file",
  exportTooltip: "Export...",
  exportXlsx: "Export as .xlsx",
  exportCsv: "Export as .csv",
  exportCsvRaw: "Export as .csv (raw values)",
  exportTsv: "Export as .tsv",
  importing: "Importing {name}...",
  exporting: "Exporting...",
  importFailed: "Could not import {name}.",
  exportFailed: "Could not export the workbook.",
  errorUnsupportedFormat:
    "{name} is a legacy .xls file or a password-protected workbook. Save it as an unprotected .xlsx file and try again.",
  errorNotAZip: "{name} is not an .xlsx file.",
  errorNoWorkbook: "{name} does not contain a workbook.",
} as const satisfies BaseTranslation;

export default en;
