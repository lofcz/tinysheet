/**
 * Office 2016 chart types (waterfall, histogram, Pareto, funnel) are stored
 * as "chartex" parts (xl/charts/chartExN.xml, namespace
 * http://schemas.microsoft.com/office/drawing/2014/chartex) and anchored
 * in the drawing through mc:AlternateContent. This module writes and reads
 * those parts.
 */
import {
  Chart,
  chartColor,
  chartRangeToText,
  ChartHistogramBinning,
  ChartLegendPosition,
  ChartRange,
  ChartSeries,
  ChartType,
  resolveChartModel,
} from "@lofcz/tinysheet-core";
import { hex, NS_A, NS_R, SheetsCtx, solidFill } from "./chartXml";
import type { ImportChartOptions, ImportedChart } from "./importXlsx";
import {
  child,
  children,
  escapeXmlText as esc,
  find,
  findAll,
  parseXml,
  XmlNode,
} from "./xml";

export const NS_CX = "http://schemas.microsoft.com/office/drawing/2014/chartex";
/** mc:Choice `Requires` namespaces. */
export const NS_CX1 =
  "http://schemas.microsoft.com/office/drawing/2015/9/8/chartex";
export const NS_CX2 =
  "http://schemas.microsoft.com/office/drawing/2015/10/21/chartex";
export const REL_CHARTEX =
  "http://schemas.microsoft.com/office/2014/relationships/chartEx";
export const CT_CHARTEX = "application/vnd.ms-office.chartex+xml";

const CHARTEX_TYPES: ChartType[] = [
  "waterfall",
  "histogram",
  "pareto",
  "funnel",
];

export function isChartExType(type: ChartType) {
  return CHARTEX_TYPES.includes(type);
}

/** The mc:Choice requirement of a chartex type. */
export function chartExRequires(type: ChartType) {
  return type === "funnel"
    ? { prefix: "cx2", ns: NS_CX2 }
    : { prefix: "cx1", ns: NS_CX1 };
}

function txData(ctx: SheetsCtx, ref: ChartRange | null | undefined, v: string) {
  return `<cx:tx><cx:txData>${
    ref ? `<cx:f>${esc(chartRangeToText(ctx, ref))}</cx:f>` : ""
  }<cx:v>${esc(v)}</cx:v></cx:txData></cx:tx>`;
}

function binningXml(b: ChartHistogramBinning | undefined) {
  const attr = (name: string, v: number | undefined) =>
    v != null && Number.isFinite(v) ? ` ${name}="${v}"` : "";
  let inner = "";
  if (b?.mode === "width" && b.width && b.width > 0)
    inner = `<cx:binSize val="${b.width}"/>`;
  else if (b?.mode === "count" && b.count && b.count > 0)
    inner = `<cx:binCount val="${Math.round(b.count)}"/>`;
  return `<cx:binning intervalClosed="r"${attr(
    "underflow",
    b?.underflow
  )}${attr("overflow", b?.overflow)}>${inner}</cx:binning>`;
}

const POS: Record<string, string> = {
  center: "ctr",
  insideEnd: "inEnd",
  insideBase: "inBase",
  outsideEnd: "outEnd",
};

function uid(i: number) {
  const h = (n: number) => n.toString(16).toUpperCase().padStart(8, "0");
  return `{${h(0x6d3a0000 + i)}-0000-4000-8000-${h(i)}0000}`;
}

/** chartex part for a waterfall, histogram, Pareto or funnel chart. */
export function chartExToXml(ctx: SheetsCtx, chart: Chart): string {
  const model = resolveChartModel(ctx, chart);
  const { type } = chart;
  const s: ChartSeries | undefined = chart.series[0];
  const m = model.series[0];
  const values = m?.values ?? [];
  const cats = model.categories;
  const count = Math.max(values.length, cats.length);

  let data = '<cx:data id="0">';
  const catRef = s?.categories;
  if (catRef || (cats.length && type !== "histogram")) {
    let pts = "";
    for (let i = 0; i < count; i += 1)
      pts += `<cx:pt idx="${i}">${esc(cats[i] ?? "")}</cx:pt>`;
    data += `<cx:strDim type="cat">${
      catRef ? `<cx:f>${esc(chartRangeToText(ctx, catRef))}</cx:f>` : ""
    }<cx:lvl ptCount="${count}">${pts}</cx:lvl></cx:strDim>`;
  }
  let vpts = "";
  values.forEach((v, i) => {
    if (v != null && Number.isFinite(v))
      vpts += `<cx:pt idx="${i}">${v}</cx:pt>`;
  });
  data += `<cx:numDim type="val">${
    s?.values ? `<cx:f>${esc(chartRangeToText(ctx, s.values))}</cx:f>` : ""
  }<cx:lvl ptCount="${
    values.length
  }" formatCode="General">${vpts}</cx:lvl></cx:numDim></cx:data>`;

  const name = m?.name ?? "Series1";
  const tx =
    s?.nameRef && !s.name
      ? txData(ctx, s.nameRef, name)
      : txData(ctx, null, name);
  const color = hex(s?.color, chartColor(chart, 0));
  const o = chart.dataLabelOptions ?? {};
  const labels = chart.dataLabels
    ? `<cx:dataLabels${
        o.position && POS[o.position] ? ` pos="${POS[o.position]}"` : ""
      }>${
        o.numberFormat
          ? `<cx:numFmt formatCode="${esc(o.numberFormat)}" sourceLinked="0"/>`
          : ""
      }<cx:visibility seriesName="${o.showSeriesName ? 1 : 0}" categoryName="${
        o.showCategory ? 1 : 0
      }" value="${o.showValue !== false ? 1 : 0}"/></cx:dataLabels>`
    : "";

  let series = "";
  let axes = "";
  const gridlines = chart.gridlines !== false ? "<cx:majorGridlines/>" : "";
  const axisTitle = (t?: string) =>
    t?.trim()
      ? `<cx:title><cx:tx><cx:txData><cx:v>${esc(
          t.trim()
        )}</cx:v></cx:txData></cx:tx></cx:title>`
      : "";
  const catAxis = (gap: number, hidden = false) =>
    `<cx:axis id="0"${
      hidden ? ' hidden="1"' : ""
    }><cx:catScaling gapWidth="${gap}"/>${axisTitle(
      chart.categoryAxisTitle
    )}<cx:tickLabels/></cx:axis>`;
  const valAxis = (id: number, extra = "", hidden = false) =>
    `<cx:axis id="${id}"${
      hidden ? ' hidden="1"' : ""
    }><cx:valScaling${extra}/>${
      id === 1 ? axisTitle(chart.valueAxisTitle) : ""
    }${id === 1 ? gridlines : ""}<cx:tickLabels/></cx:axis>`;

  if (type === "waterfall") {
    const totals = new Set(chart.waterfallTotals ?? []);
    const [inc, dec, tot] = [0, 1, 2].map((k) =>
      hex(chartColor(chart, k), "4472C4")
    );
    let pts = "";
    values.forEach((v, i) => {
      if (v == null) return;
      let c = v < 0 ? dec : inc;
      if (totals.has(i)) c = tot;
      if (s?.pointColors?.[i]) c = hex(s.pointColors[i], c);
      pts += `<cx:dataPt idx="${i}"><cx:spPr>${solidFill(
        c
      )}</cx:spPr></cx:dataPt>`;
    });
    const subtotals = totals.size
      ? `<cx:subtotals>${Array.from(totals)
          .sort((a, b) => a - b)
          .map((i) => `<cx:idx val="${i}"/>`)
          .join("")}</cx:subtotals>`
      : "";
    series = `<cx:series layoutId="waterfall" uniqueId="${uid(
      1
    )}">${tx}${pts}${labels}<cx:dataId val="0"/><cx:layoutPr><cx:visibility connectorLines="${
      chart.waterfallConnectors === false ? 0 : 1
    }"/>${subtotals}</cx:layoutPr></cx:series>`;
    axes = catAxis(0.5) + valAxis(1);
  } else if (type === "funnel") {
    series = `<cx:series layoutId="funnel" uniqueId="${uid(
      1
    )}">${tx}<cx:spPr>${solidFill(color)}</cx:spPr>${
      chart.dataLabels !== false
        ? labels ||
          '<cx:dataLabels pos="ctr"><cx:visibility seriesName="0" categoryName="0" value="1"/></cx:dataLabels>'
        : ""
    }<cx:dataId val="0"/></cx:series>`;
    axes = catAxis(0.06) + valAxis(1, "", true);
  } else {
    // histogram and Pareto
    const textCats =
      type === "pareto" &&
      cats.some((c) => c !== "" && !Number.isFinite(Number(c)));
    const layout = textCats ? "<cx:aggregation/>" : binningXml(chart.binning);
    series = `<cx:series layoutId="clusteredColumn" uniqueId="${uid(
      1
    )}" formatIdx="0">${tx}<cx:spPr>${solidFill(
      color
    )}</cx:spPr>${labels}<cx:dataId val="0"/><cx:layoutPr>${layout}</cx:layoutPr>${
      type === "pareto" ? '<cx:axisId val="1"/>' : ""
    }</cx:series>`;
    if (type === "pareto") {
      series += `<cx:series layoutId="paretoLine" ownerIdx="0" uniqueId="${uid(
        2
      )}" formatIdx="1"><cx:spPr><a:ln w="28575">${solidFill(
        hex(chartColor(chart, 1), "ED7D31")
      )}</a:ln></cx:spPr><cx:axisId val="2"/></cx:series>`;
    }
    axes = catAxis(0) + valAxis(1);
    if (type === "pareto")
      axes += `<cx:axis id="2"><cx:valScaling max="1" min="0"/>${axisTitle(
        chart.secondaryValueAxisTitle
      )}<cx:units unit="percentage"/><cx:tickLabels/></cx:axis>`;
  }

  const legendPos = { right: "r", left: "l", top: "t", bottom: "b" } as const;
  const legend =
    chart.legend && chart.legend !== "none"
      ? `<cx:legend pos="${legendPos[chart.legend]}" align="ctr" overlay="0"/>`
      : "";
  const title = chart.title?.trim()
    ? `<cx:title pos="t" align="ctr" overlay="0"><cx:tx><cx:txData><cx:v>${esc(
        chart.title.trim()
      )}</cx:v></cx:txData></cx:tx></cx:title>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<cx:chartSpace xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:cx="${NS_CX}">` +
    `<cx:chartData>${data}</cx:chartData>` +
    `<cx:chart>${title}<cx:plotArea><cx:plotAreaRegion>${series}</cx:plotAreaRegion>${axes}</cx:plotArea>${legend}</cx:chart>` +
    `</cx:chartSpace>`
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function textOf(node: XmlNode | undefined) {
  if (!node) return "";
  const v = child(node, "tx", "txData", "v");
  if (v) return v.text.trim();
  return findAll(node, "t")
    .map((t) => t.text)
    .join("")
    .trim();
}

function levelPoints(dim: XmlNode | undefined): string[] {
  const lvl = child(dim, "lvl");
  if (!lvl) return [];
  const n = parseInt(lvl.attrs.ptCount ?? "", 10);
  const out: string[] = [];
  children(lvl, "pt").forEach((pt, i) => {
    const idx = parseInt(pt.attrs.idx ?? String(i), 10);
    out[Number.isFinite(idx) ? idx : i] = pt.text;
  });
  const len = Number.isFinite(n) ? Math.max(n, out.length) : out.length;
  for (let i = 0; i < len; i += 1) if (out[i] == null) out[i] = "";
  return out;
}

function num(v: string | undefined) {
  if (v == null || v === "" || v === "auto") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function colorOfSpPr(spPr: XmlNode | undefined) {
  const srgb = find(spPr, "srgbClr")?.attrs.val;
  return srgb ? `#${srgb.toUpperCase()}` : undefined;
}

/** Parse a chartex part; null for layouts TinySheet cannot draw. */
export function importChartExXml(
  xml: string,
  opts: ImportChartOptions
): ImportedChart | null {
  const root = parseXml(xml);
  const space = find(root, "chartSpace");
  const chartNode = child(space, "chart");
  const region = find(chartNode, "plotAreaRegion");
  const seriesNodes = children(region, "series");
  const first = seriesNodes.find((s) => s.attrs.layoutId !== "paretoLine");
  if (!first) return null;
  const layout = first.attrs.layoutId;
  const pareto = seriesNodes.some((s) => s.attrs.layoutId === "paretoLine");
  let type: ChartType;
  if (layout === "waterfall") type = "waterfall";
  else if (layout === "funnel") type = "funnel";
  else if (layout === "clusteredColumn") type = pareto ? "pareto" : "histogram";
  else return null;

  const dataId = child(first, "dataId")?.attrs.val ?? "0";
  const dataNode = children(child(space, "chartData"), "data").find(
    (d) => (d.attrs.id ?? "0") === dataId
  );
  const catDim =
    children(dataNode, "strDim").find((d) => d.attrs.type === "cat") ??
    children(dataNode, "numDim").find((d) => d.attrs.type === "cat");
  const valDim = children(dataNode, "numDim").find(
    (d) => (d.attrs.type ?? "val") === "val"
  );

  const series: ChartSeries = { values: null };
  const valRef = child(valDim, "f")?.text.trim();
  series.values = valRef ? opts.resolveRange(valRef) : null;
  const cachedValues = levelPoints(valDim).map((v) => num(v) ?? null);
  const cache: NonNullable<ChartSeries["cache"]> = {};
  if (cachedValues.length) cache.values = cachedValues;
  if (catDim) {
    const catRef = child(catDim, "f")?.text.trim();
    const range = catRef ? opts.resolveRange(catRef) : null;
    if (range) series.categories = range;
    const cats = levelPoints(catDim);
    if (cats.length) cache.categories = cats;
  }
  const txNode = child(first, "tx", "txData");
  const nameRef = child(txNode, "f")?.text.trim();
  const nameCached = child(txNode, "v")?.text;
  if (nameRef) {
    const range = opts.resolveRange(nameRef);
    if (range) series.nameRef = range;
    else if (nameCached) series.name = nameCached;
  } else if (nameCached != null) series.name = nameCached;
  if (nameCached) cache.name = nameCached;
  if (Object.keys(cache).length) series.cache = cache;
  const color = colorOfSpPr(child(first, "spPr"));
  if (color && type !== "waterfall") series.color = color;

  const out: ImportedChart = { type, series: [series] };
  const title = textOf(child(chartNode, "title"));
  if (title) out.title = title;
  const labels = child(first, "dataLabels");
  if (labels) {
    const vis = child(labels, "visibility");
    out.dataLabels = true;
    const o: NonNullable<Chart["dataLabelOptions"]> = {};
    if (vis?.attrs.value === "0") o.showValue = false;
    if (vis?.attrs.categoryName === "1") o.showCategory = true;
    if (vis?.attrs.seriesName === "1") o.showSeriesName = true;
    const pos = Object.entries(POS).find(([, v]) => v === labels.attrs.pos);
    if (pos) o.position = pos[0] as NonNullable<typeof o.position>;
    const fmt = child(labels, "numFmt")?.attrs.formatCode;
    if (fmt) o.numberFormat = fmt;
    if (Object.keys(o).length) out.dataLabelOptions = o;
  } else if (type === "funnel") out.dataLabels = false;

  const layoutPr = child(first, "layoutPr");
  if (type === "waterfall") {
    const totals = children(child(layoutPr, "subtotals"), "idx")
      .map((n) => parseInt(n.attrs.val ?? "", 10))
      .filter((n) => Number.isFinite(n));
    if (totals.length) out.waterfallTotals = totals;
    if (child(layoutPr, "visibility")?.attrs.connectorLines === "0")
      out.waterfallConnectors = false;
  }
  const binning = child(layoutPr, "binning");
  if (binning) {
    const b: ChartHistogramBinning = {};
    const size = num(child(binning, "binSize")?.attrs.val);
    const cnt = num(child(binning, "binCount")?.attrs.val);
    if (size != null) {
      b.mode = "width";
      b.width = size;
    } else if (cnt != null) {
      b.mode = "count";
      b.count = cnt;
    }
    const over = num(binning.attrs.overflow);
    const under = num(binning.attrs.underflow);
    if (over != null) b.overflow = over;
    if (under != null) b.underflow = under;
    if (Object.keys(b).length) out.binning = b;
  }

  const axes = children(find(chartNode, "plotArea"), "axis");
  const catAxis = axes.find((a) => child(a, "catScaling"));
  const valAxis = axes.find((a) => a.attrs.id === "1");
  const catTitle = textOf(child(catAxis, "title"));
  const valTitle = textOf(child(valAxis, "title"));
  if (catTitle) out.categoryAxisTitle = catTitle;
  if (valTitle) out.valueAxisTitle = valTitle;
  out.gridlines = !!child(valAxis, "majorGridlines");
  const secTitle = textOf(
    child(
      axes.find((a) => a.attrs.id === "2"),
      "title"
    )
  );
  if (secTitle) out.secondaryValueAxisTitle = secTitle;

  const legend = child(chartNode, "legend");
  const legendMap: Record<string, ChartLegendPosition> = {
    l: "left",
    t: "top",
    b: "bottom",
    r: "right",
  };
  out.legend = legend
    ? (legendMap[legend.attrs.pos ?? "r"] ?? "right")
    : "none";
  return out;
}
