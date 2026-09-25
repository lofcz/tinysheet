/**
 * Colour helpers of the pickers (ColorPicker, BorderPicker): hex / RGB /
 * HSL / HSV conversions, Excel's theme palette with its tints and shades,
 * the standard colours and the shared "Recent Colors" list.
 */

export type RGB = { r: number; g: number; b: number };
export type HSV = { h: number; s: number; v: number };

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** "#abc", "#aabbcc", "rgb(…)" → RGB, or null when unparsable. */
export function parseColor(input: string | null | undefined): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  let m = /^#?([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = m[1].split("").map((ch) => parseInt(ch + ch, 16));
    return { r, g, b };
  }
  m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) {
    return {
      r: clamp(Math.round(+m[1]), 0, 255),
      g: clamp(Math.round(+m[2]), 0, 255),
      b: clamp(Math.round(+m[3]), 0, 255),
    };
  }
  return null;
}

export function toHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Lower-case "#rrggbb" of any parsable colour ("" otherwise). */
export function normalizeHex(input: string | null | undefined): string {
  const rgb = parseColor(input);
  return rgb ? toHex(rgb) : "";
}

export function rgbToHsl({ r, g, b }: RGB) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  };
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hh < 1) rgb = [c, x, 0];
  else if (hh < 2) rgb = [x, c, 0];
  else if (hh < 3) rgb = [0, c, x];
  else if (hh < 4) rgb = [0, x, c];
  else if (hh < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = v - c;
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  };
}

/** Relative brightness 0 (black) … 1 (white), for contrast decisions. */
export function brightness(hex: string) {
  const rgb = parseColor(hex);
  if (!rgb) return 1;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/** Excel's tint (+) / shade (−) of a theme colour: HSL luminance. */
export function tintShade(hex: string, amount: number): string {
  const rgb = parseColor(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb);
  const nl = amount >= 0 ? l + (1 - l) * amount : l * (1 + amount);
  return toHex(hslToRgb(h, s, clamp(nl, 0, 1)));
}

export type PaletteColor = { color: string; name: string };

/** The Office theme (Excel 2013–2021): name, base colour. */
export const THEME_COLORS: { name: string; role: string; color: string }[] = [
  { name: "White", role: "Background 1", color: "#ffffff" },
  { name: "Black", role: "Text 1", color: "#000000" },
  { name: "Gray", role: "Background 2", color: "#e7e6e6" },
  { name: "Blue-Gray", role: "Text 2", color: "#44546a" },
  { name: "Blue", role: "Accent 1", color: "#4472c4" },
  { name: "Orange", role: "Accent 2", color: "#ed7d31" },
  { name: "Gray", role: "Accent 3", color: "#a5a5a5" },
  { name: "Gold", role: "Accent 4", color: "#ffc000" },
  { name: "Blue", role: "Accent 5", color: "#5b9bd5" },
  { name: "Green", role: "Accent 6", color: "#70ad47" },
];

/** Excel's Standard Colors row. */
export const STANDARD_COLORS: PaletteColor[] = [
  { color: "#c00000", name: "Dark Red" },
  { color: "#ff0000", name: "Red" },
  { color: "#ffc000", name: "Orange" },
  { color: "#ffff00", name: "Yellow" },
  { color: "#92d050", name: "Light Green" },
  { color: "#00b050", name: "Green" },
  { color: "#00b0f0", name: "Light Blue" },
  { color: "#0070c0", name: "Blue" },
  { color: "#002060", name: "Dark Blue" },
  { color: "#7030a0", name: "Purple" },
];

/** The five tint / shade steps Excel shows under a theme colour. */
function variantSteps(hex: string): number[] {
  const rgb = parseColor(hex)!;
  const { l } = rgbToHsl(rgb);
  if (l >= 0.999) return [-0.05, -0.15, -0.25, -0.35, -0.5];
  if (l <= 0.001) return [0.5, 0.35, 0.25, 0.15, 0.05];
  if (l > 0.8) return [-0.1, -0.25, -0.5, -0.75, -0.9];
  if (l < 0.2) return [0.9, 0.75, 0.5, 0.25, 0.1];
  return [0.8, 0.6, 0.4, -0.25, -0.5];
}

/**
 * The Theme Colors grid: 6 rows × 10 columns (base colours, then their
 * tints and shades), named like Excel's screen tips.
 */
export function themeGrid(): PaletteColor[][] {
  const rows: PaletteColor[][] = [
    THEME_COLORS.map((t) => ({
      color: t.color,
      name: `${t.name}, ${t.role}`,
    })),
  ];
  const steps = THEME_COLORS.map((t) => variantSteps(t.color));
  for (let i = 0; i < 5; i += 1) {
    rows.push(
      THEME_COLORS.map((t, col) => {
        const amount = steps[col][i];
        const pct = Math.round(Math.abs(amount) * 100);
        return {
          color: tintShade(t.color, amount),
          name: `${t.name}, ${t.role}, ${amount > 0 ? "Lighter" : "Darker"} ${pct}%`,
        };
      })
    );
  }
  return rows;
}

/* ---------- Recent colours (shared by every picker of the page) ---------- */

const MAX_RECENT = 10;
let recent: string[] = [];
const listeners = new Set<() => void>();

export function getRecentColors() {
  return recent;
}

/** Remember a custom colour (More Colors…) at the front of the list. */
export function addRecentColor(color: string) {
  const hex = normalizeHex(color);
  if (!hex) return;
  recent = [hex, ...recent.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  listeners.forEach((l) => l());
}

export function subscribeRecentColors(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
