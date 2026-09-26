/**
 * Chart objects: `sheet.charts[]` holds live charts whose series reference
 * cell ranges. Everything here mutates the (immer draft) context, so the
 * React layer gets undo/redo and collaboration ops for free: chart state lives
 * under `luckysheetfile`, which is what the history records.
 *
 * Rendering is delegated to the pure SVG renderer in `./chartRender`.
 */
import type { Context } from "../context";
import type { ChartShape } from "./chartShapes";
import { checkProtection } from "./protection";
import type { Cell, CellMatrix, Sheet } from "../types";
import { getSheetIndex, indexToColumnChar } from "../utils";
import { chartLocales } from "../locale/chart";
import { locateRangeForChange, ReferenceChange } from "./refAdjust";
import {
  adjustChartPlacements,
  ChartAnchor,
  ChartBox,
  ChartPlacement,
  getChartBox,
  setChartBox,
} from "./chartAnchor";
import {
  getChartStyle,
  getChartTheme,
  paletteColor,
  renderChartSvg,
  ChartDataLabelOptions,
  ChartErrorBars,
  ChartFormats,
  ChartGrouping,
  ChartHistogramBinning,
  ChartLegendPosition,
  ChartRadarStyle,
  ChartRenderModel,
  ChartRenderSeries,
  ChartSeriesType,
  ChartStockVariant,
  ChartTheme,
  ChartTrendline,
  ChartType,
  ChartValueAxisOptions,
  ChartAxisNumberFormat,
  ChartEffects,
  formatWithCode,
} from "./chartRender";

export * from "./chartAnchor";

/** A rectangular cell range on one sheet (0-based, inclusive). */
export type ChartRangeArea = {
  sheetId: string;
  row: [number, number];
  column: [number, number];
};

/**
 * A chart reference: one rectangle, or a union of several (Excel's
 * non-contiguous references, `(Sheet1!$B$2:$B$3,Sheet1!$B$5)`), whose
 * first area is the range itself and the others follow in `areas`.
 */
export type ChartRange = ChartRangeArea & {
  /** Further areas of a union reference, in order. */
  areas?: ChartRangeArea[];
};

/** Every area of a (possibly union) reference, in order. */
export function chartRangeAreas(
  range: ChartRange | null | undefined
): ChartRangeArea[] {
  if (!range) return [];
  const first: ChartRangeArea = {
    sheetId: range.sheetId,
    row: range.row,
    column: range.column,
  };
  return range.areas?.length ? [first, ...range.areas] : [first];
}

/** A reference made of `areas` (null when there is none). */
export function chartRangeFromAreas(
  areas: ChartRangeArea[]
): ChartRange | null {
  if (areas.length === 0) return null;
  const [first, ...rest] = areas;
  const out: ChartRange = {
    sheetId: first.sheetId,
    row: [first.row[0], first.row[1]],
    column: [first.column[0], first.column[1]],
  };
  if (rest.length) {
    out.areas = rest.map((a) => ({
      sheetId: a.sheetId,
      row: [a.row[0], a.row[1]] as [number, number],
      column: [a.column[0], a.column[1]] as [number, number],
    }));
  }
  return out;
}

/** Number of cells of a reference (all its areas). */
export function chartRangeSize(range: ChartRange | null | undefined) {
  return chartRangeAreas(range).reduce(
    (n, a) => n + (a.row[1] - a.row[0] + 1) * (a.column[1] - a.column[0] + 1),
    0
  );
}

export type ChartSeries = {
  /** Literal series name; wins over `nameRef`. */
  name?: string;
  /** Cell holding the series name. */
  nameRef?: ChartRange | null;
  /** Y values. `null` means the reference was deleted (#REF!). */
  values: ChartRange | null;
  /** Category labels (X values for scatter charts). */
  categories?: ChartRange | null;
  /** Explicit series colour; defaults to the Office palette by index. */
  color?: string;
  /** Outline of bars / slices / areas (Format › Shape Outline); null: none. */
  outline?: string | null;
  /** Format › Shape Effects › Shadow (old form; see `effects`). */
  shadow?: boolean;
  /** Format › Shape Effects: shadow, glow, soft edges, bevel, 3-D. */
  effects?: ChartEffects;
  /**
   * Hidden by the Chart Filters (or an unchecked Legend Entry in Select
   * Data): kept with its references, not plotted.
   */
  filtered?: boolean;
  /** Explicit per-point colours (pie slices, varied columns). */
  pointColors?: string[];
  /**
   * Per-point outlines (a formatted data point's Shape Outline), by point
   * index; null: no outline (`<a:ln><a:noFill/>`).
   */
  pointOutlines?: Record<number, string | null>;
  /** Combo charts: column, line or area (default column). */
  type?: ChartSeriesType;
  /** Plot on the secondary value axis (combo, column, line, area). */
  secondary?: boolean;
  /** Bubble charts: bubble sizes. */
  sizes?: ChartRange | null;
  trendlines?: ChartTrendline[];
  errorBars?: ChartErrorBars & {
    /** Custom error amounts. */
    plus?: ChartRange | null;
    minus?: ChartRange | null;
  };
  /**
   * Values cached from an imported file, used when a reference cannot be
   * resolved (external workbooks, unsupported reference syntax).
   */
  cache?: {
    name?: string;
    values?: (number | null)[];
    categories?: string[];
    sizes?: (number | null)[];
  };
};

export type Chart = {
  id: string;
  type: ChartType;
  grouping?: ChartGrouping;
  /** Secondary value axis (series with `secondary`). */
  secondaryValueAxis?: ChartValueAxisOptions;
  secondaryValueAxisTitle?: string;
  /** What data labels show, where, and their number format. */
  dataLabelOptions?: ChartDataLabelOptions;
  /** Histogram / Pareto bins. */
  binning?: ChartHistogramBinning;
  radarStyle?: ChartRadarStyle;
  stockVariant?: ChartStockVariant;
  /** Waterfall: points shown as totals ("Set as total"). */
  waterfallTotals?: number[];
  /** Waterfall connector lines (default true). */
  waterfallConnectors?: boolean;
  /** Bubble size scale in % (default 100). */
  bubbleScale?: number;
  /** Chart style from the style gallery (1–8, default 1). */
  style?: number;
  /** Colour palette id (`colorful1`, `monochrome2`, ...). */
  palette?: string;
  /** Move and size with cells (default), move only, or neither. */
  placement?: ChartPlacement;
  /** Cell anchor of the chart's corners (see chartAnchor.ts). */
  anchor?: ChartAnchor;
  /** Range the chart was created from (used by "Switch row/column"). */
  source?: ChartRange | null;
  /** Series were read from rows of `source` instead of columns. */
  seriesInRows?: boolean;
  series: ChartSeries[];
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  legend?: ChartLegendPosition;
  dataLabels?: boolean;
  gridlines?: boolean;
  markers?: boolean;
  scatterLines?: boolean;
  varyColors?: boolean;
  valueAxis?: ChartValueAxisOptions;
  /**
   * Format Axis › Number of the category (horizontal / X) axis; linked to
   * the category cells' formats by default.
   */
  categoryAxisFormat?: ChartAxisNumberFormat;
  /** Chart Title › Centered Overlay: the title does not shrink the plot. */
  titleOverlay?: boolean;
  /** Add Chart Element › Axes: `false` hides an axis (c:delete). */
  axes?: { category?: boolean; value?: boolean };
  /** Major gridlines of the category axis (vertical in a column chart). */
  categoryGridlines?: boolean;
  /** Minor gridlines of the value / category axis. */
  minorGridlines?: boolean;
  minorCategoryGridlines?: boolean;
  /** Data table under the plot area (c:dTable). */
  dataTable?: { legendKeys?: boolean } | null;
  /** Line and area charts: drop lines; line charts: high-low lines. */
  dropLines?: boolean;
  hiLowLines?: boolean;
  /** Line charts with two or more series: up / down bars. */
  upDownBars?: boolean;
  /**
   * Hidden and Empty Cell Settings: empty cells as gaps (default), zero or
   * connected with a line (c:dispBlanksAs).
   */
  displayBlanksAs?: "gap" | "zero" | "span";
  /** Plot only visible cells (default true; c:plotVisOnly). */
  plotVisibleOnly?: boolean;
  /** Show #N/A as an empty cell (default false; c16r3:dispNaAsBlank). */
  displayNaAsBlank?: boolean;
  /** Chart Filters: indices of the categories that are not plotted. */
  hiddenCategories?: number[];
  /** Format tab: fill / outline / text of the chart's elements. */
  formats?: ChartFormats;
  /** Format › Insert Shapes: shapes drawn in the chart (chartShapes.ts). */
  shapes?: ChartShape[];
  /** Arrange › Group: the group (charts and shapes) it belongs to. */
  group?: string;
  /** The group it was ungrouped from (Arrange › Group › Regroup). */
  ungroupedFrom?: string;
  /** Position and size in sheet pixels at 100% zoom. */
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Excel's default chart size (5 in x 3 in). */
export const DEFAULT_CHART_WIDTH = 480;
export const DEFAULT_CHART_HEIGHT = 288;
export const MIN_CHART_WIDTH = 80;
export const MIN_CHART_HEIGHT = 60;

export const CHART_TYPES: ChartType[] = [
  "column",
  "bar",
  "line",
  "area",
  "pie",
  "doughnut",
  "scatter",
  "combo",
  "radar",
  "bubble",
  "waterfall",
  "histogram",
  "pareto",
  "funnel",
  "stock",
];

/** Types whose series can be clustered / stacked. */
export function chartHasGrouping(type: ChartType) {
  return (
    type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area" ||
    type === "combo"
  );
}

/** Types drawn with a category or value axis (not pie-like). */
export function chartHasAxes(type: ChartType) {
  return type !== "pie" && type !== "doughnut" && type !== "funnel";
}

/** Types whose series may carry trendlines and error bars. */
export function chartSupportsTrendlines(type: ChartType) {
  return (
    type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area" ||
    type === "combo" ||
    type === "scatter" ||
    type === "bubble"
  );
}

/** Types where series can be moved to a secondary axis. */
export function chartSupportsSecondaryAxis(type: ChartType) {
  return (
    type === "combo" || type === "column" || type === "line" || type === "area"
  );
}

/** Types that read X values from the first column (scatter, bubble). */
function isXYType(type: ChartType | undefined) {
  return type === "scatter" || type === "bubble";
}

let chartIdSeed = 0;
export function generateChartId() {
  chartIdSeed += 1;
  return `chart_${Date.now().toString(36)}_${chartIdSeed}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Range text <-> ChartRange
// ---------------------------------------------------------------------------

function quoteSheetName(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) &&
    !/^[A-Za-z]{1,3}\d+$/.test(name)
    ? name
    : `'${name.replace(/'/g, "''")}'`;
}

function colIndex(letters: string) {
  let out = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i += 1) {
    out = out * 26 + (up.charCodeAt(i) - 64);
  }
  return out - 1;
}

function sheetDims(sheet: Sheet | undefined) {
  const rows = sheet?.data?.length ?? sheet?.row ?? 1000;
  const cols = sheet?.data?.[0]?.length ?? sheet?.column ?? 100;
  return { rows, cols };
}

/**
 * Split `a,b,(c,d)` at top-level commas (not inside quotes, parentheses,
 * braces or strings).
 */
export function splitChartArgs(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) {
        if (text[i + 1] === quote) i += 1;
        else quote = null;
      }
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "}") depth -= 1;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((p) => p.trim());
}

/** `(x)` without its enclosing parentheses (only when they pair up). */
export function stripChartParens(text: string) {
  let t = text.trim();
  while (t.startsWith("(") && t.endsWith(")")) {
    let depth = 0;
    let quote: string | null = null;
    let wraps = true;
    for (let i = 0; i < t.length; i += 1) {
      const ch = t[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === "'" || ch === '"') quote = ch;
      else if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0 && i < t.length - 1) {
          wraps = false;
          break;
        }
      }
    }
    if (!wraps) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Parse `Sheet1!$A$1:$B$4`, `'My sheet'!A1`, `A1:B4`, `A:B` or `1:3` into a
 * range, and unions of them (`(Sheet1!$B$2:$B$3,Sheet1!$B$5)`, Excel's
 * non-contiguous references). Returns null for anything else (external
 * references, names).
 */
export function parseChartRange(
  ctx: Pick<Context, "luckysheetfile">,
  text: string,
  defaultSheetId: string
): ChartRange | null {
  if (text == null) return null;
  let t = String(text).trim();
  if (t.startsWith("=")) t = t.slice(1).trim();
  t = stripChartParens(t);
  if (!t) return null;
  const parts = splitChartArgs(t);
  if (parts.length > 1) {
    const areas: ChartRangeArea[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const area = parseChartRangeArea(
        ctx,
        stripChartParens(parts[i]),
        defaultSheetId
      );
      if (!area) return null;
      areas.push(area);
    }
    return chartRangeFromAreas(areas);
  }
  return parseChartRangeArea(ctx, t, defaultSheetId);
}

function parseChartRangeArea(
  ctx: Pick<Context, "luckysheetfile">,
  text: string,
  defaultSheetId: string
): ChartRange | null {
  let t = text;
  if (!t) return null;
  let sheetId = defaultSheetId;
  const bang = t.lastIndexOf("!");
  if (bang >= 0) {
    let name = t.slice(0, bang).trim();
    if (name.startsWith("'") && name.endsWith("'")) {
      name = name.slice(1, -1).replace(/''/g, "'");
    }
    const sheet = ctx.luckysheetfile.find((s) => s.name === name);
    if (!sheet?.id) return null;
    sheetId = sheet.id;
    t = t.slice(bang + 1).trim();
  }
  const sheet = ctx.luckysheetfile.find((s) => s.id === sheetId);
  const { rows, cols } = sheetDims(sheet);
  const cell = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;
  const colOnly = /^\$?([A-Za-z]{1,3})$/;
  const rowOnly = /^\$?(\d+)$/;
  const parts = t.split(":");
  if (parts.length > 2) return null;
  const [a, b = parts[0]] = parts;
  let m1 = a.match(cell);
  let m2 = b.match(cell);
  if (m1 && m2) {
    const r1 = parseInt(m1[2], 10) - 1;
    const r2 = parseInt(m2[2], 10) - 1;
    const c1 = colIndex(m1[1]);
    const c2 = colIndex(m2[1]);
    if (r1 < 0 || r2 < 0) return null;
    return {
      sheetId,
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  if (parts.length === 2) {
    m1 = a.match(colOnly);
    m2 = b.match(colOnly);
    if (m1 && m2) {
      const c1 = colIndex(m1[1]);
      const c2 = colIndex(m2[1]);
      return {
        sheetId,
        row: [0, Math.max(0, rows - 1)],
        column: [Math.min(c1, c2), Math.max(c1, c2)],
      };
    }
    m1 = a.match(rowOnly);
    m2 = b.match(rowOnly);
    if (m1 && m2) {
      const r1 = parseInt(m1[1], 10) - 1;
      const r2 = parseInt(m2[1], 10) - 1;
      if (r1 < 0 || r2 < 0) return null;
      return {
        sheetId,
        row: [Math.min(r1, r2), Math.max(r1, r2)],
        column: [0, Math.max(0, cols - 1)],
      };
    }
  }
  return null;
}

/**
 * `Sheet1!$A$1:$B$4` (absolute, sheet-qualified, as Excel writes it); a
 * union as `(Sheet1!$B$2:$B$3,Sheet1!$B$5)`.
 */
export function chartRangeToText(
  ctx: Pick<Context, "luckysheetfile">,
  range: ChartRange | null | undefined,
  options: { absolute?: boolean; sheet?: boolean } = {}
): string {
  if (!range) return "#REF!";
  if (range.areas?.length) {
    return `(${chartRangeAreas(range)
      .map((a) => chartRangeToText(ctx, a, options))
      .join(",")})`;
  }
  const abs = options.absolute !== false ? "$" : "";
  const sheet = ctx.luckysheetfile.find((s) => s.id === range.sheetId);
  const a = `${abs}${indexToColumnChar(range.column[0])}${abs}${
    range.row[0] + 1
  }`;
  const b = `${abs}${indexToColumnChar(range.column[1])}${abs}${
    range.row[1] + 1
  }`;
  const ref = a === b ? a : `${a}:${b}`;
  if (options.sheet === false || !sheet) return ref;
  return `${quoteSheetName(sheet.name)}!${ref}`;
}

// ---------------------------------------------------------------------------
// Cell reading
// ---------------------------------------------------------------------------

export type ChartCell = {
  display: string;
  numeric: number | null;
  /** Non-empty and not a number (text, boolean, error). */
  text: boolean;
  /** Date-formatted number (treated as a label for header detection). */
  date: boolean;
  /** Number format code of a numeric cell (absent: General). */
  format?: string;
};

const EMPTY_CELL: ChartCell = {
  display: "",
  numeric: null,
  text: false,
  date: false,
};

function isDateFormat(cell: Cell) {
  if (cell.ct?.t === "d") return true;
  const fa = cell.ct?.fa;
  if (!fa || fa === "General" || fa === "@") return false;
  const cleaned = fa.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
  return /[dy]/i.test(cleaned) || /h+:m/i.test(cleaned);
}

export function readChartCell(cell: Cell | null | undefined): ChartCell {
  if (cell == null) return EMPTY_CELL;
  let { v } = cell;
  if (v == null && cell.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    v = cell.ct.s.map((s: any) => s?.v ?? "").join("");
  }
  if (v == null || v === "") return EMPTY_CELL;
  const display = cell.m != null && cell.m !== "" ? String(cell.m) : String(v);
  const fa = cell.ct?.fa;
  const format = fa && fa !== "General" ? { format: fa } : {};
  if (typeof v === "number") {
    return {
      display,
      numeric: Number.isFinite(v) ? v : null,
      text: false,
      date: isDateFormat(cell),
      ...format,
    };
  }
  if (typeof v === "boolean") {
    return { display, numeric: null, text: true, date: false };
  }
  if (cell.ct?.t === "n" || cell.ct?.t === "d") {
    const parsed = Number(v);
    if (v.trim() !== "" && Number.isFinite(parsed)) {
      return {
        display,
        numeric: parsed,
        text: false,
        date: isDateFormat(cell),
        ...format,
      };
    }
  }
  return { display, numeric: null, text: true, date: false };
}

function sheetById(ctx: Pick<Context, "luckysheetfile">, id: string) {
  return ctx.luckysheetfile.find((s) => s.id === id);
}

/** Cells of a range in row-major order (a union: area after area). */
export function readChartRange(
  ctx: Pick<Context, "luckysheetfile">,
  range: ChartRange | null | undefined
): ChartCell[] {
  if (!range) return [];
  if (range.areas?.length) {
    return chartRangeAreas(range).flatMap((a) => readChartRange(ctx, a));
  }
  const data = sheetById(ctx, range.sheetId)?.data;
  const out: ChartCell[] = [];
  const r2 = Math.min(range.row[1], (data?.length ?? 0) - 1);
  for (let r = range.row[0]; r <= r2; r += 1) {
    const row = data?.[r];
    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      out.push(readChartCell(row?.[c]));
    }
  }
  // Rows past the end of the data still count as (blank) points.
  const expected =
    (range.row[1] - range.row[0] + 1) * (range.column[1] - range.column[0] + 1);
  while (out.length < expected && out.length < 100000) out.push(EMPTY_CELL);
  return out;
}

// ---------------------------------------------------------------------------
// Series detection (Excel's "insert chart from selection" rules)
// ---------------------------------------------------------------------------

/**
 * Expand a single cell to its current region (the contiguous block of
 * non-empty cells around it), like Excel does when inserting a chart from one
 * selected cell.
 */
export function getChartSourceRegion(
  data: CellMatrix | undefined,
  row: number,
  column: number
): { row: [number, number]; column: [number, number] } {
  const filled = (r: number, c: number) =>
    readChartCell(data?.[r]?.[c]) !== EMPTY_CELL;
  const b = { r1: row, r2: row, c1: column, c2: column };
  const rows = data?.length ?? 0;
  const cols = data?.[0]?.length ?? 0;
  const rowHas = (r: number) => {
    const last = Math.min(cols - 1, b.c2 + 1);
    for (let c = Math.max(0, b.c1 - 1); c <= last; c += 1)
      if (filled(r, c)) return true;
    return false;
  };
  const colHas = (c: number) => {
    const last = Math.min(rows - 1, b.r2 + 1);
    for (let r = Math.max(0, b.r1 - 1); r <= last; r += 1)
      if (filled(r, c)) return true;
    return false;
  };
  let grown = true;
  let guard = 0;
  while (grown && guard < 10000) {
    grown = false;
    guard += 1;
    if (b.r1 > 0 && rowHas(b.r1 - 1)) {
      b.r1 -= 1;
      grown = true;
    }
    if (b.r2 < rows - 1 && rowHas(b.r2 + 1)) {
      b.r2 += 1;
      grown = true;
    }
    if (b.c1 > 0 && colHas(b.c1 - 1)) {
      b.c1 -= 1;
      grown = true;
    }
    if (b.c2 < cols - 1 && colHas(b.c2 + 1)) {
      b.c2 += 1;
      grown = true;
    }
  }
  return { row: [b.r1, b.r2], column: [b.c1, b.c2] };
}

export type DetectedSeries = {
  series: ChartSeries[];
  seriesInRows: boolean;
  headerRow: boolean;
  headerColumn: boolean;
};

/**
 * Split a block into series the way Excel does:
 * - a first row of labels (text/blank over numbers) holds series names;
 * - a first column of labels (text or dates) holds categories;
 * - an empty top-left cell marks both a header row and a header column;
 * - series run along the longer side (columns when rows >= columns) unless
 *   `seriesInRows` forces an orientation;
 * - scatter charts use the first numeric column (or row) as X values.
 */
export function detectChartSeries(
  ctx: Pick<Context, "luckysheetfile">,
  source: ChartRange,
  options: { type?: ChartType; seriesInRows?: boolean } = {}
): DetectedSeries {
  const data = sheetById(ctx, source.sheetId)?.data;
  const [r1, r2] = source.row;
  const [c1, c2] = source.column;
  const at = (r: number, c: number) => readChartCell(data?.[r]?.[c]);
  const nrows = r2 - r1 + 1;
  const ncols = c2 - c1 + 1;
  const isLabel = (cell: ChartCell) => cell.text || cell.date;
  const topLeftEmpty = at(r1, c1) === EMPTY_CELL;

  let headerColumn = false;
  if (ncols > 1 && nrows === 1) {
    headerColumn = at(r1, c1).text;
  } else if (ncols > 1) {
    let any = false;
    let ok = true;
    for (let r = r1 + 1; r <= r2 && ok; r += 1) {
      const cell = at(r, c1);
      if (cell === EMPTY_CELL) continue;
      if (!isLabel(cell)) ok = false;
      else any = true;
    }
    headerColumn = ok && any;
  }
  let headerRow = false;
  if (nrows > 1) {
    let any = false;
    let ok = true;
    for (let c = c1 + (headerColumn ? 1 : 0); c <= c2 && ok; c += 1) {
      const cell = at(r1, c);
      if (cell === EMPTY_CELL) continue;
      if (!cell.text) ok = false;
      else any = true;
    }
    headerRow = ok && any;
  }
  if (topLeftEmpty && nrows > 1 && ncols > 1) {
    headerRow = true;
    headerColumn = true;
  }

  const dr1 = r1 + (headerRow ? 1 : 0);
  const dc1 = c1 + (headerColumn ? 1 : 0);
  const dataRows = Math.max(0, r2 - dr1 + 1);
  const dataCols = Math.max(0, c2 - dc1 + 1);
  const seriesInRows =
    options.seriesInRows ??
    (options.type !== "bubble" && dataRows < dataCols && dataRows > 0);

  const { sheetId } = source;
  const series: ChartSeries[] = [];
  const scatter = isXYType(options.type);
  // bubble charts take (Y, size) column pairs after the X column
  const step = options.type === "bubble" ? 2 : 1;

  if (!seriesInRows) {
    let categories: ChartRange | null = headerColumn
      ? { sheetId, row: [dr1, r2], column: [c1, c1] }
      : null;
    let first = dc1;
    if (scatter && !headerColumn && dataCols > 1) {
      categories = { sheetId, row: [dr1, r2], column: [dc1, dc1] };
      first = dc1 + 1;
    }
    for (let c = first; c <= c2; c += step) {
      const sizes: ChartRange | null =
        step === 2 && c + 1 <= c2
          ? { sheetId, row: [dr1, r2], column: [c + 1, c + 1] }
          : null;
      series.push({
        values: { sheetId, row: [dr1, r2], column: [c, c] },
        ...(headerRow
          ? { nameRef: { sheetId, row: [r1, r1], column: [c, c] } }
          : { name: `Series${series.length + 1}` }),
        ...(categories ? { categories } : {}),
        ...(sizes ? { sizes } : {}),
      });
    }
  } else {
    let categories: ChartRange | null = headerRow
      ? { sheetId, row: [r1, r1], column: [dc1, c2] }
      : null;
    let first = dr1;
    if (scatter && !headerRow && dataRows > 1) {
      categories = { sheetId, row: [dr1, dr1], column: [dc1, c2] };
      first = dr1 + 1;
    }
    for (let r = first; r <= r2; r += step) {
      const sizes: ChartRange | null =
        step === 2 && r + 1 <= r2
          ? { sheetId, row: [r + 1, r + 1], column: [dc1, c2] }
          : null;
      series.push({
        values: { sheetId, row: [r, r], column: [dc1, c2] },
        ...(headerColumn
          ? { nameRef: { sheetId, row: [r, r], column: [c1, c1] } }
          : { name: `Series${series.length + 1}` }),
        ...(categories ? { categories } : {}),
        ...(sizes ? { sizes } : {}),
      });
    }
  }
  return { series, seriesInRows, headerRow, headerColumn };
}

// ---------------------------------------------------------------------------
// Chart lookup and mutation (all operate on the immer draft)
// ---------------------------------------------------------------------------

export function getSheetCharts(ctx: Context, sheetId?: string): Chart[] {
  const i = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  if (i == null) return [];
  return ctx.luckysheetfile[i].charts ?? [];
}

export function findChart(
  ctx: Pick<Context, "luckysheetfile">,
  id: string | undefined
): { sheet: Sheet; index: number; chart: Chart } | null {
  if (!id) return null;
  for (let s = 0; s < ctx.luckysheetfile.length; s += 1) {
    const sheet = ctx.luckysheetfile[s];
    const { charts } = sheet;
    if (!charts) continue;
    for (let i = 0; i < charts.length; i += 1) {
      if (charts[i].id === id) return { sheet, index: i, chart: charts[i] };
    }
  }
  return null;
}

function rowTop(ctx: Context, r: number) {
  const zoom = ctx.zoomRatio || 1;
  if (r <= 0) return 0;
  const v = ctx.visibledatarow?.[r - 1];
  if (v != null) return v / zoom;
  return r * ((ctx.defaultrowlen || 19) + 1);
}

function colLeft(ctx: Context, c: number) {
  const zoom = ctx.zoomRatio || 1;
  if (c <= 0) return 0;
  const v = ctx.visibledatacolumn?.[c - 1];
  if (v != null) return v / zoom;
  return c * ((ctx.defaultcollen || 73) + 1);
}

/** Top-left corner of a cell in sheet pixels at 100% zoom. */
export function getChartCellPosition(
  ctx: Context,
  row: number,
  column: number
) {
  return { left: colLeft(ctx, column), top: rowTop(ctx, row) };
}

/**
 * Type-specific defaults: combo series types, radar style, stock variant,
 * waterfall labels... `fresh` also sets the defaults Excel uses for a new
 * chart of that type (legend, data labels).
 */
export function applyChartTypeDefaults(
  chart: Chart,
  fresh = false,
  comboSecondary = false
) {
  const { type } = chart;
  if (chartHasGrouping(type)) chart.grouping = chart.grouping ?? "clustered";
  else delete chart.grouping;
  if (type === "combo") {
    chart.series.forEach((s, i) => {
      if (s.type == null) s.type = i === 0 ? "column" : "line";
    });
    if (comboSecondary && chart.series.length > 1) {
      chart.series[chart.series.length - 1].secondary = true;
    }
    if (chart.markers == null) chart.markers = true;
  }
  if (type === "radar" && !chart.radarStyle) chart.radarStyle = "marker";
  if (type === "stock" && !chart.stockVariant)
    chart.stockVariant = chart.series.length >= 4 ? "ohlc" : "hlc";
  if (!fresh) return;
  if (type === "waterfall") {
    chart.dataLabels = true;
    chart.legend = "top";
  }
  if (type === "histogram") chart.legend = "none";
  if (type === "pareto") chart.legend = "top";
  if (type === "funnel") {
    chart.dataLabels = true;
    chart.legend = "none";
  }
  if (type === "stock") chart.legend = "bottom";
}

export type InsertChartOptions = {
  type?: ChartType;
  grouping?: ChartGrouping;
  /** Source range; defaults to the current selection (or its region). */
  range?: ChartRange;
  seriesInRows?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  title?: string;
  markers?: boolean;
  select?: boolean;
  /** Combo charts: put the last series on the secondary axis. */
  comboSecondary?: boolean;
};

/** The range to chart for the current selection. */
export function getChartSourceFromSelection(ctx: Context): ChartRange | null {
  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!last) return null;
  const sheetId = ctx.currentSheetId;
  const i = getSheetIndex(ctx, sheetId);
  if (i == null) return null;
  const { data } = ctx.luckysheetfile[i];
  let row: [number, number] = [last.row[0], last.row[1]];
  let column: [number, number] = [last.column[0], last.column[1]];
  if (row[0] === row[1] && column[0] === column[1]) {
    const region = getChartSourceRegion(data, row[0], column[0]);
    row = region.row;
    column = region.column;
  }
  // Trim whole-row / whole-column selections to the used part of the data.
  const maxRow = (data?.length ?? 1) - 1;
  const maxCol = (data?.[0]?.length ?? 1) - 1;
  row = [Math.min(row[0], maxRow), Math.min(row[1], maxRow)];
  column = [Math.min(column[0], maxCol), Math.min(column[1], maxCol)];
  if (data && (row[1] - row[0] > 200 || column[1] - column[0] > 50)) {
    let lr = row[0];
    let lc = column[0];
    for (let r = row[0]; r <= row[1]; r += 1) {
      for (let c = column[0]; c <= column[1]; c += 1) {
        if (readChartCell(data[r]?.[c]) !== EMPTY_CELL) {
          if (r > lr) lr = r;
          if (c > lc) lc = c;
        }
      }
    }
    row = [row[0], lr];
    column = [column[0], lc];
  }
  return { sheetId, row, column };
}

/** Insert a chart built from the selection; returns it (or null). */
export function insertChart(
  ctx: Context,
  options: InsertChartOptions = {}
): Chart | null {
  if (!checkProtection(ctx, "editObjects")) return null;
  if (ctx.allowEdit === false) return null;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return null;
  const source = options.range ?? getChartSourceFromSelection(ctx);
  const type = options.type ?? "column";
  const detected = source
    ? detectChartSeries(ctx, source, {
        type,
        seriesInRows: options.seriesInRows,
      })
    : { series: [], seriesInRows: false };
  const width = options.width ?? DEFAULT_CHART_WIDTH;
  const height = options.height ?? DEFAULT_CHART_HEIGHT;
  let { left, top } = options;
  if (left == null || top == null) {
    if (source && source.sheetId === ctx.currentSheetId) {
      left = colLeft(ctx, source.column[1] + 1) + 16;
      top = rowTop(ctx, source.row[0]);
    } else {
      const zoom = ctx.zoomRatio || 1;
      left = (ctx.scrollLeft || 0) / zoom + 40;
      top = (ctx.scrollTop || 0) / zoom + 40;
    }
  }
  const chart: Chart = {
    id: generateChartId(),
    type,
    ...(chartHasGrouping(type)
      ? { grouping: options.grouping ?? "clustered" }
      : {}),
    source: source ?? null,
    seriesInRows: detected.seriesInRows,
    series: detected.series,
    legend: "right",
    gridlines: chartHasAxes(type),
    ...(type === "line" || isXYType(type) || type === "combo"
      ? { markers: options.markers ?? true }
      : {}),
    ...(options.title ? { title: options.title } : {}),
    left: Math.max(0, left),
    top: Math.max(0, top),
    width,
    height,
  };
  applyChartTypeDefaults(chart, true, options.comboSecondary);
  const sheet = ctx.luckysheetfile[sheetIndex];
  setChartBox(ctx, sheet.id!, chart, {
    left: chart.left,
    top: chart.top,
    width,
    height,
  });
  sheet.charts = [...(sheet.charts ?? []), chart];
  if (options.select !== false) ctx.activeChart = chart.id;
  return chart;
}

/** Shallow-merge `patch` into a chart (re-anchoring it when moved). */
export function updateChart(
  ctx: Context,
  id: string,
  patch: Partial<Omit<Chart, "id">>
) {
  if (!checkProtection(ctx, "editObjects")) return;
  const found = findChart(ctx, id);
  if (!found) return;
  const { chart, sheet } = found;
  const moved =
    patch.left != null ||
    patch.top != null ||
    patch.width != null ||
    patch.height != null;
  const box = moved ? getChartBox(ctx, sheet.id!, chart) : null;
  Object.assign(chart, patch);
  if (box && !patch.anchor) {
    setChartBox(ctx, sheet.id!, chart, {
      left: patch.left ?? box.left,
      top: patch.top ?? box.top,
      width: patch.width ?? box.width,
      height: patch.height ?? box.height,
    });
  }
}

/** A chart's current box (following its anchor cells). */
export function getChartDisplayBox(ctx: Context, id: string): ChartBox | null {
  const found = findChart(ctx, id);
  if (!found) return null;
  return getChartBox(ctx, found.sheet.id!, found.chart);
}

/** Change how a chart follows its cells, keeping its current box. */
export function setChartPlacement(
  ctx: Context,
  id: string,
  placement: ChartPlacement
) {
  const found = findChart(ctx, id);
  if (!found) return;
  const box = getChartBox(ctx, found.sheet.id!, found.chart);
  found.chart.placement = placement;
  setChartBox(ctx, found.sheet.id!, found.chart, box);
}

export function deleteChart(ctx: Context, id?: string) {
  if (!checkProtection(ctx, "editObjects")) return;
  const target = id ?? ctx.activeChart;
  const found = findChart(ctx, target);
  if (!found) return;
  found.sheet.charts = found.sheet.charts!.filter((c) => c.id !== target);
  if (ctx.activeChart === target) {
    ctx.activeChart = undefined;
    ctx.chartEditorOpen = false;
  }
}

/**
 * Move Chart › Object in: move a chart to another sheet (its references
 * stay on their sheets), at `box` or at the same place.
 */
export function moveChartToSheet(
  ctx: Context,
  id: string,
  sheetId: string,
  box?: ChartBox
): Chart | null {
  if (!checkProtection(ctx, "editObjects")) return null;
  const found = findChart(ctx, id);
  const target = ctx.luckysheetfile.find((s) => s.id === sheetId);
  if (!found || !target) return null;
  const at = box ?? getChartBox(ctx, found.sheet.id!, found.chart);
  if (found.sheet.id === sheetId) {
    if (box) setChartBox(ctx, sheetId, found.chart, box);
    return found.chart;
  }
  found.sheet.charts = found.sheet.charts!.filter((c) => c.id !== id);
  const chart = found.chart;
  delete chart.anchor;
  target.charts = [...(target.charts ?? []), chart];
  setChartBox(ctx, sheetId, chart, at);
  return chart;
}

/** Bring Forward / Send Backward (to the front / back): chart z-order. */
export function reorderChart(
  ctx: Context,
  id: string,
  to: "forward" | "backward" | "front" | "back"
) {
  const found = findChart(ctx, id);
  if (!found?.sheet.charts) return;
  const list = [...found.sheet.charts];
  const i = found.index;
  const [c] = list.splice(i, 1);
  let at = i;
  if (to === "forward") at = Math.min(list.length, i + 1);
  else if (to === "backward") at = Math.max(0, i - 1);
  else if (to === "front") at = list.length;
  else at = 0;
  list.splice(at, 0, c);
  found.sheet.charts = list;
}

/** Add a copy of `chart` (e.g. from the clipboard) to the current sheet. */
export function pasteChart(
  ctx: Context,
  chart: Chart,
  position?: { left: number; top: number }
): Chart | null {
  if (!checkProtection(ctx, "editObjects")) return null;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return null;
  const copy: Chart = JSON.parse(JSON.stringify(chart));
  copy.id = generateChartId();
  if (position) {
    copy.left = position.left;
    copy.top = position.top;
  }
  const sheet = ctx.luckysheetfile[sheetIndex];
  if (sheet.id != null) {
    setChartBox(ctx, sheet.id, copy, {
      left: copy.left,
      top: copy.top,
      width: copy.width,
      height: copy.height,
    });
  }
  sheet.charts = [...(sheet.charts ?? []), copy];
  ctx.activeChart = copy.id;
  return copy;
}

/** Re-read the series from the chart's source range. */
export function setChartSource(
  ctx: Context,
  id: string,
  source: ChartRange,
  seriesInRows?: boolean
) {
  if (!checkProtection(ctx, "editObjects")) return;
  const found = findChart(ctx, id);
  if (!found) return;
  const { chart } = found;
  const detected = detectChartSeries(ctx, source, {
    type: chart.type,
    seriesInRows,
  });
  // Keep explicit colours and per-series options by position.
  detected.series.forEach((s, i) => {
    const old = chart.series[i];
    if (!old) return;
    if (old.color) s.color = old.color;
    if (old.type) s.type = old.type;
    if (old.secondary) s.secondary = true;
    if (old.trendlines) s.trendlines = old.trendlines;
    if (old.errorBars) s.errorBars = old.errorBars;
  });
  chart.source = source;
  chart.seriesInRows = detected.seriesInRows;
  chart.series = detected.series;
  applyChartTypeDefaults(chart);
}

function unionRange(a: ChartRange | null, b: ChartRange | null | undefined) {
  if (!b) return a;
  if (!a)
    return {
      sheetId: b.sheetId,
      row: [...b.row],
      column: [...b.column],
    } as ChartRange;
  if (a.sheetId !== b.sheetId) return a;
  return {
    sheetId: a.sheetId,
    row: [Math.min(a.row[0], b.row[0]), Math.max(a.row[1], b.row[1])],
    column: [
      Math.min(a.column[0], b.column[0]),
      Math.max(a.column[1], b.column[1]),
    ],
  } as ChartRange;
}

/** Bounding range of all series references (for imported charts). */
export function inferChartSource(chart: Chart): ChartRange | null {
  let out: ChartRange | null = null;
  chart.series.forEach((s) => {
    out = unionRange(out, s.values);
    out = unionRange(out, s.nameRef);
    out = unionRange(out, s.categories);
    out = unionRange(out, s.sizes);
  });
  return out;
}

export function switchChartRowColumn(ctx: Context, id: string) {
  const found = findChart(ctx, id);
  if (!found) return;
  const { chart } = found;
  const source = chart.source ?? inferChartSource(chart);
  if (!source) return;
  setChartSource(ctx, id, source, !chart.seriesInRows);
}

/** Change the chart type, adjusting type-specific defaults. */
export function setChartType(
  ctx: Context,
  id: string,
  type: ChartType,
  grouping?: ChartGrouping
) {
  if (!checkProtection(ctx, "editObjects")) return;
  const found = findChart(ctx, id);
  if (!found) return;
  const { chart } = found;
  const prev = chart.type;
  chart.type = type;
  if (chartHasGrouping(type)) {
    chart.grouping = grouping ?? chart.grouping ?? "clustered";
  } else {
    delete chart.grouping;
  }
  if (
    (type === "line" || isXYType(type) || type === "combo") &&
    chart.markers == null
  ) {
    chart.markers = true;
  }
  if (!chartHasAxes(type)) chart.gridlines = false;
  else if (
    chart.gridlines === false &&
    (isXYType(prev) || !chartHasAxes(prev) || chart.gridlines == null)
  )
    chart.gridlines = true;
  if (type !== "combo") {
    chart.series.forEach((s) => {
      delete s.type;
    });
  }
  if (!chartSupportsSecondaryAxis(type)) {
    chart.series.forEach((s) => {
      delete s.secondary;
    });
  }
  // Scatter and bubble read X values from the first column (and bubble
  // sizes from every second one); re-detect when crossing.
  const { source } = chart;
  const layout = (t: ChartType) => {
    if (t === "bubble") return 2;
    return isXYType(t) ? 1 : 0;
  };
  if (source && layout(prev) !== layout(type)) {
    setChartSource(ctx, id, source, chart.seriesInRows);
  }
  applyChartTypeDefaults(chart, prev !== type);
}

// ---------------------------------------------------------------------------
// Resolution and rendering
// ---------------------------------------------------------------------------

function resolveSeriesName(
  ctx: Pick<Context, "luckysheetfile">,
  s: ChartSeries,
  index: number
) {
  if (s.name != null && s.name !== "") return s.name;
  if (s.nameRef) {
    const cells = readChartRange(ctx, s.nameRef);
    const text = cells
      .map((c) => c.display)
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  if (s.cache?.name) return s.cache.name;
  return `Series${index + 1}`;
}

function readNumbers(
  ctx: Pick<Context, "luckysheetfile">,
  range: ChartRange | null | undefined
) {
  return readChartRange(ctx, range).map((c) => c.numeric);
}

/** Cells of a reference in reading order (area after area). */
export function chartRangeCells(
  range: ChartRange | null | undefined
): { sheetId: string; r: number; c: number }[] {
  const out: { sheetId: string; r: number; c: number }[] = [];
  chartRangeAreas(range).forEach((a) => {
    for (let r = a.row[0]; r <= a.row[1] && out.length < 100000; r += 1) {
      for (let c = a.column[0]; c <= a.column[1]; c += 1) {
        out.push({ sheetId: a.sheetId, r, c });
      }
    }
  });
  return out;
}

/** Whether each cell of `range` is in a hidden row or column. */
function hiddenCellsOf(
  ctx: Pick<Context, "luckysheetfile">,
  range: ChartRange | null | undefined
): boolean[] {
  return chartRangeCells(range).map(({ sheetId, r, c }) => {
    const config = sheetById(ctx, sheetId)?.config;
    return (
      config?.rowhidden?.[r] != null || config?.colhidden?.[c] != null || false
    );
  });
}

/** Colour of palette entry `index` for a chart. */
export function chartColor(chart: Pick<Chart, "palette">, index: number) {
  return paletteColor(chart.palette, index);
}

/** Resolve a chart's references into the renderer's model. */
export function resolveChartModel(
  ctx: Pick<Context, "luckysheetfile"> & {
    theme?: string;
    lang?: string | null;
  },
  chart: Chart
): ChartRenderModel {
  let categories: string[] = [];
  const categorySource = chart.series.find((s) => s.categories)?.categories;
  const catFormat = chart.categoryAxisFormat;
  const catCode =
    catFormat?.sourceLinked === false ? catFormat.numberFormat : undefined;
  let categoryCellFormat: string | undefined;
  if (categorySource) {
    const cells = readChartRange(ctx, categorySource);
    categoryCellFormat = cells.find((c) => c.numeric != null)?.format;
    // Format Axis › Number, not linked to source: the category numbers
    // (dates) in the axis' own format
    categories = cells.map((c) =>
      catCode && c.numeric != null
        ? formatWithCode(catCode, c.numeric)
        : c.display
    );
  } else {
    const cached = chart.series.find((s) => s.cache?.categories)?.cache
      ?.categories;
    if (cached) categories = cached.slice();
  }
  const pie = chart.type === "pie" || chart.type === "doughnut";
  const vary = pie || !!chart.varyColors;
  const pick = (i: number) => chartColor(chart, i);
  const blanks = chart.displayBlanksAs ?? "gap";
  const visibleOnly = chart.plotVisibleOnly !== false;
  // hidden rows / columns: a series whose cells are all hidden is not
  // plotted, a point hidden in every plotted series is not either
  const hiddenCells: (boolean[] | null)[] = chart.series.map((s) =>
    visibleOnly && s.values ? hiddenCellsOf(ctx, s.values) : null
  );
  const series: ChartRenderSeries[] = chart.series.map((s, i) => {
    let values: (number | null)[] = [];
    let labels: string[] | undefined;
    let connect: boolean[] | undefined;
    if (s.values) {
      const cells = readChartRange(ctx, s.values);
      values = cells.map((c) => c.numeric);
      labels = cells.map((c) => (c.numeric != null ? c.display : ""));
      // empty cells as zero / connected; #N/A is passed over (or treated
      // as an empty cell with "Show #N/A as an empty cell")
      cells.forEach((c, p) => {
        const na = c.display === "#N/A";
        const empty = c === EMPTY_CELL || (na && !!chart.displayNaAsBlank);
        if (empty && blanks === "zero") values[p] = 0;
        else if ((empty && blanks === "span") || (na && !empty)) {
          if (!connect) connect = [];
          connect[p] = true;
        }
      });
    } else if (s.cache?.values) {
      values = s.cache.values.slice();
    }
    let xValues: (number | null)[] | undefined;
    if (isXYType(chart.type)) {
      if (s.categories) {
        const xs = readChartRange(ctx, s.categories);
        xValues = xs.some((c) => c.numeric != null)
          ? xs.map((c) => c.numeric)
          : undefined;
      } else if (s.cache?.categories) {
        const parsed = s.cache.categories.map((c) => {
          const v = Number(c);
          return c !== "" && Number.isFinite(v) ? v : null;
        });
        xValues = parsed.some((v) => v != null) ? parsed : undefined;
      }
    }
    const color = s.color || pick(i);
    let pointColors: string[] | undefined;
    if (vary && (pie || chart.series.length === 1)) {
      pointColors = values.map((_, p) => s.pointColors?.[p] || pick(p));
    } else if (s.pointColors?.length) {
      pointColors = values.map((_, p) => s.pointColors?.[p] || color);
    }
    let sizes: (number | null)[] | undefined;
    if (chart.type === "bubble") {
      if (s.sizes) sizes = readNumbers(ctx, s.sizes);
      else if (s.cache?.sizes) sizes = s.cache.sizes.slice();
      else sizes = values.map(() => 1);
    }
    let errorBars: ChartRenderSeries["errorBars"];
    if (s.errorBars) {
      const { plus, minus, ...rest } = s.errorBars;
      errorBars = {
        ...rest,
        ...(plus ? { plusValues: readNumbers(ctx, plus) } : {}),
        ...(minus ? { minusValues: readNumbers(ctx, minus) } : {}),
      };
    }
    const cellsHidden = hiddenCells[i];
    const allHidden =
      !!cellsHidden && cellsHidden.length > 0 && cellsHidden.every(Boolean);
    return {
      name: resolveSeriesName(ctx, s, i),
      color,
      index: i,
      ...(s.filtered || allHidden ? { hidden: true } : {}),
      ...(s.outline !== undefined ? { outline: s.outline } : {}),
      ...(s.shadow ? { shadow: true } : {}),
      ...(s.effects ? { effects: s.effects } : {}),
      ...(connect ? { connect } : {}),
      values,
      ...(labels ? { labels } : {}),
      ...(xValues ? { xValues } : {}),
      ...(pointColors ? { pointColors } : {}),
      ...(s.pointOutlines && Object.keys(s.pointOutlines).length
        ? { pointOutlines: { ...s.pointOutlines } }
        : {}),
      ...(s.type && chart.type === "combo" ? { type: s.type } : {}),
      ...(s.secondary && chartSupportsSecondaryAxis(chart.type)
        ? { secondary: true }
        : {}),
      ...(sizes ? { sizes } : {}),
      ...(s.trendlines?.length && chartSupportsTrendlines(chart.type)
        ? { trendlines: s.trendlines }
        : {}),
      ...(errorBars && chartSupportsTrendlines(chart.type)
        ? { errorBars }
        : {}),
    };
  });
  // points in hidden rows / columns (in every plotted series), and the
  // categories unchecked in the Chart Filters
  let hiddenPoints: boolean[] | undefined;
  const plotted = series.filter((s) => !s.hidden);
  const masks = plotted
    .map((s) => hiddenCells[s.index ?? 0])
    .filter((m): m is boolean[] => !!m && m.length > 0);
  if (masks.length && masks.length === plotted.length) {
    const len = Math.max(...masks.map((m) => m.length));
    for (let p = 0; p < len; p += 1) {
      if (masks.every((m) => m[p])) {
        if (!hiddenPoints) hiddenPoints = [];
        hiddenPoints[p] = true;
      }
    }
  }
  chart.hiddenCategories?.forEach((p) => {
    if (!hiddenPoints) hiddenPoints = [];
    hiddenPoints[p] = true;
  });
  const axisFormats = chartAxisFormats(ctx, chart, categoryCellFormat);
  const themeName = ctx.theme === "dark" ? "dark" : "light";
  const style = chart.style ? getChartStyle(chart.style).spec(themeName) : {};
  const lang = ctx.lang || "en";
  const loc =
    chartLocales[lang] ?? chartLocales[lang.split("-")[0]] ?? chartLocales.en;
  return {
    type: chart.type,
    grouping: chartHasGrouping(chart.type) ? chart.grouping : undefined,
    title: chart.title,
    categoryAxisTitle: chart.categoryAxisTitle,
    valueAxisTitle: chart.valueAxisTitle,
    legend: chart.legend,
    dataLabels: chart.dataLabels,
    gridlines: chart.gridlines,
    markers: chart.markers,
    scatterLines: chart.scatterLines,
    varyColors: vary,
    valueAxis: chart.valueAxis,
    secondaryValueAxis: chart.secondaryValueAxis,
    secondaryValueAxisTitle: chart.secondaryValueAxisTitle,
    dataLabelOptions: chart.dataLabelOptions,
    binning: chart.binning,
    radarStyle: chart.radarStyle,
    stockVariant: chart.stockVariant,
    waterfallTotals: chart.waterfallTotals,
    waterfallConnectors: chart.waterfallConnectors,
    waterfallColors: [pick(0), pick(1), pick(2)],
    bubbleScale: chart.bubbleScale,
    style,
    labels: {
      increase: loc.increase ?? chartLocales.en.increase,
      decrease: loc.decrease ?? chartLocales.en.decrease,
      total: loc.total ?? chartLocales.en.total,
      cumulative: loc.cumulative ?? chartLocales.en.cumulative,
    },
    categories,
    series,
    ...(hiddenPoints ? { hiddenPoints } : {}),
    ...(chart.titleOverlay ? { titleOverlay: true } : {}),
    ...(chart.axes?.category === false ? { hideCategoryAxis: true } : {}),
    ...(chart.axes?.value === false ? { hideValueAxis: true } : {}),
    ...(chart.categoryGridlines ? { categoryGridlines: true } : {}),
    ...(chart.minorGridlines ? { minorGridlines: true } : {}),
    ...(chart.minorCategoryGridlines ? { minorCategoryGridlines: true } : {}),
    ...(chart.dataTable ? { dataTable: chart.dataTable } : {}),
    ...(chart.dropLines ? { dropLines: true } : {}),
    ...(chart.hiLowLines ? { hiLowLines: true } : {}),
    ...(chart.upDownBars ? { upDownBars: true } : {}),
    ...(chart.formats ? { formats: chart.formats } : {}),
    ...(axisFormats ? { axisFormats } : {}),
  };
}

/** The number format a value axis shows: its own, or the source cells'. */
function effectiveAxisFormat(
  options: ChartAxisNumberFormat | undefined,
  source: string | undefined
) {
  if (options?.sourceLinked === false) return options.numberFormat;
  return source;
}

/**
 * The number formats of a chart's axes (Format Axis › Number): each is
 * "Linked to source" by default, i.e. the format of the first value (X
 * value) cell of the first series plotted on it (Excel).
 */
export function chartAxisFormats(
  ctx: Pick<Context, "luckysheetfile">,
  chart: Chart,
  categoryCellFormat?: string
): ChartRenderModel["axisFormats"] {
  // counts and bins, not the source values
  if (chart.type === "histogram" || chart.type === "pareto") return undefined;
  const firstFormat = (secondary: boolean) => {
    const s = chart.series.find(
      (x) =>
        !x.filtered &&
        x.values &&
        !!x.secondary === secondary &&
        (secondary ? chartSupportsSecondaryAxis(chart.type) : true)
    );
    return readChartRange(ctx, s?.values).find((c) => c.numeric != null)
      ?.format;
  };
  const out: NonNullable<ChartRenderModel["axisFormats"]> = {};
  const value = effectiveAxisFormat(chart.valueAxis, firstFormat(false));
  if (value) out.value = value;
  if (
    chartSupportsSecondaryAxis(chart.type) &&
    chart.series.some((s) => s.secondary)
  ) {
    const secondary = effectiveAxisFormat(
      chart.secondaryValueAxis,
      firstFormat(true)
    );
    if (secondary) out.secondary = secondary;
  }
  if (isXYType(chart.type)) {
    let source = categoryCellFormat;
    if (source === undefined) {
      const xs = chart.series.find((s) => s.categories)?.categories;
      source = readChartRange(ctx, xs).find((c) => c.numeric != null)?.format;
    }
    const category = effectiveAxisFormat(chart.categoryAxisFormat, source);
    if (category) out.category = category;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Chart chrome colours for a chart's style on a theme. */
export function chartThemeFor(
  chart: Pick<Chart, "style">,
  themeName: string | null | undefined
): ChartTheme {
  const name = themeName === "dark" ? "dark" : "light";
  const preset = chart.style ? getChartStyle(chart.style) : null;
  return getChartTheme(name, preset?.theme?.(name));
}

/** Render a chart to an SVG string at its own size. */
export function renderChartToSvg(
  ctx: Pick<Context, "luckysheetfile"> & {
    theme?: string;
    lang?: string | null;
  },
  chart: Chart,
  theme?: ChartTheme | string,
  size?: { width: number; height: number }
) {
  const themeName = typeof theme === "string" ? theme : ctx.theme;
  const resolvedTheme =
    typeof theme === "object" ? theme : chartThemeFor(chart, themeName);
  return renderChartSvg(
    resolveChartModel({ ...ctx, theme: themeName }, chart),
    size?.width ?? chart.width,
    size?.height ?? chart.height,
    resolvedTheme
  );
}

/** Every range a chart reads. */
export function getChartRanges(chart: Chart): ChartRange[] {
  const out: ChartRange[] = [];
  const add = (r: ChartRange | null | undefined) => {
    chartRangeAreas(r).forEach((a) => out.push(a));
  };
  chart.series.forEach((s) => {
    add(s.values);
    add(s.nameRef);
    add(s.categories);
    add(s.sizes);
    add(s.errorBars?.plus);
    add(s.errorBars?.minus);
  });
  return out;
}

/** Ranges a chart depends on (for cheap change detection). */
export function getChartReferencedSheetIds(chart: Chart): string[] {
  const ids = new Set<string>();
  getChartRanges(chart).forEach((r) => ids.add(r.sheetId));
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// Reference adjustment on row/column insert and delete
// ---------------------------------------------------------------------------

type Axis = "row" | "column";

/**
 * Map every area of a reference; areas mapped to null are dropped (a union
 * keeps its other areas, like Excel), null when none is left.
 */
export function mapChartRange(
  range: ChartRange,
  fn: (area: ChartRangeArea) => ChartRangeArea | null
): ChartRange | null {
  if (!range.areas?.length) {
    const next = fn(range);
    if (!next) return null;
    if (next === range) return range;
    return {
      sheetId: next.sheetId,
      row: next.row,
      column: next.column,
    };
  }
  const areas = chartRangeAreas(range);
  const mapped = areas.map(fn);
  if (mapped.every((a, i) => a === areas[i])) return range;
  return chartRangeFromAreas(mapped.filter((a): a is ChartRangeArea => !!a));
}

function forEachChartRange(
  ctx: Pick<Context, "luckysheetfile">,
  area: (range: ChartRangeArea) => ChartRangeArea | null
) {
  const fn = (range: ChartRange) => mapChartRange(range, area);
  ctx.luckysheetfile.forEach((sheet) => {
    sheet.charts?.forEach((chart) => {
      if (chart.source) chart.source = fn(chart.source);
      chart.series.forEach((s) => {
        if (s.values) s.values = fn(s.values);
        if (s.nameRef) s.nameRef = fn(s.nameRef);
        if (s.categories) s.categories = fn(s.categories);
        if (s.sizes) s.sizes = fn(s.sizes);
        if (s.errorBars?.plus) s.errorBars.plus = fn(s.errorBars.plus);
        if (s.errorBars?.minus) s.errorBars.minus = fn(s.errorBars.minus);
      });
    });
  });
}

/** Shift one span for `count` lines inserted before index `at`. */
export function shiftSpanForInsert(
  span: [number, number],
  at: number,
  count: number
): [number, number] {
  return [
    span[0] >= at ? span[0] + count : span[0],
    span[1] >= at ? span[1] + count : span[1],
  ];
}

/** Shrink/shift one span for lines `start..end` deleted; null if all gone. */
export function shiftSpanForDelete(
  span: [number, number],
  start: number,
  end: number
): [number, number] | null {
  const count = end - start + 1;
  const [a, b] = span;
  if (b < start) return span;
  if (a > end) return [a - count, b - count];
  const na = a < start ? a : start;
  const nb = b > end ? b - count : start - 1;
  return nb < na ? null : [na, nb];
}

/**
 * Keep charts in sync with a structural change (registered with refAdjust,
 * see modelSync.ts): series, category, name and source ranges follow their
 * cells (a range moved to another sheet by cut/paste follows it there; a
 * deleted one becomes null, i.e. #REF!), and the charts themselves follow
 * their anchor cells (chartAnchor.ts): they move with inserted / deleted
 * rows and columns (and "move and size" charts grow or shrink), and charts
 * whose cells are shifted or cut/pasted go with them. Called before the
 * cells move.
 */
export function adjustChartsForChange(ctx: Context, change: ReferenceChange) {
  const hasCharts = ctx.luckysheetfile.some((s) => s.charts?.length);
  if (!hasCharts || change.type === "renameSheet") return;
  adjustChartPlacements(ctx, change);
  forEachChartRange(ctx, (range) => {
    const next = locateRangeForChange(range, change, range.sheetId);
    if (!next) return null;
    if (
      next.sheetId === range.sheetId &&
      next.range.row[0] === range.row[0] &&
      next.range.row[1] === range.row[1] &&
      next.range.column[0] === range.column[0] &&
      next.range.column[1] === range.column[1]
    ) {
      return range;
    }
    return { sheetId: next.sheetId, ...next.range };
  });
}

/**
 * Rewrite chart references after `count` rows/columns were inserted at `at`
 * (the index of the first new line) on sheet `sheetId`, and move charts on
 * that sheet that sit below/right of the insertion point.
 */
export function adjustChartsForInsert(
  ctx: Context,
  sheetId: string,
  type: Axis,
  at: number,
  count: number
) {
  if (count <= 0) return;
  adjustChartsForChange(ctx, {
    type: "insert",
    sheetId,
    axis: type,
    index: at,
    count,
  });
}

/** Rewrite chart references after rows/columns `start..end` were deleted. */
export function adjustChartsForDelete(
  ctx: Context,
  sheetId: string,
  type: Axis,
  start: number,
  end: number
) {
  if (end < start) return;
  adjustChartsForChange(ctx, {
    type: "delete",
    sheetId,
    axis: type,
    start,
    end,
  });
}

/**
 * Charts of a duplicated sheet: new ids, and ranges on the original sheet
 * point at the copy (Excel's copied charts plot the copied data).
 */
export function remapDuplicatedCharts(
  charts: Chart[] | undefined,
  fromSheetId: string,
  toSheetId: string
): Chart[] | undefined {
  if (!charts?.length) return charts;
  const remap = <T extends ChartRange | null | undefined>(range: T): T =>
    range
      ? (mapChartRange(range, (a) =>
          a.sheetId === fromSheetId ? { ...a, sheetId: toSheetId } : a
        ) as T)
      : range;
  return charts.map((chart) => ({
    ...chart,
    id: generateChartId(),
    source: remap(chart.source),
    series: chart.series.map((s) => ({
      ...s,
      values: remap(s.values),
      nameRef: remap(s.nameRef),
      categories: remap(s.categories),
      ...(s.sizes ? { sizes: remap(s.sizes) } : {}),
      ...(s.errorBars
        ? {
            errorBars: {
              ...s.errorBars,
              plus: remap(s.errorBars.plus),
              minus: remap(s.errorBars.minus),
            },
          }
        : {}),
    })),
  }));
}
