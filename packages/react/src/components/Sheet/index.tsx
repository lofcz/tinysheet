import React, { useRef, useEffect, useContext, useCallback } from "react";
import {
  Canvas,
  Context,
  GlobalCache,
  updateContextWithCanvas,
  updateContextWithSheetData,
  handleGlobalWheel,
  initFreeze,
  Sheet as SheetType,
} from "@lofcz/tinysheet-core";
import "./index.css";
import WorkbookContext from "../../context";
import SheetOverlay from "../SheetOverlay";

type Props = {
  sheet: SheetType;
};

type Freeze = NonNullable<GlobalCache["freezen"]>[string];

/**
 * Context fields that only drive DOM overlays (selection, editors, menus,
 * drag state, ...). A change limited to these fields leaves the canvas
 * untouched, so the sheet is not redrawn for it.
 */
const OVERLAY_ONLY_KEYS = new Set<string>([
  "commentBoxes",
  "editingCommentBox",
  "hoveredCommentBox",
  "editingInsertedImgs",
  "activeImg",
  "presences",
  "showSearch",
  "showReplace",
  "linkCard",
  "rangeDialog",
  "warnDialog",
  "dataVerificationDropDownList",
  "contextMenu",
  "sheetTabContextMenu",
  "filterContextMenu",
  "cellmainWidth",
  "cellmainHeight",
  "sheetScrollRecord",
  "luckysheet_select_status",
  "luckysheet_select_save",
  "luckysheet_selection_range",
  "formulaRangeHighlight",
  "formulaRangeSelect",
  "functionCandidates",
  "functionHint",
  "functionCandidateIndex",
  "functionHintArgIndex",
  "luckysheet_copy_save",
  "luckysheet_paste_iscut",
  "filterOptions",
  "filter",
  "luckysheet_sheet_move_status",
  "luckysheet_sheet_move_data",
  "luckysheet_scroll_status",
  "luckysheet_rows_selected_status",
  "luckysheet_cols_selected_status",
  "luckysheet_rows_change_size",
  "luckysheet_rows_change_size_start",
  "luckysheet_cols_change_size",
  "luckysheet_cols_change_size_start",
  "luckysheet_cols_freeze_drag",
  "luckysheet_rows_freeze_drag",
  "luckysheetCellUpdate",
  "luckysheet_shiftkeydown",
  "luckysheet_shiftpositon",
  "iscopyself",
  "luckysheet_model_move_state",
  "luckysheet_model_xy",
  "luckysheet_model_move_obj",
  "luckysheet_cell_selected_move",
  "luckysheet_cell_selected_move_index",
  "luckysheet_cell_selected_extend",
  "luckysheet_cell_selected_extend_index",
  "chart_selection",
  "luckysheetPaintModelOn",
  "luckysheetPaintSingle",
  "showSheetList",
  "sheetFocused",
]);

/** Whether anything the canvas renderer reads differs between two contexts. */
function canvasInputsChanged(prev: Context, next: Context) {
  if (prev === next) return false;
  const keys = Object.keys(next) as (keyof Context)[];
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (prev[k] !== next[k] && !OVERLAY_ONLY_KEYS.has(k)) return true;
  }
  return Object.keys(prev).length !== keys.length;
}

/** Whether the only canvas-relevant change is the scroll position. */
function onlyScrolled(prev: Context, next: Context) {
  if (prev.scrollLeft === next.scrollLeft && prev.scrollTop === next.scrollTop)
    return false;
  const keys = Object.keys(next) as (keyof Context)[];
  if (Object.keys(prev).length !== keys.length) return false;
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (
      prev[k] !== next[k] &&
      k !== "scrollLeft" &&
      k !== "scrollTop" &&
      !OVERLAY_ONLY_KEYS.has(k)
    )
      return false;
  }
  return true;
}

// Extra rows/columns (in px) drawn around an exposed strip, so borders and
// cells bleeding across its edge are repainted too (the strip is clipped).
const STRIP_MARGIN = 4;

/**
 * Scroll by moving the pixels already on the canvas and drawing only the
 * newly exposed strip. Applies to unfrozen sheets scrolled along one axis by
 * less than half the view, when every edge lands on a device pixel (so the
 * copy is exact). Returns false when a full redraw is needed instead.
 */
function blitScroll(
  canvasElement: HTMLCanvasElement,
  prev: Context,
  next: Context
) {
  const dx = next.scrollLeft - prev.scrollLeft;
  const dy = next.scrollTop - prev.scrollTop;
  if ((dx !== 0) === (dy !== 0)) return false;
  const dpr = next.devicePixelRatio;
  const [width, height] = next.luckysheetTableContentHW;
  // main cell area: drawMain paints from one pixel above/left of the headers
  const left = next.rowHeaderWidth - 1;
  const top = next.columnHeaderHeight - 1;
  const delta = dx || dy;
  const span = dx ? width - left : height - top;
  if (Math.abs(delta) * 2 > span) return false;
  if (
    ![left, top, width, height, delta].every((v) => Number.isInteger(v * dpr))
  ) {
    return false;
  }
  const ctx2d = canvasElement.getContext("2d");
  if (!ctx2d || typeof ctx2d.setTransform !== "function") return false;

  // 1. shift the existing cell area (device pixels, identity transform)
  let w = width - left;
  let h = height - top;
  let sx = left;
  let sy = top;
  let tx = left;
  let ty = top;
  if (dy) {
    h -= Math.abs(dy);
    if (dy > 0) sy += dy;
    else ty -= dy;
  } else {
    w -= Math.abs(dx);
    if (dx > 0) sx += dx;
    else tx -= dx;
  }
  ctx2d.save();
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.beginPath();
  ctx2d.rect(tx * dpr, ty * dpr, w * dpr, h * dpr);
  ctx2d.clip();
  ctx2d.globalCompositeOperation = "copy";
  ctx2d.drawImage(
    canvasElement,
    sx * dpr,
    sy * dpr,
    w * dpr,
    h * dpr,
    tx * dpr,
    ty * dpr,
    w * dpr,
    h * dpr
  );
  ctx2d.restore();

  // 2. draw the exposed strip, clipped to it
  let stripX = left;
  let stripY = top;
  let stripW = width - left;
  let stripH = height - top;
  if (dy) {
    stripH = Math.abs(dy);
    if (dy > 0) stripY = height - dy;
  } else {
    stripW = Math.abs(dx);
    if (dx > 0) stripX = width - dx;
  }
  const tableCanvas = new Canvas(canvasElement, next);
  ctx2d.save();
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.beginPath();
  ctx2d.rect(stripX * dpr, stripY * dpr, stripW * dpr, stripH * dpr);
  ctx2d.clip();
  // Shifting scroll offset and draw offset by the same k keeps every cell
  // at the canvas position a full draw would give it.
  if (dy) {
    const k = stripY - STRIP_MARGIN - next.columnHeaderHeight;
    tableCanvas.drawMain({
      scrollWidth: next.scrollLeft,
      scrollHeight: next.scrollTop + k,
      drawHeight: stripH + 2 * STRIP_MARGIN,
      offsetTop: next.columnHeaderHeight + k,
      clear: true,
    });
  } else {
    const k = stripX - STRIP_MARGIN - next.rowHeaderWidth;
    tableCanvas.drawMain({
      scrollWidth: next.scrollLeft + k,
      scrollHeight: next.scrollTop,
      drawWidth: stripW + 2 * STRIP_MARGIN,
      offsetLeft: next.rowHeaderWidth + k,
      clear: true,
    });
  }
  ctx2d.restore();

  // 3. headers are cheap: redraw the one that moved
  if (dy) tableCanvas.drawRowHeader(next.scrollTop);
  else tableCanvas.drawColumnHeader(next.scrollLeft);
  return true;
}

function drawSheet(
  canvasElement: HTMLCanvasElement,
  context: Context,
  freeze: Freeze | undefined
) {
  const tableCanvas = new Canvas(canvasElement, context);
  if (
    freeze?.horizontal?.freezenhorizontaldata ||
    freeze?.vertical?.freezenverticaldata
  ) {
    // with frozen
    const horizontalData = freeze?.horizontal?.freezenhorizontaldata;
    const verticallData = freeze?.vertical?.freezenverticaldata;
    if (horizontalData && verticallData) {
      const [horizontalPx, , horizontalScrollTop] = horizontalData;
      const [verticalPx, , verticalScrollWidth] = verticallData;
      // main
      tableCanvas.drawMain({
        scrollWidth: context.scrollLeft + verticalPx - verticalScrollWidth,
        scrollHeight: context.scrollTop + horizontalPx - horizontalScrollTop,
        offsetLeft: verticalPx - verticalScrollWidth + context.rowHeaderWidth,
        offsetTop:
          horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
        clear: true,
      });
      // right top
      tableCanvas.drawMain({
        scrollWidth: context.scrollLeft + verticalPx - verticalScrollWidth,
        scrollHeight: horizontalScrollTop,
        drawHeight: horizontalPx - horizontalScrollTop,
        offsetLeft: verticalPx - verticalScrollWidth + context.rowHeaderWidth,
      });
      // left down
      tableCanvas.drawMain({
        scrollWidth: verticalScrollWidth,
        scrollHeight: context.scrollTop + horizontalPx - horizontalScrollTop,
        drawWidth: verticalPx - verticalScrollWidth,
        offsetTop:
          horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
      });
      // left top
      tableCanvas.drawMain({
        scrollWidth: verticalScrollWidth,
        scrollHeight: horizontalScrollTop,
        drawWidth: verticalPx - verticalScrollWidth,
        drawHeight: horizontalPx - horizontalScrollTop,
      });
      // headers
      tableCanvas.drawColumnHeader(
        context.scrollLeft + verticalPx - verticalScrollWidth,
        undefined,
        verticalPx - verticalScrollWidth + context.rowHeaderWidth
      );
      tableCanvas.drawColumnHeader(
        verticalScrollWidth,
        verticalPx - verticalScrollWidth
      );
      tableCanvas.drawRowHeader(
        context.scrollTop + horizontalPx - horizontalScrollTop,
        undefined,
        horizontalPx - horizontalScrollTop + context.columnHeaderHeight
      );
      tableCanvas.drawRowHeader(
        horizontalScrollTop,
        horizontalPx - horizontalScrollTop
      );
      tableCanvas.drawFreezeLine({
        horizontalTop:
          horizontalPx - horizontalScrollTop + context.columnHeaderHeight - 2,
        verticalLeft:
          verticalPx - verticalScrollWidth + context.rowHeaderWidth - 2,
      });
    } else if (horizontalData) {
      const [horizontalPx, , horizontalScrollTop] = horizontalData;
      // main
      tableCanvas.drawMain({
        scrollWidth: context.scrollLeft,
        scrollHeight: context.scrollTop + horizontalPx - horizontalScrollTop,
        offsetTop:
          horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
        clear: true,
      });
      // top
      tableCanvas.drawMain({
        scrollWidth: context.scrollLeft,
        scrollHeight: horizontalScrollTop,
        drawHeight: horizontalPx - horizontalScrollTop,
      });
      // headers
      tableCanvas.drawColumnHeader(context.scrollLeft);
      tableCanvas.drawRowHeader(
        context.scrollTop + horizontalPx - horizontalScrollTop,
        undefined,
        horizontalPx - horizontalScrollTop + context.columnHeaderHeight
      );
      tableCanvas.drawRowHeader(
        horizontalScrollTop,
        horizontalPx - horizontalScrollTop
      );
      tableCanvas.drawFreezeLine({
        horizontalTop:
          horizontalPx - horizontalScrollTop + context.columnHeaderHeight - 2,
      });
    } else if (verticallData) {
      const [verticalPx, , verticalScrollWidth] = verticallData;
      // main
      tableCanvas.drawMain({
        scrollWidth: context.scrollLeft + verticalPx - verticalScrollWidth,
        scrollHeight: context.scrollTop,
        offsetLeft: verticalPx - verticalScrollWidth + context.rowHeaderWidth,
      });
      // left
      tableCanvas.drawMain({
        scrollWidth: verticalScrollWidth,
        scrollHeight: context.scrollTop,
        drawWidth: verticalPx - verticalScrollWidth,
      });
      // headers
      tableCanvas.drawRowHeader(context.scrollTop);
      tableCanvas.drawColumnHeader(
        context.scrollLeft + verticalPx - verticalScrollWidth,
        undefined,
        verticalPx - verticalScrollWidth + context.rowHeaderWidth
      );
      tableCanvas.drawColumnHeader(
        verticalScrollWidth,
        verticalPx - verticalScrollWidth
      );
      tableCanvas.drawFreezeLine({
        verticalLeft:
          verticalPx - verticalScrollWidth + context.rowHeaderWidth - 2,
      });
    }
  } else {
    // without frozen
    tableCanvas.drawMain({
      scrollWidth: context.scrollLeft,
      scrollHeight: context.scrollTop,
      clear: true,
    });
    tableCanvas.drawColumnHeader(context.scrollLeft);
    tableCanvas.drawRowHeader(context.scrollTop);
  }
}

const requestFrame: (cb: () => void) => number =
  typeof window !== "undefined" && window.requestAnimationFrame
    ? (cb) => window.requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16) as unknown as number;
const cancelFrame: (id: number) => void =
  typeof window !== "undefined" && window.cancelAnimationFrame
    ? (id) => window.cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

const Sheet: React.FC<Props> = ({ sheet }) => {
  const { data } = sheet;
  // const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const { context, setContext, refs, settings } = useContext(WorkbookContext);

  /**
   * Update data on window resize
   */
  useEffect(() => {
    function resize() {
      if (!data) return;
      setContext((draftCtx) => {
        if (settings.devicePixelRatio === 0) {
          draftCtx.devicePixelRatio = (
            typeof globalThis !== "undefined" ? globalThis : window
          ).devicePixelRatio;
        }
        updateContextWithSheetData(draftCtx, data);
        updateContextWithCanvas(
          draftCtx,
          refs.canvas.current!,
          placeholderRef.current!
        );
      });
    }
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, [data, refs.canvas, setContext, settings.devicePixelRatio]);

  /**
   * Recalculate row/col info when the sheet's dimensions or row/column
   * sizes change. Cell edits replace `data` without changing its shape, and
   * must not rebuild visibledatarow/visibledatacolumn (and with them the
   * freeze cache and every consumer of those arrays).
   */
  const dataRef = useRef(data);
  dataRef.current = data;
  const rowCount = data?.length ?? 0;
  const colCount = data?.[0]?.length ?? 0;
  useEffect(() => {
    const currentData = dataRef.current;
    if (!currentData) return;
    setContext((draftCtx) => updateContextWithSheetData(draftCtx, currentData));
  }, [
    context.config?.rowlen,
    context.config?.columnlen,
    context.config?.rowhidden,
    context.config.colhidden,
    rowCount,
    colCount,
    sheet.id,
    context.zoomRatio,
    context.defaultrowlen,
    context.defaultcollen,
    setContext,
  ]);

  /**
   * Init canvas
   */
  useEffect(() => {
    setContext((draftCtx) =>
      updateContextWithCanvas(
        draftCtx,
        refs.canvas.current!,
        placeholderRef.current!
      )
    );
  }, [
    refs.canvas,
    setContext,
    context.rowHeaderWidth,
    context.columnHeaderHeight,
    context.devicePixelRatio,
  ]);

  /**
   * Recalculate freeze data when sheet changes or sheet.frozen changes
   * should be defined before redraw
   */
  useEffect(() => {
    initFreeze(context, refs.globalCache, context.currentSheetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    refs.globalCache,
    sheet.frozen,
    context.currentSheetId,
    context.visibledatacolumn,
    context.visibledatarow,
  ]);

  // What was last drawn, so overlay-only context changes (selection, hover,
  // editing state, ...) skip the redraw entirely.
  const lastDrawn = useRef<{
    context: Context;
    freeze: Freeze | undefined;
    sheetId?: string;
  } | null>(null);
  // What is actually on the canvas (lastDrawn is updated when a draw is
  // scheduled); lets a pure scroll reuse the pixels.
  const lastPainted = useRef<{
    context: Context;
    freeze: Freeze | undefined;
    sheetId?: string;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
  } | null>(null);
  // Draws are coalesced into one per animation frame; this holds the latest.
  const pendingDraw = useRef<(() => void) | null>(null);
  const frameId = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameId.current != null) cancelFrame(frameId.current);
      frameId.current = null;
      pendingDraw.current = null;
    },
    []
  );

  /**
   * Redraw canvas when a context change affects it
   */
  useEffect(() => {
    // update formula chains value first if not empty
    if (context.groupValuesRefreshData.length > 0) {
      // wait for it to be refreshed
      return;
    }

    const freeze = refs.globalCache.freezen?.[sheet.id!];
    const last = lastDrawn.current;
    if (
      last &&
      last.freeze === freeze &&
      last.sheetId === sheet.id &&
      !canvasInputsChanged(last.context, context)
    ) {
      return;
    }
    lastDrawn.current = { context, freeze, sheetId: sheet.id };

    const canvasElement = refs.canvas.current;
    if (!canvasElement) return;
    pendingDraw.current = () => {
      const painted = lastPainted.current;
      const canBlit =
        painted != null &&
        painted.canvas === canvasElement &&
        painted.width === canvasElement.width &&
        painted.height === canvasElement.height &&
        painted.sheetId === sheet.id &&
        !freeze &&
        !painted.freeze &&
        onlyScrolled(painted.context, context);
      if (!canBlit || !blitScroll(canvasElement, painted!.context, context)) {
        drawSheet(canvasElement, context, freeze);
      }
      lastPainted.current = {
        context,
        freeze,
        sheetId: sheet.id,
        canvas: canvasElement,
        width: canvasElement.width,
        height: canvasElement.height,
      };
    };
    if (frameId.current == null) {
      frameId.current = requestFrame(() => {
        frameId.current = null;
        const draw = pendingDraw.current;
        pendingDraw.current = null;
        draw?.();
      });
    }
  }, [context, refs.canvas, refs.globalCache.freezen, sheet.id]);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      setContext((draftCtx) => {
        handleGlobalWheel(
          draftCtx,
          e,
          refs.globalCache,
          refs.scrollbarX.current!,
          refs.scrollbarY.current!
        );
      });
      e.preventDefault();
    },
    [refs.globalCache, refs.scrollbarX, refs.scrollbarY, setContext]
  );

  /**
   * Bind wheel event.
   * Note: cannot use onWheel directly on the container because it behaves strange
   */
  useEffect(() => {
    const container = containerRef.current;
    container?.addEventListener("wheel", onWheel);
    return () => {
      container?.removeEventListener("wheel", onWheel);
    };
  }, [onWheel]);

  return (
    <div ref={containerRef} className="fortune-sheet-container">
      {/* this is a placeholder div to help measure the empty space between toolbar and footer, directly measuring the canvas element is inaccurate, don't know why */}
      <div ref={placeholderRef} className="fortune-sheet-canvas-placeholder" />
      <canvas
        className="fortune-sheet-canvas"
        ref={refs.canvas}
        aria-hidden="true"
      />
      <SheetOverlay />
    </div>
  );
};

export default Sheet;
