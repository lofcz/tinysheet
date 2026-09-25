/**
 * Excel's "Pick From Drop-down List…": the distinct text entries of the
 * contiguous block of cells above and below the active cell in its column.
 */
import { Context, getFlowdata } from "../context";
import { Cell } from "../types";

function cellText(cell: Cell | null | undefined): string | null {
  if (!cell || cell.f) return null;
  const { v } = cell;
  if (v == null || v === "") return null;
  // Excel offers text entries only
  if (typeof v !== "string") return null;
  if (cell.ct?.t === "n" || cell.ct?.t === "d") return null;
  return v;
}

function isBlank(cell: Cell | null | undefined) {
  if (!cell) return true;
  return (cell.v == null || cell.v === "") && !cell.f;
}

export function getPickListValues(
  ctx: Context,
  r: number,
  c: number,
  sheetId?: string
): string[] {
  const data = getFlowdata(ctx, sheetId);
  if (!data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const visit = (row: number) => {
    const text = cellText(data[row]?.[c]);
    if (text != null && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  };
  for (let i = r - 1; i >= 0 && !isBlank(data[i]?.[c]); i -= 1) visit(i);
  for (let i = r + 1; i < data.length && !isBlank(data[i]?.[c]); i += 1) {
    visit(i);
  }
  return out.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
