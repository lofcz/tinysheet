/**
 * Worksheet functions backed by the number-format engine, so that formula
 * results match what the same format shows in a cell:
 *
 * - TEXT(value, format_text)
 * - DOLLAR(number, [decimals])
 * - FIXED(number, [decimals], [no_commas])
 *
 * formulajs ships simplified versions of these (TEXT only understands a few
 * patterns, DOLLAR writes negatives as "$(1.00)", FIXED rounds 1.005 to
 * "1.00"), so they are overridden here.
 */
// @ts-ignore
import SSF from "./ssf";
import { parseInput } from "./inputParse";

const ERROR_CODES = [
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#SPILL!",
  "#CALC!",
  "#GETTING_DATA",
];

const MAX_SERIAL = 2958465; // 9999-12-31

/** Throw an error the formula parser maps to an Excel error value. */
function fail(code: "VALUE" | "N/A" | "NUM"): never {
  throw new Error(code);
}

/** Single value from a scalar or a range/array argument (top-left item). */
function scalar(arg: any): any {
  let v = arg;
  while (Array.isArray(v)) {
    if (v.length === 0) return undefined;
    [v] = v;
  }
  return v;
}

/** Propagate error arguments (Error objects or error-code strings). */
function checkError(v: any) {
  if (v instanceof Error) throw v;
  if (typeof v === "string" && ERROR_CODES.includes(v.toUpperCase())) {
    throw new Error(v.toUpperCase());
  }
}

/**
 * Coerce an argument to a number the way Excel does for a numeric
 * parameter: numbers pass, booleans are 1/0, empty is 0, and text is parsed
 * like typed input ("1,234", "12%", "3/15/2024"); other text is #VALUE!.
 */
function toNumber(arg: any): number {
  const v = scalar(arg);
  checkError(v);
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) {
    // Serial number of a JS date (local calendar date and time).
    const epoch = Date.UTC(
      v.getFullYear(),
      v.getMonth(),
      v.getDate(),
      v.getHours(),
      v.getMinutes(),
      v.getSeconds()
    );
    const days = (epoch - Date.UTC(1899, 11, 31)) / 86400000;
    return days >= 60 ? days + 1 : days;
  }
  const parsed = parseInput(String(v));
  if (parsed.type === "number" || parsed.type === "date") return parsed.v;
  return fail("VALUE");
}

/** Excel's ROUND: half away from zero, on the decimal representation. */
function round(n: number, digits: number): number {
  const d = Math.trunc(digits);
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  let r: number;
  if (d >= 0) {
    r = Number(`${Math.round(Number(`${a}e${d}`))}e-${d}`);
    if (Number.isNaN(r)) r = Math.round(a * 10 ** d) / 10 ** d;
  } else {
    const f = 10 ** -d;
    r = Math.round(a / f) * f;
  }
  return sign * r;
}

function decimalsArg(arg: any, dflt: number): number {
  const v = scalar(arg);
  if (v === undefined) return dflt;
  const d = Math.trunc(toNumber(v));
  if (d > 127) fail("VALUE");
  return d;
}

/** TEXT(value, format_text) */
export function TEXT(...args: any[]): string {
  if (args.length !== 2) fail("N/A");
  let value = scalar(args[0]);
  const fmtArg = scalar(args[1]);
  checkError(value);
  checkError(fmtArg);

  let fmt = "";
  if (typeof fmtArg === "boolean") fmt = fmtArg ? "TRUE" : "FALSE";
  else if (fmtArg !== undefined && fmtArg !== null) fmt = String(fmtArg);
  if (fmt === "") return "";

  if (value === undefined || value === null || value === "") value = 0;
  if (value instanceof Date) value = toNumber(value);
  if (typeof value === "string") {
    const parsed = parseInput(value);
    if (parsed.type === "number" || parsed.type === "date") value = parsed.v;
  }

  let out: string;
  try {
    out = SSF.format(fmt, value);
  } catch (e) {
    return fail("VALUE");
  }
  if (typeof value === "number" && SSF.is_date(fmt)) {
    if (value < 0 || value >= MAX_SERIAL + 1) fail("VALUE");
  }
  return `${out}`;
}

/** DOLLAR(number, [decimals]) → "$1,234.57", "($1,200)" */
export function DOLLAR(...args: any[]): string {
  if (args.length < 1 || args.length > 2) fail("N/A");
  const n = toNumber(args[0]);
  const d = decimalsArg(args[1], 2);
  const r = round(n, d);
  const body = d > 0 ? `#,##0.${"0".repeat(d)}` : "#,##0";
  return `${SSF.format(`"$"${body};("$"${body})`, r)}`;
}

/** FIXED(number, [decimals], [no_commas]) → "1,234.6" */
export function FIXED(...args: any[]): string {
  if (args.length < 1 || args.length > 3) fail("N/A");
  const n = toNumber(args[0]);
  const d = decimalsArg(args[1], 2);
  const noCommasArg = scalar(args[2]);
  checkError(noCommasArg);
  const noCommas =
    noCommasArg !== undefined && noCommasArg !== null && toNumber(noCommasArg);
  const r = round(n, d);
  const intPart = noCommas ? "0" : "#,##0";
  const body = d > 0 ? `${intPart}.${"0".repeat(d)}` : intPart;
  return `${SSF.format(body, r)}`;
}

export const FORMAT_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  TEXT,
  DOLLAR,
  FIXED,
};

type ParserLike = {
  setFunction: (name: string, fn: (params: any[]) => any) => any;
  on?: (
    event: string,
    cb: (name: string, params: any[], done: (v: any) => void) => void
  ) => any;
};

/**
 * Register TEXT/DOLLAR/FIXED on a formula parser. `setFunction` handlers
 * receive the evaluated argument list as one array. Function names are
 * matched case-insensitively ("=text(...)" works too).
 */
export function registerFormatFunctions(parser: ParserLike) {
  Object.keys(FORMAT_FUNCTIONS).forEach((name) => {
    parser.setFunction(name, (params: any[]) =>
      FORMAT_FUNCTIONS[name](...(params || []))
    );
  });
  parser.on?.("callFunction", (name, params, done) => {
    const upper = `${name}`.toUpperCase();
    if (upper !== name && FORMAT_FUNCTIONS[upper]) {
      done(FORMAT_FUNCTIONS[upper](...(params || [])));
    }
  });
  return parser;
}
