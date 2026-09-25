/**
 * Review › Protect Sheet / Allow Edit Ranges / Protect Workbook: the dialogs
 * (the ribbon commands are in ../Ribbon), plugged in through the extension
 * registries:
 *
 * - the "protection" sheet overlay (shows refused edits, asks for Allow Edit
 *   Range passwords, keeps hidden headings hidden),
 * - Tab / Shift+Tab move between unlocked cells of a protected sheet.
 */
import {
  Context,
  getSheetIndex,
  HIDDEN_HEADER_SIZE,
  getSheetProtection,
  getWorkbookProtection,
  hasProtectionPassword,
  protectionLocale,
  registerShortcut,
  selectNextUnlockedCell,
  sheetShowsHeadings,
  unlockEditRange,
  unprotectSheet,
  unprotectWorkbook,
  verifyProtectionPassword,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useEffect } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { useAlert } from "../../hooks/useAlert";
import { registerSheetOverlay } from "../../extensions";
import {
  AllowEditRangesDialog,
  PasswordPrompt,
  ProtectSheetDialog,
  ProtectWorkbookDialog,
  useClearUndo,
} from "./dialogs";
import "./index.css";

/** The window size changed for the grid (formula bar / headings shown). */
function relayout() {
  setTimeout(() => window.dispatchEvent(new Event("resize")));
}

export function useUnprotect() {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const clearUndo = useClearUndo();
  const t = protectionLocale(context);
  return useCallback(
    (kind: "sheet" | "workbook") => {
      const sheetId = context.currentSheetId;
      const stored =
        kind === "sheet"
          ? getSheetProtection(context, sheetId)
          : getWorkbookProtection(context);
      const run = () => {
        setContext((ctx: Context) => {
          if (kind === "sheet") unprotectSheet(ctx, sheetId);
          else unprotectWorkbook(ctx);
        });
        clearUndo();
      };
      if (!hasProtectionPassword(stored)) {
        run();
        return;
      }
      showDialog(
        <PasswordPrompt
          title={
            kind === "sheet" ? t.unprotectSheetTitle : t.unprotectWorkbookTitle
          }
          prompt={t.password}
          check={async (password) => {
            const ok = await verifyProtectionPassword(stored, password);
            if (ok) run();
            return ok;
          }}
        />
      );
    },
    [clearUndo, context, setContext, showDialog, t]
  );
}

/**
 * Mounted in the cell area: shows edits refused by protection, asks for the
 * password of an Allow Edit Range, and keeps hidden headings hidden.
 */
export const ProtectionLayer: React.FC = () => {
  const { context, setContext, settings } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { showAlert } = useAlert();
  const t = protectionLocale(context);
  const alert = context.protectionAlert;
  const unlock = context.protectionUnlock;

  useEffect(() => {
    if (!alert) return;
    showAlert(alert.message, "ok");
    setContext(
      (ctx: Context) => {
        ctx.protectionAlert = undefined;
      },
      { noHistory: true }
    );
  }, [alert, setContext, showAlert]);

  useEffect(() => {
    if (!unlock) return;
    const { sheetId, name } = unlock;
    const index = getSheetIndex(context, sheetId);
    const item = (
      index == null
        ? undefined
        : context.luckysheetfile[index].config?.authority?.allowRangeList
    )?.find((r) => r.name === name);
    const clear = () =>
      setContext(
        (ctx: Context) => {
          ctx.protectionUnlock = undefined;
        },
        { noHistory: true }
      );
    if (!item) {
      clear();
      return;
    }
    showDialog(
      <PasswordPrompt
        title={t.unlockRangeTitle}
        prompt={t.unlockRangePrompt}
        onCancel={clear}
        check={async (password) => {
          const ok = await verifyProtectionPassword(item, password);
          if (ok) {
            setContext(
              (ctx: Context) => {
                unlockEditRange(ctx, sheetId, name);
              },
              { noHistory: true }
            );
          }
          return ok;
        }}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock]);

  // View › Headings: tiny headers while hidden, the configured size again
  // once shown (the workbook sets them only when the sheet changes)
  const index = getSheetIndex(context, context.currentSheetId);
  const hidden =
    index != null && !sheetShowsHeadings(context.luckysheetfile[index]);
  const { rowHeaderWidth, columnHeaderHeight, zoomRatio } = context;
  useEffect(() => {
    const tiny = HIDDEN_HEADER_SIZE;
    if (hidden && (rowHeaderWidth !== tiny || columnHeaderHeight !== tiny)) {
      setContext(
        (ctx: Context) => {
          ctx.rowHeaderWidth = tiny;
          ctx.columnHeaderHeight = tiny;
        },
        { noHistory: true }
      );
      relayout();
    } else if (
      !hidden &&
      rowHeaderWidth === tiny &&
      columnHeaderHeight === tiny
    ) {
      setContext(
        (ctx: Context) => {
          ctx.rowHeaderWidth = settings.rowHeaderWidth * (zoomRatio || 1);
          ctx.columnHeaderHeight =
            settings.columnHeaderHeight * (zoomRatio || 1);
        },
        { noHistory: true }
      );
      relayout();
    }
  }, [
    hidden,
    rowHeaderWidth,
    columnHeaderHeight,
    zoomRatio,
    setContext,
    settings.rowHeaderWidth,
    settings.columnHeaderHeight,
  ]);

  return null;
};

let registered = false;

/**
 * Register the protection features (the overlay and the Tab shortcuts). Called once by the
 * sheet tab bar module; hosts can call it again safely.
 */
export function registerProtectionFeatures() {
  if (registered) return;
  registered = true;
  registerSheetOverlay("protection", ProtectionLayer);
  registerShortcut("protection-tab", {
    key: "Tab",
    handler: (ctx) => selectNextUnlockedCell(ctx, false),
  });
  registerShortcut("protection-shift-tab", {
    key: "Tab",
    shift: true,
    handler: (ctx) => selectNextUnlockedCell(ctx, true),
  });
}

export {
  AllowEditRangesDialog,
  PasswordPrompt,
  ProtectSheetDialog,
  ProtectWorkbookDialog,
};
