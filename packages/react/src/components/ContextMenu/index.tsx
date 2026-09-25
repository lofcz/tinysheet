import {
  locale,
  handleCopy,
  handlePasteByClick,
  insertRowCol,
  removeActiveImage,
  deleteSelectedCellText,
  clearGroupedSheetsContents,
  getInsertDeleteCellsShortcut,
  sortSelection,
  createFilter,
  showImgChooser,
  handleLink,
  hideSelected,
  showSelected,
  getSheetIndex,
  isAllowEdit,
  jfrefreshgrid,
  getFlowdata,
  newComment,
  editComment,
  deleteComment,
  showHideComment,
  showHideAllComments,
  removeHyperlink,
  getPickListValues,
  autofitRows,
  autofitColumns,
  colLocationByIndex,
  rowLocationByIndex,
  Context,
  getSheetProtection,
  isProtectionActionAllowed,
  SheetProtectionAction,
  handlePasteSpecial,
  PasteSpecialOptions,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, {
  useContext,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import regeneratorRuntime from "regenerator-runtime";
import WorkbookContext, { SetContextOptions } from "../../context";
import { ModalContext } from "../../context/modal";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import "./index.css";
import "./cellMenu.css";
import { menuIcon } from "./icons";
import { ContextMenuPopup, Icon, MenuItem } from "../ui";
import { menuText } from "./text";
import PasteOptions, { PasteOption } from "./PasteOptions";
import CustomSort from "../CustomSort";
import DataVerification from "../DataVerification";
import {
  getContextMenuAction,
  ContextMenuActionKey,
  ContextMenuItem,
  getContextMenuItem,
  getContextMenuItemNames,
  BuiltContextMenuItem,
} from "./actions";
import { registerDefaultContextMenuActions } from "./defaultActions";
import { registerCellImageFeature } from "../CellImages";
import {
  InsertDeleteDialog,
  SizeDialog,
  useInsertDeleteRunner,
} from "./dialogs";
import PickList, { PickListState } from "./PickList";
import { installThreadedCommentsUI } from "../ThreadedComments";

registerDefaultContextMenuActions();
// threaded comments: cell menu entries, toolbar item, card overlay and
// shortcut (an explicit call: a bare import would be tree-shaken)
installThreadedCommentsUI();
// pictures in cells: menu items, toolbar item, overlay and drawing
registerCellImageFeature();

type MenuEntry =
  | {
      type: "item";
      key: string;
      label: string;
      icon?: string;
      shortcut?: string;
      disabled?: boolean;
      /** Keep the menu open after selecting (submenu parents). */
      children?: MenuEntry[];
      onSelect?: () => void;
    }
  | { type: "divider"; key: string }
  | { type: "node"; key: string; node: React.ReactNode };

type ItemEntry = Extract<MenuEntry, { type: "item" }>;

type Range = { row: number[]; column: number[] };

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|ad|od)/.test(navigator.platform);
const mod = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`);

/** Drop leading, trailing and doubled dividers left by hidden items. */
function tidyDividers(entries: MenuEntry[]) {
  const out: MenuEntry[] = [];
  entries.forEach((e) => {
    if (e.type === "divider") {
      if (out.length === 0 || out[out.length - 1].type === "divider") return;
    }
    out.push(e);
  });
  while (out.length && out[out.length - 1].type === "divider") out.pop();
  return out;
}

/** Every index spanned by the whole-row / whole-column parts of a selection. */
function spannedIndexes(sel: Range[] | undefined, type: "row" | "column") {
  const out: number[] = [];
  (sel || []).forEach((s) => {
    const [a, b] = type === "row" ? s.row : s.column;
    for (let i = a; i <= b; i += 1) out.push(i);
  });
  return _.uniq(out);
}

/** Position (relative to the workbook) under the active cell. */
function activeCellAnchor(
  ctx: Context,
  cellArea: HTMLElement | null,
  workbook: HTMLElement | null
) {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel || !cellArea || !workbook) return null;
  const r = sel.row_focus ?? sel.row[0];
  const c = sel.column_focus ?? sel.column[0];
  const [x0, x1] = colLocationByIndex(c, ctx.visibledatacolumn);
  const [, y1] = rowLocationByIndex(r, ctx.visibledatarow);
  const area = cellArea.getBoundingClientRect();
  const wb = workbook.getBoundingClientRect();
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  return {
    r,
    c,
    cellLeft: area.left - wb.left + clamp(x0 - ctx.scrollLeft, 0, area.width),
    cellWidth: x1 - x0,
    x:
      area.left -
      wb.left +
      clamp((x0 + x1) / 2 - ctx.scrollLeft, 0, area.width),
    y: area.top - wb.top + clamp(y1 - ctx.scrollTop, 0, area.height),
  };
}

const ContextMenu: React.FC = () => {
  const { showDialog, hideDialog } = useDialog();
  const { showModal } = useContext(ModalContext);
  const workbookCtx = useContext(WorkbookContext);
  const { context, setContext, settings, refs } = workbookCtx;
  const { contextMenu } = context;
  const { showAlert } = useAlert();
  const { rightclick, drag, generalDialog, cellMenu } = locale(context);
  const text = menuText(context);
  const [pickList, setPickList] = useState<PickListState | null>(null);
  const runInsertDelete = useInsertDeleteRunner();
  const open = !_.isEmpty(contextMenu);

  const focusSheet = useCallback(() => {
    refs.cellInput.current?.focus({ preventScroll: true });
  }, [refs.cellInput]);

  /** Apply `recipe` and close the menu. */
  const run = useCallback(
    (recipe: (draftCtx: Context) => void, options?: SetContextOptions) => {
      setContext((draftCtx) => {
        recipe(draftCtx);
        draftCtx.contextMenu = {};
      }, options);
      focusSheet();
    },
    [focusSheet, setContext]
  );

  const close = useCallback(() => {
    setContext((draftCtx) => {
      draftCtx.contextMenu = {};
    });
    focusSheet();
  }, [focusSheet, setContext]);

  const sel = context.luckysheet_select_save;
  const last = sel?.[sel.length - 1];
  const multi = (sel?.length ?? 0) > 1;
  const activeR = last ? (last.row_focus ?? last.row[0]) : 0;
  const activeC = last ? (last.column_focus ?? last.column[0]) : 0;
  const headerFlag = contextMenu.headerMenu as
    | boolean
    | "row"
    | "column"
    | undefined;
  let headerType: "row" | "column" | null = null;
  if (headerFlag === "row" || headerFlag === "column") headerType = headerFlag;
  else if (last?.row_select && !last.column_select) headerType = "row";
  else if (last?.column_select && !last.row_select) headerType = "column";

  const runRegistered = useCallback(
    (key: ContextMenuActionKey) => {
      const action = getContextMenuAction(key);
      close();
      action?.({
        ...workbookCtx,
        showDialog: (content) => showDialog(content),
        showModal,
        hideDialog,
      });
    },
    [close, hideDialog, showDialog, showModal, workbookCtx]
  );

  const runItem = useCallback(
    (custom: ContextMenuItem) => {
      close();
      custom.onSelect({
        ...workbookCtx,
        showDialog: (content) => showDialog(content),
        showModal,
        hideDialog,
      });
    },
    [close, hideDialog, showDialog, showModal, workbookCtx]
  );

  const insertOrDeleteRowCol = useCallback(
    (mode: "insert" | "delete", type: "row" | "column") => {
      if (!last) return;
      if (multi) {
        close();
        showAlert(rightclick.noMulti, "ok");
        return;
      }
      const range = { row: last.row, column: last.column };
      if (mode === "delete") {
        const d = getFlowdata(context);
        const total = type === "row" ? (d?.length ?? 0) : (d?.[0]?.length ?? 0);
        const [a, b] = type === "row" ? last.row : last.column;
        if (b - a + 1 >= total) {
          close();
          showAlert(
            type === "row"
              ? rightclick.cannotDeleteAllRow
              : rightclick.cannotDeleteAllColumn,
            "ok"
          );
          return;
        }
      }
      focusSheet();
      runInsertDelete(
        mode,
        type === "row" ? "entireRow" : "entireColumn",
        range
      );
    },
    [
      close,
      context,
      focusSheet,
      last,
      multi,
      rightclick,
      runInsertDelete,
      showAlert,
    ]
  );

  const flowdata = open ? getFlowdata(context) : null;
  const activeCell = flowdata?.[activeR]?.[activeC];
  const sheetIndex = getSheetIndex(context, context.currentSheetId);
  const sheet = sheetIndex == null ? null : context.luckysheetfile[sheetIndex];
  const hasAnyNote = useMemo(
    () => !!flowdata?.some((row) => row?.some((cell) => cell?.ps)),
    [flowdata]
  );
  const editable = open && isAllowEdit(context);
  // protected sheet: entries follow Protect Sheet's allowed actions (the
  // core guard still refuses locked cells, e.g. rows to delete)
  const protection = open ? getSheetProtection(context) : null;
  const allows = (action: SheetProtectionAction) =>
    protection
      ? open &&
        context.allowEdit !== false &&
        isProtectionActionAllowed(protection, action)
      : editable;
  const rowColAction = (
    mode: "insert" | "delete",
    type: "row" | "column"
  ): SheetProtectionAction => {
    if (mode === "insert")
      return type === "row" ? "insertRows" : "insertColumns";
    return type === "row" ? "deleteRows" : "deleteColumns";
  };

  // "Insert [n] rows above / below" with an inline count (FortuneSheet's
  // original items, still available through `cellContextMenu` settings).
  const legacyInsertRowCol = (type: "row" | "column"): MenuEntry[] => {
    if (!last) return [];
    if (type === "row" ? last.column_select : last.row_select) return [];
    const dirs = type === "row" ? ["top", "bottom"] : ["left", "right"];
    return dirs.map((dir) => ({
      type: "node",
      key: `add-${type}-${dir}`,
      node: (
        <div
          key={`add-${type}-${dir}`}
          className="ts-menu-item fortune-menu-count-item"
          role="menuitem"
          tabIndex={-1}
          data-key={`add-${type}-${dir}`}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.click();
            }
          }}
          onClick={(e) => {
            const container = e.currentTarget;
            const position = type === "row" ? last.row[0] : last.column[0];
            const countStr = container.querySelector("input")?.value;
            if (countStr == null) return;
            const count = parseInt(countStr, 10);
            if (!(count >= 1)) return;
            const direction =
              dir === "top" || dir === "left" ? "lefttop" : "rightbottom";
            const insertRowColOp: SetContextOptions["insertRowColOp"] = {
              type,
              index: position,
              count,
              direction,
              id: context.currentSheetId,
            };
            setContext(
              (draftCtx) => {
                try {
                  insertRowCol(draftCtx, insertRowColOp);
                } catch (err: any) {
                  if (err.message === "maxExceeded")
                    showAlert(
                      type === "row"
                        ? rightclick.rowOverLimit
                        : rightclick.columnOverLimit,
                      "ok"
                    );
                  else if (err.message === "readOnly")
                    showAlert(
                      type === "row"
                        ? rightclick.cannotInsertOnRowReadOnly
                        : rightclick.cannotInsertOnColumnReadOnly,
                      "ok"
                    );
                }
                draftCtx.contextMenu = {};
              },
              { insertRowColOp }
            );
          }}
        >
          <span className="ts-menu-icon">
            <Icon icon={menuIcon("insert")} />
          </span>
          <span className="ts-menu-label">
            {_.startsWith(context.lang ?? "", "zh") && (
              <>
                {rightclick.to}
                <span className={`luckysheet-cols-rows-shift-${dir}`}>
                  {(rightclick as any)[dir]}
                </span>
              </>
            )}
            {`${rightclick.insert}  `}
            <input
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              tabIndex={0}
              type="text"
              className="fortune-menu-count-input"
              aria-label={rightclick.number}
              placeholder={rightclick.number}
              defaultValue="1"
            />
            <span className="luckysheet-cols-rows-shift-word">
              {`${type === "row" ? rightclick.row : rightclick.column}  `}
            </span>
            {!_.startsWith(context.lang ?? "", "zh") && (
              <span className={`luckysheet-cols-rows-shift-${dir}`}>
                {(rightclick as any)[dir]}
              </span>
            )}
          </span>
        </div>
      ),
    }));
  };

  const buildEntry = (name: string, i: number): MenuEntry[] => {
    if (!last) return [];
    const item = (e: Omit<ItemEntry, "type">): MenuEntry[] => [
      { type: "item", ...e },
    ];
    switch (name) {
      case "|":
        return [{ type: "divider", key: `divider-${i}` }];
      case "cut":
        return item({
          key: name,
          label: cellMenu.cut,
          icon: "cut",
          shortcut: mod("X"),
          disabled: multi || !editable,
          onSelect: () =>
            run((draftCtx) => {
              handleCopy(draftCtx);
              draftCtx.luckysheet_paste_iscut = true;
            }),
        });
      case "copy":
        return item({
          key: name,
          label: cellMenu.copy,
          icon: "copy",
          shortcut: mod("C"),
          disabled: multi,
          onSelect: () => run((draftCtx) => handleCopy(draftCtx)),
        });
      case "paste": {
        if (!regeneratorRuntime) return [];
        const hasCopy = !!context.luckysheet_copy_save?.copyRange?.length;
        const special = multi || !editable || !hasCopy;
        const paste = async (option: PasteOption) => {
          if (option !== "all") {
            const options: PasteSpecialOptions =
              option === "transpose"
                ? { transpose: true }
                : option === "link"
                  ? { pasteLink: true }
                  : { paste: option };
            run((draftCtx) => {
              handlePasteSpecial(draftCtx, options);
            });
            return;
          }
          let clipboardText = "";
          const sessionClipboardText =
            sessionStorage.getItem("localClipboard") || "";
          try {
            clipboardText = await navigator.clipboard.readText();
          } catch (err) {
            console.warn(
              "Clipboard access blocked. Attempting to use sessionStorage fallback."
            );
          }
          const finalText = clipboardText || sessionClipboardText;
          run((draftCtx) => handlePasteByClick(draftCtx, finalText));
        };
        return [
          {
            type: "node",
            key: name,
            node: (
              <PasteOptions
                title={text.pasteOptions}
                onPaste={paste}
                options={[
                  { id: "all", label: text.pasteAll, disabled: !editable },
                  { id: "values", label: text.pasteValues, disabled: special },
                  {
                    id: "formulas",
                    label: text.pasteFormulas,
                    disabled: special,
                  },
                  {
                    id: "transpose",
                    label: text.pasteTranspose,
                    disabled: special,
                  },
                  {
                    id: "formats",
                    label: text.pasteFormatting,
                    disabled: special,
                  },
                  { id: "link", label: text.pasteLink, disabled: special },
                ]}
              />
            ),
          },
        ];
      }
      case "paste-special":
        if (!getContextMenuAction("pasteSpecial")) return [];
        return item({
          key: name,
          label: cellMenu.pasteSpecial,
          icon: "paste-special",
          shortcut: isMac ? "⌃⌘V" : "Ctrl+Alt+V",
          // pastes the last copy of the workbook
          disabled:
            multi ||
            !editable ||
            !context.luckysheet_copy_save?.copyRange?.length,
          onSelect: () => runRegistered("pasteSpecial"),
        });
      case "insert-cells":
      case "delete-cells":
      case "delete-cell": {
        const mode = name === "insert-cells" ? "insert" : "delete";
        let label = mode === "insert" ? cellMenu.insert : cellMenu.delete;
        // entire rows / columns are inserted or deleted without a dialog
        if (headerType) {
          label =
            mode === "insert" ? cellMenu.insertRowCol : cellMenu.deleteRowCol;
        }
        return item({
          key: name,
          label,
          icon: mode === "insert" ? "insert" : "delete",
          disabled:
            multi ||
            !(headerType ? allows(rowColAction(mode, headerType)) : editable),
          onSelect: () => {
            if (headerType) {
              insertOrDeleteRowCol(mode, headerType);
              return;
            }
            close();
            showModal(
              <InsertDeleteDialog
                mode={mode}
                range={{ row: last.row, column: last.column }}
              />
            );
          },
        });
      }
      case "insert-rowcol":
      case "delete-rowcol": {
        if (!headerType) return [];
        const mode = name === "insert-rowcol" ? "insert" : "delete";
        return item({
          key: name,
          label:
            mode === "insert" ? cellMenu.insertRowCol : cellMenu.deleteRowCol,
          icon: mode === "insert" ? "insert" : "delete",
          disabled: multi || !allows(rowColAction(mode, headerType)),
          onSelect: () => insertOrDeleteRowCol(mode, headerType!),
        });
      }
      case "delete-row":
      case "delete-column": {
        const type = name === "delete-row" ? "row" : "column";
        if (!(type === "row" ? last.row_select : last.column_select)) return [];
        return item({
          key: name,
          label: `${rightclick.deleteSelected}${
            type === "row" ? rightclick.row : rightclick.column
          }`,
          icon: "delete",
          disabled: !allows(rowColAction("delete", type)),
          onSelect: () => insertOrDeleteRowCol("delete", type),
        });
      }
      case "clear":
        return item({
          key: name,
          label: cellMenu.clearContents,
          icon: "clear",
          shortcut: isMac ? "⌫" : "Del",
          disabled: !editable,
          onSelect: () =>
            run((draftCtx) => {
              if (draftCtx.activeImg != null) {
                removeActiveImage(draftCtx);
              } else {
                const msg = deleteSelectedCellText(draftCtx);
                if (msg === "partMC") {
                  showDialog(generalDialog.partiallyError, "ok");
                } else if (msg === "allowEdit") {
                  showDialog(generalDialog.readOnlyError, "ok");
                } else if (msg === "dataNullError") {
                  showDialog(generalDialog.dataNullError, "ok");
                } else if (msg === "success") {
                  clearGroupedSheetsContents(draftCtx);
                }
              }
              jfrefreshgrid(draftCtx, null, undefined);
            }),
        });
      case "filter":
      case "filter-menu": {
        const hasFilter = _.size(context.luckysheet_filter_save) > 0;
        const toggle: ItemEntry = {
          type: "item",
          key: "filter-toggle",
          label: hasFilter ? cellMenu.clearFilter : cellMenu.addFilter,
          icon: hasFilter ? "filter-clear" : "filter",
          disabled: multi || !editable,
          onSelect: () => run((draftCtx) => createFilter(draftCtx)),
        };
        if (name === "filter") return [toggle];
        return item({
          key: name,
          label: cellMenu.filter,
          icon: "filter",
          children: [toggle],
        });
      }
      case "orderAZ":
      case "orderZA":
      case "sort":
      case "sort-menu": {
        const sortItem = (asc: boolean): ItemEntry => ({
          type: "item",
          key: asc ? "sort-az" : "sort-za",
          label: asc ? cellMenu.sortAZ : cellMenu.sortZA,
          icon: asc ? "sort-az" : "sort-za",
          disabled: multi || !editable,
          onSelect: () => run((draftCtx) => sortSelection(draftCtx, asc)),
        });
        const custom: ItemEntry = {
          type: "item",
          key: "sort-custom",
          label: cellMenu.customSort,
          disabled: multi || !editable,
          onSelect: () => {
            close();
            showDialog(<CustomSort />);
          },
        };
        if (name === "orderAZ") return [sortItem(true)];
        if (name === "orderZA") return [sortItem(false)];
        if (name === "sort") return [custom];
        return item({
          key: name,
          label: cellMenu.sort,
          icon: "sort",
          children: [sortItem(true), sortItem(false), custom],
        });
      }
      case "comment": {
        const noteItem = (
          key: string,
          label: string,
          fn: typeof newComment,
          icon?: string
        ): ItemEntry => ({
          type: "item",
          key,
          label,
          icon,
          disabled: !allows("editObjects"),
          onSelect: () => {
            setContext((draftCtx) => {
              fn(draftCtx, refs.globalCache, activeR, activeC);
              draftCtx.contextMenu = {};
            });
          },
        });
        const out: MenuEntry[] = activeCell?.ps
          ? [
              noteItem("edit-note", cellMenu.editNote, editComment, "note"),
              noteItem("delete-note", cellMenu.deleteNote, deleteComment),
              noteItem("show-note", cellMenu.showNote, showHideComment),
            ]
          : [noteItem("insert-note", cellMenu.insertNote, newComment, "note")];
        if (hasAnyNote) {
          out.push({
            type: "item",
            key: "show-all-notes",
            label: cellMenu.showAllNotes,
            onSelect: () => run((draftCtx) => showHideAllComments(draftCtx)),
          });
        }
        return out;
      }
      case "cell-format":
        if (!getContextMenuAction("formatCells")) return [];
        return item({
          key: name,
          label: cellMenu.formatCells,
          icon: "format",
          shortcut: mod("1"),
          disabled: !allows("formatCells"),
          onSelect: () => runRegistered("formatCells"),
        });
      case "pick-list": {
        if (headerType) return [];
        const values = getPickListValues(context, activeR, activeC);
        return item({
          key: name,
          label: cellMenu.pickFromList,
          icon: "list",
          shortcut: isMac ? "⌥↓" : "Alt+↓",
          disabled: multi || !editable || values.length === 0,
          onSelect: () => {
            const anchor = activeCellAnchor(
              context,
              refs.cellArea.current,
              refs.workbookContainer.current
            );
            close();
            if (!anchor) return;
            setPickList({
              r: activeR,
              c: activeC,
              left: anchor.cellLeft,
              top: anchor.y,
              minWidth: anchor.cellWidth,
              values,
            });
          },
        });
      }
      case "define-name":
        if (!getContextMenuAction("defineName")) return [];
        return item({
          key: name,
          label: cellMenu.defineName,
          icon: "name",
          disabled: !editable,
          onSelect: () => runRegistered("defineName"),
        });
      case "link": {
        const link = sheet?.hyperlink?.[`${activeR}_${activeC}`];
        const out: MenuEntry[] = item({
          key: name,
          label: link ? cellMenu.editLink : cellMenu.link,
          icon: "link",
          shortcut: mod("K"),
          disabled: multi || !allows("insertHyperlinks"),
          onSelect: () => run((draftCtx) => handleLink(draftCtx)),
        });
        if (link) {
          out.push({
            type: "item",
            key: "remove-link",
            label: cellMenu.removeLink,
            disabled: !allows("insertHyperlinks"),
            onSelect: () =>
              run((draftCtx) => removeHyperlink(draftCtx, activeR, activeC)),
          });
        }
        return out;
      }
      case "image":
        return item({
          key: name,
          label: cellMenu.insertImage,
          icon: "image",
          disabled: !allows("editObjects"),
          onSelect: () => run(() => showImgChooser()),
        });
      case "data":
        return item({
          key: name,
          label: cellMenu.dataValidation,
          icon: "validation",
          disabled: multi || !editable,
          onSelect: () => {
            close();
            showDialog(<DataVerification />);
          },
        });
      case "chart":
        if (!getContextMenuAction("insertChart")) return [];
        return item({
          key: name,
          label: cellMenu.insertChart,
          icon: "chart",
          disabled: !allows("editObjects"),
          onSelect: () => runRegistered("insertChart"),
        });
      case "set-row-height":
      case "set-column-width": {
        const type = name === "set-row-height" ? "row" : "column";
        const selected = (sel || []).filter((s) =>
          type === "row" ? s.row_select : s.column_select
        );
        if (headerType !== type && selected.length === 0) return [];
        const targets = spannedIndexes(
          selected.length ? selected : [last],
          type
        );
        const cfg = sheet?.config || {};
        const sizes = _.uniq(
          targets.map((t) =>
            type === "row"
              ? (cfg.rowlen?.[t] ?? context.defaultrowlen)
              : (cfg.columnlen?.[t] ?? context.defaultcollen)
          )
        );
        return item({
          key: name,
          label: type === "row" ? cellMenu.rowHeight : cellMenu.columnWidth,
          icon: type === "row" ? "rowHeight" : "columnWidth",
          disabled:
            !context.allowEdit ||
            !allows(type === "row" ? "formatRows" : "formatColumns"),
          onSelect: () => {
            close();
            showModal(
              <SizeDialog
                type={type}
                targets={targets}
                initial={sizes.length === 1 ? Math.round(sizes[0]) : ""}
              />
            );
          },
        });
      }
      case "autofit": {
        if (!headerType) return [];
        const type = headerType;
        const selected = (sel || []).filter((s) =>
          type === "row" ? s.row_select : s.column_select
        );
        const targets = spannedIndexes(
          selected.length ? selected : [last],
          type
        );
        return item({
          key: name,
          label:
            type === "row"
              ? cellMenu.autofitRowHeight
              : cellMenu.autofitColumnWidth,
          icon: "autofit",
          disabled:
            !context.allowEdit ||
            !allows(type === "row" ? "formatRows" : "formatColumns"),
          onSelect: () =>
            run((draftCtx) =>
              (type === "row" ? autofitRows : autofitColumns)(draftCtx, targets)
            ),
        });
      }
      case "hide-row":
      case "hide-column": {
        const type = name === "hide-row" ? "row" : "column";
        const selected = type === "row" ? last.row_select : last.column_select;
        if (headerType !== type && !selected) return [];
        const act = (hide: boolean) => () =>
          run((draftCtx) => {
            if (hide) {
              if (hideSelected(draftCtx, type) === "noMulti") {
                showDialog(drag.noMulti);
              }
            } else {
              showSelected(draftCtx, type);
            }
          });
        return [
          {
            type: "item",
            key: `${name}-hide`,
            label: cellMenu.hide,
            icon: "hide",
            disabled:
              !context.allowEdit ||
              !allows(type === "row" ? "formatRows" : "formatColumns"),
            onSelect: act(true),
          },
          {
            type: "item",
            key: `${name}-unhide`,
            label: cellMenu.unhide,
            icon: "unhide",
            disabled:
              !context.allowEdit ||
              !allows(type === "row" ? "formatRows" : "formatColumns"),
            onSelect: act(false),
          },
        ];
      }
      case "insert-row":
      case "insert-column":
        return legacyInsertRowCol(name === "insert-row" ? "row" : "column");
      default: {
        // entries registered by features (actions.ts)
        const custom = getContextMenuItem(name);
        if (!custom) return [];
        if (typeof custom === "function") {
          const helpers = {
            ...workbookCtx,
            showDialog: (content: React.ReactNode) => showDialog(content),
            hideDialog,
            showModal,
          };
          const built = custom({
            ...helpers,
            r: activeR,
            c: activeC,
            headerType,
            close,
          });
          if (!built) return [];
          const toEntry = (x: BuiltContextMenuItem): ItemEntry => ({
            type: "item",
            key: x.key,
            label: x.label,
            icon: x.icon,
            shortcut: x.shortcut,
            disabled: x.disabled,
            children: x.children?.map(toEntry),
            onSelect: x.onSelect
              ? () => {
                  close();
                  x.onSelect!(helpers);
                }
              : undefined,
          });
          return (Array.isArray(built) ? built : [built]).map(toEntry);
        }
        if (custom.visible?.(context) === false) return [];
        return item({
          key: name,
          label: custom.label(context),
          icon: custom.icon,
          disabled: !editable || !!custom.disabled?.(context),
          onSelect: () => runItem(custom),
        });
      }
    }
  };

  let names = headerType
    ? settings.headerContextMenu
    : settings.cellContextMenu;
  if (contextMenu.imageMenu) names = getContextMenuItemNames("image");
  const entries = open
    ? tidyDividers(_.flatMap(names, (name, i) => buildEntry(name, i)))
    : [];
  // entries -> MenuList items (lucide icons, data-key = entry key)
  const toMenuItems = (list: MenuEntry[]): MenuItem[] =>
    list.map((entry): MenuItem => {
      if (entry.type === "divider") return { type: "separator", id: entry.key };
      if (entry.type === "node") {
        return { type: "custom", id: entry.key, render: () => entry.node };
      }
      return {
        id: entry.key,
        label: entry.label,
        icon: menuIcon(entry.icon),
        shortcut: entry.shortcut,
        disabled: entry.disabled,
        children: entry.children?.length
          ? toMenuItems(entry.children)
          : undefined,
        // entries close the menu themselves (a dialog may take the focus)
        onSelect: entry.onSelect ?? close,
      };
    });
  const menuItems = open ? toMenuItems(entries) : [];

  // keyboard: Shift+F10 / the context-menu key open the menu at the active
  // cell (entire rows / columns get the header menu)
  const contextRef = useRef(context);
  contextRef.current = context;
  useEffect(() => {
    const wb = refs.workbookContainer.current;
    if (!wb) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+- / Ctrl+Shift+= on cells (not entire rows / columns): the
      // Delete… / Insert… dialog, as in Excel
      const cellsMode = getInsertDeleteCellsShortcut(
        contextRef.current,
        e,
        refs.cellInput.current,
        refs.fxInput.current
      );
      if (cellsMode) {
        const s = contextRef.current.luckysheet_select_save?.[0];
        if (!s) return;
        e.preventDefault();
        e.stopPropagation();
        showModal(
          <InsertDeleteDialog
            mode={cellsMode}
            range={{ row: s.row, column: s.column }}
          />
        );
        return;
      }
      const isMenuKey =
        e.key === "ContextMenu" || (e.shiftKey && e.key === "F10");
      // Alt+Down: Pick From Drop-down List (validation lists keep the key)
      const isPickKey =
        e.altKey && !e.ctrlKey && !e.metaKey && e.key === "ArrowDown";
      if (!isMenuKey && !isPickKey) return;
      const ctx = contextRef.current;
      if (!ctx.allowEdit || ctx.luckysheetCellUpdate.length > 0) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target !== refs.cellInput.current &&
        (target.closest(".fortune-context-menu, .ts-context-menu") ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      const anchor = activeCellAnchor(
        ctx,
        refs.cellArea.current,
        refs.workbookContainer.current
      );
      if (!anchor) return;
      if (isPickKey) {
        const idx = getSheetIndex(ctx, ctx.currentSheetId);
        const dv =
          idx == null ? null : ctx.luckysheetfile[idx].dataVerification;
        if (dv?.[`${anchor.r}_${anchor.c}`]) return;
        e.preventDefault();
        e.stopPropagation();
        const values = getPickListValues(ctx, anchor.r, anchor.c);
        if (values.length > 0) {
          setPickList({
            r: anchor.r,
            c: anchor.c,
            left: anchor.cellLeft,
            top: anchor.y,
            minWidth: anchor.cellWidth,
            values,
          });
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setContext((draftCtx) => {
        const s = draftCtx.luckysheet_select_save?.[0];
        let header: "row" | "column" | undefined;
        if (s?.row_select && !s.column_select) header = "row";
        else if (s?.column_select && !s.row_select) header = "column";
        const wbRect = refs.workbookContainer.current!.getBoundingClientRect();
        draftCtx.contextMenu = {
          x: anchor.x,
          y: anchor.y,
          pageX: anchor.x + wbRect.left,
          pageY: anchor.y + wbRect.top,
        };
        if (header) _.set(draftCtx.contextMenu, "headerMenu", header);
      });
    };
    wb.addEventListener("keydown", onKeyDown, true);
    return () => wb.removeEventListener("keydown", onKeyDown, true);
  }, [
    refs.cellArea,
    refs.cellInput,
    refs.fxInput,
    refs.workbookContainer,
    setContext,
    showModal,
  ]);

  const wbRect = open
    ? refs.workbookContainer.current?.getBoundingClientRect()
    : undefined;
  return (
    <>
      {open && (
        <ContextMenuPopup
          x={(wbRect?.left ?? 0) + (contextMenu.x ?? 0)}
          y={(wbRect?.top ?? 0) + (contextMenu.y ?? 0)}
          items={menuItems}
          within={refs.workbookContainer.current}
          className="fortune-context-menu-list fortune-cell-menu"
          popupClassName="fortune-context-menu-popup"
          submenuClassName="fortune-cell-submenu"
          minWidth={232}
          aria-label={
            contextMenu.imageMenu
              ? text.pictureMenu
              : headerType === "row"
                ? text.rowMenu
                : headerType === "column"
                  ? text.columnMenu
                  : text.cellMenu
          }
          onClose={(reason) => {
            if (reason === "select") return;
            if (reason === "outside") {
              setContext((draftCtx) => {
                draftCtx.contextMenu = {};
              });
              return;
            }
            close();
          }}
        />
      )}
      {pickList && (
        <PickList state={pickList} onClose={() => setPickList(null)} />
      )}
    </>
  );
};

export default ContextMenu;
