import { Context, locale } from "@lofcz/tinysheet-core";

/**
 * Strings of the redesigned menus and pickers that the core locale does
 * not have yet (English; a locale can provide `menus` with the same keys).
 */
const EN = {
  cellMenu: "Cell",
  rowMenu: "Row",
  columnMenu: "Column",
  pictureMenu: "Picture",
  sheetTabMenu: "Sheet tab",
  chartMenu: "Chart",
  shapeMenu: "Shape",
  slicerMenu: "Slicer",
  pasteOptions: "Paste Options:",
  pasteAll: "Paste",
  pasteValues: "Values",
  pasteFormulas: "Formulas",
  pasteTranspose: "Transpose",
  pasteFormatting: "Formatting",
  pasteLink: "Paste Link",
  noColor: "No Color",
  automatic: "Automatic",
  noFill: "No Fill",
  moreColors: "More Colors…",
  tabColor: "Tab Color",
};

export type MenuText = typeof EN;

export function menuText(ctx: Context): MenuText {
  const extra = (locale(ctx) as { menus?: Partial<MenuText> }).menus;
  return extra ? { ...EN, ...extra } : EN;
}
