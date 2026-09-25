import _ from "lodash";
import {
  colLocationByIndex,
  Context,
  Freezen,
  getSheetIndex,
  GlobalCache,
  isAllowEdit,
  rowLocationByIndex,
  Sheet,
} from "..";

function cutVolumn(arr: number[], cutindex: number) {
  if (cutindex <= 0) {
    return arr;
  }
  const ret = arr.slice(cutindex);
  return ret;
}

type Frozen = NonNullable<Sheet["frozen"]>;

function currentSheetFile(ctx: Context): Sheet | null {
  const i = getSheetIndex(ctx, ctx.currentSheetId);
  return i == null ? null : ctx.luckysheetfile[i];
}

/** Pixel start of row/column `index`. */
function startPx(positions: number[], index: number) {
  return index > 0 ? positions?.[index - 1] ?? 0 : 0;
}

/** First row and column shown by frozen panes (the window's top-left). */
function frozenTopLeft(frozen: Frozen): [number, number] {
  return [Math.max(0, frozen.top ?? 0), Math.max(0, frozen.left ?? 0)];
}

/**
 * Which rows and columns a sheet has frozen, as Excel shows them: the first
 * frozen row/column and how many there are (0 when none).
 */
export function getFrozenCells(
  sheet: Pick<Sheet, "frozen"> | null | undefined
) {
  const frozen = sheet?.frozen;
  const out = { top: 0, rows: 0, left: 0, columns: 0, split: false };
  if (!frozen) return out;
  const rf = frozen.range?.row_focus ?? 0;
  const cf = frozen.range?.column_focus ?? 0;
  const [top, left] = frozenTopLeft(frozen);
  out.split = !!frozen.split;
  if (frozen.type === "row") {
    out.rows = 1;
  } else if (frozen.type === "column") {
    out.columns = 1;
  } else if (frozen.type === "both") {
    out.rows = frozen.range ? rf + 1 : 1;
    out.columns = frozen.range ? cf + 1 : 1;
  } else {
    if (frozen.type !== "rangeColumn") {
      out.top = top;
      out.rows = Math.max(0, rf - top + 1);
    }
    if (frozen.type !== "rangeRow") {
      out.left = left;
      out.columns = Math.max(0, cf - left + 1);
    }
  }
  return out;
}

/**
 * The smallest scroll offsets of the current sheet. Frozen panes that start
 * below/right of the first row/column (frozen from a scrolled position)
 * keep the scrolling pane from scrolling back over the frozen rows/columns:
 * at the minimum it starts right after them.
 */
export function frozenScrollMin(ctx: Context) {
  const sheet = currentSheetFile(ctx);
  const frozen = sheet?.frozen;
  if (!frozen || frozen.split) return { top: 0, left: 0 };
  const { top, rows, left, columns } = getFrozenCells(sheet);
  return {
    top: rows > 0 ? startPx(ctx.visibledatarow, top) : 0,
    left: columns > 0 ? startPx(ctx.visibledatacolumn, left) : 0,
  };
}

/** Keeps the scroll offsets at or past {@link frozenScrollMin}. */
export function clampFrozenScroll(ctx: Context) {
  const min = frozenScrollMin(ctx);
  let changed = false;
  if (ctx.scrollTop < min.top) {
    ctx.scrollTop = min.top;
    changed = true;
  }
  if (ctx.scrollLeft < min.left) {
    ctx.scrollLeft = min.left;
    changed = true;
  }
  return changed;
}

function frozenTofreezen(ctx: Context, cache: GlobalCache, sheetId: string) {
  // get frozen type
  const file = ctx.luckysheetfile[getSheetIndex(ctx, sheetId)!];
  const { frozen } = file;

  if (frozen == null) {
    delete cache.freezen;
    return;
  }

  const freezen: Freezen = {};

  let { range } = frozen;
  if (!range) {
    range = {
      row_focus: 0,
      column_focus: 0,
    };
  }
  let { type } = frozen;
  if (type === "row") {
    type = "rangeRow";
  } else if (type === "column") {
    type = "rangeColumn";
  } else if (type === "both") {
    type = "rangeBoth";
  }

  // The top/left pane starts at row `top` / column `left` instead of the
  // first row/column: frozen panes keep the rows/columns that were scrolled
  // out when they were frozen hidden (Excel), split panes scroll it.
  const splitTop = Math.max(0, frozen.top ?? 0);
  const splitLeft = Math.max(0, frozen.left ?? 0);

  // transform to freezen
  if (type === "rangeRow" || type === "rangeBoth") {
    const scrollTop = splitTop > 0 ? ctx.visibledatarow[splitTop - 1] ?? 0 : 0;
    let row_st = _.sortedIndex(ctx.visibledatarow, scrollTop);

    const { row_focus } = range;

    if (row_focus > row_st) {
      row_st = row_focus;
    }

    if (row_st === -1) {
      row_st = 0;
    }

    const top =
      ctx.visibledatarow[row_st] - 2 - scrollTop + ctx.columnHeaderHeight;
    const freezenhorizontaldata = [
      ctx.visibledatarow[row_st],
      row_st + 1,
      scrollTop,
      cutVolumn(ctx.visibledatarow, row_st + 1),
      top,
    ];

    freezen.horizontal = {
      freezenhorizontaldata,
      top,
    };
  }
  if (type === "rangeColumn" || type === "rangeBoth") {
    const scrollLeft =
      splitLeft > 0 ? ctx.visibledatacolumn[splitLeft - 1] ?? 0 : 0;
    let col_st = _.sortedIndex(ctx.visibledatacolumn, scrollLeft);

    const { column_focus } = range;

    if (column_focus > col_st) {
      col_st = column_focus;
    }

    if (col_st === -1) {
      col_st = 0;
    }

    const left =
      ctx.visibledatacolumn[col_st] - 2 - scrollLeft + ctx.rowHeaderWidth;
    const freezenverticaldata = [
      ctx.visibledatacolumn[col_st],
      col_st + 1,
      scrollLeft,
      cutVolumn(ctx.visibledatacolumn, col_st + 1),
      left,
    ];

    freezen.vertical = {
      freezenverticaldata,
      left,
    };
  }

  cache.freezen ||= {};
  cache.freezen[ctx.currentSheetId] = freezen;
}

export function initFreeze(ctx: Context, cache: GlobalCache, sheetId: string) {
  frozenTofreezen(ctx, cache, sheetId);
}

export function scrollToFrozenRowCol(
  ctx: Context,
  freeze: Freezen | undefined
) {
  const select_save = ctx.luckysheet_select_save;
  if (!select_save) return;

  let row;
  const { row_focus } = select_save[0];
  if (row_focus === select_save[0].row[0]) {
    [, row] = select_save[0].row;
  } else if (row_focus === select_save[0].row[1]) {
    [row] = select_save[0].row;
  }

  let column;
  const { column_focus } = select_save[0];
  if (column_focus === select_save[0].column[0]) {
    [, column] = select_save[0].column;
  } else if (column_focus === select_save[0].column[1]) {
    [column] = select_save[0].column;
  }

  const freezenverticaldata = freeze?.vertical?.freezenverticaldata;
  const freezenhorizontaldata = freeze?.horizontal?.freezenhorizontaldata;

  if (freezenverticaldata != null && column != null) {
    let freezen_colindex = freezenverticaldata[1];

    const offset = _.sortedIndex(freezenverticaldata[3], ctx.scrollLeft);

    const top = freezenverticaldata[4];

    freezen_colindex += offset;

    if (column >= ctx.visibledatacolumn.length) {
      column = ctx.visibledatacolumn.length - 1;
    }

    if (freezen_colindex >= ctx.visibledatacolumn.length) {
      freezen_colindex = ctx.visibledatacolumn.length - 1;
    }

    const column_px = ctx.visibledatacolumn[column];
    const freezen_px = ctx.visibledatacolumn[freezen_colindex];

    if (column_px <= freezen_px + top) {
      ctx.scrollLeft = frozenScrollMin(ctx).left;
      // setTimeout(function () {
      //   $("#luckysheet-scrollbar-x").scrollLeft(0);
      // }, 100);
    }
  }

  if (freezenhorizontaldata != null && row != null) {
    let freezen_rowindex = freezenhorizontaldata[1];

    const offset = _.sortedIndex(freezenhorizontaldata[3], ctx.scrollTop);

    const left = freezenhorizontaldata[4];

    freezen_rowindex += offset;

    if (row >= ctx.visibledatarow.length) {
      row = ctx.visibledatarow.length - 1;
    }

    if (freezen_rowindex >= ctx.visibledatarow.length) {
      freezen_rowindex = ctx.visibledatarow.length - 1;
    }

    const row_px = ctx.visibledatarow[row];
    const freezen_px = ctx.visibledatarow[freezen_rowindex];

    if (row_px <= freezen_px + left) {
      ctx.scrollTop = frozenScrollMin(ctx).top;
      // setTimeout(function () {
      //   $("#luckysheet-scrollbar-y").scrollTop(0);
      // }, 100);
    }
  }
}

export function getFrozenHandleTop(ctx: Context) {
  const idx = getSheetIndex(ctx, ctx.currentSheetId);
  if (idx == null) return ctx.scrollTop;

  const sheet = ctx.luckysheetfile[idx];
  if (
    sheet?.frozen?.type === "row" ||
    sheet?.frozen?.type === "rangeRow" ||
    sheet?.frozen?.type === "rangeBoth" ||
    sheet?.frozen?.type === "both"
  ) {
    return (
      rowLocationByIndex(
        sheet?.frozen?.range?.row_focus || 0,
        ctx.visibledatarow
      )[1] + ctx.scrollTop
    );
  }
  return ctx.scrollTop;
}

export function getFrozenHandleLeft(ctx: Context) {
  const idx = getSheetIndex(ctx, ctx.currentSheetId);
  if (idx == null) return ctx.scrollLeft;

  const sheet = ctx.luckysheetfile[idx];
  if (
    sheet?.frozen?.type === "column" ||
    sheet?.frozen?.type === "rangeColumn" ||
    sheet?.frozen?.type === "rangeBoth" ||
    sheet?.frozen?.type === "both"
  ) {
    return (
      colLocationByIndex(
        sheet?.frozen?.range?.column_focus || 0,
        ctx.visibledatacolumn
      )[1] -
      2 +
      ctx.scrollLeft
    );
  }
  return ctx.scrollLeft;
}

/* ------------------------------------------------------------------------ */
/* Excel's Freeze Panes menu and Split                                       */
/* ------------------------------------------------------------------------ */

export type FreezeMode = "panes" | "topRow" | "firstColumn" | "unfreeze";

/** Active cell, moved to the top-left cell of a merge. */
function activeCellForFreeze(ctx: Context): [number, number] {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return [0, 0];
  let r = last.row_focus ?? last.row[0];
  let c = last.column_focus ?? last.column[0];
  const cell =
    ctx.luckysheetfile[getSheetIndex(ctx, ctx.currentSheetId)!]?.data?.[r]?.[c];
  if (cell?.mc) {
    r = cell.mc.r;
    c = cell.mc.c;
  }
  return [r, c];
}

/**
 * The first row/column visible at `scroll` (Excel scrolls whole rows: one
 * scrolled more than half out counts as scrolled out).
 */
function firstVisibleIndex(positions: number[], scroll: number) {
  if (!positions?.length || !(scroll > 0)) return 0;
  const last = positions.length - 1;
  const i = Math.min(last, _.sortedLastIndex(positions, scroll));
  const start = i > 0 ? positions[i - 1] : 0;
  if (i < last && positions[i] - scroll < (positions[i] - start) / 2) {
    return i + 1;
  }
  return i;
}

/** Index of the row/column under the middle of the visible area. */
function middleIndex(positions: number[], size: number, scroll = 0) {
  if (!positions?.length || !(size > 0)) return 0;
  return Math.max(
    0,
    Math.min(
      positions.length - 1,
      _.sortedIndex(positions, Math.max(0, scroll) + size / 2)
    )
  );
}

/** The top-left visible cell of the (unfrozen) sheet. */
function visibleTopLeft(ctx: Context): [number, number] {
  return [
    firstVisibleIndex(ctx.visibledatarow, ctx.scrollTop),
    firstVisibleIndex(ctx.visibledatacolumn, ctx.scrollLeft),
  ];
}

/**
 * Frozen/split state for panes that start at row `r` / column `c` (the
 * active cell): the rows from the top visible row `top` down to `r - 1` and
 * the columns from the left visible column `left` to `c - 1` go to the
 * top/left panes. When the active cell is the top-left visible cell (or
 * above/left of it) Excel splits in the middle of the window.
 */
function panesAt(
  ctx: Context,
  r: number,
  c: number,
  [top, left]: [number, number] = [0, 0]
): Frozen | null {
  let row = r;
  let col = c;
  if (row <= top && col <= left) {
    const rowsFrom = startPx(ctx.visibledatarow, top);
    const colsFrom = startPx(ctx.visibledatacolumn, left);
    row =
      Math.max(
        top,
        middleIndex(ctx.visibledatarow, ctx.cellmainHeight, rowsFrom)
      ) + 1;
    col =
      Math.max(
        left,
        middleIndex(ctx.visibledatacolumn, ctx.cellmainWidth, colsFrom)
      ) + 1;
  }
  const rows = row > top;
  const cols = col > left;
  if (!rows && !cols) return null;
  let type: Frozen["type"] = "rangeColumn";
  if (rows && cols) type = "rangeBoth";
  else if (rows) type = "rangeRow";
  const frozen: Frozen = {
    type,
    range: {
      row_focus: rows ? row - 1 : 0,
      column_focus: cols ? col - 1 : 0,
    },
  };
  if (rows && top > 0) frozen.top = top;
  if (cols && left > 0) frozen.left = left;
  return frozen;
}

/** Whether frozen rows/columns would leave no room for the scrolling pane. */
function frozenAreaTooLarge(ctx: Context, frozen: Frozen) {
  const rf = frozen.range?.row_focus ?? 0;
  const cf = frozen.range?.column_focus ?? 0;
  const rows = frozen.type === "rangeRow" || frozen.type === "rangeBoth";
  const cols = frozen.type === "rangeColumn" || frozen.type === "rangeBoth";
  if (rows && ctx.cellmainHeight > 0 && ctx.visibledatarow?.length) {
    const h =
      (ctx.visibledatarow[rf] ?? 0) -
      startPx(ctx.visibledatarow, frozen.top ?? 0);
    if (h > ctx.cellmainHeight - 20) return true;
  }
  if (cols && ctx.cellmainWidth > 0 && ctx.visibledatacolumn?.length) {
    const w =
      (ctx.visibledatacolumn[cf] ?? 0) -
      startPx(ctx.visibledatacolumn, frozen.left ?? 0);
    if (w > ctx.cellmainWidth - 20) return true;
  }
  return false;
}

/**
 * Excel's View > Freeze Panes menu, from the current scroll position:
 * - "panes": the rows above and columns left of the active cell, starting at
 *   the top-left visible cell (at the top-left visible cell itself, the
 *   middle of the window);
 * - "topRow" / "firstColumn": the top visible row / left visible column;
 * - "unfreeze": removes frozen panes (and a split) and scrolls back so the
 *   first frozen row/column is at the top/left of the window again.
 * Rows/columns scrolled out above/left of the window when freezing are not
 * shown until unfreeze (Excel), and the scrolling pane continues right after
 * the frozen part. A frozen part larger than the window is allowed and
 * clipped, like Excel (never "tooLarge"). `dryRun` only checks.
 */
export function freezePanes(
  ctx: Context,
  mode: FreezeMode,
  options: { dryRun?: boolean } = {}
): "ok" | "tooLarge" | "noop" {
  if (!isAllowEdit(ctx)) return "noop";
  const sheet = currentSheetFile(ctx);
  if (!sheet) return "noop";
  if (mode === "unfreeze") {
    if (options.dryRun) return "ok";
    const prev = sheet.frozen;
    delete sheet.frozen;
    if (prev && !prev.split) {
      // the first frozen row/column is at the top-left of the window again
      const { top, rows, left, columns } = getFrozenCells({ frozen: prev });
      if (rows > 0) ctx.scrollTop = startPx(ctx.visibledatarow, top);
      if (columns > 0) ctx.scrollLeft = startPx(ctx.visibledatacolumn, left);
    }
    return "ok";
  }
  // re-freezing works from what the window shows now
  const current = sheet.frozen && !sheet.frozen.split ? sheet.frozen : null;
  const [top, left] = current ? frozenTopLeft(current) : visibleTopLeft(ctx);
  let frozen: Frozen | null;
  if (mode === "topRow") {
    frozen = { type: "rangeRow", range: { row_focus: top, column_focus: 0 } };
    if (top > 0) frozen.top = top;
  } else if (mode === "firstColumn") {
    frozen = {
      type: "rangeColumn",
      range: { row_focus: 0, column_focus: left },
    };
    if (left > 0) frozen.left = left;
  } else {
    const [r, c] = activeCellForFreeze(ctx);
    frozen = panesAt(ctx, r, c, [top, left]);
  }
  if (!frozen) return "noop";
  if (options.dryRun) return "ok";
  sheet.frozen = frozen;
  // the scrolling pane continues right after the frozen part
  const min = frozenScrollMin(ctx);
  if (frozen.type !== "rangeColumn") ctx.scrollTop = min.top;
  if (frozen.type !== "rangeRow") ctx.scrollLeft = min.left;
  return "ok";
}

function freezesAxis(frozen: Frozen, type: "row" | "column") {
  return type === "row"
    ? frozen.type === "rangeRow" || frozen.type === "rangeBoth"
    : frozen.type === "rangeColumn" || frozen.type === "rangeBoth";
}

/**
 * Keeps frozen/split panes on the same rows (or columns) when `count`
 * rows/columns are inserted at `index` (the index of the first new one).
 */
export function adjustFrozenForInsert(
  sheet: Sheet,
  type: "row" | "column",
  index: number,
  count: number
) {
  const { frozen } = sheet;
  if (!frozen || count <= 0 || !freezesAxis(frozen, type)) return;
  const range = frozen.range ?? { row_focus: 0, column_focus: 0 };
  const focusKey = type === "row" ? "row_focus" : "column_focus";
  const firstKey = type === "row" ? "top" : "left";
  // inserted inside or above the frozen part: it grows / moves down
  if (range[focusKey] >= index) range[focusKey] += count;
  const first = frozen[firstKey] ?? 0;
  if (first > 0 && first >= index) frozen[firstKey] = first + count;
  frozen.range = range;
}

/**
 * Keeps frozen/split panes on the same rows (or columns) when rows/columns
 * `start`..`end` are deleted; that direction of the freeze goes away when
 * all of its rows/columns are deleted.
 */
export function adjustFrozenForDelete(
  sheet: Sheet,
  type: "row" | "column",
  start: number,
  end: number
) {
  const { frozen } = sheet;
  if (!frozen || end < start || !freezesAxis(frozen, type)) return;
  const range = frozen.range ?? { row_focus: 0, column_focus: 0 };
  const focusKey = type === "row" ? "row_focus" : "column_focus";
  const firstKey = type === "row" ? "top" : "left";
  const count = end - start + 1;
  const first = frozen[firstKey] ?? 0;
  const last = range[focusKey];
  if (start <= first && end >= last) {
    const other = type === "row" ? "column" : "row";
    if (!freezesAxis(frozen, other)) {
      delete sheet.frozen;
      return;
    }
    frozen.type = type === "row" ? "rangeColumn" : "rangeRow";
    range[focusKey] = 0;
    delete frozen[firstKey];
    frozen.range = range;
    return;
  }
  // the last frozen row is the last one left before the deleted block
  if (last > end) range[focusKey] = last - count;
  else if (last >= start) range[focusKey] = start - 1;
  if (first > 0) {
    let next = first;
    if (first > end) next = first - count;
    else if (first >= start) next = start;
    if (next > 0) frozen[firstKey] = next;
    else delete frozen[firstKey];
  }
  frozen.range = range;
}

/** Which kind of panes the current sheet has. */
export function getPaneState(ctx: Context): "none" | "frozen" | "split" {
  const frozen = currentSheetFile(ctx)?.frozen;
  if (!frozen) return "none";
  return frozen.split ? "split" : "frozen";
}

/**
 * View > Split: splits the window above and left of the active cell into
 * panes that scroll separately (at A1, in the middle of the window);
 * toggles the split off when there is one. Replaces frozen panes.
 */
export function toggleSplitPanes(ctx: Context): boolean {
  if (!isAllowEdit(ctx)) return false;
  const sheet = currentSheetFile(ctx);
  if (!sheet) return false;
  if (sheet.frozen?.split) {
    delete sheet.frozen;
    return true;
  }
  const [r, c] = activeCellForFreeze(ctx);
  const frozen = panesAt(ctx, r, c);
  if (!frozen) return false;
  if (frozenAreaTooLarge(ctx, frozen)) {
    // split in the middle of the window instead
    const mid = panesAt(ctx, 0, 0);
    if (!mid) return false;
    sheet.frozen = { ...mid, split: true, top: 0, left: 0 };
    return true;
  }
  sheet.frozen = { ...frozen, split: true, top: 0, left: 0 };
  return true;
}

/**
 * Moves a split bar: the top/left pane then ends with row/column `index`
 * (null removes that bar; removing both removes the split).
 */
export function setSplitPosition(
  ctx: Context,
  axis: "row" | "column",
  index: number | null
) {
  const sheet = currentSheetFile(ctx);
  const frozen = sheet?.frozen;
  if (!sheet || !frozen?.split) return;
  const hasRows = frozen.type === "rangeRow" || frozen.type === "rangeBoth";
  const hasCols = frozen.type === "rangeColumn" || frozen.type === "rangeBoth";
  const range = frozen.range ?? { row_focus: 0, column_focus: 0 };
  let rows = hasRows;
  let cols = hasCols;
  if (axis === "row") {
    rows = index != null;
    if (index != null) {
      range.row_focus = Math.max(index, frozen.top ?? 0);
    } else {
      frozen.top = 0;
    }
  } else {
    cols = index != null;
    if (index != null) {
      range.column_focus = Math.max(index, frozen.left ?? 0);
    } else {
      frozen.left = 0;
    }
  }
  if (!rows && !cols) {
    delete sheet.frozen;
    return;
  }
  frozen.range = range;
  if (rows && cols) frozen.type = "rangeBoth";
  else frozen.type = rows ? "rangeRow" : "rangeColumn";
}

/**
 * Scrolls the top (axis "row") or left (axis "column") pane of a split by
 * `delta` rows/columns, keeping its size. Returns whether it moved.
 */
export function scrollSplitPane(
  ctx: Context,
  axis: "row" | "column",
  delta: number
): boolean {
  const sheet = currentSheetFile(ctx);
  const frozen = sheet?.frozen;
  if (!frozen?.split || !frozen.range || delta === 0) return false;
  const count =
    axis === "row"
      ? ctx.visibledatarow?.length ?? 0
      : ctx.visibledatacolumn?.length ?? 0;
  const first = (axis === "row" ? frozen.top : frozen.left) ?? 0;
  const last =
    axis === "row" ? frozen.range.row_focus : frozen.range.column_focus;
  const size = last - first;
  const nextFirst = Math.max(0, Math.min(count - 1 - size, first + delta));
  if (nextFirst === first) return false;
  if (axis === "row") {
    frozen.top = nextFirst;
    frozen.range.row_focus = nextFirst + size;
  } else {
    frozen.left = nextFirst;
    frozen.range.column_focus = nextFirst + size;
  }
  return true;
}
