import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/** Page Layout: Page Setup · Sheet Options (docs/DESIGN.md). */
export const pageLayoutTab: RibbonTabConfig = {
  id: "pageLayout",
  groups: [
    { id: "pageSetup", icon: "print", items: ["pageLayout", "print"] },
    { id: "sheetOptions", icon: "border-all", items: ["view-options"] },
  ],
};
