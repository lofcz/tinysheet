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
 * TODO(P7): register "pasteSpecial" (Paste Special dialog, Ctrl+Alt+V).
 * TODO(P9): register "formatCells" (Format Cells dialog, Ctrl+1).
 * TODO(P12): register "insertChart" (insert a chart from the selection).
 * TODO(P3): register "defineName" (New Name dialog for the selection).
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

const registry: Partial<Record<ContextMenuActionKey, ContextMenuAction>> = {};

/** Register the handler of a context-menu entry; returns an unregister fn. */
export function registerContextMenuAction(
  key: ContextMenuActionKey,
  action: ContextMenuAction
) {
  registry[key] = action;
  return () => {
    if (registry[key] === action) delete registry[key];
  };
}

export function getContextMenuAction(key: ContextMenuActionKey) {
  return registry[key];
}
