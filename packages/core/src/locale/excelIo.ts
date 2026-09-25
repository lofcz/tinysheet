/**
 * Strings of the excel package's UI (import / export toolbar items, the
 * export menu and import messages). Kept in their own file, like
 * dataTools.ts and chart.ts, so the excel package does not touch the big
 * per-language files. Every language falls back to English key by key.
 */

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
};

export type ExcelIoLocale = typeof en;

const zh: Partial<ExcelIoLocale> = {
  importTooltip: "导入文件",
  exportTooltip: "导出...",
  exportXlsx: "导出为 .xlsx",
  exportCsv: "导出为 .csv",
  exportCsvRaw: "导出为 .csv（原始值）",
  exportTsv: "导出为 .tsv",
  importing: "正在导入 {name}...",
  exporting: "正在导出...",
  importFailed: "无法导入 {name}。",
  exportFailed: "无法导出工作簿。",
  errorUnsupportedFormat:
    "{name} 是旧版 .xls 文件或受密码保护的工作簿。请将其另存为未受保护的 .xlsx 文件后重试。",
  errorNotAZip: "{name} 不是 .xlsx 文件。",
  errorNoWorkbook: "{name} 不包含工作簿。",
};

const zhTW: Partial<ExcelIoLocale> = {
  importTooltip: "匯入檔案",
  exportTooltip: "匯出...",
  exportXlsx: "匯出為 .xlsx",
  exportCsv: "匯出為 .csv",
  exportCsvRaw: "匯出為 .csv（原始值）",
  exportTsv: "匯出為 .tsv",
  importing: "正在匯入 {name}...",
  exporting: "正在匯出...",
  importFailed: "無法匯入 {name}。",
  exportFailed: "無法匯出活頁簿。",
  errorUnsupportedFormat:
    "{name} 是舊版 .xls 檔案或受密碼保護的活頁簿。請將其另存為未受保護的 .xlsx 檔案後再試一次。",
  errorNotAZip: "{name} 不是 .xlsx 檔案。",
  errorNoWorkbook: "{name} 不包含活頁簿。",
};

const es: Partial<ExcelIoLocale> = {
  importTooltip: "Importar archivo",
  exportTooltip: "Exportar...",
  exportXlsx: "Exportar como .xlsx",
  exportCsv: "Exportar como .csv",
  exportCsvRaw: "Exportar como .csv (valores sin formato)",
  exportTsv: "Exportar como .tsv",
  importing: "Importando {name}...",
  exporting: "Exportando...",
  importFailed: "No se pudo importar {name}.",
  exportFailed: "No se pudo exportar el libro.",
  errorUnsupportedFormat:
    "{name} es un archivo .xls antiguo o un libro protegido con contraseña. Guárdelo como archivo .xlsx sin protección e inténtelo de nuevo.",
  errorNotAZip: "{name} no es un archivo .xlsx.",
  errorNoWorkbook: "{name} no contiene un libro.",
};

const ru: Partial<ExcelIoLocale> = {
  importTooltip: "Импорт файла",
  exportTooltip: "Экспорт...",
  exportXlsx: "Экспорт в .xlsx",
  exportCsv: "Экспорт в .csv",
  exportCsvRaw: "Экспорт в .csv (исходные значения)",
  exportTsv: "Экспорт в .tsv",
  importing: "Импорт {name}...",
  exporting: "Экспорт...",
  importFailed: "Не удалось импортировать {name}.",
  exportFailed: "Не удалось экспортировать книгу.",
  errorUnsupportedFormat:
    "{name} — файл старого формата .xls или книга, защищённая паролем. Сохраните её как незащищённый файл .xlsx и повторите попытку.",
  errorNotAZip: "{name} не является файлом .xlsx.",
  errorNoWorkbook: "{name} не содержит книгу.",
};

const hi: Partial<ExcelIoLocale> = {
  importTooltip: "फ़ाइल आयात करें",
  exportTooltip: "निर्यात करें...",
  exportXlsx: ".xlsx के रूप में निर्यात करें",
  exportCsv: ".csv के रूप में निर्यात करें",
  exportCsvRaw: ".csv के रूप में निर्यात करें (मूल मान)",
  exportTsv: ".tsv के रूप में निर्यात करें",
  importing: "{name} आयात हो रहा है...",
  exporting: "निर्यात हो रहा है...",
  importFailed: "{name} आयात नहीं किया जा सका।",
  exportFailed: "वर्कबुक निर्यात नहीं की जा सकी।",
  errorUnsupportedFormat:
    "{name} एक पुरानी .xls फ़ाइल या पासवर्ड-सुरक्षित वर्कबुक है। इसे असुरक्षित .xlsx फ़ाइल के रूप में सहेजें और फिर से प्रयास करें।",
  errorNotAZip: "{name} एक .xlsx फ़ाइल नहीं है।",
  errorNoWorkbook: "{name} में कोई वर्कबुक नहीं है।",
};

const translations: Record<string, Partial<ExcelIoLocale>> = {
  en,
  zh,
  "zh-CN": zh,
  "zh-TW": zhTW,
  zh_tw: zhTW,
  es,
  ru,
  hi,
};

const cache: Record<string, ExcelIoLocale> = {};

/**
 * The excel package's UI strings for a language ("zh-TW", "es", ...) or a
 * context with `lang`; English for unknown languages and missing keys.
 */
export function excelIoLocale(
  lang?: string | null | { lang?: string | null }
): ExcelIoLocale {
  const code =
    (typeof lang === "object" && lang != null ? lang.lang : lang) || "en";
  const key =
    [code, code.split(/[-_]/)[0]].find((l) =>
      Object.prototype.hasOwnProperty.call(translations, l)
    ) ?? "en";
  if (!cache[key]) cache[key] = { ...en, ...translations[key] };
  return cache[key];
}

export const excelIoLocales = translations;
