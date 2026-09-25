import { makeContext, input, value } from "../formula/helpers";
import { createFilter, applyFilterCondition } from "../../src/modules/filter";
import { moveCellRange } from "../../src/modules/moveCells";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { mockClipboard, cut, paste, sheetOf } from "../clipboard/helpers";

// Excel moves the AutoFilter with its data: cutting and pasting (or
// dragging) a block that contains the whole filter range takes the filter
// buttons, every column's criteria and the rows they hide along.

beforeEach(mockClipboard);

const hiddenRows = (cfg) =>
  Object.keys(cfg?.rowhidden || {})
    .map(Number)
    .sort((a, b) => a - b);

/** A1:B5 (Name, Qty) with an AutoFilter; Qty >= 30 keeps rows 4-5. */
function setup() {
  const ctx = makeContext({ rows: 30, cols: 10 });
  const rows = [
    ["Name", "Qty"],
    ["apple", "10"],
    ["banana", "20"],
    ["cherry", "30"],
    ["date", "40"],
  ];
  rows.forEach(([a, b], i) => {
    input(ctx, `A${i + 1}`, a);
    input(ctx, `B${i + 1}`, b);
  });
  ctx.config = {};
  sheetOf(ctx, "id_1").config = ctx.config;
  ctx.luckysheet_select_save = [
    { row: [0, 4], column: [0, 1], row_focus: 0, column_focus: 0 },
  ];
  createFilter(ctx);
  applyFilterCondition(ctx, 1, {
    type: "custom",
    op1: "greaterOrEqual",
    value1: "30",
  });
  return ctx;
}

describe("moving cells carries the AutoFilter", () => {
  test("setup: rows 2-3 hidden by the Qty filter", () => {
    const ctx = setup();
    expect(sheetOf(ctx, "id_1").filter_select).toMatchObject({
      row: [0, 4],
      column: [0, 1],
    });
    expect(hiddenRows(ctx.config)).toEqual([1, 2]);
  });

  test("cut/paste of the filtered block moves the filter and its state", () => {
    const ctx = setup();
    cut(ctx, "A1", "B5");
    paste(ctx, "D11");
    const file = sheetOf(ctx, "id_1");
    expect(value(ctx, "D11")).toBe("Name");
    expect(file.filter_select).toEqual({ row: [10, 14], column: [3, 4] });
    expect(ctx.luckysheet_filter_save).toEqual(file.filter_select);
    // the Qty column's criteria moved from column B to column E
    const qty = file.filter[1];
    expect(qty).toMatchObject({
      cindex: 4,
      str: 10,
      edr: 14,
      stc: 3,
      edc: 4,
      caljs: { type: "custom", op1: "greaterOrEqual", value1: "30" },
    });
    expect(Object.keys(qty.rowhidden).map(Number)).toEqual([11, 12]);
    expect(ctx.filter).toEqual(file.filter);
    // the old rows are shown again, the new ones hidden
    expect(hiddenRows(ctx.config)).toEqual([11, 12]);
    expect(hiddenRows(file.config)).toEqual([11, 12]);
  });

  test("a sideways move keeps the hidden rows", () => {
    const ctx = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 4], column: [0, 1] } },
      { sheetId: "id_1", row: 0, column: 5 }
    );
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toEqual({ row: [0, 4], column: [5, 6] });
    expect(file.filter[1].cindex).toBe(6);
    expect(hiddenRows(ctx.config)).toEqual([1, 2]);
  });

  test("hand-hidden rows outside the filter stay hidden", () => {
    const ctx = setup();
    ctx.config.rowhidden = { ...ctx.config.rowhidden, 20: 0 };
    cut(ctx, "A1", "B5");
    paste(ctx, "A11");
    expect(hiddenRows(ctx.config)).toEqual([11, 12, 20]);
  });

  test("moving part of the filter range leaves the filter in place", () => {
    const ctx = setup();
    cut(ctx, "A1", "A5");
    paste(ctx, "D1");
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toMatchObject({ row: [0, 4], column: [0, 1] });
    expect(hiddenRows(ctx.config)).toEqual([1, 2]);
  });

  test("to another sheet: the filter goes along", () => {
    const ctx = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 4], column: [0, 1] } },
      { sheetId: "id_2", row: 2, column: 2 }
    );
    const src = sheetOf(ctx, "id_1");
    const dst = sheetOf(ctx, "id_2");
    expect(src.filter_select).toBeUndefined();
    expect(src.filter).toBeUndefined();
    expect(ctx.luckysheet_filter_save).toBeUndefined();
    expect(hiddenRows(ctx.config)).toEqual([]);
    expect(dst.filter_select).toEqual({ row: [2, 6], column: [2, 3] });
    expect(dst.filter[1].cindex).toBe(3);
    expect(hiddenRows(dst.config)).toEqual([3, 4]);
  });

  test("a sheet keeps its own AutoFilter when one moves in beside it", () => {
    const ctx = setup();
    const dst = sheetOf(ctx, "id_2");
    dst.filter_select = { row: [20, 22], column: [0, 0] };
    dst.filter = {};
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 4], column: [0, 1] } },
      { sheetId: "id_2", row: 0, column: 4 }
    );
    expect(dst.filter_select).toEqual({ row: [20, 22], column: [0, 0] });
    expect(sheetOf(ctx, "id_1").filter_select).toBeUndefined();
    expect(hiddenRows(ctx.config)).toEqual([]);
  });
});

describe("row and column insert/delete keep the AutoFilter aligned", () => {
  test("rows inserted above move the range, criteria and hidden rows", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toMatchObject({ row: [2, 6], column: [0, 1] });
    expect(file.filter[1]).toMatchObject({ cindex: 1, str: 2, edr: 6 });
    expect(Object.keys(file.filter[1].rowhidden).map(Number)).toEqual([3, 4]);
    expect(hiddenRows(ctx.config)).toEqual([3, 4]);
    // and deleted again
    deleteRowCol(ctx, { type: "row", start: 0, end: 0, id: "id_1" });
    expect(file.filter_select).toMatchObject({ row: [1, 5] });
    expect(Object.keys(file.filter[1].rowhidden).map(Number)).toEqual([2, 3]);
    expect(hiddenRows(ctx.config)).toEqual([2, 3]);
  });

  test("rows inserted inside grow the range", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 2,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toMatchObject({ row: [0, 5] });
    expect(Object.keys(file.filter[1].rowhidden).map(Number)).toEqual([1, 3]);
  });

  test("columns inserted before move the criteria to the right column", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toMatchObject({ column: [1, 2] });
    expect(file.filter[1]).toMatchObject({ cindex: 2, stc: 1, edc: 2 });
  });

  test("deleting rows inside shrinks the range and drops their state", () => {
    const ctx = setup();
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toMatchObject({ row: [0, 3] });
    expect(Object.keys(file.filter[1].rowhidden).map(Number)).toEqual([1]);
    expect(hiddenRows(ctx.config)).toEqual([1]);
  });

  test("deleting a column before the filter shifts its criteria left", () => {
    const ctx = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 4], column: [0, 1] } },
      { sheetId: "id_1", row: 0, column: 2 }
    );
    deleteRowCol(ctx, { type: "column", start: 0, end: 0, id: "id_1" });
    const file = sheetOf(ctx, "id_1");
    expect(file.filter_select).toMatchObject({ column: [1, 2] });
    expect(file.filter[1]).toMatchObject({ cindex: 2, stc: 1, edc: 2 });
  });
});
