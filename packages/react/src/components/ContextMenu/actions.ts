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
  /** Show a component that renders its own dialog. */
  showModal: (content: React.ReactNode) => void;
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
 * Entries a feature adds to a context menu. A "cell" item (the default)
 * shows where its name is listed in `settings.cellContextMenu`; an "image"
 * item shows in the menu of a floating picture (in registration order).
 *
 *   registerContextMenuItem("picture-alt-text", {
 *     label: (ctx) => locale(ctx).cellImage.altText,
 *     visible: (ctx) => ...,
 *     onSelect: ({ showDialog }) => showDialog(<AltText />),
 *   });
 */
export type ContextMenuItem = {
  label: (context: Context) => string;
  /** A context-menu icon name (see ./icons.tsx). */
  icon?: string;
  menu?: "cell" | "image";
  /** Hidden when this returns false. */
  visible?: (context: Context) => boolean;
  /** Greyed out when this returns true (and when the sheet is read-only). */
  disabled?: (context: Context) => boolean;
  onSelect: ContextMenuAction;
};

const items = new Map<string, ContextMenuItem>();

/** Add a menu entry named `name`. Returns a function that removes it. */
export function registerContextMenuItem(name: string, item: ContextMenuItem) {
  items.set(name, item);
  return () => {
    if (items.get(name) === item) items.delete(name);
  };
}

export function getContextMenuItem(name: string) {
  return items.get(name);
}

/** Names of the items registered for `menu`, in registration order. */
export function getContextMenuItemNames(menu: "cell" | "image") {
  return [...items.entries()]
    .filter(([, item]) => (item.menu ?? "cell") === menu)
    .map(([name]) => name);
}
