import type React from "react";
import type { Context } from "@lofcz/tinysheet-core";
import type { RefValues } from "../../context";

export type InsertFunctionHelpers = {
  context: Context;
  setContext: (recipe: (ctx: Context) => void) => void;
  refs: RefValues;
  /** Shows a modal (the Insert Function dialog) in the workbook. */
  showModal: (content: React.ReactNode) => void;
  hideModal: () => void;
  /**
   * The editor holding the formula (the formula bar or the in-cell editor)
   * when a cell is being edited, else null: insert the picked function at
   * its caret.
   */
  editor: HTMLDivElement | null;
};

/**
 * Opens the Insert Function picker. Return false to fall back to the
 * built-in behaviour (the function list of the formula autocomplete).
 */
export type InsertFunctionHandler = (
  helpers: InsertFunctionHelpers
) => boolean | void;

let handler: InsertFunctionHandler | null = null;

/**
 * Plugs an Insert Function dialog into the formula bar's fx button.
 * Returns an unregister function.
 */
export function registerInsertFunction(h: InsertFunctionHandler) {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

export function getInsertFunction(): InsertFunctionHandler | null {
  return handler;
}
