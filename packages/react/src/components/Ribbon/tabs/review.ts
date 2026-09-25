import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/** Review: Comments · Notes · Protect (docs/DESIGN.md). */
export const reviewTab: RibbonTabConfig = {
  id: "review",
  groups: [
    { id: "comments", icon: "comment", items: ["threaded-comment"] },
    { id: "notes", icon: "sticky-note", items: ["comment"] },
    { id: "protect", icon: "lock", items: ["protection"] },
  ],
};
