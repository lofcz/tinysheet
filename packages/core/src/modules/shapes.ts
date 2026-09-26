/**
 * Shapes and text boxes (Insert › Shapes): `sheet.shapes[]` holds floating
 * DrawingML-style objects drawn over the grid.
 *
 * - Position: every shape is anchored to cells like an xlsx
 *   `twoCellAnchor`: its top-left corner (`from`) and bottom-right corner
 *   (`to`) are a cell plus an offset inside it, in pixels at 100% zoom. The
 *   shape therefore moves and sizes with its cells when rows/columns are
 *   resized, hidden, inserted or deleted (`adjustShapesForChange` is
 *   registered as a reference adjuster, see modelSync.ts).
 * - Array order is z-order (last = front). Shapes sharing a `group` id form
 *   a group: they are selected, moved and reordered together.
 * - Geometry is a DrawingML preset (`prst`, see shapeGeometry.ts) with
 *   optional adjust values, rotation and flips; fill, outline, shadow and
 *   rich text follow DrawingML's `spPr` / `txBody` model so they round-trip
 *   through xlsx.
 *
 * Everything here mutates the (immer draft) context: shape state lives under
 * `luckysheetfile`, so undo/redo and collaboration ops come for free. The
 * selection (`ctx.activeShapes`) is UI state outside the history.
 */
import type { Context } from "../context";
import type { Sheet } from "../types";
import { getSheetIndex } from "../utils";
import type { ReferenceChange } from "./refAdjust";
import {
  columnLeftPx,
  columnWidthPx,
  rowHeightPx,
  rowTopPx,
} from "./sheetGeometry";
import { LINE_PRESETS } from "./shapeGeometry";

/** A corner of a shape: cell (0-based) plus offset inside it (px, zoom 1). */
export type ShapeAnchor = { r: number; c: number; dx: number; dy: number };

export type ShapeDash =
  | "solid"
  | "dash"
  | "dot"
  | "dashDot"
  | "lgDash"
  | "sysDash"
  | "sysDot";

/** DrawingML line end types (`a:headEnd` / `a:tailEnd`). */
export type ShapeArrowHead =
  | "none"
  | "triangle"
  | "arrow"
  | "stealth"
  | "diamond"
  | "oval";

export type ShapeFill = {
  /** `#RRGGBB` */
  color: string;
  /** 0 (opaque) – 1 (invisible). */
  transparency?: number;
};

export type ShapeLine = {
  color: string;
  /** Width in px (1 px = 0.75 pt). */
  width: number;
  dash?: ShapeDash;
  /** Line start / end decorations (lines and connectors). */
  head?: ShapeArrowHead;
  tail?: ShapeArrowHead;
};

export type ShapeTextAlign = "l" | "ctr" | "r" | "just";

export type ShapeTextRun = {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  strike?: boolean;
  /** `#RRGGBB` */
  color?: string;
  /** Font size in pt. */
  size?: number;
  font?: string;
};

export type ShapeParagraph = {
  runs: ShapeTextRun[];
  align?: ShapeTextAlign;
};

export type ShapeText = {
  paragraphs: ShapeParagraph[];
  /** Vertical alignment (DrawingML `bodyPr anchor`). */
  anchor?: "t" | "ctr" | "b";
  /** Wrap text in the shape (default true). */
  wrap?: boolean;
  /** Run formatting for new and empty text (DrawingML `endParaRPr`). */
  defaults?: Omit<ShapeTextRun, "text">;
};

export type Shape = {
  id: string;
  /** Object name ("Rectangle 1"); also the accessible name fallback. */
  name?: string;
  /** Alternative text (xlsx `descr`). */
  alt?: string;
  /** DrawingML preset geometry, e.g. "rect", "ellipse", "rightArrow". */
  prst: string;
  /** Adjust values of the preset (DrawingML units, 100000 = 100%). */
  adj?: Record<string, number>;
  /** A text box (xlsx `txBox="1"`). */
  textBox?: boolean;
  from: ShapeAnchor;
  to: ShapeAnchor;
  /** Clockwise rotation in degrees. */
  rot?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** Solid fill; absent = no fill. */
  fill?: ShapeFill | null;
  /** Outline; absent = no line. */
  line?: ShapeLine | null;
  shadow?: boolean;
  text?: ShapeText;
  /** Group id: shapes with the same id form one group. */
  group?: string;
  /** The group it was ungrouped from (Arrange › Group › Regroup). */
  ungroupedFrom?: string;
};

/** A shape box in sheet pixels at 100% zoom (unrotated frame). */
export type ShapeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Presets offered by the Insert › Shapes gallery
// ---------------------------------------------------------------------------

export type ShapeGalleryItem = {
  /** Locale key under `locale(ctx).shape` and the gallery item id. */
  key: string;
  prst: string;
  category: "lines" | "basic" | "arrows" | "callouts" | "stars" | "text";
  head?: ShapeArrowHead;
  tail?: ShapeArrowHead;
  textBox?: boolean;
};

export const SHAPE_GALLERY: ShapeGalleryItem[] = [
  { key: "textBox", prst: "rect", category: "text", textBox: true },
  { key: "line", prst: "line", category: "lines" },
  { key: "arrowLine", prst: "line", category: "lines", tail: "triangle" },
  {
    key: "doubleArrowLine",
    prst: "line",
    category: "lines",
    head: "triangle",
    tail: "triangle",
  },
  { key: "elbowConnector", prst: "bentConnector3", category: "lines" },
  { key: "rect", prst: "rect", category: "basic" },
  { key: "roundRect", prst: "roundRect", category: "basic" },
  { key: "ellipse", prst: "ellipse", category: "basic" },
  { key: "triangle", prst: "triangle", category: "basic" },
  { key: "rtTriangle", prst: "rtTriangle", category: "basic" },
  { key: "diamond", prst: "diamond", category: "basic" },
  { key: "pentagon", prst: "pentagon", category: "basic" },
  { key: "hexagon", prst: "hexagon", category: "basic" },
  { key: "heart", prst: "heart", category: "basic" },
  { key: "rightArrow", prst: "rightArrow", category: "arrows" },
  { key: "leftArrow", prst: "leftArrow", category: "arrows" },
  { key: "upArrow", prst: "upArrow", category: "arrows" },
  { key: "downArrow", prst: "downArrow", category: "arrows" },
  { key: "wedgeRectCallout", prst: "wedgeRectCallout", category: "callouts" },
  {
    key: "wedgeRoundRectCallout",
    prst: "wedgeRoundRectCallout",
    category: "callouts",
  },
  { key: "star5", prst: "star5", category: "stars" },
];

/** Office theme defaults (accent 1 fill, darker outline, white text). */
export const SHAPE_DEFAULT_FILL = "#4472C4";
export const SHAPE_DEFAULT_LINE = "#2F528F";

const OBJECT_NAMES: Record<string, string> = {
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
  star5: "Star: 5 Points",
  line: "Straight Connector",
  straightConnector1: "Straight Arrow Connector",
  bentConnector3: "Connector: Elbow",
};

export function isLineShape(shape: Pick<Shape, "prst">) {
  return LINE_PRESETS.has(shape.prst);
}

let shapeIdSeed = 0;

export function generateShapeId() {
  shapeIdSeed += 1;
  return `shape_${Date.now().toString(36)}_${shapeIdSeed}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function generateGroupId() {
  return `group_${generateShapeId().slice(6)}`;
}

// ---------------------------------------------------------------------------
// Rich text helpers
// ---------------------------------------------------------------------------

/** The text of a shape as plain text (paragraphs joined by "\n"). */
export function shapeTextToPlain(text: ShapeText | undefined): string {
  if (!text) return "";
  return text.paragraphs
    .map((p) => p.runs.map((r) => r.text).join(""))
    .join("\n");
}

/**
 * Plain text (lines = paragraphs) as shape text, keeping the formatting of
 * `base`'s first run and paragraph and its alignment settings.
 */
export function plainToShapeText(plain: string, base?: ShapeText): ShapeText {
  const firstPara = base?.paragraphs[0];
  const runStyle: Omit<ShapeTextRun, "text"> = {
    ...(firstPara?.runs[0] ?? base?.defaults ?? {}),
  };
  delete (runStyle as Partial<ShapeTextRun>).text;
  return {
    ...(base ?? {}),
    paragraphs: plain.split("\n").map((line) => ({
      ...(firstPara?.align ? { align: firstPara.align } : {}),
      runs: line === "" ? [] : [{ ...runStyle, text: line }],
    })),
  };
}

/** Apply run formatting to every run of the text (and its defaults). */
export function formatShapeText(
  text: ShapeText | undefined,
  patch: Omit<ShapeTextRun, "text">
): ShapeText {
  const base: ShapeText = text ?? { paragraphs: [{ runs: [] }] };
  const clean = (run: Omit<ShapeTextRun, "text">) => {
    const out = { ...run, ...patch } as Record<string, unknown>;
    Object.keys(out).forEach((k) => {
      if (out[k] === undefined || out[k] === false) delete out[k];
    });
    return out;
  };
  return {
    ...base,
    defaults: clean(base.defaults ?? {}) as ShapeText["defaults"],
    paragraphs: base.paragraphs.map((p) => ({
      ...p,
      runs: p.runs.map((r) => clean(r) as ShapeTextRun),
    })),
  };
}

/** Whether every run (or the defaults when there is no text) has `key` set. */
export function shapeTextHas(
  text: ShapeText | undefined,
  key: "b" | "i" | "u" | "strike"
) {
  const runs = text?.paragraphs.flatMap((p) => p.runs) ?? [];
  const withText = runs.filter((r) => r.text !== "");
  if (withText.length === 0) return !!text?.defaults?.[key];
  return withText.every((r) => !!r[key]);
}

/** Accessible label: the name, plus the text when there is any. */
export function shapeLabel(shape: Shape) {
  const text = shapeTextToPlain(shape.text).trim();
  const name = shape.alt || shape.name || OBJECT_NAMES[shape.prst] || "Shape";
  return text ? `${name}: ${text}` : name;
}

// ---------------------------------------------------------------------------
// Geometry: anchors <-> sheet pixels
// ---------------------------------------------------------------------------

/** Row/column geometry of one sheet, at 100% zoom (grid lines included). */
export type AxisGeometry = {
  rowTop: (r: number) => number;
  rowHeight: (r: number) => number;
  colLeft: (c: number) => number;
  colWidth: (c: number) => number;
};

/** Geometry of a sheet of the workbook (the laid-out one uses the layout). */
export function contextGeometry(ctx: Context, sheetId: string): AxisGeometry {
  return {
    rowTop: (r) => rowTopPx(ctx, sheetId, r),
    rowHeight: (r) => rowHeightPx(ctx, sheetId, r),
    colLeft: (c) => columnLeftPx(ctx, sheetId, c),
    colWidth: (c) => columnWidthPx(ctx, sheetId, c),
  };
}

/**
 * Geometry of a sheet from its config alone (row heights, column widths,
 * hidden rows/columns), e.g. for xlsx import/export. Prefix sums are cached.
 */
export function configGeometry(
  config: Sheet["config"] | undefined,
  defaultRowHeight = 19,
  defaultColWidth = 73
): AxisGeometry {
  const cfg = config || {};
  const rowHeight = (r: number) => {
    if (cfg.rowhidden?.[r] != null) return 0;
    return (Number(cfg.rowlen?.[r]) || defaultRowHeight) + 1;
  };
  const colWidth = (c: number) => {
    if (cfg.colhidden?.[c] != null) return 0;
    return (Number(cfg.columnlen?.[c]) || defaultColWidth) + 1;
  };
  const prefix = (size: (i: number) => number) => {
    const sums = [0];
    return (i: number) => {
      if (i <= 0) return 0;
      for (let k = sums.length; k <= i; k += 1)
        sums[k] = sums[k - 1] + size(k - 1);
      return sums[i];
    };
  };
  return {
    rowTop: prefix(rowHeight),
    rowHeight,
    colLeft: prefix(colWidth),
    colWidth,
  };
}

const MAX_INDEX = { row: 1048575, column: 16383 };

/** Largest index whose start is <= pos (hidden ones share the next start). */
function indexAt(start: (i: number) => number, pos: number, max: number) {
  if (pos <= 0) return 0;
  let hi = 1;
  while (hi < max && start(hi) <= pos) hi = Math.min(max, hi * 2);
  let lo = 0;
  // invariant: start(lo) <= pos, and start(hi) > pos unless hi == max
  if (start(hi) <= pos) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (start(mid) <= pos) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Sheet pixel position of an anchor. */
export function anchorToPoint(geo: AxisGeometry, a: ShapeAnchor) {
  return {
    x: geo.colLeft(a.c) + Math.min(Math.max(0, a.dx), geo.colWidth(a.c)),
    y: geo.rowTop(a.r) + Math.min(Math.max(0, a.dy), geo.rowHeight(a.r)),
  };
}

/** The anchor (cell + offset) of a sheet pixel position. */
export function pointToAnchor(
  geo: AxisGeometry,
  x: number,
  y: number
): ShapeAnchor {
  // hundredths of a px: a position computed through a zoom (x / 1.5) that
  // lands a hair before a cell edge is on the edge
  const round = (n: number) => Math.round(n * 100) / 100;
  const px = round(Math.max(0, x));
  const py = round(Math.max(0, y));
  const c = indexAt(geo.colLeft, px, MAX_INDEX.column);
  const r = indexAt(geo.rowTop, py, MAX_INDEX.row);
  return {
    r,
    c,
    dx: round(px - geo.colLeft(c)),
    dy: round(py - geo.rowTop(r)),
  };
}

export function anchorsToBox(
  geo: AxisGeometry,
  from: ShapeAnchor,
  to: ShapeAnchor
): ShapeBox {
  const a = anchorToPoint(geo, from);
  const b = anchorToPoint(geo, to);
  return {
    left: a.x,
    top: a.y,
    width: Math.max(0, b.x - a.x),
    height: Math.max(0, b.y - a.y),
  };
}

export function boxToAnchors(geo: AxisGeometry, box: ShapeBox) {
  return {
    from: pointToAnchor(geo, box.left, box.top),
    to: pointToAnchor(geo, box.left + box.width, box.top + box.height),
  };
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

function sheetOf(ctx: Context, sheetId?: string): Sheet | undefined {
  const i = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  return i == null ? undefined : ctx.luckysheetfile[i];
}

export function getSheetShapes(ctx: Context, sheetId?: string): Shape[] {
  return sheetOf(ctx, sheetId)?.shapes ?? [];
}

export function findShape(ctx: Context, id: string, sheetId?: string) {
  return getSheetShapes(ctx, sheetId).find((s) => s.id === id);
}

/** Box of a shape of the current (or given) sheet, in sheet px at zoom 1. */
export function getShapeBox(
  ctx: Context,
  shape: Pick<Shape, "from" | "to">,
  sheetId?: string
): ShapeBox {
  return anchorsToBox(
    contextGeometry(ctx, sheetId ?? ctx.currentSheetId),
    shape.from,
    shape.to
  );
}

export function unionBox(boxes: ShapeBox[]): ShapeBox | null {
  if (boxes.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  boxes.forEach((b) => {
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.left + b.width);
    bottom = Math.max(bottom, b.top + b.height);
  });
  return { left, top, width: right - left, height: bottom - top };
}

/** Ids of `ids` plus every other member of their groups. */
export function expandShapeGroups(shapes: Shape[], ids: string[]): string[] {
  const want = new Set(ids);
  const groups = new Set(
    shapes.filter((s) => want.has(s.id) && s.group).map((s) => s.group!)
  );
  return shapes
    .filter((s) => want.has(s.id) || (s.group && groups.has(s.group)))
    .map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Mutations (immer draft)
// ---------------------------------------------------------------------------

/** Select shapes (whole groups); `toggle` adds/removes them (Ctrl/Shift+click). */
export function selectShapes(ctx: Context, ids: string[], toggle = false) {
  const shapes = getSheetShapes(ctx);
  const picked = expandShapeGroups(shapes, ids);
  if (!toggle) {
    ctx.activeShapes = picked;
  } else {
    const current = new Set(ctx.activeShapes ?? []);
    const allIn = picked.every((id) => current.has(id));
    picked.forEach((id) => (allIn ? current.delete(id) : current.add(id)));
    ctx.activeShapes = shapes.filter((s) => current.has(s.id)).map((s) => s.id);
  }
  if (ctx.editingShape && !ctx.activeShapes.includes(ctx.editingShape)) {
    ctx.editingShape = undefined;
  }
  // charts grouped with the shapes come along; a chart selected before
  // stays selected with Ctrl / Shift (modules/objects.ts)
  const groups = new Set(
    shapes
      .filter((s) => picked.includes(s.id) && s.group)
      .map((s) => s.group as string)
  );
  const groupCharts = (sheetOf(ctx)?.charts ?? [])
    .filter((c) => c.group && groups.has(c.group))
    .map((c) => c.id);
  const charts = new Set<string>(toggle ? (ctx.selectedCharts ?? []) : []);
  if (toggle && ctx.activeChart) charts.add(ctx.activeChart);
  groupCharts.forEach((id) => charts.add(id));
  ctx.selectedCharts = charts.size ? Array.from(charts) : undefined;
  if (ctx.activeChart) {
    ctx.activeChart = undefined;
    ctx.chartElement = undefined;
    ctx.chartEditorOpen = false;
  }
}

export function clearShapeSelection(ctx: Context) {
  ctx.activeShapes = undefined;
  ctx.editingShape = undefined;
  ctx.selectedCharts = undefined;
}

export type InsertShapeOptions = {
  /** Box in sheet px (zoom 1); defaults to a 144×96 box near the selection. */
  box?: ShapeBox;
  flipH?: boolean;
  flipV?: boolean;
  /** Select the new shape (default true). */
  select?: boolean;
  text?: string;
};

function nextName(shapes: Shape[], base: string) {
  let n = shapes.length + 1;
  const used = new Set(shapes.map((s) => s.name));
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function defaultBox(ctx: Context, item: ShapeGalleryItem): ShapeBox {
  const geo = contextGeometry(ctx, ctx.currentSheetId);
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  const r = sel ? (sel.row_focus ?? sel.row[0]) : 1;
  const c = sel ? (sel.column_focus ?? sel.column[0]) : 1;
  const left = geo.colLeft(c) + 8;
  const top = geo.rowTop(r) + 8;
  if (item.category === "lines") return { left, top, width: 144, height: 0 };
  if (item.textBox) return { left, top, width: 160, height: 60 };
  return { left, top, width: 144, height: 96 };
}

/** A new shape for a gallery item (not added to the sheet). */
export function createShape(
  item: ShapeGalleryItem,
  from: ShapeAnchor,
  to: ShapeAnchor,
  name?: string
): Shape {
  const line = LINE_PRESETS.has(item.prst);
  const shape: Shape = {
    id: generateShapeId(),
    name,
    prst: item.prst,
    from,
    to,
  };
  if (item.textBox) {
    shape.textBox = true;
    shape.fill = { color: "#FFFFFF" };
    shape.line = { color: "#000000", width: 1 };
    shape.text = {
      paragraphs: [{ runs: [], align: "l" }],
      anchor: "t",
      wrap: true,
    };
  } else if (line) {
    shape.line = {
      color: SHAPE_DEFAULT_FILL,
      width: 1.5,
      ...(item.head ? { head: item.head } : {}),
      ...(item.tail ? { tail: item.tail } : {}),
    };
  } else {
    shape.fill = { color: SHAPE_DEFAULT_FILL };
    shape.line = { color: SHAPE_DEFAULT_LINE, width: 1 };
    shape.text = {
      paragraphs: [{ runs: [], align: "ctr" }],
      anchor: "ctr",
      wrap: true,
    };
  }
  return shape;
}

export function galleryItem(key: string): ShapeGalleryItem | undefined {
  return SHAPE_GALLERY.find((g) => g.key === key);
}

/**
 * Insert a shape from the gallery (`key`, e.g. "rect", "arrowLine",
 * "textBox") on the current sheet. Returns the shape, or null.
 */
export function insertShape(
  ctx: Context,
  key: string,
  options: InsertShapeOptions = {}
): Shape | null {
  if (ctx.allowEdit === false) return null;
  const item = galleryItem(key);
  const sheet = sheetOf(ctx);
  if (!item || !sheet) return null;
  const geo = contextGeometry(ctx, ctx.currentSheetId);
  const box = options.box ?? defaultBox(ctx, item);
  const { from, to } = boxToAnchors(geo, {
    ...box,
    left: Math.max(0, box.left),
    top: Math.max(0, box.top),
  });
  const shapes = sheet.shapes ?? [];
  const base = item.textBox ? "TextBox" : (OBJECT_NAMES[item.prst] ?? "Shape");
  const shape = createShape(item, from, to, nextName(shapes, base));
  if (options.flipH) shape.flipH = true;
  if (options.flipV) shape.flipV = true;
  if (options.text != null) {
    shape.text = plainToShapeText(options.text, shape.text);
  }
  sheet.shapes = [...shapes, shape];
  if (options.select !== false) {
    ctx.activeShapes = [shape.id];
    ctx.editingShape = undefined;
  }
  ctx.shapeDrawKind = undefined;
  return shape;
}

/** Shallow-merge `patch` into each shape of `ids` (current sheet). */
export function updateShapes(
  ctx: Context,
  ids: string[],
  patch: Partial<Omit<Shape, "id">> | ((shape: Shape) => void)
) {
  const want = new Set(ids);
  getSheetShapes(ctx).forEach((s) => {
    if (!want.has(s.id)) return;
    if (typeof patch === "function") patch(s);
    else Object.assign(s, patch);
  });
}

/** Set the boxes (sheet px, zoom 1) of shapes, re-anchoring them. */
export function setShapeBoxes(ctx: Context, boxes: Record<string, ShapeBox>) {
  const geo = contextGeometry(ctx, ctx.currentSheetId);
  getSheetShapes(ctx).forEach((s) => {
    const box = boxes[s.id];
    if (!box) return;
    const { from, to } = boxToAnchors(geo, box);
    s.from = from;
    s.to = to;
  });
}

/** Move shapes by (dx, dy) sheet px; the move stops at the sheet's edge. */
export function moveShapes(
  ctx: Context,
  ids: string[],
  dx: number,
  dy: number
) {
  const want = new Set(ids);
  const shapes = getSheetShapes(ctx).filter((s) => want.has(s.id));
  if (shapes.length === 0) return;
  const boxes = shapes.map((s) => getShapeBox(ctx, s));
  const u = unionBox(boxes)!;
  const mx = Math.max(dx, -u.left);
  const my = Math.max(dy, -u.top);
  const next: Record<string, ShapeBox> = {};
  shapes.forEach((s, i) => {
    next[s.id] = {
      ...boxes[i],
      left: boxes[i].left + mx,
      top: boxes[i].top + my,
    };
  });
  setShapeBoxes(ctx, next);
}

export function deleteShapes(ctx: Context, ids?: string[]) {
  const sheet = sheetOf(ctx);
  const target = new Set(ids ?? ctx.activeShapes ?? []);
  if (!sheet?.shapes || target.size === 0) return;
  sheet.shapes = sheet.shapes.filter((s) => !target.has(s.id));
  // a group of one is no group
  const counts = new Map<string, number>();
  sheet.shapes.forEach((s) => {
    if (s.group) counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
  });
  sheet.shapes.forEach((s) => {
    if (s.group && counts.get(s.group) === 1) delete s.group;
  });
  if (ctx.activeShapes) {
    const left = ctx.activeShapes.filter((id) => !target.has(id));
    ctx.activeShapes = left.length ? left : undefined;
  }
  if (ctx.editingShape && target.has(ctx.editingShape)) {
    ctx.editingShape = undefined;
  }
}

/** z-order units: a group's members together, other shapes alone. */
function toUnits(shapes: Shape[]): Shape[][] {
  const units: Shape[][] = [];
  const byGroup = new Map<string, Shape[]>();
  shapes.forEach((s) => {
    if (!s.group) {
      units.push([s]);
      return;
    }
    const unit = byGroup.get(s.group);
    if (unit) unit.push(s);
    else {
      const created = [s];
      byGroup.set(s.group, created);
      units.push(created);
    }
  });
  return units;
}

export type ShapeOrder = "front" | "back" | "forward" | "backward";

/** Bring to front / send to back / bring forward / send backward. */
export function reorderShapes(ctx: Context, ids: string[], how: ShapeOrder) {
  const sheet = sheetOf(ctx);
  if (!sheet?.shapes) return;
  const want = new Set(expandShapeGroups(sheet.shapes, ids));
  const units = toUnits(sheet.shapes);
  const picked = (u: Shape[]) => u.some((s) => want.has(s.id));
  let next: Shape[][];
  if (how === "front") {
    next = [...units.filter((u) => !picked(u)), ...units.filter(picked)];
  } else if (how === "back") {
    next = [...units.filter(picked), ...units.filter((u) => !picked(u))];
  } else if (how === "forward") {
    next = [...units];
    for (let i = next.length - 2; i >= 0; i -= 1) {
      if (picked(next[i]) && !picked(next[i + 1])) {
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
  } else {
    next = [...units];
    for (let i = 1; i < next.length; i += 1) {
      if (picked(next[i]) && !picked(next[i - 1])) {
        [next[i], next[i - 1]] = [next[i - 1], next[i]];
      }
    }
  }
  sheet.shapes = next.flat();
}

/** Group the selected shapes (at least two units); returns the group id. */
export function groupShapes(ctx: Context, ids: string[]): string | null {
  const sheet = sheetOf(ctx);
  if (!sheet?.shapes) return null;
  const want = new Set(expandShapeGroups(sheet.shapes, ids));
  const units = toUnits(sheet.shapes);
  const picked = units.filter((u) => u.some((s) => want.has(s.id)));
  if (picked.length < 2) return null;
  const group = generateGroupId();
  const members = picked.flat();
  members.forEach((s) => {
    s.group = group;
  });
  // members become contiguous at the position of the topmost one
  const topmost = units.lastIndexOf(picked[picked.length - 1]);
  const before = units
    .slice(0, topmost + 1)
    .filter((u) => !picked.includes(u))
    .flat();
  const after = units
    .slice(topmost + 1)
    .filter((u) => !picked.includes(u))
    .flat();
  sheet.shapes = [...before, ...members, ...after];
  ctx.activeShapes = members.map((s) => s.id);
  return group;
}

export function ungroupShapes(ctx: Context, ids: string[]) {
  const shapes = getSheetShapes(ctx);
  const want = new Set(expandShapeGroups(shapes, ids));
  shapes.forEach((s) => {
    if (want.has(s.id)) delete s.group;
  });
}

export type ShapeAlign =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

function unitBoxes(ctx: Context, ids: string[]) {
  const shapes = getSheetShapes(ctx);
  const want = new Set(expandShapeGroups(shapes, ids));
  return toUnits(shapes.filter((s) => want.has(s.id))).map((unit) => {
    const boxes = unit.map((s) => getShapeBox(ctx, s));
    return { unit, boxes, box: unionBox(boxes)! };
  });
}

function shiftUnits(
  ctx: Context,
  moves: { unit: Shape[]; boxes: ShapeBox[]; dx: number; dy: number }[]
) {
  const next: Record<string, ShapeBox> = {};
  moves.forEach(({ unit, boxes, dx, dy }) =>
    unit.forEach((s, i) => {
      next[s.id] = {
        ...boxes[i],
        left: Math.max(0, boxes[i].left + dx),
        top: Math.max(0, boxes[i].top + dy),
      };
    })
  );
  setShapeBoxes(ctx, next);
}

/** Align the selected shapes (groups move as one) to their common box. */
export function alignShapes(ctx: Context, ids: string[], how: ShapeAlign) {
  const units = unitBoxes(ctx, ids);
  if (units.length < 2) return;
  const all = unionBox(units.map((u) => u.box))!;
  shiftUnits(
    ctx,
    units.map(({ unit, boxes, box }) => {
      let dx = 0;
      let dy = 0;
      if (how === "left") dx = all.left - box.left;
      if (how === "center")
        dx = all.left + all.width / 2 - (box.left + box.width / 2);
      if (how === "right") dx = all.left + all.width - (box.left + box.width);
      if (how === "top") dy = all.top - box.top;
      if (how === "middle")
        dy = all.top + all.height / 2 - (box.top + box.height / 2);
      if (how === "bottom") dy = all.top + all.height - (box.top + box.height);
      return { unit, boxes, dx, dy };
    })
  );
}

/** Distribute the selected shapes evenly (equal gaps) along an axis. */
export function distributeShapes(
  ctx: Context,
  ids: string[],
  axis: "horizontal" | "vertical"
) {
  const units = unitBoxes(ctx, ids);
  if (units.length < 3) return;
  const pos = (b: ShapeBox) => (axis === "horizontal" ? b.left : b.top);
  const size = (b: ShapeBox) => (axis === "horizontal" ? b.width : b.height);
  units.sort((a, b) => pos(a.box) - pos(b.box));
  const first = units[0].box;
  const last = units[units.length - 1].box;
  const span = pos(last) + size(last) - pos(first);
  const used = units.reduce((sum, u) => sum + size(u.box), 0);
  const gap = (span - used) / (units.length - 1);
  let at = pos(first);
  shiftUnits(
    ctx,
    units.map(({ unit, boxes, box }) => {
      const delta = at - pos(box);
      at += size(box) + gap;
      return {
        unit,
        boxes,
        dx: axis === "horizontal" ? delta : 0,
        dy: axis === "vertical" ? delta : 0,
      };
    })
  );
}

/** Copied shapes, with their boxes so they can be pasted anywhere. */
export type ShapeClip = { shapes: (Shape & { box: ShapeBox })[] };

export function copyShapes(ctx: Context, ids: string[]): ShapeClip | null {
  const shapes = getSheetShapes(ctx);
  const want = new Set(expandShapeGroups(shapes, ids));
  const picked = shapes.filter((s) => want.has(s.id));
  if (picked.length === 0) return null;
  return {
    shapes: picked.map((s) => ({
      ...JSON.parse(JSON.stringify(s)),
      box: getShapeBox(ctx, s),
    })),
  };
}

/**
 * Paste copied shapes on the current sheet: at `at` (top-left of their
 * common box), or offset from where they were. New ids and groups; the
 * pasted shapes are selected. Returns their ids.
 */
export function pasteShapes(
  ctx: Context,
  clip: ShapeClip,
  at?: { left: number; top: number }
): string[] {
  const sheet = sheetOf(ctx);
  if (!sheet || ctx.allowEdit === false || clip.shapes.length === 0) return [];
  const all = unionBox(clip.shapes.map((s) => s.box))!;
  const dx = at ? at.left - all.left : 12;
  const dy = at ? at.top - all.top : 12;
  const geo = contextGeometry(ctx, ctx.currentSheetId);
  const groups = new Map<string, string>();
  const existing = [...(sheet.shapes ?? [])];
  const added: Shape[] = clip.shapes.map(({ box, ...rest }) => {
    const copy: Shape = JSON.parse(JSON.stringify(rest));
    copy.id = generateShapeId();
    if (copy.group) {
      if (!groups.has(copy.group)) groups.set(copy.group, generateGroupId());
      copy.group = groups.get(copy.group);
    }
    const base = (copy.name ?? "Shape").replace(/\s+\d+$/, "");
    copy.name = nextName([...existing], base);
    existing.push(copy);
    const anchors = boxToAnchors(geo, {
      ...box,
      left: Math.max(0, box.left + dx),
      top: Math.max(0, box.top + dy),
    });
    copy.from = anchors.from;
    copy.to = anchors.to;
    return copy;
  });
  sheet.shapes = [...(sheet.shapes ?? []), ...added];
  ctx.activeShapes = added.map((s) => s.id);
  ctx.editingShape = undefined;
  return ctx.activeShapes;
}

/** Ctrl+D: duplicate the shapes next to the originals. */
export function duplicateShapes(ctx: Context, ids: string[]) {
  const clip = copyShapes(ctx, ids);
  return clip ? pasteShapes(ctx, clip) : [];
}

// ---------------------------------------------------------------------------
// Structural changes
// ---------------------------------------------------------------------------

function shiftAnchorForInsert(
  a: ShapeAnchor,
  key: "r" | "c",
  index: number,
  count: number
) {
  if (a[key] >= index) a[key] += count;
}

/**
 * Rows/columns inserted or deleted: anchors follow their cells ("move and
 * size with cells"). Shapes lying entirely in deleted rows/columns are
 * deleted, like cells; a shape partly in them shrinks. Cell moves and
 * shifts (cut/paste, insert/delete cells) leave shapes where they are, as
 * in Excel.
 */
export function adjustShapesForChange(ctx: Context, change: ReferenceChange) {
  if (change.type !== "insert" && change.type !== "delete") return;
  const sheet = ctx.luckysheetfile?.find((s) => s.id === change.sheetId);
  if (!sheet?.shapes?.length) return;
  const key = change.axis === "row" ? "r" : "c";
  const off = change.axis === "row" ? "dy" : "dx";
  if (change.type === "insert") {
    sheet.shapes.forEach((s) => {
      shiftAnchorForInsert(s.from, key, change.index, change.count);
      shiftAnchorForInsert(s.to, key, change.index, change.count);
    });
    return;
  }
  const { start, end } = change;
  const count = end - start + 1;
  const inside = (a: ShapeAnchor) => a[key] >= start && a[key] <= end;
  const removed = new Set<string>();
  sheet.shapes.forEach((s) => {
    const fromIn = inside(s.from);
    // `to` at offset 0 of the first row after the block ends inside it
    const toIn = inside(s.to) || (s.to[key] === end + 1 && s.to[off] === 0);
    if (fromIn && toIn && s.from[key] >= start) {
      removed.add(s.id);
      return;
    }
    [s.from, s.to].forEach((a) => {
      if (a[key] > end) a[key] -= count;
      else if (a[key] >= start) {
        a[key] = start;
        a[off] = 0;
      }
    });
  });
  if (removed.size > 0) {
    sheet.shapes = sheet.shapes.filter((s) => !removed.has(s.id));
    if (sheet.id === ctx.currentSheetId && ctx.activeShapes) {
      const left = ctx.activeShapes.filter((id) => !removed.has(id));
      ctx.activeShapes = left.length ? left : undefined;
    }
  }
}
