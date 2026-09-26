/**
 * Chart placement (Excel's Format Chart Area › Properties):
 *
 * - "twoCell" (move and size with cells, the default): the chart's top-left
 *   and bottom-right corners are anchored to cells (+ pixel offsets), so
 *   the chart moves and stretches when rows/columns are resized, hidden,
 *   inserted or deleted;
 * - "oneCell" (move but don't size with cells): only the top-left corner is
 *   anchored, the size stays;
 * - "absolute" (don't move or size with cells): sheet pixel position.
 *
 * The anchor is the source of truth for the displayed box
 * (`getChartBox`), recomputed from the current row/column geometry on every
 * render. `left`/`top`/`width`/`height` are kept as the last known box (for
 * absolute charts, files without anchors and quick reads).
 */
import type { Context } from "../context";
import type { Chart } from "./chart";
import { locateRangeForChange, ReferenceChange } from "./refAdjust";
import {
  columnLeftPx,
  columnWidthPx,
  insertedSizePx,
  rowHeightPx,
  rowTopPx,
} from "./sheetGeometry";

export type ChartPlacement = "twoCell" | "oneCell" | "absolute";

/** A cell corner plus an offset in pixels at 100% zoom. */
export type ChartAnchorPoint = {
  row: number;
  col: number;
  rowOff: number;
  colOff: number;
};

export type ChartAnchor = { from: ChartAnchorPoint; to: ChartAnchorPoint };

export type ChartBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Axis = "row" | "column";

function startOf(ctx: Context, sheetId: string, axis: Axis, i: number) {
  return axis === "row"
    ? rowTopPx(ctx, sheetId, i)
    : columnLeftPx(ctx, sheetId, i);
}

function sizeOf(ctx: Context, sheetId: string, axis: Axis, i: number) {
  return axis === "row"
    ? rowHeightPx(ctx, sheetId, i)
    : columnWidthPx(ctx, sheetId, i);
}

/** The visible row/column containing sheet pixel `px`, and the offset. */
export function pixelToIndex(
  ctx: Context,
  sheetId: string,
  axis: Axis,
  px: number
): { index: number; offset: number } {
  // hundredths of a px: a position computed through a zoom that lands a
  // hair before a cell edge is on the edge
  const p = Math.round(Math.max(0, px) * 100) / 100;
  // exponential then binary search on the (monotonic) start positions
  let hi = 1;
  while (hi < 1 << 22 && startOf(ctx, sheetId, axis, hi) <= p) hi *= 2;
  let lo = 0;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (startOf(ctx, sheetId, axis, mid) <= p) lo = mid;
    else hi = mid - 1;
  }
  // skip hidden (zero-size) lines that start at the same pixel
  let index = lo;
  let guard = 0;
  while (sizeOf(ctx, sheetId, axis, index) === 0 && guard < 100000) {
    index += 1;
    guard += 1;
  }
  const start = startOf(ctx, sheetId, axis, index);
  return { index, offset: Math.max(0, p - start) };
}

/** Anchor for a pixel box on sheet `sheetId`. */
export function boxToAnchor(
  ctx: Context,
  sheetId: string,
  box: ChartBox
): ChartAnchor {
  const fc = pixelToIndex(ctx, sheetId, "column", box.left);
  const fr = pixelToIndex(ctx, sheetId, "row", box.top);
  const tc = pixelToIndex(ctx, sheetId, "column", box.left + box.width);
  const tr = pixelToIndex(ctx, sheetId, "row", box.top + box.height);
  return {
    from: {
      row: fr.index,
      col: fc.index,
      rowOff: fr.offset,
      colOff: fc.offset,
    },
    to: { row: tr.index, col: tc.index, rowOff: tr.offset, colOff: tc.offset },
  };
}

function pointPx(ctx: Context, sheetId: string, p: ChartAnchorPoint) {
  const colW = columnWidthPx(ctx, sheetId, p.col);
  const rowH = rowHeightPx(ctx, sheetId, p.row);
  return {
    x:
      columnLeftPx(ctx, sheetId, p.col) + Math.min(Math.max(0, p.colOff), colW),
    y: rowTopPx(ctx, sheetId, p.row) + Math.min(Math.max(0, p.rowOff), rowH),
  };
}

/**
 * The chart's box in sheet pixels at 100% zoom for the current geometry.
 * A twoCell chart whose rows or columns are all hidden has a zero size.
 */
export function getChartBox(
  ctx: Context,
  sheetId: string,
  chart: Chart
): ChartBox {
  const stored = {
    left: chart.left,
    top: chart.top,
    width: chart.width,
    height: chart.height,
  };
  const { anchor } = chart;
  const placement = chart.placement ?? "twoCell";
  if (!anchor || placement === "absolute") return stored;
  const from = pointPx(ctx, sheetId, anchor.from);
  if (placement === "oneCell") {
    return { ...stored, left: from.x, top: from.y };
  }
  const to = pointPx(ctx, sheetId, anchor.to);
  return {
    left: from.x,
    top: from.y,
    width: Math.max(0, to.x - from.x),
    height: Math.max(0, to.y - from.y),
  };
}

/** Set a chart's box and re-anchor it to the cells under it. */
export function setChartBox(
  ctx: Context,
  sheetId: string,
  chart: Chart,
  box: ChartBox
) {
  chart.left = box.left;
  chart.top = box.top;
  chart.width = box.width;
  chart.height = box.height;
  chart.anchor = boxToAnchor(ctx, sheetId, box);
}

/** Give a chart without an anchor one (from its stored box). */
export function ensureChartAnchor(ctx: Context, sheetId: string, chart: Chart) {
  if (chart.anchor) return;
  chart.anchor = boxToAnchor(ctx, sheetId, {
    left: chart.left,
    top: chart.top,
    width: chart.width,
    height: chart.height,
  });
}

/** Cells covered by a chart (inclusive), from its anchor. */
export function chartCoveredCells(chart: Chart) {
  const a = chart.anchor!;
  const lastRow = Math.max(
    a.from.row,
    a.to.rowOff > 0 ? a.to.row : a.to.row - 1
  );
  const lastCol = Math.max(
    a.from.col,
    a.to.colOff > 0 ? a.to.col : a.to.col - 1
  );
  return {
    row: [a.from.row, lastRow] as [number, number],
    column: [a.from.col, lastCol] as [number, number],
  };
}

function key(axis: Axis) {
  return axis === "row"
    ? ({ idx: "row", off: "rowOff" } as const)
    : ({ idx: "col", off: "colOff" } as const);
}

function insertPoint(
  p: ChartAnchorPoint,
  axis: Axis,
  index: number,
  count: number,
  isEnd: boolean
) {
  const k = key(axis);
  const at = p[k.idx];
  // the start corner moves when lines are inserted at or before it; the
  // end corner only when they are inserted inside the chart
  if (at > index || (at === index && (!isEnd || p[k.off] > 0)))
    p[k.idx] = at + count;
}

function deletePoint(
  p: ChartAnchorPoint,
  axis: Axis,
  start: number,
  end: number
) {
  const k = key(axis);
  const at = p[k.idx];
  if (at > end) p[k.idx] = at - (end - start + 1);
  else if (at >= start) {
    p[k.idx] = start;
    p[k.off] = 0;
  }
}

/**
 * Move, grow or shrink the charts affected by a structural change (see
 * `adjustChartsForChange`). Called before the cells move, so the pixel
 * geometry is the old one.
 */
export function adjustChartPlacements(ctx: Context, change: ReferenceChange) {
  if (change.type === "renameSheet" || change.type === "deleteSheet") return;
  const sheet = ctx.luckysheetfile.find((s) => s.id === change.sheetId);
  if (!sheet?.charts?.length) return;
  const { sheetId } = change;

  if (change.type === "insert" || change.type === "delete") {
    const { axis } = change;
    const edgeOf = (i: number) => startOf(ctx, sheetId, axis, i);
    sheet.charts.forEach((chart) => {
      const placement = chart.placement ?? "twoCell";
      if (placement === "absolute") return;
      ensureChartAnchor(ctx, sheetId, chart);
      const a = chart.anchor!;
      const posKey = axis === "row" ? "top" : "left";
      const sizeKey = axis === "row" ? "height" : "width";
      const pos = chart[posKey];
      if (change.type === "insert") {
        const edge = edgeOf(change.index);
        const size = insertedSizePx(ctx, axis, change.count);
        const k = key(axis);
        const endInside =
          a.to[k.idx] > change.index ||
          (a.to[k.idx] === change.index && a.to[k.off] > 0);
        const startMoves = a.from[k.idx] >= change.index;
        insertPoint(a.from, axis, change.index, change.count, false);
        if (placement === "twoCell") {
          insertPoint(a.to, axis, change.index, change.count, true);
          if (!startMoves && endInside) chart[sizeKey] += size;
        } else {
          // keep `to` consistent with the unchanged size
          insertPoint(a.to, axis, change.index, change.count, !startMoves);
        }
        if (startMoves || pos >= edge - 0.5) chart[posKey] = pos + size;
        return;
      }
      const from = edgeOf(change.start);
      const to = edgeOf(change.end + 1);
      const removed = to - from;
      const end = pos + chart[sizeKey];
      let nextPos = pos;
      if (pos >= to) nextPos = pos - removed;
      else if (pos > from) nextPos = from;
      deletePoint(a.from, axis, change.start, change.end);
      if (placement === "twoCell") {
        deletePoint(a.to, axis, change.start, change.end);
        let nextEnd = end;
        if (end >= to) nextEnd = end - removed;
        else if (end > from) nextEnd = from;
        chart[sizeKey] = Math.max(0, nextEnd - nextPos);
      } else {
        deletePoint(a.to, axis, change.start, change.end);
      }
      chart[posKey] = nextPos;
    });
    return;
  }

  // Cell shifts and moves: a chart whose cells all move goes with them.
  const moving: { chart: Chart; toSheetId: string }[] = [];
  sheet.charts.forEach((chart) => {
    const placement = chart.placement ?? "twoCell";
    if (placement === "absolute") return;
    ensureChartAnchor(ctx, sheetId, chart);
    const covered = chartCoveredCells(chart);
    const next = locateRangeForChange(covered, change, sheetId);
    if (!next) return;
    const dr = next.range.row[0] - covered.row[0];
    const dc = next.range.column[0] - covered.column[0];
    const sameSize =
      next.range.row[1] - next.range.row[0] ===
        covered.row[1] - covered.row[0] &&
      next.range.column[1] - next.range.column[0] ===
        covered.column[1] - covered.column[0];
    if (!sameSize || (!dr && !dc && next.sheetId === sheetId)) return;
    const a = chart.anchor!;
    const oldTop = rowTopPx(ctx, sheetId, a.from.row);
    const oldLeft = columnLeftPx(ctx, sheetId, a.from.col);
    a.from.row += dr;
    a.from.col += dc;
    a.to.row += dr;
    a.to.col += dc;
    chart.top += rowTopPx(ctx, next.sheetId, a.from.row) - oldTop;
    chart.left += columnLeftPx(ctx, next.sheetId, a.from.col) - oldLeft;
    if (next.sheetId !== sheetId)
      moving.push({ chart, toSheetId: next.sheetId });
  });
  moving.forEach(({ chart, toSheetId }) => {
    const target = ctx.luckysheetfile.find((s) => s.id === toSheetId);
    if (!target) return;
    sheet.charts = sheet.charts!.filter((c) => c !== chart);
    target.charts = [...(target.charts ?? []), chart];
  });
}
