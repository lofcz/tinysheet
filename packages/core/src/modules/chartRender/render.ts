/**
 * Pure SVG chart renderer: column, bar, line, area (clustered, stacked and
 * 100% stacked), combo (per-series column/line/area with a secondary axis),
 * pie, doughnut, scatter, bubble, radar, waterfall, histogram, Pareto,
 * funnel and stock. Output is a standalone SVG string so it can be inlined
 * in the sheet's chart layer, turned into a data URI for an image, or
 * rasterised for export.
 */
import { computeErrorAmounts } from "./stats";
import {
  layoutCategoryFrame,
  layoutXYFrame,
  makeValueAxis,
  CategoryFrame,
} from "./frame";
import {
  barLabelPlace,
  drawErrorBars,
  drawTrendlines,
  drawTrendNotes,
  pointLabelPlace,
  TrendContext,
  trendlineTypeLabel,
} from "./marks";
import {
  renderFunnel,
  renderHistogram,
  renderRadar,
  renderStock,
  renderWaterfall,
} from "./special";
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
  GAP_WIDTH,
  LABEL_SIZE,
  LEGEND_SIZE,
  line,
  n,
  PAD,
  pointColor,
  rect,
  Rect,
  renderLabels,
  svgText,
  TITLE_SIZE,
  truncateText,
} from "./svg";
import { chartThemes } from "./theme";
import type {
  ChartRenderModel,
  ChartRenderSeries,
  ChartSeriesType,
  ChartTheme,
  ChartType,
} from "./types";

export { estimateTextWidth, formatChartNumber };

type LegendKind = "box" | "line" | "lineMarker" | "marker" | "dotted";
type LegendItem = { label: string; color: string; kind: LegendKind };

const DOUGHNUT_HOLE = 0.5;

const CATEGORY_TYPES: ChartType[] = ["column", "bar", "line", "area", "combo"];

function isCategoryChart(type: ChartType) {
  return CATEGORY_TYPES.includes(type);
}

type Kind = "column" | "bar" | "line" | "area";

function seriesKind(model: ChartRenderModel, s: ChartRenderSeries): Kind {
  switch (model.type) {
    case "bar":
      return "bar";
    case "combo":
      return (s.type ?? "column") as ChartSeriesType;
    case "line":
    case "area":
      return model.type;
    default:
      return "column";
  }
}

function onSecondary(model: ChartRenderModel, s: ChartRenderSeries) {
  return (
    !!s.secondary &&
    (model.type === "combo" ||
      model.type === "column" ||
      model.type === "line" ||
      model.type === "area")
  );
}

function usesPointLegend(model: ChartRenderModel) {
  if (model.type === "pie" || model.type === "doughnut") return true;
  return (
    !!model.varyColors &&
    model.series.length === 1 &&
    (model.type === "column" || model.type === "bar")
  );
}

function trendLegendItems(model: ChartRenderModel): LegendItem[] {
  const out: LegendItem[] = [];
  model.series.forEach((s) => {
    s.trendlines?.forEach((t) => {
      out.push({
        label: t.name || `${trendlineTypeLabel(t)} (${s.name})`,
        color: t.color || s.color,
        kind: "dotted",
      });
    });
  });
  return out;
}

function legendItems(model: ChartRenderModel): LegendItem[] {
  const labels = renderLabels(model);
  if (usesPointLegend(model)) {
    const first = model.series[0];
    if (!first) return [];
    const count = categoryCount(model);
    const items: LegendItem[] = [];
    for (let i = 0; i < count; i += 1) {
      items.push({
        label: categoryLabel(model, i),
        color: pointColor(first, i),
        kind: "box",
      });
    }
    return items;
  }
  const first = model.series[0];
  switch (model.type) {
    case "waterfall": {
      const [inc, dec, tot] = model.waterfallColors ?? [
        "#4472C4",
        "#ED7D31",
        "#A5A5A5",
      ];
      return [
        { label: labels.increase, color: inc, kind: "box" },
        { label: labels.decrease, color: dec, kind: "box" },
        { label: labels.total, color: tot, kind: "box" },
      ];
    }
    case "histogram":
    case "funnel":
      return first
        ? [{ label: first.name, color: first.color, kind: "box" }]
        : [];
    case "pareto":
      return first
        ? [
            { label: first.name, color: first.color, kind: "box" },
            {
              label: labels.cumulative,
              color: model.series[1]?.color ?? "#ED7D31",
              kind: "line",
            },
          ]
        : [];
    case "stock":
    case "bubble":
      return model.series.map((s) => ({
        label: s.name,
        color: s.color,
        kind: "marker" as LegendKind,
      }));
    case "radar": {
      const style = model.radarStyle ?? "marker";
      let kind: LegendKind = "line";
      if (style === "filled") kind = "box";
      else if (style === "marker") kind = "lineMarker";
      return model.series.map((s) => ({ label: s.name, color: s.color, kind }));
    }
    case "scatter": {
      let kind: LegendKind = "marker";
      if (model.scatterLines)
        kind = model.markers !== false ? "lineMarker" : "line";
      return [
        ...model.series.map((s) => ({ label: s.name, color: s.color, kind })),
        ...trendLegendItems(model),
      ];
    }
    default:
      break;
  }
  return [
    ...model.series.map((s) => {
      const k = seriesKind(model, s);
      let kind: LegendKind = "box";
      if (k === "line") kind = model.markers !== false ? "lineMarker" : "line";
      return { label: s.name, color: s.color, kind };
    }),
    ...trendLegendItems(model),
  ];
}

function renderLegendSwatch(item: LegendItem, x: number, cy: number) {
  const c = escapeXml(item.color);
  switch (item.kind) {
    case "line":
    case "lineMarker": {
      let out = line(x, cy, x + 16, cy, item.color, 2);
      if (item.kind === "lineMarker") out += circle(x + 8, cy, 3, item.color);
      return { svg: out, width: 16 };
    }
    case "dotted":
      return {
        svg: `<line x1="${n(x)}" y1="${n(cy)}" x2="${n(x + 16)}" y2="${n(
          cy
        )}" stroke="${c}" stroke-width="1.75" stroke-dasharray="2 3"/>`,
        width: 16,
      };
    case "marker":
      return { svg: circle(x + 4, cy, 3.5, item.color), width: 8 };
    default:
      return {
        svg: rect({ x, y: cy - 4, width: 8, height: 8 }, item.color),
        width: 8,
      };
  }
}

/**
 * Lays out and draws the legend; returns the rectangle left for the plot.
 */
function layoutLegend(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
): Rect {
  const position = model.legend ?? "right";
  const items = legendItems(model);
  if (position === "none" || items.length === 0) return area;
  const rowH = 16;
  if (position === "right" || position === "left") {
    const maxText = Math.max(
      ...items.map((it) => estimateTextWidth(it.label, LEGEND_SIZE))
    );
    const swatchW = Math.max(
      ...items.map((it) => renderLegendSwatch(it, 0, 0).width)
    );
    const legendW = Math.min(maxText + swatchW + 12, area.width * 0.4);
    const visibleRows = Math.max(1, Math.floor(area.height / rowH));
    const shown = items.slice(0, visibleRows);
    const totalH = shown.length * rowH;
    const x0 =
      position === "right" ? area.x + area.width - legendW + 4 : area.x + 2;
    let y = area.y + Math.max(0, (area.height - totalH) / 2) + rowH / 2;
    shown.forEach((item) => {
      const swatch = renderLegendSwatch(item, x0, y);
      out.push(swatch.svg);
      out.push(
        svgText(
          x0 + swatch.width + 5,
          y,
          truncateText(
            item.label,
            legendW - swatch.width - 7 + 0.01,
            LEGEND_SIZE
          ),
          {
            size: LEGEND_SIZE,
            fill: theme.text,
            baseline: "central",
            family: theme.fontFamily,
          }
        )
      );
      y += rowH;
    });
    return position === "right"
      ? { ...area, width: area.width - legendW - 4 }
      : { ...area, x: area.x + legendW + 4, width: area.width - legendW - 4 };
  }
  // top / bottom: wrap items into centred rows
  const maxRowW = area.width;
  const rows: { items: LegendItem[]; width: number }[] = [];
  let current: { items: LegendItem[]; width: number } = {
    items: [],
    width: 0,
  };
  items.forEach((item) => {
    const w = Math.min(
      estimateTextWidth(item.label, LEGEND_SIZE) + 30,
      maxRowW
    );
    if (current.items.length > 0 && current.width + w > maxRowW) {
      rows.push(current);
      current = { items: [], width: 0 };
    }
    current.items.push(item);
    current.width += w;
  });
  if (current.items.length) rows.push(current);
  const maxRows = Math.max(1, Math.floor((area.height * 0.4) / rowH));
  const shownRows = rows.slice(0, maxRows);
  const legendH = shownRows.length * rowH + 4;
  let y =
    position === "top"
      ? area.y + rowH / 2
      : area.y + area.height - legendH + rowH / 2 + 2;
  shownRows.forEach((row) => {
    let x = area.x + Math.max(0, (area.width - row.width) / 2);
    row.items.forEach((item) => {
      const w = Math.min(
        estimateTextWidth(item.label, LEGEND_SIZE) + 30,
        maxRowW
      );
      const swatch = renderLegendSwatch(item, x, y);
      out.push(swatch.svg);
      out.push(
        svgText(
          x + swatch.width + 5,
          y,
          truncateText(item.label, w - swatch.width - 12, LEGEND_SIZE),
          {
            size: LEGEND_SIZE,
            fill: theme.text,
            baseline: "central",
            family: theme.fontFamily,
          }
        )
      );
      x += w;
    });
    y += rowH;
  });
  return position === "top"
    ? { ...area, y: area.y + legendH, height: area.height - legendH }
    : { ...area, height: area.height - legendH };
}

// ---------------------------------------------------------------------------
// Category charts: column, bar, line, area, combo
// ---------------------------------------------------------------------------

type Spans = ([number, number] | null)[];

type Group = {
  kind: Kind;
  secondary: boolean;
  /** Series indices in the group. */
  members: number[];
  spans: Map<number, Spans>;
};

function stackGroup(
  model: ChartRenderModel,
  group: Group,
  count: number,
  track: (v: number, secondary: boolean) => void
) {
  const grouping = model.grouping ?? "clustered";
  const bars = group.kind === "column" || group.kind === "bar";
  group.members.forEach((si) => group.spans.set(si, []));
  if (grouping === "clustered") {
    group.members.forEach((si) => {
      const s = model.series[si];
      const spans = group.spans.get(si)!;
      for (let i = 0; i < count; i += 1) {
        const v = s.values[i];
        if (finite(v)) {
          spans[i] = [0, v];
          track(v, group.secondary);
        } else spans[i] = null;
      }
    });
    return;
  }
  for (let i = 0; i < count; i += 1) {
    let total = 0;
    if (grouping === "percentStacked") {
      group.members.forEach((si) => {
        const v = model.series[si].values[i];
        if (finite(v)) total += Math.abs(v);
      });
    }
    // Bars stack positives up and negatives down from zero; lines and
    // areas keep one running total and treat blanks as zero.
    let pos = 0;
    let neg = 0;
    let running = 0;
    group.members.forEach((si) => {
      const spans = group.spans.get(si)!;
      let v = model.series[si].values[i];
      if (!finite(v)) {
        if (bars) {
          spans[i] = null;
          return;
        }
        v = 0;
      }
      if (grouping === "percentStacked") v = total === 0 ? 0 : v / total;
      let start: number;
      if (!bars) {
        start = running;
        running += v;
      } else if (v >= 0) {
        start = pos;
        pos += v;
      } else {
        start = neg;
        neg += v;
      }
      spans[i] = [start, start + v];
      track(start + v, group.secondary);
    });
    track(0, group.secondary);
  }
}

function renderCategory(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const style = model.style ?? {};
  const count = categoryCount(model);
  const horizontal = model.type === "bar";
  const grouping = model.grouping ?? "clustered";
  const percent = grouping === "percentStacked";
  const stacked = grouping !== "clustered";

  // Group series by how they are drawn and which axis they use.
  const groupMap = new Map<string, Group>();
  model.series.forEach((s, si) => {
    const kind = seriesKind(model, s);
    const secondary = onSecondary(model, s);
    const key = `${kind}:${secondary ? 1 : 0}`;
    let g = groupMap.get(key);
    if (!g) {
      g = { kind, secondary, members: [], spans: new Map() };
      groupMap.set(key, g);
    }
    g.members.push(si);
  });
  const groups = Array.from(groupMap.values());
  const ext = {
    p: [Infinity, -Infinity],
    s: [Infinity, -Infinity],
  };
  const track = (v: number, secondary: boolean) => {
    const e = secondary ? ext.s : ext.p;
    if (v < e[0]) e[0] = v;
    if (v > e[1]) e[1] = v;
  };
  groups.forEach((g) => stackGroup(model, g, count, track));
  // error bars extend the value axis
  model.series.forEach((s) => {
    if (!s.errorBars || stacked) return;
    computeErrorAmounts(s.errorBars, s.values).forEach((a) => {
      if (!a) return;
      track(a.center + a.plus, onSecondary(model, s));
      track(a.center - a.minus, onSecondary(model, s));
    });
  });
  const hasSecondary = groups.some((g) => g.secondary);
  const fixExt = (e: number[]) => (Number.isFinite(e[0]) ? e : [0, 1]);
  const [pmin, pmax] = fixExt(ext.p);
  const primary = makeValueAxis(pmin, pmax, model.valueAxis, percent);
  const secondary = hasSecondary
    ? makeValueAxis(
        fixExt(ext.s)[0],
        fixExt(ext.s)[1],
        model.secondaryValueAxis,
        percent
      )
    : undefined;
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) labels.push(categoryLabel(model, i));
  const allArea = groups.every((g) => g.kind === "area");
  const frame = layoutCategoryFrame(area, theme, {
    count,
    labels,
    primary,
    secondary,
    horizontal,
    edgeToEdge: allArea,
    categoryTitle: model.categoryAxisTitle,
    valueTitle: model.valueAxisTitle,
    secondaryTitle: model.secondaryValueAxisTitle,
    gridlines: model.gridlines,
    style,
  });
  out.push(...frame.pre);

  const dataLabels: string[] = [];
  const overlays: string[] = [];
  const tc: TrendContext = { plot: frame.plot, theme, notes: [] };
  const family = theme.fontFamily;
  const opts = model.dataLabelOptions ?? {};
  const gap = style.gapWidth ?? GAP_WIDTH;
  const order: Kind[] = ["area", "column", "bar", "line"];
  const sorted = groups
    .slice()
    .sort(
      (a, b) =>
        order.indexOf(a.kind) - order.indexOf(b.kind) ||
        Number(a.secondary) - Number(b.secondary)
    );

  sorted.forEach((g) => {
    const vPos = (v: number) => frame.vPos(v, g.secondary);
    const base = frame.baseline(g.secondary);
    if (g.kind === "column" || g.kind === "bar") {
      const clustered = !stacked;
      const size = frame.band;
      const barW = clustered
        ? size / (g.members.length + gap)
        : size / (1 + gap);
      g.members.forEach((si, gi) => {
        const s = model.series[si];
        const spans = g.spans.get(si)!;
        const centers: (number | null)[] = [];
        for (let i = 0; i < count; i += 1) {
          const span = spans[i];
          if (!span) {
            centers[i] = null;
            continue;
          }
          const [a, b] = clustered ? [base, span[1]] : span;
          const p1 = vPos(a);
          const p2 = vPos(b);
          const offset =
            frame.bandStart(i) +
            (clustered ? (gap / 2) * barW + gi * barW : (gap / 2) * barW);
          centers[i] = offset + barW / 2;
          const color =
            model.varyColors && model.series.length === 1
              ? pointColor(s, i)
              : s.pointColors?.[i] || s.color;
          const r: Rect = horizontal
            ? {
                x: Math.min(p1, p2),
                y: offset,
                width: Math.abs(p2 - p1),
                height: barW,
              }
            : {
                x: offset,
                y: Math.min(p1, p2),
                width: barW,
                height: Math.abs(p2 - p1),
              };
          out.push(rect(r, color, fillExtra(style, style.barRadius)));
          if (model.dataLabels) {
            const raw = s.values[i] as number;
            const place = barLabelPlace(
              r,
              horizontal,
              opts.position,
              !clustered,
              b >= a
            );
            dataLabels.push(
              svgText(place.x, place.y, dataLabelText(model, s, i, raw), {
                size: LABEL_SIZE,
                fill: place.inside && !clustered ? "#ffffff" : theme.text,
                anchor: place.anchor,
                baseline: place.baseline,
                family,
              })
            );
          }
        }
        if (!stacked)
          drawErrorBars(
            overlays,
            s,
            s.values,
            (i) => centers[i] ?? null,
            vPos,
            horizontal,
            theme
          );
        if (!stacked)
          drawTrendlines(
            overlays,
            s,
            s.values.map((_, i) => i + 1),
            s.values,
            (x, y) => {
              const c = frame.catCoord(x - 1);
              return frame.point(c, vPos(y));
            },
            tc
          );
      });
      return;
    }
    // line and area
    const isArea = g.kind === "area";
    const lineW = style.lineWidth ?? 2.25;
    const markerR = style.markerSize ?? 3.5;
    g.members.forEach((si) => {
      const s = model.series[si];
      const spans = g.spans.get(si)!;
      const xAt = (i: number) => frame.catCoord(i);
      if (isArea) {
        const top: string[] = [];
        const bottom: string[] = [];
        for (let i = 0; i < count; i += 1) {
          const span = spans[i];
          const a = span && stacked ? span[0] : base;
          const b = span ? span[1] : a;
          top.push(`${n(xAt(i))},${n(vPos(b))}`);
          bottom.unshift(`${n(xAt(i))},${n(vPos(a))}`);
        }
        if (top.length) {
          const extra = fillExtra({
            ...style,
            fillOpacity: style.fillOpacity ?? 0.85,
          });
          out.push(
            `<polygon points="${top.join(" ")} ${bottom.join(
              " "
            )}" fill="${escapeXml(s.color)}"${extra}/>`
          );
        }
      } else {
        let d = "";
        let pen = false;
        for (let i = 0; i < count; i += 1) {
          const span = spans[i];
          if (!span || (!stacked && !finite(s.values[i]))) {
            pen = false;
            continue;
          }
          d += `${pen ? "L" : "M"}${n(xAt(i))} ${n(vPos(span[1]))} `;
          pen = true;
        }
        if (d) {
          out.push(
            `<path d="${d.trim()}" fill="none" stroke="${escapeXml(
              s.color
            )}" stroke-width="${lineW}" stroke-linejoin="round" stroke-linecap="round"/>`
          );
        }
        if (model.markers !== false) {
          for (let i = 0; i < count; i += 1) {
            const span = spans[i];
            if (!span || !finite(s.values[i])) continue;
            out.push(
              circle(
                xAt(i),
                vPos(span[1]),
                markerR,
                s.color,
                ` stroke="${escapeXml(theme.background)}" stroke-width="0.75"`
              )
            );
          }
        }
      }
      if (model.dataLabels) {
        for (let i = 0; i < count; i += 1) {
          const span = spans[i];
          const raw = s.values[i];
          if (!span || !finite(raw)) continue;
          const place = pointLabelPlace(xAt(i), vPos(span[1]), opts.position);
          dataLabels.push(
            svgText(place.x, place.y, dataLabelText(model, s, i, raw), {
              size: LABEL_SIZE,
              fill: theme.text,
              anchor: place.anchor,
              baseline: place.baseline,
              family,
            })
          );
        }
      }
      if (!stacked) {
        drawErrorBars(overlays, s, s.values, xAt, vPos, false, theme);
        drawTrendlines(
          overlays,
          s,
          s.values.map((_, i) => i + 1),
          s.values,
          (x, y) => [frame.catCoord(x - 1), vPos(y)],
          tc
        );
      }
    });
  });

  out.push(...overlays);
  out.push(...frame.post);
  drawTrendNotes(out, tc);
  out.push(...dataLabels);
}

// ---------------------------------------------------------------------------
// XY charts: scatter and bubble
// ---------------------------------------------------------------------------

function renderXY(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const style = model.style ?? {};
  const bubble = model.type === "bubble";
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  const xsOf = (s: ChartRenderSeries) =>
    s.values.map((_, i) => (s.xValues ? s.xValues[i] : i + 1));
  model.series.forEach((s) => {
    const xs = xsOf(s);
    s.values.forEach((y, i) => {
      const x = xs[i];
      if (!finite(x) || !finite(y)) return;
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    });
    s.trendlines?.forEach((t) => {
      if (t.type === "movingAverage" || !Number.isFinite(xmin)) return;
      if (t.forward) xmax += Math.max(0, t.forward);
      if (t.backward) xmin -= Math.max(0, t.backward);
    });
    if (s.errorBars) {
      computeErrorAmounts(s.errorBars, s.values).forEach((a) => {
        if (!a) return;
        ymin = Math.min(ymin, a.center - a.minus);
        ymax = Math.max(ymax, a.center + a.plus);
      });
    }
  });
  if (!Number.isFinite(xmin)) {
    xmin = 0;
    xmax = 1;
  }
  if (!Number.isFinite(ymin)) {
    ymin = 0;
    ymax = 1;
  }
  const frame = layoutXYFrame(area, theme, {
    x: makeValueAxis(xmin, xmax),
    y: makeValueAxis(ymin, ymax, model.valueAxis),
    xTitle: model.categoryAxisTitle,
    yTitle: model.valueAxisTitle,
    gridlines: model.gridlines,
    style,
  });
  out.push(...frame.pre);
  const { plot, xPos, yPos } = frame;
  const labels: string[] = [];
  const overlays: string[] = [];
  const tc: TrendContext = { plot, theme, notes: [] };
  const opts = model.dataLabelOptions ?? {};
  let maxSize = 0;
  if (bubble) {
    model.series.forEach((s) =>
      s.sizes?.forEach((v) => {
        if (finite(v) && v > maxSize) maxSize = v;
      })
    );
  }
  const rMax =
    Math.min(plot.width, plot.height) *
    0.125 *
    ((model.bubbleScale ?? 100) / 100);
  model.series.forEach((s) => {
    const xs = xsOf(s);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < s.values.length; i += 1) {
      const x = xs[i];
      const y = s.values[i];
      if (finite(x) && finite(y)) pts.push([xPos(x), yPos(y), i]);
    }
    if (bubble) {
      pts.forEach(([x, y, i]) => {
        const size = s.sizes?.[i];
        if (!finite(size) || size <= 0 || maxSize <= 0) return;
        const r = Math.max(1.5, rMax * Math.sqrt(size / maxSize));
        out.push(
          circle(
            x,
            y,
            r,
            pointColor(s, i),
            fillExtra({
              ...style,
              fillOpacity: style.fillOpacity ?? 0.75,
              seriesOutline: style.seriesOutline ?? s.color,
            })
          )
        );
      });
    } else {
      if (model.scatterLines && pts.length > 1) {
        out.push(
          `<path d="${pts
            .map((p, i) => `${i ? "L" : "M"}${n(p[0])} ${n(p[1])}`)
            .join(" ")}" fill="none" stroke="${escapeXml(
            s.color
          )}" stroke-width="${style.lineWidth ?? 2}"/>`
        );
      }
      if (model.markers !== false || !model.scatterLines) {
        pts.forEach(([x, y]) => {
          out.push(circle(x, y, style.markerSize ?? 3.5, s.color));
        });
      }
    }
    if (model.dataLabels) {
      pts.forEach(([x, y, i]) => {
        const place = pointLabelPlace(
          x,
          y,
          opts.position ?? (bubble ? "center" : "right"),
          5
        );
        labels.push(
          svgText(
            place.x,
            bubble || opts.position ? place.y : y - 5,
            dataLabelText(model, s, i, s.values[i] as number, {
              category: formatChartNumber(xs[i] as number),
            }),
            {
              size: LABEL_SIZE,
              fill: theme.text,
              anchor: place.anchor,
              baseline: bubble || opts.position ? place.baseline : undefined,
              family: theme.fontFamily,
            }
          )
        );
      });
    }
    drawErrorBars(
      overlays,
      s,
      s.values,
      (i) => (finite(xs[i]) ? xPos(xs[i] as number) : null),
      yPos,
      false,
      theme
    );
    drawTrendlines(overlays, s, xs, s.values, (x, y) => [xPos(x), yPos(y)], tc);
  });
  out.push(...overlays);
  out.push(...frame.post);
  drawTrendNotes(out, tc);
  out.push(...labels);
}

// ---------------------------------------------------------------------------
// Pie and doughnut
// ---------------------------------------------------------------------------

function arcPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
) {
  const sweep = a1 - a0;
  if (sweep >= Math.PI * 2 - 1e-6) {
    // full ring: two half arcs
    const outer = `M${n(cx)} ${n(cy - r1)} A${n(r1)} ${n(r1)} 0 1 1 ${n(
      cx
    )} ${n(cy + r1)} A${n(r1)} ${n(r1)} 0 1 1 ${n(cx)} ${n(cy - r1)} Z`;
    if (r0 <= 0) return outer;
    return `${outer} M${n(cx)} ${n(cy - r0)} A${n(r0)} ${n(r0)} 0 1 0 ${n(
      cx
    )} ${n(cy + r0)} A${n(r0)} ${n(r0)} 0 1 0 ${n(cx)} ${n(cy - r0)} Z`;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const p = (r: number, a: number) =>
    `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  if (r0 <= 0) {
    return `M${n(cx)} ${n(cy)} L${p(r1, a0)} A${n(r1)} ${n(
      r1
    )} 0 ${large} 1 ${p(r1, a1)} Z`;
  }
  return `M${p(r1, a0)} A${n(r1)} ${n(r1)} 0 ${large} 1 ${p(r1, a1)} L${p(
    r0,
    a1
  )} A${n(r0)} ${n(r0)} 0 ${large} 0 ${p(r0, a0)} Z`;
}

function renderPie(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const doughnut = model.type === "doughnut";
  const rings = doughnut ? model.series : model.series.slice(0, 1);
  if (rings.length === 0) return;
  const opts = model.dataLabelOptions ?? {};
  const outside = !doughnut && opts.position === "outsideEnd";
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const radius = Math.max(
    4,
    Math.min(area.width, area.height) / 2 - (outside ? LABEL_SIZE + 10 : 4)
  );
  const hole = doughnut ? radius * DOUGHNUT_HOLE : 0;
  const ringW = (radius - hole) / rings.length;
  const labels: string[] = [];
  const outline = model.style?.seriesOutline ?? theme.sliceSeparator;
  const outlineW = model.style?.seriesOutlineWidth ?? 1;
  rings.forEach((s, ri) => {
    const r0 = hole + ri * ringW;
    const r1 = r0 + ringW;
    let total = 0;
    s.values.forEach((v) => {
      if (finite(v)) total += Math.abs(v);
    });
    if (total <= 0) return;
    let angle = -Math.PI / 2;
    s.values.forEach((v, i) => {
      if (!finite(v) || v === 0) return;
      const sweep = (Math.abs(v) / total) * Math.PI * 2;
      const color = pointColor(s, i);
      out.push(
        `<path d="${arcPath(
          cx,
          cy,
          r0,
          r1,
          angle,
          angle + sweep
        )}" fill="${escapeXml(color)}" fill-rule="evenodd" stroke="${escapeXml(
          outline
        )}" stroke-width="${outlineW}"/>`
      );
      if (model.dataLabels) {
        const mid = angle + sweep / 2;
        let lr = doughnut ? (r0 + r1) / 2 : radius * 0.65;
        if (!doughnut && opts.position === "center") lr = radius * 0.5;
        if (!doughnut && opts.position === "insideEnd") lr = radius * 0.82;
        if (outside) lr = radius + 8;
        const lx = cx + lr * Math.cos(mid);
        let anchor: "start" | "middle" | "end" = "middle";
        if (outside) anchor = Math.cos(mid) >= 0 ? "start" : "end";
        labels.push(
          svgText(
            lx,
            cy + lr * Math.sin(mid),
            dataLabelText(model, s, i, v, {
              percent: Math.abs(v) / total,
            }),
            {
              size: LABEL_SIZE,
              fill: outside ? theme.text : "#ffffff",
              anchor,
              baseline: "central",
              family: theme.fontFamily,
            }
          )
        );
      }
      angle += sweep;
    });
  });
  out.push(...labels);
}

// ---------------------------------------------------------------------------

export function hasChartData(model: ChartRenderModel) {
  return model.series.some((s) => s.values.some((v) => finite(v)));
}

/** Render a chart model to a standalone SVG string. */
export function renderChartSvg(
  model: ChartRenderModel,
  width: number,
  height: number,
  theme: ChartTheme = chartThemes.light
) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const out: string[] = [];
  out.push(
    rect(
      { x: 0.5, y: 0.5, width: w - 1, height: h - 1 },
      theme.background,
      ` stroke="${escapeXml(theme.border)}" stroke-width="1"`
    )
  );
  let area: Rect = {
    x: PAD,
    y: PAD,
    width: w - PAD * 2,
    height: h - PAD * 2,
  };
  const title = model.title?.trim();
  if (title) {
    out.push(
      svgText(
        w / 2,
        PAD + TITLE_SIZE,
        truncateText(title, w - PAD * 2, TITLE_SIZE),
        {
          size: TITLE_SIZE,
          fill: theme.text,
          anchor: "middle",
          weight: model.style?.titleBold ? "700" : undefined,
          family: theme.fontFamily,
        }
      )
    );
    area = {
      ...area,
      y: area.y + TITLE_SIZE + 10,
      height: area.height - TITLE_SIZE - 10,
    };
  }

  if (area.width > 20 && area.height > 20 && model.series.length > 0) {
    area = layoutLegend(model, area, theme, out);
    const { type } = model;
    if (isCategoryChart(type)) renderCategory(model, area, theme, out);
    else if (type === "scatter" || type === "bubble")
      renderXY(model, area, theme, out);
    else if (type === "radar") renderRadar(model, area, theme, out);
    else if (type === "waterfall") renderWaterfall(model, area, theme, out);
    else if (type === "histogram" || type === "pareto")
      renderHistogram(model, area, theme, out);
    else if (type === "funnel") renderFunnel(model, area, theme, out);
    else if (type === "stock") renderStock(model, area, theme, out);
    else renderPie(model, area, theme, out);
  }

  const label = escapeXml(title || model.type);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${out.join(
    ""
  )}</svg>`;
}

export type { CategoryFrame };
