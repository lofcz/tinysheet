import {
  makeContext,
  input,
  pressDelete,
  value,
  values,
  cell,
  parseA1,
} from "./helpers";
import { execfunction, groupValuesRefresh } from "../../src/modules/formula";
import { getcellFormula } from "../../src/modules/cell";
import { clearCell, setCellValue } from "../../src/api/cell";
import { getSpillAnchor } from "../../src/modules/formulaFunctions";

function seed(ctx) {
  input(ctx, "A1", "1");
  input(ctx, "A2", "2");
  input(ctx, "A3", "3");
  input(ctx, "B1", "10");
  input(ctx, "B2", "20");
  input(ctx, "B3", "30");
}

describe("dynamic-array spill", () => {
  test("a matrix result spills into the neighbouring cells", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    expect(values(ctx, "D1", "E3")).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
    // the formula lives only in the anchor
    expect(cell(ctx, "D1").f).toBe("=A1:B3");
    expect(cell(ctx, "D1").spill).toEqual({ rs: 3, cs: 2 });
    expect(cell(ctx, "E2").f).toBeUndefined();
    expect(cell(ctx, "E2").spillFrom).toEqual({ dr: 1, dc: 1 });
    expect(cell(ctx, "E2").m).toBe("20");
    const { r, c } = parseA1("E2");
    expect(getcellFormula(ctx, r, c, "id_1")).toBeUndefined();
    expect(getSpillAnchor(ctx, r, c)).toEqual({ r: 0, c: 3 });
    expect(getSpillAnchor(ctx, 0, 3)).toBeNull();
  });

  test("a 1x1 matrix does not spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A2:A2");
    expect(value(ctx, "D1")).toBe(2);
    expect(cell(ctx, "D1").spill).toBeUndefined();
    expect(cell(ctx, "D2")).toBeNull();
  });

  test("spilled values follow their sources", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "A3", "300");
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [300]]);
  });

  test("formulas reading spilled cells recalculate", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "F1", "=SUM(D1:D3)");
    input(ctx, "F2", "=D3*2");
    expect(value(ctx, "F1")).toBe(6);
    expect(value(ctx, "F2")).toBe(6);
    input(ctx, "A3", "5");
    expect(value(ctx, "F1")).toBe(8);
    expect(value(ctx, "F2")).toBe(10);
    // and a chain behind them
    input(ctx, "G1", "=F2+1");
    input(ctx, "A3", "7");
    expect(value(ctx, "G1")).toBe(15);
  });

  test("a formula entered after the spill reads the spilled values", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=ROW(A1:A4)");
    input(ctx, "E1", "=D4*100");
    expect(value(ctx, "E1")).toBe(400);
  });

  test("the spill area shrinks and grows with the result", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "3");
    input(ctx, "D1", "=OFFSET(A1,0,0,C1,2)");
    expect(values(ctx, "D1", "E3")).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
    input(ctx, "C1", "1");
    expect(values(ctx, "D1", "E3")).toEqual([
      [1, 10],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(cell(ctx, "D2")).toBeNull();
    expect(cell(ctx, "D1").spill).toEqual({ rs: 1, cs: 2 });
    input(ctx, "C1", "2");
    expect(values(ctx, "D1", "E3")).toEqual([
      [1, 10],
      [2, 20],
      [undefined, undefined],
    ]);
  });

  test("replacing the formula with a scalar formula clears the spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "D1", "=A1+1");
    expect(values(ctx, "D1", "D3")).toEqual([[2], [undefined], [undefined]]);
    expect(cell(ctx, "D1").spill).toBeUndefined();
  });

  test("a non-empty cell in the way gives #SPILL!", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D3", "x");
    input(ctx, "D1", "=A1:A3");
    expect(values(ctx, "D1", "D3")).toEqual([["#SPILL!"], [undefined], ["x"]]);
    expect(cell(ctx, "D1").ct.t).toBe("e");
    expect(cell(ctx, "D1").spill).toEqual({ rs: 3, cs: 1, blocked: true });
  });

  test("merged cells and formulas also block", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "E2", "=1");
    input(ctx, "D1", "=A1:B3");
    expect(value(ctx, "D1")).toBe("#SPILL!");
    const ctx2 = makeContext();
    seed(ctx2);
    ctx2.luckysheetfile[0].data[2][4] = { mc: { r: 2, c: 4, rs: 1, cs: 1 } };
    input(ctx2, "D1", "=A1:B3");
    expect(value(ctx2, "D1")).toBe("#SPILL!");
  });

  test("a spill beyond the sheet edge gives #SPILL!", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    input(ctx, "A3", "=ROW(A1:A3)");
    expect(value(ctx, "A3")).toBe("#SPILL!");
    expect(cell(ctx, "A4")).toBeNull();
  });

  test("typing into a spilled cell blocks the spill; clearing it re-spills", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "F1", "=SUM(D1:D3)");
    input(ctx, "D2", "hello");
    expect(values(ctx, "D1", "D3")).toEqual([
      ["#SPILL!"],
      ["hello"],
      [undefined],
    ]);
    expect(cell(ctx, "D2").spillFrom).toBeUndefined();
    // Like Excel, SUM propagates the #SPILL! error from the blocked anchor.
    expect(value(ctx, "F1")).toBe("#SPILL!");
    // clear it again in the editor
    input(ctx, "D2", "");
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [3]]);
    expect(value(ctx, "F1")).toBe(6);
    // block with a formula, unblock with the Delete key
    input(ctx, "D3", "=1+1");
    expect(value(ctx, "D1")).toBe("#SPILL!");
    expect(value(ctx, "D2")).toBeUndefined();
    pressDelete(ctx, "D3");
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [3]]);
  });

  test("deleting blocked cells from another spill unblocks", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "3");
    input(ctx, "D1", "=OFFSET(A1,0,0,C1,1)");
    // wants D2:F2, D2 is occupied by D1's spill
    input(ctx, "D2", "=COLUMN(A1:C1)");
    expect(value(ctx, "D1")).toBe("#SPILL!");
    expect(values(ctx, "D2", "F2")).toEqual([[1, 2, 3]]);
    input(ctx, "D2", "");
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [3]]);
    // now an anchor elsewhere is blocked by D1's spill until it shrinks
    input(ctx, "C3", "=COLUMN(A1:C1)");
    expect(value(ctx, "C3")).toBe("#SPILL!");
    input(ctx, "C1", "2");
    expect(values(ctx, "C3", "E3")).toEqual([[1, 2, 3]]);
    expect(values(ctx, "D1", "D2")).toEqual([[1], [2]]);
  });

  test("replacing the anchor with a value clears the spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    input(ctx, "F1", "=SUM(D1:E3)");
    expect(value(ctx, "F1")).toBe(66);
    input(ctx, "D1", "5");
    expect(values(ctx, "D1", "E3")).toEqual([
      [5, undefined],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(value(ctx, "F1")).toBe(5);
    expect(cell(ctx, "D1").spill).toBeUndefined();
  });

  test("deleting the anchor with the Delete key clears the spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    input(ctx, "G1", "=SUM(E1:E3)");
    pressDelete(ctx, "D1");
    expect(values(ctx, "D1", "E3")).toEqual([
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(value(ctx, "G1")).toBe(0);
  });

  test("clearing the anchor through the API clears the spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    clearCell(ctx, 0, 3);
    groupValuesRefresh(ctx);
    expect(values(ctx, "D1", "D3")).toEqual([
      [undefined],
      [undefined],
      [undefined],
    ]);
    input(ctx, "D1", "=A1:A3");
    setCellValue(ctx, 0, 3, 7, null);
    groupValuesRefresh(ctx);
    expect(values(ctx, "D1", "D3")).toEqual([[7], [undefined], [undefined]]);
  });

  test("pressing Delete on spilled cells only re-spills them", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    pressDelete(ctx, "D2", "D3");
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [3]]);
  });

  test("spilled cells keep their own formatting", () => {
    const ctx = makeContext();
    seed(ctx);
    ctx.luckysheetfile[0].data[1][3] = { bg: "#ff0000" };
    input(ctx, "D1", "=A1:A3");
    expect(cell(ctx, "D2")).toMatchObject({ bg: "#ff0000", v: 2 });
    input(ctx, "D1", "=A1");
    expect(cell(ctx, "D2")).toEqual({ bg: "#ff0000" });
  });

  test("error values inside the result are written as errors", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "A2", "=1/0");
    input(ctx, "D1", "=A1:A3");
    expect(values(ctx, "D1", "D3")).toEqual([[1], ["#DIV/0!"], [3]]);
    expect(cell(ctx, "D2").ct.t).toBe("e");
  });

  test("empty source cells spill as 0", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A4");
    expect(values(ctx, "D1", "D4")).toEqual([[1], [2], [3], [0]]);
  });

  test("spill works on other sheets and with sheet references", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "B2", "=Sheet1!A1:A3", "id_2");
    expect(values(ctx, "B2", "B4", "id_2")).toEqual([[1], [2], [3]]);
    input(ctx, "A2", "22");
    expect(value(ctx, "B3", "id_2")).toBe(22);
    // nothing spilled on Sheet1
    expect(cell(ctx, "B4")).toBeNull();
  });

  test("evaluating a formula for another purpose does not spill", () => {
    const ctx = makeContext();
    seed(ctx);
    // e.g. conditional formatting evaluates formulas against a cell
    const res = execfunction(ctx, "=A1:A3", 0, 3);
    expect(res[1]).toEqual([[1], [2], [3]]);
    groupValuesRefresh(ctx);
    expect(cell(ctx, "D2")).toBeNull();
  });

  test("sheets carrying the legacy dynamicArray field still work", () => {
    const ctx = makeContext();
    ctx.luckysheetfile[0].dynamicArray = [{ r: 0, c: 3, f: "=A1:A3" }];
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "D1", "9");
    expect(ctx.luckysheetfile[0].dynamicArray).toEqual([]);
    expect(values(ctx, "D1", "D3")).toEqual([[9], [undefined], [undefined]]);
  });
});
