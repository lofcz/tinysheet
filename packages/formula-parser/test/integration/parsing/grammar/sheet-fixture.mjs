// Shared fixture for the grammar tests (not a test file itself).
import error from "../../../../src/error";
//
//     A      B       C
// 1   1      "x"     (blank)
// 2   2      "y"     "#N/A"
// 3   3      "x"     "#DIV/0!"
// 4   4      "z"     TRUE
// 5   5      "x"     "10"
export const SHEET = [
  [1, "x", null],
  [2, "y", "#N/A"],
  [3, "x", "#DIV/0!"],
  [4, "z", true],
  [5, "x", "10"],
];

export const OTHER_SHEET = [
  [100, 200],
  [300, 400],
];

function gridFor(sheetName) {
  return sheetName ? OTHER_SHEET : SHEET;
}

/**
 * Wire a parser to the fixture and record every cell/range request.
 *
 * @returns {Array} Log of requests: ["cell", label, sheetName] or
 *   ["range", startCell, endCell].
 */
export function attachSheet(parser) {
  const log = [];

  parser.on("callCellValue", (cell, _options, done) => {
    log.push(["cell", cell.label, cell.sheetName]);
    const grid = gridFor(cell.sheetName);

    done(grid[cell.row.index]?.[cell.column.index] ?? null);
  });
  parser.on("callRangeValue", (start, end, _options, done) => {
    log.push(["range", start, end]);
    const grid = gridFor(start.sheetName);
    const r1 = start.row.index === -1 ? 0 : start.row.index;
    const r2 = end.row.index === -1 ? grid.length - 1 : end.row.index;
    const c1 = start.column.index === -1 ? 0 : start.column.index;
    const c2 = end.column.index === -1 ? grid[0].length - 1 : end.column.index;
    const rows = [];

    for (let r = r1; r <= r2; r += 1) {
      const line = [];

      for (let c = c1; c <= c2; c += 1) {
        line.push(grid[r]?.[c] ?? null);
      }
      rows.push(line);
    }
    done(rows);
  });

  return log;
}

/**
 * Replace error values by their code ("#N/A") so results compare with toEqual.
 */
export function plain(value) {
  if (value instanceof Error) {
    return error(value.message) || value.message;
  }
  if (Array.isArray(value)) {
    return value.map(plain);
  }

  return value;
}
