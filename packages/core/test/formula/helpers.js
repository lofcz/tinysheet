import { contextFactory } from "../factories/context";
import { FormulaCache } from "../../src";
import { updateCell } from "../../src/modules/cell";
import { groupValuesRefresh } from "../../src/modules/formula";
import { deleteSelectedCellText } from "../../src/modules/selection";
import { jfrefreshgrid } from "../../src/modules/refresh";

function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
}

export function parseA1(a1) {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  let c = 0;
  for (let i = 0; i < m[1].length; i += 1) {
    c = c * 26 + (m[1].charCodeAt(i) - 64);
  }
  return { r: parseInt(m[2], 10) - 1, c: c - 1 };
}

/** A two-sheet workbook ("Sheet1", "My Sheet") with empty 12x8 grids. */
export function makeContext(options = {}) {
  const { rows = 12, cols = 8 } = options;
  return contextFactory({
    formulaCache: new FormulaCache(),
    groupValuesRefreshData: [],
    luckysheetfile: [
      { name: "Sheet1", id: "id_1", order: 0, data: emptyGrid(rows, cols) },
      { name: "My Sheet", id: "id_2", order: 1, data: emptyGrid(rows, cols) },
    ],
  });
}

function withSheet(ctx, sheetId, fn) {
  const prev = ctx.currentSheetId;
  ctx.currentSheetId = sheetId;
  try {
    return fn();
  } finally {
    ctx.currentSheetId = prev;
  }
}

/** Type a value or formula into a cell, like the cell editor does. */
export function input(ctx, a1, text, sheetId = "id_1") {
  const { r, c } = parseA1(a1);
  // Mimic the cell editor element (its text is used when the value is empty).
  const $input = { innerText: text, innerHTML: text };
  withSheet(ctx, sheetId, () => {
    updateCell(ctx, r, c, $input, text);
    groupValuesRefresh(ctx);
  });
}

/** Press Delete on a range, like the keyboard handler does. */
export function pressDelete(ctx, from, to = from) {
  const a = parseA1(from);
  const b = parseA1(to);
  ctx.luckysheet_select_save = [
    { row: [a.r, b.r], column: [a.c, b.c], row_focus: a.r, column_focus: a.c },
  ];
  deleteSelectedCellText(ctx);
  jfrefreshgrid(ctx, null, undefined);
  groupValuesRefresh(ctx);
}

export function cell(ctx, a1, sheetId = "id_1") {
  const { r, c } = parseA1(a1);
  const sheet = ctx.luckysheetfile.find((s) => s.id === sheetId);
  return sheet.data[r][c];
}

export function value(ctx, a1, sheetId = "id_1") {
  return cell(ctx, a1, sheetId)?.v;
}

/** Values of a rectangular range as a 2D array. */
export function values(ctx, from, to, sheetId = "id_1") {
  const { r: r1, c: c1 } = parseA1(from);
  const { r: r2, c: c2 } = parseA1(to);
  const { data } = ctx.luckysheetfile.find((s) => s.id === sheetId);
  const out = [];
  for (let r = r1; r <= r2; r += 1) {
    const row = [];
    for (let c = c1; c <= c2; c += 1) row.push(data[r][c]?.v);
    out.push(row);
  }
  return out;
}
