/**
 * Series overlays: trendlines (with equation / R² labels), error bars and
 * data-label placement.
 */
import { computeErrorAmounts, fitTrendline } from "./stats";
import { escapeXml, finite, LABEL_SIZE, line, n, Rect, svgText } from "./svg";
import type {
  ChartDataLabelPosition,
  ChartRenderSeries,
  ChartTheme,
  ChartTrendline,
} from "./types";

export type TrendContext = {
  plot: Rect;
  theme: ChartTheme;
  /** Equation / R² texts, drawn stacked in the plot's top-right corner. */
  notes: string[];
};

const SAMPLES = 80;

function inside(plot: Rect, x: number, y: number) {
  return (
    x >= plot.x - 0.5 &&
    x <= plot.x + plot.width + 0.5 &&
    y >= plot.y - 0.5 &&
    y <= plot.y + plot.height + 0.5
  );
}

/**
 * Draw every trendline of a series. `xs` / `ys` are the regression inputs
 * (category charts use 1-based category numbers as x) and `toPixel` maps a
 * data point to the plot.
 */
export function drawTrendlines(
  out: string[],
  series: ChartRenderSeries,
  xs: (number | null)[],
  ys: (number | null)[],
  toPixel: (x: number, y: number) => [number, number],
  tc: TrendContext
) {
  const trends = series.trendlines;
  if (!trends?.length) return;
  let xmin = Infinity;
  let xmax = -Infinity;
  xs.forEach((x, i) => {
    if (finite(x) && finite(ys[i])) {
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
    }
  });
  if (!Number.isFinite(xmin)) return;
  trends.forEach((trend) => {
    const fit = fitTrendline(trend, xs, ys);
    if (!fit) return;
    const color = trend.color || series.color;
    const attrs = ` fill="none" stroke="${escapeXml(
      color
    )}" stroke-width="1.75" stroke-dasharray="2 3" stroke-linecap="round"`;
    let d = "";
    if (fit.points) {
      fit.points.forEach(([x, y], i) => {
        const [px, py] = toPixel(x, y);
        d += `${i ? "L" : "M"}${n(px)} ${n(py)} `;
      });
    } else {
      const from = xmin - Math.max(0, trend.backward ?? 0);
      const to = xmax + Math.max(0, trend.forward ?? 0);
      let pen = false;
      for (let k = 0; k <= SAMPLES; k += 1) {
        const x = from + ((to - from) * k) / SAMPLES;
        const y = fit.predict(x);
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        const [px, py] = toPixel(x, y);
        if (!inside(tc.plot, px, py)) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${n(px)} ${n(py)} `;
        pen = true;
      }
    }
    if (d) out.push(`<path d="${d.trim()}"${attrs}/>`);
    const texts: string[] = [];
    if (trend.displayEquation && fit.equation) texts.push(fit.equation);
    if (trend.displayRSquared && fit.rSquared != null)
      texts.push(`R² = ${fit.rSquared.toFixed(4)}`);
    if (texts.length) tc.notes.push(texts.join("   "));
  });
}

/** Draw the stacked equation / R² notes. */
export function drawTrendNotes(out: string[], tc: TrendContext) {
  tc.notes.forEach((text, i) => {
    out.push(
      svgText(
        tc.plot.x + tc.plot.width - 4,
        tc.plot.y + LABEL_SIZE + 2 + i * (LABEL_SIZE + 4),
        text,
        {
          size: LABEL_SIZE,
          fill: tc.theme.text,
          anchor: "end",
          family: tc.theme.fontFamily,
        }
      )
    );
  });
}

/**
 * Error bars of a series along the value axis. `at(i)` gives the category
 * pixel of point i (null to skip) and `vPos` maps a value to a pixel.
 */
export function drawErrorBars(
  out: string[],
  series: ChartRenderSeries,
  values: (number | null)[],
  at: (i: number) => number | null,
  vPos: (v: number) => number,
  horizontal: boolean,
  theme: ChartTheme
) {
  const bars = series.errorBars;
  if (!bars) return;
  const amounts = computeErrorAmounts(bars, values);
  const color = bars.color || theme.text;
  const cap = bars.endCap !== false ? 3.5 : 0;
  amounts.forEach((a, i) => {
    if (!a || (a.plus === 0 && a.minus === 0)) return;
    const c = at(i);
    if (c == null) return;
    const lo = vPos(a.center - a.minus);
    const hi = vPos(a.center + a.plus);
    if (horizontal) {
      out.push(line(lo, c, hi, c, color, 1));
      if (cap) {
        if (a.minus) out.push(line(lo, c - cap, lo, c + cap, color, 1));
        if (a.plus) out.push(line(hi, c - cap, hi, c + cap, color, 1));
      }
    } else {
      out.push(line(c, lo, c, hi, color, 1));
      if (cap) {
        if (a.minus) out.push(line(c - cap, lo, c + cap, lo, color, 1));
        if (a.plus) out.push(line(c - cap, hi, c + cap, hi, color, 1));
      }
    }
  });
}

export type LabelPlace = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline?: string;
  /** The label sits on the mark (use a contrasting colour). */
  inside: boolean;
};

/** Data label position for a bar. */
export function barLabelPlace(
  r: Rect,
  horizontal: boolean,
  position: ChartDataLabelPosition | undefined,
  stacked: boolean,
  positive: boolean
): LabelPlace {
  let pos = position ?? "auto";
  if (pos === "auto" || pos === "bestFit")
    pos = stacked ? "center" : "outsideEnd";
  if (!["center", "insideEnd", "insideBase", "outsideEnd"].includes(pos))
    pos = "outsideEnd";
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  if (pos === "center")
    return {
      x: cx,
      y: cy,
      anchor: "middle",
      baseline: "central",
      inside: true,
    };
  if (horizontal) {
    const endX = positive ? r.x + r.width : r.x;
    const baseX = positive ? r.x : r.x + r.width;
    const dir = positive ? 1 : -1;
    if (pos === "outsideEnd")
      return {
        x: endX + 3 * dir,
        y: cy,
        anchor: positive ? "start" : "end",
        baseline: "central",
        inside: false,
      };
    const x = pos === "insideEnd" ? endX - 3 * dir : baseX + 3 * dir;
    const anchorEnd = (pos === "insideEnd") === positive;
    return {
      x,
      y: cy,
      anchor: anchorEnd ? "end" : "start",
      baseline: "central",
      inside: true,
    };
  }
  const endY = positive ? r.y : r.y + r.height;
  const baseY = positive ? r.y + r.height : r.y;
  if (pos === "outsideEnd")
    return positive
      ? { x: cx, y: endY - 3, anchor: "middle", inside: false }
      : { x: cx, y: endY + LABEL_SIZE, anchor: "middle", inside: false };
  if (pos === "insideEnd")
    return positive
      ? { x: cx, y: endY + LABEL_SIZE + 2, anchor: "middle", inside: true }
      : { x: cx, y: endY - 3, anchor: "middle", inside: true };
  return positive
    ? { x: cx, y: baseY - 3, anchor: "middle", inside: true }
    : { x: cx, y: baseY + LABEL_SIZE + 2, anchor: "middle", inside: true };
}

/** Data label position for a point (line, scatter, bubble, radar). */
export function pointLabelPlace(
  x: number,
  y: number,
  position: ChartDataLabelPosition | undefined,
  offset = 7
): LabelPlace {
  switch (position) {
    case "center":
      return { x, y, anchor: "middle", baseline: "central", inside: true };
    case "left":
      return {
        x: x - offset,
        y,
        anchor: "end",
        baseline: "central",
        inside: false,
      };
    case "right":
      return {
        x: x + offset,
        y,
        anchor: "start",
        baseline: "central",
        inside: false,
      };
    case "below":
      return {
        x,
        y: y + offset + LABEL_SIZE - 2,
        anchor: "middle",
        inside: false,
      };
    default:
      return { x, y: y - offset, anchor: "middle", inside: false };
  }
}

export function trendlineTypeLabel(t: ChartTrendline) {
  switch (t.type) {
    case "exponential":
      return "Expon.";
    case "logarithmic":
      return "Log.";
    case "polynomial":
      return "Poly.";
    case "power":
      return "Power";
    case "movingAverage":
      return `${Math.max(2, Math.round(t.period ?? 2))} per. Mov. Avg.`;
    default:
      return "Linear";
  }
}
