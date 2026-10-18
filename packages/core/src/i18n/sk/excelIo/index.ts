import type { NamespaceExcelIoTranslation } from "../../i18n-types";

const sk = {
  importTooltip: "Importovať súbor",
  exportTooltip: "Exportovať…",
  exportXlsx: "Exportovať ako .xlsx",
  exportCsv: "Exportovať ako .csv",
  exportCsvRaw: "Exportovať ako .csv (čisté hodnoty)",
  exportTsv: "Exportovať ako .tsv",
  importing: "Importujem {name}…",
  exporting: "Exportujem…",
  importFailed: "Súbor {name} sa nepodarilo importovať.",
  exportFailed: "Zošit sa nepodarilo exportovať.",
  errorUnsupportedFormat:
    "Súbor {name} je v starom formáte .xls alebo je chránený heslom. Uložte ho ako nechránený súbor .xlsx a skúste to znova.",
  errorNotAZip: "Súbor {name} nie je vo formáte .xlsx.",
  errorNoWorkbook: "Súbor {name} neobsahuje zošit.",
} as const satisfies NamespaceExcelIoTranslation;

export default sk;
