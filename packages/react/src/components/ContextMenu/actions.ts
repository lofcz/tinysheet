import type React from "react";
import type { Context, Settings } from "@lofcz/tinysheet-core";
import type { RefValues, SetContextOptions } from "../../context";
// eslint-disable-next-line import/no-cycle
import { loadBuiltinFeatures } from "../../features";

/**
 * Hooks for context-menu entries whose feature lives in another module
 * (Paste Special, Format Cells, Insert Chart, Define Name). The menu shows an
 * entry only when a handler is registered, so features can plug themselves
 * in without editing the menu:
 *
 *   registerContextMenuAction("formatCells", ({ showDialog }) =>
 *     showDialog(<FormatCells />));
 *
 * The built-in handlers are registered by ./defaultActions.tsx; registering
 * a key again replaces its handler until the returned function is called.
 */
export type ContextMenuActionKey =
  | "pasteSpecial"
  | "formatCells"
  | "insertChart"
  | "defineName";

export type ContextMenuActionHelpers = {
  context: Context;
  setContext: (
    recipe: (ctx: Context) => void,
    options?: SetContextOptions
  ) => void;
  settings: Required<Settings>;
  refs: RefValues;
  showDialog: (content: React.ReactNode) => void;
  hideDialog: () => void;
};

export type ContextMenuAction = (helpers: ContextMenuActionHelpers) => void;

/** Handlers per key, the latest registration last. */
const registry: Partial<Record<ContextMenuActionKey, ContextMenuAction[]>> = {};

/**
 * Register the handler of a context-menu entry. Returns a function that
 * removes it again (the previously registered handler, if any, comes back).
 */
export function registerContextMenuAction(
  key: ContextMenuActionKey,
  action: ContextMenuAction
) {
  registry[key] = [...(registry[key] ?? []), action];
  return () => {
    const list = registry[key] ?? [];
    const i = list.lastIndexOf(action);
    if (i >= 0) registry[key] = [...list.slice(0, i), ...list.slice(i + 1)];
  };
}

export function getContextMenuAction(key: ContextMenuActionKey) {
  const list = registry[key];
  return list?.[list.length - 1];
}

/**
 * A cell-menu entry contributed by a feature, listed by its name in
 * `settings.cellContextMenu` / `headerContextMenu`; `children` make it a
 * submenu. `onSelect` runs after the menu closed.
 */
export type ContextMenuItem = {
  key: string;
  label: string;
  /** a ContextMenu/icons.tsx icon name */
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  children?: ContextMenuItem[];
  onSelect?: (helpers: ContextMenuActionHelpers) => void;
};

export type ContextMenuItemBuilder = (
  helpers: ContextMenuActionHelpers & {
    /** "row" / "column" in the header menu, null in the cell menu */
    headerType: "row" | "column" | null;
  }
) => ContextMenuItem | ContextMenuItem[] | null;

const items = new Map<string, ContextMenuItemBuilder>();

/**
 * Register a feature's menu entry under `name` (the name used in the menu
 * settings). The builder runs each time the menu opens; return null to hide
 * the entry. Returns a function that removes it.
 */
export function registerContextMenuItem(
  name: string,
  build: ContextMenuItemBuilder
) {
  items.set(name, build);
  return () => {
    if (items.get(name) === build) items.delete(name);
  };
}

export function getContextMenuItem(name: string) {
  loadBuiltinFeatures();
  return items.get(name);
}
