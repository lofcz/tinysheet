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
 * (`registerCellDecorator`, `registerShortcut`). Context-menu entries are
 * registered with `registerContextMenuAction` / `registerContextMenuItem`
 * (re-exported here).
 */
import React from "react";

export {
  registerContextMenuAction,
  registerContextMenuItem,
} from "./components/ContextMenu/actions";
export type {
  ContextMenuItem,
  ContextMenuActionHelpers,
} from "./components/ContextMenu/actions";

export type ToolbarItemRenderer = (props: {
  name: string;
  tooltip: string;
}) => React.ReactNode;

const toolbarItems = new Map<string, ToolbarItemRenderer>();

export function registerToolbarItem(name: string, render: ToolbarItemRenderer) {
  toolbarItems.set(name, render);
  return () => {
    if (toolbarItems.get(name) === render) toolbarItems.delete(name);
  };
}

export function getToolbarItemRenderer(name: string) {
  return toolbarItems.get(name);
}

type OverlayEntry = { key: string; Component: React.ComponentType };

let overlays: OverlayEntry[] = [];

export function registerSheetOverlay(
  key: string,
  Component: React.ComponentType
) {
  overlays = [...overlays.filter((o) => o.key !== key), { key, Component }];
  return () => {
    overlays = overlays.filter(
      (o) => !(o.key === key && o.Component === Component)
    );
  };
}

export function getSheetOverlays(): readonly OverlayEntry[] {
  return overlays;
}
