// See ./index.js for the calling convention.
//
// Text & regex functions with Excel semantics. Entries here override the
// formulajs implementations of the same name.
//
// Conventions used throughout this module:
// * Coercion helpers (toText, toNumber, ...) THROW an Error whose message is
//   an error code from ../error; the function wrapper turns that into the
//   formula result (or into an Error element when lifted over an array).
// * "Omitted" optional arguments are detected by `args.length` or by a
//   null/undefined value, so that skipped arguments such as
//   TEXTBEFORE(A1,"-",,1) fall back to their defaults.
// * Where Excel lifts a scalar function over arrays (LEN(A1:A3)), the
//   function is wrapped with `lift`, which broadcasts array arguments and
//   returns a 2D array of the same shape.
import errorText, {
  ERROR,
  ERROR_CALC,
  ERROR_NOT_AVAILABLE,
  ERROR_NUM,
  ERROR_VALUE,
} from "../error";

// Excel's cell text limit; longer results are #VALUE!.
const MAX_TEXT_LENGTH = 32767;

function fail(code) {
  return new Error(code);
}

function isOmitted(value) {
  return value === undefined || value === null;
}

// ---------------------------------------------------------------------------
// Array helpers
// ---------------------------------------------------------------------------

function to2D(value) {
  if (!Array.isArray(value)) {
    return [[value]];
  }
  if (value.length === 0) {
    return [[]];
  }
  if (!Array.isArray(value[0])) {
    return [value];
  }
  return value;
}

function flatten(value) {
  if (!Array.isArray(value)) {
    return [value];
  }
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) {
      v.forEach(walk);
    } else {
      out.push(v);
    }
  };
  walk(value);
  return out;
}

function topLeft(value) {
  let v = value;
  while (Array.isArray(v)) {
    v = v[0];
  }
  return v;
}

function asElementError(e) {
  if (e instanceof Error && errorText(e.message)) {
    return new Error(e.message);
  }
  return new Error(ERROR_VALUE);
}

/**
 * Wrap a scalar function so that it is lifted element-wise over the
 * arguments at `indices` (Excel's implicit array evaluation). Arrays of
 * different sizes broadcast: a single row/column is repeated, and positions
 * outside a smaller array become #N/A.
 */
function lift(fn, indices) {
  return function lifted(...args) {
    const arrays = [];
    let rows = 1;
    let cols = 1;

    indices.forEach((index) => {
      if (index < args.length && Array.isArray(args[index])) {
        const grid = to2D(args[index]);
        arrays.push([index, grid]);
        rows = Math.max(rows, grid.length);
        cols = Math.max(cols, grid[0].length);
      }
    });

    if (arrays.length === 0) {
      return fn(...args);
    }

    if (rows === 1 && cols === 1) {
      const scalarArgs = args.slice();
      arrays.forEach(([index, grid]) => {
        scalarArgs[index] = grid[0][0];
      });
      return fn(...scalarArgs);
    }

    const result = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const cellArgs = args.slice();
        let outOfRange = false;

        arrays.forEach(([index, grid]) => {
          const rr = grid.length === 1 ? 0 : r;
          const cc = grid[0].length === 1 ? 0 : c;
          if (rr >= grid.length || cc >= grid[rr].length) {
            outOfRange = true;
          } else {
            cellArgs[index] = grid[rr][cc];
          }
        });

        if (outOfRange) {
          row.push(fail(ERROR_NOT_AVAILABLE));
        } else {
          try {
            const value = fn(...cellArgs);
            row.push(Array.isArray(value) ? topLeft(value) : value);
          } catch (e) {
            row.push(asElementError(e));
          }
        }
      }
      result.push(row);
    }
    return result;
  };
}

// ---------------------------------------------------------------------------
// Number <-> text conversion
// ---------------------------------------------------------------------------

/**
 * Convert a number to text the way Excel does when a number is used as text
 * ("General" format without a column-width limit): at most 15 significant
 * digits, scientific notation for very large or very small magnitudes.
 */
function numberToText(n) {
  if (!Number.isFinite(n)) {
    throw fail(ERROR_NUM);
  }
  if (n === 0) {
    return "0";
  }
  const sign = n < 0 ? "-" : "";
  const [mantissa, expPart] = Math.abs(n).toExponential(14).split("e");
  const exp = parseInt(expPart, 10);
  const digits = mantissa.replace(".", "").replace(/0+$/, "") || "0";

  if (exp >= 15 || exp < -9) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    const e = String(Math.abs(exp)).padStart(2, "0");
    return `${sign}${m}E${exp < 0 ? "-" : "+"}${e}`;
  }
  if (exp < 0) {
    return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  }
  if (digits.length <= exp + 1) {
    return sign + digits + "0".repeat(exp + 1 - digits.length);
  }
  return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
}

/**
 * Parse a plain numeric string: sign, "$", thousands separators (groups of
 * three), decimals, exponent, trailing "%" (each divides by 100),
 * accounting-style parentheses and mixed fractions ("1 1/2").
 * Returns null when the text is not numeric.
 */
function parseNumericText(input) {
  let s = input.trim();
  if (s === "") {
    return null;
  }

  let negative = false;
  if (s.length > 2 && s[0] === "(" && s[s.length - 1] === ")") {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  let percent = 0;
  while (s.endsWith("%")) {
    percent += 1;
    s = s.slice(0, -1).trim();
  }

  const fraction = /^([+-]?)\s*(\d+) +(\d+)\/(\d+)$/.exec(s);
  if (fraction) {
    const den = Number(fraction[4]);
    if (den === 0) {
      return null;
    }
    let value = Number(fraction[2]) + Number(fraction[3]) / den;
    if (fraction[1] === "-") {
      value = -value;
    }
    if (negative) {
      if (fraction[1]) {
        return null;
      }
      value = -value;
    }
    return value / 100 ** percent;
  }

  const m =
    /^([+-]?)\s*(\$?)\s*([+-]?)\s*((?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d*)?)(?:[eE]([+-]?\d+))?$/.exec(
      s
    );
  if (!m || !/\d/.test(m[4])) {
    return null;
  }
  if (m[1] && m[3]) {
    return null;
  }
  const sign = m[1] || m[3];
  if (negative && sign) {
    return null;
  }

  let value = Number(m[4].replace(/,/g, ""));
  if (m[5] !== undefined) {
    value *= 10 ** Number(m[5]);
  }
  if (sign === "-" || negative) {
    value = -value;
  }
  value /= 100 ** percent;
  return Number.isFinite(value) ? value : null;
}

const MONTH_NAMES = [
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
];

function monthFromName(word) {
  const w = word.toLowerCase().replace(/\.$/, "");
  if (w.length < 3) {
    return 0;
  }
  const index = MONTH_NAMES.findIndex((name) => name.startsWith(w));
  return index + 1;
}

function expandYear(text) {
  const y = Number(text);
  if (text.length <= 2) {
    return y < 30 ? 2000 + y : 1900 + y;
  }
  return y;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Excel 1900 date system serial number, or null for an invalid date. */
function dateSerial(year, month, day) {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return null;
  }
  if (year === 1900 && month === 2 && day === 29) {
    return 60; // Excel's phantom leap day.
  }
  if (day > daysInMonth(year, month)) {
    return null;
  }
  let serial =
    (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 864e5;
  if (serial < 61) {
    serial -= 1;
  }
  return serial;
}

function parseDateText(s) {
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) {
    return dateSerial(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // en-US month/day/year
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{1,4})$/.exec(s);
  if (m) {
    if (m[3].length === 3) {
      return null;
    }
    return dateSerial(expandYear(m[3]), Number(m[1]), Number(m[2]));
  }

  // month/day (current year) or month/year
  m = /^(\d{1,2})[-/](\d{1,4})$/.exec(s);
  if (m) {
    const month = Number(m[1]);
    const second = Number(m[2]);
    if (m[2].length <= 2 && second >= 1 && second <= 31) {
      return dateSerial(new Date().getFullYear(), month, second);
    }
    if (m[2].length === 4) {
      return dateSerial(second, month, 1);
    }
    return null;
  }

  // day month-name [year]
  m = /^(\d{1,2})[-\s/]+([A-Za-z]+\.?)(?:[-\s/,]+(\d{2}|\d{4}))?$/.exec(s);
  if (m) {
    const month = monthFromName(m[2]);
    if (!month) {
      return null;
    }
    const year = m[3] ? expandYear(m[3]) : new Date().getFullYear();
    return dateSerial(year, month, Number(m[1]));
  }

  // month-name day[, year] / month-name year
  m =
    /^([A-Za-z]+\.?)[-\s/]+(\d{1,4})(?:(?:\s*,\s*|[-\s/]+)(\d{2}|\d{4}))?$/.exec(
      s
    );
  if (m) {
    const month = monthFromName(m[1]);
    if (!month) {
      return null;
    }
    if (m[3]) {
      if (m[2].length > 2) {
        return null;
      }
      return dateSerial(expandYear(m[3]), month, Number(m[2]));
    }
    const n = Number(m[2]);
    if (m[2].length <= 2 && n >= 1 && n <= 31) {
      return dateSerial(new Date().getFullYear(), month, n);
    }
    return dateSerial(expandYear(m[2]), month, 1);
  }

  return null;
}

function parseTimeText(s) {
  const m =
    /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}(?:\.\d+)?))?\s*(am|pm|a|p)?$/i.exec(
      s
    );
  if (!m || (m[2] === undefined && m[4] === undefined)) {
    return null;
  }
  let hours = Number(m[1]);
  const minutes = m[2] === undefined ? 0 : Number(m[2]);
  const seconds = m[3] === undefined ? 0 : Number(m[3]);
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }
  if (m[4]) {
    if (hours > 12) {
      return null;
    }
    const pm = m[4].toLowerCase().startsWith("p");
    hours %= 12;
    if (pm) {
      hours += 12;
    }
  }
  return (hours * 3600 + minutes * 60 + seconds) / 86400;
}

/**
 * Parse text the way VALUE() does: numbers (see parseNumericText), dates,
 * times and date-times. Returns null when the text is not a value.
 */
function parseValueText(input) {
  const numeric = parseNumericText(input);
  if (numeric !== null) {
    return numeric;
  }

  const s = input.trim().replace(/\s+/g, " ");
  if (s === "") {
    return null;
  }

  const date = parseDateText(s);
  if (date !== null) {
    return date;
  }

  const time = parseTimeText(s);
  if (time !== null) {
    return time;
  }

  const split =
    /^(.*?)\s+(\d{1,2}(?::\d{1,2}(?::\d{1,2}(?:\.\d+)?)?)?\s*(?:am|pm|a|p)?)$/i.exec(
      s
    );
  if (split) {
    const datePart = parseDateText(split[1]);
    const timePart = parseTimeText(split[2]);
    if (datePart !== null && timePart !== null) {
      return datePart + timePart;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Scalar coercion
// ---------------------------------------------------------------------------

function toText(value) {
  const v = Array.isArray(value) ? topLeft(value) : value;
  if (v instanceof Error) {
    throw v;
  }
  if (v === null || v === undefined) {
    return "";
  }
  if (typeof v === "boolean") {
    return v ? "TRUE" : "FALSE";
  }
  if (typeof v === "number") {
    return numberToText(v);
  }
  return String(v);
}

function toNumber(value) {
  const v = Array.isArray(value) ? topLeft(value) : value;
  if (v instanceof Error) {
    throw v;
  }
  if (v === null || v === undefined) {
    return 0;
  }
  if (typeof v === "boolean") {
    return v ? 1 : 0;
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw fail(ERROR_NUM);
    }
    return v;
  }
  const parsed = parseValueText(String(v));
  if (parsed === null) {
    throw fail(ERROR_VALUE);
  }
  return parsed;
}

function toInt(value) {
  return Math.trunc(toNumber(value));
}

function toBool(value) {
  const v = Array.isArray(value) ? topLeft(value) : value;
  if (v instanceof Error) {
    throw v;
  }
  if (v === null || v === undefined) {
    return false;
  }
  if (typeof v === "boolean") {
    return v;
  }
  if (typeof v === "number") {
    return v !== 0;
  }
  const s = String(v).trim().toUpperCase();
  if (s === "TRUE") {
    return true;
  }
  if (s === "FALSE") {
    return false;
  }
  const n = parseValueText(s);
  if (n === null) {
    throw fail(ERROR_VALUE);
  }
  return n !== 0;
}

/** Integer option that must be one of `allowed`; blank means `fallback`. */
function toOption(value, fallback, allowed) {
  if (isOmitted(value)) {
    return fallback;
  }
  const n = toInt(value);
  if (!allowed.includes(n)) {
    throw fail(ERROR_VALUE);
  }
  return n;
}

function checkLength(text) {
  if (text.length > MAX_TEXT_LENGTH) {
    throw fail(ERROR_VALUE);
  }
  return text;
}

function errorToText(e) {
  return errorText(e.message) || errorText(ERROR_VALUE);
}

// ---------------------------------------------------------------------------
// Delimiter search (TEXTBEFORE / TEXTAFTER / TEXTSPLIT)
// ---------------------------------------------------------------------------

function prepareSearch(text, needles, caseInsensitive) {
  if (!caseInsensitive) {
    return [text, needles];
  }
  const hay = text.toLowerCase();
  const lowered = needles.map((n) => n.toLowerCase());
  // Keep indices aligned with the original text if lowercasing changes
  // lengths (rare, e.g. "İ"); fall back to per-character lowercasing.
  if (hay.length !== text.length) {
    const perChar = Array.from(text, (ch) => {
      const lower = ch.toLowerCase();
      return lower.length === ch.length ? lower : ch;
    }).join("");
    return [perChar, lowered];
  }
  return [hay, lowered];
}

/**
 * Non-overlapping delimiter matches scanning left to right. At a given
 * position the longest delimiter wins. Stops after `limit` matches.
 */
function scanForward(hay, needles, limit = Infinity) {
  const matches = [];
  let from = 0;
  while (from <= hay.length && matches.length < limit) {
    let best = null;
    needles.forEach((needle) => {
      const at = hay.indexOf(needle, from);
      if (
        at !== -1 &&
        (best === null ||
          at < best.start ||
          (at === best.start && needle.length > best.end - best.start))
      ) {
        best = { start: at, end: at + needle.length };
      }
    });
    if (!best) {
      break;
    }
    matches.push(best);
    from = best.end > best.start ? best.end : best.start + 1;
  }
  return matches;
}

/** Non-overlapping delimiter matches scanning right to left. */
function scanBackward(hay, needles, limit) {
  const matches = [];
  let to = hay.length;
  while (to >= 0 && matches.length < limit) {
    let best = null;
    needles.forEach((needle) => {
      if (needle.length > to) {
        return;
      }
      const at = hay.lastIndexOf(needle, to - needle.length);
      if (at === -1) {
        return;
      }
      const end = at + needle.length;
      if (
        best === null ||
        end > best.end ||
        (end === best.end && needle.length > best.end - best.start)
      ) {
        best = { start: at, end };
      }
    });
    if (!best) {
      break;
    }
    matches.push(best);
    to = best.end > best.start ? best.start : best.start - 1;
  }
  return matches;
}

function splitText(text, delimiters, caseInsensitive) {
  const [hay, needles] = prepareSearch(text, delimiters, caseInsensitive);
  const parts = [];
  let last = 0;
  scanForward(hay, needles).forEach(({ start, end }) => {
    if (end === start) {
      return;
    }
    parts.push(text.slice(last, start));
    last = end;
  });
  parts.push(text.slice(last));
  return parts;
}

function textBeforeAfter(before, args) {
  if (args.length < 2) {
    throw fail(ERROR_VALUE);
  }
  const text = toText(args[0]);
  const delimiters = flatten(args[1]).map(toText);
  const instance = isOmitted(args[2]) ? 1 : toInt(args[2]);
  const matchMode = toOption(args[3], 0, [0, 1]);
  const matchEnd = isOmitted(args[4]) ? false : toBool(args[4]);

  if (instance === 0 || (text.length > 0 && Math.abs(instance) > text.length)) {
    throw fail(ERROR_VALUE);
  }

  const [hay, needles] = prepareSearch(text, delimiters, matchMode === 1);
  const count = Math.abs(instance);
  const matches =
    instance > 0
      ? scanForward(hay, needles, count)
      : scanBackward(hay, needles, count);

  let beforeText;
  let afterText;
  if (matches.length >= count) {
    const match = matches[count - 1];
    beforeText = text.slice(0, match.start);
    afterText = text.slice(match.end);
  } else if (matchEnd && matches.length === count - 1) {
    // The end (or, searching backwards, the start) of the text acts as the
    // final delimiter.
    beforeText = instance > 0 ? text : "";
    afterText = instance > 0 ? "" : text;
  } else {
    if (args.length > 5 && args[5] !== undefined) {
      return args[5];
    }
    throw fail(ERROR_NOT_AVAILABLE);
  }
  return before ? beforeText : afterText;
}

// ---------------------------------------------------------------------------
// Regular expressions (Excel uses PCRE2; translate the common differences)
// ---------------------------------------------------------------------------

function translatePcre(source) {
  let out = "";
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      const next = source[i + 1];
      i++;
      if (!inClass && next === "A") {
        out += "(?<![\\s\\S])";
      } else if (!inClass && next === "z") {
        out += "(?![\\s\\S])";
      } else if (!inClass && next === "Z") {
        out += "(?=\\n?(?![\\s\\S]))";
      } else {
        out += ch + next;
      }
    } else if (inClass) {
      if (ch === "]") {
        inClass = false;
      }
      out += ch;
    } else if (ch === "[") {
      inClass = true;
      out += ch;
      // A "]" right after "[" or "[^" is a literal in PCRE.
      if (source[i + 1] === "^") {
        out += "^";
        i++;
      }
      if (source[i + 1] === "]") {
        out += "\\]";
        i++;
      }
    } else if (source.startsWith("(?P<", i)) {
      out += "(?<";
      i += 3;
    } else if (source.startsWith("(?P=", i)) {
      const close = source.indexOf(")", i);
      if (close === -1) {
        throw fail(ERROR_VALUE);
      }
      out += `\\k<${source.slice(i + 4, close)}>`;
      i = close;
    } else {
      out += ch;
    }
  }
  return out;
}

function compileRegex(patternValue, caseInsensitive, global) {
  let source = toText(patternValue);
  let flags = global ? "g" : "";
  if (caseInsensitive) {
    flags += "i";
  }

  const inline = /^\(\?([a-zA-Z]+)\)/.exec(source);
  if (inline) {
    for (const f of inline[1]) {
      if (f === "i" || f === "m" || f === "s") {
        if (!flags.includes(f)) {
          flags += f;
        }
      } else {
        throw fail(ERROR_VALUE);
      }
    }
    source = source.slice(inline[0].length);
  }

  source = translatePcre(source);
  try {
    return new RegExp(source, `${flags}u`);
  } catch (e) {
    try {
      return new RegExp(source, flags);
    } catch (e2) {
      throw fail(ERROR_VALUE);
    }
  }
}

function allMatches(re, text) {
  const matches = [];
  re.lastIndex = 0;
  let m = re.exec(text);
  while (m) {
    matches.push(m);
    if (m[0] === "") {
      re.lastIndex += 1;
      if (re.lastIndex > text.length) {
        break;
      }
    }
    m = re.exec(text);
  }
  return matches;
}

/** Expand a PCRE2-style replacement string: $n, ${n}, ${name}, $$. */
function expandReplacement(replacement, match) {
  let out = "";
  for (let i = 0; i < replacement.length; i++) {
    const ch = replacement[i];
    if (ch !== "$" || i + 1 >= replacement.length) {
      out += ch;
      continue;
    }
    const next = replacement[i + 1];
    if (next === "$") {
      out += "$";
      i++;
    } else if (/\d/.test(next)) {
      let digits = next;
      if (
        /\d/.test(replacement[i + 2] || "") &&
        Number(next + replacement[i + 2]) < match.length
      ) {
        digits += replacement[i + 2];
      }
      out += match[Number(digits)] ?? "";
      i += digits.length;
    } else if (next === "{") {
      const close = replacement.indexOf("}", i + 2);
      if (close === -1) {
        throw fail(ERROR_VALUE);
      }
      const ref = replacement.slice(i + 2, close);
      if (/^\d+$/.test(ref)) {
        out += match[Number(ref)] ?? "";
      } else {
        out += match.groups?.[ref] ?? "";
      }
      i = close;
    } else {
      out += ch;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wildcards (SEARCH)
// ---------------------------------------------------------------------------

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function wildcardToRegex(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (
      ch === "~" &&
      i + 1 < pattern.length &&
      "*?~".includes(pattern[i + 1])
    ) {
      source += escapeRegex(pattern[i + 1]);
      i++;
    } else if (ch === "*") {
      source += "[\\s\\S]*";
    } else if (ch === "?") {
      source += "[\\s\\S]";
    } else {
      source += escapeRegex(ch);
    }
  }
  return new RegExp(source, "giu");
}

function findStart(args, withinLength) {
  const start = args.length > 2 && args[2] !== undefined ? toInt(args[2]) : 1;
  if (start < 1 || start > withinLength + 1) {
    throw fail(ERROR_VALUE);
  }
  return start;
}

// ---------------------------------------------------------------------------
// Array <-> text (ARRAYTOTEXT / VALUETOTEXT)
// ---------------------------------------------------------------------------

function valueToText(value, strict) {
  if (value instanceof Error) {
    return errorToText(value);
  }
  if (typeof value === "string") {
    return strict ? `"${value.replace(/"/g, '""')}"` : value;
  }
  return toText(value);
}

// ---------------------------------------------------------------------------
// Function table
// ---------------------------------------------------------------------------

export default {
  // --- Modern text functions -------------------------------------------

  TEXTBEFORE: lift((...args) => textBeforeAfter(true, args), [0, 2, 3, 4]),

  TEXTAFTER: lift((...args) => textBeforeAfter(false, args), [0, 2, 3, 4]),

  TEXTSPLIT: lift(
    (...args) => {
      if (args.length < 2) {
        throw fail(ERROR_VALUE);
      }
      const text = toText(args[0]);
      const delimiterList = (value) =>
        isOmitted(value)
          ? []
          : flatten(value)
              .map(toText)
              .filter((d) => d !== "");
      const colDelimiters = delimiterList(args[1]);
      const rowDelimiters = delimiterList(args[2]);
      const ignoreEmpty = isOmitted(args[3]) ? false : toBool(args[3]);
      const caseInsensitive = toOption(args[4], 0, [0, 1]) === 1;
      const padWith =
        args.length > 5 && args[5] !== undefined
          ? args[5]
          : fail(ERROR_NOT_AVAILABLE);

      if (colDelimiters.length === 0 && rowDelimiters.length === 0) {
        throw fail(ERROR_VALUE);
      }

      const dropEmpty = (parts) =>
        ignoreEmpty ? parts.filter((p) => p !== "") : parts;

      let rows = rowDelimiters.length
        ? dropEmpty(splitText(text, rowDelimiters, caseInsensitive))
        : [text];
      rows = rows.map((row) =>
        colDelimiters.length
          ? dropEmpty(splitText(row, colDelimiters, caseInsensitive))
          : [row]
      );
      if (ignoreEmpty) {
        rows = rows.filter((row) => row.length > 0);
      }
      if (rows.length === 0) {
        throw fail(ERROR_CALC);
      }

      const width = Math.max(...rows.map((row) => row.length));
      return rows.map((row) =>
        row.length < width
          ? row.concat(Array(width - row.length).fill(padWith))
          : row
      );
    },
    [0]
  ),

  REGEXTEST: lift(
    (...args) => {
      if (args.length < 2) {
        throw fail(ERROR_VALUE);
      }
      const text = toText(args[0]);
      const caseInsensitive = toOption(args[2], 0, [0, 1]) === 1;
      return compileRegex(args[1], caseInsensitive, false).test(text);
    },
    [0, 1, 2]
  ),

  REGEXEXTRACT: lift(
    (...args) => {
      if (args.length < 2) {
        throw fail(ERROR_VALUE);
      }
      const text = toText(args[0]);
      const returnMode = toOption(args[2], 0, [0, 1, 2]);
      const caseInsensitive = toOption(args[3], 0, [0, 1]) === 1;

      if (returnMode === 1) {
        const re = compileRegex(args[1], caseInsensitive, true);
        const matches = allMatches(re, text);
        if (matches.length === 0) {
          throw fail(ERROR_NOT_AVAILABLE);
        }
        return matches.map((m) => [m[0]]);
      }

      const match = compileRegex(args[1], caseInsensitive, false).exec(text);
      if (!match) {
        throw fail(ERROR_NOT_AVAILABLE);
      }
      if (returnMode === 0) {
        return match[0];
      }
      const groups = match.slice(1).map((g) => (g === undefined ? "" : g));
      return [groups.length ? groups : [match[0]]];
    },
    [0, 1, 2, 3]
  ),

  REGEXREPLACE: lift(
    (...args) => {
      if (args.length < 3) {
        throw fail(ERROR_VALUE);
      }
      const text = toText(args[0]);
      const replacement = toText(args[2]);
      const occurrence = isOmitted(args[3]) ? 0 : toInt(args[3]);
      const caseInsensitive = toOption(args[4], 0, [0, 1]) === 1;
      const re = compileRegex(args[1], caseInsensitive, true);
      const matches = allMatches(re, text);

      let target = -1;
      if (occurrence > 0) {
        target = occurrence - 1;
      } else if (occurrence < 0) {
        target = matches.length + occurrence;
      }
      if (occurrence !== 0 && (target < 0 || target >= matches.length)) {
        return text;
      }

      let out = "";
      let last = 0;
      matches.forEach((m, i) => {
        if (occurrence === 0 || i === target) {
          out += text.slice(last, m.index) + expandReplacement(replacement, m);
          last = m.index + m[0].length;
        }
      });
      return checkLength(out + text.slice(last));
    },
    [0, 1, 2, 3, 4]
  ),

  ARRAYTOTEXT: (...args) => {
    if (args.length < 1) {
      throw fail(ERROR_VALUE);
    }
    const format = toOption(args[1], 0, [0, 1]);
    const grid = to2D(args[0]);
    if (format === 0) {
      return checkLength(
        flatten(grid)
          .map((v) => valueToText(v, false))
          .join(", ")
      );
    }
    const body = grid
      .map((row) => row.map((v) => valueToText(v, true)).join(","))
      .join(";");
    return checkLength(`{${body}}`);
  },

  VALUETOTEXT: lift(
    (...args) => {
      if (args.length < 1) {
        throw fail(ERROR_VALUE);
      }
      const format = toOption(args[1], 0, [0, 1]);
      return checkLength(valueToText(args[0], format === 1));
    },
    [0, 1]
  ),

  NUMBERVALUE: lift(
    (...args) => {
      if (args.length < 1) {
        throw fail(ERROR_VALUE);
      }
      const value = args[0];
      if (value instanceof Error) {
        throw value;
      }
      if (isOmitted(value)) {
        return 0;
      }
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "boolean") {
        throw fail(ERROR_VALUE);
      }

      const separator = (arg, fallback) => {
        if (isOmitted(arg)) {
          return fallback;
        }
        const s = toText(arg);
        if (s === "") {
          throw fail(ERROR_VALUE);
        }
        return s[0];
      };
      const decimal = separator(args[1], ".");
      let group = separator(args[2], ",");
      if (isOmitted(args[2]) && group === decimal) {
        group = decimal === "." ? "," : ".";
      }
      if (decimal === group) {
        throw fail(ERROR_VALUE);
      }

      let s = String(value).replace(/\s+/g, "");
      if (s === "") {
        return 0;
      }
      let percent = "";
      while (s.endsWith("%")) {
        percent += "%";
        s = s.slice(0, -1);
      }

      const parts = s.split(decimal);
      if (
        parts.length > 2 ||
        (parts.length === 2 && parts[1].includes(group))
      ) {
        throw fail(ERROR_VALUE);
      }
      const integer = parts[0].split(group).join("");
      if (/[.,]/.test(integer) || (parts[1] && /[.,]/.test(parts[1]))) {
        throw fail(ERROR_VALUE);
      }
      const normalized =
        integer + (parts.length === 2 ? `.${parts[1]}` : "") + percent;
      const n = parseNumericText(normalized);
      if (n === null) {
        throw fail(ERROR_VALUE);
      }
      return n;
    },
    [0, 1, 2]
  ),

  UNICHAR: lift(
    (...args) => {
      const code = toInt(args[0]);
      if (code < 1 || code > 0x10ffff) {
        throw fail(ERROR_VALUE);
      }
      if (code >= 0xd800 && code <= 0xdfff) {
        throw fail(ERROR_NOT_AVAILABLE);
      }
      return String.fromCodePoint(code);
    },
    [0]
  ),

  UNICODE: lift(
    (...args) => {
      const text = toText(args[0]);
      if (text === "") {
        throw fail(ERROR_VALUE);
      }
      return text.codePointAt(0);
    },
    [0]
  ),

  CONCAT: (...args) => {
    let out = "";
    args.forEach((arg) => {
      flatten(arg).forEach((v) => {
        out += toText(v);
        checkLength(out);
      });
    });
    return out;
  },

  TEXTJOIN: (...args) => {
    if (args.length < 3) {
      throw fail(ERROR_VALUE);
    }
    const delimiters = flatten(args[0]).map(toText);
    const ignoreEmpty = toBool(args[1]);
    const values = [];
    args.slice(2).forEach((arg) => {
      flatten(arg).forEach((v) => {
        const text = toText(v);
        if (!ignoreEmpty || text !== "") {
          values.push(text);
        }
      });
    });

    let out = "";
    values.forEach((text, i) => {
      if (i > 0) {
        out += delimiters[(i - 1) % delimiters.length];
      }
      out += text;
      checkLength(out);
    });
    return out;
  },

  // --- Classic text functions (Excel-exact overrides of formulajs) ------

  FIND: lift(
    (...args) => {
      if (args.length < 2) {
        throw fail(ERROR_NOT_AVAILABLE);
      }
      const findText = toText(args[0]);
      const within = toText(args[1]);
      const start = findStart(args, within.length);
      const at = within.indexOf(findText, start - 1);
      if (at === -1) {
        throw fail(ERROR_VALUE);
      }
      return at + 1;
    },
    [0, 1, 2]
  ),

  SEARCH: lift(
    (...args) => {
      if (args.length < 2) {
        throw fail(ERROR_VALUE);
      }
      const findText = toText(args[0]);
      const within = toText(args[1]);
      const start = findStart(args, within.length);
      const re = wildcardToRegex(findText);
      re.lastIndex = start - 1;
      const match = re.exec(within);
      if (!match) {
        throw fail(ERROR_VALUE);
      }
      return match.index + 1;
    },
    [0, 1, 2]
  ),

  SUBSTITUTE: lift(
    (...args) => {
      if (args.length < 3) {
        throw fail(ERROR_NOT_AVAILABLE);
      }
      const text = toText(args[0]);
      const oldText = toText(args[1]);
      const newText = toText(args[2]);
      const hasInstance = args.length > 3 && args[3] !== undefined;
      const instance = hasInstance ? toInt(args[3]) : 0;
      if (hasInstance && instance < 1) {
        throw fail(ERROR_VALUE);
      }
      if (oldText === "") {
        return text;
      }
      if (!hasInstance) {
        return checkLength(text.split(oldText).join(newText));
      }
      let at = -1;
      let from = 0;
      for (let n = 0; n < instance; n++) {
        at = text.indexOf(oldText, from);
        if (at === -1) {
          return text;
        }
        from = at + oldText.length;
      }
      return checkLength(
        text.slice(0, at) + newText + text.slice(at + oldText.length)
      );
    },
    [0, 1, 2, 3]
  ),

  PROPER: lift(
    (...args) => {
      const text = toText(args[0]);
      let out = "";
      let previousIsLetter = false;
      for (const ch of text) {
        const isLetter = /[\p{L}\p{M}]/u.test(ch);
        if (isLetter) {
          out += previousIsLetter ? ch.toLowerCase() : ch.toUpperCase();
        } else {
          out += ch;
        }
        previousIsLetter = isLetter;
      }
      return out;
    },
    [0]
  ),

  CLEAN: lift(
    (...args) => {
      const text = toText(args[0]);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) >= 32) {
          out += text[i];
        }
      }
      return out;
    },
    [0]
  ),

  TRIM: lift(
    (...args) =>
      toText(args[0])
        .replace(/^ +| +$/g, "")
        .replace(/ {2,}/g, " "),
    [0]
  ),

  LEFT: lift(
    (...args) => {
      const text = toText(args[0]);
      const count = args.length > 1 ? toInt(args[1]) : 1;
      if (count < 0) {
        throw fail(ERROR_VALUE);
      }
      return text.slice(0, count);
    },
    [0, 1]
  ),

  RIGHT: lift(
    (...args) => {
      const text = toText(args[0]);
      const count = args.length > 1 ? toInt(args[1]) : 1;
      if (count < 0) {
        throw fail(ERROR_VALUE);
      }
      return count === 0 ? "" : text.slice(-count);
    },
    [0, 1]
  ),

  MID: lift(
    (...args) => {
      if (args.length < 3) {
        throw fail(ERROR_VALUE);
      }
      const text = toText(args[0]);
      const start = toInt(args[1]);
      const count = toInt(args[2]);
      if (start < 1 || count < 0) {
        throw fail(ERROR_VALUE);
      }
      return text.substr(start - 1, count);
    },
    [0, 1, 2]
  ),

  REPT: lift(
    (...args) => {
      const text = toText(args[0]);
      const times = args.length > 1 ? toInt(args[1]) : 0;
      if (times < 0 || text.length * times > MAX_TEXT_LENGTH) {
        throw fail(ERROR_VALUE);
      }
      return text.repeat(times);
    },
    [0, 1]
  ),

  EXACT: lift(
    (...args) => {
      if (args.length < 2) {
        throw fail(ERROR_NOT_AVAILABLE);
      }
      return toText(args[0]) === toText(args[1]);
    },
    [0, 1]
  ),

  LEN: lift(
    (...args) => {
      if (args.length < 1) {
        throw fail(ERROR);
      }
      return toText(args[0]).length;
    },
    [0]
  ),

  VALUE: lift(
    (...args) => {
      if (args.length < 1) {
        throw fail(ERROR_VALUE);
      }
      const value = args[0];
      if (value instanceof Error) {
        throw value;
      }
      if (isOmitted(value)) {
        return 0;
      }
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "boolean") {
        throw fail(ERROR_VALUE);
      }
      const parsed = parseValueText(String(value));
      if (parsed === null) {
        throw fail(ERROR_VALUE);
      }
      return parsed;
    },
    [0]
  ),
};
