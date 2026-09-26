import type { ChartToolsLocale, RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Chart Design (Excel 365's contextual tab while a chart is selected):
 * Chart Layouts · Chart Styles · Data · Type · Location. Commands in
 * ../commands/chart.
 */
export const chartDesignTab = (t: ChartToolsLocale): RibbonTabConfig => ({
  id: "chartDesign",
  label: t.contextual.chartDesign,
  groups: [
    {
      id: "chartLayouts",
      label: t.groups.chartLayouts,
      icon: "chart",
      items: [
        { id: "chart-add-element", size: "large" },
        { id: "chart-quick-layout", size: "large" },
      ],
    },
    {
      id: "chartStyles",
      label: t.groups.chartStyles,
      icon: "chart",
      items: [
        { id: "chart-change-colors", size: "large" },
        { id: "chart-styles", size: "large" },
      ],
    },
    {
      id: "chartData",
      label: t.groups.data,
      icon: "chart",
      items: [
        { id: "chart-switch-row-column", size: "large" },
        { id: "chart-select-data", size: "large" },
      ],
    },
    {
      id: "chartType",
      label: t.groups.type,
      icon: "chart",
      items: [{ id: "chart-change-type", size: "large" }],
    },
    {
      id: "chartLocation",
      label: t.groups.location,
      icon: "chart",
      items: [{ id: "chart-move", size: "large" }],
    },
  ],
});

/**
 * Format (for the selected chart element): Current Selection · Shape
 * Styles · WordArt Styles · Arrange · Size.
 */
export const chartFormatTab = (t: ChartToolsLocale): RibbonTabConfig => ({
  id: "chartFormat",
  label: t.contextual.format,
  groups: [
    {
      id: "chartCurrentSelection",
      label: t.groups.currentSelection,
      icon: "chart",
      items: [
        {
          rows: [
            ["chart-element-select"],
            ["chart-format-selection", "chart-reset-style"],
          ],
        },
      ],
    },
    {
      id: "chartInsertShapes",
      label: t.groups.insertShapes,
      icon: "chart",
      items: [
        { id: "chart-insert-shapes", size: "large" },
        { rows: [["chart-edit-shape"], ["chart-text-box"]] },
      ],
    },
    {
      id: "chartShapeStyles",
      label: t.groups.shapeStyles,
      icon: "chart",
      items: [
        { id: "chart-shape-styles", size: "large" },
        {
          rows: [
            ["chart-shape-fill", "chart-shape-outline"],
            ["chart-shape-effects"],
          ],
        },
      ],
    },
    {
      id: "chartWordArt",
      label: t.groups.wordArtStyles,
      icon: "chart",
      items: [
        { id: "chart-wordart-styles", size: "large" },
        {
          rows: [
            ["chart-text-fill"],
            ["chart-text-outline"],
            ["chart-text-effects"],
          ],
        },
      ],
    },
    {
      id: "chartArrange",
      label: t.groups.arrange,
      icon: "chart",
      items: [
        {
          rows: [
            ["chart-bring-forward", "chart-send-backward"],
            ["chart-align", "chart-group", "chart-rotate"],
          ],
        },
      ],
    },
    {
      id: "chartSize",
      label: t.groups.size,
      icon: "chart",
      items: [{ rows: [["chart-height"], ["chart-width"]] }],
    },
  ],
});

/**
 * Shape Format: charts and shapes selected together (Excel shows it for a
 * multi-selection): Arrange (Align, Group, Rotate).
 */
export const shapeFormatTab = (t: ChartToolsLocale): RibbonTabConfig => ({
  id: "shapeFormat",
  label: t.contextual.shapeFormat,
  groups: [
    {
      id: "shapeArrange",
      label: t.groups.arrange,
      icon: "chart",
      items: [
        { id: "chart-align", size: "large" },
        { id: "chart-group", size: "large" },
        { id: "chart-rotate", size: "large" },
      ],
    },
  ],
});
