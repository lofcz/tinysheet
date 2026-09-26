import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Insert (Excel 365's Insert ribbon, docs/DESIGN.md): Tables ·
 * Illustrations · Charts · Sparklines · Filters · Links · Comments · Text ·
 * Controls. Commands in ../commands/insert.
 */
export const insertTab: RibbonTabConfig = {
  id: "insert",
  groups: [
    {
      id: "tables",
      icon: "table",
      items: [
        { id: "pivotTable", size: "large" },
        { id: "insert-table", size: "large" },
      ],
    },
    {
      id: "illustrations",
      icon: "image",
      items: [
        { id: "pictures", size: "large" },
        { id: "shapes", size: "large" },
        { id: "screenshot", size: "large" },
      ],
    },
    {
      id: "charts",
      icon: "chart",
      items: [
        { id: "recommended-charts", size: "large" },
        {
          rows: [
            ["chart-column", "chart-line", "chart-pie"],
            ["chart-scatter", "chart-other"],
          ],
        },
      ],
    },
    {
      id: "sparklines",
      icon: "sparkline",
      items: [
        { id: "sparkline-line", size: "large" },
        { id: "sparkline-column", size: "large" },
        { id: "sparkline-winloss", size: "large" },
      ],
    },
    { id: "filters", icon: "filter", items: [{ id: "slicer", size: "large" }] },
    { id: "links", icon: "link", items: [{ id: "link", size: "large" }] },
    {
      id: "comments",
      icon: "comment",
      items: [
        { id: "insert-comment", size: "large" },
        { id: "insert-note", size: "large" },
      ],
    },
    {
      id: "text",
      icon: "ts-text",
      items: [
        { id: "text-box", size: "large" },
        { id: "header-footer", size: "large" },
      ],
    },
    {
      id: "controls",
      icon: "checkbox",
      items: [{ id: "checkbox", size: "large" }],
    },
  ],
};
