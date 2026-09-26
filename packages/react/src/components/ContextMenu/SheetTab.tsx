import {
  locale,
  addSheet,
  beginUndoGroup,
  deleteSheet,
  duplicateSheet,
  getGroupedSheetIds,
  hideSheets,
  isSheetProtected,
  moveSheet,
  moveSheets,
  protectionLocale,
  selectAllSheets,
  ungroupSheets,
  checkWorkbookStructure,
  isWorkbookStructureProtected,
  setSheetTabColor,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useContext, useCallback, useMemo } from "react";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import { MoveOrCopyDialog, UnhideDialog } from "../SheetTab/SheetDialogs";
import { ProtectSheetDialog, useUnprotect } from "../Protection";
import { activateSheetTab } from "../SheetTab/activate";
import { ColorPicker, ContextMenuPopup, MenuItem } from "../ui";
import { menuIcon } from "./icons";
import { menuText } from "./text";
import "./index.css";

/**
 * Sheet tab context menu (Excel's order: Insert, Delete, Rename, Move or
 * Copy…, Protect Sheet…, Tab Color ▸, Hide, Unhide…, Select All Sheets).
 * Besides the configured items it offers Duplicate, Move or Copy... (next
 * to "copy"), Unhide... (next to "hide") and, with several visible sheets,
 * Select All Sheets / Ungroup Sheets. A ui `ContextMenuPopup`: keyboard
 * navigation, Esc / outside click / scroll / resize close it.
 */
const SheetTabContextMenu: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const { x, y, sheet, onRename } = context.sheetTabContextMenu;
  const { sheetconfig } = locale(context);
  const { showAlert, hideAlert } = useAlert();
  const { showDialog } = useDialog();
  const unprotect = useUnprotect();
  const protection = protectionLocale(context);
  const grouped = getGroupedSheetIds(context);
  const visibleCount = context.luckysheetfile.filter(
    (s) => s.hide !== 1
  ).length;
  const hiddenCount = context.luckysheetfile.length - visibleCount;
  // the sheets a command applies to: the group, or the clicked sheet
  const groupKey = grouped.join("\n");
  const targets = useMemo(
    () =>
      sheet?.id && groupKey.split("\n").includes(sheet.id)
        ? groupKey.split("\n")
        : [sheet?.id!],
    [groupKey, sheet?.id]
  );

  /**
   * Closes the menu. After a command (and Esc) keys go to the grid again,
   * so Ctrl+Z undoes it; a dialog or the rename box takes the focus after.
   */
  const close = useCallback(
    (refocus = true) => {
      setContext((ctx) => {
        ctx.sheetTabContextMenu = {};
      });
      if (refocus) refs.cellInput.current?.focus({ preventScroll: true });
    },
    [refs.cellInput, setContext]
  );

  /** Move left / right: past the next visible sheet on that side. */
  const moveBy = useCallback(
    (delta: -1 | 1) => {
      if (context.allowEdit === false) return;
      if (!sheet?.id) return;
      setContext((ctx) => {
        const visible = _.sortBy(
          ctx.luckysheetfile.filter((s) => s.hide !== 1),
          (s) => Number(s.order)
        );
        const ids = targets.filter(Boolean);
        const first = visible.findIndex((s) => ids.includes(s.id!));
        const last = _.findLastIndex(visible, (s) => ids.includes(s.id!));
        if (first < 0) return;
        if (delta < 0) {
          if (first === 0) return;
          moveSheets(ctx, ids, visible[first - 1].id!);
        } else {
          if (last >= visible.length - 1) return;
          moveSheets(ctx, ids, visible[last + 2]?.id ?? null);
        }
      });
    },
    [context.allowEdit, setContext, sheet?.id, targets]
  );

  /** Insert: a new sheet before the clicked one (Excel). */
  const insertSheet = useCallback(() => {
    if (context.allowEdit === false || !sheet?.id) return;
    setContext(
      (ctx) => {
        const previous = ctx.currentSheetId;
        const view = {
          scrollLeft: ctx.scrollLeft,
          scrollTop: ctx.scrollTop,
          luckysheet_select_status: ctx.luckysheet_select_status,
          luckysheet_select_save: ctx.luckysheet_select_save,
          luckysheet_selection_range: ctx.luckysheet_selection_range,
        };
        const count = ctx.luckysheetfile.length;
        addSheet(ctx, settings);
        if (ctx.luckysheetfile.length === count) return;
        const added = ctx.luckysheetfile[ctx.luckysheetfile.length - 1];
        if (added?.id) moveSheet(ctx, added.id, sheet.id!);
        ctx.sheetScrollRecord[previous] = view;
        ctx.groupedSheetIds = undefined;
        ctx.zoomRatio = 1;
      },
      { addSheetOp: true }
    );
  }, [context.allowEdit, setContext, settings, sheet?.id]);

  /** Delete: the grouped sheets, or the clicked one, as one undo step. */
  const removeSheets = useCallback(() => {
    const ids = targets.filter(Boolean);
    const endGroup = beginUndoGroup(refs.globalCache);
    try {
      ids.forEach((id) => {
        setContext(
          (ctx) => {
            deleteSheet(ctx, id);
          },
          { deleteSheetOp: { id } }
        );
      });
    } finally {
      endGroup();
    }
    refs.cellInput.current?.focus({ preventScroll: true });
  }, [refs.cellInput, refs.globalCache, setContext, targets]);

  const hideSheet = useCallback(() => {
    if (context.allowEdit === false) return;
    if (!sheet) return;
    if (visibleCount - targets.length < 1) {
      showAlert(sheetconfig.noMoreSheet, "ok");
      return;
    }
    setContext((ctx) => {
      hideSheets(ctx, targets);
    });
  }, [
    context.allowEdit,
    setContext,
    sheet,
    showAlert,
    sheetconfig.noMoreSheet,
    targets,
    visibleCount,
  ]);

  const copySheet = useCallback(() => {
    if (context.allowEdit === false) return;
    if (!sheet?.id) return;
    setContext(
      (ctx) => {
        const id = duplicateSheet(ctx, sheet.id!);
        if (id) {
          ctx.groupedSheetIds = undefined;
          activateSheetTab(ctx, id, refs.globalCache);
        }
      },
      { addSheetOp: true }
    );
  }, [context.allowEdit, refs.globalCache, setContext, sheet?.id]);

  const focusSheet = useCallback(() => {
    if (context.allowEdit === false) return;
    if (!sheet?.id) return;
    setContext((ctx) => {
      _.forEach(ctx.luckysheetfile, (sheetfile) => {
        sheetfile.status = sheet.id === sheetfile.id ? 1 : 0;
      });
    });
  }, [context.allowEdit, setContext, sheet?.id]);

  if (!sheet || x == null || y == null) return null;

  const editable = context.allowEdit !== false;
  const sheetProtected = isSheetProtected(context);
  const currentColor =
    context.luckysheetfile.find((s) => s.id === sheet.id)?.color ?? null;
  const act =
    (fn: () => void, refocus = true) =>
    () => {
      close(refocus);
      fn();
    };

  const items: MenuItem[] = [];
  settings.sheetTabContextMenu?.forEach((name, i) => {
    switch (name) {
      case "insert":
        items.push({
          id: "insert",
          label: sheetconfig.insert,
          icon: menuIcon("insertSheet"),
          disabled: !editable,
          onSelect: act(() => {
            if (isWorkbookStructureProtected(context)) {
              setContext((ctx) => {
                checkWorkbookStructure(ctx);
              });
              return;
            }
            insertSheet();
          }),
        });
        break;
      case "delete":
        items.push({
          id: "delete",
          label: sheetconfig.delete,
          icon: menuIcon("delete"),
          disabled: !editable,
          onSelect: act(() => {
            if (isWorkbookStructureProtected(context)) {
              // Excel's message instead of the confirmation
              setContext((ctx) => {
                checkWorkbookStructure(ctx);
              });
            } else if (visibleCount - targets.length >= 1) {
              showAlert(sheetconfig.confirmDelete, "yesno", () => {
                hideAlert();
                removeSheets();
              });
            } else {
              showAlert(sheetconfig.noMoreSheet, "ok");
            }
          }, false),
        });
        break;
      case "rename":
        items.push({
          id: "rename",
          label: sheetconfig.rename,
          icon: menuIcon("rename"),
          disabled: !editable,
          onSelect: () => {
            onRename?.();
            close(false);
          },
        });
        break;
      case "copy":
        items.push({
          id: "duplicate",
          label: sheetconfig.duplicate,
          icon: menuIcon("copy"),
          disabled: !editable,
          onSelect: act(copySheet),
        });
        if (editable) {
          items.push({
            id: "move-or-copy",
            label: sheetconfig.moveOrCopy,
            icon: menuIcon("move-copy"),
            onSelect: act(
              () => showDialog(<MoveOrCopyDialog sheet={sheet} />),
              false
            ),
          });
        }
        break;
      case "protect":
        items.push({
          id: "protect",
          label: sheetProtected
            ? protection.unprotectSheet
            : protection.protectSheet,
          icon: menuIcon(sheetProtected ? "unprotect" : "protect"),
          disabled: !editable,
          onSelect: act(() => {
            if (sheetProtected) unprotect("sheet");
            else showDialog(<ProtectSheetDialog />);
          }, false),
        });
        break;
      case "color":
        items.push({
          id: "color",
          label: sheetconfig.tabColor,
          icon: menuIcon("color"),
          disabled: !editable,
          children: [
            {
              type: "custom",
              id: "tab-color-picker",
              render: () => (
                <ColorPicker
                  value={currentColor}
                  automaticLabel={sheetconfig.noColor}
                  aria-label={sheetconfig.tabColor}
                  onChange={(color) => {
                    setContext((ctx) => {
                      setSheetTabColor(
                        ctx,
                        targets.filter(Boolean),
                        color ?? undefined
                      );
                    });
                    close();
                  }}
                />
              ),
            },
          ],
        });
        break;
      case "hide":
        items.push({
          id: "hide",
          label: sheetconfig.hide,
          icon: menuIcon("hide"),
          disabled: !editable,
          onSelect: act(hideSheet),
        });
        if (editable && hiddenCount > 0) {
          items.push({
            id: "unhide",
            label: sheetconfig.unhideMenu,
            icon: menuIcon("unhide"),
            onSelect: act(() => showDialog(<UnhideDialog />), false),
          });
        }
        break;
      case "move":
        items.push(
          {
            id: "move-left",
            label: sheetconfig.moveLeft,
            icon: menuIcon("move-left"),
            disabled: !editable,
            onSelect: act(() => moveBy(-1)),
          },
          {
            id: "move-right",
            label: sheetconfig.moveRight,
            icon: menuIcon("move-right"),
            disabled: !editable,
            onSelect: act(() => moveBy(1)),
          }
        );
        break;
      case "focus":
        items.push({
          id: "focus",
          label: sheetconfig.focus,
          onSelect: act(focusSheet),
        });
        break;
      case "|":
        items.push({ type: "separator", id: `divider-${i}` });
        break;
      default:
        break;
    }
  });
  if (visibleCount > 1) {
    items.push({ type: "separator", id: "divider-group" });
    items.push(
      grouped.length > 0
        ? {
            id: "ungroup",
            label: sheetconfig.ungroupSheets,
            icon: menuIcon("select-all"),
            onSelect: act(() => setContext((ctx) => ungroupSheets(ctx))),
          }
        : {
            id: "select-all",
            label: sheetconfig.selectAllSheets,
            icon: menuIcon("select-all"),
            onSelect: act(() => setContext((ctx) => selectAllSheets(ctx))),
          }
    );
  }
  const wb = refs.workbookContainer.current?.getBoundingClientRect();

  return (
    <ContextMenuPopup
      x={(wb?.left ?? 0) + x}
      y={(wb?.top ?? 0) + y}
      items={items}
      within={refs.workbookContainer.current}
      className="fortune-sheet-tab-menu"
      popupClassName="fortune-sheet-tab-menu-popup"
      minWidth={200}
      aria-label={menuText(context).sheetTabMenu}
      onClose={(reason) => {
        if (reason === "select") return;
        close(reason !== "outside");
      }}
    />
  );
};

export default SheetTabContextMenu;
