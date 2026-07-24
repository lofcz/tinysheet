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
  /** category = expand value/category ranges into bars; series = one bar per ser */
  mode: "category" | "series";
};

export type FortuneChartSpec = {
  type: "bar";
  width: number;
  height: number;
  series: FortuneChartSeriesSpec[];
};

export type ChartCellValue = {
  display: string;
  numeric: number | null;
};

export type ChartCellResolver = (reference: string) => ChartCellValue[];
