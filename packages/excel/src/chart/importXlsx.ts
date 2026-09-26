/**
 * Read a DrawingML chart part (xl/charts/chartN.xml) into a live TinySheet
 * chart object: column, bar, line, area, combo (several chart groups, with
 * a secondary axis), pie, doughnut, scatter, bubble, radar and stock
 * charts, with trendlines, error bars and data label options. Returns null
 * for chart families the renderer cannot draw (surface, pie-of-pie, 3-D
 * only variants...), so the importer can fall back to a static image.
 * Office 2016 chart types live in chartex parts (./chartEx.ts).
 */
import type {
  Chart,
  ChartDataLabelOptions,
  ChartErrorBars,
  ChartGrouping,
  ChartLegendPosition,
  ChartRange,
  ChartSeries,
  ChartSeriesType,
  ChartTrendline,
  ChartType,
} from "@lofcz/tinysheet-core";
import { child, children, find, findAll, parseXml, val, XmlNode } from "./xml";

export type ImportedChart = Omit<
  Chart,
  "id" | "left" | "top" | "width" | "height"
>;

const SCHEME_COLORS: Record<string, string> = {
  accent1: "#4472C4",
  accent2: "#ED7D31",
  accent3: "#A5A5A5",
  accent4: "#FFC000",
  accent5: "#5B9BD5",
  accent6: "#70AD47",
  tx1: "#000000",
  dk1: "#000000",
  bg1: "#FFFFFF",
  lt1: "#FFFFFF",
  tx2: "#44546A",
  dk2: "#44546A",
  bg2: "#E7E6E6",
  lt2: "#E7E6E6",
};

const SUPPORTED: Record<string, ChartType> = {
  barChart: "column",
  bar3DChart: "column",
  lineChart: "line",
  line3DChart: "line",
  areaChart: "area",
  area3DChart: "area",
  pieChart: "pie",
  pie3DChart: "pie",
  doughnutChart: "doughnut",
  scatterChart: "scatter",
  radarChart: "radar",
  bubbleChart: "bubble",
  stockChart: "stock",
};

/** Groups that can be combined into a combo chart. */
const COMBINABLE: Record<string, ChartSeriesType> = {
  barChart: "column",
  bar3DChart: "column",
  lineChart: "line",
  line3DChart: "line",
  areaChart: "area",
  area3DChart: "area",
};

function isTrue(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value === "1" || value === "true";
}

function colorOf(fill: XmlNode | undefined): string | undefined {
  if (!fill) return undefined;
  const srgb = child(fill, "srgbClr")?.attrs.val;
  if (srgb) return `#${srgb.toUpperCase()}`;
  const scheme = child(fill, "schemeClr")?.attrs.val;
  if (scheme && SCHEME_COLORS[scheme]) return SCHEME_COLORS[scheme];
  return undefined;
}

/**
 * An explicit RGB colour (what the Format tab writes); theme colours with
 * tints (Excel's default chart chrome) are left to the chart style.
 */
function explicitColor(fill: XmlNode | undefined): string | undefined {
  const srgb = child(fill, "srgbClr")?.attrs.val;
  return srgb ? `#${srgb.toUpperCase()}` : undefined;
}

/** Fill colour of a shape (area/bar fill, else its outline for lines). */
function shapeColor(spPr: XmlNode | undefined, preferLine: boolean) {
  const fill = colorOf(child(spPr, "solidFill"));
  const lineFill = colorOf(child(spPr, "ln", "solidFill"));
  return preferLine ? (lineFill ?? fill) : (fill ?? lineFill);
}

function richText(node: XmlNode | undefined): string {
  if (!node) return "";
  return findAll(node, "t")
    .map((t) => t.text)
    .join("")
    .trim();
}

function cachePoints(cache: XmlNode | undefined): string[] {
  if (!cache) return [];
  const count = parseInt(val(cache, "ptCount") ?? "", 10);
  const out: string[] = [];
  children(cache, "pt").forEach((pt, i) => {
    const idx = parseInt(pt.attrs.idx ?? String(i), 10);
    out[Number.isFinite(idx) ? idx : i] = child(pt, "v")?.text ?? "";
  });
  const n = Number.isFinite(count) ? Math.max(count, out.length) : out.length;
  for (let i = 0; i < n; i += 1) if (out[i] == null) out[i] = "";
  return out;
}

type DataSource = {
  ref?: string;
  /** c15:fullRef: the whole range of a reference the Chart Filters cut. */
  fullRef?: string;
  cache: string[];
};

/** `c:cat` / `c:val` / `c:xVal` / `c:yVal` / `c:bubbleSize` data source. */
function dataSource(node: XmlNode | undefined): DataSource | undefined {
  if (!node) return undefined;
  const ref = child(node, "numRef") ?? child(node, "strRef");
  if (ref) {
    const cache = child(ref, "numCache") ?? child(ref, "strCache");
    const full = find(child(ref, "extLst"), "sqref")?.text.trim();
    return {
      ref: child(ref, "f")?.text.trim(),
      cache: cachePoints(cache),
      ...(full ? { fullRef: full } : {}),
    };
  }
  const multi = child(node, "multiLvlStrRef");
  if (multi) {
    // Multi-level categories: keep the innermost level's labels.
    const lvl = find(multi, "lvl");
    return { ref: child(multi, "f")?.text.trim(), cache: cachePoints(lvl) };
  }
  const lit = child(node, "numLit") ?? child(node, "strLit");
  if (lit) return { cache: cachePoints(lit) };
  return undefined;
}

function toNumber(text: string): number | null {
  if (text == null || text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export type ImportChartOptions = {
  /** Resolve an A1 reference (`Sheet1!$A$1:$A$4`) to a range, or null. */
  resolveRange: (ref: string) => ChartRange | null;
};

function numberVal(node: XmlNode | undefined, ...path: string[]) {
  const raw = val(node, ...path);
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

const TREND_TYPES: Record<string, ChartTrendline["type"]> = {
  linear: "linear",
  exp: "exponential",
  log: "logarithmic",
  poly: "polynomial",
  power: "power",
  movingAvg: "movingAverage",
};

function readTrendline(node: XmlNode): ChartTrendline | null {
  const type = TREND_TYPES[val(node, "trendlineType") ?? "linear"];
  if (!type) return null;
  const t: ChartTrendline = { type };
  const order = numberVal(node, "order");
  const period = numberVal(node, "period");
  const forward = numberVal(node, "forward");
  const backward = numberVal(node, "backward");
  const intercept = numberVal(node, "intercept");
  if (type === "polynomial") t.order = order ?? 2;
  if (type === "movingAverage") t.period = period ?? 2;
  if (forward) t.forward = forward;
  if (backward) t.backward = backward;
  if (intercept != null) t.intercept = intercept;
  if (isTrue(val(node, "dispEq"), false)) t.displayEquation = true;
  if (isTrue(val(node, "dispRSqr"), false)) t.displayRSquared = true;
  const name = child(node, "name")?.text;
  if (name) t.name = name;
  const color = shapeColor(child(node, "spPr"), true);
  if (color) t.color = color;
  return t;
}

const ERR_TYPES: Record<string, ChartErrorBars["type"]> = {
  fixedVal: "fixed",
  percentage: "percentage",
  stdDev: "stdDev",
  stdErr: "stdErr",
  cust: "custom",
};

function readErrorBars(
  nodes: XmlNode[],
  opts: ImportChartOptions
): ChartSeries["errorBars"] | undefined {
  // TinySheet draws Y error bars; scatter X bars are skipped.
  const node = nodes.find((n) => (val(n, "errDir") ?? "y") === "y");
  if (!node) return undefined;
  const type = ERR_TYPES[val(node, "errValType") ?? "fixedVal"];
  if (!type) return undefined;
  const out: NonNullable<ChartSeries["errorBars"]> = { type };
  const include = val(node, "errBarType");
  if (include === "plus" || include === "minus") out.include = include;
  if (isTrue(val(node, "noEndCap"), false)) out.endCap = false;
  const value = numberVal(node, "val");
  if (value != null) out.value = value;
  if (type === "custom") {
    (["plus", "minus"] as const).forEach((side) => {
      const src = dataSource(child(node, side));
      const range = src?.ref ? opts.resolveRange(src.ref) : null;
      if (range) out[side] = range;
    });
  }
  const color = shapeColor(child(node, "spPr"), true);
  if (color) out.color = color;
  return out;
}

type ReadSeries = ChartSeries & {
  markers?: boolean;
  lines?: boolean;
  showVal?: boolean;
  hiddenPoints?: number[];
};

/** Indices of the cells of `full` that `shown` (a union of parts) omits. */
function hiddenPoints(full: ChartRange, shown: ChartRange): number[] {
  const inShown = (r: number, c: number) =>
    [shown, ...(shown.areas ?? [])].some(
      (a) =>
        a.sheetId === full.sheetId &&
        r >= a.row[0] &&
        r <= a.row[1] &&
        c >= a.column[0] &&
        c <= a.column[1]
    );
  const out: number[] = [];
  let i = 0;
  for (let r = full.row[0]; r <= full.row[1]; r += 1) {
    for (let c = full.column[0]; c <= full.column[1]; c += 1) {
      if (!inShown(r, c)) out.push(i);
      i += 1;
    }
  }
  return out;
}

function readSeries(
  ser: XmlNode,
  type: ChartType,
  opts: ImportChartOptions
): ReadSeries {
  const series: ReadSeries = { values: null };
  const tx = child(ser, "tx");
  if (tx) {
    const strRef = child(tx, "strRef");
    if (strRef) {
      const f = child(strRef, "f")?.text.trim();
      const range = f ? opts.resolveRange(f) : null;
      if (range) series.nameRef = range;
      const cached = cachePoints(child(strRef, "strCache")).join(" ");
      if (cached) series.cache = { ...series.cache, name: cached };
      if (!range && cached) series.name = cached;
    } else {
      const literal = child(tx, "v")?.text;
      if (literal != null) series.name = literal;
    }
  }
  const spPr = child(ser, "spPr");
  const color = shapeColor(
    spPr,
    type === "line" || type === "scatter" || type === "radar"
  );
  if (color && type !== "stock") series.color = color;
  if (type === "stock") {
    const marker = shapeColor(child(ser, "marker", "spPr"), false);
    if (marker) series.color = marker;
  }
  if (spPr && child(spPr, "ln", "noFill")) series.lines = false;
  if (type === "column" || type === "bar" || type === "area") {
    const outline = explicitColor(child(spPr, "ln", "solidFill"));
    if (outline) series.outline = outline;
  }

  const points: string[] = [];
  children(ser, "dPt").forEach((dPt) => {
    const idx = parseInt(val(dPt, "idx") ?? "", 10);
    const c = shapeColor(child(dPt, "spPr"), false);
    if (Number.isFinite(idx) && c) points[idx] = c;
  });
  if (points.length) {
    series.pointColors = Array.from(points, (p) => p ?? "");
  }

  const symbol = val(ser, "marker", "symbol");
  if (symbol != null) series.markers = symbol !== "none";
  const showVal = val(ser, "dLbls", "showVal");
  if (showVal != null) series.showVal = isTrue(showVal, false);

  const trendlines = children(ser, "trendline")
    .map(readTrendline)
    .filter((t): t is ChartTrendline => !!t);
  if (trendlines.length) series.trendlines = trendlines;
  const errorBars = readErrorBars(children(ser, "errBars"), opts);
  if (errorBars) series.errorBars = errorBars;

  const cat = dataSource(child(ser, "cat") ?? child(ser, "xVal"));
  const values = dataSource(child(ser, "val") ?? child(ser, "yVal"));
  // a reference cut by the Chart Filters: the whole range, and the points
  // left out become hidden categories
  const whole = (src: DataSource) =>
    src.fullRef ? opts.resolveRange(src.fullRef) : null;
  if (cat) {
    const full = whole(cat);
    const range = full ?? (cat.ref ? opts.resolveRange(cat.ref) : null);
    if (range) series.categories = range;
    if (cat.cache.length && !full)
      series.cache = { ...series.cache, categories: cat.cache };
  }
  if (values) {
    const full = whole(values);
    const shown = values.ref ? opts.resolveRange(values.ref) : null;
    series.values = full ?? shown;
    if (full && shown) {
      const hidden = hiddenPoints(full, shown);
      if (hidden.length) series.hiddenPoints = hidden;
    }
    if (values.cache.length && !full)
      series.cache = { ...series.cache, values: values.cache.map(toNumber) };
  }
  const sizes = dataSource(child(ser, "bubbleSize"));
  if (sizes) {
    const range =
      whole(sizes) ?? (sizes.ref ? opts.resolveRange(sizes.ref) : null);
    if (range) series.sizes = range;
    if (sizes.cache.length)
      series.cache = { ...series.cache, sizes: sizes.cache.map(toNumber) };
  }
  return series;
}

function axisTitle(axis: XmlNode | undefined) {
  return richText(child(axis, "title"));
}

function legendPosition(chart: XmlNode): ChartLegendPosition {
  const legend = child(chart, "legend");
  if (!legend) return "none";
  switch (val(legend, "legendPos")) {
    case "l":
      return "left";
    case "t":
      return "top";
    case "b":
      return "bottom";
    default:
      return "right";
  }
}

function axisBounds(axis: XmlNode | undefined) {
  const min = numberVal(axis, "scaling", "min");
  const max = numberVal(axis, "scaling", "max");
  const majorUnit = numberVal(axis, "majorUnit");
  if (min == null && max == null && majorUnit == null) return undefined;
  return {
    ...(min != null ? { min } : {}),
    ...(max != null ? { max } : {}),
    ...(majorUnit != null ? { majorUnit } : {}),
  };
}

const POSITIONS: Record<string, ChartDataLabelOptions["position"]> = {
  ctr: "center",
  inEnd: "insideEnd",
  inBase: "insideBase",
  outEnd: "outsideEnd",
  t: "above",
  b: "below",
  l: "left",
  r: "right",
  bestFit: "bestFit",
};

function readLabelOptions(dLbls: XmlNode | undefined) {
  if (!dLbls) return undefined;
  const o: ChartDataLabelOptions = {};
  if (val(dLbls, "showVal") === "0") o.showValue = false;
  if (isTrue(val(dLbls, "showCatName"), false)) o.showCategory = true;
  if (isTrue(val(dLbls, "showSerName"), false)) o.showSeriesName = true;
  if (isTrue(val(dLbls, "showPercent"), false)) o.showPercent = true;
  const pos = POSITIONS[val(dLbls, "dLblPos") ?? ""];
  if (pos) o.position = pos;
  const fmt = child(dLbls, "numFmt")?.attrs.formatCode;
  if (
    fmt &&
    fmt !== "General" &&
    child(dLbls, "numFmt")?.attrs.sourceLinked !== "1"
  )
    o.numberFormat = fmt;
  const sep = child(dLbls, "separator")?.text;
  if (sep != null && sep !== "") o.separator = sep;
  return Object.keys(o).length ? o : undefined;
}

function anyLabelShown(dLbls: XmlNode | undefined) {
  return ["showVal", "showCatName", "showSerName", "showPercent"].some((k) =>
    isTrue(val(dLbls, k), false)
  );
}

/** Parse chart XML; null when the chart type is not supported. */
export function importChartXml(
  xml: string,
  opts: ImportChartOptions
): ImportedChart | null {
  const root = parseXml(xml);
  const chart = find(root, "chart");
  const plot = child(chart, "plotArea");
  if (!chart || !plot) return null;
  const allGroups = plot.children.filter((c) => c.name.endsWith("Chart"));
  if (allGroups.length === 0 || !SUPPORTED[allGroups[0].name]) return null;
  const groups = allGroups.filter((c) => SUPPORTED[c.name]);
  const first = groups[0];
  let type = SUPPORTED[first.name];
  const horizontal =
    (first.name === "barChart" || first.name === "bar3DChart") &&
    val(first, "barDir") === "bar";
  if (horizontal) type = "bar";

  // Combination charts: several bar / line / area groups, or groups on a
  // secondary axis. The value axis of the first group is the primary one.
  const valAxes = children(plot, "valAx");
  const primaryAxisIds = children(first, "axId").map((a) => a.attrs.val);
  const isSecondary = (g: XmlNode) => {
    const ids = children(g, "axId").map((a) => a.attrs.val);
    return ids.length > 0 && !ids.every((id) => primaryAxisIds.includes(id));
  };
  const kinds = new Set(groups.map((g) => COMBINABLE[g.name]).filter(Boolean));
  const combinable = groups.every((g) => COMBINABLE[g.name]) && !horizontal;
  const combo = combinable && kinds.size > 1;
  if (combo) type = "combo";

  const out: ImportedChart = { type, series: [] };
  const groupingRaw = val(first, "grouping");
  if (
    type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area" ||
    type === "combo"
  ) {
    const grouping: ChartGrouping =
      groupingRaw === "stacked" || groupingRaw === "percentStacked"
        ? groupingRaw
        : "clustered";
    out.grouping = grouping;
  }

  const used = combinable ? groups : [first];
  const all: ReadSeries[] = [];
  const orders: number[] = [];
  used.forEach((g) => {
    const gType = combinable ? SUPPORTED[g.name] : type;
    const secondary = combinable && isSecondary(g);
    // series hidden by the Chart Filters live in a c15 extension
    const filtered = children(child(g, "extLst"), "ext").flatMap((ext) =>
      ext.children
        .filter((c) => /^filtered\w+Series$/.test(c.name))
        .map((c) => child(c, "ser"))
        .filter((s): s is XmlNode => !!s)
    );
    const read = (ser: XmlNode, hidden: boolean) => {
      const s = readSeries(
        ser,
        gType === "column" && horizontal ? "bar" : gType,
        opts
      );
      if (combo) s.type = COMBINABLE[g.name];
      if (secondary) s.secondary = true;
      if (hidden) s.filtered = true;
      const order = parseInt(val(ser, "order") ?? "", 10);
      orders.push(Number.isFinite(order) ? order : all.length);
      all.push(s);
    };
    children(g, "ser").forEach((ser) => read(ser, false));
    filtered.forEach((ser) => read(ser, true));
  });
  // plot order (filtered series were read after the others)
  if (all.some((s) => s.filtered)) {
    const sorted = all
      .map((s, i) => ({ s, o: orders[i], i }))
      .sort((a, b) => a.o - b.o || a.i - b.i)
      .map((e) => e.s);
    all.splice(0, all.length, ...sorted);
  }

  let showVal = used.some((g) => isTrue(val(g, "dLbls", "showVal"), false));
  const groupLabels = used.map((g) => child(g, "dLbls")).find(anyLabelShown);
  let markersSeen = false;
  let anyMarker = false;
  let anyLines = false;
  all.forEach((s) => {
    if (s.showVal) showVal = true;
    if (s.markers != null) markersSeen = true;
    if (s.markers !== false) anyMarker = true;
    if (s.lines !== false) anyLines = true;
    const clean: ChartSeries & Record<string, unknown> = { ...s };
    delete clean.markers;
    delete clean.lines;
    delete clean.showVal;
    delete clean.hiddenPoints;
    out.series.push(clean);
  });
  const hiddenCats = all.find((s) => s.hiddenPoints?.length)?.hiddenPoints;
  if (hiddenCats) out.hiddenCategories = hiddenCats;
  if (showVal || groupLabels) out.dataLabels = true;
  const labelOptions = readLabelOptions(groupLabels);
  if (labelOptions) out.dataLabelOptions = labelOptions;

  if (type === "line" || type === "combo") {
    const lineGroup = used.find((g) => g.name.startsWith("line")) ?? first;
    const groupMarker = val(lineGroup, "marker");
    out.markers = markersSeen ? anyMarker : isTrue(groupMarker, true);
  }
  if (type === "scatter") {
    const style = val(first, "scatterStyle") ?? "marker";
    out.markers = markersSeen ? anyMarker : !/^(line|smooth)$/.test(style);
    out.scatterLines = style === "marker" ? false : anyLines;
  }
  if (type === "radar") {
    const style = val(first, "radarStyle") ?? "marker";
    if (style === "filled") out.radarStyle = "filled";
    else if (style === "standard" || (markersSeen && !anyMarker))
      out.radarStyle = "line";
    else out.radarStyle = "marker";
  }
  if (type === "bubble") {
    const scale = numberVal(first, "bubbleScale");
    if (scale != null && scale !== 100) out.bubbleScale = scale;
  }
  if (type === "stock") {
    out.stockVariant =
      child(first, "upDownBars") || all.length >= 4 ? "ohlc" : "hlc";
  }
  const vary = child(first, "varyColors");
  if (vary) out.varyColors = isTrue(vary.attrs.val, true);

  // Titles
  const titleNode = child(chart, "title");
  let title = richText(child(titleNode, "tx"));
  if (!title && titleNode) {
    const ref = child(titleNode, "tx", "strRef");
    title = cachePoints(child(ref, "strCache")).join(" ");
  }
  if (
    !title &&
    titleNode &&
    !isTrue(val(chart, "autoTitleDeleted"), false) &&
    all.length === 1
  ) {
    // Excel's automatic title is the series name.
    title = all[0].name ?? all[0].cache?.name ?? "";
  }
  if (title) out.title = title;

  const catAx = child(plot, "catAx") ?? child(plot, "dateAx");
  let categoryAxis: XmlNode | undefined = catAx;
  let valueAxis: XmlNode | undefined =
    valAxes.find((a) => primaryAxisIds.includes(val(a, "axId"))) ?? valAxes[0];
  if (type === "scatter" || type === "bubble") {
    categoryAxis =
      valAxes.find((a) => val(a, "axPos") === "b" || val(a, "axPos") === "t") ??
      valAxes[0];
    valueAxis = valAxes.find((a) => a !== categoryAxis) ?? valAxes[1];
  }
  const catTitle = axisTitle(categoryAxis);
  const valTitle = axisTitle(valueAxis);
  if (catTitle) out.categoryAxisTitle = catTitle;
  if (valTitle) out.valueAxisTitle = valTitle;
  if (type !== "pie" && type !== "doughnut") {
    out.gridlines = !!child(valueAxis, "majorGridlines");
    const bounds = axisBounds(valueAxis);
    if (bounds) out.valueAxis = bounds;
  } else {
    out.gridlines = false;
  }
  if (all.some((s) => s.secondary)) {
    const secondaryAxis = valAxes.find(
      (a) => a !== valueAxis && !primaryAxisIds.includes(val(a, "axId"))
    );
    const secTitle = axisTitle(secondaryAxis);
    if (secTitle) out.secondaryValueAxisTitle = secTitle;
    const bounds = axisBounds(secondaryAxis);
    if (bounds) out.secondaryValueAxis = bounds;
  }
  out.legend = legendPosition(chart);
  readElements(out, chart, plot, used, categoryAxis, valueAxis);
  const chartArea = readChartAreaFormat(root);
  if (chartArea) out.formats = { ...out.formats, chartArea };
  return out;
}

/** The text colour of a `c:txPr` / title run, if any. */
function textColor(node: XmlNode | undefined) {
  if (!node) return undefined;
  // the first run / paragraph properties that give a colour
  const props = [...findAll(node, "rPr"), ...findAll(node, "defRPr")];
  for (const p of props) {
    const color = explicitColor(child(p, "solidFill"));
    if (color) return color;
  }
  return undefined;
}

/** Fill / outline of a `c:spPr` (undefined when not set). */
function shapeFormat(spPr: XmlNode | undefined) {
  if (!spPr) return undefined;
  const out: { fill?: string | null; line?: string | null } = {};
  if (child(spPr, "noFill")) out.fill = null;
  else {
    const fill = explicitColor(child(spPr, "solidFill"));
    if (fill) out.fill = fill;
  }
  if (child(spPr, "ln", "noFill")) out.line = null;
  else {
    const line = explicitColor(child(spPr, "ln", "solidFill"));
    if (line) out.line = line;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Chart elements: axes shown, gridlines, data table, drop / high-low
 * lines, up/down bars, title overlay, hidden and empty cell settings and
 * the Format tab's fills, outlines and text colours.
 */
function readElements(
  out: ImportedChart,
  chart: XmlNode,
  plot: XmlNode,
  used: XmlNode[],
  categoryAxis: XmlNode | undefined,
  valueAxis: XmlNode | undefined
) {
  const deleted = (axis: XmlNode | undefined) =>
    !!axis && isTrue(val(axis, "delete"), false);
  const axes: NonNullable<ImportedChart["axes"]> = {};
  if (deleted(categoryAxis)) axes.category = false;
  if (deleted(valueAxis)) axes.value = false;
  if (Object.keys(axes).length) out.axes = axes;
  if (child(categoryAxis, "majorGridlines")) out.categoryGridlines = true;
  if (child(categoryAxis, "minorGridlines")) out.minorCategoryGridlines = true;
  if (child(valueAxis, "minorGridlines")) out.minorGridlines = true;
  const dTable = child(plot, "dTable");
  if (dTable) {
    out.dataTable = { legendKeys: isTrue(val(dTable, "showKeys"), true) };
  }
  if (out.type !== "stock") {
    const lineGroup = used.find((g) => g.name === "lineChart");
    if (used.some((g) => child(g, "dropLines"))) out.dropLines = true;
    if (lineGroup && child(lineGroup, "hiLowLines")) out.hiLowLines = true;
    if (lineGroup && child(lineGroup, "upDownBars")) out.upDownBars = true;
  }
  const titleNode = child(chart, "title");
  if (titleNode && isTrue(val(titleNode, "overlay"), false))
    out.titleOverlay = true;
  const blanks = val(chart, "dispBlanksAs");
  if (blanks === "zero" || blanks === "span") out.displayBlanksAs = blanks;
  if (val(chart, "plotVisOnly") === "0") out.plotVisibleOnly = false;
  if (isTrue(val(find(child(chart, "extLst"), "dispNaAsBlank")), false))
    out.displayNaAsBlank = true;

  const formats: NonNullable<ImportedChart["formats"]> = {};
  const set = (
    key: keyof NonNullable<ImportedChart["formats"]>,
    f: { fill?: string | null; line?: string | null; text?: string } | undefined
  ) => {
    if (f && Object.keys(f).length) formats[key] = { ...formats[key], ...f };
  };
  const text = (color: string | undefined) => (color ? { text: color } : {});
  set("plotArea", shapeFormat(child(plot, "spPr")));
  if (titleNode) {
    set("title", {
      ...shapeFormat(child(titleNode, "spPr")),
      ...text(textColor(child(titleNode, "tx"))),
    });
  }
  const legend = child(chart, "legend");
  if (legend) {
    set("legend", {
      ...shapeFormat(child(legend, "spPr")),
      ...text(textColor(child(legend, "txPr"))),
    });
  }
  (
    [
      ["categoryAxis", categoryAxis],
      ["valueAxis", valueAxis],
    ] as const
  ).forEach(([key, axis]) => {
    if (!axis) return;
    const line = shapeFormat(child(axis, "spPr"))?.line;
    set(key, {
      ...(line ? { line } : {}),
      ...text(textColor(child(axis, "txPr"))),
    });
    const titleColor = textColor(child(axis, "title", "tx"));
    if (titleColor)
      set(key === "categoryAxis" ? "categoryAxisTitle" : "valueAxisTitle", {
        text: titleColor,
      });
  });
  const gridLine = shapeFormat(
    child(valueAxis, "majorGridlines", "spPr")
  )?.line;
  if (gridLine) set("majorGridlines", { line: gridLine });
  if (Object.keys(formats).length) out.formats = formats;
}

/**
 * The chart area's fill and outline (c:chartSpace/c:spPr), unless they are
 * the defaults TinySheet writes (white fill, light grey outline).
 */
function readChartAreaFormat(root: XmlNode) {
  const space = find(root, "chartSpace");
  const spPr = space?.children.find((c) => c.name === "spPr");
  const f = shapeFormat(spPr);
  if (!f) return undefined;
  if (f.fill === "#FFFFFF") delete f.fill;
  if (f.line === "#D9D9D9") delete f.line;
  return Object.keys(f).length ? f : undefined;
}
