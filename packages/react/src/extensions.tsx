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
 * - status bar items: `registerStatusBarItem("calcStatus", CalcStatus)`.
 *
 * Canvas cell decorators and keyboard shortcuts live in the core package
 * (`registerCellDecorator`, `registerShortcut`). Context-menu entries are
 * registered with `registerContextMenuAction` / `registerContextMenuItem`
 * (re-exported here).
 *
 * Built-in features register themselves in ./features.ts, loaded on the
 * first registry lookup (the package is side-effect free, so a feature
 * module is never imported just for its registration).
 */
import React from "react";
// eslint-disable-next-line import/no-cycle
import { loadBuiltinFeatures } from "./features";

// context-menu entries: see components/ContextMenu/actions.ts
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
  loadBuiltinFeatures();
  toolbarItems.set(name, render);
  return () => {
    if (toolbarItems.get(name) === render) toolbarItems.delete(name);
  };
}

export function getToolbarItemRenderer(name: string) {
  loadBuiltinFeatures();
  return toolbarItems.get(name);
}

type OverlayEntry = { key: string; Component: React.ComponentType };

let overlays: OverlayEntry[] = [];

export function registerSheetOverlay(
  key: string,
  Component: React.ComponentType
) {
  loadBuiltinFeatures();
  overlays = [...overlays.filter((o) => o.key !== key), { key, Component }];
  return () => {
    overlays = overlays.filter(
      (o) => !(o.key === key && o.Component === Component)
    );
  };
}

export function getSheetOverlays(): readonly OverlayEntry[] {
  loadBuiltinFeatures();
  return overlays;
}

let statusBarItems: OverlayEntry[] = [];

/**
 * Mount a component in the status bar, after the mode indicator
 * ("Calculate", "Circular References: A1", progress, ...).
 */
export function registerStatusBarItem(
  key: string,
  Component: React.ComponentType
) {
  statusBarItems = [
    ...statusBarItems.filter((o) => o.key !== key),
    { key, Component },
  ];
  return () => {
    statusBarItems = statusBarItems.filter(
      (o) => !(o.key === key && o.Component === Component)
    );
  };
}

export function getStatusBarItems(): readonly OverlayEntry[] {
  loadBuiltinFeatures();
  return statusBarItems;
}
