/**
 * PivotTables.
 *
 * A PivotTable is stored on the sheet showing its report
 * (`sheet.pivotTables`): its source (a range with a header row, or a table
 * name), the anchor of the report body, the fields on the Rows / Columns /
 * Values / Filters areas, per-field settings (sorting, label and value
 * filters, hidden items, date grouping, subtotals) and options (layout,
 * subtotals, grand totals, empty-cell text, preserve formatting, auto
 * refresh).
 *
 * `refreshPivotTable` reads the source, groups and aggregates it
 * (`computePivot`) and writes the report into the sheet's cells as ordinary
 * values with pivot styling, so it renders, copies and exports like any
 * other cells. The cells covered are remembered (`output`) together with
 * the layout of the row and column items (`layout`), which GETPIVOTDATA and
 * drill-down read. Cells of a report are protected: the UI refuses edits
 * there (`pivotAt`).
 *
 * Aggregation follows Excel: Count counts non-empty cells, Count Numbers
 * and the numeric functions look at numbers only, StdDev/Var are sample
 * statistics and StdDevp/Varp population ones; totals only include the
 * items left visible by label, value and item filters.
 */
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import type { Context } from "../context";
import type {
  Cell,
  CellMatrix,
  PivotAggregate,
  PivotAxisItem,
  PivotDateGroup,
  PivotFieldSettings,
  PivotLabelFilter,
  PivotLayout,
  PivotOptions,
  PivotSource,
  PivotTable,
  PivotValueField,
  PivotValueFilter,
  Sheet,
} from "../types";
import { generateRandomSheetName, getSheetIndex } from "../utils";
import { pivotLocale, pivotText, PivotLocale } from "../locale/pivot";
import { peek } from "./dependencyGraph";
import { is_date, update as formatWithCode } from "./format";
import { recalculateWorkbook } from "./names";
import { changeSheet, moveSheet } from "./sheet";
import { createTable, findTable, getTables, tableAreas } from "./tables";
import { valueIsError } from "./validation";

type Span = { row: [number, number]; column: [number, number] };

export const PIVOT_VALUES_FIELD = "__values__";

export const PIVOT_AGGREGATES: PivotAggregate[] = [
  "sum",
  "count",
  "average",
  "max",
  "min",
  "product",
  "countNums",
  "stdDev",
  "stdDevp",
  "var",
  "varp",
];

export const PIVOT_DATE_GROUPS: PivotDateGroup[] = [
  "years",
  "quarters",
  "months",
  "days",
];

export const DEFAULT_PIVOT_OPTIONS: PivotOptions = {
  layout: "compact",
  subtotals: "top",
  grandTotalRow: true,
  grandTotalColumn: true,
  preserveFormatting: true,
  autoRefresh: false,
};

/** Header / total fill of the report (Excel's PivotStyleLight16). */
export const PIVOT_HEADER_BG = "#DDEBF7";
/** Fill of an empty PivotTable's placeholder area. */
export const PIVOT_PLACEHOLDER_BG = "#F2F2F2";

export type PivotError =
  | "source"
  | "headers"
  | "location"
  | "overlapPivot"
  | "overlapTable"
  | "replaceData"
  | "notFound";

export type CreatePivotOptions = {
  /** Put the report on a new sheet (default) or at `anchor` of `sheetId`. */
  newSheet?: boolean;
  sheetId?: string;
  anchor?: { r: number; c: number };
  name?: string;
  newSheetId?: string;
  force?: boolean;
};

export type PivotPatch = Partial<
  Pick<
    PivotTable,
    | "name"
    | "rows"
    | "columns"
    | "values"
    | "filters"
    | "fields"
    | "anchor"
    | "rowHeaderCaption"
    | "colHeaderCaption"
    | "source"
  >
> & { options?: Partial<PivotOptions> };

function applyPatch(prev: PivotTable, patch: PivotPatch): PivotTable {
  return {
    ...prev,
    ...patch,
    options: { ...prev.options, ...patch.options },
  } as PivotTable;
}

/* ------------------------------------------------------------------------ */
/* Lookup                                                                   */
/* ------------------------------------------------------------------------ */

function sheetOf(ctx: Context, sheetId: string): Sheet | undefined {
  const i = getSheetIndex(ctx, sheetId);
  return i == null ? undefined : ctx.luckysheetfile[i];
}

export type PivotRef = { sheetId: string; pivot: PivotTable };

/** Every PivotTable of the workbook (or of one sheet). */
export function getPivotTables(ctx: Context, sheetId?: string): PivotRef[] {
  const out: PivotRef[] = [];
  const files = (peek(peek(ctx).luckysheetfile) as Sheet[]) ?? [];
  files.forEach((raw) => {
    const f = peek(raw);
    if (!f?.id || (sheetId != null && f.id !== sheetId)) return;
    (peek(f.pivotTables) ?? []).forEach((p) => {
      out.push({ sheetId: f.id!, pivot: peek(p) });
    });
  });
  return out;
}

export function findPivotTable(
  ctx: Context,
  sheetId: string,
  id: string
): PivotTable | null {
  const sheet = sheetOf(ctx, sheetId);
  return sheet?.pivotTables?.find((p) => p.id === id) ?? null;
}

function inSpan(span: Span | undefined, r: number, c: number) {
  return (
    !!span &&
    r >= span.row[0] &&
    r <= span.row[1] &&
    c >= span.column[0] &&
    c <= span.column[1]
  );
}

function spansOverlap(a: Span, b: Span) {
  return !(
    a.row[1] < b.row[0] ||
    b.row[1] < a.row[0] ||
    a.column[1] < b.column[0] ||
    b.column[1] < a.column[0]
  );
}

/** The PivotTable whose report covers cell (r, c) of a sheet. */
export function pivotAt(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): PivotTable | null {
  return (
    getPivotTables(ctx, sheetId).find((p) => inSpan(p.pivot.output, r, c))
      ?.pivot ?? null
  );
}

/** The PivotTable whose report intersects a range of a sheet. */
export function pivotInRange(
  ctx: Context,
  sheetId: string,
  range: { row: number[]; column: number[] }
): PivotTable | null {
  const span: Span = {
    row: [range.row[0], range.row[1] ?? range.row[0]],
    column: [range.column[0], range.column[1] ?? range.column[0]],
  };
  return (
    getPivotTables(ctx, sheetId).find(
      (p) => p.pivot.output && spansOverlap(p.pivot.output, span)
    )?.pivot ?? null
  );
}

/** First free "PivotTableN" name of the workbook. */
export function nextPivotTableName(ctx: Context) {
  const used = new Set(
    getPivotTables(ctx).map((p) => p.pivot.name.toUpperCase())
  );
  for (let i = 1; ; i += 1) {
    const name = `PivotTable${i}`;
    if (!used.has(name.toUpperCase())) return name;
  }
}

/* ------------------------------------------------------------------------ */
/* Source                                                                   */
/* ------------------------------------------------------------------------ */

export type PivotSourceField = {
  name: string;
  index: number;
  /** Every non-empty value is a number with a date format. */
  isDate: boolean;
  /** Every non-empty value is a number. */
  isNumeric: boolean;
};

export type PivotSourceData = {
  sheetId: string;
  range: Span;
  fields: PivotSourceField[];
  /** Data rows (cells), one per source row under the header. */
  records: (Cell | null)[][];
};

/** The sheet range a source refers to (header row included). */
export function resolvePivotSource(
  ctx: Context,
  source: PivotSource
): { sheetId: string; range: Span } | null {
  if (source.table) {
    const t = findTable(ctx, source.table);
    if (!t) return null;
    const { dataEnd } = tableAreas(t.table);
    const top = t.table.range.row[0];
    return {
      sheetId: t.sheetId,
      range: {
        row: [top, Math.max(top, dataEnd)],
        column: [...t.table.range.column] as [number, number],
      },
    };
  }
  if (!source.sheetId || !source.range) return null;
  if (!sheetOf(ctx, source.sheetId)) return null;
  return { sheetId: source.sheetId, range: source.range };
}

function cellText(cell: Cell | null | undefined): string {
  if (cell?.v == null) return "";
  if (cell.m != null) return String(cell.m);
  return String(cell.v);
}

function isDateCell(cell: Cell | null | undefined) {
  const fa = cell?.ct?.fa;
  if (typeof cell?.v !== "number" || !fa) return false;
  if (cell.ct?.t === "d") return true;
  try {
    return !!is_date(fa);
  } catch {
    return false;
  }
}

function isBlankCell(cell: Cell | null | undefined) {
  return cell?.v == null || cell.v === "";
}

/** Reads the header and data rows of a PivotTable source. */
export function readPivotSource(
  ctx: Context,
  source: PivotSource
): PivotSourceData | { error: PivotError } {
  const resolved = resolvePivotSource(ctx, source);
  if (!resolved) return { error: "source" };
  const sheet = sheetOf(ctx, resolved.sheetId);
  const data = peek(sheet?.data) as CellMatrix | undefined;
  if (!data) return { error: "source" };
  const { row, column } = resolved.range;
  if (
    row[0] < 0 ||
    column[0] < 0 ||
    row[0] >= data.length ||
    column[0] > column[1] ||
    row[0] > row[1]
  ) {
    return { error: "source" };
  }
  const lastRow = Math.min(row[1], data.length - 1);
  const header = peek(data[row[0]]) ?? [];
  const names: string[] = [];
  for (let c = column[0]; c <= column[1]; c += 1) {
    const text = cellText(peek(header[c])).trim();
    if (!text) return { error: "headers" };
    // duplicates get a number, as in Excel ("Sales2")
    const taken = new Set(names.map((x) => x.toUpperCase()));
    let name = text;
    for (let n = 2; taken.has(name.toUpperCase()); n += 1) {
      name = `${text}${n}`;
    }
    names.push(name);
  }
  const records: (Cell | null)[][] = [];
  for (let r = row[0] + 1; r <= lastRow; r += 1) {
    const src = peek(data[r]) ?? [];
    const rec: (Cell | null)[] = [];
    let any = false;
    for (let c = column[0]; c <= column[1]; c += 1) {
      const cell = peek(src[c]) ?? null;
      rec.push(cell);
      if (!isBlankCell(cell)) any = true;
    }
    // trailing empty rows of a whole-column source are not records
    if (any || r < lastRow) records.push(rec);
  }
  while (records.length && records[records.length - 1].every(isBlankCell)) {
    records.pop();
  }
  const fields = names.map((name, index) => {
    let isDate = true;
    let isNumeric = true;
    let seen = false;
    records.forEach((rec) => {
      const cell = rec[index];
      if (isBlankCell(cell)) return;
      seen = true;
      if (typeof cell!.v !== "number") isNumeric = false;
      if (!isDateCell(cell)) isDate = false;
    });
    return {
      name,
      index,
      isDate: seen && isDate,
      isNumeric: seen && isNumeric,
    };
  });
  return { ...resolved, fields, records };
}

/* ------------------------------------------------------------------------ */
/* Items                                                                    */
/* ------------------------------------------------------------------------ */

type Item = {
  key: string;
  label: string;
  /** 0 numbers, 1 text, 2 logicals, 3 errors, 4 blanks */
  rank: number;
  sort: number | string;
  /** The value GETPIVOTDATA and the xlsx cache use. */
  raw: string | number | boolean | null;
};

const BLANK_KEY = "blank";

/** The key identifying an item of a field ("n:5", "s:east", ...). */
export function pivotItemKey(v: unknown): string {
  if (v == null || v === "") return BLANK_KEY;
  if (typeof v === "number") return `n:${v}`;
  if (typeof v === "boolean") return `b:${v ? 1 : 0}`;
  return `s:${String(v).toLowerCase()}`;
}

function itemOfCell(cell: Cell | null | undefined, t: PivotLocale): Item {
  const v = cell?.v;
  if (v == null || v === "") {
    return { key: BLANK_KEY, label: t.blank, rank: 4, sort: 0, raw: null };
  }
  if (typeof v === "number") {
    let label = cell?.m != null ? String(cell.m) : "";
    if (!label) {
      label = cell?.ct?.fa ? String(formatWithCode(cell.ct.fa, v)) : String(v);
    }
    return { key: pivotItemKey(v), label, rank: 0, sort: v, raw: v };
  }
  if (typeof v === "boolean") {
    return {
      key: pivotItemKey(v),
      label: v ? "TRUE" : "FALSE",
      rank: 2,
      sort: v ? 1 : 0,
      raw: v,
    };
  }
  const s = String(v);
  if (valueIsError(s)) {
    return { key: pivotItemKey(s), label: s, rank: 3, sort: s, raw: s };
  }
  return {
    key: pivotItemKey(s),
    label: s,
    rank: 1,
    sort: s.toLowerCase(),
    raw: s,
  };
}

/** Days since 1899-12-30 -> UTC date parts. */
function serialToDate(serial: number) {
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function dateGroupItem(
  cell: Cell | null | undefined,
  group: PivotDateGroup,
  t: PivotLocale
): Item {
  const v = cell?.v;
  if (typeof v !== "number") return itemOfCell(cell, t);
  const { year, month, day } = serialToDate(v);
  switch (group) {
    case "years":
      return {
        key: `y:${year}`,
        label: String(year),
        rank: 0,
        sort: year,
        raw: year,
      };
    case "quarters": {
      const q = Math.ceil(month / 3);
      const label = pivotText(t.quarter, { n: q });
      return { key: `q:${q}`, label, rank: 0, sort: q, raw: label };
    }
    case "months": {
      const label = t.months[month - 1];
      return { key: `m:${month}`, label, rank: 0, sort: month, raw: label };
    }
    default: {
      const label = `${day}-${t.months[month - 1]}`;
      return {
        key: `d:${month * 100 + day}`,
        label,
        rank: 0,
        sort: month * 100 + day,
        raw: label,
      };
    }
  }
}

function compareItems(a: Item, b: Item) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.sort < b.sort) return -1;
  if (a.sort > b.sort) return 1;
  return 0;
}

/* ------------------------------------------------------------------------ */
/* Levels (fields on an axis)                                               */
/* ------------------------------------------------------------------------ */

export type PivotLevel = {
  /** Axis entry: a field name or `Field|years`. */
  id: string;
  /** Source field index. */
  field: number;
  group?: PivotDateGroup;
  /** Caption: the field name or "Years (Date)". */
  name: string;
};

function splitLevelId(id: string): [string, PivotDateGroup | undefined] {
  const bar = id.lastIndexOf("|");
  if (bar > 0) {
    const g = id.slice(bar + 1) as PivotDateGroup;
    if (PIVOT_DATE_GROUPS.includes(g)) return [id.slice(0, bar), g];
  }
  return [id, undefined];
}

function fieldIndexOf(fields: PivotSourceField[], name: string) {
  const upper = name.toUpperCase();
  return fields.findIndex((f) => f.name.toUpperCase() === upper);
}

function settingsOf(pivot: PivotTable, id: string): PivotFieldSettings {
  return pivot.fields?.[id] ?? {};
}

function finestGroup(groups: PivotDateGroup[] | undefined) {
  if (!groups?.length) return undefined;
  return _.maxBy(groups, (g) => PIVOT_DATE_GROUPS.indexOf(g));
}

/** Resolves an axis entry into a level, or null for unknown fields. */
export function resolvePivotLevel(
  pivot: PivotTable,
  fields: PivotSourceField[],
  id: string,
  t: PivotLocale
): PivotLevel | null {
  const [fieldName, group] = splitLevelId(id);
  const field = fieldIndexOf(fields, fieldName);
  if (field < 0) return null;
  const { name } = fields[field];
  if (group) {
    return {
      id,
      field,
      group,
      name: pivotText(t.dateGroupField, { group: t.dateGroups[group], name }),
    };
  }
  return {
    id,
    field,
    group: finestGroup(settingsOf(pivot, fieldName).dateGroups),
    name,
  };
}

function levelItem(level: PivotLevel, rec: (Cell | null)[], t: PivotLocale) {
  const cell = rec[level.field];
  return level.group
    ? dateGroupItem(cell, level.group, t)
    : itemOfCell(cell, t);
}

/** Item keys of a source field (the filter lists of the Fields pane). */
export function pivotFieldItems(
  ctx: Context,
  pivot: PivotTable,
  id: string
): { key: string; label: string }[] {
  const t = pivotLocale(ctx);
  const src = readPivotSource(ctx, pivot.source);
  if ("error" in src) return [];
  const level = resolvePivotLevel(pivot, src.fields, id, t);
  if (!level) return [];
  const map = new Map<string, Item>();
  src.records.forEach((rec) => {
    const item = levelItem(level, rec, t);
    if (!map.has(item.key)) map.set(item.key, item);
  });
  return [...map.values()]
    .sort(compareItems)
    .map((i) => ({ key: i.key, label: i.label }));
}

/* ------------------------------------------------------------------------ */
/* Aggregation                                                              */
/* ------------------------------------------------------------------------ */

type Acc = {
  count: number;
  n: number;
  sum: number;
  product: number;
  min: number;
  max: number;
  mean: number;
  m2: number;
  err?: string;
};

function newAcc(): Acc {
  return {
    count: 0,
    n: 0,
    sum: 0,
    product: 1,
    min: Infinity,
    max: -Infinity,
    mean: 0,
    m2: 0,
  };
}

function addValue(acc: Acc, cell: Cell | null | undefined) {
  const v = cell?.v;
  if (v == null || v === "") return;
  acc.count += 1;
  if (typeof v === "number") {
    acc.n += 1;
    acc.sum += v;
    acc.product *= v;
    if (v < acc.min) acc.min = v;
    if (v > acc.max) acc.max = v;
    const delta = v - acc.mean;
    acc.mean += delta / acc.n;
    acc.m2 += delta * (v - acc.mean);
  } else if (typeof v === "string" && valueIsError(v) && acc.err == null) {
    acc.err = v;
  }
}

/** The aggregate of an accumulator: a number, an error text or null. */
function finishAcc(
  acc: Acc | undefined,
  aggregate: PivotAggregate
): number | string | null {
  if (!acc || acc.count === 0) return null;
  if (aggregate === "count") return acc.count;
  if (aggregate === "countNums") return acc.n;
  if (acc.err) return acc.err;
  const { n } = acc;
  switch (aggregate) {
    case "sum":
      return acc.sum;
    case "average":
      return n ? acc.sum / n : "#DIV/0!";
    case "max":
      return n ? acc.max : 0;
    case "min":
      return n ? acc.min : 0;
    case "product":
      return n ? acc.product : 0;
    case "stdDev":
      return n > 1 ? Math.sqrt(acc.m2 / (n - 1)) : "#DIV/0!";
    case "stdDevp":
      return n > 0 ? Math.sqrt(acc.m2 / n) : "#DIV/0!";
    case "var":
      return n > 1 ? acc.m2 / (n - 1) : "#DIV/0!";
    case "varp":
      return n > 0 ? acc.m2 / n : "#DIV/0!";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Computation                                                              */
/* ------------------------------------------------------------------------ */

type Node = {
  item: Item;
  key: string;
  children: Map<string, Node>;
  order: number;
};

type Tree = { children: Map<string, Node> };

type Built = {
  rowTree: Tree;
  colTree: Tree;
  /** `${rowPrefix}\u0002${colPrefix}` -> accumulators per value field */
  accs: Map<string, Acc[]>;
};

const SEP = "\u0001";
const AXIS_SEP = "\u0002";

function prefixKeys(keys: string[]) {
  const out = [""];
  let cur = "";
  keys.forEach((k, i) => {
    cur = i === 0 ? k : `${cur}${SEP}${k}`;
    out.push(cur);
  });
  return out;
}

type RecordKeys = { row: Item[]; col: Item[] };

function build(
  records: (Cell | null)[][],
  keys: RecordKeys[],
  values: { field: number }[]
): Built {
  const rowTree: Tree = { children: new Map() };
  const colTree: Tree = { children: new Map() };
  const accs = new Map<string, Acc[]>();
  let order = 0;
  const insert = (tree: Tree, items: Item[]) => {
    let node: Tree = tree;
    items.forEach((item) => {
      let child = node.children.get(item.key);
      if (!child) {
        child = { item, key: item.key, children: new Map(), order };
        order += 1;
        node.children.set(item.key, child);
      }
      node = child;
    });
  };
  records.forEach((rec, i) => {
    const { row, col } = keys[i];
    insert(rowTree, row);
    insert(colTree, col);
    const rp = prefixKeys(row.map((it) => it.key));
    const cp = prefixKeys(col.map((it) => it.key));
    rp.forEach((a) => {
      cp.forEach((b) => {
        const k = `${a}${AXIS_SEP}${b}`;
        let list = accs.get(k);
        if (!list) {
          list = values.map(() => newAcc());
          accs.set(k, list);
        }
        values.forEach((v, vi) => addValue(list![vi], rec[v.field]));
      });
    });
  });
  return { rowTree, colTree, accs };
}

function matchesLabelFilter(label: string, f: PivotLabelFilter) {
  const a = label.toLowerCase();
  const b = String(f.value ?? "").toLowerCase();
  const num = Number(label);
  const bn = Number(f.value);
  const numeric = label !== "" && !Number.isNaN(num) && !Number.isNaN(bn);
  switch (f.op) {
    case "equals":
      return a === b;
    case "notEquals":
      return a !== b;
    case "beginsWith":
      return a.startsWith(b);
    case "endsWith":
      return a.endsWith(b);
    case "contains":
      return a.includes(b);
    case "notContains":
      return !a.includes(b);
    case "greaterThan":
      return numeric ? num > bn : a > b;
    case "lessThan":
      return numeric ? num < bn : a < b;
    case "between": {
      const c = String(f.value2 ?? "").toLowerCase();
      const cn = Number(f.value2);
      if (numeric && !Number.isNaN(cn)) return num >= bn && num <= cn;
      return a >= b && a <= c;
    }
    default:
      return true;
  }
}

function matchesValueFilter(v: number | string | null, f: PivotValueFilter) {
  const x = typeof v === "number" ? v : NaN;
  switch (f.op) {
    case "greaterThan":
      return x > f.value;
    case "greaterOrEqual":
      return x >= f.value;
    case "lessThan":
      return x < f.value;
    case "lessOrEqual":
      return x <= f.value;
    case "equals":
      return x === f.value;
    case "notEquals":
      return x !== f.value;
    case "between":
      return x >= f.value && x <= (f.value2 ?? f.value);
    default:
      return true;
  }
}

export type PivotComputed = {
  source: PivotSourceData;
  rowLevels: PivotLevel[];
  colLevels: PivotLevel[];
  values: (PivotValueField & { index: number; caption: string })[];
  /** Records left after filters, with their row / column items. */
  records: (Cell | null)[][];
  keys: RecordKeys[];
  built: Built;
  valuesAxis: "rows" | "columns" | null;
};

/** Caption of a value field ("Sum of Sales" or its custom name). */
export function pivotValueCaption(ctx: Context, v: PivotValueField) {
  if (v.name) return v.name;
  const t = pivotLocale(ctx);
  return pivotText(t.captions[v.aggregate] ?? t.captions.sum, {
    name: v.field,
  });
}

function sortedChildren(
  node: Tree,
  settings: PivotFieldSettings,
  total: (n: Node) => number | string | null
) {
  const list = [...node.children.values()];
  const sort = settings.sort ?? "asc";
  if (settings.sortByValue != null) {
    const dir = sort === "desc" ? -1 : 1;
    const num = (n: Node) => {
      const v = total(n);
      return typeof v === "number" ? v : -Infinity;
    };
    return list.sort(
      (a, b) => dir * (num(a) - num(b)) || compareItems(a.item, b.item)
    );
  }
  if (sort === "none") return list.sort((a, b) => a.order - b.order);
  list.sort((a, b) => compareItems(a.item, b.item));
  if (sort === "desc") list.reverse();
  return list;
}

/**
 * Groups and aggregates a PivotTable's source. Filters (report filters,
 * hidden items, label and value filters) are applied; the result's
 * accumulators only contain the visible records.
 */
export function computePivot(
  ctx: Context,
  pivot: PivotTable
): PivotComputed | { error: PivotError } {
  const t = pivotLocale(ctx);
  const source = readPivotSource(ctx, pivot.source);
  if ("error" in source) return source;
  const { fields } = source;
  const levelsOf = (ids: string[]) =>
    ids
      .map((id) => resolvePivotLevel(pivot, fields, id, t))
      .filter((l): l is PivotLevel => l != null);
  const rowLevels = levelsOf(pivot.rows);
  const colLevels = levelsOf(pivot.columns);
  const values = pivot.values
    .map((v, index) => ({
      ...v,
      index,
      caption: pivotValueCaption(ctx, v),
      fieldIndex: fieldIndexOf(fields, v.field),
    }))
    .filter((v) => v.fieldIndex >= 0);
  const valueCols = values.map((v) => ({ field: v.fieldIndex }));

  // report filters and hidden items
  const filterChecks = pivot.filters
    .map((f) => {
      const level = resolvePivotLevel(pivot, fields, f.field, t);
      if (!level || f.selected == null) return null;
      const set = new Set(f.selected);
      return (rec: (Cell | null)[]) => set.has(levelItem(level, rec, t).key);
    })
    .filter(Boolean) as ((rec: (Cell | null)[]) => boolean)[];
  const hidden = (levels: PivotLevel[]) =>
    levels.map((l) => {
      const list = settingsOf(pivot, l.id).hiddenItems;
      return list?.length ? new Set(list) : null;
    });
  const rowHidden = hidden(rowLevels);
  const colHidden = hidden(colLevels);

  let records: (Cell | null)[][] = [];
  let keys: RecordKeys[] = [];
  source.records.forEach((rec) => {
    if (!filterChecks.every((f) => f(rec))) return;
    const row = rowLevels.map((l) => levelItem(l, rec, t));
    if (row.some((it, i) => rowHidden[i]?.has(it.key))) return;
    const col = colLevels.map((l) => levelItem(l, rec, t));
    if (col.some((it, i) => colHidden[i]?.has(it.key))) return;
    records.push(rec);
    keys.push({ row, col });
  });

  let built = build(records, keys, valueCols);

  // label and value filters hide items (and their records)
  const excluded = new Set<string>();
  const applyFilters = (
    tree: Tree,
    levels: PivotLevel[],
    axis: "row" | "col"
  ) => {
    const walk = (node: Tree, depth: number, prefix: string[]) => {
      if (depth >= levels.length) return;
      const s = settingsOf(pivot, levels[depth].id);
      const children = [...node.children.values()];
      let visible = children;
      if (s.labelFilter) {
        visible = visible.filter((n) =>
          matchesLabelFilter(n.item.label, s.labelFilter!)
        );
      }
      const vf = s.valueFilter;
      if (vf && values[vf.valueIndex]) {
        const totalOf = (n: Node) => {
          const p = prefixKeys([...prefix, n.key]).pop()!;
          const k = axis === "row" ? `${p}${AXIS_SEP}` : `${AXIS_SEP}${p}`;
          return finishAcc(
            built.accs.get(k)?.[vf.valueIndex],
            values[vf.valueIndex].aggregate
          );
        };
        if (vf.op === "top" || vf.op === "bottom") {
          const ranked = visible
            .map((n) => ({ n, v: totalOf(n) }))
            .filter((x) => typeof x.v === "number")
            .sort((a, b) => (b.v as number) - (a.v as number));
          if (vf.op === "bottom") ranked.reverse();
          const keep = new Set(
            ranked.slice(0, Math.max(0, vf.value)).map((x) => x.n)
          );
          visible = visible.filter((n) => keep.has(n));
        } else {
          visible = visible.filter((n) => matchesValueFilter(totalOf(n), vf));
        }
      }
      const keep = new Set(visible);
      children.forEach((n) => {
        const path = [...prefix, n.key];
        if (!keep.has(n)) excluded.add(`${axis}:${path.join(SEP)}`);
        else walk(n, depth + 1, path);
      });
    };
    walk(tree, 0, []);
  };
  applyFilters(built.rowTree, rowLevels, "row");
  applyFilters(built.colTree, colLevels, "col");
  if (excluded.size > 0) {
    const isExcluded = (axis: string, items: Item[]) => {
      let cur = "";
      return items.some((it, i) => {
        cur = i === 0 ? it.key : `${cur}${SEP}${it.key}`;
        return excluded.has(`${axis}:${cur}`);
      });
    };
    const nextRecords: (Cell | null)[][] = [];
    const nextKeys: RecordKeys[] = [];
    records.forEach((rec, i) => {
      if (isExcluded("row", keys[i].row) || isExcluded("col", keys[i].col))
        return;
      nextRecords.push(rec);
      nextKeys.push(keys[i]);
    });
    records = nextRecords;
    keys = nextKeys;
    built = build(records, keys, valueCols);
  }

  let valuesAxis: "rows" | "columns" | null = null;
  if (values.length > 1)
    valuesAxis = pivot.options.valuesOnRows ? "rows" : "columns";
  return {
    source,
    rowLevels,
    colLevels,
    values,
    records,
    keys,
    built,
    valuesAxis,
  };
}

/* ------------------------------------------------------------------------ */
/* Axis items                                                               */
/* ------------------------------------------------------------------------ */

type AxisEntry = PivotAxisItem & {
  /** Item labels along the path. */
  labels: string[];
};

function aggregateAt(
  comp: PivotComputed,
  rowPath: string[],
  colPath: string[],
  valueIndex: number
) {
  const rp = rowPath.join(SEP);
  const cp = colPath.join(SEP);
  const v = comp.values[valueIndex];
  if (!v) return null;
  return finishAcc(
    comp.built.accs.get(`${rp}${AXIS_SEP}${cp}`)?.[valueIndex],
    v.aggregate
  );
}

function emitAxis(
  comp: PivotComputed,
  pivot: PivotTable,
  axis: "row" | "col"
): AxisEntry[] {
  const levels = axis === "row" ? comp.rowLevels : comp.colLevels;
  const tree = axis === "row" ? comp.built.rowTree : comp.built.colTree;
  const withValues = comp.valuesAxis === (axis === "row" ? "rows" : "columns");
  const { layout, subtotals } = pivot.options;
  const tabular = axis === "row" && layout === "tabular";
  const out: AxisEntry[] = [];
  const valueCount = comp.values.length;
  const sortIndex = (s: PivotFieldSettings) =>
    s.sortByValue != null && comp.values[s.sortByValue] ? s.sortByValue : 0;

  const emitValues = (t: PivotAxisItem["t"], p: string[], labels: string[]) => {
    for (let v = 0; v < valueCount; v += 1) {
      out.push({ t, p, v, labels: [...labels, comp.values[v].caption] });
    }
  };

  const walk = (node: Tree, depth: number, p: string[], labels: string[]) => {
    const level = levels[depth];
    const settings = settingsOf(pivot, level.id);
    const idx = sortIndex(settings);
    const total = (n: Node) =>
      axis === "row"
        ? aggregateAt(comp, [...p, n.key], [], idx)
        : aggregateAt(comp, [], [...p, n.key], idx);
    sortedChildren(node, settings, total).forEach((n) => {
      const path = [...p, n.key];
      const lab = [...labels, n.item.label];
      const last = depth === levels.length - 1;
      if (last) {
        if (withValues) {
          if (axis === "row") out.push({ t: "label", p: path, labels: lab });
          emitValues("item", path, lab);
        } else {
          out.push({ t: "item", p: path, labels: lab });
        }
        return;
      }
      const sub = settings.subtotal !== false && subtotals !== "off";
      if (axis === "row" && !tabular) {
        const top = sub && subtotals === "top" && !withValues;
        out.push({ t: top ? "item" : "label", p: path, labels: lab });
      }
      walk(n, depth + 1, path, lab);
      const bottom =
        sub && (axis === "col" || tabular || subtotals === "bottom");
      if (bottom) {
        if (withValues) emitValues("subtotal", path, lab);
        else out.push({ t: "subtotal", p: path, labels: lab });
      }
    });
  };

  if (levels.length === 0) {
    if (withValues) emitValues("item", [], []);
    else out.push({ t: "item", p: [], labels: [] });
    return out;
  }
  walk(tree, 0, [], []);
  const grand =
    axis === "row"
      ? pivot.options.grandTotalRow
      : pivot.options.grandTotalColumn;
  if (grand) {
    if (withValues) emitValues("grand", [], []);
    else out.push({ t: "grand", p: [], labels: [] });
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Report                                                                   */
/* ------------------------------------------------------------------------ */

export type PivotReportCell = {
  v: string | number | boolean | null;
  /** Number format of the value (value cells). */
  fa?: string;
  bold?: boolean;
  bg?: string;
  /** Indent level (compact layout). */
  indent?: number;
  /** Left-aligned (labels). */
  left?: boolean;
};

export type PivotReport = {
  /** Body cells, starting at the anchor. */
  cells: (PivotReportCell | null)[][];
  /** Report filter rows (field name, selection), placed above the body. */
  filters: [string, string][];
  layout: Omit<PivotLayout, "row" | "col">;
};

function valueFormat(v: PivotValueField) {
  if (v.numberFormat) return v.numberFormat;
  if (v.showAs && v.showAs.startsWith("percent")) return "0.00%";
  return "General";
}

function showAsValue(
  comp: PivotComputed,
  pivot: PivotTable,
  row: PivotAxisItem,
  col: PivotAxisItem,
  vi: number,
  raw: number | string | null
): number | string | null {
  const v = comp.values[vi];
  const mode = v.showAs ?? "normal";
  if (mode === "normal" || raw == null) return raw;
  if (typeof raw !== "number") return raw;
  const ratio = (d: number | string | null) => {
    if (typeof d !== "number") return typeof d === "string" ? d : null;
    return d === 0 ? "#DIV/0!" : raw / d;
  };
  switch (mode) {
    case "percentOfGrandTotal":
      return ratio(aggregateAt(comp, [], [], vi));
    case "percentOfColumnTotal":
      return ratio(aggregateAt(comp, [], col.p, vi));
    case "percentOfRowTotal":
      return ratio(aggregateAt(comp, row.p, [], vi));
    default: {
      // difference from a base item of a row or column field
      const base = v.baseField ?? "";
      const rowAt = comp.rowLevels.findIndex(
        (l) => l.id.toUpperCase() === base.toUpperCase()
      );
      const colAt = comp.colLevels.findIndex(
        (l) => l.id.toUpperCase() === base.toUpperCase()
      );
      const onRow = rowAt >= 0;
      const at = onRow ? rowAt : colAt;
      if (at < 0) return "#N/A";
      const path = onRow ? row.p : col.p;
      if (path.length <= at) return null;
      const tree = onRow ? comp.built.rowTree : comp.built.colTree;
      let node: Tree | undefined = tree;
      for (let i = 0; i < at && node; i += 1) node = node.children.get(path[i]);
      if (!node) return null;
      const levels = onRow ? comp.rowLevels : comp.colLevels;
      const siblings = sortedChildren(
        node,
        settingsOf(pivot, levels[at].id),
        () => 0
      );
      const cur = siblings.findIndex((n) => n.key === path[at]);
      let baseKey: string | undefined;
      const t = v.baseItem ?? "(previous)";
      if (t === "(previous)" || t === "(next)") {
        const j = cur + (t === "(previous)" ? -1 : 1);
        if (j < 0 || j >= siblings.length) return null;
        baseKey = siblings[j].key;
      } else {
        baseKey = siblings.find(
          (n) => n.item.label.toLowerCase() === t.toLowerCase()
        )?.key;
        if (!baseKey) return "#N/A";
      }
      if (baseKey === path[at]) return null;
      const basePath = [...path];
      basePath[at] = baseKey;
      const other = onRow
        ? aggregateAt(comp, basePath, col.p, vi)
        : aggregateAt(comp, row.p, basePath, vi);
      if (other == null) return null;
      if (typeof other !== "number") return other;
      if (mode === "difference") return raw - other;
      return other === 0 ? "#DIV/0!" : (raw - other) / other;
    }
  }
}

/** Lays out a computed PivotTable (without writing it). */
export function buildPivotReport(
  ctx: Context,
  pivot: PivotTable,
  comp: PivotComputed
): PivotReport {
  const t = pivotLocale(ctx);
  const { layout: layoutMode, emptyText } = pivot.options;
  const compact = layoutMode === "compact";
  const rowItems = emitAxis(comp, pivot, "row");
  const colItems = emitAxis(comp, pivot, "col");
  const V = comp.values.length;
  const rowAxisLevels =
    comp.rowLevels.length + (comp.valuesAxis === "rows" ? 1 : 0);
  const colAxisLevels =
    comp.colLevels.length + (comp.valuesAxis === "columns" ? 1 : 0);
  // Σ Values alone on the columns needs no extra header rows
  const hasColAxis = comp.colLevels.length > 0;
  const hasRowAxis = rowAxisLevels > 0;
  if (!hasRowAxis && !hasColAxis && V === 0) {
    // an empty PivotTable: Excel's placeholder area
    const cells: (PivotReportCell | null)[][] = _.times(18, () =>
      _.times(3, () => ({ v: null, bg: PIVOT_PLACEHOLDER_BG }))
    );
    cells[0][0] = {
      v: pivot.name,
      bold: true,
      bg: PIVOT_PLACEHOLDER_BG,
      left: true,
    };
    cells[2][0] = { v: t.placeholder, bg: PIVOT_PLACEHOLDER_BG, left: true };
    return {
      cells,
      filters: [],
      layout: {
        headerRows: 0,
        labelCols: 0,
        rowLevels: [],
        colLevels: [],
        rowItems: [],
        colItems: [],
        labels: {},
      },
    };
  }
  let labelCols = compact ? 1 : Math.max(1, rowAxisLevels);
  if (!hasRowAxis && !hasColAxis) labelCols = 0;
  const headerRows = hasColAxis ? 1 + colAxisLevels : 1;
  const dataCols = V === 0 && !hasColAxis ? 0 : colItems.length;
  const width = Math.max(1, labelCols + dataCols);
  const height = headerRows + (V === 0 && !hasRowAxis ? 0 : rowItems.length);
  const cells: (PivotReportCell | null)[][] = _.times(height, () =>
    _.times(width, () => null)
  );
  const put = (r: number, c: number, cell: PivotReportCell) => {
    if (r < height && c < width) cells[r][c] = { ...cells[r][c], ...cell };
  };
  const rowLevelNames = [
    ...comp.rowLevels.map((l) => l.name),
    ...(comp.valuesAxis === "rows" ? [t.values] : []),
  ];
  const colLevelNames = [
    ...comp.colLevels.map((l) => l.name),
    ...(comp.valuesAxis === "columns" ? [t.values] : []),
  ];
  const rowCaption = pivot.rowHeaderCaption || t.rowLabels;
  const colCaption = pivot.colHeaderCaption || t.columnLabels;
  const single = V === 1 ? comp.values[0].caption : "";

  // header rows
  for (let c = 0; c < width; c += 1) {
    for (let r = 0; r < headerRows; r += 1)
      put(r, c, { v: null, bold: true, bg: PIVOT_HEADER_BG });
  }
  if (hasColAxis) {
    if (labelCols > 0) put(0, 0, { v: single || null, bold: true, left: true });
    if (compact) {
      put(0, labelCols, { v: colCaption, left: true });
    } else {
      colLevelNames.forEach((name, i) =>
        put(0, labelCols + i, { v: name, left: true })
      );
    }
    const lastHeader = headerRows - 1;
    if (hasRowAxis) {
      if (compact) put(lastHeader, 0, { v: rowCaption, left: true });
      else
        rowLevelNames.forEach((name, i) =>
          put(lastHeader, i, { v: name, left: true })
        );
    }
    // column item labels
    colItems.forEach((item, j) => {
      const c = labelCols + j;
      const prev = colItems[j - 1];
      if (item.t === "grand") {
        const label =
          item.v != null
            ? pivotText(t.totalOf, { name: comp.values[item.v].caption })
            : t.grandTotal;
        put(1, c, { v: label, left: true });
        return;
      }
      if (item.t === "subtotal") {
        const d = item.p.length - 1;
        const itemLabel = item.labels[d];
        const label =
          item.v != null
            ? pivotText(t.itemValueTotal, {
                item: itemLabel,
                name: comp.values[item.v].caption,
              })
            : pivotText(t.itemTotal, { item: itemLabel });
        put(1 + d, c, { v: label, left: true });
        return;
      }
      for (let l = 0; l < item.labels.length; l += 1) {
        // an item's label shows on the first column of its group; value
        // captions (Σ Values) show on every column
        const show =
          l >= item.p.length ||
          !prev ||
          prev.t !== "item" ||
          !_.isEqual(prev.p.slice(0, l + 1), item.p.slice(0, l + 1));
        if (show) put(1 + l, c, { v: item.labels[l], left: true });
      }
    });
  } else {
    // one header row: row captions + value captions
    if (hasRowAxis) {
      if (compact) put(0, 0, { v: rowCaption, left: true });
      else
        rowLevelNames.forEach((name, i) => put(0, i, { v: name, left: true }));
    }
    if (V > 0 && comp.valuesAxis !== "rows") {
      colItems.forEach((item, j) => {
        const vi = item.v ?? 0;
        put(0, labelCols + j, {
          v: comp.values[vi]?.caption ?? null,
          left: false,
        });
      });
    }
  }

  // rows
  let prevLabels: string[] = [];
  rowItems.forEach((item, i) => {
    const r = headerRows + i;
    const isTotal = item.t === "grand";
    const bold = item.t !== "item" || item.p.length < comp.rowLevels.length;
    if (!hasRowAxis) {
      if (labelCols > 0)
        put(r, 0, { v: single || null, left: true, bold: false });
    } else if (item.t === "grand") {
      const label =
        item.v != null
          ? pivotText(t.totalOf, { name: comp.values[item.v].caption })
          : t.grandTotal;
      put(r, 0, { v: label, left: true, bold: true });
    } else if (item.t === "subtotal") {
      const d = item.p.length - 1;
      const itemLabel = item.labels[d];
      const label =
        item.v != null
          ? pivotText(t.itemValueTotal, {
              item: itemLabel,
              name: comp.values[item.v].caption,
            })
          : pivotText(t.itemTotal, { item: itemLabel });
      put(r, compact ? 0 : d, {
        v: label,
        left: true,
        bold: true,
        indent: compact ? d : undefined,
      });
    } else {
      const depth = item.labels.length;
      const deepest = depth - 1;
      if (compact || layoutMode === "outline") {
        const col = compact ? 0 : deepest;
        put(r, col, {
          v: item.labels[deepest] ?? null,
          left: true,
          bold: item.t === "label" || depth < rowAxisLevels,
          indent: compact ? deepest : undefined,
        });
        if (!compact && pivot.options.repeatLabels) {
          for (let l = 0; l < deepest; l += 1)
            put(r, l, { v: item.labels[l], left: true });
        }
      } else {
        // tabular: ancestors' labels on the first row of their group
        for (let l = 0; l < depth; l += 1) {
          const changed =
            pivot.options.repeatLabels ||
            !_.isEqual(
              prevLabels.slice(0, l + 1),
              item.labels.slice(0, l + 1)
            ) ||
            l === deepest;
          if (changed)
            put(r, l, { v: item.labels[l], left: true, bold: l < deepest });
        }
      }
      prevLabels = item.labels;
    }
    // values
    if (item.t === "label") {
      for (let c = labelCols; c < width; c += 1)
        put(r, c, { v: null, bold: true });
      return;
    }
    colItems.forEach((col, j) => {
      const vi = item.v ?? col.v ?? 0;
      if (!comp.values[vi]) return;
      const raw = aggregateAt(comp, item.p, col.p, vi);
      const shown = showAsValue(comp, pivot, item, col, vi, raw);
      const empty = shown == null;
      put(r, labelCols + j, {
        v: empty ? emptyText || null : shown,
        fa: valueFormat(comp.values[vi]),
        bold: bold || col.t === "subtotal",
      });
    });
    if (isTotal) {
      for (let c = 0; c < width; c += 1)
        put(r, c, {
          v: cells[r][c]?.v ?? null,
          bg: PIVOT_HEADER_BG,
          bold: true,
        });
    }
  });

  // report filters
  const filters: [string, string][] = pivot.filters.map((f) => {
    const level = resolvePivotLevel(pivot, comp.source.fields, f.field, t);
    const name = level?.name ?? f.field;
    if (f.selected == null) return [name, t.all];
    if (f.selected.length === 1 && level) {
      const rec = comp.source.records.find(
        (x) => levelItem(level, x, t).key === f.selected![0]
      );
      return [name, rec ? levelItem(level, rec, t).label : t.all];
    }
    return [name, t.multipleItems];
  });

  const labels: Record<string, Record<string, string>> = {};
  const collect = (items: AxisEntry[], prefix: string) => {
    items.forEach((it) => {
      it.p.forEach((k, l) => {
        const key = `${prefix}${l}`;
        labels[key] ??= {};
        labels[key][k] = it.labels[l];
      });
    });
  };
  collect(rowItems, "r");
  collect(colItems, "c");
  const strip = (items: AxisEntry[]): PivotAxisItem[] =>
    items.map(({ t: kind, p, v }) =>
      v == null ? { t: kind, p } : { t: kind, p, v }
    );
  return {
    cells,
    filters,
    layout: {
      headerRows,
      labelCols,
      rowLevels: comp.rowLevels.map((l) => l.id),
      colLevels: comp.colLevels.map((l) => l.id),
      rowItems: strip(rowItems),
      colItems: V === 0 && !hasColAxis ? [] : strip(colItems),
      labels,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Writing the report                                                       */
/* ------------------------------------------------------------------------ */

const PIVOT_STYLE_KEYS = ["bl", "bg", "ind", "ht"] as const;

/** Removes a report's content from a cell (user formatting may stay). */
function clearPivotCell(cell: Cell | null | undefined, preserve: boolean) {
  if (!cell || !preserve) return null;
  const next: Cell = { ...cell };
  delete next.v;
  delete next.m;
  delete next.f;
  const marks = cell.pvs ?? {};
  PIVOT_STYLE_KEYS.forEach((k) => {
    if (k in marks && (next as any)[k] === marks[k]) delete (next as any)[k];
  });
  if (cell.ct) {
    const userFa = marks.fa !== undefined && cell.ct.fa !== marks.fa;
    if (userFa) next.ct = { fa: cell.ct.fa, t: "n" };
    else delete next.ct;
  }
  delete next.pvs;
  return Object.keys(next).length ? next : null;
}

function writePivotCell(
  base: Cell | null,
  rc: PivotReportCell | null
): Cell | null {
  if (!rc && !base) return null;
  const cell: Cell = { ...(base ?? {}) };
  const marks: Record<string, any> = {};
  const style = (key: string, value: any) => {
    if (value == null) return;
    if (key in cell) return; // user formatting wins (preserve formatting)
    (cell as any)[key] = value;
    marks[key] = value;
  };
  if (rc) {
    if (rc.bold) style("bl", 1);
    if (rc.bg) style("bg", rc.bg);
    if (rc.indent) {
      style("ind", rc.indent);
    }
    if (rc.left || rc.indent) style("ht", 1);
    const { v } = rc;
    if (v != null && v !== "") {
      if (typeof v === "number") {
        const userFa = base?.ct?.fa;
        const fa = userFa || rc.fa || "General";
        if (!userFa) marks.fa = fa;
        cell.ct = { fa, t: "n" };
        cell.v = v;
        cell.m = String(formatWithCode(fa, v));
      } else if (typeof v === "boolean") {
        cell.v = v;
        cell.m = v ? "TRUE" : "FALSE";
        cell.ct = { fa: "General", t: "b" };
        marks.fa = "General";
      } else {
        cell.v = v;
        cell.m = v;
        cell.ct = { fa: base?.ct?.fa || "General", t: "g" };
        if (!base?.ct?.fa) marks.fa = "General";
      }
    }
  }
  if (Object.keys(marks).length) cell.pvs = marks;
  return Object.keys(cell).length ? cell : null;
}

function ensureSize(sheet: Sheet, rows: number, cols: number) {
  const data = sheet.data!;
  const curCols = data[0]?.length ?? 0;
  if (cols > curCols) {
    data.forEach((row) => {
      for (let c = row.length; c < cols; c += 1) row.push(null);
    });
  }
  const width = Math.max(cols, curCols);
  for (let r = data.length; r < rows; r += 1)
    data.push(_.times(width, () => null));
  if (sheet.row != null && sheet.row < data.length) sheet.row = data.length;
  if (sheet.column != null && sheet.column < width) sheet.column = width;
}

export type RefreshOptions = {
  /** Overwrite non-empty cells in the way (after the user confirmed). */
  force?: boolean;
  /** default true */
  recalculate?: boolean;
};

type RefreshPlan = {
  report: PivotReport;
  anchor: { r: number; c: number };
  span: Span;
  top: number;
};

/**
 * Computes a PivotTable's report and where it goes, checking that it fits
 * (no other report, table, its own source or - without `force` - data in
 * the way). Changes nothing.
 */
function planRefresh(
  ctx: Context,
  sheetId: string,
  pivot: PivotTable,
  force?: boolean
): RefreshPlan | { error: PivotError } {
  const sheet = sheetOf(ctx, sheetId);
  if (!sheet?.data) return { error: "notFound" };
  const comp = computePivot(ctx, pivot);
  if ("error" in comp) return { error: comp.error };
  const report = buildPivotReport(ctx, pivot, comp);
  const filterRows = report.filters.length ? report.filters.length + 1 : 0;
  const anchor = {
    r: Math.max(pivot.anchor.r, filterRows),
    c: pivot.anchor.c,
  };
  const height = report.cells.length;
  const width = report.cells[0]?.length ?? 1;
  const top = anchor.r - filterRows;
  const span: Span = {
    row: [top, anchor.r + Math.max(1, height) - 1],
    column: [
      anchor.c,
      anchor.c + Math.max(width, report.filters.length ? 2 : 1) - 1,
    ],
  };
  if (anchor.r < 0 || anchor.c < 0) return { error: "location" };
  if (
    comp.source.sheetId === sheetId &&
    spansOverlap(comp.source.range, span)
  ) {
    return { error: "location" };
  }
  // other reports and tables
  if (
    getPivotTables(ctx, sheetId).some(
      (p) =>
        p.pivot.id !== pivot.id &&
        p.pivot.output &&
        spansOverlap(p.pivot.output, span)
    )
  ) {
    return { error: "overlapPivot" };
  }
  if (getTables(ctx, sheetId).some((t) => spansOverlap(t.table.range, span))) {
    return { error: "overlapTable" };
  }
  const data = peek(sheet.data);
  const old = pivot.output;
  if (!force) {
    for (let r = span.row[0]; r <= span.row[1]; r += 1) {
      for (let c = span.column[0]; c <= span.column[1]; c += 1) {
        if (!inSpan(old, r, c)) {
          const cell = peek(peek(data[r])?.[c]);
          if (cell && (!isBlankCell(cell) || cell.f)) {
            return { error: "replaceData" };
          }
        }
      }
    }
  }
  return { report, anchor, span, top };
}

/**
 * Whether a change to a PivotTable (or its refresh, without `patch`) can be
 * applied; the error it would give otherwise ("replaceData": ask the user,
 * then apply with `force`).
 */
export function checkPivotUpdate(
  ctx: Context,
  sheetId: string,
  id: string,
  patch?: PivotPatch
): PivotError | null {
  const pivot = findPivotTable(ctx, sheetId, id);
  if (!pivot) return "notFound";
  const next = patch ? applyPatch(pivot, patch) : pivot;
  const plan = planRefresh(ctx, sheetId, next);
  return "error" in plan ? plan.error : null;
}

/** Whether Insert › PivotTable can put an empty PivotTable there. */
export function checkNewPivotTable(
  ctx: Context,
  source: PivotSource,
  options: CreatePivotOptions = {}
): PivotError | null {
  const src = readPivotSource(ctx, source);
  if ("error" in src) return src.error;
  if (options.newSheet !== false) return null;
  const sheetId = options.sheetId ?? ctx.currentSheetId;
  const probe: PivotTable = {
    id: "\u0000probe",
    name: options.name || nextPivotTableName(ctx),
    source,
    anchor: options.anchor ?? { r: 2, c: 0 },
    rows: [],
    columns: [],
    values: [],
    filters: [],
    options: { ...DEFAULT_PIVOT_OPTIONS },
  };
  const plan = planRefresh(ctx, sheetId, probe);
  return "error" in plan ? plan.error : null;
}

/**
 * Recomputes a PivotTable and writes its report. Returns an error code and
 * changes nothing on failure ("replaceData": non-empty cells are in the
 * way; call again with `force` once the user agreed).
 */
export function refreshPivotTable(
  ctx: Context,
  sheetId: string,
  id: string,
  options: RefreshOptions = {}
): { error?: PivotError } {
  const sheet = sheetOf(ctx, sheetId);
  const pivot = sheet?.pivotTables?.find((p) => p.id === id);
  if (!sheet?.data || !pivot) return { error: "notFound" };
  const plan = planRefresh(ctx, sheetId, pivot, options.force);
  if ("error" in plan) return { error: plan.error };
  const { report, anchor, span, top } = plan;
  const { data } = sheet;
  const old = pivot.output;
  const preserve = pivot.options.preserveFormatting !== false;
  if (old) {
    for (let r = old.row[0]; r <= old.row[1]; r += 1) {
      const row = data[r];
      if (!row) continue;
      for (let c = old.column[0]; c <= old.column[1]; c += 1) {
        if (row[c]) row[c] = clearPivotCell(row[c], preserve);
      }
    }
  }
  ensureSize(sheet, span.row[1] + 1, span.column[1] + 1);
  report.filters.forEach(([name, sel], i) => {
    const r = top + i;
    data[r][anchor.c] = writePivotCell(data[r][anchor.c], {
      v: name,
      left: true,
    });
    data[r][anchor.c + 1] = writePivotCell(data[r][anchor.c + 1], {
      v: sel,
      left: true,
      bold: false,
    });
  });
  report.cells.forEach((row, i) => {
    row.forEach((rc, j) => {
      const r = anchor.r + i;
      const c = anchor.c + j;
      let base: Cell | null = null;
      if (inSpan(old, r, c) || !options.force) base = data[r][c];
      data[r][c] = writePivotCell(base, rc);
    });
  });
  pivot.anchor = anchor;
  pivot.output = span;
  pivot.layout = { ...report.layout, row: anchor.r, col: anchor.c };
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return {};
}

/** Refreshes every PivotTable (optionally only those reading a sheet). */
export function refreshAllPivotTables(ctx: Context, sourceSheetId?: string) {
  let any = false;
  getPivotTables(ctx).forEach(({ sheetId, pivot }) => {
    if (sourceSheetId != null) {
      const src = resolvePivotSource(ctx, pivot.source);
      if (src?.sheetId !== sourceSheetId) return;
    }
    const res = refreshPivotTable(ctx, sheetId, pivot.id, {
      recalculate: false,
    });
    if (!res.error) any = true;
  });
  if (any) recalculateWorkbook(ctx);
}

/**
 * A fingerprint of a PivotTable's source values (auto refresh compares it
 * with the one of the last refresh).
 */
export function pivotSourceSignature(ctx: Context, pivot: PivotTable) {
  const src = readPivotSource(ctx, pivot.source);
  if ("error" in src) return `error:${src.error}`;
  let h = 0;
  const add = (s: string) => {
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  };
  add(src.fields.map((f) => f.name).join("\u0001"));
  src.records.forEach((rec) => {
    rec.forEach((cell) => add(`${cell?.v ?? ""}\u0001`));
    add("\u0002");
  });
  return `${src.records.length}:${h}`;
}

/** Removes a PivotTable and clears its report. */
export function deletePivotTable(ctx: Context, sheetId: string, id: string) {
  const sheet = sheetOf(ctx, sheetId);
  const pivot = sheet?.pivotTables?.find((p) => p.id === id);
  if (!sheet?.data || !pivot) return false;
  const old = pivot.output;
  if (old) {
    for (let r = old.row[0]; r <= old.row[1]; r += 1) {
      const row = sheet.data[r];
      if (!row) continue;
      for (let c = old.column[0]; c <= old.column[1]; c += 1) row[c] = null;
    }
  }
  sheet.pivotTables = sheet.pivotTables!.filter((p) => p.id !== id);
  if (!sheet.pivotTables.length) delete sheet.pivotTables;
  recalculateWorkbook(ctx);
  return true;
}

/* ------------------------------------------------------------------------ */
/* Creation and editing                                                     */
/* ------------------------------------------------------------------------ */

/** The source Insert › PivotTable proposes (the table or current region). */
export function suggestPivotSource(ctx: Context): PivotSource | null {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return null;
  const r = sel.row_focus ?? sel.row[0];
  const c = sel.column_focus ?? sel.column[0];
  const table = getTables(ctx, ctx.currentSheetId).find((t) =>
    inSpan(t.table.range, r, c)
  );
  if (table) return { table: table.table.name };
  const data = sheetOf(ctx, ctx.currentSheetId)?.data;
  if (!data) return null;
  if (sel.row[0] !== sel.row[1] || sel.column[0] !== sel.column[1]) {
    return {
      sheetId: ctx.currentSheetId,
      range: {
        row: [sel.row[0], sel.row[1]],
        column: [sel.column[0], sel.column[1]],
      },
    };
  }
  // current region (Ctrl+*)
  const filled = (rr: number, cc: number) =>
    !isBlankCell(peek(peek(data[rr])?.[cc]));
  if (!filled(r, c)) return null;
  let r1 = r;
  let r2 = r;
  let c1 = c;
  let c2 = c;
  let grew = true;
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const anyIn = (ra: number, rb: number, ca: number, cb: number) => {
    for (let i = ra; i <= rb; i += 1) {
      for (let j = ca; j <= cb; j += 1) if (filled(i, j)) return true;
    }
    return false;
  };
  while (grew) {
    grew = false;
    if (
      r1 > 0 &&
      anyIn(r1 - 1, r1 - 1, Math.max(0, c1 - 1), Math.min(cols - 1, c2 + 1))
    ) {
      r1 -= 1;
      grew = true;
    }
    if (
      r2 < rows - 1 &&
      anyIn(r2 + 1, r2 + 1, Math.max(0, c1 - 1), Math.min(cols - 1, c2 + 1))
    ) {
      r2 += 1;
      grew = true;
    }
    if (
      c1 > 0 &&
      anyIn(Math.max(0, r1 - 1), Math.min(rows - 1, r2 + 1), c1 - 1, c1 - 1)
    ) {
      c1 -= 1;
      grew = true;
    }
    if (
      c2 < cols - 1 &&
      anyIn(Math.max(0, r1 - 1), Math.min(rows - 1, r2 + 1), c2 + 1, c2 + 1)
    ) {
      c2 += 1;
      grew = true;
    }
  }
  return {
    sheetId: ctx.currentSheetId,
    range: { row: [r1, r2], column: [c1, c2] },
  };
}

function addBlankSheet(ctx: Context, id: string, beforeSheetId: string | null) {
  const name = generateRandomSheetName(ctx.luckysheetfile, false, ctx);
  const rows = Math.max(ctx.defaultrowNum || 84, 1);
  const cols = Math.max(ctx.defaultcolumnNum || 60, 1);
  const sheet: Sheet = {
    name,
    id,
    status: 0,
    order: ctx.luckysheetfile.length,
    row: rows,
    column: cols,
    config: {},
    zoomRatio: 1,
    data: _.times(rows, () => _.times(cols, () => null)),
  };
  if (ctx.hooks?.beforeAddSheet?.(sheet) === false) return null;
  ctx.luckysheetfile.push(sheet);
  moveSheet(ctx, id, beforeSheetId);
  return ctx.luckysheetfile[ctx.luckysheetfile.length - 1];
}

/**
 * Insert › PivotTable. Creates an empty PivotTable (rows / columns /
 * values are added in the Fields pane) on a new sheet placed before the
 * current one (anchor A3, as in Excel) or at `anchor` of an existing sheet.
 */
export function createPivotTable(
  ctx: Context,
  source: PivotSource,
  options: CreatePivotOptions = {}
): { pivot?: PivotTable; sheetId?: string; error?: PivotError } {
  if (ctx.allowEdit === false) return { error: "location" };
  const src = readPivotSource(ctx, source);
  if ("error" in src) return { error: src.error };
  const newSheet = options.newSheet !== false;
  let sheetId = options.sheetId ?? ctx.currentSheetId;
  let anchor = options.anchor ?? { r: 2, c: 0 };
  if (newSheet) {
    anchor = { r: 2, c: 0 };
    sheetId = options.newSheetId ?? uuidv4();
    if (!addBlankSheet(ctx, sheetId, ctx.currentSheetId))
      return { error: "location" };
  } else {
    const sheet = sheetOf(ctx, sheetId);
    if (!sheet?.data) return { error: "location" };
    const srcSpan = src.range;
    if (src.sheetId === sheetId && inSpan(srcSpan, anchor.r, anchor.c)) {
      return { error: "location" };
    }
  }
  const sheet = sheetOf(ctx, sheetId)!;
  const pivot: PivotTable = {
    id: uuidv4(),
    name: options.name || nextPivotTableName(ctx),
    source: source.table
      ? { table: source.table }
      : { sheetId: source.sheetId, range: source.range },
    anchor,
    rows: [],
    columns: [],
    values: [],
    filters: [],
    options: { ...DEFAULT_PIVOT_OPTIONS },
  };
  sheet.pivotTables = [...(sheet.pivotTables ?? []), pivot];
  const res = refreshPivotTable(ctx, sheetId, pivot.id, {
    force: options.force,
  });
  if (res.error) {
    sheet.pivotTables = sheet.pivotTables.filter((p) => p.id !== pivot.id);
    if (!sheet.pivotTables.length) delete sheet.pivotTables;
    if (newSheet) {
      ctx.luckysheetfile = ctx.luckysheetfile.filter((s) => s.id !== sheetId);
    }
    return { error: res.error };
  }
  if (newSheet) changeSheet(ctx, sheetId);
  const created = sheet.pivotTables.find((p) => p.id === pivot.id)!;
  const selection = [
    {
      row: [created.anchor.r, created.anchor.r],
      column: [created.anchor.c, created.anchor.c],
      row_focus: created.anchor.r,
      column_focus: created.anchor.c,
    },
  ];
  ctx.luckysheet_select_save = selection;
  // the UI activates a new sheet with the selection it remembers
  if (newSheet) {
    ctx.sheetScrollRecord = {
      ...(ctx.sheetScrollRecord ?? {}),
      [sheetId]: {
        scrollLeft: 0,
        scrollTop: 0,
        luckysheet_select_status: false,
        luckysheet_select_save: _.cloneDeep(selection),
      },
    };
  }
  delete ctx.pivotFieldListHidden;
  return { pivot: created, sheetId };
}

/**
 * Changes a PivotTable and refreshes it. On error (e.g. the report would
 * run into data) nothing changes.
 */
export function updatePivotTable(
  ctx: Context,
  sheetId: string,
  id: string,
  patch: PivotPatch,
  options: RefreshOptions = {}
): { error?: PivotError } {
  const sheet = sheetOf(ctx, sheetId);
  const index = sheet?.pivotTables?.findIndex((p) => p.id === id) ?? -1;
  if (!sheet || index < 0) return { error: "notFound" };
  const prev = sheet.pivotTables![index];
  const next = applyPatch(prev, patch);
  const list = [...sheet.pivotTables!];
  list[index] = next;
  sheet.pivotTables = list;
  const res = refreshPivotTable(ctx, sheetId, id, options);
  if (res.error) {
    const back = [...sheet.pivotTables];
    back[index] = prev;
    sheet.pivotTables = back;
  }
  return res;
}

/** Settings of one field (merged into the existing ones). */
export function updatePivotField(
  ctx: Context,
  sheetId: string,
  id: string,
  fieldId: string,
  patch: Partial<PivotFieldSettings> | null
) {
  const pivot = findPivotTable(ctx, sheetId, id);
  if (!pivot) return { error: "notFound" as PivotError };
  const fields = { ...(pivot.fields ?? {}) };
  if (patch == null) delete fields[fieldId];
  else {
    const merged: PivotFieldSettings = { ...fields[fieldId], ...patch };
    (Object.keys(merged) as (keyof PivotFieldSettings)[]).forEach((k) => {
      if (merged[k] === undefined) delete merged[k];
    });
    fields[fieldId] = merged;
  }
  return updatePivotTable(ctx, sheetId, id, { fields });
}

/**
 * Groups a date field by years / quarters / months / days, like Excel: the
 * field shows the finest group and "Years (Date)" etc. fields are added
 * next to it on its axis. An empty list ungroups.
 */
export function groupPivotDateField(
  ctx: Context,
  sheetId: string,
  id: string,
  field: string,
  groups: PivotDateGroup[]
) {
  const pivot = findPivotTable(ctx, sheetId, id);
  if (!pivot) return { error: "notFound" as PivotError };
  const ordered = PIVOT_DATE_GROUPS.filter((g) => groups.includes(g));
  const finest = ordered[ordered.length - 1];
  const coarser = ordered.slice(0, -1).map((g) => `${field}|${g}`);
  const isGroupLevel = (x: string) => x.startsWith(`${field}|`);
  const rebuild = (axis: string[]) => {
    const out: string[] = [];
    axis.forEach((x) => {
      if (isGroupLevel(x)) return;
      if (x === field) out.push(...coarser, x);
      else out.push(x);
    });
    return out;
  };
  const fields = { ...(pivot.fields ?? {}) };
  fields[field] = {
    ...fields[field],
    dateGroups: finest ? ordered : undefined,
  };
  if (!finest) delete fields[field].dateGroups;
  Object.keys(fields).forEach((k) => {
    if (isGroupLevel(k) && !coarser.includes(k)) delete fields[k];
  });
  return updatePivotTable(ctx, sheetId, id, {
    fields,
    rows: rebuild(pivot.rows),
    columns: rebuild(pivot.columns),
    filters: pivot.filters.filter(
      (f) => !isGroupLevel(f.field) || coarser.includes(f.field)
    ),
  });
}

/** The fields a PivotTable can use: source fields plus date-group levels. */
export function pivotFieldList(ctx: Context, pivot: PivotTable) {
  const t = pivotLocale(ctx);
  const src = readPivotSource(ctx, pivot.source);
  if ("error" in src) return [];
  const out: {
    id: string;
    name: string;
    isDate: boolean;
    isNumeric: boolean;
  }[] = [];
  src.fields.forEach((f) => {
    out.push({
      id: f.name,
      name: f.name,
      isDate: f.isDate,
      isNumeric: f.isNumeric,
    });
    const groups = settingsOf(pivot, f.name).dateGroups ?? [];
    PIVOT_DATE_GROUPS.filter((g) => groups.includes(g))
      .slice(0, -1)
      .forEach((g) => {
        const level = resolvePivotLevel(
          pivot,
          src.fields,
          `${f.name}|${g}`,
          t
        )!;
        out.push({
          id: level.id,
          name: level.name,
          isDate: false,
          isNumeric: false,
        });
      });
  });
  return out;
}

/** Default aggregate for a field: Sum for numbers, Count otherwise. */
export function defaultPivotAggregate(field?: {
  isNumeric: boolean;
}): PivotAggregate {
  return field?.isNumeric ? "sum" : "count";
}

export type PivotArea = "filters" | "rows" | "columns" | "values";

export type PivotAreaPosition = { area: PivotArea; index: number };

/** The axis entries of an area (field ids; Σ Values included). */
export function pivotAreaFields(pivot: PivotTable, area: PivotArea): string[] {
  const sigma = pivot.values.length > 1;
  switch (area) {
    case "filters":
      return pivot.filters.map((f) => f.field);
    case "rows":
      return sigma && pivot.options.valuesOnRows
        ? [...pivot.rows, PIVOT_VALUES_FIELD]
        : [...pivot.rows];
    case "columns":
      return sigma && !pivot.options.valuesOnRows
        ? [...pivot.columns, PIVOT_VALUES_FIELD]
        : [...pivot.columns];
    default:
      return pivot.values.map((v) => v.field);
  }
}

/** Whether a field is used on any area (the Fields pane check boxes). */
export function isPivotFieldUsed(pivot: PivotTable, field: string) {
  const up = field.toUpperCase();
  // date-group levels ("Date|years") count for their field
  const same = (x: string) => {
    const u = x.toUpperCase();
    return u === up || (!up.includes("|") && u.startsWith(`${up}|`));
  };
  return (
    pivot.rows.some(same) ||
    pivot.columns.some(same) ||
    pivot.filters.some((f) => same(f.field)) ||
    pivot.values.some((v) => same(v.field))
  );
}

/**
 * The change dragging a field makes: from an area position (null: from the
 * field list) to an area (null: removed). A field is on one of Filters /
 * Rows / Columns at a time; Values may hold it (several times) as well.
 * Σ Values moves between Rows and Columns only.
 */
export function pivotMoveField(
  pivot: PivotTable,
  field: string,
  from: PivotAreaPosition | null,
  to: { area: PivotArea; index?: number } | null,
  aggregate: PivotAggregate = "sum"
): PivotPatch {
  if (field === PIVOT_VALUES_FIELD) {
    if (to?.area === "rows") return { options: { valuesOnRows: true } };
    if (to?.area === "columns") return { options: { valuesOnRows: false } };
    return {};
  }
  const up = field.toUpperCase();
  const other = (x: string) => x.toUpperCase() !== up;
  let rows = [...pivot.rows];
  let columns = [...pivot.columns];
  let filters = [...pivot.filters];
  let values = [...pivot.values];
  const insertAt = <T>(list: T[], item: T, index?: number) => {
    const i =
      index == null ? list.length : Math.max(0, Math.min(index, list.length));
    list.splice(i, 0, item);
  };
  if (!to) {
    if (from?.area === "values") values.splice(from.index, 1);
    else if (from?.area === "rows") rows = rows.filter(other);
    else if (from?.area === "columns") columns = columns.filter(other);
    else if (from?.area === "filters")
      filters = filters.filter((f) => other(f.field));
    else {
      rows = rows.filter(other);
      columns = columns.filter(other);
      filters = filters.filter((f) => other(f.field));
      values = values.filter((v) => other(v.field));
    }
    return { rows, columns, filters, values };
  }
  if (to.area === "values") {
    if (from?.area === "values") {
      const [moved] = values.splice(from.index, 1);
      let index = to.index ?? values.length;
      if (to.index != null && from.index < to.index) index -= 1;
      insertAt(values, moved, index);
      return { values };
    }
    if (from) {
      rows = rows.filter(other);
      columns = columns.filter(other);
      filters = filters.filter((f) => other(f.field));
    }
    insertAt(values, { field, aggregate }, to.index);
    return { rows, columns, filters, values };
  }
  // to an axis: the field leaves the other axes
  let { index } = to;
  if (from && from.area === to.area && index != null && from.index < index) {
    index -= 1;
  }
  const keep = filters.find((f) => !other(f.field));
  rows = rows.filter(other);
  columns = columns.filter(other);
  filters = filters.filter((f) => other(f.field));
  if (from?.area === "values") values.splice(from.index, 1);
  if (to.area === "rows") insertAt(rows, field, index);
  else if (to.area === "columns") insertAt(columns, field, index);
  else insertAt(filters, keep ?? { field }, index);
  return { rows, columns, filters, values };
}

/* ------------------------------------------------------------------------ */
/* Report cells                                                             */
/* ------------------------------------------------------------------------ */

export type PivotCellInfo = {
  pivot: PivotTable;
  kind: "value" | "rowLabel" | "colLabel" | "header" | "filter";
  row?: PivotAxisItem;
  col?: PivotAxisItem;
  valueIndex?: number;
  /** Report filter field (kind "filter"). */
  filterIndex?: number;
};

/** What a cell of a report shows. */
export function pivotCellInfo(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): PivotCellInfo | null {
  const pivot = pivotAt(ctx, sheetId, r, c);
  const layout = pivot?.layout;
  if (!pivot || !layout) return null;
  if (r < layout.row) {
    const top = pivot.output!.row[0];
    const i = r - top;
    if (i < pivot.filters.length && c <= layout.col + 1) {
      return { pivot, kind: "filter", filterIndex: i };
    }
    return { pivot, kind: "header" };
  }
  const i = r - layout.row - layout.headerRows;
  const j = c - layout.col - layout.labelCols;
  if (i < 0)
    return {
      pivot,
      kind: j >= 0 ? "colLabel" : "header",
      col: layout.colItems[j],
    };
  const row = layout.rowItems[i];
  if (j < 0) return { pivot, kind: "rowLabel", row };
  const col = layout.colItems[j];
  if (!row || !col || row.t === "label")
    return { pivot, kind: "rowLabel", row };
  return { pivot, kind: "value", row, col, valueIndex: row.v ?? col.v ?? 0 };
}

/**
 * Double-clicking a value cell: a new sheet (before the report's sheet)
 * with the source rows behind the value, as a table. Returns the sheet id.
 */
export function pivotDrillDown(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number,
  newSheetId?: string
): string | null {
  const info = pivotCellInfo(ctx, sheetId, r, c);
  if (!info || info.kind !== "value" || !info.row || !info.col) return null;
  const comp = computePivot(ctx, info.pivot);
  if ("error" in comp) return null;
  const rowKeys = info.row.p;
  const colKeys = info.col.p;
  const rows: (Cell | null)[][] = [];
  comp.records.forEach((rec, i) => {
    const k = comp.keys[i];
    if (rowKeys.some((key, l) => k.row[l]?.key !== key)) return;
    if (colKeys.some((key, l) => k.col[l]?.key !== key)) return;
    rows.push(rec);
  });
  const id = newSheetId ?? uuidv4();
  const { fields } = comp.source;
  const sheet = addBlankSheet(ctx, id, sheetId);
  if (!sheet) return null;
  ensureSize(sheet, rows.length + 2, fields.length + 1);
  const data = sheet.data!;
  fields.forEach((f, j) => {
    data[0][j] = { v: f.name, m: f.name, ct: { fa: "General", t: "g" } };
  });
  rows.forEach((rec, i) => {
    rec.forEach((cell, j) => {
      if (!cell || isBlankCell(cell)) return;
      const copy: Cell = { v: cell.v, m: cell.m ?? String(cell.v) };
      if (cell.ct) copy.ct = { ...cell.ct };
      data[i + 1][j] = copy;
    });
  });
  if (rows.length > 0) {
    createTable(
      ctx,
      id,
      { row: [0, rows.length], column: [0, fields.length - 1] },
      { recalculate: false }
    );
  }
  changeSheet(ctx, id);
  ctx.luckysheet_select_save = [
    { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
  ];
  return id;
}

/* ------------------------------------------------------------------------ */
/* GETPIVOTDATA                                                             */
/* ------------------------------------------------------------------------ */

function keysForItem(
  item: unknown,
  labels: Record<string, string> | undefined
) {
  const out = new Set<string>();
  if (item == null) return out;
  out.add(pivotItemKey(item));
  if (typeof item === "string") {
    const n = Number(item);
    if (item.trim() !== "" && !Number.isNaN(n)) out.add(pivotItemKey(n));
  }
  const text = String(item).toLowerCase();
  Object.entries(labels ?? {}).forEach(([k, label]) => {
    if (label.toLowerCase() === text) out.add(k);
  });
  // date groups: "y:2024", "q:1", ...
  if (typeof item === "number") {
    ["y", "q", "m", "d"].forEach((p) => out.add(`${p}:${item}`));
  }
  return out;
}

/**
 * GETPIVOTDATA(data_field, pivot_table, [field1, item1], ...): the value a
 * report shows for the given items. `r`, `c` is a cell of the report.
 * Returns the value, or an error text (#REF! when the value isn't shown).
 */
export function getPivotData(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number,
  dataField: string,
  pairs: [unknown, unknown][]
): number | string | boolean | null {
  const pivot = pivotAt(ctx, sheetId, r, c);
  const layout = pivot?.layout;
  if (!pivot || !layout) return "#REF!";
  const name = String(dataField ?? "")
    .trim()
    .toLowerCase();
  const vi = pivot.values.findIndex(
    (v) =>
      pivotValueCaption(ctx, v).toLowerCase() === name ||
      v.field.toLowerCase() === name
  );
  if (vi < 0) return "#REF!";
  const want = (levels: string[], prefix: string) => {
    const map = new Map<number, Set<string>>();
    for (let i = 0; i < pairs.length; i += 1) {
      const [f, item] = pairs[i];
      const fname = String(f ?? "").toLowerCase();
      const l = levels.findIndex((id) => {
        const [base, group] = splitLevelId(id);
        if (id.toLowerCase() === fname) return true;
        if (!group) return base.toLowerCase() === fname;
        const t = pivotLocale(ctx);
        return (
          pivotText(t.dateGroupField, {
            group: t.dateGroups[group],
            name: base,
          }).toLowerCase() === fname ||
          t.dateGroups[group].toLowerCase() === fname
        );
      });
      if (l >= 0) map.set(l, keysForItem(item, layout.labels[`${prefix}${l}`]));
    }
    return map;
  };
  const rowWant = want(layout.rowLevels, "r");
  const colWant = want(layout.colLevels, "c");
  if (rowWant.size + colWant.size !== pairs.length) return "#REF!";
  const matches = (
    item: PivotAxisItem,
    w: Map<number, Set<string>>,
    axisHasValues: boolean
  ) => {
    if (item.t === "label") return false;
    if (axisHasValues && item.v !== vi) return false;
    const depth = w.size ? Math.max(...w.keys()) + 1 : 0;
    if (item.p.length !== depth) return false;
    return [...w.entries()].every(([l, keys]) => keys.has(item.p[l]));
  };
  const rowsHaveValues = layout.rowItems.some((it) => it.v != null);
  const colsHaveValues = layout.colItems.some((it) => it.v != null);
  const pick = (
    items: PivotAxisItem[],
    w: Map<number, Set<string>>,
    hasValues: boolean,
    levels: number
  ) => {
    const found = items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => {
        if (!matches(it, w, hasValues)) return false;
        if (w.size === 0 && levels > 0) return it.t === "grand";
        return true;
      });
    return found.length ? found[0].i : -1;
  };
  const i = pick(
    layout.rowItems,
    rowWant,
    rowsHaveValues,
    layout.rowLevels.length
  );
  const j = pick(
    layout.colItems,
    colWant,
    colsHaveValues,
    layout.colLevels.length
  );
  if (i < 0 || j < 0) return "#REF!";
  const sheet = sheetOf(ctx, sheetId);
  const cell = peek(
    peek(sheet?.data?.[layout.row + layout.headerRows + i])?.[
      layout.col + layout.labelCols + j
    ]
  );
  if (cell?.v == null || cell.v === "") return "#REF!";
  return cell.v as number | string | boolean;
}

/* ------------------------------------------------------------------------ */
/* Structural changes                                                       */
/* ------------------------------------------------------------------------ */

type AdjustRange = (
  range: Span,
  sheetId: string
) => { range: Span; sheetId: string } | null;

/**
 * Keeps PivotTable sources and report positions in place when rows /
 * columns are inserted or deleted or cells move (called by the model
 * adjusters, see modelSync.ts).
 */
export function adjustPivotTablesForChange(
  ctx: Context,
  locate: AdjustRange,
  deletedSheetId?: string
) {
  (ctx.luckysheetfile ?? []).forEach((sheet) => {
    if (!sheet.pivotTables?.length || !sheet.id) return;
    const hostId = sheet.id;
    sheet.pivotTables = sheet.pivotTables.map((p) => {
      let next = p;
      const { source } = p;
      if (source.sheetId && source.range) {
        if (source.sheetId === deletedSheetId) {
          next = { ...next, source: { ...source, sheetId: undefined } };
        } else {
          const moved = locate(source.range, source.sheetId);
          if (
            moved &&
            moved.sheetId === source.sheetId &&
            !_.isEqual(moved.range, source.range)
          ) {
            next = {
              ...next,
              source: { sheetId: moved.sheetId, range: moved.range },
            };
          }
        }
      }
      if (p.output) {
        const moved = locate(p.output, hostId);
        if (moved && moved.sheetId === hostId) {
          const dr = moved.range.row[0] - p.output.row[0];
          const dc = moved.range.column[0] - p.output.column[0];
          if (dr || dc || !_.isEqual(moved.range, p.output)) {
            next = {
              ...next,
              anchor: { r: p.anchor.r + dr, c: p.anchor.c + dc },
              output: moved.range,
              layout: p.layout
                ? {
                    ...p.layout,
                    row: p.layout.row + dr,
                    col: p.layout.col + dc,
                  }
                : p.layout,
            };
          }
        }
      }
      return next;
    });
  });
}
