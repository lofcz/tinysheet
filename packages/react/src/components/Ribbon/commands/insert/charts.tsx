/**
 * Insert › Charts: Recommended Charts (the Insert Chart dialog) and one
 * small split button per chart family (Excel's Column or Bar, Line or
 * Area, Pie or Doughnut, Scatter or Bubble, and the other types): the
 * button inserts the family's first chart, the arrow opens its gallery.
 */
import React, { useContext } from "react";
import {
  ChartBarBig,
  ChartColumnBig,
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  ChartScatter,
} from "lucide-react";
import { locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { Icon, Tooltip } from "../../../ui";
import type { LucideIcon } from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { Cmd, RecommendedChartIcon, useTabsText } from "../tabsCommon";
import { ChartGlyph } from "./chartGlyphs";
import { useInsertChartDialog } from "./chartDialog";
import { optionByKey, optionLabel, useInsertChart } from "./chartCommon";

export type ChartFamilyId = "column" | "line" | "pie" | "scatter" | "other";

type GallerySection = { id: string; keys: string[] };

/** The families of the Charts group and the sections of their galleries. */
export const CHART_FAMILIES: {
  id: ChartFamilyId;
  icon: LucideIcon;
  label:
    | "chartColumn"
    | "chartLine"
    | "chartPie"
    | "chartScatter"
    | "chartOther";
  tip:
    | "chartColumnTip"
    | "chartLineTip"
    | "chartPieTip"
    | "chartScatterTip"
    | "chartOtherTip";
  sections: GallerySection[];
}[] = [
  {
    id: "column",
    icon: ChartColumnBig,
    label: "chartColumn",
    tip: "chartColumnTip",
    sections: [
      {
        id: "column2d",
        keys: ["columnClustered", "columnStacked", "columnPercent"],
      },
      { id: "bar2d", keys: ["barClustered", "barStacked", "barPercent"] },
    ],
  },
  {
    id: "line",
    icon: ChartLine,
    label: "chartLine",
    tip: "chartLineTip",
    sections: [
      { id: "line2d", keys: ["line", "lineMarkers", "lineStacked"] },
      { id: "area2d", keys: ["area", "areaStacked", "areaPercent"] },
    ],
  },
  {
    id: "pie",
    icon: ChartPie,
    label: "chartPie",
    tip: "chartPieTip",
    sections: [
      { id: "pie2d", keys: ["pie"] },
      { id: "doughnut", keys: ["doughnut"] },
    ],
  },
  {
    id: "scatter",
    icon: ChartScatter,
    label: "chartScatter",
    tip: "chartScatterTip",
    sections: [
      { id: "scatter", keys: ["scatter", "scatterLines"] },
      { id: "bubble", keys: ["bubble"] },
    ],
  },
  {
    id: "other",
    icon: ChartNoAxesCombined,
    label: "chartOther",
    tip: "chartOtherTip",
    sections: [
      { id: "waterfall", keys: ["waterfall", "funnel"] },
      { id: "statistic", keys: ["histogram", "pareto"] },
      { id: "stock", keys: ["stockHLC", "stockOHLC"] },
      { id: "radar", keys: ["radar", "radarMarkers", "radarFilled"] },
      {
        id: "combo",
        keys: [
          "comboColumnLine",
          "comboColumnLineSecondary",
          "comboAreaColumn",
        ],
      },
    ],
  },
];

/** The gallery of a family: sections of thumbnails, then More Charts. */
const ChartGallery: React.FC<{
  family: (typeof CHART_FAMILIES)[number];
  onPick: (key: string) => void;
  onMore: () => void;
}> = ({ family, onPick, onMore }) => {
  const { context } = useContext(WorkbookContext);
  const t = locale(context).chart;
  const tt = useTabsText();
  const d = tt.chartDialog.descriptions;
  // Left / Right move between the tiles (Up / Down: the popover's menu keys)
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tiles = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")
    );
    const i = tiles.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? i + 1 : i - 1;
    tiles[(next + tiles.length) % tiles.length]?.focus();
  };
  return (
    <div
      className="ts-chart-gallery"
      role="menu"
      aria-label={tt.insert[family.label]}
      data-chart-family={family.id}
      onKeyDown={onKeyDown}
    >
      {family.sections.map((section) => (
        <div className="ts-chart-gallery-section" key={section.id}>
          <div className="ts-chart-gallery-title">
            {tt.insert.galleryGroups[section.id]}
          </div>
          <div className="ts-chart-gallery-tiles">
            {section.keys.map((key) => (
              <Tooltip
                key={key}
                label={optionLabel(t, key)}
                description={d[key]}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="ts-chart-gallery-tile"
                  aria-label={optionLabel(t, key)}
                  data-chart-option={key}
                  disabled={context.allowEdit === false}
                  onClick={() => onPick(key)}
                >
                  <ChartGlyph optionKey={key} />
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
      <div className="ts-chart-gallery-footer">
        <button
          type="button"
          role="menuitem"
          className="ts-chart-gallery-more"
          onClick={onMore}
        >
          <Icon icon={ChartBarBig} />
          <span>{tt.insert.moreCharts}</span>
        </button>
      </div>
    </div>
  );
};

/** Insert › Charts › Recommended Charts (the Insert Chart dialog). */
export const RecommendedChartsCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const { context } = useContext(WorkbookContext);
  const tt = useTabsText().insert;
  const openDialog = useInsertChartDialog();
  return (
    <Cmd
      size={size}
      icon={RecommendedChartIcon}
      label={tt.recommendedCharts}
      description={tt.recommendedChartsTip}
      disabled={context.allowEdit === false}
      onClick={() => openDialog("recommended")}
    />
  );
};

/** One chart family: split button (insert the first type | gallery). */
export const ChartFamilyCommand: React.FC<
  RibbonCommandProps & { family: ChartFamilyId }
> = ({ family: id }) => {
  const { context } = useContext(WorkbookContext);
  const tt = useTabsText().insert;
  const insert = useInsertChart();
  const openDialog = useInsertChartDialog();
  const family = CHART_FAMILIES.find((f) => f.id === id)!;
  const first = family.sections[0].keys[0];
  return (
    <Cmd
      size="small"
      icon={family.icon}
      label={tt[family.label]}
      description={tt[family.tip]}
      disabled={context.allowEdit === false}
      onClick={() => insert(optionByKey(first))}
      popover={(close) => (
        <ChartGallery
          family={family}
          onPick={(key) => {
            close();
            insert(optionByKey(key));
          }}
          onMore={() => {
            close();
            openDialog("all", first);
          }}
        />
      )}
    />
  );
};

/** Registered components per family id (`chart-column`, ...). */
export const chartFamilyCommands = CHART_FAMILIES.map((f) => {
  const C: React.FC<RibbonCommandProps> = (props) => (
    <ChartFamilyCommand {...props} family={f.id} />
  );
  C.displayName = `ChartFamily(${f.id})`;
  return { id: `chart-${f.id}`, Component: C };
});
