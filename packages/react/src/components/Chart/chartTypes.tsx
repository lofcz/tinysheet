import React from "react";
import type {
  Chart,
  ChartGrouping,
  ChartLocale,
  ChartRadarStyle,
  ChartStockVariant,
  ChartType,
} from "@lofcz/tinysheet-core";

export type ChartTypeGroup =
  | "groupColumnBar"
  | "groupLineArea"
  | "groupPie"
  | "groupScatter"
  | "groupStatistical"
  | "groupOther";

export type ChartTypeOption = {
  key: keyof ChartLocale;
  group: ChartTypeGroup;
  type: ChartType;
  grouping?: ChartGrouping;
  markers?: boolean;
  scatterLines?: boolean;
  radarStyle?: ChartRadarStyle;
  stockVariant?: ChartStockVariant;
  /** Combo presets. */
  combo?: "columnLine" | "columnLineSecondary" | "areaColumn";
};

/** The chart variants offered by the toolbar menu and the editor. */
export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  {
    key: "columnClustered",
    group: "groupColumnBar",
    type: "column",
    grouping: "clustered",
  },
  {
    key: "columnStacked",
    group: "groupColumnBar",
    type: "column",
    grouping: "stacked",
  },
  {
    key: "columnPercent",
    group: "groupColumnBar",
    type: "column",
    grouping: "percentStacked",
  },
  {
    key: "barClustered",
    group: "groupColumnBar",
    type: "bar",
    grouping: "clustered",
  },
  {
    key: "barStacked",
    group: "groupColumnBar",
    type: "bar",
    grouping: "stacked",
  },
  {
    key: "barPercent",
    group: "groupColumnBar",
    type: "bar",
    grouping: "percentStacked",
  },
  {
    key: "line",
    group: "groupLineArea",
    type: "line",
    grouping: "clustered",
    markers: false,
  },
  {
    key: "lineMarkers",
    group: "groupLineArea",
    type: "line",
    grouping: "clustered",
    markers: true,
  },
  {
    key: "lineStacked",
    group: "groupLineArea",
    type: "line",
    grouping: "stacked",
    markers: true,
  },
  { key: "area", group: "groupLineArea", type: "area", grouping: "clustered" },
  {
    key: "areaStacked",
    group: "groupLineArea",
    type: "area",
    grouping: "stacked",
  },
  {
    key: "areaPercent",
    group: "groupLineArea",
    type: "area",
    grouping: "percentStacked",
  },
  { key: "pie", group: "groupPie", type: "pie" },
  { key: "doughnut", group: "groupPie", type: "doughnut" },
  {
    key: "scatter",
    group: "groupScatter",
    type: "scatter",
    markers: true,
    scatterLines: false,
  },
  {
    key: "scatterLines",
    group: "groupScatter",
    type: "scatter",
    markers: true,
    scatterLines: true,
  },
  { key: "bubble", group: "groupScatter", type: "bubble" },
  { key: "histogram", group: "groupStatistical", type: "histogram" },
  { key: "pareto", group: "groupStatistical", type: "pareto" },
  { key: "waterfall", group: "groupOther", type: "waterfall" },
  { key: "funnel", group: "groupOther", type: "funnel" },
  {
    key: "stockHLC",
    group: "groupOther",
    type: "stock",
    stockVariant: "hlc",
  },
  {
    key: "stockOHLC",
    group: "groupOther",
    type: "stock",
    stockVariant: "ohlc",
  },
  { key: "radar", group: "groupOther", type: "radar", radarStyle: "line" },
  {
    key: "radarMarkers",
    group: "groupOther",
    type: "radar",
    radarStyle: "marker",
  },
  {
    key: "radarFilled",
    group: "groupOther",
    type: "radar",
    radarStyle: "filled",
  },
  {
    key: "comboColumnLine",
    group: "groupOther",
    type: "combo",
    grouping: "clustered",
    combo: "columnLine",
  },
  {
    key: "comboColumnLineSecondary",
    group: "groupOther",
    type: "combo",
    grouping: "clustered",
    combo: "columnLineSecondary",
  },
  {
    key: "comboAreaColumn",
    group: "groupOther",
    type: "combo",
    grouping: "clustered",
    combo: "areaColumn",
  },
];

export const CHART_TYPE_GROUPS: ChartTypeGroup[] = [
  "groupColumnBar",
  "groupLineArea",
  "groupPie",
  "groupScatter",
  "groupStatistical",
  "groupOther",
];

/**
 * Apply the variant details of `option` (markers, scatter lines, radar and
 * stock variants, combo series types) to a chart already of its type.
 */
export function applyChartTypeOption(chart: Chart, option: ChartTypeOption) {
  if (option.markers != null) chart.markers = option.markers;
  if (option.type === "scatter") chart.scatterLines = !!option.scatterLines;
  if (option.radarStyle) chart.radarStyle = option.radarStyle;
  if (option.stockVariant) chart.stockVariant = option.stockVariant;
  if (option.combo) {
    chart.series.forEach((s, i) => {
      if (option.combo === "areaColumn") s.type = i === 0 ? "area" : "column";
      else s.type = i === 0 ? "column" : "line";
      if (option.combo === "columnLineSecondary")
        s.secondary = i === chart.series.length - 1 && i > 0;
      else delete s.secondary;
    });
  }
}

/** The menu entry that describes `chart` best. */
export function chartTypeOptionFor(chart: Chart): ChartTypeOption {
  const grouping = chart.grouping ?? "clustered";
  const candidates = CHART_TYPE_OPTIONS.filter(
    (o) =>
      o.type === chart.type && (o.grouping == null || o.grouping === grouping)
  );
  let found: ChartTypeOption | undefined;
  if (chart.type === "line" && grouping === "clustered") {
    found = candidates.find((o) => o.markers === (chart.markers !== false));
  } else if (chart.type === "scatter") {
    found = candidates.find((o) => o.scatterLines === !!chart.scatterLines);
  } else if (chart.type === "radar") {
    found = candidates.find(
      (o) => o.radarStyle === (chart.radarStyle ?? "marker")
    );
  } else if (chart.type === "stock") {
    found = candidates.find(
      (o) => o.stockVariant === (chart.stockVariant ?? "hlc")
    );
  } else if (chart.type === "combo") {
    let combo: ChartTypeOption["combo"] = "columnLine";
    if (chart.series[0]?.type === "area") combo = "areaColumn";
    else if (chart.series.some((s) => s.secondary))
      combo = "columnLineSecondary";
    found = CHART_TYPE_OPTIONS.find((o) => o.combo === combo);
  }
  return found ?? candidates[0] ?? CHART_TYPE_OPTIONS[0];
}

/** Small monochrome glyph per chart family (menus, editor). */
export const ChartTypeIcon: React.FC<{ type: ChartType; size?: number }> = ({
  type,
  size = 18,
}) => {
  let body: React.ReactNode;
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "bar":
      body = (
        <>
          <rect x="4" y="5" width="10" height="3" />
          <rect x="4" y="10.5" width="15" height="3" />
          <rect x="4" y="16" width="7" height="3" />
        </>
      );
      break;
    case "line":
      body = <polyline points="4,17 9,11 13,14 20,6" {...stroke} />;
      break;
    case "area":
      body = <polygon points="4,19 4,14 9,9 13,12 20,6 20,19" />;
      break;
    case "pie":
      body = (
        <>
          <path d="M11 4a8 8 0 1 0 8 8h-8z" />
          <path d="M13 2.5v7.5h7.5A7.5 7.5 0 0 0 13 2.5z" />
        </>
      );
      break;
    case "doughnut":
      body = (
        <path
          fillRule="evenodd"
          d="M12 4a8 8 0 1 1 0 16a8 8 0 0 1 0-16zm0 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z"
        />
      );
      break;
    case "scatter":
      body = (
        <>
          <circle cx="7" cy="16" r="1.8" />
          <circle cx="10" cy="11" r="1.8" />
          <circle cx="14" cy="13" r="1.8" />
          <circle cx="17" cy="7" r="1.8" />
          <path d="M3 3v18h18" fill="none" stroke="currentColor" />
        </>
      );
      break;
    case "bubble":
      body = (
        <>
          <circle cx="8" cy="15" r="3" />
          <circle cx="15.5" cy="8.5" r="4.5" />
          <circle cx="17" cy="17" r="1.8" />
          <path d="M3 3v18h18" fill="none" stroke="currentColor" />
        </>
      );
      break;
    case "combo":
      body = (
        <>
          <rect x="5" y="12" width="3" height="7" />
          <rect x="10.5" y="9" width="3" height="10" />
          <rect x="16" y="13" width="3" height="6" />
          <polyline points="4,9 9,5 14,7 20,3" {...stroke} strokeWidth={1.6} />
        </>
      );
      break;
    case "radar":
      body = (
        <>
          <polygon
            points="12,3 20.5,9.2 17.3,19.3 6.7,19.3 3.5,9.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <polygon points="12,6.5 17,10.4 15,16 9.5,17 6.5,10" />
        </>
      );
      break;
    case "waterfall":
      body = (
        <>
          <rect x="3" y="11" width="3.5" height="9" />
          <rect x="7.5" y="6" width="3.5" height="5" />
          <rect x="12" y="6" width="3.5" height="4" opacity="0.6" />
          <rect x="16.5" y="10" width="3.5" height="10" />
        </>
      );
      break;
    case "histogram":
      body = (
        <>
          <rect x="3" y="13" width="4.5" height="7" />
          <rect x="7.5" y="6" width="4.5" height="14" />
          <rect x="12" y="9" width="4.5" height="11" />
          <rect x="16.5" y="15" width="4.5" height="5" />
        </>
      );
      break;
    case "pareto":
      body = (
        <>
          <rect x="3" y="7" width="4.5" height="13" />
          <rect x="8" y="12" width="4.5" height="8" />
          <rect x="13" y="15" width="4.5" height="5" />
          <polyline
            points="5,8 10,5 15,3.5 20,3"
            {...stroke}
            strokeWidth={1.6}
          />
        </>
      );
      break;
    case "funnel":
      body = (
        <>
          <rect x="3" y="4" width="18" height="4" />
          <rect x="6" y="10" width="12" height="4" />
          <rect x="9" y="16" width="6" height="4" />
        </>
      );
      break;
    case "stock":
      body = (
        <>
          <path d="M7 3v18M17 5v15" stroke="currentColor" strokeWidth="1.2" />
          <rect x="5" y="7" width="4" height="8" />
          <rect
            x="15"
            y="8"
            width="4"
            height="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path d="M12 6v12" stroke="currentColor" strokeWidth="1.2" />
        </>
      );
      break;
    default:
      body = (
        <>
          <rect x="5" y="10" width="3" height="9" />
          <rect x="10.5" y="5" width="3" height="14" />
          <rect x="16" y="13" width="3" height="6" />
        </>
      );
  }
  return (
    <svg
      className="fortune-chart-type-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
};
