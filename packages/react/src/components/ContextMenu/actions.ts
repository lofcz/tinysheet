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
 * Menu entries contributed by features. A name listed in
 * `settings.cellContextMenu` / `headerContextMenu` that the menu does not
 * know renders its registered entry. Two forms are accepted:
 *
 * - an item object: one entry; with `menu: "image"` it shows in the menu of
 *   a floating picture instead.
 *
 *     registerContextMenuItem("picture-alt-text", {
 *       label: (ctx) => locale(ctx).cellImage.altText,
 *       onSelect: ({ showDialog }) => showDialog(<AltText />),
 *     });
 *
 * - a builder: runs each time the menu opens and returns one entry, several,
 *   or null to hide it; `children` make an entry a submenu.
 *
 *     registerContextMenuItem("new-comment", ({ r, c, close }) => [
 *       { key: "new-comment", label: "New Comment", onSelect: () => ... },
 *     ]);
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

/** An entry returned by a {@link ContextMenuItemBuilder}. */
export type BuiltContextMenuItem = {
  key: string;
  label: string;
  /** a ContextMenu/icons.tsx icon name */
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  children?: BuiltContextMenuItem[];
  /** Runs after the menu closed. */
  onSelect?: (helpers: ContextMenuActionHelpers) => void;
};

export type ContextMenuItemBuilder = (
  helpers: ContextMenuActionHelpers & {
    /** the active cell */
    r: number;
    c: number;
    /** "row" / "column" in the header menu, null in the cell menu */
    headerType: "row" | "column" | null;
    /** close the menu and give the focus back to the sheet */
    close: () => void;
  }
) => BuiltContextMenuItem | BuiltContextMenuItem[] | null | undefined;

export type ContextMenuEntry = ContextMenuItem | ContextMenuItemBuilder;

const items = new Map<string, ContextMenuEntry>();

/** Add a menu entry named `name`. Returns a function that removes it. */
export function registerContextMenuItem(name: string, entry: ContextMenuEntry) {
  items.set(name, entry);
  return () => {
    if (items.get(name) === entry) items.delete(name);
  };
}

export function getContextMenuItem(name: string) {
  loadBuiltinFeatures();
  return items.get(name);
}

/** Names of the item objects registered for `menu`, in registration order. */
export function getContextMenuItemNames(menu: "cell" | "image") {
  loadBuiltinFeatures();
  return [...items.entries()]
    .filter(
      ([, entry]) =>
        typeof entry !== "function" && (entry.menu ?? "cell") === menu
    )
    .map(([name]) => name);
}
