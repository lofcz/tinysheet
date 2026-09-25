import type { CellMatrix, Sheet } from "../types";
import { peek } from "./dependencyGraph";

/**
 * Expand a sheet's sparse `celldata` into its dense `data` matrix, sized to
 * the larger of the content and `row`/`column` (or the given defaults when
 * those are unset).
 *
 * Built for load time: `celldata` is read without creating immer drafts, and
 * every row plus the matrix itself is returned frozen, so immer's auto-freeze
 * (which otherwise walks every cell of a freshly assigned matrix, twice) skips
 * them. Rows are copied on write by immer as usual; cells are left unfrozen
 * until their row is first edited.
 */
export function expandCellData(
  sheet: Sheet,
  defaultRows: number,
  defaultCols: number
): CellMatrix {
  const s = peek(sheet);
  const celldata = peek(s.celldata) as Sheet["celldata"];
  const count = celldata?.length ?? 0;
  let rows = 1;
  let cols = 1;
  for (let i = 0; i < count; i += 1) {
    const d = peek(celldata![i]);
    if (d) {
      if (d.r + 1 > rows) rows = d.r + 1;
      if (d.c + 1 > cols) cols = d.c + 1;
    }
  }
  const { row, column } = s;
  if (row != null && column != null && row > 0 && column > 0) {
    rows = Math.max(rows, row);
    cols = Math.max(cols, column);
  } else {
    rows = Math.max(rows, defaultRows);
    cols = Math.max(cols, defaultCols);
  }

  const data: CellMatrix = new Array(rows);
  for (let r = 0; r < rows; r += 1) {
    data[r] = new Array(cols).fill(null);
  }
  for (let i = 0; i < count; i += 1) {
    const d = peek(celldata![i]);
    if (d && d.r >= 0 && d.c >= 0) data[d.r][d.c] = peek(d.v) as any;
  }
  for (let r = 0; r < rows; r += 1) Object.freeze(data[r]);
  return Object.freeze(data) as CellMatrix;
}
