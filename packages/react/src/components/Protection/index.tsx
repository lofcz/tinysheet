/**
 * Review › Protect Sheet / Allow Edit Ranges / Protect Workbook and the View
 * options (Gridlines, Headings, Formula Bar, Zoom to Selection), plugged in
 * through the extension registries:
 *
 * - toolbar items "protection" and "view-options",
 * - the "protection" sheet overlay (shows refused edits, asks for Allow Edit
 *   Range passwords, keeps hidden headings hidden),
 * - Tab / Shift+Tab move between unlocked cells of a protected sheet.
 */
import {
  Context,
  getSheetIndex,
  HIDDEN_HEADER_SIZE,
  scrollSelectionIntoCorner,
  getSheetProtection,
  getWorkbookProtection,
  hasProtectionPassword,
  isSheetProtected,
  isWorkbookStructureProtected,
  protectionLocale,
  registerShortcut,
  selectNextUnlockedCell,
  setShowFormulaBar,
  setShowGridLines,
  setShowHeadings,
  sheetShowsGridLines,
  sheetShowsHeadings,
  unlockEditRange,
  unprotectSheet,
  unprotectWorkbook,
  verifyProtectionPassword,
  zoomToSelection,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useEffect } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { useAlert } from "../../hooks/useAlert";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import Combo from "../Toolbar/Combo";
import { MenuDivider } from "../Toolbar/Divider";
import Select, { Option } from "../Toolbar/Select";
import {
  AllowEditRangesDialog,
  PasswordPrompt,
  ProtectSheetDialog,
  ProtectWorkbookDialog,
  useClearUndo,
} from "./dialogs";
import "./index.css";

export const PROTECTION_ICON = "fortune-protect-sheet";
export const VIEW_OPTIONS_ICON = "fortune-view-options";

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

const ProtectionIcon: React.FC = () => (
  <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
    <defs>
      <symbol id={PROTECTION_ICON} viewBox="0 0 24 24" fill="none">
        <rect
          x="5.75"
          y="10.75"
          width="12.5"
          height="9.5"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8.75 10.75V8a3.25 3.25 0 0 1 6.5 0v2.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="15.5" r="1.25" fill="currentColor" />
      </symbol>
      <symbol id={VIEW_OPTIONS_ICON} viewBox="0 0 24 24" fill="none">
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4.75 9.5h14.5M4.75 14.5h14.5M9.5 4.75v14.5M14.5 4.75v14.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="1.5 1.5"
        />
      </symbol>
    </defs>
  </svg>
);

type MenuItem = {
  key: string;
  text: string;
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

const Menu: React.FC<{
  items: (MenuItem | "divider")[];
  setOpen: (open: boolean) => void;
  checks?: boolean;
}> = ({ items, setOpen, checks }) => (
  <Select>
    {items.map((item, i) =>
      item === "divider" ? (
        // eslint-disable-next-line react/no-array-index-key
        <MenuDivider key={`divider-${i}`} />
      ) : (
        <Option
          key={item.key}
          onClick={() => {
            if (item.disabled) return;
            item.onClick?.();
            setOpen(false);
          }}
        >
          <div
            className="fortune-toolbar-menu-line fortune-protection-menu-line"
            aria-disabled={item.disabled}
            aria-checked={checks ? !!item.checked : undefined}
            role={
              checks && item.checked != null ? "menuitemcheckbox" : undefined
            }
            data-testid={`menu-${item.key}`}
          >
            {checks && (
              <span className="fortune-protection-check">
                {item.checked ? "✓" : ""}
              </span>
            )}
            <span className="fortune-protection-menu-text">{item.text}</span>
          </div>
        </Option>
      )
    )}
  </Select>
);

/** Toolbar "Protection": Protect Sheet, Allow Edit Ranges, Protect Workbook. */
export const ProtectionToolbarItem: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const unprotect = useUnprotect();
  const t = protectionLocale(context);
  const sheetProtected = isSheetProtected(context);
  const workbookProtected = isWorkbookStructureProtected(context);
  const editable = context.allowEdit !== false;

  const toggleSheet = () => {
    if (!editable) return;
    if (sheetProtected) unprotect("sheet");
    else showDialog(<ProtectSheetDialog />);
  };
  const items: (MenuItem | "divider")[] = [
    {
      key: "protect-sheet",
      text: sheetProtected ? t.unprotectSheet : t.protectSheet,
      disabled: !editable,
      onClick: toggleSheet,
    },
    {
      key: "allow-edit-ranges",
      text: t.allowEditRanges,
      disabled: !editable || sheetProtected,
      onClick: () =>
        showDialog(
          <AllowEditRangesDialog
            onProtectSheet={() => showDialog(<ProtectSheetDialog />)}
          />
        ),
    },
    "divider",
    {
      key: "protect-workbook",
      text: workbookProtected ? t.unprotectWorkbook : t.protectWorkbook,
      disabled: !editable,
      onClick: () => {
        if (workbookProtected) unprotect("workbook");
        else showDialog(<ProtectWorkbookDialog />);
      },
    },
  ];

  return (
    <>
      <ProtectionIcon />
      <div
        className={`fortune-protection-toolbar${
          sheetProtected ? " fortune-protection-active" : ""
        }`}
        data-testid="toolbar-protection"
      >
        <Combo
          iconId={PROTECTION_ICON}
          tooltip={sheetProtected ? t.unprotectSheet : t.protectSheet}
          onClick={toggleSheet}
        >
          {(setOpen) => <Menu items={items} setOpen={setOpen} />}
        </Combo>
      </div>
    </>
  );
};

/** Toolbar "View": Gridlines, Headings, Formula Bar, Zoom to Selection. */
export const ViewOptionsToolbarItem: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = protectionLocale(context);
  const index = getSheetIndex(context, context.currentSheetId);
  const sheet = index == null ? null : context.luckysheetfile[index];
  const grid = sheetShowsGridLines(sheet);
  const headings = sheetShowsHeadings(sheet);
  const formulaBar = !context.hideFormulaBar;

  const items: (MenuItem | "divider")[] = [
    {
      key: "gridlines",
      text: t.gridlines,
      checked: grid,
      onClick: () =>
        setContext((ctx: Context) => {
          setShowGridLines(ctx, !grid);
        }),
    },
    {
      key: "headings",
      text: t.headings,
      checked: headings,
      onClick: () => {
        setContext((ctx: Context) => {
          setShowHeadings(ctx, !headings);
        });
        relayout();
      },
    },
    {
      key: "formula-bar",
      text: t.formulaBar,
      checked: formulaBar,
      onClick: () => {
        setContext(
          (ctx: Context) => {
            setShowFormulaBar(ctx, !formulaBar);
          },
          { noHistory: true }
        );
        relayout();
      },
    },
    "divider",
    {
      key: "zoom-to-selection",
      text: t.zoomToSelection,
      onClick: () => {
        setContext((ctx: Context) => {
          zoomToSelection(ctx);
        });
        // scroll again once the grid is laid out at the new zoom
        setTimeout(
          () =>
            setContext(
              (ctx: Context) => {
                scrollSelectionIntoCorner(ctx);
              },
              { noHistory: true }
            ),
          80
        );
      },
    },
  ];

  return (
    <>
      <ProtectionIcon />
      <div
        className="fortune-protection-toolbar"
        data-testid="toolbar-view-options"
      >
        <Combo iconId={VIEW_OPTIONS_ICON} tooltip={t.view}>
          {(setOpen) => <Menu items={items} setOpen={setOpen} checks />}
        </Combo>
      </div>
    </>
  );
};

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
 * Register the protection and View features (toolbar items "protection" and
 * "view-options", the overlay and the Tab shortcuts). Called once by the
 * sheet tab bar module; hosts can call it again safely.
 */
export function registerProtectionFeatures() {
  if (registered) return;
  registered = true;
  registerToolbarItem("protection", () => <ProtectionToolbarItem />);
  registerToolbarItem("view-options", () => <ViewOptionsToolbarItem />);
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
