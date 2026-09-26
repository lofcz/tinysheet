import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Context,
  PrintRange,
  computeSheetPageLayout,
  getPageSetup,
  isPageBreakPreview,
  isPageLayoutView,
  isShowingPageBreaks,
  movePageBreak,
  updatePageSetup,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import { trackPointerDrag } from "../../hooks/pointerDrag";
import WorkbookContext from "../../context";
import { useWorkbookSelector } from "../../context/store";
import { usePageLayoutDialogs } from "./dialogs";
import { formatText, usePageLayoutText, useRawContext } from "./shared";

type Axis = "row" | "column";

type Drag = {
  axis: Axis;
  /** A page break (moves it) or a print area edge (resizes the area). */
  kind: "break" | "edge";
  area: number;
  /** break: its index; edge: 0 = top/left, 1 = bottom/right */
  from: number;
  side?: 0 | 1;
  /** Boundary index under the pointer. */
  to: number;
};

/** Pixel edge before row/column `i` in the zoomed grid. */
function edge(ends: readonly number[], i: number) {
  if (i <= 0) return 0;
  return ends[Math.min(i, ends.length) - 1] ?? 0;
}

/** Index of the row/column boundary nearest to `px`. */
function nearestBoundary(ends: readonly number[], px: number) {
  const i = _.sortedIndex(ends as number[], px);
  const before = edge(ends, i);
  const after = edge(ends, i + 1);
  return Math.abs(px - before) <= Math.abs(after - px) ? i : i + 1;
}

const PageBreaks: React.FC<{ preview: boolean; pageView?: boolean }> = ({
  preview,
  pageView,
}) => {
  const { setContext, refs } = useContext(WorkbookContext);
  const raw = useRawContext();
  const t = usePageLayoutText();
  const sheet = useWorkbookSelector((c) =>
    c.luckysheetfile.find((s) => s.id === c.currentSheetId)
  );
  const rows = useWorkbookSelector((c) => c.visibledatarow);
  const zoom = useWorkbookSelector((c) => c.zoomRatio || 1);
  const cols = useWorkbookSelector((c) => c.visibledatacolumn);
  const view = useWorkbookSelector(
    (c) => ({
      left: c.scrollLeft,
      top: c.scrollTop,
      width: c.cellmainWidth,
      height: c.cellmainHeight,
    }),
    _.isEqual
  );
  const layout = useMemo(
    () => computeSheetPageLayout(raw()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, rows, cols]
  );
  const [drag, setDrag] = useState<Drag | null>(null);

  if (!layout) return null;
  const X = (c: number) => edge(cols, c);
  const Y = (r: number) => edge(rows, r);
  const rectOf = (range: PrintRange) => ({
    x: X(range.column[0]),
    y: Y(range.row[0]),
    w: X(range.column[1] + 1) - X(range.column[0]),
    h: Y(range.row[1] + 1) - Y(range.row[0]),
  });

  const edgeIndex = (ai: number, axis: Axis, side: 0 | 1) => {
    const range = layout.areas[ai].range[axis === "row" ? "row" : "column"];
    return side === 0 ? range[0] : range[1] + 1;
  };

  const startDrag = (e: React.MouseEvent, d: Drag) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pointerIndex = (ev: MouseEvent) => {
      const area = refs.cellArea.current;
      const box = area?.getBoundingClientRect();
      const ctx = raw();
      if (d.axis === "column") {
        const x = ev.clientX - (box?.left ?? 0) + (ctx.scrollLeft || 0);
        return nearestBoundary(ctx.visibledatacolumn, x);
      }
      const y = ev.clientY - (box?.top ?? 0) + (ctx.scrollTop || 0);
      return nearestBoundary(ctx.visibledatarow, y);
    };
    setDrag(d);
    const move = (ev: MouseEvent) => {
      const to = pointerIndex(ev);
      setDrag((cur) => (cur && cur.to !== to ? { ...cur, to } : cur));
    };
    const up = (ev: MouseEvent) => {
      const to = pointerIndex(ev);
      setDrag(null);
      const areaRange = layout.areas[d.area]?.range;
      if (!areaRange) return;
      const bounds: [number, number] =
        d.axis === "row"
          ? [areaRange.row[0], areaRange.row[1]]
          : [areaRange.column[0], areaRange.column[1]];
      setContext((ctx) => {
        if (d.kind === "break") {
          if (to !== d.from) movePageBreak(ctx, d.axis, d.from, to, bounds);
          return;
        }
        const areas = layout.areas.map((a) => _.cloneDeep(a.range));
        const target = areas[d.area];
        const key = d.axis === "row" ? "row" : "column";
        if (d.side === 0) {
          target[key][0] = Math.min(to, target[key][1]);
        } else {
          target[key][1] = Math.max(to - 1, target[key][0]);
        }
        if (_.isEqual(areas, getPageSetup(ctx).printArea)) return;
        updatePageSetup(ctx, { printArea: areas });
      });
    };
    // Esc: the break / print area edge stays where it was
    // the keyboard goes back to the grid afterwards
    const focusGrid = () =>
      refs.cellInput.current?.focus({ preventScroll: true });
    trackPointerDrag(e, {
      onMove: move,
      onEnd: (ev) => {
        up(ev);
        focusGrid();
      },
      onCancel: () => {
        setDrag(null);
        focusGrid();
      },
    });
  };

  // what is visible (the mask and watermarks only cover the viewport)
  const vx = view.left || 0;
  const vy = view.top || 0;
  const vw = view.width || 0;
  const vh = view.height || 0;
  const areaRects = layout.areas.map((a) => rectOf(a.range));
  const firstNumber = layout.setup.firstPageNumber ?? 1;
  const lines: React.ReactNode[] = [];

  layout.areas.forEach((area, ai) => {
    const r = areaRects[ai];
    const breakLine = (
      axis: Axis,
      line: { index: number; manual: boolean }
    ) => {
      const pos = axis === "column" ? X(line.index) : Y(line.index);
      const style: React.CSSProperties =
        axis === "column"
          ? { left: pos - 1, top: r.y, height: r.h }
          : { top: pos - 1, left: r.x, width: r.w };
      lines.push(
        <div
          key={`${ai}-${axis}-${line.index}`}
          className={`fortune-page-break fortune-page-break-${axis}${
            line.manual ? " manual" : ""
          }${preview ? " preview" : ""}`}
          style={style}
          data-index={line.index}
          onMouseDown={
            preview
              ? (e) =>
                  startDrag(e, {
                    axis,
                    kind: "break",
                    area: ai,
                    from: line.index,
                    to: line.index,
                  })
              : undefined
          }
        />
      );
    };
    area.colBreaks.forEach((b) => breakLine("column", b));
    area.rowBreaks.forEach((b) => breakLine("row", b));
    if (preview) {
      const edges: [Axis, 0 | 1, React.CSSProperties][] = [
        ["row", 0, { left: r.x, top: r.y - 2, width: r.w }],
        ["row", 1, { left: r.x, top: r.y + r.h - 2, width: r.w }],
        ["column", 0, { left: r.x - 2, top: r.y, height: r.h }],
        ["column", 1, { left: r.x + r.w - 2, top: r.y, height: r.h }],
      ];
      edges.forEach(([axis, side, style]) =>
        lines.push(
          <div
            key={`${ai}-edge-${axis}-${side}`}
            className={`fortune-page-area-edge fortune-page-break-${axis}`}
            style={style}
            onMouseDown={(e) =>
              startDrag(e, {
                axis,
                kind: "edge",
                area: ai,
                side,
                from: side,
                to: edgeIndex(ai, axis, side),
              })
            }
          />
        )
      );
    }
  });

  let ghost: React.ReactNode = null;
  if (drag) {
    const r = areaRects[drag.area];
    ghost =
      drag.axis === "column" ? (
        <div
          className="fortune-page-break-ghost fortune-page-break-column"
          style={{ left: X(drag.to) - 1, top: r?.y ?? vy, height: r?.h ?? vh }}
        />
      ) : (
        <div
          className="fortune-page-break-ghost fortune-page-break-row"
          style={{ top: Y(drag.to) - 1, left: r?.x ?? vx, width: r?.w ?? vw }}
        />
      );
  }

  // Page Layout view: every page outlined at its paper's printable size
  // (the last page of a row / column of pages shows the unused room), with
  // its number
  let pageFrames: React.ReactNode = null;
  if (pageView && !preview && vw > 0 && vh > 0) {
    const scale = layout.scale || 1;
    const pageW = (layout.printable.width / scale) * zoom;
    const pageH = (layout.printable.height / scale) * zoom;
    pageFrames = layout.pages.map((p, i) => {
      const rr = rectOf({ row: p.rows, column: p.cols });
      const hasRight = layout.pages.some(
        (q) =>
          q.area === p.area && q.rows[0] === p.rows[0] && q.cols[0] > p.cols[1]
      );
      const hasBelow = layout.pages.some(
        (q) =>
          q.area === p.area && q.cols[0] === p.cols[0] && q.rows[0] > p.rows[1]
      );
      const w = hasRight ? rr.w : Math.max(rr.w, pageW - p.headingWidth * zoom);
      const h = hasBelow
        ? rr.h
        : Math.max(rr.h, pageH - p.headingHeight * zoom);
      const visible =
        rr.x < vx + vw && rr.x + w > vx && rr.y < vy + vh && rr.y + h > vy;
      if (!visible) return null;
      return (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={`page-${i}`}
          className="fortune-page-layout-page"
          style={{ left: rr.x, top: rr.y, width: w, height: h }}
        >
          <span className="fortune-page-layout-label">
            {formatText(t.pageWatermark, { n: firstNumber + i })}
          </span>
        </div>
      );
    });
  }

  let mask: React.ReactNode = null;
  if (preview && vw > 0 && vh > 0) {
    const holes = areaRects
      .map((r) => `M${r.x - vx},${r.y - vy}h${r.w}v${r.h}h${-r.w}z`)
      .join("");
    const marks = layout.pages
      .map((p, i) => {
        const rr = rectOf({ row: p.rows, column: p.cols });
        const visible =
          rr.x < vx + vw &&
          rr.x + rr.w > vx &&
          rr.y < vy + vh &&
          rr.y + rr.h > vy;
        if (!visible) return null;
        const size = _.clamp(Math.min(rr.w, rr.h) / 4, 16, 96);
        return (
          <text
            key={i}
            x={rr.x - vx + rr.w / 2}
            y={rr.y - vy + rr.h / 2}
            fontSize={size}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fortune-page-watermark"
          >
            {formatText(t.pageWatermark, { n: firstNumber + i })}
          </text>
        );
      })
      .filter(Boolean);
    mask = (
      <svg
        className="fortune-page-break-preview"
        style={{ left: vx, top: vy, width: vw, height: vh }}
        width={vw}
        height={vh}
        aria-hidden="true"
      >
        <path
          className="fortune-page-break-mask"
          fillRule="evenodd"
          d={`M0,0h${vw}v${vh}h${-vw}z${holes}`}
        />
        {marks}
      </svg>
    );
  }

  return (
    <div
      className={`fortune-page-breaks${preview ? " preview" : ""}${
        pageView && !preview ? " page-view" : ""
      }`}
      data-testid="page-breaks"
    >
      {mask}
      {pageFrames}
      {preview &&
        areaRects.map((r, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="fortune-page-area"
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          />
        ))}
      {lines}
      {ghost}
    </div>
  );
};

/**
 * Sheet overlay of the page layout feature: Page Break Preview (page areas,
 * watermarks, draggable breaks), Page Layout view (the pages outlined and
 * numbered), the automatic page breaks of Normal view,
 * and opening Print Preview when Ctrl+P asks for it.
 */
const PageLayoutOverlay: React.FC = () => {
  const request = useWorkbookSelector((c) => c.pageLayout?.printPreviewRequest);
  const preview = useWorkbookSelector((c: Context) => isPageBreakPreview(c));
  const shown = useWorkbookSelector((c: Context) => isShowingPageBreaks(c));
  const pageView = useWorkbookSelector((c: Context) => isPageLayoutView(c));
  const { openPrintPreview } = usePageLayoutDialogs();
  const handled = useRef(request);
  useEffect(() => {
    if (request && request !== handled.current) {
      handled.current = request;
      openPrintPreview();
    }
  }, [request, openPrintPreview]);
  if (!preview && !shown && !pageView) return null;
  return <PageBreaks preview={preview} pageView={pageView} />;
};

export default PageLayoutOverlay;
