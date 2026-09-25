/**
 * Preset shape geometry: SVG outlines for the DrawingML preset shapes
 * (`a:prstGeom prst="..."`) TinySheet draws, in the shape's own box
 * (0,0)-(w,h), plus the text rectangle of each preset.
 *
 * Adjust values (`adj`, `adj1`, ...) use DrawingML units (100000 = 100%)
 * and the DrawingML defaults when absent. Presets the renderer does not know
 * are drawn as rectangles (and still round-trip through xlsx under their
 * own name).
 */

export type ShapeRect = { x: number; y: number; w: number; h: number };

export type ShapeOutline = {
  /** SVG path data. */
  d: string;
  /** Whether the outline is an open path (lines, connectors): no fill. */
  open: boolean;
  /** Where the text goes, in box coordinates. */
  text: ShapeRect;
  /** Line end points and directions, for arrow heads (open paths only). */
  ends?: {
    start: { x: number; y: number; dx: number; dy: number };
    end: { x: number; y: number; dx: number; dy: number };
  };
};

/** Line-like presets (drawn with an open path, written as connectors). */
export const LINE_PRESETS = new Set([
  "line",
  "straightConnector1",
  "bentConnector2",
  "bentConnector3",
  "bentConnector4",
  "bentConnector5",
  "curvedConnector3",
]);

/** Default adjust values of the presets that have any. */
export const PRESET_DEFAULT_ADJUST: Record<string, Record<string, number>> = {
  roundRect: { adj: 16667 },
  triangle: { adj: 50000 },
  hexagon: { adj: 25000, vf: 115470 },
  rightArrow: { adj1: 50000, adj2: 50000 },
  leftArrow: { adj1: 50000, adj2: 50000 },
  upArrow: { adj1: 50000, adj2: 50000 },
  downArrow: { adj1: 50000, adj2: 50000 },
  bentConnector3: { adj1: 50000 },
  wedgeRectCallout: { adj1: -20833, adj2: 62500 },
  wedgeRoundRectCallout: { adj1: -20833, adj2: 62500, adj3: 16667 },
  star5: { adj: 19098, hf: 105146, vf: 110557 },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function poly(points: [number, number][]) {
  return `${points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${r2(x)},${r2(y)}`)
    .join(" ")} Z`;
}

function adjOf(
  prst: string,
  adj: Record<string, number> | undefined,
  key: string
): number {
  const v = adj?.[key];
  if (v != null && Number.isFinite(v)) return v;
  return PRESET_DEFAULT_ADJUST[prst]?.[key] ?? 0;
}

function roundedRect(w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0)
    return poly([
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ]);
  return (
    `M${r2(rr)},0 H${r2(w - rr)} A${r2(rr)},${r2(rr)} 0 0 1 ${r2(w)},${r2(
      rr
    )} V${r2(h - rr)} A${r2(rr)},${r2(rr)} 0 0 1 ${r2(w - rr)},${r2(h)} ` +
    `H${r2(rr)} A${r2(rr)},${r2(rr)} 0 0 1 0,${r2(h - rr)} V${r2(rr)} A${r2(
      rr
    )},${r2(rr)} 0 0 1 ${r2(rr)},0 Z`
  );
}

/**
 * A rectangle (optionally rounded) with a callout wedge pointing at
 * `(tx, ty)`, which lies outside the rectangle.
 */
function calloutPath(w: number, h: number, tx: number, ty: number, r: number) {
  const inside = tx >= 0 && tx <= w && ty >= 0 && ty <= h;
  if (inside) return roundedRect(w, h, r);
  // the edge the wedge leaves from: the one the tip is furthest beyond
  const beyond = {
    top: -ty / h,
    bottom: (ty - h) / h,
    left: -tx / w,
    right: (tx - w) / w,
  };
  const side = (Object.keys(beyond) as (keyof typeof beyond)[]).reduce((a, b) =>
    beyond[b] > beyond[a] ? b : a
  );
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const horizontal = side === "top" || side === "bottom";
  const len = horizontal ? w : h;
  const base = len / 6;
  const along = horizontal ? tx : ty;
  const lo = Math.max(rr, Math.min(len - rr - base, along - base / 2));
  const hi = lo + base;
  const arc = (x: number, y: number) =>
    rr > 0
      ? ` A${r2(rr)},${r2(rr)} 0 0 1 ${r2(x)},${r2(y)}`
      : ` L${r2(x)},${r2(y)}`;
  const tip = ` L${r2(tx)},${r2(ty)}`;
  let d = `M${r2(rr)},0`;
  if (side === "top") d += ` H${r2(lo)}${tip} L${r2(hi)},0`;
  d += ` H${r2(w - rr)}${arc(w, rr)}`;
  if (side === "right") d += ` V${r2(lo)}${tip} L${r2(w)},${r2(hi)}`;
  d += ` V${r2(h - rr)}${arc(w - rr, h)}`;
  if (side === "bottom") d += ` H${r2(hi)}${tip} L${r2(lo)},${r2(h)}`;
  d += ` H${r2(rr)}${arc(0, h - rr)}`;
  if (side === "left") d += ` V${r2(hi)}${tip} L0,${r2(lo)}`;
  d += ` V${r2(rr)}${arc(rr, 0)} Z`;
  return d;
}

function unitDir(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

/**
 * Outline and text rectangle of preset `prst` in a `w`×`h` box.
 * Flips and rotation are applied by the caller (as a transform).
 */
export function presetOutline(
  prst: string,
  w: number,
  h: number,
  adj?: Record<string, number>
): ShapeOutline {
  const ss = Math.min(w, h);
  const a = (key: string) => adjOf(prst, adj, key);
  const full: ShapeRect = { x: 0, y: 0, w, h };
  switch (prst) {
    case "roundRect": {
      const r = (ss * Math.min(a("adj"), 50000)) / 100000;
      const inset = r * 0.29289;
      return {
        d: roundedRect(w, h, r),
        open: false,
        text: { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset },
      };
    }
    case "ellipse": {
      const rx = w / 2;
      const ry = h / 2;
      return {
        d: `M0,${r2(ry)} A${r2(rx)},${r2(ry)} 0 1 1 ${r2(w)},${r2(ry)} A${r2(
          rx
        )},${r2(ry)} 0 1 1 0,${r2(ry)} Z`,
        open: false,
        text: {
          x: w * 0.14645,
          y: h * 0.14645,
          w: w * 0.7071,
          h: h * 0.7071,
        },
      };
    }
    case "triangle": {
      const x = (w * a("adj")) / 100000;
      return {
        d: poly([
          [x, 0],
          [w, h],
          [0, h],
        ]),
        open: false,
        text: { x: x / 2, y: h / 2, w: w / 2, h: h / 2 },
      };
    }
    case "rtTriangle":
      return {
        d: poly([
          [0, 0],
          [w, h],
          [0, h],
        ]),
        open: false,
        text: { x: w / 12, y: (h * 7) / 12, w: w / 2, h: h / 3 },
      };
    case "diamond":
      return {
        d: poly([
          [w / 2, 0],
          [w, h / 2],
          [w / 2, h],
          [0, h / 2],
        ]),
        open: false,
        text: { x: w / 4, y: h / 4, w: w / 2, h: h / 2 },
      };
    case "pentagon":
      return {
        d: poly([
          [w / 2, 0],
          [w, h * 0.3633],
          [w * 0.8123, h],
          [w * 0.1877, h],
          [0, h * 0.3633],
        ]),
        open: false,
        text: { x: w * 0.1877, y: h * 0.3633, w: w * 0.6246, h: h * 0.6367 },
      };
    case "hexagon": {
      const x = (ss * Math.min(a("adj"), 50000)) / 100000;
      return {
        d: poly([
          [x, 0],
          [w - x, 0],
          [w, h / 2],
          [w - x, h],
          [x, h],
          [0, h / 2],
        ]),
        open: false,
        text: { x: x / 2, y: h / 4, w: w - x, h: h / 2 },
      };
    }
    case "rightArrow":
    case "leftArrow": {
      const shaft = (h * Math.min(a("adj1"), 100000)) / 100000;
      const head = Math.min(w, (ss * a("adj2")) / 100000);
      const y1 = (h - shaft) / 2;
      const y2 = y1 + shaft;
      const pts: [number, number][] = [
        [0, y1],
        [w - head, y1],
        [w - head, 0],
        [w, h / 2],
        [w - head, h],
        [w - head, y2],
        [0, y2],
      ];
      const mirrored =
        prst === "leftArrow"
          ? pts.map(([x, y]) => [w - x, y] as [number, number])
          : pts;
      return {
        d: poly(mirrored),
        open: false,
        text: {
          x: prst === "leftArrow" ? head / 2 : 0,
          y: y1,
          w: w - head / 2,
          h: shaft,
        },
      };
    }
    case "upArrow":
    case "downArrow": {
      const shaft = (w * Math.min(a("adj1"), 100000)) / 100000;
      const head = Math.min(h, (ss * a("adj2")) / 100000);
      const x1 = (w - shaft) / 2;
      const x2 = x1 + shaft;
      const pts: [number, number][] = [
        [x1, h],
        [x1, head],
        [0, head],
        [w / 2, 0],
        [w, head],
        [x2, head],
        [x2, h],
      ];
      const mirrored =
        prst === "downArrow"
          ? pts.map(([x, y]) => [x, h - y] as [number, number])
          : pts;
      return {
        d: poly(mirrored),
        open: false,
        text: {
          x: x1,
          y: prst === "upArrow" ? head / 2 : 0,
          w: shaft,
          h: h - head / 2,
        },
      };
    }
    case "star5": {
      const inner = a("adj") / 50000;
      const cx = w / 2;
      const cy = h / 2;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : inner;
        pts.push([
          cx + cx * k * Math.cos(angle),
          cy + cy * k * Math.sin(angle),
        ]);
      }
      return {
        d: poly(pts),
        open: false,
        text: {
          x: w * (0.5 - inner * 0.5),
          y: h * (0.5 - inner * 0.4),
          w: w * inner,
          h: h * inner * 0.9,
        },
      };
    }
    case "heart": {
      const hc = w / 2;
      const dx1 = (w * 49) / 48;
      const dx2 = (w * 10) / 48;
      const y1 = -h / 3;
      return {
        d:
          `M${r2(hc)},${r2(h / 4)} C${r2(hc + dx2)},${r2(y1)} ${r2(
            hc + dx1
          )},${r2(h / 4)} ${r2(hc)},${r2(h)} ` +
          `C${r2(hc - dx1)},${r2(h / 4)} ${r2(hc - dx2)},${r2(y1)} ${r2(
            hc
          )},${r2(h / 4)} Z`,
        open: false,
        text: { x: w / 4, y: h / 4, w: w / 2, h: h / 2 },
      };
    }
    case "wedgeRectCallout":
    case "wedgeRoundRectCallout": {
      const tx = w / 2 + (w * a("adj1")) / 100000;
      const ty = h / 2 + (h * a("adj2")) / 100000;
      const r =
        prst === "wedgeRoundRectCallout" ? (ss * a("adj3")) / 100000 : 0;
      return { d: calloutPath(w, h, tx, ty, r), open: false, text: full };
    }
    case "line":
    case "straightConnector1":
      return {
        d: `M0,0 L${r2(w)},${r2(h)}`,
        open: true,
        text: full,
        ends: {
          start: { x: 0, y: 0, ...unitDir(-w, -h) },
          end: { x: w, y: h, ...unitDir(w, h) },
        },
      };
    case "bentConnector2":
      return {
        d: `M0,0 H${r2(w)} V${r2(h)}`,
        open: true,
        text: full,
        ends: {
          start: { x: 0, y: 0, dx: -1, dy: 0 },
          end: { x: w, y: h, dx: 0, dy: h >= 0 ? 1 : -1 },
        },
      };
    case "bentConnector3":
    case "bentConnector4":
    case "bentConnector5":
    case "curvedConnector3": {
      const x = (w * (adj?.adj1 ?? 50000)) / 100000;
      const d =
        prst === "curvedConnector3"
          ? `M0,0 C${r2(x)},0 ${r2(x)},${r2(h)} ${r2(w)},${r2(h)}`
          : `M0,0 H${r2(x)} V${r2(h)} H${r2(w)}`;
      return {
        d,
        open: true,
        text: full,
        ends: {
          start: { x: 0, y: 0, dx: -1, dy: 0 },
          end: { x: w, y: h, dx: 1, dy: 0 },
        },
      };
    }
    default: {
      // rect, text boxes and presets drawn as rectangles
      return {
        d: poly([
          [0, 0],
          [w, 0],
          [w, h],
          [0, h],
        ]),
        open: false,
        text: full,
      };
    }
  }
}

/** Presets with a dedicated outline (everything else renders as `rect`). */
export const DRAWN_PRESETS = [
  "rect",
  "roundRect",
  "ellipse",
  "triangle",
  "rtTriangle",
  "diamond",
  "pentagon",
  "hexagon",
  "rightArrow",
  "leftArrow",
  "upArrow",
  "downArrow",
  "star5",
  "heart",
  "wedgeRectCallout",
  "wedgeRoundRectCallout",
  "line",
  "straightConnector1",
  "bentConnector2",
  "bentConnector3",
  "curvedConnector3",
] as const;

/**
 * Arrow head triangle at `p` pointing along (dx, dy), for a line of width
 * `lineWidth` (DrawingML "medium" head: 3× the line width, min 6 px).
 */
export function arrowHeadPath(
  p: { x: number; y: number; dx: number; dy: number },
  lineWidth: number
) {
  const len = Math.max(6, lineWidth * 3.5);
  const half = len / 2;
  const bx = p.x - p.dx * len;
  const by = p.y - p.dy * len;
  const nx = -p.dy;
  const ny = p.dx;
  return poly([
    [p.x, p.y],
    [bx + nx * half, by + ny * half],
    [bx - nx * half, by - ny * half],
  ]);
}

/** How far the line must stop short of an arrow tip (so the tip stays sharp). */
export function arrowHeadInset(lineWidth: number) {
  return Math.max(6, lineWidth * 3.5) * 0.8;
}
