/**
 * Axes frames shared by the category charts (column, bar, line, area,
 * combo, waterfall, histogram, Pareto, stock) and the XY charts (scatter,
 * bubble): plot-area layout, gridlines, tick labels, axis titles and the
 * value → pixel mappings.
 */
import { computeAxisScale, formatAxisTick, AxisScale } from "./axis";
import {
  AXIS_TITLE_SIZE,
  estimateTextWidth,
  LABEL_SIZE,
  line,
  rect,
  Rect,
  svgText,
  truncateText,
} from "./svg";
import type {
  ChartFormats,
  ChartStyleSpec,
  ChartTheme,
  ChartValueAxisOptions,
} from "./types";

export type ValueAxis = {
  scale: AxisScale;
  format: (v: number) => string;
};

/** Value axis from data extents; `percent` gives Excel's 0–100% axis. */
export function makeValueAxis(
  min: number,
  max: number,
  options?: ChartValueAxisOptions,
  percent = false
): ValueAxis {
  if (percent) {
    const lo = min < -1e-9 ? -1 : 0;
    const hi = max > 1e-9 || lo === 0 ? 1 : 0;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += 0.1) {
      ticks.push(Math.round(v * 10) / 10);
    }
    return {
      scale: { min: lo, max: hi, step: 0.1, ticks },
      format: (v) => `${Math.round(v * 100)}%`,
    };
  }
  const scale = computeAxisScale(
    Number.isFinite(min) ? min : 0,
    Number.isFinite(max) ? max : 1,
    options
  );
  return { scale, format: (v) => formatAxisTick(v, scale.step) };
}

export function pushAxisTitles(
  out: string[],
  area: Rect,
  plot: Rect,
  theme: ChartTheme,
  leftTitle: string,
  bottomTitle: string,
  rightTitle = "",
  formats?: ChartFormats,
  horizontal = false
) {
  const family = theme.fontFamily;
  const leftKey = horizontal ? "categoryAxisTitle" : "valueAxisTitle";
  const bottomKey = horizontal ? "valueAxisTitle" : "categoryAxisTitle";
  const fill = (key: "categoryAxisTitle" | "valueAxisTitle") =>
    formats?.[key]?.text ?? theme.mutedText;
  if (leftTitle) {
    const x = area.x + AXIS_TITLE_SIZE / 2 + 2;
    const y = plot.y + plot.height / 2;
    out.push(
      tagged(leftKey, [
        svgText(x, y, truncateText(leftTitle, plot.height, AXIS_TITLE_SIZE), {
          size: AXIS_TITLE_SIZE,
          fill: fill(leftKey),
          anchor: "middle",
          baseline: "central",
          weight: "600",
          rotate: -90,
          family,
        }),
      ])
    );
  }
  if (rightTitle) {
    const x = area.x + area.width - AXIS_TITLE_SIZE / 2 - 2;
    const y = plot.y + plot.height / 2;
    out.push(
      svgText(x, y, truncateText(rightTitle, plot.height, AXIS_TITLE_SIZE), {
        size: AXIS_TITLE_SIZE,
        fill: theme.mutedText,
        anchor: "middle",
        baseline: "central",
        weight: "600",
        rotate: 90,
        family,
      })
    );
  }
  if (bottomTitle) {
    out.push(
      tagged(bottomKey, [
        svgText(
          plot.x + plot.width / 2,
          area.y + area.height - 3,
          truncateText(bottomTitle, plot.width, AXIS_TITLE_SIZE),
          {
            size: AXIS_TITLE_SIZE,
            fill: fill(bottomKey),
            anchor: "middle",
            weight: "600",
            family,
          }
        ),
      ])
    );
  }
}

export type CategoryFrame = {
  plot: Rect;
  count: number;
  /** Size of one category band along the category axis. */
  band: number;
  horizontal: boolean;
  /** Start of band `i` (bar charts list the first category at the bottom). */
  bandStart: (i: number) => number;
  /** Pixel of a (fractional, 0-based) category position's centre. */
  catCoord: (i: number) => number;
  /** Value → pixel along the value axis. */
  vPos: (v: number, secondary?: boolean) => number;
  /** The value where bars start (0 clamped into the axis). */
  baseline: (secondary?: boolean) => number;
  /** (category pixel, value pixel) → (x, y). */
  point: (cat: number, val: number) => [number, number];
  /** Behind the marks: plot fill, gridlines. */
  pre: string[];
  /** Above the marks: axis lines, tick labels, titles. */
  post: string[];
};

export type CategoryFrameOptions = {
  count: number;
  labels: string[];
  primary: ValueAxis;
  secondary?: ValueAxis;
  horizontal?: boolean;
  /** Area charts: first and last category on the plot edges. */
  edgeToEdge?: boolean;
  categoryTitle?: string;
  valueTitle?: string;
  secondaryTitle?: string;
  gridlines?: boolean;
  style?: ChartStyleSpec;
  /** Hide the value axis labels (funnel-like charts). */
  hideValueAxis?: boolean;
  /** Hide the category axis (line and labels). */
  hideCategoryAxis?: boolean;
  /** Major gridlines of the category axis. */
  categoryGridlines?: boolean;
  minorGridlines?: boolean;
  minorCategoryGridlines?: boolean;
  formats?: ChartFormats;
  /** Room kept under the plot (a data table) instead of category labels. */
  bottomReserve?: number;
  /** Minimum room left of the plot (the data table's series names). */
  minLeft?: number;
};

/** A group of elements that can be picked in the sheet. */
export function tagged(el: string, parts: string[], extra = "") {
  const body = parts.join("");
  return body ? `<g data-chart-el="${el}"${extra}>${body}</g>` : "";
}

/** The outer shadow of Shape Effects (defined once per chart SVG). */
export const SHADOW_ATTR = ' filter="url(#ts-chart-shadow)"';
export const SHADOW_DEFS =
  '<defs><filter id="ts-chart-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.5" dy="2" stdDeviation="1.6" flood-opacity="0.35"/></filter></defs>';

/** The transparent hit area of the plot, with its fill / outline. */
export function plotAreaRect(
  plot: Rect,
  style: ChartStyleSpec | undefined,
  formats: ChartFormats | undefined
) {
  const f = formats?.plotArea;
  let fill = style?.plotFill ?? "transparent";
  if (f?.fill !== undefined) fill = f.fill ?? "transparent";
  const stroke = f?.line
    ? ` stroke="${f.line}" stroke-width="${f.lineWidth ?? 1}"`
    : "";
  return rect(
    plot,
    fill,
    `${stroke}${f?.shadow ? SHADOW_ATTR : ""} data-chart-el="plotArea"`
  );
}

/** Muted text colour of an axis (its Text Fill when formatted). */
function axisText(
  theme: ChartTheme,
  formats: ChartFormats | undefined,
  key: "categoryAxis" | "valueAxis"
) {
  return formats?.[key]?.text ?? theme.mutedText;
}

export function layoutCategoryFrame(
  area: Rect,
  theme: ChartTheme,
  o: CategoryFrameOptions
): CategoryFrame {
  const horizontal = !!o.horizontal;
  const family = theme.fontFamily;
  const { count } = o;
  const pScale = o.primary.scale;
  const valueLabels = pScale.ticks.map((t) => o.primary.format(t));
  const valueLabelW = o.hideValueAxis
    ? 0
    : Math.max(...valueLabels.map((l) => estimateTextWidth(l, LABEL_SIZE)), 8);
  const sScale = o.secondary?.scale;
  const secondaryLabels = sScale
    ? sScale.ticks.map((t) => o.secondary!.format(t))
    : [];
  const secondaryLabelW = sScale
    ? Math.max(
        ...secondaryLabels.map((l) => estimateTextWidth(l, LABEL_SIZE)),
        8
      )
    : 0;

  const catTitle = o.categoryTitle?.trim() || "";
  const valTitle = o.valueTitle?.trim() || "";
  const secTitle = sScale ? o.secondaryTitle?.trim() || "" : "";
  const leftTitle = horizontal ? catTitle : valTitle;
  const bottomTitle = horizontal ? valTitle : catTitle;

  const hideCat = !!o.hideCategoryAxis;
  const catLabelsShown = !hideCat && !o.bottomReserve;
  let leftLabelW: number;
  if (horizontal) {
    const maxCat = Math.max(
      ...o.labels.map((l) => estimateTextWidth(l, LABEL_SIZE)),
      8
    );
    leftLabelW = hideCat ? 0 : Math.min(maxCat, area.width * 0.3);
  } else {
    leftLabelW = valueLabelW;
  }
  const leftTitleW = leftTitle ? AXIS_TITLE_SIZE + 8 : 0;
  const rightTitleW = secTitle ? AXIS_TITLE_SIZE + 8 : 0;
  const bottomTitleH = bottomTitle ? AXIS_TITLE_SIZE + 8 : 0;
  let bottomLabelH = LABEL_SIZE + 8;
  if (o.bottomReserve) bottomLabelH = o.bottomReserve;
  else if (!horizontal && hideCat) bottomLabelH = 6;
  else if (horizontal && o.hideValueAxis) bottomLabelH = 6;

  const plot: Rect = {
    x: Math.max(
      area.x + leftTitleW + leftLabelW + 6,
      area.x + (o.minLeft ?? 0)
    ),
    y: area.y + 6,
    width: 0,
    height: 0,
  };
  let rightPad = horizontal ? valueLabelW / 2 : 6;
  if (sScale) rightPad = secondaryLabelW + 8 + rightTitleW;
  plot.width = Math.max(10, area.x + area.width - rightPad - plot.x);
  plot.height = Math.max(
    10,
    area.y + area.height - bottomTitleH - bottomLabelH - plot.y
  );

  const scaleFor = (secondary?: boolean) =>
    secondary && sScale ? sScale : pScale;
  const vPos = (v: number, secondary?: boolean) => {
    const s = scaleFor(secondary);
    const span = s.max - s.min || 1;
    const c = Math.min(s.max, Math.max(s.min, v));
    return horizontal
      ? plot.x + ((c - s.min) / span) * plot.width
      : plot.y + plot.height - ((c - s.min) / span) * plot.height;
  };
  const baseline = (secondary?: boolean) => {
    const s = scaleFor(secondary);
    return Math.min(s.max, Math.max(s.min, 0));
  };
  const catSpan = horizontal ? plot.height : plot.width;
  const band = catSpan / Math.max(1, count);
  const bandStart = (i: number) =>
    horizontal ? plot.y + plot.height - (i + 1) * band : plot.x + i * band;
  const edge = !!o.edgeToEdge && count > 1;
  const catCoord = (i: number) => {
    if (edge) return plot.x + (i * plot.width) / (count - 1);
    if (!o.edgeToEdge || count > 1) return bandStart(i) + band / 2;
    return plot.x + plot.width / 2;
  };
  const point = (cat: number, val: number): [number, number] =>
    horizontal ? [val, cat] : [cat, val];

  const pre: string[] = [];
  const post: string[] = [];
  pre.push(plotAreaRect(plot, o.style, o.formats));
  const dash = o.style?.gridDash ? ' stroke-dasharray="3 3"' : "";
  const gridColor = o.formats?.majorGridlines?.line ?? theme.gridline;
  const grid: string[] = [];
  const minor: string[] = [];
  const valueText: string[] = [];
  const catText: string[] = [];
  const valueFill = axisText(theme, o.formats, "valueAxis");
  const catFill = axisText(theme, o.formats, "categoryAxis");

  // Gridlines (major, minor) and value-axis labels
  const valueLine = (p: number, color: string, into: string[]) =>
    into.push(
      horizontal
        ? line(p, plot.y, p, plot.y + plot.height, color, 1, dash)
        : line(plot.x, p, plot.x + plot.width, p, color, 1, dash)
    );
  pScale.ticks.forEach((t, i) => {
    if (t < pScale.min - 1e-9 || t > pScale.max + 1e-9) return;
    const p = vPos(t);
    if (o.gridlines !== false) valueLine(p, gridColor, grid);
    if (o.minorGridlines) {
      const half = t + pScale.step / 2;
      if (half < pScale.max - 1e-9) valueLine(vPos(half), gridColor, minor);
    }
    if (o.hideValueAxis) return;
    valueText.push(
      horizontal
        ? svgText(p, plot.y + plot.height + LABEL_SIZE + 4, valueLabels[i], {
            size: LABEL_SIZE,
            fill: valueFill,
            anchor: "middle",
            family,
          })
        : svgText(plot.x - 5, p, valueLabels[i], {
            size: LABEL_SIZE,
            fill: valueFill,
            anchor: "end",
            baseline: "central",
            family,
          })
    );
  });
  if (o.categoryGridlines || o.minorCategoryGridlines) {
    for (let i = 0; i <= count; i += 1) {
      const at = horizontal
        ? plot.y + plot.height - i * band
        : plot.x + i * band;
      const major = (edge: number) =>
        horizontal
          ? line(plot.x, edge, plot.x + plot.width, edge, gridColor, 1, dash)
          : line(edge, plot.y, edge, plot.y + plot.height, gridColor, 1, dash);
      if (o.categoryGridlines && i > 0) grid.push(major(at));
      if (o.minorCategoryGridlines && i < count)
        minor.push(major(at + (horizontal ? -band / 2 : band / 2)));
    }
  }
  pre.push(tagged("minorGridlines", minor));
  pre.push(tagged("majorGridlines", grid));
  if (sScale) {
    sScale.ticks.forEach((t, i) => {
      if (t < sScale.min - 1e-9 || t > sScale.max + 1e-9) return;
      valueText.push(
        svgText(plot.x + plot.width + 5, vPos(t, true), secondaryLabels[i], {
          size: LABEL_SIZE,
          fill: valueFill,
          anchor: "start",
          baseline: "central",
          family,
        })
      );
    });
  }

  // Axis line: the category axis crosses at zero.
  const base = vPos(baseline());
  const axisColor = o.formats?.categoryAxis?.line ?? theme.axisLine;
  if (!hideCat) {
    catText.push(
      horizontal
        ? line(base, plot.y, base, plot.y + plot.height, axisColor)
        : line(plot.x, base, plot.x + plot.width, base, axisColor)
    );
  }

  // Category labels
  if (count > 0 && catLabelsShown) {
    const maxLabel = horizontal ? leftLabelW : band - 2;
    const needed = Math.max(
      ...o.labels.map((l) => estimateTextWidth(l, LABEL_SIZE)),
      0
    );
    const every = horizontal
      ? Math.max(1, Math.ceil((LABEL_SIZE + 2) / Math.max(1, band)))
      : Math.max(1, Math.ceil(Math.min(needed, 80) / Math.max(1, band - 2)));
    for (let i = 0; i < count; i += every) {
      const label = truncateText(
        o.labels[i] ?? "",
        horizontal ? maxLabel : Math.max(maxLabel * every, 20),
        LABEL_SIZE
      );
      if (horizontal) {
        catText.push(
          svgText(plot.x - 5, bandStart(i) + band / 2, label, {
            size: LABEL_SIZE,
            fill: catFill,
            anchor: "end",
            baseline: "central",
            family,
          })
        );
      } else {
        catText.push(
          svgText(catCoord(i), plot.y + plot.height + LABEL_SIZE + 4, label, {
            size: LABEL_SIZE,
            fill: catFill,
            anchor: "middle",
            family,
          })
        );
      }
    }
  }
  post.push(tagged("valueAxis", valueText));
  post.push(tagged("categoryAxis", catText));

  pushAxisTitles(
    post,
    area,
    plot,
    theme,
    leftTitle,
    bottomTitle,
    secTitle,
    o.formats,
    horizontal
  );

  return {
    plot,
    count,
    band,
    horizontal,
    bandStart,
    catCoord,
    vPos,
    baseline,
    point,
    pre,
    post,
  };
}

export type XYFrame = {
  plot: Rect;
  xPos: (x: number) => number;
  yPos: (y: number) => number;
  pre: string[];
  post: string[];
};

/** Scatter / bubble frame: value axes on both sides. */
export function layoutXYFrame(
  area: Rect,
  theme: ChartTheme,
  o: {
    x: ValueAxis;
    y: ValueAxis;
    xTitle?: string;
    yTitle?: string;
    gridlines?: boolean;
    style?: ChartStyleSpec;
    /** Hide the X (horizontal) / Y (vertical) value axis. */
    hideXAxis?: boolean;
    hideYAxis?: boolean;
    /** Vertical gridlines at the X ticks. */
    xGridlines?: boolean;
    minorGridlines?: boolean;
    minorXGridlines?: boolean;
    formats?: ChartFormats;
  }
): XYFrame {
  const family = theme.fontFamily;
  const yLabels = o.y.scale.ticks.map((t) => o.y.format(t));
  const xLabels = o.x.scale.ticks.map((t) => o.x.format(t));
  const yLabelW = o.hideYAxis
    ? 0
    : Math.max(...yLabels.map((l) => estimateTextWidth(l, LABEL_SIZE)), 8);
  const leftTitle = o.yTitle?.trim() || "";
  const bottomTitle = o.xTitle?.trim() || "";
  const leftTitleW = leftTitle ? AXIS_TITLE_SIZE + 8 : 0;
  const bottomTitleH = bottomTitle ? AXIS_TITLE_SIZE + 8 : 0;
  const plot: Rect = {
    x: area.x + leftTitleW + yLabelW + 6,
    y: area.y + 6,
    width: 0,
    height: 0,
  };
  plot.width = Math.max(
    10,
    area.x + area.width - Math.max(yLabelW / 2, 6) - plot.x
  );
  plot.height = Math.max(
    10,
    area.y +
      area.height -
      bottomTitleH -
      (o.hideXAxis ? 6 : LABEL_SIZE + 8) -
      plot.y
  );
  const xs = o.x.scale;
  const ys = o.y.scale;
  const xPos = (x: number) =>
    plot.x +
    ((Math.min(xs.max, Math.max(xs.min, x)) - xs.min) /
      (xs.max - xs.min || 1)) *
      plot.width;
  const yPos = (y: number) =>
    plot.y +
    plot.height -
    ((Math.min(ys.max, Math.max(ys.min, y)) - ys.min) /
      (ys.max - ys.min || 1)) *
      plot.height;
  const pre: string[] = [];
  const post: string[] = [];
  pre.push(plotAreaRect(plot, o.style, o.formats));
  const dash = o.style?.gridDash ? ' stroke-dasharray="3 3"' : "";
  const gridColor = o.formats?.majorGridlines?.line ?? theme.gridline;
  const grid: string[] = [];
  const minor: string[] = [];
  const yText: string[] = [];
  const xText: string[] = [];
  const yFill = axisText(theme, o.formats, "valueAxis");
  const xFill = axisText(theme, o.formats, "categoryAxis");
  ys.ticks.forEach((t, i) => {
    if (t < ys.min - 1e-9 || t > ys.max + 1e-9) return;
    const p = yPos(t);
    if (o.gridlines !== false)
      grid.push(line(plot.x, p, plot.x + plot.width, p, gridColor, 1, dash));
    if (o.minorGridlines && t + ys.step / 2 < ys.max - 1e-9) {
      const m = yPos(t + ys.step / 2);
      minor.push(line(plot.x, m, plot.x + plot.width, m, gridColor, 1, dash));
    }
    if (o.hideYAxis) return;
    yText.push(
      svgText(plot.x - 5, p, yLabels[i], {
        size: LABEL_SIZE,
        fill: yFill,
        anchor: "end",
        baseline: "central",
        family,
      })
    );
  });
  xs.ticks.forEach((t, i) => {
    if (t < xs.min - 1e-9 || t > xs.max + 1e-9) return;
    const p = xPos(t);
    if (o.xGridlines)
      grid.push(line(p, plot.y, p, plot.y + plot.height, gridColor, 1, dash));
    if (o.minorXGridlines && t + xs.step / 2 < xs.max - 1e-9) {
      const m = xPos(t + xs.step / 2);
      minor.push(line(m, plot.y, m, plot.y + plot.height, gridColor, 1, dash));
    }
    if (o.hideXAxis) return;
    xText.push(
      svgText(p, plot.y + plot.height + LABEL_SIZE + 4, xLabels[i], {
        size: LABEL_SIZE,
        fill: xFill,
        anchor: "middle",
        family,
      })
    );
  });
  pre.push(tagged("minorGridlines", minor));
  pre.push(tagged("majorGridlines", grid));
  const base = yPos(Math.min(ys.max, Math.max(ys.min, 0)));
  if (!o.hideXAxis)
    xText.push(
      line(
        plot.x,
        base,
        plot.x + plot.width,
        base,
        o.formats?.categoryAxis?.line ?? theme.axisLine
      )
    );
  post.push(tagged("valueAxis", yText));
  post.push(tagged("categoryAxis", xText));
  pushAxisTitles(
    post,
    area,
    plot,
    theme,
    leftTitle,
    bottomTitle,
    "",
    o.formats
  );
  return { plot, xPos, yPos, pre, post };
}
