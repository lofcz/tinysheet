import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Page Layout (Excel's Page Layout ribbon, docs/DESIGN.md): Page Setup ·
 * Scale to Fit · Sheet Options. Commands in ../commands/pageLayout.
 */
export const pageLayoutTab: RibbonTabConfig = {
  id: "pageLayout",
  groups: [
    {
      id: "pageSetup",
      icon: "ts-page-setup",
      items: [
        { id: "margins", size: "large" },
        { id: "orientation", size: "large" },
        { id: "paper-size", size: "large" },
        { id: "print-area", size: "large" },
        { id: "breaks", size: "large" },
        { id: "print-titles", size: "large" },
        { rows: [["page-setup"], ["print"]] },
      ],
    },
    {
      id: "scaleToFit",
      icon: "ts-scale-to-fit",
      items: [{ id: "scale-to-fit", size: "large" }],
    },
    {
      id: "sheetOptions",
      icon: "border-all",
      items: [
        { id: "sheet-gridlines", size: "large" },
        { id: "sheet-headings", size: "large" },
      ],
    },
  ],
};
