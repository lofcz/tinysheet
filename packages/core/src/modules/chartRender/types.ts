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
  | "scatter"
  /** Per-series column / line / area, optionally on a secondary axis. */
  | "combo"
  | "radar"
  | "bubble"
  | "waterfall"
  | "histogram"
  | "pareto"
  | "funnel"
  | "stock";

/** How one series of a combo chart is drawn. */
export type ChartSeriesType = "column" | "line" | "area";

export type ChartTrendlineType =
  | "linear"
  | "exponential"
  | "logarithmic"
  | "polynomial"
  | "power"
  | "movingAverage";

export type ChartTrendline = {
  type: ChartTrendlineType;
  /** Polynomial order (2–6). */
  order?: number;
  /** Moving-average period (>= 2). */
  period?: number;
  /** Forecast forward / backward, in x units (categories for category charts). */
  forward?: number;
  backward?: number;
  /** Force the intercept (linear, polynomial, exponential). */
  intercept?: number;
  displayEquation?: boolean;
  displayRSquared?: boolean;
  /** Custom legend name. */
  name?: string;
  color?: string;
};

export type ChartErrorBarType =
  | "fixed"
  | "percentage"
  | "stdDev"
  | "stdErr"
  | "custom";

export type ChartErrorBars = {
  type: ChartErrorBarType;
  /** Fixed amount, percentage, or number of standard deviations. */
  value?: number;
  include?: "both" | "plus" | "minus";
  /** Draw end caps (default true). */
  endCap?: boolean;
  color?: string;
};

export type ChartDataLabelPosition =
  | "auto"
  | "center"
  | "insideEnd"
  | "insideBase"
  | "outsideEnd"
  | "above"
  | "below"
  | "left"
  | "right"
  | "bestFit";

export type ChartDataLabelOptions = {
  /** Default true (unless another part is chosen). */
  showValue?: boolean;
  showCategory?: boolean;
  showSeriesName?: boolean;
  /** Pie and doughnut: percentage of the total. */
  showPercent?: boolean;
  position?: ChartDataLabelPosition;
  /** Excel number format for values (`0.0`, `#,##0`, `0%`...). */
  numberFormat?: string;
  /** Between the parts (default ", "). */
  separator?: string;
};

export type ChartHistogramBinning = {
  /** auto (Scott's rule), a bin width, or a number of bins. */
  mode?: "auto" | "width" | "count";
  width?: number;
  count?: number;
  /** Values above go into one `> overflow` bin. */
  overflow?: number;
  /** Values at or below go into one `≤ underflow` bin. */
  underflow?: number;
};

export type ChartRadarStyle = "marker" | "line" | "filled";

/** High-low-close or open-high-low-close. */
export type ChartStockVariant = "hlc" | "ohlc";

/**
 * Visual preset applied on top of the theme (a chart style from the style
 * gallery).
 */
export type ChartStyleSpec = {
  /** Plot area fill (behind the gridlines). */
  plotFill?: string;
  /** Outline drawn around bars, slices, areas and bubbles. */
  seriesOutline?: string;
  seriesOutlineWidth?: number;
  /** Opacity of area / bar fills. */
  fillOpacity?: number;
  /** Dashed gridlines. */
  gridDash?: boolean;
  titleBold?: boolean;
  /** Line series width. */
  lineWidth?: number;
  markerSize?: number;
  /** Gap between bars as a fraction of a bar (Excel's gap width / 100). */
  gapWidth?: number;
  /** Rounded bar ends. */
  barRadius?: number;
};

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
  /** Combo charts: how this series is drawn (default: the chart type). */
  type?: ChartSeriesType;
  /** Plot on the secondary value axis. */
  secondary?: boolean;
  /** Bubble sizes. */
  sizes?: (number | null)[];
  trendlines?: ChartTrendline[];
  errorBars?: ChartErrorBars & {
    /** Custom amounts, resolved from their ranges. */
    plusValues?: (number | null)[];
    minusValues?: (number | null)[];
  };
};

/** Localised legend texts of the renderer. */
export type ChartRenderLabels = {
  increase: string;
  decrease: string;
  total: string;
  cumulative: string;
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
  /** Secondary value axis bounds (combo charts). */
  secondaryValueAxis?: ChartValueAxisOptions;
  secondaryValueAxisTitle?: string;
  dataLabelOptions?: ChartDataLabelOptions;
  /** Histogram and Pareto bins. */
  binning?: ChartHistogramBinning;
  radarStyle?: ChartRadarStyle;
  stockVariant?: ChartStockVariant;
  /** Waterfall: indices of the points shown as totals. */
  waterfallTotals?: number[];
  /** Waterfall: connector lines between bars (default true). */
  waterfallConnectors?: boolean;
  /** Waterfall colours: increase, decrease, total. */
  waterfallColors?: [string, string, string];
  /** Size of the largest bubble in % of the default (default 100). */
  bubbleScale?: number;
  style?: ChartStyleSpec;
  labels?: Partial<ChartRenderLabels>;
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
