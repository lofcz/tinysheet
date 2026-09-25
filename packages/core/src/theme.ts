/**
 * Theme definitions shared by the canvas renderer and the React UI.
 *
 * The React UI is themed through CSS custom properties declared on
 * `.fortune-container` (see `react/src/components/Workbook/index.css`); the
 * `data-theme` attribute on that element switches between palettes. The canvas
 * cannot read CSS variables cheaply on every frame, so its default colours
 * live here and are looked up from `ctx.theme`.
 *
 * Light theme: cell-level colours (`fc`, `bg`, borders, conditional formats)
 * render exactly as specified.
 *
 * Dark theme (like Excel's dark sheet and Word's dark mode), cell colours are
 * adapted so the sheet stays legible, while keeping their hue:
 * - Automatic (unset) and near-black text, and near-black borders, follow the
 *   theme (light on the dark sheet).
 * - Very light fills (white, light greys and pastels: HSL lightness >= 0.85)
 *   become dark tints of the same hue (see {@link resolveCellFill}); stronger
 *   fills (yellow highlight, gold, mid greys, Accent colours) are kept, and
 *   text on them keeps its colour (black by default) so it stays readable.
 * - Other dark, saturated text colours (dark red, navy...) are lightened on
 *   dark fills; every other explicit colour is kept.
 */

/** A concrete palette. */
export type ThemeName = "light" | "dark";

/** Value accepted by `settings.theme`; `auto` follows `prefers-color-scheme`. */
export type ThemeSetting = ThemeName | "auto";

export type CanvasTheme = {
  /** Default cell background (cells without `bg`). */
  cellBackground: string;
  /** Default cell text colour (cells without `fc`). */
  cellText: string;
  /** Grid lines. */
  gridLine: string;
  /** Row / column header background. */
  headerBackground: string;
  /** Lines between and around the row / column headers. */
  headerLine: string;
  /** Row / column header labels. */
  headerText: string;
  /** Header of a row / column that holds part of the selection. */
  headerSelectedBackground: string;
  /** Label of a row / column header that holds part of the selection. */
  headerSelectedText: string;
  /** Header of a fully selected row / column. */
  headerFullBackground: string;
  /** Label of a fully selected row / column header. */
  headerFullText: string;
  /** Selection accent: the 2px edge of selected headers. */
  accent: string;
  /** Frozen-pane divider. */
  freezeLine: string;
  /** Near-black cell borders in the dark theme (Excel: Automatic). */
  borderAutomatic: string;
  /** Red corner marker for comments and data-validation errors. */
  commentMarker: string;
  /** Green corner marker for numbers stored as text. */
  numberAsTextMarker: string;
  /** Data-validation checkbox outline. */
  checkboxStroke: string;
};

export const canvasThemes: Record<ThemeName, CanvasTheme> = {
  light: {
    cellBackground: "#ffffff",
    cellText: "#000000",
    gridLine: "#e4e4e7",
    headerBackground: "#f4f4f5",
    headerLine: "#d9d9de",
    headerText: "#71717a",
    // --ts-accent-soft (accent at 10%, 20%) over the header background
    headerSelectedBackground: "#dfe5f4",
    headerSelectedText: "#18181b",
    headerFullBackground: "#cbd7f3",
    headerFullText: "#1d4ed8",
    accent: "#2563eb",
    freezeLine: "#a1a1aa",
    borderAutomatic: "#000000",
    commentMarker: "#e5484d",
    numberAsTextMarker: "#18794e",
    checkboxStroke: "#000000",
  },
  dark: {
    cellBackground: "#1c1c1f",
    cellText: "#e4e4e7",
    gridLine: "#2e2e33",
    headerBackground: "#141417",
    headerLine: "#34343a",
    headerText: "#a1a1aa",
    // --ts-accent-soft (accent at 16%, 30%) over the header background
    headerSelectedBackground: "#202b3b",
    headerSelectedText: "#fafafa",
    headerFullBackground: "#2b3f5b",
    headerFullText: "#bfdbfe",
    accent: "#60a5fa",
    freezeLine: "#71717a",
    borderAutomatic: "#d4d4d8",
    commentMarker: "#f87171",
    numberAsTextMarker: "#4ade80",
    checkboxStroke: "#c4c7c5",
  },
};

export const themeNames: ThemeName[] = ["light", "dark"];

/** Whether the OS / browser currently prefers a dark colour scheme. */
export function prefersDarkColorScheme(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolve a `settings.theme` value to a concrete palette name. */
export function resolveTheme(
  setting: ThemeSetting | null | undefined,
  prefersDark: boolean = prefersDarkColorScheme()
): ThemeName {
  if (setting === "dark") return "dark";
  if (setting === "auto") return prefersDark ? "dark" : "light";
  return "light";
}

/**
 * Canvas palette for a context (or theme name). Unknown values fall back to
 * the light palette, so contexts created before theming existed keep working.
 */
export function getCanvasTheme(
  source: { theme?: ThemeName | null } | ThemeName | null | undefined
): CanvasTheme {
  const name = typeof source === "string" ? source : source?.theme;
  return (name && canvasThemes[name]) || canvasThemes.light;
}

type RGB = [number, number, number];

const NAMED: Record<string, RGB> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  navy: [0, 0, 128],
  maroon: [128, 0, 0],
  purple: [128, 0, 128],
};

/** `#rgb` / `#rrggbb(aa)` / `rgb()` / `rgba()` / a few names -> RGB. */
function parseColor(color: string): RGB | undefined {
  const s = color.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return [1, 2, 3].map((i) => parseInt(s[i] + s[i], 16)) as RGB;
  }
  if (/^#[0-9a-f]{6}/.test(s)) {
    return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
  }
  const m = s.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (!m) return undefined;
  // a transparent fill is no fill
  if (m[4] != null && Number(m[4]) === 0) return undefined;
  return [m[1], m[2], m[3]].map(Number) as RGB;
}

/** Relative luminance (0–1). */
function luminanceOf([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function luminance(color: string): number | undefined {
  const rgb = parseColor(color);
  return rgb ? luminanceOf(rgb) : undefined;
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((v) =>
      Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

/**
 * Luminance below which a font colour counts as "near black". Covers pure
 * black (Excel's Automatic) and the `rgb(51, 51, 51)` Luckysheet default.
 */
const NEAR_BLACK = 0.05;

/** Luminance below which a coloured text is lightened on a dark fill. */
const DARK_TEXT = 0.12;

/** Fill luminance above which a cell background counts as light. */
const LIGHT_FILL = 0.4;

/** HSL lightness from which a fill counts as "very light" (dark theme). */
const PALE_FILL = 0.85;

const fillCache = new Map<string, string>();
const textCache = new Map<string, string>();

function isDark(
  source: { theme?: ThemeName | null } | ThemeName | null | undefined
) {
  return getCanvasTheme(source) === canvasThemes.dark;
}

/**
 * Fill a cell is drawn with. Light theme: `bg` unchanged. Dark theme: very
 * light fills (white, light greys, pastels) become a dark tint of the same
 * hue, lighter fills staying lighter (so banding and header rows keep their
 * contrast); every other fill is kept. Undefined when `bg` is unset.
 */
export function resolveCellFill(
  source: { theme?: ThemeName | null } | ThemeName | null | undefined,
  bg?: string | null
): string | undefined {
  if (!bg) return undefined;
  if (!isDark(source)) return bg;
  const cached = fillCache.get(bg);
  if (cached != null) return cached;
  let out = bg;
  const rgb = parseColor(bg);
  if (rgb) {
    const [h, s, l] = toHsl(rgb);
    if (l >= PALE_FILL) {
      // white -> the dark cell colour, #f2f2f2 -> a slightly lighter band
      out = hslToHex(h, s * 0.45, 0.11 + (1 - l) * 0.9);
    }
  }
  if (fillCache.size > 512) fillCache.clear();
  fillCache.set(bg, out);
  return out;
}

/**
 * Text colour for a cell. `fc` is the cell's font colour (possibly the
 * `#000000` default filled in by `normalizedCellAttr`), `bg` its stored fill
 * (before {@link resolveCellFill}).
 *
 * Light theme: `fc` unchanged (black when unset), i.e. exactly the historic
 * behaviour.
 *
 * Dark theme, following how Excel's dark mode treats "Automatic" text:
 * - on a fill that stays light, `fc` is kept (black when unset) so it stays
 *   legible;
 * - otherwise unset or near-black text, which would vanish on the dark sheet,
 *   becomes the theme text colour, and other dark colours are lightened
 *   (same hue);
 * - every other explicit colour is kept.
 */
export function resolveCellTextColor(
  source: { theme?: ThemeName | null } | ThemeName | null | undefined,
  fc?: string | null,
  bg?: string | null
): string {
  const theme = getCanvasTheme(source);
  if (theme === canvasThemes.light) return fc || theme.cellText;
  const fill = resolveCellFill(source, bg);
  const fillLum = fill ? luminance(fill) : undefined;
  if (fillLum !== undefined && fillLum > LIGHT_FILL) return fc || "#000000";
  if (!fc) return theme.cellText;
  const cached = textCache.get(fc);
  if (cached != null) return cached;
  let out = fc;
  const rgb = parseColor(fc);
  if (rgb) {
    const lum = luminanceOf(rgb);
    const [h, s, l] = toHsl(rgb);
    if (lum < NEAR_BLACK || (lum < DARK_TEXT && s < 0.2)) {
      out = theme.cellText;
    } else if (lum < DARK_TEXT) {
      out = hslToHex(h, s, Math.max(0.68, 1 - l));
    }
  }
  if (textCache.size > 512) textCache.clear();
  textCache.set(fc, out);
  return out;
}

/**
 * Colour of a cell border. Dark theme: near-black borders (Excel's
 * Automatic, the usual thin black grid of a table) become light.
 */
export function resolveBorderColor(
  source: { theme?: ThemeName | null } | ThemeName | null | undefined,
  color?: string | null
): string {
  const theme = getCanvasTheme(source);
  if (!color) return theme.borderAutomatic;
  if (theme === canvasThemes.light) return color;
  const lum = luminance(color);
  return lum !== undefined && lum < NEAR_BLACK ? theme.borderAutomatic : color;
}
