import type { Chart } from "@lofcz/tinysheet-core";

/**
 * In-page chart clipboard. Copying a chart writes a marker string to the
 * system clipboard (plus an SVG image as HTML for other apps) and keeps the
 * chart here; a paste whose text is that marker pastes the chart.
 */
let current: { marker: string; chart: Chart } | null = null;

const PREFIX = "tinysheet-chart:";

export function setChartClipboard(chart: Chart) {
  const marker = `${PREFIX}${chart.id}:${Date.now().toString(36)}`;
  current = { marker, chart: JSON.parse(JSON.stringify(chart)) };
  return marker;
}

/** The copied chart when `text` is the marker of the latest chart copy. */
export function getChartClipboard(text: string | null | undefined) {
  if (!current || !text || text.trim() !== current.marker) return null;
  return current.chart;
}
