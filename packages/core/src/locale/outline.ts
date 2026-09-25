/*
 * Strings of the outline tools (Data › Group / Ungroup, Subtotal, Auto
 * Outline, outline settings and the outline gutter). Kept apart from the
 * main locale files; a language without a translation falls back to
 * English key by key.
 */

const en = {
  toolbar: {
    outline: "Group & Outline",
  },
  menu: {
    group: "Group",
    ungroup: "Ungroup",
    showDetail: "Show Detail",
    hideDetail: "Hide Detail",
    autoOutline: "Auto Outline",
    clearOutline: "Clear Outline",
    subtotal: "Subtotal…",
    settings: "Outline Settings…",
  },
  groupDialog: {
    group: "Group",
    ungroup: "Ungroup",
    rows: "Rows",
    columns: "Columns",
  },
  errors: {
    maxLevel: "Cannot group: an outline has at most 8 levels.",
    notGrouped: "Cannot ungroup: the selection is not grouped.",
    noAutoOutline:
      "Cannot create an outline: no summary formulas (such as SUM or SUBTOTAL) refer to adjacent rows or columns.",
    noDetail: "The selection is not in a group.",
  },
  subtotal: {
    title: "Subtotal",
    atEachChange: "At each change in:",
    useFunction: "Use function:",
    addTo: "Add subtotal to:",
    replace: "Replace current subtotals",
    pageBreaks: "Page break between groups",
    summaryBelow: "Summary below data",
    removeAll: "Remove All",
    ok: "OK",
    cancel: "Cancel",
    column: "Column {name}",
    noData:
      "Select a list with a header row and at least one data row, then try again.",
    noColumns: "Choose at least one column to add a subtotal to.",
    tooManyLevels: "Cannot add subtotals: an outline has at most 8 levels.",
    tooManyRows: "Cannot add subtotals: the sheet would have too many rows.",
    functions: {
      sum: "Sum",
      count: "Count",
      average: "Average",
      max: "Max",
      min: "Min",
      product: "Product",
      countNums: "Count Numbers",
      stdDev: "StdDev",
      stdDevp: "StdDevp",
      var: "Var",
      varp: "Varp",
    },
    /** Word written after each group's key ("East Total"). */
    labels: {
      sum: "Total",
      count: "Count",
      average: "Average",
      max: "Max",
      min: "Min",
      product: "Product",
      countNums: "Count",
      stdDev: "StdDev",
      stdDevp: "StdDevp",
      var: "Var",
      varp: "Varp",
    },
    groupLabel: "{value} {label}",
    grandLabel: "Grand {label}",
  },
  settings: {
    title: "Outline Settings",
    direction: "Direction",
    summaryBelow: "Summary rows below detail",
    summaryRight: "Summary columns to right of detail",
    ok: "OK",
    cancel: "Cancel",
  },
  gutter: {
    level: "Show outline level {level}",
    expand: "Expand group (rows {from}–{to})",
    collapse: "Collapse group (rows {from}–{to})",
    expandColumns: "Expand group (columns {from}–{to})",
    collapseColumns: "Collapse group (columns {from}–{to})",
  },
};

export type OutlineLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<OutlineLocale> = {
  toolbar: { outline: "分级显示" },
  menu: {
    group: "组合",
    ungroup: "取消组合",
    showDetail: "显示明细数据",
    hideDetail: "隐藏明细数据",
    autoOutline: "自动建立分级显示",
    clearOutline: "清除分级显示",
    subtotal: "分类汇总…",
    settings: "分级显示设置…",
  },
  groupDialog: {
    group: "组合",
    ungroup: "取消组合",
    rows: "行",
    columns: "列",
  },
  errors: {
    maxLevel: "无法组合：分级显示最多 8 级。",
    notGrouped: "无法取消组合：所选内容未组合。",
    noAutoOutline:
      "无法创建分级显示：没有引用相邻行或列的汇总公式（例如 SUM 或 SUBTOTAL）。",
    noDetail: "所选内容不在组中。",
  },
  subtotal: {
    title: "分类汇总",
    atEachChange: "分类字段：",
    useFunction: "汇总方式：",
    addTo: "选定汇总项：",
    replace: "替换当前分类汇总",
    pageBreaks: "每组数据分页",
    summaryBelow: "汇总结果显示在数据下方",
    removeAll: "全部删除",
    ok: "确定",
    cancel: "取消",
    column: "列 {name}",
    noData: "请选择包含标题行和至少一行数据的列表。",
    noColumns: "请至少选择一个汇总项。",
    tooManyLevels: "无法添加分类汇总：分级显示最多 8 级。",
    tooManyRows: "无法添加分类汇总：工作表的行数过多。",
    functions: {
      sum: "求和",
      count: "计数",
      average: "平均值",
      max: "最大值",
      min: "最小值",
      product: "乘积",
      countNums: "数值计数",
      stdDev: "标准偏差",
      stdDevp: "总体标准偏差",
      var: "方差",
      varp: "总体方差",
    },
    labels: {
      sum: "汇总",
      count: "计数",
      average: "平均值",
      max: "最大值",
      min: "最小值",
      product: "乘积",
      countNums: "计数",
      stdDev: "标准偏差",
      stdDevp: "总体标准偏差",
      var: "方差",
      varp: "总体方差",
    },
    groupLabel: "{value} {label}",
    grandLabel: "总计",
  },
  settings: {
    title: "分级显示设置",
    direction: "方向",
    summaryBelow: "明细数据的下方",
    summaryRight: "明细数据的右侧",
    ok: "确定",
    cancel: "取消",
  },
  gutter: {
    level: "显示第 {level} 级",
    expand: "展开组（第 {from}–{to} 行）",
    collapse: "折叠组（第 {from}–{to} 行）",
    expandColumns: "展开组（{from}–{to} 列）",
    collapseColumns: "折叠组（{from}–{to} 列）",
  },
};

const zhTW: DeepPartial<OutlineLocale> = {
  toolbar: { outline: "大綱" },
  menu: {
    group: "組成群組",
    ungroup: "取消群組",
    showDetail: "顯示詳細資料",
    hideDetail: "隱藏詳細資料",
    autoOutline: "自動建立大綱",
    clearOutline: "清除大綱",
    subtotal: "小計…",
    settings: "大綱設定…",
  },
  groupDialog: {
    group: "組成群組",
    ungroup: "取消群組",
    rows: "列",
    columns: "欄",
  },
  errors: {
    maxLevel: "無法組成群組：大綱最多 8 層。",
    notGrouped: "無法取消群組：選取範圍未組成群組。",
    noAutoOutline:
      "無法建立大綱：沒有參照相鄰列或欄的摘要公式（例如 SUM 或 SUBTOTAL）。",
    noDetail: "選取範圍不在群組中。",
  },
  subtotal: {
    title: "小計",
    atEachChange: "分組小計欄位：",
    useFunction: "使用函數：",
    addTo: "新增小計位置：",
    replace: "取代目前小計",
    pageBreaks: "每組資料分頁",
    summaryBelow: "摘要置於小計資料下方",
    removeAll: "全部移除",
    ok: "確定",
    cancel: "取消",
    column: "欄 {name}",
    noData: "請選取包含標題列和至少一列資料的清單。",
    noColumns: "請至少選擇一個要新增小計的欄。",
    functions: {
      sum: "加總",
      count: "計數",
      average: "平均值",
      max: "最大值",
      min: "最小值",
      product: "乘積",
      countNums: "數字計數",
      stdDev: "標準差",
      stdDevp: "母體標準差",
      var: "變異數",
      varp: "母體變異數",
    },
    labels: {
      sum: "合計",
      count: "計數",
      average: "平均值",
      max: "最大值",
      min: "最小值",
      product: "乘積",
      countNums: "計數",
      stdDev: "標準差",
      stdDevp: "母體標準差",
      var: "變異數",
      varp: "母體變異數",
    },
    grandLabel: "總計",
  },
  settings: {
    title: "大綱設定",
    direction: "方向",
    summaryBelow: "摘要列在詳細資料下方",
    summaryRight: "摘要欄在詳細資料右方",
    ok: "確定",
    cancel: "取消",
  },
};

const es: DeepPartial<OutlineLocale> = {
  toolbar: { outline: "Agrupar y esquema" },
  menu: {
    group: "Agrupar",
    ungroup: "Desagrupar",
    showDetail: "Mostrar detalle",
    hideDetail: "Ocultar detalle",
    autoOutline: "Autoesquema",
    clearOutline: "Borrar esquema",
    subtotal: "Subtotal…",
    settings: "Configuración del esquema…",
  },
  groupDialog: {
    group: "Agrupar",
    ungroup: "Desagrupar",
    rows: "Filas",
    columns: "Columnas",
  },
  errors: {
    maxLevel: "No se puede agrupar: un esquema tiene como máximo 8 niveles.",
    notGrouped: "No se puede desagrupar: la selección no está agrupada.",
    noAutoOutline:
      "No se puede crear un esquema: ninguna fórmula de resumen (como SUMA o SUBTOTALES) hace referencia a filas o columnas adyacentes.",
    noDetail: "La selección no está en un grupo.",
  },
  subtotal: {
    title: "Subtotales",
    atEachChange: "Para cada cambio en:",
    useFunction: "Usar función:",
    addTo: "Agregar subtotal a:",
    replace: "Reemplazar subtotales actuales",
    pageBreaks: "Salto de página entre grupos",
    summaryBelow: "Resumen debajo de los datos",
    removeAll: "Quitar todos",
    ok: "Aceptar",
    cancel: "Cancelar",
    column: "Columna {name}",
    noData:
      "Seleccione una lista con una fila de encabezado y al menos una fila de datos.",
    noColumns: "Elija al menos una columna para agregar un subtotal.",
    functions: {
      sum: "Suma",
      count: "Cuenta",
      average: "Promedio",
      max: "Máx",
      min: "Mín",
      product: "Producto",
      countNums: "Contar números",
      stdDev: "Desvest",
      stdDevp: "Desvestp",
      var: "Var",
      varp: "Varp",
    },
    labels: {
      sum: "Total",
      count: "Cuenta",
      average: "Promedio",
      max: "Máx",
      min: "Mín",
      product: "Producto",
      countNums: "Cuenta",
      stdDev: "Desvest",
      stdDevp: "Desvestp",
      var: "Var",
      varp: "Varp",
    },
    groupLabel: "{label} {value}",
    grandLabel: "{label} general",
  },
  settings: {
    title: "Configuración",
    direction: "Dirección",
    summaryBelow: "Filas resumen debajo del detalle",
    summaryRight: "Columnas resumen a la derecha del detalle",
    ok: "Aceptar",
    cancel: "Cancelar",
  },
  gutter: {
    level: "Mostrar el nivel de esquema {level}",
    expand: "Expandir grupo (filas {from}–{to})",
    collapse: "Contraer grupo (filas {from}–{to})",
    expandColumns: "Expandir grupo (columnas {from}–{to})",
    collapseColumns: "Contraer grupo (columnas {from}–{to})",
  },
};

const ru: DeepPartial<OutlineLocale> = {
  toolbar: { outline: "Группировка и структура" },
  menu: {
    group: "Сгруппировать",
    ungroup: "Разгруппировать",
    showDetail: "Показать детали",
    hideDetail: "Скрыть детали",
    autoOutline: "Создание структуры",
    clearOutline: "Удалить структуру",
    subtotal: "Промежуточный итог…",
    settings: "Настройка структуры…",
  },
  groupDialog: {
    group: "Группирование",
    ungroup: "Разгруппирование",
    rows: "Строки",
    columns: "Столбцы",
  },
  errors: {
    maxLevel: "Невозможно сгруппировать: в структуре не более 8 уровней.",
    notGrouped: "Невозможно разгруппировать: выделение не сгруппировано.",
    noAutoOutline:
      "Невозможно создать структуру: нет итоговых формул (например, СУММ или ПРОМЕЖУТОЧНЫЕ.ИТОГИ), ссылающихся на соседние строки или столбцы.",
    noDetail: "Выделение не входит в группу.",
  },
  subtotal: {
    title: "Промежуточные итоги",
    atEachChange: "При каждом изменении в:",
    useFunction: "Операция:",
    addTo: "Добавить итоги по:",
    replace: "Заменить текущие итоги",
    pageBreaks: "Конец страницы между группами",
    summaryBelow: "Итоги под данными",
    removeAll: "Убрать все",
    ok: "ОК",
    cancel: "Отмена",
    column: "Столбец {name}",
    noData:
      "Выделите список со строкой заголовков и хотя бы одной строкой данных.",
    noColumns: "Выберите хотя бы один столбец для итогов.",
    functions: {
      sum: "Сумма",
      count: "Количество",
      average: "Среднее",
      max: "Максимум",
      min: "Минимум",
      product: "Произведение",
      countNums: "Количество чисел",
      stdDev: "Смещённое отклонение",
      stdDevp: "Несмещённое отклонение",
      var: "Смещённая дисперсия",
      varp: "Несмещённая дисперсия",
    },
    labels: {
      sum: "Итог",
      count: "Количество",
      average: "Среднее",
      max: "Максимум",
      min: "Минимум",
      product: "Произведение",
      countNums: "Количество",
    },
    groupLabel: "{value} {label}",
    grandLabel: "Общий {label}",
  },
  settings: {
    title: "Настройка",
    direction: "Расположение итоговых данных",
    summaryBelow: "Итоги в строках под данными",
    summaryRight: "Итоги в столбцах справа от данных",
    ok: "ОК",
    cancel: "Отмена",
  },
  gutter: {
    level: "Показать уровень структуры {level}",
    expand: "Развернуть группу (строки {from}–{to})",
    collapse: "Свернуть группу (строки {from}–{to})",
    expandColumns: "Развернуть группу (столбцы {from}–{to})",
    collapseColumns: "Свернуть группу (столбцы {from}–{to})",
  },
};

const hi: DeepPartial<OutlineLocale> = {
  toolbar: { outline: "समूह और रूपरेखा" },
  menu: {
    group: "समूह बनाएँ",
    ungroup: "समूह हटाएँ",
    showDetail: "विवरण दिखाएँ",
    hideDetail: "विवरण छिपाएँ",
    autoOutline: "स्वतः रूपरेखा",
    clearOutline: "रूपरेखा साफ़ करें",
    subtotal: "उप-योग…",
    settings: "रूपरेखा सेटिंग्स…",
  },
  groupDialog: {
    group: "समूह बनाएँ",
    ungroup: "समूह हटाएँ",
    rows: "पंक्तियाँ",
    columns: "स्तंभ",
  },
  subtotal: {
    title: "उप-योग",
    atEachChange: "प्रत्येक परिवर्तन पर:",
    useFunction: "फ़ंक्शन का उपयोग करें:",
    addTo: "उप-योग जोड़ें:",
    replace: "वर्तमान उप-योग बदलें",
    pageBreaks: "समूहों के बीच पृष्ठ विराम",
    summaryBelow: "डेटा के नीचे सारांश",
    removeAll: "सभी निकालें",
    ok: "ठीक है",
    cancel: "रद्द करें",
    column: "स्तंभ {name}",
    functions: {
      sum: "योग",
      count: "गणना",
      average: "औसत",
      max: "अधिकतम",
      min: "न्यूनतम",
      product: "गुणनफल",
      countNums: "संख्याओं की गणना",
    },
  },
  settings: {
    title: "रूपरेखा सेटिंग्स",
    direction: "दिशा",
    summaryBelow: "विवरण के नीचे सारांश पंक्तियाँ",
    summaryRight: "विवरण के दाईं ओर सारांश स्तंभ",
    ok: "ठीक है",
    cancel: "रद्द करें",
  },
};

const translations: Record<string, DeepPartial<OutlineLocale>> = {
  en: {},
  zh,
  "zh-CN": zh,
  "zh-TW": zhTW,
  es,
  ru,
  hi,
};

const cache: Record<string, OutlineLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = {};
  Object.keys(base).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The outline strings for a context's language (English fallback). */
export function outlineLocale(ctx: { lang?: string | null }): OutlineLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
