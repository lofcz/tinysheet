import _ from "lodash";
// @ts-ignore
import SSF from "./ssf";
import { Cell, CellMatrix } from "../types";
import { getCellValue } from "./cell";
import { parseInput, setInputMonthNames } from "./inputParse";

export {
  parseInput,
  resolveTypedInput,
  dateToSerial,
  setInputMonthNames,
} from "./inputParse";
export type { ParsedInput, TypedCellValue } from "./inputParse";

const base1904 = new Date(1900, 2, 1, 0, 0, 0);

export function datenum_local(v: Date, date1904?: number) {
  let epoch = Date.UTC(
    v.getFullYear(),
    v.getMonth(),
    v.getDate(),
    v.getHours(),
    v.getMinutes(),
    v.getSeconds()
  );
  const dnthresh_utc = Date.UTC(1899, 11, 31, 0, 0, 0);

  if (date1904) epoch -= 1461 * 24 * 60 * 60 * 1000;
  else if (v >= base1904) epoch += 24 * 60 * 60 * 1000;
  return (epoch - dnthresh_utc) / (24 * 60 * 60 * 1000);
}

/**
 * Format a value with an Excel number format code. Never throws: an invalid
 * code falls back to the value's text.
 */
export function formatValue(fmt: string | null | undefined, v: any): string {
  if (_.isNil(v)) return "";
  try {
    return `${SSF.format(fmt || "General", v)}`;
  } catch (e) {
    return `${v}`;
  }
}

/**
 * Excel's General format for a column wide enough: at most 11 characters,
 * scientific notation for very large/small numbers, and no float noise
 * (0.1 + 0.2 shows 0.3).
 */
export function formatGeneral(v: any): string {
  return formatValue("General", v);
}

/** Apply a format code (kept for backwards compatibility). */
export function update(fmt: string, v: any) {
  try {
    return SSF.format(fmt, v);
  } catch (e) {
    return v;
  }
}

export function is_date(fmt: string, v?: any) {
  return SSF.is_date(fmt, v);
}

/**
 * Number format implied by how a plain number is displayed in General, used
 * by callers that need an explicit decimal count (e.g. increase/decrease
 * decimal). 1.25 → "0.00", 7 → "General".
 */
function impliedDecimalFormat(display: string) {
  const m = /^-?\d+\.(\d+)$/.exec(display);
  if (!m) return "General";
  return `0.${"0".repeat(Math.min(m[1].length, 9))}`;
}

/**
 * Turn a raw value (typed text, pasted text or a number) into
 * `[m, ct, v]`: display text, cell type/format and stored value.
 *
 * Recognition follows Excel (see inputParse.ts). Plain decimals keep the
 * number of decimals they were written with (fa "0.00" for "1.50"), which
 * callers such as paste and autofill rely on to preserve what was shown.
 */
export function genarate(
  value: string | number | boolean
): [string, { fa: string; t: string }, any] | null {
  if (_.isNil(value)) {
    return null;
  }

  if (typeof value === "number") {
    const m = formatGeneral(value);
    return [m, { fa: impliedDecimalFormat(m), t: "n" }, value];
  }

  const str = value.toString();
  if (str.substring(0, 1) === "'") {
    const text = str.substring(1);
    return [text, { fa: "@", t: "s" }, text];
  }

  const parsed = parseInput(value);
  switch (parsed.type) {
    case "boolean":
      return [parsed.v ? "TRUE" : "FALSE", { fa: "General", t: "b" }, parsed.v];
    case "error":
      return [parsed.v, { fa: "General", t: "e" }, parsed.v];
    case "text":
      return [str, { fa: "General", t: "g" }, str];
    case "date":
      return [
        formatValue(parsed.fa, parsed.v),
        { fa: parsed.fa, t: "d" },
        parsed.v,
      ];
    default: {
      let { fa } = parsed;
      const plainDecimal = /^\s*[+-]?\d*\.(\d+)\s*$/.exec(str);
      if (fa === "General" && plainDecimal) {
        fa = `0.${"0".repeat(Math.min(plainDecimal[1].length, 9))}`;
      }
      return [formatValue(fa, parsed.v), { fa, t: "n" }, parsed.v];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Format colours ([Red], [Color10], ...)                              */
/* ------------------------------------------------------------------ */

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  blue: "#0000FF",
  cyan: "#00FFFF",
  green: "#00FF00",
  magenta: "#FF00FF",
  red: "#FF0000",
  white: "#FFFFFF",
  yellow: "#FFFF00",
};

/** Excel's default 56-colour palette, used by [ColorN]. */
const COLOR_PALETTE = [
  "#000000",
  "#FFFFFF",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#800000",
  "#008000",
  "#000080",
  "#808000",
  "#800080",
  "#008080",
  "#C0C0C0",
  "#808080",
  "#9999FF",
  "#993366",
  "#FFFFCC",
  "#CCFFFF",
  "#660066",
  "#FF8080",
  "#0066CC",
  "#CCCCFF",
  "#000080",
  "#FF00FF",
  "#FFFF00",
  "#00FFFF",
  "#800080",
  "#800000",
  "#008080",
  "#0000FF",
  "#00CCFF",
  "#CCFFFF",
  "#CCFFCC",
  "#FFFF99",
  "#99CCFF",
  "#FF99CC",
  "#CC99FF",
  "#FFCC99",
  "#3366FF",
  "#33CCCC",
  "#99CC00",
  "#FFCC00",
  "#FF9900",
  "#FF6600",
  "#666699",
  "#969696",
  "#003366",
  "#339966",
  "#003300",
  "#333300",
  "#993300",
  "#993366",
  "#333399",
  "#333333",
];

const COLOR_RE =
  /\[(black|blue|cyan|green|magenta|red|white|yellow|color\s*(\d{1,2}))\]/i;

/**
 * The font colour a number format assigns to a value, e.g. "#FF0000" for
 * -5 with "0.00;[Red]-0.00", or null when the chosen section has none.
 */
export function getFormatColor(
  fmt: string | null | undefined,
  v: any
): string | null {
  if (!fmt || fmt.indexOf("[") === -1 || _.isNil(v) || v === "") return null;
  let section: string;
  try {
    [, section] = SSF._choose(fmt, typeof v === "boolean" ? `${v}` : v);
  } catch (e) {
    return null;
  }
  if (!section) return null;
  // Ignore brackets inside quoted literals.
  const m = COLOR_RE.exec(section.replace(/"[^"]*"/g, ""));
  if (!m) return null;
  if (m[2] !== undefined) {
    return COLOR_PALETTE[parseInt(m[2], 10) - 1] || null;
  }
  return NAMED_COLORS[m[1].toLowerCase()];
}

/** Format colour for a cell's current value (see getFormatColor). */
export function getCellFormatColor(cell: Cell | null | undefined) {
  const ct = cell?.ct;
  if (!ct?.fa || ct.t === "inlineStr") return null;
  return getFormatColor(ct.fa, cell?.v);
}

/**
 * Localise month and weekday names used by date formats (mmm, mmmm, ddd,
 * dddd) and recognised in typed dates. Pass English names to reset.
 */
export function setFormatLocale(names: {
  /** 12 entries of [short, long], e.g. ["janv.", "janvier"]. */
  months?: [string, string][];
  /** 7 entries (Sunday first) of [short, long]. */
  days?: [string, string][];
}) {
  SSF.set_names({
    months: names.months?.map(([short, long]) => [
      long.charAt(0).toUpperCase(),
      short,
      long,
    ]),
    days: names.days,
  });
  setInputMonthNames(names.months);
}

/* ------------------------------------------------------------------ */
/* Value shown while editing a cell                                    */
/* ------------------------------------------------------------------ */

function fuzzynum(s: string | number) {
  let v = Number(s);
  if (typeof s === "number") {
    return s;
  }
  if (!Number.isNaN(v)) return v;
  let wt = 1;
  let ss = s
    .replace(/([\d]),([\d])/g, "$1$2")
    .replace(/[$€£¥]/g, "")
    .replace(/[%]/g, () => {
      wt *= 100;
      return "";
    });
  v = Number(ss);
  if (!Number.isNaN(v)) return v / wt;
  ss = ss.replace(/[(](.*)[)]/, ($$, $1) => {
    wt = -wt;
    return $1;
  });
  v = Number(ss);
  if (!Number.isNaN(v)) return v / wt;
  return v;
}

/** Excel shows at most 15 significant digits in the formula bar. */
function editNumber(v: any) {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number(v.toPrecision(15));
  }
  return v;
}

export function valueShowEs(r: number, c: number, d: CellMatrix) {
  let value = getCellValue(r, c, d, "m");
  if (value == null) {
    value = getCellValue(r, c, d, "v");
  } else {
    if (!Number.isNaN(fuzzynum(value))) {
      if (_.isString(value) && value.indexOf("%") > -1) {
      } else {
        value = getCellValue(r, c, d, "v");
      }
    }
    // else if (!isNaN(parseDate(value).getDate())){
    else if (d[r]?.[c]?.ct?.t === "d") {
    } else if (d[r]?.[c]?.ct?.t === "b") {
    } else {
      value = getCellValue(r, c, d, "v");
    }
  }
  return editNumber(value);
}
