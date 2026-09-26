/** Chart variants by key and inserting one (Insert › Charts). */
import { useCallback, useContext } from "react";
import { insertChart, locale } from "@lofcz/tinysheet-core";
import type { ChartLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { useAlert } from "../../../../hooks/useAlert";
import {
  applyChartTypeOption,
  CHART_TYPE_OPTIONS,
  ChartTypeOption,
} from "../../../Chart/chartTypes";

export const optionByKey = (key: string) =>
  CHART_TYPE_OPTIONS.find((o) => o.key === key) ?? CHART_TYPE_OPTIONS[0];

/** Name of a chart variant ("Clustered column"). */
export const optionLabel = (t: ChartLocale, key: string) =>
  (t as Record<string, string>)[key] ?? key;

/** Insert a chart of `option` from the selection (Excel: next to it). */
export function useInsertChart() {
  const { context, setContext } = useContext(WorkbookContext);
  const { showAlert } = useAlert();
  const t = locale(context).chart;
  return useCallback(
    (option: ChartTypeOption) => {
      if (context.allowEdit === false) return;
      if (!context.luckysheet_select_save?.length) {
        showAlert(t.noData, "ok");
        return;
      }
      setContext((ctx) => {
        const chart = insertChart(ctx, {
          type: option.type,
          grouping: option.grouping,
          markers: option.markers,
          comboSecondary: option.combo === "columnLineSecondary",
        });
        if (chart) applyChartTypeOption(chart, option);
      });
    },
    [
      context.allowEdit,
      context.luckysheet_select_save,
      setContext,
      showAlert,
      t,
    ]
  );
}
