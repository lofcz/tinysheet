/**
 * The SVG renderers live in core (`modules/chartRender`) so the sheet's chart
 * layer and the xlsx importer share them; re-exported for existing callers.
 */
export {
  escapeXml,
  renderBarChartSvg,
  renderChartSvgFromSeries,
  renderEmptyChartSvg,
  roundSvgNumber,
  svgToDataUri,
} from "@lofcz/tinysheet-core";
