import type { ChartSeriesPoint } from "./types";

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
  height: number
) {
  const svgWidth = Math.max(1, Math.round(width));
  const svgHeight = Math.max(1, Math.round(height));
  const marginLeft = Math.min(44, svgWidth * 0.18);
  const marginRight = Math.min(120, Math.max(56, svgWidth * 0.22));
  const marginTop = Math.min(24, svgHeight * 0.12);
  const marginBottom = Math.min(40, Math.max(24, svgHeight * 0.12));
  const plotX = marginLeft;
  const plotY = marginTop;
  const plotWidth = Math.max(1, svgWidth - marginLeft - marginRight);
  const plotHeight = Math.max(1, svgHeight - marginTop - marginBottom);
  let maxValue = 1;

  for (let i = 0; i < series.length; i++) {
    maxValue = Math.max(maxValue, series[i].value);
  }

  let body =
    '<rect x="0" y="0" width="' +
    svgWidth +
    '" height="' +
    svgHeight +
    '" fill="#ffffff"/>' +
    '<rect x="0.5" y="0.5" width="' +
    (svgWidth - 1) +
    '" height="' +
    (svgHeight - 1) +
    '" fill="none" stroke="#d9d9d9"/>';

  for (let tick = 0; tick <= 4; tick++) {
    const y = plotY + plotHeight - (plotHeight * tick) / 4;
    const tickValue = Math.round((maxValue * tick) / 4);
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
      tickValue +
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
    const barHeight = (series[i].value / maxValue) * plotHeight;
    const x = plotX + gap + i * (barWidth + gap);
    const y = plotY + plotHeight - barHeight;
    body +=
      '<rect x="' +
      roundSvgNumber(x) +
      '" y="' +
      roundSvgNumber(y) +
      '" width="' +
      roundSvgNumber(barWidth) +
      '" height="' +
      roundSvgNumber(barHeight) +
      '" fill="' +
      escapeXml(series[i].color) +
      '"/>';
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
  height: number
) {
  if (series.length === 0) {
    return renderEmptyChartSvg(width, height);
  }
  return renderBarChartSvg(series, width, height);
}
