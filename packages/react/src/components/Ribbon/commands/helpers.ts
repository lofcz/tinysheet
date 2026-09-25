import type React from "react";
import { useContext, useMemo } from "react";
import { ribbonLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import { ModalContext } from "../../../context/modal";
import { useDialog } from "../../../hooks/useDialog";
import type { ContextMenuActionHelpers } from "../../ContextMenu/actions";

/**
 * What a ribbon command needs to act: the workbook context (context,
 * setContext, settings, refs, undo / redo), dialogs and modals, and
 * `focusSheet` to give the keyboard back to the grid after a command, as
 * Excel does. The same shape as the context-menu action helpers, so a
 * command can call a registered context-menu action directly.
 */
export type RibbonCommandHelpers = ContextMenuActionHelpers & {
  focusSheet: () => void;
};

export function useRibbonCommandHelpers(): RibbonCommandHelpers {
  const workbook = useContext(WorkbookContext);
  const { showModal } = useContext(ModalContext);
  const { showDialog, hideDialog } = useDialog();
  return useMemo(
    () => ({
      ...workbook,
      showDialog: (content: React.ReactNode) => showDialog(content),
      hideDialog,
      showModal,
      focusSheet: () =>
        workbook.refs?.cellInput?.current?.focus({ preventScroll: true }),
    }),
    [workbook, showDialog, hideDialog, showModal]
  );
}

/** The ribbon strings (tabs, groups, File menu, commands) for the workbook. */
export function useRibbonText() {
  const { context } = useContext(WorkbookContext);
  return ribbonLocale(context);
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|ad|od)/.test(navigator.platform);

/** A shortcut for display: "Ctrl+B" becomes "⌘B" on a Mac. */
export function shortcutText(shortcut: string | undefined) {
  if (!shortcut || !isMac) return shortcut;
  return shortcut
    .replace(/Ctrl\+/g, "⌘")
    .replace(/Alt\+/g, "⌥")
    .replace(/Shift\+/g, "⇧");
}
