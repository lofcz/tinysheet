/**
 * Excel's Insert Chart dialog (Insert › Recommended Charts, "More Charts…"
 * in the chart galleries): a Recommended Charts tab with the charts that
 * suit the selected data, an All Charts tab with every type by family, and
 * a live preview of the selection drawn by the chart renderer.
 */
import React, { useCallback, useContext, useMemo, useState } from "react";
import _ from "lodash";
import {
  applyChartTypeDefaults,
  chartHasAxes,
  chartHasGrouping,
  detectChartSeries,
  getChartSourceFromSelection,
  locale,
  renderChartToSvg,
} from "@lofcz/tinysheet-core";
import type { Chart, ChartRange, Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { ModalContext } from "../../../../context/modal";
import { Button, DialogShell, Tabs } from "../../../ui";
import { applyChartTypeOption } from "../../../Chart/chartTypes";
import { useTabsText } from "../tabsCommon";
import { ChartGlyph } from "./chartGlyphs";
import { optionByKey, optionLabel, useInsertChart } from "./chartCommon";

/** Families of the All Charts tab and their variants. */
const ALL_FAMILIES: { id: string; keys: string[] }[] = [
  { id: "column", keys: ["columnClustered", "columnStacked", "columnPercent"] },
  { id: "line", keys: ["line", "lineMarkers", "lineStacked"] },
  { id: "pie", keys: ["pie", "doughnut"] },
  { id: "bar", keys: ["barClustered", "barStacked", "barPercent"] },
  { id: "area", keys: ["area", "areaStacked", "areaPercent"] },
  { id: "scatter", keys: ["scatter", "scatterLines", "bubble"] },
  { id: "stock", keys: ["stockHLC", "stockOHLC"] },
  { id: "radar", keys: ["radar", "radarMarkers", "radarFilled"] },
  { id: "histogram", keys: ["histogram", "pareto"] },
  { id: "waterfall", keys: ["waterfall"] },
  { id: "funnel", keys: ["funnel"] },
  {
    id: "combo",
    keys: ["comboColumnLine", "comboColumnLineSecondary", "comboAreaColumn"],
  },
];

const familyOf = (key: string) =>
  ALL_FAMILIES.find((f) => f.keys.includes(key)) ?? ALL_FAMILIES[0];

/** The chart `key` would insert for `source`, without inserting it. */
export function previewChart(
  ctx: Context,
  key: string,
  source: ChartRange | null,
  width: number,
  height: number
): Chart {
  const option = optionByKey(key);
  const { type } = option;
  const detected = source
    ? detectChartSeries(ctx, source, { type })
    : { series: [], seriesInRows: false };
  const xy = type === "scatter" || type === "bubble";
  const chart: Chart = {
    id: `preview-${key}`,
    type,
    ...(chartHasGrouping(type)
      ? { grouping: option.grouping ?? "clustered" }
      : {}),
    source,
    seriesInRows: detected.seriesInRows,
    series: _.cloneDeep(detected.series),
    legend: "bottom",
    gridlines: chartHasAxes(type),
    ...(type === "line" || xy || type === "combo"
      ? { markers: option.markers ?? true }
      : {}),
    left: 0,
    top: 0,
    width,
    height,
  };
  applyChartTypeDefaults(chart, true, option.combo === "columnLineSecondary");
  applyChartTypeOption(chart, option);
  return chart;
}

/**
 * Chart types that suit the data, best first (Excel's Recommended Charts):
 * one short series → column and pie; many points → lines; numeric first
 * column → scatter; several series → clustered columns and bars.
 */
export function recommendChartKeys(
  ctx: Context,
  source: ChartRange | null
): string[] {
  if (!source) return ["columnClustered", "barClustered", "lineMarkers", "pie"];
  const detected = detectChartSeries(ctx, source, { type: "column" });
  const n = detected.series.length;
  const first = detected.series[0]?.values;
  const points = first
    ? Math.max(
        first.row[1] - first.row[0] + 1,
        first.column[1] - first.column[0] + 1
      )
    : 0;
  if (n === 0) return ["columnClustered", "barClustered", "lineMarkers", "pie"];
  if (n >= 2 && !detected.headerColumn && points > 1) {
    return ["scatter", "scatterLines", "lineMarkers", "columnClustered"];
  }
  if (n === 1 && points <= 8) {
    return [
      "columnClustered",
      "pie",
      "barClustered",
      "doughnut",
      "lineMarkers",
      "funnel",
    ];
  }
  if (n === 1) {
    return ["line", "columnClustered", "area", "barClustered", "histogram"];
  }
  if (points > 12) {
    return [
      "line",
      "lineMarkers",
      "columnClustered",
      "area",
      "areaStacked",
      "comboColumnLine",
    ];
  }
  return [
    "columnClustered",
    "barClustered",
    "lineMarkers",
    "columnStacked",
    "comboColumnLine",
    "radarMarkers",
  ];
}

/**
 * A chart rendered to SVG (the renderer escapes every text). `detail` > 1
 * draws it that much larger and shrinks it to fit: smaller text, so a
 * thumbnail's axis labels do not crowd.
 */
const ChartPreview: React.FC<{
  chart: Chart;
  width: number;
  height: number;
  detail?: number;
  className?: string;
}> = ({ chart, width, height, detail = 1, className }) => {
  const { context } = useContext(WorkbookContext);
  const theme = context.theme || "light";
  const svg = useMemo(
    () =>
      renderChartToSvg(
        { luckysheetfile: context.luckysheetfile, theme, lang: context.lang },
        chart,
        theme,
        { width: width * detail, height: height * detail }
      ),
    [chart, context.luckysheetfile, context.lang, theme, width, height, detail]
  );
  return (
    <div
      className={`ts-chart-svg${className ? ` ${className}` : ""}`}
      style={{ width, height }}
      aria-hidden="true"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

const PREVIEW_W = 440;
const PREVIEW_H = 270;
const THUMB_W = 168;
const THUMB_H = 104;

export const InsertChartDialog: React.FC<{
  initialTab?: "recommended" | "all";
  initialKey?: string;
  onClose: () => void;
}> = ({ initialTab = "recommended", initialKey, onClose }) => {
  const { context } = useContext(WorkbookContext);
  const tt = useTabsText().chartDialog;
  const tc = locale(context).chart;
  const insert = useInsertChart();
  // the data and the recommendations of the selection when the dialog opened
  const source = useMemo(
    () => getChartSourceFromSelection(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const recommended = useMemo(
    () => recommendChartKeys(context, source),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source]
  );
  const hasData = useMemo(
    () =>
      !!source &&
      detectChartSeries(context, source, { type: "column" }).series.length > 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source]
  );
  const [tab, setTab] = useState<"recommended" | "all">(initialTab);
  const [key, setKey] = useState<string>(
    initialKey ?? (initialTab === "all" ? "columnClustered" : recommended[0])
  );
  const [family, setFamily] = useState(familyOf(key).id);

  const preview = useMemo(
    () => previewChart(context, key, source, PREVIEW_W, PREVIEW_H),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, source]
  );
  const thumbs = useMemo(
    () =>
      recommended.map((k) => ({
        key: k,
        chart: {
          ...previewChart(context, k, source, THUMB_W * 1.6, THUMB_H * 1.6),
          legend: "none" as const,
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recommended, source]
  );

  const confirm = useCallback(() => {
    onClose();
    insert(optionByKey(key));
  }, [insert, key, onClose]);

  const switchTab = (next: string) => {
    const id = next as "recommended" | "all";
    setTab(id);
    if (id === "recommended" && !recommended.includes(key)) {
      setKey(recommended[0]);
    } else if (id === "all") {
      setFamily(familyOf(key).id);
    }
  };

  // Up / Down move through a vertical list of options
  const listKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key))
      return;
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("[role=option]")
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const next = items[(i + step + items.length) % items.length];
    next?.focus();
    next?.click();
  };

  const detail = (
    <div className="ts-chart-dialog-detail">
      <div className="ts-chart-dialog-name">{optionLabel(tc, key)}</div>
      <ChartPreview
        chart={preview}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="ts-chart-dialog-preview"
      />
      {!hasData && <div className="ts-chart-dialog-hint">{tt.noData}</div>}
      <p className="ts-chart-dialog-description">{tt.descriptions[key]}</p>
    </div>
  );

  return (
    <DialogShell
      title={tt.title}
      onClose={onClose}
      onConfirm={confirm}
      width={760}
      className="ts-chart-dialog"
      footer={
        <>
          <Button onClick={onClose}>{tt.cancel}</Button>
          <Button variant="primary" onClick={confirm}>
            {tt.ok}
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[
          { id: "recommended", label: tt.recommended },
          { id: "all", label: tt.all },
        ]}
        value={tab}
        onChange={switchTab}
        idPrefix="ts-chart-dialog"
        aria-label={tt.title}
        size="sm"
      />
      <div
        className="ts-chart-dialog-body"
        role="tabpanel"
        id={`ts-chart-dialog-panel-${tab}`}
        aria-labelledby={`ts-chart-dialog-tab-${tab}`}
      >
        {tab === "recommended" ? (
          <div
            className="ts-chart-dialog-list ts-chart-dialog-thumbs"
            role="listbox"
            aria-label={tt.recommended}
            onKeyDown={listKeys}
          >
            {thumbs.map((thumb) => (
              <button
                key={thumb.key}
                type="button"
                role="option"
                aria-selected={thumb.key === key}
                aria-label={optionLabel(tc, thumb.key)}
                data-chart-option={thumb.key}
                tabIndex={thumb.key === key ? 0 : -1}
                className="ts-chart-dialog-thumb"
                onClick={() => setKey(thumb.key)}
                onDoubleClick={confirm}
              >
                <ChartPreview
                  chart={thumb.chart}
                  width={THUMB_W}
                  height={THUMB_H}
                  detail={1.6}
                />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div
              className="ts-chart-dialog-list ts-chart-dialog-families"
              role="listbox"
              aria-label={tt.all}
              onKeyDown={listKeys}
            >
              {ALL_FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="option"
                  aria-selected={f.id === family}
                  tabIndex={f.id === family ? 0 : -1}
                  data-chart-family={f.id}
                  className="ts-chart-dialog-family"
                  onClick={() => {
                    setFamily(f.id);
                    if (!f.keys.includes(key)) setKey(f.keys[0]);
                  }}
                >
                  <ChartGlyph optionKey={f.keys[0]} width={24} height={18} />
                  <span>{tt.families[f.id]}</span>
                </button>
              ))}
            </div>
            <div className="ts-chart-dialog-variants-wrap">
              <div
                className="ts-chart-dialog-variants"
                role="listbox"
                aria-label={tt.families[family]}
                onKeyDown={listKeys}
              >
                {familyOf(
                  ALL_FAMILIES.find((f) => f.id === family)?.keys[0] ?? key
                ).keys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="option"
                    aria-selected={k === key}
                    aria-label={optionLabel(tc, k)}
                    title={optionLabel(tc, k)}
                    tabIndex={k === key ? 0 : -1}
                    data-chart-option={k}
                    className="ts-chart-dialog-variant"
                    onClick={() => setKey(k)}
                    onDoubleClick={confirm}
                  >
                    <ChartGlyph optionKey={k} />
                  </button>
                ))}
              </div>
              {detail}
            </div>
          </>
        )}
        {tab === "recommended" && detail}
      </div>
    </DialogShell>
  );
};

/** Opens the Insert Chart dialog on a tab (and variant). */
export function useInsertChartDialog() {
  const { showModal, hideModal } = useContext(ModalContext);
  return useCallback(
    (tab: "recommended" | "all", key?: string) =>
      showModal(
        <InsertChartDialog
          initialTab={tab}
          initialKey={key}
          onClose={hideModal}
        />
      ),
    [showModal, hideModal]
  );
}
