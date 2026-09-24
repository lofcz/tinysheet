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
        drawHeight: horizontalPx,
        offsetLeft: verticalPx - verticalScrollWidth + context.rowHeaderWidth,
      });
      // left down
      tableCanvas.drawMain({
        scrollWidth: verticalScrollWidth,
        scrollHeight: context.scrollTop + horizontalPx - horizontalScrollTop,
        drawWidth: verticalPx,
        offsetTop:
          horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
      });
      // left top
      tableCanvas.drawMain({
        scrollWidth: verticalScrollWidth,
        scrollHeight: horizontalScrollTop,
        drawWidth: verticalPx,
        drawHeight: horizontalPx,
      });
      // headers
      tableCanvas.drawColumnHeader(
        context.scrollLeft + verticalPx - verticalScrollWidth,
        undefined,
        verticalPx - verticalScrollWidth + context.rowHeaderWidth
      );
      tableCanvas.drawColumnHeader(verticalScrollWidth, verticalPx);
      tableCanvas.drawRowHeader(
        context.scrollTop + horizontalPx - horizontalScrollTop,
        undefined,
        horizontalPx - horizontalScrollTop + context.columnHeaderHeight
      );
      tableCanvas.drawRowHeader(horizontalScrollTop, horizontalPx);
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
        drawHeight: horizontalPx,
      });
      // headers
      tableCanvas.drawColumnHeader(context.scrollLeft);
      tableCanvas.drawRowHeader(
        context.scrollTop + horizontalPx - horizontalScrollTop,
        undefined,
        horizontalPx - horizontalScrollTop + context.columnHeaderHeight
      );
      tableCanvas.drawRowHeader(horizontalScrollTop, horizontalPx);
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
        drawWidth: verticalPx,
      });
      // headers
      tableCanvas.drawRowHeader(context.scrollTop);
      tableCanvas.drawColumnHeader(
        context.scrollLeft + verticalPx - verticalScrollWidth,
        undefined,
        verticalPx - verticalScrollWidth + context.rowHeaderWidth
      );
      tableCanvas.drawColumnHeader(verticalScrollWidth, verticalPx);
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
   * Recalculate row/col info when data changes
   */
  useEffect(() => {
    if (!data) return;
    setContext((draftCtx) => updateContextWithSheetData(draftCtx, data));
  }, [
    context.config?.rowlen,
    context.config?.columnlen,
    context.config?.rowhidden,
    context.config.colhidden,
    data,
    context.zoomRatio,
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
    pendingDraw.current = () => drawSheet(canvasElement, context, freeze);
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
