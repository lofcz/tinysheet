import React, { useContext, useMemo } from "react";
import { Chart, renderChartToSvg } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/**
 * A chart drawn small (gallery tiles: Quick Layout, Chart Styles). It is
 * rendered `detail` times larger and scaled down, so the text of a tiny
 * thumbnail stays proportionate. The renderer escapes every text.
 */
export const ChartThumb: React.FC<{
  chart: Chart;
  width: number;
  height: number;
  detail?: number;
  className?: string;
}> = ({ chart, width, height, detail = 2.4, className }) => {
  const { context } = useContext(WorkbookContext);
  const theme = context.theme || "light";
  const svg = useMemo(
    () =>
      renderChartToSvg(
        { luckysheetfile: context.luckysheetfile, theme, lang: context.lang },
        chart,
        theme,
        { width: width * detail, height: height * detail }
      ).replace(
        /^<svg /,
        `<svg style="width:${width}px;height:${height}px;display:block" `
      ),
    [chart, context.luckysheetfile, context.lang, theme, width, height, detail]
  );
  return (
    <div
      className={`ts-chart-thumb${className ? ` ${className}` : ""}`}
      style={{ width, height }}
      aria-hidden="true"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default ChartThumb;
