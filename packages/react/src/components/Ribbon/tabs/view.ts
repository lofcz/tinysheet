import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/** View: Show · Window · Appearance (docs/DESIGN.md). */
export const viewTab: RibbonTabConfig = {
  id: "view",
  groups: [
    { id: "show", icon: "eye", items: ["view-options"] },
    { id: "window", icon: "freeze-row-col", items: ["freeze"] },
    { id: "appearance", icon: "fortune-theme-auto", items: ["theme"] },
  ],
};
