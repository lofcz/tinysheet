import type { ChartRenderOptions, ChartSeriesPoint } from "./types";
import { computeAxisScale, formatAxisTick } from "./axis";

export {
  buildAxisTicks,
  computeAxisScale,
  computeAxisStep,
  computeNiceAxisMax,
  formatAxisTick,
  getTrueMinMax,
} from "./axis";
export type { AxisScale } from "./axis";

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function roundSvgNumber(value: number) {
  return (Math.round(value * 100) / 100).toString();
}

export function svgToDataUri(svg: string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function renderEmptyChartSvg(width: number, height: number) {
  const svgWidth = Math.max(1, Math.round(width));
  const svgHeight = Math.max(1, Math.round(height));

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    svgWidth +
    '" height="' +
    svgHeight +
    '" viewBox="0 0 ' +
    svgWidth +
    " " +
    svgHeight +
    '">' +
    '<rect x="0" y="0" width="' +
    svgWidth +
    '" height="' +
    svgHeight +
    '" fill="#ffffff" stroke="#d9d9d9"/>' +
    '<text x="' +
    svgWidth / 2 +
    '" y="' +
    svgHeight / 2 +
    '" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="14" fill="#666666">Chart</text>' +
    "</svg>"
  );
}

export function renderBarChartSvg(
  series: ChartSeriesPoint[],
  width: number,
  height: number,
  options: ChartRenderOptions = {}
) {
  const svgWidth = Math.max(1, Math.round(width));
  const svgHeight = Math.max(1, Math.round(height));
  const hasTitle = Boolean(options.title && options.title.trim());
  const hasValueAxisTitle = Boolean(
    options.valueAxisTitle && options.valueAxisTitle.trim()
  );
  const hasCategoryAxisTitle = Boolean(
    options.categoryAxisTitle && options.categoryAxisTitle.trim()
  );

  const marginLeft = Math.min(
    hasValueAxisTitle ? 58 : 44,
    svgWidth * (hasValueAxisTitle ? 0.22 : 0.18)
  );
  const marginRight = Math.min(120, Math.max(56, svgWidth * 0.22));
  const marginTop = Math.min(
    hasTitle ? 36 : 24,
    svgHeight * (hasTitle ? 0.16 : 0.12)
  );
  const marginBottom = Math.min(
    hasCategoryAxisTitle ? 48 : 40,
    Math.max(hasCategoryAxisTitle ? 32 : 24, svgHeight * 0.12)
  );
  const plotX = marginLeft;
  const plotY = marginTop;
  const plotWidth = Math.max(1, svgWidth - marginLeft - marginRight);
  const plotHeight = Math.max(1, svgHeight - marginTop - marginBottom);

  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (let i = 0; i < series.length; i++) {
    const v = series[i].value;
    if (!isFinite(v)) continue;
    dataMin = Math.min(dataMin, v);
    dataMax = Math.max(dataMax, v);
  }
  if (!isFinite(dataMin) || !isFinite(dataMax)) {
    dataMin = 0;
    dataMax = 1;
  }

  const scale = computeAxisScale(dataMin, dataMax, options.valueAxis);
  const axisMax = scale.max;
  const axisMin = scale.min;
  const axisSpan = axisMax - axisMin || 1;
  const ticks = scale.ticks;

  let body =
    '<rect x="0" y="0" width="' +
    svgWidth +
    '" height="' +
    svgHeight +
    '" fill="#ffffff" rx="4" ry="4"/>' +
    '<rect x="0.5" y="0.5" width="' +
    (svgWidth - 1) +
    '" height="' +
    (svgHeight - 1) +
    '" fill="none" stroke="#d9d9d9" rx="4" ry="4"/>';

  if (hasTitle) {
    body +=
      '<text x="' +
      roundSvgNumber(plotX + plotWidth / 2) +
      '" y="' +
      roundSvgNumber(Math.max(14, marginTop * 0.55)) +
      '" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#333333">' +
      escapeXml(options.title!.trim()) +
      "</text>";
  }

  if (hasValueAxisTitle) {
    const axisTitleX = 14;
    const axisTitleY = plotY + plotHeight / 2;
    body +=
      '<text x="' +
      roundSvgNumber(axisTitleX) +
      '" y="' +
      roundSvgNumber(axisTitleY) +
      '" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#666666" transform="rotate(-90 ' +
      roundSvgNumber(axisTitleX) +
      " " +
      roundSvgNumber(axisTitleY) +
      ')">' +
      escapeXml(options.valueAxisTitle!.trim()) +
      "</text>";
  }

  for (let i = 0; i < ticks.length; i++) {
    const tickValue = ticks[i];
    const y =
      plotY + plotHeight - ((tickValue - axisMin) / axisSpan) * plotHeight;
    body +=
      '<line x1="' +
      roundSvgNumber(plotX) +
      '" y1="' +
      roundSvgNumber(y) +
      '" x2="' +
      roundSvgNumber(plotX + plotWidth) +
      '" y2="' +
      roundSvgNumber(y) +
      '" stroke="#e6e6e6" stroke-width="1"/>' +
      '<text x="' +
      roundSvgNumber(plotX - 6) +
      '" y="' +
      roundSvgNumber(y + 4) +
      '" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#666666">' +
      formatAxisTick(tickValue, scale.step) +
      "</text>";
  }

  body +=
    '<line x1="' +
    roundSvgNumber(plotX) +
    '" y1="' +
    roundSvgNumber(plotY) +
    '" x2="' +
    roundSvgNumber(plotX) +
    '" y2="' +
    roundSvgNumber(plotY + plotHeight) +
    '" stroke="#666666" stroke-width="1"/>' +
    '<line x1="' +
    roundSvgNumber(plotX) +
    '" y1="' +
    roundSvgNumber(plotY + plotHeight) +
    '" x2="' +
    roundSvgNumber(plotX + plotWidth) +
    '" y2="' +
    roundSvgNumber(plotY + plotHeight) +
    '" stroke="#666666" stroke-width="1"/>';

  const gap = plotWidth / Math.max(1, series.length * 3 + 1);
  const barWidth = Math.max(6, gap * 1.5);
  for (let i = 0; i < series.length; i++) {
    const value = series[i].value;
    const barHeight = ((value - axisMin) / axisSpan) * plotHeight;
    const x = plotX + gap + i * (barWidth + gap);
    const y = plotY + plotHeight - Math.max(0, barHeight);
    body +=
      '<rect x="' +
      roundSvgNumber(x) +
      '" y="' +
      roundSvgNumber(y) +
      '" width="' +
      roundSvgNumber(barWidth) +
      '" height="' +
      roundSvgNumber(Math.max(0, barHeight)) +
      '" fill="' +
      escapeXml(series[i].color) +
      '"/>';
  }

  if (hasCategoryAxisTitle) {
    body +=
      '<text x="' +
      roundSvgNumber(plotX + plotWidth / 2) +
      '" y="' +
      roundSvgNumber(svgHeight - 10) +
      '" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#666666">' +
      escapeXml(options.categoryAxisTitle!.trim()) +
      "</text>";
  }

  const legendX = plotX + plotWidth + 18;
  const legendY = plotY + 12;
  for (let i = 0; i < series.length; i++) {
    const y = legendY + i * 18;
    body +=
      '<rect x="' +
      roundSvgNumber(legendX) +
      '" y="' +
      roundSvgNumber(y - 9) +
      '" width="10" height="10" fill="' +
      escapeXml(series[i].color) +
      '"/>' +
      '<text x="' +
      roundSvgNumber(legendX + 16) +
      '" y="' +
      roundSvgNumber(y) +
      '" font-family="Arial, sans-serif" font-size="11" fill="#333333">' +
      escapeXml(series[i].label) +
      "</text>";
  }

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    svgWidth +
    '" height="' +
    svgHeight +
    '" viewBox="0 0 ' +
    svgWidth +
    " " +
    svgHeight +
    '">' +
    body +
    "</svg>"
  );
}

export function renderChartSvgFromSeries(
  series: ChartSeriesPoint[],
  width: number,
  height: number,
  options: ChartRenderOptions = {}
) {
  if (series.length === 0) {
    return renderEmptyChartSvg(width, height);
  }
  return renderBarChartSvg(series, width, height, options);
}
