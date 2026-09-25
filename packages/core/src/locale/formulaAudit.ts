/*
 * Strings of formula auditing, error checking and the calculation options
 * (Formulas tab). Kept apart from the main locale files; a language without
 * a translation falls back to English key by key.
 */

const en = {
  auditing: {
    menu: "Formula Auditing",
    tracePrecedents: "Trace Precedents",
    traceDependents: "Trace Dependents",
    removeArrows: "Remove Arrows",
    removePrecedentArrows: "Remove Precedent Arrows",
    removeDependentArrows: "Remove Dependent Arrows",
    showFormulas: "Show Formulas",
    evaluateFormula: "Evaluate Formula",
    watchWindow: "Watch Window",
    addWatch: "Add Watch",
    noFormula:
      "The active cell does not contain a formula that refers to a valid reference.",
    noDependents: "No formula refers to the active cell.",
    otherSheet: "Reference to another worksheet",
  },
  calc: {
    options: "Calculation Options",
    automatic: "Automatic",
    automaticExceptTables: "Automatic Except for Data Tables",
    manual: "Manual",
    calculateNow: "Calculate Now",
    calculateSheet: "Calculate Sheet",
    calculateFull: "Recalculate Everything",
    iterativeSettings: "Iterative Calculation…",
    workbookCalculation: "Workbook Calculation",
    enableIterative: "Enable iterative calculation",
    maxIterations: "Maximum Iterations:",
    maxChange: "Maximum Change:",
    calculate: "Calculate",
    calculateHint: "Formulas are waiting to be calculated. Click or press F9.",
    circularReferences: "Circular References",
    circularWarning:
      "There are one or more circular references where a formula refers to its own cell either directly or indirectly. This might cause them to calculate incorrectly. Try removing or changing these references, or moving the formulas to different cells.",
    ok: "OK",
    cancel: "Cancel",
  },
  evaluate: {
    title: "Evaluate Formula",
    reference: "Reference:",
    evaluation: "Evaluation:",
    evaluate: "Evaluate",
    restart: "Restart",
    stepIn: "Step In",
    stepOut: "Step Out",
    close: "Close",
    hint: "To show the result of the underlined expression, click Evaluate. The most recent result appears italicized.",
    noFormula: "The active cell does not contain a formula.",
  },
  watch: {
    title: "Watch Window",
    addWatch: "Add Watch…",
    deleteWatch: "Delete Watch",
    book: "Book",
    sheet: "Sheet",
    name: "Name",
    cell: "Cell",
    value: "Value",
    formula: "Formula",
    bookName: "Book1",
    empty: "Select cells and click Add Watch to keep an eye on their values.",
    close: "Close",
  },
  errors: {
    checking: "Error Checking",
    options: "Error Checking Options…",
    tagLabel: "Error checking options",
    enable: "Enable background error checking",
    rulesTitle: "Error checking rules",
    resetIgnored: "Reset Ignored Errors",
    rules: {
      evaluationError: "Cells containing formulas that result in an error",
      inconsistentFormula:
        "Formulas inconsistent with other formulas in the region",
      omitsCells: "Formulas which omit cells in a region",
      unlockedFormula: "Unlocked cells containing formulas",
      emptyCellRef: "Formulas referring to empty cells",
      numberAsText: "Numbers formatted as text or preceded by an apostrophe",
    } as Record<string, string>,
    titles: {
      evaluationError: "Error in Value",
      inconsistentFormula: "Inconsistent Formula",
      omitsCells: "Formula Omits Adjacent Cells",
      unlockedFormula: "Unprotected Formula",
      emptyCellRef: "Formula Refers to Empty Cells",
      numberAsText: "Number Stored as Text",
    } as Record<string, string>,
    details: {
      evaluationError: "A value used in the formula is of the wrong type.",
      inconsistentFormula:
        "The formula in this cell differs from the formulas in this area of the spreadsheet.",
      omitsCells:
        "The formula in this cell refers to a range that has additional numbers adjacent to it.",
      unlockedFormula:
        "The formula in this cell is not locked to protect it from being changed inadvertently.",
      emptyCellRef: "The formula in this cell refers to empty cells.",
      numberAsText:
        "The number in this cell is formatted as text or preceded by an apostrophe.",
    } as Record<string, string>,
    convertToNumber: "Convert to Number",
    copyFromAbove: "Copy Formula from Above",
    copyFromLeft: "Copy Formula from Left",
    includeCells: "Update Formula to Include Cells",
    lockCell: "Lock Cell",
    traceError: "Trace Error",
    ignore: "Ignore Error",
  },
};

export type FormulaAuditLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<FormulaAuditLocale> = {
  auditing: {
    menu: "公式审核",
    tracePrecedents: "追踪引用单元格",
    traceDependents: "追踪从属单元格",
    removeArrows: "删除箭头",
    removePrecedentArrows: "删除引用单元格追踪箭头",
    removeDependentArrows: "删除从属单元格追踪箭头",
    showFormulas: "显示公式",
    evaluateFormula: "公式求值",
    watchWindow: "监视窗口",
    addWatch: "添加监视",
    noFormula: "活动单元格不包含引用有效引用的公式。",
    noDependents: "没有公式引用活动单元格。",
    otherSheet: "引用了其他工作表",
  },
  calc: {
    options: "计算选项",
    automatic: "自动",
    automaticExceptTables: "除模拟运算表外，自动重算",
    manual: "手动",
    calculateNow: "开始计算",
    calculateSheet: "计算工作表",
    calculateFull: "全部重新计算",
    iterativeSettings: "迭代计算…",
    workbookCalculation: "工作簿计算",
    enableIterative: "启用迭代计算",
    maxIterations: "最多迭代次数：",
    maxChange: "最大误差：",
    calculate: "计算",
    calculateHint: "有公式等待计算。单击或按 F9。",
    circularReferences: "循环引用",
    circularWarning:
      "存在一个或多个循环引用，其中公式直接或间接引用其自身所在的单元格。这可能导致计算不正确。请尝试删除或更改这些引用，或将公式移到其他单元格中。",
    ok: "确定",
    cancel: "取消",
  },
  evaluate: {
    title: "公式求值",
    reference: "引用：",
    evaluation: "求值：",
    evaluate: "求值",
    restart: "重新启动",
    stepIn: "步入",
    stepOut: "步出",
    close: "关闭",
    hint: "若要显示带下划线的表达式的结果，请单击“求值”。最新结果以斜体显示。",
    noFormula: "活动单元格不包含公式。",
  },
  watch: {
    title: "监视窗口",
    addWatch: "添加监视…",
    deleteWatch: "删除监视",
    book: "工作簿",
    sheet: "工作表",
    name: "名称",
    cell: "单元格",
    value: "值",
    formula: "公式",
    bookName: "工作簿1",
    empty: "选择单元格并单击“添加监视”以跟踪其值。",
    close: "关闭",
  },
  errors: {
    checking: "错误检查",
    options: "错误检查选项…",
    tagLabel: "错误检查选项",
    enable: "允许后台错误检查",
    rulesTitle: "错误检查规则",
    resetIgnored: "重置忽略的错误",
    rules: {
      evaluationError: "所含公式导致错误的单元格",
      inconsistentFormula: "与区域中其他公式不一致的公式",
      omitsCells: "遗漏了区域中的单元格的公式",
      unlockedFormula: "包含公式的未锁定单元格",
      emptyCellRef: "引用空单元格的公式",
      numberAsText: "文本格式的数字或者前面有撇号的数字",
    },
    titles: {
      evaluationError: "值错误",
      inconsistentFormula: "公式不一致",
      omitsCells: "公式遗漏相邻单元格",
      unlockedFormula: "公式未受保护",
      emptyCellRef: "公式引用空单元格",
      numberAsText: "以文本形式存储的数字",
    },
    convertToNumber: "转换为数字",
    copyFromAbove: "从上部复制公式",
    copyFromLeft: "从左侧复制公式",
    includeCells: "更新公式以包括单元格",
    lockCell: "锁定单元格",
    traceError: "追踪错误",
    ignore: "忽略错误",
  },
};

const zhTW: DeepPartial<FormulaAuditLocale> = {
  auditing: {
    menu: "公式稽核",
    tracePrecedents: "追蹤前導參照",
    traceDependents: "追蹤從屬參照",
    removeArrows: "移除箭號",
    removePrecedentArrows: "移除前導參照箭號",
    removeDependentArrows: "移除從屬參照箭號",
    showFormulas: "顯示公式",
    evaluateFormula: "評估值公式",
    watchWindow: "監看視窗",
    addWatch: "新增監看式",
  },
  calc: {
    options: "計算選項",
    automatic: "自動",
    automaticExceptTables: "除了運算列表以外，自動重算",
    manual: "手動",
    calculateNow: "立即重算",
    calculateSheet: "計算工作表",
    enableIterative: "啟用反覆運算",
    maxIterations: "最高次數：",
    maxChange: "最大誤差：",
    calculate: "計算",
    circularReferences: "循環參照",
    ok: "確定",
    cancel: "取消",
  },
  evaluate: {
    title: "評估值公式",
    evaluate: "評估值",
    restart: "重新啟動",
    stepIn: "逐步執行",
    stepOut: "跳出",
    close: "關閉",
  },
  watch: {
    title: "監看視窗",
    addWatch: "新增監看式…",
    deleteWatch: "刪除監看式",
    book: "活頁簿",
    sheet: "工作表",
    name: "名稱",
    cell: "儲存格",
    value: "值",
    formula: "公式",
  },
  errors: {
    checking: "錯誤檢查",
    options: "錯誤檢查選項…",
    ignore: "忽略錯誤",
    convertToNumber: "轉換成數字",
  },
};

const es: DeepPartial<FormulaAuditLocale> = {
  auditing: {
    menu: "Auditoría de fórmulas",
    tracePrecedents: "Rastrear precedentes",
    traceDependents: "Rastrear dependientes",
    removeArrows: "Quitar flechas",
    removePrecedentArrows: "Quitar flechas de precedentes",
    removeDependentArrows: "Quitar flechas de dependientes",
    showFormulas: "Mostrar fórmulas",
    evaluateFormula: "Evaluar fórmula",
    watchWindow: "Ventana Inspección",
    addWatch: "Agregar inspección",
    noFormula:
      "La celda activa no contiene una fórmula que haga referencia a una referencia válida.",
    noDependents: "Ninguna fórmula hace referencia a la celda activa.",
    otherSheet: "Referencia a otra hoja de cálculo",
  },
  calc: {
    options: "Opciones para el cálculo",
    automatic: "Automático",
    automaticExceptTables: "Automático excepto en las tablas de datos",
    manual: "Manual",
    calculateNow: "Calcular ahora",
    calculateSheet: "Calcular hoja",
    calculateFull: "Recalcular todo",
    iterativeSettings: "Cálculo iterativo…",
    workbookCalculation: "Cálculo del libro",
    enableIterative: "Habilitar cálculo iterativo",
    maxIterations: "Número máximo de iteraciones:",
    maxChange: "Cambio máximo:",
    calculate: "Calcular",
    calculateHint: "Hay fórmulas pendientes de calcular. Haga clic o pulse F9.",
    circularReferences: "Referencias circulares",
    circularWarning:
      "Hay una o más referencias circulares en las que una fórmula hace referencia a su propia celda de forma directa o indirecta. Esto podría hacer que se calculen incorrectamente. Pruebe a quitar o cambiar estas referencias, o a mover las fórmulas a otras celdas.",
    ok: "Aceptar",
    cancel: "Cancelar",
  },
  evaluate: {
    title: "Evaluar fórmula",
    reference: "Referencia:",
    evaluation: "Evaluación:",
    evaluate: "Evaluar",
    restart: "Reiniciar",
    stepIn: "Paso a paso para entrar",
    stepOut: "Paso a paso para salir",
    close: "Cerrar",
    hint: "Para mostrar el resultado de la expresión subrayada, haga clic en Evaluar. El resultado más reciente aparece en cursiva.",
    noFormula: "La celda activa no contiene ninguna fórmula.",
  },
  watch: {
    title: "Ventana Inspección",
    addWatch: "Agregar inspección…",
    deleteWatch: "Eliminar inspección",
    book: "Libro",
    sheet: "Hoja",
    name: "Nombre",
    cell: "Celda",
    value: "Valor",
    formula: "Fórmula",
    bookName: "Libro1",
    empty:
      "Seleccione celdas y haga clic en Agregar inspección para seguir sus valores.",
    close: "Cerrar",
  },
  errors: {
    checking: "Comprobación de errores",
    options: "Opciones de comprobación de errores…",
    tagLabel: "Opciones de comprobación de errores",
    enable: "Habilitar comprobación de errores en segundo plano",
    rulesTitle: "Reglas de comprobación de errores",
    resetIgnored: "Restablecer errores omitidos",
    rules: {
      evaluationError: "Celdas cuyas fórmulas generan errores",
      inconsistentFormula:
        "Fórmulas incoherentes con otras fórmulas de la región",
      omitsCells: "Fórmulas que omiten celdas en una región",
      unlockedFormula: "Celdas desbloqueadas que contienen fórmulas",
      emptyCellRef: "Fórmulas que se refieren a celdas vacías",
      numberAsText:
        "Números con formato de texto o precedidos por un apóstrofo",
    },
    titles: {
      evaluationError: "Error en el valor",
      inconsistentFormula: "Fórmula incoherente",
      omitsCells: "La fórmula omite celdas adyacentes",
      unlockedFormula: "Fórmula desprotegida",
      emptyCellRef: "La fórmula hace referencia a celdas vacías",
      numberAsText: "Número almacenado como texto",
    },
    convertToNumber: "Convertir en número",
    copyFromAbove: "Copiar fórmula de arriba",
    copyFromLeft: "Copiar fórmula de la izquierda",
    includeCells: "Actualizar fórmula para incluir celdas",
    lockCell: "Bloquear celda",
    traceError: "Rastrear error",
    ignore: "Omitir error",
  },
};

const ru: DeepPartial<FormulaAuditLocale> = {
  auditing: {
    menu: "Зависимости формул",
    tracePrecedents: "Влияющие ячейки",
    traceDependents: "Зависимые ячейки",
    removeArrows: "Убрать стрелки",
    removePrecedentArrows: "Убрать стрелки влияющих ячеек",
    removeDependentArrows: "Убрать стрелки зависимых ячеек",
    showFormulas: "Показать формулы",
    evaluateFormula: "Вычислить формулу",
    watchWindow: "Окно контрольного значения",
    addWatch: "Добавить контрольное значение",
    noFormula:
      "Активная ячейка не содержит формулы, ссылающейся на допустимую ссылку.",
    noDependents: "Ни одна формула не ссылается на активную ячейку.",
    otherSheet: "Ссылка на другой лист",
  },
  calc: {
    options: "Параметры вычислений",
    automatic: "Автоматически",
    automaticExceptTables: "Автоматически, кроме таблиц данных",
    manual: "Вручную",
    calculateNow: "Пересчет",
    calculateSheet: "Произвести вычисления на листе",
    calculateFull: "Пересчитать всё",
    iterativeSettings: "Итеративные вычисления…",
    workbookCalculation: "Вычисления в книге",
    enableIterative: "Включить итеративные вычисления",
    maxIterations: "Предельное число итераций:",
    maxChange: "Относительная погрешность:",
    calculate: "Вычислить",
    calculateHint: "Есть невычисленные формулы. Щелкните или нажмите F9.",
    circularReferences: "Циклические ссылки",
    circularWarning:
      "Обнаружены циклические ссылки, в которых формула прямо или косвенно ссылается на собственную ячейку. Из-за этого расчет может быть неверным. Попробуйте удалить или изменить эти ссылки либо переместить формулы в другие ячейки.",
    ok: "ОК",
    cancel: "Отмена",
  },
  evaluate: {
    title: "Вычисление формулы",
    reference: "Ссылка:",
    evaluation: "Вычисление:",
    evaluate: "Вычислить",
    restart: "Начать сначала",
    stepIn: "Шаг с заходом",
    stepOut: "Шаг с выходом",
    close: "Закрыть",
    hint: "Чтобы показать результат подчеркнутого выражения, нажмите «Вычислить». Последний результат выделен курсивом.",
    noFormula: "Активная ячейка не содержит формулы.",
  },
  watch: {
    title: "Окно контрольного значения",
    addWatch: "Добавить контрольное значение…",
    deleteWatch: "Удалить контрольное значение",
    book: "Книга",
    sheet: "Лист",
    name: "Имя",
    cell: "Ячейка",
    value: "Значение",
    formula: "Формула",
    bookName: "Книга1",
    empty:
      "Выделите ячейки и нажмите «Добавить контрольное значение», чтобы следить за их значениями.",
    close: "Закрыть",
  },
  errors: {
    checking: "Проверка ошибок",
    options: "Параметры проверки ошибок…",
    tagLabel: "Параметры проверки ошибок",
    enable: "Включить фоновый поиск ошибок",
    rulesTitle: "Правила поиска ошибок",
    resetIgnored: "Сброс пропущенных ошибок",
    rules: {
      evaluationError: "Ячейки, которые содержат формулы, приводящие к ошибкам",
      inconsistentFormula:
        "Формулы, несогласованные с другими формулами области",
      omitsCells: "Формулы, не охватывающие смежные ячейки",
      unlockedFormula: "Незаблокированные ячейки, содержащие формулы",
      emptyCellRef: "Формулы, которые ссылаются на пустые ячейки",
      numberAsText:
        "Числа, отформатированные как текст или с предшествующим апострофом",
    },
    titles: {
      evaluationError: "Ошибка в значении",
      inconsistentFormula: "Несогласованная формула",
      omitsCells: "Формула не охватывает смежные ячейки",
      unlockedFormula: "Незащищенная формула",
      emptyCellRef: "Формула ссылается на пустые ячейки",
      numberAsText: "Число сохранено как текст",
    },
    convertToNumber: "Преобразовать в число",
    copyFromAbove: "Копировать формулу сверху",
    copyFromLeft: "Копировать формулу слева",
    includeCells: "Обновить формулу для включения ячеек",
    lockCell: "Заблокировать ячейку",
    traceError: "Источник ошибки",
    ignore: "Пропустить ошибку",
  },
};

const hi: DeepPartial<FormulaAuditLocale> = {
  auditing: {
    menu: "सूत्र ऑडिटिंग",
    tracePrecedents: "पूर्ववर्ती ट्रेस करें",
    traceDependents: "आश्रित ट्रेस करें",
    removeArrows: "तीर हटाएँ",
    showFormulas: "सूत्र दिखाएँ",
    evaluateFormula: "सूत्र का मूल्यांकन करें",
    watchWindow: "वॉच विंडो",
    addWatch: "वॉच जोड़ें",
  },
  calc: {
    options: "गणना विकल्प",
    automatic: "स्वचालित",
    manual: "मैन्युअल",
    calculateNow: "अभी गणना करें",
    calculate: "गणना करें",
    circularReferences: "वृत्ताकार संदर्भ",
    ok: "ठीक",
    cancel: "रद्द करें",
  },
  evaluate: {
    title: "सूत्र का मूल्यांकन करें",
    evaluate: "मूल्यांकन करें",
    close: "बंद करें",
  },
  watch: { title: "वॉच विंडो", value: "मान", formula: "सूत्र" },
  errors: { checking: "त्रुटि जाँच", ignore: "त्रुटि अनदेखा करें" },
};

const translations: Record<string, DeepPartial<FormulaAuditLocale>> = {
  en,
  zh,
  "zh-CN": zh,
  "zh-TW": zhTW,
  es,
  ru,
  hi,
};

const cache: Record<string, FormulaAuditLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = {};
  Object.keys(base).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The formula auditing strings for a context's language (English fallback). */
export function formulaAuditLocale(ctx: {
  lang?: string | null;
}): FormulaAuditLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
