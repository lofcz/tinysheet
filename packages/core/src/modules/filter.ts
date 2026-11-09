import _ from "lodash";
import { createWildcardMatcher } from "./wildcard";
import { checkProtection } from "./protection";
import { locale } from "../locale";
import { dataToolsLocale } from "../locale/dataTools";
import { Context, getFlowdata } from "../context";
import { Cell, CellMatrix } from "../types";
import { getSheetIndex, isAllowEdit, rgbToHex } from "../utils";
import { genarate, update } from "./format";
import { normalizeSelection } from "./selection";
import { isRealNull } from "./validation";
import { peek, peekCell } from "./dependencyGraph";
import { getCellDisplayColors, sortDataRange } from "./sort";
import { execFunctionGroup, groupValuesRefresh } from "./formula";
import { dateToSerial, serialToDateParts } from "./autofill";
import { checkCF, getComputeMap } from "./ConditionFormat";
import { filterOwnedRows } from "./tables";
import {
  activeCellTable,
  clearTableFilters,
  reapplyTableFilters,
  saveTableFilter,
  setTableFilterButton,
  tableFilterEntries,
  tableFilterRange,
  tableFilterScope,
} from "./tableFilter";

/** Rows the table filters of the current sheet hide (kept by the autofilter). */
function tableOwnedRows(ctx: Context) {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const sheet = sheetIndex == null ? null : ctx.luckysheetfile[sheetIndex];
  if (!sheet?.tables?.length) return {};
  return filterOwnedRows({ ...sheet, filter: undefined });
}

/** Recalculate SUBTOTAL and other volatile formulas after rows (un)hide. */
export function refreshFilterFormulas(ctx: Context) {
  const data = getFlowdata(ctx);
  if (data == null || ctx.formulaCache == null) return;
  const fc = ctx.formulaCache;
  try {
    // no changed cells: only volatile formulas (SUBTOTAL, ...) and their
    // dependents are recalculated
    fc.execFunctionExist = [];
    execFunctionGroup(ctx, null as any, null as any, null, undefined, data);
    fc.execFunctionGlobalData = null;
    groupValuesRefresh(ctx);
  } catch (e) {
    // best effort: the next edit recalculates anyway
  }
}

// 筛选配置状态
export function labelFilterOptionState(
  ctx: Context,
  optionstate: boolean,
  rowhidden: Record<string, number>,
  caljs: any,
  str: number,
  edr: number,
  cindex: number,
  stc: number,
  edc: number,
  saveData: boolean
) {
  const param = {
    caljs,
    rowhidden,
    optionstate,
    str,
    edr,
    cindex,
    stc,
    edc,
  };

  if (ctx.filter == null) ctx.filter = {};
  if (optionstate) {
    ctx.filter[cindex - stc] = param;
    // 条件格式参数
    if (caljs != null) {
    }
  } else {
    delete ctx.filter[cindex - stc];
  }

  if (saveData) {
    const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
    if (sheetIndex == null) return;
    const file = ctx.luckysheetfile[sheetIndex];

    if (file.filter == null) {
      file.filter = {};
    }

    if (optionstate) {
      file.filter[cindex - stc] = param;
    } else {
      delete file.filter[cindex - stc];
    }

    // server.saveParam("all", Store.currentSheetIndex, file.filter, {
    //   k: "filter",
    // });
  }
}

// 筛选排序
export function orderbydatafiler(
  ctx: Context,
  str: number,
  stc: number,
  edr: number,
  edc: number,
  curr: number,
  asc: boolean
) {
  const d = getFlowdata(ctx);
  if (d == null) {
    return null;
  }
  str += 1;

  let hasMc = false; // 排序选区是否有合并单元格
  const data: CellMatrix = [];

  for (let r = str; r <= edr; r += 1) {
    const data_row: (Cell | null)[] = [];

    for (let c = stc; c <= edc; c += 1) {
      if (d[r][c] != null && d[r][c]?.mc != null) {
        hasMc = true;
        break;
      }

      data_row.push(d[r][c]);
    }

    data.push(data_row);
  }

  if (hasMc) {
    const { filter } = locale(ctx);

    // if (isEditMode()) {
    //   alert(locale_filter.mergeError);
    // } else {
    return filter.mergeError;
    // }
  }

  sortDataRange(ctx, d, data, curr - stc, asc, str, edr, stc, edc);

  return null;
}

// 创建筛选配置
export function createFilterOptions(
  ctx: Context,
  luckysheet_filter_save:
    | {
        row: number[];
        column: number[];
      }
    | undefined,
  sheetId: string | undefined,
  filterObj?: any,
  saveData?: boolean
) {
  // $(`#luckysheet-filter-selected-sheet${ctx.currentSheetIndex}`).remove();
  // $(`#luckysheet-filter-options-sheet${ctx.currentSheetIndex}`).remove();
  // eslint-disable-next-line no-undef
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  if (sheetId != null && sheetId !== ctx.currentSheetId) return;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return;
  if (luckysheet_filter_save == null || _.size(luckysheet_filter_save) === 0) {
    delete ctx.filterOptions;
    return;
  }

  const r1 = luckysheet_filter_save.row[0];
  const r2 = luckysheet_filter_save.row[1];
  const c1 = luckysheet_filter_save.column[0];
  const c2 = luckysheet_filter_save.column[1];

  const row = ctx.visibledatarow[r2] ?? 0;
  const row_pre = r1 - 1 === -1 ? 0 : (ctx.visibledatarow[r1 - 1] ?? 0);
  const col = ctx.visibledatacolumn[c2] ?? 0;
  const col_pre = c1 - 1 === -1 ? 0 : (ctx.visibledatacolumn[c1 - 1] ?? 0);
  const options = {
    startRow: r1,
    endRow: r2,
    startCol: c1,
    endCol: c2,
    left: col_pre,
    top: row_pre,
    width: col - col_pre - 1,
    height: row - row_pre - 1,
    items: [] as { col: number; left: number; top: number }[],
  };

  for (let c = c1; c <= c2; c += 1) {
    // TODO: filterObj
    if (filterObj == null || filterObj?.[c - c1] == null) {
    } else {
    }
    let left = 0;
    if (ctx.visibledatacolumn[c]) {
      left = ctx.visibledatacolumn[c] - 20;
    }
    options.items.push({
      col: c,
      left,
      top: row_pre,
    });
  }

  if (saveData) {
    const file = ctx.luckysheetfile[sheetIndex];
    file.filter_select = luckysheet_filter_save;
  }
  ctx.filterOptions = options;
}

/** Removes the sheet autofilter (its buttons and the rows it hides). */
export function clearSheetAutoFilter(ctx: Context) {
  if (!checkProtection(ctx, "protected")) return;
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const hiddenRows = _.reduce(
    ctx.filter,
    (pre, curr) => _.assign(pre, curr?.rowhidden || {}),
    {}
  );
  ctx.config.rowhidden = _.assign(
    _.omit(ctx.config.rowhidden, _.keys(hiddenRows)),
    tableOwnedRows(ctx)
  );
  ctx.luckysheet_filter_save = undefined;
  ctx.filterOptions = undefined;
  ctx.filterContextMenu = undefined;
  ctx.filter = {};
  if (sheetIndex != null) {
    ctx.luckysheetfile[sheetIndex].filter = undefined;
    ctx.luckysheetfile[sheetIndex].filter_select = undefined;
    ctx.luckysheetfile[sheetIndex].config = _.assign({}, ctx.config);
  }
  refreshFilterFormulas(ctx);
}

/**
 * The filter menu's "Clear filter": removes the sheet autofilter, or with a
 * table scope (see tableFilter.ts) clears that table's filters.
 */
export function clearFilter(ctx: Context) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const scope = tableFilterScope(ctx);
  if (scope) {
    clearTableFilters(ctx, scope.table.name);
    ctx.filterContextMenu = undefined;
    return;
  }
  clearSheetAutoFilter(ctx);
}

export function createFilter(ctx: Context) {
  if (!checkProtection(ctx, "protected")) return;
  // if (!checkProtectionAuthorityNormal(ctx.currentSheetIndex, "filter")) {
  //   return;
  // }

  if (_.size(ctx.luckysheet_select_save) > 1) {
    // const locale_splitText = locale().splitText;

    // if (isEditMode()) {
    //   alert(locale_splitText.tipNoMulti);
    // } else {
    //   tooltip.info(locale_splitText.tipNoMulti, "");
    // }

    return;
  }
  // inside a table, the table's filter buttons are toggled (Excel)
  const inTable = activeCellTable(ctx);
  if (inTable) {
    setTableFilterButton(
      ctx,
      inTable.table.name,
      inTable.table.filterButton === false
    );
    return;
  }
  if (_.size(ctx.luckysheet_filter_save) > 0) {
    clearSheetAutoFilter(ctx);
    return;
  }

  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null || ctx.luckysheetfile[sheetIndex].isPivotTable) {
    return;
  }

  // $(
  //   `#luckysheet-filter-selected-sheet${sheetId}, #luckysheet-filter-options-sheet${ctx.currentSheetId}`
  // ).remove();

  const last = ctx.luckysheet_select_save?.[0];
  const flowdata = getFlowdata(ctx);
  let filterSave;
  if (last == null || flowdata == null) return;
  if (last.row[0] === last.row[1] && last.column[0] === last.column[1]) {
    let st_c;
    let ed_c;
    const curR = last.row[1];

    for (let c = 0; c < flowdata[curR].length; c += 1) {
      const cell = flowdata[curR][c];

      if (cell != null && !isRealNull(cell.v)) {
        if (st_c == null) {
          st_c = c;
        }
      } else if (st_c != null) {
        ed_c = c - 1;
        break;
      }
    }

    if (ed_c == null) {
      ed_c = flowdata[curR].length - 1;
    }

    filterSave = normalizeSelection(ctx, [
      { row: [curR, curR], column: [st_c || 0, ed_c] }, // st_c default 0 ?
    ]);
    ctx.luckysheet_select_save = filterSave;

    ctx.luckysheet_shiftpositon = _.assign({}, last);
    // luckysheetMoveEndCell("down", "range");
  } else if (last.row[1] - last.row[0] < 2) {
    ctx.luckysheet_shiftpositon = _.assign({}, last);
    // luckysheetMoveEndCell("down", "range");
  }

  ctx.luckysheet_filter_save = _.assign(
    {},
    filterSave?.[0] || ctx.luckysheet_select_save?.[0]
  );

  createFilterOptions(ctx, ctx.luckysheet_filter_save, undefined, {}, true);

  // server.saveParam("all", ctx.currentSheetIndex, ctx.luckysheet_filter_save, {
  //   k: "filter_select",
  // });

  // if (ctx.filterchage) {
  //   ctx.jfredo.push({
  //     type: "filtershow",
  //     data: [],
  //     curdata: [],
  //     sheetIndex: ctx.currentSheetIndex,
  //     filter_save: ctx.luckysheet_filter_save,
  //   });
  // }
}

export type FilterDate = {
  key: string;
  type: string;
  value: string;
  text: string;
  rows: number[];
  dateValues: string[];
  children: FilterDate[];
};

export type FilterValue = {
  key: string;
  value: any;
  mask: any;
  text: string;
  rows: number[];
};

/** The filter state the menu acts on: the autofilter's or a table's. */
function scopedFilters(ctx: Context): Context["filter"] {
  const scope = tableFilterScope(ctx);
  return scope ? tableFilterEntries(scope.table) : ctx.filter;
}

function getFilterHiddenRows(ctx: Context, col: number, startCol: number) {
  const filters = scopedFilters(ctx);
  const otherHiddenRows = _.reduce(
    filters,
    (pre, curr) =>
      _.assign(pre, (curr?.cindex !== col && curr?.rowhidden) || {}),
    {}
  );
  const hiddenRows = filters?.[col - startCol]?.rowhidden || {};
  return { otherHiddenRows, hiddenRows };
}

export function getFilterColumnValues(
  ctx: Context,
  col: number,
  startRow: number,
  endRow: number,
  startCol: number
) {
  const { otherHiddenRows, hiddenRows } = getFilterHiddenRows(
    ctx,
    col,
    startCol
  );
  const visibleRows: number[] = [];
  const flattenValues: string[] = [];
  // 日期值
  const dates: FilterDate[] = [];
  const datesUncheck = new Set<string>();
  const dateRowMap: Record<string, number[]> = {};
  const dateNodes = new Map<string, FilterDate>();
  const dateStrings = new Map<unknown, string>();

  // 除日期以外的值
  const valuesMap = new Map<string, FilterValue | Map<unknown, FilterValue>>();
  const valuesUncheck = new Set<string>();
  const valueRowMap: Record<string, number[]> = {};

  const flowdata = peek(getFlowdata(ctx));
  if (flowdata == null)
    return {
      dates,
      datesUncheck: [],
      dateRowMap,
      values: [],
      valuesUncheck: [],
      valueRowMap,
      visibleRows,
      flattenValues,
    };

  const { filter } = locale(ctx);
  // Date tree: year, localized month name, day.
  const monthNames = dataToolsLocale(ctx).filter.months;
  for (let r = startRow + 1; r <= endRow; r += 1) {
    if (r in otherHiddenRows) {
      continue;
    }
    visibleRows.push(r);

    const cell = peekCell(flowdata, r, col);
    const hasValue = cell != null && !isRealNull(cell.v);

    if (hasValue && cell.ct != null && cell.ct.t === "d") {
      // 单元格是日期
      const dateStr: string =
        dateStrings.get(cell.v) ?? update("YYYY-MM-DD", cell.v);
      dateStrings.set(cell.v, dateStr);

      const y = dateStr.split("-")[0];
      const m = dateStr.split("-")[1];
      const d = dateStr.split("-")[2];

      let yearValue = dateNodes.get(y);
      if (yearValue == null) {
        yearValue = {
          key: y,
          type: "year",
          value: y,
          text: y,
          children: [],
          rows: [],
          dateValues: [],
        };
        dates.push(yearValue);
        dateNodes.set(y, yearValue);
      }

      let monthValue = dateNodes.get(`${y}-${m}`);
      if (monthValue == null) {
        monthValue = {
          key: `${y}-${m}`,
          type: "month",
          value: m,
          text: monthNames[Number(m) - 1] ?? m,
          children: [],
          rows: [],
          dateValues: [],
        };
        yearValue.children.push(monthValue);
        dateNodes.set(monthValue.key, monthValue);
      }

      let dayValue = dateNodes.get(dateStr);
      if (dayValue == null) {
        dayValue = {
          key: dateStr,
          type: "day",
          value: d,
          text: d,
          children: [],
          rows: [],
          dateValues: [],
        };
        monthValue.children.push(dayValue);
        dateNodes.set(dateStr, dayValue);
        flattenValues.push(dateStr);
        yearValue.dateValues.push(dateStr);
        monthValue.dateValues.push(dateStr);
        dayValue.dateValues.push(dateStr);
        dateRowMap[dateStr] = dayValue.rows;
      }

      yearValue.rows.push(r);
      monthValue.rows.push(r);
      dayValue.rows.push(r);

      if (r in hiddenRows) {
        datesUncheck.add(dateStr);
      }
    } else {
      let v;
      let m: string | number | null | undefined;
      if (!hasValue) {
        v = null;
        m = null;
      } else {
        v = cell.v;
        m = cell.m;
      }

      let data = valuesMap.get(`${v}`);
      if (data && !(data instanceof Map) && data.mask !== m) {
        data = new Map([[data.mask, data]]);
        valuesMap.set(`${v}`, data);
      }
      let maskValue = data instanceof Map ? data.get(m) : data;
      if (maskValue == null) {
        const text =
          m == null ? (v == null ? filter.valueBlank : `${v}`) : `${m}`;
        const key = `${v}#$$$#${m}`;
        maskValue = { key, value: v, text, mask: m, rows: [] };
        if (data instanceof Map) data.set(m, maskValue);
        else valuesMap.set(`${v}`, maskValue);
        flattenValues.push(text);
        valueRowMap[key] = maskValue.rows;
      }
      maskValue.rows.push(r);

      if (r in hiddenRows) {
        valuesUncheck.add(maskValue.key);
      }
    }
  }
  const values: FilterValue[] = [];
  valuesMap.forEach((masks) => {
    if (masks instanceof Map) masks.forEach((value) => values.push(value));
    else values.push(masks);
  });
  return {
    dates,
    datesUncheck: [...datesUncheck],
    dateRowMap,
    values,
    valuesUncheck: [...valuesUncheck],
    valueRowMap,
    visibleRows,
    flattenValues,
  };
}

export type FilterColor = {
  color: string;
  checked: boolean;
  rows: number[];
};

export function getFilterColumnColors(
  ctx: Context,
  col: number,
  startRow: number,
  endRow: number
) {
  const bgMap = new Map<string, FilterColor>();
  const fcMap = new Map<string, FilterColor>();
  const flowdata = peek(getFlowdata(ctx));
  if (flowdata == null) return { bgColors: [], fcColors: [] };
  const sheet = ctx.luckysheetfile.find((s) => s.id === ctx.currentSheetId);
  const cf = sheet?.luckysheet_conditionformat_save?.length
    ? getComputeMap(ctx)
    : null;
  const hidden = ctx.config?.rowhidden || {};
  // A banded table repeats a handful of colours across tens of thousands of
  // cells. Normalize each distinct colour once, without repeated row lookups.
  const colors = new Map<string, string>();
  const normalize = (raw: string) => {
    let color = colors.get(raw);
    if (color != null) return color;
    color = raw.includes("rgb") ? rgbToHex(raw) : raw;
    if (color.length === 4) {
      color =
        "#" + color[1].repeat(2) + color[2].repeat(2) + color[3].repeat(2);
    }
    colors.set(raw, color);
    return color;
  };
  const add = (map: Map<string, FilterColor>, raw: string, row: number) => {
    const color = normalize(raw);
    let group = map.get(color);
    if (!group) {
      group = { color, checked: true, rows: [] };
      map.set(color, group);
    }
    group.rows.push(row);
    if (row in hidden) group.checked = false;
  };
  for (let r = startRow + 1; r <= endRow; r += 1) {
    const cell = peekCell(flowdata, r, col);
    const style = cf ? checkCF(r, col, cf) : null;
    add(bgMap, style?.cellColor ?? cell?.bg ?? "#ffffff", r);
    if (cell && !isRealNull(cell.v)) {
      add(fcMap, style?.textColor ?? (cell.fc || "#000000"), r);
    }
  }
  return {
    bgColors: bgMap.size < 2 ? [] : [...bgMap.values()],
    fcColors: fcMap.size < 2 ? [] : [...fcMap.values()],
  };
}

export function saveFilter(
  ctx: Context,
  optionState: boolean,
  hiddenRows: Record<string, number>,
  caljs: any,
  st_r: number,
  ed_r: number,
  cindex: number,
  st_c: number,
  ed_c: number
) {
  if (!checkProtection(ctx, "filter")) return;
  const scope = tableFilterScope(ctx);
  if (scope) {
    saveTableFilter(ctx, scope, optionState, hiddenRows, caljs, cindex);
    return;
  }
  const { otherHiddenRows, hiddenRows: prevHiddenRows } = getFilterHiddenRows(
    ctx,
    cindex,
    st_c
  );
  // keep rows hidden by hand; replace what this column's filter hid before
  // (rows a table filter hides stay hidden)
  const rowHiddenAll = _.assign(
    _.omit(ctx.config?.rowhidden || {}, _.keys(prevHiddenRows)),
    otherHiddenRows,
    hiddenRows,
    tableOwnedRows(ctx)
  );

  labelFilterOptionState(
    ctx,
    optionState,
    hiddenRows,
    caljs,
    st_r,
    ed_r,
    cindex,
    st_c,
    ed_c,
    true
  );

  const cfg = _.assign({}, ctx.config);
  cfg.rowhidden = rowHiddenAll;

  // config
  ctx.config = cfg;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) {
    return;
  }
  ctx.luckysheetfile[sheetIndex].config = cfg;
  refreshFilterFormulas(ctx);

  // server.saveParam("cg", Store.currentSheetIndex, cfg.rowhidden, {
  //   k: "rowhidden",
  // });
}

/* ------------------------------------------------------------------ */
/* Excel AutoFilter conditions                                         */
/* ------------------------------------------------------------------ */

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterOrEqual"
  | "lessThan"
  | "lessOrEqual"
  | "beginsWith"
  | "notBeginsWith"
  | "endsWith"
  | "notEndsWith"
  | "contains"
  | "notContains";

export const FILTER_OPERATORS: FilterOperator[] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterOrEqual",
  "lessThan",
  "lessOrEqual",
  "beginsWith",
  "notBeginsWith",
  "endsWith",
  "notEndsWith",
  "contains",
  "notContains",
];

export type DatePeriod =
  | "today"
  | "yesterday"
  | "tomorrow"
  | "thisWeek"
  | "lastWeek"
  | "nextWeek"
  | "thisMonth"
  | "lastMonth"
  | "nextMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "nextQuarter"
  | "thisYear"
  | "lastYear"
  | "nextYear"
  | "yearToDate"
  | "Q1"
  | "Q2"
  | "Q3"
  | "Q4"
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "M8"
  | "M9"
  | "M10"
  | "M11"
  | "M12";

/** The relative periods of Excel's Date Filters menu, in menu order. */
export const DATE_PERIODS: DatePeriod[] = [
  "tomorrow",
  "today",
  "yesterday",
  "nextWeek",
  "thisWeek",
  "lastWeek",
  "nextMonth",
  "thisMonth",
  "lastMonth",
  "nextQuarter",
  "thisQuarter",
  "lastQuarter",
  "nextYear",
  "thisYear",
  "lastYear",
  "yearToDate",
];

export type FilterCondition =
  /** set by the value checklist; the hidden rows are stored with it */
  | { type: "values" }
  /** keep rows whose fill (or font) colour is one of `colors` */
  | { type: "cellColor"; colors: string[] }
  | { type: "fontColor"; colors: string[] }
  /** Custom AutoFilter: one or two criteria joined by AND / OR */
  | {
      type: "custom";
      op1: FilterOperator;
      value1: string;
      join?: "and" | "or";
      op2?: FilterOperator;
      value2?: string;
    }
  | { type: "top10"; bottom?: boolean; count: number; percent?: boolean }
  | { type: "average"; below?: boolean }
  | { type: "datePeriod"; period: DatePeriod };

function isDateCell(cell: Cell | null | undefined) {
  return cell != null && cell.ct?.t === "d" && typeof cell.v === "number";
}

function displayText(cell: Cell | null | undefined): string {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
  }
  if (cell.m != null) return `${cell.m}`;
  return cell.v == null ? "" : `${cell.v}`;
}

/** Excel wildcards: * any run, ? one character, ~ escapes. */
export function wildcardRegExp(
  pattern: string,
  anchor: "full" | "start" | "end" | "any"
) {
  let src = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "~" && i + 1 < pattern.length) {
      src += _.escapeRegExp(pattern[i + 1]);
      i += 1;
    } else if (ch === "*") src += ".*";
    else if (ch === "?") src += ".";
    else src += _.escapeRegExp(ch);
  }
  if (anchor === "full") src = `^${src}$`;
  else if (anchor === "start") src = `^${src}`;
  else if (anchor === "end") src = `${src}$`;
  return new RegExp(src, "is");
}

/** Parse a typed criterion like Excel: numbers, dates, times, percents. */
function parseCriterion(text: string): { num: number | null; text: string } {
  const str = `${text ?? ""}`;
  if (str.trim() === "") return { num: null, text: "" };
  const parsed = genarate(str);
  if (parsed && typeof parsed[2] === "number") {
    return { num: parsed[2], text: str };
  }
  return { num: null, text: str };
}

const textCollator = new Intl.Collator(undefined, { sensitivity: "accent" });

// A filter scans a column with one criterion. Bound the cache while avoiding
// compiling that criterion again for every row.
const filterMatchers = new Map<
  string,
  ReturnType<typeof createWildcardMatcher>
>();
function filterMatcher(
  pattern: string,
  anchor: "full" | "start" | "end" | "any"
) {
  const key = `${anchor}:${pattern}`;
  let matcher = filterMatchers.get(key);
  if (!matcher) {
    if (filterMatchers.size >= 64) filterMatchers.clear();
    matcher = createWildcardMatcher(pattern, anchor);
    filterMatchers.set(key, matcher);
  }
  return matcher;
}

/** Does a cell satisfy one Custom AutoFilter criterion? */
export function matchFilterOperator(
  cell: Cell | null | undefined,
  op: FilterOperator,
  criterion: string
): boolean {
  const blank = cell == null || isRealNull(cell.v) || cell.v === "";
  const crit = parseCriterion(criterion);
  const text = blank ? "" : displayText(cell);
  const isNum = !blank && typeof cell!.v === "number";
  switch (op) {
    case "equals":
    case "notEquals": {
      let eq: boolean;
      if (crit.text === "") eq = blank;
      else if (crit.num != null && isNum) {
        eq = Math.abs((cell!.v as number) - crit.num) < 1e-9;
      } else {
        eq = !blank && filterMatcher(crit.text, "full").test(text);
      }
      return op === "equals" ? eq : !eq;
    }
    case "greaterThan":
    case "greaterOrEqual":
    case "lessThan":
    case "lessOrEqual": {
      if (blank) return false;
      let cmp: number;
      if (crit.num != null) {
        if (!isNum) return false;
        cmp = (cell!.v as number) - crit.num;
      } else {
        if (isNum) return false;
        cmp = textCollator.compare(text, crit.text);
      }
      if (op === "greaterThan") return cmp > 0;
      if (op === "greaterOrEqual") return cmp >= 0;
      if (op === "lessThan") return cmp < 0;
      return cmp <= 0;
    }
    case "beginsWith":
      return filterMatcher(crit.text, "start").test(text);
    case "notBeginsWith":
      return !filterMatcher(crit.text, "start").test(text);
    case "endsWith":
      return filterMatcher(crit.text, "end").test(text);
    case "notEndsWith":
      return !filterMatcher(crit.text, "end").test(text);
    case "contains":
      return filterMatcher(crit.text, "any").test(text);
    case "notContains":
      return !filterMatcher(crit.text, "any").test(text);
    default:
      return true;
  }
}

/** First and last serial (inclusive) of a relative date period. */
export function datePeriodRange(
  period: DatePeriod,
  now: Date = new Date()
): [number, number] | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = dateToSerial(y, m, d);
  const weekStart = today - now.getDay(); // weeks start on Sunday
  const q = Math.floor(m / 3);
  const quarter = (offset: number): [number, number] => {
    const qi = q + offset;
    const qy = y + Math.floor(qi / 4);
    const qm = (((qi % 4) + 4) % 4) * 3;
    return [dateToSerial(qy, qm, 1), dateToSerial(qy, qm + 3, 1) - 1];
  };
  const month = (offset: number): [number, number] => [
    dateToSerial(y, m + offset, 1),
    dateToSerial(y, m + offset + 1, 1) - 1,
  ];
  const year = (offset: number): [number, number] => [
    dateToSerial(y + offset, 0, 1),
    dateToSerial(y + offset + 1, 0, 1) - 1,
  ];
  switch (period) {
    case "today":
      return [today, today];
    case "yesterday":
      return [today - 1, today - 1];
    case "tomorrow":
      return [today + 1, today + 1];
    case "thisWeek":
      return [weekStart, weekStart + 6];
    case "lastWeek":
      return [weekStart - 7, weekStart - 1];
    case "nextWeek":
      return [weekStart + 7, weekStart + 13];
    case "thisMonth":
      return month(0);
    case "lastMonth":
      return month(-1);
    case "nextMonth":
      return month(1);
    case "thisQuarter":
      return quarter(0);
    case "lastQuarter":
      return quarter(-1);
    case "nextQuarter":
      return quarter(1);
    case "thisYear":
      return year(0);
    case "lastYear":
      return year(-1);
    case "nextYear":
      return year(1);
    case "yearToDate":
      return [dateToSerial(y, 0, 1), today];
    default:
      return null;
  }
}

function matchDatePeriod(
  cell: Cell | null | undefined,
  period: DatePeriod,
  now?: Date
) {
  if (!isDateCell(cell)) return false;
  const serial = Math.floor(cell!.v as number);
  const qm = /^Q([1-4])$/.exec(period);
  const mm = /^M(\d{1,2})$/.exec(period);
  if (qm || mm) {
    const month = serialToDateParts(serial).m;
    if (qm) return Math.floor(month / 3) + 1 === Number(qm[1]);
    return month + 1 === Number(mm![1]);
  }
  const range = datePeriodRange(period, now);
  return range != null && serial >= range[0] && serial <= range[1];
}

/**
 * The data rows (startRow is the header row) of column `col` that a
 * condition hides, as a rowhidden map.
 */
export function computeFilterConditionRows(
  ctx: Context,
  col: number,
  startRow: number,
  endRow: number,
  condition: FilterCondition,
  now?: Date
): Record<string, number> {
  const hidden: Record<string, number> = {};
  const data = getFlowdata(ctx);
  if (data == null) return hidden;
  const rows: number[] = [];
  for (let r = startRow + 1; r <= endRow; r += 1) rows.push(r);
  const cellOf = (r: number) => peekCell(data, r, col) ?? null;
  let keep: (r: number) => boolean = () => true;

  if (condition.type === "custom") {
    const { op1, value1, op2, value2, join } = condition;
    const hasSecond = op2 != null && value2 != null && `${value2}` !== "";
    keep = (r) => {
      const a = matchFilterOperator(cellOf(r), op1, value1);
      if (!hasSecond) return a;
      const b = matchFilterOperator(cellOf(r), op2!, value2!);
      return join === "or" ? a || b : a && b;
    };
  } else if (condition.type === "top10" || condition.type === "average") {
    const nums = rows
      .map((r) => cellOf(r)?.v)
      .filter((v): v is number => typeof v === "number");
    if (condition.type === "average") {
      const avg = nums.length ? _.sum(nums) / nums.length : 0;
      keep = (r) => {
        const v = cellOf(r)?.v;
        if (typeof v !== "number") return false;
        return condition.below ? v < avg : v > avg;
      };
    } else {
      const sorted = nums.slice().sort((a, b) => a - b);
      if (!condition.bottom) sorted.reverse();
      let n = Math.max(0, Math.floor(condition.count || 0));
      if (condition.percent) {
        n = Math.max(1, Math.floor((sorted.length * n) / 100));
      }
      n = Math.min(n, sorted.length);
      const threshold = n > 0 ? sorted[n - 1] : null;
      keep = (r) => {
        const v = cellOf(r)?.v;
        if (typeof v !== "number" || threshold == null) return false;
        return condition.bottom ? v <= threshold : v >= threshold;
      };
    }
  } else if (condition.type === "datePeriod") {
    keep = (r) => matchDatePeriod(cellOf(r), condition.period, now);
  } else if (condition.type === "cellColor" || condition.type === "fontColor") {
    const cfCompute = getComputeMap(ctx);
    const wanted = condition.colors.map((c) => c.toLowerCase());
    keep = (r) => {
      const colors = getCellDisplayColors(data, r, col, cfCompute);
      return wanted.includes(
        condition.type === "cellColor" ? colors.bg : colors.fc
      );
    };
  }

  rows.forEach((r) => {
    if (!keep(r)) hidden[r] = 0;
  });
  return hidden;
}

function currentFilterRange(ctx: Context) {
  const save = ctx.luckysheet_filter_save;
  if (save == null || save.row == null || save.column == null) return null;
  return {
    str: save.row[0],
    edr: save.row[1],
    stc: save.column[0],
    edc: save.column[1],
  };
}

/** The range the filter menu acts on: a table's (scope) or the autofilter's. */
function scopedFilterRange(ctx: Context) {
  const scope = tableFilterScope(ctx);
  if (scope) return tableFilterRange(scope.table);
  return currentFilterRange(ctx);
}

/**
 * Filter column `col` of the active AutoFilter range by a condition. Other
 * columns' filters still apply (a row must pass every column).
 */
export function applyFilterCondition(
  ctx: Context,
  col: number,
  condition: FilterCondition,
  now?: Date
) {
  const range = scopedFilterRange(ctx);
  if (range == null) return;
  const { str, edr, stc, edc } = range;
  if (col < stc || col > edc) return;
  const hidden = computeFilterConditionRows(ctx, col, str, edr, condition, now);
  saveFilter(ctx, true, hidden, condition, str, edr, col, stc, edc);
}

/** "Clear Filter From <column>": drop one column's condition. */
export function clearColumnFilter(ctx: Context, col: number) {
  const range = scopedFilterRange(ctx);
  if (range == null) return;
  const { str, edr, stc, edc } = range;
  saveFilter(ctx, false, {}, null, str, edr, col, stc, edc);
}

/**
 * Excel's Data › Clear: show every row but keep the filter buttons (inside
 * a table: the table's filters).
 */
export function clearAllFilterConditions(ctx: Context) {
  if (!checkProtection(ctx, "filter")) return;
  const inTable = activeCellTable(ctx);
  if (inTable) {
    clearTableFilters(ctx, inTable.table.name);
    return;
  }
  const hiddenRows = _.reduce(
    ctx.filter,
    (pre, curr) => _.assign(pre, curr?.rowhidden || {}),
    {} as Record<string, number>
  );
  const cfg = _.assign({}, ctx.config);
  cfg.rowhidden = _.assign(
    _.omit(cfg.rowhidden || {}, _.keys(hiddenRows)),
    tableOwnedRows(ctx)
  );
  ctx.config = cfg;
  ctx.filter = {};
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex != null) {
    ctx.luckysheetfile[sheetIndex].filter = {};
    ctx.luckysheetfile[sheetIndex].config = cfg;
  }
  refreshFilterFormulas(ctx);
}

/**
 * Re-run the stored conditions (value lists excepted) on current data
 * (inside a table: the table's filters).
 */
export function reapplyFilter(ctx: Context, now?: Date) {
  const inTable = activeCellTable(ctx);
  if (inTable) {
    reapplyTableFilters(ctx, inTable.table.name);
    return;
  }
  const range = currentFilterRange(ctx);
  if (range == null) return;
  _.forEach(_.values(ctx.filter), (f) => {
    const condition = f?.caljs as FilterCondition | undefined;
    if (condition == null || condition.type == null) return;
    if (condition.type === "values") return;
    applyFilterCondition(ctx, f.cindex, condition, now);
  });
}

/** "x of y records found": data rows of the filter range left visible. */
export function getFilterRecordCount(
  ctx: Context
): { visible: number; total: number } | null {
  const range = currentFilterRange(ctx);
  if (range == null || _.isEmpty(ctx.filter)) return null;
  const { str, edr } = range;
  const total = Math.max(0, edr - str);
  const hidden = new Set<number>();
  _.forEach(ctx.filter, (f) => {
    _.keys(f?.rowhidden || {}).forEach((k) => {
      const r = Number(k);
      if (r > str && r <= edr) hidden.add(r);
    });
  });
  return { visible: total - hidden.size, total };
}

/**
 * Which filter submenu fits a column: "date" when most values are dates,
 * "number" when most are numbers, else "text".
 */
export function getFilterColumnKind(
  ctx: Context,
  col: number,
  startRow: number,
  endRow: number
): "text" | "number" | "date" {
  const data = peek(getFlowdata(ctx));
  if (data == null) return "text";
  let dates = 0;
  let nums = 0;
  let texts = 0;
  for (let r = startRow + 1; r <= endRow; r += 1) {
    const cell = peekCell(data, r, col);
    if (cell == null || isRealNull(cell.v)) continue;
    if (isDateCell(cell)) dates += 1;
    else if (typeof cell.v === "number") nums += 1;
    else texts += 1;
  }
  if (dates > 0 && dates >= nums && dates >= texts) return "date";
  if (nums > 0 && nums >= texts) return "number";
  return "text";
}

/** The condition stored for a column of the active filter, if any. */
export function getColumnFilterCondition(
  ctx: Context,
  col: number
): FilterCondition | null {
  const range = scopedFilterRange(ctx);
  if (range == null) return null;
  const f = scopedFilters(ctx)?.[col - range.stc];
  return (f?.caljs as FilterCondition) ?? null;
}
