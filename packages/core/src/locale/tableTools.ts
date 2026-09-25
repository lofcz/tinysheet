/*
 * Strings of the table tools added in phase 3 (slicers, total-row menu,
 * calculated-column AutoCorrect, style gallery groups). Kept apart from the
 * main locale files; a language without a translation falls back to
 * English key by key.
 */

const en = {
  styleGroups: {
    light: "Light",
    medium: "Medium",
    dark: "Dark",
  } as Record<string, string>,
  /** gallery tooltip of a light / dark style: "Light 3" */
  styleLabel: "{group} {n}",
  filterButton: "Filter button",
  filterColumn: "Filter: {column}",
  errorNoRoomAbove: "The row above the table must be empty.",
  errorHeaderOnly: "A table needs at least one data row.",
  resizeHandle: "Drag to resize the table",
  totalRowMenu: "Total row function",
  moreFunctions: "More Functions…",
  autoCorrect: "AutoCorrect Options",
  undoCalculatedColumn: "Undo Calculated Column",
  overwriteColumn: "Overwrite all cells in this column with this formula",
  insertSlicer: "Insert Slicer",
  insertSlicerHint: "Choose the table columns to create slicers for.",
  insertSlicerNoTable: "Select a cell in a table to insert a slicer.",
  slicer: "Slicer",
  slicerSettings: "Slicer Settings…",
  slicerSettingsTitle: "Slicer Settings",
  sizeAndLayout: "Size and layout",
  name: "Name:",
  caption: "Caption:",
  showCaption: "Display header",
  columns: "Columns:",
  buttonHeight: "Button height:",
  buttonWidth: "Button width:",
  width: "Width:",
  height: "Height:",
  auto: "Auto",
  itemSorting: "Item sorting and filtering",
  ascending: "Ascending (A to Z)",
  descending: "Descending (Z to A)",
  hideNoData: "Hide items with no data",
  noDataLast: "Show items with no data last",
  slicerStyles: "Slicer styles",
  slicerStyleGroups: {
    light: "Light",
    dark: "Dark",
    other: "Other",
  } as Record<string, string>,
  multiSelect: "Multi-Select (Alt+S)",
  clearFilter: "Clear Filter (Alt+C)",
  removeSlicer: "Remove Slicer",
  blank: "(blank)",
  noData: "no data",
  errorSlicerName: "A slicer with this name already exists.",
};

export type TableToolsLocale = typeof en;

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

const zh: DeepPartial<TableToolsLocale> = {
  styleGroups: { light: "浅色", medium: "中等深浅", dark: "深色" },
  filterButton: "筛选按钮",
  errorNoRoomAbove: "表格上方的行必须为空。",
  totalRowMenu: "汇总行函数",
  moreFunctions: "其他函数…",
  undoCalculatedColumn: "撤消计算列",
  overwriteColumn: "使用此公式覆盖当前列中的所有单元格",
  insertSlicer: "插入切片器",
  slicer: "切片器",
  slicerSettings: "切片器设置…",
  slicerSettingsTitle: "切片器设置",
  multiSelect: "多选 (Alt+S)",
  clearFilter: "清除筛选器 (Alt+C)",
  removeSlicer: "删除切片器",
  blank: "(空白)",
};

const es: DeepPartial<TableToolsLocale> = {
  styleGroups: { light: "Claro", medium: "Medio", dark: "Oscuro" },
  filterButton: "Botón de filtro",
  errorNoRoomAbove: "La fila sobre la tabla debe estar vacía.",
  totalRowMenu: "Función de la fila de totales",
  moreFunctions: "Más funciones…",
  undoCalculatedColumn: "Deshacer columna calculada",
  overwriteColumn:
    "Sobrescribir todas las celdas de esta columna con esta fórmula",
  insertSlicer: "Insertar segmentación de datos",
  slicer: "Segmentación de datos",
  slicerSettings: "Configuración de segmentación…",
  slicerSettingsTitle: "Configuración de segmentación",
  multiSelect: "Selección múltiple (Alt+S)",
  clearFilter: "Borrar filtro (Alt+C)",
  removeSlicer: "Quitar segmentación",
  blank: "(vacías)",
};

const translations: Record<string, DeepPartial<TableToolsLocale>> = {
  en,
  zh,
  "zh-CN": zh,
  es,
};

const cache: Record<string, TableToolsLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (typeof base !== "object" || base == null) return over ?? base;
  const out: any = {};
  Object.keys(base).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** The table tools strings for a context's language (English fallback). */
export function tableToolsLocale(ctx: {
  lang?: string | null;
}): TableToolsLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}
