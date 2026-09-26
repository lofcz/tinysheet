/**
 * Shape Effects and Text Effects of chart elements (Format tab): shadow,
 * glow, soft edges, bevel, 3-D rotation, reflection and the effect
 * presets, as data (xlsx `a:effectLst`, `a:scene3d`, `a:sp3d`) and as SVG
 * filters.
 *
 * Shadow, glow, soft edges and reflection are drawn; bevel is drawn as a
 * light emboss (SVG has no 3-D), and 3-D rotation is kept for the file
 * only.
 */

/** Points to px (96 dpi). */
const PT = 96 / 72;

export type ChartShadow = {
  /** Outer, inner (inside the shape) or perspective (cast behind). */
  kind: "outer" | "inner" | "perspective";
  /** Direction the shadow falls, degrees clockwise from the right. */
  dir: number;
  /** Distance, pt. */
  dist: number;
  /** Blur, pt. */
  blur: number;
  /** Colour (default black). */
  color?: string;
  /** Transparency 0–1 (default 0.6, Excel's 60%). */
  transparency?: number;
  /** Perspective shadows: vertical scale (default 0.23) and skew. */
  scaleY?: number;
  skewX?: number;
};

export type ChartGlow = {
  color: string;
  /** Size, pt. */
  size: number;
  /** Transparency 0–1 (default 0.6). */
  transparency?: number;
};

export type ChartBevel = {
  /** a:bevelT prst: circle, relaxedInset, cross, coolSlant, angle… */
  preset: string;
  /** Width and height, pt (default 6). */
  width?: number;
  height?: number;
};

export type ChartReflection = {
  /** Size of the reflected part, 0–1 (default 0.5). */
  size?: number;
  /** Distance below, pt. */
  dist?: number;
  /** Start transparency 0–1 (default 0.5). */
  transparency?: number;
};

/** Shape Effects / Text Effects of an element. */
export type ChartEffects = {
  /** Shape Effects › Preset n (1–12), the combination it applied. */
  preset?: number;
  shadow?: ChartShadow;
  glow?: ChartGlow;
  /** Soft edges radius, pt. */
  softEdges?: number;
  bevel?: ChartBevel;
  /** a:scene3d camera preset (isometricLeftDown, perspectiveFront…). */
  rotation3d?: string;
  /** Text Effects › Reflection. */
  reflection?: ChartReflection;
};

// ---------------------------------------------------------------------------
// Presets (the galleries of Shape Effects / Text Effects)
// ---------------------------------------------------------------------------

type Named<T> = { id: string; label: string; value: T };

const outer = (
  id: string,
  label: string,
  dir: number,
  dist = 3,
  blur = 4
): Named<ChartShadow> => ({
  id,
  label,
  value: { kind: "outer", dir, dist, blur },
});
const inner = (id: string, label: string, dir: number): Named<ChartShadow> => ({
  id,
  label,
  value: { kind: "inner", dir, dist: 3, blur: 5 },
});
const perspective = (
  id: string,
  label: string,
  dir: number,
  skewX: number,
  scaleY: number
): Named<ChartShadow> => ({
  id,
  label,
  value: { kind: "perspective", dir, dist: 6, blur: 6, skewX, scaleY },
});

/** Shadow › Outer, Inner and Perspective (Excel's names). */
export const CHART_SHADOW_PRESETS: {
  group: "outer" | "inner" | "perspective";
  items: Named<ChartShadow>[];
}[] = [
  {
    group: "outer",
    items: [
      outer("outerBottomRight", "Offset: Bottom Right", 45),
      outer("outerBottom", "Offset: Bottom", 90),
      outer("outerBottomLeft", "Offset: Bottom Left", 135),
      outer("outerRight", "Offset: Right", 0),
      outer("outerCenter", "Offset: Center", 0, 0, 5),
      outer("outerLeft", "Offset: Left", 180),
      outer("outerTopRight", "Offset: Top Right", 315),
      outer("outerTop", "Offset: Top", 270),
      outer("outerTopLeft", "Offset: Top Left", 225),
    ],
  },
  {
    group: "inner",
    items: [
      inner("innerTopLeft", "Inside: Top Left", 45),
      inner("innerTop", "Inside: Top", 90),
      inner("innerTopRight", "Inside: Top Right", 135),
      inner("innerLeft", "Inside: Left", 0),
      { ...inner("innerCenter", "Inside: Center", 0) },
      inner("innerRight", "Inside: Right", 180),
      inner("innerBottomLeft", "Inside: Bottom Left", 315),
      inner("innerBottom", "Inside: Bottom", 270),
      inner("innerBottomRight", "Inside: Bottom Right", 225),
    ],
  },
  {
    group: "perspective",
    items: [
      perspective("perspUpperLeft", "Perspective: Upper Left", 225, -40, 0.4),
      perspective("perspUpperRight", "Perspective: Upper Right", 315, 40, 0.4),
      perspective("perspBelow", "Perspective: Below", 90, 0, -0.23),
      perspective("perspLowerLeft", "Perspective: Lower Left", 135, -40, -0.23),
      perspective("perspLowerRight", "Perspective: Lower Right", 45, 40, -0.23),
    ],
  },
];
CHART_SHADOW_PRESETS[1].items[4].value = {
  kind: "inner",
  dir: 0,
  dist: 0,
  blur: 9,
};

/** Glow Variations: the six accent colours at 5, 8, 11 and 18 pt. */
export const CHART_GLOW_SIZES = [5, 8, 11, 18];
export const CHART_ACCENTS = [
  { color: "#4472C4", label: "Blue, Accent color 1" },
  { color: "#ED7D31", label: "Orange, Accent color 2" },
  { color: "#A5A5A5", label: "Gray, Accent color 3" },
  { color: "#FFC000", label: "Gold, Accent color 4" },
  { color: "#5B9BD5", label: "Blue, Accent color 5" },
  { color: "#70AD47", label: "Green, Accent color 6" },
];

/** Soft Edges variations, pt. */
export const CHART_SOFT_EDGES = [1, 2.5, 5, 10, 25, 50];

/** Bevel (a:bevelT prst) with Excel's names. */
export const CHART_BEVEL_PRESETS: Named<ChartBevel>[] = [
  ["circle", "Circle"],
  ["relaxedInset", "Relaxed Inset"],
  ["cross", "Cross"],
  ["coolSlant", "Cool Slant"],
  ["angle", "Angle"],
  ["softRound", "Soft Round"],
  ["convex", "Convex"],
  ["slope", "Slope"],
  ["divot", "Divot"],
  ["riblet", "Riblet"],
  ["hardEdge", "Hard Edge"],
  ["artDeco", "Art Deco"],
].map(([id, label]) => ({ id, label, value: { preset: id } }));

/** 3-D Rotation (a:camera prst): Parallel, Perspective, Oblique. */
export const CHART_ROTATION_PRESETS: {
  group: "parallel" | "perspective" | "oblique";
  items: { id: string; label: string }[];
}[] = [
  {
    group: "parallel",
    items: [
      ["isometricLeftDown", "Isometric: Left Down"],
      ["isometricRightUp", "Isometric: Right Up"],
      ["isometricTopUp", "Isometric: Top Up"],
      ["isometricBottomDown", "Isometric: Bottom Down"],
      ["isometricOffAxis1Left", "Off Axis 1: Left"],
      ["isometricOffAxis1Right", "Off Axis 1: Right"],
      ["isometricOffAxis1Top", "Off Axis 1: Top"],
      ["isometricOffAxis2Left", "Off Axis 2: Left"],
      ["isometricOffAxis2Right", "Off Axis 2: Right"],
      ["isometricOffAxis2Top", "Off Axis 2: Top"],
    ].map(([id, label]) => ({ id, label })),
  },
  {
    group: "perspective",
    items: [
      ["perspectiveFront", "Perspective: Front"],
      ["perspectiveLeft", "Perspective: Left"],
      ["perspectiveRight", "Perspective: Right"],
      ["perspectiveBelow", "Perspective: Below"],
      ["perspectiveAbove", "Perspective: Above"],
      ["perspectiveRelaxedModerately", "Perspective: Relaxed Moderately"],
      ["perspectiveRelaxed", "Perspective: Relaxed"],
      ["perspectiveContrastingLeftFacing", "Perspective: Contrasting Left"],
      ["perspectiveContrastingRightFacing", "Perspective: Contrasting Right"],
      [
        "perspectiveHeroicExtremeLeftFacing",
        "Perspective: Heroic Extreme Left",
      ],
      [
        "perspectiveHeroicExtremeRightFacing",
        "Perspective: Heroic Extreme Right",
      ],
    ].map(([id, label]) => ({ id, label })),
  },
  {
    group: "oblique",
    items: [
      ["obliqueTopLeft", "Oblique: Top Left"],
      ["obliqueTopRight", "Oblique: Top Right"],
      ["obliqueBottomLeft", "Oblique: Bottom Left"],
      ["obliqueBottomRight", "Oblique: Bottom Right"],
    ].map(([id, label]) => ({ id, label })),
  },
];

/** Text Effects › Reflection variations. */
export const CHART_REFLECTION_PRESETS: Named<ChartReflection>[] = [
  {
    id: "tight",
    label: "Tight Reflection: Touching",
    value: { size: 0.35, dist: 0 },
  },
  {
    id: "half",
    label: "Half Reflection: Touching",
    value: { size: 0.5, dist: 0 },
  },
  {
    id: "full",
    label: "Full Reflection: Touching",
    value: { size: 1, dist: 0 },
  },
  {
    id: "tight4",
    label: "Tight Reflection: 4 pt offset",
    value: { size: 0.35, dist: 4 },
  },
  {
    id: "half4",
    label: "Half Reflection: 4 pt offset",
    value: { size: 0.5, dist: 4 },
  },
  {
    id: "full4",
    label: "Full Reflection: 4 pt offset",
    value: { size: 1, dist: 4 },
  },
];

/**
 * Shape Effects › Preset 1–12: combinations of the effects above (Office
 * builds its presets from shadows, bevels and 3-D rotations).
 */
export const CHART_EFFECT_PRESETS: ChartEffects[] = [
  { shadow: CHART_SHADOW_PRESETS[0].items[0].value },
  { shadow: CHART_SHADOW_PRESETS[0].items[1].value },
  { shadow: CHART_SHADOW_PRESETS[0].items[4].value },
  { bevel: { preset: "circle" } },
  {
    bevel: { preset: "circle" },
    shadow: CHART_SHADOW_PRESETS[0].items[0].value,
  },
  { bevel: { preset: "softRound" } },
  {
    bevel: { preset: "angle" },
    shadow: CHART_SHADOW_PRESETS[0].items[1].value,
  },
  { bevel: { preset: "relaxedInset" }, rotation3d: "perspectiveFront" },
  {
    bevel: { preset: "convex" },
    shadow: CHART_SHADOW_PRESETS[0].items[4].value,
  },
  { bevel: { preset: "slope" }, rotation3d: "isometricOffAxis1Right" },
  {
    bevel: { preset: "artDeco" },
    shadow: CHART_SHADOW_PRESETS[2].items[2].value,
  },
  {
    bevel: { preset: "hardEdge" },
    rotation3d: "perspectiveRelaxed",
    shadow: CHART_SHADOW_PRESETS[0].items[0].value,
  },
].map((e, i) => ({ ...e, preset: i + 1 }));

/** The effects an old `shadow: true` stands for (Offset: Bottom Right). */
export function legacyShadowEffects(): ChartEffects {
  return { shadow: CHART_SHADOW_PRESETS[0].items[0].value };
}

/** Whether effects hold anything. */
export function hasEffects(
  e: ChartEffects | undefined | null
): e is ChartEffects {
  return (
    !!e &&
    !!(
      e.shadow ||
      e.glow ||
      e.softEdges ||
      e.bevel ||
      e.rotation3d ||
      e.reflection
    )
  );
}

// ---------------------------------------------------------------------------
// SVG filters
// ---------------------------------------------------------------------------

/** Filters used by rendered charts, by id (identical effects share one). */
const FILTERS = new Map<string, string>();

function hashString(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

const num = (n: number) => Math.round(n * 100) / 100;

function attrColor(color: string | undefined, fallback: string) {
  return (color ?? fallback).replace(/[^#0-9a-zA-Z(),. %]/g, "");
}

/** The SVG filter body of a set of effects (null when nothing is drawn). */
function filterBody(e: ChartEffects): string | null {
  const parts: string[] = [];
  let source = "SourceGraphic";
  let alpha = "SourceAlpha";
  if (e.softEdges) {
    const r = (e.softEdges * PT) / 2;
    parts.push(
      `<feMorphology in="SourceAlpha" operator="erode" radius="${num(
        r
      )}" result="se1"/><feGaussianBlur in="se1" stdDeviation="${num(
        r / 1.5
      )}" result="se2"/><feComposite in="SourceGraphic" in2="se2" operator="in" result="soft"/>`
    );
    source = "soft";
    alpha = "se2";
  }
  if (e.bevel) {
    const w = (e.bevel.width ?? 6) * PT;
    parts.push(
      `<feGaussianBlur in="${alpha}" stdDeviation="${num(
        Math.max(1, w / 3)
      )}" result="bv1"/><feSpecularLighting in="bv1" surfaceScale="${
        e.bevel.preset === "hardEdge" || e.bevel.preset === "angle" ? 5 : 3
      }" specularConstant="0.7" specularExponent="18" lighting-color="#ffffff" result="bv2"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting><feComposite in="bv2" in2="${alpha}" operator="in" result="bv3"/><feComposite in="${source}" in2="bv3" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="bevel"/>`
    );
    source = "bevel";
  }
  const under: string[] = [];
  const over: string[] = [];
  if (e.glow) {
    const r = e.glow.size * PT;
    parts.push(
      `<feMorphology in="${alpha}" operator="dilate" radius="${num(
        r / 2
      )}" result="gl1"/><feGaussianBlur in="gl1" stdDeviation="${num(
        r / 2.5
      )}" result="gl2"/><feFlood flood-color="${attrColor(
        e.glow.color,
        "#4472C4"
      )}" flood-opacity="${num(
        1 - (e.glow.transparency ?? 0.6)
      )}"/><feComposite in2="gl2" operator="in" result="glow"/>`
    );
    under.push("glow");
  }
  if (e.shadow) {
    const s = e.shadow;
    const rad = (s.dir * Math.PI) / 180;
    const dx = Math.cos(rad) * s.dist * PT;
    const dy = Math.sin(rad) * s.dist * PT;
    const opacity = num(1 - (s.transparency ?? 0.6));
    const color = attrColor(s.color, "#000000");
    if (s.kind === "inner") {
      parts.push(
        `<feOffset in="${alpha}" dx="${num(dx)}" dy="${num(
          dy
        )}" result="is1"/><feGaussianBlur in="is1" stdDeviation="${num(
          (s.blur * PT) / 2
        )}" result="is2"/><feComposite in="${alpha}" in2="is2" operator="arithmetic" k2="1" k3="-1" result="is3"/><feFlood flood-color="${color}" flood-opacity="${opacity}"/><feComposite in2="is3" operator="in" result="inner"/>`
      );
      over.push("inner");
    } else {
      // perspective shadows fall further and flatter
      const far = s.kind === "perspective" ? 1.6 : 1;
      parts.push(
        `<feGaussianBlur in="${alpha}" stdDeviation="${num(
          (s.blur * PT * far) / 2
        )}" result="sh1"/><feOffset in="sh1" dx="${num(dx * far)}" dy="${num(
          dy * far
        )}" result="sh2"/><feFlood flood-color="${color}" flood-opacity="${num(
          opacity * (s.kind === "perspective" ? 0.8 : 1)
        )}"/><feComposite in2="sh2" operator="in" result="shadow"/>`
      );
      under.unshift("shadow");
    }
  }
  if (!parts.length) return null;
  const merge = [...under, source, ...over]
    .map((n) => `<feMergeNode in="${n}"/>`)
    .join("");
  return `${parts.join("")}<feMerge>${merge}</feMerge>`;
}

/**
 * ` filter="url(#…)"` for effects (registered for `effectDefs`), or ""
 * when they draw nothing.
 */
export function effectsAttr(e: ChartEffects | undefined | null): string {
  if (!hasEffects(e)) return "";
  const body = filterBody(e);
  if (!body) return "";
  const id = `ts-fx-${hashString(body)}`;
  if (!FILTERS.has(id)) {
    FILTERS.set(
      id,
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${body}</filter>`
    );
  }
  return ` filter="url(#${id})"`;
}

/** The `<defs>` of the effect filters an SVG body uses ("" if none). */
export function effectDefs(svgBody: string): string {
  const ids = new Set<string>();
  svgBody.replace(/url\(#(ts-fx-[a-z0-9]+)\)/g, (_m, id: string) => {
    ids.add(id);
    return "";
  });
  if (!ids.size) return "";
  return `<defs>${Array.from(ids)
    .map((id) => FILTERS.get(id) ?? "")
    .join("")}</defs>`;
}

/**
 * CSS `filter` of a chart area's outer shadow and glow (drawn outside the
 * chart box, like Excel), or undefined.
 */
export function chartAreaCssFilter(e: ChartEffects | undefined | null) {
  if (!hasEffects(e)) return undefined;
  const out: string[] = [];
  if (e.glow) {
    const r = e.glow.size * PT;
    const alpha = Math.round((1 - (e.glow.transparency ?? 0.6)) * 255)
      .toString(16)
      .padStart(2, "0");
    const c = /^#[0-9a-f]{6}$/i.test(e.glow.color) ? e.glow.color : "#4472C4";
    out.push(`drop-shadow(0 0 ${num(r / 2)}px ${c}${alpha})`);
    out.push(`drop-shadow(0 0 ${num(r / 3)}px ${c}${alpha})`);
  }
  if (e.shadow && e.shadow.kind !== "inner") {
    const s = e.shadow;
    const rad = (s.dir * Math.PI) / 180;
    const far = s.kind === "perspective" ? 1.6 : 1;
    const alpha = Math.round((1 - (s.transparency ?? 0.6)) * 255)
      .toString(16)
      .padStart(2, "0");
    const c = s.color && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#000000";
    out.push(
      `drop-shadow(${num(Math.cos(rad) * s.dist * PT * far)}px ${num(
        Math.sin(rad) * s.dist * PT * far
      )}px ${num(s.blur * PT * far * 0.6)}px ${c}${alpha})`
    );
  }
  return out.length ? out.join(" ") : undefined;
}

/** The effects without those the chart area draws with CSS. */
export function chartAreaSvgEffects(e: ChartEffects | undefined | null) {
  if (!hasEffects(e)) return undefined;
  const { glow, shadow, ...rest } = e;
  const inner = shadow?.kind === "inner" ? { shadow } : {};
  const left = { ...rest, ...inner };
  return hasEffects(left) ? left : undefined;
}

// ---------------------------------------------------------------------------
// WordArt Styles (the Format tab's gallery for a chart's text)
// ---------------------------------------------------------------------------

export type ChartWordArtStyle = {
  id: number;
  label: string;
  /** Text fill. */
  fill: string;
  /** Text outline (none when absent). */
  outline?: string;
  effects?: ChartEffects;
};

const softShadow: ChartShadow = {
  kind: "outer",
  dir: 45,
  dist: 2,
  blur: 3,
  transparency: 0.6,
};
const hardShadow = (color: string): ChartShadow => ({
  kind: "outer",
  dir: 45,
  dist: 2,
  blur: 0,
  color,
  transparency: 0,
});

/**
 * The WordArt gallery (Office's styles for chart text: solid, outlined,
 * glowing, bevelled and hard-shadowed text in the theme colours). Gradient
 * and pattern fills are drawn with their main colour.
 */
export const CHART_WORDART_STYLES: ChartWordArtStyle[] = [
  {
    label: "Fill: Black, Text color 1; Shadow",
    fill: "#000000",
    effects: { shadow: softShadow },
  },
  {
    label: "Fill: Blue, Accent color 1; Shadow",
    fill: "#4472C4",
    effects: { shadow: softShadow },
  },
  {
    label: "Fill: Orange, Accent color 2; Outline: Orange, Accent color 2",
    fill: "#ED7D31",
    outline: "#ED7D31",
  },
  {
    label:
      "Fill: White; Outline: Orange, Accent color 2; Glow: Orange, Accent color 2",
    fill: "#FFFFFF",
    outline: "#ED7D31",
    effects: { glow: { color: "#ED7D31", size: 5 } },
  },
  {
    label: "Fill: Gold, Accent color 4; Soft Bevel",
    fill: "#FFC000",
    effects: { bevel: { preset: "softRound" } },
  },
  {
    label: "Gradient Fill: Gray",
    fill: "#7F7F7F",
    effects: { shadow: softShadow },
  },
  {
    label: "Gradient Fill: Blue, Accent color 1; Reflection",
    fill: "#4472C4",
    effects: { reflection: { size: 0.35, dist: 0 } },
  },
  {
    label: "Gradient Fill: Gold, Accent color 4; Outline: Gold, Accent color 4",
    fill: "#FFC000",
    outline: "#BF9000",
  },
  {
    label:
      "Fill: White; Outline: Blue, Accent color 1; Glow: Blue, Accent color 1",
    fill: "#FFFFFF",
    outline: "#4472C4",
    effects: { glow: { color: "#4472C4", size: 5 } },
  },
  {
    label: "Fill: Gray-50%, Accent color 3; Sharp Bevel",
    fill: "#A5A5A5",
    effects: { bevel: { preset: "angle" } },
  },
  {
    label:
      "Fill: Black, Text color 1; Outline: White, Background color 1; Hard Shadow: Blue, Accent color 5",
    fill: "#000000",
    outline: "#FFFFFF",
    effects: { shadow: hardShadow("#5B9BD5") },
  },
  {
    label:
      "Fill: Blue, Accent color 1; Outline: White, Background color 1; Hard Shadow: Blue, Accent color 1",
    fill: "#4472C4",
    outline: "#FFFFFF",
    effects: { shadow: hardShadow("#4472C4") },
  },
  {
    label: "Fill: White; Outline: Blue, Accent color 5; Shadow",
    fill: "#FFFFFF",
    outline: "#5B9BD5",
    effects: { shadow: softShadow },
  },
  {
    label:
      "Fill: Black, Text color 1; Outline: White, Background color 1; Hard Shadow: Orange, Accent color 2",
    fill: "#000000",
    outline: "#FFFFFF",
    effects: { shadow: hardShadow("#ED7D31") },
  },
  {
    label: "Fill: Gray-50%, Accent color 3; Outline: Gray-50%, Accent color 3",
    fill: "#A5A5A5",
    outline: "#7B7B7B",
  },
  {
    label: "Pattern Fill: Blue, Accent color 1; Shadow",
    fill: "#2F5597",
    effects: { shadow: softShadow },
  },
  {
    label: "Pattern Fill: Gray-50%, Accent color 3; Hard Shadow",
    fill: "#7B7B7B",
    effects: { shadow: hardShadow("#3A3A3A") },
  },
  {
    label: "Fill: Green, Accent color 6; Glow: Green, Accent color 6",
    fill: "#70AD47",
    effects: { glow: { color: "#70AD47", size: 5 } },
  },
  {
    label: "Fill: Blue, Accent color 5; Reflection",
    fill: "#5B9BD5",
    effects: { reflection: { size: 0.5, dist: 0 } },
  },
  {
    label: "Fill: Orange, Accent color 2; Bevel",
    fill: "#ED7D31",
    effects: { bevel: { preset: "circle" } },
  },
].map((w, i) => ({ ...w, id: i + 1 }));
