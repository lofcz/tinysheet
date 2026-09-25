import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Data (Excel's layout): Sort & Filter · Data Tools · Forecast · Outline
 * (docs/DESIGN.md).
 */
export const dataTab: RibbonTabConfig = {
  id: "data",
  groups: [
    {
      id: "sortFilter",
      icon: "sort",
      items: [
        { rows: [["data-sort-asc"], ["data-sort-desc"]] },
        { id: "data-sort", size: "large" },
        { id: "data-filter", size: "large" },
        {
          rows: [
            ["data-filter-clear"],
            ["data-filter-reapply"],
            ["data-filter-advanced"],
          ],
        },
      ],
    },
    {
      id: "dataTools",
      icon: "splitColumn",
      items: [
        { id: "splitColumn", size: "large" },
        {
          rows: [["flash-fill"], ["remove-duplicates"], ["dataVerification"]],
        },
      ],
    },
    {
      id: "forecast",
      icon: "what-if",
      items: [{ id: "data-tools", size: "large" }],
    },
    {
      id: "outline",
      icon: "group",
      items: [
        { id: "outline", size: "large" },
        { id: "outline-ungroup", size: "large" },
        { id: "outline-subtotal", size: "large" },
        { rows: [["outline-show-detail"], ["outline-hide-detail"]] },
      ],
    },
  ],
};
