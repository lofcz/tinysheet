import { makeContext, input, value, values, cell } from "../formula/helpers";
import {
  convertTableToRange,
  createTable,
  findTable,
  resizeTable,
  setTableOptions,
  setTableTotalFunction,
  tableAt,
  TABLE_STYLES,
} from "../../src/modules/tables";
import {
  expandFormulaNames,
  nameOfRange,
  saveDefinedName,
  validateDefinedName,
} from "../../src/modules/names";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";

function fill(ctx, entries, sheetId = "id_1") {
  Object.entries(entries).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

/** A1:C4 = Item / Qty / Price with three rows, as Table1. */
function salesTable(ctx) {
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
  const res = createTable(ctx, "id_1", { row: [0, 3], column: [0, 2] });
  expect(res.error).toBeUndefined();
  return res.table;
}

describe("creating tables", () => {
  test("Format as Table stores the table and styles it", () => {
    const ctx = makeContext();
    const table = salesTable(ctx);
    expect(table.name).toBe("Table1");
    expect(table.columns.map((c) => c.name)).toEqual(["Item", "Qty", "Price"]);
    expect(ctx.luckysheetfile[0].tables).toHaveLength(1);
    const style = TABLE_STYLES.TableStyleMedium2;
    expect(cell(ctx, "A1").bg).toBe(style.header);
    expect(cell(ctx, "A1").bl).toBe(1);
    expect(cell(ctx, "A2").bg).toBe(style.band);
    expect(cell(ctx, "A3").bg).toBeUndefined();
    expect(cell(ctx, "A4").bg).toBe(style.band);
    expect(tableAt(ctx, "id_1", 2, 1).table.name).toBe("Table1");
    expect(tableAt(ctx, "id_1", 4, 1)).toBeNull();
  });

  test("names: next free TableN, clashes and overlaps", () => {
    const ctx = makeContext();
    salesTable(ctx);
    const second = createTable(ctx, "id_1", { row: [6, 8], column: [0, 1] });
    expect(second.table.name).toBe("Table2");
    expect(
      createTable(ctx, "id_1", { row: [3, 5], column: [2, 3] }).error
    ).toBe("overlap");
    expect(validateDefinedName(ctx, "table1")).toBe("duplicate");
    expect(
      createTable(ctx, "id_2", { row: [0, 1], column: [0, 0] }, { name: "A1" })
        .error
    ).toBe("invalidName");
  });

  test("empty and duplicate headers get unique names", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "x", C1: "x" });
    const { table } = createTable(ctx, "id_1", {
      row: [0, 2],
      column: [0, 2],
    });
    expect(table.columns.map((c) => c.name)).toEqual(["x", "Column2", "x2"]);
    expect(value(ctx, "B1")).toBe("Column2");
    expect(value(ctx, "C1")).toBe("x2");
  });

  test("without headers the columns are Column1..N", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2" });
    const { table } = createTable(
      ctx,
      "id_1",
      { row: [0, 1], column: [0, 1] },
      { hasHeaders: false }
    );
    expect(table.headerRow).toBe(false);
    expect(table.columns.map((c) => c.name)).toEqual(["Column1", "Column2"]);
    input(ctx, "E1", "=SUM(Table1[Column1])");
    expect(value(ctx, "E1")).toBe(3);
  });
});

describe("structured references", () => {
  test("columns, specials and whole table", () => {
    const ctx = makeContext();
    salesTable(ctx);
    const x = (f) => expandFormulaNames(ctx, f, "id_1", 10, 5);
    expect(x("Table1[Qty]")).toBe("Sheet1!$B$2:$B$4");
    expect(x("table1[qty]")).toBe("Sheet1!$B$2:$B$4");
    expect(x("Table1[#All]")).toBe("Sheet1!$A$1:$C$4");
    expect(x("Table1[#Headers]")).toBe("Sheet1!$A$1:$C$1");
    expect(x("Table1[[#Headers],[Price]]")).toBe("Sheet1!$C$1");
    expect(x("Table1[[#Headers],[#Data],[Qty]]")).toBe("Sheet1!$B$1:$B$4");
    expect(x("Table1[[Qty]:[Price]]")).toBe("Sheet1!$B$2:$C$4");
    expect(x("Table1[]")).toBe("Sheet1!$A$2:$C$4");
    expect(x("Table1")).toBe("Sheet1!$A$2:$C$4");
    expect(x("Table1[#Totals]")).toBe("#REF!");
    expect(x("Table1[Nope]")).toBe("#REF!");
    expect(x("Nope[Qty]")).toBe("#REF!");
    expect(x('"Table1[Qty]"')).toBe('"Table1[Qty]"');
  });

  test("formulas over table columns", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "E1", "=SUM(Table1[Qty])");
    input(ctx, "E2", "=SUMPRODUCT(Table1[Qty],Table1[Price])");
    input(ctx, "E3", "=ROWS(Table1)");
    input(ctx, "E4", "=Table1[[#Headers],[Price]]");
    input(ctx, "E5", "=COUNTA(Table1[#All])");
    input(ctx, "E6", "=INDEX(Table1[Item],2)");
    expect(values(ctx, "E1", "E6")).toEqual([
      [7],
      [27],
      [3],
      ["Price"],
      [12],
      ["Book"],
    ]);
    // editing a data cell recalculates
    input(ctx, "B3", "10");
    expect(value(ctx, "E1")).toBe(16);
  });

  test("this-row references inside the table", () => {
    const ctx = makeContext();
    salesTable(ctx);
    // a calculated column D (the table grows to the right)
    input(ctx, "D1", "Total");
    expect(findTable(ctx, "Table1").table.range.column).toEqual([0, 3]);
    input(ctx, "D2", "=[@Qty]*[@Price]");
    input(ctx, "D3", "=[@Qty]*[@Price]");
    input(ctx, "D4", "=Table1[@Qty]*Table1[@[Price]]");
    expect(values(ctx, "D2", "D4")).toEqual([[3], [12], [12]]);
    input(ctx, "B2", "4");
    expect(value(ctx, "D2")).toBe(6);
    // outside the data rows [@...] is #VALUE!
    input(ctx, "F1", "=Table1[@Qty]");
    expect(value(ctx, "F1")).toBe("#VALUE!");
  });

  test("references from another sheet", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "A1", "=SUM(Table1[Price])", "id_2");
    expect(value(ctx, "A1", "id_2")).toBe(16.5);
    input(ctx, "C2", "2.5");
    expect(value(ctx, "A1", "id_2")).toBe(17.5);
  });

  test("names can refer to tables", () => {
    const ctx = makeContext();
    salesTable(ctx);
    saveDefinedName(ctx, { name: "Prices", refersTo: "=Table1[Price]" });
    input(ctx, "E1", "=MAX(Prices)");
    expect(value(ctx, "E1")).toBe(12);
  });
});

describe("auto-expansion", () => {
  test("typing below the table adds a row and updates formulas", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "E1", "=SUM(Table1[Qty])");
    input(ctx, "D1", "Total");
    input(ctx, "D2", "=[@Qty]*[@Price]");
    input(ctx, "D3", "=[@Qty]*[@Price]");
    input(ctx, "D4", "=[@Qty]*[@Price]");
    input(ctx, "A5", "Bag");
    const { table } = findTable(ctx, "Table1");
    expect(table.range.row).toEqual([0, 4]);
    input(ctx, "B5", "5");
    input(ctx, "C5", "2");
    expect(value(ctx, "E1")).toBe(12);
    // the calculated column was filled into the new row
    expect(cell(ctx, "D5").f).toBe("=[@Qty]*[@Price]");
    expect(value(ctx, "D5")).toBe(10);
    // banding continues
    expect(cell(ctx, "A5").bg).toBeUndefined();
  });

  test("typing right of the table adds a column named by the header", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "D1", "Tax");
    const { table } = findTable(ctx, "Table1");
    expect(table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Qty",
      "Price",
      "Tax",
    ]);
    expect(cell(ctx, "D1").bg).toBe(TABLE_STYLES.TableStyleMedium2.header);
  });

  test("editing a header renames the column", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "B1", "Count");
    expect(findTable(ctx, "Table1").table.columns[1].name).toBe("Count");
    input(ctx, "E1", "=SUM(Table1[Count])");
    expect(value(ctx, "E1")).toBe(7);
    // a duplicate header is made unique
    input(ctx, "C1", "Count");
    expect(value(ctx, "C1")).toBe("Count2");
  });
});

describe("table options", () => {
  test("total row with SUBTOTAL formulas", () => {
    const ctx = makeContext();
    salesTable(ctx);
    expect(setTableOptions(ctx, "Table1", { totalRow: true })).toBeNull();
    const { table } = findTable(ctx, "Table1");
    expect(table.range.row).toEqual([0, 4]);
    expect(value(ctx, "A5")).toBe("Total");
    expect(cell(ctx, "C5").f).toBe("=SUBTOTAL(109,Table1[Price])");
    expect(value(ctx, "C5")).toBe(16.5);
    expect(cell(ctx, "C5").bl).toBe(1);
    setTableTotalFunction(ctx, "Table1", 1, "average");
    expect(cell(ctx, "B5").f).toBe("=SUBTOTAL(101,Table1[Qty])");
    expect(value(ctx, "B5")).toBeCloseTo(7 / 3);
    input(ctx, "E1", "=Table1[[#Totals],[Price]]");
    expect(value(ctx, "E1")).toBe(16.5);
    input(ctx, "C2", "2.5");
    expect(value(ctx, "E1")).toBe(17.5);
    // turning it off clears the row
    setTableOptions(ctx, "Table1", { totalRow: false });
    expect(findTable(ctx, "Table1").table.range.row).toEqual([0, 3]);
    expect(value(ctx, "C5")).toBeUndefined();
    expect(value(ctx, "E1")).toBe("#REF!");
  });

  test("the total row needs an empty row below", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "B6", "x");
    input(ctx, "C5", "x");
    // C5 was typed below the table: it grew
    expect(findTable(ctx, "Table1").table.range.row).toEqual([0, 4]);
    expect(setTableOptions(ctx, "Table1", { totalRow: true })).toBe("noRoom");
  });

  test("style, banding and first/last column", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "B3", "7");
    setTableOptions(ctx, "Table1", {
      style: "TableStyleMedium7",
      bandedRows: false,
      firstColumn: true,
    });
    const style = TABLE_STYLES.TableStyleMedium7;
    expect(cell(ctx, "A1").bg).toBe(style.header);
    expect(cell(ctx, "A2").bg).toBeUndefined();
    expect(cell(ctx, "A2").bl).toBe(1);
    // a user fill is kept
    ctx.luckysheetfile[0].data[2][1].bg = "#123456";
    setTableOptions(ctx, "Table1", { bandedColumns: true });
    expect(cell(ctx, "B3").bg).toBe("#123456");
    expect(cell(ctx, "C3").bg).toBe(style.band);
  });

  test("rename and resize", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "E1", "=ROWS(Sales[Qty])");
    expect(value(ctx, "E1")).toBe("#REF!");
    expect(setTableOptions(ctx, "Table1", { name: "Sales" })).toBeNull();
    expect(value(ctx, "E1")).toBe(3);
    expect(setTableOptions(ctx, "Sales", { name: "A1" })).toBe("invalidName");
    expect(
      resizeTable(ctx, "Sales", { row: [0, 5], column: [0, 2] })
    ).toBeNull();
    expect(value(ctx, "E1")).toBe(5);
    expect(
      nameOfRange(ctx, { sheetId: "id_1", row: [0, 5], column: [0, 2] })
    ).toBe("Sales");
  });

  test("convert to range rewrites structured references", () => {
    const ctx = makeContext();
    salesTable(ctx);
    input(ctx, "E1", "=SUM(Table1[Qty])");
    input(ctx, "D1", "T");
    input(ctx, "D2", "=[@Qty]*2");
    expect(convertTableToRange(ctx, "Table1")).toBe(true);
    expect(ctx.luckysheetfile[0].tables).toBeUndefined();
    expect(cell(ctx, "E1").f).toBe("=SUM(Sheet1!$B$2:$B$4)");
    expect(cell(ctx, "D2").f).toBe("=Sheet1!$B$2*2");
    expect(value(ctx, "E1")).toBe(7);
    // formatting stays
    expect(cell(ctx, "A1").bg).toBe(TABLE_STYLES.TableStyleMedium2.header);
  });
});

describe("rows and columns", () => {
  test("inserting rows inside grows the table, above shifts it", () => {
    const ctx = makeContext();
    salesTable(ctx);
    insertRowCol(ctx, {
      type: "row",
      index: 2,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(findTable(ctx, "Table1").table.range.row).toEqual([0, 4]);
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(findTable(ctx, "Table1").table.range.row).toEqual([2, 6]);
    deleteRowCol(ctx, { type: "row", start: 2, end: 2, id: "id_1" });
    const { table } = findTable(ctx, "Table1");
    expect(table.range.row).toEqual([2, 5]);
    expect(table.headerRow).toBe(false);
  });

  test("inserting and deleting columns updates column names", () => {
    const ctx = makeContext();
    salesTable(ctx);
    insertRowCol(ctx, {
      type: "column",
      index: 1,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    let { table } = findTable(ctx, "Table1");
    expect(table.range.column).toEqual([0, 3]);
    expect(table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Column2",
      "Qty",
      "Price",
    ]);
    deleteRowCol(ctx, { type: "column", start: 2, end: 2, id: "id_1" });
    ({ table } = findTable(ctx, "Table1"));
    expect(table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Column2",
      "Price",
    ]);
    deleteRowCol(ctx, { type: "column", start: 0, end: 5, id: "id_1" });
    expect(findTable(ctx, "Table1")).toBeNull();
  });
});
