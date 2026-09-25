import _ from "lodash";
import { removeActiveImage } from "..";
import { Context, getFlowdata } from "../context";
import { updateCell, cancelNormalSelected } from "../modules/cell";
import { functionCopy, handleFormulaInput } from "../modules/formula";
import {
  copy,
  deleteSelectedCellText,
  moveHighlightCell,
  normalizeSelection,
  selectionCache,
} from "../modules/selection";
import {
  cancelPaintModel,
  handleBold,
  handleCurrencyFormat,
  handleItalic,
  handleStrikeThrough,
  handleUnderline,
  updateFormat,
} from "../modules/toolbar";
import { hasPartMC } from "../modules/validation";
import { GlobalCache, Selection } from "../types";
import { getNowDateTime, isAllowEdit } from "../utils";
import { handleCopy } from "./copy";
import { openPasteSpecial } from "./paste";
import { jfrefreshgrid } from "../modules/refresh";
import { fillSelectionFromEdge } from "../modules/dropCell";
import {
  deleteRowCol,
  hideSelected,
  insertRowCol,
  showSelected,
} from "../modules/rowcol";
import * as nav from "../modules/navigation";
import { openFormatCells } from "../modules/formatCells";
import { handleNavigationShortcut } from "../modules/goTo";
import { runShortcut } from "../modules/extensions";
import {
  clearEditMode,
  endPointMode,
  getEditorArrowAction,
  movePointReference,
  returnToEditSheet,
  setEditMode,
  toggleEditMode,
} from "../modules/editMode";
import { closeFormulaParens } from "../modules/formulaEditor";
import { clearGroupedSheetsContents } from "../modules/sheet";

const MODIFIER_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "AltGraph",
  "CapsLock",
  "OS",
]);

const ARROW_DIRECTIONS: Record<string, nav.NavDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function isSemicolonKey(e: KeyboardEvent) {
  return (
    e.key === ";" ||
    e.key === ":" ||
    e.code === "Semicolon" ||
    e.keyCode === 186
  );
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Ctrl+; inserts today's date, Ctrl+Shift+; the current time. */
function currentDateOrTime(time: boolean) {
  if (!time) return getNowDateTime(1);
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** Excel's Ctrl+Shift+1..6 / Ctrl+Shift+~ number formats. */
const NUMBER_FORMAT_SHORTCUTS: Record<string, string> = {
  Backquote: "General",
  Digit1: "#,##0.00",
  Digit2: "hh:mm AM/PM",
  Digit3: "yyyy-MM-dd",
  Digit5: "0%",
  Digit6: "0.00E+00",
};

/** Controls that own their keys (toolbar buttons, menus, dialog inputs...). */
const INTERACTIVE_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a[href]",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  ...[
    "button",
    "checkbox",
    "combobox",
    "dialog",
    "listbox",
    "menu",
    "menubar",
    "menuitem",
    "option",
    "radio",
    "slider",
    "spinbutton",
    "tab",
    "tablist",
    "textbox",
  ].map((role) => `[role="${role}"]`),
].join(",");

/**
 * True when the key event comes from an interactive element outside the grid
 * (anything but the cell editor and the formula bar), which must keep its
 * own keyboard behaviour (Tab, arrows, Enter...).
 */
export function isKeyFromForeignControl(
  e: KeyboardEvent,
  cellInput?: HTMLElement | null,
  fxInput?: HTMLElement | null
) {
  const { target } = e;
  if (typeof Element === "undefined" || !(target instanceof Element))
    return false;
  if (cellInput && (target === cellInput || cellInput.contains(target)))
    return false;
  if (fxInput && (target === fxInput || fxInput.contains(target))) return false;
  return target.closest(INTERACTIVE_SELECTOR) != null;
}

function selectionContains(
  selection: Selection[] | undefined,
  r: number,
  c: number
) {
  const last = selection?.[selection.length - 1];
  return (
    !!last &&
    r >= last.row[0] &&
    r <= last.row[1] &&
    c >= last.column[0] &&
    c <= last.column[1]
  );
}

function isMultiCell(selection: Selection[] | undefined) {
  const last = selection?.[selection.length - 1];
  return (
    !!last && (last.row[0] !== last.row[1] || last.column[0] !== last.column[1])
  );
}

/**
 * Ctrl+Enter while editing: writes the entered value into every cell of the
 * selection (formulas get their relative references adjusted per cell) and
 * keeps the selection.
 */
function commitToSelection(
  ctx: Context,
  cellInput: HTMLDivElement,
  origin: [number, number],
  selection: Selection[] | undefined,
  canvas?: CanvasRenderingContext2D
) {
  const [r0, c0] = origin;
  const text = cellInput.innerText;
  updateCell(ctx, r0, c0, cellInput, undefined, canvas);

  const d = getFlowdata(ctx);
  if (!d || !selection || selection.length === 0) return;
  const originFormula = d[r0]?.[c0]?.f;

  selection.forEach((range) => {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        if (r === r0 && c === c0) continue;
        const cell = d[r]?.[c];
        if (cell?.mc && (cell.mc.r !== r || cell.mc.c !== c)) continue;
        let value: string = text;
        if (originFormula) {
          let f = originFormula;
          const dr = r - r0;
          const dc = c - c0;
          if (dr !== 0)
            f = `=${functionCopy(
              ctx,
              f,
              dr > 0 ? "down" : "up",
              Math.abs(dr)
            )}`;
          if (dc !== 0)
            f = `=${functionCopy(
              ctx,
              f,
              dc > 0 ? "right" : "left",
              Math.abs(dc)
            )}`;
          value = f;
        }
        updateCell(ctx, r, c, null, value, canvas);
      }
    }
  });

  ctx.luckysheetCellUpdate = [];
  const restored = _.cloneDeep(selection);
  const last = restored[restored.length - 1];
  last.row_focus = r0;
  last.column_focus = c0;
  ctx.luckysheet_select_save = normalizeSelection(ctx, restored);
}

/**
 * Commits the cell being edited (the text of `editor`, the in-cell editor or
 * the formula bar) and moves the active cell.
 *
 * - `how: "enter"` (Enter, Shift+Enter, Tab, Shift+Tab): inside a
 *   multi-cell selection that contains the edited cell the selection is
 *   kept and the active cell wraps within it; otherwise the selection
 *   collapses and the active cell moves (Enter after a run of Tabs returns
 *   to the column where the run started).
 * - `how: "arrow"` (arrow keys in Enter mode): collapses the selection and
 *   moves one cell.
 */
export function commitEditAndMove(
  ctx: Context,
  editor: HTMLDivElement,
  direction: nav.NavDirection,
  how: "enter" | "arrow",
  canvas?: CanvasRenderingContext2D
) {
  if (ctx.luckysheetCellUpdate.length < 2) return;
  const cell = _.clone(ctx.luckysheetCellUpdate) as [number, number];
  const prevSelection = _.cloneDeep(ctx.luckysheet_select_save);
  closeFormulaParens(editor);
  updateCell(ctx, cell[0], cell[1], editor, undefined, canvas);
  clearEditMode(ctx);
  if (
    how === "enter" &&
    isMultiCell(prevSelection) &&
    selectionContains(prevSelection, cell[0], cell[1])
  ) {
    const last = prevSelection![prevSelection!.length - 1];
    [last.row_focus, last.column_focus] = cell;
    ctx.luckysheet_select_save = prevSelection;
    nav.moveAfterEnter(ctx, direction);
    return;
  }
  ctx.luckysheet_select_save = [
    {
      row: [cell[0], cell[0]],
      column: [cell[1], cell[1]],
      row_focus: cell[0],
      column_focus: cell[1],
    },
  ];
  if (how === "enter") {
    nav.moveAfterEnter(ctx, direction);
  } else {
    ctx.tabReturn = undefined;
    nav.moveActiveCell(ctx, direction);
  }
}

export function handleGlobalEnter(
  ctx: Context,
  cellInput: HTMLDivElement,
  e: KeyboardEvent,
  canvas?: CanvasRenderingContext2D
) {
  // const flowdata = getFlowdata(ctx);
  if ((e.altKey || e.metaKey) && ctx.luckysheetCellUpdate.length > 0) {
    const last =
      ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
    if (last && !_.isNil(last.row_focus) && !_.isNil(last.column_focus)) {
      // const row_index = last.row_focus;
      // const col_index = last.column_focus;
      // enterKeyControll(flowdata?.[row_index]?.[col_index]);
    }
    e.preventDefault();
  } else if (ctx.luckysheetCellUpdate.length > 0) {
    if (e.ctrlKey) {
      // Ctrl+Enter: fill the whole selection with the entered value
      const lastCellUpdate = _.clone(ctx.luckysheetCellUpdate) as [
        number,
        number
      ];
      const prevSelection = _.cloneDeep(ctx.luckysheet_select_save);
      closeFormulaParens(cellInput);
      commitToSelection(ctx, cellInput, lastCellUpdate, prevSelection, canvas);
      clearEditMode(ctx);
      e.preventDefault();
      return;
    }

    commitEditAndMove(
      ctx,
      cellInput,
      e.shiftKey ? "up" : "down",
      "enter",
      canvas
    );
    e.preventDefault();
  } else if ((ctx.luckysheet_select_save?.length ?? 0) > 0) {
    // Like Excel, Enter moves the active cell (down, Shift+Enter up) and
    // wraps inside a multi-cell selection; F2 starts editing.
    nav.moveAfterEnter(ctx, e.shiftKey ? "up" : "down");
    e.preventDefault();
  }
}

/**
 * Shortcuts that also apply while a cell is being edited. Returns true when
 * the key was handled.
 */
function handleEditModeShortcut(
  ctx: Context,
  e: KeyboardEvent,
  cellInput: HTMLDivElement
): boolean {
  if (isSemicolonKey(e)) {
    // insert the date/time at the caret
    if (typeof document.execCommand === "function") {
      document.execCommand("insertText", false, currentDateOrTime(e.shiftKey));
    }
    e.preventDefault();
    return true;
  }
  if (e.shiftKey) return false;
  const handlers: Record<string, typeof handleBold> = {
    KeyB: handleBold,
    KeyI: handleItalic,
    KeyU: handleUnderline,
    Digit5: handleStrikeThrough,
  };
  const handler = handlers[e.code];
  if (!handler) return false;
  handler(ctx, cellInput);
  e.preventDefault();
  return true;
}

/** Starts editing the active cell with a prefilled value (Ctrl+; etc.). */
function startEditingWith(
  ctx: Context,
  cache: GlobalCache | undefined,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null | undefined,
  value: string,
  kcode: number
) {
  const active = nav.getActiveCell(ctx);
  if (!active) return;
  ctx.luckysheetCellUpdate = [active[0], active[1]];
  setEditMode(ctx, "enter");
  if (cache) cache.ignoreWriteCell = true;
  cellInput.innerText = value;
  handleFormulaInput(ctx, fxInput, cellInput, kcode);
}

export function handleWithCtrlOrMetaKey(
  ctx: Context,
  cache: GlobalCache,
  e: KeyboardEvent,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null | undefined,
  handleUndo: () => void,
  handleRedo: () => void
) {
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  const arrow = ARROW_DIRECTIONS[e.key];

  if (e.shiftKey) {
    ctx.luckysheet_shiftpositon = _.cloneDeep(
      ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1]
    );
    ctx.luckysheet_shiftkeydown = true;

    if (arrow) {
      // Ctrl + Shift + arrow: extend to the edge of the data region
      nav.moveToDataEdge(ctx, arrow, true);
    } else if (e.key === "Home") {
      nav.moveToSheetStart(ctx, true);
    } else if (e.key === "End") {
      nav.moveToLastUsedCell(ctx, true);
    } else if (e.code === "Space") {
      nav.selectCurrentRegionOrAll(ctx);
    } else if (isSemicolonKey(e)) {
      // Ctrl + Shift + ; insert the current time
      if (!isAllowEdit(ctx)) return;
      startEditingWith(
        ctx,
        cache,
        cellInput,
        fxInput,
        currentDateOrTime(true),
        e.keyCode
      );
    } else if (e.code === "KeyZ") {
      // Ctrl + shift + z 重做
      handleRedo();
      e.stopPropagation();
      return;
    } else if (e.code === "KeyV") {
      if ((ctx.luckysheet_select_save?.length ?? 0) > 1) {
        return;
      }
      // Ctrl + Shift + V: Paste Special (plain paste without a copy)
      if (openPasteSpecial(ctx)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      selectionCache.isPasteAction = true;
      e.stopPropagation();
      return;
    } else if (e.code === "Digit4") {
      handleCurrencyFormat(ctx, cellInput);
    } else if (NUMBER_FORMAT_SHORTCUTS[e.code]) {
      updateFormat(
        ctx,
        cellInput,
        flowdata,
        "ct",
        NUMBER_FORMAT_SHORTCUTS[e.code]
      );
    } else if (e.code === "Digit9" || e.code === "Digit0") {
      // Ctrl + Shift + 9 / 0: unhide rows / columns in the selection
      if (!isAllowEdit(ctx)) return;
      showSelected(ctx, e.code === "Digit9" ? "row" : "column");
      e.stopPropagation();
    } else if (e.key === "+" || e.code === "Equal") {
      // insert rows/columns is handled by getRowColShortcutOp; otherwise
      // leave the key to the zoom handler
      return;
    }
  } else if (arrow) {
    // Ctrl + arrow: jump to the edge of the data region
    nav.moveToDataEdge(ctx, arrow, false);
  } else if (e.key === "Home") {
    nav.moveToSheetStart(ctx, false);
  } else if (e.key === "End") {
    nav.moveToLastUsedCell(ctx, false);
  } else if (e.key === "PageDown" || e.key === "PageUp") {
    nav.switchSheet(ctx, e.key === "PageDown" ? 1 : -1);
  } else if (e.code === "Space") {
    nav.selectEntireColumns(ctx);
  } else if (e.key === "Backspace") {
    nav.scrollToActiveCell(ctx);
  } else if (e.code === "KeyB") {
    // Ctrl + B  加粗
    handleBold(ctx, cellInput);
  } else if (e.code === "KeyI") {
    handleItalic(ctx, cellInput);
  } else if (e.code === "KeyU") {
    handleUnderline(ctx, cellInput);
  } else if (e.code === "Digit5") {
    handleStrikeThrough(ctx, cellInput);
  } else if (e.code === "Digit1" || e.code === "Numpad1") {
    openFormatCells(ctx); // Ctrl+1: Format Cells
  } else if (e.code === "KeyC") {
    // Ctrl + C  复制
    handleCopy(ctx);
    // luckysheetactiveCell();
    e.stopPropagation();
    return;
  } else if (e.code === "KeyF") {
    // Ctrl + F  查找
    ctx.showSearch = true;
  } else if (e.code === "KeyH") {
    // Ctrl + H  替换
    ctx.showReplace = true;
  } else if (e.code === "KeyV") {
    // Ctrl + V  粘贴
    if ((ctx.luckysheet_select_save?.length ?? 0) > 1) {
      return;
    }
    // Ctrl + Alt + V: Paste Special
    if (e.altKey && openPasteSpecial(ctx)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    selectionCache.isPasteAction = true;
    // luckysheetactiveCell();
    e.stopPropagation();
    return;
  } else if (e.code === "KeyX") {
    // Ctrl + X  剪切
    // 复制时存在格式刷状态，取消格式刷
    if (ctx.luckysheetPaintModelOn) {
      cancelPaintModel(ctx);
    }

    const selection = ctx.luckysheet_select_save;
    if (!selection || _.isEmpty(selection)) {
      return;
    }

    // 复制范围内包含部分合并单元格，提示
    if (ctx.config.merge != null) {
      let has_PartMC = false;

      for (let s = 0; s < selection.length; s += 1) {
        const r1 = selection[s].row[0];
        const r2 = selection[s].row[1];
        const c1 = selection[s].column[0];
        const c2 = selection[s].column[1];

        has_PartMC = hasPartMC(ctx, ctx.config, r1, r2, c1, c2);

        if (has_PartMC) {
          break;
        }
      }

      if (has_PartMC) {
        return;
      }
    }

    // 多重选区时 提示
    if (selection.length > 1) {
      return;
    }

    copy(ctx);

    ctx.luckysheet_paste_iscut = true;
    // luckysheetactiveCell();

    e.stopPropagation();
    return;
  } else if (e.code === "KeyZ") {
    // Ctrl + Z  撤销
    handleUndo();
    e.stopPropagation();
    return;
  } else if (e.code === "KeyA") {
    // Ctrl + A: current region first, then the whole sheet
    nav.selectCurrentRegionOrAll(ctx);
  } else if (e.code === "KeyD" || e.code === "KeyR") {
    // Ctrl + D / Ctrl + R: fill down / right
    e.preventDefault();
    e.stopPropagation();
    fillSelectionFromEdge(ctx, e.code === "KeyD" ? "down" : "right");
    return;
  } else if (isSemicolonKey(e)) {
    // Ctrl + ; insert today's date
    if (!isAllowEdit(ctx)) return;
    startEditingWith(
      ctx,
      cache,
      cellInput,
      fxInput,
      currentDateOrTime(false),
      e.keyCode
    );
  } else if (e.code === "Digit9" || e.code === "Digit0") {
    // Ctrl + 9 / Ctrl + 0: hide rows / columns
    if (!isAllowEdit(ctx)) return;
    hideSelected(ctx, e.code === "Digit9" ? "row" : "column");
    e.stopPropagation();
  } else if (
    e.key === "-" ||
    e.key === "=" ||
    e.key === "+" ||
    e.code === "NumpadSubtract" ||
    e.code === "NumpadAdd"
  ) {
    // delete/insert rows is handled by getRowColShortcutOp and the cells
    // dialog by getInsertDeleteCellsShortcut; otherwise leave the key to the
    // zoom handler
    return;
  }

  e.preventDefault();
}

function handleShiftWithArrowKey(ctx: Context, e: KeyboardEvent) {
  if (
    ctx.luckysheetCellUpdate.length > 0
    // || $(event.target).hasClass("formulaInputFocus")
  ) {
    return;
  }

  ctx.luckysheet_shiftpositon = _.cloneDeep(
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1]
  );
  ctx.luckysheet_shiftkeydown = true;

  // shift + 方向键 调整选区
  const arrow = ARROW_DIRECTIONS[e.key];
  if (arrow) nav.extendSelection(ctx, arrow);

  e.preventDefault();
}

export function handleArrowKey(ctx: Context, e: KeyboardEvent) {
  if (
    ctx.luckysheetCellUpdate.length > 0 ||
    ctx.luckysheet_cell_selected_move ||
    ctx.luckysheet_cell_selected_extend
    // || $(event.target).hasClass("formulaInputFocus") ||
    // $("#luckysheet-singleRange-dialog").is(":visible") ||
    // $("#luckysheet-multiRange-dialog").is(":visible")
  ) {
    return;
  }

  const arrow = ARROW_DIRECTIONS[e.key];
  if (arrow) nav.moveActiveCell(ctx, arrow);
}

export type RowColShortcutOp = {
  insertRowColOp?: {
    type: "row" | "column";
    index: number;
    count: number;
    direction: "lefttop" | "rightbottom";
    id: string;
  };
  deleteRowColOp?: {
    type: "row" | "column";
    start: number;
    end: number;
    id: string;
  };
};

/**
 * Ctrl+- ("delete") or Ctrl+Shift+= / Ctrl++ ("insert") on the sheet with a
 * single selected range; null for any other key or state.
 */
function insertDeleteShortcut(
  ctx: Context,
  e: KeyboardEvent,
  cellInput?: HTMLElement | null,
  fxInput?: HTMLElement | null
): { mode: "insert" | "delete"; sel: Selection } | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (isKeyFromForeignControl(e, cellInput, fxInput)) return null;
  if (ctx.luckysheetCellUpdate.length > 0 || !ctx.sheetFocused) return null;
  if (!_.isEmpty(ctx.contextMenu) || ctx.filterContextMenu) return null;
  const isMinus =
    (!e.shiftKey && (e.key === "-" || e.code === "Minus")) ||
    e.code === "NumpadSubtract";
  const isPlus =
    e.key === "+" ||
    (e.shiftKey && e.code === "Equal") ||
    e.code === "NumpadAdd";
  if (!isMinus && !isPlus) return null;
  const sels = ctx.luckysheet_select_save;
  if (!sels || sels.length !== 1) return null;
  return { mode: isMinus ? "delete" : "insert", sel: sels[0] };
}

/**
 * Ctrl+- / Ctrl+Shift+= (Ctrl++) on a range that is not entire rows or
 * columns: Excel asks how to shift the cells, so the UI opens its Delete /
 * Insert dialog. Returns which one, or null.
 */
export function getInsertDeleteCellsShortcut(
  ctx: Context,
  e: KeyboardEvent,
  cellInput?: HTMLElement | null,
  fxInput?: HTMLElement | null
): "insert" | "delete" | null {
  const hit = insertDeleteShortcut(ctx, e, cellInput, fxInput);
  if (!hit || !isAllowEdit(ctx)) return null;
  const { sel } = hit;
  if (!!sel.row_select !== !!sel.column_select) return null;
  return hit.mode;
}

/**
 * Ctrl+- / Ctrl+Shift+= (Ctrl++) with entire rows or columns selected:
 * returns the delete/insert operation to run, or null. The React layer runs
 * it with the op attached so undo and collaboration see a row/column change.
 */
export function getRowColShortcutOp(
  ctx: Context,
  e: KeyboardEvent,
  cellInput?: HTMLElement | null,
  fxInput?: HTMLElement | null
): RowColShortcutOp | null {
  const hit = insertDeleteShortcut(ctx, e, cellInput, fxInput);
  if (!hit) return null;
  const { sel } = hit;
  const isMinus = hit.mode === "delete";
  let type: "row" | "column" | null = null;
  if (sel.row_select && !sel.column_select) type = "row";
  else if (sel.column_select && !sel.row_select) type = "column";
  if (!type) return null;
  if (!isAllowEdit(ctx)) return null;

  const [start, end] = type === "row" ? sel.row : sel.column;
  if (isMinus) {
    return {
      deleteRowColOp: { type, start, end, id: ctx.currentSheetId },
    };
  }
  return {
    insertRowColOp: {
      type,
      index: start,
      count: end - start + 1,
      direction: "lefttop",
      id: ctx.currentSheetId,
    },
  };
}

export function applyRowColShortcutOp(ctx: Context, op: RowColShortcutOp) {
  try {
    if (op.deleteRowColOp) deleteRowCol(ctx, op.deleteRowColOp);
    else if (op.insertRowColOp) insertRowCol(ctx, op.insertRowColOp);
  } catch (err) {
    // read-only rows/columns or the size limit: nothing to do
  }
}

/**
 * Excel's End mode: End, then an arrow jumps like Ctrl+arrow (Shift extends
 * the selection), End, Home goes to the last used cell and End, Enter to the
 * last filled cell of the row. Any other key leaves End mode. Returns true
 * when the key was consumed.
 */
export function handleEndModeKey(ctx: Context, e: KeyboardEvent): boolean {
  if (MODIFIER_KEYS.has(e.key)) return false;
  if (e.key === "End" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    ctx.endMode = !ctx.endMode;
    e.preventDefault();
    return true;
  }
  if (!ctx.endMode) return false;
  ctx.endMode = false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const arrow = ARROW_DIRECTIONS[e.key];
  if (arrow) {
    nav.moveToDataEdge(ctx, arrow, e.shiftKey);
  } else if (e.key === "Home") {
    nav.moveToLastUsedCell(ctx, e.shiftKey);
  } else if (e.key === "Enter") {
    nav.moveToRowEnd(ctx, e.shiftKey);
  } else {
    return false;
  }
  e.preventDefault();
  return true;
}

/**
 * React can run a state updater twice for one key event: when a
 * lower-priority update was pending, the key's update is replayed on the
 * rebased state after the first result was committed (and its DOM effects,
 * like clearing the editor, happened). Whatever an editing key reads from the
 * DOM is therefore captured once per event.
 */
const EVENT_MEMO = new WeakMap<Event, Record<string, any>>();

function eventMemo(e: Event) {
  let memo = EVENT_MEMO.get(e);
  if (!memo) {
    memo = {};
    EVENT_MEMO.set(e, memo);
  }
  return memo;
}

/**
 * The editor as it was when `e` was first handled (missing closing
 * parentheses added), in the shape `updateCell` reads.
 */
function editorSnapshot(e: Event, editor: HTMLDivElement): HTMLDivElement {
  const memo = eventMemo(e);
  if (!memo.editor) {
    closeFormulaParens(editor);
    const clone = editor.cloneNode(true) as HTMLDivElement;
    memo.editor = {
      innerText: editor.innerText,
      innerHTML: editor.innerHTML,
      textContent: editor.textContent,
      querySelectorAll: (selector: string) => clone.querySelectorAll(selector),
    };
  }
  return memo.editor;
}

/**
 * Keys while a cell is being edited, in the in-cell editor or the formula
 * bar (other keys are left to the editor):
 *
 * - arrows: move the caret in Edit mode and in the formula bar, pick a
 *   reference in Point mode (Shift extends, Ctrl jumps), otherwise commit
 *   and move the active cell (Enter mode);
 * - Enter / Shift+Enter / Tab / Shift+Tab: commit and move, wrapping inside
 *   a multi-cell selection; Ctrl+Enter fills the selection;
 * - F2 toggles Edit and Enter mode; Esc cancels.
 */
export function handleEditingKeyDown(
  ctx: Context,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null | undefined,
  e: KeyboardEvent,
  canvas?: CanvasRenderingContext2D
) {
  const { key } = e;
  if (MODIFIER_KEYS.has(key)) return;
  if (isKeyFromForeignControl(e, cellInput, fxInput)) return;
  const target = e.target as Node | null;
  const fromFx =
    !!fxInput && !!target && (target === fxInput || fxInput.contains(target));
  const editor = fromFx ? fxInput! : cellInput;
  const mirror = fromFx ? cellInput : fxInput;
  const allowEdit = isAllowEdit(ctx);
  const arrow = ARROW_DIRECTIONS[key];

  const memo = eventMemo(e);
  if (arrow) {
    memo.action ??= getEditorArrowAction(ctx, e, editor, fromFx);
    if (memo.action === "point") {
      if (memo.point === undefined) {
        memo.point = movePointReference(
          ctx,
          editor,
          mirror,
          arrow,
          e.shiftKey,
          e.ctrlKey || e.metaKey
        )
          ? _.cloneDeep(ctx.editState)
          : null;
      } else if (memo.point) {
        // replayed event: the editor already shows the reference
        ctx.editState = _.cloneDeep(memo.point);
      }
      if (memo.point) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (memo.action === "commit" && allowEdit) {
      commitEditAndMove(ctx, editorSnapshot(e, editor), arrow, "arrow", canvas);
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }

  // anything typed after a picked reference ends Point mode
  endPointMode(ctx);
  // Point mode across sheets: commit or cancel on the edited cell's sheet
  if (
    (key === "Enter" && !e.altKey && !e.metaKey) ||
    key === "Tab" ||
    key === "Escape"
  ) {
    returnToEditSheet(ctx, editor);
  }

  if (key === "Enter") {
    if (!allowEdit) return;
    handleGlobalEnter(ctx, editorSnapshot(e, editor), e, canvas);
    e.stopPropagation();
    // after committing from the formula bar the grid takes the keys again
    if (fromFx && ctx.luckysheetCellUpdate.length === 0) cellInput.focus();
  } else if (key === "Tab") {
    if (!allowEdit) return;
    commitEditAndMove(
      ctx,
      editorSnapshot(e, editor),
      e.shiftKey ? "left" : "right",
      "enter",
      canvas
    );
    e.preventDefault();
    e.stopPropagation();
    if (fromFx) cellInput.focus();
  } else if (key === "F2" && !e.ctrlKey && !e.altKey && !e.metaKey) {
    toggleEditMode(ctx);
    e.preventDefault();
    e.stopPropagation();
  } else if (key === "F4") {
    e.preventDefault();
  } else if (key === "Escape") {
    cancelNormalSelected(ctx);
    clearEditMode(ctx);
    moveHighlightCell(ctx, "down", 0, "rangeOfSelect");
    e.preventDefault();
    e.stopPropagation();
  }
}

export function handleGlobalKeyDown(
  ctx: Context,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null | undefined,
  e: KeyboardEvent,
  cache: GlobalCache,
  handleUndo: () => void,
  handleRedo: () => void,
  canvas?: CanvasRenderingContext2D
) {
  ctx.luckysheet_select_status = false;
  const kcode = e.keyCode;
  const kstr = e.key;
  if (!_.isEmpty(ctx.contextMenu) || ctx.filterContextMenu) {
    return;
  }

  if (kstr === "Escape" && !!ctx.luckysheet_selection_range) {
    ctx.luckysheet_selection_range = [];
  }
  if (kstr === "Escape" && ctx.luckysheetPaintModelOn) cancelPaintModel(ctx);

  const allowEdit = isAllowEdit(ctx);

  if (
    ctx.luckysheetCellUpdate.length > 0 &&
    (e.ctrlKey || e.metaKey) &&
    !e.altKey &&
    handleEditModeShortcut(ctx, e, cellInput)
  ) {
    e.stopPropagation();
    return;
  }

  if (ctx.luckysheetCellUpdate.length > 0) {
    // Enter / Edit / Point mode keys of the cell editor and formula bar
    handleEditingKeyDown(ctx, cellInput, fxInput, e, canvas);
    return;
  }

  // Toggle focus with Ctrl + Shift + F (independent of sheet focus state)
  if (e.ctrlKey && e.shiftKey && kstr === "F") {
    ctx.sheetFocused = !ctx.sheetFocused; // Toggle sheet focus
    e.preventDefault();

    if (ctx.sheetFocused) {
      // Focus back to the selected cell
      const selectedCell = document.querySelector(
        ".luckysheet-cell-input"
      ) as HTMLElement | null;
      if (selectedCell) {
        selectedCell.setAttribute("tabindex", "-1"); // Ensure it is focusable
        selectedCell.focus();
      }
    } else {
      // Focus on the fortune-toolbar
      const toolbar = document.querySelector(
        ".fortune-toolbar"
      ) as HTMLElement | null;
      if (toolbar) {
        toolbar.setAttribute("tabindex", "-1"); // Make it focusable if needed
        toolbar.focus();
      }
    }

    return;
  }
  // Ensure key events only trigger when sheet focus is ON
  if (!ctx.sheetFocused) {
    return;
  }
  // Keys typed into toolbar buttons, menus or dialog controls are theirs
  if (isKeyFromForeignControl(e, cellInput, fxInput)) {
    return;
  }
  // shortcuts registered by features (modules/extensions.ts)
  if (runShortcut(ctx, e, ctx.luckysheetCellUpdate.length > 0)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  // Ctrl+F / Ctrl+H / Ctrl+G / F5: Find, Replace, Go To (navigation stream)
  if (handleNavigationShortcut(ctx, e)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (handleEndModeKey(ctx, e)) {
    e.stopPropagation();
    return;
  }
  if (kstr === "Enter") {
    if (!allowEdit && ctx.luckysheetCellUpdate.length > 0) return;
    handleGlobalEnter(ctx, cellInput, e, canvas);
  } else if (kstr === "Tab") {
    if (ctx.luckysheetCellUpdate.length > 0) {
      return;
    }

    // Tab / Shift+Tab: move right / left, wrapping inside a selection
    nav.moveAfterEnter(ctx, e.shiftKey ? "left" : "right");
    e.preventDefault();
  } else if (kstr === "F2") {
    if (!allowEdit) return;
    if (ctx.luckysheetCellUpdate.length > 0) {
      return;
    }

    const last =
      ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
    if (!last) return;

    const row_index = last.row_focus;
    const col_index = last.column_focus;

    ctx.luckysheetCellUpdate = [row_index, col_index];
    // F2 edits in Edit mode: arrows move the caret
    setEditMode(ctx, "edit");
    e.preventDefault();
  } else {
    if (e.ctrlKey || e.metaKey) {
      handleWithCtrlOrMetaKey(
        ctx,
        cache,
        e,
        cellInput,
        fxInput,
        handleUndo,
        handleRedo
      );
      return;
    }
    if (e.altKey && (kstr === "PageDown" || kstr === "PageUp")) {
      // Alt + PageDown / PageUp: one screen right / left
      nav.moveByPage(ctx, "col", kstr === "PageDown" ? 1 : -1, e.shiftKey);
      e.preventDefault();
    } else if (
      e.shiftKey &&
      (kstr === "ArrowUp" ||
        kstr === "ArrowDown" ||
        kstr === "ArrowLeft" ||
        kstr === "ArrowRight")
    ) {
      handleShiftWithArrowKey(ctx, e);
    } else if (e.shiftKey && e.code === "Space") {
      // Shift + Space: select entire rows
      nav.selectEntireRows(ctx);
      e.preventDefault();
    } else if (kstr === "PageDown" || kstr === "PageUp") {
      nav.moveByPage(ctx, "row", kstr === "PageDown" ? 1 : -1, e.shiftKey);
      e.preventDefault();
    } else if (kstr === "Home") {
      nav.moveHome(ctx, e.shiftKey);
      e.preventDefault();
    } else if (kstr === "Escape") {
      ctx.contextMenu = {};
      // if (menuButton.luckysheetPaintModelOn) {
      //   menuButton.cancelPaintModel();
      // } else {
      //   cleargridelement(event);
      //   e.preventDefault();
      // }

      // selectHightlightShow();
    } else if (kstr === "Delete") {
      // Delete: clear the contents of the selection (formats are kept)
      if (!allowEdit) return;
      if (ctx.activeImg != null) {
        removeActiveImage(ctx);
      } else if (deleteSelectedCellText(ctx) === "success") {
        // grouped sheets: clear the same cells on each of them
        clearGroupedSheetsContents(ctx);
      }

      jfrefreshgrid(ctx, null, undefined);
      e.preventDefault();
    } else if (kstr === "Backspace") {
      // Backspace: clear the active cell and start editing it (Esc restores)
      if (!allowEdit) return;
      if (ctx.activeImg != null) {
        removeActiveImage(ctx);
        jfrefreshgrid(ctx, null, undefined);
      } else {
        const active = nav.getActiveCell(ctx);
        if (active) {
          ctx.luckysheetCellUpdate = [active[0], active[1]];
          setEditMode(ctx, "enter");
          const memo = eventMemo(e);
          if (!memo.started) {
            // not again when React replays the event (see eventMemo)
            memo.started = true;
            if (cache) cache.overwriteCell = true;
            cellInput.innerText = "";
            cellInput.innerHTML = "";
            handleFormulaInput(ctx, fxInput, cellInput, kcode);
          }
        }
      }
      e.preventDefault();
    } else if (
      kstr === "ArrowUp" ||
      kstr === "ArrowDown" ||
      kstr === "ArrowLeft" ||
      kstr === "ArrowRight"
    ) {
      handleArrowKey(ctx, e);
    } else if (
      !(
        (kcode >= 112 && kcode <= 123) ||
        kcode <= 46 ||
        kcode === 144 ||
        kcode === 108 ||
        e.ctrlKey ||
        e.altKey ||
        (e.shiftKey &&
          (kcode === 37 || kcode === 38 || kcode === 39 || kcode === 40))
      ) ||
      kcode === 8 ||
      kcode === 32 ||
      kcode === 46 ||
      kcode === 0 ||
      (e.ctrlKey && kcode === 86)
    ) {
      if (!allowEdit) return;
      if (
        String.fromCharCode(kcode) != null &&
        !_.isEmpty(ctx.luckysheet_select_save) && // $("#luckysheet-cell-selected").is(":visible") &&
        kstr !== "CapsLock" &&
        kstr !== "Win" &&
        kcode !== 18
      ) {
        // 激活输入框，并将按键输入到输入框
        const last =
          ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1];

        const row_index = last.row_focus;
        const col_index = last.column_focus;

        ctx.luckysheetCellUpdate = [row_index, col_index];
        // typing starts Enter mode: arrows commit and move
        setEditMode(ctx, "enter");
        const memo = eventMemo(e);
        if (!memo.started) {
          // a replayed event (see eventMemo) must not flag the next edit
          // session to start empty
          memo.started = true;
          cache.overwriteCell = true;
          handleFormulaInput(ctx, fxInput, cellInput, kcode);
        }
      }
    }
  }

  if (cellInput !== document.activeElement) {
    cellInput?.focus();
  }

  e.stopPropagation();
}
