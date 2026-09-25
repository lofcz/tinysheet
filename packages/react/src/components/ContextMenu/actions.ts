import type React from "react";
import type { Context, Settings } from "@lofcz/tinysheet-core";
import type { RefValues, SetContextOptions } from "../../context";

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
 * Whole menu entries contributed by features: a name listed in
 * `settings.cellContextMenu` / `headerContextMenu` that the menu does not
 * know renders the items its registered builder returns (none to hide it).
 *
 *   registerContextMenuItem("new-comment", ({ r, c, close }) => [
 *     { key: "new-comment", label: "New Comment", onSelect: () => ... },
 *   ]);
 */
export type ContextMenuItem = {
  key: string;
  label: string;
  /** a ContextMenu/icons.tsx icon name */
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
};

export type ContextMenuItemBuilder = (
  helpers: ContextMenuActionHelpers & {
    /** the active cell */
    r: number;
    c: number;
    /** set for the row / column header menu */
    headerType: "row" | "column" | null;
    /** close the menu and give the focus back to the sheet */
    close: () => void;
  }
) => ContextMenuItem[];

const itemBuilders = new Map<string, ContextMenuItemBuilder>();

export function registerContextMenuItem(
  name: string,
  build: ContextMenuItemBuilder
) {
  itemBuilders.set(name, build);
  return () => {
    if (itemBuilders.get(name) === build) itemBuilders.delete(name);
  };
}

export function getContextMenuItem(name: string) {
  return itemBuilders.get(name);
}
