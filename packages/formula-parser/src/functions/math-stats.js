// See ./index.js for the calling convention.
//
// Math & statistics functions with Excel-exact semantics. Most entries here
// override the formulajs implementation because formulajs does not follow
// Excel's coercion rules. The rules implemented throughout this module are:
//
// * Ranges and arrays (2D arrays) are "references": only real numbers take
//   part in numeric aggregates; text, booleans and blanks are skipped, and
//   error values propagate (unless a function explicitly ignores them).
// * Scalars are "direct arguments": numbers, booleans and text that parses as
//   a number (or a date/time) are coerced. A scalar can't be told apart from a
//   single-cell reference here, so non-numeric text scalars are skipped rather
//   than raising #VALUE! (Excel raises #VALUE! only for a typed literal).
// * Error values arrive either as Error instances or, from the host sheet, as
//   error strings such as "#N/A"; both are treated as errors.
//
// The helpers are exported (named) so ./date-financial.js can share them.

import {
  ERROR_DIV_ZERO,
  ERROR_NOT_AVAILABLE,
  ERROR_NUM,
  ERROR_VALUE,
  isValidStrict,
} from "../error";

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export function isErrorValue(v) {
  return v instanceof Error || (typeof v === "string" && isValidStrict(v));
}

/** Convert an error value (Error or "#N/A" string) to an Error. */
export function toError(v) {
  if (v instanceof Error) return v;
  return Error(String(v).replace(/#|!|\?/g, ""));
}

export function fail(code) {
  throw Error(code);
}

/**
 * Wrap entries of `functions` so that calling one with fewer than its
 * required number of arguments yields #VALUE! (Excel refuses such formulas;
 * blanks passed for present arguments are still accepted).
 */
export function withArity(functions, arity) {
  Object.keys(arity).forEach((name) => {
    const fn = functions[name];
    const required = arity[name];
    functions[name] = (...args) => {
      if (args.length < required) fail(ERROR_VALUE);
      return fn(...args);
    };
  });
  return functions;
}

/* -------------------------------------------------------------------------- */
/* Excel serial dates (1900 date system, including the 1900 leap-year bug)    */
/* -------------------------------------------------------------------------- */

export const MAX_SERIAL = 2958465; // 9999-12-31

function daysFromCivil(y, m, d) {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468; // days since 1970-01-01
}

function civilFromDays(days) {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}

/** Excel treats 1900 as a leap year. */
export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 || y === 1900;
}

export function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    m - 1
  ];
}

/**
 * Serial number of a (possibly overflowing) year/month/day, like Excel's
 * DATE: months and days roll over into the following/preceding periods.
 */
export function serialFromYMD(y, m, d) {
  const yy = y + Math.floor((m - 1) / 12);
  const mm = ((((m - 1) % 12) + 12) % 12) + 1;
  let first = daysFromCivil(yy, mm, 1) + 25569;
  if (first <= 60) first -= 1; // before 1900-03-01 Excel is one day behind
  return first + d - 1;
}

/** [year, month, day] of a serial (integer part); serial 60 is 1900-02-29. */
export function ymdFromSerial(serial) {
  const n = Math.floor(serial);
  if (n === 60) return [1900, 2, 29];
  if (n === 0) return [1900, 1, 0];
  return civilFromDays((n < 60 ? n + 1 : n) - 25569);
}

/** Day of week, 0 = Sunday (serial 1 is a Sunday in Excel). */
export function weekdayOf(serial) {
  return (((Math.floor(serial) - 1) % 7) + 7) % 7;
}

export function dateToSerial(date) {
  return (
    serialFromYMD(date.getFullYear(), date.getMonth() + 1, date.getDate()) +
    (date.getHours() * 3600 +
      date.getMinutes() * 60 +
      date.getSeconds() +
      date.getMilliseconds() / 1000) /
      86400
  );
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function monthFromName(name) {
  const n = name.toLowerCase();
  if (n.length < 3) return 0;
  const idx = MONTHS.findIndex((m) => n.startsWith(m));
  if (idx < 0) return 0;
  const full = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ][idx];
  return full.startsWith(n) || n === "sept" ? idx + 1 : 0;
}

function parseTimeText(t) {
  const m =
    /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}(?:\.\d+)?))?\s*(am|pm|a|p)?$/i.exec(
      t
    );
  if (!m || (m[2] === undefined && !m[4])) return undefined;
  let h = Number(m[1]);
  const mins = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  if (mins > 59 || s >= 60) return undefined;
  if (m[4]) {
    if (h > 12) return undefined;
    const pm = m[4][0].toLowerCase() === "p";
    if (h === 12) h = 0;
    if (pm) h += 12;
  }
  return (h * 3600 + mins * 60 + s) / 86400;
}

function twoDigitYear(y, text) {
  if (text.length <= 2) return y < 30 ? 2000 + y : 1900 + y;
  return y;
}

function validDate(y, m, d) {
  if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1) return undefined;
  if (d > daysInMonth(y, m)) return undefined;
  return serialFromYMD(y, m, d);
}

function parseDatePart(t) {
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(t);
  if (m) return validDate(twoDigitYear(+m[3], m[3]), +m[1], +m[2]); // m/d/y
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (m) return validDate(new Date().getFullYear(), +m[1], +m[2]);
  m = /^(\d{1,2})[-\s]+([a-z]+)\.?(?:[-\s,]+(\d{2,4}))?$/i.exec(t);
  if (m) {
    const mon = monthFromName(m[2]);
    if (!mon) return undefined;
    const y = m[3] ? twoDigitYear(+m[3], m[3]) : new Date().getFullYear();
    return validDate(y, mon, +m[1]);
  }
  m = /^([a-z]+)\.?[-\s]+(\d{1,2})(?:(?:,\s*|[-\s]+)(\d{4}))?$/i.exec(t);
  if (m) {
    const mon = monthFromName(m[1]);
    if (!mon) return undefined;
    return validDate(m[3] ? +m[3] : new Date().getFullYear(), mon, +m[2]);
  }
  m = /^([a-z]+)\.?[-\s]+(\d{4})$/i.exec(t);
  if (m) {
    const mon = monthFromName(m[1]);
    return mon ? validDate(+m[2], mon, 1) : undefined;
  }
  return undefined;
}

/**
 * Parse date and/or time text ("2020-03-15", "3/15/2020", "15-Mar-2020",
 * "March 15, 2020", "13:30", "1:30 PM", "2020-03-15 13:30:00") into
 * { date, time }: a whole-day serial (0 for time-only text) and a day
 * fraction. Returns undefined when the text isn't a date or time.
 */
export function parseDateTimeParts(text) {
  const t = String(text)
    .trim()
    .replace(/(\d)T(\d)/, "$1 $2")
    .replace(/(\d)Z$/i, "$1");
  if (!t) return undefined;
  const time = parseTimeText(t);
  if (time !== undefined) return { date: 0, time };
  const date = parseDatePart(t);
  if (date !== undefined) return { date, time: 0 };
  // "<date> <time>"
  const m =
    /^(.*?\d)\s+(\d{1,2}(?::\d{1,2}){1,2}(?:\.\d+)?\s*(?:am|pm|a|p)?)$/i.exec(
      t
    );
  if (m) {
    const d = parseDatePart(m[1]);
    const tm = parseTimeText(m[2]);
    if (d !== undefined && tm !== undefined) return { date: d, time: tm };
  }
  return undefined;
}

/** Date/time text as a serial number, or undefined. */
export function parseDateTimeText(text) {
  const parts = parseDateTimeParts(text);
  return parts && parts.date + parts.time;
}

/* -------------------------------------------------------------------------- */
/* Coercion                                                                   */
/* -------------------------------------------------------------------------- */

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Convert text to a number the way Excel's VALUE does ("1,234.5", "50%",
 * "$12", "(3)", "1e3", dates and times). Returns undefined if not numeric.
 */
export function parseNumberText(text) {
  let t = String(text).trim();
  if (!t) return undefined;
  let sign = 1;
  if (/^\(.*\)$/.test(t)) {
    sign = -1;
    t = t.slice(1, -1).trim();
  }
  let pct = 0;
  while (t.endsWith("%")) {
    pct++;
    t = t.slice(0, -1).trim();
  }
  t = t.replace(/^([+-]?)\s*\$\s*/, "$1");
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) t = t.replace(/,/g, "");
  if (NUMBER_RE.test(t)) return (sign * Number(t)) / 100 ** pct;
  if (sign === 1 && pct === 0) return parseDateTimeText(text);
  return undefined;
}

/** First element of a (possibly nested) array, or the value itself. */
export function scalar(v) {
  let x = v;
  while (Array.isArray(x)) x = x[0];
  return x;
}

/**
 * Coerce a direct argument to a number (Excel value context): numbers,
 * booleans, blanks (0), numeric/date text; errors propagate, other text is
 * #VALUE!.
 */
export function toNumber(v) {
  const x = scalar(v);
  if (typeof x === "number") {
    if (!Number.isFinite(x)) fail(ERROR_NUM);
    return x;
  }
  if (typeof x === "boolean") return x ? 1 : 0;
  if (x === null || x === undefined || x === "") return 0;
  if (x instanceof Date) return dateToSerial(x);
  if (isErrorValue(x)) throw toError(x);
  if (typeof x === "string") {
    const n = parseNumberText(x);
    if (n !== undefined) return n;
  }
  return fail(ERROR_VALUE);
}

/** Like toNumber but returns `def` for a missing/blank argument. */
export function optNumber(v, def) {
  const x = scalar(v);
  return x === undefined || x === null || x === "" ? def : toNumber(x);
}

export function toBoolean(v) {
  const x = scalar(v);
  if (typeof x === "boolean") return x;
  if (x === null || x === undefined) return false;
  if (typeof x === "number") return x !== 0;
  if (isErrorValue(x)) throw toError(x);
  if (typeof x === "string") {
    const u = x.trim().toUpperCase();
    if (u === "TRUE") return true;
    if (u === "FALSE") return false;
  }
  return fail(ERROR_VALUE);
}

/** Normalise a value into a 2D array. */
export function toGrid(v) {
  if (!Array.isArray(v)) return [[v]];
  if (v.length === 0) return [[]];
  if (!Array.isArray(v[0])) return [v];
  return v;
}

export function flatten(v, out = []) {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) flatten(v[i], out);
  } else {
    out.push(v);
  }
  return out;
}

/**
 * Collect the numbers of an argument list with Excel semantics.
 * options.ignoreErrors - skip error values instead of propagating them
 * options.a            - "A" variants: text counts as 0, TRUE as 1, FALSE as 0
 */
export function collectNumbers(args, options = {}) {
  const out = [];
  const { ignoreErrors = false, a = false } = options;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (Array.isArray(arg)) {
      const items = flatten(arg);
      for (let j = 0; j < items.length; j++) {
        const v = items[j];
        if (typeof v === "number") {
          if (Number.isFinite(v)) out.push(v);
        } else if (v instanceof Date) {
          out.push(dateToSerial(v));
        } else if (isErrorValue(v)) {
          if (!ignoreErrors) throw toError(v);
        } else if (a && typeof v === "boolean") {
          out.push(v ? 1 : 0);
        } else if (a && typeof v === "string") {
          out.push(0);
        }
      }
    } else if (isErrorValue(arg)) {
      if (!ignoreErrors) throw toError(arg);
    } else if (typeof arg === "number") {
      if (Number.isFinite(arg)) out.push(arg);
    } else if (typeof arg === "boolean") {
      out.push(arg ? 1 : 0);
    } else if (arg instanceof Date) {
      out.push(dateToSerial(arg));
    } else if (typeof arg === "string") {
      const n = parseNumberText(arg);
      if (n !== undefined) out.push(n);
      else if (a) out.push(0);
    }
  }
  return out;
}

/** Remove floating-point noise the way Excel does (15 significant digits). */
export function clean15(x) {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number(x.toPrecision(15));
}

/* -------------------------------------------------------------------------- */
/* Aggregates over number lists                                               */
/* -------------------------------------------------------------------------- */

function sum(nums) {
  let s = 0;
  for (let i = 0; i < nums.length; i++) s += nums[i];
  return s;
}

function average(nums) {
  if (!nums.length) fail(ERROR_DIV_ZERO);
  return sum(nums) / nums.length;
}

function max(nums) {
  if (!nums.length) return 0;
  let m = -Infinity;
  for (let i = 0; i < nums.length; i++) if (nums[i] > m) m = nums[i];
  return m;
}

function min(nums) {
  if (!nums.length) return 0;
  let m = Infinity;
  for (let i = 0; i < nums.length; i++) if (nums[i] < m) m = nums[i];
  return m;
}

function product(nums) {
  if (!nums.length) return 0;
  let p = 1;
  for (let i = 0; i < nums.length; i++) p *= nums[i];
  return p;
}

function variance(nums, sample) {
  const n = nums.length;
  if (n === 0 || (sample && n === 1)) fail(ERROR_DIV_ZERO);
  const mean = sum(nums) / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (nums[i] - mean) ** 2;
  return ss / (sample ? n - 1 : n);
}

function sortedAsc(nums) {
  return nums.slice().sort((x, y) => x - y);
}

function median(nums) {
  if (!nums.length) fail(ERROR_NUM);
  const s = sortedAsc(nums);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Modes in order of first occurrence (only values that repeat). */
function modes(nums) {
  const counts = new Map();
  let best = 1;
  for (let i = 0; i < nums.length; i++) {
    const c = (counts.get(nums[i]) || 0) + 1;
    counts.set(nums[i], c);
    if (c > best) best = c;
  }
  if (best < 2) fail(ERROR_NOT_AVAILABLE);
  const out = [];
  counts.forEach((c, v) => {
    if (c === best) out.push(v);
  });
  return out;
}

function kth(nums, kArg, largest) {
  const k = Math.ceil(clean15(toNumber(kArg)));
  if (!nums.length || k < 1 || k > nums.length) fail(ERROR_NUM);
  const s = sortedAsc(nums);
  return largest ? s[s.length - k] : s[k - 1];
}

function percentileInc(nums, kArg) {
  const k = toNumber(kArg);
  if (!nums.length || k < 0 || k > 1) fail(ERROR_NUM);
  const s = sortedAsc(nums);
  const h = (s.length - 1) * k;
  const lo = Math.floor(h);
  return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo];
}

function percentileExc(nums, kArg) {
  const k = toNumber(kArg);
  const n = nums.length;
  if (!n || k <= 0 || k >= 1) fail(ERROR_NUM);
  const h = clean15((n + 1) * k);
  if (h < 1 || h > n) fail(ERROR_NUM);
  const s = sortedAsc(nums);
  const lo = Math.floor(h);
  return lo < n ? s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]) : s[n - 1];
}

function quartileInc(nums, qArg) {
  const q = Math.trunc(toNumber(qArg));
  if (q < 0 || q > 4) fail(ERROR_NUM);
  return percentileInc(nums, q / 4);
}

function quartileExc(nums, qArg) {
  const q = Math.trunc(toNumber(qArg));
  if (q <= 0 || q >= 4) fail(ERROR_NUM);
  return percentileExc(nums, q / 4);
}

function countValues(args, ignoreErrors) {
  let n = 0;
  flatten(args).forEach((v) => {
    if (v === null || v === undefined) return;
    if (ignoreErrors && isErrorValue(v)) return;
    n++;
  });
  return n;
}

function countNumbers(args) {
  let n = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (Array.isArray(arg)) {
      flatten(arg).forEach((v) => {
        if ((typeof v === "number" && Number.isFinite(v)) || v instanceof Date)
          n++;
      });
    } else if (
      typeof arg === "number" ||
      typeof arg === "boolean" ||
      arg instanceof Date ||
      (typeof arg === "string" &&
        !isErrorValue(arg) &&
        parseNumberText(arg) !== undefined)
    ) {
      n++;
    }
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/* Rounding                                                                   */
/* -------------------------------------------------------------------------- */

/** Multiply by 10^digits exactly (decimal shift through the string form). */
function shift(x, digits) {
  const [m, e] = String(x).split("e");
  return Number(`${m}e${Number(e || 0) + digits}`);
}

function roundWith(value, digitsArg, mode) {
  const x = toNumber(value);
  const digits = Math.trunc(toNumber(digitsArg));
  if (x === 0) return 0;
  const abs = clean15(Math.abs(x));
  const scaled = shift(abs, digits);
  let r;
  if (mode === "up") r = Math.ceil(clean15(scaled));
  else if (mode === "down") r = Math.floor(clean15(scaled));
  else r = Math.floor(scaled + 0.5);
  const out = shift(r, -digits);
  return x < 0 && out !== 0 ? -out : out;
}

/** Round x to a multiple of sig using `fn` (Math.ceil/floor) on x/sig. */
function roundToMultiple(x, sig, fn) {
  if (sig === 0 || x === 0) return 0;
  const q = clean15(x / sig);
  return clean15(fn(q) * sig) || 0;
}

/** Negate without producing -0. */
function neg(x) {
  return x === 0 ? 0 : -x;
}

/* -------------------------------------------------------------------------- */
/* Criteria (SUMIF, COUNTIF(S), AVERAGEIF(S), MAXIFS, MINIFS)                 */
/* -------------------------------------------------------------------------- */

function wildcardRegex(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (
      ch === "~" &&
      i + 1 < pattern.length &&
      "*?~".includes(pattern[i + 1])
    ) {
      re += `\\${pattern[++i]}`;
    } else if (ch === "*") re += "[\\s\\S]*";
    else if (ch === "?") re += "[\\s\\S]";
    else re += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

function cellNumber(v) {
  if (typeof v === "number") return v;
  if (v instanceof Date) return dateToSerial(v);
  if (typeof v === "string" && !isErrorValue(v)) {
    const n = parseNumberText(v);
    return n;
  }
  return undefined;
}

function compare(a, b, op) {
  switch (op) {
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case ">=":
      return a >= b;
    case "<>":
      return a !== b;
    default:
      return a === b;
  }
}

/** Build a predicate for an Excel criteria value. */
export function makeCriteria(criteria) {
  let c = scalar(criteria);
  if (c instanceof Date) c = dateToSerial(c);
  if (c === null || c === undefined) c = 0; // empty criteria cell acts as 0
  if (typeof c === "number") {
    return (v) => cellNumber(v) === c && typeof v !== "boolean";
  }
  if (typeof c === "boolean") return (v) => v === c;
  if (c instanceof Error) {
    const code = c.message;
    return (v) => isErrorValue(v) && toError(v).message === code;
  }
  const str = String(c);
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(str);
  const op = m[1] || "=";
  const rhs = m[2];

  if (rhs === "") {
    if (!m[1]) return (v) => v === null || v === undefined || v === "";
    if (op === "=") return (v) => v === null || v === undefined;
    if (op === "<>") return (v) => !(v === null || v === undefined);
    return () => false;
  }
  if (isValidStrict(rhs.toUpperCase())) {
    const code = toError(rhs.toUpperCase()).message;
    const eq = (v) => isErrorValue(v) && toError(v).message === code;
    if (op === "=") return eq;
    if (op === "<>") return (v) => !eq(v);
    return () => false;
  }
  const num = parseNumberText(rhs);
  if (num !== undefined) {
    if (op === "=")
      return (v) => typeof v !== "boolean" && cellNumber(v) === num;
    if (op === "<>")
      return (v) => !(typeof v !== "boolean" && cellNumber(v) === num);
    return (v) =>
      (typeof v === "number" || v instanceof Date) &&
      compare(cellNumber(v), num, op);
  }
  const upper = rhs.toUpperCase();
  if (upper === "TRUE" || upper === "FALSE") {
    const b = upper === "TRUE";
    if (op === "=") return (v) => v === b;
    if (op === "<>") return (v) => v !== b;
    return (v) => typeof v === "boolean" && compare(+v, +b, op);
  }
  if (op === "=" || op === "<>") {
    const re = wildcardRegex(rhs);
    const eq = (v) => typeof v === "string" && !isErrorValue(v) && re.test(v);
    return op === "=" ? eq : (v) => !eq(v);
  }
  const lower = rhs.toLowerCase();
  return (v) =>
    typeof v === "string" &&
    !isErrorValue(v) &&
    compare(v.toLowerCase(), lower, op);
}

function sameShape(a, b) {
  return a.length === b.length && (a[0] || []).length === (b[0] || []).length;
}

/**
 * Cells of `target` whose positions satisfy all (range, criteria) pairs.
 * All ranges must have the target's shape (Excel's #VALUE! otherwise).
 */
function filterByCriteria(target, pairs) {
  const t = toGrid(target);
  if (pairs.length === 0 || pairs.length % 2) fail(ERROR_VALUE);
  const tests = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const range = toGrid(pairs[i]);
    if (!sameShape(range, t)) fail(ERROR_VALUE);
    tests.push([range, makeCriteria(pairs[i + 1])]);
  }
  const out = [];
  for (let r = 0; r < t.length; r++) {
    for (let c = 0; c < t[r].length; c++) {
      if (tests.every(([range, pred]) => pred(range[r][c]))) out.push(t[r][c]);
    }
  }
  return out;
}

/** SUMIF-style: criteria range plus an optional (top-left anchored) range. */
function filterSingle(range, criteria, valuesRange) {
  const r = toGrid(range);
  const v = valuesRange === undefined ? r : toGrid(valuesRange);
  const pred = makeCriteria(criteria);
  const out = [];
  for (let i = 0; i < r.length; i++) {
    for (let j = 0; j < r[i].length; j++) {
      if (pred(r[i][j])) out.push(v[i] ? v[i][j] : undefined);
    }
  }
  return out;
}

function numbersOf(values) {
  const out = [];
  values.forEach((v) => {
    if (isErrorValue(v)) throw toError(v);
    if (typeof v === "number") out.push(v);
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Matrices                                                                   */
/* -------------------------------------------------------------------------- */

function numericMatrix(v) {
  const g = toGrid(v);
  const cols = g[0].length;
  if (!cols) fail(ERROR_VALUE);
  return g.map((row) => {
    if (row.length !== cols) fail(ERROR_VALUE);
    return row.map((x) => {
      if (isErrorValue(x)) throw toError(x);
      if (typeof x !== "number") fail(ERROR_VALUE);
      return x;
    });
  });
}

function squareMatrix(v) {
  const m = numericMatrix(v);
  if (m.length !== m[0].length) fail(ERROR_VALUE);
  return m;
}

function determinant(matrix) {
  const a = matrix.map((r) => r.slice());
  const n = a.length;
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (a[p][c] === 0) return 0;
    if (p !== c) {
      [a[p], a[c]] = [a[c], a[p]];
      det = -det;
    }
    det *= a[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return det;
}

function inverse(matrix) {
  const n = matrix.length;
  const a = matrix.map((r, i) => [
    ...r,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  let scale = 0;
  matrix.forEach((r) =>
    r.forEach((x) => {
      scale = Math.max(scale, Math.abs(x));
    })
  );
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) <= scale * 1e-15) fail(ERROR_NUM);
    [a[p], a[c]] = [a[c], a[p]];
    const pv = a[c][c];
    for (let k = 0; k < 2 * n; k++) a[c][k] /= pv;
    for (let r = 0; r < n; r++) {
      if (r !== c && a[r][c] !== 0) {
        const f = a[r][c];
        for (let k = 0; k < 2 * n; k++) a[r][k] -= f * a[c][k];
      }
    }
  }
  return a.map((r) => r.slice(n).map((x) => (Math.abs(x) < 1e-15 ? 0 : x)));
}

/* -------------------------------------------------------------------------- */
/* SUBTOTAL / AGGREGATE                                                       */
/* -------------------------------------------------------------------------- */

const REF_FUNCTIONS = {
  1: (args, o) => average(collectNumbers(args, o)),
  2: (args) => countNumbers(args), // COUNT never counts errors
  3: (args, o) => countValues(args, o.ignoreErrors),
  4: (args, o) => max(collectNumbers(args, o)),
  5: (args, o) => min(collectNumbers(args, o)),
  6: (args, o) => product(collectNumbers(args, o)),
  7: (args, o) => Math.sqrt(variance(collectNumbers(args, o), true)),
  8: (args, o) => Math.sqrt(variance(collectNumbers(args, o), false)),
  9: (args, o) => sum(collectNumbers(args, o)),
  10: (args, o) => variance(collectNumbers(args, o), true),
  11: (args, o) => variance(collectNumbers(args, o), false),
  12: (args, o) => median(collectNumbers(args, o)),
  13: (args, o) => modes(collectNumbers(args, o))[0],
};

const ARRAY_FUNCTIONS = {
  14: (nums, k) => kth(nums, k, true),
  15: (nums, k) => kth(nums, k, false),
  16: percentileInc,
  17: quartileInc,
  18: percentileExc,
  19: quartileExc,
};

/* -------------------------------------------------------------------------- */
/* Functions                                                                  */
/* -------------------------------------------------------------------------- */

const stdev =
  (sample, a = false) =>
  (...args) =>
    Math.sqrt(variance(collectNumbers(args, { a }), sample));
const vari =
  (sample, a = false) =>
  (...args) =>
    variance(collectNumbers(args, { a }), sample);

function rankEq(number, ref, order) {
  const x = toNumber(number);
  const nums = collectNumbers([toGrid(ref)]);
  const asc = toNumber(order === undefined ? 0 : order) !== 0;
  if (!nums.includes(x)) fail(ERROR_NOT_AVAILABLE);
  let better = 0;
  let ties = 0;
  nums.forEach((v) => {
    if (v === x) ties++;
    else if (asc ? v < x : v > x) better++;
  });
  return { better, ties };
}

function forecast(x, knownY, knownX) {
  const xv = toNumber(x);
  const ys = flatten(knownY);
  const xs = flatten(knownX);
  if (ys.length !== xs.length) fail(ERROR_NOT_AVAILABLE);
  const px = [];
  const py = [];
  for (let i = 0; i < ys.length; i++) {
    if (isErrorValue(ys[i])) throw toError(ys[i]);
    if (isErrorValue(xs[i])) throw toError(xs[i]);
    if (typeof ys[i] === "number" && typeof xs[i] === "number") {
      px.push(xs[i]);
      py.push(ys[i]);
    }
  }
  if (!px.length) fail(ERROR_NOT_AVAILABLE);
  const mx = sum(px) / px.length;
  const my = sum(py) / py.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < px.length; i++) {
    sxy += (px[i] - mx) * (py[i] - my);
    sxx += (px[i] - mx) ** 2;
  }
  if (sxx === 0) fail(ERROR_DIV_ZERO);
  const b = sxy / sxx;
  return my - b * mx + b * xv;
}

function ceilingExcel(number, significance) {
  const x = toNumber(number);
  const sig = toNumber(significance === undefined ? 1 : significance);
  if (x > 0 && sig < 0) fail(ERROR_NUM);
  if (sig === 0) return 0;
  // Negative number with negative significance rounds away from zero.
  if (x < 0 && sig < 0) return neg(roundToMultiple(-x, -sig, Math.ceil));
  return roundToMultiple(x, Math.abs(sig), Math.ceil);
}

function floorExcel(number, significance) {
  const x = toNumber(number);
  const sig = toNumber(significance === undefined ? 1 : significance);
  if (x > 0 && sig < 0) fail(ERROR_NUM);
  if (sig === 0) return x === 0 ? 0 : fail(ERROR_DIV_ZERO);
  if (x < 0 && sig < 0) return neg(roundToMultiple(-x, -sig, Math.floor));
  return roundToMultiple(x, Math.abs(sig), Math.floor);
}

function ceilingPrecise(number, significance) {
  const x = toNumber(number);
  const sig = Math.abs(optNumber(significance, 1));
  return roundToMultiple(x, sig, Math.ceil);
}

function floorPrecise(number, significance) {
  const x = toNumber(number);
  const sig = Math.abs(optNumber(significance, 1));
  return roundToMultiple(x, sig, Math.floor);
}

function sumproduct(...args) {
  if (!args.length) fail(ERROR_VALUE);
  const grids = args.map(toGrid);
  const rows = grids[0].length;
  const cols = grids[0][0].length;
  grids.forEach((g) => {
    if (g.length !== rows || g.some((r) => r.length !== cols))
      fail(ERROR_VALUE);
  });
  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let p = 1;
      for (let g = 0; g < grids.length; g++) {
        const v = grids[g][r][c];
        if (isErrorValue(v)) throw toError(v);
        p *= typeof v === "number" ? v : 0;
      }
      total += p;
    }
  }
  return total;
}

const FUNCTIONS = {
  // Basic aggregates
  SUM: (...args) => sum(collectNumbers(args)),
  AVERAGE: (...args) => average(collectNumbers(args)),
  AVERAGEA: (...args) => average(collectNumbers(args, { a: true })),
  COUNT: (...args) => countNumbers(args),
  COUNTA: (...args) => countValues(args, false),
  COUNTBLANK: (...args) =>
    flatten(args).filter((v) => v === null || v === undefined || v === "")
      .length,
  MAX: (...args) => max(collectNumbers(args)),
  MAXA: (...args) => max(collectNumbers(args, { a: true })),
  MIN: (...args) => min(collectNumbers(args)),
  MINA: (...args) => min(collectNumbers(args, { a: true })),
  PRODUCT: (...args) => product(collectNumbers(args)),
  SUMSQ: (...args) => sum(collectNumbers(args).map((x) => x * x)),
  MEDIAN: (...args) => median(collectNumbers(args)),
  MODE: (...args) => modes(collectNumbers(args))[0],
  "MODE.SNGL": (...args) => modes(collectNumbers(args))[0],
  "MODE.MULT": (...args) => modes(collectNumbers(args)).map((m) => [m]),
  LARGE: (array, k) => kth(collectNumbers([toGrid(array)]), k, true),
  SMALL: (array, k) => kth(collectNumbers([toGrid(array)]), k, false),

  // Dispersion
  STDEV: stdev(true),
  "STDEV.S": stdev(true),
  STDEVP: stdev(false),
  "STDEV.P": stdev(false),
  STDEVA: stdev(true, true),
  STDEVPA: stdev(false, true),
  VAR: vari(true),
  "VAR.S": vari(true),
  VARP: vari(false),
  "VAR.P": vari(false),
  VARA: vari(true, true),
  VARPA: vari(false, true),

  // Ranking & percentiles
  RANK: (number, ref, order) => rankEq(number, ref, order).better + 1,
  "RANK.EQ": (number, ref, order) => rankEq(number, ref, order).better + 1,
  "RANK.AVG": (number, ref, order) => {
    const { better, ties } = rankEq(number, ref, order);
    return better + (ties + 1) / 2;
  },
  PERCENTILE: (array, k) => percentileInc(collectNumbers([toGrid(array)]), k),
  "PERCENTILE.INC": (array, k) =>
    percentileInc(collectNumbers([toGrid(array)]), k),
  "PERCENTILE.EXC": (array, k) =>
    percentileExc(collectNumbers([toGrid(array)]), k),
  QUARTILE: (array, q) => quartileInc(collectNumbers([toGrid(array)]), q),
  "QUARTILE.INC": (array, q) => quartileInc(collectNumbers([toGrid(array)]), q),
  "QUARTILE.EXC": (array, q) => quartileExc(collectNumbers([toGrid(array)]), q),

  // Conditional aggregates
  SUMIF: (range, criteria, sumRange) =>
    sum(numbersOf(filterSingle(range, criteria, sumRange))),
  SUMIFS: (sumRange, ...pairs) =>
    sum(numbersOf(filterByCriteria(sumRange, pairs))),
  COUNTIF: (range, criteria) => filterSingle(range, criteria).length,
  COUNTIFS: (...pairs) => {
    if (pairs.length === 0 || pairs.length % 2) fail(ERROR_VALUE);
    return filterByCriteria(pairs[0], pairs).length;
  },
  AVERAGEIF: (range, criteria, averageRange) =>
    average(numbersOf(filterSingle(range, criteria, averageRange))),
  AVERAGEIFS: (averageRange, ...pairs) =>
    average(numbersOf(filterByCriteria(averageRange, pairs))),
  MAXIFS: (maxRange, ...pairs) =>
    max(numbersOf(filterByCriteria(maxRange, pairs))),
  MINIFS: (minRange, ...pairs) =>
    min(numbersOf(filterByCriteria(minRange, pairs))),

  // Rounding
  ROUND: (number, digits) => roundWith(number, digits, "half"),
  ROUNDUP: (number, digits) => roundWith(number, digits, "up"),
  ROUNDDOWN: (number, digits) => roundWith(number, digits, "down"),
  MROUND: (number, multiple) => {
    const x = toNumber(number);
    const m = toNumber(multiple);
    if (m === 0) return 0;
    if (x * m < 0) fail(ERROR_NUM);
    const q = clean15(x / m);
    return clean15(Math.sign(q) * Math.floor(Math.abs(q) + 0.5) * m);
  },
  MOD: (number, divisor) => {
    const x = toNumber(number);
    const d = toNumber(divisor);
    if (d === 0) fail(ERROR_DIV_ZERO);
    const q = x / d;
    const fq = Math.floor(q);
    // A quotient that is an integer up to FP noise leaves no remainder.
    if (q !== fq && Math.abs(q - Math.round(q)) < 1e-12 * Math.abs(q)) return 0;
    return x - d * fq;
  },
  INT: (number) => Math.floor(toNumber(number)),
  CEILING: ceilingExcel,
  FLOOR: floorExcel,
  "CEILING.MATH": (number, significance, mode) => {
    const x = toNumber(number);
    const sig = Math.abs(optNumber(significance, 1));
    const away = optNumber(mode, 0) !== 0;
    if (x < 0 && away) return neg(roundToMultiple(-x, sig, Math.ceil));
    return roundToMultiple(x, sig, Math.ceil);
  },
  "FLOOR.MATH": (number, significance, mode) => {
    const x = toNumber(number);
    const sig = Math.abs(optNumber(significance, 1));
    const toward = optNumber(mode, 0) !== 0;
    if (x < 0 && toward) return neg(roundToMultiple(-x, sig, Math.floor));
    return roundToMultiple(x, sig, Math.floor);
  },
  "CEILING.PRECISE": ceilingPrecise,
  "ISO.CEILING": ceilingPrecise,
  "FLOOR.PRECISE": floorPrecise,

  SUMPRODUCT: sumproduct,

  // Regression & share
  FORECAST: forecast,
  "FORECAST.LINEAR": forecast,
  PERCENTOF: (subset, all) => {
    const part = sum(collectNumbers([toGrid(subset)]));
    const total = sum(collectNumbers([toGrid(all)]));
    if (total === 0) fail(ERROR_DIV_ZERO);
    return part / total;
  },

  // SUBTOTAL / AGGREGATE (hidden rows are unknown at this level)
  SUBTOTAL: (functionNum, ...refs) => {
    const fn = Math.trunc(toNumber(functionNum));
    const code = fn > 100 ? fn - 100 : fn;
    if (code < 1 || code > 11) fail(ERROR_VALUE);
    return REF_FUNCTIONS[code](refs, {});
  },
  AGGREGATE: (functionNum, options, ...refs) => {
    const fn = Math.trunc(toNumber(functionNum));
    const opt = Math.trunc(optNumber(options, 0));
    if (fn < 1 || fn > 19 || opt < 0 || opt > 7) fail(ERROR_VALUE);
    const o = { ignoreErrors: [2, 3, 6, 7].includes(opt) };
    if (fn <= 13) {
      if (!refs.length) fail(ERROR_VALUE);
      return REF_FUNCTIONS[fn](refs, o);
    }
    if (refs.length < 2) fail(ERROR_VALUE);
    return ARRAY_FUNCTIONS[fn](collectNumbers([toGrid(refs[0])], o), refs[1]);
  },

  // Matrices
  MMULT: (array1, array2) => {
    const a = numericMatrix(array1);
    const b = numericMatrix(array2);
    if (a[0].length !== b.length) fail(ERROR_VALUE);
    return a.map((row) =>
      b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0))
    );
  },
  MDETERM: (array) => determinant(squareMatrix(array)),
  MINVERSE: (array) => inverse(squareMatrix(array)),
  MUNIT: (dimension) => {
    const n = Math.trunc(toNumber(dimension));
    if (n < 1) fail(ERROR_VALUE);
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
    );
  },
};

export default withArity(FUNCTIONS, {
  LARGE: 2,
  SMALL: 2,
  RANK: 2,
  "RANK.EQ": 2,
  "RANK.AVG": 2,
  PERCENTILE: 2,
  "PERCENTILE.INC": 2,
  "PERCENTILE.EXC": 2,
  QUARTILE: 2,
  "QUARTILE.INC": 2,
  "QUARTILE.EXC": 2,
  SUMIF: 2,
  SUMIFS: 3,
  COUNTIF: 2,
  COUNTIFS: 2,
  AVERAGEIF: 2,
  AVERAGEIFS: 3,
  MAXIFS: 3,
  MINIFS: 3,
  ROUND: 2,
  ROUNDUP: 2,
  ROUNDDOWN: 2,
  MROUND: 2,
  MOD: 2,
  INT: 1,
  CEILING: 2,
  FLOOR: 2,
  "CEILING.MATH": 1,
  "FLOOR.MATH": 1,
  "CEILING.PRECISE": 1,
  "ISO.CEILING": 1,
  "FLOOR.PRECISE": 1,
  SUMPRODUCT: 1,
  FORECAST: 3,
  "FORECAST.LINEAR": 3,
  PERCENTOF: 2,
  SUBTOTAL: 2,
  AGGREGATE: 3,
  MMULT: 2,
  MDETERM: 1,
  MINVERSE: 1,
  MUNIT: 1,
});
