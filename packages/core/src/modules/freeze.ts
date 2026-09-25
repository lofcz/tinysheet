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

  // Split panes scroll their top/left pane: it starts at row `top` /
  // column `left` instead of the first row/column.
  const splitTop = frozen.split ? frozen.top ?? 0 : 0;
  const splitLeft = frozen.split ? frozen.left ?? 0 : 0;

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
      ctx.scrollLeft = 0;
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
      ctx.scrollTop = 0;
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

type Frozen = NonNullable<Sheet["frozen"]>;

function currentSheetFile(ctx: Context): Sheet | null {
  const i = getSheetIndex(ctx, ctx.currentSheetId);
  return i == null ? null : ctx.luckysheetfile[i];
}

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

/** Index of the row/column under the middle of the visible area. */
function middleIndex(positions: number[], size: number) {
  if (!positions?.length || !(size > 0)) return 0;
  return Math.max(
    0,
    Math.min(positions.length - 1, _.sortedIndex(positions, size / 2))
  );
}

/**
 * Frozen/split state for panes that start at row `r` / column `c` (the
 * active cell): rows above and columns to the left go to the top/left panes.
 * At A1 Excel splits in the middle of the window.
 */
function panesAt(ctx: Context, r: number, c: number): Frozen | null {
  let row = r;
  let col = c;
  if (row === 0 && col === 0) {
    row = middleIndex(ctx.visibledatarow, ctx.cellmainHeight) + 1;
    col = middleIndex(ctx.visibledatacolumn, ctx.cellmainWidth) + 1;
  }
  if (row > 0 && col > 0) {
    return {
      type: "rangeBoth",
      range: { row_focus: row - 1, column_focus: col - 1 },
    };
  }
  if (row > 0) {
    return { type: "rangeRow", range: { row_focus: row - 1, column_focus: 0 } };
  }
  if (col > 0) {
    return {
      type: "rangeColumn",
      range: { row_focus: 0, column_focus: col - 1 },
    };
  }
  return null;
}

/** Whether frozen rows/columns would leave no room for the scrolling pane. */
function frozenAreaTooLarge(ctx: Context, frozen: Frozen) {
  const rf = frozen.range?.row_focus ?? 0;
  const cf = frozen.range?.column_focus ?? 0;
  const rows = frozen.type === "rangeRow" || frozen.type === "rangeBoth";
  const cols = frozen.type === "rangeColumn" || frozen.type === "rangeBoth";
  if (rows && ctx.cellmainHeight > 0 && ctx.visibledatarow?.length) {
    if ((ctx.visibledatarow[rf] ?? 0) > ctx.cellmainHeight - 20) return true;
  }
  if (cols && ctx.cellmainWidth > 0 && ctx.visibledatacolumn?.length) {
    if ((ctx.visibledatacolumn[cf] ?? 0) > ctx.cellmainWidth - 20) return true;
  }
  return false;
}

/**
 * Excel's View > Freeze Panes menu:
 * - "panes": rows above and columns left of the active cell (at A1, the
 *   middle of the window);
 * - "topRow" / "firstColumn": the first row / column;
 * - "unfreeze": removes frozen panes (and a split).
 * Frozen rows/columns start at the top/left of the sheet, and the scrolling
 * pane is scrolled back to them. Returns "tooLarge" (and changes nothing)
 * when the frozen part would fill the window.
 */
export function freezePanes(
  ctx: Context,
  mode: FreezeMode
): "ok" | "tooLarge" | "noop" {
  if (!isAllowEdit(ctx)) return "noop";
  const sheet = currentSheetFile(ctx);
  if (!sheet) return "noop";
  if (mode === "unfreeze") {
    delete sheet.frozen;
    return "ok";
  }
  let frozen: Frozen | null;
  if (mode === "topRow") {
    frozen = { type: "rangeRow", range: { row_focus: 0, column_focus: 0 } };
  } else if (mode === "firstColumn") {
    frozen = { type: "rangeColumn", range: { row_focus: 0, column_focus: 0 } };
  } else {
    const [r, c] = activeCellForFreeze(ctx);
    frozen = panesAt(ctx, r, c);
  }
  if (!frozen) return "noop";
  if (frozenAreaTooLarge(ctx, frozen)) return "tooLarge";
  sheet.frozen = frozen;
  if (frozen.type !== "rangeColumn") ctx.scrollTop = 0;
  if (frozen.type !== "rangeRow") ctx.scrollLeft = 0;
  return "ok";
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
