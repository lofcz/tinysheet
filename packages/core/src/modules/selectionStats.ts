/**
 * Status-bar aggregates for the current selection (Excel's Average, Count,
 * Numerical Count, Min, Max and Sum).
 *
 * Excel semantics followed here:
 * - `count` is COUNTA: every non-empty cell (text, numbers, booleans,
 *   errors, formulas that return "").
 * - Numeric aggregates only look at real numbers (dates are numbers).
 *   Numbers stored as text and booleans are counted but not summed.
 * - Hidden and filtered-out rows are included, like Excel's status bar.
 * - Overlapping ranges of a multi-range selection are counted once per range,
 *   as Excel does.
 * - When the selection contains an error value, only `count` is meaningful;
 *   `hasError` tells the UI to hide the numeric aggregates.
 *
 * Large selections are scanned in chunks (`createSelectionStatsTask`) so the
 * UI can stay responsive and show a "calculating" state.
 */
import { Context, getFlowdata } from "../context";
import { Cell, CellMatrix } from "../types";
import { formatValue } from "./format";

export type StatusBarStatKey =
  | "average"
  | "count"
  | "numericalCount"
  | "min"
  | "max"
  | "sum";

/** Every aggregate the status bar can show, in Excel's display order. */
export const STATUS_BAR_STAT_KEYS: StatusBarStatKey[] = [
  "average",
  "count",
  "numericalCount",
  "min",
  "max",
  "sum",
];

/** Excel's default status-bar aggregates. */
export const DEFAULT_STATUS_BAR_STATS: StatusBarStatKey[] = [
  "average",
  "count",
  "sum",
];

export type SelectionStats = {
  /** Non-empty cells (COUNTA). */
  count: number;
  /** Cells holding a number (COUNT). */
  numericalCount: number;
  sum: number;
  min: number | null;
  max: number | null;
  average: number | null;
  /** Whether an error value (`#N/A`, `#DIV/0!`, ...) was found. */
  hasError: boolean;
};

export type StatsRange = { row: number[]; column: number[] };

const ERROR_VALUES = new Set([
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
]);

type CellKind = "empty" | "number" | "error" | "other";

function classify(cell: Cell | null | undefined): [CellKind, number] {
  if (cell == null) return ["empty", 0];
  const { v } = cell;
  const t = cell.ct?.t;
  if (v == null || v === "") {
    // inline (rich text) strings keep their text in ct.s
    if (t === "inlineStr" && cell.ct?.s?.length) return ["other", 0];
    // a formula returning "" is not blank for COUNTA
    if (cell.f) return ["other", 0];
    return ["empty", 0];
  }
  if (typeof v === "number") {
    if (t === "s" || !Number.isFinite(v)) return ["other", 0];
    return ["number", v];
  }
  if (typeof v === "boolean") return ["other", 0];
  if (typeof v === "string") {
    if (ERROR_VALUES.has(v) && t !== "s") return ["error", 0];
    if (t === "n" || t === "d") {
      const n = Number(v);
      if (v.trim() !== "" && Number.isFinite(n)) return ["number", n];
    }
  }
  return ["other", 0];
}

export function emptySelectionStats(): SelectionStats {
  return {
    count: 0,
    numericalCount: 0,
    sum: 0,
    min: null,
    max: null,
    average: null,
    hasError: false,
  };
}

export type SelectionStatsTask = {
  /**
   * Scan at most `budget` cells. Returns true when the whole selection has
   * been scanned.
   */
  step: (budget: number) => boolean;
  /** Aggregates of the cells scanned so far (final once `done`). */
  result: () => SelectionStats;
  done: () => boolean;
};

/**
 * An incremental scanner over `ranges` of `data`. Only stored cells are
 * visited, so a whole-column selection costs as much as the used range.
 */
export function createSelectionStatsTask(
  data: CellMatrix | null | undefined,
  ranges: StatsRange[] | null | undefined
): SelectionStatsTask {
  const stats = emptySelectionStats();
  const list = (ranges || []).filter(
    (r) => r?.row?.length >= 2 && r?.column?.length >= 2
  );
  let rangeIndex = 0;
  let r = -1;
  let finished = !data || list.length === 0;

  const startRange = () => {
    while (rangeIndex < list.length) {
      const range = list[rangeIndex];
      const r1 = Math.max(0, Math.min(range.row[0], range.row[1]));
      if (r1 < data!.length) {
        r = r1;
        return true;
      }
      rangeIndex += 1;
    }
    finished = true;
    return false;
  };
  if (!finished) startRange();

  const step = (budget: number) => {
    if (finished) return true;
    let visited = 0;
    while (!finished && visited < budget) {
      const range = list[rangeIndex];
      const r2 = Math.min(
        Math.max(range.row[0], range.row[1]),
        data!.length - 1
      );
      const c1 = Math.max(0, Math.min(range.column[0], range.column[1]));
      const c2 = Math.max(range.column[0], range.column[1]);
      while (r <= r2 && visited < budget) {
        const row = data![r];
        if (row) {
          const end = Math.min(c2, row.length - 1);
          for (let c = c1; c <= end; c += 1) {
            const [kind, n] = classify(row[c]);
            if (kind === "empty") continue;
            stats.count += 1;
            if (kind === "number") {
              stats.numericalCount += 1;
              stats.sum += n;
              if (stats.min == null || n < stats.min) stats.min = n;
              if (stats.max == null || n > stats.max) stats.max = n;
            } else if (kind === "error") {
              stats.hasError = true;
            }
          }
          visited += Math.max(1, end - c1 + 1);
        } else {
          visited += 1;
        }
        r += 1;
      }
      if (r > r2) {
        rangeIndex += 1;
        startRange();
      }
    }
    return finished;
  };

  return {
    step,
    done: () => finished,
    result: () => ({
      ...stats,
      average:
        stats.numericalCount > 0 ? stats.sum / stats.numericalCount : null,
    }),
  };
}

/** Scan the whole selection synchronously. */
export function computeSelectionStats(
  data: CellMatrix | null | undefined,
  ranges: StatsRange[] | null | undefined
): SelectionStats {
  const task = createSelectionStatsTask(data, ranges);
  task.step(Infinity);
  return task.result();
}

/** Aggregates for `ctx.luckysheet_select_save` on the current sheet. */
export function getSelectionStats(ctx: Context): SelectionStats {
  return computeSelectionStats(getFlowdata(ctx), ctx.luckysheet_select_save);
}

/**
 * Which aggregates Excel would show for `stats`: nothing for fewer than two
 * non-empty cells, only the count when the selection holds an error or no
 * number.
 */
export function visibleSelectionStats(
  stats: SelectionStats,
  enabled: StatusBarStatKey[]
): StatusBarStatKey[] {
  if (stats.count < 2) return [];
  return STATUS_BAR_STAT_KEYS.filter((key) => {
    if (!enabled.includes(key)) return false;
    if (key === "count") return true;
    if (stats.hasError) return false;
    if (key === "numericalCount") return true;
    return stats.numericalCount > 0;
  });
}

/**
 * Display text of one aggregate. Counts are plain integers; the other values
 * use the number format of the active cell (General when it has none or is
 * text), as Excel does.
 */
export function formatSelectionStat(
  key: StatusBarStatKey,
  stats: SelectionStats,
  numberFormat?: string | null
): string {
  if (key === "count") return String(stats.count);
  if (key === "numericalCount") return String(stats.numericalCount);
  const value = key === "sum" ? stats.sum : stats[key];
  if (value == null) return "";
  const fmt =
    !numberFormat || numberFormat === "@" || numberFormat === "General"
      ? "General"
      : numberFormat;
  const text = formatValue(fmt, value);
  // formats that can't show the value (e.g. a date format and a negative
  // number) fall back to General
  if (!text || /^#+$/.test(text)) return formatValue("General", value);
  return text;
}

/** Number format of the active (focus) cell of the selection. */
export function getActiveCellNumberFormat(ctx: Context): string | undefined {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return undefined;
  const r = sel.row_focus ?? sel.row?.[0];
  const c = sel.column_focus ?? sel.column?.[0];
  if (r == null || c == null) return undefined;
  return getFlowdata(ctx)?.[r]?.[c]?.ct?.fa;
}
