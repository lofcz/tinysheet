import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/** Review (Excel's layout): Comments · Notes · Protect (docs/DESIGN.md). */
export const reviewTab: RibbonTabConfig = {
  id: "review",
  groups: [
    {
      id: "comments",
      icon: "new-comment",
      items: [
        { id: "review-new-comment", size: "large" },
        {
          rows: [
            ["review-delete-comment"],
            ["review-previous-comment"],
            ["review-next-comment"],
          ],
        },
        { id: "review-show-comments", size: "large" },
      ],
    },
    {
      id: "notes",
      icon: "sticky-note",
      items: [{ id: "review-notes", size: "large" }],
    },
    {
      id: "protect",
      icon: "lock",
      items: [
        { id: "protection", size: "large" },
        { id: "protect-workbook", size: "large" },
        { id: "allow-edit-ranges", size: "large" },
      ],
    },
  ],
};
