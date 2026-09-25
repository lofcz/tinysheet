/**
 * Pure geometry of the shape handles: resizing a rotated box from any side,
 * scaling a multi-selection, rotating, line end points and adjust handles.
 * All values are sheet pixels at 100% zoom.
 */
import type { Shape, ShapeBox } from "@lofcz/tinysheet-core";

export type Side = "lt" | "mt" | "rt" | "lm" | "rm" | "lb" | "mb" | "rb";
export const SIDES: Side[] = ["lt", "mt", "rt", "lm", "rm", "lb", "mb", "rb"];

export type Point = { x: number; y: number };

const MIN_SIZE = 2;

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Resize `orig` (rotated by `rot` degrees around its centre) by dragging
 * `side` by (dx, dy) screen pixels; the opposite side stays in place.
 * `keepAspect` (Shift) keeps the proportions on corner handles.
 */
export function resizeBox(
  orig: ShapeBox,
  rot: number,
  side: Side,
  dx: number,
  dy: number,
  keepAspect = false
): ShapeBox {
  const t = rad(rot || 0);
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const w = orig.width;
  const h = orig.height;
  let l = 0;
  let tp = 0;
  let r = w;
  let b = h;
  if (side[0] === "l") l = Math.min(w - MIN_SIZE, lx);
  if (side[0] === "r") r = Math.max(MIN_SIZE, w + lx);
  if (side[1] === "t") tp = Math.min(h - MIN_SIZE, ly);
  if (side[1] === "b") b = Math.max(MIN_SIZE, h + ly);
  const corner = side[0] !== "m" && side[1] !== "m";
  if (keepAspect && corner && w > 0 && h > 0) {
    const scale = Math.max((r - l) / w, (b - tp) / h);
    const nw = w * scale;
    const nh = h * scale;
    if (side[0] === "l") l = r - nw;
    else r = l + nw;
    if (side[1] === "t") tp = b - nh;
    else b = tp + nh;
  }
  const nw = r - l;
  const nh = b - tp;
  // centre shift in the shape's frame, rotated back to the sheet
  const cxl = (l + r) / 2 - w / 2;
  const cyl = (tp + b) / 2 - h / 2;
  const cx = orig.left + w / 2 + cxl * cos - cyl * sin;
  const cy = orig.top + h / 2 + cxl * sin + cyl * cos;
  return { left: cx - nw / 2, top: cy - nh / 2, width: nw, height: nh };
}

/** Map every box from the union `from` to the union `to` proportionally. */
export function scaleBoxes(
  boxes: Record<string, ShapeBox>,
  from: ShapeBox,
  to: ShapeBox
): Record<string, ShapeBox> {
  const sx = from.width > 0 ? to.width / from.width : 1;
  const sy = from.height > 0 ? to.height / from.height : 1;
  const out: Record<string, ShapeBox> = {};
  Object.entries(boxes).forEach(([id, b]) => {
    out[id] = {
      left: to.left + (b.left - from.left) * sx,
      top: to.top + (b.top - from.top) * sy,
      width: b.width * sx,
      height: b.height * sy,
    };
  });
  return out;
}

/** Rotation (degrees, 0–360) that points the rotate handle at `p`. */
export function rotationTowards(box: ShapeBox, p: Point, snap = false) {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
  if (snap) deg = Math.round(deg / 15) * 15;
  deg = ((deg % 360) + 360) % 360;
  return Math.round(deg * 10) / 10;
}

/** A point of the shape's own (unrotated, unflipped) box as a sheet point. */
export function localToSheet(
  box: ShapeBox,
  shape: Pick<Shape, "rot" | "flipH" | "flipV">,
  p: Point
): Point {
  const x = shape.flipH ? box.width - p.x : p.x;
  const y = shape.flipV ? box.height - p.y : p.y;
  const t = rad(shape.rot || 0);
  const ox = x - box.width / 2;
  const oy = y - box.height / 2;
  return {
    x: box.left + box.width / 2 + ox * Math.cos(t) - oy * Math.sin(t),
    y: box.top + box.height / 2 + ox * Math.sin(t) + oy * Math.cos(t),
  };
}

/** A sheet point in the shape's own (unrotated, unflipped) box. */
export function sheetToLocal(
  box: ShapeBox,
  shape: Pick<Shape, "rot" | "flipH" | "flipV">,
  p: Point
): Point {
  const t = rad(-(shape.rot || 0));
  const ox = p.x - (box.left + box.width / 2);
  const oy = p.y - (box.top + box.height / 2);
  const x = box.width / 2 + ox * Math.cos(t) - oy * Math.sin(t);
  const y = box.height / 2 + ox * Math.sin(t) + oy * Math.cos(t);
  return {
    x: shape.flipH ? box.width - x : x,
    y: shape.flipV ? box.height - y : y,
  };
}

/** Start and end points of a line / connector on the sheet. */
export function lineEnds(
  box: ShapeBox,
  shape: Pick<Shape, "rot" | "flipH" | "flipV">
) {
  return {
    start: localToSheet(box, shape, { x: 0, y: 0 }),
    end: localToSheet(box, shape, { x: box.width, y: box.height }),
  };
}

/** Box and flips of a line from `start` to `end` (rotation baked in). */
export function lineFromEnds(start: Point, end: Point) {
  return {
    box: {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    },
    flipH: start.x > end.x,
    flipV: start.y > end.y,
  };
}

/** Snap `p` so the line from `fixed` is horizontal, vertical or at 45°. */
export function snapLine(fixed: Point, p: Point): Point {
  const dx = p.x - fixed.x;
  const dy = p.y - fixed.y;
  const len = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: fixed.x + Math.round(len * Math.cos(angle) * 100) / 100,
    y: fixed.y + Math.round(len * Math.sin(angle) * 100) / 100,
  };
}

/**
 * The adjust handle of presets that have one (rounded-rectangle corner,
 * callout tip), in the shape's own box, or null.
 */
export function adjustHandle(shape: Shape, box: ShapeBox): Point | null {
  const ss = Math.min(box.width, box.height);
  if (shape.prst === "roundRect") {
    const adj = shape.adj?.adj ?? 16667;
    return { x: (ss * Math.min(adj, 50000)) / 100000, y: 0 };
  }
  if (
    shape.prst === "wedgeRectCallout" ||
    shape.prst === "wedgeRoundRectCallout"
  ) {
    const a1 = shape.adj?.adj1 ?? -20833;
    const a2 = shape.adj?.adj2 ?? 62500;
    return {
      x: box.width / 2 + (box.width * a1) / 100000,
      y: box.height / 2 + (box.height * a2) / 100000,
    };
  }
  return null;
}

/** Adjust values for dragging the adjust handle to `local`. */
export function adjustFromHandle(
  shape: Shape,
  box: ShapeBox,
  local: Point
): Record<string, number> | null {
  const ss = Math.min(box.width, box.height);
  if (shape.prst === "roundRect") {
    const v = ss > 0 ? (local.x / ss) * 100000 : 0;
    return { ...shape.adj, adj: Math.round(Math.max(0, Math.min(50000, v))) };
  }
  if (
    shape.prst === "wedgeRectCallout" ||
    shape.prst === "wedgeRoundRectCallout"
  ) {
    const w = box.width || 1;
    const h = box.height || 1;
    return {
      ...shape.adj,
      adj1: Math.round(((local.x - w / 2) / w) * 100000),
      adj2: Math.round(((local.y - h / 2) / h) * 100000),
    };
  }
  return null;
}
