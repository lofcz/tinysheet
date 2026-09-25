/**
 * Formula editor helpers: tokenizing formula text while it is being typed,
 * function autocomplete ranking, argument hints, F4 reference cycling,
 * colour-coded references, bracket matching and plain-value autocomplete.
 *
 * The first half of this file is pure string logic (unit tested in
 * `packages/core/test/formulaEditor`). The second half contains small DOM
 * helpers used by the in-cell editor and the formula bar, which are both
 * `contenteditable` elements rendering the HTML produced by
 * {@link formulaTextToHTML}.
 */
import type { Context } from "../context";
import type { Cell, CellMatrix } from "../types";
import { locale } from "../locale";
import { getNameCandidates } from "./names";
import { escapeColumnName, findTable, tableAt } from "./tables";

/* -------------------------------------------------------------------------- */
/*                                  Tokenizer                                 */
/* -------------------------------------------------------------------------- */

export type FormulaTokenType =
  | "operator"
  | "function"
  | "lparen"
  | "rparen"
  | "comma"
  | "string"
  | "reference"
  | "number"
  | "bool"
  | "error"
  | "array"
  | "name"
  | "whitespace"
  | "unknown";

export type FormulaToken = {
  type: FormulaTokenType;
  text: string;
  /** offset of the first character (inclusive) */
  start: number;
  /** offset after the last character (exclusive) */
  end: number;
};

const SHEET_PREFIX = "(?:'(?:[^']|'')*'|[A-Za-z0-9_.\\u00C0-\\uFFFF]+)!";
const CELL = "\\$?[A-Za-z]{1,3}\\$?[0-9]+";
const COL = "\\$?[A-Za-z]{1,3}";
const ROW = "\\$?[0-9]+";
const REFERENCE_RE = new RegExp(
  `(?:${SHEET_PREFIX})?(?:${CELL}(?::${CELL})?|${COL}:${COL}|${ROW}:${ROW})(?![A-Za-z0-9_.(!\\u00C0-\\uFFFF])`,
  "y"
);
// sticky regexes are built with the RegExp constructor so the sources also
// type-check with an ES5 target
const sticky = (re: RegExp) => new RegExp(re.source, "y");
const NUMBER_RE = sticky(/(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/);
const IDENT_RE = sticky(/[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*/);
const ERROR_RE = sticky(
  /#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|GETTING_DATA)/
);
const WHITESPACE_RE = sticky(/\s+/);
const OPERATOR_RE = sticky(/<>|<=|>=|[-+*/^&=<>%:]/);

// order matters: `A1` is a reference before it is an identifier
const MATCHERS: [FormulaTokenType | "ident", RegExp][] = [
  ["whitespace", WHITESPACE_RE],
  ["error", ERROR_RE],
  ["reference", REFERENCE_RE],
  ["number", NUMBER_RE],
  ["ident", IDENT_RE],
  ["operator", OPERATOR_RE],
];

function matchAt(
  text: string,
  pos: number
): [FormulaTokenType | "ident", string] | null {
  for (let k = 0; k < MATCHERS.length; k += 1) {
    const [type, re] = MATCHERS[k];
    re.lastIndex = pos;
    const m = re.exec(text);
    if (m) return [type, m[0]];
  }
  return null;
}

/**
 * Splits formula text (with or without the leading `=`) into tokens. The
 * tokenizer is lenient: it never throws and every character of the input ends
 * up in exactly one token, so offsets can be mapped back to the editor.
 */
export function tokenizeFormula(text: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let i = 0;
  const push = (type: FormulaTokenType, len: number) => {
    tokens.push({ type, text: text.slice(i, i + len), start: i, end: i + len });
    i += len;
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      // string literal, `""` is an escaped quote; unterminated runs to the end
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') j += 2;
          else {
            j += 1;
            break;
          }
        } else j += 1;
      }
      if (j > text.length) j = text.length;
      push("string", j - i);
    } else if (ch === "{") {
      // array constant, commas inside do not separate arguments
      let j = i + 1;
      let inStr = false;
      while (j < text.length) {
        if (text[j] === '"') inStr = !inStr;
        else if (text[j] === "}" && !inStr) {
          j += 1;
          break;
        }
        j += 1;
      }
      push("array", Math.min(j, text.length) - i);
    } else if (ch === "(") {
      push("lparen", 1);
    } else if (ch === ")") {
      push("rparen", 1);
    } else if (ch === ",") {
      push("comma", 1);
    } else {
      const hit = matchAt(text, i);
      if (!hit) push("unknown", 1);
      else if (hit[0] !== "ident") push(hit[0], hit[1].length);
      else if (text[i + hit[1].length] === "(") push("function", hit[1].length);
      else if (/^(TRUE|FALSE)$/i.test(hit[1])) push("bool", hit[1].length);
      else push("name", hit[1].length);
    }
  }
  return tokens;
}

/* -------------------------------------------------------------------------- */
/*                         Call context / argument index                      */
/* -------------------------------------------------------------------------- */

export type FormulaCallContext = {
  /** function name as typed (not upper-cased) */
  name: string;
  /** zero-based index of the argument the caret is in */
  argIndex: number;
  /** offset of the `(` that opens the call */
  lparen: number;
};

/**
 * Returns the innermost function call enclosing `caret`, and which argument
 * the caret is in. Commas inside nested calls, strings, array constants and
 * plain parentheses are not counted.
 */
export function getCallContext(
  text: string,
  caret: number,
  tokens: FormulaToken[] = tokenizeFormula(text)
): FormulaCallContext | null {
  const stack: { name: string | null; argIndex: number; lparen: number }[] = [];
  let prev: FormulaToken | null = null;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.end > caret) break;
    if (t.type === "lparen") {
      stack.push({
        name: prev?.type === "function" ? prev.text : null,
        argIndex: 0,
        lparen: t.start,
      });
    } else if (t.type === "comma") {
      if (stack.length > 0) stack[stack.length - 1].argIndex += 1;
    } else if (t.type === "rparen") {
      stack.pop();
    }
    prev = t;
  }
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const frame = stack[i];
    if (frame.name) {
      return {
        name: frame.name,
        argIndex: frame.argIndex,
        lparen: frame.lparen,
      };
    }
  }
  return null;
}

type FunctionParam = { name: string; require?: string; repeat?: string };

/**
 * Maps an argument index to the index of the parameter describing it,
 * taking repeating parameter groups (`value1, [value2], ...`) into account.
 * Returns -1 when the function takes fewer arguments.
 */
export function resolveParamIndex(
  params: FunctionParam[] | undefined,
  argIndex: number
) {
  if (!params || params.length === 0) return -1;
  if (argIndex < params.length) return argIndex;
  const repeatStart = params.findIndex((p) => p.repeat === "y");
  if (repeatStart < 0) return -1;
  const groupLen = params.length - repeatStart;
  return repeatStart + ((argIndex - repeatStart) % groupLen);
}

/* -------------------------------------------------------------------------- */
/*                            Function autocomplete                           */
/* -------------------------------------------------------------------------- */

export type FunctionQuery = { query: string; start: number; end: number };

/**
 * Returns the (partial) function name ending at `caret`, e.g. `SU` in
 * `=IF(SU|`, or null when the caret is not at the end of an identifier in a
 * formula.
 */
export function getFunctionQuery(
  text: string,
  caret: number,
  tokens: FormulaToken[] = tokenizeFormula(text)
): FunctionQuery | null {
  if (!text.startsWith("=")) return null;
  let idx = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].start < caret && caret <= tokens[i].end) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const t = tokens[idx];
  if (t.end !== caret) return null;
  const isNameLike =
    t.type === "name" ||
    t.type === "function" ||
    t.type === "bool" ||
    (t.type === "reference" && /^[A-Za-z]+[0-9]+$/.test(t.text));
  if (!isNameLike) return null;
  // `A1:B` - the identifier is the end of a range, not a function
  let p = idx - 1;
  while (p >= 0 && tokens[p].type === "whitespace") p -= 1;
  if (p >= 0 && tokens[p].type === "operator" && tokens[p].text === ":") {
    return null;
  }
  return { query: t.text.toUpperCase(), start: t.start, end: t.end };
}

export type RankedFunction<T> = {
  item: T;
  /** 0 exact, 1 prefix, 2 prefix of a dotted segment, 3 substring, 4 fuzzy */
  tier: number;
  /** [start, end) character ranges of the name that matched the query */
  matches: [number, number][];
};

const POPULAR_FUNCTIONS = [
  "SUM",
  "IF",
  "AVERAGE",
  "COUNT",
  "COUNTA",
  "COUNTIF",
  "COUNTIFS",
  "SUMIF",
  "SUMIFS",
  "SUMPRODUCT",
  "VLOOKUP",
  "XLOOKUP",
  "INDEX",
  "MATCH",
  "MAX",
  "MIN",
  "ROUND",
  "IFERROR",
  "AND",
  "OR",
  "NOT",
  "CONCAT",
  "TEXT",
  "LEFT",
  "RIGHT",
  "MID",
  "LEN",
  "TODAY",
  "NOW",
  "DATE",
  "ABS",
  "FILTER",
  "UNIQUE",
  "SORT",
];
const POPULARITY: Record<string, number> = {};
POPULAR_FUNCTIONS.forEach((n, i) => {
  POPULARITY[n] = i;
});

function fuzzyMatch(name: string, query: string): [number, number][] | null {
  if (name[0] !== query[0]) return null;
  const matches: [number, number][] = [];
  let qi = 0;
  for (let i = 0; i < name.length && qi < query.length; i += 1) {
    if (name[i] === query[qi]) {
      const last = matches[matches.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else matches.push([i, i + 1]);
      qi += 1;
    }
  }
  return qi === query.length ? matches : null;
}

/**
 * Ranks function names against a typed query: exact match first, then
 * prefix matches, then prefix of a dotted segment (`DIST` → `NORM.S.DIST`),
 * then substring and finally subsequence matches. Popular functions are
 * listed first within a tier, the rest alphabetically.
 */
export function rankFunctions<T extends { n: string }>(
  list: T[],
  rawQuery: string,
  limit = 12
): RankedFunction<T>[] {
  const query = rawQuery.toUpperCase();
  if (!query) return [];
  // `A1` could be the start of a cell reference - only offer prefix matches
  const refLike = /^[A-Z]+[0-9]+$/.test(query);
  const seen = new Set<string>();
  const ranked: RankedFunction<T>[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const name = (item.n || "").toUpperCase();
    if (!name || seen.has(name)) continue;

    let tier = -1;
    let matches: [number, number][] = [];
    if (name === query) {
      tier = 0;
      matches = [[0, query.length]];
    } else if (name.startsWith(query)) {
      tier = 1;
      matches = [[0, query.length]];
    } else {
      let segStart = -1;
      for (let j = 1; j < name.length; j += 1) {
        if (
          (name[j - 1] === "." || name[j - 1] === "_") &&
          name.startsWith(query, j)
        ) {
          segStart = j;
          break;
        }
      }
      if (segStart >= 0) {
        tier = 2;
        matches = [[segStart, segStart + query.length]];
      } else if (!refLike && query.length >= 2) {
        const idx = name.indexOf(query);
        if (idx >= 0) {
          tier = 3;
          matches = [[idx, idx + query.length]];
        } else if (query.length >= 3) {
          const fm = fuzzyMatch(name, query);
          if (fm) {
            tier = 4;
            matches = fm;
          }
        }
      }
    }
    if (tier >= 0) {
      seen.add(name);
      ranked.push({ item, tier, matches });
    }
  }

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const na = a.item.n.toUpperCase();
    const nb = b.item.n.toUpperCase();
    const pa = POPULARITY[na] ?? Infinity;
    const pb = POPULARITY[nb] ?? Infinity;
    if (pa !== pb) return pa - pb;
    if (a.tier === 4 && na.length !== nb.length) return na.length - nb.length;
    if (na === nb) return 0;
    return na < nb ? -1 : 1;
  });
  return ranked.slice(0, limit);
}

/**
 * Returns the text and caret after accepting function `name` for the
 * identifier being typed at `caret` (`=IF(SU|` → `=IF(SUM(|`).
 */
export function insertFunctionName(
  text: string,
  caret: number,
  name: string,
  /** text typed after the name: "(" for functions, "" for defined names */
  suffix = "("
): { text: string; caret: number } {
  const q = getFunctionQuery(text, caret);
  const start = q ? q.start : caret;
  const end = q ? q.end : caret;
  const skip = suffix !== "" && text.startsWith(suffix, end);
  const before = start === 0 && !text.startsWith("=") ? "=" : "";
  const newText = `${text.slice(0, start)}${before}${name}${
    skip ? "" : suffix
  }${text.slice(end)}`;
  return {
    text: newText,
    caret: start + before.length + name.length + suffix.length,
  };
}

export function getFunctionListMap(ctx: Context): Record<string, any> {
  const map = ctx.formulaCache.functionlistMap;
  if (map && Object.keys(map).length > 0) return map;
  const { functionlist } = locale(ctx);
  for (let i = 0; i < functionlist.length; i += 1) {
    ctx.formulaCache.functionlistMap[functionlist[i].n] = functionlist[i];
  }
  return ctx.formulaCache.functionlistMap;
}

/* -------------------------------------------------------------------------- */
/*        Extra candidates (defined names, tables, sheets, table columns)     */
/* -------------------------------------------------------------------------- */

/** Text inserted after an accepted candidate, by upper-cased name. */
const candidateSuffixes = new Map<string, string>();
/** Text inserted instead of the name (a quoted sheet name), by name. */
const candidateTexts = new Map<string, string>();

/** A sheet name as written in a reference: quoted when it has to be. */
export function sheetNameForReference(name: string) {
  const plain =
    /^[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*$/.test(name) &&
    // names that read as a cell (A1) or R1C1 reference, or a boolean
    !/^[A-Za-z]{1,3}[0-9]+$/.test(name) &&
    !/^(R[0-9]*C?[0-9]*|C[0-9]*|TRUE|FALSE)$/i.test(name);
  return plain ? name : `'${name.replace(/'/g, "''")}'`;
}

function visibleSheetNames(ctx: Context) {
  return (ctx.luckysheetfile || [])
    .filter((f) => f && !f.hide && f.name)
    .map((f) => f.name);
}

/**
 * Autocomplete candidates besides the function list: defined names (plain
 * insert), LAMBDA names (`Name(`), tables (`Table1[`) and sheets
 * (`Sheet2!`, `'My Sheet'!`).
 */
export function getExtraFormulaCandidates(
  ctx: Context
): { n: string; d: string; t: string }[] {
  candidateSuffixes.clear();
  candidateTexts.clear();
  const out: { n: string; d: string; t: string }[] = getNameCandidates(ctx).map(
    (c) => {
      let suffix = "";
      if (c.kind === "table") suffix = "[";
      else if (c.kind === "lambda") suffix = "(";
      candidateSuffixes.set(c.n.toUpperCase(), suffix);
      return { n: c.n, d: c.d, t: c.kind };
    }
  );
  const functions = getFunctionListMap(ctx);
  const { formulaMore } = locale(ctx);
  visibleSheetNames(ctx).forEach((name) => {
    const upper = name.toUpperCase();
    // a function or name of the same name wins
    if (functions[upper] || candidateSuffixes.has(upper)) return;
    candidateSuffixes.set(upper, "!");
    candidateTexts.set(upper, sheetNameForReference(name));
    out.push({ n: name, d: formulaMore.sheetCandidate, t: "sheet" });
  });
  return out;
}

export type CompletionQuery =
  | {
      /** a column of a table: `Table1[Co|`, `[@Co|` inside a table */
      kind: "tableColumn";
      /** table name before the `[` (null: the table being edited in) */
      table: string | null;
      /** `[@`: this row's value */
      thisRow: boolean;
      query: string;
      /** span replaced by the accepted column */
      start: number;
      end: number;
    }
  | {
      /** a quoted sheet name: `='My Sh|` */
      kind: "sheet";
      query: string;
      start: number;
      end: number;
    };

const STRUCTURED_QUERY_RE =
  /(?:^|[^A-Za-z0-9_.À-￿\]'])([A-Za-z_À-￿][A-Za-z0-9_.À-￿]*)?\[(@?)((?:[^[\]'#@]|'.)*|#[A-Za-z ]*)$/;
const QUOTED_SHEET_QUERY_RE = /(?:^=|[=(,;:+\-*/^&<>\s])'((?:[^']|'')*)$/;

/**
 * What is being completed at `caret` besides function and name identifiers:
 * a table column after `Table1[` (or after `[` / `[@` in a table), or a
 * sheet name after an opening quote. Null inside strings.
 */
export function getCompletionQuery(
  text: string,
  caret: number
): CompletionQuery | null {
  if (!text.startsWith("=") || caret < 1 || caret > text.length) return null;
  const before = text.slice(0, caret);
  // inside a string literal
  if ((before.match(/"/g)?.length ?? 0) % 2 === 1) return null;
  const s = STRUCTURED_QUERY_RE.exec(before);
  if (s) {
    const query = s[3];
    return {
      kind: "tableColumn",
      table: s[1] ?? null,
      thisRow: s[2] === "@",
      query,
      start: caret - query.length,
      end: caret,
    };
  }
  const q = QUOTED_SHEET_QUERY_RE.exec(before);
  if (q) {
    return {
      kind: "sheet",
      query: q[1].replace(/''/g, "'"),
      start: caret - q[1].length - 1,
      end: caret,
    };
  }
  return null;
}

export type CompletionItem = {
  /** shown name */
  n: string;
  /** description */
  d: string;
  /** kind: "column", "special", "sheet" */
  t: string;
  /** text replacing the query span */
  insert: string;
};

/** The table the edited cell is in (for `[@Column]`), if any. */
function editedCellTable(ctx: Context) {
  const [r, c] = ctx.luckysheetCellUpdate ?? [];
  if (r == null || c == null) return null;
  const sheetId = ctx.editState?.sheetId ?? ctx.currentSheetId;
  return tableAt(ctx, sheetId, r, c);
}

/** The candidates for a {@link CompletionQuery}, in list order. */
export function getCompletionItems(
  ctx: Context,
  q: CompletionQuery
): CompletionItem[] {
  const { formulaMore } = locale(ctx);
  if (q.kind === "sheet") {
    return visibleSheetNames(ctx).map((name) => ({
      n: name,
      d: formulaMore.sheetCandidate,
      t: "sheet",
      insert: `'${name.replace(/'/g, "''")}'!`,
    }));
  }
  const ref = q.table ? findTable(ctx, q.table) : editedCellTable(ctx);
  if (!ref) return [];
  const { table } = ref;
  const close = "]";
  const items: CompletionItem[] = table.columns.map((col) => ({
    n: col.name,
    d: `${table.name}[${escapeColumnName(col.name)}]`,
    t: "column",
    insert: `${escapeColumnName(col.name)}${close}`,
  }));
  if (!q.thisRow && q.table) {
    const specials: [string, string, boolean][] = [
      ["#All", formulaMore.tableAll, true],
      ["#Data", formulaMore.tableData, true],
      ["#Headers", formulaMore.tableHeaders, table.headerRow],
      ["#Totals", formulaMore.tableTotals, table.totalRow],
    ];
    specials.forEach(([n, d, ok]) => {
      if (ok) items.push({ n, d, t: "special", insert: `${n}${close}` });
    });
    items.push({
      n: "@",
      d: formulaMore.tableThisRow,
      t: "special",
      insert: "@",
    });
  }
  return items;
}

/** Filters and ranks completion items for the typed query. */
function rankCompletionItems(items: CompletionItem[], query: string) {
  if (!query) {
    return items.map((item) => ({ item, matches: [] as [number, number][] }));
  }
  return rankFunctions(items, query, 50).map((r) => ({
    item: r.item,
    matches: r.matches,
  }));
}

/**
 * Text ranges of the arguments of the call whose `(` is at `lparen`
 * (surrounding spaces trimmed; an empty argument is an empty range).
 */
export function getCallArgumentRanges(
  text: string,
  lparen: number,
  tokens: FormulaToken[] = tokenizeFormula(text)
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let depth = 0;
  let argStart = -1;
  const close = (end: number) => {
    let s = argStart;
    let e = end;
    while (s < e && /\s/.test(text[s])) s += 1;
    while (e > s && /\s/.test(text[e - 1])) e -= 1;
    ranges.push({ start: s, end: e });
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.start < lparen) continue;
    if (t.type === "lparen") {
      depth += 1;
      if (depth === 1) argStart = t.end;
    } else if (t.type === "rparen") {
      depth -= 1;
      if (depth === 0) {
        close(t.start);
        return ranges;
      }
    } else if (t.type === "comma" && depth === 1) {
      close(t.start);
      argStart = t.end;
    }
  }
  if (depth > 0 && argStart >= 0) close(text.length);
  return ranges;
}

/* -------------------------------------------------------------------------- */
/*                               F4 ($) cycling                               */
/* -------------------------------------------------------------------------- */

const CELL_PART = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/;
const COL_PART = /^(\$?)([A-Za-z]{1,3})$/;
const ROW_PART = /^(\$?)([0-9]+)$/;

function splitSheetPrefix(ref: string): [string, string] {
  const bang = ref.lastIndexOf("!");
  if (bang < 0) return ["", ref];
  return [ref.slice(0, bang + 1), ref.slice(bang + 1)];
}

/**
 * Cycles the absolute/relative state of a reference the way Excel's F4 does:
 * `A1 → $A$1 → A$1 → $A1 → A1`. Ranges switch both ends to the state
 * following the state of their first cell. Whole-column / whole-row
 * references toggle between relative and absolute.
 */
export function cycleReference(ref: string): string {
  const [prefix, body] = splitSheetPrefix(ref);
  const parts = body.split(":");
  if (parts.length > 2) return ref;

  const cell0 = parts[0].match(CELL_PART);
  if (cell0) {
    const colAbs = cell0[1] === "$";
    const rowAbs = cell0[3] === "$";
    let next: [boolean, boolean];
    if (!colAbs && !rowAbs) next = [true, true];
    else if (colAbs && rowAbs) next = [false, true];
    else if (!colAbs && rowAbs) next = [true, false];
    else next = [false, false];
    const fmt = (p: string) => {
      const m = p.match(CELL_PART);
      if (!m) return p;
      return `${next[0] ? "$" : ""}${m[2]}${next[1] ? "$" : ""}${m[4]}`;
    };
    return prefix + parts.map(fmt).join(":");
  }

  const col0 = parts[0].match(COL_PART);
  if (col0 && parts.length === 2) {
    const abs = col0[1] !== "$";
    return (
      prefix +
      parts
        .map((p) => p.replace(COL_PART, (_m, _d, c) => (abs ? "$" : "") + c))
        .join(":")
    );
  }
  const row0 = parts[0].match(ROW_PART);
  if (row0 && parts.length === 2) {
    const abs = row0[1] !== "$";
    return (
      prefix +
      parts
        .map((p) => p.replace(ROW_PART, (_m, _d, r) => (abs ? "$" : "") + r))
        .join(":")
    );
  }
  return ref;
}

/**
 * Cycles the reference under or immediately left of the caret. Returns the
 * new text and a caret placed at the end of the reference, or null when there
 * is no reference at the caret.
 */
export function cycleReferenceAtCaret(
  text: string,
  caret: number
): { text: string; caret: number; start: number; end: number } | null {
  if (!text.startsWith("=")) return null;
  const tokens = tokenizeFormula(text);
  const t = tokens.find(
    (tk) => tk.type === "reference" && tk.start <= caret && caret <= tk.end
  );
  if (!t) return null;
  const replaced = cycleReference(t.text);
  const newText = text.slice(0, t.start) + replaced + text.slice(t.end);
  return {
    text: newText,
    caret: t.start + replaced.length,
    start: t.start,
    end: t.start + replaced.length,
  };
}

/* -------------------------------------------------------------------------- */
/*                             Brackets / commit                              */
/* -------------------------------------------------------------------------- */

/** Maps each paren offset to the offset of its partner (-1 if unmatched). */
export function getParenPairs(tokens: FormulaToken[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  tokens.forEach((t) => {
    if (t.type === "lparen") {
      stack.push(t.start);
      pairs.set(t.start, -1);
    } else if (t.type === "rparen") {
      const open = stack.pop();
      if (open == null) pairs.set(t.start, -1);
      else {
        pairs.set(open, t.start);
        pairs.set(t.start, open);
      }
    }
  });
  return pairs;
}

/**
 * Returns the offsets `[open, close]` of the parenthesis pair to highlight
 * for `caret`: the paren just left of the caret, else the paren right of the
 * caret, else the innermost pair enclosing it. Either offset is -1 when the
 * partner is missing.
 */
export function findBracketPair(
  text: string,
  caret: number,
  tokens: FormulaToken[] = tokenizeFormula(text)
): [number, number] | null {
  const pairs = getParenPairs(tokens);
  const order = (a: number, b: number): [number, number] =>
    text[a] === "(" ? [a, b] : [b, a];
  if (pairs.has(caret - 1)) return order(caret - 1, pairs.get(caret - 1)!);
  if (pairs.has(caret)) return order(caret, pairs.get(caret)!);
  let best: [number, number] | null = null;
  pairs.forEach((partner, pos) => {
    if (text[pos] !== "(" || pos >= caret) return;
    if (partner !== -1 && partner < caret) return;
    if (!best || pos > best[0]) best = [pos, partner];
  });
  return best;
}

/** Appends the closing parentheses a formula is missing (`=SUM(ABS(1` → `=SUM(ABS(1))`). */
export function autoCloseFormula(text: string) {
  if (!text.startsWith("=")) return text;
  let depth = 0;
  tokenizeFormula(text).forEach((t) => {
    if (t.type === "lparen") depth += 1;
    else if (t.type === "rparen" && depth > 0) depth -= 1;
  });
  if (depth <= 0) return text;
  return text.replace(/\s+$/, "") + ")".repeat(depth);
}

/**
 * Excel's case on commit: references (not their sheet names), `TRUE` /
 * `FALSE` and the names of the functions `isFunction` knows (given the name
 * in upper case) are written in upper case: `=sum(a1)` → `=SUM(A1)`.
 */
export function normalizeFormulaCase(
  text: string,
  isFunction: (name: string) => boolean
) {
  if (!text.startsWith("=")) return text;
  return tokenizeFormula(text)
    .map((t) => {
      if (t.type === "reference") {
        const bang = t.text.lastIndexOf("!");
        return t.text.slice(0, bang + 1) + t.text.slice(bang + 1).toUpperCase();
      }
      if (t.type === "bool") return t.text.toUpperCase();
      if (t.type === "function" && isFunction(t.text.toUpperCase())) {
        return t.text.toUpperCase();
      }
      return t.text;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/*                         References and their colours                       */
/* -------------------------------------------------------------------------- */

export type ParsedReference = {
  sheetName: string | null;
  /** null for whole-column references */
  row: [number, number] | null;
  /** null for whole-row references */
  column: [number, number] | null;
};

function columnIndex(letters: string) {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i += 1) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Parses `A1`, `$A$1:B2`, `A:C`, `1:3`, `Sheet2!A1`, `'My sheet'!A:A`. */
export function parseReference(ref: string): ParsedReference | null {
  const text = ref.trim();
  const [prefix, body] = splitSheetPrefix(text);
  let sheetName: string | null = null;
  if (prefix) {
    sheetName = prefix.slice(0, -1);
    if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
      sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
    }
  }
  const parts = body.split(":");
  if (parts.length > 2) return null;
  const cells = parts.map((p) => p.match(CELL_PART));
  if (cells.every((c) => c)) {
    const rows = cells.map((c) => parseInt(c![4], 10) - 1);
    const cols = cells.map((c) => columnIndex(c![2]));
    return {
      sheetName,
      row: [Math.min(...rows), Math.max(...rows)],
      column: [Math.min(...cols), Math.max(...cols)],
    };
  }
  if (parts.length !== 2) return null;
  const colParts = parts.map((p) => p.match(COL_PART));
  if (colParts.every((c) => c)) {
    const cols = colParts.map((c) => columnIndex(c![2]));
    return {
      sheetName,
      row: null,
      column: [Math.min(...cols), Math.max(...cols)],
    };
  }
  const rowParts = parts.map((p) => p.match(ROW_PART));
  if (rowParts.every((r) => r)) {
    const rows = rowParts.map((r) => parseInt(r![2], 10) - 1);
    if (rows.some((r) => r < 0)) return null;
    return {
      sheetName,
      row: [Math.min(...rows), Math.max(...rows)],
      column: null,
    };
  }
  return null;
}

function columnLetters(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Rewrites reference `ref` to point at `row` × `column` (zero-based, null
 * for a whole column / row), keeping its sheet name and the `$` anchoring of
 * each part: moving `$B$2` one row down gives `$B$3`, resizing `A1` gives
 * `A1:B3`. Returns null when `ref` is not a reference.
 */
export function formatReferenceLike(
  ref: string,
  row: [number, number] | null,
  column: [number, number] | null
): string | null {
  if (!parseReference(ref) || (row == null && column == null)) return null;
  const [prefix, body] = splitSheetPrefix(ref.trim());
  const parts = body.split(":");
  const flags = parts.map((p) => {
    const cell = p.match(CELL_PART);
    if (cell) return [cell[1], cell[3]];
    const col = p.match(COL_PART);
    if (col) return [col[1], col[1]];
    const r = p.match(ROW_PART);
    if (r) return [r[1], r[1]];
    return null;
  });
  if (flags.some((f) => f == null)) return null;
  const [colAbs0, rowAbs0] = flags[0]!;
  const [colAbs1, rowAbs1] = flags[flags.length - 1]!;
  const col = (i: number, abs: string) => abs + columnLetters(i);
  const rowText = (i: number, abs: string) => `${abs}${i + 1}`;
  if (row == null) {
    return `${prefix}${col(column![0], colAbs0)}:${col(column![1], colAbs1)}`;
  }
  if (column == null) {
    return `${prefix}${rowText(row[0], rowAbs0)}:${rowText(row[1], rowAbs1)}`;
  }
  const first = col(column[0], colAbs0) + rowText(row[0], rowAbs0);
  if (row[0] === row[1] && column[0] === column[1]) return prefix + first;
  return `${prefix}${first}:${col(column[1], colAbs1)}${rowText(
    row[1],
    rowAbs1
  )}`;
}

/**
 * Key identifying the cells a reference points at, so `A1`, `$A$1` and `a1`
 * share a colour (and a highlight box) like in Excel.
 */
export function referenceKey(ref: string) {
  const [prefix, body] = splitSheetPrefix(ref.trim());
  return (prefix + body.replace(/\$/g, "")).toUpperCase();
}

/**
 * Colours of the references of a formula being edited (the text in the
 * editors and the boxes on the grid), in Excel's order: blue, red, purple,
 * green, magenta, orange, teal, brown. Mid tones that read on the light and
 * the dark editor background alike.
 */
export const REFERENCE_COLORS = [
  "#2f6fdf",
  "#d63a3a",
  "#8b50d4",
  "#1f9950",
  "#c43a93",
  "#c9741c",
  "#1a91a8",
  "#8f6b2f",
];

export function referenceColor(colorIndex: number) {
  return REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length];
}

/**
 * Assigns colour indexes to references in order of first appearance; equal
 * references (see {@link referenceKey}) share a colour.
 */
export function assignReferenceColors(refs: string[]): number[] {
  const map = new Map<string, number>();
  return refs.map((r) => {
    const key = referenceKey(r);
    if (!map.has(key)) map.set(key, map.size);
    return map.get(key)!;
  });
}

function escapeHTML(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const REFERENCE_SPAN_CLASS = "fortune-formula-functionrange-cell";

/**
 * Renders formula text as the span markup used by the editors. Each
 * reference gets a `rangeindex` (taken from `preservedRangeIndexes` when
 * given, so the range currently being picked keeps its identity) and a colour
 * shared by equal references.
 */
export function formulaTextToHTML(
  text: string,
  preservedRangeIndexes: number[] = []
): { html: string; refCount: number; nextRangeIndex: number } {
  const tokens = tokenizeFormula(text);
  const refTokens = tokens.filter((t) => t.type === "reference");
  const colorIndexes = assignReferenceColors(refTokens.map((t) => t.text));
  let refIdx = 0;
  let maxRangeIndex = -1;
  let html = "";
  let plain = "";
  const span = (cls: string, content: string, extra = "") =>
    `<span dir="auto" class="${cls}"${extra}>${escapeHTML(content)}</span>`;
  const flushPlain = () => {
    if (plain) html += span("luckysheet-formula-text-color", plain);
    plain = "";
  };

  tokens.forEach((t, i) => {
    switch (t.type) {
      case "function":
        flushPlain();
        html += span("luckysheet-formula-text-func", t.text);
        break;
      case "lparen":
        flushPlain();
        html += span("luckysheet-formula-text-lpar", t.text);
        break;
      case "rparen":
        flushPlain();
        html += span("luckysheet-formula-text-rpar", t.text);
        break;
      case "comma":
        flushPlain();
        html += span("luckysheet-formula-text-comma", t.text);
        break;
      case "string":
        flushPlain();
        html += span("luckysheet-formula-text-string", t.text);
        break;
      case "array":
        flushPlain();
        html += span(
          "luckysheet-formula-text-array",
          t.text,
          ' style="color:#959a05"'
        );
        break;
      case "operator":
        if (i === 0 && t.text === "=") {
          plain += t.text;
          flushPlain();
        } else {
          flushPlain();
          html += span("luckysheet-formula-text-calc", t.text);
        }
        break;
      case "reference": {
        flushPlain();
        const rangeIndex =
          refIdx < preservedRangeIndexes.length
            ? preservedRangeIndexes[refIdx]
            : Math.max(refIdx, maxRangeIndex + 1);
        maxRangeIndex = Math.max(maxRangeIndex, rangeIndex);
        const color = referenceColor(colorIndexes[refIdx]);
        html += `<span class="${REFERENCE_SPAN_CLASS}" rangeindex="${rangeIndex}" dir="auto" style="color:${color};">${escapeHTML(
          t.text
        )}</span>`;
        refIdx += 1;
        break;
      }
      default:
        plain += t.text;
    }
  });
  flushPlain();
  return {
    html,
    refCount: refTokens.length,
    nextRangeIndex: maxRangeIndex + 1,
  };
}

/**
 * Re-applies the shared-colour scheme to the reference spans of an editor
 * (used after a reference was inserted by picking a range with the mouse).
 * Returns the spans with their colour.
 */
export function recolorReferenceSpans(root: Element | Document) {
  const spans = Array.from(
    root.querySelectorAll<HTMLElement>(`span.${REFERENCE_SPAN_CLASS}`)
  );
  const colorIndexes = assignReferenceColors(
    spans.map((s) => s.textContent || "")
  );
  return spans.map((el, i) => {
    const color = referenceColor(colorIndexes[i]);
    if (el.style) el.style.color = color;
    return {
      el,
      text: el.textContent || "",
      rangeIndex: parseInt(el.getAttribute("rangeindex") || "0", 10),
      color,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                          Plain value autocomplete                          */
/* -------------------------------------------------------------------------- */

function cellText(cell: Cell | null | undefined): string | null {
  if (!cell) return null;
  if (cell.f) return null;
  if (cell.ct?.t === "inlineStr") {
    const s = (cell.ct.s || []).map((x: any) => x?.v ?? "").join("");
    return s.trim() || null;
  }
  const { v } = cell;
  if (v == null || typeof v === "number" || typeof v === "boolean") {
    return null;
  }
  if (cell.ct?.t === "n" || cell.ct?.t === "d") return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Collects the distinct text values of the contiguous block of cells above
 * and below (`row`, `col`), the way Excel's AutoComplete does: the scan stops
 * at the first empty cell in each direction. Numbers, dates and formulas are
 * skipped.
 */
export function collectColumnValues(
  data: CellMatrix,
  row: number,
  col: number,
  maxScan = 5000
): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      values.push(s);
    }
  };
  const scan = (step: number) => {
    for (let n = 1; n <= maxScan; n += 1) {
      const r = row + n * step;
      if (r < 0 || r >= data.length) break;
      const cell = data[r]?.[col];
      if (cell == null || (cell.v == null && !cell.f && !cell.ct?.s)) break;
      const s = cellText(cell);
      if (s) add(s);
    }
  };
  scan(-1);
  scan(1);
  return values;
}

/**
 * Case-insensitive prefix matches of `typed` among `values`. Formulas and
 * numbers never autocomplete.
 */
export function matchColumnValues(
  values: string[],
  typed: string,
  limit = 8
): string[] {
  const t = typed.replace(/\u00a0/g, " ");
  if (!t.trim() || t.startsWith("=") || /^[\s]*[-+]?[\d.,]/.test(t)) return [];
  const lower = t.toLowerCase();
  return values
    .filter((v) => {
      const lv = v.toLowerCase();
      return lv.startsWith(lower) && lv !== lower;
    })
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/*                                DOM helpers                                 */
/* -------------------------------------------------------------------------- */

/** Text offset of the caret (selection focus) inside `el`, or null. */
export function getCaretOffset(el: HTMLElement): number | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  const { focusNode, focusOffset } = sel;
  if (!focusNode || (focusNode !== el && !el.contains(focusNode))) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  try {
    range.setEnd(focusNode, focusOffset);
  } catch {
    return null;
  }
  return range.toString().length;
}

/** Places a collapsed caret at text offset `offset` inside `el`. */
export function setCaretOffset(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let target: Node | null = null;
  let targetOffset = 0;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      target = node;
      targetOffset = remaining;
      break;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  if (target) {
    range.setStart(target, targetOffset);
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/** DOM position of text offset `offset` inside `el`. */
function textPosition(el: HTMLElement, offset: number): [Node, number] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  let last: Node | null = null;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) return [node, remaining];
    remaining -= len;
    last = node;
    node = walker.nextNode();
  }
  if (last) return [last, last.textContent?.length ?? 0];
  return [el, el.childNodes.length];
}

/** Selects the text between offsets `start` and `end` inside `el`. */
export function selectTextRange(el: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(...textPosition(el, start));
  range.setEnd(...textPosition(el, Math.max(start, end)));
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Argument hint: selects the text of argument `argIndex` of the function
 * call around the caret in `el` (Excel's clickable argument names). Returns
 * false when the call has no such argument yet.
 */
export function selectCallArgument(el: HTMLElement, argIndex: number) {
  const text = el.textContent || "";
  const caret = getCaretOffset(el) ?? text.length;
  const tokens = tokenizeFormula(text);
  const call = getCallContext(text, caret, tokens);
  if (!call) return false;
  const range = getCallArgumentRanges(text, call.lparen, tokens)[argIndex];
  if (!range) return false;
  selectTextRange(el, range.start, range.end);
  return true;
}

export const BRACKET_MATCH_CLASS = "fortune-formula-paren-match";

/** Highlights the parenthesis pair around `caret` (see {@link findBracketPair}). */
export function highlightBracketPair(
  el: HTMLElement,
  caret: number | null,
  text: string = el.textContent || ""
) {
  el.querySelectorAll(`.${BRACKET_MATCH_CLASS}`).forEach((e) =>
    e.classList.remove(BRACKET_MATCH_CLASS)
  );
  if (caret == null || !text.startsWith("=")) return;
  const pair = findBracketPair(text, caret);
  if (!pair) return;
  const targets = new Set(pair.filter((p) => p >= 0));
  if (targets.size === 0) return;
  let pos = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    const parent = node.parentElement;
    if (
      parent &&
      len === 1 &&
      targets.has(pos) &&
      (parent.classList.contains("luckysheet-formula-text-lpar") ||
        parent.classList.contains("luckysheet-formula-text-rpar"))
    ) {
      parent.classList.add(BRACKET_MATCH_CLASS);
    }
    pos += len;
    node = walker.nextNode();
  }
}

/** The completion shown for the text it was computed on (see accept). */
let activeCompletion: {
  text: string;
  start: number;
  end: number;
  inserts: Map<string, string>;
} | null = null;

/**
 * Applies a table column / quoted sheet completion; false when `name` is
 * not one of the completions shown for the editor's current text.
 */
function applyActiveCompletion(el: HTMLElement, name: string) {
  const text = el.textContent || "";
  const a = activeCompletion;
  if (!a || a.text !== text || !a.inserts.has(name)) return false;
  const insert = a.inserts.get(name)!;
  // a closing `]` / `'!` already typed after the caret is not repeated
  let skip = 0;
  if (insert.endsWith("]") && text.startsWith("]", a.end)) skip = 1;
  else if (insert.endsWith("'!") && text.startsWith("'!", a.end)) skip = 2;
  el.textContent = text.slice(0, a.start) + insert + text.slice(a.end + skip);
  setCaretOffset(el, a.start + insert.length);
  activeCompletion = null;
  return true;
}

/**
 * Replaces the identifier being typed with `name(`, caret after the `(`.
 * Only touches the DOM; callers re-render the formula afterwards.
 */
export function applyFunctionCandidate(el: HTMLElement, name: string) {
  if (applyActiveCompletion(el, name)) return true;
  const text = el.textContent || "";
  const caret = getCaretOffset(el) ?? text.length;
  const upper = name.toUpperCase();
  const suffix = candidateSuffixes.get(upper) ?? "(";
  const res = insertFunctionName(
    text,
    caret,
    candidateTexts.get(upper) ?? name,
    suffix
  );
  el.textContent = res.text;
  setCaretOffset(el, res.caret);
  return true;
}

/** F4: cycles `$` on the reference at the caret. Returns false if none. */
export function applyReferenceCycle(el: HTMLElement) {
  const text = el.textContent || "";
  const caret = getCaretOffset(el) ?? text.length;
  const res = cycleReferenceAtCaret(text, caret);
  if (!res) return false;
  el.textContent = res.text;
  setCaretOffset(el, res.caret);
  return true;
}

/** Adds missing closing parentheses to the formula in `el` before commit. */
export function closeFormulaParens(el: HTMLElement | null | undefined) {
  if (!el) return false;
  const text = el.innerText ?? el.textContent ?? "";
  if (!text.startsWith("=")) return false;
  const closed = autoCloseFormula(text);
  if (closed === text) return false;
  el.textContent = closed;
  return true;
}

/* -------------------------------------------------------------------------- */
/*                         Undo / redo inside the editor                      */
/* -------------------------------------------------------------------------- */

type EditorSnapshot = { text: string; caret: number };

/**
 * Undo steps of the text being edited (Ctrl+Z / Ctrl+Y while editing undo
 * typing and picked references, not sheet changes). The last undo entry is
 * the current text.
 */
export type EditorHistory = {
  undo: EditorSnapshot[];
  redo: EditorSnapshot[];
};

const EDITOR_HISTORY_LIMIT = 200;

function snapshotOf(el: HTMLElement): EditorSnapshot {
  const text = el.textContent ?? "";
  return { text, caret: getCaretOffset(el) ?? text.length };
}

/** Records the text of `el` as an undo step when it changed. */
export function recordEditorState(history: EditorHistory, el: HTMLElement) {
  const now = snapshotOf(el);
  const last = history.undo[history.undo.length - 1];
  if (last?.text === now.text) {
    last.caret = now.caret;
    return;
  }
  history.undo.push(now);
  if (history.undo.length > EDITOR_HISTORY_LIMIT) history.undo.shift();
  history.redo = [];
}

function restoreEditorState(el: HTMLElement, s: EditorSnapshot) {
  el.textContent = s.text;
  setCaretOffset(el, s.caret);
}

/**
 * Undoes the last change of the text in `el` (Ctrl+Z while editing).
 * Returns false when there is nothing to undo; the caller re-renders.
 */
export function undoEditorState(history: EditorHistory, el: HTMLElement) {
  recordEditorState(history, el);
  if (history.undo.length < 2) return false;
  history.redo.push(history.undo.pop()!);
  restoreEditorState(el, history.undo[history.undo.length - 1]);
  return true;
}

/** Redoes a change undone by {@link undoEditorState} (Ctrl+Y). */
export function redoEditorState(history: EditorHistory, el: HTMLElement) {
  const next = history.redo.pop();
  if (!next) return false;
  const { redo } = history;
  recordEditorState(history, el);
  history.redo = redo;
  history.undo.push(next);
  restoreEditorState(el, next);
  return true;
}

/**
 * The formula in `el` as Excel commits it: missing closing parentheses
 * added, references and function names in upper case.
 */
export function finishFormulaEdit(
  ctx: Context,
  el: HTMLElement | null | undefined
) {
  closeFormulaParens(el);
  const text = el?.innerText ?? el?.textContent ?? "";
  if (!el || !text.startsWith("=")) return;
  const functions = getFunctionListMap(ctx);
  const normalized = normalizeFormulaCase(text, (name) => name in functions);
  if (normalized !== text) el.textContent = normalized;
}

/* -------------------------------------------------------------------------- */
/*                              Context updates                               */
/* -------------------------------------------------------------------------- */

export function clearFormulaEditorState(ctx: Context) {
  if (ctx.functionCandidates?.length) ctx.functionCandidates = [];
  if (ctx.functionHint != null) ctx.functionHint = null;
}

/**
 * Recomputes the function candidates, the argument hint and the bracket
 * highlight for the caret position in `el`.
 */
export function refreshFormulaEditorState(ctx: Context, el: HTMLElement) {
  const text = el.textContent || "";
  const caretOffset = getCaretOffset(el);
  highlightBracketPair(el, caretOffset, text);
  if (!text.startsWith("=")) {
    clearFormulaEditorState(ctx);
    return;
  }
  const caret = caretOffset ?? text.length;
  const tokens = tokenizeFormula(text);
  const map = getFunctionListMap(ctx);

  // table columns after `Table1[`, sheet names after a quote
  activeCompletion = null;
  const completion = getCompletionQuery(text, caret);
  if (completion) {
    const ranked = rankCompletionItems(
      getCompletionItems(ctx, completion),
      completion.query
    );
    if (ranked.length > 0) {
      activeCompletion = {
        text,
        start: completion.start,
        end: completion.end,
        inserts: new Map(ranked.map((r) => [r.item.n, r.item.insert])),
      };
      ctx.functionCandidates = ranked.map((r) => ({
        n: r.item.n,
        d: r.item.d,
        t: r.item.t,
        matches: r.matches,
      }));
      ctx.functionCandidateIndex = 0;
      ctx.functionHint = null;
      return;
    }
  }

  const query = getFunctionQuery(text, caret, tokens);
  if (query) {
    const { functionlist } = locale(ctx);
    const extra = getExtraFormulaCandidates(ctx);
    const ranked = rankFunctions(
      (extra.length ? [...functionlist, ...extra] : functionlist) as any[],
      query.query
    ).filter(
      // a fully typed defined name needs no completion (Enter commits)
      (r) => !(r.tier === 0 && r.item.t === "name")
    );
    if (ranked.length > 0) {
      ctx.functionCandidates = ranked.map((r) => ({
        n: r.item.n,
        d: r.item.d,
        a: r.item.a,
        matches: r.matches,
      }));
      ctx.functionCandidateIndex = 0;
      ctx.functionHint = null;
      return;
    }
  }
  if (ctx.functionCandidates?.length) ctx.functionCandidates = [];

  const call = getCallContext(text, caret, tokens);
  const name = call?.name.toUpperCase();
  if (call && name && map[name]) {
    ctx.functionHint = name;
    ctx.functionHintArgIndex = call.argIndex;
  } else if (ctx.functionHint != null) {
    ctx.functionHint = null;
  }
}

/** Moves the highlighted function candidate by `delta` (wrapping). */
export function moveFunctionCandidate(ctx: Context, delta: number) {
  const len = ctx.functionCandidates.length;
  if (len === 0) return;
  const cur = ctx.functionCandidateIndex ?? 0;
  ctx.functionCandidateIndex = (((cur + delta) % len) + len) % len;
}

export function getActiveFunctionCandidate(ctx: Context): string | null {
  const len = ctx.functionCandidates.length;
  if (len === 0) return null;
  const idx = Math.min(Math.max(ctx.functionCandidateIndex ?? 0, 0), len - 1);
  return ctx.functionCandidates[idx]?.n ?? null;
}

/* -------------------------------------------------------------------------- */
/*                     Formula bar: expand, resize, lines                     */
/* -------------------------------------------------------------------------- */

/** Height (px) of the one-line formula bar. */
export const FORMULA_BAR_COLLAPSED_HEIGHT = 36;
/** Smallest and default height (px) of the expanded formula bar. */
export const FORMULA_BAR_MIN_HEIGHT = 56;
export const FORMULA_BAR_DEFAULT_HEIGHT = 96;

/** The expanded formula bar height, kept between the minimum and `max`. */
export function clampFormulaBarHeight(height: number, max = 600) {
  const top = Math.max(FORMULA_BAR_MIN_HEIGHT, max);
  if (!Number.isFinite(height)) return FORMULA_BAR_DEFAULT_HEIGHT;
  return Math.round(Math.min(top, Math.max(FORMULA_BAR_MIN_HEIGHT, height)));
}

/** Ctrl+Shift+U: expands or collapses the formula bar. */
export function toggleFormulaBar(ctx: Context) {
  ctx.formulaBarExpanded = !ctx.formulaBarExpanded;
  if (ctx.formulaBarExpanded && !ctx.formulaBarHeight) {
    ctx.formulaBarHeight = FORMULA_BAR_DEFAULT_HEIGHT;
  }
}

/**
 * Dragging the formula bar's bottom edge: a height below the expanded
 * minimum collapses it to one line.
 */
export function setFormulaBarHeight(ctx: Context, height: number, max = 600) {
  if (height < (FORMULA_BAR_COLLAPSED_HEIGHT + FORMULA_BAR_MIN_HEIGHT) / 2) {
    ctx.formulaBarExpanded = false;
    return;
  }
  ctx.formulaBarExpanded = true;
  ctx.formulaBarHeight = clampFormulaBarHeight(height, max);
}

/**
 * The indentation (leading spaces/tabs) of the line `caret` is on: Alt+Enter
 * starts the next line of a formula with it.
 */
export function lineIndentAt(text: string, caret: number) {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart, caret))![0];
}
