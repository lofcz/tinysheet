/**
 * Number-format codes the way Excel's Format Cells dialog and ribbon build
 * them: categories (Number, Currency, Accounting, ...), the codes each
 * category option produces, recognising a code back into its category and
 * options, and Increase/Decrease Decimal on any code.
 *
 * Everything here is a pure function of its input (unit tested in
 * `packages/core/test/format/numberFormat.test.js`).
 */
// @ts-ignore
import SSF from "./ssf";
import { formatHasDate, isGeneralFormat, isPercentFormat } from "./inputParse";

export type FormatCategory =
  | "general"
  | "number"
  | "currency"
  | "accounting"
  | "date"
  | "time"
  | "percentage"
  | "fraction"
  | "scientific"
  | "text"
  | "special"
  | "custom";

export const FORMAT_CATEGORIES: FormatCategory[] = [
  "general",
  "number",
  "currency",
  "accounting",
  "date",
  "time",
  "percentage",
  "fraction",
  "scientific",
  "text",
  "special",
  "custom",
];

/**
 * How negative numbers look in the Number and Currency categories:
 * `-1234.10`, red `1234.10`, `(1234.10)` and red `(1234.10)`.
 */
export type NegativeStyle = "minus" | "red" | "parens" | "redParens";

export const NEGATIVE_STYLES: NegativeStyle[] = [
  "minus",
  "red",
  "parens",
  "redParens",
];

export type NumberFormatOptions = {
  /** Decimal places (Number, Currency, Accounting, Percentage, Scientific). */
  decimals?: number;
  /** Use 1000 separator (Number). */
  thousands?: boolean;
  /** Negative number style (Number, Currency). */
  negative?: NegativeStyle;
  /** Currency symbol, "" for none (Currency, Accounting). */
  symbol?: string;
  /** Whether the symbol precedes or follows the number. */
  symbolPosition?: "before" | "after";
  /** Explicit code (Date, Time, Fraction, Special, Custom). */
  code?: string;
};

export type DescribedFormat = {
  category: FormatCategory;
  options: NumberFormatOptions;
};

export const MAX_DECIMALS = 30;

/** Currency symbols offered by the dialog (symbol, ISO code, position). */
export const CURRENCY_SYMBOLS: {
  symbol: string;
  code: string;
  position: "before" | "after";
}[] = [
  { symbol: "$", code: "USD", position: "before" },
  { symbol: "€", code: "EUR", position: "after" },
  { symbol: "£", code: "GBP", position: "before" },
  { symbol: "¥", code: "JPY/CNY", position: "before" },
  { symbol: "₹", code: "INR", position: "before" },
  { symbol: "₩", code: "KRW", position: "before" },
  { symbol: "₽", code: "RUB", position: "after" },
  { symbol: "CHF", code: "CHF", position: "before" },
  { symbol: "Kč", code: "CZK", position: "after" },
  { symbol: "zł", code: "PLN", position: "after" },
  { symbol: "kr", code: "SEK/NOK/DKK", position: "after" },
  { symbol: "R$", code: "BRL", position: "before" },
  { symbol: "₺", code: "TRY", position: "before" },
  { symbol: "₪", code: "ILS", position: "before" },
  { symbol: "₫", code: "VND", position: "after" },
  { symbol: "Rp", code: "IDR", position: "before" },
  { symbol: "R", code: "ZAR", position: "before" },
];

/** Date formats of Excel's Date category (en-US), sample 3/14/2012. */
export const DATE_FORMATS = [
  "m/d/yyyy",
  "dddd, mmmm d, yyyy",
  "m/d",
  "m/d/yy",
  "mm/dd/yy",
  "d-mmm",
  "d-mmm-yy",
  "dd-mmm-yy",
  "mmm-yy",
  "mmmm-yy",
  "mmmm d, yyyy",
  "m/d/yy h:mm AM/PM",
  "m/d/yy h:mm",
  "m/d/yyyy h:mm",
  "mmmmm",
  "mmmmm-yy",
  "d-mmm-yyyy",
  "yyyy-mm-dd",
  "yyyy/m/d",
];

/** Time formats of Excel's Time category, sample 1:30:55.2 PM. */
export const TIME_FORMATS = [
  "h:mm:ss AM/PM",
  "h:mm",
  "h:mm AM/PM",
  "h:mm:ss",
  "mm:ss",
  "mm:ss.0",
  "[h]:mm:ss",
  "m/d/yy h:mm AM/PM",
  "m/d/yy h:mm",
];

/** Fraction types: up to 1/2/3 digits, halves, quarters, ... hundredths. */
export const FRACTION_FORMATS = [
  "# ?/?",
  "# ??/??",
  "# ???/???",
  "# ?/2",
  "# ?/4",
  "# ?/8",
  "# ??/16",
  "# ?/10",
  "# ??/100",
];

/** Special formats (en-US): zip, zip+4, phone, social security number. */
export const SPECIAL_FORMATS = [
  "00000",
  "00000-0000",
  "[<=9999999]###-####;(###) ###-####",
  "000-00-0000",
];

/** Serial of 3/14/2012 13:30:55.2, Excel's own sample for date/time types. */
export const SAMPLE_DATE_SERIAL = 40982 + (13 * 3600 + 30 * 60 + 55.2) / 86400;

function decimalsPart(decimals: number) {
  const d = Math.max(0, Math.min(MAX_DECIMALS, Math.floor(decimals)));
  return d > 0 ? `.${"0".repeat(d)}` : "";
}

/** Quote a literal for use in a format code ("$", "Kč"). */
function quote(symbol: string) {
  return `"${symbol.replace(/"/g, "")}"`;
}

function withNegative(positive: string, negative: NegativeStyle) {
  switch (negative) {
    case "red":
      return `${positive};[Red]${positive}`;
    case "parens":
      return `${positive}_);(${positive})`;
    case "redParens":
      return `${positive}_);[Red](${positive})`;
    default:
      return positive;
  }
}

function accountingCode(decimals: number, symbol: string, after: boolean) {
  const num = `#,##0${decimalsPart(decimals)}`;
  const q = "?".repeat(Math.max(0, Math.min(MAX_DECIMALS, decimals)));
  if (symbol && after) {
    const s = quote(symbol);
    return `_-* ${num} ${s}_-;-* ${num} ${s}_-;_-* "-"${q} ${s}_-;_-@_-`;
  }
  const s = symbol ? quote(symbol) : "";
  return `_(${s}* ${num}_);_(${s}* \\(${num}\\);_(${s}* "-"${q}_);_(@_)`;
}

/** The format code Excel's Format Cells dialog stores for a category. */
export function buildFormatCode(
  category: FormatCategory,
  options: NumberFormatOptions = {}
): string {
  const decimals = options.decimals ?? 2;
  const negative = options.negative ?? "minus";
  const symbol = options.symbol ?? "$";
  const after = options.symbolPosition === "after";
  switch (category) {
    case "general":
      return "General";
    case "text":
      return "@";
    case "number":
      return withNegative(
        `${options.thousands ? "#,##0" : "0"}${decimalsPart(decimals)}`,
        negative
      );
    case "currency": {
      const num = `#,##0${decimalsPart(decimals)}`;
      let positive = num;
      if (symbol) {
        positive = after ? `${num} ${quote(symbol)}` : `${quote(symbol)}${num}`;
      }
      return withNegative(positive, negative);
    }
    case "accounting":
      return accountingCode(decimals, symbol, after);
    case "percentage":
      return `0${decimalsPart(decimals)}%`;
    case "scientific":
      return `0${decimalsPart(decimals)}E+00`;
    case "date":
      return options.code || DATE_FORMATS[0];
    case "time":
      return options.code || TIME_FORMATS[0];
    case "fraction":
      return options.code || FRACTION_FORMATS[0];
    case "special":
      return options.code || SPECIAL_FORMATS[0];
    default:
      return options.code || "General";
  }
}

/* ------------------------------------------------------------------ */
/* Lexing format sections                                              */
/* ------------------------------------------------------------------ */

type FmtToken = {
  /**
   * lit: literal/escape/bracket/fill; ph: 0 # ?; dot; comma; exp: E+/E-;
   * pct; slash; at; date: date/time letters; other: any other character.
   */
  kind:
    | "lit"
    | "ph"
    | "dot"
    | "comma"
    | "exp"
    | "pct"
    | "slash"
    | "at"
    | "date"
    | "other";
  text: string;
};

function lexSection(section: string): FmtToken[] {
  const out: FmtToken[] = [];
  let i = 0;
  while (i < section.length) {
    const ch = section[i];
    if (ch === '"') {
      let j = section.indexOf('"', i + 1);
      if (j === -1) j = section.length - 1;
      out.push({ kind: "lit", text: section.slice(i, j + 1) });
      i = j + 1;
    } else if (ch === "\\" || ch === "_" || ch === "*") {
      out.push({ kind: "lit", text: section.slice(i, i + 2) });
      i += 2;
    } else if (ch === "[") {
      let j = section.indexOf("]", i + 1);
      if (j === -1) j = section.length - 1;
      out.push({ kind: "lit", text: section.slice(i, j + 1) });
      i = j + 1;
    } else if (/^general/i.test(section.slice(i, i + 7))) {
      out.push({ kind: "lit", text: section.slice(i, i + 7) });
      i += 7;
    } else if (ch === "0" || ch === "#" || ch === "?") {
      out.push({ kind: "ph", text: ch });
      i += 1;
    } else if (ch === ".") {
      out.push({ kind: "dot", text: ch });
      i += 1;
    } else if (ch === ",") {
      out.push({ kind: "comma", text: ch });
      i += 1;
    } else if (
      (ch === "E" || ch === "e") &&
      (section[i + 1] === "+" || section[i + 1] === "-")
    ) {
      out.push({ kind: "exp", text: section.slice(i, i + 2) });
      i += 2;
    } else if (ch === "%") {
      out.push({ kind: "pct", text: ch });
      i += 1;
    } else if (ch === "/") {
      out.push({ kind: "slash", text: ch });
      i += 1;
    } else if (ch === "@") {
      out.push({ kind: "at", text: ch });
      i += 1;
    } else if (/^(am\/pm|a\/p)/i.test(section.slice(i, i + 5))) {
      const len = /^am\/pm/i.test(section.slice(i, i + 5)) ? 5 : 3;
      out.push({ kind: "date", text: section.slice(i, i + len) });
      i += len;
    } else if (/[ymdhsbeg]/i.test(ch)) {
      out.push({ kind: "date", text: ch });
      i += 1;
    } else {
      out.push({ kind: "other", text: ch });
      i += 1;
    }
  }
  return out;
}

/** Split a code into its `;` sections (quotes and escapes respected). */
export function splitFormatSections(fa: string): string[] {
  try {
    return SSF._split(fa);
  } catch (e) {
    return [fa];
  }
}

/** Change the decimal places of one section; null if it has no number. */
function adjustSectionDecimals(section: string, delta: number): string | null {
  const tokens = lexSection(section);
  if (tokens.some((t) => t.kind === "at" || t.kind === "date")) return null;
  if (tokens.some((t) => t.kind === "slash")) return null; // fractions
  const expIdx = tokens.findIndex((t) => t.kind === "exp");
  const mantissaEnd = expIdx === -1 ? tokens.length : expIdx;
  const phIdx: number[] = [];
  for (let i = 0; i < mantissaEnd; i += 1) {
    if (tokens[i].kind === "ph") phIdx.push(i);
  }
  const mk = (kind: FmtToken["kind"], text: string): FmtToken => ({
    kind,
    text,
  });

  if (phIdx.length === 0) {
    // Accounting zero section at 0 decimals: `"-"` grows to `"-"?`.
    const dash = tokens.findIndex((t) => t.text === '"-"');
    if (delta > 0 && dash !== -1) {
      tokens.splice(
        dash + 1,
        0,
        ...Array.from({ length: delta }, () => mk("ph", "?"))
      );
      return tokens.map((t) => t.text).join("");
    }
    return null;
  }

  const onlyQuestion = phIdx.every((i) => tokens[i].text === "?");
  const dotIdx = tokens.findIndex(
    (t, i) => i < mantissaEnd && t.kind === "dot"
  );

  if (dotIdx === -1 && onlyQuestion) {
    // `"-"??` in an accounting zero section: the ?s align decimals.
    if (delta > 0) {
      const last = phIdx[phIdx.length - 1];
      tokens.splice(
        last + 1,
        0,
        ...Array.from({ length: delta }, () => mk("ph", "?"))
      );
    } else {
      const remove = Math.min(-delta, phIdx.length);
      for (let k = 0; k < remove; k += 1) {
        tokens.splice(phIdx[phIdx.length - 1 - k], 1);
      }
    }
    return tokens.map((t) => t.text).join("");
  }

  if (dotIdx === -1) {
    if (delta < 0) return null;
    const last = phIdx[phIdx.length - 1];
    tokens.splice(
      last + 1,
      0,
      mk("dot", "."),
      ...Array.from({ length: Math.min(delta, MAX_DECIMALS) }, () =>
        mk("ph", "0")
      )
    );
    return tokens.map((t) => t.text).join("");
  }

  // Decimal placeholders directly after the point.
  let end = dotIdx + 1;
  while (end < mantissaEnd && tokens[end].kind === "ph") end += 1;
  const decimals = end - dotIdx - 1;
  if (delta > 0) {
    const add = Math.min(delta, MAX_DECIMALS - decimals);
    if (add <= 0) return null;
    tokens.splice(end, 0, ...Array.from({ length: add }, () => mk("ph", "0")));
  } else {
    const remove = Math.min(-delta, decimals);
    tokens.splice(end - remove, remove);
    if (remove === decimals) tokens.splice(dotIdx, 1);
  }
  return tokens.map((t) => t.text).join("");
}

/** Decimal places Excel's General format shows for a number. */
function generalDecimals(v: number) {
  const shown: string = SSF._general(v);
  const m = /\.(\d+)/.exec(shown.split("E")[0]);
  return {
    decimals: m ? m[1].length : 0,
    scientific: shown.indexOf("E") > -1,
  };
}

/**
 * Increase (delta > 0) or decrease (delta < 0) the decimal places of a
 * format code, like Excel's Increase/Decrease Decimal buttons. Every numeric
 * section is changed (currency, accounting, percent, scientific, custom
 * codes with sections); text sections, dates and fractions are left alone.
 * A General cell starts from the decimals its value currently shows.
 * Returns null when the code does not change.
 */
export function adjustDecimals(
  fa: string | null | undefined,
  delta: number,
  value?: unknown
): string | null {
  if (!delta) return null;
  if (isGeneralFormat(fa)) {
    const v = typeof value === "number" ? value : Number(value);
    const { decimals, scientific } =
      value === "" || value == null || !Number.isFinite(v)
        ? { decimals: 0, scientific: false }
        : generalDecimals(v);
    const next = decimals + delta;
    if (next < 0) return null;
    return `0${decimalsPart(next)}${scientific ? "E+00" : ""}`;
  }
  const code = fa as string;
  if (code === "@") return null;
  let changed = false;
  const sections = splitFormatSections(code).map((s) => {
    const next = adjustSectionDecimals(s, delta);
    if (next === null || next === s) return s;
    changed = true;
    return next;
  });
  return changed ? sections.join(";") : null;
}

/* ------------------------------------------------------------------ */
/* Recognising a code                                                  */
/* ------------------------------------------------------------------ */

/** The currency symbol a code shows, and whether it precedes the number. */
function findSymbol(section: string): { symbol: string; after: boolean } {
  const tokens = lexSection(section);
  let seenPh = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.kind === "ph") seenPh = true;
    if (t.kind === "lit" && t.text.startsWith('"') && t.text !== '"-"') {
      const symbol = t.text.slice(1, -1).trim();
      if (symbol) return { symbol, after: seenPh };
    }
    if (t.kind === "lit" && /^\[\$/.test(t.text)) {
      const symbol = t.text.slice(2, -1).split("-")[0];
      if (symbol) return { symbol, after: seenPh };
    }
    if (t.kind === "other" && /[$€£¥₹₩₽₺₪₫]/.test(t.text)) {
      return { symbol: t.text, after: seenPh };
    }
  }
  return { symbol: "", after: false };
}

function countDecimals(section: string) {
  const tokens = lexSection(section);
  const dot = tokens.findIndex((t) => t.kind === "dot");
  if (dot === -1) return 0;
  let n = 0;
  for (let i = dot + 1; i < tokens.length && tokens[i].kind === "ph"; i += 1)
    n += 1;
  return n;
}

function sameCode(a: string, b: string) {
  return a.replace(/\s+$/, "") === b.replace(/\s+$/, "");
}

/**
 * Recognise a format code as one of the Format Cells categories and the
 * options that produce it; codes no option produces are "custom" (with the
 * code in `options.code`).
 */
export function describeFormat(fa: string | null | undefined): DescribedFormat {
  if (isGeneralFormat(fa)) return { category: "general", options: {} };
  const code = fa as string;
  if (code === "@") return { category: "text", options: {} };

  const lists: [FormatCategory, string[]][] = [
    ["date", DATE_FORMATS],
    ["time", TIME_FORMATS],
    ["fraction", FRACTION_FORMATS],
    ["special", SPECIAL_FORMATS],
  ];
  for (let i = 0; i < lists.length; i += 1) {
    const [category, list] = lists[i];
    const hit = list.find((c) => c.toLowerCase() === code.toLowerCase());
    if (hit) return { category, options: { code: hit } };
  }

  const first = splitFormatSections(code)[0];
  const decimals = countDecimals(first);
  const { symbol, after } = findSymbol(first);
  const symbolPosition: "before" | "after" = after ? "after" : "before";
  const candidates: DescribedFormat[] = [
    { category: "percentage", options: { decimals } },
    { category: "scientific", options: { decimals } },
    { category: "accounting", options: { decimals, symbol, symbolPosition } },
  ];
  NEGATIVE_STYLES.forEach((negative) => {
    candidates.push({
      category: "number",
      options: { decimals, thousands: true, negative },
    });
    candidates.push({
      category: "number",
      options: { decimals, thousands: false, negative },
    });
  });
  NEGATIVE_STYLES.forEach((negative) => {
    candidates.push({
      category: "currency",
      options: { decimals, symbol, symbolPosition, negative },
    });
  });
  const hit = candidates.find((c) =>
    sameCode(buildFormatCode(c.category, c.options), code)
  );
  if (hit) return hit;
  return { category: "custom", options: { code } };
}

/**
 * The category a code belongs to for display (e.g. the ribbon's format
 * box): like describeFormat, but any date or time code counts as Date or
 * Time, and percent/scientific/currency codes by their look.
 */
export function getFormatCategory(fa: string | null | undefined) {
  const { category } = describeFormat(fa);
  if (category !== "custom") return category;
  const code = fa as string;
  const first = splitFormatSections(code)[0];
  if (lexSection(first).some((t) => t.kind === "date")) {
    return formatHasDate(code) ? "date" : "time";
  }
  if (isPercentFormat(code)) return "percentage";
  return "custom";
}

/**
 * Codes listed in the Custom category: Excel's built-in codes plus the
 * given extra codes (e.g. the ones used in the workbook), without repeats.
 */
export function customFormatList(extra: string[] = [], symbol = "$") {
  const builtIn = [
    "General",
    "0",
    "0.00",
    "#,##0",
    "#,##0.00",
    "#,##0_);(#,##0)",
    "#,##0_);[Red](#,##0)",
    "#,##0.00_);(#,##0.00)",
    "#,##0.00_);[Red](#,##0.00)",
    buildFormatCode("currency", { decimals: 0, symbol, negative: "parens" }),
    buildFormatCode("currency", {
      decimals: 0,
      symbol,
      negative: "redParens",
    }),
    buildFormatCode("currency", { decimals: 2, symbol, negative: "parens" }),
    buildFormatCode("currency", {
      decimals: 2,
      symbol,
      negative: "redParens",
    }),
    "0%",
    "0.00%",
    "0.00E+00",
    "##0.0E+0",
    "# ?/?",
    "# ??/??",
    "m/d/yyyy",
    "d-mmm-yy",
    "d-mmm",
    "mmm-yy",
    "h:mm AM/PM",
    "h:mm:ss AM/PM",
    "h:mm",
    "h:mm:ss",
    "m/d/yyyy h:mm",
    "mm:ss",
    "mm:ss.0",
    "@",
    "[h]:mm:ss",
    buildFormatCode("accounting", { decimals: 0, symbol: "" }),
    buildFormatCode("accounting", { decimals: 0, symbol }),
    buildFormatCode("accounting", { decimals: 2, symbol: "" }),
    buildFormatCode("accounting", { decimals: 2, symbol }),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  [...builtIn, ...extra].forEach((c) => {
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  });
  return out;
}

/**
 * Check a custom code the way the dialog does before applying it: returns
 * false for codes the formatter cannot parse (e.g. an unterminated quote or
 * more than four sections).
 */
export function isValidFormatCode(code: string) {
  if (!code || !code.trim()) return false;
  try {
    const sections = SSF._split(code);
    if (sections.length > 4) return false;
    SSF.format(code, 1234.5);
    SSF.format(code, -1234.5);
    SSF.format(code, 0);
    SSF.format(code, "text");
    return true;
  } catch (e) {
    return false;
  }
}
