/**
 * Range references typed into the data tool dialogs (Advanced Filter, Goal
 * Seek, Data Table): "B2", "$A$1:$D$20", "Sheet2!C3", with or without a
 * leading "=".
 */
import type { Context } from "../context";
import { getRangetxt } from "./cell";
import { getcellrange, iscelldata } from "./formula";

export type RefRange = {
  sheetId: string;
  row: [number, number];
  column: [number, number];
};

/** Parse a typed reference; null when it is not a valid cell or range. */
export function parseRefText(
  ctx: Context,
  text: string | null | undefined
): RefRange | null {
  const txt = `${text ?? ""}`.trim().replace(/^=/, "").trim();
  if (!txt || !iscelldata(txt)) return null;
  const range = getcellrange(ctx, txt);
  if (!range || range.row == null || range.column == null) return null;
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;
  if ([r1, r2, c1, c2].some((n) => n == null || Number.isNaN(n) || n < 0)) {
    return null;
  }
  return {
    sheetId: range.sheetId ?? ctx.currentSheetId,
    row: [Math.min(r1, r2), Math.max(r1, r2)],
    column: [Math.min(c1, c2), Math.max(c1, c2)],
  };
}

/** Absolute A1 text of a range ("$A$1:$D$9"), sheet-qualified off-sheet. */
export function refText(
  ctx: Context,
  range: { row: number[]; column: number[]; sheetId?: string }
) {
  const plain = getRangetxt(
    ctx,
    range.sheetId ?? ctx.currentSheetId,
    { row: range.row, column: range.column } as any,
    ctx.currentSheetId
  );
  return plain.replace(/(^|[!:])([A-Z]+)(\d+)/g, "$1$$$2$$$3");
}
