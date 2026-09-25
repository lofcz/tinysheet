/**
 * Read a DrawingML chart part (xl/charts/chartN.xml) into a live TinySheet
 * chart object. Returns null for chart families the renderer cannot draw
 * (radar, bubble, stock, surface, pie-of-pie...), so the importer can fall
 * back to a static image.
 */
import type {
  Chart,
  ChartGrouping,
  ChartLegendPosition,
  ChartRange,
  ChartSeries,
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

/** Fill colour of a shape (area/bar fill, else its outline for lines). */
function shapeColor(spPr: XmlNode | undefined, preferLine: boolean) {
  const fill = colorOf(child(spPr, "solidFill"));
  const lineFill = colorOf(child(spPr, "ln", "solidFill"));
  return preferLine ? lineFill ?? fill : fill ?? lineFill;
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
  cache: string[];
};

/** `c:cat` / `c:val` / `c:xVal` / `c:yVal` data source. */
function dataSource(node: XmlNode | undefined): DataSource | undefined {
  if (!node) return undefined;
  const ref = child(node, "numRef") ?? child(node, "strRef");
  if (ref) {
    const cache = child(ref, "numCache") ?? child(ref, "strCache");
    return { ref: child(ref, "f")?.text.trim(), cache: cachePoints(cache) };
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

function readSeries(
  ser: XmlNode,
  type: ChartType,
  opts: ImportChartOptions
): ChartSeries & { markers?: boolean; lines?: boolean; showVal?: boolean } {
  const series: ChartSeries & {
    markers?: boolean;
    lines?: boolean;
    showVal?: boolean;
  } = { values: null };
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
  const color = shapeColor(spPr, type === "line" || type === "scatter");
  if (color) series.color = color;
  if (spPr && child(spPr, "ln", "noFill")) series.lines = false;

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

  const cat = dataSource(child(ser, "cat") ?? child(ser, "xVal"));
  const values = dataSource(child(ser, "val") ?? child(ser, "yVal"));
  if (cat) {
    const range = cat.ref ? opts.resolveRange(cat.ref) : null;
    if (range) series.categories = range;
    if (cat.cache.length)
      series.cache = { ...series.cache, categories: cat.cache };
  }
  if (values) {
    const range = values.ref ? opts.resolveRange(values.ref) : null;
    series.values = range;
    if (values.cache.length)
      series.cache = { ...series.cache, values: values.cache.map(toNumber) };
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

function axisNumber(axis: XmlNode | undefined, ...path: string[]) {
  const raw = val(axis, ...path);
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
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
  const groups = plot.children.filter((c) => c.name.endsWith("Chart"));
  if (groups.length === 0) return null;
  const first = groups[0];
  let type = SUPPORTED[first.name];
  if (!type) return null;
  if (
    (first.name === "barChart" || first.name === "bar3DChart") &&
    val(first, "barDir") === "bar"
  ) {
    type = "bar";
  }

  const out: ImportedChart = { type, series: [] };
  const groupingRaw = val(first, "grouping");
  if (
    type === "column" ||
    type === "bar" ||
    type === "line" ||
    type === "area"
  ) {
    const grouping: ChartGrouping =
      groupingRaw === "stacked" || groupingRaw === "percentStacked"
        ? groupingRaw
        : "clustered";
    out.grouping = grouping;
  }

  // Combination charts: the first group's type, every group's series.
  const all = groups
    .filter((g) => SUPPORTED[g.name])
    .flatMap((g) => children(g, "ser"))
    .map((ser) => readSeries(ser, type, opts));

  let showVal = groups.some((g) => isTrue(val(g, "dLbls", "showVal"), false));
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
    out.series.push(clean);
  });
  if (showVal) out.dataLabels = true;

  if (type === "line") {
    const groupMarker = val(first, "marker");
    out.markers = markersSeen ? anyMarker : isTrue(groupMarker, true);
  }
  if (type === "scatter") {
    const style = val(first, "scatterStyle") ?? "marker";
    out.markers = markersSeen ? anyMarker : !/^(line|smooth)$/.test(style);
    out.scatterLines = style === "marker" ? false : anyLines;
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

  const valAxes = children(plot, "valAx");
  const catAx = child(plot, "catAx") ?? child(plot, "dateAx");
  let categoryAxis: XmlNode | undefined = catAx;
  let valueAxis: XmlNode | undefined = valAxes[0];
  if (type === "scatter") {
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
    const min = axisNumber(valueAxis, "scaling", "min");
    const max = axisNumber(valueAxis, "scaling", "max");
    const majorUnit = axisNumber(valueAxis, "majorUnit");
    if (min != null || max != null || majorUnit != null) {
      out.valueAxis = {
        ...(min != null ? { min } : {}),
        ...(max != null ? { max } : {}),
        ...(majorUnit != null ? { majorUnit } : {}),
      };
    }
  } else {
    out.gridlines = false;
  }
  out.legend = legendPosition(chart);
  return out;
}
