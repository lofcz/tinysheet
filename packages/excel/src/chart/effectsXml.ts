/**
 * DrawingML effects of chart elements and their text (Format › Shape
 * Effects, Text Effects): `a:effectLst` (outer / inner shadow, glow, soft
 * edge, reflection), `a:scene3d` (3-D rotation) and `a:sp3d` (bevel),
 * written and read back.
 */
import type {
  ChartEffects,
  ChartElementFormat,
  ChartShadow,
} from "@lofcz/tinysheet-core";
import { child, XmlNode } from "./xml";

const EMU_PER_PT = 12700;

const emu = (pt: number) => Math.round(pt * EMU_PER_PT);
const pt = (value: string | undefined, fallback = 0) => {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n)
    ? Math.round((n / EMU_PER_PT) * 100) / 100
    : fallback;
};

function hex6(color: string | undefined, fallback: string) {
  const c = color && /^#?[0-9a-f]{6}$/i.test(color) ? color : fallback;
  return c.replace("#", "").toUpperCase();
}

/** `<a:srgbClr>` with an alpha from a transparency (0–1). */
function colorXml(
  color: string | undefined,
  fallback: string,
  transparency?: number
) {
  const alpha =
    transparency != null && transparency > 0
      ? `<a:alpha val="${Math.round((1 - transparency) * 100000)}"/>`
      : "";
  return alpha
    ? `<a:srgbClr val="${hex6(color, fallback)}">${alpha}</a:srgbClr>`
    : `<a:srgbClr val="${hex6(color, fallback)}"/>`;
}

function shadowXml(s: ChartShadow) {
  const attrs = `blurRad="${emu(s.blur)}" dist="${emu(s.dist)}" dir="${Math.round(
    (((s.dir % 360) + 360) % 360) * 60000
  )}"`;
  const color = colorXml(s.color, "000000", s.transparency ?? 0.6);
  if (s.kind === "inner") {
    return `<a:innerShdw ${attrs}>${color}</a:innerShdw>`;
  }
  const persp =
    s.kind === "perspective"
      ? ` sx="100000" sy="${Math.round((s.scaleY ?? 0.23) * 100000)}" kx="${Math.round(
          (s.skewX ?? 0) * 60000
        )}"`
      : "";
  return `<a:outerShdw ${attrs}${persp} algn="${
    s.kind === "perspective" ? "b" : "tl"
  }" rotWithShape="0">${color}</a:outerShdw>`;
}

/** effectLst + scene3d + sp3d of effects ("" when none). */
export function effectsXml(e: ChartEffects | undefined | null): string {
  if (!e) return "";
  let list = "";
  if (e.glow) {
    list += `<a:glow rad="${emu(e.glow.size)}">${colorXml(
      e.glow.color,
      "4472C4",
      e.glow.transparency ?? 0.6
    )}</a:glow>`;
  }
  if (e.shadow?.kind === "inner") list += shadowXml(e.shadow);
  if (e.shadow && e.shadow.kind !== "inner") list += shadowXml(e.shadow);
  if (e.reflection) {
    const r = e.reflection;
    list += `<a:reflection blurRad="6350" stA="${Math.round(
      (1 - (r.transparency ?? 0.5)) * 100000
    )}" endPos="${Math.round((r.size ?? 0.5) * 100000)}" dist="${emu(
      r.dist ?? 0
    )}" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>`;
  }
  if (e.softEdges) list += `<a:softEdge rad="${emu(e.softEdges)}"/>`;
  let out = list ? `<a:effectLst>${list}</a:effectLst>` : "";
  if (e.rotation3d || e.bevel) {
    out += `<a:scene3d><a:camera prst="${
      e.rotation3d ?? "orthographicFront"
    }"/><a:lightRig rig="threePt" dir="t"/></a:scene3d>`;
  }
  if (e.bevel) {
    out += `<a:sp3d><a:bevelT w="${emu(e.bevel.width ?? 6)}" h="${emu(
      e.bevel.height ?? 6
    )}" prst="${e.bevel.preset}"/></a:sp3d>`;
  }
  return out;
}

function nodeColor(node: XmlNode | undefined) {
  const srgb = child(node, "srgbClr");
  if (!srgb?.attrs.val) return undefined;
  const alpha = child(srgb, "alpha")?.attrs.val;
  return {
    color: `#${srgb.attrs.val.toUpperCase()}`,
    transparency:
      alpha != null
        ? Math.round((1 - parseInt(alpha, 10) / 100000) * 100) / 100
        : undefined,
  };
}

function readShadow(node: XmlNode, kind: ChartShadow["kind"]): ChartShadow {
  const c = nodeColor(node);
  const sy = node.attrs.sy;
  const out: ChartShadow = {
    kind:
      kind === "outer" &&
      sy &&
      parseInt(sy, 10) < 100000 &&
      node.attrs.kx != null
        ? "perspective"
        : kind,
    dir: Math.round(parseInt(node.attrs.dir ?? "0", 10) / 60000),
    dist: pt(node.attrs.dist),
    blur: pt(node.attrs.blurRad),
  };
  if (c && c.color !== "#000000") out.color = c.color;
  if (c?.transparency != null && c.transparency !== 0.6) {
    out.transparency = c.transparency;
  }
  if (out.kind === "perspective") {
    out.scaleY = parseInt(sy ?? "23000", 10) / 100000;
    out.skewX = Math.round(parseInt(node.attrs.kx ?? "0", 10) / 60000);
  }
  return out;
}

/** The effects of a `spPr` / run properties node (undefined when none). */
export function readEffects(
  node: XmlNode | undefined
): ChartEffects | undefined {
  if (!node) return undefined;
  const e: ChartEffects = {};
  const list = child(node, "effectLst");
  const outer = child(list, "outerShdw");
  const inner = child(list, "innerShdw");
  if (outer) e.shadow = readShadow(outer, "outer");
  else if (inner) e.shadow = readShadow(inner, "inner");
  const glow = child(list, "glow");
  if (glow) {
    const c = nodeColor(glow);
    e.glow = {
      color: c?.color ?? "#4472C4",
      size: pt(glow.attrs.rad, 5),
      ...(c?.transparency != null && c.transparency !== 0.6
        ? { transparency: c.transparency }
        : {}),
    };
  }
  const soft = child(list, "softEdge");
  if (soft) e.softEdges = pt(soft.attrs.rad);
  const reflection = child(list, "reflection");
  if (reflection) {
    e.reflection = {
      size: parseInt(reflection.attrs.endPos ?? "50000", 10) / 100000,
      dist: pt(reflection.attrs.dist),
    };
  }
  const camera = child(node, "scene3d", "camera")?.attrs.prst;
  if (camera && camera !== "orthographicFront") e.rotation3d = camera;
  const bevel = child(node, "sp3d", "bevelT");
  if (bevel) {
    e.bevel = { preset: bevel.attrs.prst ?? "circle" };
    const w = pt(bevel.attrs.w, 6);
    const h = pt(bevel.attrs.h, 6);
    if (w !== 6) e.bevel.width = w;
    if (h !== 6) e.bevel.height = h;
  }
  return Object.keys(e).length ? e : undefined;
}

/**
 * Run properties of an element's text: outline (a:ln), fill and effects,
 * in the schema's order (CT_TextCharacterProperties).
 */
export function textRunProps(
  f:
    | Pick<ChartElementFormat, "text" | "textOutline" | "textEffects">
    | undefined
) {
  if (!f) return "";
  let out = "";
  if (f.textOutline) {
    out += `<a:ln w="9525"><a:solidFill><a:srgbClr val="${hex6(
      f.textOutline,
      "000000"
    )}"/></a:solidFill></a:ln>`;
  }
  if (f.text) {
    out += `<a:solidFill><a:srgbClr val="${hex6(f.text, "000000")}"/></a:solidFill>`;
  }
  const list = effectsXml(
    f.textEffects
      ? { ...f.textEffects, bevel: undefined, rotation3d: undefined }
      : undefined
  );
  out += list;
  return out;
}

/** Text outline and effects of run properties (the fill is read apart). */
export function readTextDecor(props: XmlNode | undefined) {
  if (!props) return {};
  const out: Pick<ChartElementFormat, "textOutline" | "textEffects"> = {};
  const line = child(props, "ln", "solidFill", "srgbClr")?.attrs.val;
  if (line) out.textOutline = `#${line.toUpperCase()}`;
  const effects = readEffects(props);
  if (effects) out.textEffects = effects;
  return out;
}
