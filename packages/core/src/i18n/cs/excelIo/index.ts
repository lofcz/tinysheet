import type { NamespaceExcelIoTranslation } from "../../i18n-types";

const cs = {
  importTooltip: "Importovat soubor",
  exportTooltip: "Exportovat…",
  exportXlsx: "Exportovat jako .xlsx",
  exportCsv: "Exportovat jako .csv",
  exportCsvRaw: "Exportovat jako .csv (prosté hodnoty)",
  exportTsv: "Exportovat jako .tsv",
  importing: "Importuji {name}…",
  exporting: "Exportuji…",
  importFailed: "Soubor {name} se nepodařilo importovat.",
  exportFailed: "Sešit se nepodařilo exportovat.",
  errorUnsupportedFormat:
    "Soubor {name} je ve starém formátu .xls nebo je chráněný heslem. Uložte jej jako nechráněný soubor .xlsx a zkuste to znovu.",
  errorNotAZip: "Soubor {name} není ve formátu .xlsx.",
  errorNoWorkbook: "Soubor {name} neobsahuje sešit.",
} as const satisfies NamespaceExcelIoTranslation;

export default cs;
