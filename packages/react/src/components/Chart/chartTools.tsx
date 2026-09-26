/**
 * Shared pieces of the chart tools (the Chart Design and Format tabs, the
 * buttons next to a selected chart, the Format pane): the active chart and
 * its selected element, element names as Excel writes them, and the Add
 * Chart Element menu.
 */
import { useCallback, useContext } from "react";
import {
  Axis3d,
  ChartCandlestick,
  Grid3x3,
  Heading,
  List,
  MoveVertical,
  Sigma,
  Table,
  Tag,
  TrendingUp,
  Type,
} from "lucide-react";
import type { ChartElementFormat, ChartFormatKey } from "@lofcz/tinysheet-core";
import {
  applyChartElement,
  Chart,
  chartAxisFor,
  chartElementAvailable,
  chartElementOption,
  chartElementToggles,
  ChartElementName,
  ChartToolsLocale,
  chartToolsLocale,
  Context,
  findChart,
  resolveChartModel,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import type { MenuItem } from "../ui";
import type { LucideIcon } from "../ui";
import { openChartDialog } from "./dialogs/store";

/** The active chart and ways to change it. */
export function useChartTools() {
  const { context, setContext } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const found = findChart(context, context.activeChart);
  const chart = found?.chart ?? null;
  const chartId = chart?.id;
  const readonly = context.allowEdit === false;
  const update = useCallback(
    (recipe: (c: Chart, ctx: Context) => void) => {
      if (!chartId || readonly) return;
      setContext((ctx) => {
        const f = findChart(ctx, chartId);
        if (f) recipe(f.chart, ctx);
      });
    },
    [chartId, readonly, setContext]
  );
  const element = context.chartElement ?? "chartArea";
  const selectElement = useCallback(
    (el: string) =>
      setContext(
        (ctx) => {
          ctx.chartElement = el;
        },
        { noHistory: true }
      ),
    [setContext]
  );
  /** Open the Format pane (on `el`). */
  const openPane = useCallback(
    (el?: string) =>
      setContext(
        (ctx) => {
          if (!ctx.activeChart) return;
          ctx.chartEditorOpen = true;
          if (el) ctx.chartElement = el;
        },
        { noHistory: true }
      ),
    [setContext]
  );
  const labels = {
    chartTitle: t.elements.chartTitleDefault,
    axisTitle: t.elements.axisTitleDefault,
  };
  return {
    context,
    setContext,
    t,
    chart,
    sheetId: found?.sheet.id,
    readonly,
    update,
    element,
    selectElement,
    openPane,
    labels,
  };
}

/** Excel's name of a chart element ("Vertical (Value) Axis", …). */
export function chartElementLabel(
  ctx: Context,
  chart: Chart,
  element: string,
  t: ChartToolsLocale = chartToolsLocale(ctx)
): string {
  const n = t.names;
  const axisName = (axis: "category" | "value") => {
    const horizontal = chartAxisFor(chart, "horizontal") === axis;
    const xy = chart.type === "scatter" || chart.type === "bubble";
    if (axis === "category" && !xy)
      return horizontal ? n.horizontalCategoryAxis : n.verticalCategoryAxis;
    if (xy)
      return axis === "category" ? n.horizontalValueAxis : n.verticalValueAxis;
    return horizontal ? n.horizontalValueAxis : n.verticalValueAxis;
  };
  const m = /^series:(\d+)$/.exec(element);
  if (m) {
    const model = resolveChartModel(ctx, chart);
    const name = model.series[Number(m[1])]?.name ?? "";
    return n.series.replace("{name}", name);
  }
  switch (element) {
    case "title":
      return n.title;
    case "plotArea":
      return n.plotArea;
    case "legend":
      return n.legend;
    case "categoryAxis":
      return axisName("category");
    case "valueAxis":
      return axisName("value");
    case "categoryAxisTitle":
      return n.axisTitle.replace("{axis}", axisName("category"));
    case "valueAxisTitle":
      return n.axisTitle.replace("{axis}", axisName("value"));
    case "majorGridlines":
      return n.majorGridlines.replace("{axis}", axisName("value"));
    default:
      return n.chartArea;
  }
}

const ELEMENT_ICONS: Record<ChartElementName, LucideIcon> = {
  axes: Axis3d,
  axisTitles: Type,
  chartTitle: Heading,
  dataLabels: Tag,
  dataTable: Table,
  errorBars: Sigma,
  gridlines: Grid3x3,
  legend: List,
  lines: MoveVertical,
  trendline: TrendingUp,
  upDownBars: ChartCandlestick,
};

/** Order of the Add Chart Element menu (Excel). */
export const CHART_ELEMENTS: ChartElementName[] = [
  "axes",
  "axisTitles",
  "chartTitle",
  "dataLabels",
  "dataTable",
  "errorBars",
  "gridlines",
  "legend",
  "lines",
  "trendline",
  "upDownBars",
];

/** The data label positions of a chart family's submenu. */
function labelOptions(chart: Chart): string[] {
  switch (chart.type) {
    case "column":
    case "bar":
      return ["center", "insideEnd", "insideBase", "outsideEnd", "callout"];
    case "pie":
    case "doughnut":
      return chart.type === "pie"
        ? ["center", "insideEnd", "outsideEnd", "bestFit", "callout"]
        : ["show", "callout"];
    case "line":
    case "scatter":
    case "bubble":
    case "combo":
      return ["center", "left", "right", "above", "below", "callout"];
    default:
      return ["show"];
  }
}

export type ChartElementActions = {
  /** Apply an option (all series for trendlines / error bars). */
  apply: (el: ChartElementName, option: string) => void;
  /** "More … Options…": the Format pane on an element. */
  more: (element: string) => void;
};

/** Where "More … Options…" of an element goes in the Format pane. */
export function elementPaneTarget(chart: Chart, el: ChartElementName) {
  switch (el) {
    case "axes":
      return "valueAxis";
    case "axisTitles":
      return chart.valueAxisTitle ? "valueAxisTitle" : "categoryAxisTitle";
    case "chartTitle":
      return chart.title ? "title" : "chartArea";
    case "legend":
      return "legend";
    case "gridlines":
      return "majorGridlines";
    case "dataLabels":
    case "errorBars":
    case "trendline":
    case "lines":
    case "upDownBars":
      return "series:0";
    default:
      return "chartArea";
  }
}

/**
 * The submenu of an element (Excel's Add Chart Element and the Chart
 * Elements button share it).
 */
export function chartElementSubmenu(
  chart: Chart,
  el: ChartElementName,
  t: ChartToolsLocale,
  actions: ChartElementActions
): MenuItem[] {
  const e = t.elements;
  const option = chartElementOption(chart, el);
  const radio = (id: string, label: string): MenuItem => ({
    id: `${el}-${id}`,
    label,
    checked: option === id,
    radio: true,
    onSelect: () => actions.apply(el, id),
  });
  const toggle = (id: string, label: string, on: boolean): MenuItem => ({
    id: `${el}-${id}`,
    label,
    checked: on,
    onSelect: () => actions.apply(el, id),
  });
  const more = (label: string): MenuItem[] => [
    { type: "separator", id: `${el}-sep` },
    {
      id: `${el}-more`,
      label,
      onSelect: () => actions.more(elementPaneTarget(chart, el)),
    },
  ];
  switch (el) {
    case "axes": {
      const on = chartElementToggles(chart, "axes");
      return [
        toggle("horizontal", e.primaryHorizontal, on.horizontal),
        toggle("vertical", e.primaryVertical, on.vertical),
        ...more(e.moreAxisOptions),
      ];
    }
    case "axisTitles": {
      const on = chartElementToggles(chart, "axisTitles");
      return [
        toggle("horizontal", e.primaryHorizontal, on.horizontal),
        toggle("vertical", e.primaryVertical, on.vertical),
        ...more(e.moreAxisTitleOptions),
      ];
    }
    case "chartTitle":
      return [
        radio("none", e.none),
        radio("above", e.aboveChart),
        radio("overlay", e.centeredOverlay),
        ...more(e.moreTitleOptions),
      ];
    case "dataLabels": {
      const names: Record<string, string> = {
        center: e.center,
        insideEnd: e.insideEnd,
        insideBase: e.insideBase,
        outsideEnd: e.outsideEnd,
        bestFit: e.bestFit,
        left: e.left,
        right: e.right,
        above: e.above,
        below: e.below,
        callout: e.dataCallout,
        show: e.show,
      };
      const current = option === "auto" ? "show" : option;
      return [
        radio("none", e.none),
        ...labelOptions(chart).map((id) => ({
          ...radio(id, names[id]),
          checked: current === id,
        })),
        ...more(e.moreDataLabelOptions),
      ];
    }
    case "dataTable":
      return [
        radio("none", e.none),
        radio("keys", e.withLegendKeys),
        radio("noKeys", e.noLegendKeys),
        ...more(e.moreDataTableOptions),
      ];
    case "errorBars":
      return [
        radio("none", e.none),
        radio("stdErr", e.standardError),
        radio("percentage", e.percentage),
        radio("stdDev", e.standardDeviation),
        ...more(e.moreErrorBarsOptions),
      ];
    case "gridlines": {
      const on = chartElementToggles(chart, "gridlines");
      return [
        toggle("majorHorizontal", e.primaryMajorHorizontal, on.majorHorizontal),
        toggle("majorVertical", e.primaryMajorVertical, on.majorVertical),
        toggle("minorHorizontal", e.primaryMinorHorizontal, on.minorHorizontal),
        toggle("minorVertical", e.primaryMinorVertical, on.minorVertical),
        ...more(e.moreGridlineOptions),
      ];
    }
    case "legend":
      return [
        radio("none", e.none),
        radio("right", e.right),
        radio("top", e.top),
        radio("left", e.left),
        radio("bottom", e.bottom),
        ...more(e.moreLegendOptions),
      ];
    case "lines": {
      const items = [radio("none", e.none), radio("dropLines", e.dropLines)];
      if (chart.type === "line" && chart.series.length > 1)
        items.push(radio("hiLowLines", e.highLowLines));
      return items;
    }
    case "trendline":
      return [
        radio("none", e.none),
        radio("linear", e.linear),
        radio("exponential", e.exponential),
        radio("linearForecast", e.linearForecast),
        radio("movingAverage", e.movingAverage),
        ...more(e.moreTrendlineOptions),
      ];
    case "upDownBars":
      return [
        radio("none", e.none),
        radio("on", e.upDownBarsOn),
        ...more(e.moreUpDownBarsOptions),
      ];
    default:
      return [];
  }
}

/** Excel's Add Chart Element menu. */
export function chartElementsMenu(
  chart: Chart,
  t: ChartToolsLocale,
  actions: ChartElementActions
): MenuItem[] {
  return CHART_ELEMENTS.map((el) => ({
    id: el,
    label: t.elements[el],
    icon: ELEMENT_ICONS[el],
    disabled: !chartElementAvailable(chart, el),
    children: chartElementAvailable(chart, el)
      ? chartElementSubmenu(chart, el, t, actions)
      : undefined,
  }));
}

/**
 * Apply an element option the way Excel does: a trendline for a chart of
 * several series asks which series ("Add Trendline based on Series"),
 * unless a series is selected; error bars go to every series (or the
 * selected one).
 */
export function applyChartElementOption(
  update: (recipe: (c: Chart) => void) => void,
  chart: Chart,
  element: string,
  el: ChartElementName,
  option: string,
  labels: { chartTitle: string; axisTitle: string }
) {
  const m = /^series:(\d+)$/.exec(element);
  const selectedSeries = m ? [Number(m[1])] : undefined;
  if (
    el === "trendline" &&
    option !== "none" &&
    !selectedSeries &&
    chart.series.filter((s) => !s.filtered).length > 1
  ) {
    openChartDialog({
      kind: "seriesPicker",
      chartId: chart.id,
      element: "trendline",
      option,
    });
    return;
  }
  update((c) =>
    applyChartElement(
      c,
      el,
      option,
      labels,
      option === "none" ? undefined : selectedSeries
    )
  );
}

// ---------------------------------------------------------------------------
// Element formats (Format tab, Format pane)

const FORMAT_KEYS: ChartFormatKey[] = [
  "chartArea",
  "plotArea",
  "title",
  "legend",
  "categoryAxis",
  "valueAxis",
  "categoryAxisTitle",
  "valueAxisTitle",
  "majorGridlines",
];

const TEXT_KEYS: ChartFormatKey[] = [
  "title",
  "legend",
  "categoryAxis",
  "valueAxis",
  "categoryAxisTitle",
  "valueAxisTitle",
];

/** What the Format tab can change on an element. */
export function elementCaps(element: string) {
  const series = /^series:\d+$/.test(element);
  const lineOnly =
    element === "categoryAxis" ||
    element === "valueAxis" ||
    element === "majorGridlines";
  return {
    series,
    fill:
      series ||
      (!lineOnly && !element.endsWith("Title") ? true : element === "title"),
    line: true,
    text:
      element === "chartArea" || TEXT_KEYS.includes(element as ChartFormatKey),
    effects: element === "chartArea" || element === "plotArea" || series,
  };
}

/** Set part of an element's format (series: colour / outline). */
export function setElementFormat(
  c: Chart,
  element: string,
  patch: Partial<ChartElementFormat> & { shadow?: boolean }
) {
  const m = /^series:(\d+)$/.exec(element);
  if (m) {
    const s = c.series[Number(m[1])];
    if (!s) return;
    if ("fill" in patch) {
      if (patch.fill) s.color = patch.fill;
      else delete s.color;
      delete s.pointColors;
    }
    if ("line" in patch) {
      if (patch.line === undefined) delete s.outline;
      else s.outline = patch.line;
    }
    if ("shadow" in patch) {
      if (patch.shadow) s.shadow = true;
      else delete s.shadow;
    }
    return;
  }
  if (!FORMAT_KEYS.includes(element as ChartFormatKey)) return;
  // text of the chart area: every text of the chart (Excel)
  const keys: ChartFormatKey[] =
    element === "chartArea" && ("text" in patch || "textOutline" in patch)
      ? TEXT_KEYS
      : [element as ChartFormatKey];
  const formats = { ...(c.formats ?? {}) };
  keys.forEach((key) => {
    const next: ChartElementFormat & Record<string, unknown> = {
      ...formats[key],
    };
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined) delete next[k];
      else next[k] = v;
    });
    if (Object.keys(next).length) formats[key] = next;
    else delete formats[key];
  });
  if (Object.keys(formats).length) c.formats = formats;
  else delete c.formats;
}
