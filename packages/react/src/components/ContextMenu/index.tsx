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
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, {
  useContext,
  useRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  useMemo,
  useState,
} from "react";
import regeneratorRuntime from "regenerator-runtime";
import WorkbookContext, { SetContextOptions } from "../../context";
import { ModalContext } from "../../context/modal";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
import Divider from "./Divider";
import "./index.css";
import "./cellMenu.css";
import Menu from "./Menu";
import MenuIcon from "./icons";
import CustomSort from "../CustomSort";
import DataVerification from "../DataVerification";
import {
  getContextMenuAction,
  getContextMenuItem,
  ContextMenuActionKey,
  ContextMenuItem,
} from "./actions";
import { registerDefaultContextMenuActions } from "./defaultActions";
import {
  InsertDeleteDialog,
  SizeDialog,
  useInsertDeleteRunner,
} from "./dialogs";
import PickList, { PickListState } from "./PickList";

registerDefaultContextMenuActions();

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

function menuItemsOf(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      ":scope > .luckysheet-cols-menuitem"
    )
  ).filter((el) => el.getAttribute("aria-disabled") !== "true");
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
  const containerRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const workbookCtx = useContext(WorkbookContext);
  const { context, setContext, settings, refs } = workbookCtx;
  const { contextMenu } = context;
  const { showAlert } = useAlert();
  const { rightclick, drag, generalDialog, cellMenu } = locale(context);
  const [submenu, setSubmenu] = useState<{
    key: string;
    left: number;
    top: number;
    focus: boolean;
  } | null>(null);
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

  useEffect(() => {
    if (!open) setSubmenu(null);
  }, [open]);

  const sel = context.luckysheet_select_save;
  const last = sel?.[sel.length - 1];
  const multi = (sel?.length ?? 0) > 1;
  const activeR = last ? last.row_focus ?? last.row[0] : 0;
  const activeC = last ? last.column_focus ?? last.column[0] : 0;
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
        hideDialog,
      });
    },
    [close, hideDialog, showDialog, workbookCtx]
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
        const total = type === "row" ? d?.length ?? 0 : d?.[0]?.length ?? 0;
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
        <Menu
          key={`add-${type}-${dir}`}
          onClick={(e, container) => {
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
          <>
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
              className="luckysheet-mousedown-cancel"
              placeholder={rightclick.number}
              defaultValue="1"
            />
            <span className="luckysheet-cols-rows-shift-word luckysheet-mousedown-cancel">
              {`${type === "row" ? rightclick.row : rightclick.column}  `}
            </span>
            {!_.startsWith(context.lang ?? "", "zh") && (
              <span className={`luckysheet-cols-rows-shift-${dir}`}>
                {(rightclick as any)[dir]}
              </span>
            )}
          </>
        </Menu>
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
      case "paste":
        if (!regeneratorRuntime) return [];
        return item({
          key: name,
          label: cellMenu.paste,
          icon: "paste",
          shortcut: mod("V"),
          disabled: !editable,
          onSelect: async () => {
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
          },
        });
      case "paste-special":
        if (!getContextMenuAction("pasteSpecial")) return [];
        return item({
          key: name,
          label: cellMenu.pasteSpecial,
          icon: "paste",
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
          disabled: multi || !editable,
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
          disabled: multi || !editable,
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
          disabled: !editable,
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
          icon: "filter",
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
          icon: "sort",
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
          disabled: !editable,
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
          disabled: !editable,
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
          disabled: multi || !editable,
          onSelect: () => run((draftCtx) => handleLink(draftCtx)),
        });
        if (link) {
          out.push({
            type: "item",
            key: "remove-link",
            label: cellMenu.removeLink,
            disabled: !editable,
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
          disabled: !editable,
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
          disabled: !editable,
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
              ? cfg.rowlen?.[t] ?? context.defaultrowlen
              : cfg.columnlen?.[t] ?? context.defaultcollen
          )
        );
        return item({
          key: name,
          label: type === "row" ? cellMenu.rowHeight : cellMenu.columnWidth,
          icon: type === "row" ? "rowHeight" : "columnWidth",
          disabled: !context.allowEdit,
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
          disabled: !context.allowEdit,
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
            disabled: !context.allowEdit,
            onSelect: act(true),
          },
          {
            type: "item",
            key: `${name}-unhide`,
            label: cellMenu.unhide,
            icon: "unhide",
            disabled: !context.allowEdit,
            onSelect: act(false),
          },
        ];
      }
      case "insert-row":
      case "insert-column":
        return legacyInsertRowCol(name === "insert-row" ? "row" : "column");
      default: {
        // entries registered by features (registerContextMenuItem)
        const build = getContextMenuItem(name);
        const helpers = {
          ...workbookCtx,
          showDialog: (content: React.ReactNode) => showDialog(content),
          hideDialog,
        };
        const built = build?.({ ...helpers, headerType });
        if (!built) return [];
        const toEntry = (x: ContextMenuItem): ItemEntry => ({
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
    }
  };

  const names = headerType
    ? settings.headerContextMenu
    : settings.cellContextMenu;
  const entries = open
    ? tidyDividers(_.flatMap(names, (name, i) => buildEntry(name, i)))
    : [];
  const submenuParent = submenu
    ? (entries.find((e) => e.type === "item" && e.key === submenu.key) as
        | ItemEntry
        | undefined)
    : undefined;

  const openSubmenu = (key: string, el: HTMLElement, focus: boolean) => {
    const wb = refs.workbookContainer.current?.getBoundingClientRect();
    const menu = containerRef.current?.getBoundingClientRect();
    if (!wb || !menu) return;
    const itemRect = el.getBoundingClientRect();
    setSubmenu({
      key,
      left: menu.right - wb.left - 2,
      top: itemRect.top - wb.top - 5,
      focus,
    });
  };

  const onMenuKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    level: 0 | 1
  ) => {
    const container = e.currentTarget;
    const items = menuItemsOf(container);
    const current = document.activeElement as HTMLElement | null;
    const index = current ? items.indexOf(current) : -1;
    const focusAt = (i: number) =>
      items[(i + items.length) % items.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        focusAt(index + 1);
        break;
      case "ArrowUp":
        focusAt(index <= 0 ? items.length - 1 : index - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(items.length - 1);
        break;
      case "ArrowRight":
        if (level === 0 && current?.getAttribute("aria-haspopup") === "menu") {
          openSubmenu(current.dataset.key!, current, true);
        }
        break;
      case "ArrowLeft":
        if (level === 1) {
          setSubmenu(null);
          containerRef.current
            ?.querySelector<HTMLElement>(`[data-key="${submenu?.key}"]`)
            ?.focus();
        }
        break;
      case "Escape":
        if (level === 1) {
          setSubmenu(null);
          containerRef.current
            ?.querySelector<HTMLElement>(`[data-key="${submenu?.key}"]`)
            ?.focus();
        } else {
          close();
        }
        break;
      case "Enter":
      case " ":
        if (current && items.includes(current)) current.click();
        break;
      case "Tab":
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const renderEntries = (list: MenuEntry[], level: 0 | 1) =>
    list.map((entry) => {
      if (entry.type === "divider") return <Divider key={entry.key} />;
      if (entry.type === "node") return entry.node;
      const hasChildren = !!entry.children?.length;
      const expanded = level === 0 && submenu?.key === entry.key;
      return (
        <div
          key={entry.key}
          data-key={entry.key}
          role="menuitem"
          tabIndex={entry.disabled ? -1 : 0}
          aria-disabled={entry.disabled || undefined}
          aria-haspopup={hasChildren ? "menu" : undefined}
          aria-expanded={hasChildren ? expanded : undefined}
          className={`luckysheet-cols-menuitem luckysheet-mousedown-cancel fortune-menuitem${
            entry.disabled ? " fortune-menuitem-disabled" : ""
          }${expanded ? " fortune-menuitem-expanded" : ""}`}
          onMouseEnter={(e) => {
            if (level !== 0) return;
            if (hasChildren && !entry.disabled) {
              openSubmenu(entry.key, e.currentTarget, false);
            } else if (submenu) {
              setSubmenu(null);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (entry.disabled) return;
            if (hasChildren) {
              openSubmenu(entry.key, e.currentTarget, true);
              return;
            }
            entry.onSelect?.();
          }}
        >
          <div className="luckysheet-cols-menuitem-content luckysheet-mousedown-cancel fortune-menuitem-content">
            <span className="fortune-menuitem-icon">
              {entry.icon && <MenuIcon name={entry.icon} />}
            </span>
            <span className="fortune-menuitem-label">{entry.label}</span>
            {entry.shortcut && (
              <span className="fortune-menuitem-shortcut">
                {entry.shortcut}
              </span>
            )}
            {hasChildren && (
              <span className="fortune-menuitem-arrow">
                <MenuIcon name="chevron" size={16} />
              </span>
            )}
          </div>
        </div>
      );
    });

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
        (target.closest(".fortune-context-menu") ||
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

  useLayoutEffect(() => {
    // re-position the context menu if it overflows the window
    if (!containerRef.current) {
      return;
    }
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    const rect = containerRef.current.getBoundingClientRect();
    const workbookRect =
      refs.workbookContainer.current?.getBoundingClientRect();
    if (!workbookRect) {
      return;
    }
    const menuW = rect.width;
    const menuH = rect.height;
    let top = contextMenu.y || 0;
    let left = contextMenu.x || 0;

    let hasOverflow = false;
    if (workbookRect.left + left + menuW > winW) {
      left -= menuW;
      hasOverflow = true;
    }
    if (workbookRect.top + top + menuH > winH) {
      top -= menuH;
      hasOverflow = true;
    }
    if (top < 0) {
      top = 0;
      hasOverflow = true;
    }
    if (hasOverflow) {
      setContext((draftCtx) => {
        draftCtx.contextMenu.x = left;
        draftCtx.contextMenu.y = top;
      });
    }
  }, [contextMenu.x, contextMenu.y, refs.workbookContainer, setContext]);

  // focus the first enabled item when the menu opens
  useLayoutEffect(() => {
    if (!open) return;
    menuItemsOf(containerRef.current)[0]?.focus({ preventScroll: true });
  }, [open, contextMenu.x, contextMenu.y]);

  // keep the submenu on screen, then focus it when opened from the keyboard
  useLayoutEffect(() => {
    const el = submenuRef.current;
    if (!submenu || !el) return;
    const wb = refs.workbookContainer.current?.getBoundingClientRect();
    const menu = containerRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (wb && menu && rect.right > window.innerWidth) {
      el.style.left = `${menu.left - wb.left - rect.width + 2}px`;
    }
    if (wb && rect.bottom > window.innerHeight) {
      el.style.top = `${Math.max(
        0,
        submenu.top - (rect.bottom - window.innerHeight)
      )}px`;
    }
    if (submenu.focus) menuItemsOf(el)[0]?.focus({ preventScroll: true });
  }, [submenu, refs.workbookContainer]);

  return (
    <>
      {open && (
        <div
          role="menu"
          className="fortune-context-menu luckysheet-cols-menu fortune-cell-menu"
          ref={containerRef}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => onMenuKeyDown(e, 0)}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {renderEntries(entries, 0)}
        </div>
      )}
      {open && submenuParent?.children && submenu && (
        <div
          role="menu"
          aria-label={submenuParent.label}
          className="fortune-context-menu luckysheet-cols-menu fortune-cell-menu fortune-cell-submenu"
          ref={submenuRef}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => onMenuKeyDown(e, 1)}
          style={{ left: submenu.left, top: submenu.top }}
        >
          {renderEntries(submenuParent.children, 1)}
        </div>
      )}
      {pickList && (
        <PickList state={pickList} onClose={() => setPickList(null)} />
      )}
    </>
  );
};

export default ContextMenu;
