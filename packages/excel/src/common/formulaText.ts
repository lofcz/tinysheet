/**
 * Formula text conversions between TinySheet and the xlsx file format.
 *
 * Excel stores functions added after Excel 2007 with "future function"
 * prefixes (`_xlfn.XLOOKUP`, `_xlfn._xlws.FILTER`), LET/LAMBDA parameter
 * names with `_xlpm.`, spill references (`A1#`) as `_xlfn.ANCHORARRAY(A1)`
 * and the implicit-intersection operator (`@x`) as `_xlfn.SINGLE(x)`.
 * TinySheet (like Excel's UI) shows the bare names.
 *
 * Everything works on a small token stream so string literals, quoted sheet
 * names and structured-reference brackets are never rewritten.
 */

export type FormulaToken = {
  type:
    | "str" // "text" (with "" escapes)
    | "sheet" // 'Quoted sheet' (with '' escapes)
    | "bracket" // [structured reference] or [external book]
    | "ws"
    | "ident" // names, functions, cell references, $A$1, _xlfn.X
    | "num"
    | "error" // #N/A, #REF! ...
    | "spill" // the # of A1#
    | "lparen"
    | "rparen"
    | "comma"
    | "op"; // everything else, one character at a time (+ - * / ^ & = < > : ! % @ { } ;)
  text: string;
};

const IDENT_START = /[A-Za-z_\\$À-￿]/;
const IDENT_PART = /[A-Za-z0-9_.$\\?À-￿]/;

export function tokenizeFormula(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  const s = formula;
  let i = 0;
  const push = (type: FormulaToken["type"], text: string) =>
    tokens.push({ type, text });

  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      push("str", s.slice(i, j + 1));
      i = j + 1;
    } else if (ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'") {
          if (s[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      push("sheet", s.slice(i, j + 1));
      i = j + 1;
    } else if (ch === "[") {
      let depth = 0;
      let j = i;
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] != null) {
          // escape character inside structured references
          j += 2;
          continue;
        }
        if (s[j] === "[") depth += 1;
        else if (s[j] === "]") {
          depth -= 1;
          if (depth === 0) break;
        }
        j += 1;
      }
      push("bracket", s.slice(i, j + 1));
      i = j + 1;
    } else if (/\s/.test(ch)) {
      let j = i;
      while (j < s.length && /\s/.test(s[j])) j += 1;
      push("ws", s.slice(i, j));
      i = j;
    } else if (ch === "#") {
      const prev = tokens[tokens.length - 1];
      const m = /^#[A-Za-z0-9/_]+[!?]?/.exec(s.slice(i));
      const afterRef =
        prev && (prev.type === "ident" || prev.type === "rparen");
      if (m && !afterRef) {
        push("error", m[0]);
        i += m[0].length;
      } else {
        push("spill", "#");
        i += 1;
      }
    } else if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1]))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      push("num", m![0]);
      i += m![0].length;
    } else if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < s.length && IDENT_PART.test(s[j])) j += 1;
      push("ident", s.slice(i, j));
      i = j;
    } else if (ch === "(") {
      push("lparen", ch);
      i += 1;
    } else if (ch === ")") {
      push("rparen", ch);
      i += 1;
    } else if (ch === ",") {
      push("comma", ch);
      i += 1;
    } else {
      push("op", ch);
      i += 1;
    }
  }
  return tokens;
}

export function joinTokens(tokens: FormulaToken[]) {
  return tokens.map((t) => t.text).join("");
}

function nextNonWs(tokens: FormulaToken[], i: number) {
  let j = i + 1;
  while (j < tokens.length && tokens[j].type === "ws") j += 1;
  return j;
}

function prevNonWs(tokens: FormulaToken[], i: number) {
  let j = i - 1;
  while (j >= 0 && tokens[j].type === "ws") j -= 1;
  return j;
}

/** Index of the rparen matching the lparen at `open` (or tokens.length). */
function matchingParen(tokens: FormulaToken[], open: number) {
  let depth = 0;
  for (let j = open; j < tokens.length; j += 1) {
    if (tokens[j].type === "lparen") depth += 1;
    else if (tokens[j].type === "rparen") {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return tokens.length;
}

/** Split the arguments of the call whose lparen is at `open`. */
function callArguments(tokens: FormulaToken[], open: number) {
  const close = matchingParen(tokens, open);
  const args: FormulaToken[][] = [];
  let depth = 0;
  let braces = 0;
  let current: FormulaToken[] = [];
  for (let j = open + 1; j < close; j += 1) {
    const t = tokens[j];
    if (t.type === "lparen") depth += 1;
    else if (t.type === "rparen") depth -= 1;
    else if (t.type === "op" && t.text === "{") braces += 1;
    else if (t.type === "op" && t.text === "}") braces -= 1;
    if (t.type === "comma" && depth === 0 && braces === 0) {
      args.push(current);
      current = [];
    } else {
      current.push(t);
    }
  }
  args.push(current);
  return { args, close };
}

// ---------------------------------------------------------------------------
// Future-function prefixes
// ---------------------------------------------------------------------------

/**
 * Functions Excel writes with the `_xlfn.` prefix: everything added in Excel
 * 2010 and later (see Microsoft's "_xlfn. prefix is displayed in front of a
 * formula" list), plus the dynamic-array and LAMBDA era functions.
 */
const XLFN_FUNCTIONS = [
  // Excel 2010
  "AGGREGATE",
  "BETA.DIST",
  "BETA.INV",
  "BINOM.DIST",
  "BINOM.INV",
  "CEILING.PRECISE",
  "CHISQ.DIST",
  "CHISQ.DIST.RT",
  "CHISQ.INV",
  "CHISQ.INV.RT",
  "CHISQ.TEST",
  "CONFIDENCE.NORM",
  "CONFIDENCE.T",
  "COVARIANCE.P",
  "COVARIANCE.S",
  "ERF.PRECISE",
  "ERFC.PRECISE",
  "EXPON.DIST",
  "F.DIST",
  "F.DIST.RT",
  "F.INV",
  "F.INV.RT",
  "F.TEST",
  "FLOOR.PRECISE",
  "GAMMA.DIST",
  "GAMMA.INV",
  "GAMMALN.PRECISE",
  "HYPGEOM.DIST",
  "LOGNORM.DIST",
  "LOGNORM.INV",
  "MODE.MULT",
  "MODE.SNGL",
  "NEGBINOM.DIST",
  "NETWORKDAYS.INTL",
  "NORM.DIST",
  "NORM.INV",
  "NORM.S.DIST",
  "NORM.S.INV",
  "PERCENTILE.EXC",
  "PERCENTILE.INC",
  "PERCENTRANK.EXC",
  "PERCENTRANK.INC",
  "POISSON.DIST",
  "QUARTILE.EXC",
  "QUARTILE.INC",
  "RANK.AVG",
  "RANK.EQ",
  "STDEV.P",
  "STDEV.S",
  "T.DIST",
  "T.DIST.2T",
  "T.DIST.RT",
  "T.INV",
  "T.INV.2T",
  "T.TEST",
  "VAR.P",
  "VAR.S",
  "WEIBULL.DIST",
  "WORKDAY.INTL",
  "Z.TEST",
  // Excel 2013
  "ACOT",
  "ACOTH",
  "ARABIC",
  "BASE",
  "BINOM.DIST.RANGE",
  "BITAND",
  "BITLSHIFT",
  "BITOR",
  "BITRSHIFT",
  "BITXOR",
  "CEILING.MATH",
  "COMBINA",
  "COT",
  "COTH",
  "CSC",
  "CSCH",
  "DAYS",
  "DECIMAL",
  "ENCODEURL",
  "FILTERXML",
  "FLOOR.MATH",
  "FORMULATEXT",
  "GAMMA",
  "GAUSS",
  "IFNA",
  "IMCOSH",
  "IMCOT",
  "IMCSC",
  "IMCSCH",
  "IMSEC",
  "IMSECH",
  "IMSINH",
  "IMTAN",
  "ISFORMULA",
  "ISOWEEKNUM",
  "MUNIT",
  "NUMBERVALUE",
  "PDURATION",
  "PERMUTATIONA",
  "PHI",
  "RRI",
  "SEC",
  "SECH",
  "SHEET",
  "SHEETS",
  "SKEW.P",
  "UNICHAR",
  "UNICODE",
  "WEBSERVICE",
  "XOR",
  // Excel 2016 / 2019
  "CONCAT",
  "FORECAST.ETS",
  "FORECAST.ETS.CONFINT",
  "FORECAST.ETS.SEASONALITY",
  "FORECAST.ETS.STAT",
  "FORECAST.LINEAR",
  "IFS",
  "MAXIFS",
  "MINIFS",
  "SWITCH",
  "TEXTJOIN",
  // Dynamic arrays, LAMBDA and later (Microsoft 365)
  "ANCHORARRAY",
  "ARRAYTOTEXT",
  "BYCOL",
  "BYROW",
  "CHOOSECOLS",
  "CHOOSEROWS",
  "DROP",
  "EXPAND",
  "GROUPBY",
  "HSTACK",
  "IMAGE",
  "ISOMITTED",
  "LAMBDA",
  "LET",
  "MAKEARRAY",
  "MAP",
  "PERCENTOF",
  "PIVOTBY",
  "RANDARRAY",
  "REDUCE",
  "REGEXEXTRACT",
  "REGEXREPLACE",
  "REGEXTEST",
  "SCAN",
  "SEQUENCE",
  "SINGLE",
  "SORTBY",
  "STOCKHISTORY",
  "TAKE",
  "TEXTAFTER",
  "TEXTBEFORE",
  "TEXTSPLIT",
  "TOCOL",
  "TOROW",
  "TRIMRANGE",
  "UNIQUE",
  "VALUETOTEXT",
  "VSTACK",
  "WRAPCOLS",
  "WRAPROWS",
  "XLOOKUP",
  "XMATCH",
];

/** Functions Excel writes as `_xlfn._xlws.NAME`. */
const XLWS_FUNCTIONS = ["FILTER", "SORT"];

const XLFN_SET = new Set(XLFN_FUNCTIONS);
const XLWS_SET = new Set(XLWS_FUNCTIONS);

/**
 * Functions whose use makes Excel store the formula as a dynamic-array
 * formula (`cm` metadata), so that it is not evaluated with legacy implicit
 * intersection.
 */
const DYNAMIC_ARRAY_FUNCTIONS = new Set([
  "FILTER",
  "SORT",
  "SORTBY",
  "UNIQUE",
  "SEQUENCE",
  "RANDARRAY",
  "TEXTSPLIT",
  "VSTACK",
  "HSTACK",
  "TOCOL",
  "TOROW",
  "WRAPROWS",
  "WRAPCOLS",
  "TAKE",
  "DROP",
  "CHOOSEROWS",
  "CHOOSECOLS",
  "EXPAND",
  "MAP",
  "SCAN",
  "BYROW",
  "BYCOL",
  "MAKEARRAY",
  "GROUPBY",
  "PIVOTBY",
  "ANCHORARRAY",
  "SINGLE",
  "TRIMRANGE",
  "REGEXEXTRACT",
]);

const PREFIX_RE = /^(?:_xlfn\.|_xlws\.|_xlpm\.|_xludf\.)+/i;

function isFunctionCall(tokens: FormulaToken[], i: number) {
  const j = nextNonWs(tokens, i);
  return tokens[j]?.type === "lparen";
}

/** Names declared as LET variables or LAMBDA parameters anywhere in the formula. */
function collectLambdaParams(tokens: FormulaToken[]) {
  const names = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type !== "ident") continue;
    const name = t.text.replace(PREFIX_RE, "").toUpperCase();
    if (name !== "LET" && name !== "LAMBDA") continue;
    const open = nextNonWs(tokens, i);
    if (tokens[open]?.type !== "lparen") continue;
    const { args } = callArguments(tokens, open);
    args.slice(0, -1).forEach((arg, k) => {
      if (name === "LET" && k % 2 === 1) return;
      const idents = arg.filter((a) => a.type !== "ws");
      if (idents.length === 1 && idents[0].type === "ident") {
        names.add(idents[0].text.replace(PREFIX_RE, "").toUpperCase());
      }
    });
  }
  return names;
}

export type ExcelFormulaInfo = {
  /** Formula text for the file (no leading "="). */
  formula: string;
  /**
   * Whether Excel would store this as a dynamic-array formula (it uses a
   * function that returns arrays, `@` or a spill reference).
   */
  dynamic: boolean;
};

/**
 * Convert a TinySheet formula (`=XLOOKUP(...)`) to the text stored in xlsx
 * (`_xlfn.XLOOKUP(...)`).
 */
export function toExcelFormula(formula: string): ExcelFormulaInfo {
  let text = formula.trim();
  if (text.startsWith("=")) text = text.slice(1);
  const tokens = tokenizeFormula(text);
  const params = collectLambdaParams(tokens);
  let dynamic = false;
  const out: FormulaToken[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type === "ident") {
      const bare = t.text.replace(PREFIX_RE, "");
      const upper = bare.toUpperCase();
      const prev = tokens[prevNonWs(tokens, i)];
      const qualified = prev?.type === "op" && prev.text === "!";
      if (params.has(upper) && !qualified) {
        out.push({ type: "ident", text: `_xlpm.${bare}` });
        continue;
      }
      if (isFunctionCall(tokens, i) && !qualified) {
        if (DYNAMIC_ARRAY_FUNCTIONS.has(upper)) dynamic = true;
        if (XLWS_SET.has(upper)) {
          out.push({ type: "ident", text: `_xlfn._xlws.${bare}` });
          continue;
        }
        if (XLFN_SET.has(upper)) {
          out.push({ type: "ident", text: `_xlfn.${bare}` });
          continue;
        }
      }
      out.push(t);
      continue;
    }
    if (t.type === "spill") {
      // A1# / Sheet1!A1# / 'My sheet'!A1# -> _xlfn.ANCHORARRAY(...)
      let start = out.length - 1;
      if (start >= 0 && out[start].type === "ident") {
        if (
          start >= 2 &&
          out[start - 1].type === "op" &&
          out[start - 1].text === "!" &&
          (out[start - 2].type === "ident" || out[start - 2].type === "sheet")
        ) {
          start -= 2;
        }
        const ref = out.splice(start);
        out.push(
          { type: "ident", text: "_xlfn.ANCHORARRAY" },
          { type: "lparen", text: "(" },
          ...ref,
          { type: "rparen", text: ")" }
        );
        dynamic = true;
        continue;
      }
      out.push(t);
      continue;
    }
    if (t.type === "op" && t.text === "@") {
      // @x -> _xlfn.SINGLE(x): x is a (possibly sheet-qualified) reference
      // or name, a parenthesised expression, or a function call.
      let j = nextNonWs(tokens, i);
      const operand: FormulaToken[] = [];
      if (tokens[j]?.type === "lparen") {
        const close = matchingParen(tokens, j);
        operand.push(...tokens.slice(j + 1, close));
        j = close;
      } else {
        while (j < tokens.length) {
          const u = tokens[j];
          if (u.type === "ident" || u.type === "sheet") {
            operand.push(u);
            const k = nextNonWs(tokens, j);
            if (tokens[k]?.type === "lparen") {
              const close = matchingParen(tokens, k);
              operand.push(...tokens.slice(j + 1, close + 1));
              j = close;
              break;
            }
            if (
              tokens[j + 1]?.type === "op" &&
              (tokens[j + 1].text === "!" || tokens[j + 1].text === ":")
            ) {
              operand.push(tokens[j + 1]);
              j += 2;
              continue;
            }
            break;
          }
          break;
        }
      }
      if (operand.length === 0) {
        out.push(t);
        continue;
      }
      const inner = toExcelFormula(joinTokens(operand)).formula;
      out.push(
        { type: "ident", text: "_xlfn.SINGLE" },
        { type: "lparen", text: "(" },
        { type: "ident", text: inner },
        { type: "rparen", text: ")" }
      );
      dynamic = true;
      i = j;
      continue;
    }
    out.push(t);
  }
  return { formula: joinTokens(out), dynamic };
}

function isSimpleReference(tokens: FormulaToken[]) {
  const t = tokens.filter((x) => x.type !== "ws");
  return t.every(
    (x) =>
      x.type === "ident" ||
      x.type === "sheet" ||
      x.type === "num" ||
      (x.type === "op" && (x.text === "!" || x.text === ":"))
  );
}

function isCallOnly(tokens: FormulaToken[]) {
  const t = tokens.filter((x) => x.type !== "ws");
  if (t.length < 3 || t[0].type !== "ident" || t[1].type !== "lparen")
    return false;
  const close = matchingParen(t, 1);
  return close === t.length - 1;
}

/**
 * Convert formula text read from xlsx (`_xlfn.XLOOKUP(...)`) to what
 * TinySheet shows (`=XLOOKUP(...)`).
 */
export function fromExcelFormula(formula: string): string {
  let text = formula;
  if (text.startsWith("=")) text = text.slice(1);
  if (!/_xl(fn|ws|pm|udf)\./i.test(text)) return `=${text}`;
  const tokens = tokenizeFormula(text);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type !== "ident" || !PREFIX_RE.test(t.text)) {
      out.push(t.text);
      continue;
    }
    const bare = t.text.replace(PREFIX_RE, "");
    const upper = bare.toUpperCase();
    const open = nextNonWs(tokens, i);
    if (
      (upper === "ANCHORARRAY" || upper === "SINGLE") &&
      tokens[open]?.type === "lparen"
    ) {
      const { args, close } = callArguments(tokens, open);
      if (args.length === 1) {
        const inner = fromExcelFormula(joinTokens(args[0])).slice(1).trim();
        const simple = isSimpleReference(args[0]);
        if (upper === "ANCHORARRAY" && simple) {
          out.push(`${inner}#`);
          i = close;
          continue;
        }
        if (upper === "SINGLE") {
          out.push(simple || isCallOnly(args[0]) ? `@${inner}` : `@(${inner})`);
          i = close;
          continue;
        }
      }
    }
    out.push(bare);
  }
  return `=${out.join("")}`;
}

// ---------------------------------------------------------------------------
// Relative reference shifting (shared formulas)
// ---------------------------------------------------------------------------

const MAX_ROW = 1048576;
const MAX_COL = 16384;

export function columnToIndex(letters: string) {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i += 1) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function indexToColumn(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Zero-based (r, c) -> "A1". */
export function cellAddress(r: number, c: number) {
  return `${indexToColumn(c)}${r + 1}`;
}

const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
const COL_RE = /^(\$?)([A-Za-z]{1,3})$/;
const ROW_RE = /^(\$?)(\d+)$/;

function shiftCell(text: string, dr: number, dc: number): string | null {
  const m = CELL_RE.exec(text);
  if (!m) return text;
  let col = columnToIndex(m[2]);
  let row = parseInt(m[4], 10) - 1;
  if (!m[1]) col += dc;
  if (!m[3]) row += dr;
  if (col < 0 || row < 0 || col >= MAX_COL || row >= MAX_ROW) return null;
  return `${m[1]}${indexToColumn(col)}${m[3]}${row + 1}`;
}

function isCellRef(text: string) {
  const m = CELL_RE.exec(text);
  if (!m) return false;
  return (
    columnToIndex(m[2]) < MAX_COL &&
    parseInt(m[4], 10) <= MAX_ROW &&
    m[4] !== "0"
  );
}

/**
 * Shift the relative references of a formula by (dr, dc), the way Excel
 * derives the formulas of a shared-formula group from its master cell.
 * References that move off the sheet become #REF!.
 */
export function shiftFormula(formula: string, dr: number, dc: number) {
  if (dr === 0 && dc === 0) return formula;
  const lead = formula.startsWith("=") ? "=" : "";
  const tokens = tokenizeFormula(lead ? formula.slice(1) : formula);
  const out = tokens.map((t) => t.text);

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const prev = tokens[i - 1];
    const isRangeColon = (tok?: FormulaToken) =>
      tok?.type === "op" && tok.text === ":";
    if (t.type === "ident" && next?.type === "lparen") continue;
    if (t.type === "ident" && next?.type === "op" && next.text === "!")
      continue; // sheet name
    if (t.type === "ident" && isCellRef(t.text)) {
      if (prev?.type === "op" && prev.text === ".") continue;
      const shifted = shiftCell(t.text, dr, dc);
      out[i] = shifted ?? "#REF!";
      continue;
    }
    // Whole columns (A:C) and whole rows (1:3).
    if (
      (t.type === "ident" || t.type === "num") &&
      (isRangeColon(next) || isRangeColon(prev))
    ) {
      const other = isRangeColon(next) ? tokens[i + 2] : tokens[i - 2];
      if (!other) continue;
      const col = COL_RE.exec(t.text);
      if (col && COL_RE.test(other.text)) {
        if (!col[1]) {
          const c = columnToIndex(col[2]) + dc;
          out[i] = c < 0 || c >= MAX_COL ? "#REF!" : indexToColumn(c);
        }
        continue;
      }
      const row = ROW_RE.exec(t.text);
      if (row && ROW_RE.test(other.text)) {
        if (!row[1]) {
          const r = parseInt(row[2], 10) - 1 + dr;
          out[i] = r < 0 || r >= MAX_ROW ? "#REF!" : String(r + 1);
        }
      }
    }
  }
  return lead + out.join("");
}
