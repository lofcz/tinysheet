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
import { checkProtection } from "./protection";
import type { Context } from "../context";
import type {
  Cell,
  Sheet,
  SheetTable,
  SheetTableColumn,
  TableSlicer,
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
import { getCurrentRegion, getSheetNavInfo } from "./navigation";
import {
  offsetFormula,
  ReferenceChange,
  rewriteWorkbookFormulas,
  WorkbookFormulaSite,
} from "./refAdjust";

/**
 * The range "Format as Table" proposes: the selection, or the current
 * region around the active cell when a single cell is selected.
 */
export function suggestTableRange(ctx: Context): {
  row: [number, number];
  column: [number, number];
} | null {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return null;
  const row: [number, number] = [last.row[0], last.row[1]];
  const column: [number, number] = [last.column[0], last.column[1]];
  if (row[0] !== row[1] || column[0] !== column[1]) return { row, column };
  const info = getSheetNavInfo(ctx);
  if (!info) return { row, column };
  const region = getCurrentRegion(
    info.isFilled,
    row[0],
    column[0],
    info.rows,
    info.cols
  );
  return region
    ? {
        row: [region.row[0], region.row[1]],
        column: [region.column[0], region.column[1]],
      }
    : { row, column };
}

/* ------------------------------------------------------------------------ */
/* Styles                                                                   */
/* ------------------------------------------------------------------------ */

export type TableStyle = {
  /** header fill ("" for none) and font colour */
  header: string;
  headerText: string;
  /** fill of odd bands (the first data row / column) */
  band: string;
  /** fill of the total row ("" for none) */
  total: string;
  /** fill of the other data rows (default none) */
  fill?: string;
  /** font colour of the data and total rows (default: unchanged) */
  text?: string;
};

function lightStyle(band: string, headerText = "#000000"): TableStyle {
  return { header: "", headerText, band, total: "" };
}

function darkStyle(fill: string, band: string, total: string): TableStyle {
  return {
    header: "#000000",
    headerText: "#FFFFFF",
    band,
    total,
    fill,
    text: "#FFFFFF",
  };
}

/**
 * Built-in styles, named after the closest Excel table style (the names are
 * written to xlsx as the table style). Light styles have no header fill,
 * medium ones an accent header, dark ones dark rows with white text.
 */
export const TABLE_STYLES: Record<string, TableStyle> = {
  TableStyleLight1: lightStyle("#D9D9D9"),
  TableStyleLight2: lightStyle("#D9E1F2", "#2F5597"),
  TableStyleLight3: lightStyle("#FCE4D6", "#C55A11"),
  TableStyleLight4: lightStyle("#EDEDED", "#595959"),
  TableStyleLight5: lightStyle("#FFF2CC", "#BF8F00"),
  TableStyleLight6: lightStyle("#DDEBF7", "#2F75B5"),
  TableStyleLight7: lightStyle("#E2EFDA", "#548235"),
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
  TableStyleDark1: darkStyle("#737373", "#595959", "#262626"),
  TableStyleDark2: darkStyle("#4472C4", "#305496", "#203764"),
  TableStyleDark3: darkStyle("#ED7D31", "#C65911", "#833C0C"),
  TableStyleDark4: darkStyle("#A5A5A5", "#7B7B7B", "#525252"),
  TableStyleDark5: darkStyle("#FFC000", "#BF8F00", "#806000"),
  TableStyleDark6: darkStyle("#5B9BD5", "#2F75B5", "#1F4E78"),
  TableStyleDark7: darkStyle("#70AD47", "#548235", "#375623"),
};

export type TableStyleGroup = "light" | "medium" | "dark";

/** The gallery sections: style keys by group, in gallery order. */
export const TABLE_STYLE_GROUPS: Record<TableStyleGroup, string[]> = {
  light: Object.keys(TABLE_STYLES).filter((k) => k.includes("Light")),
  medium: Object.keys(TABLE_STYLES).filter((k) => k.includes("Medium")),
  dark: Object.keys(TABLE_STYLES).filter((k) => k.includes("Dark")),
};

export const DEFAULT_TABLE_STYLE = "TableStyleMedium2";

const TABLE_COLORS = new Set<string>();
const TABLE_TEXT_COLORS = new Set<string>(["#FFFFFF"]);
Object.values(TABLE_STYLES).forEach((s) => {
  [s.header, s.band, s.total, s.fill].forEach((x) => {
    if (x) TABLE_COLORS.add(x.toUpperCase());
  });
  [s.headerText, s.text].forEach((x) => {
    if (x) TABLE_TEXT_COLORS.add(x.toUpperCase());
  });
});

function isTableColor(color: any) {
  return (
    color == null ||
    color === "" ||
    (typeof color === "string" && TABLE_COLORS.has(color.toUpperCase()))
  );
}

/** A font colour a table style wrote (or none): the style may replace it. */
function isTableTextColor(color: any) {
  return (
    color == null ||
    color === "" ||
    (typeof color === "string" && TABLE_TEXT_COLORS.has(color.toUpperCase()))
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

/** Every slicer of the workbook, with its table and sheet. */
export function getSlicers(ctx: Context) {
  const out: { sheetId: string; table: SheetTable; slicer: TableSlicer }[] = [];
  getTables(ctx).forEach(({ sheetId, table }) => {
    table.slicers?.forEach((slicer) => out.push({ sheetId, table, slicer }));
  });
  return out;
}

/** `base`, or `base1`, `base2`... when a slicer already has that name. */
export function uniqueSlicerName(
  ctx: Context,
  base: string,
  taken: Set<string> = new Set()
) {
  const used = new Set(taken);
  getSlicers(ctx).forEach(({ slicer }) => used.add(slicer.name.toUpperCase()));
  let name = base;
  for (let n = 1; used.has(name.toUpperCase()); n += 1) name = `${base}${n}`;
  return name;
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

const IDENT_STICKY = /[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*/y;
const NUMBER_STICKY = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ERROR_STICKY = /#[A-Za-z0-9/]+[!?]?/y;

function stickyMatch(re: RegExp, s: string, i: number) {
  re.lastIndex = i;
  const m = re.exec(s);
  return m ? m[0] : null;
}

function quotedRunEnd(s: string, i: number) {
  const quote = s[i];
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === quote) {
      if (s[j + 1] === quote) j += 2;
      else return j + 1;
    } else j += 1;
  }
  return j;
}

/**
 * Calls `fn` for every structured reference of a formula (`Table1[...]`
 * with the table name, `[...]` inside a table with null) and for every bare
 * identifier that could name a table (`=SUM(Table1)`, content null), and
 * splices in its result (null/undefined keeps the text). Strings, quoted
 * sheet names, function names, sheet-qualified names and external workbook
 * prefixes (`[1]Sheet1!A1`) are skipped.
 */
export function mapStructuredReferences(
  formula: string,
  fn: (
    tableName: string | null,
    content: string | null
  ) => string | null | undefined
): string {
  const s = formula;
  if (!s) return s;
  let out = "";
  let i = 0;
  let changed = false;
  const emit = (original: string, replacement: string | null | undefined) => {
    if (replacement != null && replacement !== original) {
      out += replacement;
      changed = true;
    } else {
      out += original;
    }
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const end = quotedRunEnd(s, i);
      out += s.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "#") {
      const err = stickyMatch(ERROR_STICKY, s, i);
      if (err) {
        out += err;
        i += err.length;
        continue;
      }
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      const num = stickyMatch(NUMBER_STICKY, s, i);
      if (num) {
        out += num;
        i += num.length;
        continue;
      }
    }
    const ident = stickyMatch(IDENT_STICKY, s, i);
    if (ident) {
      const end = i + ident.length;
      const qualified = s[i - 1] === "!";
      if (s[end] === "[") {
        const bEnd = bracketEnd(s, end);
        if (bEnd > 0) {
          const text = s.slice(i, bEnd);
          emit(text, qualified ? null : fn(ident, s.slice(end + 1, bEnd - 1)));
          i = bEnd;
          continue;
        }
      } else if (!qualified && s[end] !== "(" && s[end] !== "!") {
        emit(ident, fn(ident, null));
        i = end;
        continue;
      }
      out += ident;
      i = end;
      continue;
    }
    if (ch === "[") {
      const bEnd = bracketEnd(s, i);
      if (bEnd > 0) {
        const text = s.slice(i, bEnd);
        const next = s[bEnd];
        // `[1]Sheet1!A1`: an external workbook, not a structured reference
        const external = next != null && (next === "'" || /[\w]/.test(next));
        emit(text, external ? null : fn(null, s.slice(i + 1, bEnd - 1)));
        i = bEnd;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return changed ? out : formula;
}

/**
 * The column names (first, last) a structured reference's bracket content
 * selects, or null when it selects every column (`#All`, `#Data`, ...).
 */
export function structuredReferenceColumns(
  content: string
): [string, string] | null {
  const spec = parseSpec(content);
  if (spec.error) return null;
  return spec.columns;
}

/**
 * The bracket content of a structured reference with column `oldName`
 * renamed to `newName`, or null when it does not mention that column.
 */
export function renameColumnInReference(
  content: string,
  oldName: string,
  newName: string
): string | null {
  const upper = oldName.toUpperCase();
  const escaped = escapeColumnName(newName);
  const matches = (item: string) => {
    const t = item.trim();
    return !t.startsWith("#") && unescapeColumn(t).toUpperCase() === upper;
  };
  if (content.indexOf("[") === -1) {
    // simple form: Col, @Col, #All
    const t = content.trim();
    const at = t.startsWith("@");
    const body = at ? t.slice(1) : t;
    if (!matches(body)) return null;
    // `[@Col]`, but `[@[Unit Price]]` for names that are not plain words
    if (at && !/^[A-Za-z0-9_.À-￿]+$/.test(newName)) {
      return `@[${escaped}]`;
    }
    return `${at ? "@" : ""}${escaped}`;
  }
  let out = "";
  let i = 0;
  let changed = false;
  while (i < content.length) {
    const ch = content[i];
    if (ch === "[") {
      const end = bracketEnd(content, i);
      if (end < 0) return null;
      const inner = content.slice(i + 1, end - 1);
      if (matches(inner)) {
        out += `[${escaped}]`;
        changed = true;
      } else {
        out += content.slice(i, end);
      }
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return changed ? out : null;
}

/**
 * Renaming a table rewrites every structured reference to it (and bare
 * uses of its name) in all formulas of the workbook: cells, names, data
 * validation and conditional formats (`Table1[Col]` -> `Sales[Col]`).
 */
export function renameTableReferences(
  ctx: Context,
  oldName: string,
  newName: string
) {
  const upper = oldName.toUpperCase();
  return rewriteWorkbookFormulas(ctx, (formula) =>
    mapStructuredReferences(formula, (tableName, content) => {
      if (tableName == null || tableName.toUpperCase() !== upper) return null;
      return content == null ? newName : `${newName}[${content}]`;
    })
  );
}

/**
 * Renaming a table column rewrites the structured references to it: those
 * naming the table anywhere, and the unqualified ones (`[@Col]`, `[Col]`)
 * of formulas inside the table.
 */
export function renameTableColumnReferences(
  ctx: Context,
  tableName: string,
  oldColumn: string,
  newColumn: string
) {
  const ref = findTable(ctx, tableName);
  if (!ref) return 0;
  const upper = tableName.toUpperCase();
  const { range } = ref.table;
  const inside = (site: WorkbookFormulaSite) =>
    site.kind === "cell" &&
    site.sheetId === ref.sheetId &&
    site.r != null &&
    site.c != null &&
    site.r >= range.row[0] &&
    site.r <= range.row[1] &&
    site.c >= range.column[0] &&
    site.c <= range.column[1];
  return rewriteWorkbookFormulas(ctx, (formula, site) =>
    mapStructuredReferences(formula, (name, content) => {
      if (content == null) return null;
      if (name != null ? name.toUpperCase() !== upper : !inside(site)) {
        return null;
      }
      const next = renameColumnInReference(content, oldColumn, newColumn);
      return next == null ? null : `${name ?? ""}[${next}]`;
    })
  );
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

function setFc(cell: Cell, fc: string | undefined) {
  if (!isTableTextColor(cell.fc)) return;
  if (fc) cell.fc = fc;
  else delete cell.fc;
}

/** Write the table look (fills, fonts, bold rows) into its cells. */
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
        setBg(cell, style.header || null);
        setFc(cell, style.headerText);
        cell.bl = 1;
      } else if (r === total) {
        setBg(cell, style.total || null);
        setFc(cell, style.text);
        cell.bl = 1;
      } else if (r >= dataStart && r <= dataEnd) {
        let banded = false;
        if (table.bandedRows) banded = (r - dataStart) % 2 === 0;
        if (table.bandedColumns) banded = banded || (c - c1) % 2 === 0;
        setBg(cell, banded ? style.band : (style.fill ?? null));
        setFc(cell, style.text);
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
        if (next.fc && isTableTextColor(next.fc)) delete next.fc;
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
  | "noRoom"
  | "noRoomAbove";

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

/** Replaces table `ref.table` on its sheet by a patched copy (returned). */
export function updateTableObject(
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
/**
 * Validates a "Format as Table" request without changing anything. Returns
 * the table span (a lone header row gets one data row) or the error.
 */
export function checkTableRange(
  ctx: Context,
  sheetId: string,
  range: Span,
  options: { hasHeaders?: boolean; name?: string } = {}
): { span: Span } | { error: TableError } {
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
  if (options.name) {
    const err = validateDefinedName(ctx, options.name.trim(), null);
    if (err === "duplicate") return { error: "duplicateName" };
    if (err) return { error: "invalidName" };
  }
  return { span };
}

export function createTable(
  ctx: Context,
  sheetId: string,
  range: Span,
  options: CreateTableOptions = {}
): { table?: SheetTable; error?: TableError } {
  if (!checkProtection(ctx, "protected", null, sheetId)) return {};
  const checked = checkTableRange(ctx, sheetId, range, options);
  if ("error" in checked) return { error: checked.error };
  const { row, column } = checked.span;
  const data = sheetById(ctx, sheetId)!.data!;
  const hasHeaders = options.hasHeaders !== false;
  const name = options.name?.trim() || nextTableName(ctx);
  const span: Span = { row, column };
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

/** SUBTOTAL function numbers of the total-row functions (hidden rows ignored). */
export const SUBTOTAL_CODES: Record<string, number> = {
  average: 101,
  countNums: 102,
  count: 103,
  max: 104,
  min: 105,
  stdDev: 107,
  sum: 109,
  var: 110,
};

/**
 * The total-row formula for a column of table `tableName` (null when there
 * is none): `=SUBTOTAL(109,Table1[Sales])`, or the column's own formula for
 * a "custom" function.
 */
export function totalRowFormula(
  column: SheetTableColumn,
  tableName: string
): string | null {
  if (column.totalFunction === "custom") return column.totalFormula ?? null;
  const code = SUBTOTAL_CODES[column.totalFunction ?? "none"];
  if (!code) return null;
  return `=SUBTOTAL(${code},${tableName}[${escapeColumnName(column.name)}])`;
}

function writeTotalRow(ctx: Context, sheetId: string, table: SheetTable) {
  const data = sheetById(ctx, sheetId)?.data;
  const { total } = tableAreas(table);
  if (!data || total == null) return;
  table.columns.forEach((col, i) => {
    const c = table.range.column[0] + i;
    const f = totalRowFormula(col, table.name);
    if (f) writeFormula(ctx, sheetId, data, total, c, f);
    else if (col.totalLabel != null) writeText(data, total, c, col.totalLabel);
    else clearCell(data, total, c);
  });
}

/** Whether a total row can be added below table `tableName`. */
export function checkTotalRow(
  ctx: Context,
  tableName: string
): TableError | null {
  const ref = findTable(ctx, tableName);
  if (!ref) return "notFound";
  const data = sheetById(ctx, ref.sheetId)?.data;
  if (!data) return "notFound";
  const below = ref.table.range.row[1] + 1;
  if (below >= data.length) return "noRoom";
  for (
    let c = ref.table.range.column[0];
    c <= ref.table.range.column[1];
    c += 1
  ) {
    if (!isEmptyCell(data[below]?.[c])) return "noRoom";
  }
  return null;
}

/** Whether the header row can be turned back on (the row above is empty). */
export function checkHeaderRow(
  ctx: Context,
  tableName: string
): TableError | null {
  const ref = findTable(ctx, tableName);
  if (!ref) return "notFound";
  const data = sheetById(ctx, ref.sheetId)?.data;
  if (!data) return "notFound";
  const above = ref.table.range.row[0] - 1;
  if (above < 0) return "noRoomAbove";
  for (
    let c = ref.table.range.column[0];
    c <= ref.table.range.column[1];
    c += 1
  ) {
    if (!isEmptyCell(data[above]?.[c])) return "noRoomAbove";
  }
  if (
    getTables(ctx, ref.sheetId).some(
      (t) =>
        t.table.name !== ref.table.name &&
        rangesOverlap(t.table.range, {
          row: [above, above],
          column: ref.table.range.column,
        })
    )
  ) {
    return "noRoomAbove";
  }
  return null;
}

/**
 * The columns with their stored formulas (calculated column, custom total)
 * mapped by `fn`, or null when none changed.
 */
function renameInStoredFormulas(
  table: SheetTable,
  fn: (formula: string) => string
): SheetTableColumn[] | null {
  let changed = false;
  const columns = table.columns.map((col) => {
    const next = { ...col };
    (["calculatedFormula", "totalFormula"] as const).forEach((key) => {
      const f = col[key];
      if (typeof f !== "string") return;
      const mapped = fn(f);
      if (mapped !== f) {
        next[key] = mapped;
        changed = true;
      }
    });
    return next;
  });
  return changed ? columns : null;
}

export type TableOptionsPatch = Partial<
  Pick<
    SheetTable,
    | "name"
    | "style"
    | "headerRow"
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
 * last one a SUBTOTAL sum. Renaming rewrites the structured references to
 * the table in every formula of the workbook (`Table1[Col]` ->
 * `Sales[Col]`).
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
  let r1 = table.range.row[0];
  const r2 = table.range.row[1];
  if (patch.headerRow === true && !table.headerRow) {
    // the header comes back in the row above the data (it must be empty)
    const err = checkHeaderRow(ctx, table.name);
    if (err) return err;
    r1 -= 1;
    table.columns.forEach((col, i) =>
      writeText(data, r1, table.range.column[0] + i, col.name)
    );
    next.range = { row: [r1, r2], column: table.range.column };
  } else if (patch.headerRow === false && table.headerRow) {
    // the column names stay with the table; the header cells are emptied
    if (r2 - r1 < (table.totalRow ? 2 : 1)) return "invalidRange";
    for (let c = table.range.column[0]; c <= table.range.column[1]; c += 1) {
      clearCell(data, r1, c);
    }
    clearTableFormatting(ctx, sheetId, [r1, r1], table.range.column);
    r1 += 1;
    next.range = { row: [r1, r2], column: table.range.column };
  }
  if (patch.totalRow === true && !table.totalRow) {
    const below = r2 + 1;
    const err = checkTotalRow(ctx, table.name);
    if (err) return err;
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
  let updated = updateTableObject(ctx, ref, next);
  if (patch.name != null && patch.name !== table.name) {
    renameTableReferences(ctx, table.name, patch.name);
    const renamed = renameInStoredFormulas(updated, (formula) =>
      mapStructuredReferences(formula, (refTable, content) => {
        if (refTable == null) return null;
        if (refTable.toUpperCase() !== table.name.toUpperCase()) return null;
        return content == null ? patch.name : `${patch.name}[${content}]`;
      })
    );
    if (renamed) {
      updated = updateTableObject(
        ctx,
        { sheetId, table: updated },
        { columns: renamed }
      );
    }
  }
  // the table must be updated before its total formulas are evaluated
  if (patch.totalRow === true && !table.totalRow) {
    writeTotalRow(ctx, sheetId, updated);
  }
  applyTableFormatting(ctx, sheetId, updated);
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return null;
}

/**
 * Sets the total-row function of column `index` (0-based). "custom" keeps
 * `formula` (More Functions…) as the column's total formula; "none" shows
 * `label` instead.
 */
export function setTableTotalFunction(
  ctx: Context,
  tableName: string,
  index: number,
  fn: TableTotalFunction,
  label?: string,
  formula?: string
): TableError | null {
  const ref = findTable(ctx, tableName);
  if (!ref) return "notFound";
  const columns = ref.table.columns.map((col, i) => {
    if (i !== index) return col;
    const next: SheetTableColumn = { ...col, totalFunction: fn };
    delete next.totalLabel;
    delete next.totalFormula;
    if (fn === "none" && label != null) next.totalLabel = label;
    if (fn === "custom" && formula) next.totalFormula = formula;
    return next;
  });
  const table = updateTableObject(ctx, ref, { columns });
  writeTotalRow(ctx, ref.sheetId, table);
  recalculateWorkbook(ctx);
  return null;
}

/* ------------------------------------------------------------------------ */
/* Calculated columns                                                       */
/* ------------------------------------------------------------------------ */

function isFormulaCell(cell: Cell | null | undefined): cell is Cell {
  return typeof cell?.f === "string" && cell.f.length > 1;
}

/** The formula a calculated column holds in row `r` of its table. */
export function calculatedFormulaAt(
  table: SheetTable,
  column: SheetTableColumn,
  r: number
): string | null {
  if (!column.calculatedFormula) return null;
  const { dataStart } = tableAreas(table);
  return offsetFormula(column.calculatedFormula, r - dataStart, 0);
}

/**
 * Fills the empty cells of the calculated columns of `table` in rows
 * `from`..`to` (new rows of the table inherit the column formulas).
 */
function fillCalculatedRows(
  ctx: Context,
  sheetId: string,
  table: SheetTable,
  from: number,
  to: number
) {
  const data = sheetById(ctx, sheetId)?.data;
  if (!data) return false;
  const { dataStart, dataEnd } = tableAreas(table);
  let filled = false;
  table.columns.forEach((col, k) => {
    if (!col.calculatedFormula) return;
    const c = table.range.column[0] + k;
    for (
      let r = Math.max(from, dataStart);
      r <= Math.min(to, dataEnd);
      r += 1
    ) {
      if (isEmptyCell(data[r]?.[c])) {
        writeFormula(
          ctx,
          sheetId,
          data,
          r,
          c,
          calculatedFormulaAt(table, col, r)!
        );
        filled = true;
      }
    }
  });
  return filled;
}

/**
 * Makes column `index` of table `tableName` a calculated column holding the
 * formula of cell (`fromRow`, column): every other data cell gets that
 * formula (relative references follow the row). "Overwrite all cells in
 * this column with this formula".
 */
export function fillCalculatedColumn(
  ctx: Context,
  tableName: string,
  index: number,
  fromRow: number
): boolean {
  const ref = findTable(ctx, tableName);
  if (!ref) return false;
  const { table, sheetId } = ref;
  const data = sheetById(ctx, sheetId)?.data;
  const c = table.range.column[0] + index;
  const source = data?.[fromRow]?.[c];
  if (!data || !isFormulaCell(source) || !table.columns[index]) return false;
  const { dataStart, dataEnd } = tableAreas(table);
  if (fromRow < dataStart || fromRow > dataEnd) return false;
  for (let r = dataStart; r <= dataEnd; r += 1) {
    if (r !== fromRow) {
      writeFormula(
        ctx,
        sheetId,
        data,
        r,
        c,
        offsetFormula(source.f!, r - fromRow, 0)
      );
    }
  }
  const columns = table.columns.map((col, k) =>
    k === index
      ? {
          ...col,
          calculatedFormula: offsetFormula(source.f!, dataStart - fromRow, 0),
        }
      : col
  );
  updateTableObject(ctx, ref, { columns });
  recalculateWorkbook(ctx);
  return true;
}

/**
 * "Undo Calculated Column": the formula stays in row `keepRow` only; the
 * other cells of the column that hold the calculated formula are cleared.
 */
export function undoCalculatedColumn(
  ctx: Context,
  tableName: string,
  index: number,
  keepRow: number
): boolean {
  const ref = findTable(ctx, tableName);
  if (!ref) return false;
  const { table, sheetId } = ref;
  const col = table.columns[index];
  const data = sheetById(ctx, sheetId)?.data;
  if (!data || !col) return false;
  const c = table.range.column[0] + index;
  const { dataStart, dataEnd } = tableAreas(table);
  if (col.calculatedFormula) {
    for (let r = dataStart; r <= dataEnd; r += 1) {
      if (
        r !== keepRow &&
        data[r]?.[c]?.f === calculatedFormulaAt(table, col, r)
      ) {
        clearCell(data, r, c);
      }
    }
  }
  const next = { ...col };
  delete next.calculatedFormula;
  updateTableObject(ctx, ref, {
    columns: table.columns.map((x, k) => (k === index ? next : x)),
  });
  recalculateWorkbook(ctx);
  return true;
}

/**
 * A formula typed into a table column: an empty column (or a calculated
 * column being changed) becomes a calculated column filled with it; a
 * column holding other data only offers to overwrite it (AutoCorrect).
 */
function onTableFormulaEdited(
  ctx: Context,
  ref: TableRef,
  r: number,
  c: number
): boolean {
  const { table, sheetId } = ref;
  const data = sheetById(ctx, sheetId)?.data;
  const cell = data?.[r]?.[c];
  if (!data || !isFormulaCell(cell)) return false;
  const k = c - table.range.column[0];
  const col = table.columns[k];
  const { dataStart, dataEnd } = tableAreas(table);
  let others = 0;
  let consistent = true;
  let empty = true;
  for (let rr = dataStart; rr <= dataEnd; rr += 1) {
    if (rr !== r) {
      others += 1;
      const other = data[rr]?.[c];
      if (!isEmptyCell(other)) empty = false;
      if (
        !col.calculatedFormula ||
        other?.f !== calculatedFormulaAt(table, col, rr)
      ) {
        consistent = false;
      }
    }
  }
  const expected = calculatedFormulaAt(table, col, r);
  if (expected === cell.f) return false;
  if (others === 0 || empty || (col.calculatedFormula && consistent)) {
    fillCalculatedColumn(ctx, table.name, k, r);
    if (others > 0) {
      ctx.tableAutoCorrect = {
        sheetId,
        table: table.name,
        column: k,
        r,
        c,
        kind: "created",
      };
    }
    return true;
  }
  ctx.tableAutoCorrect = {
    sheetId,
    table: table.name,
    column: k,
    r,
    c,
    kind: "overwrite",
  };
  return false;
}

/* ------------------------------------------------------------------------ */
/* Filter hidden rows                                                       */
/* ------------------------------------------------------------------------ */

/** Rows the filters of a table hide. */
export function tableFilterRows(table: SheetTable): Record<string, number> {
  const out: Record<string, number> = {};
  if (!table.filters) return out;
  Object.values(table.filters).forEach((f) => Object.assign(out, f?.rowhidden));
  return out;
}

/** Rows hidden by the sheet autofilter and by every table filter. */
export function filterOwnedRows(sheet: Sheet): Record<string, number> {
  const out: Record<string, number> = {};
  if (sheet.filter) {
    Object.values(sheet.filter).forEach((f: any) =>
      Object.assign(out, f?.rowhidden)
    );
  }
  sheet.tables?.forEach((t) => Object.assign(out, tableFilterRows(t)));
  return out;
}

/**
 * Updates a sheet's hidden rows after filters changed: the `release` rows
 * (what the changed filter hid before) are shown again unless another
 * filter still hides them, and every row a filter hides is hidden. Rows
 * hidden by hand stay hidden.
 */
export function syncFilterHiddenRows(
  ctx: Context,
  sheetId: string,
  release: Record<string, number>
) {
  const sheet = sheetById(ctx, sheetId);
  if (!sheet) return;
  const current = sheetId === ctx.currentSheetId;
  const base = (current ? ctx.config : sheet.config) ?? {};
  const rowhidden = {
    ..._.omit(base.rowhidden ?? {}, Object.keys(release)),
    ...filterOwnedRows(sheet),
  };
  const cfg = { ...base, rowhidden };
  sheet.config = cfg;
  if (current) ctx.config = cfg;
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
  // filters follow their columns; slicers of dropped columns go away
  const patch: Partial<SheetTable> = { range: span, columns };
  if (table.filters) {
    const filters: NonNullable<SheetTable["filters"]> = {};
    Object.entries(table.filters).forEach(([k, f]) => {
      const nk = Number(k) + oldRange.column[0] - column[0];
      if (nk >= 0 && nk < columns.length) filters[nk] = f;
    });
    patch.filters = _.isEmpty(filters) ? undefined : filters;
  }
  if (table.slicers) {
    const kept = new Set(columns.map((col) => col.name.toUpperCase()));
    const slicers = table.slicers.filter((x) =>
      kept.has(x.column.toUpperCase())
    );
    patch.slicers = slicers.length > 0 ? slicers : undefined;
  }
  const next = updateTableObject(ctx, ref, patch);
  // new rows inherit the calculated columns
  const oldEnd = tableAreas(table).dataEnd;
  const { dataEnd } = tableAreas(next);
  if (dataEnd > oldEnd)
    fillCalculatedRows(ctx, sheetId, next, oldEnd + 1, dataEnd);
  applyTableFormatting(ctx, sheetId, next);
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return null;
}

/**
 * The structured references to table `tableName` of every formula of the
 * workbook (cells, names, data validation, conditional formats), bare uses
 * of its name included, rewritten as absolute A1 references. Used when the
 * table goes away but its cells stay (Convert to Range).
 */
export function structuredReferencesToA1(ctx: Context, tableName: string) {
  const ref = findTable(ctx, tableName);
  if (!ref) return 0;
  const upper = ref.table.name.toUpperCase();
  const { range } = ref.table;
  return rewriteWorkbookFormulas(ctx, (formula, site) => {
    const isCell = site.kind === "cell" && site.r != null && site.c != null;
    const env: StructuredRefEnv = {
      ctx,
      sheetId: site.sheetId,
      r: isCell ? site.r! : null,
      c: isCell ? site.c! : null,
    };
    const inside =
      isCell &&
      site.sheetId === ref.sheetId &&
      site.r! >= range.row[0] &&
      site.r! <= range.row[1] &&
      site.c! >= range.column[0] &&
      site.c! <= range.column[1];
    return mapStructuredReferences(formula, (name, content) => {
      if (name != null ? name.toUpperCase() !== upper : !inside) return null;
      return resolveStructuredReference(env, name, content ?? "");
    });
  });
}

/**
 * "Convert to Range": removes the table object (the formatting stays, as in
 * Excel) and rewrites structured references to it as A1 references in every
 * formula of the workbook.
 */
export function convertTableToRange(ctx: Context, tableName: string) {
  if (!checkProtection(ctx, "protected")) return false;
  const ref = findTable(ctx, tableName);
  if (!ref) return false;
  // rewrite formulas first, while the table still resolves
  structuredReferencesToA1(ctx, ref.table.name);
  replaceSheetTables(ctx, ref.sheetId, (list) =>
    list.filter((t) => t.name !== ref.table.name)
  );
  // rows its filters hid (and its slicers) go with the table
  const released = tableFilterRows(ref.table);
  if (!_.isEmpty(released)) syncFilterHiddenRows(ctx, ref.sheetId, released);
  recalculateWorkbook(ctx);
  return true;
}

/* ------------------------------------------------------------------------ */
/* Edits: auto-expansion and header renames                                 */
/* ------------------------------------------------------------------------ */

/**
 * Called after a cell was edited (updateCell). Typing into the row directly
 * below a table (without a total row) or the column directly right of it
 * extends the table (calculated columns fill the new row); editing a header
 * cell renames the column; a formula typed into a data cell can make its
 * column a calculated column. Returns true when a table changed (the
 * workbook was then recalculated).
 */
export function onTableCellEdited(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): boolean {
  ctx.tableAutoCorrect = undefined;
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
      const oldName = table.columns[k].name;
      if (name === oldName) return false;
      let columns = table.columns.map((col, j) =>
        j === k ? { ...col, name } : col
      );
      // formulas follow the renamed column (Excel)
      renameTableColumnReferences(ctx, table.name, oldName, name);
      const upper = table.name.toUpperCase();
      columns =
        renameInStoredFormulas({ ...table, columns }, (formula) =>
          mapStructuredReferences(formula, (tableName, content) => {
            if (content == null) return null;
            if (tableName != null && tableName.toUpperCase() !== upper) {
              return null;
            }
            const next = renameColumnInReference(content, oldName, name);
            return next == null ? null : `${tableName ?? ""}[${next}]`;
          })
        ) ?? columns;
      const slicers = table.slicers?.map((s) =>
        s.column.toUpperCase() === oldName.toUpperCase()
          ? { ...s, column: name }
          : s
      );
      updateTableObject(ctx, ref, slicers ? { columns, slicers } : { columns });
      recalculateWorkbook(ctx);
      return true;
    }
    const { dataStart, dataEnd, total } = tableAreas(table);
    if (r >= dataStart && r <= dataEnd && c >= c1 && c <= c2) {
      return onTableFormulaEdited(ctx, ref, r, c);
    }
    if (r === total && c >= c1 && c <= c2) {
      // a formula typed into the total row is a custom total, text a label
      const k = c - c1;
      const col = table.columns[k];
      if (typeof cell?.f === "string" && cell.f.length > 1) {
        if (cell.f === totalRowFormula(col, table.name)) return false;
        const next: SheetTableColumn = {
          ...col,
          totalFunction: "custom",
          totalFormula: cell.f,
        };
        delete next.totalLabel;
        updateTableObject(ctx, ref, {
          columns: table.columns.map((x, j) => (j === k ? next : x)),
        });
        return true;
      }
      const next: SheetTableColumn = { ...col, totalFunction: "none" };
      delete next.totalFormula;
      const text = cellText(cell);
      if (text) next.totalLabel = text;
      else delete next.totalLabel;
      updateTableObject(ctx, ref, {
        columns: table.columns.map((x, j) => (j === k ? next : x)),
      });
      return true;
    }
    if (!isEmptyCell(cell)) {
      if (!table.totalRow && r === r2 + 1 && c >= c1 && c <= c2) {
        const next = updateTableObject(ctx, ref, {
          range: { row: [r1, r2 + 1], column: [c1, c2] },
        });
        // calculated columns: the new row inherits their formulas
        fillCalculatedRows(ctx, ref.sheetId, next, r, r);
        // copy [@...] formulas of the row above (columns without a
        // calculated formula)
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

type RowColOp =
  | { kind: "insert"; type: "row" | "column"; index: number; count: number }
  | { kind: "delete"; type: "row" | "column"; start: number; end: number };

function spanWithin(span: [number, number], band: [number, number]) {
  return span[0] >= band[0] && span[1] <= band[1];
}

/**
 * The row/column operation `change` amounts to for a table on its sheet,
 * or null when the table is not affected. Inserting/deleting cells acts on
 * a table like inserting/deleting rows (columns) when the table lies
 * entirely in the shifted column (row) band, as in refAdjust.
 */
function rowColOpFor(change: ReferenceChange, range: Span): RowColOp | null {
  switch (change.type) {
    case "insert":
      return {
        kind: "insert",
        type: change.axis,
        index: change.index,
        count: change.count,
      };
    case "delete":
      return {
        kind: "delete",
        type: change.axis,
        start: change.start,
        end: change.end,
      };
    case "insertCells": {
      const { range: at } = change;
      if (change.shift === "down") {
        if (!spanWithin(range.column, at.column)) return null;
        return {
          kind: "insert",
          type: "row",
          index: at.row[0],
          count: at.row[1] - at.row[0] + 1,
        };
      }
      if (!spanWithin(range.row, at.row)) return null;
      return {
        kind: "insert",
        type: "column",
        index: at.column[0],
        count: at.column[1] - at.column[0] + 1,
      };
    }
    case "deleteCells": {
      const { range: at } = change;
      if (change.shift === "up") {
        if (!spanWithin(range.column, at.column)) return null;
        return {
          kind: "delete",
          type: "row",
          start: at.row[0],
          end: at.row[1],
        };
      }
      if (!spanWithin(range.row, at.row)) return null;
      return {
        kind: "delete",
        type: "column",
        start: at.column[0],
        end: at.column[1],
      };
    }
    default:
      return null;
  }
}

/**
 * Whether inserting/deleting the cells of `range` (shifting `shift`) would
 * tear a table apart: the shifted cells of a table must be whole table
 * rows/columns (Excel refuses the operation otherwise).
 */
export function shiftCellsBreaksTable(
  ctx: Context,
  sheetId: string,
  range: Span,
  shift: "down" | "right" | "up" | "left"
) {
  const vertical = shift === "down" || shift === "up";
  const band = vertical ? range.column : range.row;
  const from = vertical ? range.row[0] : range.column[0];
  return getTables(ctx, sheetId).some(({ table }) => {
    const tBand = vertical ? table.range.column : table.range.row;
    const tSpan = vertical ? table.range.row : table.range.column;
    const touchesBand = tBand[1] >= band[0] && tBand[0] <= band[1];
    // only cells from the range start onwards move
    if (!touchesBand || tSpan[1] < from) return false;
    return !spanWithin(tBand, band);
  });
}

type TableSnapshot = { name: string; sheetId: string; range: Span };

function snapshotTables(ctx: Context): TableSnapshot[] {
  const out: TableSnapshot[] = [];
  ctx.luckysheetfile.forEach((sheet) => {
    if (!sheet.id) return;
    sheet.tables?.forEach((t) => {
      out.push({
        name: t.name,
        sheetId: sheet.id!,
        range: {
          row: [t.range.row[0], t.range.row[1]],
          column: [t.range.column[0], t.range.column[1]],
        },
      });
    });
  });
  return out;
}

/** The table (of `tables`) holding the formula cell of `site`. */
function hostTableOf(tables: TableSnapshot[], site: WorkbookFormulaSite) {
  if (site.kind !== "cell" || site.r == null || site.c == null) return null;
  const { r, c } = site;
  return (
    tables.find(
      (t) =>
        t.sheetId === site.sheetId &&
        r >= t.range.row[0] &&
        r <= t.range.row[1] &&
        c >= t.range.column[0] &&
        c <= t.range.column[1]
    ) ?? null
  );
}

/**
 * Structured references to tables that were deleted (all their cells, or
 * their sheet) or to deleted table columns become #REF!, like the A1
 * references they stand for.
 */
function breakStructuredReferences(
  ctx: Context,
  tables: TableSnapshot[],
  deadTables: Set<string>,
  deadColumns: Map<string, Set<string>>
) {
  if (deadTables.size === 0 && deadColumns.size === 0) return;
  const byName = new Map(tables.map((t) => [t.name.toUpperCase(), t]));
  rewriteWorkbookFormulas(ctx, (formula, site) =>
    mapStructuredReferences(formula, (tableName, content) => {
      const table =
        tableName != null
          ? byName.get(tableName.toUpperCase())
          : hostTableOf(tables, site);
      if (!table) return null;
      const upper = table.name.toUpperCase();
      if (deadTables.has(upper)) return REF_ERROR;
      const dead = deadColumns.get(upper);
      if (!dead || content == null) return null;
      const cols = structuredReferenceColumns(content);
      if (
        cols &&
        (dead.has(cols[0].toUpperCase()) || dead.has(cols[1].toUpperCase()))
      ) {
        return REF_ERROR;
      }
      return null;
    })
  );
}

/** Row keys of a rowhidden map after a row insert/delete. */
function shiftRowKeys(
  rows: Record<string, number>,
  change: ReferenceChange
): Record<string, number> {
  if (
    (change.type !== "insert" && change.type !== "delete") ||
    change.axis !== "row"
  ) {
    return rows;
  }
  const out: Record<string, number> = {};
  Object.keys(rows).forEach((k) => {
    const r = Number(k);
    if (change.type === "insert") {
      out[r >= change.index ? r + change.count : r] = rows[k];
    } else if (r < change.start) out[r] = rows[k];
    else if (r > change.end) out[r - (change.end - change.start + 1)] = rows[k];
  });
  return out;
}

/** A slicer anchor after a whole row/column insert or delete. */
function shiftAnchor(index: number, change: ReferenceChange, axis: string) {
  if (change.type === "insert" && change.axis === axis) {
    return index >= change.index ? index + change.count : index;
  }
  if (change.type === "delete" && change.axis === axis) {
    if (index > change.end) return index - (change.end - change.start + 1);
    if (index >= change.start) return change.start;
  }
  return index;
}

/**
 * Table state stored by row or column (filter hidden rows, filter column
 * keys, slicers and their cell anchors) after a structural change; `t` is
 * the table with its new range and columns, `orig` the table before.
 */
function adjustTableState(
  t: SheetTable,
  orig: SheetTable,
  change: ReferenceChange
): SheetTable {
  let out = t;
  if (t.filters) {
    const names = new Map(orig.columns.map((col, i) => [i, col.name]));
    const filters: NonNullable<SheetTable["filters"]> = {};
    Object.entries(t.filters).forEach(([k, f]) => {
      const name = names.get(Number(k));
      const nk = t.columns.findIndex((col, i) =>
        t.columns === orig.columns ? i === Number(k) : col.name === name
      );
      if (nk < 0) return;
      filters[nk] = { ...f, rowhidden: shiftRowKeys(f.rowhidden, change) };
    });
    out = { ...out, filters: _.isEmpty(filters) ? undefined : filters };
  }
  if (t.slicers) {
    const names = new Set(t.columns.map((col) => col.name.toUpperCase()));
    const slicers = t.slicers
      .filter((x) => names.has(x.column.toUpperCase()))
      .map((x) => {
        const r = shiftAnchor(x.r, change, "row");
        const c = shiftAnchor(x.c, change, "column");
        return r === x.r && c === x.c ? x : { ...x, r, c };
      });
    const same =
      slicers.length === t.slicers.length &&
      slicers.every((x, i) => x === t.slicers![i]);
    if (!same) {
      out = { ...out, slicers: slicers.length > 0 ? slicers : undefined };
    }
  }
  return out;
}

/**
 * Keeps tables in sync with a structural change (registered with refAdjust,
 * see modelSync.ts; called once per change, before the cells move):
 *
 * - rows/columns inserted or deleted (and cells inserted or deleted over
 *   whole table rows/columns): the table grows, shrinks or moves; new
 *   columns get unique names (written into the header row once the cells
 *   have moved); a deleted header/total row turns that option off;
 * - cells moved (cut/paste, drag): a table inside the moved block moves
 *   with it, to another sheet too;
 * - a table whose cells are all deleted, or whose sheet is deleted, is
 *   removed and structured references to it become #REF! (so do references
 *   to deleted table columns).
 */
export function adjustTablesForChange(
  ctx: Context,
  change: ReferenceChange
): (() => void) | undefined {
  if (change.type === "renameSheet") return undefined;
  const before = snapshotTables(ctx);
  if (before.length === 0) return undefined;
  const deadTables = new Set<string>();
  const deadColumns = new Map<string, Set<string>>();
  const headerWrites: {
    sheetId: string;
    r: number;
    c: number;
    text: string;
  }[] = [];

  if (change.type === "deleteSheet") {
    before.forEach((t) => {
      if (t.sheetId === change.sheetId) deadTables.add(t.name.toUpperCase());
    });
    breakStructuredReferences(ctx, before, deadTables, deadColumns);
    return undefined;
  }

  if (change.type === "move") {
    const source = sheetById(ctx, change.sheetId);
    const target = sheetById(ctx, change.toSheetId);
    if (!source?.tables?.length || !target) return undefined;
    const dr = change.toRow - change.range.row[0];
    const dc = change.toColumn - change.range.column[0];
    const moved: SheetTable[] = [];
    const staying: SheetTable[] = [];
    source.tables.forEach((t) => {
      const inside =
        spanWithin(t.range.row, change.range.row) &&
        spanWithin(t.range.column, change.range.column);
      if (!inside) {
        staying.push(t);
        return;
      }
      moved.push({
        ...t,
        range: {
          row: [t.range.row[0] + dr, t.range.row[1] + dr],
          column: [t.range.column[0] + dc, t.range.column[1] + dc],
        },
      });
    });
    if (moved.length === 0) return undefined;
    if (source === target) {
      source.tables = [...staying, ...moved];
    } else {
      if (staying.length > 0) source.tables = staying;
      else delete source.tables;
      target.tables = [...(target.tables ?? []), ...moved];
    }
    return undefined;
  }

  const sheet = sheetById(ctx, change.sheetId);
  if (!sheet?.tables?.length) return undefined;
  const next: SheetTable[] = [];
  let changed = false;
  sheet.tables.forEach((t) => {
    const op = rowColOpFor(change, t.range);
    if (!op) {
      next.push(t);
      return;
    }
    const key = op.type === "row" ? "row" : "column";
    const span = t.range[key];
    if (op.kind === "insert") {
      const nextSpan = shiftSpanInsert(span, op.index, op.count);
      if (nextSpan[0] === span[0] && nextSpan[1] === span[1]) {
        next.push(t);
        return;
      }
      changed = true;
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
        if (t.headerRow) {
          for (let i = at; i < at + op.count; i += 1) {
            headerWrites.push({
              sheetId: change.sheetId,
              r: t.range.row[0],
              c: span[0] + i,
              text: columns[i].name,
            });
          }
        }
      }
      next.push({ ...t, columns, range: { ...t.range, [key]: nextSpan } });
      return;
    }
    const nextSpan = shiftSpanDelete(span, op.start, op.end);
    if (nextSpan && nextSpan[0] === span[0] && nextSpan[1] === span[1]) {
      next.push(t);
      return;
    }
    changed = true;
    if (!nextSpan) {
      // the whole table was deleted
      deadTables.add(t.name.toUpperCase());
      return;
    }
    const inDeleted = (x: number) => x >= op.start && x <= op.end;
    if (key === "column") {
      const gone = t.columns.filter((_col, i) => inDeleted(span[0] + i));
      if (gone.length > 0) {
        deadColumns.set(
          t.name.toUpperCase(),
          new Set(gone.map((col) => col.name.toUpperCase()))
        );
      }
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
  // filters, slicers and calculated columns follow the change
  const calcFills: { name: string; from: number; to: number }[] = [];
  const originals = new Map(sheet.tables.map((t) => [t.name, t]));
  const final = next.map((t) => {
    const orig = originals.get(t.name)!;
    const out = adjustTableState(t, orig, change);
    if (out !== t) changed = true;
    if (
      change.type === "insert" &&
      change.axis === "row" &&
      out.columns.some((col) => col.calculatedFormula)
    ) {
      const { dataStart, dataEnd } = tableAreas(out);
      const from = Math.max(change.index, dataStart);
      const to = Math.min(change.index + change.count - 1, dataEnd);
      if (from <= to && change.index > orig.range.row[0]) {
        calcFills.push({ name: out.name, from, to });
      }
    }
    return out;
  });
  // references are rewritten while the old table ranges still resolve
  // unqualified references ([@Col]) of cells inside the tables
  breakStructuredReferences(ctx, before, deadTables, deadColumns);
  if (changed) {
    if (final.length > 0) sheet.tables = final;
    else delete sheet.tables;
  }
  if (headerWrites.length === 0 && calcFills.length === 0) return undefined;
  return () => {
    headerWrites.forEach(({ sheetId, r, c, text }) => {
      const data = sheetById(ctx, sheetId)?.data;
      if (data) writeText(data, r, c, text);
    });
    // inserted rows inherit the calculated columns
    calcFills.forEach(({ name, from, to }) => {
      const table = sheetById(ctx, change.sheetId)?.tables?.find(
        (t) => t.name === name
      );
      if (table) fillCalculatedRows(ctx, change.sheetId, table, from, to);
    });
  };
}

/**
 * Tables of a duplicated sheet get new, unique names (Excel appends a
 * number); structured references to them in the copy's own formulas follow.
 * Returns the renames (old name -> new name).
 */
export function renameDuplicatedTables(
  ctx: Context,
  copy: Sheet
): Map<string, string> {
  const renames = new Map<string, string>();
  if (!copy.tables?.length) return renames;
  const taken = new Set<string>();
  getNameIndex(ctx).entries.forEach((e) => taken.add(e.name.toUpperCase()));
  tableIndexOf(ctx).forEach((_t, upper) => taken.add(upper));
  const slicerNames = new Set<string>();
  copy.tables = copy.tables.map((t) => {
    let n = 2;
    let name = `${t.name}${n}`;
    while (taken.has(name.toUpperCase())) {
      n += 1;
      name = `${t.name}${n}`;
    }
    taken.add(name.toUpperCase());
    renames.set(t.name.toUpperCase(), name);
    // slicer names are workbook-unique too
    const slicers = t.slicers?.map((x) => {
      const slicerName = uniqueSlicerName(ctx, x.name, slicerNames);
      slicerNames.add(slicerName.toUpperCase());
      return { ...x, name: slicerName };
    });
    return slicers ? { ...t, name, slicers } : { ...t, name };
  });
  const rename = (formula: string) =>
    mapStructuredReferences(formula, (tableName, content) => {
      if (tableName == null) return null;
      const next = renames.get(tableName.toUpperCase());
      if (!next) return null;
      return content == null ? next : `${next}[${content}]`;
    });
  const visit = (cell: Cell | null | undefined) => {
    if (typeof cell?.f === "string" && cell.f.length > 1) {
      const f = rename(cell.f);
      if (f !== cell.f) cell.f = f;
    }
  };
  if (copy.data) copy.data.forEach((row) => row?.forEach((c) => visit(c)));
  else copy.celldata?.forEach((d) => visit(d.v as Cell));
  return renames;
}
