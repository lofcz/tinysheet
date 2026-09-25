/**
 * Pure SVG chart renderer: column, bar, line, area (clustered, stacked and
 * 100% stacked), pie, doughnut and scatter. Output is a standalone SVG string
 * so it can be inlined in the sheet's chart layer, turned into a data URI for
 * an image, or rasterised for xlsx export.
 */
import { computeAxisScale, formatAxisTick, AxisScale } from "./axis";
import { escapeXml, roundSvgNumber as n } from "./legacy";
import { chartThemes } from "./theme";
import type {
  ChartRenderModel,
  ChartRenderSeries,
  ChartTheme,
  ChartType,
} from "./types";

type Rect = { x: number; y: number; width: number; height: number };

type LegendItem = { label: string; color: string; line: boolean };

const TITLE_SIZE = 14;
const LABEL_SIZE = 10;
const LEGEND_SIZE = 10;
const AXIS_TITLE_SIZE = 10;
const PAD = 8;
/** Excel's default gap width (150% of a bar). */
const GAP_WIDTH = 1.5;
const DOUGHNUT_HOLE = 0.5;

/** Rough text width for Calibri/Arial-like fonts (no DOM measuring). */
export function estimateTextWidth(str: string, fontSize: number) {
  let units = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code > 0x2e80) units += 1;
    else if ("iljtfI.,:;'!| ".indexOf(str[i]) >= 0) units += 0.32;
    else if ("mwMW".indexOf(str[i]) >= 0) units += 0.85;
    else if (str[i] >= "A" && str[i] <= "Z") units += 0.64;
    else units += 0.54;
  }
  return units * fontSize;
}

function truncateText(str: string, maxWidth: number, fontSize: number) {
  if (maxWidth <= 0) return "";
  if (estimateTextWidth(str, fontSize) <= maxWidth) return str;
  let out = str;
  while (out.length > 1 && estimateTextWidth(`${out}…`, fontSize) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length <= 1 ? "" : `${out}…`;
}

/** Excel "General"-like number text for data labels. */
export function formatChartNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  if (abs >= 1e11 || abs < 1e-9) return value.toExponential(2);
  const digits = Math.max(0, 10 - Math.floor(Math.log10(abs) + 1));
  return String(parseFloat(value.toFixed(Math.min(digits, 9))));
}

function svgText(
  x: number,
  y: number,
  content: string,
  opts: {
    size: number;
    fill: string;
    anchor?: "start" | "middle" | "end";
    weight?: string;
    baseline?: string;
    rotate?: number;
    family: string;
  }
) {
  if (!content) return "";
  const rotate =
    opts.rotate != null
      ? ` transform="rotate(${opts.rotate} ${n(x)} ${n(y)})"`
      : "";
  return `<text x="${n(x)}" y="${n(y)}" font-family="${escapeXml(
    opts.family
  )}" font-size="${opts.size}"${
    opts.weight ? ` font-weight="${opts.weight}"` : ""
  } fill="${escapeXml(opts.fill)}" text-anchor="${opts.anchor || "start"}"${
    opts.baseline ? ` dominant-baseline="${opts.baseline}"` : ""
  }${rotate}>${escapeXml(content)}</text>`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width = 1
) {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(
    y2
  )}" stroke="${escapeXml(stroke)}" stroke-width="${width}"/>`;
}

function rect(r: Rect, fill: string, extra = "") {
  return `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(
    Math.max(0, r.width)
  )}" height="${n(Math.max(0, r.height))}" fill="${escapeXml(fill)}"${extra}/>`;
}

function isCartesian(type: ChartType) {
  return type !== "pie" && type !== "doughnut";
}

function finite(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

function categoryCount(model: ChartRenderModel) {
  let count = model.categories.length;
  model.series.forEach((s) => {
    count = Math.max(count, s.values.length);
  });
  return count;
}

function categoryLabel(model: ChartRenderModel, i: number) {
  const label = model.categories[i];
  return label != null && label !== "" ? label : String(i + 1);
}

function pointColor(
  model: ChartRenderModel,
  series: ChartRenderSeries,
  index: number
) {
  return series.pointColors?.[index] || series.color;
}

function usesPointLegend(model: ChartRenderModel) {
  if (model.type === "pie" || model.type === "doughnut") return true;
  return (
    !!model.varyColors &&
    model.series.length === 1 &&
    (model.type === "column" || model.type === "bar")
  );
}

function legendItems(model: ChartRenderModel): LegendItem[] {
  if (usesPointLegend(model)) {
    const first = model.series[0];
    if (!first) return [];
    const count = categoryCount(model);
    const items: LegendItem[] = [];
    for (let i = 0; i < count; i += 1) {
      items.push({
        label: categoryLabel(model, i),
        color: pointColor(model, first, i),
        line: false,
      });
    }
    return items;
  }
  const lineLike =
    model.type === "line" ||
    (model.type === "scatter" && model.scatterLines === true);
  return model.series.map((s) => ({
    label: s.name,
    color: s.color,
    line: lineLike,
  }));
}

function renderLegendSwatch(
  item: LegendItem,
  x: number,
  cy: number,
  model: ChartRenderModel
) {
  if (item.line) {
    let out = line(x, cy, x + 16, cy, item.color, 2);
    if (model.markers !== false) {
      out += `<circle cx="${n(x + 8)}" cy="${n(cy)}" r="3" fill="${escapeXml(
        item.color
      )}"/>`;
    }
    return { svg: out, width: 16 };
  }
  if (model.type === "scatter") {
    return {
      svg: `<circle cx="${n(x + 4)}" cy="${n(cy)}" r="3.5" fill="${escapeXml(
        item.color
      )}"/>`,
      width: 8,
    };
  }
  return {
    svg: rect({ x, y: cy - 4, width: 8, height: 8 }, item.color),
    width: 8,
  };
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
    const legendW = Math.min(maxText + 26, area.width * 0.4);
    const visibleRows = Math.max(1, Math.floor(area.height / rowH));
    const shown = items.slice(0, visibleRows);
    const totalH = shown.length * rowH;
    const x0 =
      position === "right" ? area.x + area.width - legendW + 4 : area.x + 2;
    let y = area.y + Math.max(0, (area.height - totalH) / 2) + rowH / 2;
    shown.forEach((item) => {
      const swatch = renderLegendSwatch(item, x0, y, model);
      out.push(swatch.svg);
      out.push(
        svgText(
          x0 + swatch.width + 5,
          y,
          truncateText(item.label, legendW - swatch.width - 10, LEGEND_SIZE),
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
      const swatch = renderLegendSwatch(item, x, y, model);
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
// Cartesian charts
// ---------------------------------------------------------------------------

type StackInfo = {
  /** Plotted [start, end] per series per category (after stacking). */
  spans: ([number, number] | null)[][];
  min: number;
  max: number;
};

function computeStacks(model: ChartRenderModel, count: number): StackInfo {
  const grouping = model.grouping ?? "clustered";
  const spans: ([number, number] | null)[][] = model.series.map(() => []);
  let min = Infinity;
  let max = -Infinity;
  const track = (v: number) => {
    if (v < min) min = v;
    if (v > max) max = v;
  };
  if (grouping === "clustered" || model.type === "scatter") {
    model.series.forEach((s, si) => {
      for (let i = 0; i < count; i += 1) {
        const v = s.values[i];
        if (finite(v)) {
          spans[si][i] = [0, v];
          track(v);
        } else spans[si][i] = null;
      }
    });
  } else {
    for (let i = 0; i < count; i += 1) {
      let total = 0;
      if (grouping === "percentStacked") {
        model.series.forEach((s) => {
          const v = s.values[i];
          if (finite(v)) total += Math.abs(v);
        });
      }
      // Bars stack positives up and negatives down from zero; lines and
      // areas keep one running total and treat blanks as zero.
      const bars = model.type === "column" || model.type === "bar";
      let pos = 0;
      let neg = 0;
      let running = 0;
      model.series.forEach((s, si) => {
        let v = s.values[i];
        if (!finite(v)) {
          if (bars) {
            spans[si][i] = null;
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
        spans[si][i] = [start, start + v];
        track(start + v);
      });
      track(0);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  return { spans, min, max };
}

function valueScale(model: ChartRenderModel, stacks: StackInfo): AxisScale {
  if (model.grouping === "percentStacked" && model.type !== "scatter") {
    const min = stacks.min < 0 ? -1 : 0;
    const max = stacks.max > 0 || min === 0 ? 1 : 0;
    const ticks: number[] = [];
    for (let v = min; v <= max + 1e-9; v += 0.1) {
      ticks.push(Math.round(v * 10) / 10);
    }
    return { min, max, step: 0.1, ticks };
  }
  return computeAxisScale(stacks.min, stacks.max, model.valueAxis);
}

function formatValueTick(model: ChartRenderModel, v: number, step: number) {
  if (model.grouping === "percentStacked" && model.type !== "scatter") {
    return `${Math.round(v * 100)}%`;
  }
  return formatAxisTick(v, step);
}

function dataLabelText(series: ChartRenderSeries, i: number, value: number) {
  const label = series.labels?.[i];
  if (label != null && label !== "") return label;
  return formatChartNumber(value);
}

/** Data label position for a bar: centred inside (stacked) or past its end. */
function barLabelPlacement(
  r: Rect,
  horizontal: boolean,
  inside: boolean,
  positive: boolean
): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline?: string;
} {
  if (inside) {
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      anchor: "middle",
      baseline: "central",
    };
  }
  if (horizontal) {
    return positive
      ? {
          x: r.x + r.width + 3,
          y: r.y + r.height / 2,
          anchor: "start",
          baseline: "central",
        }
      : {
          x: r.x - 3,
          y: r.y + r.height / 2,
          anchor: "end",
          baseline: "central",
        };
  }
  return positive
    ? { x: r.x + r.width / 2, y: r.y - 3, anchor: "middle" }
    : {
        x: r.x + r.width / 2,
        y: r.y + r.height + LABEL_SIZE,
        anchor: "middle",
      };
}

function renderCartesian(
  model: ChartRenderModel,
  area: Rect,
  theme: ChartTheme,
  out: string[]
) {
  const { type } = model;
  const horizontal = type === "bar";
  const scatter = type === "scatter";
  const count = categoryCount(model);
  const stacks = computeStacks(model, count);
  const vScale = valueScale(model, stacks);

  let xScale: AxisScale | null = null;
  if (scatter) {
    let xmin = Infinity;
    let xmax = -Infinity;
    model.series.forEach((s) => {
      for (let i = 0; i < s.values.length; i += 1) {
        const x = s.xValues ? s.xValues[i] : i + 1;
        if (finite(x)) {
          xmin = Math.min(xmin, x);
          xmax = Math.max(xmax, x);
        }
      }
    });
    if (!Number.isFinite(xmin)) {
      xmin = 0;
      xmax = 1;
    }
    xScale = computeAxisScale(xmin, xmax);
  }

  const valueLabels = vScale.ticks.map((t) =>
    formatValueTick(model, t, vScale.step)
  );
  const valueLabelW = Math.max(
    ...valueLabels.map((l) => estimateTextWidth(l, LABEL_SIZE)),
    8
  );

  const catAxisTitle = model.categoryAxisTitle?.trim() || "";
  const valAxisTitle = model.valueAxisTitle?.trim() || "";
  // Titles on the left (vertical axis) and bottom (horizontal axis).
  const leftTitle = horizontal ? catAxisTitle : valAxisTitle;
  const bottomTitle = horizontal ? valAxisTitle : catAxisTitle;

  let categoryLabels: string[] = [];
  if (!scatter) {
    for (let i = 0; i < count; i += 1)
      categoryLabels.push(categoryLabel(model, i));
  } else {
    categoryLabels = xScale!.ticks.map((t) => formatAxisTick(t, xScale!.step));
  }

  let leftLabelW: number;
  if (horizontal) {
    const maxCat = Math.max(
      ...categoryLabels.map((l) => estimateTextWidth(l, LABEL_SIZE)),
      8
    );
    leftLabelW = Math.min(maxCat, area.width * 0.3);
  } else {
    leftLabelW = valueLabelW;
  }
  const leftTitleW = leftTitle ? AXIS_TITLE_SIZE + 8 : 0;
  const bottomTitleH = bottomTitle ? AXIS_TITLE_SIZE + 8 : 0;
  const bottomLabelH = LABEL_SIZE + 8;

  const plot: Rect = {
    x: area.x + leftTitleW + leftLabelW + 6,
    y: area.y + 6,
    width: 0,
    height: 0,
  };
  // Leave room for the last horizontal tick label to overhang.
  const rightPad = horizontal || scatter ? valueLabelW / 2 : 6;
  plot.width = Math.max(10, area.x + area.width - rightPad - plot.x);
  plot.height = Math.max(
    10,
    area.y + area.height - bottomTitleH - bottomLabelH - plot.y
  );

  const vSpan = vScale.max - vScale.min || 1;
  const clampV = (v: number) => Math.min(vScale.max, Math.max(vScale.min, v));
  // value → pixel along the value axis
  const vPos = (v: number) =>
    horizontal
      ? plot.x + ((clampV(v) - vScale.min) / vSpan) * plot.width
      : plot.y + plot.height - ((clampV(v) - vScale.min) / vSpan) * plot.height;
  const baselineValue = clampV(0);

  const family = theme.fontFamily;

  // Gridlines and value-axis labels
  vScale.ticks.forEach((t, i) => {
    if (t < vScale.min - 1e-9 || t > vScale.max + 1e-9) return;
    const p = vPos(t);
    if (horizontal) {
      if (model.gridlines !== false)
        out.push(line(p, plot.y, p, plot.y + plot.height, theme.gridline));
      out.push(
        svgText(p, plot.y + plot.height + LABEL_SIZE + 4, valueLabels[i], {
          size: LABEL_SIZE,
          fill: theme.mutedText,
          anchor: "middle",
          family,
        })
      );
    } else {
      if (model.gridlines !== false)
        out.push(line(plot.x, p, plot.x + plot.width, p, theme.gridline));
      out.push(
        svgText(plot.x - 5, p, valueLabels[i], {
          size: LABEL_SIZE,
          fill: theme.mutedText,
          anchor: "end",
          baseline: "central",
          family,
        })
      );
    }
  });

  const labels: string[] = [];
  const grouping = model.grouping ?? "clustered";
  const seriesCount = Math.max(1, model.series.length);
  const catSpan = horizontal ? plot.height : plot.width;
  const band = catSpan / Math.max(1, count);
  // Excel bar charts list the first category at the bottom.
  const bandStart = (i: number) =>
    horizontal ? plot.y + plot.height - (i + 1) * band : plot.x + i * band;

  if (type === "column" || type === "bar") {
    const clustered = grouping === "clustered";
    const barW = clustered
      ? band / (seriesCount + GAP_WIDTH)
      : band / (1 + GAP_WIDTH);
    model.series.forEach((s, si) => {
      for (let i = 0; i < count; i += 1) {
        const span = stacks.spans[si][i];
        if (!span) continue;
        const [a, b] = clustered ? [baselineValue, span[1]] : span;
        const p1 = vPos(a);
        const p2 = vPos(b);
        const offset =
          bandStart(i) +
          (clustered
            ? (GAP_WIDTH / 2) * barW + si * barW
            : (GAP_WIDTH / 2) * barW);
        const color =
          model.varyColors && model.series.length === 1
            ? pointColor(model, s, i)
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
        out.push(rect(r, color));
        if (model.dataLabels) {
          const raw = s.values[i] as number;
          const place = barLabelPlacement(r, horizontal, !clustered, b >= a);
          labels.push(
            svgText(place.x, place.y, dataLabelText(s, i, raw), {
              size: LABEL_SIZE,
              fill: clustered ? theme.text : "#ffffff",
              anchor: place.anchor,
              baseline: place.baseline,
              family,
            })
          );
        }
      }
    });
  } else if (type === "line" || type === "area") {
    const isArea = type === "area";
    const xAt = (i: number) => {
      if (!isArea) return bandStart(i) + band / 2;
      if (count <= 1) return plot.x + plot.width / 2;
      return plot.x + (i * plot.width) / (count - 1);
    };
    const stacked = grouping !== "clustered";
    const drawOrder = model.series.map((_, i) => i);
    drawOrder.forEach((si) => {
      const s = model.series[si];
      const spans = stacks.spans[si];
      if (isArea) {
        const top: string[] = [];
        const bottom: string[] = [];
        for (let i = 0; i < count; i += 1) {
          const span = spans[i];
          const a = span && stacked ? span[0] : baselineValue;
          const b = span ? span[1] : a;
          top.push(`${n(xAt(i))},${n(vPos(b))}`);
          bottom.unshift(`${n(xAt(i))},${n(vPos(a))}`);
        }
        if (top.length) {
          out.push(
            `<polygon points="${top.join(" ")} ${bottom.join(
              " "
            )}" fill="${escapeXml(s.color)}" fill-opacity="0.85"/>`
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
            )}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`
          );
        }
        if (model.markers !== false) {
          for (let i = 0; i < count; i += 1) {
            const span = spans[i];
            if (!span || !finite(s.values[i])) continue;
            out.push(
              `<circle cx="${n(xAt(i))}" cy="${n(
                vPos(span[1])
              )}" r="3.5" fill="${escapeXml(s.color)}" stroke="${escapeXml(
                theme.background
              )}" stroke-width="0.75"/>`
            );
          }
        }
      }
      if (model.dataLabels) {
        for (let i = 0; i < count; i += 1) {
          const span = spans[i];
          const raw = s.values[i];
          if (!span || !finite(raw)) continue;
          labels.push(
            svgText(xAt(i), vPos(span[1]) - 7, dataLabelText(s, i, raw), {
              size: LABEL_SIZE,
              fill: theme.text,
              anchor: "middle",
              family,
            })
          );
        }
      }
    });
  } else if (scatter && xScale) {
    const xs = xScale;
    const xSpan = xs.max - xs.min || 1;
    const xPos = (x: number) =>
      plot.x +
      ((Math.min(xs.max, Math.max(xs.min, x)) - xs.min) / xSpan) * plot.width;
    model.series.forEach((s) => {
      const pts: [number, number, number][] = [];
      for (let i = 0; i < s.values.length; i += 1) {
        const x = s.xValues ? s.xValues[i] : i + 1;
        const y = s.values[i];
        if (finite(x) && finite(y)) pts.push([xPos(x), vPos(y), i]);
      }
      if (model.scatterLines && pts.length > 1) {
        out.push(
          `<path d="${pts
            .map((p, i) => `${i ? "L" : "M"}${n(p[0])} ${n(p[1])}`)
            .join(" ")}" fill="none" stroke="${escapeXml(
            s.color
          )}" stroke-width="2"/>`
        );
      }
      if (model.markers !== false || !model.scatterLines) {
        pts.forEach(([x, y]) => {
          out.push(
            `<circle cx="${n(x)}" cy="${n(y)}" r="3.5" fill="${escapeXml(
              s.color
            )}"/>`
          );
        });
      }
      if (model.dataLabels) {
        pts.forEach(([x, y, i]) => {
          labels.push(
            svgText(x + 5, y - 5, dataLabelText(s, i, s.values[i] as number), {
              size: LABEL_SIZE,
              fill: theme.text,
              family,
            })
          );
        });
      }
    });
    // X-axis tick labels
    xs.ticks.forEach((t, i) => {
      if (t < xs.min - 1e-9 || t > xs.max + 1e-9) return;
      out.push(
        svgText(
          xPos(t),
          plot.y + plot.height + LABEL_SIZE + 4,
          categoryLabels[i],
          {
            size: LABEL_SIZE,
            fill: theme.mutedText,
            anchor: "middle",
            family,
          }
        )
      );
    });
  }

  // Axis lines: the category axis crosses at zero.
  const base = vPos(baselineValue);
  if (horizontal) {
    out.push(line(base, plot.y, base, plot.y + plot.height, theme.axisLine));
  } else {
    out.push(line(plot.x, base, plot.x + plot.width, base, theme.axisLine));
  }

  // Category labels
  if (!scatter && count > 0) {
    const maxLabel = horizontal ? leftLabelW : band - 2;
    const needed = Math.max(
      ...categoryLabels.map((l) => estimateTextWidth(l, LABEL_SIZE))
    );
    const every = horizontal
      ? Math.max(1, Math.ceil((LABEL_SIZE + 2) / Math.max(1, band)))
      : Math.max(1, Math.ceil(Math.min(needed, 80) / Math.max(1, band - 2)));
    const areaEdge = type === "area" && count > 1;
    for (let i = 0; i < count; i += every) {
      const label = truncateText(
        categoryLabels[i],
        horizontal ? maxLabel : Math.max(maxLabel * every, 20),
        LABEL_SIZE
      );
      if (horizontal) {
        out.push(
          svgText(plot.x - 5, bandStart(i) + band / 2, label, {
            size: LABEL_SIZE,
            fill: theme.mutedText,
            anchor: "end",
            baseline: "central",
            family,
          })
        );
      } else {
        const cx = areaEdge
          ? plot.x + (i * plot.width) / (count - 1)
          : bandStart(i) + band / 2;
        out.push(
          svgText(cx, plot.y + plot.height + LABEL_SIZE + 4, label, {
            size: LABEL_SIZE,
            fill: theme.mutedText,
            anchor: "middle",
            family,
          })
        );
      }
    }
  }

  if (leftTitle) {
    const x = area.x + AXIS_TITLE_SIZE / 2 + 2;
    const y = plot.y + plot.height / 2;
    out.push(
      svgText(x, y, truncateText(leftTitle, plot.height, AXIS_TITLE_SIZE), {
        size: AXIS_TITLE_SIZE,
        fill: theme.mutedText,
        anchor: "middle",
        baseline: "central",
        weight: "600",
        rotate: -90,
        family,
      })
    );
  }
  if (bottomTitle) {
    out.push(
      svgText(
        plot.x + plot.width / 2,
        area.y + area.height - 3,
        truncateText(bottomTitle, plot.width, AXIS_TITLE_SIZE),
        {
          size: AXIS_TITLE_SIZE,
          fill: theme.mutedText,
          anchor: "middle",
          weight: "600",
          family,
        }
      )
    );
  }

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
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const radius = Math.max(4, Math.min(area.width, area.height) / 2 - 4);
  const hole = doughnut ? radius * DOUGHNUT_HOLE : 0;
  const ringW = (radius - hole) / rings.length;
  const labels: string[] = [];
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
      const color = pointColor(model, s, i);
      out.push(
        `<path d="${arcPath(
          cx,
          cy,
          r0,
          r1,
          angle,
          angle + sweep
        )}" fill="${escapeXml(color)}" fill-rule="evenodd" stroke="${escapeXml(
          theme.sliceSeparator
        )}" stroke-width="1"/>`
      );
      if (model.dataLabels) {
        const mid = angle + sweep / 2;
        const lr = doughnut ? (r0 + r1) / 2 : radius * 0.65;
        labels.push(
          svgText(
            cx + lr * Math.cos(mid),
            cy + lr * Math.sin(mid),
            dataLabelText(s, i, v),
            {
              size: LABEL_SIZE,
              fill: "#ffffff",
              anchor: "middle",
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
    if (isCartesian(model.type)) renderCartesian(model, area, theme, out);
    else renderPie(model, area, theme, out);
  }

  const label = escapeXml(title || model.type);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${out.join(
    ""
  )}</svg>`;
}
