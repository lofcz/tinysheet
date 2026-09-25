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
  calculateFull,
  calculateNow,
  calculateSheet,
  getCalcSettings,
  getCircularReferences,
  isCalculationPending,
  isDataTableRecalcDeferred,
  normalizeCalcSettings,
  setCalcSettings,
} from "../../src";

function chainWorkbook() {
  const s = makeSheet("Sheet1", "s1", 6, 4);
  putValue(s, 0, 0, 1);
  putFormula(s, 0, 1, "=A1*2", 2);
  putFormula(s, 0, 2, "=B1+1", 3);
  const ctx = makeCtx([s]);
  loadWorkbook(ctx);
  return ctx;
}

describe("calculation options", () => {
  test("defaults, normalisation and storage on every sheet", () => {
    const s1 = makeSheet("Sheet1", "s1", 2, 2);
    const s2 = makeSheet("Sheet2", "s2", 2, 2, 1);
    const ctx = makeCtx([s1, s2]);
    expect(getCalcSettings(ctx)).toEqual({
      mode: "auto",
      iterate: false,
      maxIterations: 100,
      maxChange: 0.001,
      fullCalcOnLoad: false,
    });
    ctx.calcDefaults = { mode: "manual" };
    expect(getCalcSettings(ctx).mode).toBe("manual");
    setCalcSettings(ctx, { mode: "autoNoTable", maxIterations: 7.4 });
    expect(s1.calcSettings.mode).toBe("autoNoTable");
    expect(s2.calcSettings.maxIterations).toBe(7);
    expect(isDataTableRecalcDeferred(ctx)).toBe(true);
    expect(normalizeCalcSettings({ mode: "bogus", maxChange: -1 })).toEqual(
      normalizeCalcSettings({})
    );
    // the first sheet carrying options wins, even after deleting others
    ctx.luckysheetfile.shift();
    expect(getCalcSettings(ctx).mode).toBe("autoNoTable");
  });

  test("manual mode defers dependents until F9", () => {
    const ctx = chainWorkbook();
    setCalcSettings(ctx, { mode: "manual" });
    edit(ctx, 0, 0, "5");
    expect(val(ctx, 0, 0)).toBe(5);
    expect(val(ctx, 0, 1)).toBe(2);
    expect(val(ctx, 0, 2)).toBe(3);
    expect(isCalculationPending(ctx)).toBe(true);

    // an entered formula is calculated itself, its dependents wait
    edit(ctx, 1, 0, "=A1+100");
    expect(val(ctx, 1, 0)).toBe(105);

    calculateNow(ctx);
    expect(val(ctx, 0, 1)).toBe(10);
    expect(val(ctx, 0, 2)).toBe(11);
    expect(isCalculationPending(ctx)).toBe(false);
  });

  test("switching back to automatic recalculates what changed", () => {
    const ctx = chainWorkbook();
    setCalcSettings(ctx, { mode: "manual" });
    edit(ctx, 0, 0, "4");
    expect(val(ctx, 0, 2)).toBe(3);
    setCalcSettings(ctx, { mode: "auto" });
    expect(val(ctx, 0, 1)).toBe(8);
    expect(val(ctx, 0, 2)).toBe(9);
    expect(isCalculationPending(ctx)).toBe(false);
    edit(ctx, 0, 0, "1");
    expect(val(ctx, 0, 2)).toBe(3);
  });

  test("Shift+F9 calculates the active sheet, Ctrl+Alt+F9 everything", () => {
    const s1 = makeSheet("Sheet1", "s1", 4, 4);
    const s2 = makeSheet("Sheet2", "s2", 4, 4, 1);
    putValue(s1, 0, 0, 1);
    putFormula(s1, 0, 1, "=A1*10", 10);
    putValue(s2, 0, 0, 2);
    putFormula(s2, 0, 1, "=A1*10", 20);
    const ctx = makeCtx([s1, s2]);
    loadWorkbook(ctx);
    setCalcSettings(ctx, { mode: "manual" });
    edit(ctx, 0, 0, "3", "s2");
    edit(ctx, 0, 0, "7", "s1");
    calculateSheet(ctx, "s1");
    expect(val(ctx, 0, 1, "s1")).toBe(70);
    expect(val(ctx, 0, 1, "s2")).toBe(20);
    expect(isCalculationPending(ctx)).toBe(true);

    // stale values straight in the data: only a full rebuild fixes them
    s1.data[0][1].v = 1;
    calculateFull(ctx);
    expect(val(ctx, 0, 1, "s1")).toBe(70);
    expect(val(ctx, 0, 1, "s2")).toBe(30);
    expect(isCalculationPending(ctx)).toBe(false);
  });

  test("iterative calculation converges a circular reference", () => {
    // B1 = A1 + C1/2, C1 = B1/2  =>  B1 = A1 * 4/3
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 10);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    setCalcSettings(ctx, {
      iterate: true,
      maxIterations: 100,
      maxChange: 1e-6,
    });
    edit(ctx, 0, 1, "=A1+C1/2");
    edit(ctx, 0, 2, "=B1/2");
    expect(Number(val(ctx, 0, 1))).toBeCloseTo(40 / 3, 4);
    expect(Number(val(ctx, 0, 2))).toBeCloseTo(20 / 3, 4);
    expect(getCircularReferences(ctx)).toHaveLength(2);

    edit(ctx, 0, 0, "30");
    expect(Number(val(ctx, 0, 1))).toBeCloseTo(40, 4);
    expect(Number(val(ctx, 0, 2))).toBeCloseTo(20, 4);
  });

  test("iteration stops after Maximum Iterations", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    setCalcSettings(ctx, { iterate: true, maxIterations: 100 });
    // Excel: =A1+1 typed into A1 gives 100 with 100 iterations
    edit(ctx, 0, 0, "=A1+1");
    expect(val(ctx, 0, 0)).toBe(100);
    setCalcSettings(ctx, { maxIterations: 5 });
    edit(ctx, 1, 0, "=A2+1");
    expect(val(ctx, 1, 0)).toBe(5);
  });

  test("without iteration a cycle is evaluated once and reported", () => {
    const s = makeSheet("Sheet1", "s1", 4, 4);
    putValue(s, 0, 0, 1);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);
    edit(ctx, 0, 1, "=A1+C1");
    edit(ctx, 0, 2, "=B1+1");
    expect(Number.isFinite(Number(val(ctx, 0, 1)))).toBe(true);
    expect(getCircularReferences(ctx)).toHaveLength(2);
  });
});
