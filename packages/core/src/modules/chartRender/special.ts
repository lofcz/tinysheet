/**
 * Renderers for the chart families with their own geometry: radar,
 * waterfall, histogram / Pareto, funnel and stock.
 */
import { layoutCategoryFrame, makeValueAxis } from "./frame";
import { barLabelPlace, pointLabelPlace } from "./marks";
import { computeHistogramBins } from "./stats";
import {
  categoryCount,
  categoryLabel,
  circle,
  dataLabelText,
  escapeXml,
  estimateTextWidth,
  fillExtra,
  finite,
  formatChartNumber,
  LABEL_SIZE,
  line,
  n,
  pointColor,
  rect,
  Rect,
  svgText,
  truncateText,
} from "./svg";
import type { ChartRenderModel, ChartRenderSeries, ChartTheme } from "./types";

const DEFAULT_ACCENTS: [string, string, string] = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
];

function accents(model: ChartRenderModel) {
  return model.waterfallColors ?? DEFAULT_ACCENTS;
}

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------

export function renderRadar(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const count = categoryCount(model);
  if (count < 1) return;
  const style = model.radarStyle ?? "marker";
  let min = Infinity;
  let max = -Infinity;
  model.series.forEach((s) =>
    s.values.forEach((v) => {
      if (finite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    })
  );
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const axis = makeValueAxis(
    min,
    max,
    model.valueAxis,
    false,
    model.axisFormats?.value
  );
  const { scale } = axis;
  const family = theme.fontFamily;
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) labels.push(categoryLabel(model, i));
  const labelW = Math.min(
    area.width * 0.25,
    Math.max(...labels.map((l) => estimateTextWidth(l, LABEL_SIZE)))
  );
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const R = Math.max(
    4,
    Math.min(area.width / 2 - labelW - 8, area.height / 2 - LABEL_SIZE - 6)
  );
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / count;
  const span = scale.max - scale.min || 1;
  const radius = (v: number) =>
    ((Math.min(scale.max, Math.max(scale.min, v)) - scale.min) / span) * R;
  const at = (i: number, v: number): [number, number] => [
    cx + radius(v) * Math.cos(angle(i)),
    cy + radius(v) * Math.sin(angle(i)),
  ];

  // web: gridline polygons, spokes, value labels on the first spoke
  if (model.gridlines !== false) {
    scale.ticks.forEach((t) => {
      if (t <= scale.min + 1e-9 || t > scale.max + 1e-9) return;
      const pts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const [x, y] = at(i, t);
        pts.push(`${n(x)},${n(y)}`);
      }
      out.push(
        `<polygon points="${pts.join(" ")}" fill="none" stroke="${escapeXml(
          theme.gridline
        )}" stroke-width="1"/>`
      );
    });
  }
  for (let i = 0; i < count; i += 1) {
    const [x, y] = at(i, scale.max);
    out.push(line(cx, cy, x, y, theme.axisLine));
    const lx = cx + (R + 6) * Math.cos(angle(i));
    const ly = cy + (R + 6) * Math.sin(angle(i));
    const c = Math.cos(angle(i));
    let anchor: "start" | "middle" | "end" = "middle";
    if (c > 0.2) anchor = "start";
    else if (c < -0.2) anchor = "end";
    out.push(
      svgText(lx, ly, truncateText(labels[i], labelW + 4, LABEL_SIZE), {
        size: LABEL_SIZE,
        fill: theme.mutedText,
        anchor,
        baseline: "central",
        family,
      })
    );
  }
  scale.ticks.forEach((t) => {
    // the outermost ring's label would sit on the first category label
    if (t < scale.min - 1e-9 || t > scale.max - 1e-9) return;
    out.push(
      svgText(cx + 3, cy - radius(t), axis.format(t), {
        size: LABEL_SIZE - 1,
        fill: theme.mutedText,
        anchor: "start",
        baseline: "central",
        family,
      })
    );
  });

  const dataLabels: string[] = [];
  model.series.forEach((s) => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < count; i += 1) {
      const v = s.values[i];
      // blanks plot at the centre, as in Excel
      const [x, y] = at(i, finite(v) ? v : scale.min);
      pts.push([x, y, i]);
    }
    const d = `${pts
      .map((p, i) => `${i ? "L" : "M"}${n(p[0])} ${n(p[1])}`)
      .join(" ")} Z`;
    if (style === "filled") {
      out.push(
        `<path d="${d}" fill="${escapeXml(s.color)}"${fillExtra({
          ...model.style,
          fillOpacity: model.style?.fillOpacity ?? 0.6,
        })}/>`
      );
    } else {
      out.push(
        `<path d="${d}" fill="none" stroke="${escapeXml(
          s.color
        )}" stroke-width="${
          model.style?.lineWidth ?? 2
        }" stroke-linejoin="round"/>`
      );
    }
    if (style === "marker") {
      pts.forEach(([x, y, i]) => {
        if (finite(s.values[i]))
          out.push(circle(x, y, model.style?.markerSize ?? 3.5, s.color));
      });
    }
    if (model.dataLabels) {
      pts.forEach(([x, y, i]) => {
        const v = s.values[i];
        if (!finite(v)) return;
        const place = pointLabelPlace(x, y, model.dataLabelOptions?.position);
        dataLabels.push(
          svgText(place.x, place.y, dataLabelText(model, s, i, v), {
            size: LABEL_SIZE,
            fill: theme.text,
            anchor: place.anchor,
            baseline: place.baseline,
            family,
          })
        );
      });
    }
  });
  out.push(...dataLabels);
}

// ---------------------------------------------------------------------------
// Waterfall
// ---------------------------------------------------------------------------

export function renderWaterfall(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const s = model.series[0];
  if (!s) return;
  const count = categoryCount(model);
  const totals = new Set(model.waterfallTotals ?? []);
  const spans: ([number, number] | null)[] = [];
  let running = 0;
  let min = 0;
  let max = 0;
  for (let i = 0; i < count; i += 1) {
    const v = s.values[i];
    if (!finite(v)) {
      spans.push(null);
      continue;
    }
    let span: [number, number];
    if (totals.has(i)) {
      span = [0, v];
      running = v;
    } else {
      span = [running, running + v];
      running += v;
    }
    spans.push(span);
    min = Math.min(min, span[0], span[1]);
    max = Math.max(max, span[0], span[1]);
  }
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) labels.push(categoryLabel(model, i));
  const frame = layoutCategoryFrame(area, theme, {
    count,
    labels,
    primary: makeValueAxis(
      min,
      max,
      model.valueAxis,
      false,
      model.axisFormats?.value
    ),
    categoryTitle: model.categoryAxisTitle,
    valueTitle: model.valueAxisTitle,
    gridlines: model.gridlines,
    style: model.style,
  });
  out.push(...frame.pre);
  const [inc, dec, tot] = accents(model);
  const gap = model.style?.gapWidth ?? 0.5;
  const barW = frame.band / (1 + gap);
  const dataLabels: string[] = [];
  let prevEnd: { x: number; value: number } | null = null;
  spans.forEach((span, i) => {
    if (!span) return;
    const x = frame.bandStart(i) + (gap / 2) * barW;
    const y1 = frame.vPos(span[0]);
    const y2 = frame.vPos(span[1]);
    const total = totals.has(i);
    let color = total ? tot : inc;
    if (!total && span[1] < span[0]) color = dec;
    if (s.pointColors?.[i]) color = s.pointColors[i];
    const r: Rect = {
      x,
      y: Math.min(y1, y2),
      width: barW,
      height: Math.max(0.5, Math.abs(y2 - y1)),
    };
    out.push(rect(r, color, fillExtra(model.style, model.style?.barRadius)));
    if (model.waterfallConnectors !== false && prevEnd) {
      const y = frame.vPos(prevEnd.value);
      out.push(
        line(prevEnd.x, y, x, y, theme.mutedText, 1, ' stroke-dasharray="2 2"')
      );
    }
    prevEnd = { x: x + barW, value: span[1] };
    if (model.dataLabels) {
      const v = s.values[i] as number;
      const place = barLabelPlace(
        r,
        false,
        model.dataLabelOptions?.position,
        false,
        span[1] >= span[0]
      );
      dataLabels.push(
        svgText(place.x, place.y, dataLabelText(model, s, i, v), {
          size: LABEL_SIZE,
          fill: place.inside ? "#ffffff" : theme.text,
          anchor: place.anchor,
          baseline: place.baseline,
          family: theme.fontFamily,
        })
      );
    }
  });
  out.push(...frame.post, ...dataLabels);
}

// ---------------------------------------------------------------------------
// Histogram and Pareto
// ---------------------------------------------------------------------------

/** The bars of a histogram / Pareto chart (label and height). */
export function histogramBars(model: ChartRenderModel) {
  const s = model.series[0];
  if (!s) return [];
  let bars: { label: string; value: number }[];
  const textCategories =
    model.type === "pareto" &&
    model.categories.some((c) => c !== "" && !Number.isFinite(Number(c)));
  if (textCategories) {
    // Pareto by category: sum per category.
    const sums = new Map<string, number>();
    s.values.forEach((v, i) => {
      if (!finite(v)) return;
      const key = model.categories[i] ?? "";
      sums.set(key, (sums.get(key) ?? 0) + v);
    });
    bars = Array.from(sums.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  } else {
    bars = computeHistogramBins(s.values, model.binning).map((b) => ({
      label: b.label,
      value: b.count,
    }));
  }
  if (model.type === "pareto") bars.sort((a, b) => b.value - a.value);
  return bars;
}

export function renderHistogram(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const s: ChartRenderSeries | undefined = model.series[0];
  if (!s) return;
  const pareto = model.type === "pareto";
  const bars = histogramBars(model);
  const count = bars.length;
  let max = 0;
  let min = 0;
  let total = 0;
  bars.forEach((b) => {
    max = Math.max(max, b.value);
    min = Math.min(min, b.value);
    total += Math.abs(b.value);
  });
  if (max === 0 && min === 0) max = 1;
  const frame = layoutCategoryFrame(area, theme, {
    count,
    labels: bars.map((b) => b.label),
    primary: makeValueAxis(
      min,
      max,
      model.valueAxis,
      false,
      model.axisFormats?.value
    ),
    secondary: pareto ? makeValueAxis(0, 1, undefined, true) : undefined,
    categoryTitle: model.categoryAxisTitle,
    valueTitle: model.valueAxisTitle,
    secondaryTitle: model.secondaryValueAxisTitle,
    gridlines: model.gridlines,
    style: model.style,
  });
  out.push(...frame.pre);
  const gap = model.style?.gapWidth ?? 0;
  const barW = frame.band / (1 + gap);
  const outline = model.style?.seriesOutline ?? theme.background;
  const dataLabels: string[] = [];
  bars.forEach((b, i) => {
    const x = frame.bandStart(i) + (gap / 2) * barW;
    const y1 = frame.vPos(0);
    const y2 = frame.vPos(b.value);
    const r: Rect = {
      x,
      y: Math.min(y1, y2),
      width: barW,
      height: Math.abs(y2 - y1),
    };
    out.push(
      rect(
        r,
        s.pointColors?.[i] || s.color,
        fillExtra({ ...model.style, seriesOutline: outline })
      )
    );
    if (model.dataLabels) {
      const place = barLabelPlace(
        r,
        false,
        model.dataLabelOptions?.position,
        false,
        true
      );
      dataLabels.push(
        svgText(place.x, place.y, formatChartNumber(b.value), {
          size: LABEL_SIZE,
          fill: place.inside ? "#ffffff" : theme.text,
          anchor: place.anchor,
          baseline: place.baseline,
          family: theme.fontFamily,
        })
      );
    }
  });
  if (pareto && total > 0) {
    let cum = 0;
    const color = accents(model)[1];
    const pts = bars.map((b, i) => {
      cum += Math.abs(b.value);
      return [frame.catCoord(i), frame.vPos(cum / total, true)];
    });
    out.push(
      `<path d="${pts
        .map((p, i) => `${i ? "L" : "M"}${n(p[0])} ${n(p[1])}`)
        .join(" ")}" fill="none" stroke="${escapeXml(
        color
      )}" stroke-width="2.25" stroke-linejoin="round"/>`
    );
    pts.forEach(([x, y]) => out.push(circle(x, y, 3, color)));
  }
  out.push(...frame.post, ...dataLabels);
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export function renderFunnel(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const s = model.series[0];
  if (!s) return;
  const count = categoryCount(model);
  if (count === 0) return;
  const family = theme.fontFamily;
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) labels.push(categoryLabel(model, i));
  const labelW = Math.min(
    area.width * 0.3,
    Math.max(...labels.map((l) => estimateTextWidth(l, LABEL_SIZE)), 8)
  );
  const plot: Rect = {
    x: area.x + labelW + 10,
    y: area.y + 4,
    width: Math.max(10, area.width - labelW - 14),
    height: Math.max(10, area.height - 8),
  };
  let max = 0;
  s.values.forEach((v) => {
    if (finite(v)) max = Math.max(max, Math.abs(v));
  });
  if (max === 0) max = 1;
  const band = plot.height / count;
  const gap = model.style?.gapWidth ?? 0.06;
  const barH = band / (1 + gap);
  for (let i = 0; i < count; i += 1) {
    const y = plot.y + i * band + (gap / 2) * barH;
    out.push(
      svgText(
        plot.x - 6,
        y + barH / 2,
        truncateText(labels[i], labelW, LABEL_SIZE),
        {
          size: LABEL_SIZE,
          fill: theme.mutedText,
          anchor: "end",
          baseline: "central",
          family,
        }
      )
    );
    const v = s.values[i];
    if (!finite(v)) continue;
    const w = (Math.abs(v) / max) * plot.width;
    const r: Rect = {
      x: plot.x + (plot.width - w) / 2,
      y,
      width: w,
      height: barH,
    };
    out.push(
      rect(r, pointColor(s, i), fillExtra(model.style, model.style?.barRadius))
    );
    if (model.dataLabels !== false) {
      out.push(
        svgText(
          r.x + r.width / 2,
          y + barH / 2,
          dataLabelText(model, s, i, v),
          {
            size: LABEL_SIZE,
            fill: w > 30 ? "#ffffff" : theme.text,
            anchor: "middle",
            baseline: "central",
            family,
          }
        )
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export function renderStock(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const { series } = model;
  const variant = model.stockVariant ?? (series.length >= 4 ? "ohlc" : "hlc");
  const [open, high, low, close] =
    variant === "ohlc"
      ? [series[0], series[1], series[2], series[3]]
      : [undefined, series[0], series[1], series[2]];
  const count = categoryCount(model);
  let min = Infinity;
  let max = -Infinity;
  series.forEach((s) =>
    s.values.forEach((v) => {
      if (finite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    })
  );
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) labels.push(categoryLabel(model, i));
  const frame = layoutCategoryFrame(area, theme, {
    count,
    labels,
    primary: makeValueAxis(
      min,
      max,
      model.valueAxis,
      false,
      model.axisFormats?.value
    ),
    categoryTitle: model.categoryAxisTitle,
    valueTitle: model.valueAxisTitle,
    gridlines: model.gridlines,
    style: model.style,
  });
  out.push(...frame.pre);
  const bodyW = Math.max(2, Math.min(24, frame.band * 0.5));
  for (let i = 0; i < count; i += 1) {
    const x = frame.catCoord(i);
    const h = high?.values[i];
    const l = low?.values[i];
    if (finite(h) && finite(l)) {
      out.push(line(x, frame.vPos(h), x, frame.vPos(l), theme.text, 1));
    }
    const o = open?.values[i];
    const c = close?.values[i];
    if (variant === "ohlc" && finite(o) && finite(c)) {
      const up = c >= o;
      const y1 = frame.vPos(o);
      const y2 = frame.vPos(c);
      out.push(
        rect(
          {
            x: x - bodyW / 2,
            y: Math.min(y1, y2),
            width: bodyW,
            height: Math.max(1, Math.abs(y2 - y1)),
          },
          up ? theme.background : theme.text,
          ` stroke="${escapeXml(theme.text)}" stroke-width="1"`
        )
      );
    } else if (finite(c) && close) {
      const y = frame.vPos(c);
      out.push(line(x, y, x + Math.min(8, bodyW), y, close.color, 2));
    }
  }
  if (model.dataLabels && close) {
    for (let i = 0; i < count; i += 1) {
      const c = close.values[i];
      if (!finite(c)) continue;
      out.push(
        svgText(
          frame.catCoord(i) + bodyW / 2 + 3,
          frame.vPos(c),
          dataLabelText(model, close, i, c),
          {
            size: LABEL_SIZE,
            fill: theme.text,
            baseline: "central",
            family: theme.fontFamily,
          }
        )
      );
    }
  }
  out.push(...frame.post);
}
