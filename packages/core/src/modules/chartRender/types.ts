/**
 * Types shared by the pure SVG chart renderers. Nothing in this folder touches
 * the workbook context, so both the sheet chart layer (core/react) and the
 * xlsx importer/exporter (excel) can render charts with it.
 */

/** Chart families supported by the renderer (Excel naming). */
export type ChartType =
  | "column"
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "doughnut"
  | "scatter";

/** Series grouping for column, bar, line and area charts. */
export type ChartGrouping = "clustered" | "stacked" | "percentStacked";

export type ChartLegendPosition = "right" | "left" | "top" | "bottom" | "none";

/** Explicit value-axis bounds / major unit (c:scaling / c:majorUnit). */
export type ChartValueAxisOptions = {
  min?: number;
  max?: number;
  majorUnit?: number;
};

/** One plottable series after its references have been resolved. */
export type ChartRenderSeries = {
  name: string;
  color: string;
  /** Y values; `null` is a blank cell (a gap in line charts). */
  values: (number | null)[];
  /** Display text of each value (cell text), used for data labels. */
  labels?: string[];
  /** X values for scatter charts. */
  xValues?: (number | null)[];
  /** Per-point colours (pie slices, varied column colours). */
  pointColors?: string[];
};

/** Everything the renderer needs to draw one chart. */
export type ChartRenderModel = {
  type: ChartType;
  grouping?: ChartGrouping;
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  legend?: ChartLegendPosition;
  dataLabels?: boolean;
  /** Major gridlines on the value axis (default true). */
  gridlines?: boolean;
  /** Point markers on line and scatter charts (default true). */
  markers?: boolean;
  /** Scatter charts: connect points with lines. */
  scatterLines?: boolean;
  /** Each point of a single-series chart gets its own colour. */
  varyColors?: boolean;
  valueAxis?: ChartValueAxisOptions;
  categories: string[];
  series: ChartRenderSeries[];
};

/** Colours for chart chrome; series colours come from the model. */
export type ChartTheme = {
  background: string;
  border: string;
  text: string;
  mutedText: string;
  gridline: string;
  axisLine: string;
  /** Doughnut hole, pie slice separators. */
  sliceSeparator: string;
  fontFamily: string;
};

// ---------------------------------------------------------------------------
// Legacy single-series bar renderer types (kept for the image fallback path of
// the xlsx importer).
// ---------------------------------------------------------------------------

export type ChartSeriesPoint = {
  label: string;
  value: number;
  color: string;
};

export type ChartRenderOptions = {
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  valueAxis?: ChartValueAxisOptions;
};

/** Office accent palette used for Excel chart defaults / varyColors. */
export const DEFAULT_CHART_COLORS = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];

/**
 * Excel cycles the six accents and then darker / lighter variants of them;
 * this extended list keeps many-series charts distinguishable.
 */
export const EXTENDED_CHART_COLORS = [
  ...DEFAULT_CHART_COLORS,
  "#264478",
  "#9E480E",
  "#636363",
  "#997300",
  "#255E91",
  "#43682B",
  "#698ED0",
  "#F1975A",
  "#B7B7B7",
  "#FFCD33",
  "#7CAFDD",
  "#8CC168",
];

export function chartPaletteColor(index: number) {
  return EXTENDED_CHART_COLORS[
    ((index % EXTENDED_CHART_COLORS.length) + EXTENDED_CHART_COLORS.length) %
      EXTENDED_CHART_COLORS.length
  ];
}
