/**
 * Table filters and slicers.
 *
 * Every table has its own filter (Excel: one sheet autofilter plus one
 * filter per table). Its state lives on the table (`table.filters`, keyed
 * by the column's index in the table): the condition and the rows it hides.
 * The sheet's hidden rows are the union of the rows hidden by hand, by the
 * sheet autofilter and by every table filter (see syncFilterHiddenRows).
 *
 * The header filter buttons open the regular filter menu; while
 * `ctx.filterScope` names a table, the filter.ts functions the menu calls
 * (saveFilter, applyFilterCondition, ...) act on that table's filter.
 *
 * Slicers (`table.slicers`) are button panels that filter one column by
 * value. They read and write the same column filter, so the header button
 * and the slicer always agree, and several slicers combine (AND).
 */
import _ from "lodash";
import type { Context } from "../context";
import type {
  Cell,
  SheetTable,
  TableColumnFilter,
  TableSlicer,
} from "../types";
import type { FilterCondition } from "./filter";
import { computeFilterConditionRows, refreshFilterFormulas } from "./filter";
import {
  findTable,
  syncFilterHiddenRows,
  tableAreas,
  tableAt,
  tableFilterRows,
  TableRef,
  uniqueSlicerName,
  updateTableObject,
} from "./tables";

export { tableToolsLocale } from "../locale/tableTools";
export type { TableToolsLocale } from "../locale/tableTools";

function sheetOf(ctx: Context, id: string) {
  return ctx.luckysheetfile.find((f) => f.id === id);
}

/**
 * The text a value filter and a slicer use for a cell: its display text,
 * "" for blanks.
 */
export function tableItemText(cell: Cell | null | undefined): string {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((x: any) => x?.v ?? "").join("");
  }
  const v = cell.m ?? cell.v;
  return v == null ? "" : String(v);
}

/** The table the filter menu acts on (see ctx.filterScope), if any. */
export function tableFilterScope(ctx: Context): TableRef | null {
  const scope = ctx.filterScope;
  if (!scope || scope.sheetId !== ctx.currentSheetId) return null;
  const ref = findTable(ctx, scope.table);
  if (!ref || ref.sheetId !== scope.sheetId || !ref.table.headerRow) {
    return null;
  }
  return ref;
}

/**
 * The filter-menu range of a table: its header row (`str`) to its last
 * data row, and its columns.
 */
export function tableFilterRange(table: SheetTable) {
  const { dataStart, dataEnd } = tableAreas(table);
  return {
    str: dataStart - 1,
    edr: dataEnd,
    stc: table.range.column[0],
    edc: table.range.column[1],
  };
}

/**
 * The table's filters in the shape of the autofilter state (`ctx.filter`),
 * keyed by column offset, for the filter menu.
 */
export function tableFilterEntries(table: SheetTable) {
  const range = tableFilterRange(table);
  const out: Record<string, any> = {};
  _.forEach(table.filters, (f, k) => {
    if (!f) return;
    out[k] = {
      caljs: f.condition,
      rowhidden: f.rowhidden,
      optionstate: true,
      str: range.str,
      edr: range.edr,
      cindex: range.stc + Number(k),
      stc: range.stc,
      edc: range.edc,
    };
  });
  return out;
}

/** The rows a column condition hides (data rows of the table only). */
export function computeTableColumnRows(
  ctx: Context,
  sheetId: string,
  table: SheetTable,
  index: number,
  condition: TableColumnFilter["condition"]
): Record<string, number> {
  const data = sheetOf(ctx, sheetId)?.data;
  const hidden: Record<string, number> = {};
  if (!data) return hidden;
  const { dataStart, dataEnd } = tableAreas(table);
  const c = table.range.column[0] + index;
  if (condition.type === "values") {
    const set = new Set(condition.hidden ?? []);
    for (let r = dataStart; r <= dataEnd; r += 1) {
      if (set.has(tableItemText(data[r]?.[c]))) hidden[r] = 0;
    }
    return hidden;
  }
  // conditions are evaluated on the current sheet's data
  const prev = ctx.currentSheetId;
  ctx.currentSheetId = sheetId;
  try {
    return computeFilterConditionRows(
      ctx,
      c,
      dataStart - 1,
      dataEnd,
      condition as FilterCondition
    );
  } finally {
    ctx.currentSheetId = prev;
  }
}

/**
 * Sets (or with null clears) the filter of column `index` of a table and
 * updates the sheet's hidden rows. `rowhidden` defaults to the rows the
 * condition hides on the current data.
 */
export function setTableColumnFilter(
  ctx: Context,
  tableName: string,
  index: number,
  condition: TableColumnFilter["condition"] | null,
  rowhidden?: Record<string, number>
): boolean {
  const ref = findTable(ctx, tableName);
  if (!ref || index < 0 || index >= ref.table.columns.length) return false;
  const { table, sheetId } = ref;
  const before = tableFilterRows(table);
  const filters = { ...(table.filters ?? {}) };
  if (condition == null) {
    delete filters[index];
  } else {
    filters[index] = {
      condition,
      rowhidden:
        rowhidden ??
        computeTableColumnRows(ctx, sheetId, table, index, condition),
    };
  }
  updateTableObject(ctx, ref, {
    filters: _.isEmpty(filters) ? undefined : filters,
  });
  syncFilterHiddenRows(ctx, sheetId, before);
  if (sheetId === ctx.currentSheetId) refreshFilterFormulas(ctx);
  return true;
}

/**
 * The value texts rows hide: the texts of `rows` that no other data row of
 * the column shows (a value checklist hides whole values).
 */
function hiddenTexts(
  ctx: Context,
  sheetId: string,
  table: SheetTable,
  index: number,
  rows: Record<string, number>
) {
  const data = sheetOf(ctx, sheetId)?.data;
  if (!data) return [];
  const { dataStart, dataEnd } = tableAreas(table);
  const c = table.range.column[0] + index;
  const hidden = new Set<string>();
  const shown = new Set<string>();
  for (let r = dataStart; r <= dataEnd; r += 1) {
    const text = tableItemText(data[r]?.[c]);
    if (r in rows) hidden.add(text);
    else shown.add(text);
  }
  return [...hidden].filter((t) => !shown.has(t));
}

/**
 * saveFilter for a table (the filter menu with a table scope): the
 * checklist result `rowhidden` of column `col` (sheet column).
 */
export function saveTableFilter(
  ctx: Context,
  ref: TableRef,
  optionState: boolean,
  rowhidden: Record<string, number>,
  condition: any,
  col: number
) {
  const index = col - ref.table.range.column[0];
  if (!optionState || (_.isEmpty(rowhidden) && condition?.type === "values")) {
    setTableColumnFilter(ctx, ref.table.name, index, null);
    return;
  }
  let next = condition ?? { type: "values" };
  if (next.type === "values") {
    next = {
      type: "values",
      hidden: hiddenTexts(ctx, ref.sheetId, ref.table, index, rowhidden),
    };
  }
  setTableColumnFilter(ctx, ref.table.name, index, next, rowhidden);
}

/** Removes every filter of a table (the buttons stay). */
export function clearTableFilters(ctx: Context, tableName: string) {
  const ref = findTable(ctx, tableName);
  if (!ref || !ref.table.filters) return false;
  const before = tableFilterRows(ref.table);
  updateTableObject(ctx, ref, { filters: undefined });
  syncFilterHiddenRows(ctx, ref.sheetId, before);
  if (ref.sheetId === ctx.currentSheetId) refreshFilterFormulas(ctx);
  return true;
}

/** Re-runs a table's filters on its current data (Data › Reapply). */
export function reapplyTableFilters(ctx: Context, tableName: string) {
  const ref = findTable(ctx, tableName);
  if (!ref?.table.filters) return false;
  const { table, sheetId } = ref;
  const before = tableFilterRows(table);
  const filters: NonNullable<SheetTable["filters"]> = {};
  _.forEach(table.filters, (f, k) => {
    if (!f) return;
    filters[k] = {
      condition: f.condition,
      rowhidden: computeTableColumnRows(
        ctx,
        sheetId,
        table,
        Number(k),
        f.condition
      ),
    };
  });
  updateTableObject(ctx, ref, { filters });
  syncFilterHiddenRows(ctx, sheetId, before);
  if (sheetId === ctx.currentSheetId) refreshFilterFormulas(ctx);
  return true;
}

/** Shows or hides a table's header filter buttons (off clears its filters). */
export function setTableFilterButton(
  ctx: Context,
  tableName: string,
  on: boolean
) {
  const ref = findTable(ctx, tableName);
  if (!ref) return false;
  if (!on) clearTableFilters(ctx, tableName);
  const fresh = findTable(ctx, tableName)!;
  updateTableObject(ctx, fresh, { filterButton: on });
  return true;
}

/** The table holding the active cell (with a header row), if any. */
export function activeCellTable(ctx: Context): TableRef | null {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return null;
  const r = last.row_focus ?? last.row[0];
  const c = last.column_focus ?? last.column[0];
  const ref = tableAt(ctx, ctx.currentSheetId, r, c);
  return ref && ref.table.headerRow ? ref : null;
}

/* ------------------------------------------------------------------------ */
/* Slicers                                                                  */
/* ------------------------------------------------------------------------ */

export const SLICER_DEFAULTS = {
  width: 180,
  height: 240,
  buttonHeight: 26,
  columnCount: 1,
  style: "SlicerStyleLight1",
};

export type SlicerItem = {
  /** Display text ("" for blanks). */
  text: string;
  /** The item is selected (its rows pass this column's filter). */
  selected: boolean;
  /** Some row of the item passes the other columns' filters. */
  hasData: boolean;
};

function compareItems(a: string, b: string, aNum: number, bNum: number) {
  // blanks last
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  const na = Number.isNaN(aNum);
  const nb = Number.isNaN(bNum);
  if (!na && !nb) return aNum - bNum;
  if (!na) return -1;
  if (!nb) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * The items of a slicer: the unique values of its column, sorted, with
 * their selection and "has data" state (Excel greys out items whose rows
 * all are filtered out by other columns).
 */
export function getSlicerItems(
  ctx: Context,
  sheetId: string,
  table: SheetTable,
  slicer: TableSlicer
): SlicerItem[] {
  const index = table.columns.findIndex(
    (col) => col.name.toUpperCase() === slicer.column.toUpperCase()
  );
  const data = sheetOf(ctx, sheetId)?.data;
  if (index < 0 || !data) return [];
  const c = table.range.column[0] + index;
  const { dataStart, dataEnd } = tableAreas(table);
  const own = table.filters?.[index];
  const others: Record<string, number> = {};
  _.forEach(table.filters, (f, k) => {
    if (f && Number(k) !== index) Object.assign(others, f.rowhidden);
  });
  const items = new Map<
    string,
    { num: number; selected: boolean; hasData: boolean }
  >();
  for (let r = dataStart; r <= dataEnd; r += 1) {
    const cell = data[r]?.[c];
    const text = tableItemText(cell);
    let item = items.get(text);
    if (!item) {
      item = {
        num: typeof cell?.v === "number" ? cell.v : NaN,
        selected: false,
        hasData: false,
      };
      items.set(text, item);
    }
    if (!own || !(r in own.rowhidden)) item.selected = true;
    if (!(r in others)) item.hasData = true;
  }
  const list = [...items.entries()].sort((a, b) =>
    compareItems(a[0], b[0], a[1].num, b[1].num)
  );
  if (slicer.sortOrder === "descending") {
    const blanks = list.filter(([t]) => t === "");
    const rest = list.filter(([t]) => t !== "").reverse();
    list.splice(0, list.length, ...rest, ...blanks);
  }
  let out = list.map(([text, v]) => ({
    text,
    selected: v.selected,
    hasData: v.hasData,
  }));
  if (slicer.hideNoData) out = out.filter((x) => x.hasData);
  else if (slicer.noDataLast !== false) {
    out = [...out.filter((x) => x.hasData), ...out.filter((x) => !x.hasData)];
  }
  return out;
}

export function findSlicer(ctx: Context, name: string) {
  const upper = name.toUpperCase();
  let found: { ref: TableRef; slicer: TableSlicer; index: number } | null =
    null;
  ctx.luckysheetfile.forEach((sheet) => {
    sheet.tables?.forEach((table) => {
      table.slicers?.forEach((slicer) => {
        if (!found && slicer.name.toUpperCase() === upper && sheet.id) {
          found = {
            ref: { sheetId: sheet.id, table },
            slicer,
            index: table.columns.findIndex(
              (col) => col.name.toUpperCase() === slicer.column.toUpperCase()
            ),
          };
        }
      });
    });
  });
  return found as { ref: TableRef; slicer: TableSlicer; index: number } | null;
}

/** A slicer's column filter is active (Clear Filter is enabled). */
export function slicerHasFilter(ctx: Context, name: string) {
  const found = findSlicer(ctx, name);
  return (
    !!found && found.index >= 0 && !!found.ref.table.filters?.[found.index]
  );
}

/**
 * A click on slicer item `text`. `toggle` (multi-select mode or Ctrl+click)
 * adds or removes the item; otherwise only the item is selected. Selecting
 * every item clears the column's filter.
 */
export function selectSlicerItem(
  ctx: Context,
  slicerName: string,
  text: string,
  toggle: boolean
) {
  const found = findSlicer(ctx, slicerName);
  if (!found || found.index < 0) return false;
  const { ref, slicer, index } = found;
  const items = getSlicerItems(ctx, ref.sheetId, ref.table, {
    ...slicer,
    hideNoData: false,
  });
  const all = items.map((x) => x.text);
  if (!all.includes(text)) return false;
  const filtered = !!ref.table.filters?.[index];
  let selected: Set<string>;
  if (toggle && filtered) {
    selected = new Set(items.filter((x) => x.selected).map((x) => x.text));
    if (selected.has(text)) selected.delete(text);
    else selected.add(text);
  } else {
    selected = new Set([text]);
  }
  const hidden = all.filter((t) => !selected.has(t));
  if (selected.size === 0 || hidden.length === 0) {
    return setTableColumnFilter(ctx, ref.table.name, index, null);
  }
  return setTableColumnFilter(ctx, ref.table.name, index, {
    type: "values",
    hidden,
  });
}

/** Selects exactly the items `texts` of a slicer (all: no filter). */
export function setSlicerSelection(
  ctx: Context,
  slicerName: string,
  texts: string[]
) {
  const found = findSlicer(ctx, slicerName);
  if (!found || found.index < 0) return false;
  const { ref, slicer, index } = found;
  const all = getSlicerItems(ctx, ref.sheetId, ref.table, {
    ...slicer,
    hideNoData: false,
  }).map((x) => x.text);
  const wanted = new Set(texts);
  const hidden = all.filter((t) => !wanted.has(t));
  if (hidden.length === 0 || hidden.length === all.length) {
    return setTableColumnFilter(ctx, ref.table.name, index, null);
  }
  return setTableColumnFilter(ctx, ref.table.name, index, {
    type: "values",
    hidden,
  });
}

/** The slicer's Clear Filter button. */
export function clearSlicerFilter(ctx: Context, slicerName: string) {
  const found = findSlicer(ctx, slicerName);
  if (!found || found.index < 0) return false;
  return setTableColumnFilter(ctx, found.ref.table.name, found.index, null);
}

/** Slicer name for a column: `Slicer_Region`, unique in the workbook. */
function slicerBaseName(column: string) {
  const cleaned = column.replace(/[^A-Za-z0-9_.À-￿]+/g, "_");
  return `Slicer_${cleaned || "Column"}`;
}

export type SlicerPlacement = {
  r: number;
  c: number;
  offsetX?: number;
  offsetY?: number;
};

/**
 * Insert › Slicer: one slicer per column name of table `tableName`, laid
 * out from `at` (default: right of the table). Returns the new slicers.
 */
export function addTableSlicers(
  ctx: Context,
  tableName: string,
  columns: string[],
  at?: SlicerPlacement
): TableSlicer[] {
  const ref = findTable(ctx, tableName);
  if (!ref) return [];
  const { table } = ref;
  const taken = new Set<string>();
  const place = at ?? {
    r: table.range.row[0],
    c: table.range.column[1] + 2,
  };
  const created: TableSlicer[] = [];
  columns.forEach((column, i) => {
    const col = table.columns.find(
      (x) => x.name.toUpperCase() === column.toUpperCase()
    );
    if (!col) return;
    const name = uniqueSlicerName(ctx, slicerBaseName(col.name), taken);
    taken.add(name.toUpperCase());
    created.push({
      name,
      column: col.name,
      caption: col.name,
      showCaption: true,
      r: place.r,
      c: place.c,
      // side by side, three per row
      offsetX: (place.offsetX ?? 0) + (i % 3) * (SLICER_DEFAULTS.width + 16),
      offsetY:
        (place.offsetY ?? 0) +
        Math.floor(i / 3) * (SLICER_DEFAULTS.height + 16),
      width: SLICER_DEFAULTS.width,
      height: SLICER_DEFAULTS.height,
      columnCount: SLICER_DEFAULTS.columnCount,
      buttonHeight: SLICER_DEFAULTS.buttonHeight,
      style: SLICER_DEFAULTS.style,
    });
  });
  if (created.length === 0) return [];
  updateTableObject(ctx, ref, {
    slicers: [...(table.slicers ?? []), ...created],
  });
  return created;
}

export type SlicerPatch = Partial<Omit<TableSlicer, "column">>;

/** Changes slicer settings, size or position. */
export function updateSlicer(
  ctx: Context,
  slicerName: string,
  patch: SlicerPatch
): boolean {
  const found = findSlicer(ctx, slicerName);
  if (!found) return false;
  const next: TableSlicer = { ...found.slicer, ...patch };
  if (patch.name != null && patch.name !== found.slicer.name) {
    const clash = findSlicer(ctx, patch.name);
    if (clash || !patch.name.trim()) return false;
  }
  next.width = Math.max(60, Math.round(next.width));
  next.height = Math.max(40, Math.round(next.height));
  if (next.columnCount != null) {
    next.columnCount = Math.min(20, Math.max(1, Math.round(next.columnCount)));
  }
  if (next.buttonHeight != null) {
    next.buttonHeight = Math.min(200, Math.max(12, next.buttonHeight));
  }
  updateTableObject(ctx, found.ref, {
    slicers: found.ref.table.slicers!.map((x) =>
      x === found.slicer ? next : x
    ),
  });
  if (
    ctx.activeSlicer?.name.toUpperCase() === found.slicer.name.toUpperCase()
  ) {
    ctx.activeSlicer = { ...ctx.activeSlicer, name: next.name };
  }
  return true;
}

/**
 * Removes a slicer. Its column filter is cleared unless another slicer
 * filters the same column.
 */
export function removeSlicer(ctx: Context, slicerName: string) {
  const found = findSlicer(ctx, slicerName);
  if (!found) return false;
  const { ref, slicer, index } = found;
  const rest = ref.table.slicers!.filter((x) => x !== slicer);
  updateTableObject(ctx, ref, {
    slicers: rest.length > 0 ? rest : undefined,
  });
  const shared = rest.some(
    (x) => x.column.toUpperCase() === slicer.column.toUpperCase()
  );
  if (!shared && index >= 0 && ref.table.filters?.[index]) {
    setTableColumnFilter(ctx, ref.table.name, index, null);
  }
  if (ctx.activeSlicer?.name.toUpperCase() === slicerName.toUpperCase()) {
    ctx.activeSlicer = undefined;
  }
  return true;
}
