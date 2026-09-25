import React from "react";
import type {
  Chart,
  ChartGrouping,
  ChartLocale,
  ChartType,
} from "@lofcz/tinysheet-core";

export type ChartTypeOption = {
  key: keyof ChartLocale;
  type: ChartType;
  grouping?: ChartGrouping;
  markers?: boolean;
  scatterLines?: boolean;
};

/** The chart variants offered by the toolbar menu and the editor. */
export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { key: "columnClustered", type: "column", grouping: "clustered" },
  { key: "columnStacked", type: "column", grouping: "stacked" },
  { key: "columnPercent", type: "column", grouping: "percentStacked" },
  { key: "barClustered", type: "bar", grouping: "clustered" },
  { key: "barStacked", type: "bar", grouping: "stacked" },
  { key: "barPercent", type: "bar", grouping: "percentStacked" },
  { key: "line", type: "line", grouping: "clustered", markers: false },
  { key: "lineMarkers", type: "line", grouping: "clustered", markers: true },
  { key: "lineStacked", type: "line", grouping: "stacked", markers: true },
  { key: "area", type: "area", grouping: "clustered" },
  { key: "areaStacked", type: "area", grouping: "stacked" },
  { key: "areaPercent", type: "area", grouping: "percentStacked" },
  { key: "pie", type: "pie" },
  { key: "doughnut", type: "doughnut" },
  { key: "scatter", type: "scatter", markers: true, scatterLines: false },
  { key: "scatterLines", type: "scatter", markers: true, scatterLines: true },
];

/** The menu entry that describes `chart` best. */
export function chartTypeOptionFor(chart: Chart): ChartTypeOption {
  const grouping = chart.grouping ?? "clustered";
  const candidates = CHART_TYPE_OPTIONS.filter(
    (o) =>
      o.type === chart.type && (o.grouping == null || o.grouping === grouping)
  );
  if (chart.type === "line" && grouping === "clustered") {
    return candidates.find((o) => o.markers === (chart.markers !== false))!;
  }
  if (chart.type === "scatter") {
    return candidates.find((o) => o.scatterLines === !!chart.scatterLines)!;
  }
  return candidates[0] ?? CHART_TYPE_OPTIONS[0];
}

/** Small monochrome glyph per chart family (menus, editor). */
export const ChartTypeIcon: React.FC<{ type: ChartType; size?: number }> = ({
  type,
  size = 18,
}) => {
  let body: React.ReactNode;
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
      body = (
        <polyline
          points="4,17 9,11 13,14 20,6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      );
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
