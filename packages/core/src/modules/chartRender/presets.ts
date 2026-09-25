/**
 * Chart colour palettes and chart styles (Excel's "Change Colors" and
 * "Chart Styles" galleries). Palettes are lists of series colours; styles
 * are visual presets resolved per theme, so every style also looks right on
 * the dark canvas theme.
 */
import { chartPaletteColor } from "./types";
import type { ChartStyleSpec, ChartTheme } from "./types";

export type ChartPalette = {
  id: string;
  /** Colourful palettes cycle accents; monochromatic ones shade one hue. */
  kind: "colorful" | "monochromatic";
  colors: string[];
};

export const CHART_PALETTES: ChartPalette[] = [
  {
    id: "colorful1",
    kind: "colorful",
    colors: ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"],
  },
  {
    id: "colorful2",
    kind: "colorful",
    colors: ["#ED7D31", "#FFC000", "#70AD47", "#9E480E", "#997300", "#43682B"],
  },
  {
    id: "colorful3",
    kind: "colorful",
    colors: ["#A5A5A5", "#5B9BD5", "#264478", "#636363", "#255E91", "#698ED0"],
  },
  {
    id: "colorful4",
    kind: "colorful",
    colors: ["#70AD47", "#264478", "#9E480E", "#636363", "#997300", "#255E91"],
  },
  {
    id: "monochrome1",
    kind: "monochromatic",
    colors: ["#4472C4", "#264478", "#698ED0", "#335AA1", "#8FAADC", "#1F3864"],
  },
  {
    id: "monochrome2",
    kind: "monochromatic",
    colors: ["#ED7D31", "#9E480E", "#F1975A", "#C55A11", "#F4B183", "#843C0C"],
  },
  {
    id: "monochrome3",
    kind: "monochromatic",
    colors: ["#A5A5A5", "#636363", "#C9C9C9", "#7F7F7F", "#DBDBDB", "#3A3A3A"],
  },
  {
    id: "monochrome4",
    kind: "monochromatic",
    colors: ["#FFC000", "#997300", "#FFD966", "#BF9000", "#FFE699", "#7F6000"],
  },
  {
    id: "monochrome5",
    kind: "monochromatic",
    colors: ["#5B9BD5", "#255E91", "#9DC3E6", "#2E75B6", "#BDD7EE", "#1F4E79"],
  },
  {
    id: "monochrome6",
    kind: "monochromatic",
    colors: ["#70AD47", "#43682B", "#A9D18E", "#548235", "#C5E0B4", "#375623"],
  },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour. */
export function shadeColor(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const out = rgb.map((c) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${out
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function getChartPalette(id: string | undefined): ChartPalette {
  return CHART_PALETTES.find((p) => p.id === id) ?? CHART_PALETTES[0];
}

/**
 * Colour `index` of a palette: the base colours, then darker and lighter
 * variants of them (as Excel does after the sixth series).
 */
export function paletteColor(paletteId: string | undefined, index: number) {
  const palette = getChartPalette(paletteId);
  if (palette.id === "colorful1") return chartPaletteColor(index);
  const { colors } = palette;
  const i = Math.max(0, Math.floor(index));
  const base = colors[i % colors.length];
  const cycle = Math.floor(i / colors.length) % 3;
  if (cycle === 1) return shadeColor(base, -0.4);
  if (cycle === 2) return shadeColor(base, 0.4);
  return base;
}

export type ChartStylePreset = {
  id: number;
  /** Visual spec for a theme ("light" / "dark"). */
  spec: (theme: "light" | "dark") => ChartStyleSpec;
  /** Chrome colour overrides for a theme. */
  theme?: (theme: "light" | "dark") => Partial<ChartTheme>;
  /** Chart options the style switches on or off when applied. */
  flags?: {
    gridlines?: boolean;
    dataLabels?: boolean;
    legend?: "right" | "bottom" | "top" | "none";
  };
};

export const CHART_STYLES: ChartStylePreset[] = [
  { id: 1, spec: () => ({}), flags: { gridlines: true, dataLabels: false } },
  {
    id: 2,
    spec: () => ({ gapWidth: 0.8 }),
    flags: { gridlines: false, dataLabels: true, legend: "bottom" },
  },
  {
    id: 3,
    spec: (t) => ({
      seriesOutline: t === "dark" ? "#1e1f22" : "#ffffff",
      seriesOutlineWidth: 1.5,
      gapWidth: 0.5,
    }),
    flags: { gridlines: true, dataLabels: false },
  },
  {
    id: 4,
    spec: () => ({ fillOpacity: 0.7, gridDash: true, lineWidth: 3 }),
    flags: { gridlines: true, dataLabels: false },
  },
  {
    id: 5,
    spec: (t) => ({
      plotFill: t === "dark" ? "#2a2b2f" : "#f2f2f2",
      titleBold: true,
    }),
    theme: (t) =>
      t === "dark" ? { gridline: "#46494e" } : { gridline: "#ffffff" },
    flags: { gridlines: true, dataLabels: false },
  },
  {
    id: 6,
    spec: (t) => ({
      seriesOutline: t === "dark" ? "#111214" : "#404040",
      titleBold: true,
    }),
    theme: (t) =>
      t === "dark"
        ? {
            background: "#111214",
            border: "#2c2e33",
            gridline: "#2c2e33",
            sliceSeparator: "#111214",
          }
        : {
            background: "#404040",
            border: "#404040",
            text: "#ffffff",
            mutedText: "#d9d9d9",
            gridline: "#595959",
            axisLine: "#7f7f7f",
            sliceSeparator: "#404040",
          },
    flags: { gridlines: true, dataLabels: false },
  },
  {
    id: 7,
    spec: () => ({
      titleBold: true,
      lineWidth: 3.5,
      markerSize: 5,
      gapWidth: 0.6,
      barRadius: 2,
    }),
    flags: { gridlines: true, dataLabels: false, legend: "top" },
  },
  {
    id: 8,
    spec: () => ({ lineWidth: 1.5, markerSize: 2.5, gapWidth: 1 }),
    flags: { gridlines: false, dataLabels: false, legend: "bottom" },
  },
];

export function getChartStyle(id: number | undefined) {
  return CHART_STYLES.find((s) => s.id === id) ?? CHART_STYLES[0];
}
