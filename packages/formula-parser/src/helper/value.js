/**
 * Excel value semantics shared by the evaluator, the operators and the
 * higher-order functions: error values, coercion (number / text / logical)
 * and comparison.
 *
 * Error values are `Error` instances whose message is the short error id
 * from ../error.js ("N/A", "DIV/0", "VALUE", ...), the convention of the
 * function registry (see ../functions/index.js). One instance is shared per
 * error. `toFormulajsError` maps them to the formulajs singletons for the
 * formulajs functions that recognise errors by identity (ISERROR, ISNA, ...).
 */
import formulajs from "../formulajs";
import errorParser from "../error";

const ERROR_CODES = [
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#ERROR!",
  "#SPILL!",
  "#CALC!",
];

// "#DIV/0!" -> Error("DIV/0")
const ERROR_VALUES = new Map(
  ERROR_CODES.map((code) => [code, new Error(code.replace(/^#|[!?]$/g, ""))])
);

// "#DIV/0!" -> formulajs' own error singleton
const FORMULAJS_ERRORS = new Map();

(function registerFormulajsErrors() {
  const fjErrors =
    (formulajs && formulajs.utils && formulajs.utils.errors) || {};

  Object.keys(fjErrors).forEach((key) => {
    const value = fjErrors[key];
    const code = value instanceof Error ? errorParser(value.message) : null;

    if (code && !FORMULAJS_ERRORS.has(code)) {
      FORMULAJS_ERRORS.set(code, value);
    }
  });
})();

/**
 * Canonical error code ("#DIV/0!", "#N/A", ...) of an error-ish thing
 * (Error instance, short id such as "DIV/0", or code string).
 * Unknown errors map to "#ERROR!".
 *
 * @param {*} err
 * @returns {String}
 */
export function errorCode(err) {
  const message = err instanceof Error ? err.message : err;

  return errorParser(message) || "#ERROR!";
}

/**
 * Error value (Error instance) for an error code, short id or exception.
 * JS runtime failures (stack overflow) map to #NUM!, anything unknown to #ERROR!.
 *
 * @param {*} err
 * @returns {Error}
 */
export function toErrorValue(err) {
  if (err instanceof RangeError) {
    return ERROR_VALUES.get("#NUM!");
  }
  const code = errorCode(err);

  return ERROR_VALUES.get(code) || ERROR_VALUES.get("#ERROR!");
}

/**
 * The formulajs singleton for an error value (formulajs compares errors by
 * identity); other values are returned unchanged.
 *
 * @param {*} value
 * @returns {*}
 */
export function toFormulajsError(value) {
  if (!(value instanceof Error)) {
    return value;
  }

  return FORMULAJS_ERRORS.get(errorCode(value)) || value;
}

/**
 * @param {*} value
 * @returns {Boolean}
 */
export function isErrorValue(value) {
  return value instanceof Error;
}

const ERROR_STRINGS = new Set(ERROR_CODES);

/**
 * Whether a string cell value is an Excel error literal (e.g. "#N/A").
 *
 * @param {*} value
 * @returns {Boolean}
 */
export function isErrorString(value) {
  return (
    typeof value === "string" &&
    value.charCodeAt(0) === 35 &&
    ERROR_STRINGS.has(value)
  );
}

/**
 * Throw an error value for the given code.
 *
 * @param {String} code Short id ("VALUE") or code ("#VALUE!").
 */
export function fail(code) {
  throw toErrorValue(code);
}

/**
 * Whether the value is blank (empty cell).
 *
 * @param {*} value
 * @returns {Boolean}
 */
export function isBlank(value) {
  return value === null || value === void 0;
}

const MS_PER_DAY = 86400000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Excel serial number of a JS Date (local calendar components).
 *
 * @param {Date} date
 * @returns {Number}
 */
export function dateToSerial(date) {
  const utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

  return (utc - EXCEL_EPOCH) / MS_PER_DAY;
}

function serialFromParts(year, month, day) {
  if (month < 1 || month > 12 || day < 1) {
    return null;
  }
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);

  if (check.getUTCDate() !== day) {
    return null;
  }

  return (utc - EXCEL_EPOCH) / MS_PER_DAY;
}

const NUMBER_RE =
  /^([+-])?(\$)?(\d{1,3}(?:,\d{3})+(?:\.\d*)?|\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?(%)?$/;
const TIME_RE =
  /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([AaPp][Mm])?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const US_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

function parseTime(text) {
  const match = TIME_RE.exec(text);

  if (!match) {
    return null;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  const meridiem = match[4] ? match[4].toUpperCase() : null;

  if (minutes > 59 || seconds >= 60) {
    return null;
  }
  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    hours = (hours % 12) + (meridiem === "PM" ? 12 : 0);
  }

  return (hours * 3600 + minutes * 60 + seconds) / 86400;
}

function parseDate(text) {
  let match = ISO_DATE_RE.exec(text);

  if (match) {
    return serialFromParts(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }
  match = US_DATE_RE.exec(text);
  if (match) {
    let year = Number(match[3]);

    if (match[3].length === 2) {
      year += year < 30 ? 2000 : 1900;
    }

    return serialFromParts(year, Number(match[1]), Number(match[2]));
  }

  return null;
}

/**
 * Parse text the way Excel coerces it to a number in arithmetic:
 * "12", " 1,234.5 ", "1e3", "50%", "$10", "(5)", "2024-01-31", "1/31/2024",
 * "12:30", "1:30 PM", "2024-01-31 06:00".
 *
 * @param {String} text
 * @returns {Number|null} Returns null when the text is not numeric.
 */
export function parseNumericText(text) {
  let str = text.trim();

  if (str === "") {
    return null;
  }
  let negate = false;

  if (str.length > 2 && str[0] === "(" && str[str.length - 1] === ")") {
    negate = true;
    str = str.slice(1, -1).trim();
  }
  const match = NUMBER_RE.exec(str);

  if (match) {
    let number = Number(match[3].replace(/,/g, ""));

    if (match[4]) {
      number *= Math.pow(10, Number(match[4]));
    }
    if (match[5]) {
      number /= 100;
    }
    if (match[1] === "-") {
      number = -number;
    }
    if (negate) {
      if (match[1]) {
        return null;
      }
      number = -number;
    }

    return isFinite(number) ? number : null;
  }
  if (negate) {
    return null;
  }

  const time = parseTime(str);

  if (time !== null) {
    return time;
  }
  const date = parseDate(str);

  if (date !== null) {
    return date;
  }
  const space = str.indexOf(" ");

  if (space > 0) {
    const datePart = parseDate(str.slice(0, space));
    const timePart = parseTime(str.slice(space + 1).trim());

    if (datePart !== null && timePart !== null) {
      return datePart + timePart;
    }
  }

  return null;
}

/**
 * Coerce a scalar to a number like Excel's arithmetic operators do.
 * Blank → 0, TRUE → 1, numeric text → number, Date → serial.
 * Throws the error value for errors and #VALUE! for anything else.
 *
 * @param {*} value
 * @returns {Number}
 */
export function toNumber(value) {
  switch (typeof value) {
    case "number":
      return value;
    case "boolean":
      return value ? 1 : 0;
    case "string": {
      const number = parseNumericText(value);

      if (number === null) {
        fail("VALUE");
      }

      return number;
    }
    case "undefined":
      return 0;
    default:
      break;
  }
  if (value === null) {
    return 0;
  }
  if (value instanceof Error) {
    throw value;
  }
  if (value instanceof Date) {
    return dateToSerial(value);
  }
  if (Array.isArray(value)) {
    const first = Array.isArray(value[0]) ? value[0][0] : value[0];

    return toNumber(first);
  }

  return fail("VALUE");
}

/**
 * Format a number the way Excel's General format renders it as text
 * (15 significant digits, scientific notation for very large/small values).
 *
 * @param {Number} number
 * @returns {String}
 */
export function formatGeneral(number) {
  if (number === 0) {
    return "0";
  }
  if (!isFinite(number)) {
    fail("NUM");
  }
  const rounded = Number(number.toPrecision(15));
  const exponent = Number(rounded.toExponential().split("e")[1]);

  if (exponent >= 15 || exponent <= -10) {
    const [mantissa, exp] = rounded.toExponential(14).split("e");
    const trimmed = mantissa.replace(/\.?0+$/, "");
    const expNumber = Number(exp);
    const expAbs = Math.abs(expNumber);

    return `${trimmed}E${expNumber < 0 ? "-" : "+"}${
      expAbs < 10 ? "0" : ""
    }${expAbs}`;
  }
  const text = rounded.toFixed(Math.max(0, 14 - exponent));

  return text.indexOf(".") === -1 ? text : text.replace(/\.?0+$/, "");
}

/**
 * Coerce a scalar to text like Excel's `&` operator does.
 *
 * @param {*} value
 * @returns {String}
 */
export function toText(value) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return formatGeneral(value);
    case "boolean":
      return value ? "TRUE" : "FALSE";
    case "undefined":
      return "";
    default:
      break;
  }
  if (value === null) {
    return "";
  }
  if (value instanceof Error) {
    throw value;
  }
  if (value instanceof Date) {
    return formatGeneral(dateToSerial(value));
  }
  if (Array.isArray(value)) {
    const first = Array.isArray(value[0]) ? value[0][0] : value[0];

    return toText(first);
  }
  if (typeof value === "function") {
    fail("VALUE");
  }

  return String(value);
}

/**
 * Coerce a scalar to a logical value like IF() does.
 * Blank → FALSE, numbers → non-zero, "TRUE"/"FALSE" text (any case).
 *
 * @param {*} value
 * @returns {Boolean}
 */
export function toBoolean(value) {
  switch (typeof value) {
    case "boolean":
      return value;
    case "number":
      return value !== 0;
    case "string": {
      const upper = value.toUpperCase();

      if (upper === "TRUE") {
        return true;
      }
      if (upper === "FALSE") {
        return false;
      }

      return fail("VALUE");
    }
    case "undefined":
      return false;
    default:
      break;
  }
  if (value === null) {
    return false;
  }
  if (value instanceof Error) {
    throw value;
  }
  if (value instanceof Date) {
    return true;
  }

  return fail("VALUE");
}

const collator =
  typeof Intl !== "undefined" && Intl.Collator
    ? new Intl.Collator("en-US", { sensitivity: "accent" })
    : null;

function compareText(a, b) {
  if (a === b) {
    return 0;
  }
  const la = a.toLowerCase();
  const lb = b.toLowerCase();

  if (la === lb) {
    return 0;
  }
  if (collator) {
    const result = collator.compare(la, lb);

    if (result !== 0) {
      return result < 0 ? -1 : 1;
    }
  }

  return la < lb ? -1 : 1;
}

function roundSignificant(number) {
  return number === 0 || !isFinite(number)
    ? number
    : Number(number.toPrecision(15));
}

function compareNumbers(a, b) {
  if (a === b) {
    return 0;
  }
  // Values further apart than the 15th significant digit cannot round to the
  // same number; skip the (slow) toPrecision round trip for them.
  if (Math.abs(a - b) > 1e-13 * Math.max(Math.abs(a), Math.abs(b))) {
    return a < b ? -1 : 1;
  }
  const ra = roundSignificant(a);
  const rb = roundSignificant(b);

  if (ra === rb) {
    return 0;
  }

  return ra < rb ? -1 : 1;
}

// Excel orders numbers < text < logicals.
function typeRank(value) {
  switch (typeof value) {
    case "number":
      return 0;
    case "string":
      return 1;
    case "boolean":
      return 2;
    default:
      return 3;
  }
}

function blankLike(other) {
  switch (typeof other) {
    case "string":
      return "";
    case "boolean":
      return false;
    default:
      return 0;
  }
}

function normalizeComparable(value) {
  if (value instanceof Date) {
    return dateToSerial(value);
  }
  if (Array.isArray(value)) {
    return normalizeComparable(
      Array.isArray(value[0]) ? value[0][0] : value[0]
    );
  }
  if (typeof value === "function") {
    fail("VALUE");
  }

  return value;
}

/**
 * Compare two scalars with Excel semantics (case-insensitive text,
 * numbers < text < logicals, blanks match 0 / "" / FALSE, 15 significant
 * digits for numbers). Errors are thrown (left operand first).
 *
 * @param {*} a
 * @param {*} b
 * @returns {Number} -1, 0 or 1.
 */
export function compare(a, b) {
  if (a instanceof Error) {
    throw a;
  }
  if (b instanceof Error) {
    throw b;
  }
  a = normalizeComparable(a);
  b = normalizeComparable(b);

  const aBlank = isBlank(a);
  const bBlank = isBlank(b);

  if (aBlank && bBlank) {
    return 0;
  }
  if (aBlank) {
    a = blankLike(b);
  } else if (bBlank) {
    b = blankLike(a);
  }
  const rankA = typeRank(a);
  const rankB = typeRank(b);

  if (rankA !== rankB) {
    return rankA < rankB ? -1 : 1;
  }
  if (rankA === 0) {
    return compareNumbers(a, b);
  }
  if (rankA === 1) {
    return compareText(a, b);
  }
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

/**
 * Excel `=` equality (never throws for mismatching types).
 *
 * @param {*} a
 * @param {*} b
 * @returns {Boolean}
 */
export function equals(a, b) {
  return compare(a, b) === 0;
}
