import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/** Data: Sort & Filter · Data Tools · Outline (docs/DESIGN.md). */
export const dataTab: RibbonTabConfig = {
  id: "data",
  groups: [
    { id: "sortFilter", icon: "sort", items: ["filter"] },
    {
      id: "dataTools",
      icon: "splitColumn",
      items: [{ rows: [["splitColumn", "data-tools"], ["dataVerification"]] }],
    },
    { id: "outline", icon: "group", items: ["outline"] },
  ],
};
