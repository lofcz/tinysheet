export type ChartSeriesPoint = {
  label: string;
  value: number;
  color: string;
};

export type FortuneChartSeriesSpec = {
  color: string;
  title?: string;
  titleRef?: string;
  categoryRef?: string;
  cachedCategories?: string[];
  valueRef?: string;
  cachedValues?: number[];
  /** Per-point colors from c:dPt, when present. */
  pointColors?: string[];
  /** category = expand value/category ranges into bars; series = one bar per ser */
  mode: "category" | "series";
};

/** Explicit value-axis overrides from c:valAx (c:scaling min/max, c:majorUnit). */
export type FortuneChartValueAxis = {
  min?: number;
  max?: number;
  majorUnit?: number;
};

export type FortuneChartSpec = {
  type: "bar";
  width: number;
  height: number;
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  valueAxis?: FortuneChartValueAxis;
  /**
   * When true (Excel default for single-series category charts), each category
   * gets a distinct palette color instead of the series fill.
   */
  varyColors?: boolean;
  series: FortuneChartSeriesSpec[];
};

export type ChartRenderOptions = {
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  valueAxis?: FortuneChartValueAxis;
};

export type ChartCellValue = {
  display: string;
  numeric: number | null;
};

export type ChartCellResolver = (reference: string) => ChartCellValue[];

/** Office accent palette used for Excel chart defaults / varyColors. */
export const DEFAULT_CHART_COLORS = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];
