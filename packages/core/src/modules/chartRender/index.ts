export * from "./types";
export * from "./axis";
export * from "./theme";
export * from "./presets";
export {
  escapeXml,
  roundSvgNumber,
  svgToDataUri,
  renderEmptyChartSvg,
  renderBarChartSvg,
  renderChartSvgFromSeries,
} from "./legacy";
export {
  renderChartSvg,
  hasChartData,
  estimateTextWidth,
  formatChartNumber,
} from "./render";
export { histogramBars } from "./special";
export {
  fitTrendline,
  computeErrorAmounts,
  computeHistogramBins,
  formatCoefficient,
  sampleStdDev,
  solveLinearSystem,
} from "./stats";
export type { TrendlineFit, ErrorAmount, HistogramBin } from "./stats";
