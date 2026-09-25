import _ from "lodash";
import type { Context } from "../context";
import type { Cell, CellMatrix, SingleRange } from "../types";
import type {
  CFCellResult,
  CFComputeMap,
  CFDataBar,
  CFRule,
  CFStyle,
  CFValueObject,
} from "./cfTypes";
import { normalizeRule, CF_ICON_SETS, iconSetSize } from "./cfRules";
import {
  compileCFFormula,
  evaluateCFFormula,
  isCFError,
  isCFTruthy,
  shiftCFFormula,
} from "./cfFormula";
import { peek, peekSheet } from "./dependencyGraph";

/*
 * Conditional-formatting evaluation.
 *
 * `computeCFRules` evaluates every rule of a sheet and returns a map from
 * "r_c" to what the rules do to that cell. Rules are applied from the highest
 * priority (the last array element) down; a property set by a higher-priority
 * rule wins over lower ones, and "stop if true" ends the evaluation of a cell.
 *
 * `getCFComputeMap` caches the result per recalculation: it is reused while
 * the rules and every sheet's cell matrix are the same (frozen) objects, so
 * painting never re-evaluates rules.
 */

/* Values */

function inlineText(cell: Cell) {
  const s = (cell.ct as any)?.s;
  if (!Array.isArray(s)) return "";
  return s.map((x: any) => x?.v ?? "").join("");
}

/** The value Excel's rules see: number, text, boolean, error text or null. */
export function cfCellValue(cell: Cell | null | undefined): any {
  if (!cell) return null;
  if (cell.ct?.t === "inlineStr") return inlineText(cell);
  const { v } = cell;
  if (_.isNil(v)) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (
    (cell.ct?.t === "n" || cell.ct?.t === "d") &&
    typeof v === "string" &&
    v.trim() !== "" &&
    !Number.isNaN(Number(v))
  ) {
    return Number(v);
  }
  return v;
}

function numericValue(cell: Cell | null | undefined): number | null {
  const v = cfCellValue(cell);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isBlankValue(v: any) {
  return _.isNil(v) || (typeof v === "string" && v.trim() === "");
}

function toOperand(raw: any): any {
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  if (_.isNil(raw)) return "";
  const s = `${raw}`;
  if (s.trim() !== "" && !Number.isNaN(Number(s))) return Number(s);
  const u = s.trim().toUpperCase();
  if (u === "TRUE") return true;
  if (u === "FALSE") return false;
  return s;
}

function typeRank(v: any) {
  if (typeof v === "number") return 0;
  if (typeof v === "string") return 1;
  return 2; // boolean
}

/** Excel's ordering: numbers < text (case-insensitive) < FALSE < TRUE. */
export function compareCFValues(a: any, b: any): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  if (ra === 1) {
    const x = (a as string).toLowerCase();
    const y = (b as string).toLowerCase();
    if (x === y) return 0;
    return x < y ? -1 : 1;
  }
  const x = Number(a);
  const y = Number(b);
  if (Math.abs(x - y) < 1e-12 * Math.max(1, Math.abs(x), Math.abs(y))) {
    return 0;
  }
  return x < y ? -1 : 1;
}

/* Dates */

const MS_PER_DAY = 86400000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function serialOf(y: number, m: number, d: number) {
  return Math.round((Date.UTC(y, m, d) - EXCEL_EPOCH) / MS_PER_DAY);
}

/** The clock of "dates occurring" rules (replaceable in tests). */
export const cfClock = { now: () => new Date() };

/** Today's date serial (local time). */
export function cfToday(): number {
  const now = cfClock.now();
  return serialOf(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateText(s: string): number | null {
  const m = /^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s*$/.exec(s);
  if (!m) return null;
  return serialOf(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10)
  );
}

/** Inclusive serial range of an Excel "dates occurring" period. */
export function cfDatePeriod(
  period: string,
  today = cfToday()
): [number, number] | null {
  const date = new Date(EXCEL_EPOCH + today * MS_PER_DAY);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const dow = date.getUTCDay(); // weeks start on Sunday, as in Excel
  switch (period) {
    case "yesterday":
      return [today - 1, today - 1];
    case "today":
      return [today, today];
    case "tomorrow":
      return [today + 1, today + 1];
    case "last7Days":
      return [today - 6, today];
    case "thisWeek":
      return [today - dow, today - dow + 6];
    case "lastWeek":
      return [today - dow - 7, today - dow - 1];
    case "nextWeek":
      return [today - dow + 7, today - dow + 13];
    case "thisMonth":
      return [serialOf(y, m, 1), serialOf(y, m + 1, 0)];
    case "lastMonth":
      return [serialOf(y, m - 1, 1), serialOf(y, m, 0)];
    case "nextMonth":
      return [serialOf(y, m + 1, 1), serialOf(y, m + 2, 0)];
    case "thisYear":
      return [serialOf(y, 0, 1), serialOf(y, 11, 31)];
    case "lastYear":
      return [serialOf(y - 1, 0, 1), serialOf(y - 1, 11, 31)];
    case "last30days":
      return [today - 29, today];
    case "next7days":
      return [today, today + 6];
    case "next30days":
      return [today, today + 29];
    default:
      break;
  }
  // legacy: a date or "date - date"
  const single = parseDateText(period);
  if (single != null) return [single, single];
  const parts = `${period}`.split(/\s+[-~]\s+|\s*~\s*/);
  if (parts.length === 2) {
    const a = parseDateText(parts[0]);
    const b = parseDateText(parts[1]);
    if (a != null && b != null) return [Math.min(a, b), Math.max(a, b)];
  }
  return null;
}

/* Statistics */

function percentileInc(sorted: number[], k: number) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const p = Math.min(1, Math.max(0, k));
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

interface Stats {
  values: number[];
  sorted: number[];
  min: number;
  max: number;
}

function makeStats(values: number[]): Stats {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    values,
    sorted,
    min: sorted.length ? sorted[0] : NaN,
    max: sorted.length ? sorted[sorted.length - 1] : NaN,
  };
}

/* Colours */

export function parseCFColor(color: string): [number, number, number] | null {
  if (!color) return null;
  const s = color.trim();
  let m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) {
    return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as [
      number,
      number,
      number,
    ];
  }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function toHex(rgb: number[]) {
  return `#${rgb
    .map((x) =>
      Math.max(0, Math.min(255, Math.round(x)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`.toUpperCase();
}

export function mixCFColors(c1: string, c2: string, t: number) {
  const a = parseCFColor(c1);
  const b = parseCFColor(c2);
  if (!a || !b) return t < 0.5 ? c1 : c2;
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t));
}

/* Evaluation */

interface EvalEnv {
  ctx: Context;
  sheetId: string;
  data: CellMatrix;
  rows: number;
  cols: number;
  today: number;
}

function forEachCell(
  env: EvalEnv,
  ranges: SingleRange[],
  fn: (r: number, c: number, cell: Cell | null) => void
) {
  const seen = ranges.length > 1 ? new Set<number>() : null;
  for (let s = 0; s < ranges.length; s += 1) {
    const rg = ranges[s];
    if (!rg?.row || !rg?.column) continue;
    const r2 = Math.min(rg.row[1], env.rows - 1);
    const c2 = Math.min(rg.column[1], env.cols - 1);
    for (let r = Math.max(0, rg.row[0]); r <= r2; r += 1) {
      const row = peek(env.data[r]);
      for (let c = Math.max(0, rg.column[0]); c <= c2; c += 1) {
        if (seen) {
          const k = r * 20000 + c;
          if (seen.has(k)) continue;
          seen.add(k);
        }
        fn(r, c, (peek(row?.[c]) as Cell) ?? null);
      }
    }
  }
}

function collectNumbers(env: EvalEnv, ranges: SingleRange[]) {
  const values: number[] = [];
  forEachCell(env, ranges, (_r, _c, cell) => {
    const n = numericValue(cell);
    if (n !== null) values.push(n);
  });
  return values;
}

function topLeft(ranges: SingleRange[]) {
  const first = ranges[0];
  return first ? { r: first.row[0], c: first.column[0] } : { r: 0, c: 0 };
}

function evalFormulaNumber(env: EvalEnv, formula: any, ranges: SingleRange[]) {
  const tl = topLeft(ranges);
  const v = evaluateCFFormula(env.ctx, `${formula}`, tl.r, tl.c, env.sheetId);
  const n = Number(v);
  return typeof v === "boolean" || Number.isNaN(n) ? NaN : n;
}

function resolveValue(
  env: EvalEnv,
  vo: CFValueObject | undefined,
  stats: Stats,
  ranges: SingleRange[],
  fallback: "min" | "max"
): number {
  const type = vo?.type ?? fallback;
  const raw = vo?.value;
  switch (type) {
    case "min":
      return stats.min;
    case "max":
      return stats.max;
    case "autoMin":
      return Math.min(0, stats.min);
    case "autoMax":
      return Math.max(0, stats.max);
    case "percent": {
      const p = Number(raw ?? 0);
      return stats.min + ((stats.max - stats.min) * p) / 100;
    }
    case "percentile":
      return percentileInc(stats.sorted, Number(raw ?? 0) / 100);
    case "formula":
      return evalFormulaNumber(env, raw, ranges);
    case "num":
    default: {
      if (typeof raw === "string" && raw.trim().startsWith("=")) {
        return evalFormulaNumber(env, raw, ranges);
      }
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
      return fallback === "min" ? stats.min : stats.max;
    }
  }
}

type Emit = (r: number, c: number, patch: CFCellResult) => boolean;

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

export function dataBarGeometry(
  v: number,
  lo: number,
  hi: number,
  db: CFDataBar
) {
  const minLen = clamp01((db.minLength ?? 0) / 100);
  const maxLen = clamp01((db.maxLength ?? 100) / 100);
  const scaleLen = (frac: number) => minLen + frac * (maxLen - minLen);
  const mode = db.axisPosition ?? "automatic";
  let axis: number | null = null;
  if (mode === "midpoint") axis = 0.5;
  else if (mode === "automatic" && lo < 0) axis = hi > 0 ? -lo / (hi - lo) : 1;
  let start: number;
  let end: number;
  let solidSide: "left" | "right" = "left";
  if (axis === null) {
    const frac = hi === lo ? 1 : clamp01((v - lo) / (hi - lo));
    start = 0;
    end = scaleLen(frac);
  } else if (v >= 0) {
    const frac = hi > 0 ? clamp01(v / hi) : 0;
    const len = v === 0 ? 0 : (1 - axis) * scaleLen(frac);
    start = axis;
    end = axis + len;
  } else {
    const frac = lo < 0 ? clamp01(v / lo) : 0;
    const len = axis * scaleLen(frac);
    start = axis - len;
    end = axis;
    solidSide = "right";
  }
  if (db.direction === "rightToLeft") {
    const s = 1 - end;
    end = 1 - start;
    start = s;
    if (axis !== null) axis = 1 - axis;
    solidSide = solidSide === "left" ? "right" : "left";
  }
  return { start, end, axis, solidSide };
}

function evalDataBar(env: EvalEnv, rule: CFRule, emit: Emit) {
  const db = rule.dataBar!;
  const stats = makeStats(collectNumbers(env, rule.cellrange));
  if (stats.values.length === 0) return;
  let lo = resolveValue(
    env,
    db.min ?? { type: "autoMin" },
    stats,
    rule.cellrange,
    "min"
  );
  let hi = resolveValue(
    env,
    db.max ?? { type: "autoMax" },
    stats,
    rule.cellrange,
    "max"
  );
  if (Number.isNaN(lo)) lo = Math.min(0, stats.min);
  if (Number.isNaN(hi)) hi = Math.max(0, stats.max);
  if (lo > hi) [lo, hi] = [hi, lo];
  forEachCell(env, rule.cellrange, (r, c, cell) => {
    const v = numericValue(cell);
    if (v === null) return;
    const geo = dataBarGeometry(v, lo, hi, db);
    const negative = v < 0 && !db.sameNegativeColor;
    const color = negative ? db.negativeColor || "#FF0000" : db.color;
    const border = db.border ?? db.gradient;
    let borderColor: string | null = null;
    if (border) {
      borderColor = negative
        ? db.negativeBorderColor || db.negativeColor || "#FF0000"
        : db.borderColor || db.color;
    }
    emit(r, c, {
      dataBar: {
        start: geo.start,
        end: geo.end,
        color,
        borderColor,
        gradient: !!db.gradient,
        solidSide: geo.solidSide,
        axis: geo.axis,
        axisColor: db.axisColor || "#000000",
      },
      hideValue: db.showValue === false ? true : undefined,
    });
  });
}

function evalColorScale(env: EvalEnv, rule: CFRule, emit: Emit) {
  const stops = rule.colorScale?.stops ?? [];
  if (stops.length < 2) return;
  const stats = makeStats(collectNumbers(env, rule.cellrange));
  if (stats.values.length === 0) return;
  const last = stops.length - 1;
  const points = stops.map((s, i) =>
    resolveValue(env, s, stats, rule.cellrange, i === last ? "max" : "min")
  );
  // keep the stops ascending
  for (let i = 1; i < points.length; i += 1) {
    if (Number.isNaN(points[i]) || points[i] < points[i - 1]) {
      points[i] = points[i - 1];
    }
  }
  forEachCell(env, rule.cellrange, (r, c, cell) => {
    const v = numericValue(cell);
    if (v === null) return;
    let color: string;
    if (v <= points[0]) color = stops[0].color;
    else if (v >= points[last]) color = stops[last].color;
    else {
      let i = 0;
      while (i < last - 1 && v > points[i + 1]) i += 1;
      const span = points[i + 1] - points[i];
      const t = span === 0 ? 1 : (v - points[i]) / span;
      color = mixCFColors(stops[i].color, stops[i + 1].color, t);
    }
    emit(r, c, { cellColor: color });
  });
}

function evalIconSet(env: EvalEnv, rule: CFRule, emit: Emit) {
  const set = rule.iconSet!;
  if (!CF_ICON_SETS[set.name]) return;
  const n = iconSetSize(set.name);
  const stats = makeStats(collectNumbers(env, rule.cellrange));
  if (stats.values.length === 0) return;
  const bounds = set.thresholds
    .slice(0, n - 1)
    .map((t) => resolveValue(env, t, stats, rule.cellrange, "min"));
  forEachCell(env, rule.cellrange, (r, c, cell) => {
    const v = numericValue(cell);
    if (v === null) return;
    let index = 0;
    for (let k = 0; k < bounds.length; k += 1) {
      const gte = set.thresholds[k]?.gte !== false;
      const cmp = compareCFValues(v, bounds[k]);
      if (gte ? cmp >= 0 : cmp > 0) index = k + 1;
    }
    if (set.reverse) index = n - 1 - index;
    emit(r, c, {
      icon: { set: set.name, index },
      hideValue: set.showValue === false ? true : undefined,
    });
  });
}

function styleOf(format: any): CFCellResult {
  const out: CFCellResult = {};
  if (!format || Array.isArray(format)) return out;
  const f = format as CFStyle;
  (
    [
      "textColor",
      "cellColor",
      "bold",
      "italic",
      "strikethrough",
      "underline",
      "borderColor",
      "numberFormat",
    ] as const
  ).forEach((k) => {
    const v = f[k];
    if (!_.isNil(v) && v !== "" && v !== false) (out as any)[k] = v;
  });
  return out;
}

function evalHighlight(env: EvalEnv, rule: CFRule, emit: Emit) {
  const name = rule.conditionName;
  const ranges = rule.cellrange;
  const style = styleOf(rule.format);
  const values = rule.conditionValue ?? [];
  const tl = topLeft(ranges);
  const mark = (r: number, c: number) => emit(r, c, style);

  // operand i for cell (r, c): formulas shift relative to the top-left cell
  const memo = new Map<string, any>();
  const operandTemplates = values.map((raw) =>
    typeof raw === "string" && raw.trim().startsWith("=")
      ? compileCFFormula(raw.trim().substring(1))
      : null
  );
  const evalShifted = (
    tpl: ReturnType<typeof compileCFFormula>,
    r: number,
    c: number
  ) => {
    const text =
      tpl.relative || tpl.positional
        ? shiftCFFormula(tpl, r - tl.r, c - tl.c)
        : shiftCFFormula(tpl, 0, 0);
    const key = tpl.positional ? `${r}_${c}|${text}` : text;
    if (memo.has(key)) return memo.get(key);
    const v = evaluateCFFormula(env.ctx, `=${text}`, r, c, env.sheetId);
    memo.set(key, v);
    return v;
  };
  const operand = (i: number, r: number, c: number) => {
    const tpl = operandTemplates[i];
    if (tpl) return toOperand(evalShifted(tpl, r, c));
    return toOperand(values[i]);
  };

  switch (name) {
    case "greaterThan":
    case "lessThan":
    case "greaterThanOrEqual":
    case "lessThanOrEqual":
    case "equal":
    case "notEqual":
    case "between":
    case "notBetween": {
      forEachCell(env, ranges, (r, c, cell) => {
        let v = cfCellValue(cell);
        if (isCFError(v)) return;
        const a = operand(0, r, c);
        if (isCFError(a)) return;
        if (isBlankValue(v)) v = typeof a === "string" ? "" : 0;
        let ok = false;
        if (name === "between" || name === "notBetween") {
          const b = operand(1, r, c);
          if (isCFError(b)) return;
          const lo = compareCFValues(a, b) <= 0 ? a : b;
          const hi = lo === a ? b : a;
          const inside =
            compareCFValues(v, lo) >= 0 && compareCFValues(v, hi) <= 0;
          ok = name === "between" ? inside : !inside;
        } else {
          const cmp = compareCFValues(v, a);
          ok =
            (name === "greaterThan" && cmp > 0) ||
            (name === "lessThan" && cmp < 0) ||
            (name === "greaterThanOrEqual" && cmp >= 0) ||
            (name === "lessThanOrEqual" && cmp <= 0) ||
            (name === "equal" && cmp === 0) ||
            (name === "notEqual" && cmp !== 0);
        }
        if (ok) mark(r, c);
      });
      break;
    }
    case "textContains":
    case "textNotContains":
    case "textBeginsWith":
    case "textEndsWith": {
      forEachCell(env, ranges, (r, c, cell) => {
        const v = cfCellValue(cell);
        if (isCFError(v)) return;
        const text = _.isNil(v) ? "" : `${v}`.toLowerCase();
        const raw = operandTemplates[0]
          ? evalShifted(operandTemplates[0], r, c)
          : values[0];
        const needle = _.isNil(raw) ? "" : `${raw}`.toLowerCase();
        let ok: boolean;
        if (name === "textContains") ok = text !== "" && text.includes(needle);
        else if (name === "textNotContains")
          ok = !text.includes(needle) || text === "";
        else if (name === "textBeginsWith")
          ok = text !== "" && text.startsWith(needle);
        else ok = text !== "" && text.endsWith(needle);
        if (ok) mark(r, c);
      });
      break;
    }
    case "occurrenceDate": {
      const period = cfDatePeriod(`${values[0] ?? ""}`, env.today);
      if (!period) break;
      forEachCell(env, ranges, (r, c, cell) => {
        const v = numericValue(cell);
        if (v === null) return;
        const day = Math.floor(v);
        if (day >= period[0] && day <= period[1]) mark(r, c);
      });
      break;
    }
    case "blanks":
    case "noBlanks":
      forEachCell(env, ranges, (r, c, cell) => {
        const blank = isBlankValue(cfCellValue(cell));
        if (blank === (name === "blanks")) mark(r, c);
      });
      break;
    case "errors":
    case "noErrors":
      forEachCell(env, ranges, (r, c, cell) => {
        const err = isCFError(cfCellValue(cell));
        if (err === (name === "errors")) mark(r, c);
      });
      break;
    case "duplicateValue": {
      const unique = `${values[0] ?? "0"}` === "1";
      const counts = new Map<string, number>();
      const keys: [number, number, string][] = [];
      forEachCell(env, ranges, (r, c, cell) => {
        const v = cfCellValue(cell);
        if (isBlankValue(v)) return;
        let key = `s${`${v}`.toLowerCase()}`;
        if (typeof v === "number") key = `n${v}`;
        else if (typeof v === "boolean") key = `b${v}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        keys.push([r, c, key]);
      });
      keys.forEach(([r, c, key]) => {
        const n = counts.get(key)!;
        if (unique ? n === 1 : n > 1) mark(r, c);
      });
      break;
    }
    case "top10":
    case "top10_percent":
    case "last10":
    case "last10_percent": {
      const nums = collectNumbers(env, ranges).sort((a, b) => b - a);
      if (nums.length === 0) break;
      let count = Math.floor(Number(values[0] ?? 10));
      if (!(count > 0)) break;
      if (name.endsWith("_percent")) {
        count = Math.max(1, Math.floor((nums.length * count) / 100));
      }
      count = Math.min(count, nums.length);
      const top = name.startsWith("top");
      const threshold = top ? nums[count - 1] : nums[nums.length - count];
      forEachCell(env, ranges, (r, c, cell) => {
        const v = numericValue(cell);
        if (v === null) return;
        if (top ? v >= threshold : v <= threshold) mark(r, c);
      });
      break;
    }
    case "aboveAverage":
    case "belowAverage": {
      const nums = collectNumbers(env, ranges);
      if (nums.length === 0) break;
      const avg = nums.reduce((s, x) => s + x, 0) / nums.length;
      let bound = avg;
      const k = Number(rule.stdDev ?? 0);
      if (k > 0) {
        const variance =
          nums.length > 1
            ? nums.reduce((s, x) => s + (x - avg) ** 2, 0) / (nums.length - 1)
            : 0;
        const sd = Math.sqrt(variance);
        bound = name === "aboveAverage" ? avg + k * sd : avg - k * sd;
      }
      const equal = !!rule.equalAverage && !(k > 0);
      forEachCell(env, ranges, (r, c, cell) => {
        const v = numericValue(cell);
        if (v === null) return;
        const cmp = compareCFValues(v, bound);
        const ok =
          name === "aboveAverage"
            ? cmp > 0 || (equal && cmp === 0)
            : cmp < 0 || (equal && cmp === 0);
        if (ok) mark(r, c);
      });
      break;
    }
    case "formula": {
      let f = `${values[0] ?? ""}`.trim();
      if (f.startsWith("=")) f = f.substring(1);
      if (!f) break;
      const tpl = compileCFFormula(f);
      forEachCell(env, ranges, (r, c) => {
        if (isCFTruthy(evalShifted(tpl, r, c))) mark(r, c);
      });
      break;
    }
    default:
      break;
  }
}

/** Evaluate `rules` (ascending priority) against a sheet's cells. */
export function computeCFRules(
  ctx: Context,
  rules: CFRule[] | null | undefined,
  data: CellMatrix | null | undefined,
  sheetId: string = ctx.currentSheetId
): CFComputeMap {
  const map: CFComputeMap = {};
  const list = peek(rules);
  const matrix = peek(data);
  if (!list || list.length === 0 || !matrix) return map;
  let cols = 0;
  for (let r = 0; r < Math.min(matrix.length, 5); r += 1) {
    cols = Math.max(cols, peek(matrix[r])?.length ?? 0);
  }
  const env: EvalEnv = {
    ctx,
    sheetId,
    data: matrix,
    rows: matrix.length,
    cols,
    today: cfToday(),
  };
  const stopped = new Set<string>();
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const rule = normalizeRule(peek(list[i]));
    if (!rule || !Array.isArray(rule.cellrange)) continue;
    const stop = !!rule.stopIfTrue;
    const emit: Emit = (r, c, patch) => {
      const key = `${r}_${c}`;
      if (stopped.has(key)) return false;
      let res = map[key];
      if (!res) {
        res = {};
        map[key] = res;
      }
      const keys = Object.keys(patch) as (keyof CFCellResult)[];
      for (let k = 0; k < keys.length; k += 1) {
        const prop = keys[k];
        const value = patch[prop];
        if (value !== undefined && res[prop] === undefined) {
          (res as any)[prop] = value;
        }
      }
      if (stop) stopped.add(key);
      return true;
    };
    try {
      if (rule.type === "dataBar" && rule.dataBar) evalDataBar(env, rule, emit);
      else if (rule.type === "colorGradation" && rule.colorScale)
        evalColorScale(env, rule, emit);
      else if (rule.type === "icons" && rule.iconSet)
        evalIconSet(env, rule, emit);
      else if (rule.type === "default" || rule.conditionName)
        evalHighlight(env, rule, emit);
    } catch (e) {
      // a broken rule must never break painting
    }
  }
  return map;
}

/** Evaluate the rules of a sheet (default: the current sheet), uncached. */
export function computeCFMap(ctx: Context, sheetId?: string): CFComputeMap {
  const id = sheetId ?? ctx.currentSheetId;
  const sheet = peekSheet(ctx, id);
  if (!sheet) return {};
  return computeCFRules(
    ctx,
    sheet.luckysheet_conditionformat_save as CFRule[],
    sheet.data as CellMatrix,
    id
  );
}

interface CacheEntry {
  sheetId: string;
  fingerprint: any[];
  map: CFComputeMap;
}

const cache = new WeakMap<object, CacheEntry>();

/**
 * All sheets' cell matrices plus today's date, or null when some matrix may
 * still change in place (plain objects or immer drafts are not frozen).
 */
function fingerprintOf(ctx: Context): any[] | null {
  const files = peek(peek(ctx).luckysheetfile);
  if (!files) return null;
  const out: any[] = [cfToday()];
  for (let i = 0; i < files.length; i += 1) {
    const data = peek(peek(files[i])?.data);
    if (data && !Object.isFrozen(data)) return null;
    out.push(data);
  }
  return out;
}

/**
 * The conditional-formatting map of a sheet, cached per recalculation: it is
 * recomputed only when the rules, any sheet's cells or the date change.
 */
export function getCFComputeMap(ctx: Context, sheetId?: string): CFComputeMap {
  const id = sheetId ?? ctx.currentSheetId;
  const sheet = peekSheet(ctx, id);
  const rules = peek(sheet?.luckysheet_conditionformat_save);
  if (!sheet || !rules || rules.length === 0) return {};
  const fingerprint = Object.isFrozen(rules) ? fingerprintOf(ctx) : null;
  if (fingerprint) {
    const hit = cache.get(rules);
    if (
      hit &&
      hit.sheetId === id &&
      hit.fingerprint.length === fingerprint.length &&
      hit.fingerprint.every((x, i) => x === fingerprint[i])
    ) {
      return hit.map;
    }
  }
  const map = computeCFRules(ctx, rules, sheet.data as CellMatrix, id);
  if (fingerprint) cache.set(rules, { sheetId: id, fingerprint, map });
  return map;
}
