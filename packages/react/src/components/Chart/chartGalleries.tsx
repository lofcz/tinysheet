/**
 * Chart galleries shared by the Chart Design tab and the Chart Styles
 * button next to a chart: styles, colour palettes (Change Colors) and the
 * previews of a variant of the chart.
 */
import React, { useContext } from "react";
import _ from "lodash";
import {
  Chart,
  CHART_PALETTES,
  chartHasAxes,
  chartToolsLocale,
  getChartStyle,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { Tooltip } from "../ui";

/** Apply chart style `id` (Chart Styles gallery). */
export function applyChartStyle(c: Chart, id: number) {
  c.style = id;
  const { flags } = getChartStyle(id);
  if (flags?.gridlines != null && chartHasAxes(c.type))
    c.gridlines = flags.gridlines;
  if (flags?.dataLabels != null) c.dataLabels = flags.dataLabels;
  if (flags?.legend) c.legend = flags.legend;
}

/** Apply a colour palette (Change Colors): explicit colours give way. */
export function applyChartPalette(c: Chart, id: string) {
  c.palette = id;
  c.series.forEach((s) => {
    delete s.color;
    delete s.pointColors;
  });
}

/** A copy of `chart` with `recipe` applied (gallery previews). */
export function variant(chart: Chart, recipe: (c: Chart) => void): Chart {
  const copy: Chart = _.cloneDeep(chart);
  recipe(copy);
  return copy;
}

export const fill = (text: string, n: number | string) =>
  text.replace("{n}", String(n));

/** The palettes of Change Colors, grouped Colorful / Monochromatic. */
export const PaletteList: React.FC<{
  chart: Chart;
  onPick: (id: string) => void;
  onPreview: (id: string | null) => void;
}> = ({ chart, onPick, onPreview }) => {
  const { context } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const current = chart.palette ?? "colorful1";
  const groups = [
    {
      kind: "colorful",
      label: t.design.colorful,
      name: t.design.colorfulPalette,
    },
    {
      kind: "monochromatic",
      label: t.design.monochromatic,
      name: t.design.monochromaticPalette,
    },
  ] as const;
  return (
    <div
      className="ts-chart-palettes"
      role="listbox"
      aria-label={t.design.changeColors}
      onMouseLeave={() => onPreview(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>("[role=option]")
        );
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next =
          items[
            (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
          ];
        e.preventDefault();
        next?.focus();
      }}
    >
      {groups.map((g) => {
        const palettes = CHART_PALETTES.filter((p) => p.kind === g.kind);
        return (
          <div key={g.kind} className="ts-chart-palette-group">
            <div className="ts-chart-palette-heading">{g.label}</div>
            {palettes.map((p, i) => (
              <Tooltip
                key={p.id}
                label={fill(g.name, i + 1)}
                placement="right-start"
              >
                <div
                  role="option"
                  aria-selected={p.id === current}
                  aria-label={fill(g.name, i + 1)}
                  tabIndex={p.id === current ? 0 : -1}
                  className="ts-chart-palette"
                  data-palette={p.id}
                  onMouseEnter={() => onPreview(p.id)}
                  onFocus={() => onPreview(p.id)}
                  onClick={() => onPick(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(p.id);
                    }
                  }}
                >
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      className="ts-chart-palette-swatch"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </Tooltip>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/** A chart's style thumbnails (no titles, legend or labels). */
export function styleThumb(chart: Chart, id: number): Chart {
  return variant(chart, (c) => {
    applyChartStyle(c, id);
    c.title = "";
    c.categoryAxisTitle = "";
    c.valueAxisTitle = "";
    c.legend = "none";
    delete c.dataTable;
  });
}
