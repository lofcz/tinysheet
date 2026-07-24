import {
  renderChartSvgFromSeries,
  svgToDataUri,
} from "./render";
import { resolveChartSpecToSeries } from "./resolve";
import type { ChartCellResolver, FortuneChartSpec } from "./types";

export function refreshSheetChartImages<T extends { src?: string; chartSpec?: FortuneChartSpec }>(
  images: T[] | undefined,
  resolver: ChartCellResolver
): T[] | undefined {
  if (images == null || images.length === 0) {
    return images;
  }

  return images.map((image) => {
    const spec = image.chartSpec;
    if (spec == null || spec.type !== "bar") {
      return image;
    }

    const series = resolveChartSpecToSeries(spec, resolver);
    const svg = renderChartSvgFromSeries(series, spec.width, spec.height, {
      title: spec.title,
      categoryAxisTitle: spec.categoryAxisTitle,
      valueAxisTitle: spec.valueAxisTitle,
      valueAxis: spec.valueAxis,
    });
    return {
      ...image,
      src: svgToDataUri(svg),
      chartSpec: spec,
    };
  });
}
