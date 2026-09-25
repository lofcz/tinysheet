/**
 * Read DrawingML shapes, text boxes, connectors and groups from a sheet's
 * drawing part (`xdr:sp`, `xdr:cxnSp`, `xdr:grpSp` in two-cell, one-cell or
 * absolute anchors) into live TinySheet shapes (`sheet.shapes`).
 *
 * Preset geometry, adjust values, rotation and flips, fill (solid, first
 * gradient stop, or the shape style's fill reference), outline (width,
 * colour, dash, arrow ends), outer shadow, and rich text (runs, paragraph
 * alignment, vertical anchor, wrap) are kept. Theme colours resolve against
 * the workbook theme with lumMod/lumOff/shade/tint/alpha. Anchors with
 * custom geometry stay static pictures (FortuneSheet renders them).
 */
import {
  anchorToPoint,
  AxisGeometry,
  boxToAnchors,
  configGeometry,
  generateShapeId,
  LINE_PRESETS,
  Shape,
  ShapeAnchor,
  ShapeArrowHead,
  ShapeBox,
  ShapeDash,
  ShapeParagraph,
  ShapeText,
  ShapeTextAlign,
  ShapeTextRun,
} from "@lofcz/tinysheet-core";
import { child, children, find, parseXml, XmlNode } from "../chart/xml";
import type { SheetImportContext } from "../ToFortuneSheet/importFeatures";

const EMU_PER_PX = 9525;

export type ThemeColors = Record<string, string>;

/** Office 2013+ default theme, used when the file has no theme part. */
export const DEFAULT_THEME_COLORS: ThemeColors = {
  dk1: "000000",
  lt1: "FFFFFF",
  dk2: "44546A",
  lt2: "E7E6E6",
  accent1: "4472C4",
  accent2: "ED7D31",
  accent3: "A5A5A5",
  accent4: "FFC000",
  accent5: "5B9BD5",
  accent6: "70AD47",
  hlink: "0563C1",
  folHlink: "954F72",
};

const SCHEME_ALIASES: Record<string, string> = {
  tx1: "dk1",
  bg1: "lt1",
  tx2: "dk2",
  bg2: "lt2",
};

const PRESET_COLORS: Record<string, string> = {
  black: "000000",
  white: "FFFFFF",
  red: "FF0000",
  green: "008000",
  blue: "0000FF",
  yellow: "FFFF00",
  gray: "808080",
  orange: "FFA500",
};

/** Colour scheme of a theme part (`a:clrScheme`). */
export function readThemeColors(themeXml: string | undefined): ThemeColors {
  const colors = { ...DEFAULT_THEME_COLORS };
  if (!themeXml) return colors;
  const scheme = find(parseXml(themeXml), "clrScheme");
  scheme?.children.forEach((slot) => {
    const c = slot.children[0];
    const value =
      c?.name === "sysClr" ? c.attrs.lastClr : (c?.attrs.val ?? undefined);
    if (value && /^[0-9a-f]{6}$/i.test(value))
      colors[slot.name] = value.toUpperCase();
  });
  return colors;
}

function toRgb(hex: string) {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]) {
  return rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")
    .toUpperCase();
}

function rgbToHsl([r, g, b]: number[]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: number[]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map(
    (v) => v * 255
  );
}

type Color = { color: string; alpha?: number };

/** A DrawingML colour element (srgbClr, schemeClr, ...) with modifiers. */
function readColorNode(
  node: XmlNode | undefined,
  theme: ThemeColors,
  placeholder?: Color
): Color | undefined {
  if (!node) return undefined;
  let hex: string | undefined;
  let alpha: number | undefined;
  switch (node.name) {
    case "srgbClr":
      hex = node.attrs.val;
      break;
    case "sysClr":
      hex =
        node.attrs.lastClr ??
        (node.attrs.val === "window" ? "FFFFFF" : "000000");
      break;
    case "schemeClr": {
      const key = node.attrs.val;
      if (key === "phClr") {
        hex = placeholder?.color.replace("#", "");
        alpha = placeholder?.alpha;
      } else {
        hex = theme[SCHEME_ALIASES[key] ?? key];
      }
      break;
    }
    case "prstClr":
      hex = PRESET_COLORS[node.attrs.val];
      break;
    case "scrgbClr": {
      const pct = (k: string) => (Number(node.attrs[k] ?? 0) / 100000) * 255;
      hex = toHex([pct("r"), pct("g"), pct("b")]);
      break;
    }
    default:
      return undefined;
  }
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  let rgb = toRgb(hex);
  node.children.forEach((mod) => {
    const v = Number(mod.attrs.val) / 100000;
    if (!Number.isFinite(v)) return;
    if (mod.name === "alpha") alpha = v;
    else if (mod.name === "shade") rgb = rgb.map((c) => c * v);
    else if (mod.name === "tint") rgb = rgb.map((c) => c + (255 - c) * (1 - v));
    else if (mod.name === "lumMod" || mod.name === "lumOff") {
      const hsl = rgbToHsl(rgb);
      hsl[2] =
        mod.name === "lumMod"
          ? Math.min(1, hsl[2] * v)
          : Math.min(1, Math.max(0, hsl[2] + v));
      rgb = hslToRgb(hsl);
    }
  });
  return { color: `#${toHex(rgb)}`, ...(alpha != null ? { alpha } : {}) };
}

const COLOR_NAMES = [
  "srgbClr",
  "schemeClr",
  "sysClr",
  "prstClr",
  "scrgbClr",
  "hslClr",
];

function colorIn(
  parent: XmlNode | undefined,
  theme: ThemeColors,
  placeholder?: Color
) {
  const node = parent?.children.find((c) => COLOR_NAMES.includes(c.name));
  return readColorNode(node, theme, placeholder);
}

/** Fill of a spPr-like node: null = no fill, undefined = not specified. */
function readFill(
  node: XmlNode | undefined,
  theme: ThemeColors,
  placeholder?: Color
): Color | null | undefined {
  if (!node) return undefined;
  if (child(node, "noFill")) return null;
  const solid = child(node, "solidFill");
  if (solid) return colorIn(solid, theme, placeholder) ?? null;
  const grad = child(node, "gradFill");
  if (grad) {
    const stop = child(grad, "gsLst", "gs");
    return colorIn(stop, theme, placeholder) ?? null;
  }
  const patt = child(node, "pattFill");
  if (patt) return colorIn(child(patt, "fgClr"), theme, placeholder) ?? null;
  return undefined;
}

const DASHES = new Set<ShapeDash>([
  "solid",
  "dash",
  "dot",
  "dashDot",
  "lgDash",
  "sysDash",
  "sysDot",
]);

const DASH_ALIASES: Record<string, ShapeDash> = {
  sysDashDot: "dashDot",
  sysDashDotDot: "dashDot",
  lgDashDot: "dashDot",
  lgDashDotDot: "dashDot",
};

const HEADS = new Set<ShapeArrowHead>([
  "triangle",
  "arrow",
  "stealth",
  "diamond",
  "oval",
]);

function readText(
  txBody: XmlNode | undefined,
  theme: ThemeColors,
  fontColor: string | undefined
): ShapeText | undefined {
  if (!txBody) return undefined;
  const bodyPr = child(txBody, "bodyPr");
  const anchorAttr = bodyPr?.attrs.anchor;
  const runFormat = (rPr: XmlNode | undefined) => {
    const fmt: Omit<ShapeTextRun, "text"> = {};
    if (!rPr) return fmt;
    const on = (v: string | undefined) => v === "1" || v === "true";
    const sz = Number(rPr.attrs.sz);
    if (Number.isFinite(sz) && sz > 0) fmt.size = sz / 100;
    if (on(rPr.attrs.b)) fmt.b = true;
    if (on(rPr.attrs.i)) fmt.i = true;
    if (rPr.attrs.u && rPr.attrs.u !== "none") fmt.u = true;
    if (rPr.attrs.strike && rPr.attrs.strike !== "noStrike") fmt.strike = true;
    const fill = readFill(rPr, theme);
    if (fill) fmt.color = fill.color;
    const face = child(rPr, "latin")?.attrs.typeface;
    if (face && !face.startsWith("+")) fmt.font = face;
    return fmt;
  };
  const paragraphs: ShapeParagraph[] = children(txBody, "p").map((p) => {
    const algn = child(p, "pPr")?.attrs.algn;
    const align: ShapeTextAlign | undefined =
      algn === "l" || algn === "ctr" || algn === "r"
        ? algn
        : algn === "just" || algn === "dist"
          ? "just"
          : undefined;
    const runs: ShapeTextRun[] = [];
    p.children.forEach((node) => {
      if (node.name === "r" || node.name === "fld") {
        const value = child(node, "t")?.text ?? "";
        if (value !== "")
          runs.push({ ...runFormat(child(node, "rPr")), text: value });
      } else if (node.name === "br") {
        const last = runs[runs.length - 1];
        if (last) last.text += "\n";
        else runs.push({ ...runFormat(child(node, "rPr")), text: "\n" });
      }
    });
    return { runs, ...(align ? { align } : {}) };
  });
  const first = children(txBody, "p")[0];
  const defaults = runFormat(child(first, "endParaRPr"));
  // without an explicit or style colour, Excel draws black text
  if (!defaults.color) defaults.color = fontColor ?? "#000000";
  return {
    paragraphs: paragraphs.length ? paragraphs : [{ runs: [] }],
    anchor: anchorAttr === "ctr" ? "ctr" : anchorAttr === "b" ? "b" : "t",
    ...(bodyPr?.attrs.wrap === "none" ? { wrap: false } : {}),
    defaults,
  };
}

function readShapeNode(
  node: XmlNode,
  box: ShapeBox,
  geo: AxisGeometry,
  theme: ThemeColors,
  group?: string
): Shape | null {
  const nv = child(node, "nvSpPr") ?? child(node, "nvCxnSpPr");
  const cNvPr = child(nv, "cNvPr");
  const spPr = child(node, "spPr");
  if (!spPr || child(spPr, "custGeom")) return null;
  const prst = child(spPr, "prstGeom")?.attrs.prst ?? "rect";
  const style = child(node, "style");
  const styleColor = (name: string) => {
    const ref = child(style, name);
    if (!ref || ref.attrs.idx === "0") return undefined;
    return colorIn(ref, theme);
  };

  const shape: Shape = {
    id: generateShapeId(),
    prst,
    ...boxToAnchors(geo, box),
  };
  if (cNvPr?.attrs.name) shape.name = cNvPr.attrs.name;
  if (cNvPr?.attrs.descr) shape.alt = cNvPr.attrs.descr;
  if (child(nv, "cNvSpPr")?.attrs.txBox === "1") shape.textBox = true;
  if (group) shape.group = group;

  const gds = children(child(child(spPr, "prstGeom"), "avLst"), "gd");
  gds.forEach((gd) => {
    const m = /^val\s+(-?\d+)/.exec(gd.attrs.fmla ?? "");
    if (m && gd.attrs.name) {
      shape.adj = { ...(shape.adj ?? {}), [gd.attrs.name]: Number(m[1]) };
    }
  });

  const xfrm = child(spPr, "xfrm");
  const rot = Number(xfrm?.attrs.rot ?? 0) / 60000;
  if (rot) shape.rot = ((rot % 360) + 360) % 360;
  if (xfrm?.attrs.flipH === "1") shape.flipH = true;
  if (xfrm?.attrs.flipV === "1") shape.flipV = true;

  const isLine = LINE_PRESETS.has(prst) || node.name === "cxnSp";
  let fill = readFill(spPr, theme);
  if (fill === undefined) {
    const ref = styleColor("fillRef");
    fill = ref ?? null;
  }
  if (fill && !isLine) {
    shape.fill = {
      color: fill.color,
      ...(fill.alpha != null && fill.alpha < 1
        ? { transparency: Math.round((1 - fill.alpha) * 100) / 100 }
        : {}),
    };
  } else {
    shape.fill = null;
  }

  const ln = child(spPr, "ln");
  let lineColor = readFill(ln, theme);
  if (lineColor === undefined) lineColor = styleColor("lnRef") ?? null;
  if (lineColor && !(ln && child(ln, "noFill"))) {
    const w = Number(ln?.attrs.w);
    shape.line = {
      color: lineColor.color,
      width:
        Number.isFinite(w) && w > 0
          ? Math.round((w / EMU_PER_PX) * 100) / 100
          : ln
            ? 1
            : 1.33,
    };
    const dash = child(ln, "prstDash")?.attrs.val;
    const d = (dash &&
      (DASHES.has(dash as ShapeDash) ? dash : DASH_ALIASES[dash])) as
      | ShapeDash
      | undefined;
    if (d && d !== "solid") shape.line.dash = d;
    const head = child(ln, "headEnd")?.attrs.type as ShapeArrowHead;
    const tail = child(ln, "tailEnd")?.attrs.type as ShapeArrowHead;
    if (HEADS.has(head)) shape.line.head = head;
    if (HEADS.has(tail)) shape.line.tail = tail;
  } else {
    shape.line = null;
  }

  if (child(child(spPr, "effectLst"), "outerShdw")) shape.shadow = true;

  if (!isLine) {
    const text = readText(
      child(node, "txBody"),
      theme,
      styleColor("fontRef")?.color
    );
    if (text) shape.text = text;
  }
  return shape;
}

type Transform = { box: ShapeBox };

function xfrmBox(xfrm: XmlNode | undefined, key: "off" | "chOff") {
  const off = child(xfrm, key);
  const ext = child(xfrm, key === "off" ? "ext" : "chExt");
  return {
    x: Number(off?.attrs.x ?? 0),
    y: Number(off?.attrs.y ?? 0),
    cx: Number(ext?.attrs.cx ?? 0),
    cy: Number(ext?.attrs.cy ?? 0),
  };
}

/** Shapes of a group node, flattened into one group. */
function readGroup(
  node: XmlNode,
  parent: Transform,
  geo: AxisGeometry,
  theme: ThemeColors,
  group: string,
  out: Shape[]
) {
  const xfrm = child(child(node, "grpSpPr"), "xfrm");
  const ch = xfrmBox(xfrm, "chOff");
  const sx = ch.cx > 0 ? parent.box.width / ch.cx : 1 / EMU_PER_PX;
  const sy = ch.cy > 0 ? parent.box.height / ch.cy : 1 / EMU_PER_PX;
  const childBox = (x: XmlNode | undefined): ShapeBox => {
    const b = xfrmBox(x, "off");
    return {
      left: parent.box.left + (b.x - ch.x) * sx,
      top: parent.box.top + (b.y - ch.y) * sy,
      width: b.cx * sx,
      height: b.cy * sy,
    };
  };
  node.children.forEach((c) => {
    if (c.name === "sp" || c.name === "cxnSp") {
      const shape = readShapeNode(
        c,
        childBox(child(child(c, "spPr"), "xfrm")),
        geo,
        theme,
        group
      );
      if (shape) out.push(shape);
    } else if (c.name === "grpSp") {
      readGroup(
        c,
        { box: childBox(child(child(c, "grpSpPr"), "xfrm")) },
        geo,
        theme,
        group,
        out
      );
    }
  });
}

function cellAnchor(node: XmlNode | undefined): ShapeAnchor {
  const n = (name: string) => Number(child(node, name)?.text ?? 0) || 0;
  return {
    c: n("col"),
    r: n("row"),
    dx: Math.round((n("colOff") / EMU_PER_PX) * 100) / 100,
    dy: Math.round((n("rowOff") / EMU_PER_PX) * 100) / 100,
  };
}

function anchorBox(anchor: XmlNode, geo: AxisGeometry): ShapeBox | null {
  const ext = child(anchor, "ext");
  const size = {
    width: Number(ext?.attrs.cx ?? 0) / EMU_PER_PX,
    height: Number(ext?.attrs.cy ?? 0) / EMU_PER_PX,
  };
  if (anchor.name === "twoCellAnchor") {
    const a = anchorToPoint(geo, cellAnchor(child(anchor, "from")));
    const b = anchorToPoint(geo, cellAnchor(child(anchor, "to")));
    return {
      left: a.x,
      top: a.y,
      width: Math.max(0, b.x - a.x),
      height: Math.max(0, b.y - a.y),
    };
  }
  if (anchor.name === "oneCellAnchor") {
    const a = anchorToPoint(geo, cellAnchor(child(anchor, "from")));
    return { left: a.x, top: a.y, ...size };
  }
  if (anchor.name === "absoluteAnchor") {
    const pos = child(anchor, "pos");
    return {
      left: Number(pos?.attrs.x ?? 0) / EMU_PER_PX,
      top: Number(pos?.attrs.y ?? 0) / EMU_PER_PX,
      ...size,
    };
  }
  return null;
}

/** Whether an anchor's XML holds custom geometry (kept as a picture). */
export function hasCustomGeometry(anchorXml: string) {
  return /<(?:\w+:)?custGeom[\s/>]/.test(anchorXml);
}

let groupSeed = 0;

/** Shapes of a drawing part (z-order = document order). */
export function readDrawingShapes(
  drawingXml: string,
  geo: AxisGeometry,
  theme: ThemeColors = DEFAULT_THEME_COLORS
): Shape[] {
  const root = find(parseXml(drawingXml), "wsDr");
  const out: Shape[] = [];
  root?.children.forEach((anchor) => {
    const box = anchorBox(anchor, geo);
    if (!box) return;
    if (find(anchor, "custGeom")) return;
    anchor.children.forEach((node) => {
      if (node.name === "sp" || node.name === "cxnSp") {
        const shape = readShapeNode(node, box, geo, theme);
        if (!shape) return;
        // a two-cell anchor keeps its exact cells
        if (anchor.name === "twoCellAnchor") {
          shape.from = cellAnchor(child(anchor, "from"));
          shape.to = cellAnchor(child(anchor, "to"));
        }
        out.push(shape);
      } else if (node.name === "grpSp") {
        groupSeed += 1;
        const members: Shape[] = [];
        readGroup(
          node,
          { box },
          geo,
          theme,
          `group_x${Date.now().toString(36)}_${groupSeed}`,
          members
        );
        if (members.length === 1) delete members[0].group;
        out.push(...members);
      }
    });
  });
  return out;
}

const DRAWING_REL = /\/drawing"/;

/** Zip path of the drawing part of a worksheet part, if any. */
function drawingPartOf(files: Record<string, any>, sheetFile: string) {
  const slash = sheetFile.lastIndexOf("/");
  const dir = sheetFile.slice(0, slash);
  const rels = files[`${dir}/_rels/${sheetFile.slice(slash + 1)}.rels`];
  if (typeof rels !== "string") return undefined;
  const tag = (rels.match(/<Relationship\b[^>]*>/g) || []).find((t) =>
    DRAWING_REL.test(t)
  );
  const target = tag && /\bTarget="([^"]*)"/.exec(tag)?.[1];
  if (!target) return undefined;
  if (target.startsWith("/")) return target.slice(1);
  const parts = dir.split("/");
  target.split("/").forEach((seg) => {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  });
  return parts.join("/");
}

/** Sheet import feature: the sheet's drawing shapes -> `sheet.shapes`. */
export function readShapes(ctx: SheetImportContext) {
  const path = drawingPartOf(ctx.files as any, ctx.sheetFile);
  if (!path || typeof ctx.files[path] !== "string") return;
  const sheet = ctx.sheet as any;
  const geo = configGeometry(
    sheet.config,
    sheet.defaultRowHeight || 19,
    sheet.defaultColWidth || 73
  );
  const themePath = Object.keys(ctx.files).find((f) =>
    /^xl\/theme\/theme\d*\.xml$/.test(f)
  );
  const theme = readThemeColors(themePath ? ctx.files[themePath] : undefined);
  const shapes = readDrawingShapes(ctx.files[path], geo, theme);
  if (shapes.length) sheet.shapes = shapes;
}
