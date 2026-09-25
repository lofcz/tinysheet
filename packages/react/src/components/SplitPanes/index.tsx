import {
  getSheetIndex,
  locale,
  scrollSplitPane,
  setSplitPosition,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useCallback, useContext, useEffect, useState } from "react";
import WorkbookContext from "../../context";
import "./index.css";

const BAR = 6;

/**
 * Split panes (View > Split): draggable split bars over the sheet, and
 * wheel scrolling of the top / left panes (the bottom-right pane scrolls
 * with the sheet's scrollbars). Dragging a bar to the headers removes it.
 */
const SplitPanes: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { freezen } = locale(context);
  const [drag, setDrag] = useState<{
    axis: "row" | "column";
    pos: number;
  } | null>(null);

  const idx = getSheetIndex(context, context.currentSheetId);
  const frozen = idx == null ? undefined : context.luckysheetfile[idx]?.frozen;
  const split = frozen?.split ? frozen : undefined;
  const hasRows =
    !!split && (split.type === "rangeRow" || split.type === "rangeBoth");
  const hasCols =
    !!split && (split.type === "rangeColumn" || split.type === "rangeBoth");
  const rows = context.visibledatarow;
  const cols = context.visibledatacolumn;

  // pane sizes in px (without headers)
  const paneHeight = hasRows
    ? (rows[split!.range?.row_focus ?? 0] ?? 0) -
      ((split!.top ?? 0) > 0 ? rows[(split!.top ?? 0) - 1] ?? 0 : 0)
    : 0;
  const paneWidth = hasCols
    ? (cols[split!.range?.column_focus ?? 0] ?? 0) -
      ((split!.left ?? 0) > 0 ? cols[(split!.left ?? 0) - 1] ?? 0 : 0)
    : 0;

  // wheel over the top / left pane scrolls that pane only
  useEffect(() => {
    const area = refs.cellArea.current;
    if (!area || !split) return undefined;
    const onWheel = (e: WheelEvent) => {
      const rect = area.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inTop = hasRows && y < paneHeight;
      const inLeft = hasCols && x < paneWidth;
      if (!inTop && !inLeft) return;
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX || e.deltaY : e.deltaY;
      const steps =
        Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 60));
      if (horizontal && !inLeft) return;
      if (!horizontal && !inTop) return;
      e.preventDefault();
      e.stopPropagation();
      setContext(
        (ctx) => {
          scrollSplitPane(ctx, horizontal ? "column" : "row", steps);
        },
        { noHistory: true }
      );
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [
    hasCols,
    hasRows,
    paneHeight,
    paneWidth,
    refs.cellArea,
    setContext,
    split,
  ]);

  const startDrag = useCallback(
    (axis: "row" | "column", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const overlay = (e.currentTarget as HTMLElement).parentElement;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const posOf = (ev: MouseEvent | React.MouseEvent) =>
        axis === "row" ? ev.clientY - rect.top : ev.clientX - rect.left;
      setDrag({ axis, pos: posOf(e) });
      const onMove = (ev: MouseEvent) => setDrag({ axis, pos: posOf(ev) });
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setDrag(null);
        const pos = posOf(ev);
        setContext((ctx) => {
          const i = getSheetIndex(ctx, ctx.currentSheetId);
          const f = i == null ? undefined : ctx.luckysheetfile[i]?.frozen;
          if (!f?.split) return;
          if (axis === "row") {
            const inPane = pos - ctx.columnHeaderHeight;
            if (inPane < 8) {
              setSplitPosition(ctx, "row", null);
              return;
            }
            const offset =
              (f.top ?? 0) > 0 ? ctx.visibledatarow[f.top! - 1] : 0;
            const r = _.sortedIndex(ctx.visibledatarow, offset + inPane);
            setSplitPosition(ctx, "row", Math.max(0, r - 1));
          } else {
            const inPane = pos - ctx.rowHeaderWidth;
            if (inPane < 8) {
              setSplitPosition(ctx, "column", null);
              return;
            }
            const offset =
              (f.left ?? 0) > 0 ? ctx.visibledatacolumn[f.left! - 1] : 0;
            const c = _.sortedIndex(ctx.visibledatacolumn, offset + inPane);
            setSplitPosition(ctx, "column", Math.max(0, c - 1));
          }
        });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [setContext]
  );

  if (!split) return null;

  return (
    <>
      {hasRows && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fortune-split-bar fortune-split-bar-h"
          role="separator"
          aria-orientation="horizontal"
          aria-label={freezen.splitPanes}
          style={{ top: context.columnHeaderHeight + paneHeight - BAR / 2 }}
          onMouseDown={(e) => startDrag("row", e)}
        />
      )}
      {hasCols && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fortune-split-bar fortune-split-bar-v"
          role="separator"
          aria-orientation="vertical"
          aria-label={freezen.splitPanes}
          style={{ left: context.rowHeaderWidth + paneWidth - BAR / 2 }}
          onMouseDown={(e) => startDrag("column", e)}
        />
      )}
      {drag && (
        <div
          className={`fortune-split-ghost fortune-split-ghost-${
            drag.axis === "row" ? "h" : "v"
          }`}
          style={
            drag.axis === "row"
              ? { top: drag.pos - BAR / 2 }
              : { left: drag.pos - BAR / 2 }
          }
        />
      )}
    </>
  );
};

export default SplitPanes;
