/**
 * The shapes drawn in a chart (Format › Insert Shapes): drawn over the
 * chart, picked as chart elements ("shape:<id>"), moved and sized inside
 * the chart (one undo step per drag), text typed after a double-click.
 */
import React, { useContext, useRef, useState } from "react";
import {
  Chart,
  chartAreaCssFilter,
  chartShapeAsShape,
  chartShapeBox,
  ChartShape,
  findChart,
  setChartShapeBox,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { trackPointerDrag } from "../../hooks/pointerDrag";
import ShapeView from "../Shapes/ShapeView";
import ShapeTextEditor from "../Shapes/ShapeTextEditor";

type Box = { left: number; top: number; width: number; height: number };
type Handle = "lt" | "mt" | "rt" | "lm" | "rm" | "lb" | "mb" | "rb";
const HANDLES: Handle[] = ["lt", "mt", "rt", "lm", "rm", "lb", "mb", "rb"];

function resize(orig: Box, h: Handle, dx: number, dy: number): Box {
  let { left, top, width, height } = orig;
  if (h[0] === "l") {
    const w = Math.max(4, width - dx);
    left += width - w;
    width = w;
  } else if (h[0] === "r") width = Math.max(4, width + dx);
  if (h[1] === "t") {
    const hh = Math.max(4, height - dy);
    top += height - hh;
    height = hh;
  } else if (h[1] === "b") height = Math.max(4, height + dy);
  return { left, top, width, height };
}

export const ChartShapes: React.FC<{
  chart: Chart;
  zoom: number;
  /** The pane copy that takes the pointer (the others only draw). */
  interactive: boolean;
}> = ({ chart, zoom, interactive }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const [drag, setDrag] = useState<{ id: string; box: Box } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const readonly = context.allowEdit === false;
  const selected =
    context.activeChart === chart.id &&
    (context.chartElement ?? "").startsWith("shape:")
      ? (context.chartElement as string).slice(6)
      : null;
  if (!chart.shapes?.length) return null;

  const select = (id: string) =>
    setContext(
      (ctx) => {
        ctx.activeChart = chart.id;
        ctx.chartElement = `shape:${id}`;
      },
      { noHistory: true }
    );

  const start = (e: React.MouseEvent, s: ChartShape, mode: "move" | Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement)
      .closest<HTMLElement>(".fortune-chart-box")
      ?.focus({ preventScroll: true });
    if (selected !== s.id) select(s.id);
    if (readonly) return;
    const orig = chartShapeBox(chart, s);
    let current = orig;
    let moved = false;
    stop.current?.();
    stop.current = trackPointerDrag(e, {
      onMove: (ev) => {
        const dx = (ev.pageX - e.pageX) / zoom;
        const dy = (ev.pageY - e.pageY) / zoom;
        if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        moved = true;
        current =
          mode === "move"
            ? { ...orig, left: orig.left + dx, top: orig.top + dy }
            : resize(orig, mode, dx, dy);
        setDrag({ id: s.id, box: current });
      },
      onEnd: () => {
        stop.current = null;
        setDrag(null);
        if (!moved) return;
        setContext((ctx) => {
          const f = findChart(ctx, chart.id);
          if (f) setChartShapeBox(f.chart, s.id, current);
        });
      },
      onCancel: () => {
        stop.current = null;
        setDrag(null);
      },
    });
  };

  return (
    <div className="fortune-chart-shapes">
      {chart.shapes.map((s) => {
        const box = drag?.id === s.id ? drag.box : chartShapeBox(chart, s);
        const isSelected = interactive && selected === s.id;
        const shape = chartShapeAsShape(s);
        return (
          <div
            key={s.id}
            className={`fortune-chart-shape${
              isSelected ? " fortune-chart-shape--selected" : ""
            }${editing === s.id ? " fortune-shape-editing" : ""}`}
            data-chart-shape={s.id}
            data-chart-el={`shape:${s.id}`}
            style={{
              left: box.left * zoom,
              top: box.top * zoom,
              width: box.width * zoom,
              height: box.height * zoom,
              transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
              filter: chartAreaCssFilter(s.effects),
              pointerEvents: interactive ? undefined : "none",
            }}
            onMouseDown={(e) => start(e, s, "move")}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (readonly || shape.prst === "line") return;
              select(s.id);
              setEditing(s.id);
            }}
          >
            <ShapeView
              shape={shape}
              width={box.width}
              height={box.height}
              zoom={zoom}
              editor={
                editing === s.id ? (
                  <ShapeTextEditor
                    shape={shape}
                    onDone={(text) => {
                      setEditing(null);
                      if (!text) return;
                      setContext((ctx) => {
                        const f = findChart(ctx, chart.id);
                        const target = f?.chart.shapes?.find(
                          (x) => x.id === s.id
                        );
                        if (target) target.text = text;
                      });
                    }}
                    onExit={() => setEditing(null)}
                  />
                ) : undefined
              }
            />
            {isSelected && !readonly && editing !== s.id && (
              <>
                <div className="fortune-chart-shape-outline" />
                {HANDLES.map((h) => (
                  <div
                    key={h}
                    className={`fortune-chart-shape-handle ${h}`}
                    data-handle={h}
                    onMouseDown={(e) => start(e, s, h)}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChartShapes;
