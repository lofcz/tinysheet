/**
 * Outline tools (Data › Group / Ungroup, Show / Hide Detail, Auto Outline,
 * Clear Outline, Subtotal, outline settings), plugged in through the
 * extension registries: a sheet overlay that asks rows-or-columns for
 * Shift+Alt+Right / Left on a plain range. The ribbon commands (Data ›
 * Outline) are in ../Ribbon; the gutter is rendered by the sheet
 * (./OutlineGutter).
 */
import React, { useContext, useEffect, useLayoutEffect } from "react";
import WorkbookContext from "../../context";
import { dedupeOutlineSteps } from "./history";
import { useDialog } from "../../hooks/useDialog";
import { registerSheetOverlay } from "../../extensions";
import { GroupDialog } from "./dialogs";
import OutlineGutterView from "./OutlineGutter";
import "./index.css";

export { GroupDialog, OutlineSettingsDialog, SubtotalDialog } from "./dialogs";

/**
 * Asks "Rows or Columns?" when Group / Ungroup was requested (keyboard) for
 * a range that is neither whole rows nor whole columns.
 */
export const OutlinePrompt: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const prompt = context.outlinePrompt;
  // an outline command replayed by React is recorded twice: keep one step
  // (synchronously in the commit, before the next Ctrl+Z can pop it)
  const sheets = context.luckysheetfile;
  useLayoutEffect(() => {
    const list = refs.globalCache?.undoList;
    if (list) dedupeOutlineSteps(list);
  }, [sheets, refs.globalCache]);
  useEffect(() => {
    if (!prompt) return;
    setContext(
      (ctx) => {
        delete ctx.outlinePrompt;
      },
      { noHistory: true }
    );
    showDialog(<GroupDialog ungroup={prompt === "ungroup"} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);
  return null;
};

let installed = false;

/** Register the Group prompt (idempotent). */
export function installOutlineUI() {
  if (installed) return;
  installed = true;
  registerSheetOverlay("outlinePrompt", OutlinePrompt);
}

/** The outline gutter, rendered by the sheet. */
export const OutlineGutter: React.FC = () => <OutlineGutterView />;
