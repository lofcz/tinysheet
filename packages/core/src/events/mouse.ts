import _ from "lodash";
import { Freezen } from "..";
import { Context, getFlowdata } from "../context";
import {
  cancelActiveImgItem,
  cancelPaintModel,
  israngeseleciton,
  onCommentBoxMove,
  onCommentBoxMoveEnd,
  onCommentBoxResize,
  onCommentBoxResizeEnd,
  cancelCommentBoxDrag,
  onImageMove,
  onImageMoveEnd,
  onImageResize,
  onImageResizeEnd,
  cancelImageDrag,
  removeEditingComment,
  overShowComment,
  onFormulaRangeDragEnd,
  onCellsMoveEnd,
  cancelCellsMove,
  onCellsMove,
  cellFocus,
  clearEditMode,
  dropdownArrowPressed,
  dragPointWithMouse,
  dragReference,
  endReferenceDrag,
  pointCellWithMouse,
  ReferenceDragHandle,
  startReferenceDrag,
} from "../modules";
import { finishFormulaEdit } from "../modules/formulaEditor";
import {
  frozenScrollMin,
  getFrozenHandleLeft,
  getFrozenHandleTop,
} from "../modules/freeze";
import { MAX_ZOOM_RATIO, MIN_ZOOM_RATIO } from "../modules/zoom";
import {
  mergeBorder,
  mergeMoveMain,
  updateCell,
  luckysheetUpdateCell,
} from "../modules/cell";
import {
  borderIndexAt,
  colLocation,
  colLocationByIndex,
  getCellAreaElement,
  getGridPoint,
  rowLocation,
  rowLocationByIndex,
} from "../modules/location";
import { runCellPointerHandlers } from "../modules/extensions";
import {
  checkProtection,
  checkProtectionAllSelected,
  checkProtectionSelectLockedOrUnLockedCells,
} from "../modules/protection";
import {
  normalizeSelection,
  pasteHandlerOfPaintModel,
} from "../modules/selection";
import { Settings } from "../settings";
import { GlobalCache } from "../types";
import { getSheetIndex, isAllowEdit } from "../utils";
import {
  onDropCellSelectEnd,
  onDropCellSelect,
  hideDropCellSelection,
} from "../modules/dropCell";
import {
  handleFormulaInput,
  rangeDragColumn,
  rangeDragRow,
} from "../modules/formula";
import {
  showLinkCard,
  onRangeSelectionModalMove,
  onRangeSelectionModalMoveEnd,
} from "../modules/hyperlink";
import {
  onSearchDialogMove,
  onSearchDialogMoveEnd,
} from "../modules/searchReplace";

let mouseWheelUniqueTimeout: ReturnType<typeof setTimeout>;
let scrollLockTimeout: ReturnType<typeof setTimeout>;
const wheelRemainder = { x: 0, y: 0 };
let wheelZoomRemainder = 0;

/**
 * Ctrl+wheel (and trackpad pinch, which the browser reports as a wheel
 * with ctrlKey): zoom the sheet by 10% per mouse notch, like Excel.
 * Returns whether the zoom changed.
 */
export function handleWheelZoom(ctx: Context, e: WheelEvent) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return false;
  const px = e.deltaMode === 0 ? e.deltaY : e.deltaY * 33;
  const zoom = ctx.zoomRatio || 1;
  // hundredths of zoom; what does not make one yet is kept for the next
  const target = zoom * 100 - px / 10 + wheelZoomRemainder;
  const next = Math.min(
    MAX_ZOOM_RATIO * 100,
    Math.max(MIN_ZOOM_RATIO * 100, Math.round(target))
  );
  wheelZoomRemainder = next === Math.round(target) ? target - next : 0;
  if (next === Math.round(zoom * 100)) return false;
  ctx.zoomRatio = next / 100;
  ctx.luckysheetfile[index].zoomRatio = next / 100;
  return true;
}

/**
 * How far to scroll (px, this frame) while a drag holds the pointer past
 * the edge of the scrolling pane: selecting cells or whole rows/columns,
 * dragging the fill handle or moving cells. Faster the further past the
 * edge the pointer is, like Excel. `dt` is the time since the last frame
 * (ms). Zero when there is nothing to scroll.
 */
export function getDragAutoScroll(
  ctx: Context,
  globalCache: GlobalCache,
  e: { clientX: number; clientY: number },
  container: HTMLElement,
  dt: number
) {
  const none = { dx: 0, dy: 0 };
  if (
    !ctx.luckysheet_scroll_status ||
    ctx.luckysheet_cols_change_size ||
    ctx.luckysheet_rows_change_size ||
    ctx.luckysheet_cols_freeze_drag ||
    ctx.luckysheet_rows_freeze_drag
  ) {
    return none;
  }
  const rect = getCellAreaElement(container).getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return none;
  const freeze = globalCache.freezen?.[ctx.currentSheetId];
  const anchor = _.last(ctx.luckysheet_select_save);
  const min = frozenScrollMin(ctx);
  // The scrolling pane starts below/right of the frozen panes: a drag
  // anchored in it scrolls back when the pointer enters the frozen panes.
  let top = rect.top;
  let left = rect.left;
  const hData = freeze?.horizontal?.freezenhorizontaldata;
  const vData = freeze?.vertical?.freezenverticaldata;
  if (hData && (anchor?.row_focus ?? 0) >= hData[1] && ctx.scrollTop > min.top)
    top += hData[0] - hData[2];
  if (
    vData &&
    (anchor?.column_focus ?? 0) >= vData[1] &&
    ctx.scrollLeft > min.left
  )
    left += vData[0] - vData[2];
  // px per second: 12 default rows at the edge, more the further past it
  const speed = (dist: number) =>
    Math.min(6000, 240 + dist * 24) * (Math.min(dt, 100) / 1000);
  let dx = 0;
  let dy = 0;
  if (!ctx.luckysheet_cols_selected_status) {
    if (e.clientY < top) dy = -speed(top - e.clientY);
    else if (e.clientY > rect.bottom) dy = speed(e.clientY - rect.bottom);
  }
  if (!ctx.luckysheet_rows_selected_status) {
    if (e.clientX < left) dx = -speed(left - e.clientX);
    else if (e.clientX > rect.right) dx = speed(e.clientX - rect.right);
  }
  return { dx, dy };
}

/** Marks a popup over the grid (autocomplete, argument hint...). */
export const WHEEL_POPUP_ATTRIBUTE = "data-fortune-popup";

/**
 * Whether a wheel event over the grid happened over a popup (the function
 * autocomplete, the argument hint...) or another element laid over the grid
 * that has content to scroll (a dropdown, a long in-cell edit): that element
 * scrolls, never the sheet. Looks at the target's ancestors below `boundary`
 * (the element listening for the wheel).
 */
export function isWheelOverPopup(e: WheelEvent, boundary: Element | null) {
  let el = e.target instanceof Element ? e.target : null;
  while (el && el !== boundary) {
    if (el.hasAttribute(WHEEL_POPUP_ATTRIBUTE)) return true;
    // the sheet's own scrollbars scroll the sheet
    if (!/\bluckysheet-scrollbar-/.test(el.className?.toString() ?? "")) {
      const style = window.getComputedStyle(el);
      if (
        (/auto|scroll/.test(style.overflowY) &&
          el.scrollHeight > el.clientHeight) ||
        (/auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth)
      ) {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export function handleGlobalWheel(
  ctx: Context,
  e: WheelEvent,
  cache: GlobalCache,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement
) {
  if (cache.searchDialog?.mouseEnter && ctx.showSearch && ctx.showReplace)
    return;
  if (ctx.filterContextMenu != null) return;
  clearTimeout(mouseWheelUniqueTimeout);
  clearTimeout(scrollLockTimeout);

  // The wheel's deltas in px: a mouse notch is ~100px (5 default rows), a
  // trackpad sends many small deltas and scrolls smoothly. Shift turns a
  // vertical wheel into a horizontal scroll (the browser does not always).
  const lineHeight = (ctx.defaultrowlen + 1) * (ctx.zoomRatio || 1);
  const unit =
    e.deltaMode === 1
      ? lineHeight
      : e.deltaMode === 2
        ? Math.max(scrollbarY.clientHeight, lineHeight)
        : 1;
  let dx = e.deltaX * unit;
  let dy = e.deltaY * unit;
  if (e.shiftKey && dx === 0) {
    dx = dy;
    dy = 0;
  }

  // one axis at a time, the one a gesture started on (trackpads drift)
  const vertical = Math.abs(dy) >= Math.abs(dx);
  // whole px (exact blits); the fractions of small deltas add up
  const step = (axis: "x" | "y", pos: number, delta: number) => {
    const target = pos + delta + wheelRemainder[axis];
    const next = Math.round(target);
    wheelRemainder[axis] = target - next;
    return next;
  };
  if (dy !== 0 && vertical && !cache.verticalScrollLock) {
    cache.horizontalScrollLock = true;
    // the browser clamps the scrollbar to the scroll range
    scrollbarY.scrollTop = step("y", scrollbarY.scrollTop, dy);
  } else if (dx !== 0 && !vertical && !cache.horizontalScrollLock) {
    cache.verticalScrollLock = true;
    scrollbarX.scrollLeft = step("x", scrollbarX.scrollLeft, dx);
  }

  mouseWheelUniqueTimeout = setTimeout(() => {
    delete cache.visibleColumnsUnique;
    delete cache.visibleRowsUnique;
  }, 500);

  scrollLockTimeout = setTimeout(() => {
    delete cache.verticalScrollLock;
    delete cache.horizontalScrollLock;
  }, 50);

  e.preventDefault();
}

export function fixPositionOnFrozenCells(
  freeze: Freezen | undefined,
  x: number,
  y: number,
  mouseX: number,
  mouseY: number
) {
  let inHorizontalFreeze = false;
  let inVerticalFreeze = false;

  if (!freeze) return { x, y, inHorizontalFreeze, inVerticalFreeze };

  const freezenverticaldata = freeze?.vertical?.freezenverticaldata;
  const freezenhorizontaldata = freeze?.horizontal?.freezenhorizontaldata;

  if (
    freezenverticaldata != null &&
    mouseX < freezenverticaldata[0] - freezenverticaldata[2]
  ) {
    x = mouseX + freezenverticaldata[2];
    inVerticalFreeze = true;
  }

  if (
    freezenhorizontaldata != null &&
    mouseY < freezenhorizontaldata[0] - freezenhorizontaldata[2]
  ) {
    y = mouseY + freezenhorizontaldata[2];
    inHorizontalFreeze = true;
  }

  return { x, y, inHorizontalFreeze, inVerticalFreeze };
}

/**
 * The cell (the top-left cell of a merge) under the mouse; `container` is the
 * sheet overlay (with the headers).
 */
function cellAtOverlayPoint(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLElement
): [number, number] {
  const rect = container.getBoundingClientRect();
  const mouseX = e.pageX - rect.left - window.scrollX - ctx.rowHeaderWidth;
  const mouseY = e.pageY - rect.top - window.scrollY - ctx.columnHeaderHeight;
  const { x, y } = fixPositionOnFrozenCells(
    globalCache.freezen?.[ctx.currentSheetId],
    mouseX + ctx.scrollLeft,
    mouseY + ctx.scrollTop,
    mouseX,
    mouseY
  );
  let r = rowLocation(y, ctx.visibledatarow)[2];
  let c = colLocation(x, ctx.visibledatacolumn)[2];
  const flowdata = getFlowdata(ctx);
  const merge = flowdata ? mergeBorder(ctx, flowdata, r, c) : null;
  if (merge) {
    [, , r] = merge.row;
    [, , c] = merge.column;
  }
  return [Math.max(0, r), Math.max(0, c)];
}

/** The editor a formula is edited in (the formula bar when it has the focus). */
function activeEditors(
  cellInput: HTMLDivElement,
  fxInput?: HTMLDivElement | null
): [HTMLDivElement, HTMLDivElement | null | undefined] {
  return fxInput && document.activeElement === fxInput
    ? [fxInput, cellInput]
    : [cellInput, fxInput];
}

/**
 * Mouse down on the border (`handle` "move") or a corner of the colour box
 * of a formula's reference while the formula is edited: dragging moves or
 * resizes the reference, the formula follows live and the editor keeps the
 * focus (like Excel). `container` is the sheet overlay.
 */
export function handleReferenceBoxMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null | undefined,
  container: HTMLElement,
  rangeIndex: number,
  handle: ReferenceDragHandle
) {
  if (e.button !== 0 || ctx.luckysheetCellUpdate.length === 0) return false;
  const [editor] = activeEditors(cellInput, fxInput);
  return startReferenceDrag(
    ctx,
    editor,
    rangeIndex,
    handle,
    cellAtOverlayPoint(ctx, globalCache, e, container)
  );
}

export function handleCellAreaMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  cellInput: HTMLDivElement,
  container: HTMLDivElement,
  fxInput?: HTMLDivElement | null,
  canvas?: CanvasRenderingContext2D
) {
  ctx.contextMenu = {};
  ctx.filterContextMenu = undefined;
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  removeEditingComment(ctx, globalCache);
  // TODO set MouseDown state to context
  // const mouse = mousePosition(
  //   e.nativeEvent.offsetX,
  //   e.nativeEvent.offsetY,
  //   context
  // );
  cancelActiveImgItem(ctx, globalCache);
  const rect = container.getBoundingClientRect();
  const mouseX = e.pageX - rect.left - window.scrollX;
  const mouseY = e.pageY - rect.top - window.scrollY;
  const _x = mouseX + ctx.scrollLeft;
  const _y = mouseY + ctx.scrollTop;
  if (_x >= rect.width + ctx.scrollLeft || _y >= rect.height + ctx.scrollTop) {
    return;
  }
  const freeze = globalCache.freezen?.[ctx.currentSheetId];
  const { x, y, inHorizontalFreeze, inVerticalFreeze } =
    fixPositionOnFrozenCells(freeze, _x, _y, mouseX, mouseY);

  const row_location = rowLocation(y, ctx.visibledatarow);
  let row = row_location[1];
  let row_pre = row_location[0];
  let row_index = row_location[2];

  const col_location = colLocation(x, ctx.visibledatacolumn);
  let col = col_location[1];
  let col_pre = col_location[0];
  let col_index = col_location[2];

  let row_index_ed = row_index;
  let col_index_ed = col_index;
  const margeset = mergeBorder(ctx, flowdata, row_index, col_index);
  if (margeset) {
    [row_pre, row, row_index, row_index_ed] = margeset.row;
    [col_pre, col, col_index, col_index_ed] = margeset.column;
  }

  // protected sheet: locked / unlocked cells may not be selectable
  if (
    ctx.luckysheetCellUpdate.length === 0 &&
    !checkProtectionSelectLockedOrUnLockedCells(
      ctx,
      row_index,
      col_index,
      ctx.currentSheetId
    )
  ) {
    return;
  }
  showLinkCard(ctx, row_index, col_index, false, true);

  if (
    ctx.hooks.beforeCellMouseDown?.(flowdata[row_index]?.[col_index], {
      row: row_index,
      column: col_index,
      startRow: row_pre,
      startColumn: col_pre,
      endRow: row,
      endColumn: col,
    }) === false
  ) {
    return;
  }

  cellFocus(ctx, row_index, col_index, true);
  // A press on the chevron of a list cell opens its list with this click.
  if (
    e.button === 0 &&
    dropdownArrowPressed(ctx, row_index, col_index, x, col)
  ) {
    ctx.dataVerificationDropDownList = true;
  }

  // in-cell controls registered by features (checkboxes, ...)
  if (
    e.button === 0 &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    runCellPointerHandlers({
      ctx,
      r: row_index,
      c: col_index,
      cell: flowdata[row_index]?.[col_index],
      x: col_pre,
      y: row_pre,
      w: col - col_pre,
      h: row - row_pre,
      offsetX: x - col_pre,
      offsetY: y - row_pre,
      zoom: ctx.zoomRatio,
      event: e,
    })
  ) {
    return;
  }

  if (!inHorizontalFreeze && !inVerticalFreeze) {
    if (col_pre < ctx.scrollLeft) {
      ctx.scrollLeft = col_pre;
    }

    if (row_pre < ctx.scrollTop) {
      ctx.scrollTop = row_pre;
    }
  }

  if (e.button === 2) {
    // $("#luckysheet-dataVerification-showHintBox").hide();

    const isInSelection = _.some(
      ctx.luckysheet_select_save,
      (obj_s) =>
        obj_s.row != null &&
        row_index >= obj_s.row[0] &&
        row_index <= obj_s.row[1] &&
        col_index >= obj_s.column[0] &&
        col_index <= obj_s.column[1]
    );
    if (isInSelection) return;
  }

  // if (
  //   ctx.flowdata[row_index] != null &&
  //   ctx.flowdata[row_index][col_index] != null &&
  //   ctx.flowdata[row_index][col_index].dd != null
  // ) {
  //   if (
  //     luckysheetConfigsetting.fireMousedown != null &&
  //     getObjType(luckysheetConfigsetting.fireMousedown) == "function"
  //   ) {
  //     luckysheetConfigsetting.fireMousedown(
  //       ctx.flowdata[row_index][col_index].dd
  //     );
  //     return;
  //   }
  // }

  // if (
  //   hyperlinkCtrl.hyperlink &&
  //   hyperlinkCtrl.hyperlink[row_index + "_" + col_index] &&
  //   event.which != "3"
  // ) {
  //   hyperlinkCtrl.cellFocus(row_index, col_index);
  //   return;
  // }

  ctx.luckysheet_scroll_status = true;

  if (ctx.luckysheetCellUpdate.length > 0) {
    // Point mode: clicking a cell puts its reference into the formula
    const [editor, copyTo] = activeEditors(cellInput, fxInput);
    if (
      pointCellWithMouse(ctx, editor, copyTo, [row_index, col_index], {
        add: e.ctrlKey || e.metaKey,
        extend: e.shiftKey,
      })
    ) {
      // keep the focus and caret in the editor; dragging extends the range
      e.preventDefault();
      return; // skip ctx.luckysheet_select_save to prevent clearing cellInput
    }
    // Point mode across sheets: a click that inserts no reference keeps
    // editing (the cell is on another sheet)
    if (ctx.formulaEditOrigin) {
      e.preventDefault();
      return;
    }
    // like Excel: missing closing parentheses added, names in upper case
    finishFormulaEdit(ctx, cellInput);
    updateCell(
      ctx,
      ctx.luckysheetCellUpdate[0],
      ctx.luckysheetCellUpdate[1],
      cellInput,
      undefined,
      canvas
    );
    clearEditMode(ctx);
    ctx.luckysheet_select_status = true;

    //     if ($("#luckysheet-info").is(":visible")) {
    //       ctx.luckysheet_select_status = false;
    //     }
  }
  if (
    checkProtectionSelectLockedOrUnLockedCells(
      ctx,
      row_index,
      col_index,
      ctx.currentSheetId
    )
  ) {
    ctx.luckysheet_select_status = true;
  }

  // if ($("#luckysheet-multiRange-dialog").is(":visible")) {
  //   conditionformat.selectStatus = true;
  //   ctx.luckysheet_select_status = false;

  //   if (event.shiftKey) {
  //     let last =
  //       conditionformat.selectRange[conditionformat.selectRange.length - 1];

  //     let top = 0,
  //       height = 0,
  //       rowseleted = [];
  //     if (last.top > row_pre) {
  //       top = row_pre;
  //       height = last.top + last.height - row_pre;

  //       if (last.row[1] > last.row_focus) {
  //         last.row[1] = last.row_focus;
  //       }

  //       rowseleted = [row_index, last.row[1]];
  //     } else if (last.top == row_pre) {
  //       top = row_pre;
  //       height = last.top + last.height - row_pre;
  //       rowseleted = [row_index, last.row[0]];
  //     } else {
  //       top = last.top;
  //       height = row - last.top - 1;

  //       if (last.row[0] < last.row_focus) {
  //         last.row[0] = last.row_focus;
  //       }

  //       rowseleted = [last.row[0], row_index];
  //     }

  //     let left = 0,
  //       width = 0,
  //       columnseleted = [];
  //     if (last.left > col_pre) {
  //       left = col_pre;
  //       width = last.left + last.width - col_pre;

  //       if (last.column[1] > last.column_focus) {
  //         last.column[1] = last.column_focus;
  //       }

  //       columnseleted = [col_index, last.column[1]];
  //     } else if (last.left == col_pre) {
  //       left = col_pre;
  //       width = last.left + last.width - col_pre;
  //       columnseleted = [col_index, last.column[0]];
  //     } else {
  //       left = last.left;
  //       width = col - last.left - 1;

  //       if (last.column[0] < last.column_focus) {
  //         last.column[0] = last.column_focus;
  //       }

  //       columnseleted = [last.column[0], col_index];
  //     }

  //     let changeparam = menuButton.mergeMoveMain(
  //       columnseleted,
  //       rowseleted,
  //       last,
  //       top,
  //       height,
  //       left,
  //       width
  //     );
  //     if (changeparam != null) {
  //       columnseleted = changeparam[0];
  //       rowseleted = changeparam[1];
  //       top = changeparam[2];
  //       height = changeparam[3];
  //       left = changeparam[4];
  //       width = changeparam[5];
  //     }

  //     last["row"] = rowseleted;
  //     last["column"] = columnseleted;

  //     last["left_move"] = left;
  //     last["width_move"] = width;
  //     last["top_move"] = top;
  //     last["height_move"] = height;

  //     conditionformat.selectRange[conditionformat.selectRange.length - 1] =
  //       last;
  //   } else if (event.ctrlKey) {
  //     conditionformat.selectRange.push({
  //       left: col_pre,
  //       width: col - col_pre - 1,
  //       top: row_pre,
  //       height: row - row_pre - 1,
  //       left_move: col_pre,
  //       width_move: col - col_pre - 1,
  //       top_move: row_pre,
  //       height_move: row - row_pre - 1,
  //       row: [row_index, row_index_ed],
  //       column: [col_index, col_index_ed],
  //       row_focus: row_index,
  //       column_focus: col_index,
  //     });
  //   } else {
  //     conditionformat.selectRange = [];
  //     conditionformat.selectRange.push({
  //       left: col_pre,
  //       width: col - col_pre - 1,
  //       top: row_pre,
  //       height: row - row_pre - 1,
  //       left_move: col_pre,
  //       width_move: col - col_pre - 1,
  //       top_move: row_pre,
  //       height_move: row - row_pre - 1,
  //       row: [row_index, row_index_ed],
  //       column: [col_index, col_index_ed],
  //       row_focus: row_index,
  //       column_focus: col_index,
  //     });
  //   }

  //   selectionCopyShow(conditionformat.selectRange);

  //   let range = conditionformat.getTxtByRange(conditionformat.selectRange);
  //   $("#luckysheet-multiRange-dialog input").val(range);

  //   return;
  // } else {
  //   conditionformat.selectStatus = false;
  //   conditionformat.selectRange = [];
  // }

  // if ($("#luckysheet-singleRange-dialog").is(":visible")) {
  //   ctx.luckysheet_select_status = false;

  //   selectionCopyShow([
  //     { row: [row_index, row_index], column: [col_index, col_index] },
  //   ]);

  //   let range = getRangetxt(
  //     ctx.currentSheetId,
  //     { row: [row_index, row_index], column: [col_index, col_index] },
  //     ctx.currentSheetId
  //   );
  //   $("#luckysheet-singleRange-dialog input").val(range);

  //   return;
  // }

  // if ($("#luckysheet-dataVerificationRange-dialog").is(":visible")) {
  //   dataVerificationCtrl.selectStatus = true;
  //   ctx.luckysheet_select_status = false;

  //   if (event.shiftKey) {
  //     let last =
  //       dataVerificationCtrl.selectRange[
  //         dataVerificationCtrl.selectRange.length - 1
  //       ];

  //     let top = 0,
  //       height = 0,
  //       rowseleted = [];
  //     if (last.top > row_pre) {
  //       top = row_pre;
  //       height = last.top + last.height - row_pre;

  //       if (last.row[1] > last.row_focus) {
  //         last.row[1] = last.row_focus;
  //       }

  //       rowseleted = [row_index, last.row[1]];
  //     } else if (last.top == row_pre) {
  //       top = row_pre;
  //       height = last.top + last.height - row_pre;
  //       rowseleted = [row_index, last.row[0]];
  //     } else {
  //       top = last.top;
  //       height = row - last.top - 1;

  //       if (last.row[0] < last.row_focus) {
  //         last.row[0] = last.row_focus;
  //       }

  //       rowseleted = [last.row[0], row_index];
  //     }

  //     let left = 0,
  //       width = 0,
  //       columnseleted = [];
  //     if (last.left > col_pre) {
  //       left = col_pre;
  //       width = last.left + last.width - col_pre;

  //       if (last.column[1] > last.column_focus) {
  //         last.column[1] = last.column_focus;
  //       }

  //       columnseleted = [col_index, last.column[1]];
  //     } else if (last.left == col_pre) {
  //       left = col_pre;
  //       width = last.left + last.width - col_pre;
  //       columnseleted = [col_index, last.column[0]];
  //     } else {
  //       left = last.left;
  //       width = col - last.left - 1;

  //       if (last.column[0] < last.column_focus) {
  //         last.column[0] = last.column_focus;
  //       }

  //       columnseleted = [last.column[0], col_index];
  //     }

  //     let changeparam = menuButton.mergeMoveMain(
  //       columnseleted,
  //       rowseleted,
  //       last,
  //       top,
  //       height,
  //       left,
  //       width
  //     );
  //     if (changeparam != null) {
  //       columnseleted = changeparam[0];
  //       rowseleted = changeparam[1];
  //       top = changeparam[2];
  //       height = changeparam[3];
  //       left = changeparam[4];
  //       width = changeparam[5];
  //     }

  //     last["row"] = rowseleted;
  //     last["column"] = columnseleted;

  //     last["left_move"] = left;
  //     last["width_move"] = width;
  //     last["top_move"] = top;
  //     last["height_move"] = height;

  //     dataVerificationCtrl.selectRange[
  //       dataVerificationCtrl.selectRange.length - 1
  //     ] = last;
  //   } else {
  //     dataVerificationCtrl.selectRange = [];
  //     dataVerificationCtrl.selectRange.push({
  //       left: col_pre,
  //       width: col - col_pre - 1,
  //       top: row_pre,
  //       height: row - row_pre - 1,
  //       left_move: col_pre,
  //       width_move: col - col_pre - 1,
  //       top_move: row_pre,
  //       height_move: row - row_pre - 1,
  //       row: [row_index, row_index_ed],
  //       column: [col_index, col_index_ed],
  //       row_focus: row_index,
  //       column_focus: col_index,
  //     });
  //   }

  //   selectionCopyShow(dataVerificationCtrl.selectRange);

  //   let range = dataVerificationCtrl.getTxtByRange(
  //     dataVerificationCtrl.selectRange
  //   );
  //   if (formula.rangetosheet != ctx.currentSheetId) {
  //     range =
  //       ctx.luckysheetfile[getSheetIndex(ctx.currentSheetId)].name +
  //       "!" +
  //       range;
  //   }
  //   $("#luckysheet-dataVerificationRange-dialog input").val(range);

  //   return;
  // } else {
  //   dataVerificationCtrl.selectStatus = false;
  //   dataVerificationCtrl.selectRange = [];
  // }

  // if (ifFormulaGenerator.singleRangeFocus) {
  //   $("#luckysheet-ifFormulaGenerator-dialog .singRange").click();
  // }
  // if (
  //   $("#luckysheet-ifFormulaGenerator-singleRange-dialog").is(":visible")
  // ) {

  //   ctx.luckysheet_select_status = false;
  //   formula.rangestart = false;

  //   $("#fortune-formula-functionrange-select")
  //     .css({
  //       left: col_pre,
  //       width: col - col_pre - 1,
  //       top: row_pre,
  //       height: row - row_pre - 1,
  //     })
  //     .show();
  //   $("#luckysheet-formula-help-c").hide();

  //   let range = getRangetxt(
  //     ctx.currentSheetId,
  //     { row: [row_index, row_index], column: [col_index, col_index] },
  //     ctx.currentSheetId
  //   );
  //   $("#luckysheet-ifFormulaGenerator-singleRange-dialog input").val(range);

  //   return;
  // }
  // if (
  //   $("#luckysheet-ifFormulaGenerator-multiRange-dialog").is(":visible")
  // ) {

  //   ctx.luckysheet_select_status = false;
  //   formula.func_selectedrange = {
  //     left: col_pre,
  //     width: col - col_pre - 1,
  //     top: row_pre,
  //     height: row - row_pre - 1,
  //     left_move: col_pre,
  //     width_move: col - col_pre - 1,
  //     top_move: row_pre,
  //     height_move: row - row_pre - 1,
  //     row: [row_index, row_index],
  //     column: [col_index, col_index],
  //     row_focus: row_index,
  //     column_focus: col_index,
  //   };
  //   formula.rangestart = true;

  //   $("#fortune-formula-functionrange-select")
  //     .css({
  //       left: col_pre,
  //       width: col - col_pre - 1,
  //       top: row_pre,
  //       height: row - row_pre - 1,
  //     })
  //     .show();
  //   $("#luckysheet-formula-help-c").hide();

  //   let range = getRangetxt(
  //     ctx.currentSheetId,
  //     { row: [row_index, row_index], column: [col_index, col_index] },
  //     ctx.currentSheetId
  //   );
  //   $("#luckysheet-ifFormulaGenerator-multiRange-dialog input").val(range);

  //   $("#luckysheet-row-count-show").hide();
  //   $("#luckysheet-column-count-show").hide();

  //   return;
  // }

  if (ctx.luckysheet_select_status) {
    if (e.shiftKey) {
      const last =
        ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
      if (
        last &&
        last.top != null &&
        last.left != null &&
        last.height != null &&
        last.width != null &&
        last.row_focus != null &&
        last.column_focus != null
      ) {
        let top = 0;
        let height = 0;
        let rowseleted = [];
        if (last.top > row_pre) {
          top = row_pre;
          height = last.top + last.height - row_pre;
          if (last.row[1] > last.row_focus) {
            last.row[1] = last.row_focus;
          }
          rowseleted = [row_index, last.row[1]];
        } else if (last.top === row_pre) {
          top = row_pre;
          height = last.top + last.height - row_pre;
          rowseleted = [row_index, last.row[0]];
        } else {
          top = last.top;
          height = row - last.top - 1;
          if (last.row[0] < last.row_focus) {
            last.row[0] = last.row_focus;
          }
          rowseleted = [last.row[0], row_index];
        }
        let left = 0;
        let width = 0;
        let columnseleted = [];
        if (last.left > col_pre) {
          left = col_pre;
          width = last.left + last.width - col_pre;
          if (last.column[1] > last.column_focus) {
            last.column[1] = last.column_focus;
          }
          columnseleted = [col_index, last.column[1]];
        } else if (last.left === col_pre) {
          left = col_pre;
          width = last.left + last.width - col_pre;
          columnseleted = [col_index, last.column[0]];
        } else {
          left = last.left;
          width = col - last.left - 1;
          if (last.column[0] < last.column_focus) {
            last.column[0] = last.column_focus;
          }
          columnseleted = [last.column[0], col_index];
        }
        const changeparam = mergeMoveMain(
          ctx,
          columnseleted,
          rowseleted,
          last,
          top,
          height,
          left,
          width
        );
        if (changeparam != null) {
          // @ts-ignore
          [columnseleted, rowseleted, top, height, left, width] = changeparam;
        }
        last.row = rowseleted;
        last.column = columnseleted;
        last.left_move = left;
        last.width_move = width;
        last.top_move = top;
        last.height_move = height;
        ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1] =
          last;

        // if ($("#luckysheet-alternateformat-rangeDialog").is(":visible")) {
        //   $("#luckysheet-alternateformat-rangeDialog input").val(
        //     getRangetxt(ctx.currentSheetId, ctx.luckysheet_select_save)
        //   );
        // }
        // if (pivotTable.luckysheet_pivotTable_select_state) {
        //   $("#luckysheet-pivotTable-range-selection-input").val(
        //     `${
        //       ctx.luckysheetfile[getSheetIndex(ctx.currentSheetId)]
        //         .name
        //     }!${chatatABC(ctx.luckysheet_select_save[0].column[0])}${
        //       ctx.luckysheet_select_save[0].row[0] + 1
        //     }:${chatatABC(ctx.luckysheet_select_save[0].column[1])}${
        //       ctx.luckysheet_select_save[0].row[1] + 1
        //     }`
        //   );
      }
    } else if (e.ctrlKey || e.metaKey) {
      ctx.luckysheet_select_save?.push({
        left: col_pre,
        width: col - col_pre - 1,
        top: row_pre,
        height: row - row_pre - 1,
        left_move: col_pre,
        width_move: col - col_pre - 1,
        top_move: row_pre,
        height_move: row - row_pre - 1,
        row: [row_index, row_index_ed],
        column: [col_index, col_index_ed],
        row_focus: row_index,
        column_focus: col_index,
      });
    } else {
      // eslint-disable-next-line prefer-const
      ctx.luckysheet_select_save = [
        {
          left: col_pre,
          width: col - col_pre - 1,
          top: row_pre,
          height: row - row_pre - 1,
          left_move: col_pre,
          width_move: col - col_pre - 1,
          top_move: row_pre,
          height_move: row - row_pre - 1,
          row: [row_index, row_index_ed],
          column: [col_index, col_index_ed],
          row_focus: row_index,
          column_focus: col_index,
        },
      ];

      //   menuButton.menuButtonFocus(ctx.flowdata, row_index, col_index);

      //   formula.fucntionboxshow(row_index, col_index);
    }
  }

  // selectHightlightShow();

  //   if (
  //     luckysheetFreezen.freezenhorizontaldata != null ||
  //     luckysheetFreezen.freezenverticaldata != null
  //   ) {
  //     luckysheetFreezen.scrollAdaptOfselect();
  //   }

  //   if (!browser.mobilecheck()) {

  //     luckysheetactiveCell();
  //   }

  //   server.saveParam(
  //     "mv",
  //     ctx.currentSheetId,
  //     ctx.luckysheet_select_save
  //   );
  // }

  // if (alternateformat.rangefocus) {
  //   alternateformat.rangefocus = false;
  //   $("#luckysheet-alternateformat-range .fa-table").click();
  // }

  // $("#luckysheet-row-count-show, #luckysheet-column-count-show").hide();

  // if (!isEditMode()) {

  //   hideAllNeedRangeShow();
  // }

  // // selectHelpboxFill();

  // pivotTable.pivotclick(row_index, col_index, ctx.currentSheetId);

  // luckysheetContainerFocus();

  ctx.luckysheet_select_save = normalizeSelection(
    ctx,
    ctx.luckysheet_select_save
  );

  if (ctx.hooks.afterCellMouseDown) {
    setTimeout(() => {
      ctx.hooks.afterCellMouseDown?.(flowdata[row_index]?.[col_index], {
        row: row_index,
        column: col_index,
        startRow: row_pre,
        startColumn: col_pre,
        endRow: row,
        endColumn: col,
      });
    });
  }
}

export function handleCellAreaDoubleClick(
  ctx: Context,
  globalCache: GlobalCache,
  settings: Settings,
  e: MouseEvent,
  container: HTMLElement
) {
  // if ($(event.target).hasClass("luckysheet-mousedown-cancel")) {
  //   return;
  // }
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  if (
    (ctx.luckysheetCellUpdate.length > 0 && ctx.formulaCache.rangestart) ||
    ctx.formulaCache.rangedrag_column_start ||
    ctx.formulaCache.rangedrag_row_start ||
    (ctx.luckysheetCellUpdate.length > 0 && israngeseleciton(ctx))
  ) {
    return;
  }

  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) {
    checkProtection(ctx, "editCells");
    return;
  }

  // if (parseInt($("#luckysheet-input-box").css("top")) > 0) {
  //   return;
  // }

  // const mouse = mouseposition(event.pageX, event.pageY);
  // if (
  //   mouse[0] >= ctx.cellmainWidth - ctx.cellMainSrollBarSize ||
  //   mouse[1] >= ctx.cellmainHeight - ctx.cellMainSrollBarSize
  // ) {
  //   return;
  // }

  // const scrollLeft = $("#luckysheet-cell-main").scrollLeft();
  // const scrollTop = $("#luckysheet-cell-main").scrollTop();
  // let x = mouse[0] + scrollLeft;
  // let y = mouse[1] + scrollTop;
  const rect = container.getBoundingClientRect();
  const mouseX = e.pageX - rect.left;
  const mouseY = e.pageY - rect.top;
  const _x = mouseX + ctx.scrollLeft;
  const _y = mouseY + ctx.scrollTop;

  const freeze = globalCache.freezen?.[ctx.currentSheetId];
  const { x, y } = fixPositionOnFrozenCells(freeze, _x, _y, mouseX, mouseY);

  const row_location = rowLocation(y, ctx.visibledatarow);
  let row_index = row_location[2];

  const col_location = colLocation(x, ctx.visibledatacolumn);
  let col_index = col_location[2];

  const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
  const { dataVerification } = ctx.luckysheetfile[index];

  if (dataVerification) {
    const item = dataVerification[`${row_index}_${col_index}`];
    if (item && item.type === "checkbox") return;
    // A list that only accepts its items opens the list instead of the text editor.
    if (item && item.type === "dropdown" && item.prohibitInput) {
      ctx.dataVerificationDropDownList = true;
      return;
    }
  }

  const margeset = mergeBorder(ctx, flowdata, row_index, col_index);
  if (margeset) {
    [, , row_index] = margeset.row;
    [, , col_index] = margeset.column;
  }

  // if (
  //   $("#luckysheet-search-formula-parm").is(":visible") ||
  //   $("#luckysheet-search-formula-parm-select").is(":visible")
  // ) {

  //   $("#luckysheet-cell-selected").hide();
  // } else if (
  //   $("#luckysheet-conditionformat-dialog").is(":visible") ||
  //   $("#luckysheet-administerRule-dialog").is(":visible") ||
  //   $("#luckysheet-newConditionRule-dialog").is(":visible") ||
  //   $("#luckysheet-editorConditionRule-dialog").is(":visible") ||
  //   $("#luckysheet-singleRange-dialog").is(":visible") ||
  //   $("#luckysheet-multiRange-dialog").is(":visible")
  // ) {

  // } else if (
  //   $("#luckysheet-modal-dialog-slider-alternateformat").is(":visible") ||
  //   $("#luckysheet-alternateformat-rangeDialog").is(":visible")
  // ) {

  // } else {
  //   if (menuButton.luckysheetPaintModelOn) {
  //     menuButton.cancelPaintModel();
  //   }

  const { column_focus, row_focus } = ctx.luckysheet_select_save![0];
  if (
    !_.isNil(column_focus) &&
    !_.isNil(row_focus) &&
    (column_focus !== col_index || row_focus !== row_index)
  ) {
    row_index = row_focus;
    col_index = column_focus;
  }

  luckysheetUpdateCell(ctx, row_index, col_index);
  // }
}

export function handleContextMenu(
  ctx: Context,
  settings: Settings,
  e: MouseEvent,
  workbookContainer: HTMLDivElement,
  container: HTMLDivElement,
  area: "cell" | "rowHeader" | "columnHeader"
) {
  if (!ctx.allowEdit) {
    return;
  }
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  // if (isEditMode()) {

  //   return;
  // }
  const workbookRect = workbookContainer.getBoundingClientRect();

  const { cellContextMenu } = settings;

  // $("#luckysheet-cols-rows-data").show();
  // $("#luckysheet-cols-rows-handleincell").show();
  // $("#luckysheet-cols-rows-add, #luckysheet-cols-rows-shift").hide();

  // $$("#luckysheet-cols-rows-data .luckysheet-menuseparator").style.display =
  //   "block";
  // $$(
  //   "#luckysheet-cols-rows-handleincell .luckysheet-menuseparator"
  // ).style.display = "block";

  if (_.isEmpty(cellContextMenu)) {
    return;
  }

  // relative to the workbook container
  const x = e.pageX - workbookRect.left;
  const y = e.pageY - workbookRect.top;
  // showrightclickmenu($("#luckysheet-rightclick-menu"), x, y);
  ctx.contextMenu = {
    x,
    y,
    pageX: e.pageX,
    pageY: e.pageY,
  };
  // select current cell when clicking the right button
  e.preventDefault();
  if (area === "cell") {
    _.set(ctx.contextMenu, "headerMenu", undefined);
    const rect = container.getBoundingClientRect();
    const mouseX = e.pageX - rect.left - window.scrollX;
    const mouseY = e.pageY - rect.top - window.scrollY;
    const _selected_x = mouseX + ctx.scrollLeft;
    const _selected_y = mouseY + ctx.scrollTop;
    const { x: selected_x, y: selected_y } = fixPositionOnFrozenCells(
      ctx.getRefs().globalCache.freezen?.[ctx.currentSheetId],
      _selected_x,
      _selected_y,
      mouseX,
      mouseY
    );
    const row_location = rowLocation(selected_y, ctx.visibledatarow);
    const row = row_location[1];
    const row_pre = row_location[0];
    const row_index = row_location[2];

    const col_location = colLocation(selected_x, ctx.visibledatacolumn);
    const col = col_location[1];
    const col_pre = col_location[0];
    const col_index = col_location[2];

    const isInSelection = _.some(
      ctx.luckysheet_select_save,
      (obj_s) =>
        obj_s.row != null &&
        row_index >= obj_s.row[0] &&
        row_index <= obj_s.row[1] &&
        col_index >= obj_s.column[0] &&
        col_index <= obj_s.column[1]
    );
    if (!isInSelection && (e.metaKey || e.ctrlKey)) {
      if (flowdata[row_index][col_index]?.mc) {
        const changeparam = mergeMoveMain(
          ctx,
          [col_index, col_index],
          [row_index, row_index],
          { row_focus: row_index, column_focus: col_index },
          row_pre,
          row,
          col_pre,
          col
        );
        if (changeparam != null) {
          // @ts-ignore
          const [columnseleted, rowseleted, top, height, left, width] =
            changeparam;
          ctx.luckysheet_select_save?.push({
            left: left as number,
            width: (width as number) - 1,
            top: top as number,
            height: (height as number) - 1,
            left_move: left as number,
            width_move: width as number,
            top_move: top as number,
            height_move: height as number,
            row: rowseleted as number[],
            column: columnseleted as number[],
            row_focus: (rowseleted as number[])[0],
            column_focus: (columnseleted as number[])[0],
          });
          return;
        }
      }
      ctx.luckysheet_select_save?.push({
        left: col_pre,
        width: col - col_pre - 1,
        top: row_pre,
        height: row - row_pre - 1,
        left_move: col_pre,
        width_move: col - col_pre - 1,
        top_move: row_pre,
        height_move: row - row_pre - 1,
        row: [row_index, row_index],
        column: [col_index, col_index],
        row_focus: row_index,
        column_focus: col_index,
      });
      return;
    }
    if (isInSelection) return;
    const row_index_ed = row_index;
    const col_index_ed = col_index;
    if (flowdata[row_index][col_index]?.mc) {
      const changeparam = mergeMoveMain(
        ctx,
        [col_index, col_index],
        [row_index, row_index],
        { row_focus: row_index, column_focus: col_index },
        row_pre,
        row,
        col_pre,
        col
      );
      if (changeparam != null) {
        // @ts-ignore
        const [columnseleted, rowseleted, top, height, left, width] =
          changeparam;
        ctx.luckysheet_select_save = [
          {
            left: left as number,
            width: (width as number) - 1,
            top: top as number,
            height: (height as number) - 1,
            left_move: left as number,
            width_move: width as number,
            top_move: top as number,
            height_move: height as number,
            row: rowseleted as number[],
            column: columnseleted as number[],
            row_focus: (rowseleted as number[])[0],
            column_focus: (columnseleted as number[])[0],
          },
        ];
        return;
      }
    }
    ctx.luckysheet_select_save = [
      {
        left: col_pre,
        width: col - col_pre - 1,
        top: row_pre,
        height: row - row_pre - 1,
        left_move: col_pre,
        width_move: col - col_pre - 1,
        top_move: row_pre,
        height_move: row - row_pre - 1,
        row: [row_index, row_index_ed],
        column: [col_index, col_index_ed],
        row_focus: row_index,
        column_focus: col_index,
      },
    ];
  } else if (area === "rowHeader") {
    _.set(ctx.contextMenu, "headerMenu", "row");
    const rect = container.getBoundingClientRect();
    const mouseY = e.pageY - rect.top - window.scrollY;
    const _selected_y = mouseY + ctx.scrollTop;
    const { y: selected_y } = fixPositionOnFrozenCells(
      ctx.getRefs().globalCache.freezen?.[ctx.currentSheetId],
      0,
      _selected_y,
      0,
      mouseY
    );
    const row_location = rowLocation(selected_y, ctx.visibledatarow);
    const row = row_location[1];
    const row_pre = row_location[0];
    const row_index = row_location[2];

    const isInSelection = _.some(
      ctx.luckysheet_select_save,
      (obj_s) =>
        obj_s.row != null &&
        row_index >= obj_s.row[0] &&
        row_index <= obj_s.row[1] &&
        !obj_s.column_select
    );

    if (isInSelection) return;
    const col_index = ctx.visibledatacolumn.length - 1;
    const col = ctx.visibledatacolumn[col_index];
    const col_pre = 0;
    const top = row_pre;
    const height = row - row_pre - 1;
    const rowseleted = [row_index, row_index];
    ctx.luckysheet_select_save = [];
    ctx.luckysheet_select_save.push({
      left: colLocationByIndex(0, ctx.visibledatacolumn)[0],
      width:
        colLocationByIndex(0, ctx.visibledatacolumn)[1] -
        colLocationByIndex(0, ctx.visibledatacolumn)[0] -
        1,
      top,
      height,
      left_move: col_pre,
      width_move: col - col_pre - 1,
      top_move: top,
      height_move: height,
      row: rowseleted,
      column: [0, col_index],
      row_focus: row_index,
      column_focus: 0,
      row_select: true,
    });
  } else if (area === "columnHeader") {
    _.set(ctx.contextMenu, "headerMenu", "column");
    const rect = container.getBoundingClientRect();
    const mouseX = e.pageX - rect.left - window.scrollX;
    const _selected_x = mouseX + ctx.scrollLeft;
    const { x: selected_x } = fixPositionOnFrozenCells(
      ctx.getRefs().globalCache.freezen?.[ctx.currentSheetId],
      _selected_x,
      0,
      mouseX,
      0
    );
    const row_index = ctx.visibledatarow.length - 1;
    const row = ctx.visibledatarow[row_index];
    const row_pre = 0;
    const col_location = colLocation(selected_x, ctx.visibledatacolumn);
    const col = col_location[1];
    const col_pre = col_location[0];
    const col_index = col_location[2];

    const isInSelection = _.some(
      ctx.luckysheet_select_save,
      (obj_s) =>
        obj_s.row != null &&
        col_index >= obj_s.column[0] &&
        col_index <= obj_s.column[1] &&
        !obj_s.row_select
    );

    if (isInSelection) return;
    const left = col_pre;
    const width = col - col_pre - 1;
    const columnseleted = [col_index, col_index];
    ctx.luckysheet_select_save = [];
    ctx.luckysheet_select_save.push({
      left,
      width,
      top: rowLocationByIndex(0, ctx.visibledatarow)[0],
      height:
        rowLocationByIndex(0, ctx.visibledatarow)[1] -
        rowLocationByIndex(0, ctx.visibledatarow)[0] -
        1,
      left_move: left,
      width_move: width,
      top_move: row_pre,
      height_move: row - row_pre - 1,
      row: [0, row_index],
      column: columnseleted,
      row_focus: 0,
      column_focus: col_index,
      column_select: true,
    });
  }
}

function mouseRender(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  cellInput: HTMLDivElement,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement,
  container: HTMLDivElement,
  fxInput?: HTMLDivElement | null
) {
  // Scrolling while the pointer is past the grid's edge is driven per frame
  // by the view (see getDragAutoScroll), not by pointer moves.
  const rect = container.getBoundingClientRect();

  if (ctx.rangeDialog?.singleSelect) {
    return;
  }

  if (ctx.luckysheet_select_status) {
    const anchor = _.last(ctx.luckysheet_select_save);
    // past the grid's edge: the first/last visible row or column
    const { x, y } = getGridPoint(
      ctx,
      globalCache.freezen?.[ctx.currentSheetId],
      e,
      container,
      {
        clamp: true,
        anchorRow: anchor?.row_focus,
        anchorCol: anchor?.column_focus,
      }
    );

    const row_location = rowLocation(y, ctx.visibledatarow);
    const row = row_location[1];
    const row_pre = row_location[0];
    const row_index = row_location[2];
    const col_location = colLocation(x, ctx.visibledatacolumn);
    const col = col_location[1];
    const col_pre = col_location[0];
    const col_index = col_location[2];

    if (
      !checkProtectionSelectLockedOrUnLockedCells(
        ctx,
        row_index,
        col_index,
        ctx.currentSheetId
      )
    ) {
      ctx.luckysheet_select_status = false;
      return;
    }

    const last = _.cloneDeep(
      ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1]
    );

    if (
      !last ||
      _.isNil(last.left) ||
      _.isNil(last.top) ||
      _.isNil(last.height) ||
      _.isNil(last.width) ||
      _.isNil(last.row_focus) ||
      _.isNil(last.column_focus)
    ) {
      return;
    }

    let top = 0;
    let height = 0;
    let rowseleted = [];
    if (last.top > row_pre) {
      top = row_pre;
      height = last.top + last.height - row_pre;

      if (last.row[1] > last.row_focus) {
        last.row[1] = last.row_focus;
      }

      rowseleted = [row_index, last.row[1]];
    } else if (last.top === row_pre) {
      top = row_pre;
      height = last.top + last.height - row_pre;
      rowseleted = [row_index, last.row[0]];
    } else {
      top = last.top;
      height = row - last.top - 1;

      if (last.row[0] < last.row_focus) {
        last.row[0] = last.row_focus;
      }

      rowseleted = [last.row[0], row_index];
    }

    let left = 0;
    let width = 0;
    let columnseleted = [];
    if (last.left > col_pre) {
      left = col_pre;
      width = last.left + last.width - col_pre;

      if (last.column[1] > last.column_focus) {
        last.column[1] = last.column_focus;
      }

      columnseleted = [col_index, last.column[1]];
    } else if (last.left === col_pre) {
      left = col_pre;
      width = last.left + last.width - col_pre;
      columnseleted = [col_index, last.column[0]];
    } else {
      left = last.left;
      width = col - last.left - 1;

      if (last.column[0] < last.column_focus) {
        last.column[0] = last.column_focus;
      }

      columnseleted = [last.column[0], col_index];
    }

    const changeparam = mergeMoveMain(
      ctx,
      columnseleted,
      rowseleted,
      last,
      top,
      height,
      left,
      width
    );
    if (changeparam != null) {
      // @ts-ignore
      [columnseleted, rowseleted, top, height, left, width] = changeparam;
    }

    last.row = rowseleted;
    last.column = columnseleted;

    last.left_move = left;
    last.width_move = width;
    last.top_move = top;
    last.height_move = height;

    const isMaxColumn =
      ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1]
        .column;
    const colMax = ctx.visibledatacolumn.length - 1;
    if (isMaxColumn![0] === 0 && isMaxColumn![1] === colMax) {
      last.column[1] = colMax;
      last.width_move = ctx.visibledatacolumn[colMax] - 1;
    }

    const isMaxRow =
      ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1].row;
    const rowMax = ctx.visibledatarow.length - 1;
    if (isMaxRow![0] === 0 && isMaxRow![1] === rowMax) {
      last.row[1] = rowMax;
      last.height_move = ctx.visibledatarow[rowMax] - 1;
    }

    ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1] = last;

    // Reaching into the frozen panes scrolls the scrolling pane back
    // gradually (auto-scroll, see getDragAutoScroll), not in one jump.

    // selectHelpboxFill();

    // if ($("#luckysheet-alternateformat-rangeDialog").is(":visible")) {
    //   $("#luckysheet-alternateformat-rangeDialog input").val(
    //     getRangetxt(
    //       ctx.currentSheetId,
    //       ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1]
    //     )
    //   );
    // }

    // if (pivotTable.luckysheet_pivotTable_select_state) {
    //   $("#luckysheet-pivotTable-range-selection-input").val(
    //     `${
    //       ctx.luckysheetfile[getSheetIndex(ctx.currentSheetId)].name
    //     }!${chatatABC(ctx.luckysheet_select_save[0].column[0])}${
    //       ctx.luckysheet_select_save[0].row[0] + 1
    //     }:${chatatABC(ctx.luckysheet_select_save[0].column[1])}${
    //       ctx.luckysheet_select_save[0].row[1] + 1
    //     }`
    //   );
    // }
    // } else if (conditionformat.selectStatus) {
    //   const mouse = mouseposition(event.pageX, event.pageY);
    //   const x = mouse[0] + $("#luckysheet-cell-main").scrollLeft();
    //   const y = mouse[1] + $("#luckysheet-cell-main").scrollTop();

    //   const row_location = rowLocation(y);
    //   const row = row_location[1];
    //   const row_pre = row_location[0];
    //   const row_index = row_location[2];
    //   const col_location = colLocation(x);
    //   const col = col_location[1];
    //   const col_pre = col_location[0];
    //   const col_index = col_location[2];

    //   const last =
    //     conditionformat.selectRange[conditionformat.selectRange.length - 1];

    //   let top = 0;
    //   let height = 0;
    //   let rowseleted = [];
    //   if (last.top > row_pre) {
    //     top = row_pre;
    //     height = last.top + last.height - row_pre;

    //     if (last.row[1] > last.row_focus) {
    //       last.row[1] = last.row_focus;
    //     }

    //     rowseleted = [row_index, last.row[1]];
    //   } else if (last.top == row_pre) {
    //     top = row_pre;
    //     height = last.top + last.height - row_pre;
    //     rowseleted = [row_index, last.row[0]];
    //   } else {
    //     top = last.top;
    //     height = row - last.top - 1;

    //     if (last.row[0] < last.row_focus) {
    //       last.row[0] = last.row_focus;
    //     }

    //     rowseleted = [last.row[0], row_index];
    //   }

    //   let left = 0;
    //   let width = 0;
    //   let columnseleted = [];
    //   if (last.left > col_pre) {
    //     left = col_pre;
    //     width = last.left + last.width - col_pre;

    //     if (last.column[1] > last.column_focus) {
    //       last.column[1] = last.column_focus;
    //     }

    //     columnseleted = [col_index, last.column[1]];
    //   } else if (last.left == col_pre) {
    //     left = col_pre;
    //     width = last.left + last.width - col_pre;
    //     columnseleted = [col_index, last.column[0]];
    //   } else {
    //     left = last.left;
    //     width = col - last.left - 1;

    //     if (last.column[0] < last.column_focus) {
    //       last.column[0] = last.column_focus;
    //     }

    //     columnseleted = [last.column[0], col_index];
    //   }

    //   const changeparam = menuButton.mergeMoveMain(
    //     columnseleted,
    //     rowseleted,
    //     last,
    //     top,
    //     height,
    //     left,
    //     width
    //   );
    //   if (changeparam != null) {
    //     columnseleted = changeparam[0];
    //     rowseleted = changeparam[1];
    //     top = changeparam[2];
    //     height = changeparam[3];
    //     left = changeparam[4];
    //     width = changeparam[5];
    //   }

    //   last.row = rowseleted;
    //   last.column = columnseleted;

    //   last.left_move = left;
    //   last.width_move = width;
    //   last.top_move = top;
    //   last.height_move = height;

    //   conditionformat.selectRange[conditionformat.selectRange.length - 1] = last;

    //   selectionCopyShow(conditionformat.selectRange);

    //   const range = conditionformat.getTxtByRange(conditionformat.selectRange);
    //   $("#luckysheet-multiRange-dialog input").val(range);
    // } else if (dataVerificationCtrl.selectStatus) {
    //   const mouse = mouseposition(event.pageX, event.pageY);
    //   const x = mouse[0] + $("#luckysheet-cell-main").scrollLeft();
    //   const y = mouse[1] + $("#luckysheet-cell-main").scrollTop();

    //   const row_location = rowLocation(y);
    //   const row = row_location[1];
    //   const row_pre = row_location[0];
    //   const row_index = row_location[2];
    //   const col_location = colLocation(x);
    //   const col = col_location[1];
    //   const col_pre = col_location[0];
    //   const col_index = col_location[2];

    //   const last =
    //     dataVerificationCtrl.selectRange[
    //       dataVerificationCtrl.selectRange.length - 1
    //     ];

    //   let top = 0;
    //   let height = 0;
    //   let rowseleted = [];
    //   if (last.top > row_pre) {
    //     top = row_pre;
    //     height = last.top + last.height - row_pre;

    //     if (last.row[1] > last.row_focus) {
    //       last.row[1] = last.row_focus;
    //     }

    //     rowseleted = [row_index, last.row[1]];
    //   } else if (last.top == row_pre) {
    //     top = row_pre;
    //     height = last.top + last.height - row_pre;
    //     rowseleted = [row_index, last.row[0]];
    //   } else {
    //     top = last.top;
    //     height = row - last.top - 1;

    //     if (last.row[0] < last.row_focus) {
    //       last.row[0] = last.row_focus;
    //     }

    //     rowseleted = [last.row[0], row_index];
    //   }

    //   let left = 0;
    //   let width = 0;
    //   let columnseleted = [];
    //   if (last.left > col_pre) {
    //     left = col_pre;
    //     width = last.left + last.width - col_pre;

    //     if (last.column[1] > last.column_focus) {
    //       last.column[1] = last.column_focus;
    //     }

    //     columnseleted = [col_index, last.column[1]];
    //   } else if (last.left == col_pre) {
    //     left = col_pre;
    //     width = last.left + last.width - col_pre;
    //     columnseleted = [col_index, last.column[0]];
    //   } else {
    //     left = last.left;
    //     width = col - last.left - 1;

    //     if (last.column[0] < last.column_focus) {
    //       last.column[0] = last.column_focus;
    //     }

    //     columnseleted = [last.column[0], col_index];
    //   }

    //   const changeparam = menuButton.mergeMoveMain(
    //     columnseleted,
    //     rowseleted,
    //     last,
    //     top,
    //     height,
    //     left,
    //     width
    //   );
    //   if (changeparam != null) {
    //     columnseleted = changeparam[0];
    //     rowseleted = changeparam[1];
    //     top = changeparam[2];
    //     height = changeparam[3];
    //     left = changeparam[4];
    //     width = changeparam[5];
    //   }

    //   last.row = rowseleted;
    //   last.column = columnseleted;

    //   last.left_move = left;
    //   last.width_move = width;
    //   last.top_move = top;
    //   last.height_move = height;

    //   dataVerificationCtrl.selectRange[
    //     dataVerificationCtrl.selectRange.length - 1
    //   ] = last;

    //   selectionCopyShow(dataVerificationCtrl.selectRange);

    //   let range = dataVerificationCtrl.getTxtByRange(
    //     dataVerificationCtrl.selectRange
    //   );
    //   if (formula.rangetosheet != ctx.currentSheetId) {
    //     range = `${
    //       ctx.luckysheetfile[getSheetIndex(ctx.currentSheetId)].name
    //     }!${range}`;
    //   }
    //   $("#luckysheet-dataVerificationRange-dialog input").val(range);
  } else if (ctx.formulaCache.rangestart) {
    const [editor, copyTo] = activeEditors(cellInput, fxInput);
    dragPointWithMouse(
      ctx,
      editor,
      copyTo,
      cellAtOverlayPoint(ctx, globalCache, e, container)
    );
    e.preventDefault();
  } else if (ctx.formulaCache.rangedrag_row_start) {
    rangeDragRow(
      ctx,
      e,
      cellInput,
      scrollX.scrollLeft,
      scrollY.scrollTop,
      container,
      fxInput
    );
  } else if (ctx.formulaCache.rangedrag_column_start) {
    rangeDragColumn(
      ctx,
      e,
      cellInput,
      scrollX.scrollLeft,
      scrollY.scrollTop,
      container,
      fxInput
    );
  } else if (ctx.luckysheet_rows_selected_status) {
    // const mouse = mouseposition(event.pageX, event.pageY);
    // const y = mouse[1] + $("#luckysheet-rows-h").scrollTop();
    // if (y < 0) {
    //   return false;
    // }
    // const row_location = rowLocation(y);
    // const row = row_location[1];
    // const row_pre = row_location[0];
    // const row_index = row_location[2];
    // const col_index = ctx.visibledatacolumn.length - 1;
    // const col = ctx.visibledatacolumn[col_index];
    // const col_pre = 0;
    // const last = $.extend(
    //   true,
    //   {},
    //   ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1]
    // );
    // let top = 0;
    // let height = 0;
    // let rowseleted = [];
    // if (last.top > row_pre) {
    //   top = row_pre;
    //   height = last.top + last.height - row_pre;
    //   if (last.row[1] > last.row_focus) {
    //     last.row[1] = last.row_focus;
    //   }
    //   rowseleted = [row_index, last.row[1]];
    // } else if (last.top == row_pre) {
    //   top = row_pre;
    //   height = last.top + last.height - row_pre;
    //   rowseleted = [row_index, last.row[0]];
    // } else {
    //   top = last.top;
    //   height = row - last.top - 1;
    //   if (last.row[0] < last.row_focus) {
    //     last.row[0] = last.row_focus;
    //   }
    //   rowseleted = [last.row[0], row_index];
    // }
    // last.row = rowseleted;
    // last.top_move = top;
    // last.height_move = height;
    // ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1] = last;
    // selectHightlightShow();
    // clearTimeout(ctx.countfuncTimeout);
    // ctx.countfuncTimeout = setTimeout(function () {
    //   countfunc();
    // }, 500);
  } else if (ctx.luckysheet_cols_selected_status) {
    // const mouse = mouseposition(event.pageX, event.pageY);
    // const x = mouse[0] + $("#luckysheet-cols-h-c").scrollLeft();
    // if (x < 0) {
    //   return false;
    // }
    // const row_index = ctx.visibledatarow.length - 1;
    // const row = ctx.visibledatarow[row_index];
    // const row_pre = 0;
    // const col_location = colLocation(x);
    // const col = col_location[1];
    // const col_pre = col_location[0];
    // const col_index = col_location[2];
    // const last = $.extend(
    //   true,
    //   {},
    //   ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1]
    // );
    // let left = 0;
    // let width = 0;
    // let columnseleted = [];
    // if (last.left > col_pre) {
    //   left = col_pre;
    //   width = last.left + last.width - col_pre;
    //   if (last.column[1] > last.column_focus) {
    //     last.column[1] = last.column_focus;
    //   }
    //   columnseleted = [col_index, last.column[1]];
    // } else if (last.left == col_pre) {
    //   left = col_pre;
    //   width = last.left + last.width - col_pre;
    //   columnseleted = [col_index, last.column[0]];
    // } else {
    //   left = last.left;
    //   width = col - last.left - 1;
    //   if (last.column[0] < last.column_focus) {
    //     last.column[0] = last.column_focus;
    //   }
    //   columnseleted = [last.column[0], col_index];
    // }
    // last.column = columnseleted;
    // last.left_move = left;
    // last.width_move = width;
    // ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1] = last;
    // selectHightlightShow();
    // clearTimeout(ctx.countfuncTimeout);
    // ctx.countfuncTimeout = setTimeout(function () {
    //   countfunc();
    // }, 500);
  } else if (ctx.luckysheet_cell_selected_move) {
    /*
      const mouse = mouseposition(event.pageX, event.pageY);
  
      const scrollLeft = $("#luckysheet-cell-main").scrollLeft();
      const scrollTop = $("#luckysheet-cell-main").scrollTop();
  
      const x = mouse[0] + scrollLeft;
      const y = mouse[1] + scrollTop;
  
      const winH =
        $(window).height() +
        scrollTop -
        ctx.sheetBarHeight -
        ctx.statisticBarHeight;
      const winW = $(window).width() + scrollLeft;
  
      const row_location = rowLocation(y, ctx.visibledatarow);
      let row = row_location[1];
      let row_pre = row_location[0];
      const row_index = row_location[2];
      const col_location = colLocation(x, ctx.visibledatarow);
      let col = col_location[1];
      let col_pre = col_location[0];
      const col_index = col_location[2];
  
      const row_index_original = ctx.luckysheet_cell_selected_move_index[0];
      const col_index_original = ctx.luckysheet_cell_selected_move_index[1];
  
      let row_s =
        ctx.luckysheet_select_save[0].row[0] - row_index_original + row_index;
      let row_e =
        ctx.luckysheet_select_save[0].row[1] - row_index_original + row_index;
  
      let col_s =
        ctx.luckysheet_select_save[0].column[0] - col_index_original + col_index;
      let col_e =
        ctx.luckysheet_select_save[0].column[1] - col_index_original + col_index;
  
      if (row_s < 0 || y < 0) {
        row_s = 0;
        row_e =
          ctx.luckysheet_select_save[0].row[1] -
          ctx.luckysheet_select_save[0].row[0];
      }
  
      if (col_s < 0 || x < 0) {
        col_s = 0;
        col_e =
          ctx.luckysheet_select_save[0].column[1] -
          ctx.luckysheet_select_save[0].column[0];
      }
  
      if (
        row_e >= ctx.visibledatarow[ctx.visibledatarow.length - 1] ||
        y > winH
      ) {
        row_s =
          ctx.visibledatarow.length -
          1 -
          ctx.luckysheet_select_save[0].row[1] +
          ctx.luckysheet_select_save[0].row[0];
        row_e = ctx.visibledatarow.length - 1;
      }
  
      if (
        col_e >= ctx.visibledatacolumn[ctx.visibledatacolumn.length - 1] ||
        x > winW
      ) {
        col_s =
          ctx.visibledatacolumn.length -
          1 -
          ctx.luckysheet_select_save[0].column[1] +
          ctx.luckysheet_select_save[0].column[0];
        col_e = ctx.visibledatacolumn.length - 1;
      }
  
      col_pre = col_s - 1 == -1 ? 0 : ctx.visibledatacolumn[col_s - 1];
      col = ctx.visibledatacolumn[col_e];
      row_pre = row_s - 1 == -1 ? 0 : ctx.visibledatarow[row_s - 1];
      row = ctx.visibledatarow[row_e];
  
      $(".fortune-cell-selected-move").css({
        left: col_pre,
        width: col - col_pre - 2,
        top: row_pre,
        height: row - row_pre - 2,
        display: "block",
      });
      */
  } else if (ctx.luckysheet_cell_selected_extend) {
    onDropCellSelect(
      ctx,
      e,
      scrollX,
      scrollY,
      container,
      globalCache.freezen?.[ctx.currentSheetId]
    );
  } else if (ctx.luckysheet_cols_change_size) {
    const [startX, index] = ctx.luckysheet_cols_change_size_start;
    const edge = resizedEdge(
      ctx.visibledatacolumn,
      index,
      Math.round(e.clientX - startX),
      ctx.zoomRatio
    );
    const changeSizeLine = container.querySelector(".fortune-change-size-line");
    if (changeSizeLine) {
      (changeSizeLine as HTMLDivElement).style.left = `${edge - 1}px`;
    }
    const changeSizeCol = container.querySelector(".fortune-cols-change-size");
    if (changeSizeCol) {
      (changeSizeCol as HTMLDivElement).style.left = `${edge - 5}px`;
    }
  } else if (ctx.luckysheet_rows_change_size) {
    const [startY, index] = ctx.luckysheet_rows_change_size_start;
    const edge = resizedEdge(
      ctx.visibledatarow,
      index,
      Math.round(e.clientY - startY),
      ctx.zoomRatio
    );
    const changeSizeLine = container.querySelector(".fortune-change-size-line");
    if (changeSizeLine) {
      (changeSizeLine as HTMLDivElement).style.top = `${edge - 1}px`;
    }
    const changeSizeRow = container.querySelector(".fortune-rows-change-size");
    if (changeSizeRow) {
      (changeSizeRow as HTMLDivElement).style.top = `${edge - 2}px`;
    }
  } else if (ctx.luckysheet_cols_freeze_drag) {
    const x =
      e.pageX -
      rect.left -
      ctx.rowHeaderWidth +
      ctx.scrollLeft -
      window.scrollX;
    const [col_pre, col_curr] = colLocation(x, ctx.visibledatacolumn);

    const col = x > (col_pre + col_curr) / 2 ? col_curr : col_pre;

    if (x < rect.width + ctx.scrollLeft - 100) {
      const freezeLine = container.querySelector(".fortune-freeze-drag-line");
      if (freezeLine) {
        (freezeLine as HTMLDivElement).style.left = `${Math.max(0, col - 2)}px`;
      }
      const freezeHandle = container.querySelector(
        ".fortune-cols-freeze-handle"
      );
      if (freezeHandle) {
        (freezeHandle as HTMLDivElement).style.left = `${x}px`;
      }
      // reuse change-size-line
      const changeSizeLine = container.querySelector(
        ".fortune-change-size-line"
      );
      if (changeSizeLine) {
        (changeSizeLine as HTMLDivElement).style.left = `${x}px`;
      }
    }
  } else if (ctx.luckysheet_rows_freeze_drag) {
    const y =
      e.pageY -
      rect.top -
      ctx.columnHeaderHeight +
      ctx.scrollTop -
      window.scrollY;
    const [row_pre, row_curr] = rowLocation(y, ctx.visibledatarow);

    const row = y > (row_curr + row_pre) / 2 ? row_curr : row_pre;

    if (y < rect.height + ctx.scrollTop - 20) {
      const freezeLine = container.querySelector(".fortune-freeze-drag-line");
      if (freezeLine) {
        (freezeLine as HTMLDivElement).style.top = `${Math.max(0, row - 2)}px`;
      }
      const freezeHandle = container.querySelector(
        ".fortune-rows-freeze-handle"
      );
      if (freezeHandle) {
        (freezeHandle as HTMLDivElement).style.top = `${y}px`;
      }
      // reuse change-size-line
      const changeSizeLine = container.querySelector(
        ".fortune-change-size-line"
      );
      if (changeSizeLine) {
        (changeSizeLine as HTMLDivElement).style.top = `${y}px`;
      }
    }
  }

  // ctx.jfautoscrollTimeout = window.requestAnimationFrame(mouseRender);
}

export function handleOverlayMouseMove(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  cellInput: HTMLDivElement,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement,
  container: HTMLDivElement,
  fxInput?: HTMLDivElement | null
) {
  if (ctx.formulaCache.referenceDrag) {
    const [editor, copyTo] = activeEditors(cellInput, fxInput);
    dragReference(
      ctx,
      editor,
      copyTo,
      cellAtOverlayPoint(ctx, globalCache, e, container)
    );
    e.preventDefault();
    return;
  }
  if (onCommentBoxResize(ctx, globalCache, e)) return;
  if (onCommentBoxMove(ctx, globalCache, e)) return;
  if (onImageMove(ctx, globalCache, e)) return;
  if (onImageResize(ctx, globalCache, e)) return;
  onCellsMove(ctx, globalCache, e, scrollX, scrollY, container);
  overShowComment(ctx, e, scrollX, scrollY, container);
  onSearchDialogMove(globalCache, e);
  onRangeSelectionModalMove(globalCache, e);

  // window.cancelAnimationFrame(ctx.jfautoscrollTimeout);

  /* if (
    luckysheetConfigsetting &&
    luckysheetConfigsetting.hook &&
    luckysheetConfigsetting.hook.sheetMousemove
  ) {
    const mouse = mouseposition(event.pageX, event.pageY);
    const x = mouse[0] + $("#luckysheet-cell-main").scrollLeft();
    const y = mouse[1] + $("#luckysheet-cell-main").scrollTop();

    const row_location = rowLocation(y);
    let row = row_location[1];
    let row_pre = row_location[0];
    let row_index = row_location[2];
    const col_location = colLocation(x);
    let col = col_location[1];
    let col_pre = col_location[0];
    let col_index = col_location[2];

    const margeset = menuButton.mergeborer(
      ctx.flowdata,
      row_index,
      col_index
    );
    if (margeset) {
      row = margeset.row[1];
      row_pre = margeset.row[0];
      row_index = margeset.row[2];

      col = margeset.column[1];
      col_pre = margeset.column[0];
      col_index = margeset.column[2];
    }

    // if(ctx.flowdata[row_index] && ctx.flowdata[row_index][col_index]){
    const sheetFile = sheetmanage.getSheetByIndex();

    const moveState = {
      functionResizeStatus: formula.functionResizeStatus,
      horizontalmoveState: !!luckysheetFreezen.horizontalmovestate,
      verticalmoveState: !!luckysheetFreezen.verticalmovestate,
      pivotTableMoveState: !!pivotTable && pivotTable.movestate,
      sheetMoveStatus: ctx.luckysheet_sheet_move_status,
      scrollStatus: !!ctx.luckysheet_scroll_status,
      selectStatus: !!ctx.luckysheet_select_status,
      rowsSelectedStatus: !!ctx.luckysheet_rows_selected_status,
      colsSelectedStatus: !!ctx.luckysheet_cols_selected_status,
      cellSelectedMove: !!ctx.luckysheet_cell_selected_move,
      cellSelectedExtend: !!ctx.luckysheet_cell_selected_extend,
      colsChangeSize: !!ctx.luckysheet_cols_change_size,
      rowsChangeSize: !!ctx.luckysheet_rows_change_size,
      chartMove: !!ctx.chartparam.luckysheetCurrentChartMove,
      chartResize: !!ctx.chartparam.luckysheetCurrentChartResize,
      rangeResize: !!formula.rangeResize,
      rangeMove: !!formula.rangeMove,
    };

    const luckysheetTableContent = $("#luckysheetTableContent")
      .get(0)
      .getContext("2d");

    if (ctx.flowdata && ctx.flowdata[row_index]) {
      method.createHookFunction(
        "sheetMousemove",
        ctx.flowdata[row_index][col_index],
        {
          r: row_index,
          c: col_index,
          start_r: row_pre,
          start_c: col_pre,
          end_r: row,
          end_c: col,
        },
        sheetFile,
        moveState,
        luckysheetTableContent
      );
    }
    // }
  }

  if (formula.functionResizeStatus) {
    const y = event.pageY;
    const movepx = y - formula.functionResizeData.y;
    let mpx = formula.functionResizeData.calculatebarHeight + movepx;
    const winh = Math.round($(window).height() / 2);

    if (mpx <= 28) {
      if (mpx <= 20) {
        return;
      }
      mpx = 28;
    } else if (mpx >= winh) {
      if (mpx >= winh + 8) {
        return;
      }
      mpx = winh;
    }

    ctx.calculatebarHeight = mpx;
    $("#luckysheet-wa-calculate").css("height", ctx.calculatebarHeight - 2);
    $("#luckysheet-wa-calculate-size").css({
      background: "#5e5e5e",
      cursor: "ns-resize",
    });

    clearTimeout(formula.functionResizeTimeout);
    formula.functionResizeTimeout = setTimeout(function () {
      luckysheetsizeauto();
    }, 15);
  } else if (!!pivotTable && pivotTable.movestate) {
    const x = event.pageX;
    const y = event.pageY;
    $("#luckysheet-modal-dialog-slider-pivot-move").css({
      left: x - pivotTable.movesave.width / 2,
      top: y - pivotTable.movesave.height,
    });
  } else if (ctx.luckysheet_sheet_move_status) {
    const scrollLeft = $("#fortune-sheettab-container-c").scrollLeft();
    const x = event.pageX + scrollLeft;

    if (Math.abs(event.pageX - ctx.luckysheet_sheet_move_data.pageX) < 3) {
      return;
    }

    const winW = $("#fortune-sheettab-container").width();
    const left =
      x -
      ctx.luckysheet_sheet_move_data.curleft -
      $("#fortune-sheettab-container").offset().left;
    ctx.luckysheet_sheet_move_data.activeobject.css({ left });

    let row_index = luckysheet_searcharray(
      ctx.luckysheet_sheet_move_data.widthlist,
      left + ctx.luckysheet_sheet_move_data.curleft
    );
    ctx.luckysheet_sheet_move_data.cursorobject.css({ cursor: "move" });

    if (left - scrollLeft <= 6) {
      $("#luckysheet-sheets-leftscroll").click();
    }

    if (left - scrollLeft >= winW - 40) {
      $("#luckysheet-sheets-rightscroll").click();
    }

    if (row_index != ctx.luckysheet_sheet_move_data.curindex) {
      if (row_index == -1 && left > 0) {
        row_index = ctx.luckysheet_sheet_move_data.widthlist.length - 1;
        $("#luckysheet-sheets-item-clone").insertAfter(
          $("#luckysheet-sheet-area div.luckysheet-sheets-item:visible").eq(
            row_index
          )
        );
      } else if (row_index == -1 && left <= 0) {
        $("#luckysheet-sheets-item-clone").insertBefore(
          $("#luckysheet-sheet-area div.luckysheet-sheets-item:visible").eq(0)
        );
      } else {
        $("#luckysheet-sheets-item-clone").insertAfter(
          $("#luckysheet-sheet-area div.luckysheet-sheets-item:visible").eq(
            row_index
          )
        );
      }

      ctx.luckysheet_sheet_move_data.widthlist = [];
      $("#luckysheet-sheet-area div.luckysheet-sheets-item:visible").each(
        function (i) {
          if (i == 0) {
            ctx.luckysheet_sheet_move_data.widthlist.push(
              parseInt($(this).outerWidth())
            );
          } else {
            ctx.luckysheet_sheet_move_data.widthlist.push(
              parseInt($(this).outerWidth()) +
                ctx.luckysheet_sheet_move_data.widthlist[i - 1]
            );
          }
        }
      );

      ctx.luckysheet_sheet_move_data.curindex = $(
        "#luckysheet-sheet-area div.luckysheet-sheets-item:visible"
      ).index($("#luckysheet-sheets-item-clone"));
    }
  } else if (ctx.luckysheet_model_move_state) {
    const scrollTop = $(document).scrollTop();
    const scrollLeft = $(document).scrollLeft();
    const y = event.pageY + scrollTop;
    const x = event.pageX + scrollLeft;
    const winH = $(window).height();
    const winW = $(window).width();
    const myh = ctx.luckysheet_model_move_obj.height();
    const myw = ctx.luckysheet_model_move_obj.width();
    let top = y - ctx.luckysheet_model_xy[1];
    let left = x - ctx.luckysheet_model_xy[0];

    if (top < 0) {
      top = 0;
    }

    if (top + myh + 62 > winH) {
      top = winH - myh - 62;
    }

    if (left < 0) {
      left = 0;
    }

    if (left + myw + 86 > winW) {
      left = winW - myw - 86;
    }

    ctx.luckysheet_model_move_obj.css({ top, left });
    event.preventDefault();
  } else */ if (
    !!ctx.luckysheet_scroll_status ||
    !!ctx.luckysheet_select_status ||
    !!ctx.luckysheet_rows_selected_status ||
    !!ctx.luckysheet_cols_selected_status ||
    !!ctx.luckysheet_cell_selected_move ||
    !!ctx.luckysheet_cell_selected_extend ||
    !!ctx.luckysheet_cols_change_size ||
    !!ctx.luckysheet_rows_change_size
    // !!ctx.chartparam?.luckysheetCurrentChartMove ||
    // !!ctx.chartparam?.luckysheetCurrentChartResize ||
    // !!formula?.rangeResize ||
    // !!formula?.rangeMove
  ) {
    // if (ctx.luckysheet_select_status) {
    //   clearTimeout(ctx.countfuncTimeout);
    //   ctx.countfuncTimeout = setTimeout(function () {
    //     countfunc();
    //   }, 500);
    // }

    mouseRender(
      ctx,
      globalCache,
      e,
      cellInput,
      scrollX,
      scrollY,
      container,
      fxInput
    );
    // ctx.jfautoscrollTimeout = window.requestAnimationFrame(mouseRender);
  }
}

/** Whether a grid drag that Esc cancels is going on. */
export function isCancelableGridDrag(ctx: Context, globalCache?: GlobalCache) {
  return !!(
    globalCache?.image ||
    globalCache?.commentBox?.movingId ||
    globalCache?.commentBox?.resizingId ||
    ctx.luckysheet_cell_selected_move ||
    ctx.luckysheet_cell_selected_extend ||
    ctx.luckysheet_cols_change_size ||
    ctx.luckysheet_rows_change_size ||
    ctx.luckysheet_cols_freeze_drag ||
    ctx.luckysheet_rows_freeze_drag
  );
}

/**
 * Esc during a drag of the selection's border, the fill handle, a header
 * border, a freeze line or a picture: the drag ends and changes nothing (Excel). The
 * release that follows does nothing either. Returns whether a drag was
 * cancelled. `container` is the sheet overlay.
 */
export function cancelGridDrag(
  ctx: Context,
  globalCache: GlobalCache,
  container: HTMLElement
) {
  if (!isCancelableGridDrag(ctx, globalCache)) return false;
  cancelImageDrag(globalCache);
  cancelCommentBoxDrag(globalCache);
  cancelCellsMove(ctx, globalCache);
  if (ctx.luckysheet_cell_selected_extend) {
    ctx.luckysheet_cell_selected_extend = false;
    hideDropCellSelection(container as HTMLDivElement);
  }
  ctx.luckysheet_cols_change_size = false;
  ctx.luckysheet_rows_change_size = false;
  ctx.luckysheet_cols_freeze_drag = false;
  ctx.luckysheet_rows_freeze_drag = false;
  ctx.luckysheet_scroll_status = false;
  ctx.luckysheet_select_status = false;
  return true;
}

/** Where the border of `index` is (sheet px) while it is dragged by `delta`. */
function resizedEdge(
  edges: number[],
  index: number,
  delta: number,
  zoomRatio: number
) {
  const zoom = zoomRatio || 1;
  const start = index > 0 ? (edges[index - 1] ?? 0) : 0;
  if (delta === 0) return edges[index] ?? start;
  if (resizeHides(edges, index, delta)) return start;
  return (
    start + Math.round((resizedLength(edges, index, delta, zoom) + 1) * zoom)
  );
}

/**
 * Whether dragging the border of `index` by `delta` screen px puts it at
 * or before the row's / column's start: Excel hides the row / column.
 */
function resizeHides(edges: number[], index: number, delta: number) {
  const drawn = edges[index] - (index > 0 ? edges[index - 1] : 0);
  return drawn + delta <= 0;
}

/**
 * The row height / column width (unzoomed px, as in config.rowlen /
 * columnlen) after dragging the border of `index` by `delta` screen px.
 */
function resizedLength(
  edges: number[],
  index: number,
  delta: number,
  zoomRatio: number
) {
  const zoom = zoomRatio || 1;
  // drawn size: the length plus the grid line, zoomed
  const drawn = edges[index] - (index > 0 ? edges[index - 1] : 0);
  const size = Math.round((drawn + delta) / zoom) - 1;
  // not narrower than 10 screen px
  return Math.max(size, Math.ceil(10 / zoom) - 1, 0);
}

export function handleOverlayMouseUp(
  ctx: Context,
  globalCache: GlobalCache,
  settings: Settings,
  e: MouseEvent,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
  container: HTMLDivElement,
  cellInput: HTMLDivElement | null,
  fxInput: HTMLDivElement | null
) {
  const rect = container.getBoundingClientRect();
  endReferenceDrag(ctx);

  onImageMoveEnd(ctx, globalCache);
  onImageResizeEnd(ctx, globalCache);
  onCommentBoxMoveEnd(ctx, globalCache);
  onCommentBoxResizeEnd(ctx, globalCache);
  onFormulaRangeDragEnd(ctx);
  onSearchDialogMoveEnd(globalCache);
  onRangeSelectionModalMoveEnd(globalCache);
  onCellsMoveEnd(ctx, globalCache, e, scrollbarX, scrollbarY, container);
  if (
    ctx.formulaCache.rangestart ||
    ctx.formulaCache.rangedrag_column_start ||
    ctx.formulaCache.rangedrag_row_start
  ) {
    if (document.activeElement?.id === "luckysheet-functionbox-cell") {
      handleFormulaInput(ctx, cellInput!, fxInput!, 0, undefined, false);
    } else {
      handleFormulaInput(ctx, fxInput, cellInput!, 0, undefined, false);
    }
  }
  // if (
  //   luckysheetConfigsetting &&
  //   luckysheetConfigsetting.hook &&
  //   luckysheetConfigsetting.hook.sheetMouseup
  // ) {
  //   const mouse = mouseposition(event.pageX, event.pageY);
  //   const x = mouse[0] + $("#luckysheet-cell-main").scrollLeft();
  //   const y = mouse[1] + $("#luckysheet-cell-main").scrollTop();

  //   const row_location = rowLocation(y);
  //   let row = row_location[1];
  //   let row_pre = row_location[0];
  //   let row_index = row_location[2];
  //   const col_location = colLocation(x);
  //   let col = col_location[1];
  //   let col_pre = col_location[0];
  //   let col_index = col_location[2];

  //   const margeset = menuButton.mergeborer(
  //     ctx.flowdata,
  //     row_index,
  //     col_index
  //   );
  //   if (margeset) {
  //     row = margeset.row[1];
  //     row_pre = margeset.row[0];
  //     row_index = margeset.row[2];

  //     col = margeset.column[1];
  //     col_pre = margeset.column[0];
  //     col_index = margeset.column[2];
  //   }

  //   // if(ctx.flowdata[row_index] && ctx.flowdata[row_index][col_index]){
  //   const sheetFile = sheetmanage.getSheetByIndex();

  //   const moveState = {
  //     functionResizeStatus: formula.functionResizeStatus,
  //     horizontalmoveState: !!luckysheetFreezen.horizontalmovestate,
  //     verticalmoveState: !!luckysheetFreezen.verticalmovestate,
  //     pivotTableMoveState: !!pivotTable && pivotTable.movestate,
  //     sheetMoveStatus: ctx.luckysheet_sheet_move_status,
  //     scrollStatus: !!ctx.luckysheet_scroll_status,
  //     selectStatus: !!ctx.luckysheet_select_status,
  //     rowsSelectedStatus: !!ctx.luckysheet_rows_selected_status,
  //     colsSelectedStatus: !!ctx.luckysheet_cols_selected_status,
  //     cellSelectedMove: !!ctx.luckysheet_cell_selected_move,
  //     cellSelectedExtend: !!ctx.luckysheet_cell_selected_extend,
  //     colsChangeSize: !!ctx.luckysheet_cols_change_size,
  //     rowsChangeSize: !!ctx.luckysheet_rows_change_size,
  //     chartMove: !!ctx.chartparam.luckysheetCurrentChartMove,
  //     chartResize: !!ctx.chartparam.luckysheetCurrentChartResize,
  //     rangeResize: !!formula.rangeResize,
  //     rangeMove: !!formula.rangeMove,
  //   };

  //   const luckysheetTableContent = $("#luckysheetTableContent")
  //     .get(0)
  //     .getContext("2d");

  //   method.createHookFunction(
  //     "sheetMouseup",
  //     ctx.flowdata[row_index][col_index],
  //     {
  //       r: row_index,
  //       c: col_index,
  //       start_r: row_pre,
  //       start_c: col_pre,
  //       end_r: row,
  //       end_c: col,
  //     },
  //     sheetFile,
  //     moveState,
  //     luckysheetTableContent
  //   );
  //   // }
  // }

  if (ctx.luckysheet_select_status) {
    // clearTimeout(ctx.countfuncTimeout);
    // ctx.countfuncTimeout = setTimeout(function () {
    //   countfunc();
    // }, 0);

    if (ctx.luckysheetPaintModelOn) {
      pasteHandlerOfPaintModel(ctx, ctx.luckysheet_copy_save);
      if (ctx.luckysheetPaintSingle) {
        cancelPaintModel(ctx);
      }
    }
  }

  ctx.luckysheet_select_status = false;
  ctx.luckysheet_scroll_status = false;

  // $("#luckysheet-cell-selected")
  //   .find(".luckysheet-cs-fillhandle")
  //   .css("cursor", "crosshair")
  //   .end()
  //   .find(".luckysheet-cs-draghandle")
  //   .css("cursor", "move");
  // $(
  //   "#luckysheet-cell-main, #luckysheetTableContent, #luckysheet-sheettable_0"
  // ).css("cursor", "default");

  ctx.luckysheet_rows_selected_status = false;

  ctx.luckysheet_cols_selected_status = false;

  ctx.luckysheet_model_move_state = false;

  if (ctx.luckysheet_rows_change_size) {
    ctx.luckysheet_rows_change_size = false;
    const [startY, changeRowIndex] = ctx.luckysheet_rows_change_size_start;
    const dy = Math.round(e.clientY - startY);
    // a click on the border (or the first click of a double-click that
    // autofits) leaves the height alone
    if (dy !== 0 && ctx.visibledatarow[changeRowIndex] != null) {
      const size = resizedLength(
        ctx.visibledatarow,
        changeRowIndex,
        dy,
        ctx.zoomRatio
      );
      const cfg = ctx.config;
      cfg.rowlen ||= {};
      cfg.customHeight ||= {};
      // every selected whole row when the border belongs to one of them
      const rowSelections = (ctx.luckysheet_select_save ?? []).filter(
        (select) => select.row_select
      );
      const changeRowSelected = rowSelections.some(
        (select) =>
          changeRowIndex >= select.row[0] && changeRowIndex <= select.row[1]
      );
      const rows = changeRowSelected
        ? rowSelections.flatMap((select) =>
            _.range(select.row[0], select.row[1] + 1)
          )
        : [changeRowIndex];
      // dragged up to its top: hidden; a hidden row dragged open: shown
      const hide = resizeHides(ctx.visibledatarow, changeRowIndex, dy);
      cfg.rowhidden ||= {};
      rows.forEach((r) => {
        if (hide) {
          cfg.rowhidden![r] = 0;
          return;
        }
        cfg.rowlen![r] = size;
        cfg.customHeight![r] = 1;
        delete cfg.rowhidden![r];
      });
      ctx.config = cfg;
      const idx = getSheetIndex(ctx, ctx.currentSheetId);
      if (idx == null) return;
      ctx.luckysheetfile[idx].config = ctx.config;
    }
  }

  if (ctx.luckysheet_cols_change_size) {
    ctx.luckysheet_cols_change_size = false;
    const [startX, changeColumnIndex] = ctx.luckysheet_cols_change_size_start;
    const dx = Math.round(e.clientX - startX);
    if (dx !== 0 && ctx.visibledatacolumn[changeColumnIndex] != null) {
      const size = resizedLength(
        ctx.visibledatacolumn,
        changeColumnIndex,
        dx,
        ctx.zoomRatio
      );
      const cfg = ctx.config;
      cfg.columnlen ||= {};
      cfg.customWidth ||= {};
      const columnSelections = (ctx.luckysheet_select_save ?? []).filter(
        (select) => select.column_select
      );
      const changeColumnSelected = columnSelections.some(
        (select) =>
          changeColumnIndex >= select.column[0] &&
          changeColumnIndex <= select.column[1]
      );
      const columns = changeColumnSelected
        ? columnSelections.flatMap((select) =>
            _.range(select.column[0], select.column[1] + 1)
          )
        : [changeColumnIndex];
      // dragged left to its start: hidden; a hidden column dragged open:
      // shown (Excel)
      const hide = resizeHides(ctx.visibledatacolumn, changeColumnIndex, dx);
      cfg.colhidden ||= {};
      columns.forEach((c) => {
        if (hide) {
          cfg.colhidden![c] = 0;
          return;
        }
        cfg.columnlen![c] = size;
        cfg.customWidth![c] = 1;
        delete cfg.colhidden![c];
      });
      ctx.config = cfg;
      const idx = getSheetIndex(ctx, ctx.currentSheetId);
      if (idx == null) return;
      ctx.luckysheetfile[idx].config = ctx.config;
    }
  }

  if (ctx.luckysheet_cols_freeze_drag) {
    ctx.luckysheet_cols_freeze_drag = false;

    const { scrollLeft } = ctx;
    const x =
      e.pageX - rect.left - ctx.rowHeaderWidth + scrollLeft - window.scrollX;
    const [col_pre, col_curr, col_index_curr] = colLocation(
      x,
      ctx.visibledatacolumn
    );
    const col_index =
      x > (col_curr + col_pre) / 2 ? col_index_curr : col_index_curr - 1;
    const idx = getSheetIndex(ctx, ctx.currentSheetId);
    if (idx == null) return;
    if (col_index < 0) {
      const { frozen } = ctx.luckysheetfile[idx];
      if (frozen) {
        if (frozen.type === "rangeBoth" || frozen.type === "both") {
          frozen.type = "rangeRow";
        } else if (frozen.type === "column" || frozen.type === "rangeColumn") {
          delete ctx.luckysheetfile[idx].frozen;
        }
      }
      const freezeHandle = container.querySelector(
        ".fortune-cols-freeze-handle"
      ) as HTMLDivElement;
      if (freezeHandle) {
        freezeHandle.style.left = `${ctx.scrollLeft}px`;
      }
    } else if (!ctx.luckysheetfile[idx].frozen) {
      ctx.luckysheetfile[idx].frozen = {
        type: "rangeColumn",
        range: { column_focus: col_index, row_focus: 0 },
      };
    } else {
      const frozen = ctx.luckysheetfile[idx].frozen!;
      if (!frozen.range) {
        frozen.range = { column_focus: col_index, row_focus: 0 };
      } else {
        frozen.range.column_focus = col_index;
      }
      if (frozen?.type === "rangeRow" || frozen?.type === "row") {
        frozen.type = "rangeBoth";
      }
    }
    const freezeHandle = container.querySelector(
      ".fortune-cols-freeze-handle"
    ) as HTMLDivElement;
    if (freezeHandle) {
      freezeHandle.style.left = `${getFrozenHandleLeft(ctx)}px`;
    }
  }

  if (ctx.luckysheet_rows_freeze_drag) {
    ctx.luckysheet_rows_freeze_drag = false;

    const { scrollTop } = ctx;
    const y =
      e.pageY - rect.top - ctx.columnHeaderHeight + scrollTop - window.scrollY;
    const [row_pre, row_curr, row_index_curr] = rowLocation(
      y,
      ctx.visibledatarow
    );
    const row_index =
      y > (row_curr + row_pre) / 2 ? row_index_curr : row_index_curr - 1;
    const idx = getSheetIndex(ctx, ctx.currentSheetId);
    if (idx == null) return;
    if (row_index < 0) {
      const { frozen } = ctx.luckysheetfile[idx];
      if (frozen) {
        if (frozen.type === "rangeBoth" || frozen.type === "both") {
          frozen.type = "rangeColumn";
        } else if (frozen.type === "row" || frozen.type === "rangeRow") {
          delete ctx.luckysheetfile[idx].frozen;
        }
      }
    } else if (!ctx.luckysheetfile[idx].frozen) {
      ctx.luckysheetfile[idx].frozen = {
        type: "rangeRow",
        range: { column_focus: 0, row_focus: row_index },
      };
    } else {
      const frozen = ctx.luckysheetfile[idx].frozen!;
      if (!frozen.range) {
        frozen.range = { column_focus: 0, row_focus: row_index };
      } else {
        frozen.range.row_focus = row_index;
      }
      if (frozen?.type === "rangeColumn" || frozen?.type === "column") {
        frozen.type = "rangeBoth";
      }
    }
    const freezeHandle = container.querySelector(
      ".fortune-rows-freeze-handle"
    ) as HTMLDivElement;
    if (freezeHandle) {
      freezeHandle.style.top = `${getFrozenHandleTop(ctx)}px`;
    }
  }

  // if (formula.rangeMove) {
  //   formula.rangeMoveDragged(formula.rangeMoveObj);
  // }

  if (ctx.luckysheet_cell_selected_extend) {
    onDropCellSelectEnd(
      ctx,
      e,
      container,
      globalCache.freezen?.[ctx.currentSheetId]
    );
  }
}

export function handleRowHeaderMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLDivElement,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null
) {
  if (!checkProtectionAllSelected(ctx, ctx.currentSheetId)) {
    return;
  }

  removeEditingComment(ctx, globalCache);

  // if (
  //   $("#luckysheet-modal-dialog-activeImage").is(":visible") ||
  //   $("#luckysheet-modal-dialog-cropping").is(":visible")
  // ) {
  cancelActiveImgItem(ctx, globalCache);
  // }

  const rect = container.getBoundingClientRect();
  const mouseY = e.pageY - rect.top - window.scrollY;
  const _y = mouseY + ctx.scrollTop;

  const freeze = globalCache.freezen?.[ctx.currentSheetId];
  const { y } = fixPositionOnFrozenCells(freeze, 0, _y, 0, mouseY);

  const row_location = rowLocation(y, ctx.visibledatarow);
  const row = row_location[1];
  const row_pre = row_location[0];
  const row_index = row_location[2];
  const col_index = ctx.visibledatacolumn.length - 1;
  const col = ctx.visibledatacolumn[col_index];
  const col_pre = 0;

  // $("#luckysheet-rightclick-menu").hide();
  // $("#luckysheet-sheet-list, #luckysheet-rightclick-sheet-menu").hide();

  if (e.button === 2) {
    const flowdata = getFlowdata(ctx);
    const isInSelection = _.some(
      ctx.luckysheet_select_save,
      (obj_s) =>
        obj_s.row != null &&
        row_index >= obj_s.row[0] &&
        row_index <= obj_s.row[1] &&
        obj_s.column[0] === 0 &&
        obj_s.column[1] === (flowdata?.[0]?.length ?? 0) - 1
    );
    if (isInSelection) return;
  }

  const top = row_pre;
  const height = row - row_pre - 1;
  const rowseleted = [row_index, row_index];

  ctx.luckysheet_scroll_status = true;

  if (!_.isEmpty(ctx.luckysheetCellUpdate)) {
    // Point mode: clicking a row header puts `2:2` into the formula
    const [editor, copyTo] = activeEditors(cellInput, fxInput);
    if (
      pointCellWithMouse(ctx, editor, copyTo, [row_index, 0], {
        add: e.ctrlKey || e.metaKey,
        extend: e.shiftKey,
        kind: "row",
      })
    ) {
      e.preventDefault();
      return;
    }
    // Point mode across sheets: the cell is on another sheet
    if (ctx.formulaEditOrigin) {
      e.preventDefault();
      return;
    }
    finishFormulaEdit(ctx, cellInput);
    updateCell(
      ctx,
      ctx.luckysheetCellUpdate[0],
      ctx.luckysheetCellUpdate[1],
      cellInput
    );
    clearEditMode(ctx);
    ctx.luckysheet_rows_selected_status = true;
  } else {
    ctx.luckysheet_rows_selected_status = true;
  }

  if (ctx.luckysheet_rows_selected_status) {
    if (e.shiftKey) {
      const last = _.cloneDeep(
        ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1]
      );
      if (
        !last ||
        _.isNil(last.top) ||
        _.isNil(last.height) ||
        _.isNil(last.row_focus)
      ) {
        return;
      }

      let _top = 0;
      let _height = 0;
      let _rowseleted = [];
      if (last.top > row_pre) {
        _top = row_pre;
        _height = last.top + last.height - row_pre;

        if (last.row[1] > last.row_focus) {
          last.row[1] = last.row_focus;
        }

        _rowseleted = [row_index, last.row[1]];
      } else if (last.top === row_pre) {
        _top = row_pre;
        _height = last.top + last.height - row_pre;
        _rowseleted = [row_index, last.row[0]];
      } else {
        _top = last.top;
        _height = row - last.top - 1;

        if (last.row[0] < last.row_focus) {
          last.row[0] = last.row_focus;
        }

        _rowseleted = [last.row[0], row_index];
      }

      last.row = _rowseleted;

      last.top_move = _top;
      last.height_move = _height;

      ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1] =
        last;
    } else if (e.ctrlKey || e.metaKey) {
      ctx.luckysheet_select_save?.push({
        left: colLocationByIndex(0, ctx.visibledatacolumn)[0],
        width:
          colLocationByIndex(0, ctx.visibledatacolumn)[1] -
          colLocationByIndex(0, ctx.visibledatacolumn)[0] -
          1,
        top,
        height,
        left_move: col_pre,
        width_move: col - col_pre - 1,
        top_move: top,
        height_move: height,
        row: rowseleted,
        column: [0, col_index],
        row_focus: row_index,
        column_focus: 0,
        row_select: true,
      });
    } else {
      ctx.luckysheet_select_save = [];
      ctx.luckysheet_select_save.push({
        left: colLocationByIndex(0, ctx.visibledatacolumn)[0],
        width:
          colLocationByIndex(0, ctx.visibledatacolumn)[1] -
          colLocationByIndex(0, ctx.visibledatacolumn)[0] -
          1,
        top,
        height,
        left_move: col_pre,
        width_move: col - col_pre - 1,
        top_move: top,
        height_move: height,
        row: rowseleted,
        column: [0, col_index],
        row_focus: row_index,
        column_focus: 0,
        row_select: true,
      });

      ctx.luckysheet_select_status = true;
      ctx.luckysheet_scroll_status = true;
    }
    // selectHightlightShow();

    // server.saveParam("mv", ctx.currentSheetId, ctx.luckysheet_select_save);
  }
}

export function handleColumnHeaderMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLElement,
  cellInput: HTMLDivElement,
  fxInput: HTMLDivElement | null
) {
  if (!checkProtectionAllSelected(ctx, ctx.currentSheetId)) {
    return;
  }

  removeEditingComment(ctx, globalCache);

  // if (
  //   $("#luckysheet-modal-dialog-activeImage").is(":visible") ||
  //   $("#luckysheet-modal-dialog-cropping").is(":visible")
  // ) {
  cancelActiveImgItem(ctx, globalCache);
  // }

  const rect = container.getBoundingClientRect();
  const mouseX = e.pageX - rect.left - window.scrollX;
  const _x = mouseX + ctx.scrollLeft;
  const freeze = globalCache.freezen?.[ctx.currentSheetId];
  const { x } = fixPositionOnFrozenCells(freeze, _x, 0, mouseX, 0);

  const row_index = ctx.visibledatarow.length - 1;
  const row = ctx.visibledatarow[row_index];
  const row_pre = 0;
  const col_location = colLocation(x, ctx.visibledatacolumn);
  const col = col_location[1];
  const col_pre = col_location[0];
  const col_index = col_location[2];

  ctx.orderbyindex = col_index;

  // $("#luckysheet-rightclick-menu").hide();
  // $("#luckysheet-sheet-list, #luckysheet-rightclick-sheet-menu").hide();
  // $("#luckysheet-filter-menu, #luckysheet-filter-submenu").hide();

  if (e.button === 2) {
    const flowdata = getFlowdata(ctx);
    const isInSelection = _.some(
      ctx.luckysheet_select_save,
      (obj_s) =>
        obj_s.column != null &&
        col_index >= obj_s.column[0] &&
        col_index <= obj_s.column[1] &&
        obj_s.row[0] === 0 &&
        obj_s.row[1] === (flowdata?.length ?? 0) - 1
    );
    if (isInSelection) return;
  }

  const left = col_pre;
  const width = col - col_pre - 1;
  const columnseleted = [col_index, col_index];

  ctx.luckysheet_scroll_status = true;

  if (!_.isEmpty(ctx.luckysheetCellUpdate)) {
    // Point mode: clicking a column header puts `B:B` into the formula
    const [editor, copyTo] = activeEditors(cellInput, fxInput);
    if (
      pointCellWithMouse(ctx, editor, copyTo, [0, col_index], {
        add: e.ctrlKey || e.metaKey,
        extend: e.shiftKey,
        kind: "column",
      })
    ) {
      e.preventDefault();
      return;
    }
    // Point mode across sheets: the cell is on another sheet
    if (ctx.formulaEditOrigin) {
      e.preventDefault();
      return;
    }
    finishFormulaEdit(ctx, cellInput);
    updateCell(
      ctx,
      ctx.luckysheetCellUpdate[0],
      ctx.luckysheetCellUpdate[1],
      cellInput
    );
    clearEditMode(ctx);
    ctx.luckysheet_cols_selected_status = true;
  } else {
    ctx.luckysheet_cols_selected_status = true;
  }

  if (ctx.luckysheet_cols_selected_status) {
    if (e.shiftKey) {
      const last = _.cloneDeep(
        ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1]
      );

      let _left = 0;
      let _width = 0;
      let _columnseleted = [];

      if (
        !last ||
        _.isNil(last.left) ||
        _.isNil(last.width) ||
        _.isNil(last.column_focus)
      ) {
        return;
      }

      if (last.left > col_pre) {
        _left = col_pre;
        _width = last.left + last.width - col_pre;

        if (last.column[1] > last.column_focus) {
          last.column[1] = last.column_focus;
        }

        _columnseleted = [col_index, last.column[1]];
      } else if (last.left === col_pre) {
        _left = col_pre;
        _width = last.left + last.width - col_pre;
        _columnseleted = [col_index, last.column[0]];
      } else {
        _left = last.left;
        _width = col - last.left - 1;

        if (last.column[0] < last.column_focus) {
          last.column[0] = last.column_focus;
        }

        _columnseleted = [last.column[0], col_index];
      }

      last.column = _columnseleted;

      last.left_move = _left;
      last.width_move = _width;

      ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1] =
        last;
    } else if (e.ctrlKey || e.metaKey) {
      ctx.luckysheet_select_save?.push({
        left,
        width,
        top: rowLocationByIndex(0, ctx.visibledatarow)[0],
        height:
          rowLocationByIndex(0, ctx.visibledatarow)[1] -
          rowLocationByIndex(0, ctx.visibledatarow)[0] -
          1,
        left_move: left,
        width_move: width,
        top_move: row_pre,
        height_move: row - row_pre - 1,
        row: [0, row_index],
        column: columnseleted,
        row_focus: 0,
        column_focus: col_index,
        column_select: true,
      });
    } else {
      ctx.luckysheet_select_save = [];
      ctx.luckysheet_select_save.push({
        left,
        width,
        top: rowLocationByIndex(0, ctx.visibledatarow)[0],
        height:
          rowLocationByIndex(0, ctx.visibledatarow)[1] -
          rowLocationByIndex(0, ctx.visibledatarow)[0] -
          1,
        left_move: left,
        width_move: width,
        top_move: row_pre,
        height_move: row - row_pre - 1,
        row: [0, row_index],
        column: columnseleted,
        row_focus: 0,
        column_focus: col_index,
        column_select: true,
      });

      ctx.luckysheet_select_status = true;
      ctx.luckysheet_scroll_status = true;
    }

    // selectHightlightShow();

    // server.saveParam("mv", ctx.currentSheetId, ctx.luckysheet_select_save);
  }
}

/**
 * The column whose right border a header resize handle grabs: `index` when
 * the header knows it (the border under the pointer, either side), else the
 * border nearest the pointer.
 */
function resizeTarget(
  edges: number[],
  sheetPos: number,
  index: number | undefined
) {
  if (index != null && index >= 0 && index < edges.length) return index;
  const near = borderIndexAt(edges, sheetPos);
  if (near >= 0) return near;
  return Math.min(_.sortedIndex(edges, sheetPos), edges.length - 1);
}

export function handleColSizeHandleMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  headerContainer: HTMLDivElement,
  workbookContainer: HTMLDivElement,
  cellArea: HTMLDivElement,
  index?: number
) {
  removeEditingComment(ctx, globalCache);
  cancelActiveImgItem(ctx, globalCache);

  ctx.luckysheetCellUpdate = [];

  const { x } = getGridPoint(
    ctx,
    globalCache.freezen?.[ctx.currentSheetId],
    e,
    cellArea
  );
  const col_index = resizeTarget(ctx.visibledatacolumn, x, index);
  const col = ctx.visibledatacolumn[col_index];

  ctx.luckysheet_cols_change_size = true;
  ctx.luckysheet_scroll_status = true;
  const changeSizeLine = workbookContainer.querySelector(
    ".fortune-change-size-line"
  );
  if (changeSizeLine) {
    const ele = changeSizeLine as HTMLDivElement;
    ele.style.height = `${
      cellArea.getBoundingClientRect().height + ctx.scrollTop
    }px`;
    ele.style.borderWidth = "0 1px 0 0";
    ele.style.top = "0";
    ele.style.left = `${col - 1}px`;
    ele.style.width = "1px";
  }
  // where the drag started (px) and the column it resizes
  ctx.luckysheet_cols_change_size_start = [e.clientX, col_index];
  e.stopPropagation();
}

export function handleRowSizeHandleMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  headerContainer: HTMLDivElement,
  workbookContainer: HTMLDivElement,
  cellArea: HTMLDivElement,
  index?: number
) {
  removeEditingComment(ctx, globalCache);
  cancelActiveImgItem(ctx, globalCache);

  if (
    ctx.formulaCache.rangestart ||
    ctx.formulaCache.rangedrag_column_start ||
    ctx.formulaCache.rangedrag_row_start ||
    (ctx.luckysheetCellUpdate.length > 0 && israngeseleciton(ctx))
  )
    return;
  ctx.luckysheetCellUpdate = [];

  const { y } = getGridPoint(
    ctx,
    globalCache.freezen?.[ctx.currentSheetId],
    e,
    cellArea
  );
  const row_index = resizeTarget(ctx.visibledatarow, y, index);
  const row = ctx.visibledatarow[row_index];

  ctx.luckysheet_rows_change_size = true;
  ctx.luckysheet_scroll_status = true;
  const changeSizeLine = workbookContainer.querySelector(
    ".fortune-change-size-line"
  );
  if (changeSizeLine) {
    const ele = changeSizeLine as HTMLDivElement;
    ele.style.width = `${
      cellArea.getBoundingClientRect().width + ctx.scrollLeft
    }px`;
    ele.style.borderWidth = "0 0 1px 0";
    ele.style.top = `${row - 1}px`;
    ele.style.left = "0";
    ele.style.height = "1px";
  }
  // where the drag started (px) and the row it resizes
  ctx.luckysheet_rows_change_size_start = [e.clientY, row_index];
  e.stopPropagation();
}

export function handleColFreezeHandleMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  headerContainer: HTMLDivElement,
  workbookContainer: HTMLDivElement,
  cellArea: HTMLDivElement
) {
  removeEditingComment(ctx, globalCache);
  cancelActiveImgItem(ctx, globalCache);

  ctx.luckysheetCellUpdate = [];

  // let mouse = mouseposition(event.pageX, event.pageY);
  const { scrollLeft } = ctx;
  const { scrollTop } = ctx;

  const x = e.pageX - headerContainer.getBoundingClientRect().left + scrollLeft;

  const col_location = colLocation(x, ctx.visibledatacolumn);
  const col = col_location[1];

  ctx.luckysheet_cols_freeze_drag = true;
  ctx.luckysheet_scroll_status = true;
  const freezeDragLine = workbookContainer.querySelector(
    ".fortune-freeze-drag-line"
  );
  if (freezeDragLine) {
    const ele = freezeDragLine as HTMLDivElement;
    ele.style.height = `${
      cellArea.getBoundingClientRect().height + scrollTop
    }px`;
    ele.style.borderWidth = "0 3px 0 0";
    ele.style.top = "0";
    ele.style.left = `${col - 3}px`;
    ele.style.width = "1px";
  }
  // reuse change-size-line
  const changeSizeLine = workbookContainer.querySelector(
    ".fortune-change-size-line"
  );
  if (changeSizeLine) {
    const ele = changeSizeLine as HTMLDivElement;
    ele.style.height = `${
      cellArea.getBoundingClientRect().height + scrollTop
    }px`;
    ele.style.borderWidth = "0 1px 0 0";
    ele.style.top = "0";
    ele.style.left = `${col - 3}px`;
    ele.style.width = "1px";
  }
  e.stopPropagation();
}

export function handleRowFreezeHandleMouseDown(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  headerContainer: HTMLDivElement,
  workbookContainer: HTMLDivElement,
  cellArea: HTMLDivElement
) {
  removeEditingComment(ctx, globalCache);
  cancelActiveImgItem(ctx, globalCache);

  ctx.luckysheetCellUpdate = [];

  // let mouse = mouseposition(event.pageX, event.pageY);
  const { scrollLeft } = ctx;
  const { scrollTop } = ctx;

  const y = e.pageY - headerContainer.getBoundingClientRect().top + scrollTop;

  const row_location = rowLocation(y, ctx.visibledatarow);
  const row = row_location[1];

  ctx.luckysheet_rows_freeze_drag = true;
  ctx.luckysheet_scroll_status = true;
  const freezeDragLine = workbookContainer.querySelector(
    ".fortune-freeze-drag-line"
  );
  if (freezeDragLine) {
    const ele = freezeDragLine as HTMLDivElement;
    ele.style.width = `${
      cellArea.getBoundingClientRect().width + scrollLeft
    }px`;
    ele.style.borderWidth = "0 0 3px 0";
    ele.style.top = `${row - 3}px`;
    ele.style.left = "0";
    ele.style.height = "1px";
  }
  // reuse change-size-line
  const changeSizeLine = workbookContainer.querySelector(
    ".fortune-change-size-line"
  );
  if (changeSizeLine) {
    const ele = changeSizeLine as HTMLDivElement;
    ele.style.width = `${
      cellArea.getBoundingClientRect().width + scrollLeft
    }px`;
    ele.style.borderWidth = "0 0 1px 0";
    ele.style.top = `${row - 3}px`;
    ele.style.left = "0";
    ele.style.height = "1px";
  }
  e.stopPropagation();
}
