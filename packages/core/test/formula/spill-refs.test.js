/**
 * Spill references (`A1#`) and spills past the sheet edge.
 *
 * Excel: "A1#" refers to the whole spill range of the dynamic-array formula
 * in A1 and follows it when it grows or shrinks; it is #REF! when A1 does not
 * hold a formula. TinySheet sheets are smaller than Excel's grid, so a spill
 * past the sheet edge grows the sheet (Excel's limits: 1,048,576 rows and
 * 16,384 columns) instead of showing #SPILL!.
 */
import { enablePatches, produceWithPatches, applyPatches } from "immer";
import { makeContext, input, value, values, cell, parseA1 } from "./helpers";
import { groupValuesRefresh, functionCopy } from "../../src/modules/formula";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { dropCellCache, updateDropCell } from "../../src/modules/dropCell";
import {
  getSpillRange,
  getSpilledCellFormula,
  getSpillObstructingCells,
} from "../../src/modules/spill";

enablePatches();

function seed(ctx) {
  input(ctx, "A1", "1");
  input(ctx, "A2", "2");
  input(ctx, "A3", "3");
  input(ctx, "B1", "10");
  input(ctx, "B2", "20");
  input(ctx, "B3", "30");
}

describe("spill references (A1#)", () => {
  test("A1# is the whole spill range", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    input(ctx, "G1", "=SUM(D1#)");
    input(ctx, "G2", "=ROWS(D1#)");
    input(ctx, "G3", "=COLUMNS(D1#)");
    expect(value(ctx, "G1")).toBe(66);
    expect(value(ctx, "G2")).toBe(3);
    expect(value(ctx, "G3")).toBe(2);
    // the stored formula keeps the spill reference
    expect(cell(ctx, "G1").f).toBe("=SUM(D1#)");
  });

  test("A1# follows the spill when it grows and shrinks", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "2");
    input(ctx, "D1", "=OFFSET(A1,0,0,C1,1)");
    input(ctx, "G1", "=SUM(D1#)");
    input(ctx, "G2", "=ROWS(D1#)");
    expect(value(ctx, "G1")).toBe(3);
    expect(value(ctx, "G2")).toBe(2);
    input(ctx, "C1", "3");
    expect(value(ctx, "G1")).toBe(6);
    expect(value(ctx, "G2")).toBe(3);
    input(ctx, "C1", "1");
    expect(value(ctx, "G1")).toBe(1);
    expect(value(ctx, "G2")).toBe(1);
  });

  test("a formula on A1# spills itself", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "F1", "=D1#*2");
    expect(values(ctx, "F1", "F3")).toEqual([[2], [4], [6]]);
    input(ctx, "A2", "5");
    expect(values(ctx, "F1", "F3")).toEqual([[2], [10], [6]]);
  });

  test("A1# on another sheet", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "A1", "=SUM(Sheet1!D1#)", "id_2");
    input(ctx, "B1", "=SUM(Sheet1!$D$1#)", "id_2");
    expect(value(ctx, "A1", "id_2")).toBe(6);
    expect(value(ctx, "B1", "id_2")).toBe(6);
    input(ctx, "A3", "30");
    expect(value(ctx, "A1", "id_2")).toBe(33);
  });

  test("#REF! when the cell holds no formula, #SPILL! while blocked", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "G1", "=SUM(A1#)");
    input(ctx, "G2", "=SUM(H9#)");
    expect(value(ctx, "G1")).toBe("#REF!");
    expect(value(ctx, "G2")).toBe("#REF!");
    input(ctx, "D1", "=A1:A3");
    input(ctx, "G3", "=SUM(D1#)");
    input(ctx, "D3", "x");
    expect(value(ctx, "D1")).toBe("#SPILL!");
    expect(value(ctx, "G3")).toBe("#SPILL!");
    input(ctx, "D3", "");
    expect(value(ctx, "G3")).toBe(6);
  });

  test("a single-value formula is a 1x1 spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1+1");
    input(ctx, "G1", "=SUM(D1#)*10");
    expect(value(ctx, "G1")).toBe(20);
  });

  test("copying and filling adjust A1# like any reference", () => {
    const ctx = makeContext();
    expect(functionCopy(ctx, "=SUM(D1#)", "right", 1)).toBe("SUM(E1#)");
    expect(functionCopy(ctx, "=SUM($D$1#)", "down", 2)).toBe("SUM($D$1#)");
    expect(functionCopy(ctx, "=D2#+Sheet1!D2#", "down", 1)).toBe(
      "D3#+Sheet1!D3#"
    );
  });

  test("inserting and deleting rows and columns move A1#", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C2", "=A1:A3");
    input(ctx, "E1", "=SUM(C2#)");
    const op = (type, index) => ({
      type,
      index,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    insertRowCol(ctx, op("row", 0));
    groupValuesRefresh(ctx);
    expect(cell(ctx, "E2").f).toBe("=SUM(C3#)");
    insertRowCol(ctx, op("column", 0));
    groupValuesRefresh(ctx);
    expect(cell(ctx, "F2").f).toBe("=SUM(D3#)");
    // the source grew by the inserted row: the spill and the sum follow
    expect(cell(ctx, "D3").f).toBe("=B2:B4");
    input(ctx, "B2", "4");
    expect(value(ctx, "F2")).toBe(9); // 4 + 2 + 3
    deleteRowCol(ctx, { type: "row", start: 0, end: 0, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "F1").f).toBe("=SUM(D2#)");
    // deleting the anchor makes the reference #REF!
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "F1").f).toBe("=SUM(#REF!)");
  });

  test("filling a formula with A1# re-targets the spill reference", () => {
    const ctx = makeContext();
    ctx.visibledatarow = Array.from({ length: 12 }, (_, i) => (i + 1) * 20);
    ctx.visibledatacolumn = Array.from({ length: 8 }, (_, i) => (i + 1) * 74);
    ctx.luckysheetCellUpdate = [];
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "E1", "=B1:B3");
    input(ctx, "D5", "=SUM(D1#)");
    dropCellCache.copyRange = { row: [4, 4], column: [3, 3] };
    dropCellCache.applyRange = { row: [4, 4], column: [4, 4] };
    dropCellCache.direction = "right";
    dropCellCache.applyType = "1";
    dropCellCache.ctrlKey = false;
    ctx.luckysheet_select_save = [{ row: [4, 4], column: [3, 4] }];
    updateDropCell(ctx);
    groupValuesRefresh(ctx);
    expect(cell(ctx, "E5").f).toBe("=SUM(E1#)");
    expect(value(ctx, "E5")).toBe(60);
  });
});

describe("spills past the sheet edge grow the sheet", () => {
  test("rows are added for a spill past the last row", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    input(ctx, "A3", "=ROW(A1:A3)");
    const { data } = ctx.luckysheetfile[0];
    expect(data.length).toBeGreaterThanOrEqual(5);
    // grown by a whole chunk, not a row at a time
    expect(data.length).toBe(104);
    expect(values(ctx, "A3", "A5")).toEqual([[1], [2], [3]]);
    expect(cell(ctx, "A3").spill).toEqual({ rs: 3, cs: 1 });
    expect(cell(ctx, "A5").spillFrom).toEqual({ dr: 2, dc: 0 });
  });

  test("columns are added for a spill past the last column", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    input(ctx, "C1", "=COLUMN(A1:E1)");
    const { data } = ctx.luckysheetfile[0];
    expect(data[0].length).toBe(14);
    expect(data.every((row) => row.length === 14)).toBe(true);
    const { r } = parseA1("C1");
    expect(data[r].slice(2, 7).map((x) => x?.v)).toEqual([1, 2, 3, 4, 5]);
  });

  test("dependents of the grown spill see its values", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    input(ctx, "B1", "=SUM(A1#)");
    input(ctx, "A1", "=ROW(A1:A6)");
    expect(values(ctx, "A1", "A6")).toEqual([[1], [2], [3], [4], [5], [6]]);
    expect(value(ctx, "B1")).toBe(21);
  });

  test("a spill larger than the sheet can grow stays #SPILL!", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    // 20,000 rows: more than insertRowCol allows a sheet to have
    input(ctx, "A1", "=ROW(A1:A20000)");
    expect(value(ctx, "A1")).toBe("#SPILL!");
    expect(ctx.luckysheetfile[0].data.length).toBe(4);
    // past Excel's grid: never grown
    input(ctx, "B1", "=ROW(A1:A1048576)");
    expect(value(ctx, "B1")).toBe("#SPILL!");
  });

  test("undo removes the rows added for a spill", () => {
    let ctx = makeContext({ rows: 4, cols: 4 });
    const [next, , inversePatches] = produceWithPatches(ctx, (d) => {
      input(d, "A3", "=ROW(A1:A3)");
    });
    expect(next.luckysheetfile[0].data.length).toBe(104);
    ctx = applyPatches(next, inversePatches);
    expect(ctx.luckysheetfile[0].data.length).toBe(4);
    expect(cell(ctx, "A3")).toBeNull();
  });
});

describe("spill queries for the UI", () => {
  test("getSpillRange finds the range from any of its cells", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    const range = { r: 0, c: 3, rs: 3, cs: 2, blocked: false };
    expect(getSpillRange(ctx, 0, 3)).toEqual(range);
    expect(getSpillRange(ctx, 2, 4)).toEqual(range);
    expect(getSpillRange(ctx, 3, 3)).toBeNull();
    expect(getSpillRange(ctx, 0, 0)).toBeNull();
  });

  test("the formula bar text of a spilled cell is the anchor's formula", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    expect(getSpilledCellFormula(ctx, 1, 4)).toBe("=A1:B3");
    expect(getSpilledCellFormula(ctx, 0, 3)).toBeNull();
    expect(getSpilledCellFormula(ctx, 0, 0)).toBeNull();
  });

  test("a blocked anchor reports its range and the obstructing cells", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "E2", "x");
    input(ctx, "D3", "=1");
    input(ctx, "D1", "=A1:B3");
    expect(getSpillRange(ctx, 0, 3)).toEqual({
      r: 0,
      c: 3,
      rs: 3,
      cs: 2,
      blocked: true,
    });
    // the obstructing cells are not part of a (blocked) spill range
    expect(getSpillRange(ctx, 1, 4)).toBeNull();
    expect(getSpillObstructingCells(ctx, 0, 3)).toEqual([
      { r: 1, c: 4 },
      { r: 2, c: 3 },
    ]);
    expect(getSpillObstructingCells(ctx, 1, 4)).toEqual([]);
  });
});
