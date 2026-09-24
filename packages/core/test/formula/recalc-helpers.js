// Shared helpers for the recalculation correctness tests and benchmarks.
// (Not a test file itself: jest only picks up *.test.js.)
import { contextFactory } from "../factories/context";
import {
  FormulaCache,
  updateCell,
  groupValuesRefresh,
  setFormulaCellInfoMap,
  getFlowdata,
} from "../../src";

export function makeSheet(name, id, rows, cols, order = 0) {
  const data = new Array(rows);
  for (let r = 0; r < rows; r += 1) {
    data[r] = new Array(cols).fill(null);
  }
  return { name, id, order, data, calcChain: [], status: order === 0 ? 1 : 0 };
}

export function makeCtx(sheets) {
  return contextFactory({
    currentSheetId: sheets[0].id,
    luckysheetfile: sheets,
    formulaCache: new FormulaCache(),
    groupValuesRefreshData: [],
  });
}

/** Put a formula straight into sheet data (as a loaded workbook would have it). */
export function putFormula(sheet, r, c, f, v = 0) {
  sheet.data[r][c] = { f, v, m: String(v) };
  sheet.calcChain.push({ r, c, id: sheet.id });
}

export function putValue(sheet, r, c, v) {
  sheet.data[r][c] = { v, m: String(v), ct: { fa: "General", t: "n" } };
}

/** Mimics the Workbook component's init: register every sheet's formulas. */
export function loadWorkbook(ctx) {
  ctx.luckysheetfile.forEach((sheet) => {
    setFormulaCellInfoMap(ctx, sheet.calcChain, sheet.data);
  });
}

/** Type a value / formula into a cell the way the UI does, then flush results. */
export function edit(ctx, r, c, value, sheetId) {
  if (sheetId) ctx.currentSheetId = sheetId;
  updateCell(ctx, r, c, null, value);
  groupValuesRefresh(ctx);
}

export function val(ctx, r, c, sheetId) {
  const data = getFlowdata(ctx, sheetId || ctx.currentSheetId);
  return data?.[r]?.[c]?.v;
}

export function cell(ctx, r, c, sheetId) {
  const data = getFlowdata(ctx, sheetId || ctx.currentSheetId);
  return data?.[r]?.[c];
}
