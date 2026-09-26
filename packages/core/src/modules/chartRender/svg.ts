/**
 * SVG primitives and text helpers shared by the chart renderers.
 */
// @ts-ignore
import SSF from "../ssf";
import { escapeXml, roundSvgNumber as n } from "./legacy";
import type {
  ChartDataLabelOptions,
  ChartRenderLabels,
  ChartRenderModel,
  ChartRenderSeries,
  ChartStyleSpec,
} from "./types";

export type Rect = { x: number; y: number; width: number; height: number };

export const TITLE_SIZE = 14;
export const LABEL_SIZE = 10;
export const LEGEND_SIZE = 10;
export const AXIS_TITLE_SIZE = 10;
export const PAD = 8;
/** Excel's default gap width (150% of a bar). */
export const GAP_WIDTH = 1.5;

export const DEFAULT_LABELS: ChartRenderLabels = {
  increase: "Increase",
  decrease: "Decrease",
  total: "Total",
  cumulative: "Cumulative %",
};

export { n, escapeXml };

/** Rough text width for Calibri/Arial-like fonts (no DOM measuring). */
export function estimateTextWidth(str: string, fontSize: number) {
  let units = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code > 0x2e80) units += 1;
    else if ("iljtfI.,:;'!| ".indexOf(str[i]) >= 0) units += 0.32;
    else if ("mwMW".indexOf(str[i]) >= 0) units += 0.85;
    else if (str[i] >= "A" && str[i] <= "Z") units += 0.64;
    else units += 0.54;
  }
  return units * fontSize;
}

export function truncateText(str: string, maxWidth: number, fontSize: number) {
  if (maxWidth <= 0) return "";
  if (estimateTextWidth(str, fontSize) <= maxWidth) return str;
  let out = str;
  while (out.length > 1 && estimateTextWidth(`${out}…`, fontSize) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length <= 1 ? "" : `${out}…`;
}

/** Excel "General"-like number text for data labels. */
export function formatChartNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  if (abs >= 1e11 || abs < 1e-9) return value.toExponential(2);
  const digits = Math.max(0, 10 - Math.floor(Math.log10(abs) + 1));
  return String(parseFloat(value.toFixed(Math.min(digits, 9))));
}

/** Format with an Excel number format code; never throws. */
export function formatWithCode(code: string | undefined, value: number) {
  if (!code || code === "General") return formatChartNumber(value);
  try {
    return String(SSF.format(code, value));
  } catch (e) {
    return formatChartNumber(value);
  }
}

export type TextOptions = {
  size: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  weight?: string;
  baseline?: string;
  rotate?: number;
  family: string;
};

export function svgText(
  x: number,
  y: number,
  content: string,
  opts: TextOptions
) {
  if (!content) return "";
  const rotate =
    opts.rotate != null
      ? ` transform="rotate(${opts.rotate} ${n(x)} ${n(y)})"`
      : "";
  return `<text x="${n(x)}" y="${n(y)}" font-family="${escapeXml(
    opts.family
  )}" font-size="${opts.size}"${
    opts.weight ? ` font-weight="${opts.weight}"` : ""
  } fill="${escapeXml(opts.fill)}" text-anchor="${opts.anchor || "start"}"${
    opts.baseline ? ` dominant-baseline="${opts.baseline}"` : ""
  }${rotate}>${escapeXml(content)}</text>`;
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width = 1,
  extra = ""
) {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(
    y2
  )}" stroke="${escapeXml(stroke)}" stroke-width="${width}"${extra}/>`;
}

export function rect(r: Rect, fill: string, extra = "") {
  return `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(
    Math.max(0, r.width)
  )}" height="${n(Math.max(0, r.height))}" fill="${escapeXml(fill)}"${extra}/>`;
}

export function circle(
  cx: number,
  cy: number,
  r: number,
  fill: string,
  extra = ""
) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${escapeXml(
    fill
  )}"${extra}/>`;
}

/** Stroke / opacity attributes for filled marks under a chart style. */
export function fillExtra(style: ChartStyleSpec | undefined, radius = 0) {
  let out = "";
  if (style?.fillOpacity != null && style.fillOpacity < 1)
    out += ` fill-opacity="${style.fillOpacity}"`;
  if (style?.seriesOutline)
    out += ` stroke="${escapeXml(style.seriesOutline)}" stroke-width="${
      style.seriesOutlineWidth ?? 1
    }"`;
  if (radius > 0) out += ` rx="${n(radius)}"`;
  return out;
}

export function finite(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

export function categoryCount(model: ChartRenderModel) {
  let count = model.categories.length;
  model.series.forEach((s) => {
    count = Math.max(count, s.values.length);
  });
  return count;
}

export function categoryLabel(model: ChartRenderModel, i: number) {
  const label = model.categories[i];
  return label != null && label !== "" ? label : String(i + 1);
}

export function pointColor(series: ChartRenderSeries, index: number) {
  return series.pointColors?.[index] || series.color;
}

export function renderLabels(model: ChartRenderModel): ChartRenderLabels {
  return { ...DEFAULT_LABELS, ...(model.labels ?? {}) };
}

/**
 * Data label text: series name, category, value and percentage (in Excel's
 * order), joined by the separator.
 */
/** Whether point `i` of a series carries a data label. */
export function labelVisible(
  model: ChartRenderModel,
  series: ChartRenderSeries,
  i: number
) {
  if (!model.dataLabelOptions?.lastPointOnly) return true;
  let last = -1;
  series.values.forEach((v, k) => {
    if (v != null && Number.isFinite(v)) last = k;
  });
  return i === last;
}

export function dataLabelText(
  model: ChartRenderModel,
  series: ChartRenderSeries,
  i: number,
  value: number,
  extra: { category?: string; percent?: number } = {}
) {
  const o: ChartDataLabelOptions = model.dataLabelOptions ?? {};
  const parts: string[] = [];
  if (o.showSeriesName) parts.push(series.name);
  if (o.showCategory)
    parts.push(extra.category ?? categoryLabel(model, i) ?? "");
  if (o.showValue !== false) {
    if (o.numberFormat) parts.push(formatWithCode(o.numberFormat, value));
    else {
      const label = series.labels?.[i];
      parts.push(
        label != null && label !== "" ? label : formatChartNumber(value)
      );
    }
  }
  if (o.showPercent && extra.percent != null) {
    parts.push(`${Math.round(extra.percent * 100)}%`);
  }
  return parts.filter((p) => p !== "").join(o.separator ?? ", ");
}
