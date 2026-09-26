/**
 * Shapes drawn inside a chart (Format › Insert Shapes while a chart is
 * selected), like Excel's chart drawings: they belong to the chart, move
 * and size with it and are stored in chart-relative units (xlsx
 * `c:userShapes` with `cdr:relSizeAnchor`, fractions of the chart area).
 */
import type { Chart } from "./chart";
import type { ChartEffects } from "./chartRender";
import {
  createShape,
  galleryItem,
  plainToShapeText,
  Shape,
  ShapeBox,
} from "./shapes";

/** A shape in a chart: a sheet shape's look, placed in chart fractions. */
export type ChartShape = Omit<Shape, "from" | "to" | "group"> & {
  /** Left, top, width, height as fractions (0–1) of the chart's size. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Shape Effects (shadow, glow, soft edges, bevel, 3-D). */
  effects?: ChartEffects;
};

/** Element id of a chart shape (Format › Current Selection). */
export const chartShapeElement = (id: string) => `shape:${id}`;

/** The chart shape an element id names, if any. */
export function chartShapeOf(chart: Chart, element: string | undefined) {
  const m = /^shape:(.+)$/.exec(element ?? "");
  if (!m) return undefined;
  return chart.shapes?.find((s) => s.id === m[1]);
}

const NAMES: Record<string, string> = {
  rect: "Rectangle",
  roundRect: "Rectangle: Rounded Corners",
  ellipse: "Oval",
  triangle: "Isosceles Triangle",
  rtTriangle: "Right Triangle",
  diamond: "Diamond",
  pentagon: "Regular Pentagon",
  hexagon: "Hexagon",
  heart: "Heart",
  rightArrow: "Arrow: Right",
  leftArrow: "Arrow: Left",
  upArrow: "Arrow: Up",
  downArrow: "Arrow: Down",
  wedgeRectCallout: "Speech Bubble: Rectangle",
  wedgeRoundRectCallout: "Speech Bubble: Rectangle with Corners Rounded",
  line: "Straight Connector",
};

/**
 * Insert a gallery shape (`key`: "rect", "textBox", "arrowLine"…) into a
 * chart, at `box` (chart px) or 1 in × 0.67 in in the middle (Excel's
 * size for a click without a drag). Returns the shape, or null.
 */
export function insertChartShape(
  chart: Chart,
  key: string,
  box?: ShapeBox,
  text?: string
): ChartShape | null {
  const item = galleryItem(key);
  if (!item) return null;
  const w = chart.width || 1;
  const h = chart.height || 1;
  const size = { width: Math.min(96, w * 0.4), height: Math.min(64, h * 0.4) };
  const b = box ?? {
    left: (w - size.width) / 2,
    top: (h - size.height) / 2,
    ...size,
  };
  const base = item.textBox ? "TextBox" : (NAMES[item.prst] ?? "Shape");
  const count = (chart.shapes ?? []).length + 1;
  const made = createShape(
    item,
    { r: 0, c: 0, dx: 0, dy: 0 },
    { r: 0, c: 0, dx: 0, dy: 0 },
    `${base} ${count}`
  );
  const { from, to, group, ...look } = made;
  const shape: ChartShape = {
    ...look,
    x: clamp01(b.left / w),
    y: clamp01(b.top / h),
    w: clamp01(b.width / w),
    h: clamp01(b.height / h),
  };
  if (text != null) shape.text = plainToShapeText(text, shape.text);
  chart.shapes = [...(chart.shapes ?? []), shape];
  return shape;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

/** Box of a chart shape in chart px. */
export function chartShapeBox(
  chart: Pick<Chart, "width" | "height">,
  s: ChartShape
) {
  return {
    left: s.x * chart.width,
    top: s.y * chart.height,
    width: s.w * chart.width,
    height: s.h * chart.height,
  };
}

/** Move / size a chart shape to `box` (chart px), kept inside the chart. */
export function setChartShapeBox(chart: Chart, id: string, box: ShapeBox) {
  const s = chart.shapes?.find((x) => x.id === id);
  if (!s) return;
  const w = chart.width || 1;
  const h = chart.height || 1;
  const width = Math.min(w, Math.max(4, box.width));
  const height = Math.min(h, Math.max(4, box.height));
  s.x = clamp01(Math.min(box.left, w - width) / w);
  s.y = clamp01(Math.min(box.top, h - height) / h);
  s.w = clamp01(width / w);
  s.h = clamp01(height / h);
}

/** Edit Shape › Change Shape: another preset, the look kept. */
export function changeChartShape(chart: Chart, id: string, key: string) {
  const s = chart.shapes?.find((x) => x.id === id);
  const item = galleryItem(key);
  if (!s || !item) return;
  s.prst = item.prst;
  delete s.adj;
}

export function deleteChartShape(chart: Chart, id: string) {
  if (!chart.shapes) return;
  chart.shapes = chart.shapes.filter((s) => s.id !== id);
  if (!chart.shapes.length) delete chart.shapes;
}

/** A chart shape as a sheet shape (for drawing it with the shape view). */
export function chartShapeAsShape(s: ChartShape): Shape {
  const { x, y, w, h, effects, ...look } = s;
  return {
    ...look,
    from: { r: 0, c: 0, dx: 0, dy: 0 },
    to: { r: 0, c: 0, dx: 0, dy: 0 },
  };
}
