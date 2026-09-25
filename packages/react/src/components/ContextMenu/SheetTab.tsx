import {
  locale,
  deleteSheet,
  api,
  duplicateSheet,
  getGroupedSheetIds,
  hideSheets,
  selectAllSheets,
  ungroupSheets,
  checkWorkbookStructure,
  isWorkbookStructureProtected,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, {
  useContext,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { ChangeColor } from "../ChangeColor";
import { MoveOrCopyDialog, UnhideDialog } from "../SheetTab/SheetDialogs";
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
  const { context, setContext, settings } = useContext(WorkbookContext);
  const { x, y, sheet, onRename } = context.sheetTabContextMenu;
  const { sheetconfig } = locale(context);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [isShowChangeColor, setIsShowChangeColor] = useState<boolean>(false);
  const [isShowInputColor, setIsShowInputColor] = useState<boolean>(false);
  const { showAlert, hideAlert } = useAlert();
  const { showDialog } = useDialog();
  const containerRef = useRef<HTMLDivElement>(null);

  const grouped = getGroupedSheetIds(context);
  const visibleCount = context.luckysheetfile.filter(
    (s) => s.hide !== 1
  ).length;
  const hiddenCount = context.luckysheetfile.length - visibleCount;
  // the sheets a command applies to: the group, or the clicked sheet
  const targets =
    sheet?.id && grouped.includes(sheet.id) ? grouped : [sheet?.id!];

  const close = useCallback(() => {
    setContext((ctx) => {
      ctx.sheetTabContextMenu = {};
    });
  }, [setContext]);

  useLayoutEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && x != null && y != null) {
      setPosition({ x, y: y - rect.height });
    }
  }, [x, y]);

  useOutsideClick(containerRef, close, [close]);

  const moveSheet = useCallback(
    (delta: number) => {
      if (context.allowEdit === false) return;
      if (!sheet) return;
      setContext((ctx) => {
        let currentOrder = -1;
        _.sortBy(ctx.luckysheetfile, ["order"]).forEach((_sheet, i) => {
          _sheet.order = i;
          if (_sheet.id === sheet.id) {
            currentOrder = i;
          }
        });
        api.setSheetOrder(ctx, { [sheet.id!]: currentOrder + delta });
      });
    },
    [context.allowEdit, setContext, sheet]
  );

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
          ctx.currentSheetId = id;
        }
      },
      { addSheetOp: true }
    );
  }, [context.allowEdit, setContext, sheet?.id]);

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
        if (name === "delete") {
          return (
            <Menu
              key={name}
              onClick={() => {
                const shownSheets = context.luckysheetfile.filter(
                  (singleSheet) =>
                    _.isUndefined(singleSheet.hide) || singleSheet.hide !== 1
                );
                if (isWorkbookStructureProtected(context)) {
                  // Excel's message instead of the confirmation
                  setContext((ctx) => {
                    checkWorkbookStructure(ctx);
                  });
                } else if (
                  context.luckysheetfile.length > 1 &&
                  shownSheets.length > 1
                ) {
                  showAlert(sheetconfig.confirmDelete, "yesno", () => {
                    setContext(
                      (ctx) => {
                        deleteSheet(ctx, sheet.id!);
                      },
                      {
                        deleteSheetOp: {
                          id: sheet.id!,
                        },
                      }
                    );
                    hideAlert();
                  });
                } else {
                  showAlert(sheetconfig.noMoreSheet, "ok");
                }
                close();
              }}
            >
              {sheetconfig.delete}
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
                  moveSheet(-1.5);
                  close();
                }}
              >
                {sheetconfig.moveLeft}
              </Menu>
              <Menu
                onClick={() => {
                  moveSheet(1.5);
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
