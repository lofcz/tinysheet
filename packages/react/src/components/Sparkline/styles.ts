import type { SparklineColors } from "@lofcz/tinysheet-core";

/**
 * The style gallery: colour sets like Excel's sparkline styles, built from
 * the Office accent colours (dark, medium and light variants per accent)
 * plus two monochrome styles.
 */
const ACCENTS = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];

function channel(hex: string, i: number) {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

/** Excel's tint/shade: t < 0 darkens by |t|, t > 0 lightens by t. */
export function tintColor(hex: string, t: number) {
  const out = [0, 1, 2].map((i) => {
    const c = channel(hex, i);
    const v = t < 0 ? c * (1 + t) : c + (255 - c) * t;
    return Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`.toUpperCase();
}

export type SparklineStyle = Omit<SparklineColors, "axis">;

function accentStyle(accent: string, next: string, variant: number) {
  if (variant === 0) {
    return {
      series: tintColor(accent, -0.5),
      negative: next,
      markers: tintColor(accent, -0.5),
      first: tintColor(accent, 0.4),
      last: tintColor(accent, 0.4),
      high: accent,
      low: accent,
    };
  }
  if (variant === 1) {
    return {
      series: accent,
      negative: tintColor(next, -0.25),
      markers: tintColor(accent, -0.25),
      first: tintColor(accent, -0.5),
      last: tintColor(accent, -0.5),
      high: tintColor(accent, -0.5),
      low: tintColor(accent, -0.5),
    };
  }
  return {
    series: tintColor(accent, -0.25),
    negative: tintColor(next, 0.4),
    markers: tintColor(accent, -0.25),
    first: accent,
    last: accent,
    high: tintColor(accent, 0.4),
    low: tintColor(accent, 0.4),
  };
}

export const SPARKLINE_STYLES: SparklineStyle[] = (() => {
  const out: SparklineStyle[] = [];
  [0, 1, 2].forEach((variant) => {
    ACCENTS.forEach((accent, i) => {
      out.push(accentStyle(accent, ACCENTS[(i + 1) % ACCENTS.length], variant));
    });
  });
  out.push({
    series: "#000000",
    negative: "#C00000",
    markers: "#000000",
    first: "#7F7F7F",
    last: "#7F7F7F",
    high: "#404040",
    low: "#404040",
  });
  out.push({
    series: "#7F7F7F",
    negative: "#FF0000",
    markers: "#404040",
    first: "#404040",
    last: "#404040",
    high: "#000000",
    low: "#000000",
  });
  return out;
})();
