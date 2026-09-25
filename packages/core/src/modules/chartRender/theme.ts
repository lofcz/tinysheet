import type { ChartTheme } from "./types";

const FONT = "Calibri, Arial, sans-serif";

/**
 * Chart chrome palettes. The light palette matches Excel's default chart
 * style; the dark palette matches the dark canvas theme (`canvasThemes.dark`)
 * so a chart sits on the sheet without a white slab.
 */
export const chartThemes: Record<"light" | "dark", ChartTheme> = {
  light: {
    background: "#ffffff",
    border: "#d9d9d9",
    text: "#404040",
    mutedText: "#595959",
    gridline: "#d9d9d9",
    axisLine: "#bfbfbf",
    sliceSeparator: "#ffffff",
    fontFamily: FONT,
  },
  dark: {
    background: "#1e1f22",
    border: "#3c4043",
    text: "#e3e3e3",
    mutedText: "#bdc1c6",
    gridline: "#3c4043",
    axisLine: "#5f6368",
    sliceSeparator: "#1e1f22",
    fontFamily: FONT,
  },
};

export function getChartTheme(
  name: string | null | undefined,
  overrides?: Partial<ChartTheme>
): ChartTheme {
  const base = name === "dark" ? chartThemes.dark : chartThemes.light;
  return overrides ? { ...base, ...overrides } : base;
}
