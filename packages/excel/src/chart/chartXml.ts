/**
 * DrawingML chart part (xl/charts/chartN.xml) for one TinySheet chart:
 * column, bar, line, area and combo charts (with a secondary axis), pie,
 * doughnut, scatter, bubble, radar and stock charts, with trendlines,
 * error bars and data label options. Element order follows the
 * ECMA-376 schema, which Excel enforces.
 *
 * Waterfall, histogram, Pareto and funnel charts are Office 2016 "chartex"
 * parts, written by ./chartEx.ts.
 */
import {
  Chart,
  chartColor,
  chartRangeToText,
  ChartDataLabelPosition,
  ChartRange,
  ChartRenderModel,
  ChartSeries,
  ChartTrendline,
  readChartRange,
  resolveChartModel,
  Sheet,
} from "@lofcz/tinysheet-core";
import { escapeXmlText as esc } from "./xml";

export const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
export const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const NS_R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export type SheetsCtx = { luckysheetfile: Sheet[] };

export function hex(color: string | undefined, fallback: string) {
  const c = color && /^#?[0-9a-f]{6}$/i.test(color) ? color : fallback;
  return c.replace("#", "").toUpperCase();
}

export function solidFill(color: string) {
  return `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
}

export function richTitle(
  text: string,
  size = 1400,
  o: { overlay?: boolean; color?: string; spPr?: string } = {}
) {
  const fill = o.color ? solidFill(hex(o.color, "000000")) : "";
  return (
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0"/></a:pPr>` +
    `<a:r><a:rPr lang="en-US" sz="${size}" b="0"${
      fill ? `>${fill}</a:rPr>` : "/>"
    }<a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="${
      o.overlay ? 1 : 0
    }"/>${o.spPr ?? ""}</c:title>`
  );
}

function numCache(values: (number | null)[]) {
  let pts = "";
  values.forEach((v, i) => {
    if (v != null && Number.isFinite(v))
      pts += `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`;
  });
  return `<c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}`;
}

function strCache(values: string[]) {
  let pts = "";
  values.forEach((v, i) => {
    pts += `<c:pt idx="${i}"><c:v>${esc(v ?? "")}</c:v></c:pt>`;
  });
  return `<c:ptCount val="${values.length}"/>${pts}`;
}

/** Office 2013 chart extensions (filtered series, full references). */
export const NS_C15 = "http://schemas.microsoft.com/office/drawing/2012/chart";
const EXT_C15 = "{02D57815-91ED-43cb-92C2-25804820EDAC}";
/** Office 2016 display options (Show #N/A as an empty cell). */
const NS_C16R3 = "http://schemas.microsoft.com/office/drawing/2017/03/chart";
const EXT_C16R3 = "{56B9EC1D-385E-4148-901F-78D8002777C0}";

/**
 * A one-row / one-column reference without the points `hidden` (the
 * categories unchecked in the Chart Filters): Excel writes the visible
 * cells as a union and keeps the whole range in a c15:fullRef.
 */
function visiblePart(
  range: ChartRange,
  hidden: Set<number> | undefined
): ChartRange | null {
  if (!hidden?.size || range.areas?.length) return null;
  const vertical = range.column[0] === range.column[1];
  const horizontal = range.row[0] === range.row[1];
  if (!vertical && !horizontal) return null;
  const [a, b] = vertical ? range.row : range.column;
  const runs: [number, number][] = [];
  for (let i = a; i <= b; i += 1) {
    if (hidden.has(i - a)) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  }
  if (
    runs.length === 0 ||
    (runs.length === 1 && runs[0][0] === a && runs[0][1] === b)
  )
    return null;
  const areas = runs.map((run) =>
    vertical
      ? { sheetId: range.sheetId, row: run, column: range.column }
      : { sheetId: range.sheetId, row: range.row, column: run }
  );
  const [first, ...rest] = areas;
  return { ...first, ...(rest.length ? { areas: rest } : {}) };
}

function refXml(
  ctx: SheetsCtx,
  kind: "num" | "str",
  range: ChartRange,
  cache: string,
  full?: ChartRange
) {
  const ext = full
    ? `<c:extLst><c:ext uri="${EXT_C15}" xmlns:c15="${NS_C15}"><c15:fullRef><c15:sqref>${esc(
        chartRangeToText(ctx, full)
      )}</c15:sqref></c15:fullRef></c:ext></c:extLst>`
    : "";
  return `<c:${kind}Ref><c:f>${esc(
    chartRangeToText(ctx, range)
  )}</c:f><c:${kind}Cache>${cache}</c:${kind}Cache>${ext}</c:${kind}Ref>`;
}

function numSource(
  ctx: SheetsCtx,
  range: ChartRange | null | undefined,
  values: (number | null)[],
  hidden?: Set<number>
) {
  if (range) {
    const visible = visiblePart(range, hidden);
    if (visible) {
      const shown = values.filter((_, i) => !hidden!.has(i));
      return refXml(ctx, "num", visible, numCache(shown), range);
    }
    return refXml(ctx, "num", range, numCache(values));
  }
  return `<c:numLit>${numCache(values)}</c:numLit>`;
}

function strSource(
  ctx: SheetsCtx,
  range: ChartRange | null | undefined,
  values: string[],
  hidden?: Set<number>
) {
  if (range) {
    const visible = visiblePart(range, hidden);
    if (visible) {
      const shown = values.filter((_, i) => !hidden!.has(i));
      return refXml(ctx, "str", visible, strCache(shown), range);
    }
    return refXml(ctx, "str", range, strCache(values));
  }
  return `<c:strLit>${strCache(values)}</c:strLit>`;
}

const FILTERED_XML: Record<string, string> = {
  bar: "filteredBarSeries",
  line: "filteredLineSeries",
  stock: "filteredLineSeries",
  area: "filteredAreaSeries",
  pie: "filteredPieSeries",
  doughnut: "filteredPieSeries",
  scatter: "filteredScatterSeries",
  radar: "filteredRadarSeries",
  bubble: "filteredBubbleSeries",
};

/**
 * The series of a chart group, split into plotted `<c:ser>` elements and
 * the c15 extension holding the ones hidden by the Chart Filters (written
 * last in the group, as Excel does).
 */
function groupSeries(
  chart: Chart,
  kind: GroupKind,
  members: number[],
  ser: (kind: GroupKind, index: number) => string
) {
  let shown = "";
  let filtered = "";
  members.forEach((i) => {
    const xml = ser(kind, i);
    if (chart.series[i]?.filtered) {
      filtered += `<c15:${FILTERED_XML[kind]}>${xml
        .replace(/^<c:ser>/, "<c15:ser>")
        .replace(/<\/c:ser>$/, "</c15:ser>")}</c15:${FILTERED_XML[kind]}>`;
    } else shown += xml;
  });
  const ext = filtered
    ? `<c:extLst><c:ext uri="${EXT_C15}" xmlns:c15="${NS_C15}">${filtered}</c:ext></c:extLst>`
    : "";
  return { shown, ext };
}

type GroupKind =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "doughnut"
  | "scatter"
  | "radar"
  | "bubble"
  | "stock";

const TREND_XML: Record<ChartTrendline["type"], string> = {
  linear: "linear",
  exponential: "exp",
  logarithmic: "log",
  polynomial: "poly",
  power: "power",
  movingAverage: "movingAvg",
};

function trendlineXml(t: ChartTrendline, color: string) {
  let x = "<c:trendline>";
  if (t.name) x += `<c:name>${esc(t.name)}</c:name>`;
  x += `<c:spPr><a:ln w="19050" cap="rnd">${solidFill(
    hex(t.color, color)
  )}<a:prstDash val="sysDot"/></a:ln></c:spPr>`;
  x += `<c:trendlineType val="${TREND_XML[t.type]}"/>`;
  if (t.type === "polynomial")
    x += `<c:order val="${Math.min(
      6,
      Math.max(2, Math.round(t.order ?? 2))
    )}"/>`;
  if (t.type === "movingAverage")
    x += `<c:period val="${Math.max(2, Math.round(t.period ?? 2))}"/>`;
  if (t.type !== "movingAverage") {
    if (t.forward) x += `<c:forward val="${t.forward}"/>`;
    if (t.backward) x += `<c:backward val="${t.backward}"/>`;
    if (t.intercept != null && Number.isFinite(t.intercept))
      x += `<c:intercept val="${t.intercept}"/>`;
    x += `<c:dispRSqr val="${t.displayRSquared ? 1 : 0}"/>`;
    x += `<c:dispEq val="${t.displayEquation ? 1 : 0}"/>`;
  }
  return `${x}</c:trendline>`;
}

const ERR_XML = {
  fixed: "fixedVal",
  percentage: "percentage",
  stdDev: "stdDev",
  stdErr: "stdErr",
  custom: "cust",
} as const;

function errBarsXml(
  ctx: SheetsCtx,
  s: ChartSeries,
  m: ChartRenderModel["series"][number],
  withDir: boolean
) {
  const e = s.errorBars;
  if (!e) return "";
  let x = "<c:errBars>";
  if (withDir) x += '<c:errDir val="y"/>';
  x += `<c:errBarType val="${e.include ?? "both"}"/>`;
  x += `<c:errValType val="${ERR_XML[e.type]}"/>`;
  x += `<c:noEndCap val="${e.endCap === false ? 1 : 0}"/>`;
  if (e.type === "custom") {
    const plus = m.errorBars?.plusValues ?? [];
    const minus = m.errorBars?.minusValues ?? [];
    x += `<c:plus>${numSource(ctx, e.plus, plus)}</c:plus>`;
    x += `<c:minus>${numSource(ctx, e.minus, minus)}</c:minus>`;
  } else if (e.type !== "stdErr") {
    x += `<c:val val="${e.value ?? (e.type === "percentage" ? 5 : 1)}"/>`;
  }
  if (e.color)
    x += `<c:spPr><a:ln w="9525">${solidFill(
      hex(e.color, "000000")
    )}</a:ln></c:spPr>`;
  return `${x}</c:errBars>`;
}

const POS_XML: Record<ChartDataLabelPosition, string> = {
  auto: "",
  center: "ctr",
  insideEnd: "inEnd",
  insideBase: "inBase",
  outsideEnd: "outEnd",
  above: "t",
  below: "b",
  left: "l",
  right: "r",
  bestFit: "bestFit",
};

/** dLblPos values Excel accepts per chart group (others make it repair). */
function allowedPositions(kind: GroupKind, stacked: boolean): string[] {
  switch (kind) {
    case "bar":
      return stacked
        ? ["ctr", "inEnd", "inBase"]
        : ["ctr", "inEnd", "inBase", "outEnd"];
    case "line":
    case "scatter":
    case "bubble":
    case "stock":
      return ["ctr", "l", "r", "t", "b"];
    case "pie":
      return ["ctr", "inEnd", "outEnd", "bestFit"];
    default:
      return [];
  }
}

function dLblsXml(chart: Chart, kind: GroupKind, stacked: boolean) {
  const on = !!chart.dataLabels;
  const o = chart.dataLabelOptions ?? {};
  let x = "<c:dLbls>";
  if (on && o.numberFormat)
    x += `<c:numFmt formatCode="${esc(o.numberFormat)}" sourceLinked="0"/>`;
  const pos = on && o.position ? POS_XML[o.position] : "";
  if (pos && allowedPositions(kind, stacked).includes(pos))
    x += `<c:dLblPos val="${pos}"/>`;
  const flag = (b: boolean | undefined) => (on && b ? 1 : 0);
  x += `<c:showLegendKey val="0"/><c:showVal val="${flag(
    o.showValue !== false
  )}"/><c:showCatName val="${flag(o.showCategory)}"/><c:showSerName val="${flag(
    o.showSeriesName
  )}"/><c:showPercent val="${flag(
    (kind === "pie" || kind === "doughnut") && o.showPercent
  )}"/><c:showBubbleSize val="0"/>`;
  if (on && o.separator != null)
    x += `<c:separator>${esc(o.separator)}</c:separator>`;
  return `${x}</c:dLbls>`;
}

type SeriesOptions = {
  kind: GroupKind;
  index: number;
  catNumeric: boolean;
  vary: boolean;
  /** Categories unchecked in the Chart Filters. */
  hidden?: Set<number>;
};

function seriesXml(
  ctx: SheetsCtx,
  chart: Chart,
  model: ChartRenderModel,
  o: SeriesOptions
) {
  const s = chart.series[o.index];
  const m = model.series[o.index];
  const { kind, index: i } = o;
  const color = hex(s.color, chartColor(chart, i));
  let x = `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>`;
  if (s.nameRef && !s.name) {
    x += `<c:tx>${strSource(ctx, s.nameRef, [m.name])}</c:tx>`;
  } else {
    x += `<c:tx><c:v>${esc(m.name)}</c:v></c:tx>`;
  }
  const lineLike =
    kind === "line" ||
    (kind === "scatter" && chart.scatterLines) ||
    (kind === "radar" && chart.radarStyle !== "filled");
  if (kind === "stock") {
    x += '<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>';
  } else if (lineLike) {
    x += `<c:spPr><a:ln w="28575" cap="rnd">${solidFill(
      color
    )}<a:round/></a:ln></c:spPr>`;
  } else if (kind === "scatter") {
    x += `<c:spPr><a:ln w="25400"><a:noFill/></a:ln></c:spPr>`;
  } else {
    let ln =
      kind === "pie" || kind === "doughnut"
        ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>'
        : "";
    if (s.outline === null) ln = "<a:ln><a:noFill/></a:ln>";
    else if (s.outline)
      ln = `<a:ln w="9525">${solidFill(hex(s.outline, "000000"))}</a:ln>`;
    x += `<c:spPr>${solidFill(color)}${ln}</c:spPr>`;
  }
  if (kind === "bar" || kind === "bubble") x += '<c:invertIfNegative val="0"/>';
  if (kind === "line" || kind === "scatter" || kind === "radar") {
    const markers =
      kind === "radar"
        ? chart.radarStyle === "marker"
        : chart.markers !== false;
    x += !markers
      ? '<c:marker><c:symbol val="none"/></c:marker>'
      : `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${solidFill(
          color
        )}</c:spPr></c:marker>`;
  }
  if (kind === "stock") {
    const close =
      i === chart.series.length - 1 && (chart.stockVariant ?? "hlc") === "hlc";
    x += close
      ? `<c:marker><c:symbol val="dash"/><c:size val="5"/><c:spPr>${solidFill(
          color
        )}</c:spPr></c:marker>`
      : '<c:marker><c:symbol val="none"/></c:marker>';
  }
  if (o.vary && m.pointColors) {
    m.pointColors.forEach((pc, p) => {
      x += `<c:dPt><c:idx val="${p}"/>${
        kind === "pie" || kind === "doughnut"
          ? '<c:bubble3D val="0"/>'
          : '<c:invertIfNegative val="0"/><c:bubble3D val="0"/>'
      }<c:spPr>${solidFill(hex(pc, chartColor(chart, p)))}</c:spPr></c:dPt>`;
    });
  }
  const analysis =
    kind === "bar" ||
    kind === "line" ||
    kind === "area" ||
    kind === "scatter" ||
    kind === "bubble";
  if (analysis) {
    s.trendlines?.forEach((t) => {
      x += trendlineXml(t, color);
    });
    x += errBarsXml(ctx, s, m, kind === "scatter" || kind === "bubble");
  }
  const { categories } = model;
  const hidden = o.hidden;
  if (kind === "scatter" || kind === "bubble") {
    const xs = m.xValues ?? m.values.map((_, p) => p + 1);
    x += `<c:xVal>${
      o.catNumeric || !s.categories
        ? numSource(ctx, s.categories, xs, hidden)
        : strSource(ctx, s.categories, categories, hidden)
    }</c:xVal>`;
    x += `<c:yVal>${numSource(ctx, s.values, m.values, hidden)}</c:yVal>`;
    if (kind === "bubble") {
      x += `<c:bubbleSize>${numSource(
        ctx,
        s.sizes,
        m.sizes ?? m.values.map(() => 1),
        hidden
      )}</c:bubbleSize><c:bubble3D val="0"/>`;
    } else x += '<c:smooth val="0"/>';
  } else {
    if (s.categories || categories.length) {
      x += `<c:cat>${
        o.catNumeric
          ? numSource(
              ctx,
              s.categories,
              categories.map((c) => (c === "" ? null : Number(c))),
              hidden
            )
          : strSource(ctx, s.categories, categories, hidden)
      }</c:cat>`;
    }
    x += `<c:val>${numSource(ctx, s.values, m.values, hidden)}</c:val>`;
    if (kind === "line" || kind === "stock") x += '<c:smooth val="0"/>';
  }
  return `${x}</c:ser>`;
}

const AX = {
  cat: 500000001,
  val: 500000002,
  cat2: 500000003,
  val2: 500000004,
};

/** DrawingML chart part for one chart. */
export function chartToXml(ctx: SheetsCtx, chart: Chart): string {
  const model = resolveChartModel(ctx, chart);
  const { type } = chart;
  const grouping = chart.grouping ?? "clustered";
  const stacked = grouping !== "clustered";
  const pie = type === "pie" || type === "doughnut";
  const xy = type === "scatter" || type === "bubble";
  const vary = pie || !!chart.varyColors;
  const catRange = chart.series.find((s) => s.categories)?.categories;
  const catNumeric =
    !!catRange && readChartRange(ctx, catRange).every((c) => !c.text);
  const hidden = chart.hiddenCategories?.length
    ? new Set(chart.hiddenCategories)
    : undefined;
  const ser = (kind: GroupKind, index: number) =>
    seriesXml(ctx, chart, model, { kind, index, catNumeric, vary, hidden });
  const lines = (kind: GroupKind) => {
    let out = "";
    if (chart.dropLines && (kind === "line" || kind === "area"))
      out += "<c:dropLines/>";
    if (kind !== "line") return out;
    if (chart.hiLowLines) out += "<c:hiLowLines/>";
    if (chart.upDownBars)
      out +=
        '<c:upDownBars><c:gapWidth val="150"/><c:upBars/><c:downBars/></c:upDownBars>';
    return out;
  };
  const axIds = (secondary: boolean) =>
    secondary
      ? `<c:axId val="${AX.cat2}"/><c:axId val="${AX.val2}"/>`
      : `<c:axId val="${AX.cat}"/><c:axId val="${AX.val}"/>`;
  const xmlGrouping = (kind: GroupKind) =>
    (kind === "line" || kind === "area") && grouping === "clustered"
      ? "standard"
      : grouping;

  let groups = "";
  let hasSecondary = false;
  if (
    type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area" ||
    type === "combo"
  ) {
    // one chart group per (series type, axis), primary groups first
    const keys: { kind: GroupKind; secondary: boolean; members: number[] }[] =
      [];
    chart.series.forEach((s, i) => {
      let kind: GroupKind = "bar";
      if (type === "line" || type === "area") kind = type;
      if (type === "combo")
        kind = s.type === "line" || s.type === "area" ? s.type : "bar";
      const secondary = !!s.secondary && type !== "bar";
      let g = keys.find((k) => k.kind === kind && k.secondary === secondary);
      if (!g) {
        g = { kind, secondary, members: [] };
        keys.push(g);
      }
      g.members.push(i);
    });
    if (keys.length === 0)
      keys.push({ kind: "bar", secondary: false, members: [] });
    keys.sort((a, b) => Number(a.secondary) - Number(b.secondary));
    keys.forEach((g) => {
      if (g.secondary) hasSecondary = true;
      const { shown: series, ext } = groupSeries(chart, g.kind, g.members, ser);
      const dLbls = dLblsXml(chart, g.kind, stacked);
      if (g.kind === "bar") {
        groups +=
          `<c:barChart><c:barDir val="${type === "bar" ? "bar" : "col"}"/>` +
          `<c:grouping val="${grouping}"/><c:varyColors val="${
            vary ? 1 : 0
          }"/>${series}${dLbls}<c:gapWidth val="150"/>${
            grouping === "clustered" ? "" : '<c:overlap val="100"/>'
          }${axIds(g.secondary)}${ext}</c:barChart>`;
      } else if (g.kind === "line") {
        groups += `<c:lineChart><c:grouping val="${xmlGrouping(
          "line"
        )}"/><c:varyColors val="0"/>${series}${dLbls}${lines(
          "line"
        )}<c:marker val="${chart.markers === false ? 0 : 1}"/>${axIds(
          g.secondary
        )}${ext}</c:lineChart>`;
      } else {
        groups += `<c:areaChart><c:grouping val="${xmlGrouping(
          "area"
        )}"/><c:varyColors val="0"/>${series}${dLbls}${lines("area")}${axIds(
          g.secondary
        )}${ext}</c:areaChart>`;
      }
    });
  } else {
    const indices = chart.series.map((_, i) => i);
    const all = (kind: GroupKind) => groupSeries(chart, kind, indices, ser);
    switch (type) {
      case "pie": {
        const g = all("pie");
        groups = `<c:pieChart><c:varyColors val="1"/>${g.shown}${dLblsXml(
          chart,
          "pie",
          false
        )}<c:firstSliceAng val="0"/>${g.ext}</c:pieChart>`;
        break;
      }
      case "doughnut": {
        const g = all("doughnut");
        groups = `<c:doughnutChart><c:varyColors val="1"/>${g.shown}${dLblsXml(
          chart,
          "doughnut",
          false
        )}<c:firstSliceAng val="0"/><c:holeSize val="50"/>${
          g.ext
        }</c:doughnutChart>`;
        break;
      }
      case "radar": {
        const style =
          { marker: "marker", line: "marker", filled: "filled" }[
            chart.radarStyle ?? "marker"
          ] ?? "marker";
        const g = all("radar");
        groups = `<c:radarChart><c:radarStyle val="${style}"/><c:varyColors val="0"/>${
          g.shown
        }${dLblsXml(chart, "radar", false)}${axIds(false)}${
          g.ext
        }</c:radarChart>`;
        break;
      }
      case "bubble": {
        const g = all("bubble");
        groups = `<c:bubbleChart><c:varyColors val="0"/>${g.shown}${dLblsXml(
          chart,
          "bubble",
          false
        )}<c:bubble3D val="0"/><c:bubbleScale val="${Math.round(
          chart.bubbleScale ?? 100
        )}"/><c:showNegBubbles val="0"/>${axIds(false)}${
          g.ext
        }</c:bubbleChart>`;
        break;
      }
      case "stock": {
        const ohlc = (chart.stockVariant ?? "hlc") === "ohlc";
        const g = all("stock");
        groups =
          `<c:stockChart>${g.shown}${dLblsXml(chart, "stock", false)}` +
          `<c:hiLowLines><c:spPr><a:ln w="9525">${solidFill(
            "000000"
          )}</a:ln></c:spPr></c:hiLowLines>${
            ohlc
              ? `<c:upDownBars><c:gapWidth val="150"/><c:upBars><c:spPr>${solidFill(
                  "FFFFFF"
                )}<a:ln w="9525">${solidFill(
                  "000000"
                )}</a:ln></c:spPr></c:upBars><c:downBars><c:spPr>${solidFill(
                  "000000"
                )}<a:ln w="9525">${solidFill(
                  "000000"
                )}</a:ln></c:spPr></c:downBars></c:upDownBars>`
              : ""
          }${axIds(false)}${g.ext}</c:stockChart>`;
        break;
      }
      default: {
        const g = all("scatter");
        groups = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${
          g.shown
        }${dLblsXml(chart, "scatter", false)}${axIds(false)}${
          g.ext
        }</c:scatterChart>`;
      }
    }
  }

  const formats = chart.formats ?? {};
  const gridlines = (major: boolean, minor: boolean) =>
    `${
      major
        ? formats.majorGridlines?.line
          ? `<c:majorGridlines><c:spPr><a:ln w="9525">${solidFill(
              hex(formats.majorGridlines.line, "D9D9D9")
            )}</a:ln></c:spPr></c:majorGridlines>`
          : "<c:majorGridlines/>"
        : ""
    }${minor ? "<c:minorGridlines/>" : ""}`;
  const valueGrid = gridlines(
    chart.gridlines !== false,
    !!chart.minorGridlines
  );
  const categoryGrid = gridlines(
    !!chart.categoryGridlines,
    !!chart.minorCategoryGridlines
  );
  const axisTitle = (
    t: string | undefined,
    key: "categoryAxisTitle" | "valueAxisTitle"
  ) =>
    t && t.trim()
      ? richTitle(t.trim(), 1000, { color: formats[key]?.text })
      : "";
  const scaling = (bounds?: Chart["valueAxis"]) => {
    let out = '<c:scaling><c:orientation val="minMax"/>';
    if (bounds?.max != null) out += `<c:max val="${bounds.max}"/>`;
    if (bounds?.min != null) out += `<c:min val="${bounds.min}"/>`;
    return `${out}</c:scaling>`;
  };
  // tick marks, then the axis line (spPr) and label colour (txPr)
  const common = (key: "categoryAxis" | "valueAxis") =>
    `<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${shapeProps(
      { line: formats[key]?.line }
    )}${textProps(formats[key]?.text)}`;
  const majorUnit = (bounds?: Chart["valueAxis"]) =>
    bounds?.majorUnit != null ? `<c:majorUnit val="${bounds.majorUnit}"/>` : "";
  const catPos = type === "bar" ? "l" : "b";
  const valPos = type === "bar" ? "b" : "l";
  const valueFormat =
    stacked && grouping === "percentStacked" ? "0%" : "General";
  const deleted = (axis: "category" | "value") =>
    chart.axes?.[axis] === false ? 1 : 0;
  const catAx = (id: number, cross: number, secondary: boolean, title = "") =>
    `<c:catAx><c:axId val="${id}"/>${scaling()}<c:delete val="${
      secondary ? 1 : deleted("category")
    }"/><c:axPos val="${catPos}"/>${
      secondary ? "" : categoryGrid
    }${title}<c:numFmt formatCode="General" sourceLinked="1"/>${common(
      "categoryAxis"
    )}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const between = type === "area" ? "midCat" : "between";

  let axes = "";
  if (xy) {
    axes =
      `<c:valAx><c:axId val="${AX.cat}"/>${scaling()}<c:delete val="${deleted(
        "category"
      )}"/><c:axPos val="b"/>${categoryGrid}${axisTitle(
        chart.categoryAxisTitle,
        "categoryAxisTitle"
      )}<c:numFmt formatCode="General" sourceLinked="1"/>${common(
        "categoryAxis"
      )}<c:crossAx val="${
        AX.val
      }"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>` +
      `<c:valAx><c:axId val="${AX.val}"/>${scaling(
        chart.valueAxis
      )}<c:delete val="${deleted(
        "value"
      )}"/><c:axPos val="l"/>${valueGrid}${axisTitle(
        chart.valueAxisTitle,
        "valueAxisTitle"
      )}<c:numFmt formatCode="General" sourceLinked="1"/>${common(
        "valueAxis"
      )}<c:crossAx val="${
        AX.cat
      }"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/>${majorUnit(
        chart.valueAxis
      )}</c:valAx>`;
  } else if (!pie) {
    axes =
      catAx(
        AX.cat,
        AX.val,
        false,
        axisTitle(chart.categoryAxisTitle, "categoryAxisTitle")
      ) +
      `<c:valAx><c:axId val="${AX.val}"/>${scaling(
        chart.valueAxis
      )}<c:delete val="${deleted(
        "value"
      )}"/><c:axPos val="${valPos}"/>${valueGrid}${axisTitle(
        chart.valueAxisTitle,
        "valueAxisTitle"
      )}<c:numFmt formatCode="${valueFormat}" sourceLinked="${
        valueFormat === "General" ? 1 : 0
      }"/>${common("valueAxis")}<c:crossAx val="${
        AX.cat
      }"/><c:crosses val="autoZero"/><c:crossBetween val="${between}"/>${majorUnit(
        chart.valueAxis
      )}</c:valAx>`;
    if (hasSecondary) {
      axes +=
        catAx(AX.cat2, AX.val2, true) +
        `<c:valAx><c:axId val="${AX.val2}"/>${scaling(
          chart.secondaryValueAxis
        )}<c:delete val="0"/><c:axPos val="r"/>${axisTitle(
          chart.secondaryValueAxisTitle,
          "valueAxisTitle"
        )}<c:numFmt formatCode="${valueFormat}" sourceLinked="${
          valueFormat === "General" ? 1 : 0
        }"/>${common("valueAxis")}<c:crossAx val="${
          AX.cat2
        }"/><c:crosses val="max"/><c:crossBetween val="${between}"/>${majorUnit(
          chart.secondaryValueAxis
        )}</c:valAx>`;
    }
  }
  const dataTable =
    chart.dataTable && !pie && !xy
      ? `<c:dTable><c:showHorzBorder val="1"/><c:showVertBorder val="1"/><c:showOutline val="1"/><c:showKeys val="${
          chart.dataTable.legendKeys === false ? 0 : 1
        }"/></c:dTable>`
      : "";

  const legendPos = { right: "r", left: "l", top: "t", bottom: "b" } as const;
  const legend =
    chart.legend === "none"
      ? ""
      : `<c:legend><c:legendPos val="${
          legendPos[chart.legend ?? "right"]
        }"/><c:overlay val="0"/>${shapeProps(formats.legend ?? {})}${textProps(
          formats.legend?.text
        )}</c:legend>`;
  const title = chart.title?.trim();
  const blanks = { gap: "gap", zero: "zero", span: "span" }[
    chart.displayBlanksAs ?? "gap"
  ];
  const displayOptions = chart.displayNaAsBlank
    ? `<c:extLst><c:ext uri="${EXT_C16R3}" xmlns:c16r3="${NS_C16R3}"><c16r3:dataDisplayOptions16><c16r3:dispNaAsBlank val="1"/></c16r3:dataDisplayOptions16></c:ext></c:extLst>`
    : "";
  const area = formats.chartArea ?? {};

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    `<c:roundedCorners val="0"/><c:chart>${
      title
        ? richTitle(title, 1400, {
            overlay: !!chart.titleOverlay,
            color: formats.title?.text,
            spPr: shapeProps(formats.title ?? {}),
          })
        : ""
    }<c:autoTitleDeleted val="${
      title ? 0 : 1
    }"/><c:plotArea><c:layout/>${groups}${axes}${dataTable}${shapeProps(
      formats.plotArea ?? {}
    )}</c:plotArea>${legend}<c:plotVisOnly val="${
      chart.plotVisibleOnly === false ? 0 : 1
    }"/><c:dispBlanksAs val="${blanks}"/>${displayOptions}</c:chart>` +
    `<c:spPr>${
      area.fill === null
        ? "<a:noFill/>"
        : solidFill(hex(area.fill ?? undefined, "FFFFFF"))
    }${
      area.line === null
        ? "<a:ln><a:noFill/></a:ln>"
        : `<a:ln w="9525">${solidFill(hex(area.line ?? undefined, "D9D9D9"))}</a:ln>`
    }</c:spPr></c:chartSpace>`
  );
}

/** `<c:spPr>` of an element's fill / outline ("" when neither is set). */
function shapeProps(f: { fill?: string | null; line?: string | null }) {
  let inner = "";
  if (f.fill === null) inner += "<a:noFill/>";
  else if (f.fill) inner += solidFill(hex(f.fill, "FFFFFF"));
  if (f.line === null) inner += "<a:ln><a:noFill/></a:ln>";
  else if (f.line)
    inner += `<a:ln w="9525">${solidFill(hex(f.line, "000000"))}</a:ln>`;
  return inner ? `<c:spPr>${inner}</c:spPr>` : "";
}

/** `<c:txPr>` giving a text colour ("" when none). */
function textProps(color: string | undefined) {
  if (!color) return "";
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr>${solidFill(
    hex(color, "000000")
  )}</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
}
