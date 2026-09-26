/*
 * Strings of the ribbon's Formulas, Data and Review tabs and of the Insert
 * Function dialog: button labels, Excel-style screen-tip descriptions and
 * menu entries. Kept in their own file (like ribbon.ts) so the tabs evolve
 * without touching the big per-language files. A language without a
 * translation falls back to English key by key.
 */

const en = {
  formulas: {
    insertFunction: "Insert Function",
    insertFunctionShortcut: "Shift+F3",
    insertFunctionTip:
      "Work with the formula in the current cell. Pick a function and get help filling in its arguments.",
    insertFunctionMenu: "Insert Function…",
    autoSum: "AutoSum",
    autoSumShortcut: "Alt+=",
    autoSumTip:
      "Automatically add it up. Your total will appear after the selected cells.",
    sum: "Sum",
    average: "Average",
    countNumbers: "Count Numbers",
    max: "Max",
    min: "Min",
    moreFunctions: "More Functions…",
    recentlyUsed: "Recently Used",
    recentlyUsedTip:
      "Browse and select from a list of recently used functions.",
    financial: "Financial",
    financialTip: "Browse and select from a list of financial functions.",
    logical: "Logical",
    logicalTip: "Browse and select from a list of logical functions.",
    text: "Text",
    textTip: "Browse and select from a list of text functions.",
    dateTime: "Date & Time",
    dateTimeTip: "Browse and select from a list of date and time functions.",
    lookup: "Lookup & Reference",
    lookupTip:
      "Browse and select from a list of lookup and reference functions.",
    math: "Math & Trig",
    mathTip:
      "Browse and select from a list of math and trigonometry functions.",
    more: "More Functions",
    moreTip:
      "Browse and select from lists of statistical, engineering, information and more functions.",
    statistical: "Statistical",
    engineering: "Engineering",
    information: "Information",
    compatibility: "Compatibility",
    web: "Web",
    database: "Database",
    allFunctions: "All",
    functionsLabel: "{category} functions",
    functionHint: "Point to a function to see what it does.",
    nameManager: "Name Manager",
    nameManagerShortcut: "Ctrl+F3",
    nameManagerTip:
      "Create, edit, delete and find all the names used in the workbook.",
    defineName: "Define Name",
    defineNameTip:
      "Name cells so you can use that name in formulas instead of cell references.",
    useInFormula: "Use in Formula",
    useInFormulaTip:
      "Choose a name used in this workbook and insert it into the current formula.",
    noNames: "No names defined",
    createFromSelection: "Create from Selection",
    createFromSelectionShortcut: "Ctrl+Shift+F3",
    createFromSelectionTip:
      "Automatically generate names from the selected cells, using the text in the top row or the leftmost column.",
    tracePrecedentsTip:
      "Show arrows that indicate which cells affect the value of the selected cell.",
    traceDependentsTip:
      "Show arrows that indicate which cells are affected by the value of the selected cell.",
    removeArrowsTip:
      "Remove the arrows drawn by Trace Precedents or Trace Dependents.",
    showFormulasShortcut: "Ctrl+`",
    showFormulasTip:
      "Display the formula in each cell instead of the resulting value.",
    errorCheckingTip: "Check for common errors that occur in formulas.",
    errorCheckingMenu: "Error Checking…",
    noErrors: "The error check has been completed for the entire sheet.",
    circularReferences: "Circular References",
    evaluateFormulaTip:
      "Debug a complex formula, evaluating each part individually.",
    watchWindowTip:
      "Monitor the values of certain cells as changes are made to the sheet. The values show in a pane beside the grid.",
    calculationOptionsTip:
      "Choose to calculate formulas automatically or manually.",
    calculateNowShortcut: "F9",
    calculateNowTip: "Calculate the entire workbook now.",
    calculateSheetShortcut: "Shift+F9",
    calculateSheetTip: "Calculate the current sheet now.",
  },
  data: {
    sortAsc: "Sort A to Z",
    sortAscTip: "Sort lowest to highest.",
    sortDesc: "Sort Z to A",
    sortDescTip: "Sort highest to lowest.",
    sort: "Sort",
    sortTip: "Sort data by several criteria at once in the Sort dialog.",
    filter: "Filter",
    filterShortcut: "Ctrl+Shift+L",
    filterTip:
      "Turn on filtering for the selected cells. Then click the arrow in the column header to narrow down the data.",
    clear: "Clear",
    clearTip: "Clear the filter and sort state for the current range of data.",
    reapply: "Reapply",
    reapplyShortcut: "Ctrl+Alt+L",
    reapplyTip: "Reapply the filter and sort in the current range.",
    advanced: "Advanced",
    advancedTip: "Filter with complex criteria from a range of cells.",
    textToColumns: "Text to Columns",
    textToColumnsTip:
      "Split a single column of text into multiple columns, for example first and last names.",
    flashFill: "Flash Fill",
    flashFillShortcut: "Ctrl+E",
    flashFillTip:
      "Automatically fill in values. Enter a couple of examples of the output you want and keep the active cell in the column you want filled in.",
    removeDuplicates: "Remove Duplicates",
    removeDuplicatesTip: "Delete duplicate rows from a sheet.",
    dataValidation: "Data Validation",
    dataValidationTip:
      "Pick from a list of rules to limit the type of data that can be entered in a cell.",
    dataValidationMenu: "Data Validation…",
    circleInvalid: "Circle Invalid Data",
    clearCircles: "Clear Validation Circles",
    validationRules: "Validation Rules Pane",
    whatIf: "What-If Analysis",
    whatIfTip:
      "Try out various values for the formulas in the sheet: Goal Seek finds the right input for the value you want, a Data Table shows the results of several inputs at once.",
    goalSeek: "Goal Seek…",
    dataTable: "Data Table…",
    recalcDataTables: "Recalculate Data Tables",
    group: "Group",
    groupShortcut: "Shift+Alt+→",
    groupTip:
      "Tie a range of rows or columns together so they can be collapsed or expanded.",
    groupMenu: "Group…",
    autoOutline: "Auto Outline",
    ungroup: "Ungroup",
    ungroupShortcut: "Shift+Alt+←",
    ungroupTip: "Ungroup a range of rows or columns that were grouped.",
    ungroupMenu: "Ungroup…",
    clearOutline: "Clear Outline",
    subtotal: "Subtotal",
    subtotalTip:
      "Total several rows of related data together by automatically inserting subtotals and totals for the selected cells.",
    showDetail: "Show Detail",
    showDetailTip: "Expand a collapsed group of cells.",
    hideDetail: "Hide Detail",
    hideDetailTip: "Collapse a group of cells.",
    outlineSettings: "Outline Settings…",
  },
  review: {
    newComment: "New Comment",
    newCommentShortcut: "Ctrl+Shift+F2",
    newCommentTip:
      "Start a conversation about the selected cell. Replies stay in the same thread.",
    delete: "Delete",
    deleteTip: "Delete the selected comment.",
    previous: "Previous",
    previousTip: "Go to the previous comment in the workbook.",
    next: "Next",
    nextTip: "Go to the next comment in the workbook.",
    showComments: "Show Comments",
    showCommentsTip:
      "See all the comments of the workbook in a pane beside the grid.",
    notes: "Notes",
    notesTip: "Add a quick note to the selected cell, or show and hide notes.",
    newNote: "New Note",
    newNoteShortcut: "Shift+F2",
    editNote: "Edit Note",
    deleteNote: "Delete Note",
    previousNote: "Previous Note",
    nextNote: "Next Note",
    showHideNote: "Show/Hide Note",
    showAllNotes: "Show All Notes",
    convertToComments: "Convert to Comments",
    convertConfirm:
      "Convert all notes of this sheet to threaded comments? Converted notes are removed.",
    protectSheet: "Protect Sheet",
    unprotectSheet: "Unprotect Sheet",
    protectSheetTip:
      "Prevent unwanted changes by limiting what others can edit. For example, you can keep cells from being edited or formatted.",
    unprotectSheetTip: "Allow changes to the protected sheet again.",
    protectWorkbook: "Protect Workbook",
    unprotectWorkbook: "Unprotect Workbook",
    protectWorkbookTip:
      "Prevent others from making changes to the structure of the workbook, such as adding, deleting or hiding sheets.",
    allowEditRanges: "Allow Edit Ranges",
    allowEditRangesTip:
      "Choose ranges that people can edit when the sheet is protected, optionally with a password.",
  },
  insertFunction: {
    title: "Insert Function",
    search: "Search for a function",
    searchPlaceholder: "Type a name or what you want to do",
    category: "Category",
    functions: "Select a function",
    noMatch: "No function matches your search.",
    ok: "Insert",
    cancel: "Cancel",
    mostRecentlyUsed: "Most Recently Used",
  },
  file: {
    newDescription: "Start a blank workbook",
    openDescription: "Open an .xlsx or .csv file from this device",
    saveAsDescription: "Download a copy of this workbook",
    saveAsXlsxDescription: "Workbook with formulas, formatting and sheets",
    saveAsCsvDescription: "Values of the current sheet only",
    printDescription: "Preview and print the workbook",
  },
};

export type RibbonFormulasDataReviewLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<RibbonFormulasDataReviewLocale> = {
  formulas: {
    insertFunction: "插入函数",
    insertFunctionMenu: "插入函数…",
    autoSum: "自动求和",
    sum: "求和",
    average: "平均值",
    countNumbers: "计数",
    max: "最大值",
    min: "最小值",
    moreFunctions: "其他函数…",
    recentlyUsed: "最近使用的函数",
    financial: "财务",
    logical: "逻辑",
    text: "文本",
    dateTime: "日期和时间",
    lookup: "查找与引用",
    math: "数学和三角函数",
    more: "其他函数",
    statistical: "统计",
    engineering: "工程",
    information: "信息",
    compatibility: "兼容性",
    web: "Web",
    database: "数据库",
    allFunctions: "全部",
    nameManager: "名称管理器",
    defineName: "定义名称",
    useInFormula: "用于公式",
    noNames: "未定义名称",
    createFromSelection: "根据所选内容创建",
  },
  data: {
    sortAsc: "升序",
    sortDesc: "降序",
    sort: "排序",
    filter: "筛选",
    clear: "清除",
    reapply: "重新应用",
    advanced: "高级",
    textToColumns: "分列",
    flashFill: "快速填充",
    removeDuplicates: "删除重复值",
    dataValidation: "数据验证",
    dataValidationMenu: "数据验证…",
    circleInvalid: "圈释无效数据",
    clearCircles: "清除验证标识圈",
    whatIf: "模拟分析",
    goalSeek: "单变量求解…",
    dataTable: "模拟运算表…",
    group: "组合",
    ungroup: "取消组合",
    autoOutline: "自动建立分级显示",
    clearOutline: "清除分级显示",
    subtotal: "分类汇总",
    showDetail: "显示明细数据",
    hideDetail: "隐藏明细数据",
  },
  review: {
    newComment: "新建批注",
    delete: "删除",
    previous: "上一条",
    next: "下一条",
    showComments: "显示批注",
    notes: "注释",
    newNote: "新建注释",
    editNote: "编辑注释",
    deleteNote: "删除注释",
    previousNote: "上一条注释",
    nextNote: "下一条注释",
    showHideNote: "显示/隐藏注释",
    showAllNotes: "显示所有注释",
    convertToComments: "转换为批注",
    protectSheet: "保护工作表",
    unprotectSheet: "撤消工作表保护",
    protectWorkbook: "保护工作簿",
    unprotectWorkbook: "撤消工作簿保护",
    allowEditRanges: "允许编辑区域",
  },
  insertFunction: {
    title: "插入函数",
    search: "搜索函数",
    category: "类别",
    functions: "选择函数",
    ok: "插入",
    cancel: "取消",
    mostRecentlyUsed: "常用函数",
  },
};

const es: DeepPartial<RibbonFormulasDataReviewLocale> = {
  formulas: {
    insertFunction: "Insertar función",
    insertFunctionMenu: "Insertar función…",
    autoSum: "Autosuma",
    sum: "Suma",
    average: "Promedio",
    countNumbers: "Contar números",
    max: "Máx",
    min: "Mín",
    moreFunctions: "Más funciones…",
    recentlyUsed: "Usadas recientemente",
    financial: "Financieras",
    logical: "Lógicas",
    text: "Texto",
    dateTime: "Fecha y hora",
    lookup: "Búsqueda y referencia",
    math: "Matemáticas y trigonométricas",
    more: "Más funciones",
    statistical: "Estadísticas",
    engineering: "Ingeniería",
    information: "Información",
    compatibility: "Compatibilidad",
    database: "Base de datos",
    allFunctions: "Todas",
    nameManager: "Administrador de nombres",
    defineName: "Asignar nombre",
    useInFormula: "Utilizar en la fórmula",
    createFromSelection: "Crear desde la selección",
  },
  data: {
    sortAsc: "Ordenar de A a Z",
    sortDesc: "Ordenar de Z a A",
    sort: "Ordenar",
    filter: "Filtro",
    clear: "Borrar",
    reapply: "Volver a aplicar",
    advanced: "Avanzadas",
    textToColumns: "Texto en columnas",
    flashFill: "Relleno rápido",
    removeDuplicates: "Quitar duplicados",
    dataValidation: "Validación de datos",
    whatIf: "Análisis de hipótesis",
    group: "Agrupar",
    ungroup: "Desagrupar",
    subtotal: "Subtotal",
    showDetail: "Mostrar detalle",
    hideDetail: "Ocultar detalle",
  },
  review: {
    newComment: "Nuevo comentario",
    delete: "Eliminar",
    previous: "Anterior",
    next: "Siguiente",
    showComments: "Mostrar comentarios",
    notes: "Notas",
    protectSheet: "Proteger hoja",
    unprotectSheet: "Desproteger hoja",
    protectWorkbook: "Proteger libro",
    unprotectWorkbook: "Desproteger libro",
    allowEditRanges: "Permitir editar rangos",
  },
  insertFunction: {
    title: "Insertar función",
    search: "Buscar una función",
    category: "Categoría",
    functions: "Seleccionar una función",
    ok: "Insertar",
    cancel: "Cancelar",
  },
};

const translations: Record<
  string,
  DeepPartial<RibbonFormulasDataReviewLocale>
> = { zh, "zh-CN": zh, es };

const cache: Record<string, RibbonFormulasDataReviewLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = { ...base };
  Object.keys(over).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/**
 * The strings of the Formulas, Data and Review tabs for a context's
 * language (English fallback).
 */
export function ribbonFormulasDataReviewLocale(ctx: {
  lang?: string | null;
}): RibbonFormulasDataReviewLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
