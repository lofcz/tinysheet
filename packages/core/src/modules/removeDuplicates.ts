import _ from "lodash";
import { Context, getFlowdata } from "../context";
import { locale } from "../locale";
import { Cell } from "../types";
import { getSheetIndex } from "../utils";
import { execfunction } from "./formula";
import { update } from "./format";
import { jfrefreshgrid } from "./refresh";
import { detectHeaderRow, shiftFormula } from "./sort";

/*
 * Excel's Data › Remove Duplicates. Rows of the range whose values in the
 * chosen columns match an earlier row are removed; the rows left move up
 * inside the range (cells outside it do not move). Values compare as they
 * are displayed, case-insensitively, like Excel.
 */

export type RemoveDuplicatesOptions = {
  range: { row: number[]; column: number[] };
  /** Absolute column indexes to compare; defaults to every column. */
  columns?: number[];
  hasHeader?: boolean;
};

export type RemoveDuplicatesResult = {
  removed: number;
  unique: number;
  error?: string;
};

function compareText(cell: Cell | null | undefined): string {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || [])
      .map((s: any) => s?.v ?? "")
      .join("")
      .toLowerCase();
  }
  const shown = cell.m ?? cell.v;
  return shown == null ? "" : `${shown}`.toLowerCase();
}

/** Guess whether the first row of `range` is a header (Excel does too). */
export function detectDuplicatesHeader(
  ctx: Context,
  range: { row: number[]; column: number[] }
) {
  const data = getFlowdata(ctx);
  return data ? detectHeaderRow(data, range) : false;
}

export function removeDuplicates(
  ctx: Context,
  options: RemoveDuplicatesOptions
): RemoveDuplicatesResult {
  const data = getFlowdata(ctx);
  if (data == null || ctx.allowEdit === false) return { removed: 0, unique: 0 };
  const [r1, r2] = options.range.row;
  const [c1, c2] = options.range.column;
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      if (data[r]?.[c]?.mc != null) {
        return {
          removed: 0,
          unique: 0,
          error: locale(ctx).sort.mergeError,
        };
      }
    }
  }
  const columns = (
    options.columns?.length ? options.columns : _.range(c1, c2 + 1)
  ).filter((c) => c >= c1 && c <= c2);
  const start = options.hasHeader ? r1 + 1 : r1;
  if (start > r2 || columns.length === 0) return { removed: 0, unique: 0 };

  const seen = new Set<string>();
  const keep: number[] = [];
  for (let r = start; r <= r2; r += 1) {
    const key = columns.map((c) => compareText(data[r]?.[c])).join("\u0000");
    if (!seen.has(key)) {
      seen.add(key);
      keep.push(r);
    }
  }
  const removed = r2 - start + 1 - keep.length;
  if (removed === 0) return { removed: 0, unique: keep.length };

  // snapshot, then compact the kept rows to the top of the range
  const rows = keep.map((r) => {
    const row: (Cell | null)[] = [];
    for (let c = c1; c <= c2; c += 1) row.push(data[r]?.[c] ?? null);
    return row;
  });
  const formulaCells: { r: number; c: number }[] = [];
  for (let i = 0; i <= r2 - start; i += 1) {
    const to = start + i;
    const from = keep[i];
    for (let c = c1; c <= c2; c += 1) {
      let cell = i < rows.length ? rows[i][c - c1] : null;
      if (cell?.f && from !== to) {
        cell = { ...cell, f: shiftFormula(ctx, cell.f, to - from, 0) };
      }
      if (cell?.f) formulaCells.push({ r: to, c });
      data[to][c] = cell;
    }
  }
  formulaCells.forEach(({ r, c }) => {
    const cell = data[r][c];
    if (!cell?.f) return;
    const [, v, f] = execfunction(
      ctx,
      cell.f,
      r,
      c,
      undefined,
      undefined,
      false,
      true
    );
    cell.v = v;
    cell.f = f;
    cell.m = update(cell.ct?.fa || "General", v);
  });

  // per-cell validation rules follow their rows
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const file = sheetIndex == null ? null : ctx.luckysheetfile[sheetIndex];
  if (file?.dataVerification) {
    const dv = { ...file.dataVerification };
    const moved: Record<string, any> = {};
    for (let r = start; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) delete dv[`${r}_${c}`];
    }
    keep.forEach((from, i) => {
      for (let c = c1; c <= c2; c += 1) {
        const item = file.dataVerification[`${from}_${c}`];
        if (item != null) moved[`${start + i}_${c}`] = item;
      }
    });
    file.dataVerification = { ...dv, ...moved };
  }

  jfrefreshgrid(ctx, data, [{ row: [r1, r2], column: [c1, c2] }]);
  return { removed, unique: keep.length };
}
