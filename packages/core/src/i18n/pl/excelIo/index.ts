import type { NamespaceExcelIoTranslation } from "../../i18n-types";

const pl = {
  importTooltip: "Importuj plik",
  exportTooltip: "Eksportuj…",
  exportXlsx: "Eksportuj jako .xlsx",
  exportCsv: "Eksportuj jako .csv",
  exportCsvRaw: "Eksportuj jako .csv (wartości surowe)",
  exportTsv: "Eksportuj jako .tsv",
  importing: "Importowanie {name}…",
  exporting: "Eksportowanie…",
  importFailed: "Nie udało się zaimportować pliku {name}.",
  exportFailed: "Nie udało się wyeksportować skoroszytu.",
  errorUnsupportedFormat:
    "Plik {name} jest w starym formacie .xls lub jest chroniony hasłem. Zapisz go jako niechroniony plik .xlsx i spróbuj ponownie.",
  errorNotAZip: "Plik {name} nie jest plikiem .xlsx.",
  errorNoWorkbook: "Plik {name} nie zawiera skoroszytu.",
} as const satisfies NamespaceExcelIoTranslation;

export default pl;
