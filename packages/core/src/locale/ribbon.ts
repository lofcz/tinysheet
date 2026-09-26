/*
 * Strings of the ribbon (tabs, group labels, File menu, ribbon-native
 * commands). Kept in their own file, like cellTools.ts, so features do not
 * touch the big per-language files. A language without a translation falls
 * back to English key by key.
 */

const en = {
  ribbon: "Ribbon",
  quickAccess: "Quick access",
  collapseRibbon: "Collapse the ribbon",
  collapseRibbonShortcut: "Ctrl+F1",
  expandRibbon: "Pin the ribbon",
  groupOptions: "{group}: show commands",
  tabs: {
    file: "File",
    home: "Home",
    insert: "Insert",
    pageLayout: "Page Layout",
    formulas: "Formulas",
    data: "Data",
    review: "Review",
    view: "View",
  } as Record<string, string>,
  groups: {
    clipboard: "Clipboard",
    font: "Font",
    alignment: "Alignment",
    number: "Number",
    styles: "Styles",
    cells: "Cells",
    editing: "Editing",
    tables: "Tables",
    illustrations: "Illustrations",
    charts: "Charts",
    sparklines: "Sparklines",
    filters: "Filters",
    links: "Links",
    comments: "Comments",
    notes: "Notes",
    text: "Text",
    controls: "Controls",
    pageSetup: "Page Setup",
    scaleToFit: "Scale to Fit",
    sheetOptions: "Sheet Options",
    functionLibrary: "Function Library",
    definedNames: "Defined Names",
    formulaAuditing: "Formula Auditing",
    calculation: "Calculation",
    sortFilter: "Sort & Filter",
    dataTools: "Data Tools",
    forecast: "Forecast",
    outline: "Outline",
    protect: "Protect",
    workbookViews: "Workbook Views",
    show: "Show",
    zoom: "Zoom",
    window: "Window",
    appearance: "Appearance",
    custom: "Custom",
  } as Record<string, string>,
  file: {
    menu: "File",
    new: "New",
    newShortcut: "Ctrl+N",
    open: "Open…",
    openShortcut: "Ctrl+O",
    saveAs: "Save As",
    saveAsXlsx: "Excel Workbook (.xlsx)",
    saveAsCsv: "CSV (Comma delimited) (.csv)",
    print: "Print…",
    printShortcut: "Ctrl+P",
  },
  commands: {
    paste: "Paste",
    pasteShortcut: "Ctrl+V",
    pasteSpecial: "Paste Special…",
    pasteValues: "Paste Values",
    cut: "Cut",
    cutShortcut: "Ctrl+X",
    copy: "Copy",
    copyShortcut: "Ctrl+C",
  },
  sidePane: {
    close: "Close pane",
    resize: "Resize pane",
  },
};

export type RibbonLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<RibbonLocale> = {
  ribbon: "功能区",
  quickAccess: "快速访问",
  collapseRibbon: "折叠功能区",
  expandRibbon: "固定功能区",
  tabs: {
    file: "文件",
    home: "开始",
    insert: "插入",
    pageLayout: "页面布局",
    formulas: "公式",
    data: "数据",
    review: "审阅",
    view: "视图",
  },
  groups: {
    clipboard: "剪贴板",
    font: "字体",
    alignment: "对齐方式",
    number: "数字",
    styles: "样式",
    cells: "单元格",
    editing: "编辑",
    tables: "表格",
    illustrations: "插图",
    charts: "图表",
    sparklines: "迷你图",
    filters: "筛选器",
    links: "链接",
    comments: "批注",
    notes: "注释",
    text: "文本",
    controls: "控件",
    pageSetup: "页面设置",
    scaleToFit: "调整为合适大小",
    sheetOptions: "工作表选项",
    functionLibrary: "函数库",
    definedNames: "定义的名称",
    formulaAuditing: "公式审核",
    calculation: "计算",
    sortFilter: "排序和筛选",
    dataTools: "数据工具",
    forecast: "预测",
    outline: "分级显示",
    protect: "保护",
    workbookViews: "工作簿视图",
    show: "显示",
    zoom: "缩放",
    window: "窗口",
    appearance: "外观",
    custom: "自定义",
  },
  file: {
    menu: "文件",
    new: "新建",
    open: "打开…",
    saveAs: "另存为",
    saveAsXlsx: "Excel 工作簿 (.xlsx)",
    saveAsCsv: "CSV（逗号分隔）(.csv)",
    print: "打印…",
  },
  commands: {
    paste: "粘贴",
    pasteSpecial: "选择性粘贴…",
    pasteValues: "粘贴值",
    cut: "剪切",
    copy: "复制",
  },
};

const es: DeepPartial<RibbonLocale> = {
  ribbon: "Cinta de opciones",
  tabs: {
    file: "Archivo",
    home: "Inicio",
    insert: "Insertar",
    pageLayout: "Disposición de página",
    formulas: "Fórmulas",
    data: "Datos",
    review: "Revisar",
    view: "Vista",
  },
  groups: {
    clipboard: "Portapapeles",
    font: "Fuente",
    alignment: "Alineación",
    number: "Número",
    styles: "Estilos",
    cells: "Celdas",
    editing: "Edición",
    tables: "Tablas",
    illustrations: "Ilustraciones",
    charts: "Gráficos",
    comments: "Comentarios",
    functionLibrary: "Biblioteca de funciones",
    definedNames: "Nombres definidos",
    formulaAuditing: "Auditoría de fórmulas",
    calculation: "Cálculo",
    sortFilter: "Ordenar y filtrar",
    dataTools: "Herramientas de datos",
    outline: "Esquema",
    protect: "Proteger",
    show: "Mostrar",
    window: "Ventana",
  },
  commands: {
    paste: "Pegar",
    pasteSpecial: "Pegado especial…",
    cut: "Cortar",
    copy: "Copiar",
  },
};

const translations: Record<string, DeepPartial<RibbonLocale>> = {
  zh,
  "zh-CN": zh,
  es,
};

const cache: Record<string, RibbonLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = { ...base };
  Object.keys(over).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The ribbon strings for a context's language (English fallback). */
export function ribbonLocale(ctx: { lang?: string | null }): RibbonLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
