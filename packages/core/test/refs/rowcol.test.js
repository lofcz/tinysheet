import { makeContext, input, cell, value } from "../formula/helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { groupValuesRefresh } from "../../src/modules/formula";

// Inserting or deleting rows/columns rewrites every formula in the workbook
// (Excel: "Insert or delete rows and columns" - references adjust, and a
// reference to a deleted cell shows #REF!).

function setup() {
  const ctx = makeContext({ rows: 12, cols: 8 });
  input(ctx, "A1", "1");
  input(ctx, "A2", "2");
  input(ctx, "A3", "3");
  input(ctx, "A4", "4");
  input(ctx, "B1", "=SUM(A1:A4)");
  input(ctx, "B2", "=A3*10");
  input(ctx, "B3", "=$A$4");
  input(ctx, "C1", "=Sheet1!A4+1", "id_2");
  input(ctx, "C2", "=SUM(A:A)");
  return ctx;
}

describe("insert rows", () => {
  test("formulas on every sheet follow the inserted rows", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 1,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B1").f).toBe("=SUM(A1:A6)");
    expect(cell(ctx, "B4").f).toBe("=A5*10");
    expect(cell(ctx, "B5").f).toBe("=$A$6");
    expect(cell(ctx, "C1", "id_2").f).toBe("=Sheet1!A6+1");
    expect(cell(ctx, "C4").f).toBe("=SUM(A:A)");
    expect(value(ctx, "B1")).toBe(10);
    expect(value(ctx, "B4")).toBe(30);
    expect(value(ctx, "C1", "id_2")).toBe(5);
  });

  test("rightbottom inserts after the index row", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 3,
      count: 1,
      direction: "rightbottom",
      id: "id_1",
    });
    // A4 stays, A1:A4 does not grow (insertion below the range)
    expect(cell(ctx, "B1").f).toBe("=SUM(A1:A4)");
    expect(cell(ctx, "B3").f).toBe("=$A$4");
  });

  test("formulas not in the calc chain are rewritten too", () => {
    const ctx = setup();
    ctx.luckysheetfile[0].calcChain = [];
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cell(ctx, "B2").f).toBe("=SUM(A2:A5)");
  });

  test("ROW() is recalculated after the insert", () => {
    const ctx = setup();
    input(ctx, "D5", "=ROW()");
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    groupValuesRefresh(ctx);
    expect(value(ctx, "D6")).toBe(6);
  });
});

describe("insert columns", () => {
  test("column references shift, whole-row references do not", () => {
    const ctx = setup();
    input(ctx, "D1", "=SUM(1:1)");
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cell(ctx, "C1").f).toBe("=SUM(B1:B4)");
    expect(cell(ctx, "E1").f).toBe("=SUM(1:1)");
    expect(cell(ctx, "C1", "id_2").f).toBe("=Sheet1!B4+1");
  });
});

describe("delete rows", () => {
  test("ranges shrink and deleted references become #REF!", () => {
    const ctx = setup();
    deleteRowCol(ctx, { type: "row", start: 2, end: 2, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B1").f).toBe("=SUM(A1:A3)");
    expect(cell(ctx, "B2").f).toBe("=#REF!*10");
    expect(cell(ctx, "C1", "id_2").f).toBe("=Sheet1!A3+1");
    expect(value(ctx, "B1")).toBe(7);
    expect(value(ctx, "B2")).toBe("#REF!");
    expect(value(ctx, "C1", "id_2")).toBe(5);
  });

  test("deleting the referenced row of an absolute reference", () => {
    const ctx = setup();
    deleteRowCol(ctx, { type: "row", start: 3, end: 3, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B3").f).toBe("=#REF!");
    expect(value(ctx, "B3")).toBe("#REF!");
    expect(cell(ctx, "C1", "id_2").f).toBe("=#REF!+1");
  });
});

describe("delete columns", () => {
  test("formulas to the right move left, references follow", () => {
    const ctx = setup();
    input(ctx, "E1", "=B1+C2");
    deleteRowCol(ctx, { type: "column", start: 2, end: 2, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "D1").f).toBe("=B1+#REF!");
    expect(cell(ctx, "B1").f).toBe("=SUM(A1:A4)");
  });
});

describe("data validation, hyperlinks and conditional formats", () => {
  test("list sources and internal hyperlinks follow inserted rows", () => {
    const ctx = setup();
    const sheet2 = ctx.luckysheetfile[1];
    sheet2.dataVerification = {
      "0_0": { type: "dropdown", value1: "Sheet1!$A$2:$A$4", value2: "" },
    };
    sheet2.hyperlink = {
      "1_1": { linkType: "cellrange", linkAddress: "Sheet1!A3" },
    };
    ctx.luckysheetfile[0].luckysheet_conditionformat_save = [
      {
        type: "default",
        cellrange: [{ row: [0, 3], column: [0, 0] }],
        conditionName: "formula",
        conditionValue: ["=A1>B2"],
      },
    ];
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(sheet2.dataVerification["0_0"].value1).toBe("Sheet1!$A$3:$A$5");
    expect(sheet2.hyperlink["1_1"].linkAddress).toBe("Sheet1!A4");
    const cf = ctx.luckysheetfile[0].luckysheet_conditionformat_save[0];
    expect(cf.cellrange).toEqual([{ row: [1, 4], column: [0, 0] }]);
    expect(cf.conditionValue).toEqual(["=A2>B3"]);
  });
});
