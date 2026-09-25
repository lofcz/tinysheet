import { makeContext, input, value, cell } from "../formula/helpers";
import {
  convertTableToRange,
  createTable,
  findTable,
  mapStructuredReferences,
  renameColumnInReference,
  setTableOptions,
} from "../../src/modules/tables";
import { findDefinedName, saveDefinedName } from "../../src/modules/names";
import { groupValuesRefresh } from "../../src/modules/formula";

// Renaming a table or one of its columns rewrites the structured references
// of every formula in the workbook (Excel); converting a table to a range
// turns them into A1 references; INDIRECT resolves names and tables.

function fill(ctx, entries, sheetId = "id_1") {
  Object.entries(entries).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

/**
 * Table1 = Sheet1!A1:D4 (Item, Qty, Price, Total) where Total is the
 * calculated column [@Qty]*[@Price], plus formulas, a name, a validation
 * rule and a conditional format that use it.
 */
function setup() {
  const ctx = makeContext({ rows: 12, cols: 8 });
  fill(ctx, {
    A1: "Item",
    B1: "Qty",
    C1: "Price",
    D1: "Total",
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
    createTable(ctx, "id_1", { row: [0, 3], column: [0, 3] }).error
  ).toBeUndefined();
  fill(ctx, {
    D2: "=[@Qty]*[@Price]",
    D3: "=[@Qty]*[@Price]",
    D4: "=[@Qty]*[@Price]",
    F1: "=SUM(Table1[Qty])",
    F2: "=SUM(Table1[[#This Row],[Price]])",
  });
  expect(
    saveDefinedName(ctx, { name: "TotQty", refersTo: "=SUM(Table1[Qty])" })
  ).toBeNull();
  fill(
    ctx,
    {
      A1: "=SUM(Table1[Price])",
      A2: "=ROWS(Table1)",
      A3: '="Table1[Qty]"',
      A4: "=TotQty",
      A5: "=SUM(Table1[[Qty]:[Price]])",
      A6: "=SUM(Table1[Total])",
    },
    "id_2"
  );
  const other = ctx.luckysheetfile[1];
  other.dataVerification = {
    "7_0": {
      type: "custom",
      value1: "=COUNT(Table1[Qty])>0",
      value2: "",
    },
  };
  other.luckysheet_conditionformat_save = [
    {
      type: "default",
      cellrange: [{ row: [0, 0], column: [0, 0] }],
      conditionName: "formula",
      conditionValue: ["=A1>SUM(Table1[Price])"],
    },
  ];
  return ctx;
}

describe("renaming a table", () => {
  test("rewrites structured references everywhere", () => {
    const ctx = setup();
    expect(setTableOptions(ctx, "Table1", { name: "Sales" })).toBeNull();
    groupValuesRefresh(ctx);
    expect(findTable(ctx, "Sales")).not.toBeNull();
    expect(findTable(ctx, "Table1")).toBeNull();
    expect(cell(ctx, "F1").f).toBe("=SUM(Sales[Qty])");
    expect(cell(ctx, "F2").f).toBe("=SUM(Sales[[#This Row],[Price]])");
    // unqualified references need no change
    expect(cell(ctx, "D2").f).toBe("=[@Qty]*[@Price]");
    expect(cell(ctx, "A1", "id_2").f).toBe("=SUM(Sales[Price])");
    expect(cell(ctx, "A2", "id_2").f).toBe("=ROWS(Sales)");
    // text is not a reference
    expect(cell(ctx, "A3", "id_2").f).toBe('="Table1[Qty]"');
    expect(cell(ctx, "A5", "id_2").f).toBe("=SUM(Sales[[Qty]:[Price]])");
    expect(findDefinedName(ctx, "TotQty").refersTo).toBe("=SUM(Sales[Qty])");
    const other = ctx.luckysheetfile[1];
    expect(other.dataVerification["7_0"].value1).toBe("=COUNT(Sales[Qty])>0");
    expect(other.luckysheet_conditionformat_save[0].conditionValue).toEqual([
      "=A1>SUM(Sales[Price])",
    ]);
    expect(value(ctx, "F1")).toBe(7);
    expect(value(ctx, "A1", "id_2")).toBe(16.5);
    expect(value(ctx, "A2", "id_2")).toBe(3);
    expect(value(ctx, "A4", "id_2")).toBe(7);
    expect(value(ctx, "A5", "id_2")).toBe(23.5);
    expect(value(ctx, "A6", "id_2")).toBe(27);
  });

  test("renaming back and forth is lossless", () => {
    const ctx = setup();
    setTableOptions(ctx, "Table1", { name: "Sales" });
    setTableOptions(ctx, "sales", { name: "Table1" });
    expect(cell(ctx, "F1").f).toBe("=SUM(Table1[Qty])");
    expect(cell(ctx, "A2", "id_2").f).toBe("=ROWS(Table1)");
  });
});

describe("renaming a table column (editing its header)", () => {
  test("rewrites qualified and unqualified references to the column", () => {
    const ctx = setup();
    input(ctx, "B1", "Units");
    groupValuesRefresh(ctx);
    const { table } = findTable(ctx, "Table1");
    expect(table.columns.map((c) => c.name)).toEqual([
      "Item",
      "Units",
      "Price",
      "Total",
    ]);
    expect(cell(ctx, "D2").f).toBe("=[@Units]*[@Price]");
    expect(cell(ctx, "D4").f).toBe("=[@Units]*[@Price]");
    expect(cell(ctx, "F1").f).toBe("=SUM(Table1[Units])");
    // the other column of the reference is untouched
    expect(cell(ctx, "F2").f).toBe("=SUM(Table1[[#This Row],[Price]])");
    expect(cell(ctx, "A5", "id_2").f).toBe("=SUM(Table1[[Units]:[Price]])");
    expect(findDefinedName(ctx, "TotQty").refersTo).toBe("=SUM(Table1[Units])");
    expect(ctx.luckysheetfile[1].dataVerification["7_0"].value1).toBe(
      "=COUNT(Table1[Units])>0"
    );
    expect(value(ctx, "D3")).toBe(12);
    expect(value(ctx, "F1")).toBe(7);
    expect(value(ctx, "A4", "id_2")).toBe(7);
  });

  test("names that need brackets are bracketed", () => {
    const ctx = setup();
    input(ctx, "C1", "Unit Price");
    expect(cell(ctx, "D2").f).toBe("=[@Qty]*[@[Unit Price]]");
    expect(cell(ctx, "A1", "id_2").f).toBe("=SUM(Table1[Unit Price])");
    groupValuesRefresh(ctx);
    expect(value(ctx, "D2")).toBe(3);
    expect(value(ctx, "A1", "id_2")).toBe(16.5);
  });

  test("a formula outside the table keeps its unqualified brackets", () => {
    const ctx = setup();
    // not a structured reference outside a table: left alone
    input(ctx, "H1", "=1", "id_1");
    ctx.luckysheetfile[0].data[0][7].f = "=SUM([Qty])";
    input(ctx, "B1", "Units");
    expect(ctx.luckysheetfile[0].data[0][7].f).toBe("=SUM([Qty])");
  });
});

describe("converting a table to a range", () => {
  test("structured references become A1 references everywhere", () => {
    const ctx = setup();
    expect(convertTableToRange(ctx, "Table1")).toBe(true);
    groupValuesRefresh(ctx);
    expect(findTable(ctx, "Table1")).toBeNull();
    expect(cell(ctx, "F1").f).toBe("=SUM(Sheet1!$B$2:$B$4)");
    expect(cell(ctx, "D2").f).toBe("=Sheet1!$B$2*Sheet1!$C$2");
    expect(cell(ctx, "A2", "id_2").f).toBe("=ROWS(Sheet1!$A$2:$D$4)");
    expect(cell(ctx, "A3", "id_2").f).toBe('="Table1[Qty]"');
    expect(findDefinedName(ctx, "TotQty").refersTo).toBe(
      "=SUM(Sheet1!$B$2:$B$4)"
    );
    expect(ctx.luckysheetfile[1].dataVerification["7_0"].value1).toBe(
      "=COUNT(Sheet1!$B$2:$B$4)>0"
    );
    expect(
      ctx.luckysheetfile[1].luckysheet_conditionformat_save[0].conditionValue
    ).toEqual(["=A1>SUM(Sheet1!$C$2:$C$4)"]);
    expect(value(ctx, "F1")).toBe(7);
    expect(value(ctx, "A2", "id_2")).toBe(3);
    expect(value(ctx, "A4", "id_2")).toBe(7);
  });
});

describe("INDIRECT with names and tables", () => {
  test("resolves defined names, structured references and [@Col]", () => {
    const ctx = setup();
    saveDefinedName(ctx, { name: "Qtys", refersTo: "=Sheet1!$B$2:$B$4" });
    saveDefinedName(ctx, {
      name: "Here",
      refersTo: "='My Sheet'!$A$1",
      scope: "id_2",
    });
    fill(
      ctx,
      {
        B1: '=SUM(INDIRECT("Qtys"))',
        B2: '=SUM(INDIRECT("Table1[Qty]"))',
        B3: '=SUM(INDIRECT("table1[[#All],[Price]]"))',
        B4: '=INDIRECT("Here")',
        B5: '=INDIRECT("NoSuchName")',
        B6: '=ROWS(INDIRECT("Table1"))',
      },
      "id_2"
    );
    // a sheet-scoped name is not visible from another sheet
    input(ctx, "H1", '=INDIRECT("Here")');
    // [@Col] resolves against the formula's row (typing next to the table
    // extends it, so E3 is inside it); outside a table it is #REF!
    input(ctx, "E3", '=INDIRECT("[@Qty]")');
    input(ctx, "H5", '=INDIRECT("[@Qty]")');
    expect(value(ctx, "B1", "id_2")).toBe(7);
    expect(value(ctx, "B2", "id_2")).toBe(7);
    expect(value(ctx, "B3", "id_2")).toBe(16.5);
    expect(value(ctx, "B4", "id_2")).toBe(16.5);
    expect(value(ctx, "B5", "id_2")).toBe("#REF!");
    expect(value(ctx, "B6", "id_2")).toBe(3);
    expect(value(ctx, "H1")).toBe("#REF!");
    expect(findTable(ctx, "Table1").table.range.column).toEqual([0, 4]);
    expect(value(ctx, "E3")).toBe(1);
    expect(value(ctx, "H5")).toBe("#REF!");
  });
});

describe("structured reference helpers", () => {
  test("mapStructuredReferences skips strings, functions and sheet names", () => {
    const seen = [];
    mapStructuredReferences(
      "=SUM(T[a])+'T'!A1+\"T[x]\"+T+T(1)+Sheet1!T+[@b]+[1]Sheet1!A1+1E5",
      (t, content) => {
        seen.push([t, content]);
        return null;
      }
    );
    expect(seen).toEqual([
      ["T", "a"],
      ["T", null],
      [null, "@b"],
    ]);
  });

  test("renameColumnInReference handles every form", () => {
    expect(renameColumnInReference("Qty", "qty", "Units")).toBe("Units");
    expect(renameColumnInReference("@Qty", "Qty", "Units")).toBe("@Units");
    expect(renameColumnInReference("@[Qty]", "Qty", "Units")).toBe("@[Units]");
    expect(renameColumnInReference("[#This Row],[Qty]", "Qty", "A#B")).toBe(
      "[#This Row],[A'#B]"
    );
    expect(renameColumnInReference("[Qty]:[Price]", "Price", "P")).toBe(
      "[Qty]:[P]"
    );
    expect(renameColumnInReference("#All", "All", "X")).toBeNull();
    expect(renameColumnInReference("Price", "Qty", "X")).toBeNull();
  });
});
