/**
 * Extension points for the React UI, so features plug in without editing the
 * shared Toolbar and SheetOverlay components:
 *
 * - toolbar items: `registerToolbarItem("insertImage", ({ tooltip }) => ...)`
 *   renders that item wherever its name appears in the ribbon (and
 *   `settings.toolbarItems`); pass `{ tab, group }` to place a new item in
 *   a ribbon group. Ribbon-native commands built from the ui primitives
 *   register with `registerRibbonCommand` (components/Ribbon).
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
// eslint-disable-next-line import/no-cycle
import { placeRibbonItem, RibbonPlacement } from "./components/Ribbon/registry";

// ribbon: see components/Ribbon
export {
  registerRibbonCommand,
  placeRibbonItem,
  registerRibbonGroup,
  registerFileMenuItem,
} from "./components/Ribbon/registry";
export type {
  RibbonCommandProps,
  RibbonPlacement,
  FileMenuItem,
} from "./components/Ribbon/registry";
// side panes (Comments, Format Shape, PivotTable Fields, Watch Window)
export { SidePane, useSidePane } from "./components/SidePane";
export type { SidePaneProps } from "./components/SidePane";

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

/**
 * Register a toolbar item. `placement` puts it into a group of the default
 * ribbon (items the default layout already lists need none).
 */
export function registerToolbarItem(
  name: string,
  render: ToolbarItemRenderer,
  placement?: RibbonPlacement
) {
  loadBuiltinFeatures();
  toolbarItems.set(name, render);
  const unplace = placement ? placeRibbonItem(name, placement) : undefined;
  return () => {
    if (toolbarItems.get(name) === render) toolbarItems.delete(name);
    unplace?.();
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
