/*
 * Strings of page layout and printing (Page Setup, Print Preview, Page
 * Break Preview). Kept apart from the main locale files; a language without
 * a translation falls back to English key by key.
 */

const en = {
  pageLayout: "Page Layout",
  print: "Print (Ctrl+P)",
  printPreview: "Print Preview…",
  pageSetup: "Page Setup…",
  printArea: "Print Area",
  setPrintArea: "Set Print Area",
  addToPrintArea: "Add to Print Area",
  clearPrintArea: "Clear Print Area",
  breaks: "Breaks",
  insertPageBreak: "Insert Page Break",
  removePageBreak: "Remove Page Break",
  resetPageBreaks: "Reset All Page Breaks",
  pageBreakPreview: "Page Break Preview",
  normalView: "Normal View",
  showPageBreaks: "Show Page Breaks",
  printTitles: "Print Titles…",
  orientation: "Orientation",
  portrait: "Portrait",
  landscape: "Landscape",
  margins: "Margins",
  marginPresets: {
    normal: "Normal",
    wide: "Wide",
    narrow: "Narrow",
  } as Record<string, string>,
  size: "Size",
  pageWatermark: "Page {n}",

  // Page Setup dialog
  pageSetupTitle: "Page Setup",
  tabs: {
    page: "Page",
    margins: "Margins",
    headerFooter: "Header/Footer",
    sheet: "Sheet",
  } as Record<string, string>,
  scaling: "Scaling",
  adjustTo: "Adjust to:",
  normalSize: "% normal size",
  fitTo: "Fit to:",
  pagesWide: "page(s) wide by",
  tall: "tall",
  fitAuto: "(0 = automatic)",
  paperSize: "Paper size:",
  printQuality: "Print quality:",
  firstPageNumber: "First page number:",
  auto: "Auto",
  top: "Top:",
  bottom: "Bottom:",
  left: "Left:",
  right: "Right:",
  header: "Header:",
  footer: "Footer:",
  inches: "Margins are in inches.",
  centerOnPage: "Center on page",
  horizontally: "Horizontally",
  vertically: "Vertically",
  customHeader: "Custom Header",
  customFooter: "Custom Footer",
  leftSection: "Left section",
  centerSection: "Center section",
  rightSection: "Right section",
  editing: "Editing:",
  oddPages: "Header/footer",
  evenPages: "Even pages",
  firstPage: "First page",
  insertCode: "Insert:",
  codes: {
    page: "Page number",
    pages: "Number of pages",
    date: "Date",
    time: "Time",
    path: "File path",
    file: "File name",
    sheet: "Sheet name",
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
  } as Record<string, string>,
  presetNone: "(none)",
  differentOddEven: "Different odd and even pages",
  differentFirst: "Different first page",
  scaleWithDoc: "Scale with document",
  alignWithMargins: "Align with page margins",
  printAreaLabel: "Print area:",
  printTitlesLabel: "Print titles",
  rowsToRepeat: "Rows to repeat at top:",
  columnsToRepeat: "Columns to repeat at left:",
  printLabel: "Print",
  gridlines: "Gridlines",
  blackAndWhite: "Black and white",
  draftQuality: "Draft quality",
  headings: "Row and column headings",
  comments: "Comments and notes:",
  commentsOptions: {
    none: "(None)",
    atEnd: "At end of sheet",
    asDisplayed: "As displayed on sheet",
  } as Record<string, string>,
  cellErrors: "Cell errors as:",
  cellErrorsOptions: {
    displayed: "displayed",
    blank: "<blank>",
    dash: "--",
    NA: "#N/A",
  } as Record<string, string>,
  pageOrder: "Page order",
  downThenOver: "Down, then over",
  overThenDown: "Over, then down",
  invalidReference: 'The reference "{ref}" is not valid.',
  ok: "OK",
  cancel: "Cancel",

  // Print Preview
  printTitle: "Print",
  printButton: "Print",
  settings: "Settings",
  printActiveSheet: "Print Active Sheet",
  printEntireWorkbook: "Print Entire Workbook",
  printSelection: "Print Selection",
  ignorePrintArea: "Ignore print area",
  pageOf: "{page} of {pages}",
  previousPage: "Previous page",
  nextPage: "Next page",
  zoomToPage: "Zoom to page",
  noPages: "We couldn't find anything to print.",
  noScaling: "No Scaling",
  fitSheet: "Fit Sheet on One Page",
  fitColumns: "Fit All Columns on One Page",
  fitRows: "Fit All Rows on One Page",
  customScaling: "Custom Scaling",
  pdfHint: 'Choose "Save as PDF" in the print dialog to export a PDF.',
};

export type PageLayoutLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<PageLayoutLocale> = {
  pageLayout: "页面布局",
  print: "打印 (Ctrl+P)",
  printPreview: "打印预览…",
  pageSetup: "页面设置…",
  printArea: "打印区域",
  setPrintArea: "设置打印区域",
  addToPrintArea: "添加到打印区域",
  clearPrintArea: "取消打印区域",
  breaks: "分隔符",
  insertPageBreak: "插入分页符",
  removePageBreak: "删除分页符",
  resetPageBreaks: "重设所有分页符",
  pageBreakPreview: "分页预览",
  normalView: "普通视图",
  showPageBreaks: "显示分页符",
  printTitles: "打印标题…",
  orientation: "纸张方向",
  portrait: "纵向",
  landscape: "横向",
  margins: "页边距",
  marginPresets: { normal: "常规", wide: "宽", narrow: "窄" },
  size: "纸张大小",
  pageWatermark: "第 {n} 页",
  pageSetupTitle: "页面设置",
  tabs: {
    page: "页面",
    margins: "页边距",
    headerFooter: "页眉/页脚",
    sheet: "工作表",
  },
  scaling: "缩放",
  adjustTo: "缩放比例:",
  normalSize: "% 正常尺寸",
  fitTo: "调整为:",
  pagesWide: "页宽",
  tall: "页高",
  paperSize: "纸张大小:",
  printQuality: "打印质量:",
  firstPageNumber: "起始页码:",
  auto: "自动",
  top: "上:",
  bottom: "下:",
  left: "左:",
  right: "右:",
  header: "页眉:",
  footer: "页脚:",
  inches: "页边距单位为英寸。",
  centerOnPage: "居中方式",
  horizontally: "水平",
  vertically: "垂直",
  customHeader: "自定义页眉",
  customFooter: "自定义页脚",
  leftSection: "左部",
  centerSection: "中部",
  rightSection: "右部",
  gridlines: "网格线",
  blackAndWhite: "单色打印",
  draftQuality: "草稿质量",
  headings: "行和列标题",
  printTitle: "打印",
  printButton: "打印",
  ok: "确定",
  cancel: "取消",
};

const es: DeepPartial<PageLayoutLocale> = {
  pageLayout: "Disposición de página",
  print: "Imprimir (Ctrl+P)",
  printPreview: "Vista previa de impresión…",
  pageSetup: "Configurar página…",
  printArea: "Área de impresión",
  setPrintArea: "Establecer área de impresión",
  clearPrintArea: "Borrar área de impresión",
  insertPageBreak: "Insertar salto de página",
  removePageBreak: "Quitar salto de página",
  resetPageBreaks: "Restablecer todos los saltos de página",
  pageBreakPreview: "Vista previa de salto de página",
  normalView: "Vista normal",
  portrait: "Vertical",
  landscape: "Horizontal",
  pageSetupTitle: "Configurar página",
  tabs: {
    page: "Página",
    margins: "Márgenes",
    headerFooter: "Encabezado y pie de página",
    sheet: "Hoja",
  },
  printTitle: "Imprimir",
  printButton: "Imprimir",
  ok: "Aceptar",
  cancel: "Cancelar",
};

const translations: Record<string, DeepPartial<PageLayoutLocale>> = {
  en,
  zh,
  "zh-TW": zh,
  es,
};

const cache: Record<string, PageLayoutLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = {};
  Object.keys(base).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The page layout strings for a context's language (English fallback). */
export function pageLayoutLocale(ctx: {
  lang?: string | null;
}): PageLayoutLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
