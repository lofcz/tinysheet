/**
 * The chart dialogs opened from the Chart Design tab, the chart's context
 * menu and the buttons next to it: Select Data Source (./SelectDataDialog),
 * Change Chart Type (the Insert Chart dialog on the chart), Move Chart and
 * Excel's "Add … based on Series" pickers. Mounted once per workbook.
 */
import React, { useCallback, useContext, useState } from "react";
import _ from "lodash";
import {
  addSheet,
  applyChartElement,
  Chart,
  chartToolsLocale,
  findChart,
  getChartDataRange,
  moveChartToSheet,
  resolveChartModel,
  setChartType,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import { ModalContext } from "../../../context/modal";
import { Button, Dialog, Radio, Select } from "../../ui";
import { activateSheetTab } from "../../SheetTab/activate";
import { InsertChartDialog } from "../../Ribbon/commands/insert/chartDialog";
import { optionByKey } from "../../Ribbon/commands/insert/chartCommon";
import { applyChartTypeOption, chartTypeOptionFor } from "../chartTypes";
import SelectDataDialog from "./SelectDataDialog";
import { closeChartDialog, useChartDialog } from "./store";
import "./dialogs.css";

/** The chart `chart` would become as variant `key` (Change Chart Type). */
export function chartAsType(
  ctx: Parameters<typeof setChartType>[0],
  chart: Chart,
  key: string
): Chart {
  const copy: Chart = _.cloneDeep(chart);
  const found = findChart(ctx, chart.id);
  const option = optionByKey(key);
  // run the model change on a copy of the chart's sheet
  const fake = {
    ...ctx,
    luckysheetfile: ctx.luckysheetfile.map((s) =>
      s.id === found?.sheet.id
        ? {
            ...s,
            charts: (s.charts ?? []).map((c) => (c.id === copy.id ? copy : c)),
          }
        : s
    ),
  };
  setChartType(fake, copy.id, option.type, option.grouping);
  applyChartTypeOption(copy, option);
  return copy;
}

/**
 * Change Chart Type: the Insert Chart dialog on the chart's data, All
 * Charts first with the chart's own variant selected.
 */
export function useChangeChartTypeDialog() {
  const { context, setContext } = useContext(WorkbookContext);
  const { showModal, hideModal } = useContext(ModalContext);
  return useCallback(
    (chartId: string) => {
      const found = findChart(context, chartId);
      if (!found) return;
      const t = chartToolsLocale(context);
      const { chart } = found;
      showModal(
        <InsertChartDialog
          initialTab="all"
          initialKey={chartTypeOptionFor(chart).key as string}
          onClose={hideModal}
          change={{
            title: t.changeType.title,
            source: getChartDataRange(chart) ?? chart.source ?? null,
            previewFor: (key, width, height) => ({
              ...chartAsType(context, chart, key),
              left: 0,
              top: 0,
              width,
              height,
            }),
            onPick: (key) =>
              setContext((ctx) => {
                const f = findChart(ctx, chartId);
                if (!f) return;
                const option = optionByKey(key);
                setChartType(ctx, chartId, option.type, option.grouping);
                applyChartTypeOption(f.chart, option);
              }),
          }}
        />
      );
    },
    [context, hideModal, setContext, showModal]
  );
}

/** Move Chart: New sheet (a sheet holding only the chart) or Object in. */
const MoveChartDialog: React.FC<{ chartId: string }> = ({ chartId }) => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const found = findChart(context, chartId);
  const names = context.luckysheetfile.map((s) => s.name);
  const [mode, setMode] = useState<"new" | "object">("object");
  const [name, setName] = useState(() => {
    for (let n = 1; ; n += 1) {
      const candidate = t.moveChart.defaultName.replace("{n}", String(n));
      if (!names.includes(candidate)) return candidate;
    }
  });
  const [target, setTarget] = useState(found?.sheet.id ?? "");
  if (!found) return null;
  const taken = mode === "new" && names.includes(name.trim());
  const ok = () => {
    if (mode === "new") {
      const sheetName = name.trim();
      if (!sheetName || taken) return;
      setContext((ctx) => {
        const before = new Set(ctx.luckysheetfile.map((s) => s.id));
        addSheet(ctx, settings, undefined, false, sheetName);
        const sheet = ctx.luckysheetfile.find((s) => !before.has(s.id));
        if (!sheet?.id) return;
        // a chart sheet: the chart fills the window, no gridlines
        sheet.showGridLines = 0;
        const zoom = ctx.zoomRatio || 1;
        const width = Math.max(320, (ctx.cellmainWidth || 900) / zoom - 24);
        const height = Math.max(240, (ctx.cellmainHeight || 520) / zoom - 24);
        moveChartToSheet(ctx, chartId, sheet.id, {
          left: 8,
          top: 8,
          width,
          height,
        });
        activateSheetTab(ctx, sheet.id, refs.globalCache);
        ctx.activeChart = chartId;
      });
    } else if (target && target !== found.sheet.id) {
      setContext((ctx) => {
        moveChartToSheet(ctx, chartId, target);
        activateSheetTab(ctx, target, refs.globalCache);
        ctx.activeChart = chartId;
      });
    }
    closeChartDialog();
  };
  return (
    <Dialog
      open
      title={t.moveChart.title}
      onClose={closeChartDialog}
      width={460}
      className="ts-chart-data-dialog"
      data-testid="chart-move"
      footer={
        <>
          <Button onClick={closeChartDialog}>{t.selectData.cancel}</Button>
          <Button variant="primary" onClick={ok} disabled={taken}>
            {t.selectData.ok}
          </Button>
        </>
      }
    >
      <p className="ts-move-chart-prompt">{t.moveChart.prompt}</p>
      <div role="radiogroup" aria-label={t.moveChart.prompt}>
        <div className="ts-move-chart-row">
          <Radio
            name="move-chart"
            checked={mode === "new"}
            onChange={() => setMode("new")}
            label={t.moveChart.newSheet}
          />
          <input
            type="text"
            className="ts-input"
            aria-label={t.moveChart.newSheet}
            value={name}
            aria-invalid={taken || undefined}
            onMouseDown={() => setMode("new")}
            onChange={(e) => {
              setMode("new");
              setName(e.target.value);
            }}
          />
        </div>
        <div className="ts-move-chart-row">
          <Radio
            name="move-chart"
            checked={mode === "object"}
            onChange={() => setMode("object")}
            label={t.moveChart.objectIn}
          />
          <Select
            aria-label={t.moveChart.objectIn}
            value={target}
            options={context.luckysheetfile
              .filter((s) => s.hide !== 1)
              .map((s) => ({ value: s.id!, label: s.name }))}
            onChange={(v) => {
              setMode("object");
              setTarget(v);
            }}
          />
        </div>
      </div>
      {taken && (
        <p className="ts-chart-data-error" role="alert">
          {t.moveChart.nameTaken}
        </p>
      )}
    </Dialog>
  );
};

/** Excel's "Add a Trendline based on Series:" (and error bars). */
const SeriesPickerDialog: React.FC<{
  chartId: string;
  element: "trendline" | "errorBars";
  option: string;
}> = ({ chartId, element, option }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const found = findChart(context, chartId);
  const [picked, setPicked] = useState(0);
  if (!found) return null;
  const model = resolveChartModel(context, found.chart);
  const ok = () => {
    setContext((ctx) => {
      const f = findChart(ctx, chartId);
      if (f) applyChartElement(f.chart, element, option, undefined, [picked]);
    });
    closeChartDialog();
  };
  return (
    <Dialog
      open
      title={
        element === "trendline"
          ? t.elements.addTrendlineTitle
          : t.elements.addErrorBarsTitle
      }
      onClose={closeChartDialog}
      width={340}
      className="ts-chart-data-dialog"
      data-testid="chart-series-picker"
      footer={
        <>
          <Button onClick={closeChartDialog}>{t.selectData.cancel}</Button>
          <Button variant="primary" onClick={ok}>
            {t.selectData.ok}
          </Button>
        </>
      }
    >
      <p className="ts-move-chart-prompt">
        {element === "trendline"
          ? t.elements.basedOnSeries
          : t.elements.errorBarsBasedOnSeries}
      </p>
      <div
        className="ts-chart-data-list"
        role="listbox"
        aria-label={t.elements.basedOnSeries}
      >
        {model.series.map((s, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            role="option"
            aria-selected={i === picked}
            tabIndex={i === picked ? 0 : -1}
            className="ts-chart-data-item"
            onClick={() => setPicked(i)}
            onDoubleClick={ok}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown")
                setPicked(Math.min(model.series.length - 1, i + 1));
              if (e.key === "ArrowUp") setPicked(Math.max(0, i - 1));
            }}
          >
            <span className="ts-chart-data-item-label">{s.name}</span>
          </div>
        ))}
      </div>
    </Dialog>
  );
};

/** Renders the open chart dialog. */
export const ChartDialogs: React.FC = () => {
  const request = useChartDialog();
  if (!request) return null;
  switch (request.kind) {
    case "selectData":
      return (
        <SelectDataDialog
          key={request.chartId}
          chartId={request.chartId}
          onDone={closeChartDialog}
        />
      );
    case "moveChart":
      return <MoveChartDialog chartId={request.chartId} />;
    case "seriesPicker":
      return (
        <SeriesPickerDialog
          chartId={request.chartId}
          element={request.element}
          option={request.option}
        />
      );
    default:
      return null;
  }
};

export { openChartDialog, closeChartDialog } from "./store";
export default ChartDialogs;
