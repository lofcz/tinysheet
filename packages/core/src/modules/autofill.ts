/**
 * Excel-style AutoFill series generation (fill handle, Ctrl+D/Ctrl+R).
 *
 * `generateFillSeries` takes the source cells of one line (a column when
 * filling up/down, a row when filling left/right) and returns the cells to
 * write, nearest-to-source first. It is pure: formula reference adjustment
 * and writing to the sheet are done by the caller (dropCell.ts).
 *
 * Behaviour follows Excel:
 * - the source is split into runs of consecutive cells of the same kind; each
 *   run continues its own series and the pattern repeats,
 * - numbers: one cell copies (Ctrl: +1), two or more follow the least-squares
 *   linear trend (Ctrl: copy); the "growth" type uses a geometric trend,
 * - dates step by day, month or year (detected from the source), times by
 *   one hour, and the days/weekdays/months/years types force a unit,
 * - weekday and month names (full and abbreviated, English, Chinese, the
 *   workbook locale and registered custom lists) continue cyclically keeping
 *   the source's letter case, as do quarter labels (Q1, Qtr 1, Quarter 1),
 * - text with a trailing or leading number ("Item 1", "A001", "1 apple") and
 *   ordinals ("1st") increment the number,
 * - filling up/left produces the decreasing series.
 */
import _ from "lodash";
import type { Cell } from "../types";
import { update } from "./format";

export type FillSource = Cell | null | undefined;

/**
 * Fill types (kept compatible with the legacy `dropCellCache.applyType`):
 * "0" copy cells, "1" fill series (Excel default), "2" formats only,
 * "3" values without formats, "4" days, "5" weekdays, "6" months, "7" years,
 * "8" series (legacy Chinese numbers), "9" growth trend.
 */
export type FillType =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

export type FillOptions = {
  type?: FillType | string | null;
  /** Filling up or left: the series runs backwards from the source. */
  reverse?: boolean;
  /** Ctrl (Option on Mac) held while dragging: toggles copy and series. */
  ctrl?: boolean;
  /** Workbook language, used to add locale weekday/month names. */
  lang?: string | null;
};

/* ------------------------------------------------------------------------ */
/* Lists                                                                     */
/* ------------------------------------------------------------------------ */

export type FillList = { id: string; items: string[] };

const BUILTIN_LISTS: FillList[] = [
  {
    id: "en-days-short",
    items: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  {
    id: "en-days-long",
    items: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
  },
  {
    id: "en-months-short",
    items: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
  },
  {
    id: "en-months-long",
    items: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
  },
  {
    id: "zh-week-2",
    items: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  },
  {
    id: "zh-week-3",
    items: [
      "星期日",
      "星期一",
      "星期二",
      "星期三",
      "星期四",
      "星期五",
      "星期六",
    ],
  },
];

let customLists: FillList[] = [];

/** Registers user-defined fill lists (like Excel's Custom Lists). */
export function setCustomFillLists(lists: string[][]) {
  customLists = (lists || [])
    .filter((l) => Array.isArray(l) && l.length > 1)
    .map((items, i) => ({ id: `custom-${i}`, items: items.map(String) }));
}

export function getCustomFillLists(): string[][] {
  return customLists.map((l) => [...l.items]);
}

const localeListCache: Record<string, FillList[]> = {};

function getLocaleLists(lang?: string | null): FillList[] {
  if (!lang || /^en\b/i.test(lang)) return [];
  if (localeListCache[lang]) return localeListCache[lang];
  const lists: FillList[] = [];
  try {
    const mk = (opts: Intl.DateTimeFormatOptions, dates: Date[]) =>
      dates.map((d) =>
        new Intl.DateTimeFormat(lang, { ...opts, timeZone: "UTC" }).format(d)
      );
    // 2023-01-01 is a Sunday
    const days = _.range(7).map((i) => new Date(Date.UTC(2023, 0, 1 + i)));
    const months = _.range(12).map((i) => new Date(Date.UTC(2023, i, 15)));
    const candidates: [string, string[]][] = [
      ["days-long", mk({ weekday: "long" }, days)],
      ["days-short", mk({ weekday: "short" }, days)],
      ["months-long", mk({ month: "long" }, months)],
      ["months-short", mk({ month: "short" }, months)],
    ];
    candidates.forEach(([id, items]) => {
      if (new Set(items.map((s) => s.toLowerCase())).size === items.length) {
        lists.push({ id: `${lang}-${id}`, items });
      }
    });
  } catch {
    // Intl without locale data: no locale lists.
  }
  localeListCache[lang] = lists;
  return lists;
}

function findList(
  text: string,
  lang?: string | null
): { list: FillList; index: number } | null {
  const lower = text.toLowerCase();
  const all = [...customLists, ...BUILTIN_LISTS, ...getLocaleLists(lang)];
  for (let i = 0; i < all.length; i += 1) {
    const index = all[i].items.findIndex((it) => it.toLowerCase() === lower);
    if (index >= 0) return { list: all[i], index };
  }
  return null;
}

type CaseStyle = "upper" | "lower" | "asis";

function caseStyleOf(text: string): CaseStyle {
  if (
    text.length > 1 &&
    text === text.toUpperCase() &&
    text !== text.toLowerCase()
  )
    return "upper";
  if (text === text.toLowerCase() && text !== text.toUpperCase())
    return "lower";
  return "asis";
}

function applyCase(text: string, style: CaseStyle) {
  if (style === "upper") return text.toUpperCase();
  if (style === "lower") return text.toLowerCase();
  return text;
}

/* ------------------------------------------------------------------------ */
/* Chinese numbers (kept from the Luckysheet implementation)                */
/* ------------------------------------------------------------------------ */

const chnNumChar: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};
const chnNameValue: Record<string, { value: number; secUnit: boolean }> = {
  十: { value: 10, secUnit: false },
  百: { value: 100, secUnit: false },
  千: { value: 1000, secUnit: false },
  万: { value: 10000, secUnit: true },
  亿: { value: 100000000, secUnit: true },
};
const chnNumList = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const chnUnitSection = ["", "万", "亿", "万亿", "亿亿"];
const chnUnitChar = ["", "十", "百", "千"];

export function chineseToNumber(chnStr: string) {
  let rtn = 0;
  let section = 0;
  let number = 0;
  let secUnit = false;
  const str = chnStr.split("");
  for (let i = 0; i < str.length; i += 1) {
    const num = chnNumChar[str[i]];
    if (typeof num !== "undefined") {
      number = num;
      if (i === str.length - 1) section += number;
    } else {
      const unit = chnNameValue[str[i]];
      if (!unit) continue;
      if (unit.secUnit) {
        section = (section + number) * unit.value;
        rtn += section;
        section = 0;
        secUnit = true;
      } else {
        section += (number || (i === 0 ? 1 : 0)) * unit.value;
      }
      number = 0;
      secUnit = false;
    }
  }
  return secUnit ? rtn : rtn + section;
}

function sectionToChinese(section: number) {
  let strIns = "";
  let chnStr = "";
  let unitPos = 0;
  let zero = true;
  while (section > 0) {
    const v = section % 10;
    if (v === 0) {
      if (!zero) {
        zero = true;
        chnStr = chnNumList[v] + chnStr;
      }
    } else {
      zero = false;
      strIns = chnNumList[v] + chnUnitChar[unitPos];
      chnStr = strIns + chnStr;
    }
    unitPos += 1;
    section = Math.floor(section / 10);
  }
  return chnStr;
}

export function numberToChinese(num: number) {
  if (num === 0) return chnNumList[0];
  let unitPos = 0;
  let strIns = "";
  let chnStr = "";
  let needZero = false;
  while (num > 0) {
    const section = num % 10000;
    if (needZero) chnStr = chnNumList[0] + chnStr;
    strIns = sectionToChinese(section);
    strIns += section !== 0 ? chnUnitSection[unitPos] : chnUnitSection[0];
    chnStr = strIns + chnStr;
    needZero = section < 1000 && section > 0;
    num = Math.floor(num / 10000);
    unitPos += 1;
  }
  // "一十二" reads as "十二"
  return chnStr.replace(/^一十/, "十");
}

function isChnNumber(text: string) {
  if (!text) return false;
  const chars = text.split("");
  if (!chars.every((ch) => ch in chnNumChar || ch in chnNameValue))
    return false;
  // a lone unit character (e.g. "万") is not a number
  return chars.some((ch) => ch in chnNumChar) || text === "十";
}

/* ------------------------------------------------------------------------ */
/* Dates                                                                     */
/* ------------------------------------------------------------------------ */

const DAY_MS = 86400000;
const EPOCH_1899_12_30 = Date.UTC(1899, 11, 30);

/** Excel serial number (1900 system) to UTC calendar parts. */
export function serialToDateParts(serial: number) {
  const whole = Math.floor(serial);
  const frac = serial - whole;
  const base = whole >= 61 ? EPOCH_1899_12_30 : Date.UTC(1899, 11, 31);
  const dt = new Date(base + whole * DAY_MS);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth(),
    d: dt.getUTCDate(),
    dow: dt.getUTCDay(),
    frac,
  };
}

/** UTC calendar parts (month 0-based, may overflow) to an Excel serial. */
export function dateToSerial(y: number, m: number, d: number) {
  const serial = Math.round((Date.UTC(y, m, d) - EPOCH_1899_12_30) / DAY_MS);
  return serial <= 60 ? serial - 1 : serial;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** EDATE: same day `months` later, clamped to the month's last day. */
export function addMonthsToSerial(serial: number, months: number) {
  const p = serialToDateParts(serial);
  const total = p.y * 12 + p.m + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return dateToSerial(y, m, Math.min(p.d, daysInMonth(y, m))) + p.frac;
}

function isWeekend(serial: number) {
  const { dow } = serialToDateParts(serial);
  return dow === 0 || dow === 6;
}

/** WORKDAY: `n` working days (Mon-Fri) after `serial`. */
export function addWorkdaysToSerial(serial: number, n: number) {
  if (n === 0) return serial;
  const dir = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  const weeks = Math.floor((remaining - 1) / 5);
  let s = serial + dir * weeks * 7;
  remaining -= weeks * 5;
  while (remaining > 0) {
    s += dir;
    if (!isWeekend(s)) remaining -= 1;
  }
  return s;
}

function workdaysBetween(a: number, b: number) {
  const dir = b >= a ? 1 : -1;
  let count = 0;
  for (let s = a; dir > 0 ? s < b : s > b; s += dir) {
    if (!isWeekend(s + dir)) count += dir;
  }
  return count;
}

function roundSerial(v: number) {
  return Math.round(v * DAY_MS) / DAY_MS;
}

function roundNumber(v: number) {
  return Number.isFinite(v) ? parseFloat(v.toPrecision(15)) : v;
}

/* ------------------------------------------------------------------------ */
/* Classification                                                            */
/* ------------------------------------------------------------------------ */

type ValueInfo =
  | { kind: "copy" }
  | { kind: "number"; value: number }
  | { kind: "date"; value: number; timeOnly: boolean; hasTime: boolean }
  | { kind: "list"; list: FillList; index: number; style: CaseStyle }
  | {
      kind: "textnum";
      value: number;
      prefix: string;
      suffix: string;
      width: number;
    }
  | { kind: "ordinal"; value: number; upper: boolean }
  | { kind: "chn"; value: number };

function isTimeOnlyFormat(fa: string | undefined) {
  if (!fa) return false;
  const stripped = fa.replace(/"[^"]*"|\[[^\]]*\]|AM\/PM|A\/P/gi, "");
  return /[hs]/i.test(stripped) && !/[yd]/i.test(stripped);
}

function cellText(cell: Cell): string | null {
  if (typeof cell.v === "string") return cell.v;
  if (cell.v == null && typeof cell.m === "string") return cell.m;
  return null;
}

const QUARTER_RE = /^(Q|Qtr|Quarter)(\s*)([1-4])$/i;
const ORDINAL_RE = /^(\d+)(st|nd|rd|th)$/i;

function quarterList(prefix: string, space: string): FillList {
  return {
    id: `quarter:${prefix}${space}`,
    items: [1, 2, 3, 4].map((n) => `${prefix}${space}${n}`),
  };
}

/** Classifies one source cell for AutoFill. */
export function classifyFillValue(
  cell: FillSource,
  lang?: string | null
): ValueInfo {
  // formulas and pictures are copied, never extended as a series
  if (cell == null || cell.f != null || cell.img) return { kind: "copy" };
  if (cell.v == null && cell.m == null) return { kind: "copy" };
  const t = cell.ct?.t;

  if (t === "d") {
    let value: number | null = null;
    if (typeof cell.v === "number") value = cell.v;
    else if (cell.v != null && !Number.isNaN(Number(cell.v)))
      value = Number(cell.v);
    if (value != null) {
      const timeOnly =
        isTimeOnlyFormat(cell.ct?.fa) || (value >= 0 && value < 1);
      return {
        kind: "date",
        value,
        timeOnly,
        hasTime: value !== Math.floor(value),
      };
    }
    return { kind: "copy" };
  }

  if (t === "b" || t === "e" || typeof cell.v === "boolean")
    return { kind: "copy" };

  if (
    t === "n" ||
    (typeof cell.v === "number" && t !== "s" && t !== "inlineStr")
  ) {
    const value = Number(cell.v);
    return Number.isFinite(value)
      ? { kind: "number", value }
      : { kind: "copy" };
  }

  if (t === "inlineStr") return { kind: "copy" };
  const text = cellText(cell);
  if (text == null || text === "") return { kind: "copy" };

  const quarter = text.match(QUARTER_RE);
  if (quarter) {
    return {
      kind: "list",
      list: quarterList(quarter[1], quarter[2]),
      index: Number(quarter[3]) - 1,
      style: "asis",
    };
  }

  const found = findList(text, lang);
  if (found) {
    return {
      kind: "list",
      list: found.list,
      index: found.index,
      style: caseStyleOf(text),
    };
  }

  const ordinal = text.match(ORDINAL_RE);
  if (ordinal) {
    return {
      kind: "ordinal",
      value: Number(ordinal[1]),
      upper: ordinal[2] === ordinal[2].toUpperCase(),
    };
  }

  const trailing = text.match(/^([\s\S]*?)(\d+)$/);
  if (trailing) {
    const digits = trailing[2];
    return {
      kind: "textnum",
      value: Number(digits),
      prefix: trailing[1],
      suffix: "",
      width: digits.length > 1 && digits[0] === "0" ? digits.length : 0,
    };
  }
  const leading = text.match(/^(\d+)(\D[\s\S]*)$/);
  if (leading) {
    const digits = leading[1];
    return {
      kind: "textnum",
      value: Number(digits),
      prefix: "",
      suffix: leading[2],
      width: digits.length > 1 && digits[0] === "0" ? digits.length : 0,
    };
  }

  if (isChnNumber(text)) return { kind: "chn", value: chineseToNumber(text) };

  return { kind: "copy" };
}

function runKey(info: ValueInfo): string {
  switch (info.kind) {
    case "number":
      return "number";
    case "date":
      return info.timeOnly ? "time" : "date";
    case "list":
      return `list:${info.list.id}`;
    case "textnum":
      return `textnum:${info.prefix}\u0000${info.suffix}`;
    case "ordinal":
      return "ordinal";
    case "chn":
      return "chn";
    default:
      return "copy";
  }
}

/** Whether a cell would produce a series (not a plain copy) when filled. */
export function isSeriesFillValue(cell: FillSource, lang?: string | null) {
  return classifyFillValue(cell, lang).kind !== "copy";
}

/* ------------------------------------------------------------------------ */
/* Series                                                                    */
/* ------------------------------------------------------------------------ */

function cloneCell(cell: FillSource): FillSource {
  return cell == null ? null : _.cloneDeep(cell);
}

/** Least-squares line through (0, ys[0]) ... (k-1, ys[k-1]). */
export function linearTrend(ys: number[]) {
  const k = ys.length;
  if (k === 1) return { intercept: ys[0], slope: 0 };
  const mx = (k - 1) / 2;
  const my = _.mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < k; i += 1) {
    num += (i - mx) * (ys[i] - my);
    den += (i - mx) * (i - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  return { intercept: my - slope * mx, slope };
}

function uniformStep(values: number[], modulo?: number): number | null {
  const diff = (a: number, b: number) =>
    modulo ? (((b - a) % modulo) + modulo) % modulo : b - a;
  const step = diff(values[0], values[1]);
  for (let i = 2; i < values.length; i += 1) {
    if (diff(values[i - 1], values[i]) !== step) return null;
  }
  return step;
}

function ordinalSuffix(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

type Generator = (t: number) => FillSource;

function withNumber(template: FillSource, value: number, defaultFa: string) {
  const d = (cloneCell(template) || {}) as Cell;
  d.v = value;
  if (!d.ct) d.ct = { fa: defaultFa, t: defaultFa === "General" ? "n" : "d" };
  const fa = d.ct.fa || defaultFa;
  try {
    d.m = update(fa, value);
  } catch {
    d.m = String(value);
  }
  return d;
}

function withText(template: FillSource, text: string) {
  const d = (cloneCell(template) || {}) as Cell;
  d.v = text;
  d.m = text;
  return d;
}

function makeGenerator(
  infos: ValueInfo[],
  cells: FillSource[],
  type: string,
  ctrl: boolean,
  dir: 1 | -1
): Generator {
  const k = cells.length;
  const copy: Generator = (t) => cloneCell(cells[t % k]);
  const first = infos[0];
  const explicitSeries = type !== "1" && type !== "8" && type !== "3";
  // Ctrl toggles between copying and extending the series (a single number
  // is the exception: it copies by default and Ctrl makes it count up).
  // `dir` is the implicit step direction for single cells (-1 up/left).
  const wantSeries = () => explicitSeries || !ctrl;

  switch (first.kind) {
    case "number": {
      const ys = infos.map((i) => (i as { value: number }).value);
      if (k === 1) {
        const single = explicitSeries ? true : ctrl;
        if (!single) return copy;
        return (t) =>
          withNumber(cells[0], roundNumber(ys[0] + dir * t), "General");
      }
      if (!wantSeries()) return copy;
      if (type === "9" && (ys.every((y) => y > 0) || ys.every((y) => y < 0))) {
        const sign = ys[0] < 0 ? -1 : 1;
        const fit = linearTrend(ys.map((y) => Math.log(Math.abs(y))));
        return (t) =>
          withNumber(
            cells[t % k],
            roundNumber(sign * Math.exp(fit.intercept + fit.slope * t)),
            "General"
          );
      }
      const fit = linearTrend(ys);
      return (t) =>
        withNumber(
          cells[t % k],
          roundNumber(fit.intercept + fit.slope * t),
          "General"
        );
    }

    case "date": {
      const serials = infos.map((i) => (i as { value: number }).value);
      const { timeOnly } = first as { timeOnly: boolean };
      const base = serials[0];
      const out = (t: number, v: number) =>
        withNumber(
          cells[t % k],
          roundSerial(v),
          timeOnly ? "hh:mm" : "yyyy-MM-dd"
        );
      if (!wantSeries()) return copy;

      if (type === "5") {
        const step =
          k === 1 ? dir : workdaysBetween(serials[0], serials[1]) || dir;
        return (t) => out(t, addWorkdaysToSerial(base, t * step));
      }
      if (type === "6" || type === "7") {
        let step = (type === "7" ? 12 : 1) * dir;
        if (k > 1) {
          const p0 = serialToDateParts(serials[0]);
          const p1 = serialToDateParts(serials[1]);
          const diff = p1.y * 12 + p1.m - (p0.y * 12 + p0.m);
          if (type === "7") step = Math.round(diff / 12) * 12 || 12 * dir;
          else step = diff || dir;
        }
        return (t) => out(t, addMonthsToSerial(base, t * step));
      }
      if (k === 1) {
        const step = (type !== "4" && timeOnly ? 1 / 24 : 1) * dir;
        return (t) => out(t, base + t * step);
      }
      if (type !== "4" && !timeOnly) {
        const parts = serials.map(serialToDateParts);
        const sameDay = parts.every((p) => p.d === parts[0].d);
        const monthIdx = parts.map((p) => p.y * 12 + p.m);
        const monthStep = uniformStep(monthIdx);
        if (sameDay && monthStep != null && monthStep !== 0) {
          return (t) => out(t, addMonthsToSerial(base, t * monthStep));
        }
      }
      const fit = linearTrend(serials);
      return (t) => out(t, fit.intercept + fit.slope * t);
    }

    case "list": {
      const { list, style } = first as {
        list: FillList;
        style: CaseStyle;
      };
      const L = list.items.length;
      const idx = infos.map((i) => (i as { index: number }).index);
      if (!wantSeries()) return copy;
      const step = k === 1 ? dir : uniformStep(idx, L);
      if (step == null || step === 0) return copy;
      return (t) => {
        const tpl = infos[t % k] as { style: CaseStyle };
        const i = (((idx[0] + t * step) % L) + L) % L;
        return withText(
          cells[t % k],
          applyCase(list.items[i], tpl.style ?? style)
        );
      };
    }

    case "textnum":
    case "ordinal":
    case "chn": {
      const nums = infos.map((i) => (i as { value: number }).value);
      if (!wantSeries()) return copy;
      const step = k === 1 ? dir : uniformStep(nums);
      if (step == null || step === 0) return copy;
      return (t) => {
        const n = Math.abs(nums[0] + t * step);
        const info = infos[t % k];
        let text: string;
        if (info.kind === "textnum") {
          const digits = String(n).padStart(info.width, "0");
          text = `${info.prefix}${digits}${info.suffix}`;
        } else if (info.kind === "ordinal") {
          const suffix = ordinalSuffix(n);
          text = `${n}${info.upper ? suffix.toUpperCase() : suffix}`;
        } else {
          text = numberToChinese(n);
        }
        return withText(cells[t % k], text);
      };
    }

    default:
      return copy;
  }
}

/**
 * Generates `len` cells continuing `source` (ordered from the far end of the
 * source towards the fill area when `reverse` is false). The first returned
 * cell is the one adjacent to the source.
 */
export function generateFillSeries(
  source: FillSource[],
  len: number,
  options: FillOptions = {}
): FillSource[] {
  const src = options.reverse ? [...source].reverse() : [...source];
  const n = src.length;
  if (n === 0 || len <= 0) return [];
  const type = String(options.type ?? "1");

  if (type === "0" || type === "2") {
    return _.range(len).map((i) => cloneCell(src[i % n]));
  }

  const infos = src.map((cell) => classifyFillValue(cell, options.lang));

  // Runs of consecutive cells of the same kind; each run is its own series.
  const runOf: { start: number; len: number; gen: Generator }[] = [];
  let start = 0;
  while (start < n) {
    const key = runKey(infos[start]);
    let end = start + 1;
    while (end < n && runKey(infos[end]) === key) end += 1;
    const run = {
      start,
      len: end - start,
      gen: makeGenerator(
        infos.slice(start, end),
        src.slice(start, end),
        type,
        !!options.ctrl,
        options.reverse ? -1 : 1
      ),
    };
    for (let p = start; p < end; p += 1) runOf[p] = run;
    start = end;
  }

  const out: FillSource[] = [];
  for (let i = 0; i < len; i += 1) {
    const pos = i % n;
    const rep = Math.floor(i / n) + 1;
    const run = runOf[pos];
    out.push(run.gen(rep * run.len + (pos - run.start)));
  }
  return out;
}
