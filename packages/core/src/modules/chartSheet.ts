/**
 * Chart sheets (Excel's Move Chart › New sheet): a sheet that holds one
 * chart and no cells. It has its own tab; the chart fills the window and
 * cannot be moved or sized on it; Move Chart › Object in puts the chart on
 * a worksheet again and removes the chart sheet (Excel).
 *
 * A chart sheet is a sheet with `chartSheet: true` whose `charts` hold its
 * chart (its stored size is the page, 10 in × 7.5 in landscape less the
 * margins); gridlines and headings are off so nothing of a grid shows.
 * In xlsx it is a real chartsheet part (xl/chartsheets/sheetN.xml).
 */
import type { Context } from "../context";
import type { Settings } from "../settings";
import type { Sheet } from "../types";
import { getSheetIndex } from "../utils";
import { findChart, moveChartToSheet, type Chart } from "./chart";
import { addSheet, deleteSheet } from "./sheet";

/** The chart page of a chart sheet (landscape Letter less margins), px. */
export const CHART_SHEET_WIDTH = 864;
export const CHART_SHEET_HEIGHT = 624;

export function isChartSheet(
  sheet: Pick<Sheet, "chartSheet"> | null | undefined
) {
  return !!sheet?.chartSheet;
}

/** The chart of a chart sheet (its first chart). */
export function chartSheetChart(
  sheet: Sheet | null | undefined
): Chart | undefined {
  return isChartSheet(sheet) ? sheet!.charts?.[0] : undefined;
}

/** Whether the current sheet is a chart sheet. */
export function onChartSheet(ctx: Context) {
  const i = getSheetIndex(ctx, ctx.currentSheetId);
  return i != null && isChartSheet(ctx.luckysheetfile[i]);
}

/**
 * Move Chart › New sheet: a chart sheet named `name`, placed before the
 * sheet the chart was on, with the chart selected. Returns the new sheet's
 * id (to activate), or null.
 */
export function moveChartToNewSheet(
  ctx: Context,
  settings: Required<Settings> | undefined,
  chartId: string,
  name: string
): string | null {
  const found = findChart(ctx, chartId);
  if (!found || !name.trim()) return null;
  const from = found.sheet;
  const id = settings?.generateSheetId?.() ?? `chart_sheet_${Date.now()}`;
  const order =
    typeof from.order === "number"
      ? from.order
      : ctx.luckysheetfile.indexOf(from);
  const before = ctx.luckysheetfile.length;
  // the id is passed so addSheet does not switch sheets itself: the caller
  // shows the new sheet (the React layer's sheet activation)
  addSheet(ctx, settings, id, false, name, {
    name,
    id,
    order,
    status: 0,
    row: ctx.defaultrowNum,
    column: ctx.defaultcolumnNum,
    config: {},
    zoomRatio: 1,
    chartSheet: true,
    showGridLines: 0,
    showRowColHeaders: false,
    // chart sheets print landscape (Excel's default for them)
    pageSetup: { orientation: "landscape" },
  } as Sheet);
  if (ctx.luckysheetfile.length === before) return null;
  const sheet = ctx.luckysheetfile.find((s) => s.id === id);
  if (!sheet) return null;
  const chart = moveChartToSheet(ctx, chartId, id, {
    left: 0,
    top: 0,
    width: CHART_SHEET_WIDTH,
    height: CHART_SHEET_HEIGHT,
  });
  if (!chart) return null;
  delete chart.anchor;
  chart.placement = "absolute";
  // a chart that left a chart sheet was the only thing on it: gone
  if (isChartSheet(from) && !from.charts?.length) {
    deleteSheet(ctx, from.id!);
  }
  ctx.activeChart = chartId;
  return id;
}

/**
 * Move Chart › Object in: the chart onto worksheet `sheetId` (at the
 * default place and size when it leaves a chart sheet, which is removed).
 */
export function moveChartToObject(
  ctx: Context,
  chartId: string,
  sheetId: string,
  box = { left: 64, top: 40, width: 480, height: 288 }
) {
  const found = findChart(ctx, chartId);
  if (!found) return null;
  const from = found.sheet;
  const leaving = isChartSheet(from);
  const chart = moveChartToSheet(
    ctx,
    chartId,
    sheetId,
    leaving ? box : undefined
  );
  if (!chart) return null;
  if (leaving) {
    chart.placement = "twoCell";
    if (!from.charts?.length) deleteSheet(ctx, from.id!);
  }
  return chart;
}
