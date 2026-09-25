/**
 * Insert or delete cells, shifting the neighbouring cells (Excel's Insert >
 * Shift cells down / right and Delete > Shift cells up / left).
 *
 * Only the cells in the column band (for up/down) or the row band (for
 * left/right) of the range move. Formulas everywhere are rewritten with the
 * same rules as Excel (see refAdjust.ts), and cell-keyed data follows the
 * cells: merges, data validation, hyperlinks, borders, conditional-format
 * ranges and the calc chain.
 */
import _ from "lodash";
import type { Context } from "../context";
import type { Cell } from "../types";
import { getSheetIndex } from "../utils";
import { delFunctionGroup } from "./formula";
import { liveSheetConfig } from "./moveCells";
import {
  adjustRangeForChange,
  adjustReferences,
  recalcAfterStructuralChange,
  ReferenceChange,
} from "./refAdjust";
import { expandRowsAndColumns } from "./sheet";

type Rect = { row: [number, number]; column: [number, number] };

type ShiftSpec = {
  insert: boolean;
  /** true: cells move along rows (down/up); false: along columns */
  vertical: boolean;
  range: Rect;
};

/** Where cell (r, c) goes; null when it is deleted. */
function cellMapper(spec: ShiftSpec) {
  const { range, insert, vertical } = spec;
  const [b1, b2] = vertical ? range.column : range.row;
  const [s1, s2] = vertical ? range.row : range.column;
  const n = s2 - s1 + 1;
  return (r: number, c: number): [number, number] | null => {
    const band = vertical ? c : r;
    const pos = vertical ? r : c;
    if (band < b1 || band > b2) return [r, c];
    let next = pos;
    if (insert) {
      if (pos >= s1) next = pos + n;
    } else if (pos >= s1 && pos <= s2) {
      return null;
    } else if (pos > s2) next = pos - n;
    return vertical ? [next, c] : [r, next];
  };
}

/**
 * Whether a merged area straddles the band edge (Excel refuses the shift:
 * "This operation will cause some merged cells to unmerge").
 */
function mergeBlocks(
  merge: Record<string, { r: number; c: number; rs: number; cs: number }>,
  spec: ShiftSpec
) {
  const { range, vertical } = spec;
  const [b1, b2] = vertical ? range.column : range.row;
  const s1 = vertical ? range.row[0] : range.column[0];
  const s2 = vertical ? range.row[1] : range.column[1];
  return _.some(merge, (mc) => {
    const m1 = vertical ? mc.c : mc.r;
    const m2 = vertical ? mc.c + mc.cs - 1 : mc.r + mc.rs - 1;
    const p1 = vertical ? mc.r : mc.c;
    const p2 = vertical ? mc.r + mc.rs - 1 : mc.c + mc.cs - 1;
    const inBand = m1 >= b1 && m2 <= b2;
    const touchesBand = m2 >= b1 && m1 <= b2;
    // affected part of the sheet: the band from the range start onwards
    const affected = p2 >= s1;
    if (!affected || !touchesBand) return false;
    if (!inBand) return true;
    // a merge crossing the start of the range would be split
    if (p1 < s1 && p2 >= s1) return true;
    // deleting part of a merge
    if (!spec.insert && p1 <= s2 && p2 > s2 && p1 >= s1) return true;
    return false;
  });
}

function shiftCells(ctx: Context, sheetId: string, spec: ShiftSpec) {
  const idx = getSheetIndex(ctx, sheetId);
  if (idx == null) return false;
  const file = ctx.luckysheetfile[idx];
  const d = file.data;
  if (!d || d.length === 0) return false;
  const cfg = liveSheetConfig(ctx, sheetId);
  const { range, vertical, insert } = spec;
  if (mergeBlocks(cfg.merge || {}, spec)) throw new Error("partMC");

  const [b1, b2] = vertical ? range.column : range.row;
  const [s1, s2] = vertical ? range.row : range.column;
  const n = s2 - s1 + 1;
  const map = cellMapper(spec);

  // make room so that no cell is pushed off the grid
  if (insert) {
    let last = -1;
    for (let b = b1; b <= b2; b += 1) {
      const size = vertical ? d.length : d[0].length;
      for (let p = size - 1; p >= s1; p -= 1) {
        const cell = vertical ? d[p]?.[b] : d[b]?.[p];
        if (cell != null) {
          last = Math.max(last, p);
          break;
        }
      }
    }
    const size = vertical ? d.length : d[0].length;
    const need = Math.max(last + n + 1, s2 + 1) - size;
    if (need > 0) {
      expandRowsAndColumns(d, vertical ? need : 0, vertical ? 0 : need);
    }
  }

  const change: ReferenceChange = insert
    ? {
        type: "insertCells",
        sheetId,
        range,
        shift: vertical ? "down" : "right",
      }
    : {
        type: "deleteCells",
        sheetId,
        range,
        shift: vertical ? "up" : "left",
      };
  adjustReferences(ctx, change);

  // formulas of deleted cells go away
  if (!insert) {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        if (d[r]?.[c]?.f) delFunctionGroup(ctx, r, c, sheetId);
      }
    }
  }

  // move the cells of the band
  const size = vertical ? d.length : d[0].length;
  for (let b = b1; b <= b2; b += 1) {
    const line: (Cell | null)[] = [];
    for (let p = 0; p < size; p += 1) {
      line.push((vertical ? d[p]?.[b] : d[b]?.[p]) ?? null);
    }
    let next: (Cell | null)[];
    if (insert) {
      next = [
        ...line.slice(0, s1),
        ...new Array(n).fill(null),
        ...line.slice(s1, size - n),
      ];
    } else {
      next = [
        ...line.slice(0, s1),
        ...line.slice(s2 + 1),
        ...new Array(n).fill(null),
      ];
    }
    for (let p = s1; p < size; p += 1) {
      const cell = next[p];
      if (cell?.mc) {
        const to = map(cell.mc.r, cell.mc.c);
        if (to) cell.mc = { ...cell.mc, r: to[0], c: to[1] };
      }
      if (vertical) d[p][b] = cell;
      else d[b][p] = cell;
    }
  }

  // cell-keyed data
  const remapKeys = (obj: Record<string, any> | undefined) => {
    if (!obj) return obj;
    const out: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      const [r, c] = key.split("_").map(Number);
      const to = map(r, c);
      if (to) out[`${to[0]}_${to[1]}`] = obj[key];
    });
    return out;
  };
  if (cfg.merge) {
    const merge: typeof cfg.merge = {};
    _.forEach(cfg.merge, (mc) => {
      const to = map(mc.r, mc.c);
      if (to) merge[`${to[0]}_${to[1]}`] = { ...mc, r: to[0], c: to[1] };
    });
    cfg.merge = merge;
  }
  if (file.dataVerification) {
    file.dataVerification = remapKeys(file.dataVerification);
  }
  if (file.hyperlink) file.hyperlink = remapKeys(file.hyperlink);

  if (cfg.borderInfo) {
    const borders: any[] = [];
    cfg.borderInfo.forEach((b: any) => {
      if (b.rangeType === "cell") {
        const to = map(b.value.row_index, b.value.col_index);
        if (to) {
          borders.push({
            ...b,
            value: { ...b.value, row_index: to[0], col_index: to[1] },
          });
        }
      } else if (b.rangeType === "range") {
        const ranges = (b.range || [])
          .map((rg: Rect) => adjustRangeForChange(rg, change, sheetId))
          .filter(Boolean);
        if (ranges.length > 0) borders.push({ ...b, range: ranges });
      } else borders.push(b);
    });
    cfg.borderInfo = borders;
  }

  const cf = file.luckysheet_conditionformat_save;
  if (cf && cf.length > 0) {
    file.luckysheet_conditionformat_save = cf
      .map((rule: any) => ({
        ...rule,
        cellrange: (rule.cellrange || [])
          .map((rg: Rect) => adjustRangeForChange(rg, change, sheetId))
          .filter(Boolean),
      }))
      .filter((rule: any) => rule.cellrange.length > 0);
  }

  if (file.calcChain) {
    file.calcChain = file.calcChain
      .map((calc: any) => {
        const to = map(calc.r, calc.c);
        return to ? { ...calc, r: to[0], c: to[1] } : null;
      })
      .filter(Boolean) as any[];
  }

  file.config = cfg;
  if (sheetId === ctx.currentSheetId) ctx.config = cfg;
  recalcAfterStructuralChange(ctx);
  return true;
}

/**
 * Insert blank cells in `range`, shifting the cells below it down or the
 * cells to its right right. Throws Error("partMC") when a merged area would
 * be split.
 */
export function insertCells(
  ctx: Context,
  range: Rect,
  shift: "down" | "right",
  sheetId: string = ctx.currentSheetId
) {
  return shiftCells(ctx, sheetId, {
    insert: true,
    vertical: shift === "down",
    range: {
      row: [range.row[0], range.row[1]],
      column: [range.column[0], range.column[1]],
    },
  });
}

/**
 * Delete the cells in `range`, shifting the cells below it up or the cells
 * to its right left. References to deleted cells become #REF!. Throws
 * Error("partMC") when a merged area would be split.
 */
export function deleteCells(
  ctx: Context,
  range: Rect,
  shift: "up" | "left",
  sheetId: string = ctx.currentSheetId
) {
  return shiftCells(ctx, sheetId, {
    insert: false,
    vertical: shift === "up",
    range: {
      row: [range.row[0], range.row[1]],
      column: [range.column[0], range.column[1]],
    },
  });
}
