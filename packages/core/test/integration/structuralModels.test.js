import { makeContext, input, value, cell } from "../formula/helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { insertCells, deleteCells } from "../../src/modules/shiftCells";
import { moveCellRange } from "../../src/modules/moveCells";
import {
  deleteSheet,
  duplicateSheet,
  renameSheet,
} from "../../src/modules/sheet";
import { createTable, findTable } from "../../src/modules/tables";
import { findDefinedName, saveDefinedName } from "../../src/modules/names";
import { findChart, insertChart } from "../../src/modules/chart";
import { getReferenceAdjusterKeys } from "../../src/modules/refAdjust";
import { groupValuesRefresh } from "../../src/modules/formula";
import { MODEL_ADJUSTER_KEYS } from "../../src/modules/modelSync";

// Every structural edit (rows/columns, cells with a shift, cut/paste,
// sheet rename/delete/duplicate) keeps defined names, tables and charts in
// sync, and each model is adjusted exactly once per edit.

function fill(ctx, entries, sheetId = "id_1") {
  Object.entries(entries).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

/**
 * Sheet1!A1:C4 = Item / Qty / Price (Table1), a workbook name `Qtys` on
 * B2:B4, a sheet-scoped name `Corner` on E1 (outside the data), a chart of
 * A1:C4 at (10, 100), and formulas using all of them on the other sheet.
 */
function setup() {
  const ctx = makeContext({ rows: 14, cols: 10 });
  fill(ctx, {
    A1: "Item",
    B1: "Qty",
    C1: "Price",
    A2: "Pen",
    B2: "2",
    C2: "1.5",
    A3: "Book",
    B3: "1",
    C3: "12",
    A4: "Cup",
    B4: "4",
    C4: "3",
  });
  expect(
    createTable(ctx, "id_1", { row: [0, 3], column: [0, 2] }).error
  ).toBeUndefined();
  expect(
    saveDefinedName(ctx, { name: "Qtys", refersTo: "=Sheet1!$B$2:$B$4" })
  ).toBeNull();
  expect(
    saveDefinedName(ctx, {
      name: "Corner",
      refersTo: "=Sheet1!$E$1",
      scope: "id_1",
    })
  ).toBeNull();
  const chart = insertChart(ctx, {
    type: "column",
    range: { sheetId: "id_1", row: [0, 3], column: [0, 2] },
    left: 10,
    top: 100,
  });
  fill(
    ctx,
    {
      A1: "=SUM(Qtys)",
      A2: "=SUM(Table1[Qty])",
      A3: "=Sheet1!B4",
    },
    "id_2"
  );
  return { ctx, chartId: chart.id };
}

const tableRange = (ctx, name = "Table1") => findTable(ctx, name)?.table.range;
const refersTo = (ctx, name, sheetId) =>
  findDefinedName(ctx, name, sheetId)?.refersTo;
const chartOf = (ctx, id) => findChart(ctx, id).chart;

describe("model adjusters are registered with refAdjust", () => {
  test("names, tables, charts and notes are registered once", () => {
    const keys = getReferenceAdjusterKeys();
    MODEL_ADJUSTER_KEYS.forEach((key) => {
      expect(keys.filter((k) => k === key)).toHaveLength(1);
    });
  });
});

describe("rows and columns: every model moves exactly once", () => {
  test("inserting rows above the data", () => {
    const { ctx, chartId } = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    groupValuesRefresh(ctx);
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$4:$B$6");
    expect(refersTo(ctx, "Corner", "id_1")).toBe("=Sheet1!$E$3");
    expect(tableRange(ctx)).toEqual({ row: [2, 5], column: [0, 2] });
    const chart = chartOf(ctx, chartId);
    expect(chart.source.row).toEqual([2, 5]);
    expect(chart.series[0].values.row).toEqual([3, 5]);
    // two default rows (20px each) were inserted above the chart
    expect(chart.top).toBe(140);
    expect(cell(ctx, "A3", "id_2").f).toBe("=Sheet1!B6");
    expect(value(ctx, "A1", "id_2")).toBe(7);
    expect(value(ctx, "A2", "id_2")).toBe(7);
  });

  test("inserting a row inside the table grows it once", () => {
    const { ctx, chartId } = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 2,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$2:$B$5");
    expect(tableRange(ctx)).toEqual({ row: [0, 4], column: [0, 2] });
    expect(chartOf(ctx, chartId).source.row).toEqual([0, 4]);
  });

  test("deleting rows", () => {
    const { ctx, chartId } = setup();
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$2:$B$3");
    expect(tableRange(ctx)).toEqual({ row: [0, 2], column: [0, 2] });
    expect(chartOf(ctx, chartId).source.row).toEqual([0, 2]);
    expect(value(ctx, "A1", "id_2")).toBe(5);
    expect(value(ctx, "A2", "id_2")).toBe(5);
  });

  test("inserting and deleting columns", () => {
    const { ctx, chartId } = setup();
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$C$2:$C$4");
    expect(refersTo(ctx, "Corner", "id_1")).toBe("=Sheet1!$F$1");
    expect(tableRange(ctx)).toEqual({ row: [0, 3], column: [1, 3] });
    expect(chartOf(ctx, chartId).source.column).toEqual([1, 3]);
    deleteRowCol(ctx, { type: "column", start: 0, end: 0, id: "id_1" });
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$2:$B$4");
    expect(tableRange(ctx)).toEqual({ row: [0, 3], column: [0, 2] });
    expect(chartOf(ctx, chartId).source.column).toEqual([0, 2]);
  });

  test("a column inserted inside a table gets a header once the cells moved", () => {
    const { ctx } = setup();
    insertRowCol(ctx, {
      type: "column",
      index: 1,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    const { table } = findTable(ctx, "Table1");
    expect(table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Column2",
      "Qty",
      "Price",
    ]);
    expect(cell(ctx, "B1").v).toBe("Column2");
    expect(cell(ctx, "C1").v).toBe("Qty");
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$C$2:$C$4");
  });

  test("deleting a table column breaks references to it", () => {
    const { ctx } = setup();
    deleteRowCol(ctx, { type: "column", start: 1, end: 1, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(findTable(ctx, "Table1").table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Price",
    ]);
    expect(cell(ctx, "A2", "id_2").f).toBe("=SUM(#REF!)");
    expect(refersTo(ctx, "Qtys")).toBe("=#REF!");
  });

  test("deleting every row of a table removes it; references become #REF!", () => {
    const { ctx, chartId } = setup();
    deleteRowCol(ctx, { type: "row", start: 0, end: 3, id: "id_1" });
    expect(findTable(ctx, "Table1")).toBeNull();
    expect(cell(ctx, "A2", "id_2").f).toBe("=SUM(#REF!)");
    expect(chartOf(ctx, chartId).source).toBeNull();
  });
});

describe("insert / delete cells with a shift", () => {
  test("shifting whole table columns down moves names, table and chart", () => {
    const { ctx, chartId } = setup();
    insertCells(ctx, { row: [0, 0], column: [0, 2] }, "down");
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$3:$B$5");
    // E1 is outside the shifted band
    expect(refersTo(ctx, "Corner", "id_1")).toBe("=Sheet1!$E$1");
    expect(tableRange(ctx)).toEqual({ row: [1, 4], column: [0, 2] });
    expect(chartOf(ctx, chartId).source.row).toEqual([1, 4]);
    // objects are not moved by a cell shift
    expect(chartOf(ctx, chartId).top).toBe(100);
  });

  test("deleting the table's cells removes it", () => {
    const { ctx, chartId } = setup();
    deleteCells(ctx, { row: [0, 3], column: [0, 2] }, "up");
    expect(findTable(ctx, "Table1")).toBeNull();
    expect(cell(ctx, "A2", "id_2").f).toBe("=SUM(#REF!)");
    expect(refersTo(ctx, "Qtys")).toBe("=#REF!");
    expect(chartOf(ctx, chartId).source).toBeNull();
  });

  test("shifting cells right over whole table rows adds table columns", () => {
    const { ctx } = setup();
    insertCells(ctx, { row: [0, 3], column: [1, 1] }, "right");
    const { table } = findTable(ctx, "Table1");
    expect(table.range).toEqual({ row: [0, 3], column: [0, 3] });
    expect(table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Column2",
      "Qty",
      "Price",
    ]);
    expect(cell(ctx, "B1").v).toBe("Column2");
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$C$2:$C$4");
  });

  test("a shift that would tear a table apart is refused", () => {
    const { ctx } = setup();
    expect(() =>
      insertCells(ctx, { row: [1, 1], column: [1, 1] }, "down")
    ).toThrow("tableShift");
    expect(() =>
      deleteCells(ctx, { row: [0, 0], column: [2, 3] }, "left")
    ).toThrow("tableShift");
    // nothing changed
    expect(tableRange(ctx)).toEqual({ row: [0, 3], column: [0, 2] });
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$2:$B$4");
    // cells below / right of a table can still be shifted
    insertCells(ctx, { row: [5, 5], column: [0, 2] }, "down");
    insertCells(ctx, { row: [0, 3], column: [4, 4] }, "right");
    expect(tableRange(ctx)).toEqual({ row: [0, 3], column: [0, 2] });
    expect(refersTo(ctx, "Corner", "id_1")).toBe("=Sheet1!$F$1");
  });
});

describe("cut/paste (move)", () => {
  test("moving the table block to another sheet carries every model", () => {
    const { ctx, chartId } = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 3], column: [0, 2] } },
      { sheetId: "id_2", row: 4, column: 4 }
    );
    groupValuesRefresh(ctx);
    const ref = findTable(ctx, "Table1");
    expect(ref.sheetId).toBe("id_2");
    expect(ref.table.range).toEqual({ row: [4, 7], column: [4, 6] });
    expect(ctx.luckysheetfile[0].tables).toBeUndefined();
    expect(refersTo(ctx, "Qtys")).toBe("='My Sheet'!$F$6:$F$8");
    const chart = chartOf(ctx, chartId);
    expect(chart.source).toEqual({
      sheetId: "id_2",
      row: [4, 7],
      column: [4, 6],
    });
    expect(value(ctx, "A1", "id_2")).toBe(7);
    expect(value(ctx, "A2", "id_2")).toBe(7);
    // qualified references stay qualified (Excel)
    expect(cell(ctx, "A3", "id_2").f).toBe("='My Sheet'!F8");
  });

  test("moving part of the data moves only what points inside it", () => {
    const { ctx } = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [1, 3], column: [1, 1] } },
      { sheetId: "id_1", row: 8, column: 1 }
    );
    expect(refersTo(ctx, "Qtys")).toBe("=Sheet1!$B$9:$B$11");
    // the table itself is not inside the moved block: it stays
    expect(tableRange(ctx)).toEqual({ row: [0, 3], column: [0, 2] });
  });
});

describe("sheets", () => {
  test("renaming a sheet renames references in names", () => {
    const { ctx } = setup();
    expect(renameSheet(ctx, "id_1", "Data")).toBeNull();
    expect(refersTo(ctx, "Qtys")).toBe("=Data!$B$2:$B$4");
    expect(refersTo(ctx, "Corner", "id_1")).toBe("=Data!$E$1");
    expect(cell(ctx, "A3", "id_2").f).toBe("=Data!B4");
    groupValuesRefresh(ctx);
  });

  test("deleting a sheet breaks names, tables and chart ranges on it", () => {
    const { ctx } = setup();
    // a chart on the other sheet plotting Sheet1
    ctx.currentSheetId = "id_2";
    const chart = insertChart(ctx, {
      type: "line",
      range: { sheetId: "id_1", row: [0, 3], column: [0, 2] },
      left: 0,
      top: 0,
    });
    ctx.currentSheetId = "id_1";
    deleteSheet(ctx, "id_1");
    expect(ctx.luckysheetfile).toHaveLength(1);
    // the workbook name moved to the remaining sheet
    expect(refersTo(ctx, "Qtys")).toBe("=#REF!");
    expect(refersTo(ctx, "Corner", "id_1")).toBeUndefined();
    expect(findTable(ctx, "Table1")).toBeNull();
    expect(cell(ctx, "A2", "id_2").f).toBe("=SUM(#REF!)");
    expect(chartOf(ctx, chart.id).source).toBeNull();
  });

  test("duplicating a sheet gives its tables, names and charts their own identity", () => {
    const { ctx, chartId } = setup();
    input(ctx, "E2", "=SUM(Table1[Price])");
    const copyId = duplicateSheet(ctx, "id_1", { newSheetId: "id_3" });
    const copy = ctx.luckysheetfile.find((s) => s.id === copyId);
    expect(copy.name).toBe("Sheet1 (2)");
    // Table1 keeps its name; the copy's table gets a new one
    expect(findTable(ctx, "Table1").sheetId).toBe("id_1");
    const copyTable = copy.tables[0];
    expect(copyTable.name).not.toBe("Table1");
    expect(findTable(ctx, copyTable.name).sheetId).toBe(copyId);
    expect(copy.data[1][4].f).toBe(`=SUM(${copyTable.name}[Price])`);
    expect(cell(ctx, "E2").f).toBe("=SUM(Table1[Price])");
    // workbook names are not duplicated; the sheet-scoped one points at
    // the copy
    expect(copy.definedNames).toEqual([
      { name: "Corner", refersTo: "='Sheet1 (2)'!$E$1", local: true },
    ]);
    expect(refersTo(ctx, "Corner", "id_1")).toBe("=Sheet1!$E$1");
    // the copied chart plots the copied cells
    const copied = copy.charts[0];
    expect(copied.id).not.toBe(chartId);
    expect(copied.source.sheetId).toBe(copyId);
    expect(chartOf(ctx, chartId).source.sheetId).toBe("id_1");
  });
});
