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
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { ChangeColor } from "../ChangeColor";
import { MoveOrCopyDialog, UnhideDialog } from "../SheetTab/SheetDialogs";
import { ProtectSheetDialog, useUnprotect } from "../Protection";
import { activateSheetTab } from "../SheetTab/activate";
import SVGIcon from "../SVGIcon";
import Divider from "./Divider";
import "./index.css";
import Menu from "./Menu";

/**
 * Sheet tab context menu. Besides the configured items it offers Excel's
 * Move or Copy... (next to "copy"), Unhide... (next to "hide") and, with
 * several visible sheets, Select All Sheets / Ungroup Sheets.
 */
const SheetTabContextMenu: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const { x, y, sheet, onRename } = context.sheetTabContextMenu;
  const { sheetconfig } = locale(context);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [isShowChangeColor, setIsShowChangeColor] = useState<boolean>(false);
  const [isShowInputColor, setIsShowInputColor] = useState<boolean>(false);
  const { showAlert, hideAlert } = useAlert();
  const { showDialog } = useDialog();
  const unprotect = useUnprotect();
  const protection = protectionLocale(context);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const closeOnOutsideClick = useCallback(() => close(false), [close]);

  useLayoutEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && x != null && y != null) {
      // above the pointer, kept inside the workbook
      const bounds = refs.workbookContainer.current?.getBoundingClientRect();
      const maxX = bounds ? bounds.width - rect.width - 4 : x;
      setPosition({
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, y - rect.height),
      });
    }
  }, [x, y, refs.workbookContainer]);

  useEffect(() => {
    if (x == null || y == null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close, x, y]);

  useOutsideClick(containerRef, closeOnOutsideClick, [closeOnOutsideClick]);

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

  const updateShowInputColor = useCallback((state: boolean) => {
    setIsShowInputColor(state);
  }, []);

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

  return (
    <div
      role="menu"
      className="fortune-context-menu luckysheet-cols-menu"
      onContextMenu={(e) => e.stopPropagation()}
      style={{ left: position.x, top: position.y, overflow: "visible" }}
      ref={containerRef}
    >
      {settings.sheetTabContextMenu?.map((name, i) => {
        if (name === "insert") {
          return (
            <Menu
              key={name}
              onClick={() => {
                close();
                if (isWorkbookStructureProtected(context)) {
                  setContext((ctx) => {
                    checkWorkbookStructure(ctx);
                  });
                  return;
                }
                insertSheet();
              }}
            >
              {sheetconfig.insert}
            </Menu>
          );
        }
        if (name === "delete") {
          return (
            <Menu
              key={name}
              onClick={() => {
                close();
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
              }}
            >
              {sheetconfig.delete}
            </Menu>
          );
        }
        if (name === "protect") {
          const sheetProtected = isSheetProtected(context);
          return (
            <Menu
              key={name}
              onClick={() => {
                close();
                if (!editable) return;
                if (sheetProtected) unprotect("sheet");
                else showDialog(<ProtectSheetDialog />);
              }}
            >
              {sheetProtected
                ? protection.unprotectSheet
                : protection.protectSheet}
            </Menu>
          );
        }
        if (name === "rename") {
          return (
            <Menu
              key={name}
              onClick={() => {
                onRename?.();
                close();
              }}
            >
              {sheetconfig.rename}
            </Menu>
          );
        }
        if (name === "move") {
          return (
            <React.Fragment key={name}>
              <Menu
                onClick={() => {
                  moveBy(-1);
                  close();
                }}
              >
                {sheetconfig.moveLeft}
              </Menu>
              <Menu
                onClick={() => {
                  moveBy(1);
                  close();
                }}
              >
                {sheetconfig.moveRight}
              </Menu>
            </React.Fragment>
          );
        }
        if (name === "hide") {
          return (
            <React.Fragment key={name}>
              <Menu
                onClick={() => {
                  hideSheet();
                  close();
                }}
              >
                {sheetconfig.hide}
              </Menu>
              {editable && hiddenCount > 0 && (
                <Menu
                  onClick={() => {
                    close();
                    showDialog(<UnhideDialog />);
                  }}
                >
                  {sheetconfig.unhideMenu}
                </Menu>
              )}
            </React.Fragment>
          );
        }
        if (name === "copy") {
          return (
            <React.Fragment key={name}>
              <Menu
                onClick={() => {
                  copySheet();
                  close();
                }}
              >
                {sheetconfig.duplicate}
              </Menu>
              {editable && (
                <Menu
                  onClick={() => {
                    close();
                    showDialog(<MoveOrCopyDialog sheet={sheet} />);
                  }}
                >
                  {sheetconfig.moveOrCopy}
                </Menu>
              )}
            </React.Fragment>
          );
        }
        if (name === "color") {
          return (
            <Menu
              key={name}
              onMouseEnter={() => {
                setIsShowChangeColor(true);
              }}
              onMouseLeave={() => {
                if (!isShowInputColor) {
                  setIsShowChangeColor(false);
                }
              }}
            >
              {sheetconfig.tabColor}
              <span className="change-color-triangle">
                <SVGIcon name="rightArrow" width={18} />
              </span>
              {isShowChangeColor && context.allowEdit && (
                <ChangeColor
                  triggerParentUpdate={updateShowInputColor}
                  sheetIds={targets}
                />
              )}
            </Menu>
          );
        }
        if (name === "focus") {
          return (
            <Menu
              key={name}
              onClick={() => {
                focusSheet();
                close();
              }}
            >
              {sheetconfig.focus}
            </Menu>
          );
        }
        if (name === "|") {
          return <Divider key={`divide-${i}`} />;
        }
        return null;
      })}
      {visibleCount > 1 && (
        <>
          <Divider />
          {grouped.length > 0 ? (
            <Menu
              onClick={() => {
                setContext((ctx) => ungroupSheets(ctx));
                close();
              }}
            >
              {sheetconfig.ungroupSheets}
            </Menu>
          ) : (
            <Menu
              onClick={() => {
                setContext((ctx) => selectAllSheets(ctx));
                close();
              }}
            >
              {sheetconfig.selectAllSheets}
            </Menu>
          )}
        </>
      )}
    </div>
  );
};

export default SheetTabContextMenu;
