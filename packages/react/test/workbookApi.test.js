import { generateAPIs } from "../src/components/Workbook/api";
import { api, defaultSettings } from "@lofcz/tinysheet-core";
import { applyExcelImportHydration } from "../../excel/src/hydrate/applyExcelImportHydration";
import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  val,
} from "../../core/test/formula/recalc-helpers";

function fixture(schedule) {
  const data = makeSheet("Data", "data", 4, 3);
  const summary = makeSheet("Summary", "summary", 4, 3, 1);
  putValue(data, 0, 0, 7);
  putFormula(data, 0, 1, "=A1*2", 14);
  putValue(summary, 0, 0, "Preserved header");
  putFormula(summary, 0, 1, "=Data!B1+1", 15);
  const ctx = makeCtx([data, summary]);
  loadWorkbook(ctx);
  const set = schedule ?? ((recipe) => recipe(ctx));
  const workbook = generateAPIs(
    ctx,
    set,
    () => {},
    () => {},
    defaultSettings,
    null,
    null,
    null
  );
  return { ctx, workbook };
}

test("numeric range edits recalculate existing formulas and other tabs", () => {
  const { ctx, workbook } = fixture();
  workbook.setCellValuesByRange(
    [[10]],
    { row: [0, 0], column: [0, 0] },
    { id: "data" }
  );
  expect(val(ctx, 0, 1, "data")).toBe(20);
  expect(val(ctx, 0, 1, "summary")).toBe(21);
  expect(val(ctx, 0, 0, "summary")).toBe("Preserved header");
  expect(ctx.currentSheetId).toBe("data");
  workbook.clearCell(0, 0, { id: "data" });
  expect(val(ctx, 0, 1, "summary")).toBe(1);
});

test("replacing or clearing a formula removes it and updates its dependents", () => {
  const { ctx, workbook } = fixture();
  workbook.setCellValue(0, 1, 99, { id: "data" });
  expect(ctx.luckysheetfile[0].data[0][1].f).toBeUndefined();
  expect(val(ctx, 0, 1, "summary")).toBe(100);
  workbook.setCellValue(0, 1, "=A1*2", { id: "data" });
  workbook.setCellValuesByRange(
    [[null]],
    { row: [0, 0], column: [1, 1] },
    { id: "data" }
  );
  expect(ctx.luckysheetfile[0].data[0][1].f).toBeUndefined();
  expect(val(ctx, 0, 1, "summary")).toBe(1);
});

test("formula writes target a nonactive tab without changing the active tab", () => {
  const { ctx, workbook } = fixture();
  workbook.setCellValue(0, 1, "=Data!A1*3", { id: "summary" });
  expect(val(ctx, 0, 1, "summary")).toBe(21);
  expect(val(ctx, 0, 1, "data")).toBe(14);
  expect(ctx.currentSheetId).toBe("data");
});

test("invalid currency formats throw before a React recipe is scheduled", () => {
  const schedule = jest.fn();
  const { workbook } = fixture(schedule);
  expect(() =>
    workbook.setCellFormatByRange(
      "ct",
      { fa: "#,##0.00 Kč", t: "n" },
      { row: [0, 0], column: [0, 0] }
    )
  ).toThrow("Invalid Excel number format");
  expect(schedule).not.toHaveBeenCalled();
  workbook.setCellFormatByRange(
    "ct",
    { fa: '#,##0.00 "Kč"', t: "n" },
    { row: [0, 0], column: [0, 0] }
  );
  expect(schedule).toHaveBeenCalledTimes(1);
});

test("calculateFormula writes results into each requested tab", () => {
  const { ctx } = fixture();
  api.calculateFormula(ctx, "summary");
  expect(val(ctx, 0, 1, "summary")).toBe(15);
  expect(val(ctx, 0, 1, "data")).toBe(14);
});

test("XLSX hydration calculates references topologically without overwriting source data", () => {
  const { ctx } = fixture();
  ctx.luckysheetfile[0].data[0][0].v = 10;
  ctx.luckysheetfile.reverse(); // summary precedes the data it depends on
  applyExcelImportHydration(ctx, { sheets: ctx.luckysheetfile, sizing: [] });
  expect(val(ctx, 0, 0, "data")).toBe(10);
  expect(val(ctx, 0, 1, "data")).toBe(20);
  expect(val(ctx, 0, 1, "summary")).toBe(21);
  expect(val(ctx, 0, 0, "summary")).toBe("Preserved header");
});
