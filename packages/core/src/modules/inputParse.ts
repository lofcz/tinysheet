/**
 * Typed-input recognition that mirrors what Excel (en-US) does when text is
 * typed into a cell: numbers, thousands separators, currency, percentages,
 * scientific notation, mixed fractions, dates, times, booleans and errors.
 *
 * Everything here is a pure function of its input so it can be unit-tested
 * without a workbook.
 */

export type ParsedInput =
  | { type: "number"; v: number; fa: string }
  | { type: "date"; v: number; fa: string }
  | { type: "boolean"; v: boolean }
  | { type: "error"; v: string }
  | { type: "text"; v: string };

export type ParseOptions = {
  /** Reference date used for inputs without a year (e.g. "3/15"). */
  now?: Date;
};

export const GENERAL = "General";

const ERROR_VALUES = [
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#GETTING_DATA",
  "#SPILL!",
  "#CALC!",
];

/** Excel keeps 15 significant digits; the rest are zeroed (truncated). */
const MAX_DIGITS = 15;

const CURRENCY_SYMBOLS = "$€£¥₹₩₽¢";

const MONTHS_EN = [
  ["jan", "january"],
  ["feb", "february"],
  ["mar", "march"],
  ["apr", "april"],
  ["may", "may"],
  ["jun", "june"],
  ["jul", "july"],
  ["aug", "august"],
  ["sep", "september", "sept"],
  ["oct", "october"],
  ["nov", "november"],
  ["dec", "december"],
];

const WEEKDAYS_EN = [
  "sun",
  "sunday",
  "mon",
  "monday",
  "tue",
  "tues",
  "tuesday",
  "wed",
  "wednesday",
  "thu",
  "thur",
  "thurs",
  "thursday",
  "fri",
  "friday",
  "sat",
  "saturday",
];

let extraMonthNames: string[][] = [];

/**
 * Register additional (localised) month names that typed input should
 * recognise, e.g. `[["janv.", "janvier"], ...]` (12 entries, any casing).
 */
export function setInputMonthNames(names: string[][] | null | undefined) {
  extraMonthNames = (names || []).map((l) =>
    (l || []).map((n) => String(n).toLowerCase())
  );
}

function monthFromName(name: string): number {
  const n = name.toLowerCase().replace(/\.$/, "");
  for (let i = 0; i < 12; i += 1) {
    if (MONTHS_EN[i].includes(n)) return i + 1;
    const extra = extraMonthNames[i];
    if (extra && (extra.includes(n) || extra.includes(`${n}.`))) return i + 1;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Serial dates (1900 date system, including the Lotus 29-Feb-1900 bug) */
/* ------------------------------------------------------------------ */

function isLeapYear(y: number) {
  if (y === 1900) return true; // Excel's intentional Lotus bug
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    m - 1
  ];
}

export function isValidDate(y: number, m: number, d: number) {
  return (
    Number.isInteger(y) &&
    Number.isInteger(m) &&
    Number.isInteger(d) &&
    y >= 1900 &&
    y <= 9999 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
}

/** Excel serial number for a calendar date (1 = 1900-01-01, 60 = 1900-02-29). */
export function dateToSerial(y: number, m: number, d: number): number {
  if (y === 1900 && m === 2 && d === 29) return 60;
  const days = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 31)) / 86400000
  );
  // Serials after 28-Feb-1900 are shifted by the phantom 29-Feb-1900.
  return days >= 60 ? days + 1 : days;
}

/** Excel's two-digit year window: 00-29 → 2000s, 30-99 → 1900s. */
function expandYear(y: string): number {
  const n = parseInt(y, 10);
  if (y.length <= 2) return n < 30 ? 2000 + n : 1900 + n;
  return n;
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/** Zero out digits beyond the 15th significant digit (Excel truncates). */
function truncateDigits(intPart: string, fracPart: string) {
  const all = intPart + fracPart;
  const firstSig = all.search(/[1-9]/);
  if (firstSig < 0 || all.length - firstSig <= MAX_DIGITS) {
    return [intPart, fracPart];
  }
  const keep = firstSig + MAX_DIGITS;
  const truncated = all.slice(0, keep) + "0".repeat(all.length - keep);
  return [
    truncated.slice(0, intPart.length),
    truncated.slice(intPart.length).replace(/0+$/, ""),
  ];
}

type NumberParts = {
  value: number;
  hasDecimal: boolean;
  hasThousands: boolean;
  hasExponent: boolean;
};

const NUMBER_RE = /^(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

function parseUnsignedNumber(s: string): NumberParts | null {
  const m = NUMBER_RE.exec(s);
  if (!m) return null;
  const rawInt = m[1] || "";
  const rawFrac = m[2];
  if (rawInt.replace(/,/g, "") === "" && !rawFrac) return null;
  const hasThousands = rawInt.indexOf(",") > -1;
  const hasExponent = m[3] !== undefined;
  // Excel does not accept "1,234e5".
  if (hasThousands && hasExponent) return null;
  const [intPart, fracPart] = truncateDigits(
    rawInt.replace(/,/g, "") || "0",
    rawFrac || ""
  );
  const value = Number(
    `${intPart}${fracPart ? `.${fracPart}` : ""}${
      hasExponent ? `e${m[3]}` : ""
    }`
  );
  if (!Number.isFinite(value)) return null;
  return {
    value,
    hasDecimal: rawFrac !== undefined && rawFrac.length > 0,
    hasThousands,
    hasExponent,
  };
}

function currencyFormat(symbol: string, trailing: boolean, decimals: boolean) {
  const num = decimals ? "#,##0.00" : "#,##0";
  const quoted = `"${symbol}"`;
  return trailing ? `${num}${quoted}` : `${quoted}${num}`;
}

function parseNumber(input: string): ParsedInput | null {
  let s = input;
  let negative = false;
  let percent = false;
  let currency = "";
  let currencyTrailing = false;

  // Accounting negative: (123), ($123)
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1].trim();
  }

  const takeSign = () => {
    if (s[0] === "-" || s[0] === "+") {
      if (s[0] === "-") {
        if (negative) return false;
        negative = true;
      }
      s = s.slice(1).trim();
    }
    return true;
  };
  const takeLeadingCurrency = () => {
    if (s && CURRENCY_SYMBOLS.indexOf(s[0]) > -1) {
      if (currency) return false;
      currency = s.charAt(0);
      s = s.slice(1).trim();
    }
    return true;
  };

  // Sign and currency can appear in either order: -$3, $-3
  if (!takeSign() || !takeLeadingCurrency() || !takeSign()) return null;

  // Trailing currency symbol: 5€, 5 €
  const last = s[s.length - 1];
  if (last && CURRENCY_SYMBOLS.indexOf(last) > -1) {
    if (currency) return null;
    currency = last;
    currencyTrailing = true;
    s = s.slice(0, -1).trim();
  }

  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1).trim();
  }

  // Trailing minus: "3-"
  if (s.endsWith("-") && !negative && s.length > 1) {
    negative = true;
    s = s.slice(0, -1);
  }

  if (percent && currency) return null;

  const parts = parseUnsignedNumber(s);
  if (!parts) return null;

  let { value } = parts;
  if (percent) value = Number((value / 100).toPrecision(MAX_DIGITS));
  if (negative) value = -value;
  if (Object.is(value, -0)) value = 0;

  let fa = GENERAL;
  if (currency) {
    fa = currencyFormat(currency, currencyTrailing, parts.hasDecimal);
  } else if (percent) {
    fa = parts.hasDecimal ? "0.00%" : "0%";
  } else if (parts.hasExponent) {
    fa = "0.00E+00";
  } else if (parts.hasThousands) {
    fa = parts.hasDecimal ? "#,##0.00" : "#,##0";
  }
  return { type: "number", v: value, fa };
}

/** "0 1/2", "1 3/16", "-2 1/4" → mixed fractions (plain "1/2" is a date). */
function parseFraction(s: string): ParsedInput | null {
  const m = /^([+-])?(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (!m) return null;
  const whole = parseInt(m[2], 10);
  const num = parseInt(m[3], 10);
  const den = parseInt(m[4], 10);
  if (den === 0 || m[4].length > 3) return null;
  let v = whole + num / den;
  if (m[1] === "-") v = -v;
  // One "?" per denominator digit: "# ?/?", "# ??/??", "# ???/???".
  const q = "?".repeat(m[4].length);
  return { type: "number", v, fa: `# ${q}/${q}` };
}

/* ------------------------------------------------------------------ */
/* Times                                                               */
/* ------------------------------------------------------------------ */

type TimeParts = { value: number; fa: string };

function parseTime(s: string): TimeParts | null {
  // mm:ss.0 (minutes and fractional seconds)
  let m = /^(\d{1,2}):(\d{1,2}\.\d+)$/.exec(s);
  if (m) {
    const min = parseInt(m[1], 10);
    const sec = parseFloat(m[2]);
    if (sec >= 60) return null;
    return { value: (min * 60 + sec) / 86400, fa: "mm:ss.0" };
  }

  m =
    /^(\d{1,4})(?::(\d{1,2}))?(?::(\d{1,2}(?:\.\d+)?))?\s*([AaPp][Mm]?)?$/.exec(
      s
    );
  if (!m) return null;
  const [, hs, ms, ss, ampmRaw] = m;
  // A bare number is not a time; "9 PM" is.
  if (ms === undefined && !ampmRaw) return null;
  if (ms === undefined && ss !== undefined) return null;
  let h = parseInt(hs, 10);
  const min = ms === undefined ? 0 : parseInt(ms, 10);
  const sec = ss === undefined ? 0 : parseFloat(ss);
  if (min >= 60 || sec >= 60) return null;
  let fa: string;
  if (ampmRaw) {
    if (h > 12) return null;
    const pm = ampmRaw[0].toLowerCase() === "p";
    if (h === 12) h = 0;
    if (pm) h += 12;
    fa = ss !== undefined ? "h:mm:ss AM/PM" : "h:mm AM/PM";
  } else if (h >= 24) {
    if (hs.length > 4) return null;
    fa = "[h]:mm:ss";
  } else {
    fa = ss !== undefined ? "h:mm:ss" : "h:mm";
  }
  return { value: (h * 3600 + min * 60 + sec) / 86400, fa };
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

type DateParts = { serial: number; fa: string };

function makeDate(
  y: number,
  mo: number,
  d: number,
  fa: string
): DateParts | null {
  if (!isValidDate(y, mo, d)) return null;
  return { serial: dateToSerial(y, mo, d), fa };
}

function parseDatePart(input: string, now: Date): DateParts | null {
  // Drop a leading weekday name ("Friday, March 15, 2024").
  let s = input;
  const wd = /^([A-Za-z]+)\.?,?\s+(.*)$/.exec(s);
  if (wd && WEEKDAYS_EN.includes(wd[1].toLowerCase())) [, , s] = wd;

  const curYear = now.getFullYear();
  let m: RegExpExecArray | null;

  // ISO-ish, year first: 2024-03-15, 2024/3/15
  m = /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/.exec(s);
  if (m) {
    return makeDate(
      +m[1],
      +m[3],
      +m[4],
      m[2] === "-" ? "yyyy-mm-dd" : "yyyy/m/d"
    );
  }

  // Month first (en-US): 3/15/2024, 3-15-24
  m = /^(\d{1,2})([-/])(\d{1,2})\2(\d{2}|\d{4})$/.exec(s);
  if (m) return makeDate(expandYear(m[4]), +m[1], +m[3], "m/d/yyyy");

  // Two numbers: month/day of the current year, else month/year.
  m = /^(\d{1,2})[-/](\d{1,4})$/.exec(s);
  if (m) {
    const mo = +m[1];
    const second = m[2];
    if (second.length <= 2 && isValidDate(curYear, mo, +second)) {
      return makeDate(curYear, mo, +second, "d-mmm");
    }
    if (second.length === 2 || second.length === 4) {
      return makeDate(expandYear(second), mo, 1, "mmm-yy");
    }
    return null;
  }

  // Day first, month name: 15-Mar-2024, 15 March 2024, 15-Mar
  m =
    /^(\d{1,2})(?:[-\s/]+|\.\s*)([A-Za-zÀ-ɏ]+\.?)(?:[-\s/,]+(\d{2}|\d{4}))?$/.exec(
      s
    );
  if (m) {
    const mo = monthFromName(m[2]);
    if (!mo) return null;
    if (m[3] === undefined) return makeDate(curYear, mo, +m[1], "d-mmm");
    return makeDate(expandYear(m[3]), mo, +m[1], "d-mmm-yy");
  }

  // Month name first: Mar 15, 2024 / March 15 2024 / Mar-15 / Mar 2024 / Sept2
  m =
    /^([A-Za-zÀ-ɏ]+\.?)[-\s/]*(\d{1,4})(?:(?:,\s*|[-\s/]+)(\d{2}|\d{4}))?$/.exec(
      s
    );
  if (m) {
    const mo = monthFromName(m[1]);
    if (!mo) return null;
    const n = m[2];
    if (m[3] !== undefined) {
      if (n.length > 2) return null;
      return makeDate(expandYear(m[3]), mo, +n, "d-mmm-yy");
    }
    if (n.length <= 2 && isValidDate(curYear, mo, +n)) {
      return makeDate(curYear, mo, +n, "d-mmm");
    }
    if (n.length === 2 || n.length === 4) {
      return makeDate(expandYear(n), mo, 1, "mmm-yy");
    }
    return null;
  }

  return null;
}

/** Time format to append to a date format; elapsed/min:sec times can't. */
function timeSuffix(fa: string) {
  return fa === "[h]:mm:ss" || fa === "mm:ss.0" ? null : fa;
}

function parseDateTime(s: string, now: Date): ParsedInput | null {
  const time = parseTime(s);
  if (time) return { type: "date", v: time.value, fa: time.fa };

  const date = parseDatePart(s, now);
  if (date) return { type: "date", v: date.serial, fa: date.fa };

  // Date followed by a time ("2024-03-15 13:45", "3/15/2024 9:30 PM",
  // "2024-03-15T13:45:10"). Try every split point from the right.
  const splitRe = /[\sT]+/g;
  let match: RegExpExecArray | null;
  const splits: [number, number][] = [];
  // eslint-disable-next-line no-cond-assign
  while ((match = splitRe.exec(s))) {
    splits.push([match.index, match.index + match[0].length]);
  }
  for (let i = splits.length - 1; i >= 0; i -= 1) {
    const [a, b] = splits[i];
    const dPart = s.slice(0, a);
    const tPart = s.slice(b);
    const t = parseTime(tPart);
    if (t) {
      const suffix = timeSuffix(t.fa);
      const d = suffix ? parseDatePart(dPart, now) : null;
      if (d && suffix) {
        return { type: "date", v: d.serial + t.value, fa: `${d.fa} ${suffix}` };
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Interpret typed text the way Excel does for a cell formatted as General.
 * A leading apostrophe is *not* handled here (callers strip it and force
 * text), neither is a leading "=" (formulas).
 */
export function parseInput(
  raw: string | number | boolean,
  opts: ParseOptions = {}
): ParsedInput {
  if (typeof raw === "number") {
    return { type: "number", v: raw, fa: GENERAL };
  }
  if (typeof raw === "boolean") {
    return { type: "boolean", v: raw };
  }
  const text = String(raw);
  const s = text.trim();
  if (s === "") return { type: "text", v: text };

  const upper = s.toUpperCase();
  if (upper === "TRUE") return { type: "boolean", v: true };
  if (upper === "FALSE") return { type: "boolean", v: false };
  if (ERROR_VALUES.includes(upper)) return { type: "error", v: upper };

  const num = parseNumber(s);
  if (num) return num;

  const frac = parseFraction(s);
  if (frac) return frac;

  const dt = parseDateTime(s, opts.now || new Date());
  if (dt) return dt;

  return { type: "text", v: text };
}

/* ------------------------------------------------------------------ */
/* Format-code helpers                                                 */
/* ------------------------------------------------------------------ */

/** Remove quoted literals, escapes and bracket blocks from a format code. */
function stripLiterals(fa: string) {
  return fa
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/_./g, "")
    .replace(/\*./g, "")
    .replace(/\[[^\]]*\]/g, "");
}

export function isGeneralFormat(fa: string | null | undefined) {
  return !fa || fa.trim().toLowerCase() === "general";
}

export function isTextFormat(fa: string | null | undefined) {
  return fa === "@";
}

export function isPercentFormat(fa: string | null | undefined) {
  if (!fa) return false;
  const first = fa.split(";")[0];
  return stripLiterals(first).indexOf("%") > -1;
}

/** Whether the first section of a format shows date parts (y, d, m-as-month). */
export function formatHasDate(fa: string | null | undefined) {
  if (!fa) return false;
  const f = stripLiterals(fa.split(";")[0]).toLowerCase();
  if (/[yd]/.test(f) || /(^|[^a-z])e+([^a-z]|$)/.test(f)) return true;
  // "m" is a month unless it follows h or precedes s.
  const mm = f.replace(/h+[^a-z0-9]*m+/g, "").replace(/m+[^a-z0-9]*s/g, "");
  return /m/.test(mm);
}

/** Whether the first section of a format shows time parts. */
export function formatHasTime(fa: string | null | undefined) {
  if (!fa) return false;
  const raw = fa.split(";")[0];
  if (/\[(h+|m+|s+)\]/i.test(raw)) return true;
  const f = stripLiterals(raw).toLowerCase();
  return /[hs]/.test(f) || /am\/pm|a\/p/.test(f);
}

export type TypedCellValue = {
  v: number | string | boolean;
  /** Number format code to store in ct.fa. */
  fa: string;
  /** Cell type to store in ct.t. */
  t: "n" | "d" | "b" | "e" | "g" | "s";
};

/**
 * Apply Excel's rules for typing into a cell that may already carry a
 * number format:
 *
 * - General cells take the format implied by the input ("$5" → currency).
 * - Text (@) cells keep everything as text.
 * - Other formats are kept, except that a date/time typed into a date/time
 *   format of a different kind (time into a date-only format, or a date into
 *   a time-only format) switches to the recognised format.
 * - Percent cells use automatic percent entry: typing 5 stores 0.05 (numbers
 *   whose magnitude is below 1 are taken as-is, so 0.5 stays 50%).
 * - Text typed into a formatted cell keeps the format (its text section, if
 *   any, still applies).
 */
export function resolveTypedInput(
  raw: string | number | boolean,
  currentFa?: string | null,
  opts: ParseOptions = {}
): TypedCellValue {
  if (isTextFormat(currentFa)) {
    return { v: String(raw), fa: "@", t: "s" };
  }
  const parsed = parseInput(raw, opts);
  const keep = !isGeneralFormat(currentFa);
  const cur = currentFa as string;

  switch (parsed.type) {
    case "boolean":
      return { v: parsed.v, fa: keep ? cur : GENERAL, t: "b" };
    case "error":
      return { v: parsed.v, fa: keep ? cur : GENERAL, t: "e" };
    case "text":
      return { v: parsed.v, fa: keep ? cur : GENERAL, t: "g" };
    default:
      break;
  }

  if (!keep) {
    return {
      v: parsed.v,
      fa: parsed.fa,
      t: parsed.type === "date" ? "d" : "n",
    };
  }

  const curIsDate = formatHasDate(cur) || formatHasTime(cur);
  let { v } = parsed;
  let fa = cur;

  if (parsed.type === "date" && curIsDate) {
    const typedTimeOnly = v < 1 && !formatHasDate(parsed.fa);
    const typedHasDate = formatHasDate(parsed.fa);
    if (
      (typedTimeOnly && !formatHasTime(cur)) ||
      (typedHasDate && !formatHasDate(cur))
    ) {
      fa = parsed.fa;
    }
  } else if (
    typeof raw === "string" &&
    parsed.type === "number" &&
    isPercentFormat(cur) &&
    !isPercentFormat(parsed.fa)
  ) {
    // Automatic percent entry (typed text only, not programmatic numbers).
    if (Math.abs(v) >= 1) v = Number((v / 100).toPrecision(MAX_DIGITS));
  }

  return { v, fa, t: formatHasDate(fa) || formatHasTime(fa) ? "d" : "n" };
}
