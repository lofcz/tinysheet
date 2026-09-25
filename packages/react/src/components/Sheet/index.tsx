import React, { useRef, useEffect, useContext, useCallback } from "react";
import {
  Canvas,
  Context,
  GlobalCache,
  updateContextWithCanvas,
  updateContextWithSheetData,
  handleGlobalWheel,
  initFreeze,
  getSheetIndex,
  Sheet as SheetType,
} from "@lofcz/tinysheet-core";
import "./index.css";
import WorkbookContext from "../../context";
import SheetOverlay from "../SheetOverlay";
import { TrackedScope } from "../../context/store";

// The overlay re-renders for the context fields it reads, not with the Sheet
// (which sees every context change to schedule canvas redraws).
const SHEET_OVERLAY = <SheetOverlay />;

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
  // phase 2 dialogs, panels and edit state (DOM only)
  "activeChart",
  "chartEditorOpen",
  "showPasteSpecial",
  "formatCellsDialog",
  "dataVerificationAlert",
  "dataVerificationSidebar",
  "editState",
  "endMode",
  "tabReturn",
  "groupedSheetIds",
  "showGoTo",
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

// Leading px of a scrolling band that are redrawn instead of copied.
const BAND_EDGE = 4;

/**
 * One step of a sheet redraw, in canvas (CSS px) coordinates. A frozen sheet
 * is drawn as up to four cell panes, the header parts and the freeze lines;
 * later steps paint over what earlier ones spilled across pane edges.
 */
type DrawPass =
  | {
      kind: "cells";
      scrollWidth: number;
      scrollHeight: number;
      drawWidth: number;
      drawHeight: number;
      offsetLeft: number;
      offsetTop: number;
      clear?: boolean;
    }
  | {
      kind: "colHeader";
      scrollWidth: number;
      drawWidth: number;
      offsetLeft: number;
    }
  | {
      kind: "rowHeader";
      scrollHeight: number;
      drawHeight: number;
      offsetTop: number;
    }
  | { kind: "freezeLine"; horizontalTop?: number; verticalLeft?: number };

/** The passes of a full redraw, in drawing order. */
function sheetPasses(context: Context, freeze: Freeze | undefined): DrawPass[] {
  const [W, H] = context.luckysheetTableContentHW;
  const { rowHeaderWidth: rhw, columnHeaderHeight: chh } = context;
  const horizontalData = freeze?.horizontal?.freezenhorizontaldata;
  const verticalData = freeze?.vertical?.freezenverticaldata;
  // frozen (or split-pane) rows: bottom edge, and the pane's own scroll
  const [hPx, , hScroll] = horizontalData ?? [0, 0, 0];
  const [vPx, , vScroll] = verticalData ?? [0, 0, 0];
  const mainLeft = verticalData ? vPx - vScroll + rhw : rhw;
  const mainTop = horizontalData ? hPx - hScroll + chh : chh;
  const mainScrollX = context.scrollLeft + (verticalData ? vPx - vScroll : 0);
  const mainScrollY = context.scrollTop + (horizontalData ? hPx - hScroll : 0);
  const passes: DrawPass[] = [
    {
      kind: "cells",
      scrollWidth: mainScrollX,
      scrollHeight: mainScrollY,
      drawWidth: W,
      drawHeight: H,
      offsetLeft: mainLeft,
      offsetTop: mainTop,
      clear: true,
    },
  ];
  if (horizontalData) {
    // frozen rows, scrolling horizontally with the main pane
    passes.push({
      kind: "cells",
      scrollWidth: mainScrollX,
      scrollHeight: hScroll,
      drawWidth: W,
      drawHeight: hPx - hScroll,
      offsetLeft: mainLeft,
      offsetTop: chh,
    });
  }
  if (verticalData) {
    // frozen columns, scrolling vertically with the main pane
    passes.push({
      kind: "cells",
      scrollWidth: vScroll,
      scrollHeight: mainScrollY,
      drawWidth: vPx - vScroll,
      drawHeight: H,
      offsetLeft: rhw,
      offsetTop: mainTop,
    });
  }
  if (horizontalData && verticalData) {
    passes.push({
      kind: "cells",
      scrollWidth: vScroll,
      scrollHeight: hScroll,
      drawWidth: vPx - vScroll,
      drawHeight: hPx - hScroll,
      offsetLeft: rhw,
      offsetTop: chh,
    });
  }
  // headers: the scrolling part, then the frozen part
  passes.push({
    kind: "colHeader",
    scrollWidth: mainScrollX,
    drawWidth: W,
    offsetLeft: mainLeft,
  });
  if (verticalData) {
    passes.push({
      kind: "colHeader",
      scrollWidth: vScroll,
      drawWidth: vPx - vScroll,
      offsetLeft: rhw,
    });
  }
  passes.push({
    kind: "rowHeader",
    scrollHeight: mainScrollY,
    drawHeight: H,
    offsetTop: mainTop,
  });
  if (horizontalData) {
    passes.push({
      kind: "rowHeader",
      scrollHeight: hScroll,
      drawHeight: hPx - hScroll,
      offsetTop: chh,
    });
  }
  if (horizontalData || verticalData) {
    passes.push({
      kind: "freezeLine",
      horizontalTop: horizontalData ? mainTop - 2 : undefined,
      verticalLeft: verticalData ? mainLeft - 2 : undefined,
    });
  }
  return passes;
}

/**
 * Narrow one axis of a pass to [lo, hi) (canvas px, margin included):
 * shifting the scroll offset and the draw offset by the same k keeps every
 * cell where a full pass puts it. Returns null when nothing is left.
 */
function narrow(
  scroll: number,
  offset: number,
  size: number,
  lo: number,
  hi: number
) {
  const start = Math.max(offset, lo);
  const end = Math.min(offset + size, hi);
  if (end <= start) return null;
  const k = start - offset;
  return { scroll: scroll + k, offset: offset + k, size: end - start };
}

type Strip = { axis: "x" | "y"; start: number; size: number };

function runPass(canvas: Canvas, pass: DrawPass, strip?: Strip) {
  // narrowed to the strip (plus margin) along its axis only
  const lo = strip ? strip.start - STRIP_MARGIN : -Infinity;
  const hi = strip ? strip.start + strip.size + STRIP_MARGIN : Infinity;
  const onX = strip?.axis === "x";
  const onY = strip?.axis === "y";
  if (pass.kind === "cells") {
    const nx = onX
      ? narrow(pass.scrollWidth, pass.offsetLeft, pass.drawWidth, lo, hi)
      : {
          scroll: pass.scrollWidth,
          offset: pass.offsetLeft,
          size: pass.drawWidth,
        };
    const ny = onY
      ? narrow(pass.scrollHeight, pass.offsetTop, pass.drawHeight, lo, hi)
      : {
          scroll: pass.scrollHeight,
          offset: pass.offsetTop,
          size: pass.drawHeight,
        };
    if (!nx || !ny) return;
    canvas.drawMain({
      scrollWidth: nx.scroll,
      scrollHeight: ny.scroll,
      drawWidth: nx.size,
      drawHeight: ny.size,
      offsetLeft: nx.offset,
      offsetTop: ny.offset,
      clear: pass.clear,
    });
  } else if (pass.kind === "colHeader") {
    if (onY && lo > canvas.sheetCtx.columnHeaderHeight) return;
    const nx = onX
      ? narrow(pass.scrollWidth, pass.offsetLeft, pass.drawWidth, lo, hi)
      : {
          scroll: pass.scrollWidth,
          offset: pass.offsetLeft,
          size: pass.drawWidth,
        };
    if (!nx) return;
    canvas.drawColumnHeader(nx.scroll, nx.size, nx.offset);
  } else if (pass.kind === "rowHeader") {
    if (onX && lo > canvas.sheetCtx.rowHeaderWidth) return;
    const ny = onY
      ? narrow(pass.scrollHeight, pass.offsetTop, pass.drawHeight, lo, hi)
      : {
          scroll: pass.scrollHeight,
          offset: pass.offsetTop,
          size: pass.drawHeight,
        };
    if (!ny) return;
    canvas.drawRowHeader(ny.scroll, ny.size, ny.offset);
  } else {
    canvas.drawFreezeLine(pass);
  }
}

/**
 * Draw the sheet, or only a strip of it: clipped to the strip, with each
 * pass narrowed to the rows (or columns) that reach it, so the pixels in the
 * strip are exactly those of a full redraw.
 */
function drawSheet(
  canvasElement: HTMLCanvasElement,
  context: Context,
  freeze: Freeze | undefined,
  strip?: Strip
) {
  const tableCanvas = new Canvas(canvasElement, context);
  const passes = sheetPasses(context, freeze);
  if (!strip) {
    passes.forEach((pass) => runPass(tableCanvas, pass));
    return;
  }
  const ctx2d = canvasElement.getContext("2d");
  if (!ctx2d) return;
  const dpr = context.devicePixelRatio;
  const [width, height] = context.luckysheetTableContentHW;
  ctx2d.save();
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.beginPath();
  if (strip.axis === "y") {
    ctx2d.rect(0, strip.start * dpr, width * dpr, strip.size * dpr);
  } else {
    ctx2d.rect(strip.start * dpr, 0, strip.size * dpr, height * dpr);
  }
  ctx2d.clip();
  passes.forEach((pass) => runPass(tableCanvas, pass, strip));
  ctx2d.restore();
}

/**
 * Whether a merged cell spans the frozen/scrolling boundary on `axis`: the
 * frozen pane then paints part of the scrolling band, which a blit cannot
 * reproduce.
 */
function mergeCrossesFreeze(
  context: Context,
  freeze: Freeze | undefined,
  axis: "x" | "y"
) {
  const data =
    axis === "y"
      ? freeze?.horizontal?.freezenhorizontaldata
      : freeze?.vertical?.freezenverticaldata;
  const merge = context.config?.merge;
  if (!data || !merge) return false;
  const frozenCount = data[1] as number;
  // the frozen panes (frozen rows for a vertical scroll) and the sheet
  // range they draw across the other axis
  const panes = sheetPasses(context, freeze).flatMap((p) => {
    if (p.kind !== "cells") return [];
    if (axis === "y") {
      return p.offsetTop === context.columnHeaderHeight
        ? [[p.scrollWidth, p.scrollWidth + p.drawWidth]]
        : [];
    }
    return p.offsetLeft === context.rowHeaderWidth
      ? [[p.scrollHeight, p.scrollHeight + p.drawHeight]]
      : [];
  });
  const edges =
    axis === "y" ? context.visibledatacolumn : context.visibledatarow;
  return Object.values(merge).some((m) => {
    const [start, span, from, count] =
      axis === "y" ? [m.r, m.rs, m.c, m.cs] : [m.c, m.cs, m.r, m.rs];
    if (!(start < frozenCount && start + span > frozenCount)) return false;
    const lo = from > 0 ? edges[from - 1] ?? 0 : 0;
    const hi = edges[Math.min(from + count, edges.length) - 1] ?? lo;
    return panes.some(([s0, s1]) => hi >= s0 && lo <= s1);
  });
}

/**
 * Whether the sheet has conditional-format data bars or icon sets. They are
 * anti-aliased paths whose edge pixels depend on the clip they are drawn
 * under, so a strip redraw would not match a full redraw exactly.
 */
function hasPathDecorations(context: Context) {
  const i = getSheetIndex(context, context.currentSheetId);
  const rules =
    i == null
      ? undefined
      : context.luckysheetfile[i]?.luckysheet_conditionformat_save;
  return (
    Array.isArray(rules) &&
    rules.some((r: any) => r?.type === "dataBar" || r?.type === "icons")
  );
}

/**
 * Scroll by moving the pixels already on the canvas and drawing only the
 * newly exposed strip. Along the scrolled axis everything past the frozen
 * panes moves: for a vertical scroll, the band below the frozen rows (row
 * header, frozen columns and main pane alike); the frozen rows stay put.
 * Applies to scrolls along one axis by less than half the band, when every
 * edge lands on a device pixel (so the copy is exact). Returns false when a
 * full redraw is needed instead.
 */
function blitScroll(
  canvasElement: HTMLCanvasElement,
  prev: Context,
  next: Context,
  freeze: Freeze | undefined
) {
  const dx = next.scrollLeft - prev.scrollLeft;
  const dy = next.scrollTop - prev.scrollTop;
  if ((dx !== 0) === (dy !== 0)) return false;
  const dpr = next.devicePixelRatio;
  const [width, height] = next.luckysheetTableContentHW;
  const main = sheetPasses(next, freeze)[0] as Extract<
    DrawPass,
    { kind: "cells" }
  >;
  const axis = dx ? "x" : "y";
  // The moving band starts where the main pane's fill does. Its first
  // BAND_EDGE px are redrawn rather than copied: frozen panes and header
  // parts reach across the boundary there (borders, header clears) and do
  // not move with the scroll.
  const bandStart = dx ? main.offsetLeft - 1 : main.offsetTop - 1;
  const end = dx ? width : height;
  const delta = dx || dy;
  const copyStart = bandStart + BAND_EDGE;
  const len = end - copyStart - Math.abs(delta);
  if (Math.abs(delta) * 2 > end - copyStart) return false;
  if (
    ![bandStart, copyStart, width, height, delta].every((v) =>
      Number.isInteger(v * dpr)
    )
  ) {
    return false;
  }
  if (mergeCrossesFreeze(next, freeze, axis)) return false;
  if (hasPathDecorations(next)) return false;
  const ctx2d = canvasElement.getContext("2d");
  if (!ctx2d || typeof ctx2d.setTransform !== "function") return false;

  // 1. shift the band (device pixels, identity transform)
  const src = delta > 0 ? copyStart + delta : copyStart;
  const dst = delta > 0 ? copyStart : copyStart - delta;
  const [sx, sy, tx, ty, w, h] = dx
    ? [src, 0, dst, 0, len, height]
    : [0, src, 0, dst, width, len];
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

  // 2. redraw the exposed strip and the band edge with every pass, clipped
  if (delta > 0) {
    drawSheet(canvasElement, next, freeze, {
      axis,
      start: end - delta,
      size: delta,
    });
    drawSheet(canvasElement, next, freeze, {
      axis,
      start: bandStart,
      size: BAND_EDGE,
    });
  } else {
    drawSheet(canvasElement, next, freeze, {
      axis,
      start: bandStart,
      size: BAND_EDGE - delta,
    });
  }
  return true;
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
        painted.freeze === freeze &&
        onlyScrolled(painted.context, context);
      if (
        !canBlit ||
        !blitScroll(canvasElement, painted!.context, context, freeze)
      ) {
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
      <TrackedScope>{SHEET_OVERLAY}</TrackedScope>
    </div>
  );
};

export default Sheet;
