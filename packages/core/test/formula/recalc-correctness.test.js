import { enablePatches, produceWithPatches, applyPatches } from "immer";
import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  edit,
  val,
} from "./recalc-helpers";
import {
  jfrefreshgrid,
  groupValuesRefresh,
  insertRowCol,
  deleteRowCol,
  getFlowdata,
} from "../../src";

enablePatches();

describe("recalculation correctness", () => {
  test("linear chain propagates through every link", () => {
    const s = makeSheet("Sheet1", "s1", 20, 3);
    putValue(s, 0, 0, 1);
    for (let r = 1; r < 10; r += 1) putFormula(s, r, 0, `=A${r}+1`, r + 1);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 0, 0, "5");
    for (let r = 0; r < 10; r += 1) expect(Number(val(ctx, r, 0))).toBe(5 + r);
  });

  test("chain declared in reverse order is evaluated topologically", () => {
    // A10 = 1, A9 = A10 + 1, ... A1 = A2 + 1 and calcChain lists A1 first
    const s = makeSheet("Sheet1", "s1", 12, 2);
    putValue(s, 9, 0, 1);
    for (let r = 0; r < 9; r += 1) putFormula(s, r, 0, `=A${r + 2}+1`, 10 - r);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 9, 0, "100");
    expect(val(ctx, 0, 0)).toBe(109);
    expect(val(ctx, 8, 0)).toBe(101);
  });

  test("diamond: sink is evaluated after both branches", () => {
    const s = makeSheet("Sheet1", "s1", 4, 5);
    putValue(s, 0, 0, 1);
    putFormula(s, 0, 3, "=B1+C1", 5); // D1 listed first on purpose
    putFormula(s, 0, 1, "=A1*2", 2);
    putFormula(s, 0, 2, "=A1*3", 3);
    putFormula(s, 0, 4, "=D1+B1", 7);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 0, 0, "2");
    expect(val(ctx, 0, 1)).toBe(4);
    expect(val(ctx, 0, 2)).toBe(6);
    expect(val(ctx, 0, 3)).toBe(10);
    expect(val(ctx, 0, 4)).toBe(14);
  });

  test("range dependencies (SUM, AVERAGE) and dependents of range formulas", () => {
    const s = makeSheet("Sheet1", "s1", 10, 4);
    for (let r = 0; r < 5; r += 1) putValue(s, r, 0, r + 1); // A1:A5 = 1..5
    putFormula(s, 0, 1, "=SUM(A1:A5)", 15);
    putFormula(s, 1, 1, "=AVERAGE(A2:A4)", 3);
    putFormula(s, 2, 1, "=B1*2", 30);
    putFormula(s, 3, 1, "=SUM(A6:A9)", 0);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 2, 0, "10"); // A3: 3 -> 10
    expect(val(ctx, 0, 1)).toBe(22);
    expect(val(ctx, 1, 1)).toBe(16 / 3);
    expect(val(ctx, 2, 1)).toBe(44);
    expect(val(ctx, 3, 1)).toBe(0);

    edit(ctx, 7, 0, "4"); // A8 is only inside SUM(A6:A9)
    expect(val(ctx, 3, 1)).toBe(4);
    expect(val(ctx, 0, 1)).toBe(22);
  });

  test("2D ranges", () => {
    const s = makeSheet("Sheet1", "s1", 6, 6);
    putFormula(s, 5, 5, "=SUM(B2:D4)", 0);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 2, 2, "7"); // C3 inside
    expect(val(ctx, 5, 5)).toBe(7);
    edit(ctx, 0, 0, "100"); // A1 outside
    expect(val(ctx, 5, 5)).toBe(7);
    edit(ctx, 3, 3, "1"); // D4 corner
    expect(val(ctx, 5, 5)).toBe(8);
  });

  test("cross-sheet references", () => {
    const s1 = makeSheet("Sheet1", "s1", 4, 4, 0);
    const s2 = makeSheet("Sheet2", "s2", 4, 4, 1);
    const s3 = makeSheet("Data_3", "s3", 4, 4, 2);
    putValue(s1, 0, 0, 1);
    putFormula(s2, 0, 0, "=Sheet1!A1*10", 10);
    putFormula(s2, 1, 0, "=SUM(Sheet1!A1:B2)", 1);
    putFormula(s3, 0, 0, "=Sheet2!A1+Sheet2!A2", 11);
    putFormula(s1, 3, 3, "=Data_3!A1+1", 12);
    const ctx = makeCtx([s1, s2, s3]);
    loadWorkbook(ctx);

    edit(ctx, 0, 0, "3", "s1");
    expect(val(ctx, 0, 0, "s2")).toBe(30);
    expect(val(ctx, 1, 0, "s2")).toBe(3);
    expect(val(ctx, 0, 0, "s3")).toBe(33);
    expect(val(ctx, 3, 3, "s1")).toBe(34);
  });

  test("entering a new formula registers its dependencies", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 0, 1, "=A1*5");
    expect(val(ctx, 0, 1)).toBe(5);
    edit(ctx, 0, 2, "=B1+1");
    expect(val(ctx, 0, 2)).toBe(6);
    edit(ctx, 0, 0, "2");
    expect(val(ctx, 0, 1)).toBe(10);
    expect(val(ctx, 0, 2)).toBe(11);
  });

  test("editing a formula replaces its old dependencies", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    putValue(s, 1, 0, 100);
    putFormula(s, 0, 1, "=A1+1", 2);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 0, 1, "=A2+1");
    expect(val(ctx, 0, 1)).toBe(101);
    edit(ctx, 0, 0, "50");
    expect(val(ctx, 0, 1)).toBe(101);
    edit(ctx, 1, 0, "7");
    expect(val(ctx, 0, 1)).toBe(8);
  });

  test("overwriting a formula with a value stops recalculation of that cell", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    putFormula(s, 0, 1, "=A1+1", 2);
    putFormula(s, 0, 2, "=B1*10", 20);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    edit(ctx, 0, 1, "7");
    expect(Number(val(ctx, 0, 1))).toBe(7);
    expect(val(ctx, 0, 2)).toBe(70);
    edit(ctx, 0, 0, "3");
    expect(Number(val(ctx, 0, 1))).toBe(7);
    expect(getFlowdata(ctx)[0][1].f).toBeUndefined();
    expect(val(ctx, 0, 2)).toBe(70);
  });

  test("bulk change via jfrefreshgrid (paste/delete path)", () => {
    const s = makeSheet("Sheet1", "s1", 10, 4);
    for (let r = 0; r < 5; r += 1) putValue(s, r, 0, 1);
    putFormula(s, 0, 1, "=SUM(A1:A5)", 5);
    putFormula(s, 1, 1, "=B1+A5", 6);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    // simulate a paste of a 5x1 block into A1:A5
    for (let r = 0; r < 5; r += 1) putValue(s, r, 0, 2);
    jfrefreshgrid(ctx, null, [{ row: [0, 4], column: [0, 0] }]);
    groupValuesRefresh(ctx);
    expect(val(ctx, 0, 1)).toBe(10);
    expect(val(ctx, 1, 1)).toBe(12);

    // simulate Delete on A1:A5
    for (let r = 0; r < 5; r += 1) s.data[r][0] = null;
    jfrefreshgrid(ctx, null, [{ row: [0, 4], column: [0, 0] }]);
    groupValuesRefresh(ctx);
    expect(val(ctx, 0, 1)).toBe(0);
    expect(val(ctx, 1, 1)).toBe(0);
  });

  test("row insert/delete invalidates and rebuilds the dependency graph", () => {
    const s = makeSheet("Sheet1", "s1", 10, 4);
    putValue(s, 0, 0, 1);
    putFormula(s, 2, 0, "=A1*2", 2);
    putFormula(s, 3, 0, "=A3+1", 3);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 0, 0, "2");
    expect(val(ctx, 3, 0)).toBe(5);

    insertRowCol(ctx, {
      type: "row",
      index: 1,
      count: 1,
      direction: "rightbottom",
      id: "s1",
    });
    // A1 stays; formulas shifted to A4 (=A1*2) and A5 (=A4+1)
    expect(getFlowdata(ctx)[3][0].f).toBe("=A1*2");
    expect(getFlowdata(ctx)[4][0].f).toBe("=A4+1");
    edit(ctx, 0, 0, "10");
    expect(val(ctx, 3, 0)).toBe(20);
    expect(val(ctx, 4, 0)).toBe(21);

    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "s1" });
    expect(getFlowdata(ctx)[2][0].f).toBe("=A1*2");
    edit(ctx, 0, 0, "4");
    expect(val(ctx, 2, 0)).toBe(8);
    expect(val(ctx, 3, 0)).toBe(9);
  });

  test("undo/redo keep the dependency graph in sync", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    putValue(s, 1, 0, 100);
    putFormula(s, 0, 1, "=A1+1", 2);
    let ctx = makeCtx([s]);
    loadWorkbook(ctx);

    // edit B1 to reference A2 through immer, like the Workbook component does
    const [next, patches, inversePatches] = produceWithPatches(ctx, (d) => {
      d.currentSheetId = "s1";
      edit(d, 0, 1, "=A2+1");
    });
    ctx = next;
    ctx.formulaCache.updateFormulaCache(
      ctx,
      { patches, inversePatches },
      "redo"
    );
    expect(val(ctx, 0, 1)).toBe(101);

    // undo: B1 is =A1+1 again, so it must follow A1 and not A2
    ctx = applyPatches(ctx, inversePatches);
    ctx.formulaCache.updateFormulaCache(
      ctx,
      { patches, inversePatches },
      "undo"
    );
    expect(getFlowdata(ctx)[0][1].f).toBe("=A1+1");
    [ctx] = produceWithPatches(ctx, (d) => {
      edit(d, 0, 0, "5");
    });
    expect(val(ctx, 0, 1)).toBe(6);
    [ctx] = produceWithPatches(ctx, (d) => {
      edit(d, 1, 0, "7");
    });
    expect(val(ctx, 0, 1)).toBe(6);
  });

  test("circular references do not hang", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    putFormula(s, 0, 1, "=A1+C1", 1);
    putFormula(s, 0, 2, "=B1+1", 2);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 0, 0, "2");
    // B1 and C1 form a cycle; we only require termination and a finite value
    expect(val(ctx, 0, 1)).not.toBeUndefined();
    expect(val(ctx, 0, 2)).not.toBeUndefined();
  });
});
