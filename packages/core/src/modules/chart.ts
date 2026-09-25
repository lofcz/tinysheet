/**
 * Chart objects: `sheet.charts[]` holds live charts whose series reference
 * cell ranges. Everything here mutates the (immer draft) context, so the
 * React layer gets undo/redo and collaboration ops for free: chart state lives
 * under `luckysheetfile`, which is what the history records.
 *
 * Rendering is delegated to the pure SVG renderer in `./chartRender`.
 */
import type { Context } from "../context";
import type { Cell, CellMatrix, Sheet } from "../types";
import { getSheetIndex, indexToColumnChar } from "../utils";
import {
  chartPaletteColor,
  getChartTheme,
  renderChartSvg,
  ChartGrouping,
  ChartLegendPosition,
  ChartRenderModel,
  ChartRenderSeries,
  ChartTheme,
  ChartType,
  ChartValueAxisOptions,
} from "./chartRender";

/** A rectangular cell range on one sheet (0-based, inclusive). */
export type ChartRange = {
  sheetId: string;
  row: [number, number];
  column: [number, number];
};

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
  /** Explicit per-point colours (pie slices, varied columns). */
  pointColors?: string[];
  /**
   * Values cached from an imported file, used when a reference cannot be
   * resolved (external workbooks, unsupported reference syntax).
   */
  cache?: {
    name?: string;
    values?: (number | null)[];
    categories?: string[];
  };
};

export type Chart = {
  id: string;
  type: ChartType;
  grouping?: ChartGrouping;
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
];

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
 * Parse `Sheet1!$A$1:$B$4`, `'My sheet'!A1`, `A1:B4`, `A:B` or `1:3` into a
 * range. Returns null for anything else (unions, external references).
 */
export function parseChartRange(
  ctx: Pick<Context, "luckysheetfile">,
  text: string,
  defaultSheetId: string
): ChartRange | null {
  if (text == null) return null;
  let t = String(text).trim();
  if (t.startsWith("=")) t = t.slice(1).trim();
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1).trim();
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

/** `Sheet1!$A$1:$B$4` (absolute, sheet-qualified, as Excel writes it). */
export function chartRangeToText(
  ctx: Pick<Context, "luckysheetfile">,
  range: ChartRange | null | undefined,
  options: { absolute?: boolean; sheet?: boolean } = {}
) {
  if (!range) return "#REF!";
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
  if (typeof v === "number") {
    return {
      display,
      numeric: Number.isFinite(v) ? v : null,
      text: false,
      date: isDateFormat(cell),
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
      };
    }
  }
  return { display, numeric: null, text: true, date: false };
}

function sheetById(ctx: Pick<Context, "luckysheetfile">, id: string) {
  return ctx.luckysheetfile.find((s) => s.id === id);
}

/** Cells of a range in row-major order. */
export function readChartRange(
  ctx: Pick<Context, "luckysheetfile">,
  range: ChartRange | null | undefined
): ChartCell[] {
  if (!range) return [];
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
export function getCurrentRegion(
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
    options.seriesInRows ?? (dataRows < dataCols && dataRows > 0);

  const { sheetId } = source;
  const series: ChartSeries[] = [];
  const scatter = options.type === "scatter";

  if (!seriesInRows) {
    let categories: ChartRange | null = headerColumn
      ? { sheetId, row: [dr1, r2], column: [c1, c1] }
      : null;
    let first = dc1;
    if (scatter && !headerColumn && dataCols > 1) {
      categories = { sheetId, row: [dr1, r2], column: [dc1, dc1] };
      first = dc1 + 1;
    }
    for (let c = first; c <= c2; c += 1) {
      series.push({
        values: { sheetId, row: [dr1, r2], column: [c, c] },
        ...(headerRow
          ? { nameRef: { sheetId, row: [r1, r1], column: [c, c] } }
          : { name: `Series${series.length + 1}` }),
        ...(categories ? { categories } : {}),
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
    for (let r = first; r <= r2; r += 1) {
      series.push({
        values: { sheetId, row: [r, r], column: [dc1, c2] },
        ...(headerColumn
          ? { nameRef: { sheetId, row: [r, r], column: [c1, c1] } }
          : { name: `Series${series.length + 1}` }),
        ...(categories ? { categories } : {}),
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
    const region = getCurrentRegion(data, row[0], column[0]);
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
    ...(type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area"
      ? { grouping: options.grouping ?? "clustered" }
      : {}),
    source: source ?? null,
    seriesInRows: detected.seriesInRows,
    series: detected.series,
    legend: "right",
    gridlines: type !== "pie" && type !== "doughnut",
    ...(type === "line" || type === "scatter"
      ? { markers: options.markers ?? true }
      : {}),
    ...(options.title ? { title: options.title } : {}),
    left: Math.max(0, left),
    top: Math.max(0, top),
    width,
    height,
  };
  const sheet = ctx.luckysheetfile[sheetIndex];
  sheet.charts = [...(sheet.charts ?? []), chart];
  if (options.select !== false) ctx.activeChart = chart.id;
  return chart;
}

/** Shallow-merge `patch` into a chart. */
export function updateChart(
  ctx: Context,
  id: string,
  patch: Partial<Omit<Chart, "id">>
) {
  const found = findChart(ctx, id);
  if (!found) return;
  Object.assign(found.chart, patch);
}

export function deleteChart(ctx: Context, id?: string) {
  const target = id ?? ctx.activeChart;
  const found = findChart(ctx, target);
  if (!found) return;
  found.sheet.charts = found.sheet.charts!.filter((c) => c.id !== target);
  if (ctx.activeChart === target) {
    ctx.activeChart = undefined;
    ctx.chartEditorOpen = false;
  }
}

/** Add a copy of `chart` (e.g. from the clipboard) to the current sheet. */
export function pasteChart(
  ctx: Context,
  chart: Chart,
  position?: { left: number; top: number }
): Chart | null {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return null;
  const copy: Chart = JSON.parse(JSON.stringify(chart));
  copy.id = generateChartId();
  if (position) {
    copy.left = position.left;
    copy.top = position.top;
  }
  const sheet = ctx.luckysheetfile[sheetIndex];
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
  const found = findChart(ctx, id);
  if (!found) return;
  const { chart } = found;
  const detected = detectChartSeries(ctx, source, {
    type: chart.type,
    seriesInRows,
  });
  // Keep explicit colours by position.
  detected.series.forEach((s, i) => {
    const color = chart.series[i]?.color;
    if (color) s.color = color;
  });
  chart.source = source;
  chart.seriesInRows = detected.seriesInRows;
  chart.series = detected.series;
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
  const found = findChart(ctx, id);
  if (!found) return;
  const { chart } = found;
  const wasScatter = chart.type === "scatter";
  chart.type = type;
  if (
    type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area"
  ) {
    chart.grouping = grouping ?? chart.grouping ?? "clustered";
  } else {
    delete chart.grouping;
  }
  if ((type === "line" || type === "scatter") && chart.markers == null) {
    chart.markers = true;
  }
  if (type === "pie" || type === "doughnut") chart.gridlines = false;
  else if (chart.gridlines === false && (wasScatter || chart.gridlines == null))
    chart.gridlines = true;
  // Scatter reads X values from the first column; re-detect when crossing.
  const { source } = chart;
  if (source && wasScatter !== (type === "scatter")) {
    setChartSource(ctx, id, source, chart.seriesInRows);
  }
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

/** Resolve a chart's references into the renderer's model. */
export function resolveChartModel(
  ctx: Pick<Context, "luckysheetfile">,
  chart: Chart
): ChartRenderModel {
  let categories: string[] = [];
  const categorySource = chart.series.find((s) => s.categories)?.categories;
  if (categorySource) {
    categories = readChartRange(ctx, categorySource).map((c) => c.display);
  } else {
    const cached = chart.series.find((s) => s.cache?.categories)?.cache
      ?.categories;
    if (cached) categories = cached.slice();
  }
  const pie = chart.type === "pie" || chart.type === "doughnut";
  const vary = pie || !!chart.varyColors;
  const series: ChartRenderSeries[] = chart.series.map((s, i) => {
    let values: (number | null)[] = [];
    let labels: string[] | undefined;
    if (s.values) {
      const cells = readChartRange(ctx, s.values);
      values = cells.map((c) => c.numeric);
      labels = cells.map((c) => (c.numeric != null ? c.display : ""));
    } else if (s.cache?.values) {
      values = s.cache.values.slice();
    }
    let xValues: (number | null)[] | undefined;
    if (chart.type === "scatter") {
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
    const color = s.color || chartPaletteColor(i);
    let pointColors: string[] | undefined;
    if (vary && (pie || chart.series.length === 1)) {
      pointColors = values.map(
        (_, p) => s.pointColors?.[p] || chartPaletteColor(p)
      );
    } else if (s.pointColors?.length) {
      pointColors = values.map((_, p) => s.pointColors?.[p] || color);
    }
    return {
      name: resolveSeriesName(ctx, s, i),
      color,
      values,
      ...(labels ? { labels } : {}),
      ...(xValues ? { xValues } : {}),
      ...(pointColors ? { pointColors } : {}),
    };
  });
  return {
    type: chart.type,
    grouping: chart.grouping,
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
    categories,
    series,
  };
}

/** Render a chart to an SVG string at its own size. */
export function renderChartToSvg(
  ctx: Pick<Context, "luckysheetfile"> & { theme?: string },
  chart: Chart,
  theme?: ChartTheme | string,
  size?: { width: number; height: number }
) {
  const resolvedTheme =
    typeof theme === "object" ? theme : getChartTheme(theme ?? ctx.theme);
  return renderChartSvg(
    resolveChartModel(ctx, chart),
    size?.width ?? chart.width,
    size?.height ?? chart.height,
    resolvedTheme
  );
}

/** Ranges a chart depends on (for cheap change detection). */
export function getChartReferencedSheetIds(chart: Chart): string[] {
  const ids = new Set<string>();
  chart.series.forEach((s) => {
    if (s.values) ids.add(s.values.sheetId);
    if (s.nameRef) ids.add(s.nameRef.sheetId);
    if (s.categories) ids.add(s.categories.sheetId);
  });
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// Reference adjustment on row/column insert and delete
// ---------------------------------------------------------------------------

type Axis = "row" | "column";

function forEachChartRange(
  ctx: Pick<Context, "luckysheetfile">,
  fn: (range: ChartRange) => ChartRange | null
) {
  ctx.luckysheetfile.forEach((sheet) => {
    sheet.charts?.forEach((chart) => {
      if (chart.source) chart.source = fn(chart.source);
      chart.series.forEach((s) => {
        if (s.values) s.values = fn(s.values);
        if (s.nameRef) s.nameRef = fn(s.nameRef);
        if (s.categories) s.categories = fn(s.categories);
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
  const hasCharts = ctx.luckysheetfile.some((s) => s.charts?.length);
  if (!hasCharts || count <= 0) return;
  forEachChartRange(ctx, (range) => {
    if (range.sheetId !== sheetId) return range;
    return type === "row"
      ? { ...range, row: shiftSpanForInsert(range.row, at, count) }
      : { ...range, column: shiftSpanForInsert(range.column, at, count) };
  });
  // Charts move with their cells (only computable for the laid-out sheet).
  if (sheetId !== ctx.currentSheetId) return;
  const sheet = sheetById(ctx, sheetId);
  if (!sheet?.charts?.length) return;
  const edge = type === "row" ? rowTop(ctx, at) : colLeft(ctx, at);
  const size =
    type === "row"
      ? (ctx.defaultrowlen || 19) + 1
      : (ctx.defaultcollen || 73) + 1;
  sheet.charts.forEach((chart) => {
    if (type === "row" && chart.top >= edge - 0.5) chart.top += count * size;
    if (type === "column" && chart.left >= edge - 0.5)
      chart.left += count * size;
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
  const hasCharts = ctx.luckysheetfile.some((s) => s.charts?.length);
  if (!hasCharts || end < start) return;
  forEachChartRange(ctx, (range) => {
    if (range.sheetId !== sheetId) return range;
    const span = shiftSpanForDelete(
      type === "row" ? range.row : range.column,
      start,
      end
    );
    if (!span) return null;
    return type === "row"
      ? { ...range, row: span }
      : { ...range, column: span };
  });
  if (sheetId !== ctx.currentSheetId) return;
  const sheet = sheetById(ctx, sheetId);
  if (!sheet?.charts?.length) return;
  const from = type === "row" ? rowTop(ctx, start) : colLeft(ctx, start);
  const to = type === "row" ? rowTop(ctx, end + 1) : colLeft(ctx, end + 1);
  const removed = to - from;
  sheet.charts.forEach((chart) => {
    const pos = type === "row" ? chart.top : chart.left;
    let next = pos;
    if (pos >= to) next = pos - removed;
    else if (pos > from) next = from;
    if (type === "row") chart.top = next;
    else chart.left = next;
  });
}
