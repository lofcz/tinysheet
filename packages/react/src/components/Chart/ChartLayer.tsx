import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Chart,
  chartAreaCssFilter,
  clearObjectSelection,
  deleteChart,
  deleteChartShape,
  groupMembers as groupMembersOf,
  insertChartShape,
  moveObjects,
  ObjectRef,
  selectedObjects as selectedObjectsOf,
  selectObjects,
  toggleObject,
  ensureChartAnchor,
  getChartBox,
  getChartCellPosition,
  getChartReferencedSheetIds,
  getSheetIndex,
  isChartSheet,
  legacyShadowEffects,
  locale,
  MIN_CHART_HEIGHT,
  MIN_CHART_WIDTH,
  pasteChart,
  renderChartToSvg,
  Sheet,
  svgToDataUri,
  updateChart,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { getChartClipboard, setChartClipboard } from "./chartClipboard";
import { useChartPreview } from "./chartPreview";
import ChartButtons from "./ChartButtons";
import ChartShapes from "./ChartShapes";
import {
  pendingChartShape,
  setPendingChartShape,
  usePendingChartShape,
} from "./chartShapeDraw";
import { isChartRefEditActive } from "./dialogs/store";
import ChartContextMenu, { ChartMenuState } from "./ChartContextMenu";
import { trackPointerDrag } from "../../hooks/pointerDrag";
import { paneClipPath, placeInPanes } from "./panes";
import "./index.css";

type Box = { left: number; top: number; width: number; height: number };
type Side = "lt" | "mt" | "rt" | "lm" | "rm" | "lb" | "mb" | "rb";
const SIDES: Side[] = ["lt", "mt", "rt", "lm", "rm", "lb", "mb", "rb"];

/** Room around the chart of a chart sheet (px). */
const CHART_SHEET_MARGIN = 12;

type Drag = {
  id: string;
  mode: "move" | Side;
  /** Ctrl / Shift at the press: a click toggles the chart in the selection. */
  toggle?: boolean;
  /** Other selected objects moved along (a multi-selection or group). */
  others?: ObjectRef[];
  /** A click on a selected group member selects that chart alone. */
  inside?: boolean;
  /** Edges of the other objects (Snap to Shape), sheet px. */
  snapX?: number[];
  snapY?: number[];
  startX: number;
  startY: number;
  zoom: number;
  orig: Box;
  current: Box;
  moved: boolean;
};

/**
 * Re-render charts at most once per animation frame: a burst of cell edits
 * (paste, fill, recalculation) redraws charts once.
 */
function useFrameThrottled<T>(value: T, enabled: boolean): T {
  const [snapshot, setSnapshot] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  const frame = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || snapshot === value || frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setSnapshot(latest.current);
    });
  }, [value, snapshot, enabled]);
  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    []
  );
  return enabled ? snapshot : value;
}

type SvgCacheEntry = {
  chart: Chart;
  data: unknown[];
  theme: string;
  lang: string;
  width: number;
  height: number;
  svg: string;
};

function resizeBox(orig: Box, side: Side, dx: number, dy: number): Box {
  let { left, top, width, height } = orig;
  if (side[0] === "l") {
    const w = Math.max(MIN_CHART_WIDTH, width - dx);
    left += width - w;
    width = w;
  } else if (side[0] === "r") {
    width = Math.max(MIN_CHART_WIDTH, width + dx);
  }
  if (side[1] === "t") {
    const h = Math.max(MIN_CHART_HEIGHT, height - dy);
    top += height - h;
    height = h;
  } else if (side[1] === "b") {
    height = Math.max(MIN_CHART_HEIGHT, height + dy);
  }
  if (left < 0) {
    width += left;
    left = 0;
  }
  if (top < 0) {
    height += top;
    top = 0;
  }
  return { left, top, width, height };
}

/** CSS filter of the chart area's Shape Effects (shadow, glow). */
function chartAreaFilter(chart: Chart) {
  const f = chart.formats?.chartArea;
  return chartAreaCssFilter(
    f?.effects ?? (f?.shadow ? legacyShadowEffects() : undefined)
  );
}

/** The chart element under a pointer event ("chartArea" by default). */
function elementAt(target: EventTarget | null) {
  const el = (target as Element | null)?.closest?.("[data-chart-el]");
  const id = el?.getAttribute("data-chart-el");
  // gridlines and the data table are picked with the plot area
  if (!id || id === "minorGridlines" || id === "dataTable") return "chartArea";
  return id;
}

/**
 * The outline of the selected chart element (title, legend, plot area,
 * axis, series…), measured on the rendered SVG.
 */
const ElementOutline: React.FC<{
  boxRef: React.RefObject<HTMLDivElement | null>;
  element: string;
  svg: string;
}> = ({ boxRef, element, svg }) => {
  const [rect, setRect] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = box?.querySelector(
      `.fortune-chart-svg [data-chart-el="${element}"]`
    );
    if (!box || !el) {
      setRect(null);
      return;
    }
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setRect({
      left: r.left - b.left - 2,
      top: r.top - b.top - 2,
      width: r.width + 4,
      height: r.height + 4,
    });
  }, [boxRef, element, svg]);
  if (!rect) return null;
  return (
    <div
      className="fortune-chart-element-outline"
      data-element={element}
      style={rect}
      aria-hidden="true"
    >
      {["lt", "rt", "lb", "rb"].map((c) => (
        <span key={c} className={`fortune-chart-element-handle ${c}`} />
      ))}
    </div>
  );
};

const ChartLayer: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { chart: t } = locale(context);
  const sheetIndex = getSheetIndex(context, context.currentSheetId);
  const sheet: Sheet | undefined =
    sheetIndex == null ? undefined : context.luckysheetfile[sheetIndex];
  const charts = sheet?.charts;
  const hasCharts = !!charts && charts.length > 0;
  const files = useFrameThrottled(context.luckysheetfile, hasCharts);
  const [dragBox, setPreview] = useState<(Box & { id: string }) | null>(null);
  const drag = useRef<Drag | null>(null);
  const stopTracking = useRef<(() => void) | null>(null);
  const cache = useRef(new Map<string, SvgCacheEntry>());
  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  const [menu, setMenu] = useState<ChartMenuState | null>(null);
  const [focusSeries, setFocusSeries] = useState<number | null>(null);
  const preview = useChartPreview();
  const zoom = context.zoomRatio || 1;
  const themeName = context.theme || "light";
  const lang = context.lang || "";
  const readonly = context.allowEdit === false;
  const sheetId = sheet?.id;
  // Read so row/column resizes and hides re-render the charts.
  const { config, visibledatarow, visibledatacolumn } = context;

  const svgFor = useCallback(
    (chart: Chart, width: number, height: number) => {
      const sheetIds = getChartReferencedSheetIds(chart);
      const data = sheetIds.map((id) => files.find((f) => f.id === id)?.data);
      const hit = cache.current.get(chart.id);
      if (
        hit &&
        hit.chart === chart &&
        hit.theme === themeName &&
        hit.lang === lang &&
        hit.width === width &&
        hit.height === height &&
        hit.data.length === data.length &&
        hit.data.every((d, i) => d === data[i])
      ) {
        return hit.svg;
      }
      const svg = renderChartToSvg(
        { luckysheetfile: files, theme: themeName, lang },
        chart,
        themeName,
        { width, height }
      );
      cache.current.set(chart.id, {
        chart,
        data,
        theme: themeName,
        lang,
        width,
        height,
        svg,
      });
      return svg;
    },
    [files, themeName, lang]
  );

  /** Where a chart is shown now (it follows its anchor cells). */
  // a chart sheet: its chart fills the window (Excel's zoom to fit)
  const chartSheet = isChartSheet(sheet);
  const boxOf = useCallback(
    (chart: Chart): Box => {
      if (chartSheet) {
        const z = context.zoomRatio || 1;
        const m = CHART_SHEET_MARGIN;
        // room on the right for the chart buttons (Chart Elements…)
        const right = m + 40;
        return {
          left: (context.scrollLeft || 0) / z + m / z,
          top: (context.scrollTop || 0) / z + m / z,
          width: Math.max(80, (context.cellmainWidth - m - right) / z),
          height: Math.max(60, (context.cellmainHeight - 2 * m) / z),
        };
      }
      if (!sheetId)
        return {
          left: chart.left,
          top: chart.top,
          width: chart.width,
          height: chart.height,
        };
      return getChartBox(context, sheetId, chart);
    },
    // geometry fields are listed so the boxes follow resizes and hides
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, sheetId, config, visibledatarow, visibledatacolumn, chartSheet]
  );

  // on a chart sheet its chart is always the selected object (Excel)
  const sheetChartId = chartSheet ? charts?.[0]?.id : undefined;
  useEffect(() => {
    if (!sheetChartId || context.activeChart === sheetChartId) return;
    setContext(
      (ctx) => {
        ctx.activeChart = sheetChartId;
        ctx.chartElement = ctx.chartElement ?? "chartArea";
      },
      { noHistory: true }
    );
  }, [sheetChartId, context.activeChart, setContext]);

  // Charts from older files have no cell anchor yet: anchor them to the
  // cells under them (not an undo step).
  useEffect(() => {
    if (!sheetId || !charts?.some((c) => !c.anchor)) return;
    setContext(
      (ctx) => {
        const target = ctx.luckysheetfile.find((s) => s.id === sheetId);
        target?.charts?.forEach((c) => ensureChartAnchor(ctx, sheetId, c));
      },
      { noHistory: true }
    );
  }, [charts, sheetId, setContext]);

  // Drop cache entries of deleted charts.
  useEffect(() => {
    const ids = new Set<string>();
    context.luckysheetfile.forEach((f) =>
      f.charts?.forEach((c) => ids.add(c.id))
    );
    (Array.from(cache.current.keys()) as string[]).forEach((id) => {
      if (!ids.has(id)) cache.current.delete(id);
    });
  }, [context.luckysheetfile]);

  // Focus a newly selected chart so Delete / Ctrl+C act on it.
  const { activeChart, chartEditorOpen } = context;
  useLayoutEffect(() => {
    if (!activeChart) return;
    const el = boxRefs.current.get(activeChart);
    if (el && !el.contains(document.activeElement)) {
      const editor = document.activeElement?.closest?.(".fortune-chart-editor");
      if (!editor) el.focus({ preventScroll: true });
    }
  }, [activeChart]);

  // Forget the selection when it no longer exists on this sheet.
  const { selectedCharts } = context;
  useEffect(() => {
    if (activeChart && !charts?.some((c) => c.id === activeChart)) {
      setContext((ctx) => {
        ctx.activeChart = undefined;
        ctx.chartEditorOpen = false;
      });
    }
    if (
      selectedCharts?.length &&
      !selectedCharts.every((id) => charts?.some((c) => c.id === id))
    ) {
      setContext((ctx) => {
        const keep = (ctx.selectedCharts ?? []).filter((id) =>
          charts?.some((c) => c.id === id)
        );
        ctx.selectedCharts = keep.length ? keep : undefined;
      });
    }
  }, [activeChart, charts, selectedCharts, setContext]);

  // Clicking elsewhere in the workbook deselects (unless the editor is open).
  const multi = !!selectedCharts?.length;
  useEffect(() => {
    if (!multi) return undefined;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const container = refs.workbookContainer.current;
      if (!target || !container?.contains(target)) return;
      if (
        target.closest?.(
          ".fortune-chart-box, .fortune-shape, .fortune-shape-frame, .fortune-ribbon, .fortune-side-slot, .ts-popover, .ts-dialog"
        )
      )
        return;
      setContext((ctx) => clearObjectSelection(ctx));
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [multi, refs.workbookContainer, setContext]);

  useEffect(() => {
    if (!activeChart || chartEditorOpen || chartSheet) return undefined;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const container = refs.workbookContainer.current;
      if (!target || !container?.contains(target)) return;
      // the ribbon (Chart Design / Format), menus, dialogs and panes act on
      // the selected chart; the Select Data dialog picks cells with it
      if (isChartRefEditActive()) return;
      if (
        target.closest?.(
          ".fortune-chart-box, .fortune-chart-editor, .fortune-chart-menu, .fortune-toolbar, .fortune-ribbon, .fortune-ribbon-pane, .fortune-side-slot, .fortune-series-formula, .ts-popover, .ts-dialog"
        )
      )
        return;
      // Ctrl / Shift + click on a shape adds it to the selection
      if (
        target.closest?.(".fortune-shape") &&
        (e.ctrlKey || e.metaKey || e.shiftKey)
      )
        return;
      setContext((ctx) => {
        ctx.activeChart = undefined;
        ctx.chartElement = undefined;
      });
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [
    activeChart,
    chartEditorOpen,
    chartSheet,
    refs.workbookContainer,
    setContext,
  ]);

  // Paste a copied chart (capture phase, before the cell paste handler).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const container = refs.workbookContainer.current;
      const active = document.activeElement as HTMLElement | null;
      if (!container || !active || !container.contains(active)) return;
      if (active.closest(".fortune-chart-editor")) return;
      const copied = getChartClipboard(e.clipboardData?.getData("text/plain"));
      if (!copied || readonly) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const fromChart = !!active.closest(".fortune-chart-box");
      setContext((ctx) => {
        let position = { left: copied.left + 20, top: copied.top + 20 };
        const sel =
          ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
        if (!fromChart && sel) {
          position = getChartCellPosition(
            ctx,
            sel.row_focus ?? sel.row[0],
            sel.column_focus ?? sel.column[0]
          );
        }
        pasteChart(ctx, copied, position);
      });
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  }, [readonly, refs.workbookContainer, setContext]);

  // the nearest row / column edge to `pos` (sheet px at 100%): Alt snaps
  const snapToGrid = useCallback(
    (pos: number, axis: "x" | "y") => {
      const edges =
        axis === "x" ? context.visibledatacolumn : context.visibledatarow;
      let best = 0;
      edges.forEach((edge) => {
        if (Math.abs(edge / zoom - pos) < Math.abs(best - pos)) {
          best = edge / zoom;
        }
      });
      return best;
    },
    [context.visibledatacolumn, context.visibledatarow, zoom]
  );
  const snapRef = useRef(snapToGrid);
  snapRef.current = snapToGrid;
  const snapGridRef = useRef(!!context.snapToGrid);
  snapGridRef.current = !!context.snapToGrid;

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    let dx = (e.pageX - d.startX) / d.zoom;
    let dy = (e.pageY - d.startY) / d.zoom;
    if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    d.moved = true;
    if (d.mode === "move") {
      // Shift: only horizontally or vertically; Alt: snap to the grid
      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (e.altKey || snapGridRef.current) {
        dx = snapRef.current(d.orig.left + dx, "x") - d.orig.left;
        dy = snapRef.current(d.orig.top + dy, "y") - d.orig.top;
      } else if (d.snapX?.length || d.snapY?.length) {
        // Snap to Shape: an edge within 6 px of another object's edge
        const snap = (start: number, size: number, edges: number[]) => {
          let best = 0;
          let bestDist = 7;
          [start, start + size].forEach((edge) =>
            edges.forEach((target) => {
              const delta = target - edge;
              if (Math.abs(delta) < bestDist) {
                best = delta;
                bestDist = Math.abs(delta);
              }
            })
          );
          return best;
        };
        dx += snap(d.orig.left + dx, d.orig.width, d.snapX ?? []);
        dy += snap(d.orig.top + dy, d.orig.height, d.snapY ?? []);
      }
    }
    d.current =
      d.mode === "move"
        ? {
            ...d.orig,
            left: Math.max(0, d.orig.left + dx),
            top: Math.max(0, d.orig.top + dy),
          }
        : resizeBox(d.orig, d.mode, dx, dy);
    setPreview({ id: d.id, ...d.current });
  }, []);

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      const d = drag.current;
      drag.current = null;
      stopTracking.current = null;
      if (d && !d.moved && d.toggle) {
        // Ctrl / Shift + click: add or remove the chart (Excel)
        setContext((ctx) => toggleObject(ctx, { kind: "chart", id: d.id }), {
          noHistory: true,
        });
      } else if (d && !d.moved && d.inside) {
        // a second click on a group member selects it alone
        setContext(
          (ctx) => selectObjects(ctx, [{ kind: "chart", id: d.id }], true),
          { noHistory: true }
        );
      }
      if (d?.moved && d.mode === "move" && d.others?.length) {
        // the whole selection (a group) moves by the same distance
        const dx = Math.round(d.current.left - d.orig.left);
        const dy = Math.round(d.current.top - d.orig.top);
        setContext((ctx) =>
          moveObjects(ctx, [{ kind: "chart", id: d.id }, ...d.others!], dx, dy)
        );
        setPreview(null);
        return;
      }
      if (d?.moved) {
        const box = {
          left: Math.round(d.current.left),
          top: Math.round(d.current.top),
          width: Math.round(d.current.width),
          height: Math.round(d.current.height),
        };
        // Ctrl held on release: a copy goes there (Excel)
        const copy = d.mode === "move" && (e.ctrlKey || e.metaKey);
        setContext((ctx) => {
          if (copy) {
            const chart = ctx.luckysheetfile
              .find((s) => s.id === ctx.currentSheetId)
              ?.charts?.find((c) => c.id === d.id);
            const pasted = chart ? pasteChart(ctx, chart, box) : null;
            if (pasted) ctx.activeChart = pasted.id;
            return;
          }
          updateChart(ctx, d.id, box);
        });
      }
      setPreview(null);
    },
    [setContext]
  );

  // Esc (or a lost pointer): the chart stays where it was
  const onDragCancel = useCallback(() => {
    drag.current = null;
    stopTracking.current = null;
    setPreview(null);
  }, []);

  useEffect(() => () => stopTracking.current?.(), []);

  // Format › Insert Shapes: a picked shape waits for a drag in the chart;
  // it is dropped when the chart is deselected
  const pendingShape = usePendingChartShape();
  useEffect(() => {
    if (!activeChart) setPendingChartShape(null);
  }, [activeChart]);

  // Format › Insert Shapes: drawing a shape in a chart
  const [drawing, setDrawing] = useState<{
    id: string;
    box: Box;
  } | null>(null);
  const startShapeDraw = useCallback(
    (e: React.MouseEvent, chart: Chart) => {
      const key = pendingChartShape();
      const el = boxRefs.current.get(chart.id);
      if (!key || !el) return;
      const rect = el.getBoundingClientRect();
      const at = (ev: { clientX: number; clientY: number }) => ({
        x: Math.min(chart.width, Math.max(0, (ev.clientX - rect.left) / zoom)),
        y: Math.min(chart.height, Math.max(0, (ev.clientY - rect.top) / zoom)),
      });
      const start = at(e);
      let box: Box | null = null;
      stopTracking.current?.();
      stopTracking.current = trackPointerDrag(e, {
        onMove: (ev) => {
          const p = at(ev);
          box = {
            left: Math.min(start.x, p.x),
            top: Math.min(start.y, p.y),
            width: Math.abs(p.x - start.x),
            height: Math.abs(p.y - start.y),
          };
          setDrawing({ id: chart.id, box });
        },
        onEnd: () => {
          stopTracking.current = null;
          setDrawing(null);
          setPendingChartShape(null);
          const drawn: Box | null =
            box && box.width >= 4 && box.height >= 4 ? box : null;
          setContext((ctx) => {
            const f = ctx.luckysheetfile
              .find((sh) => sh.id === ctx.currentSheetId)
              ?.charts?.find((c) => c.id === chart.id);
            if (!f) return;
            // a click without a drag: the shape's default size there
            const shape = insertChartShape(
              f,
              key,
              drawn ?? {
                left: Math.min(start.x, f.width - 96),
                top: Math.min(start.y, f.height - 64),
                width: 96,
                height: 64,
              }
            );
            ctx.activeChart = chart.id;
            if (shape) ctx.chartElement = `shape:${shape.id}`;
          });
        },
        onCancel: () => {
          stopTracking.current = null;
          setDrawing(null);
          setPendingChartShape(null);
        },
      });
    },
    [setContext, zoom]
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, chart: Chart, mode: Drag["mode"]) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      boxRefs.current.get(chart.id)?.focus({ preventScroll: true });
      // Format › Insert Shapes: a drag in the chart draws the shape
      if (mode === "move" && pendingChartShape() && !readonly) {
        startShapeDraw(e, chart);
        return;
      }
      const mod = e.ctrlKey || e.metaKey || e.shiftKey;
      const inMulti =
        !!context.selectedCharts?.includes(chart.id) &&
        (context.selectedCharts.length > 1 || !!context.activeShapes?.length);
      let others: ObjectRef[] = [];
      let toggle = false;
      let inside = false;
      if (mode === "move" && (mod || inMulti || chart.group)) {
        if (mod) {
          // Ctrl / Shift: a click toggles, a drag moves the selection
          toggle = true;
          if (inMulti || context.activeChart === chart.id) {
            others = selectedObjectsOf(context).filter(
              (r) => !(r.kind === "chart" && r.id === chart.id)
            );
          }
        } else if (inMulti) {
          others = selectedObjectsOf(context).filter(
            (r) => !(r.kind === "chart" && r.id === chart.id)
          );
          inside = !!chart.group;
        } else if (chart.group) {
          // a click on a grouped chart selects its whole group (Excel)
          setContext(
            (ctx) => selectObjects(ctx, [{ kind: "chart", id: chart.id }]),
            { noHistory: true }
          );
          others = groupMembersOf(context, chart.group).filter(
            (r) => !(r.kind === "chart" && r.id === chart.id)
          );
        }
      }
      if (!toggle && !others.length && !inside) {
        // a click picks the element under the pointer (Excel)
        const element =
          mode === "move" ? elementAt(e.target) : context.chartElement;
        if (
          context.activeChart !== chart.id ||
          (mode === "move" && context.chartElement !== element)
        ) {
          setContext(
            (ctx) => {
              ctx.activeChart = chart.id;
              ctx.chartElement = element ?? "chartArea";
              ctx.selectedCharts = undefined;
              ctx.activeShapes = undefined;
            },
            { noHistory: true }
          );
        }
      }
      // a chart sheet's chart fills it: no moving or sizing (Excel)
      if (readonly || chartSheet) return;
      const orig = boxOf(chart);
      // Snap to Shape: the edges of the other charts
      const snapX: number[] = [];
      const snapY: number[] = [];
      if (context.snapToShape) {
        charts?.forEach((c) => {
          if (c.id === chart.id) return;
          const b = boxOf(c);
          snapX.push(b.left, b.left + b.width);
          snapY.push(b.top, b.top + b.height);
        });
      }
      drag.current = {
        id: chart.id,
        mode,
        startX: e.pageX,
        startY: e.pageY,
        zoom,
        orig,
        current: orig,
        moved: false,
        toggle,
        inside,
        others,
        snapX,
        snapY,
      };
      stopTracking.current?.();
      stopTracking.current = trackPointerDrag(e, {
        onMove: onMouseMove,
        onEnd: onMouseUp,
        onCancel: onDragCancel,
      });
    },
    [
      boxOf,
      charts,
      chartSheet,
      context,
      onDragCancel,
      onMouseMove,
      onMouseUp,
      readonly,
      setContext,
      startShapeDraw,
      zoom,
    ]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, chart: Chart) => {
      const mod = e.ctrlKey || e.metaKey;
      // Undo / redo bubble to the workbook.
      if (mod && (e.code === "KeyZ" || e.code === "KeyY")) return;
      // Copy / cut / paste are handled by the clipboard events.
      if (mod && ["KeyC", "KeyX", "KeyV"].includes(e.code)) {
        e.stopPropagation();
        return;
      }
      if (e.key === "Tab") return;
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        setContext((ctx) => {
          ctx.activeChart = undefined;
          ctx.chartEditorOpen = false;
        });
        refs.cellInput.current?.focus();
        return;
      }
      if (readonly) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        // a shape drawn in the chart goes, the chart stays (Excel)
        const shape = /^shape:(.+)$/.exec(context.chartElement ?? "");
        if (shape) {
          setContext((ctx) => {
            const f = ctx.luckysheetfile
              .find((sh) => sh.id === ctx.currentSheetId)
              ?.charts?.find((c) => c.id === chart.id);
            if (f) deleteChartShape(f, shape[1]);
            ctx.chartElement = "chartArea";
          });
          return;
        }
        // the chart of a chart sheet cannot be deleted (delete the sheet)
        if (chartSheet) return;
        setContext((ctx) => deleteChart(ctx, chart.id));
        refs.cellInput.current?.focus();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        setContext((ctx) => {
          ctx.chartEditorOpen = true;
        });
        return;
      }
      if (chartSheet) return;
      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = nudge[e.key];
      if (delta) {
        e.preventDefault();
        const box = boxOf(chart);
        setContext((ctx) =>
          updateChart(ctx, chart.id, {
            left: Math.max(0, box.left + delta[0]),
            top: Math.max(0, box.top + delta[1]),
          })
        );
      }
    },
    [
      boxOf,
      chartSheet,
      context.chartElement,
      readonly,
      refs.cellInput,
      setContext,
    ]
  );

  const onCopy = useCallback(
    (e: React.ClipboardEvent, chart: Chart, cut: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      const marker = setChartClipboard(chart);
      e.clipboardData.setData("text/plain", marker);
      const box = boxOf(chart);
      const width = Math.max(1, Math.round(box.width));
      const height = Math.max(1, Math.round(box.height));
      const svg = renderChartToSvg(
        { luckysheetfile: context.luckysheetfile, lang: context.lang },
        chart,
        "light",
        { width, height }
      );
      e.clipboardData.setData(
        "text/html",
        `<img src="${svgToDataUri(
          svg
        )}" width="${width}" height="${height}" alt="">`
      );
      if (cut && !readonly) {
        setContext((ctx) => deleteChart(ctx, chart.id));
        refs.cellInput.current?.focus();
      }
    },
    [
      boxOf,
      context.lang,
      context.luckysheetfile,
      readonly,
      refs.cellInput,
      setContext,
    ]
  );

  const freeze = refs.globalCache.freezen?.[context.currentSheetId];

  const boxes = useMemo(() => {
    if (!charts) return [];
    return charts.map((chart) => {
      const box = dragBox?.id === chart.id ? dragBox : boxOf(chart);
      return { chart, box };
    });
  }, [boxOf, charts, dragBox]);

  if (!hasCharts) return null;

  return (
    <div className="fortune-chart-layer">
      {menu && <ChartContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {boxes.map(({ chart, box }) => {
        const active = chart.id === activeChart;
        const zoomed = {
          left: box.left * zoom,
          top: box.top * zoom,
          width: box.width * zoom,
          height: box.height * zoom,
        };
        const panes = placeInPanes(context, freeze, zoomed);
        // a "move and size" chart whose rows or columns are all hidden
        if (panes.length === 0 || box.width < 1 || box.height < 1) return null;
        // a gallery / dialog preview draws the chart as it would become
        const shown = preview?.id === chart.id ? preview : chart;
        const svg = svgFor(
          shown,
          Math.round(box.width),
          Math.round(box.height)
        );
        return panes.map((pane) => {
          const showHandles = active && pane.primary && !chartSheet;
          const showButtons = active && pane.primary;
          const inSelection = !!selectedCharts?.includes(chart.id);
          return (
            <div
              key={`${chart.id}-${pane.primary ? "main" : pane.clip.join()}`}
              ref={
                pane.primary
                  ? (el) => {
                      if (el) boxRefs.current.set(chart.id, el);
                      else boxRefs.current.delete(chart.id);
                    }
                  : undefined
              }
              className={`fortune-chart-box${
                active || inSelection ? " fortune-chart-box-active" : ""
              }`}
              data-selected={inSelection || undefined}
              data-group={chart.group}
              data-drawing={(active && pendingShape) || undefined}
              data-chart-id={chart.id}
              data-focus-series={
                active && focusSeries != null ? focusSeries : undefined
              }
              role={pane.primary ? "figure" : undefined}
              aria-label={pane.primary ? chart.title || t.chart : undefined}
              aria-hidden={pane.primary ? undefined : true}
              tabIndex={pane.primary ? 0 : -1}
              style={{
                left: pane.left,
                top: pane.top,
                width: zoomed.width,
                height: zoomed.height,
                // the frozen band hides a part of the box; the sides that are
                // not cut keep the handles and the chart buttons outside it
                clipPath: paneClipPath(pane),
                ["--ts-chart-clip-top" as string]: `${pane.clip[0]}px`,
              }}
              onMouseDown={(e) => startDrag(e, chart, "move")}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Format <Element> for the element double-clicked: the
                // press picked it (the release lands on the box, which
                // captures the pointer)
                const element = elementAt(e.target);
                setContext(
                  (ctx) => {
                    ctx.activeChart = chart.id;
                    if (element !== "chartArea" || !ctx.chartElement) {
                      ctx.chartElement = element;
                    }
                    ctx.chartEditorOpen = true;
                  },
                  { noHistory: true }
                );
              }}
              onContextMenu={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (context.activeChart !== chart.id) {
                  setContext((ctx) => {
                    ctx.activeChart = chart.id;
                  });
                }
                setMenu({ chartId: chart.id, x: e.clientX, y: e.clientY });
              }}
              onKeyDown={(e) => onKeyDown(e, chart)}
              onCopy={(e) => onCopy(e, chart, false)}
              onCut={(e) => onCopy(e, chart, true)}
            >
              <div
                className="fortune-chart-svg"
                // the chart area's outer shadow and glow fall outside it
                style={{ filter: chartAreaFilter(shown) }}
                // SVG produced by the chart renderer; every text is XML-escaped.
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <ChartShapes
                chart={shown}
                zoom={zoom}
                interactive={pane.primary}
              />
              {inSelection && pane.primary && (
                <div className="fortune-chart-outline" />
              )}
              {drawing?.id === chart.id && (
                <div
                  className="fortune-chart-shape-draw"
                  style={{
                    left: drawing.box.left * zoom,
                    top: drawing.box.top * zoom,
                    width: drawing.box.width * zoom,
                    height: drawing.box.height * zoom,
                  }}
                />
              )}
              {showHandles && (
                <>
                  <div className="fortune-chart-outline" />
                  {!readonly &&
                    SIDES.map((side) => (
                      <div
                        key={side}
                        className={`fortune-chart-handle fortune-chart-handle-${side}`}
                        onMouseDown={(e) => startDrag(e, chart, side)}
                      />
                    ))}
                  {active &&
                    (context.chartElement ?? "chartArea") !== "chartArea" && (
                      <ElementOutline
                        boxRef={{
                          current: boxRefs.current.get(chart.id) ?? null,
                        }}
                        element={context.chartElement!}
                        svg={svg}
                      />
                    )}
                </>
              )}
              {showButtons && !readonly && (
                <div
                  className="fortune-chart-actions"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <ChartButtons
                    chartId={chart.id}
                    onFocusSeries={setFocusSeries}
                  />
                </div>
              )}
            </div>
          );
        });
      })}
    </div>
  );
};

export default ChartLayer;
