import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Home: Clipboard · Font · Alignment · Number · Styles · Cells · Editing
 * (docs/DESIGN.md). Items are ribbon command ids or legacy toolbar item
 * names; `rows` stacks small items like Excel's two-row groups.
 */
export const homeTab: RibbonTabConfig = {
  id: "home",
  groups: [
    {
      id: "clipboard",
      icon: "paste",
      items: [
        { id: "paste", size: "large" },
        { rows: [["cut", "copy"], ["format-painter"]] },
      ],
    },
    {
      id: "font",
      icon: "bold",
      items: [
        {
          rows: [
            ["font", "font-size"],
            [
              "bold",
              "italic",
              "underline",
              "strike-through",
              "border",
              "background",
              "font-color",
            ],
          ],
        },
      ],
    },
    {
      id: "alignment",
      icon: "align-left",
      items: [
        {
          rows: [
            ["vertical-align", "text-rotation", "text-wrap"],
            ["horizontal-align", "merge-cell"],
          ],
        },
      ],
    },
    {
      id: "number",
      icon: "percentage-format",
      items: [
        {
          rows: [
            ["format"],
            [
              "currency-format",
              "percentage-format",
              "number-decrease",
              "number-increase",
            ],
          ],
        },
      ],
    },
    {
      id: "styles",
      icon: "conditionFormat",
      items: [
        { rows: [["conditionFormat", "formatAsTable"], ["cell-styles"]] },
      ],
    },
    {
      id: "editing",
      icon: "formula-sum",
      items: [
        {
          rows: [
            ["quick-formula", "clear-format"],
            ["filter", "search", "locationCondition"],
          ],
        },
      ],
    },
  ],
};
