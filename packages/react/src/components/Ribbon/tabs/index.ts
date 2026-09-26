import type { RibbonTabConfig } from "@lofcz/tinysheet-core";
import { homeTab } from "./home";
import { insertTab } from "./insert";
import { pageLayoutTab } from "./pageLayout";
import { formulasTab } from "./formulas";
import { dataTab } from "./data";
import { reviewTab } from "./review";
import { viewTab } from "./view";

/**
 * The default ribbon, one file per tab so each tab evolves on its own.
 * Undo / Redo live in the quick access cluster of the tab row and File is
 * the menu left of the tabs (see ../Ribbon.tsx).
 */
export const defaultRibbon: RibbonTabConfig[] = [
  homeTab,
  insertTab,
  pageLayoutTab,
  formulasTab,
  dataTab,
  reviewTab,
  viewTab,
];

/** Items of the quick access cluster (right of the tabs). */
export const quickAccessItems = ["undo", "redo"];
