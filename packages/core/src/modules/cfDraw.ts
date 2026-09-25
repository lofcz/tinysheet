import type { Cell } from "../types";
import type { CFCellResult, CFDataBarResult, CFIconSetName } from "./cfTypes";
import { CF_ICON_SETS, CFIconDef } from "./cfRules";
import { mixCFColors, parseCFColor } from "./cfEngine";
import { formatValue } from "./format";

/*
 * Canvas drawing of conditional formatting: data bars, icons and borders.
 * `drawCFDecorations` is the single hook called from the cell painter.
 */

type Ctx2D = CanvasRenderingContext2D;

/**
 * A horizontal gradient from `solid` (at the `solidSide` end) to `light`
 * over [x, x + w) x [y, y + h), painted as one solid rectangle per device
 * pixel column. Canvas gradients are dithered against the device pixel
 * grid, so a gradient moved by a scroll (the sheet blits scrolled pixels)
 * would differ from one painted in place; solid columns do not.
 */
function fillGradientColumns(
  rc: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  solid: [number, number, number],
  light: [number, number, number],
  solidSide: string | undefined
) {
  const m = typeof rc.getTransform === "function" ? rc.getTransform() : null;
  const sx = (m?.a ?? 1) || 1;
  const tx = m?.e ?? 0;
  // In device pixels, from the first column the bar touches. The fraction
  // and width are quantised so that a bar moved by whole pixels gets the
  // very same colours (float noise would flip a rounding now and then).
  const start = x * sx + tx;
  const d0 = Math.floor(start);
  const frac = Math.round((start - d0) * 64) / 64;
  const wd = Math.round(w * sx * 64) / 64;
  const n = Math.ceil(frac + wd);
  for (let k = 0; k < n; k += 1) {
    const lo = Math.max(0, k - frac);
    const hi = Math.min(wd, k + 1 - frac);
    if (hi > lo) {
      const left = (d0 + frac + lo - tx) / sx;
      const right = (d0 + frac + hi - tx) / sx;
      const center = (lo + hi) / 2;
      const t = solidSide === "left" ? center / wd : 1 - center / wd;
      rc.fillStyle = `rgb(${Math.round(
        solid[0] + (light[0] - solid[0]) * t
      )},${Math.round(solid[1] + (light[1] - solid[1]) * t)},${Math.round(
        solid[2] + (light[2] - solid[2]) * t
      )})`;
      rc.fillRect(left, y, right - left, h);
    }
  }
}

export function drawCFDataBar(
  rc: Ctx2D,
  bar: CFDataBarResult,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (w <= 0 || h <= 0) return;
  const x1 = x + w * bar.start;
  const x2 = x + w * bar.end;
  const bw = x2 - x1;
  if (bw > 0.25) {
    const light = bar.gradient
      ? parseCFColor(mixCFColors(bar.color, "#FFFFFF", 0.88))
      : null;
    const solid = bar.gradient ? parseCFColor(bar.color) : null;
    if (solid && light) {
      fillGradientColumns(rc, x1, y, bw, h, solid, light, bar.solidSide);
    } else {
      if (bar.gradient) {
        const from = bar.solidSide === "left" ? x1 : x2;
        const to = bar.solidSide === "left" ? x2 : x1;
        const g = rc.createLinearGradient(from, 0, to, 0);
        g.addColorStop(0, bar.color);
        g.addColorStop(1, mixCFColors(bar.color, "#FFFFFF", 0.88));
        rc.fillStyle = g;
      } else {
        rc.fillStyle = bar.color;
      }
      rc.fillRect(x1, y, bw, h);
    }
    if (bar.borderColor && bw >= 2) {
      rc.lineWidth = 1;
      rc.strokeStyle = bar.borderColor;
      rc.strokeRect(x1 + 0.5, y + 0.5, bw - 1, h - 1);
    }
  }
  if (bar.axis !== null) {
    const ax = Math.round(x + w * bar.axis) + 0.5;
    rc.lineWidth = 1;
    rc.strokeStyle = bar.axisColor;
    rc.setLineDash?.([2, 2]);
    rc.beginPath();
    rc.moveTo(ax, y);
    rc.lineTo(ax, y + h);
    rc.stroke();
    rc.setLineDash?.([]);
  }
}

function poly(rc: Ctx2D, pts: number[][]) {
  rc.beginPath();
  rc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) rc.lineTo(pts[i][0], pts[i][1]);
  rc.closePath();
}

const ARROW = [
  [-0.42, -0.13],
  [0.04, -0.13],
  [0.04, -0.4],
  [0.46, 0],
  [0.04, 0.4],
  [0.04, 0.13],
  [-0.42, 0.13],
];

const ARROW_ANGLE: Record<string, number> = {
  arrowRight: 0,
  arrowUp: -Math.PI / 2,
  arrowDown: Math.PI / 2,
  arrowUpRight: -Math.PI / 4,
  arrowDownRight: Math.PI / 4,
};

function starPath(rc: Ctx2D) {
  rc.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 0.48 : 0.2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r + 0.03;
    if (i === 0) rc.moveTo(px, py);
    else rc.lineTo(px, py);
  }
  rc.closePath();
}

function glyph(
  rc: Ctx2D,
  kind: "check" | "cross" | "exclamation",
  color: string,
  k: number
) {
  rc.strokeStyle = color;
  rc.fillStyle = color;
  rc.lineCap = "round";
  rc.lineJoin = "round";
  rc.lineWidth = 0.15 * k;
  if (kind === "check") {
    rc.beginPath();
    rc.moveTo(-0.3 * k, 0.02 * k);
    rc.lineTo(-0.08 * k, 0.25 * k);
    rc.lineTo(0.32 * k, -0.25 * k);
    rc.stroke();
  } else if (kind === "cross") {
    rc.beginPath();
    rc.moveTo(-0.25 * k, -0.25 * k);
    rc.lineTo(0.25 * k, 0.25 * k);
    rc.moveTo(0.25 * k, -0.25 * k);
    rc.lineTo(-0.25 * k, 0.25 * k);
    rc.stroke();
  } else {
    rc.fillRect(-0.07 * k, -0.36 * k, 0.14 * k, 0.44 * k);
    rc.beginPath();
    rc.arc(0, 0.28 * k, 0.08 * k, 0, Math.PI * 2);
    rc.fill();
  }
}

/** Draw one icon in unit space (centred at 0,0, extent ±0.5). */
function drawIconUnit(rc: Ctx2D, def: CFIconDef, unit: number) {
  const { shape, color } = def;
  const level = def.level ?? 0;
  rc.lineWidth = 1 / unit;
  if (shape in ARROW_ANGLE) {
    rc.save();
    rc.rotate(ARROW_ANGLE[shape]);
    poly(rc, ARROW);
    rc.fillStyle = color;
    rc.fill();
    rc.restore();
    return;
  }
  switch (shape) {
    case "triangleUp":
      poly(rc, [
        [0, -0.36],
        [0.42, 0.3],
        [-0.42, 0.3],
      ]);
      rc.fillStyle = color;
      rc.fill();
      break;
    case "triangleDown":
      poly(rc, [
        [0, 0.36],
        [0.42, -0.3],
        [-0.42, -0.3],
      ]);
      rc.fillStyle = color;
      rc.fill();
      break;
    case "dash":
      rc.fillStyle = color;
      rc.fillRect(-0.36, -0.1, 0.72, 0.2);
      break;
    case "circle":
    case "circleRim":
      rc.beginPath();
      rc.arc(0, 0, shape === "circleRim" ? 0.4 : 0.44, 0, Math.PI * 2);
      rc.fillStyle = color;
      rc.fill();
      if (shape === "circleRim") {
        rc.lineWidth = 0.1;
        rc.strokeStyle = "#333333";
        rc.stroke();
      }
      break;
    case "diamond":
      poly(rc, [
        [0, -0.46],
        [0.46, 0],
        [0, 0.46],
        [-0.46, 0],
      ]);
      rc.fillStyle = color;
      rc.fill();
      break;
    case "triangle":
      poly(rc, [
        [0, -0.44],
        [0.48, 0.4],
        [-0.48, 0.4],
      ]);
      rc.fillStyle = color;
      rc.fill();
      break;
    case "check":
    case "cross":
    case "exclamation":
      glyph(rc, shape, color, 1.25);
      break;
    case "checkCircle":
    case "crossCircle":
    case "exclamationCircle":
      rc.beginPath();
      rc.arc(0, 0, 0.46, 0, Math.PI * 2);
      rc.fillStyle = color;
      rc.fill();
      glyph(
        rc,
        ({ checkCircle: "check", crossCircle: "cross" } as const)[
          shape as "checkCircle"
        ] ?? "exclamation",
        "#FFFFFF",
        0.9
      );
      break;
    case "flag":
      rc.strokeStyle = "#555555";
      rc.lineWidth = 0.08;
      rc.beginPath();
      rc.moveTo(-0.3, -0.44);
      rc.lineTo(-0.3, 0.46);
      rc.stroke();
      poly(rc, [
        [-0.28, -0.44],
        [0.42, -0.2],
        [-0.28, 0.06],
      ]);
      rc.fillStyle = color;
      rc.fill();
      break;
    case "star":
      if (level > 0) {
        rc.save();
        if (level === 1) {
          rc.beginPath();
          rc.rect(-0.5, -0.5, 0.5, 1);
          rc.clip();
        }
        starPath(rc);
        rc.fillStyle = color;
        rc.fill();
        rc.restore();
      }
      starPath(rc);
      rc.lineWidth = 0.06;
      rc.strokeStyle = color;
      rc.stroke();
      break;
    case "quarter":
      rc.beginPath();
      rc.arc(0, 0, 0.42, 0, Math.PI * 2);
      rc.fillStyle = "#FFFFFF";
      rc.fill();
      if (level > 0) {
        rc.beginPath();
        rc.moveTo(0, 0);
        rc.arc(0, 0, 0.42, -Math.PI / 2, -Math.PI / 2 + (level * Math.PI) / 2);
        rc.closePath();
        rc.fillStyle = color;
        rc.fill();
      }
      rc.beginPath();
      rc.arc(0, 0, 0.42, 0, Math.PI * 2);
      rc.lineWidth = 0.07;
      rc.strokeStyle = color;
      rc.stroke();
      break;
    case "rating":
      for (let i = 0; i < 4; i += 1) {
        const bh = 0.25 + i * 0.22;
        rc.fillStyle = i < level ? color : "#C8CCD2";
        rc.fillRect(-0.44 + i * 0.235, 0.46 - bh, 0.17, bh);
      }
      break;
    case "boxes":
      for (let i = 0; i < 4; i += 1) {
        const bx = i % 2 === 0 ? -0.44 : 0.04;
        const by = i < 2 ? -0.44 : 0.04;
        rc.fillStyle = i < level ? color : "#DDE1E6";
        rc.fillRect(bx, by, 0.4, 0.4);
      }
      break;
    default:
      break;
  }
}

export function drawCFIcon(
  rc: Ctx2D,
  icon: { set: CFIconSetName; index: number },
  x: number,
  y: number,
  size: number
) {
  const def = CF_ICON_SETS[icon.set]?.[icon.index];
  if (!def || size <= 0) return;
  rc.save();
  rc.translate(x + size / 2, y + size / 2);
  rc.scale(size, size);
  drawIconUnit(rc, def, size);
  rc.restore();
}

/** Icon edge length for a cell of the given height. */
export function cfIconSize(cellHeight: number, zoom = 1) {
  return Math.max(0, Math.min(cellHeight - 4, Math.round(15 * zoom)));
}

/**
 * Paint data bar, icon and border of a cell; (x, y, w, h) is the cell box on
 * the canvas. Called after the background fill and before the text.
 */
export function drawCFDecorations(
  rc: Ctx2D,
  cf: CFCellResult | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1
) {
  if (!cf || (!cf.dataBar && !cf.icon && !cf.borderColor)) return;
  rc.save();
  if (cf.dataBar) {
    const pad = 2;
    drawCFDataBar(
      rc,
      cf.dataBar,
      x + pad,
      y + pad,
      w - pad * 2 - 1,
      h - pad * 2 - 1
    );
  }
  if (cf.icon) {
    const s = cfIconSize(h, zoom);
    drawCFIcon(rc, cf.icon, x + 2, y + (h - 1 - s) / 2, s);
  }
  if (cf.borderColor) {
    rc.lineWidth = 1;
    rc.strokeStyle = cf.borderColor;
    // inside the cell: neighbours and grid lines are painted afterwards
    rc.strokeRect(x - 0.5, y + 0.5, w - 2, h - 3);
  }
  rc.restore();
}

const textCells = new WeakMap<object, { cf: CFCellResult; cell: Cell }>();

/**
 * The cell as the text painter should see it: font styles, number format
 * and "show bar/icon only" of conditional formatting applied. Memoised per
 * cell and result, so layout caches keep working.
 */
export function cfTextCell<T extends Cell | null | undefined>(
  cell: T,
  cf: CFCellResult | null | undefined
): T {
  if (!cell || !cf) return cell;
  if (
    !cf.bold &&
    !cf.italic &&
    !cf.strikethrough &&
    !cf.underline &&
    !cf.numberFormat &&
    !cf.hideValue
  ) {
    return cell;
  }
  const hit = textCells.get(cell);
  if (hit && hit.cf === cf) return hit.cell as T;
  const out: any = { ...cell };
  if (cf.bold) out.bl = 1;
  if (cf.italic) out.it = 1;
  if (cf.strikethrough) out.cl = 1;
  if (cf.underline) out.un = 1;
  if (cf.numberFormat && out.ct?.t !== "inlineStr") {
    const v =
      typeof out.v === "string" &&
      out.v.trim() !== "" &&
      !Number.isNaN(Number(out.v))
        ? Number(out.v)
        : out.v;
    if (typeof v === "number") {
      out.m = formatValue(cf.numberFormat, v);
      out.ct = { ...(out.ct || {}), fa: cf.numberFormat, t: "n" };
    }
  }
  if (cf.hideValue) {
    out.m = "";
    if (out.ct?.t === "inlineStr") out.ct = { fa: "General", t: "g" };
  }
  textCells.set(cell, { cf, cell: out });
  return out;
}
