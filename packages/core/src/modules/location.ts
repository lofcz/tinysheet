import _ from "lodash";
import { Context } from "../context";
import { Freezen } from "../types";
import { frozenScrollMin } from "./freeze";

export function mousePosition(x: number, y: number, ctx: Context) {
  const newX = x - ctx.rowHeaderWidth;
  const newY =
    y -
    // ctx.infobarHeight -
    ctx.toolbarHeight -
    ctx.calculatebarHeight -
    ctx.columnHeaderHeight;

  return [newX, newY];
}

export function rowLocationByIndex(row_index: number, visibleRow: number[]) {
  let row = 0;
  let row_pre = 0;
  row = visibleRow[row_index];

  if (row_index === 0) {
    row_pre = 0;
  } else {
    row_pre = visibleRow[row_index - 1];
  }

  return [row_pre, row, row_index];
}

export function rowLocation(y: number, visibleRow: number[]) {
  let row_index = _.sortedIndex(visibleRow, y);

  if (row_index >= visibleRow.length && y > 0) {
    row_index = visibleRow.length - 1;
  } else if (row_index === -1 && y <= 0) {
    row_index = 0;
  }

  return rowLocationByIndex(row_index, visibleRow);
}

export function colLocationByIndex(col_index: number, visibleCol: number[]) {
  let col = 0;
  let col_pre = 0;
  col = visibleCol[col_index];

  if (col_index === 0) {
    col_pre = 0;
  } else {
    col_pre = visibleCol[col_index - 1];
  }

  return [col_pre, col, col_index];
}

export function colLocation(x: number, visibleCol: number[]) {
  let col_index = _.sortedIndex(visibleCol, x);

  if (col_index >= visibleCol.length && x > 0) {
    col_index = visibleCol.length - 1;
  } else if (col_index === -1 && x <= 0) {
    col_index = 0;
  }

  return colLocationByIndex(col_index, visibleCol);
}

/**
 * The row (column) whose bottom (right) border is within `slop` px of
 * `pos` (sheet px, along `edges` = visibledatarow / visibledatacolumn),
 * on either side of it: what a header border drag resizes. -1 when no
 * border is that close. Hidden rows/columns are never picked.
 */
export function borderIndexAt(edges: number[], pos: number, slop = 4) {
  if (edges.length === 0) return -1;
  // the first row/column ending at an edge (skipping hidden ones after it)
  const first = (edge: number) => _.sortedIndex(edges, edge);
  const i = Math.min(_.sortedIndex(edges, pos), edges.length - 1);
  let best = -1;
  let bestDist = slop + 1;
  [i, i - 1].forEach((k) => {
    if (k < 0) return;
    const dist = Math.abs(edges[k] - pos);
    if (dist < bestDist && edges[k] > 0) {
      bestDist = dist;
      best = first(edges[k]);
    }
  });
  return best;
}

/** The visible cell area (headers excluded) that `container` is or holds. */
export function getCellAreaElement(container: HTMLElement): HTMLElement {
  if (container.classList.contains("fortune-cell-area")) return container;
  return (
    container.querySelector<HTMLElement>(".fortune-cell-area") ?? container
  );
}

/**
 * Where a pointer is on the grid. `mouseX`/`mouseY` are relative to the
 * visible cell area (headers excluded); `x`/`y` are sheet coordinates (the
 * scroll and frozen panes applied), like the edges in
 * `ctx.visibledatarow`/`visibledatacolumn`.
 *
 * With `clamp` (a drag), a pointer past an edge of the cell area is taken
 * to that edge, so it hits the first/last visible row or column rather
 * than rows scrolled out of view. A drag anchored (`anchorRow`,
 * `anchorCol`) in the scrolling pane does not reach into the frozen panes
 * until the scrolling pane is scrolled back to its start.
 */
export function getGridPoint(
  ctx: Context,
  freeze: Freezen | undefined,
  e: { clientX: number; clientY: number },
  container: HTMLElement,
  options: { clamp?: boolean; anchorRow?: number; anchorCol?: number } = {}
) {
  const rect = getCellAreaElement(container).getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;
  const hData = freeze?.horizontal?.freezenhorizontaldata;
  const vData = freeze?.vertical?.freezenverticaldata;
  // the part of the cell area the frozen rows / columns cover
  const frozenH = hData ? hData[0] - hData[2] : 0;
  const frozenW = vData ? vData[0] - vData[2] : 0;
  if (options.clamp) {
    const maxX = Math.max(0, (rect.width || ctx.cellmainWidth) - 1);
    const maxY = Math.max(0, (rect.height || ctx.cellmainHeight) - 1);
    mouseX = Math.min(Math.max(mouseX, 0), maxX);
    mouseY = Math.min(Math.max(mouseY, 0), maxY);
    const min = frozenScrollMin(ctx);
    if (
      hData &&
      mouseY < frozenH &&
      options.anchorRow != null &&
      options.anchorRow >= hData[1] &&
      ctx.scrollTop > min.top
    ) {
      mouseY = frozenH;
    }
    if (
      vData &&
      mouseX < frozenW &&
      options.anchorCol != null &&
      options.anchorCol >= vData[1] &&
      ctx.scrollLeft > min.left
    ) {
      mouseX = frozenW;
    }
  }
  let x = mouseX + ctx.scrollLeft;
  let y = mouseY + ctx.scrollTop;
  const inVerticalFreeze = !!vData && mouseX < frozenW;
  const inHorizontalFreeze = !!hData && mouseY < frozenH;
  if (inVerticalFreeze) x = mouseX + vData![2];
  if (inHorizontalFreeze) y = mouseY + hData![2];
  return { mouseX, mouseY, x, y, inHorizontalFreeze, inVerticalFreeze };
}
