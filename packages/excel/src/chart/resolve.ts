import type {
  ChartCellResolver,
  ChartSeriesPoint,
  FortuneChartSpec,
  FortuneChartSeriesSpec,
} from "./types";
import { DEFAULT_CHART_COLORS } from "./types";

export function parseChartNumber(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return 0;
  }
  const parsed = parseFloat(String(value).replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
}

function firstDisplay(
  resolver: ChartCellResolver,
  reference: string | undefined,
  fallback = ""
) {
  if (reference == null || reference === "") {
    return fallback;
  }
  const cells = resolver(reference);
  if (cells.length === 0) {
    return fallback;
  }
  return cells[0].display || fallback;
}

function resolveDisplays(
  resolver: ChartCellResolver,
  reference: string | undefined,
  cached: string[] | undefined
) {
  if (reference) {
    const cells = resolver(reference);
    if (cells.length > 0) {
      return cells.map((cell) => cell.display || "");
    }
  }
  return cached ? cached.slice() : [];
}

function resolveNumerics(
  resolver: ChartCellResolver,
  reference: string | undefined,
  cached: number[] | undefined
) {
  if (reference) {
    const cells = resolver(reference);
    if (cells.length > 0) {
      return cells.map((cell) =>
        cell.numeric != null ? cell.numeric : parseChartNumber(cell.display)
      );
    }
  }
  return cached ? cached.slice() : [];
}

function colorForCategoryPoint(
  spec: FortuneChartSeriesSpec,
  pointIndex: number,
  varyColors: boolean
) {
  const fromPoint = spec.pointColors?.[pointIndex];
  if (fromPoint) {
    return fromPoint;
  }
  if (varyColors) {
    return DEFAULT_CHART_COLORS[pointIndex % DEFAULT_CHART_COLORS.length];
  }
  return spec.color;
}

function resolveCategorySeries(
  spec: FortuneChartSeriesSpec,
  resolver: ChartCellResolver,
  varyColors: boolean
): ChartSeriesPoint[] {
  const labels = resolveDisplays(
    resolver,
    spec.categoryRef,
    spec.cachedCategories
  );
  const values = resolveNumerics(resolver, spec.valueRef, spec.cachedValues);
  const pointCount = Math.max(labels.length, values.length);

  if (pointCount <= 1) {
    return [];
  }

  const points: ChartSeriesPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    let label = i < labels.length ? labels[i] : "";
    if (label === "") {
      label = "Point " + (i + 1);
    }
    points.push({
      label,
      value: i < values.length ? values[i] : 0,
      color: colorForCategoryPoint(spec, i, varyColors),
    });
  }
  return points;
}

function resolveSingleSeries(
  spec: FortuneChartSeriesSpec,
  resolver: ChartCellResolver,
  index: number
): ChartSeriesPoint {
  let label = spec.title || "";
  if (label === "" && spec.titleRef) {
    label = firstDisplay(resolver, spec.titleRef, "");
  }
  if (label === "") {
    label = "Series " + (index + 1);
  }

  const values = resolveNumerics(resolver, spec.valueRef, spec.cachedValues);
  const value = values.length > 0 ? values[0] : 0;

  return { label, value, color: spec.color };
}

/** Resolve a chart spec to plottable series using live cells and/or OOXML caches. */
export function resolveChartSpecToSeries(
  spec: FortuneChartSpec,
  resolver: ChartCellResolver
): ChartSeriesPoint[] {
  const series: ChartSeriesPoint[] = [];
  // Excel-like default: a single category series varies point colors unless
  // the chart explicitly disables it.
  const varyColors =
    spec.varyColors !== false &&
    spec.series.filter((s) => s.mode === "category").length === 1;

  for (let i = 0; i < spec.series.length; i++) {
    const item = spec.series[i];
    if (item.mode === "category") {
      const points = resolveCategorySeries(item, resolver, varyColors);
      if (points.length > 0) {
        for (let p = 0; p < points.length; p++) {
          series.push(points[p]);
        }
        continue;
      }
    }
    series.push(resolveSingleSeries(item, resolver, i));
  }

  return series;
}
