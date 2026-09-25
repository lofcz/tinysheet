import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Insert: Tables · Illustrations · Charts · Sparklines · Filters · Links ·
 * Comments · Controls (docs/DESIGN.md).
 */
export const insertTab: RibbonTabConfig = {
  id: "insert",
  groups: [
    { id: "tables", icon: "table", items: ["pivotTable", "formatAsTable"] },
    {
      id: "illustrations",
      icon: "image",
      items: [
        {
          rows: [
            ["image", "picture-in-cell"],
            ["shapes", "screenshot"],
          ],
        },
      ],
    },
    { id: "charts", icon: "chart", items: ["chart"] },
    { id: "sparklines", icon: "sparkline", items: ["sparkline"] },
    { id: "filters", icon: "filter", items: ["slicer"] },
    { id: "links", icon: "link", items: ["link"] },
    { id: "comments", icon: "comment", items: ["threaded-comment", "comment"] },
    { id: "controls", icon: "checkbox", items: ["checkbox"] },
  ],
};
