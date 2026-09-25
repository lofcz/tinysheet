/*
 * Strings of the cell controls and data tools (checkboxes, Flash Fill,
 * Goal Seek, Data Tables, Advanced Filter). A language without a
 * translation falls back to English key by key.
 */

const en = {
  toolbar: {
    checkbox: "Checkbox",
    dataTools: "Data tools",
    flashFill: "Flash Fill",
    flashFillShortcut: "Ctrl+E",
    advancedFilter: "Advanced Filter…",
    clearAdvancedFilter: "Clear Advanced Filter",
    whatIf: "What-If Analysis",
    goalSeek: "Goal Seek…",
    dataTable: "Data Table…",
    recalcDataTables: "Recalculate Data Tables",
  },
  checkbox: {
    insert: "Insert checkboxes",
    remove: "Remove checkboxes",
  },
  flashFill: {
    filled: "Flash Fill: {count} cells changed",
    filledOne: "Flash Fill: 1 cell changed",
    noPattern:
      "Flash Fill couldn't find a pattern. Type a few more examples next to your data, then try again.",
    noData:
      "Select a cell in the column to fill, next to the data, after typing an example.",
    undo: "Undo",
  },
  goalSeek: {
    title: "Goal Seek",
    setCell: "Set cell",
    toValue: "To value",
    changingCell: "By changing cell",
    ok: "OK",
    cancel: "Cancel",
    statusTitle: "Goal Seek Status",
    found: "Goal Seeking with Cell {cell} found a solution.",
    notFound: "Goal Seeking with Cell {cell} may not have found a solution.",
    targetValue: "Target value",
    currentValue: "Current value",
    iterations: "Iterations",
    errSetCell: "The set cell must contain a formula.",
    errSetCellRef: "The set cell must be a single cell reference.",
    errChangingCell:
      "The changing cell must be a single cell with a value, not a formula.",
    errValue: "Enter a number for the target value.",
  },
  dataTable: {
    title: "Data Table",
    rowInput: "Row input cell",
    colInput: "Column input cell",
    hint: "Select the whole table first: input values in the first row and/or column, formulas next to them.",
    ok: "OK",
    cancel: "Cancel",
    errInput: "Enter a valid row or column input cell.",
    errTooSmall: "Select a range of at least two rows and two columns.",
    errInputInTable: "The input cell can't be inside the table.",
    errOverlap: "The selection overlaps another data table.",
    partError: "Cannot change part of a data table.",
  },
  advancedFilter: {
    title: "Advanced Filter",
    action: "Action",
    inPlace: "Filter the list, in-place",
    copy: "Copy to another location",
    listRange: "List range",
    criteriaRange: "Criteria range",
    copyTo: "Copy to",
    unique: "Unique records only",
    ok: "OK",
    cancel: "Cancel",
    clear: "Clear",
    errList:
      "The list range must be a range with a header row and at least one record.",
    errCriteria:
      "The criteria range must have a label row and at least one condition row.",
    errCopyTo:
      "The copy-to reference is invalid, names a column the list doesn't have, or doesn't fit the sheet.",
    errOverlap: "The copy-to range can't overlap the list range.",
    result: "{matched} of {total} records found.",
  },
};

export type CellToolsLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, any> ? DeepPartial<T[K]> : T[K];
};

const zh: DeepPartial<CellToolsLocale> = {
  toolbar: {
    checkbox: "复选框",
    dataTools: "数据工具",
    flashFill: "快速填充",
    advancedFilter: "高级筛选…",
    clearAdvancedFilter: "清除高级筛选",
    whatIf: "模拟分析",
    goalSeek: "单变量求解…",
    dataTable: "模拟运算表…",
    recalcDataTables: "重新计算模拟运算表",
  },
  flashFill: {
    filled: "快速填充：已更改 {count} 个单元格",
    filledOne: "快速填充：已更改 1 个单元格",
    noPattern: "快速填充未找到模式。请在数据旁多输入几个示例后重试。",
    undo: "撤销",
  },
  goalSeek: {
    title: "单变量求解",
    setCell: "目标单元格",
    toValue: "目标值",
    changingCell: "可变单元格",
    ok: "确定",
    cancel: "取消",
    statusTitle: "单变量求解状态",
    found: "对单元格 {cell} 进行单变量求解，求得一个解。",
    notFound: "对单元格 {cell} 进行单变量求解，可能未求得解。",
    targetValue: "目标值",
    currentValue: "当前解",
  },
  dataTable: {
    title: "模拟运算表",
    rowInput: "输入引用行的单元格",
    colInput: "输入引用列的单元格",
    ok: "确定",
    cancel: "取消",
    partError: "无法只更改模拟运算表的一部分。",
  },
  advancedFilter: {
    title: "高级筛选",
    action: "方式",
    inPlace: "在原有区域显示筛选结果",
    copy: "将筛选结果复制到其他位置",
    listRange: "列表区域",
    criteriaRange: "条件区域",
    copyTo: "复制到",
    unique: "选择不重复的记录",
    ok: "确定",
    cancel: "取消",
    clear: "清除",
  },
};

const es: DeepPartial<CellToolsLocale> = {
  toolbar: {
    checkbox: "Casilla",
    dataTools: "Herramientas de datos",
    flashFill: "Relleno rápido",
    advancedFilter: "Filtro avanzado…",
    clearAdvancedFilter: "Borrar filtro avanzado",
    whatIf: "Análisis de hipótesis",
    goalSeek: "Buscar objetivo…",
    dataTable: "Tabla de datos…",
  },
  flashFill: {
    filled: "Relleno rápido: {count} celdas cambiadas",
    filledOne: "Relleno rápido: 1 celda cambiada",
    noPattern:
      "Relleno rápido no encontró ningún patrón. Escriba algunos ejemplos más y vuelva a intentarlo.",
    undo: "Deshacer",
  },
  goalSeek: {
    title: "Buscar objetivo",
    setCell: "Definir la celda",
    toValue: "Con el valor",
    changingCell: "Cambiando la celda",
    ok: "Aceptar",
    cancel: "Cancelar",
    statusTitle: "Estado de la búsqueda de objetivo",
    targetValue: "Valor del objetivo",
    currentValue: "Valor actual",
  },
  dataTable: {
    title: "Tabla de datos",
    rowInput: "Celda de entrada (fila)",
    colInput: "Celda de entrada (columna)",
    ok: "Aceptar",
    cancel: "Cancelar",
    partError: "No se puede cambiar parte de una tabla de datos.",
  },
  advancedFilter: {
    title: "Filtro avanzado",
    action: "Acción",
    inPlace: "Filtrar la lista sin moverla a otro lugar",
    copy: "Copiar a otro lugar",
    listRange: "Rango de la lista",
    criteriaRange: "Rango de criterios",
    copyTo: "Copiar a",
    unique: "Solo registros únicos",
    ok: "Aceptar",
    cancel: "Cancelar",
    clear: "Borrar",
  },
};

const translations: Record<string, DeepPartial<CellToolsLocale>> = {
  zh,
  "zh-CN": zh,
  es,
};

const cache: Record<string, CellToolsLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = {};
  Object.keys(base).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The cell tools strings for a context's language (English fallback). */
export function cellToolsLocale(ctx: {
  lang?: string | null;
}): CellToolsLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
