import _ from "lodash";
import { checkProtection } from "./protection";

import { Context, getFlowdata } from "../context";
import { Cell, CellMatrix, Freezen, Rect } from "../types";
import { colLocation, getGridPoint, rowLocation } from "./location";
import { getSheetIndex, isAllowEdit } from "../utils";
import { getBorderInfoCompute } from "./border";
import { genarate, update } from "./format";
import * as formula from "./formula";
import { isRealNum } from "./validation";
import { CFSplitRange } from "./ConditionFormat";
import { normalizeSelection } from "./selection";
import { jfrefreshgrid } from "./refresh";
import { reconcileSpills } from "./spill";
import { classifyFillValue, FillSource, generateFillSeries } from "./autofill";
import { cellHasValue } from "./navigation";

export {
  generateFillSeries,
  setCustomFillLists,
  getCustomFillLists,
} from "./autofill";

function toPx(v: number) {
  return `${v}px`;
}

export const dropCellCache: Record<string, any> = {
  copyRange: {}, // 复制范围
  applyRange: {}, // 应用范围
  // 0 copy cells, 1 fill series, 2 formats only, 3 values only, 4 days,
  // 5 weekdays, 6 months, 7 years, 8 series (legacy Chinese numbers),
  // 9 growth trend. See FillType in ./autofill.
  applyType: null,
  direction: null, // down / right / up / left
  ctrlKey: false, // Ctrl (Option on Mac) held on release: toggles copy/series
};

export function showDropCellSelection(
  { width, height, top, left }: Rect,
  container: HTMLDivElement
) {
  const selectedExtend = container.querySelector(
    ".fortune-cell-selected-extend"
  ) as HTMLDivElement;
  if (selectedExtend) {
    selectedExtend.style.left = toPx(left);
    selectedExtend.style.width = toPx(width);
    selectedExtend.style.top = toPx(top);
    selectedExtend.style.height = toPx(height);
    selectedExtend.style.display = "block";
  }
}

export function hideDropCellSelection(container: HTMLDivElement) {
  const selectedExtend = container.querySelector(
    ".fortune-cell-selected-extend"
  ) as HTMLDivElement;
  if (selectedExtend) {
    selectedExtend.style.display = "none";
  }
}

export function createDropCellRange(
  ctx: Context,
  e: MouseEvent,
  container: HTMLDivElement,
  freeze?: Freezen
) {
  ctx.luckysheet_cell_selected_extend = true;
  ctx.luckysheet_scroll_status = true;

  const { x, y } = getGridPoint(ctx, freeze, e, container);

  const row_location = rowLocation(y, ctx.visibledatarow);
  const row_pre = row_location[0];
  const row = row_location[1];
  const row_index = row_location[2];
  const col_location = colLocation(x, ctx.visibledatacolumn);
  const col_pre = col_location[0];
  const col = col_location[1];
  const col_index = col_location[2];

  ctx.luckysheet_cell_selected_extend_index = [row_index, col_index];

  showDropCellSelection(
    {
      left: col_pre,
      width: col - col_pre - 1,
      top: row_pre,
      height: row - row_pre - 1,
    },
    container
  );
}

export function onDropCellSelect(
  ctx: Context,
  e: MouseEvent,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement,
  container: HTMLDivElement,
  freeze?: Freezen
) {
  // past the grid's edge (auto-scrolling): the last visible row / column
  const anchor = ctx.luckysheet_select_save?.[0];
  const { x, y } = getGridPoint(ctx, freeze, e, container, {
    clamp: true,
    anchorRow: anchor?.row[0],
    anchorCol: anchor?.column[0],
  });

  const row_location = rowLocation(y, ctx.visibledatarow);
  const row = row_location[1];
  const row_pre = row_location[0];
  const row_index = row_location[2];
  const col_location = colLocation(x, ctx.visibledatacolumn);
  const col = col_location[1];
  const col_pre = col_location[0];
  const col_index = col_location[2];

  const row_index_original = ctx.luckysheet_cell_selected_extend_index[0];
  const col_index_original = ctx.luckysheet_cell_selected_extend_index[1];

  if (!ctx.luckysheet_select_save) return;
  let row_s = ctx.luckysheet_select_save[0].row[0];
  let row_e = ctx.luckysheet_select_save[0].row[1];
  let col_s = ctx.luckysheet_select_save[0].column[0];
  let col_e = ctx.luckysheet_select_save[0].column[1];

  let top = ctx.luckysheet_select_save[0].top_move;
  let height = ctx.luckysheet_select_save[0].height_move;
  let left = ctx.luckysheet_select_save[0].left_move;
  let width = ctx.luckysheet_select_save[0].width_move;

  if (top == null || height == null || left == null || width == null) return;
  if (
    Math.abs(row_index_original - row_index) >
    Math.abs(col_index_original - col_index)
  ) {
    if (!(row_index >= row_s && row_index <= row_e)) {
      if (top >= row_pre) {
        height += top - row_pre;
        top = row_pre;
      } else {
        height = row - top - 1;
      }
    }
  } else {
    if (!(col_index >= col_s && col_index <= col_e)) {
      if (left >= col_pre) {
        width += left - col_pre;
        left = col_pre;
      } else {
        width = col - left - 1;
      }
    }
  }
  if (y < 0) {
    row_s = 0;
    [row_e] = ctx.luckysheet_select_save[0].row;
  }
  if (x < 0) {
    col_s = 0;
    [col_e] = ctx.luckysheet_select_save[0].column;
  }

  showDropCellSelection({ left, width, top, height }, container);
}

/**
 * Which kinds of series the copy range holds. Kept for API compatibility:
 * [number, text+number/ordinal, date, Chinese number, list, -, -].
 */
export function getTypeItemHide(ctx: Context) {
  const { copyRange } = dropCellCache;
  const flowdata = getFlowdata(ctx);
  if (flowdata == null || !copyRange?.row || !copyRange?.column) return [];

  let hasNumber = false;
  let hasExtendNumber = false;
  let hasDate = false;
  let hasChn = false;
  let hasList = false;

  for (let r = copyRange.row[0]; r <= copyRange.row[1]; r += 1) {
    for (let c = copyRange.column[0]; c <= copyRange.column[1]; c += 1) {
      const info = classifyFillValue(flowdata[r]?.[c], ctx.lang);
      if (info.kind === "number") hasNumber = true;
      else if (info.kind === "date") hasDate = true;
      else if (info.kind === "textnum" || info.kind === "ordinal")
        hasExtendNumber = true;
      else if (info.kind === "chn") hasChn = true;
      else if (info.kind === "list") hasList = true;
    }
  }

  return [hasNumber, hasExtendNumber, hasDate, hasChn, hasList, false, false];
}

/** Shifts a filled formula by `shift` rows/columns and recalculates it. */
function applyFilledFormula(
  ctx: Context,
  cell: Cell,
  r: number,
  c: number,
  d: CellMatrix,
  direction: string,
  shift: number
) {
  const f = `=${formula.functionCopy(ctx, cell.f!, direction, shift)}`;
  const v = formula.execfunction(ctx, f, r, c);

  formula.execFunctionGroup(ctx, r, c, v[1], undefined, d);

  [, cell.v, cell.f] = v;

  if (cell.v != null) {
    if (
      isRealNum(cell.v) &&
      !/^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i.test(
        `${cell.v}`
      )
    ) {
      if (cell.v === Infinity || cell.v === -Infinity) {
        cell.m = cell.v.toString();
      } else if (cell.v.toString().indexOf("e") > -1) {
        let len = (cell.v.toString().split(".")[1] || "").split("e")[0].length;
        if (len > 5) len = 5;
        cell.m = Number(cell.v).toExponential(len).toString();
      } else if (
        cell.ct?.t === "n" &&
        cell.ct.fa != null &&
        cell.ct.fa !== "General"
      ) {
        // keep the source cell's number format
        cell.m = update(cell.ct.fa, cell.v);
      } else {
        const mask = genarate(
          Math.round(Number(cell.v) * 1000000000) / 1000000000
        );
        cell.m = mask![0].toString();
      }
      cell.ct = cell.ct || { fa: "General", t: "n" };
    } else {
      const mask = genarate(cell.v);
      cell.m = mask![0].toString();
      [, cell.ct] = mask!;
    }
  }
}

/**
 * Writes the fill described by `dropCellCache` (copyRange, applyRange,
 * direction, applyType, ctrlKey) into the current sheet.
 */
export function updateDropCell(ctx: Context) {
  const d = getFlowdata(ctx);
  const allowEdit = isAllowEdit(ctx);
  if (allowEdit === false || d == null) {
    return;
  }
  if (!checkProtection(ctx, "editCells", [dropCellCache.applyRange])) return;

  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];
  // Excel does not overwrite rows hidden by a filter, but does fill rows
  // hidden manually.
  const filterHidden = _.reduce(
    ctx.filter,
    (pre, curr) => _.assign(pre, curr?.rowhidden || {}),
    {} as Record<string, number>
  );

  const cfg = _.cloneDeep(ctx.config);
  if (cfg.borderInfo == null) {
    cfg.borderInfo = [];
  }
  const borderInfoCompute = getBorderInfoCompute(ctx, ctx.currentSheetId);
  let bordersChanged = false;
  const dataVerification = file.dataVerification
    ? _.cloneDeep(file.dataVerification)
    : null;
  let verificationChanged = false;

  const { direction, copyRange, applyRange } = dropCellCache;
  const vertical = direction === "down" || direction === "up";
  const reverse = direction === "up" || direction === "left";

  const [cr1, cr2] = copyRange.row;
  const [cc1, cc2] = copyRange.column;
  const [ar1, ar2] = applyRange.row;
  const [ac1, ac2] = applyRange.column;

  const csLen = vertical ? cr2 - cr1 + 1 : cc2 - cc1 + 1;
  const asLen = vertical ? ar2 - ar1 + 1 : ac2 - ac1 + 1;
  const lineStart = vertical ? ac1 : ar1;
  const lineEnd = vertical ? ac2 : ar2;
  const copyStart = vertical ? cr1 : cc1;
  const copyEnd = vertical ? cr2 : cc2;
  const applyStart = vertical ? ar1 : ac1;
  const applyEnd = vertical ? ar2 : ac2;

  for (let line = lineStart; line <= lineEnd; line += 1) {
    const source: FillSource[] = [];
    for (let b = copyStart; b <= copyEnd; b += 1) {
      source.push(vertical ? d[b]?.[line] : d[line]?.[b]);
    }

    const applyData = generateFillSeries(source, asLen, {
      type: dropCellCache.applyType ?? "1",
      reverse,
      ctrl: !!dropCellCache.ctrlKey,
      lang: ctx.lang,
    });

    for (let i = 0; i < asLen; i += 1) {
      const along = reverse ? applyEnd - i : applyStart + i;
      const r = vertical ? along : line;
      const c = vertical ? line : along;
      if (filterHidden[r] != null) continue;

      const cell = applyData[i] as Cell | null | undefined;
      if (cell?.f != null) {
        applyFilledFormula(
          ctx,
          cell,
          r,
          c,
          d,
          direction,
          csLen * (Math.floor(i / csLen) + 1)
        );
      }

      if (!d[r]) d[r] = [];
      d[r][c] = cell || null;

      // borders and data validation follow the source cell
      const srcAlong = reverse
        ? copyEnd - (i % csLen)
        : copyStart + (i % csLen);
      const bd_r = vertical ? srcAlong : line;
      const bd_c = vertical ? line : srcAlong;
      const srcBorder = borderInfoCompute[`${bd_r}_${bd_c}`];
      if (srcBorder) {
        cfg.borderInfo.push({
          rangeType: "cell",
          value: {
            row_index: r,
            col_index: c,
            l: srcBorder.l,
            r: srcBorder.r,
            t: srcBorder.t,
            b: srcBorder.b,
          },
        });
        bordersChanged = true;
      } else if (borderInfoCompute[`${r}_${c}`]) {
        cfg.borderInfo.push({
          rangeType: "cell",
          value: {
            row_index: r,
            col_index: c,
            l: null,
            r: null,
            t: null,
            b: null,
          },
        });
        bordersChanged = true;
      }

      if (dataVerification != null) {
        if (dataVerification[`${bd_r}_${bd_c}`]) {
          dataVerification[`${r}_${c}`] = dataVerification[`${bd_r}_${bd_c}`];
          verificationChanged = true;
        } else if (dataVerification[`${r}_${c}`]) {
          delete dataVerification[`${r}_${c}`];
          verificationChanged = true;
        }
      }
    }
  }

  if (bordersChanged) {
    ctx.config = cfg;
    file.config = cfg;
  }
  if (verificationChanged) {
    file.dataVerification = dataVerification!;
  }

  // 条件格式
  const cdformat = file.luckysheet_conditionformat_save;
  if (cdformat != null && cdformat.length > 0) {
    for (let i = 0; i < cdformat.length; i += 1) {
      const cdformat_cellrange = cdformat[i].cellrange;

      let emptyRange: any = [];

      for (let j = 0; j < cdformat_cellrange.length; j += 1) {
        const range = CFSplitRange(
          cdformat_cellrange[j],
          { row: copyRange.row, column: copyRange.column },
          { row: applyRange.row, column: applyRange.column },
          "operatePart"
        );
        if (range.length > 0) {
          emptyRange = emptyRange.concat(range);
        }
      }

      if (emptyRange.length > 0) {
        cdformat[i].cellrange.push(applyRange);
      }
    }
  }

  jfrefreshgrid(ctx, d, ctx.luckysheet_select_save);
  reconcileSpills(ctx, ctx.currentSheetId, { pasted: [applyRange] });
}

function rangeHasMerge(d: CellMatrix, rows: number[], cols: number[]): boolean {
  for (let r = rows[0]; r <= rows[1]; r += 1) {
    for (let c = cols[0]; c <= cols[1]; c += 1) {
      if (d[r]?.[c]?.mc != null) return true;
    }
  }
  return false;
}

export function onDropCellSelectEnd(
  ctx: Context,
  e: MouseEvent,
  container: HTMLDivElement,
  freeze?: Freezen
) {
  ctx.luckysheet_cell_selected_extend = false;
  hideDropCellSelection(container);

  // released past the grid's edge: the last visible row / column
  const anchor = ctx.luckysheet_select_save?.[0];
  const { x, y } = getGridPoint(ctx, freeze, e, container, {
    clamp: true,
    anchorRow: anchor?.row[0],
    anchorCol: anchor?.column[0],
  });

  const row_location = rowLocation(y, ctx.visibledatarow);
  const row_pre = row_location[0];
  const row_index = row_location[2];
  const col_location = colLocation(x, ctx.visibledatacolumn);
  const col_pre = col_location[0];
  const col_index = col_location[2];

  const row_index_original = ctx.luckysheet_cell_selected_extend_index[0];
  const col_index_original = ctx.luckysheet_cell_selected_extend_index[1];

  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (
    last &&
    last.top != null &&
    last.left != null &&
    last.height != null &&
    last.width != null &&
    last.row_focus != null &&
    last.column_focus != null
  ) {
    let row_s = last.row[0];
    let row_e = last.row[1];
    let col_s = last.column[0];
    let col_e = last.column[1];

    // 复制范围
    dropCellCache.copyRange = _.cloneDeep(_.pick(last, ["row", "column"]));
    // Series detection happens per cell in generateFillSeries; plain text
    // is copied. Ctrl (Option on Mac) toggles between copy and series.
    dropCellCache.applyType = "1";
    dropCellCache.ctrlKey = !!(e.ctrlKey || e.altKey);

    if (ctx.luckysheet_select_save == null) return;
    const { top_move, left_move } = ctx.luckysheet_select_save[0];
    if (
      Math.abs(row_index_original - row_index) >
      Math.abs(col_index_original - col_index)
    ) {
      if (!(row_index >= row_s && row_index <= row_e)) {
        if (top_move != null && top_move >= row_pre) {
          // 当往上拖拽时
          dropCellCache.applyRange = {
            row: [row_index, last.row[0] - 1],
            column: last.column,
          };
          dropCellCache.direction = "up";

          row_s -= last.row[0] - row_index;
        } else {
          // 当往下拖拽时
          dropCellCache.applyRange = {
            row: [last.row[1] + 1, row_index],
            column: last.column,
          };
          dropCellCache.direction = "down";

          row_e += row_index - last.row[1];
        }
      } else {
        return;
      }
    } else {
      if (!(col_index >= col_s && col_index <= col_e)) {
        if (left_move != null && left_move >= col_pre) {
          // 当往左拖拽时
          dropCellCache.applyRange = {
            row: last.row,
            column: [col_index, last.column[0] - 1],
          };
          dropCellCache.direction = "left";

          col_s -= last.column[0] - col_index;
        } else {
          // 当往右拖拽时
          dropCellCache.applyRange = {
            row: last.row,
            column: [last.column[1] + 1, col_index],
          };
          dropCellCache.direction = "right";

          col_e += col_index - last.column[1];
        }
      } else {
        return;
      }
    }

    if (y < 0) {
      row_s = 0;
      [row_e] = last.row;
    }

    if (x < 0) {
      col_s = 0;
      [col_e] = last.column;
    }

    const flowdata = getFlowdata(ctx);
    if (flowdata == null) return;

    if (
      ctx.config.merge != null &&
      (rangeHasMerge(flowdata, last.row, last.column) ||
        rangeHasMerge(flowdata, [row_s, row_e], [col_s, col_e]))
    ) {
      return;
    }

    last.row = [row_s, row_e];
    last.column = [col_s, col_e];

    ctx.luckysheet_select_save = normalizeSelection(ctx, [
      {
        row: [row_s, row_e],
        column: [col_s, col_e],
      },
    ]);

    try {
      updateDropCell(ctx);
    } catch (err) {
      console.error(err);
    }

    const selectedMoveEle = container.querySelector(
      ".fortune-cell-selected-move"
    );
    if (selectedMoveEle) {
      (selectedMoveEle as HTMLDivElement).style.display = "none";
    }
  }
}

/**
 * Double-click on the fill handle: fills the selection down as far as the
 * data in the adjacent column (left first, then right) goes, stopping before
 * any data already in the fill columns. Returns true when something was
 * filled.
 */
export function autoFillToDataEnd(ctx: Context): boolean {
  const d = getFlowdata(ctx);
  const sels = ctx.luckysheet_select_save;
  if (!d || !sels || sels.length !== 1) return false;
  if (!checkProtection(ctx, "editCells")) return false;
  if (!isAllowEdit(ctx)) return false;
  const sel = sels[0];
  const [r1, r2] = sel.row;
  const [c1, c2] = sel.column;
  const rows = d.length;
  const cols = d[0]?.length ?? 0;
  const filled = (r: number, c: number) => cellHasValue(d[r]?.[c]);

  const scan = (col: number) => {
    if (col < 0 || col >= cols || r2 + 1 >= rows || !filled(r2 + 1, col))
      return -1;
    let r = r2 + 1;
    while (r + 1 < rows && filled(r + 1, col)) r += 1;
    return r;
  };
  let end = scan(c1 - 1);
  if (end < 0) end = scan(c2 + 1);
  if (end <= r2) return false;

  for (let r = r2 + 1; r <= end; r += 1) {
    let hit = false;
    for (let c = c1; c <= c2; c += 1) {
      if (filled(r, c)) {
        hit = true;
        break;
      }
    }
    if (hit) {
      end = r - 1;
      break;
    }
  }
  if (end <= r2) return false;
  if (rangeHasMerge(d, [r1, end], [c1, c2])) return false;

  dropCellCache.copyRange = { row: [r1, r2], column: [c1, c2] };
  dropCellCache.applyRange = { row: [r2 + 1, end], column: [c1, c2] };
  dropCellCache.direction = "down";
  dropCellCache.applyType = "1";
  dropCellCache.ctrlKey = false;

  ctx.luckysheet_select_save = normalizeSelection(ctx, [
    {
      row: [r1, end],
      column: [c1, c2],
      row_focus: sel.row_focus ?? r1,
      column_focus: sel.column_focus ?? c1,
    },
  ]);
  updateDropCell(ctx);
  return true;
}

/**
 * Ctrl+D / Ctrl+R: copies the top row (left column) of each selected range
 * into the rest of it, or the cell above (to the left) when a single row
 * (column) is selected. Formulas are adjusted like the fill handle does.
 */
export function fillSelectionFromEdge(
  ctx: Context,
  direction: "down" | "right"
): boolean {
  const d = getFlowdata(ctx);
  const sels = ctx.luckysheet_select_save;
  if (!d || !sels || sels.length === 0) return false;
  if (!checkProtection(ctx, "editCells")) return false;
  if (!isAllowEdit(ctx)) return false;
  let done = false;
  const ranges = _.cloneDeep(sels);

  ranges.forEach((sel) => {
    const [r1, r2] = sel.row;
    const [c1, c2] = sel.column;
    let copyRange;
    let applyRange;
    if (direction === "down") {
      if (r1 === r2) {
        if (r1 === 0) return;
        copyRange = { row: [r1 - 1, r1 - 1], column: [c1, c2] };
        applyRange = { row: [r1, r2], column: [c1, c2] };
      } else {
        copyRange = { row: [r1, r1], column: [c1, c2] };
        applyRange = { row: [r1 + 1, r2], column: [c1, c2] };
      }
    } else if (c1 === c2) {
      if (c1 === 0) return;
      copyRange = { row: [r1, r2], column: [c1 - 1, c1 - 1] };
      applyRange = { row: [r1, r2], column: [c1, c2] };
    } else {
      copyRange = { row: [r1, r2], column: [c1, c1] };
      applyRange = { row: [r1, r2], column: [c1 + 1, c2] };
    }
    if (
      rangeHasMerge(d, copyRange.row, copyRange.column) ||
      rangeHasMerge(d, applyRange.row, applyRange.column)
    ) {
      return;
    }
    dropCellCache.copyRange = copyRange;
    dropCellCache.applyRange = applyRange;
    dropCellCache.direction = direction;
    dropCellCache.applyType = "0";
    dropCellCache.ctrlKey = false;
    updateDropCell(ctx);
    done = true;
  });

  ctx.luckysheet_select_save = normalizeSelection(ctx, ranges);
  return done;
}
