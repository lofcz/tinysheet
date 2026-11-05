import type { Chart } from "@lofcz/tinysheet-core";
import { anchorFor } from "../chart/exportXlsx";
import { chartToXml, USER_SHAPES_RID } from "../chart/chartXml";
import { isChartExType } from "../chart/chartEx";
import {
  chartUserShapesXml,
  CT_CHART_SHAPES,
  REL_USER_SHAPES,
} from "../chart/userShapes";
import type { SheetExportContext } from "./buildWorkbook";

/** Keep TinySheet's complete chart model while the workbook writer owns its package graph. */
export function writeCharts(ctx: SheetExportContext) {
  if (ctx.sheet.chartSheet) return;
  const charts: Chart[] = ctx.sheet.charts ?? [];
  for (const chart of charts) {
    // Office 2016 chart extensions and chart sheets still use their existing writers.
    if (isChartExType(chart.type)) continue;
    (ctx.post.features ||= {})["native-charts"] = true;
    const geometry = anchorFor(ctx.sheet, chart);
    const point = (p: typeof geometry.from) => ({
      col: p.col.index,
      row: p.row.index,
      colOff: Math.round(p.col.offsetPx * 9525),
      rowOff: Math.round(p.row.offsetPx * 9525),
    });
    const shapes = chartUserShapesXml(chart);
    ctx.worksheet.addChartPart(
      {
        xml: chartToXml({ luckysheetfile: ctx.sheets }, chart),
        name: chart.title || "Chart",
        ...(shapes
          ? {
              relatedParts: [
                {
                  relationshipId: USER_SHAPES_RID,
                  relationshipType: REL_USER_SHAPES,
                  contentType: CT_CHART_SHAPES,
                  xml: shapes,
                },
              ],
            }
          : {}),
      },
      {
        from: point(geometry.from),
        to: point(geometry.to),
        editAs: chart.placement ?? "twoCell",
      }
    );
  }
}
