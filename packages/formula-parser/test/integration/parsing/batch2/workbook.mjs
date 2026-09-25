// Shared helper for the batch-2 function tests (not a test file itself).
import Parser from "../../../../src/parser";
import error from "../../../../src/error";

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

/**
 * A parser wired to an in-memory sheet given as a 2D array (row-major,
 * starting at A1). Returns `evaluate(formula)` which yields the result, or
 * the error code when the formula fails.
 *
 * @param {Array<Array>} [sheet]
 * @returns {Function}
 */
export function workbook(sheet = []) {
  const parser = new Parser();

  parser.on("callCellValue", (cell, _options, done) => {
    done(sheet[cell.row.index]?.[cell.column.index] ?? null);
  });
  parser.on("callRangeValue", (start, end, _options, done) => {
    const width = sheet.reduce((w, row) => Math.max(w, row.length), 0);
    const r1 = start.row.index === -1 ? 0 : start.row.index;
    const r2 = end.row.index === -1 ? sheet.length - 1 : end.row.index;
    const c1 = start.column.index === -1 ? 0 : start.column.index;
    const c2 = end.column.index === -1 ? width - 1 : end.column.index;
    const rows = [];

    for (let r = r1; r <= r2; r += 1) {
      const line = [];

      for (let c = c1; c <= c2; c += 1) {
        line.push(sheet[r]?.[c] ?? null);
      }
      rows.push(line);
    }
    done(rows);
  });

  return (formula) => {
    const { error: err, result } = parser.parse(formula);

    return err === null ? plain(result) : err;
  };
}
