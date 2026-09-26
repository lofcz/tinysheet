/**
 * The formula bar while a chart series is selected (Excel): it shows the
 * series' `=SERIES(name, categories, values, order)` formula; editing it
 * and pressing Enter reassigns the series (Escape restores the text), one
 * undo step.
 */
import React, { useContext, useEffect, useState } from "react";
import {
  applySeriesFormula,
  findChart,
  moveChartSeries,
  parseSeriesFormula,
  seriesFormula,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/** Index of the selected series of the active chart, else null. */
export function useSelectedSeries() {
  const { context } = useContext(WorkbookContext);
  const m = /^series:(\d+)$/.exec(context.chartElement ?? "");
  if (!m || !context.activeChart) return null;
  const found = findChart(context, context.activeChart);
  const index = Number(m[1]);
  if (!found?.chart.series[index]) return null;
  return { chartId: found.chart.id, sheetId: found.sheet.id!, index };
}

export const SeriesFormulaBar: React.FC<{
  chartId: string;
  sheetId: string;
  index: number;
}> = ({ chartId, sheetId, index }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const found = findChart(context, chartId);
  const formula = found ? seriesFormula(context, found.chart, index) : "";
  const [text, setText] = useState(formula);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(formula);
    setInvalid(false);
  }, [formula]);
  const readonly = context.allowEdit === false;
  const commit = () => {
    const parsed = parseSeriesFormula(context, text, sheetId);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setContext((ctx) => {
      const f = findChart(ctx, chartId);
      const s = f?.chart.series[index];
      if (!f || !s) return;
      applySeriesFormula(s, parsed);
      // the order argument moves the series (Excel)
      const to = Math.min(f.chart.series.length, parsed.order) - 1;
      if (to !== index) {
        moveChartSeries(f.chart, index, to);
        ctx.chartElement = `series:${to}`;
      }
    });
    setInvalid(false);
    // Enter hands the keyboard back to the sheet (Excel)
    refs.cellInput.current?.focus({ preventScroll: true });
  };
  return (
    <input
      className={`fortune-series-formula${
        invalid ? " fortune-series-formula--invalid" : ""
      }`}
      aria-label="Series formula"
      aria-invalid={invalid || undefined}
      data-testid="series-formula"
      value={text}
      readOnly={readonly}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setText(formula);
          setInvalid(false);
          refs.cellInput.current?.focus({ preventScroll: true });
        }
      }}
    />
  );
};

export default SeriesFormulaBar;
