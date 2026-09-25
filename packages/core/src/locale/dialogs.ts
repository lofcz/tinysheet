/*
 * Strings of the dialog frames and side panes (titles, section headings
 * and buttons that the dialogs did not have before they were drawn as
 * DialogShells). Kept in their own file, like ribbon.ts; a language without
 * a translation falls back to English key by key.
 */

const en = {
  /** Title of message boxes (Excel: "Microsoft Excel"). */
  appName: "TinySheet",
  close: "Close",
  ok: "OK",
  cancel: "Cancel",
  apply: "Apply",
  panes: {
    comments: "Comments",
    formatShape: "Format Shape",
    pivotFields: "PivotTable Fields",
    watchWindow: "Watch Window",
    dataValidation: "Data Validation",
  },
  zoom: {
    magnification: "Magnification",
    fitSelection: "Fit selection",
    custom: "Custom",
  },
  wizard: {
    step: "Step {n} of {total}",
    back: "Back",
    next: "Next",
  },
  shapePane: {
    shapeOptions: "Shape Options",
    textOptions: "Text Options",
    fillLine: "Fill & Line",
    sizeProperties: "Size & Properties",
    textBox: "Text Box",
    textFill: "Text Fill",
    font: "Font",
    moreColors: "More colors…",
  },
  sections: {
    options: "Options",
    preview: "Preview",
    sample: "Sample",
    settings: "Settings",
    range: "Range",
    columns: "Columns",
    sortBy: "Sort by",
    order: "Order",
    fill: "Fill",
    line: "Line",
    size: "Size",
    text: "Text",
    filter: "Filter",
  },
  titles: {
    removeDuplicates: "Remove Duplicates",
    sort: "Sort",
    textToColumns: "Convert Text to Columns Wizard",
    nameManager: "Name Manager",
    newName: "New Name",
    editName: "Edit Name",
    findReplace: "Find and Replace",
    goTo: "Go To",
    goToSpecial: "Go To Special",
    insertFunction: "Insert Function",
    functionArguments: "Function Arguments",
    hyperlink: "Insert Hyperlink",
    editHyperlink: "Edit Hyperlink",
    dataValidation: "Data Validation",
    conditionalFormatting: "Conditional Formatting",
    rulesManager: "Conditional Formatting Rules Manager",
    newRule: "New Formatting Rule",
    editRule: "Edit Formatting Rule",
    moveCopy: "Move or Copy",
    unhide: "Unhide",
    insertCells: "Insert",
    deleteCells: "Delete",
    zoom: "Zoom",
    formatSearch: "Format",
    customNumberFormat: "Number Format",
    changeColor: "Color",
    selectRange: "Select Range",
    customColor: "Custom Color",
  },
};

export type DialogsLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<DialogsLocale> = {
  close: "关闭",
  ok: "确定",
  cancel: "取消",
  apply: "应用",
  panes: {
    comments: "批注",
    formatShape: "设置形状格式",
    pivotFields: "数据透视表字段",
    watchWindow: "监视窗口",
    dataValidation: "数据验证",
  },
  titles: {
    removeDuplicates: "删除重复值",
    sort: "排序",
    textToColumns: "文本分列向导",
    nameManager: "名称管理器",
    newName: "新建名称",
    editName: "编辑名称",
    findReplace: "查找和替换",
    goTo: "定位",
    goToSpecial: "定位条件",
    insertFunction: "插入函数",
    hyperlink: "插入超链接",
    editHyperlink: "编辑超链接",
    dataValidation: "数据验证",
    conditionalFormatting: "条件格式",
    rulesManager: "条件格式规则管理器",
    newRule: "新建格式规则",
    editRule: "编辑格式规则",
    moveCopy: "移动或复制",
    unhide: "取消隐藏",
    insertCells: "插入",
    deleteCells: "删除",
    zoom: "缩放",
  },
};

const es: DeepPartial<DialogsLocale> = {
  close: "Cerrar",
  ok: "Aceptar",
  cancel: "Cancelar",
  apply: "Aplicar",
  panes: {
    comments: "Comentarios",
    formatShape: "Formato de forma",
    pivotFields: "Campos de tabla dinámica",
    watchWindow: "Ventana Inspección",
    dataValidation: "Validación de datos",
  },
  titles: {
    removeDuplicates: "Quitar duplicados",
    sort: "Ordenar",
    textToColumns: "Asistente para convertir texto en columnas",
    nameManager: "Administrador de nombres",
    findReplace: "Buscar y reemplazar",
    goTo: "Ir a",
    hyperlink: "Insertar hipervínculo",
    dataValidation: "Validación de datos",
    rulesManager: "Administrador de reglas de formato condicionales",
    newRule: "Nueva regla de formato",
    moveCopy: "Mover o copiar",
    unhide: "Mostrar",
    zoom: "Zoom",
  },
};

const translations: Record<string, DeepPartial<DialogsLocale>> = {
  zh,
  "zh-CN": zh,
  es,
};

const cache: Record<string, DialogsLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = { ...base };
  Object.keys(over).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The dialog / pane strings for a context's language (English fallback). */
export function dialogsLocale(ctx: { lang?: string | null }): DialogsLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
