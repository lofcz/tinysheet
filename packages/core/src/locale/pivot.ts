/*
 * Strings of PivotTables (report captions, the Create PivotTable dialog, the
 * PivotTable Fields pane and messages). Kept apart from the main locale
 * files; a language without a translation falls back to English key by key.
 */

const en = {
  pivotTable: "PivotTable",
  insertPivotTable: "PivotTable",
  createTitle: "Create PivotTable",
  chooseData: "Choose the data that you want to analyze",
  tableOrRange: "Table/Range",
  chooseLocation: "Choose where you want the PivotTable to be placed",
  newWorksheet: "New Worksheet",
  existingWorksheet: "Existing Worksheet",
  location: "Location",
  ok: "OK",
  cancel: "Cancel",
  fieldsTitle: "PivotTable Fields",
  chooseFields: "Choose fields to add to report:",
  searchFields: "Search",
  dragHint: "Drag fields between areas below:",
  filtersArea: "Filters",
  columnsArea: "Columns",
  rowsArea: "Rows",
  valuesArea: "Values",
  valuesField: "Σ Values",
  close: "Close",
  refresh: "Refresh",
  refreshPivot: "Refresh PivotTable",
  showFieldList: "Show Field List",
  hideFieldList: "Hide Field List",
  pivotOptions: "PivotTable Options",
  layout: "Report Layout",
  layoutCompact: "Compact Form",
  layoutOutline: "Outline Form",
  layoutTabular: "Tabular Form",
  subtotals: "Subtotals",
  subtotalsTop: "Show at Top of Group",
  subtotalsBottom: "Show at Bottom of Group",
  subtotalsOff: "Do Not Show Subtotals",
  grandTotals: "Grand Totals",
  grandTotalRow: "Grand total row",
  grandTotalColumn: "Grand total column",
  repeatLabels: "Repeat item labels",
  emptyCells: "For empty cells show",
  preserveFormatting: "Preserve cell formatting on update",
  autoRefresh: "Refresh when the source data changes",
  pivotName: "PivotTable Name",
  moveUp: "Move Up",
  moveDown: "Move Down",
  moveToFilters: "Move to Report Filter",
  moveToRows: "Move to Row Labels",
  moveToColumns: "Move to Column Labels",
  moveToValues: "Move to Values",
  removeField: "Remove Field",
  valueFieldSettings: "Value Field Settings…",
  fieldSettings: "Field Settings…",
  customName: "Custom Name",
  summarizeBy: "Summarize value field by",
  showValuesAs: "Show values as",
  baseField: "Base field",
  baseItem: "Base item",
  previousItem: "(previous)",
  nextItem: "(next)",
  numberFormat: "Number Format",
  sortAsc: "Sort A to Z",
  sortDesc: "Sort Z to A",
  sortNone: "Data source order",
  sortByValue: "Sort by value",
  sortBy: "Sort by",
  labelFilter: "Label Filter",
  valueFilter: "Value Filter",
  clearFilter: "Clear Filter",
  selectAll: "(Select All)",
  all: "(All)",
  multipleItems: "(Multiple Items)",
  blank: "(blank)",
  group: "Group…",
  ungroup: "Ungroup",
  groupBy: "By",
  groupTitle: "Grouping",
  rowLabels: "Row Labels",
  columnLabels: "Column Labels",
  grandTotal: "Grand Total",
  total: "Total",
  totalOf: "Total {name}",
  itemTotal: "{item} Total",
  itemValueTotal: "{item} {name}",
  values: "Values",
  placeholder:
    "To build a report, choose fields from the PivotTable Field List",
  aggregates: {
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
  } as Record<string, string>,
  /** Default value field captions ("Sum of Sales"). */
  captions: {
    sum: "Sum of {name}",
    count: "Count of {name}",
    average: "Average of {name}",
    max: "Max of {name}",
    min: "Min of {name}",
    product: "Product of {name}",
    countNums: "Count of {name}",
    stdDev: "StdDev of {name}",
    stdDevp: "StdDevp of {name}",
    var: "Var of {name}",
    varp: "Varp of {name}",
  } as Record<string, string>,
  showAs: {
    normal: "No Calculation",
    percentOfGrandTotal: "% of Grand Total",
    percentOfColumnTotal: "% of Column Total",
    percentOfRowTotal: "% of Row Total",
    difference: "Difference From",
    percentDifference: "% Difference From",
  } as Record<string, string>,
  dateGroups: {
    years: "Years",
    quarters: "Quarters",
    months: "Months",
    days: "Days",
  } as Record<string, string>,
  /** Synthetic date-group field names ("Years (Date)"). */
  dateGroupField: "{group} ({name})",
  quarter: "Qtr{n}",
  months: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  labelOps: {
    equals: "Equals",
    notEquals: "Does Not Equal",
    beginsWith: "Begins With",
    endsWith: "Ends With",
    contains: "Contains",
    notContains: "Does Not Contain",
    greaterThan: "Is Greater Than",
    lessThan: "Is Less Than",
    between: "Between",
  } as Record<string, string>,
  valueOps: {
    equals: "Equals",
    notEquals: "Does Not Equal",
    greaterThan: "Is Greater Than",
    greaterOrEqual: "Is Greater Than Or Equal To",
    lessThan: "Is Less Than",
    lessOrEqual: "Is Less Than Or Equal To",
    between: "Between",
    top: "Top N",
    bottom: "Bottom N",
  } as Record<string, string>,
  and: "and",
  apply: "Apply",
  noFields: "The source has no fields.",
  cannotChange: "You can't change this part of a PivotTable.",
  errorSource: "The PivotTable source reference isn't valid.",
  errorHeaders:
    "The PivotTable field name is not valid. To create a PivotTable report, you must use data that is organized as a list with labeled columns.",
  errorLocation: "The destination reference isn't valid.",
  errorOverlapPivot:
    "A PivotTable report cannot overlap another PivotTable report.",
  errorOverlapTable: "A PivotTable report cannot overlap a table.",
  confirmReplace:
    "There's already data in the destination. Do you want to replace it?",
  drillDownNothing: "There are no rows behind this value.",
  refreshError: "The PivotTable could not be refreshed: {error}",
};

export type PivotLocale = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

const translations: Record<string, DeepPartial<PivotLocale>> = {
  en: {},
};

const cache: Record<string, PivotLocale> = {};

function mergeDeep(base: any, over: any): any {
  if (over == null) return base;
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (typeof base !== "object") return over ?? base;
  const out: any = {};
  Object.keys(base).forEach((k) => {
    out[k] = mergeDeep(base[k], over[k]);
  });
  return out;
}

/** PivotTable strings for a context's language (English fallback). */
export function pivotLocale(ctx: { lang?: string | null }): PivotLocale {
  const lang = ctx?.lang || "en";
  const key = [lang, lang.split("-")[0]].find((l) => l in translations) ?? "en";
  if (!cache[key]) cache[key] = mergeDeep(en, translations[key]);
  return cache[key];
}

/** Replace {name} placeholders. */
export function pivotText(
  text: string,
  values: Record<string, string | number>
) {
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in values ? `${values[k]}` : m
  );
}
