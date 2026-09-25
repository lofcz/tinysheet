/**
 * Page layout and printing (Excel's Page Layout tab and File > Print):
 * Page Setup dialog, Print Preview and printing, Page Break Preview.
 *
 * Plugs into the workbook through the extension registries:
 *
 * - toolbar items "pageLayout" (menu) and "print" (Print Preview);
 * - a sheet overlay drawing page breaks and Page Break Preview;
 * - the Ctrl+P shortcut (asks the overlay to open Print Preview).
 *
 * `registerPageLayoutFeature()` is called by the package entry (the package
 * is side-effect free, so importing a module does not register anything).
 */
import { registerShortcut, requestPrintPreview } from "@lofcz/tinysheet-core";
import React from "react";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import PageLayoutOverlay from "./PageBreakOverlay";
import { PageLayoutMenu, PrintButton } from "./ToolbarItems";
import "./index.css";

export { default as PageSetupDialog } from "./PageSetupDialog";
export type { PageSetupTab } from "./PageSetupDialog";
export { default as PrintPreview } from "./PrintPreview";
export { usePageLayoutDialogs } from "./dialogs";
export { PageLayoutMenu, PrintButton, PageLayoutOverlay };

let unregister: (() => void) | null = null;

/** Registers the page layout toolbar items, overlay and Ctrl+P (idempotent). */
export function registerPageLayoutFeature() {
  if (unregister) return unregister;
  const offs = [
    registerToolbarItem("pageLayout", () => <PageLayoutMenu />),
    registerToolbarItem("print", () => <PrintButton />),
    registerSheetOverlay("pageLayout", PageLayoutOverlay),
    registerShortcut("pageLayout.print", {
      key: "p",
      mod: true,
      handler: (ctx) => {
        requestPrintPreview(ctx);
      },
    }),
  ];
  unregister = () => {
    offs.forEach((off) => off());
    unregister = null;
  };
  return unregister;
}
