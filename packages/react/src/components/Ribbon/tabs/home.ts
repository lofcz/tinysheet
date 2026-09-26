import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Home: Clipboard · Font · Alignment · Number · Styles · Cells · Editing,
 * in Excel's order and arrangement (docs/DESIGN.md). The commands live in
 * ../commands/home (and ../commands/clipboard.tsx); `rows` stacks small
 * items like Excel's two-row groups, `size: "large"` is an icon over its
 * label.
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
            ["font", "font-size", "font-grow", "font-shrink"],
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
            [
              "horizontal-align",
              "indent-decrease",
              "indent-increase",
              "merge-cell",
            ],
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
              "comma-style",
              "number-increase",
              "number-decrease",
            ],
          ],
        },
      ],
    },
    {
      id: "styles",
      icon: "conditionFormat",
      items: [
        { id: "conditionFormat", size: "large" },
        { id: "formatAsTable", size: "large" },
        { id: "cell-styles", size: "large" },
      ],
    },
    {
      id: "cells",
      icon: "home-cells",
      items: [
        { id: "cells-insert", size: "large" },
        { id: "cells-delete", size: "large" },
        { id: "cells-format", size: "large" },
      ],
    },
    {
      id: "editing",
      icon: "formula-sum",
      items: [
        { rows: [["autosum"], ["fill", "clear-format"]] },
        { id: "sort-filter", size: "large" },
        { id: "search", size: "large" },
      ],
    },
  ],
};
