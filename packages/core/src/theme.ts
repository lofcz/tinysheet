/**
 * Theme definitions shared by the canvas renderer and the React UI.
 *
 * The React UI is themed through CSS custom properties declared on
 * `.fortune-container` (see `react/src/components/Workbook/index.css`); the
 * `data-theme` attribute on that element switches between palettes. The canvas
 * cannot read CSS variables cheaply on every frame, so its default colours
 * live here and are looked up from `ctx.theme`.
 *
 * Cell-level colours (`fc`, `bg`, borders, conditional formats) always render
 * as specified; only the defaults used when a cell has no colour of its own
 * come from the theme.
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
  /** Grid lines and header separators. */
  gridLine: string;
  /** Row / column header background. */
  headerBackground: string;
  /** Row / column header labels. */
  headerText: string;
  /** Frozen-pane divider. */
  freezeLine: string;
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
    gridLine: "#e1e1e1",
    headerBackground: "#f8f9fa",
    headerText: "#5f6368",
    freezeLine: "#c4c7cc",
    commentMarker: "#fc6666",
    numberAsTextMarker: "#487f1e",
    checkboxStroke: "#000000",
  },
  dark: {
    cellBackground: "#1e1f22",
    cellText: "#e3e3e3",
    gridLine: "#34363a",
    headerBackground: "#26272b",
    headerText: "#9aa0a6",
    freezeLine: "#5f6368",
    commentMarker: "#f28b82",
    numberAsTextMarker: "#81c995",
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

/** Relative luminance (0–1) of a `#rgb` / `#rrggbb` / `rgb()` colour. */
function luminance(color: string): number | undefined {
  let r: number;
  let g: number;
  let b: number;
  const hex = color.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    [r, g, b] = [1, 2, 3].map((i) => parseInt(hex[i] + hex[i], 16));
  } else if (/^#[0-9a-f]{6}/.test(hex)) {
    [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  } else {
    const m = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return undefined;
    [r, g, b] = [m[1], m[2], m[3]].map(Number);
  }
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Luminance below which a font colour counts as "near black". Covers pure
 * black (Excel's Automatic) and the `rgb(51, 51, 51)` Luckysheet default.
 */
const NEAR_BLACK = 0.05;

/** Fill luminance above which a cell background counts as light. */
const LIGHT_FILL = 0.4;

/**
 * Text colour for a cell. `fc` is the cell's font colour (possibly the
 * `#000000` default filled in by `normalizedCellAttr`), `bg` its fill.
 *
 * Light theme: `fc` unchanged (black when unset), i.e. exactly the historic
 * behaviour.
 *
 * Dark theme, following how Excel's dark mode treats "Automatic" text:
 * - on a light cell fill, `fc` is kept (black when unset) so it stays legible;
 * - otherwise unset or near-black text, which would vanish on the dark sheet,
 *   becomes the theme text colour;
 * - every other explicit colour is kept.
 */
export function resolveCellTextColor(
  source: { theme?: ThemeName | null } | ThemeName | null | undefined,
  fc?: string | null,
  bg?: string | null
): string {
  const theme = getCanvasTheme(source);
  if (theme === canvasThemes.light) return fc || theme.cellText;
  const fillLum = bg ? luminance(bg) : undefined;
  if (fillLum !== undefined && fillLum > LIGHT_FILL) return fc || "#000000";
  if (!fc) return theme.cellText;
  const textLum = luminance(fc);
  if (fc.trim().toLowerCase() === "black") return theme.cellText;
  if (textLum !== undefined && textLum < NEAR_BLACK) return theme.cellText;
  return fc;
}
