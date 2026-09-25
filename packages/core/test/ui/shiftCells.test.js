import {
  insertCells,
  deleteCells,
  shiftFormulaReferences,
  groupValuesRefresh,
} from "../../src";
import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  val,
  cell,
} from "../formula/recalc-helpers";

function setup() {
  const s1 = makeSheet("Sheet1", "s1", 6, 6, 0);
  const s2 = makeSheet("Sheet2", "s2", 3, 3, 1);
  const ctx = makeCtx([s1, s2]);
  return { ctx, s1, s2 };
}

describe("insert / delete cells with a shift direction", () => {
  it("shift right moves the band only and grows the sheet when needed", () => {
    const { ctx, s1 } = setup();
    putValue(s1, 0, 0, 1);
    putValue(s1, 0, 5, 6);
    putValue(s1, 1, 0, 2);
    insertCells(ctx, { row: [0, 0], column: [0, 1] }, "right");
    expect(val(ctx, 0, 0)).toBeUndefined();
    expect(val(ctx, 0, 2)).toBe(1);
    expect(val(ctx, 0, 7)).toBe(6);
    expect(val(ctx, 1, 0)).toBe(2); // outside the band
    expect(s1.data[0].length).toBe(8);
    expect(s1.data[5].length).toBe(8); // the matrix stays rectangular
  });

  it("shift down / up moves only the selected columns", () => {
    const { ctx, s1 } = setup();
    putValue(s1, 0, 1, 10);
    putValue(s1, 1, 1, 11);
    putValue(s1, 0, 2, 20);
    insertCells(ctx, { row: [0, 0], column: [1, 1] }, "down");
    expect(s1.data[0][1]).toBeNull();
    expect(val(ctx, 1, 1)).toBe(10);
    expect(val(ctx, 2, 1)).toBe(11);
    expect(val(ctx, 0, 2)).toBe(20);
    deleteCells(ctx, { row: [0, 1], column: [1, 1] }, "up");
    expect(val(ctx, 0, 1)).toBe(11);
    expect(val(ctx, 1, 1)).toBeUndefined();
  });

  it("delete shift left removes the cells and pulls the rest", () => {
    const { ctx, s1 } = setup();
    [1, 2, 3, 4].forEach((v, i) => putValue(s1, 0, i, v));
    deleteCells(ctx, { row: [0, 0], column: [1, 2] }, "left");
    expect(s1.data[0].map((c) => c?.v ?? null)).toEqual([
      1,
      4,
      null,
      null,
      null,
      null,
    ]);
  });

  it("formulas follow moved cells and deleted references become #REF!", () => {
    const { ctx, s1, s2 } = setup();
    putValue(s1, 0, 0, 5);
    putValue(s1, 0, 1, 7);
    putFormula(s1, 3, 0, "=A1*2", 10);
    putFormula(s1, 3, 1, "=SUM(A1:C1)", 12);
    putFormula(s2, 0, 0, "=Sheet1!B1+1", 8);
    loadWorkbook(ctx);

    insertCells(ctx, { row: [0, 0], column: [0, 0] }, "right");
    expect(cell(ctx, 3, 0).f).toBe("=B1*2");
    expect(cell(ctx, 3, 1).f).toBe("=SUM(B1:D1)");
    expect(cell(ctx, 0, 0, "s2").f).toBe("=Sheet1!C1+1");
    expect(val(ctx, 3, 0)).toBe(10);
    expect(val(ctx, 0, 0, "s2")).toBe(8);

    deleteCells(ctx, { row: [0, 0], column: [1, 1] }, "left");
    groupValuesRefresh(ctx);
    expect(cell(ctx, 3, 0).f).toBe("=#REF!*2");
    expect(cell(ctx, 3, 1).f).toBe("=SUM(B1:C1)");
    expect(val(ctx, 3, 1)).toBe(7);
  });

  it("rewrites references but not strings, functions or other sheets", () => {
    const shift = {
      kind: "insert",
      axis: "col",
      r1: 0,
      r2: 9,
      c1: 1,
      c2: 1,
      n: 1,
    };
    expect(
      shiftFormulaReferences(
        '=CONCAT("B1",B1,LOG10(B2),Other!B1)',
        shift,
        "S",
        true
      )
    ).toBe('=CONCAT("B1",C1,LOG10(C2),Other!B1)');
    expect(shiftFormulaReferences("='S'!$B$1+S!A1", shift, "S", false)).toBe(
      "='S'!$C$1+S!A1"
    );
    // a range that leaves the band is not adjusted (Excel)
    expect(shiftFormulaReferences("=SUM(B1:B20)", shift, "S", true)).toBe(
      "=SUM(B1:B20)"
    );
  });

  it("moves hyperlinks, validation and notes, and refuses to split merges", () => {
    const { ctx, s1 } = setup();
    s1.data[0][1] = { v: "x", ps: { value: "note", isShow: false } };
    s1.hyperlink = { "0_1": { linkType: "webpage", linkAddress: "a" } };
    s1.dataVerification = { "0_2": { type: "number" } };
    insertCells(ctx, { row: [0, 0], column: [0, 0] }, "right");
    expect(s1.data[0][2].ps.value).toBe("note");
    expect(Object.keys(s1.hyperlink)).toEqual(["0_2"]);
    expect(Object.keys(s1.dataVerification)).toEqual(["0_3"]);

    s1.config = { merge: { "2_2": { r: 2, c: 2, rs: 2, cs: 2 } } };
    expect(() =>
      insertCells(ctx, { row: [2, 2], column: [0, 0] }, "right")
    ).toThrow("partMC");
    insertCells(ctx, { row: [2, 3], column: [0, 0] }, "right");
    expect(s1.config.merge).toEqual({ "2_3": { r: 2, c: 3, rs: 2, cs: 2 } });
  });
});
