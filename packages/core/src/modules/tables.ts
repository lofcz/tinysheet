/**
 * Excel-style tables ("Format as Table").
 *
 * A table is stored on its sheet (`sheet.tables`) with its whole range
 * (header row + data rows + optional total row), options and column names.
 * The look (header fill, banded rows, bold total row) is written into the
 * cells as ordinary formatting, so it renders, copies and exports like any
 * other cell format; cells whose fill was changed by the user keep it.
 *
 * Structured references (`Table1[Col]`, `Table1[[#Headers],[Col]]`,
 * `Table1[#Totals]`, `Table1[#All]`, `[@Col]`, `Table1[[Col1]:[Col3]]`) are
 * rewritten into absolute A1 references before a formula is parsed (see
 * `expandFormulaNames` in names.ts), which also feeds the dependency graph.
 * When a table is created, resized or removed the workbook is recalculated.
 */
import _ from "lodash";
import type { Context } from "../context";
import type {
  Cell,
  Sheet,
  SheetTable,
  SheetTableColumn,
  TableTotalFunction,
} from "../types";
import { peek } from "./dependencyGraph";
import { execfunction } from "./formula";
import {
  absoluteRangeText,
  bracketEnd,
  getNameIndex,
  recalculateWorkbook,
  sheetNameById,
  validateDefinedName,
} from "./names";

/* ------------------------------------------------------------------------ */
/* Styles                                                                   */
/* ------------------------------------------------------------------------ */

export type TableStyle = {
  /** header fill and font colour */
  header: string;
  headerText: string;
  /** fill of odd bands (the first data row / column) */
  band: string;
  /** fill of the total row */
  total: string;
};

/** Built-in styles, named after the closest Excel table style. */
export const TABLE_STYLES: Record<string, TableStyle> = {
  TableStyleMedium2: {
    header: "#4472C4",
    headerText: "#FFFFFF",
    band: "#D9E1F2",
    total: "#D9E1F2",
  },
  TableStyleMedium3: {
    header: "#ED7D31",
    headerText: "#FFFFFF",
    band: "#FCE4D6",
    total: "#FCE4D6",
  },
  TableStyleMedium4: {
    header: "#A5A5A5",
    headerText: "#FFFFFF",
    band: "#EDEDED",
    total: "#EDEDED",
  },
  TableStyleMedium5: {
    header: "#FFC000",
    headerText: "#FFFFFF",
    band: "#FFF2CC",
    total: "#FFF2CC",
  },
  TableStyleMedium6: {
    header: "#5B9BD5",
    headerText: "#FFFFFF",
    band: "#DDEBF7",
    total: "#DDEBF7",
  },
  TableStyleMedium7: {
    header: "#70AD47",
    headerText: "#FFFFFF",
    band: "#E2EFDA",
    total: "#E2EFDA",
  },
  TableStyleMedium1: {
    header: "#000000",
    headerText: "#FFFFFF",
    band: "#D9D9D9",
    total: "#D9D9D9",
  },
  TableStyleMedium8: {
    header: "#7030A0",
    headerText: "#FFFFFF",
    band: "#E4DFEC",
    total: "#E4DFEC",
  },
};

export const DEFAULT_TABLE_STYLE = "TableStyleMedium2";

const TABLE_COLORS = new Set<string>();
Object.values(TABLE_STYLES).forEach((s) => {
  [s.header, s.band, s.total].forEach((x) => TABLE_COLORS.add(x.toUpperCase()));
});

function isTableColor(color: any) {
  return (
    color == null ||
    color === "" ||
    (typeof color === "string" && TABLE_COLORS.has(color.toUpperCase()))
  );
}

/* ------------------------------------------------------------------------ */
/* Lookup                                                                   */
/* ------------------------------------------------------------------------ */

export type TableRef = { sheetId: string; table: SheetTable };

const tableIndexes = new WeakMap<object, Map<string, TableRef>>();

/** Every table of the workbook by upper-cased name. */
export function tableIndexOf(ctx: Context): Map<string, TableRef> {
  const index = getNameIndex(ctx);
  let map = tableIndexes.get(index);
  if (map) return map;
  map = new Map();
  const files = (peek(peek(ctx).luckysheetfile) as Sheet[]) ?? [];
  for (let i = 0; i < files.length; i += 1) {
    const f = peek(files[i]);
    const list = peek(f?.tables) ?? [];
    for (let j = 0; j < list.length; j += 1) {
      const t = peek(list[j]);
      if (t?.name && f.id) {
        map.set(t.name.toUpperCase(), { sheetId: f.id, table: t });
      }
    }
  }
  tableIndexes.set(index, map);
  return map;
}

export function getTables(ctx: Context, sheetId?: string): TableRef[] {
  const all = Array.from(tableIndexOf(ctx).values());
  return sheetId == null ? all : all.filter((t) => t.sheetId === sheetId);
}

export function findTable(ctx: Context, name: string): TableRef | null {
  return tableIndexOf(ctx).get(String(name).toUpperCase()) ?? null;
}

/** The table covering cell (r, c) of a sheet, if any. */
export function tableAt(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): TableRef | null {
  let found: TableRef | null = null;
  tableIndexOf(ctx).forEach((t) => {
    if (found || t.sheetId !== sheetId) return;
    const { row, column } = t.table.range;
    if (r >= row[0] && r <= row[1] && c >= column[0] && c <= column[1]) {
      found = t;
    }
  });
  return found;
}

/** Row spans of a table: header row, data rows, total row. */
export function tableAreas(table: SheetTable) {
  const [r1, r2] = table.range.row;
  const header = table.headerRow ? r1 : null;
  const total = table.totalRow ? r2 : null;
  const dataStart = table.headerRow ? r1 + 1 : r1;
  const dataEnd = table.totalRow ? r2 - 1 : r2;
  return { header, total, dataStart, dataEnd };
}

/* ------------------------------------------------------------------------ */
/* Structured references                                                    */
/* ------------------------------------------------------------------------ */

export type StructuredRefEnv = {
  ctx: Context;
  sheetId: string;
  r: number | null;
  c: number | null;
};

const REF_ERROR = "#REF!";
const VALUE_ERROR = "#VALUE!";

/** Undo the `'` escapes of a column name (`'[` -> `[`). */
function unescapeColumn(text: string) {
  return text.replace(/'(.)/g, "$1");
}

/** Escape a column name for use inside a structured reference. */
export function escapeColumnName(name: string) {
  return name.replace(/(['#[\]])/g, "'$1");
}

/** Split `a,b,c` at top-level commas (outside brackets, honouring `'`). */
function splitItems(text: string) {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") i += 1;
    else if (ch === "[") depth += 1;
    else if (ch === "]") depth -= 1;
    else if (ch === "," && depth === 0) {
      items.push(text.slice(start, i));
      start = i + 1;
    }
  }
  items.push(text.slice(start));
  return items.map((x) => x.trim());
}

function stripBrackets(item: string) {
  const t = item.trim();
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
  return t;
}

type Spec = {
  specials: Set<string>;
  columns: [string, string] | null;
  error?: boolean;
};

const SPECIALS: Record<string, string> = {
  "#ALL": "all",
  "#DATA": "data",
  "#HEADERS": "headers",
  "#TOTALS": "totals",
  "#THIS ROW": "thisRow",
};

const COLUMN_RANGE = /^\[((?:[^'\]]|'.)*)\]\s*:\s*\[((?:[^'\]]|'.)*)\]$/;

function parseSpec(content: string): Spec {
  const spec: Spec = { specials: new Set(), columns: null };
  const text = content.trim();
  if (!text) return spec;
  const addColumns = (a: string, b?: string) => {
    if (spec.columns) spec.error = true;
    spec.columns = [unescapeColumn(a.trim()), unescapeColumn((b ?? a).trim())];
  };
  const addItem = (raw: string) => {
    let item = raw.trim();
    if (!item) return;
    if (item.startsWith("@")) {
      spec.specials.add("thisRow");
      item = item.slice(1).trim();
      if (!item) return;
    }
    const range = COLUMN_RANGE.exec(item);
    if (range) {
      addColumns(range[1], range[2]);
      return;
    }
    const inner = stripBrackets(item);
    const special = SPECIALS[inner.toUpperCase()];
    if (special) spec.specials.add(special);
    else addColumns(inner);
  };
  if (text.indexOf("[") === -1) {
    // simple form: Table1[Col], Table1[#All], [@Col]
    addItem(text);
    return spec;
  }
  splitItems(text).forEach(addItem);
  return spec;
}

function columnIndex(table: SheetTable, name: string) {
  const upper = name.toUpperCase();
  return table.columns.findIndex((col) => col.name.toUpperCase() === upper);
}

/**
 * A1 text for a structured reference to `tableName` (null: the table the
 * formula cell is in) with the bracket content `content`, or an error
 * literal.
 */
export function resolveStructuredReference(
  env: StructuredRefEnv,
  tableName: string | null,
  content: string
): string {
  const { ctx } = env;
  let ref: TableRef | null;
  if (tableName == null) {
    ref =
      env.r == null || env.c == null
        ? null
        : tableAt(ctx, env.sheetId, env.r, env.c);
  } else {
    ref = findTable(ctx, tableName);
  }
  if (!ref) return REF_ERROR;
  const { table, sheetId } = ref;
  const spec = parseSpec(content);
  if (spec.error) return REF_ERROR;
  const { header, total, dataStart, dataEnd } = tableAreas(table);
  const [tr1, tr2] = table.range.row;
  let r1: number;
  let r2: number;
  const s = spec.specials;
  if (s.has("thisRow")) {
    if (
      env.r == null ||
      env.sheetId !== sheetId ||
      env.r < dataStart ||
      env.r > dataEnd
    ) {
      return VALUE_ERROR;
    }
    r1 = env.r;
    r2 = env.r;
  } else if (s.has("all")) {
    r1 = tr1;
    r2 = tr2;
  } else if (s.size === 0) {
    r1 = dataStart;
    r2 = dataEnd;
  } else {
    const rows: number[] = [];
    if (s.has("headers")) {
      if (header == null) return REF_ERROR;
      rows.push(header);
    }
    if (s.has("data") && dataEnd >= dataStart) rows.push(dataStart, dataEnd);
    if (s.has("totals")) {
      if (total == null) return REF_ERROR;
      rows.push(total);
    }
    if (rows.length === 0) return REF_ERROR;
    r1 = Math.min(...rows);
    r2 = Math.max(...rows);
  }
  if (r2 < r1) return REF_ERROR;
  let c1 = table.range.column[0];
  let c2 = table.range.column[1];
  if (spec.columns) {
    const a = columnIndex(table, spec.columns[0]);
    const b = columnIndex(table, spec.columns[1]);
    if (a < 0 || b < 0) return REF_ERROR;
    c1 = table.range.column[0] + Math.min(a, b);
    c2 = table.range.column[0] + Math.max(a, b);
  }
  return absoluteRangeText(sheetNameById(ctx, sheetId), r1, c1, r2, c2);
}

const IDENT = /^[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*/;

/**
 * Replaces the structured references to `tableName` in a formula by A1
 * references (used when a table is converted to a normal range).
 */
export function rewriteStructuredReferences(
  ctx: Context,
  formula: string,
  tableName: string,
  sheetId: string,
  r: number,
  c: number
): string {
  const upper = tableName.toUpperCase();
  const env: StructuredRefEnv = { ctx, sheetId, r, c };
  const s = formula;
  const inTable = tableAt(ctx, sheetId, r, c)?.table.name.toUpperCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === ch) {
          if (s[j + 1] === ch) j += 2;
          else break;
        } else j += 1;
      }
      out += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const m = IDENT.exec(s.slice(i));
    if (m) {
      const end = i + m[0].length;
      if (s[end] === "[" && m[0].toUpperCase() === upper) {
        const bEnd = bracketEnd(s, end);
        if (bEnd > 0) {
          out += resolveStructuredReference(
            env,
            m[0],
            s.slice(end + 1, bEnd - 1)
          );
          i = bEnd;
          continue;
        }
      }
      out += m[0];
      i = end;
      continue;
    }
    if (ch === "[" && inTable === upper) {
      const bEnd = bracketEnd(s, i);
      if (bEnd > 0) {
        out += resolveStructuredReference(env, null, s.slice(i + 1, bEnd - 1));
        i = bEnd;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Cell helpers                                                             */
/* ------------------------------------------------------------------------ */

function sheetById(ctx: Context, id: string) {
  return ctx.luckysheetfile.find((f) => f.id === id);
}

function cellText(cell: Cell | null | undefined) {
  if (!cell) return "";
  const v = cell.m ?? cell.v;
  return v == null ? "" : String(v);
}

function isEmptyCell(cell: Cell | null | undefined) {
  return !cell || ((cell.v == null || cell.v === "") && !cell.f);
}

function writeText(data: Sheet["data"], r: number, c: number, text: string) {
  if (!data?.[r]) return;
  const cell: Cell = { ...(data[r][c] ?? {}) };
  delete cell.f;
  cell.v = text;
  cell.m = text;
  cell.ct = { fa: "General", t: "g" };
  data[r][c] = cell;
}

function writeFormula(
  ctx: Context,
  sheetId: string,
  data: Sheet["data"],
  r: number,
  c: number,
  f: string
) {
  if (!data?.[r]) return;
  const cell: Cell = { ...(data[r][c] ?? {}) };
  cell.f = f;
  delete cell.m;
  data[r][c] = cell;
  const res = execfunction(ctx, f, r, c, sheetId);
  data[r][c] = { ...data[r][c], v: res[1] };
}

function clearCell(data: Sheet["data"], r: number, c: number) {
  if (!data?.[r]?.[c]) return;
  const cell: Cell = { ...data[r][c]! };
  delete cell.v;
  delete cell.m;
  delete cell.f;
  data[r][c] = cell;
}

/** `base`, or `base2`, `base3`... when it clashes with `others`. */
function uniqueAmong(base: string, others: string[]) {
  const used = new Set(others.map((o) => o.toUpperCase()));
  let name = base;
  for (let n = 2; used.has(name.toUpperCase()); n += 1) name = `${base}${n}`;
  return name;
}

/** Unique, non-empty column names from the header texts. */
function uniqueColumnNames(texts: string[]) {
  const used: string[] = [];
  return texts.map((raw, i) => {
    const name = uniqueAmong(raw.trim() || `Column${i + 1}`, used);
    used.push(name);
    return name;
  });
}

/* ------------------------------------------------------------------------ */
/* Formatting                                                               */
/* ------------------------------------------------------------------------ */

function setBg(cell: Cell, bg: string | null) {
  if (!isTableColor(cell.bg)) return;
  if (bg) cell.bg = bg;
  else delete cell.bg;
}

/** Write the table look (fills, header font, bold rows) into its cells. */
export function applyTableFormatting(
  ctx: Context,
  sheetId: string,
  table: SheetTable
) {
  const data = sheetById(ctx, sheetId)?.data;
  if (!data) return;
  const style = TABLE_STYLES[table.style] ?? TABLE_STYLES[DEFAULT_TABLE_STYLE];
  const { header, total, dataStart, dataEnd } = tableAreas(table);
  const [c1, c2] = table.range.column;
  for (let r = table.range.row[0]; r <= table.range.row[1]; r += 1) {
    if (!data[r]) continue;
    for (let c = c1; c <= c2; c += 1) {
      const cell: Cell = { ...(data[r][c] ?? {}) };
      if (r === header) {
        setBg(cell, style.header);
        if (!cell.fc || cell.fc.toUpperCase() === "#FFFFFF") {
          cell.fc = style.headerText;
        }
        cell.bl = 1;
      } else if (r === total) {
        setBg(cell, style.total);
        cell.bl = 1;
      } else if (r >= dataStart && r <= dataEnd) {
        let banded = false;
        if (table.bandedRows) banded = (r - dataStart) % 2 === 0;
        else if (table.bandedColumns) banded = (c - c1) % 2 === 0;
        setBg(cell, banded ? style.band : null);
        if (c === c1 || c === c2) {
          const bold =
            (table.firstColumn && c === c1) || (table.lastColumn && c === c2);
          if (bold) cell.bl = 1;
          else if (cell.bl === 1) delete cell.bl;
        }
      }
      data[r][c] = cell;
    }
  }
}

/** Remove the fills a table wrote (cells with a user colour keep it). */
function clearTableFormatting(
  ctx: Context,
  sheetId: string,
  rows: [number, number],
  cols: [number, number]
) {
  const data = sheetById(ctx, sheetId)?.data;
  if (!data) return;
  for (let r = rows[0]; r <= rows[1]; r += 1) {
    for (let c = cols[0]; c <= cols[1]; c += 1) {
      const cell = data[r]?.[c];
      if (cell) {
        const next: Cell = { ...cell };
        if (cell.bg && isTableColor(cell.bg)) delete next.bg;
        if (next.fc?.toUpperCase() === "#FFFFFF") delete next.fc;
        if (next.bl === 1) delete next.bl;
        data[r][c] = next;
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Creation and options                                                     */
/* ------------------------------------------------------------------------ */

export type TableError =
  | "overlap"
  | "merged"
  | "invalidRange"
  | "notFound"
  | "invalidName"
  | "duplicateName"
  | "noRoom";

type Span = { row: [number, number]; column: [number, number] };

/** First free `TableN` name. */
export function nextTableName(ctx: Context) {
  for (let i = 1; ; i += 1) {
    const name = `Table${i}`;
    if (validateDefinedName(ctx, name, null) !== "duplicate") return name;
  }
}

function rangesOverlap(a: Span, b: Span) {
  return !(
    a.row[1] < b.row[0] ||
    b.row[1] < a.row[0] ||
    a.column[1] < b.column[0] ||
    b.column[1] < a.column[0]
  );
}

function replaceSheetTables(
  ctx: Context,
  sheetId: string,
  fn: (tables: SheetTable[]) => SheetTable[]
) {
  const sheet = sheetById(ctx, sheetId);
  if (!sheet) return;
  const next = fn([...(sheet.tables ?? [])]);
  if (next.length > 0) sheet.tables = next;
  else delete sheet.tables;
}

function updateTableObject(
  ctx: Context,
  ref: TableRef,
  patch: Partial<SheetTable>
): SheetTable {
  const next: SheetTable = { ...ref.table, ...patch };
  replaceSheetTables(ctx, ref.sheetId, (list) =>
    list.map((t) => (t.name === ref.table.name ? next : t))
  );
  return next;
}

export type CreateTableOptions = {
  hasHeaders?: boolean;
  style?: string;
  name?: string;
  /** default true */
  recalculate?: boolean;
};

/**
 * "Format as Table" on `range` of sheet `sheetId`. With `hasHeaders` false
 * the table has no header row and columns are named Column1, Column2, ...
 * Returns the table or an error code.
 */
export function createTable(
  ctx: Context,
  sheetId: string,
  range: Span,
  options: CreateTableOptions = {}
): { table?: SheetTable; error?: TableError } {
  const sheet = sheetById(ctx, sheetId);
  const data = sheet?.data;
  if (!sheet || !data) return { error: "invalidRange" };
  const row: [number, number] = [
    Math.min(range.row[0], range.row[1]),
    Math.max(range.row[0], range.row[1]),
  ];
  const column: [number, number] = [
    Math.min(range.column[0], range.column[1]),
    Math.max(range.column[0], range.column[1]),
  ];
  if (
    row[0] < 0 ||
    column[0] < 0 ||
    row[1] >= data.length ||
    column[1] >= (data[0]?.length ?? 0)
  ) {
    return { error: "invalidRange" };
  }
  const hasHeaders = options.hasHeaders !== false;
  if (hasHeaders && row[1] === row[0]) {
    // a header alone: the row below becomes the first data row
    if (row[1] + 1 >= data.length) return { error: "noRoom" };
    row[1] += 1;
  }
  const span: Span = { row, column };
  if (getTables(ctx, sheetId).some((t) => rangesOverlap(t.table.range, span))) {
    return { error: "overlap" };
  }
  const merge = sheet.config?.merge;
  if (
    merge &&
    Object.values(merge).some((m) =>
      rangesOverlap(
        {
          row: [m.r, m.r + (m.rs ?? 1) - 1],
          column: [m.c, m.c + (m.cs ?? 1) - 1],
        },
        span
      )
    )
  ) {
    return { error: "merged" };
  }
  const name = options.name?.trim() || nextTableName(ctx);
  if (options.name) {
    const err = validateDefinedName(ctx, name, null);
    if (err === "duplicate") return { error: "duplicateName" };
    if (err) return { error: "invalidName" };
  }
  const width = column[1] - column[0] + 1;
  const headerTexts = _.times(width, (i) =>
    hasHeaders ? cellText(data[row[0]]?.[column[0] + i]) : ""
  );
  const names = uniqueColumnNames(headerTexts);
  if (hasHeaders) {
    names.forEach((n, i) => {
      if (n !== headerTexts[i]) writeText(data, row[0], column[0] + i, n);
    });
  }
  const table: SheetTable = {
    name,
    range: span,
    headerRow: hasHeaders,
    totalRow: false,
    bandedRows: true,
    bandedColumns: false,
    firstColumn: false,
    lastColumn: false,
    style:
      options.style && TABLE_STYLES[options.style]
        ? options.style
        : DEFAULT_TABLE_STYLE,
    columns: names.map((n) => ({ name: n })),
  };
  replaceSheetTables(ctx, sheetId, (list) => [...list, table]);
  applyTableFormatting(ctx, sheetId, table);
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return { table };
}

const SUBTOTAL_CODES: Record<string, number> = {
  average: 101,
  countNums: 102,
  count: 103,
  max: 104,
  min: 105,
  stdDev: 107,
  sum: 109,
  var: 110,
};

/** The total-row formula for a column (null when there is none). */
export function totalRowFormula(column: SheetTableColumn): string | null {
  const code = SUBTOTAL_CODES[column.totalFunction ?? "none"];
  if (!code) return null;
  return `=SUBTOTAL(${code},[${escapeColumnName(column.name)}])`;
}

function writeTotalRow(ctx: Context, sheetId: string, table: SheetTable) {
  const data = sheetById(ctx, sheetId)?.data;
  const { total } = tableAreas(table);
  if (!data || total == null) return;
  table.columns.forEach((col, i) => {
    const c = table.range.column[0] + i;
    const f = totalRowFormula(col);
    if (f) writeFormula(ctx, sheetId, data, total, c, f);
    else if (col.totalLabel != null) writeText(data, total, c, col.totalLabel);
    else clearCell(data, total, c);
  });
}

export type TableOptionsPatch = Partial<
  Pick<
    SheetTable,
    | "name"
    | "style"
    | "totalRow"
    | "bandedRows"
    | "bandedColumns"
    | "firstColumn"
    | "lastColumn"
  >
>;

/**
 * Changes table options (Table Design). Turning the total row on uses the
 * row below the table (it must be empty): the first column gets "Total", the
 * last one a SUBTOTAL sum. Renaming does not rewrite formulas that use the
 * old name.
 */
export function setTableOptions(
  ctx: Context,
  tableName: string,
  patch: TableOptionsPatch,
  options: { recalculate?: boolean } = {}
): TableError | null {
  const ref = findTable(ctx, tableName);
  if (!ref) return "notFound";
  const { sheetId } = ref;
  const data = sheetById(ctx, sheetId)?.data;
  if (!data) return "notFound";
  const next: Partial<SheetTable> = { ...patch };
  if (patch.name != null && patch.name !== ref.table.name) {
    const err = validateDefinedName(ctx, patch.name, null, {
      name: ref.table.name,
      scope: null,
    });
    if (err === "duplicate") return "duplicateName";
    if (err) return "invalidName";
  }
  if (patch.style != null && !TABLE_STYLES[patch.style]) delete next.style;
  const { table } = ref;
  const [r1, r2] = table.range.row;
  if (patch.totalRow === true && !table.totalRow) {
    const below = r2 + 1;
    if (below >= data.length) return "noRoom";
    for (let c = table.range.column[0]; c <= table.range.column[1]; c += 1) {
      if (!isEmptyCell(data[below]?.[c])) return "noRoom";
    }
    const last = table.columns.length - 1;
    next.columns = table.columns.map((col, i) => {
      if (i === last)
        return { ...col, totalFunction: col.totalFunction ?? "sum" };
      if (i === 0) return { ...col, totalLabel: col.totalLabel ?? "Total" };
      return col;
    });
    next.range = { row: [r1, below], column: table.range.column };
  } else if (patch.totalRow === false && table.totalRow) {
    for (let c = table.range.column[0]; c <= table.range.column[1]; c += 1) {
      clearCell(data, r2, c);
    }
    clearTableFormatting(ctx, sheetId, [r2, r2], table.range.column);
    next.range = { row: [r1, r2 - 1], column: table.range.column };
  }
  const updated = updateTableObject(ctx, ref, next);
  // the table must be updated before its total formulas are evaluated
  if (patch.totalRow === true && !table.totalRow) {
    writeTotalRow(ctx, sheetId, updated);
  }
  applyTableFormatting(ctx, sheetId, updated);
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return null;
}

/** Sets the total-row function of column `index` (0-based). */
export function setTableTotalFunction(
  ctx: Context,
  tableName: string,
  index: number,
  fn: TableTotalFunction,
  label?: string
): TableError | null {
  const ref = findTable(ctx, tableName);
  if (!ref) return "notFound";
  const columns = ref.table.columns.map((col, i) => {
    if (i !== index) return col;
    const next: SheetTableColumn = { name: col.name, totalFunction: fn };
    if (fn === "none" && label != null) next.totalLabel = label;
    return next;
  });
  const table = updateTableObject(ctx, ref, { columns });
  writeTotalRow(ctx, ref.sheetId, table);
  recalculateWorkbook(ctx);
  return null;
}

/**
 * Resizes a table to `range` (same first row). New columns get their names
 * from their header cells.
 */
export function resizeTable(
  ctx: Context,
  tableName: string,
  range: Span,
  options: { recalculate?: boolean } = {}
): TableError | null {
  const ref = findTable(ctx, tableName);
  if (!ref) return "notFound";
  const { sheetId, table } = ref;
  const data = sheetById(ctx, sheetId)?.data;
  if (!data) return "notFound";
  const row: [number, number] = [range.row[0], range.row[1]];
  const column: [number, number] = [range.column[0], range.column[1]];
  const minRows = (table.headerRow ? 1 : 0) + (table.totalRow ? 1 : 0);
  if (
    row[0] !== table.range.row[0] ||
    row[1] < row[0] + minRows ||
    column[1] < column[0] ||
    column[0] < 0 ||
    row[1] >= data.length ||
    column[1] >= (data[0]?.length ?? 0)
  ) {
    return "invalidRange";
  }
  const span: Span = { row, column };
  if (
    getTables(ctx, sheetId).some(
      (t) => t.table.name !== table.name && rangesOverlap(t.table.range, span)
    )
  ) {
    return "overlap";
  }
  const oldRange = table.range;
  const oldColumn = (c: number) =>
    c >= oldRange.column[0] && c <= oldRange.column[1]
      ? table.columns[c - oldRange.column[0]]
      : null;
  const texts: string[] = [];
  for (let c = column[0]; c <= column[1]; c += 1) {
    texts.push(
      oldColumn(c)?.name ?? (table.headerRow ? cellText(data[row[0]]?.[c]) : "")
    );
  }
  const names = uniqueColumnNames(texts);
  const columns = names.map((n, i) => {
    const c = column[0] + i;
    const old = oldColumn(c);
    if (table.headerRow && cellText(data[row[0]]?.[c]) !== n) {
      writeText(data, row[0], c, n);
    }
    return old && old.name === n ? old : { name: n };
  });
  if (oldRange.row[1] > row[1]) {
    clearTableFormatting(
      ctx,
      sheetId,
      [row[1] + 1, oldRange.row[1]],
      oldRange.column
    );
  }
  if (oldRange.column[1] > column[1]) {
    clearTableFormatting(ctx, sheetId, oldRange.row, [
      column[1] + 1,
      oldRange.column[1],
    ]);
  }
  const next = updateTableObject(ctx, ref, { range: span, columns });
  applyTableFormatting(ctx, sheetId, next);
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return null;
}

/**
 * "Convert to Range": removes the table object (the formatting stays, as in
 * Excel) and rewrites structured references to it as A1 references.
 */
export function convertTableToRange(ctx: Context, tableName: string) {
  const ref = findTable(ctx, tableName);
  if (!ref) return false;
  // rewrite formulas first, while the table still resolves
  const rewrites: { sheetId: string; r: number; c: number; f: string }[] = [];
  ctx.luckysheetfile.forEach((sheet) => {
    const data = peek(sheet.data);
    if (!data || !sheet.id) return;
    for (let r = 0; r < data.length; r += 1) {
      const row = peek(data[r]);
      if (row) {
        for (let c = 0; c < row.length; c += 1) {
          const f = peek(row[c])?.f;
          if (typeof f === "string" && f.indexOf("[") > -1) {
            const next = rewriteStructuredReferences(
              ctx,
              f,
              ref.table.name,
              sheet.id,
              r,
              c
            );
            if (next !== f) rewrites.push({ sheetId: sheet.id, r, c, f: next });
          }
        }
      }
    }
  });
  rewrites.forEach(({ sheetId, r, c, f }) => {
    const data = sheetById(ctx, sheetId)?.data;
    if (data?.[r]?.[c]) data[r][c] = { ...data[r][c]!, f };
  });
  replaceSheetTables(ctx, ref.sheetId, (list) =>
    list.filter((t) => t.name !== ref.table.name)
  );
  recalculateWorkbook(ctx);
  return true;
}

/* ------------------------------------------------------------------------ */
/* Edits: auto-expansion and header renames                                 */
/* ------------------------------------------------------------------------ */

/**
 * Called after a cell was edited (updateCell). Typing into the row directly
 * below a table (without a total row) or the column directly right of it
 * extends the table (formulas of calculated `[@...]` columns are copied to
 * the new row); editing a header cell renames the column. Returns true when
 * a table changed (the workbook was then recalculated).
 */
export function onTableCellEdited(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): boolean {
  const tables = getTables(ctx, sheetId);
  if (tables.length === 0) return false;
  const data = sheetById(ctx, sheetId)?.data;
  if (!data) return false;
  const cell = data[r]?.[c];
  for (let i = 0; i < tables.length; i += 1) {
    const ref = tables[i];
    const { table } = ref;
    const [r1, r2] = table.range.row;
    const [c1, c2] = table.range.column;
    if (table.headerRow && r === r1 && c >= c1 && c <= c2) {
      // header edit: rename the column (unique, non-empty)
      const k = c - c1;
      const name = uniqueAmong(
        cellText(cell).trim() || `Column${k + 1}`,
        table.columns.filter((_col, j) => j !== k).map((col) => col.name)
      );
      if (name !== cellText(cell)) writeText(data, r, c, name);
      if (name === table.columns[k].name) return false;
      const columns = table.columns.map((col, j) =>
        j === k ? { ...col, name } : col
      );
      updateTableObject(ctx, ref, { columns });
      recalculateWorkbook(ctx);
      return true;
    }
    if (!isEmptyCell(cell)) {
      if (!table.totalRow && r === r2 + 1 && c >= c1 && c <= c2) {
        const next = updateTableObject(ctx, ref, {
          range: { row: [r1, r2 + 1], column: [c1, c2] },
        });
        // calculated columns: copy [@...] formulas of the row above
        for (let cc = c1; cc <= c2; cc += 1) {
          const above = data[r2]?.[cc];
          if (
            cc !== c &&
            isEmptyCell(data[r]?.[cc]) &&
            typeof above?.f === "string" &&
            above.f.indexOf("[@") > -1
          ) {
            writeFormula(ctx, sheetId, data, r, cc, above.f);
          }
        }
        applyTableFormatting(ctx, sheetId, next);
        recalculateWorkbook(ctx);
        return true;
      }
      if (c === c2 + 1 && r >= r1 && r <= r2) {
        return (
          resizeTable(ctx, table.name, {
            row: [r1, r2],
            column: [c1, c2 + 1],
          }) == null
        );
      }
    }
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Row / column insertion and deletion                                      */
/* ------------------------------------------------------------------------ */

/** Span after inserting `count` rows/columns before position `at`. */
export function shiftSpanInsert(
  span: [number, number],
  at: number,
  count: number
): [number, number] {
  const [a, b] = span;
  if (at <= a) return [a + count, b + count];
  if (at <= b) return [a, b + count];
  return span;
}

/** Span after deleting `start`..`end`; null when it is deleted entirely. */
export function shiftSpanDelete(
  span: [number, number],
  start: number,
  end: number
): [number, number] | null {
  const n = end - start + 1;
  const [a, b] = span;
  if (start <= a && end >= b) return null;
  let na = a;
  if (a > end) na = a - n;
  else if (a >= start) na = start;
  let nb = b;
  if (b > end) nb = b - n;
  else if (b >= start) nb = start - 1;
  return nb < na ? null : [na, nb];
}

export type RowColChange =
  | { kind: "insert"; type: "row" | "column"; index: number; count: number }
  | { kind: "delete"; type: "row" | "column"; start: number; end: number };

/**
 * Keeps tables in place when rows/columns are inserted (`count` new ones
 * starting at `index`) or deleted (`start`..`end`) on a sheet. Called by
 * insertRowCol / deleteRowCol after the cells moved.
 */
export function adjustTablesForRowCol(
  ctx: Context,
  sheetId: string,
  op: RowColChange
) {
  const sheet = sheetById(ctx, sheetId);
  if (!sheet?.tables?.length) return;
  const { data } = sheet;
  const key = op.type === "row" ? "row" : "column";
  const next: SheetTable[] = [];
  sheet.tables.forEach((t) => {
    const span = t.range[key];
    if (op.kind === "insert") {
      const nextSpan = shiftSpanInsert(span, op.index, op.count);
      let { columns } = t;
      if (key === "column" && op.index > span[0] && op.index <= span[1]) {
        const at = op.index - span[0];
        const added = _.times(op.count, () => ({ name: "" }));
        const merged = [
          ...columns.slice(0, at),
          ...added,
          ...columns.slice(at),
        ];
        const names = uniqueColumnNames(merged.map((col) => col.name));
        columns = merged.map((col, i) => ({ ...col, name: names[i] }));
        if (t.headerRow && data) {
          for (let i = at; i < at + op.count; i += 1) {
            writeText(data, t.range.row[0], span[0] + i, columns[i].name);
          }
        }
      }
      next.push({ ...t, columns, range: { ...t.range, [key]: nextSpan } });
      return;
    }
    const nextSpan = shiftSpanDelete(span, op.start, op.end);
    if (!nextSpan) return; // the whole table was deleted
    const inDeleted = (x: number) => x >= op.start && x <= op.end;
    if (key === "column") {
      const columns = t.columns.filter((_col, i) => !inDeleted(span[0] + i));
      next.push({ ...t, columns, range: { ...t.range, column: nextSpan } });
      return;
    }
    // a deleted header / total row turns the option off
    next.push({
      ...t,
      headerRow: t.headerRow && !inDeleted(span[0]),
      totalRow: t.totalRow && !inDeleted(span[1]),
      range: { ...t.range, row: nextSpan },
    });
  });
  if (next.length > 0) sheet.tables = next;
  else delete sheet.tables;
}
