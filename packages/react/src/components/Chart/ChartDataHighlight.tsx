/**
 * The selected chart's data outlined on its sheet, as Excel does: series
 * names in red, category labels (X values) in purple, values in blue, each
 * with square handles at its corners. Dragging a corner resizes the data
 * (adds or removes points and series), dragging an edge moves it; the
 * chart follows live and the drag is one undo step (Esc cancels).
 *
 * When the series form one block, the three outlines stand for the whole
 * block; otherwise (or when one series is selected) every reference of
 * the series is outlined on its own and a drag changes that reference.
 */
import React, { useCallback, useContext, useRef } from "react";
import _ from "lodash";
import {
  applyChartDataBlock,
  Chart,
  chartDataBlockRects,
  ChartDataBlock,
  chartRangeAreas,
  ChartRange,
  ChartRangeArea,
  Context,
  findChart,
  getChartDataBlock,
  getGridPoint,
  reshapeChartDataBlock,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { trackPointerDrag } from "../../hooks/pointerDrag";
import { assignChartData } from "./dialogs/SelectDataDialog";
import { paneClipPath, placeInPanes } from "./panes";

/** Excel's outline colours (the suite's reference palette). */
export const CHART_RANGE_COLORS = {
  names: "#ff616b",
  categories: "#a970f0",
  values: "#5b97ff",
  sizes: "#3dae5c",
} as const;

type Part = keyof typeof CHART_RANGE_COLORS;
type Corner = "lt" | "rt" | "lb" | "rb";

type Outline = {
  key: string;
  part: Part;
  area: ChartRangeArea;
  /** Apply the outline's new rectangle to a copy of the chart. */
  reshape: (chart: Chart, to: ChartRangeArea) => boolean;
};

const REF_FIELDS: {
  part: Part;
  field: "nameRef" | "categories" | "values" | "sizes";
}[] = [
  { part: "names", field: "nameRef" },
  { part: "categories", field: "categories" },
  { part: "values", field: "values" },
  { part: "sizes", field: "sizes" },
];

/** A block is usable: spans at least one line, names / labels outside. */
function validBlock(b: ChartDataBlock) {
  if (b.points[0] < 0 || b.series[0] < 0) return false;
  if (b.points[1] < b.points[0] || b.series[1] < b.series[0]) return false;
  if (
    b.nameAt != null &&
    (b.nameAt < 0 || (b.nameAt >= b.points[0] && b.nameAt <= b.points[1]))
  )
    return false;
  if (
    b.categoryAt != null &&
    (b.categoryAt < 0 ||
      (b.categoryAt >= b.series[0] && b.categoryAt <= b.series[1]))
  )
    return false;
  return true;
}

/** The outlines of a chart on sheet `sheetId`. */
function chartOutlines(
  chart: Chart,
  sheetId: string,
  element: string
): Outline[] {
  const m = /^series:(\d+)$/.exec(element);
  const block = m ? null : getChartDataBlock(chart);
  if (block && block.sheetId === sheetId) {
    const rects = chartDataBlockRects(block);
    const out: Outline[] = [];
    (["names", "categories", "values"] as const).forEach((part) => {
      const area = rects[part];
      if (!area) return;
      out.push({
        key: `block-${part}`,
        part,
        area,
        reshape: (c, to) => {
          const current = getChartDataBlock(c);
          if (!current) return false;
          const next = reshapeChartDataBlock(current, part, to);
          if (!validBlock(next)) return false;
          applyChartDataBlock(c, next);
          return true;
        },
      });
    });
    return out;
  }
  const out: Outline[] = [];
  chart.series.forEach((s, i) => {
    if (m && Number(m[1]) !== i) return;
    if (s.filtered && !m) return;
    REF_FIELDS.forEach(({ part, field }) => {
      const ref = s[field] as ChartRange | null | undefined;
      if (!ref || (field === "nameRef" && s.name)) return;
      chartRangeAreas(ref).forEach((area, ai) => {
        if (area.sheetId !== sheetId) return;
        out.push({
          key: `s${i}-${field}-${ai}`,
          part,
          area,
          reshape: (c, to) => {
            const target = c.series[i];
            const r = target?.[field] as ChartRange | null | undefined;
            if (!r) return false;
            const areas = chartRangeAreas(r);
            areas[ai] = to;
            const [first, ...rest] = areas;
            (target as Record<string, unknown>)[field] = rest.length
              ? { ...first, areas: rest }
              : {
                  sheetId: first.sheetId,
                  row: first.row,
                  column: first.column,
                };
            return true;
          },
        });
      });
    });
  });
  return out;
}

/** Row / column of a sheet position (px, zoomed) from the visible lines. */
function lineAt(edges: number[], pos: number) {
  let lo = 0;
  let hi = edges.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (edges[mid] < pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const ChartDataHighlight: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const drag = useRef<{ stop: () => void } | null>(null);
  const chartId = context.activeChart;
  const found = findChart(context, chartId);
  const sheetId = context.currentSheetId;
  const element = context.chartElement ?? "chartArea";

  const freeze = refs.globalCache.freezen?.[context.currentSheetId];
  // the cell under the pointer, in the frozen panes too
  const cellAt = useCallback(
    (ctx: Context, e: MouseEvent) => {
      const area = refs.cellArea.current;
      if (!area) return null;
      const { x, y } = getGridPoint(ctx, freeze, e, area, { clamp: true });
      return {
        r: lineAt(ctx.visibledatarow, y),
        c: lineAt(ctx.visibledatacolumn, x),
      };
    },
    [refs.cellArea, freeze]
  );

  if (!found || found.sheet.id !== sheetId) return null;
  const { chart } = found;
  const outlines = chartOutlines(chart, sheetId, element);
  if (outlines.length === 0) return null;
  const readonly = context.allowEdit === false;
  const rows = context.visibledatarow;
  const cols = context.visibledatacolumn;
  const boxOf = (a: ChartRangeArea) => {
    const top = a.row[0] > 0 ? (rows[a.row[0] - 1] ?? 0) : 0;
    const left = a.column[0] > 0 ? (cols[a.column[0] - 1] ?? 0) : 0;
    const bottom = rows[Math.min(a.row[1], rows.length - 1)] ?? top;
    const right = cols[Math.min(a.column[1], cols.length - 1)] ?? left;
    return { left, top, width: right - left, height: bottom - top };
  };

  const start = (
    e: React.PointerEvent<HTMLElement>,
    outline: Outline,
    mode: "move" | Corner
  ) => {
    if (e.button !== 0 || readonly) return;
    e.preventDefault();
    e.stopPropagation();
    const original: Chart = _.cloneDeep(chart);
    const from = cellAt(context, e.nativeEvent);
    if (!from) return;
    const a = outline.area;
    let last = "";
    let changed: Chart | null = null;
    const toArea = (cell: { r: number; c: number }): ChartRangeArea => {
      if (mode === "move") {
        const dr = Math.max(-a.row[0], cell.r - from.r);
        const dc = Math.max(-a.column[0], cell.c - from.c);
        return {
          sheetId: a.sheetId,
          row: [a.row[0] + dr, a.row[1] + dr],
          column: [a.column[0] + dc, a.column[1] + dc],
        };
      }
      // the opposite corner stays
      const fixedR = mode[1] === "t" ? a.row[1] : a.row[0];
      const fixedC = mode[0] === "l" ? a.column[1] : a.column[0];
      return {
        sheetId: a.sheetId,
        row: [Math.min(fixedR, cell.r), Math.max(fixedR, cell.r)],
        column: [Math.min(fixedC, cell.c), Math.max(fixedC, cell.c)],
      };
    };
    const show = (next: Chart) =>
      setContext((ctx) => assignChartData(ctx, chart.id, next), {
        noHistory: true,
      });
    drag.current?.stop();
    const stop = trackPointerDrag(e, {
      onMove: (ev) => {
        const cell = cellAt(context, ev);
        if (!cell) return;
        const to = toArea(cell);
        const key = `${to.row.join()}|${to.column.join()}`;
        if (key === last) return;
        last = key;
        const next: Chart = _.cloneDeep(original);
        if (!outline.reshape(next, to)) return;
        changed = next;
        show(next);
      },
      onEnd: () => {
        drag.current = null;
        if (!changed) return;
        const final = changed;
        // one undo step from the chart as it was
        show(original);
        setContext((ctx) => assignChartData(ctx, chart.id, final));
      },
      onCancel: () => {
        drag.current = null;
        if (changed) show(original);
      },
    });
    drag.current = { stop };
  };

  return (
    <div className="fortune-chart-ranges" data-chart={chart.id}>
      {outlines.flatMap((o) => {
        const color = CHART_RANGE_COLORS[o.part];
        const cells = boxOf(o.area);
        const box = {
          left: cells.left - 1,
          top: cells.top - 1,
          width: cells.width + 1,
          height: cells.height + 1,
        };
        // one copy per frozen pane the range shows in (Excel)
        return placeInPanes(context, freeze, box).map((pane) => (
          <div
            key={`${o.key}-${pane.clip.join()}`}
            className="fortune-chart-range"
            data-part={o.part}
            data-pane={pane.primary ? undefined : "frozen"}
            style={{
              left: pane.left,
              top: pane.top,
              width: box.width,
              height: box.height,
              clipPath: paneClipPath(pane, 6),
              borderColor: color,
              background: `${color}14`,
            }}
          >
            {(["top", "right", "bottom", "left"] as const).map((edge) => (
              <div
                key={edge}
                className={`fortune-chart-range-edge ${edge}`}
                data-edge={edge}
                onPointerDown={(e) => start(e, o, "move")}
              />
            ))}
            {(["lt", "rt", "lb", "rb"] as const).map((c) => (
              <div
                key={c}
                className={`fortune-chart-range-handle ${c}`}
                data-corner={c}
                style={{ background: color }}
                onPointerDown={(e) => start(e, o, c)}
              />
            ))}
          </div>
        ));
      })}
    </div>
  );
};

export default ChartDataHighlight;
