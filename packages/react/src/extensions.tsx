/**
 * Extension points for the React UI, so features plug in without editing the
 * shared Toolbar and SheetOverlay components:
 *
 * - toolbar items: `registerToolbarItem("insertImage", ({ tooltip }) => ...)`
 *   renders that item wherever its name appears in `settings.toolbarItems`.
 * - sheet overlays: `registerSheetOverlay("traceArrows", TraceArrows)` mounts
 *   a component inside the cell area (positioned like the selection boxes;
 *   use the workbook context for geometry).
 *
 * Canvas cell decorators and keyboard shortcuts live in the core package
 * (`registerCellDecorator`, `registerShortcut`).
 *
 * Built-in features (builtinExtensions.ts) are installed before the first
 * registry access, so a host's own registration under the same name wins.
 */
import React from "react";
import { installBuiltinExtensions } from "./builtinExtensions";

let builtinsInstalled = false;

function ensureBuiltins() {
  if (builtinsInstalled) return;
  builtinsInstalled = true;
  installBuiltinExtensions();
}

export type ToolbarItemRenderer = (props: {
  name: string;
  tooltip: string;
}) => React.ReactNode;

const toolbarItems = new Map<string, ToolbarItemRenderer>();

export function registerToolbarItem(name: string, render: ToolbarItemRenderer) {
  ensureBuiltins();
  toolbarItems.set(name, render);
  return () => {
    if (toolbarItems.get(name) === render) toolbarItems.delete(name);
  };
}

export function getToolbarItemRenderer(name: string) {
  ensureBuiltins();
  return toolbarItems.get(name);
}

type OverlayEntry = { key: string; Component: React.ComponentType };

let overlays: OverlayEntry[] = [];

export function registerSheetOverlay(
  key: string,
  Component: React.ComponentType
) {
  ensureBuiltins();
  overlays = [...overlays.filter((o) => o.key !== key), { key, Component }];
  return () => {
    overlays = overlays.filter(
      (o) => !(o.key === key && o.Component === Component)
    );
  };
}

export function getSheetOverlays(): readonly OverlayEntry[] {
  ensureBuiltins();
  return overlays;
}
