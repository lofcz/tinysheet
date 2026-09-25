/**
 * Defined names (Excel's Name Manager).
 *
 * Storage. Names are part of the workbook JSON: every sheet may carry a
 * `definedNames` array. Entries with `local: true` are scoped to the sheet
 * that stores them; the others are workbook-scoped and are normally stored on
 * the first sheet (they are collected from every sheet, so reordering sheets
 * is harmless; deleting the storing sheet moves them, see
 * `moveWorkbookNamesBeforeSheetDelete`).
 *
 * Evaluation. Before a formula is parsed, `expandFormulaNames` rewrites the
 * formula text (never the stored formula): a name that refers to a reference
 * is replaced by the reference itself (`SUM(Sales)` -> `SUM(Sheet1!$B$2:$B$9)`,
 * so reference-taking functions such as ROW, INDEX or OFFSET keep working),
 * any other definition by its parenthesised formula (`Rate*2` -> `(0.2)*2`),
 * a LAMBDA name called as a function by the parenthesised LAMBDA
 * (`Double(3)` -> `(LAMBDA(x,x*2))(3)`), and structured references to tables
 * by A1 references (see tables.ts). The same expansion feeds the dependency
 * graph (`getNameDependencies`), so formulas are recalculated when a name's
 * target cells change; changing a definition invalidates the graph and
 * recalculates the workbook (`recalculateWorkbook`).
 *
 * Relative references (Excel semantics). A reference without `$` in a
 * definition is relative to the cell that uses the name: `=Sheet1!A1`
 * defined while B2 is active means "the cell one row up and one column
 * left" (see `saveDefinedName`). Definitions are stored as seen from cell
 * A1, which is also how xlsx files store them (Excel writes that name as
 * `Sheet1!XFD1048576`: offsets wrap around the grid), and are shifted to
 * the using cell when a formula is expanded (`offsetRelativeReferences`).
 * The Name Manager shows them as seen from the active cell
 * (`refersToForActiveCell`). Structural changes move only the absolute
 * parts of name references; relative parts are offsets and stay.
 */
import _ from "lodash";
import { Context, getFlowdata } from "../context";
import type { DefinedName, FormulaDependency, Sheet } from "../types";
import { columnCharToIndex, indexToColumnChar } from "../utils";
import { peek } from "./dependencyGraph";
import { execFunctionGroup, execfunction, groupValuesRefresh } from "./formula";
import { invalidateDependencyGraph } from "./formulaHelper";
import { setSelectionRange } from "./navigation";
import { extractStaticReferences, quoteSheetName } from "./formulaFunctions";
import type { StructuredRefEnv } from "./tables";
import { resolveStructuredReference, tableIndexOf } from "./tables";
import {
  formatRef,
  getFormulaReferences,
  parseRef,
  ParsedRef,
  ReferenceAdjusterApi,
  ReferenceChange,
  transformReferences,
} from "./refAdjust";

/* ------------------------------------------------------------------------ */
/* Types                                                                    */
/* ------------------------------------------------------------------------ */

/** A defined name together with where it lives. */
export type DefinedNameEntry = DefinedName & {
  /** id of the sheet storing the entry */
  sheetId: string;
  /** scope: the sheet id for sheet-scoped names, null for workbook names */
  scope: string | null;
  /** the definition has references relative to the using cell */
  relative?: boolean;
};

export type NameValidationError =
  | "empty"
  | "tooLong"
  | "invalidChars"
  | "cellReference"
  | "reserved"
  | "duplicate";

export type NameRange = {
  sheetId: string;
  row: [number, number];
  column: [number, number];
};

/* ------------------------------------------------------------------------ */
/* Sheet helpers                                                            */
/* ------------------------------------------------------------------------ */

function sheetsOf(ctx: Context): Sheet[] {
  return (peek(peek(ctx).luckysheetfile) as Sheet[]) ?? [];
}

/** Sheet id by (case-insensitive) sheet name. */
export function sheetIdByName(ctx: Context, name: string): string | null {
  const lower = name.toLowerCase();
  const files = sheetsOf(ctx);
  for (let i = 0; i < files.length; i += 1) {
    const f = peek(files[i]);
    if ((f?.name ?? "").toLowerCase() === lower) return f.id ?? null;
  }
  return null;
}

export function sheetNameById(ctx: Context, id: string): string | null {
  const files = sheetsOf(ctx);
  for (let i = 0; i < files.length; i += 1) {
    const f = peek(files[i]);
    if (f?.id === id) return f.name;
  }
  return null;
}

function sheetArrayIndex(ctx: Context, id: string) {
  return ctx.luckysheetfile.findIndex((f) => f.id === id);
}

/** A1 text of a rectangle, absolute, with a quoted sheet prefix. */
export function absoluteRangeText(
  sheetName: string | null,
  r1: number,
  c1: number,
  r2: number,
  c2: number
) {
  const a = `$${indexToColumnChar(c1)}$${r1 + 1}`;
  const b = `$${indexToColumnChar(c2)}$${r2 + 1}`;
  const prefix = sheetName == null ? "" : `${quoteSheetName(sheetName)}!`;
  return r1 === r2 && c1 === c2 ? `${prefix}${a}` : `${prefix}${a}:${b}`;
}

/* ------------------------------------------------------------------------ */
/* Name index (memoised on the identity of the per-sheet arrays)            */
/* ------------------------------------------------------------------------ */

type NameIndex = {
  key: any[];
  workbook: Map<string, DefinedNameEntry>;
  local: Map<string, Map<string, DefinedNameEntry>>;
  entries: DefinedNameEntry[];
  /** true when the workbook has neither names nor tables */
  empty: boolean;
  /** some name has references relative to the using cell */
  relative: boolean;
  /** memo of expanded formulas */
  expanded: Map<string, string>;
  deps: Map<string, FormulaDependency[]>;
};

const indexes = new WeakMap<object, NameIndex>();

function indexKey(ctx: Context) {
  const files = sheetsOf(ctx);
  const key: any[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = peek(files[i]);
    key.push(f?.id, f?.name, peek(f?.definedNames), peek(f?.tables));
  }
  return key;
}

function sameKey(a: any[], b: any[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function getNameIndex(ctx: Context): NameIndex {
  const owner = ctx.formulaCache as object;
  const key = indexKey(ctx);
  const cached = indexes.get(owner);
  if (cached && sameKey(cached.key, key)) return cached;
  const workbook = new Map<string, DefinedNameEntry>();
  const local = new Map<string, Map<string, DefinedNameEntry>>();
  const entries: DefinedNameEntry[] = [];
  let hasTables = false;
  let relative = false;
  const files = sheetsOf(ctx);
  for (let i = 0; i < files.length; i += 1) {
    const f = peek(files[i]);
    if (!f?.id) continue;
    if ((peek(f.tables)?.length ?? 0) > 0) hasTables = true;
    const list = peek(f.definedNames) ?? [];
    for (let j = 0; j < list.length; j += 1) {
      const d = peek(list[j]);
      if (!d?.name) continue;
      const entry: DefinedNameEntry = {
        ...d,
        sheetId: f.id,
        scope: d.local ? f.id : null,
      };
      // eslint-disable-next-line no-use-before-define
      if (hasRelativeReferences(d.refersTo)) {
        entry.relative = true;
        relative = true;
      }
      const upper = d.name.toUpperCase();
      if (d.local) {
        let m = local.get(f.id);
        if (!m) {
          m = new Map();
          local.set(f.id, m);
        }
        if (!m.has(upper)) {
          m.set(upper, entry);
          entries.push(entry);
        }
      } else if (!workbook.has(upper)) {
        workbook.set(upper, entry);
        entries.push(entry);
      }
    }
  }
  const index: NameIndex = {
    key,
    workbook,
    local,
    entries,
    empty: entries.length === 0 && !hasTables,
    relative,
    expanded: new Map(),
    deps: new Map(),
  };
  indexes.set(owner, index);
  return index;
}

/** Every defined name of the workbook (hidden ones included). */
export function getDefinedNames(ctx: Context): DefinedNameEntry[] {
  return getNameIndex(ctx).entries.slice();
}

/**
 * The name `name` as seen from a formula on sheet `sheetId`: the sheet's own
 * name first, then the workbook name.
 */
export function findDefinedName(
  ctx: Context,
  name: string,
  sheetId?: string | null
): DefinedNameEntry | null {
  const index = getNameIndex(ctx);
  const upper = name.toUpperCase();
  if (sheetId != null) {
    const own = index.local.get(sheetId)?.get(upper);
    if (own) return own;
  }
  return index.workbook.get(upper) ?? null;
}

/* ------------------------------------------------------------------------ */
/* Validation                                                               */
/* ------------------------------------------------------------------------ */

const NAME_RE = /^[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*$/;
const MAX_COLS = 16384;
const MAX_ROWS = 1048576;

/** True for texts Excel reads as a cell reference (A1, xfd1048576, R1C1, R, C). */
export function looksLikeCellReference(text: string) {
  const a1 = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(text);
  if (a1) {
    const c = columnCharToIndex(a1[1].toUpperCase());
    const r = parseInt(a1[2], 10);
    if (c < MAX_COLS && r >= 1 && r <= MAX_ROWS) return true;
  }
  if (/^[RrCc]$/.test(text)) return true;
  if (/^[Rr](\d*|\[-?\d+\])([Cc](\d*|\[-?\d+\]))?$/.test(text)) return true;
  if (/^[Cc](\d+|\[-?\d+\])$/.test(text)) return true;
  return false;
}

/**
 * Checks `name` against Excel's naming rules: starts with a letter, `_` or
 * `\`; then letters, digits, `.`, `_`, `\` or `?`; at most 255 characters;
 * not a cell reference; unique (case-insensitively) within its scope and
 * among table names. `exclude` is the entry being renamed.
 */
export function validateDefinedName(
  ctx: Context,
  name: string,
  scope?: string | null,
  exclude?: { name: string; scope: string | null }
): NameValidationError | null {
  const n = (name ?? "").trim();
  if (!n) return "empty";
  if (n.length > 255) return "tooLong";
  if (!NAME_RE.test(n)) return "invalidChars";
  if (looksLikeCellReference(n)) return "cellReference";
  const upper = n.toUpperCase();
  if (upper === "TRUE" || upper === "FALSE") return "reserved";
  const isExcluded = (entry: { name: string; scope: string | null }) =>
    exclude != null &&
    exclude.scope === entry.scope &&
    exclude.name.toUpperCase() === entry.name.toUpperCase();
  const index = getNameIndex(ctx);
  const clash =
    scope == null
      ? index.workbook.get(upper)
      : index.local.get(scope)?.get(upper);
  if (clash && !isExcluded(clash)) return "duplicate";
  const table = tableIndexOf(ctx).get(upper);
  if (table && !(exclude && exclude.name.toUpperCase() === upper)) {
    return "duplicate";
  }
  return null;
}

/**
 * Turns arbitrary text (a header cell) into a valid name, like Excel's
 * "Create from Selection": spaces and invalid characters become `_`, a
 * leading digit or a cell-like result gets a `_` prefix.
 */
export function sanitizeName(text: string): string {
  let n = String(text ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_.\\?À-￿]/g, "_");
  if (!n) return "";
  if (!/^[A-Za-z_\\À-￿]/.test(n)) n = `_${n}`;
  if (looksLikeCellReference(n) || /^(TRUE|FALSE)$/i.test(n)) n = `_${n}`;
  return n.slice(0, 255);
}

/* ------------------------------------------------------------------------ */
/* Formula scanning                                                         */
/* ------------------------------------------------------------------------ */

const SHEET_PART = "(?:[A-Za-z0-9_.\\u00C0-\\uFFFF]+|'(?:[^']|'')+')!";
const CELL_PART = "\\$?[A-Za-z]{1,3}\\$?\\d+";
const REF_BODY = `(?:${SHEET_PART})?(?:${CELL_PART}(?::(?:${SHEET_PART})?${CELL_PART})?|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3}|\\$?\\d+:\\$?\\d+)`;
const REF_AT = new RegExp(
  `${REF_BODY}(?![A-Za-z0-9_.(!\\[\\u00C0-\\uFFFF])`,
  "y"
);
const PURE_REF = new RegExp(`^${REF_BODY}$`);
const NUMBER_AT = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ERROR_AT = /#[A-Za-z0-9/]+[!?]?/y;
const IDENT_START = /[A-Za-z_\\À-￿]/;
const IDENT_AT = /[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*/y;

function matchSticky(re: RegExp, s: string, i: number) {
  re.lastIndex = i;
  const m = re.exec(s);
  return m ? m[0] : null;
}

/** End index (exclusive) of a quoted run starting at i. */
function quotedEnd(s: string, i: number, quote: string) {
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
 * End index (exclusive) of a structured-reference bracket group starting at
 * `i` (a `[`), honouring nesting and `'` escapes. -1 when unbalanced.
 */
export function bracketEnd(s: string, i: number) {
  let depth = 0;
  let j = i;
  while (j < s.length) {
    const ch = s[j];
    if (ch === "'") j += 2;
    else {
      if (ch === "[") depth += 1;
      else if (ch === "]") {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
      j += 1;
    }
  }
  return -1;
}

export function isPureReference(text: string) {
  return PURE_REF.test(text.trim());
}

function isLambdaDefinition(refersTo: string) {
  return /^=?\s*(?:_xlfn\.)?LAMBDA\s*\(/i.test(refersTo);
}

function nextNonSpace(s: string, i: number) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j += 1;
  return s[j];
}

type ScanEnv = {
  ctx: Context;
  index: NameIndex;
  sheetId: string;
  r: number | null;
  c: number | null;
  /** entries being expanded (cycle guard) */
  stack: Set<DefinedNameEntry>;
};

const NAME_ERROR = "#NAME?";
const MAX_DEPTH = 32;

function findEntry(env: ScanEnv, upper: string) {
  const own = env.index.local.get(env.sheetId)?.get(upper);
  if (own) return own;
  return env.index.workbook.get(upper) ?? null;
}

function expandEntry(entry: DefinedNameEntry, env: ScanEnv): string {
  if (env.stack.has(entry) || env.stack.size >= MAX_DEPTH) return NAME_ERROR;
  let body = entry.refersTo.trim();
  if (body.startsWith("=")) body = body.slice(1).trim();
  if (!body) return NAME_ERROR;
  // relative references are offsets from the cell using the name
  if (entry.relative && (env.r || env.c)) {
    // eslint-disable-next-line no-use-before-define
    body = offsetRelativeReferences(body, env.r ?? 0, env.c ?? 0);
  }
  if (isPureReference(body)) return body;
  env.stack.add(entry);
  try {
    // eslint-disable-next-line no-use-before-define
    const inner = scan(body, {
      ...env,
      // names inside a sheet-scoped definition resolve from its sheet
      sheetId: entry.scope ?? env.sheetId,
    });
    return `(${inner})`;
  } finally {
    env.stack.delete(entry);
  }
}

type Frame = { name: string | null; arg: number };

function scan(s: string, env: ScanEnv): string {
  let out = "";
  let i = 0;
  const frames: Frame[] = [];
  const shadowed = new Set<string>();
  let lastIdent: string | null = null;
  while (i < s.length) {
    const ch = s[i];
    const identBefore = lastIdent;
    lastIdent = null;
    if (ch === '"') {
      const end = quotedEnd(s, i, '"');
      out += s.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "[") {
      const end = bracketEnd(s, i);
      if (end < 0) {
        out += s.slice(i);
        break;
      }
      out += resolveStructuredReference(
        env as StructuredRefEnv,
        null,
        s.slice(i + 1, end - 1)
      );
      i = end;
      continue;
    }
    const ref = matchSticky(REF_AT, s, i);
    if (ref) {
      out += ref;
      i += ref.length;
      continue;
    }
    if (ch === "'") {
      const end = quotedEnd(s, i, "'");
      if (s[end] === "!") {
        const sheetName = s.slice(i + 1, end - 1).replace(/''/g, "'");
        // eslint-disable-next-line no-use-before-define
        const res = qualified(s, end + 1, sheetName, env);
        if (res) {
          out += res.text;
          i = res.end;
          continue;
        }
      }
      out += s.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "#") {
      const err = matchSticky(ERROR_AT, s, i);
      if (err) {
        out += err;
        i += err.length;
        continue;
      }
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      const num = matchSticky(NUMBER_AT, s, i);
      if (num) {
        out += num;
        i += num.length;
        continue;
      }
    }
    if (IDENT_START.test(ch)) {
      const ident = matchSticky(IDENT_AT, s, i)!;
      const end = i + ident.length;
      const next = s[end];
      if (next === "!") {
        // eslint-disable-next-line no-use-before-define
        const res = qualified(s, end + 1, ident, env);
        if (res) {
          out += res.text;
          i = res.end;
          continue;
        }
        out += ident;
        i = end;
        continue;
      }
      if (next === "[") {
        const bEnd = bracketEnd(s, end);
        if (bEnd > 0) {
          out += resolveStructuredReference(
            env as StructuredRefEnv,
            ident,
            s.slice(end + 1, bEnd - 1)
          );
          i = bEnd;
          continue;
        }
      }
      const upper = ident.toUpperCase();
      if (next === "(") {
        const entry = shadowed.has(upper) ? null : findEntry(env, upper);
        if (entry && isLambdaDefinition(entry.refersTo)) {
          out += expandEntry(entry, env);
        } else {
          out += ident;
        }
        lastIdent = upper;
        i = end;
        continue;
      }
      const frame = frames[frames.length - 1];
      const after = nextNonSpace(s, end);
      if (
        frame &&
        after === "," &&
        ((frame.name === "LET" && frame.arg % 2 === 0) ||
          frame.name === "LAMBDA")
      ) {
        // LET variable / LAMBDA parameter: shadows names from here on
        shadowed.add(upper);
        out += ident;
        i = end;
        continue;
      }
      if (!shadowed.has(upper)) {
        const entry = findEntry(env, upper);
        if (entry) {
          out += expandEntry(entry, env);
          i = end;
          continue;
        }
        if (tableIndexOf(env.ctx).has(upper)) {
          // a bare table name means its data rows (Table1 = Table1[])
          out += resolveStructuredReference(env as StructuredRefEnv, ident, "");
          i = end;
          continue;
        }
      }
      out += ident;
      i = end;
      continue;
    }
    if (ch === "(") {
      frames.push({
        name: identBefore ? identBefore.replace(/^_XLFN\./, "") : null,
        arg: 0,
      });
    } else if (ch === "{") {
      frames.push({ name: "{", arg: 0 });
    } else if (ch === ")" || ch === "}") {
      frames.pop();
    } else if (ch === "," || ch === ";") {
      const frame = frames[frames.length - 1];
      if (frame) frame.arg += 1;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** `Sheet!Name` (the sheet part already consumed); null when not a name. */
function qualified(
  s: string,
  start: number,
  sheetName: string,
  env: ScanEnv
): { text: string; end: number } | null {
  const ident = matchSticky(IDENT_AT, s, start);
  if (!ident) return null;
  const end = start + ident.length;
  if (s[end] === "!" || s[end] === "(") return null;
  const sheetId = sheetIdByName(env.ctx, sheetName);
  if (sheetId == null) return { text: "#REF!", end };
  const upper = ident.toUpperCase();
  const entry =
    env.index.local.get(sheetId)?.get(upper) ?? env.index.workbook.get(upper);
  if (!entry) return null;
  return { text: expandEntry(entry, { ...env, sheetId }), end };
}

/**
 * Rewrites defined names and structured references of `expr` (a formula
 * without the leading "=") into plain formula text, for a formula at
 * (r, c) of sheet `sheetId`. Returns `expr` itself when there is nothing to
 * rewrite.
 */
export function expandFormulaNames(
  ctx: Context,
  expr: string,
  sheetId: string,
  r?: number | null,
  c?: number | null
): string {
  if (!expr) return expr;
  const index = getNameIndex(ctx);
  if (index.empty) return expr;
  // [@Col] and relative names depend on the formula's cell
  const positional = index.relative || expr.indexOf("[") > -1;
  const key = positional
    ? `${sheetId}|${r}|${c}|${expr}`
    : `${sheetId}|${expr}`;
  const hit = index.expanded.get(key);
  if (hit != null) return hit;
  const out = scan(expr, {
    ctx,
    index,
    sheetId,
    r: r ?? null,
    c: c ?? null,
    stack: new Set(),
  });
  if (index.expanded.size > 20000) index.expanded.clear();
  index.expanded.set(key, out);
  return out;
}

/**
 * True when a formula uses defined names or structured references (it may
 * then depend on other sheets).
 */
export function formulaUsesNames(
  ctx: Context,
  formula: string,
  sheetId: string
): boolean {
  const index = getNameIndex(ctx);
  if (index.empty || !formula) return false;
  if (formula.indexOf("[") > -1) return true;
  const expr = formula.startsWith("=") ? formula.slice(1) : formula;
  return expandFormulaNames(ctx, expr, sheetId) !== expr;
}

/**
 * Extra dependencies of a formula cell that come from names and structured
 * references (the cells they refer to).
 */
export function getNameDependencies(
  ctx: Context,
  formula: string,
  sheetId: string,
  r?: number | null,
  c?: number | null
): FormulaDependency[] {
  const index = getNameIndex(ctx);
  if (index.empty || !formula) return [];
  const expr = formula.startsWith("=") ? formula.slice(1) : formula;
  const expanded = expandFormulaNames(ctx, expr, sheetId, r, c);
  if (expanded === expr) return [];
  const key = `${sheetId}|${expanded}`;
  let deps = index.deps.get(key);
  if (!deps) {
    deps = extractStaticReferences(ctx, expanded, sheetId);
    index.deps.set(key, deps);
  }
  return deps;
}

/* ------------------------------------------------------------------------ */
/* Definitions                                                              */
/* ------------------------------------------------------------------------ */

/** Whether a reference has a part without `$`. */
function isRelativeRef(ref: ParsedRef) {
  const rowsRelative = ref.kind !== "cols" && (!ref.ar1 || !ref.ar2);
  const colsRelative = ref.kind !== "rows" && (!ref.ac1 || !ref.ac2);
  return rowsRelative || colsRelative;
}

/** Whether a definition has references relative to the using cell. */
export function hasRelativeReferences(refersTo: string) {
  if (typeof refersTo !== "string" || !/[A-Za-z]|\d:\d/.test(refersTo)) {
    return false;
  }
  return getFormulaReferences(refersTo).some(isRelativeRef);
}

function wrap(v: number, size: number) {
  return ((v % size) + size) % size;
}

/**
 * Moves the relative parts of every reference of `formula` by (dr, dc),
 * wrapping around the grid like Excel's relative names (a reference one
 * row above A1 is row 1048576). Absolute parts are kept.
 */
export function offsetRelativeReferences(
  formula: string,
  dr: number,
  dc: number
): string {
  if (!formula || (!dr && !dc)) return formula;
  return transformReferences(formula, (ref) => {
    if (!isRelativeRef(ref)) return null;
    const next = { ...ref };
    if (ref.kind !== "cols") {
      if (!ref.ar1) next.r1 = wrap(ref.r1 + dr, MAX_ROWS);
      if (!ref.ar2) next.r2 = wrap(ref.r2 + dr, MAX_ROWS);
    }
    if (ref.kind !== "rows") {
      if (!ref.ac1) next.c1 = wrap(ref.c1 + dc, MAX_COLS);
      if (!ref.ac2) next.c2 = wrap(ref.c2 + dc, MAX_COLS);
    }
    if (ref.kind === "cell") {
      next.r2 = next.r1;
      next.c2 = next.c1;
    }
    return next;
  });
}

/** The active cell (the selection's focus) of the current sheet. */
export function activeCellOf(ctx: Context): { r: number; c: number } {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return { r: 0, c: 0 };
  return {
    r: last.row_focus ?? last.row?.[0] ?? 0,
    c: last.column_focus ?? last.column?.[0] ?? 0,
  };
}

/**
 * A stored definition as Excel's Name Manager shows it: relative
 * references as seen from the active cell (or `base`).
 */
export function refersToForActiveCell(
  ctx: Context,
  refersTo: string,
  base: { r: number; c: number } = activeCellOf(ctx)
) {
  return offsetRelativeReferences(refersTo, base.r, base.c);
}

/** One reference typed in a definition, qualified and made A1-relative. */
function normalizeReference(
  text: string,
  sheetName: string | null,
  base: { r: number; c: number }
) {
  const ref = parseRef(text);
  if (!ref) return text;
  let withSheet = ref;
  if (ref.sheet == null && sheetName != null) {
    withSheet = {
      ...ref,
      prefix: `${quoteSheetName(sheetName)}!`,
      sheet: sheetName,
    };
  }
  const out = formatRef(withSheet);
  return offsetRelativeReferences(`=${out}`, -base.r, -base.c).slice(1);
}

/**
 * Normalises a definition typed by the user: adds the leading "=",
 * qualifies unqualified references with the sheet `sheetId` (`=$A$1:$B$2`
 * on Sheet1 -> `=Sheet1!$A$1:$B$2`), and stores relative references as seen
 * from A1 when they were typed with `base` as the active cell (`=A1` typed
 * at B2 -> `=Sheet1!XFD1048576`, i.e. one row up and one column left of the
 * using cell). Plain text that is not a formula becomes a constant (`abc`
 * -> `="abc"`, `12` -> `=12`).
 */
export function normalizeRefersTo(
  ctx: Context,
  text: string,
  sheetId: string,
  base: { r: number; c: number } = { r: 0, c: 0 }
): string {
  let t = String(text ?? "").trim();
  if (!t) return "";
  if (!t.startsWith("=")) {
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return `=${t}`;
    if (/^(TRUE|FALSE)$/i.test(t)) return `=${t.toUpperCase()}`;
    return `="${t.replace(/"/g, '""')}"`;
  }
  t = t.slice(1).trim();
  const sheetName = sheetNameById(ctx, sheetId);
  let out = "";
  let i = 0;
  while (i < t.length) {
    const ch = t[i];
    if (ch === '"' || ch === "'") {
      let end = quotedEnd(t, i, ch);
      if (ch === "'" && t[end] === "!") {
        // 'Sheet name'!A1 or 'Sheet name'!Name: keep the qualified part
        const ref = matchSticky(REF_AT, t, i);
        if (ref) {
          out += normalizeReference(ref, sheetName, base);
          i += ref.length;
          continue;
        }
        const rest = matchSticky(IDENT_AT, t, end + 1) ?? "";
        end += 1 + rest.length;
      }
      out += t.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "[") {
      const end = bracketEnd(t, i);
      const stop = end < 0 ? t.length : end;
      out += t.slice(i, stop);
      i = stop;
      continue;
    }
    const ref = matchSticky(REF_AT, t, i);
    if (ref) {
      out += normalizeReference(ref, sheetName, base);
      i += ref.length;
      continue;
    }
    const ident = IDENT_START.test(ch) ? matchSticky(IDENT_AT, t, i) : null;
    if (ident) {
      out += ident;
      i += ident.length;
      // skip a sheet-qualified part verbatim
      if (t[i] === "!") {
        const rest =
          matchSticky(REF_AT, t, i + 1) ??
          matchSticky(IDENT_AT, t, i + 1) ??
          "";
        out += `!${rest}`;
        i += 1 + rest.length;
      }
      continue;
    }
    const num = matchSticky(NUMBER_AT, t, i);
    if (num) {
      out += num;
      i += num.length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return `=${out}`;
}

/**
 * Parses `A1`, `B2:D9`, `Sheet2!C3`, `'My Sheet'!A:A`, `3:5` into a sheet
 * range (whole columns/rows span the sheet's current size).
 */
export function parseRangeText(
  ctx: Context,
  text: string,
  defaultSheetId: string
): NameRange | null {
  const t = text.trim();
  const m = /^(?:(?:'((?:[^']|'')+)'|([A-Za-z0-9_.À-￿]+))!)?(.+)$/.exec(t);
  if (!m) return null;
  let sheetId: string | null = defaultSheetId;
  const sheetName = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
  if (sheetName != null) sheetId = sheetIdByName(ctx, sheetName);
  if (sheetId == null) return null;
  const body = m[3].replace(/\$/g, "");
  const sheet = sheetsOf(ctx).find((f) => peek(f)?.id === sheetId);
  const data = peek(peek(sheet)?.data);
  const rows = Math.max(data?.length ?? 0, 1);
  const cols = Math.max(peek(data?.[0])?.length ?? 0, 1);
  let cm = /^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/.exec(body);
  if (cm) {
    const c1 = columnCharToIndex(cm[1].toUpperCase());
    const r1 = parseInt(cm[2], 10) - 1;
    const c2 = cm[3] ? columnCharToIndex(cm[3].toUpperCase()) : c1;
    const r2 = cm[4] ? parseInt(cm[4], 10) - 1 : r1;
    if (r1 < 0 || r2 < 0 || c1 >= MAX_COLS || c2 >= MAX_COLS) return null;
    return {
      sheetId,
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  cm = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(body);
  if (cm) {
    const c1 = columnCharToIndex(cm[1].toUpperCase());
    const c2 = columnCharToIndex(cm[2].toUpperCase());
    if (c1 >= MAX_COLS || c2 >= MAX_COLS) return null;
    return {
      sheetId,
      row: [0, rows - 1],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  cm = /^(\d+):(\d+)$/.exec(body);
  if (cm) {
    const r1 = parseInt(cm[1], 10) - 1;
    const r2 = parseInt(cm[2], 10) - 1;
    if (r1 < 0 || r2 < 0) return null;
    return {
      sheetId,
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [0, cols - 1],
    };
  }
  return null;
}

/** The range a name refers to, when its definition is a single reference. */
export function resolveNameRange(
  ctx: Context,
  name: string,
  sheetId?: string | null
): NameRange | null {
  const entry = findDefinedName(ctx, name, sheetId);
  if (!entry) return null;
  let body = entry.relative
    ? refersToForActiveCell(ctx, entry.refersTo).trim()
    : entry.refersTo.trim();
  if (body.startsWith("=")) body = body.slice(1).trim();
  if (!isPureReference(body)) return null;
  return parseRangeText(
    ctx,
    body,
    entry.scope ?? sheetId ?? ctx.currentSheetId
  );
}

/**
 * The name (or table name) whose reference is exactly `range`, if any —
 * for the Name Box. Sheet-scoped names of the sheet win.
 */
export function nameOfRange(ctx: Context, range: NameRange): string | null {
  const index = getNameIndex(ctx);
  if (index.empty) return null;
  const same = (x: NameRange | null) =>
    x != null &&
    x.sheetId === range.sheetId &&
    x.row[0] === range.row[0] &&
    x.row[1] === range.row[1] &&
    x.column[0] === range.column[0] &&
    x.column[1] === range.column[1];
  const candidates = index.entries
    .filter((e) => !e.hidden && (e.scope == null || e.scope === range.sheetId))
    .sort((a, b) => (a.scope == null ? 1 : 0) - (b.scope == null ? 1 : 0));
  for (let i = 0; i < candidates.length; i += 1) {
    const e = candidates[i];
    let body = e.refersTo.trim();
    if (body.startsWith("=")) body = body.slice(1);
    if (isPureReference(body)) {
      if (same(parseRangeText(ctx, body, e.scope ?? range.sheetId))) {
        return e.name;
      }
    }
  }
  let tableName: string | null = null;
  tableIndexOf(ctx).forEach(({ sheetId, table }) => {
    if (
      !tableName &&
      same({
        sheetId,
        row: table.range.row,
        column: table.range.column,
      })
    ) {
      tableName = table.name;
    }
  });
  return tableName;
}

/* ------------------------------------------------------------------------ */
/* Mutations                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Re-derive every formula after names or tables changed: the dependency
 * graph is rebuilt (static dependencies include name targets) and all
 * formulas are recalculated.
 */
export function recalculateWorkbook(ctx: Context) {
  invalidateDependencyGraph(ctx);
  const fc = ctx.formulaCache;
  fc.execFunctionGlobalData = {};
  execFunctionGroup(
    ctx,
    null as any,
    null as any,
    null,
    undefined,
    undefined,
    true
  );
  groupValuesRefresh(ctx);
  fc.execFunctionGlobalData = null;
}

function storageSheetIndex(ctx: Context, scope: string | null) {
  if (scope != null) return sheetArrayIndex(ctx, scope);
  // workbook names live next to the existing ones, else on the first sheet
  const files = ctx.luckysheetfile;
  for (let i = 0; i < files.length; i += 1) {
    if (files[i].definedNames?.some((d) => !d.local)) return i;
  }
  return files.length > 0 ? 0 : -1;
}

export type DefinedNameInput = {
  name: string;
  refersTo: string;
  /** sheet id for a sheet-scoped name, null/undefined for the workbook */
  scope?: string | null;
  comment?: string;
  hidden?: boolean;
};

function removeEntry(ctx: Context, name: string, scope: string | null) {
  const upper = name.toUpperCase();
  let removed = false;
  ctx.luckysheetfile.forEach((f) => {
    if (!f.definedNames?.length) return;
    if (scope != null && f.id !== scope) return;
    const next = f.definedNames.filter(
      (d) => !(d.name.toUpperCase() === upper && !!d.local === (scope != null))
    );
    if (next.length !== f.definedNames.length) {
      removed = true;
      if (next.length > 0) f.definedNames = next;
      else delete f.definedNames;
    }
  });
  return removed;
}

/**
 * Adds a defined name (or replaces the one being edited, `previous`).
 * Returns the validation error, or null on success. The definition is
 * normalised relative to `sheetId` (default: the current sheet): relative
 * references are taken as typed with `base` active (default: the active
 * cell when `sheetId` is the current sheet, else A1), as in Excel's Name
 * Manager.
 */
export function saveDefinedName(
  ctx: Context,
  input: DefinedNameInput,
  previous?: { name: string; scope: string | null },
  options: {
    sheetId?: string;
    recalculate?: boolean;
    base?: { r: number; c: number };
  } = {}
): NameValidationError | "emptyDefinition" | null {
  const scope = input.scope ?? null;
  const err = validateDefinedName(ctx, input.name, scope, previous);
  if (err) return err;
  const sheetId = options.sheetId ?? ctx.currentSheetId;
  const base =
    options.base ??
    (sheetId === ctx.currentSheetId ? activeCellOf(ctx) : { r: 0, c: 0 });
  const refersTo = normalizeRefersTo(ctx, input.refersTo, sheetId, base);
  if (!refersTo) return "emptyDefinition";
  if (previous) removeEntry(ctx, previous.name, previous.scope);
  const idx = storageSheetIndex(ctx, scope);
  if (idx < 0) return "emptyDefinition";
  const entry: DefinedName = { name: input.name.trim(), refersTo };
  if (scope != null) entry.local = true;
  if (input.comment) entry.comment = input.comment;
  if (input.hidden) entry.hidden = true;
  const sheet = ctx.luckysheetfile[idx];
  sheet.definedNames = [...(sheet.definedNames ?? []), entry];
  if (options.recalculate !== false) recalculateWorkbook(ctx);
  return null;
}

/** Deletes a defined name; returns false when it does not exist. */
export function deleteDefinedName(
  ctx: Context,
  name: string,
  scope: string | null = null,
  options: { recalculate?: boolean } = {}
) {
  const removed = removeEntry(ctx, name, scope);
  if (removed && options.recalculate !== false) recalculateWorkbook(ctx);
  return removed;
}

/**
 * Excel's "Create Names from Selection": names taken from the top row, left
 * column, bottom row and/or right column of `range` refer to the rest of the
 * corresponding column/row. Existing names are replaced. Returns the names
 * created.
 */
export function createNamesFromSelection(
  ctx: Context,
  range: NameRange,
  options: { top?: boolean; left?: boolean; bottom?: boolean; right?: boolean }
): string[] {
  const { sheetId } = range;
  const sheet = ctx.luckysheetfile.find((f) => f.id === sheetId);
  const sheetName = sheet?.name ?? null;
  const data = peek(sheet?.data);
  if (!data) return [];
  let [r1, r2] = range.row;
  let [c1, c2] = range.column;
  const text = (r: number, c: number) => {
    const cell = peek(peek(data[r])?.[c]);
    const v = cell?.m ?? cell?.v;
    return v == null ? "" : String(v);
  };
  const created: string[] = [];
  const define = (
    label: string,
    a: number,
    b: number,
    c: number,
    d: number
  ) => {
    const name = sanitizeName(label);
    if (!name || a > c || b > d) return;
    removeEntry(ctx, name, null);
    const err = saveDefinedName(
      ctx,
      {
        name,
        refersTo: `=${absoluteRangeText(sheetName, a, b, c, d)}`,
      },
      undefined,
      { sheetId, recalculate: false }
    );
    if (!err) created.push(name);
  };
  const top = !!options.top && r2 > r1;
  const bottom = !!options.bottom && r2 - (top ? 1 : 0) > r1;
  const left = !!options.left && c2 > c1;
  const right = !!options.right && c2 - (left ? 1 : 0) > c1;
  const headRow = r1;
  const footRow = r2;
  const headCol = c1;
  const footCol = c2;
  if (top) r1 += 1;
  if (bottom) r2 -= 1;
  if (left) c1 += 1;
  if (right) c2 -= 1;
  for (let c = c1; c <= c2; c += 1) {
    if (top) define(text(headRow, c), r1, c, r2, c);
    if (bottom) define(text(footRow, c), r1, c, r2, c);
  }
  for (let r = r1; r <= r2; r += 1) {
    if (left) define(text(r, headCol), r, c1, r, c2);
    if (right) define(text(r, footCol), r, c1, r, c2);
  }
  if (created.length > 0) recalculateWorkbook(ctx);
  return created;
}

/**
 * Keeps workbook-scoped names alive when the sheet storing them is deleted
 * (called by deleteSheet before the sheet is removed).
 */
export function moveWorkbookNamesBeforeSheetDelete(
  ctx: Context,
  sheetId: string
) {
  const idx = sheetArrayIndex(ctx, sheetId);
  if (idx < 0) return;
  const sheet = ctx.luckysheetfile[idx];
  const global = (sheet.definedNames ?? []).filter((d) => !d.local);
  if (global.length === 0) return;
  const target = ctx.luckysheetfile.find((f, i) => i !== idx);
  if (!target) return;
  target.definedNames = [...(target.definedNames ?? []), ...global];
}

/**
 * Whether a reference of a name definition points at fixed cells for
 * `change`. References whose affected coordinates are relative (`A1` in a
 * name, see "Relative references" above) are offsets from the cell using
 * the name, so moving cells does not change them.
 */
function followsChange(ref: ParsedRef, change: ReferenceChange) {
  const rowsFixed = ref.kind === "cols" || (ref.ar1 && ref.ar2);
  const colsFixed = ref.kind === "rows" || (ref.ac1 && ref.ac2);
  switch (change.type) {
    case "insert":
    case "delete":
      return change.axis === "row" ? rowsFixed : colsFixed;
    case "renameSheet":
    case "deleteSheet":
      return true;
    default:
      return rowsFixed && colsFixed;
  }
}

/**
 * Rewrite one name definition for a structural change: absolute references
 * follow their cells (and become #REF! when deleted), sheet renames and
 * deletions apply to every reference.
 */
export function rewriteNameDefinition(
  refersTo: string,
  hostSheetId: string,
  change: ReferenceChange,
  rewrite: (formula: string, host: string) => string
): string {
  return transformReferences(refersTo, (ref) => {
    if (!followsChange(ref, change)) return null;
    const text = `=${formatRef(ref)}`;
    const out = rewrite(text, hostSheetId);
    if (out === text) return null;
    if (out.indexOf("#REF!") >= 0) return "#REF!";
    return parseRef(out.slice(1));
  });
}

/**
 * Keeps defined names pointing at the same cells for every structural
 * change (rows/columns/cells inserted or deleted, cells moved, sheets
 * renamed or deleted). Registered with refAdjust (see modelSync.ts), so it
 * runs exactly once per change.
 */
export function adjustNamesForChange(
  ctx: Context,
  change: ReferenceChange,
  api: Pick<ReferenceAdjusterApi, "rewriteFormula">
) {
  ctx.luckysheetfile.forEach((f) => {
    if (!f.definedNames?.length || f.id == null) return;
    const deleted = change.type === "deleteSheet" && f.id === change.sheetId;
    let changed = false;
    const next = f.definedNames.map((d) => {
      // names scoped to a deleted sheet go away with it; workbook names
      // stored there are moved to another sheet (deleteSheet)
      if (deleted && d.local) return d;
      if (typeof d.refersTo !== "string" || !d.refersTo) return d;
      const refersTo = rewriteNameDefinition(
        d.refersTo,
        f.id!,
        change,
        api.rewriteFormula
      );
      if (refersTo === d.refersTo) return d;
      changed = true;
      return { ...d, refersTo };
    });
    // a new array: the name index is memoised on its identity
    if (changed) f.definedNames = next;
  });
}

/* ------------------------------------------------------------------------ */
/* Display helpers                                                          */
/* ------------------------------------------------------------------------ */

function formatScalar(v: any): string {
  if (v == null) return "";
  if (v instanceof Error) return v.message;
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

/**
 * The current value of a defined name as Excel's Name Manager shows it:
 * `5`, `"text"`, `{1,2;3,4}` for ranges and arrays (truncated), `#REF!`.
 */
export function evaluateDefinedName(
  ctx: Context,
  entry: DefinedNameEntry,
  maxLength = 60
): string {
  if (isLambdaDefinition(entry.refersTo)) return "LAMBDA";
  const sheetId = entry.scope ?? ctx.currentSheetId;
  // evaluate on a shallow copy: the context may be frozen (React state)
  const tmp = { ...ctx } as Context;
  // relative references: as seen from the active cell (Excel)
  const formula = entry.relative
    ? refersToForActiveCell(ctx, entry.refersTo)
    : entry.refersTo;
  let res: any[];
  try {
    res = execfunction(
      tmp,
      formula,
      null as any,
      null as any,
      sheetId,
      undefined,
      false,
      true
    );
  } catch {
    return "#NAME?";
  }
  const v = res[1];
  let text: string;
  if (Array.isArray(v)) {
    const rows = (Array.isArray(v[0]) ? v : [v]) as any[][];
    text = `{${rows
      .map((row) => row.map((x) => formatScalar(x)).join(","))
      .join(";")}}`;
  } else {
    text = formatScalar(v);
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

/** Names to offer in formula autocomplete (tables included). */
export function getNameCandidates(
  ctx: Context
): { n: string; d: string; kind: "name" | "lambda" | "table" }[] {
  const out: { n: string; d: string; kind: "name" | "lambda" | "table" }[] = [];
  const index = getNameIndex(ctx);
  if (index.empty) return out;
  const seen = new Set<string>();
  const current = ctx.currentSheetId;
  index.entries.forEach((e) => {
    if (e.hidden) return;
    if (e.scope != null && e.scope !== current) return;
    const upper = e.name.toUpperCase();
    if (seen.has(upper)) return;
    seen.add(upper);
    out.push({
      n: e.name,
      d: e.comment || e.refersTo,
      kind: isLambdaDefinition(e.refersTo) ? "lambda" : "name",
    });
  });
  tableIndexOf(ctx).forEach(({ table, sheetId }) => {
    const sheetName = sheetNameById(ctx, sheetId);
    out.push({
      n: table.name,
      d: absoluteRangeText(
        sheetName,
        table.range.row[0],
        table.range.column[0],
        table.range.row[1],
        table.range.column[1]
      ),
      kind: "table",
    });
  });
  return out;
}

export { isLambdaDefinition };

/** Workbook-level helper for tests and the API: all names as plain objects. */
export function listDefinedNames(ctx: Context) {
  return getDefinedNames(ctx)
    .filter((e) => !e.hidden)
    .map((e) => _.pick(e, ["name", "refersTo", "scope", "comment"]));
}

/* ------------------------------------------------------------------------ */
/* Name Box                                                                 */
/* ------------------------------------------------------------------------ */

/** The last selection of the current sheet as a NameRange. */
export function selectionAsNameRange(ctx: Context): NameRange | null {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return null;
  return {
    sheetId: ctx.currentSheetId,
    row: [last.row[0], last.row[1]],
    column: [last.column[0], last.column[1]],
  };
}

/**
 * Selects `range` (switching sheets when needed). Returns true when the
 * sheet changed (the caller may scroll again once the sheet is rendered).
 */
export function goToNameRange(ctx: Context, range: NameRange): boolean {
  const idx = sheetArrayIndex(ctx, range.sheetId);
  if (idx < 0) return false;
  const switching = range.sheetId !== ctx.currentSheetId;
  if (switching) {
    const sheet = ctx.luckysheetfile[idx];
    if (ctx.sheetScrollRecord) {
      ctx.sheetScrollRecord[ctx.currentSheetId] = {
        scrollLeft: ctx.scrollLeft,
        scrollTop: ctx.scrollTop,
        luckysheet_select_status: ctx.luckysheet_select_status,
        luckysheet_select_save: ctx.luckysheet_select_save,
        luckysheet_selection_range: ctx.luckysheet_selection_range,
      };
    }
    ctx.currentSheetId = range.sheetId;
    ctx.config = sheet.config ?? {};
    ctx.zoomRatio = sheet.zoomRatio || 1;
  }
  const data = getFlowdata(ctx);
  const rows = data?.length ?? 0;
  const cols = data?.[0]?.length ?? 0;
  setSelectionRange(
    ctx,
    { row: range.row, column: range.column },
    range.row[0],
    range.column[0],
    {
      columnSelect: range.row[0] === 0 && range.row[1] >= rows - 1,
      rowSelect: range.column[0] === 0 && range.column[1] >= cols - 1,
    }
  );
  if (switching && ctx.sheetScrollRecord) {
    // the sheet tab restores this record when the new sheet is shown
    ctx.sheetScrollRecord[range.sheetId] = {
      scrollLeft: 0,
      scrollTop: 0,
      luckysheet_select_status: false,
      luckysheet_select_save: ctx.luckysheet_select_save,
      luckysheet_selection_range: [],
    };
  }
  return switching;
}

export type NameBoxResult =
  | { kind: "goto"; range: NameRange }
  | { kind: "define"; name: string }
  | { kind: "error" };

/**
 * Interprets text typed into the Name Box: a defined name or table, a
 * reference (`A1`, `B2:D9`, `Sheet2!C3`, `C:C`, `3:5`) or a new valid name
 * (to be defined for the current selection).
 */
export function resolveNameBoxInput(ctx: Context, text: string): NameBoxResult {
  const t = text.trim();
  if (!t) return { kind: "error" };
  const sheetId = ctx.currentSheetId;
  const named = resolveNameRange(ctx, t, sheetId);
  if (named) return { kind: "goto", range: named };
  const table = tableIndexOf(ctx).get(t.toUpperCase());
  if (table) {
    return {
      kind: "goto",
      range: {
        sheetId: table.sheetId,
        row: table.table.range.row,
        column: table.table.range.column,
      },
    };
  }
  const ref = parseRangeText(ctx, t, sheetId);
  if (ref) return { kind: "goto", range: ref };
  if (findDefinedName(ctx, t, sheetId)) return { kind: "error" };
  if (validateDefinedName(ctx, t, null) == null) {
    return { kind: "define", name: t };
  }
  return { kind: "error" };
}

/** Defines `name` (workbook scope) for the current selection. */
export function defineNameForSelection(ctx: Context, name: string) {
  const range = selectionAsNameRange(ctx);
  if (!range) return "emptyDefinition" as const;
  return saveDefinedName(ctx, {
    name,
    refersTo: `=${absoluteRangeText(
      sheetNameById(ctx, range.sheetId),
      range.row[0],
      range.column[0],
      range.row[1],
      range.column[1]
    )}`,
  });
}
