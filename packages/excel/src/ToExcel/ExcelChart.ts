import type { Chart } from "@lofcz/tinysheet-core";
import { anchorFor } from "../chart/exportXlsx";
import { chartToXml, USER_SHAPES_RID } from "../chart/chartXml";
import { isChartExType, chartExToXml } from "../chart/chartEx";
import {
  chartUserShapesXml,
  CT_CHART_SHAPES,
  REL_USER_SHAPES,
} from "../chart/userShapes";
import type { SheetExportContext } from "./buildWorkbook";

/** Keep TinySheet's complete chart model while the workbook writer owns its package graph. */
export function writeCharts(ctx: SheetExportContext) {
  if (ctx.sheet.chartSheet) {
    ctx.worksheet.kind = "chartsheet";
    ctx.worksheet.pageSetup.orientation ??= "landscape";
  }
  const charts: Chart[] = ctx.sheet.charts ?? [];
  for (const chart of charts) {
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
        xml: isChartExType(chart.type)
          ? chartExToXml({ luckysheetfile: ctx.sheets }, chart)
          : chartToXml({ luckysheetfile: ctx.sheets }, chart),
        name: chart.id || chart.title || "Chart",
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
      ctx.sheet.chartSheet
        ? {
            from: { col: 0, row: 0 },
            ext: {
              cx: Math.round(chart.width * 9525),
              cy: Math.round(chart.height * 9525),
            },
          }
        : {
            from: point(geometry.from),
            to: point(geometry.to),
            editAs: chart.placement ?? "twoCell",
          }
    );
  }
}
