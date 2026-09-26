import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * View (Excel's View ribbon, docs/DESIGN.md): Workbook Views · Show ·
 * Zoom · Window · Appearance. Commands in ../commands/view.
 */
export const viewTab: RibbonTabConfig = {
  id: "view",
  groups: [
    {
      id: "workbookViews",
      icon: "ts-workbook-views",
      items: [
        { id: "view-normal", size: "large" },
        { id: "view-page-break", size: "large" },
        { id: "view-page-layout", size: "large" },
      ],
    },
    {
      id: "show",
      icon: "eye",
      items: [
        { rows: [["show-gridlines", "show-formula-bar"], ["show-headings"]] },
      ],
    },
    {
      id: "zoom",
      icon: "ts-zoom",
      items: [
        { id: "zoom", size: "large" },
        { id: "zoom-100", size: "large" },
        { id: "zoom-to-selection", size: "large" },
      ],
    },
    {
      id: "window",
      icon: "freeze-row-col",
      items: [
        { id: "freeze", size: "large" },
        { id: "split", size: "large" },
      ],
    },
    {
      id: "appearance",
      icon: "fortune-theme-auto",
      items: [{ id: "theme", size: "large" }],
    },
  ],
};
