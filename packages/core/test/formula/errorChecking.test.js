import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  val,
  cell,
} from "./recalc-helpers";
import {
  convertToNumber,
  copyFormulaFromSource,
  formulaR1C1,
  getCellError,
  groupValuesRefresh,
  ignoreCellError,
  resetIgnoredErrors,
  setErrorCheckingOptions,
  updateFormulaToIncludeCells,
} from "../../src";

/** Plain contexts are mutated in place: give the cache a new matrix. */
function touch(ctx) {
  ctx.luckysheetfile[0].data = [...ctx.luckysheetfile[0].data];
}

function rule(ctx, r, c) {
  return getCellError(ctx, r, c)?.rule ?? null;
}

describe("error checking rules", () => {
  test("R1C1 form ignores the position of relative references", () => {
    expect(formulaR1C1({ f: "=A1+$B$2" }, 1, 1)).toBe("=R[-1]C[-1]+R2C2");
    expect(formulaR1C1({ f: "=A2+$B$2" }, 2, 1)).toBe("=R[-1]C[-1]+R2C2");
    expect(formulaR1C1({ f: "=a3+$B$2" }, 2, 1)).toBe("=R[0]C[-1]+R2C2");
    expect(formulaR1C1({ v: 1 }, 0, 0)).toBeNull();
  });

  test("each rule, ignore and options", () => {
    const s = makeSheet("Sheet1", "s1", 12, 6);
    // number stored as text
    s.data[0][0] = { v: "42", m: "42", ct: { fa: "@", t: "s" } };
    // inconsistent formula: C2 differs from C1 and C3
    putValue(s, 0, 1, 1);
    putValue(s, 1, 1, 2);
    putValue(s, 2, 1, 3);
    putFormula(s, 0, 2, "=B1*2", 2);
    putFormula(s, 1, 2, "=B2*3", 6);
    putFormula(s, 2, 2, "=B3*2", 6);
    // formula omits adjacent cells: E4 = SUM(E1:E2), E3 is a number
    putValue(s, 0, 4, 1);
    putValue(s, 1, 4, 2);
    putValue(s, 2, 4, 3);
    putFormula(s, 3, 4, "=SUM(E1:E2)", 3);
    // unlocked formula
    putFormula(s, 6, 0, "=1+1", 2);
    s.data[6][0].lo = 0;
    // evaluation error
    putFormula(s, 7, 0, "=1/0", "#DIV/0!");
    // reference to an empty cell
    putFormula(s, 8, 0, "=F12+1", 1);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    expect(rule(ctx, 0, 0)).toBe("numberAsText");
    expect(rule(ctx, 1, 2)).toBe("inconsistentFormula");
    expect(getCellError(ctx, 1, 2).source).toEqual({
      r: 0,
      c: 2,
      direction: "above",
    });
    expect(rule(ctx, 0, 2)).toBeNull();
    expect(rule(ctx, 3, 4)).toBe("omitsCells");
    expect(getCellError(ctx, 3, 4).fixedFormula).toBe("=SUM(E1:E3)");
    expect(rule(ctx, 6, 0)).toBe("unlockedFormula");
    expect(rule(ctx, 7, 0)).toBe("evaluationError");
    // off by default
    expect(rule(ctx, 8, 0)).toBeNull();
    setErrorCheckingOptions(ctx, { rules: { emptyCellRef: true } });
    expect(rule(ctx, 8, 0)).toBe("emptyCellRef");
    setErrorCheckingOptions(ctx, { enabled: false });
    expect(rule(ctx, 0, 0)).toBeNull();
    setErrorCheckingOptions(ctx, { enabled: true });

    ignoreCellError(ctx, 0, 0, "numberAsText");
    touch(ctx);
    expect(rule(ctx, 0, 0)).toBeNull();
    resetIgnoredErrors(ctx);
    touch(ctx);
    expect(rule(ctx, 0, 0)).toBe("numberAsText");
  });

  test("smart tag fixes", () => {
    const s = makeSheet("Sheet1", "s1", 8, 6);
    s.data[0][0] = { v: "5", m: "5", ct: { fa: "@", t: "s" } };
    putFormula(s, 1, 0, "=A1*2", 10);
    putValue(s, 0, 1, 1);
    putValue(s, 1, 1, 2);
    putValue(s, 2, 1, 3);
    putFormula(s, 0, 2, "=B1*2", 2);
    putFormula(s, 1, 2, "=B2*3", 6);
    putFormula(s, 2, 2, "=B3*2", 6);
    putValue(s, 0, 4, 1);
    putValue(s, 1, 4, 2);
    putValue(s, 2, 4, 3);
    putFormula(s, 3, 4, "=SUM(E1:E2)", 3);
    const ctx = makeCtx([s]);
    loadWorkbook(ctx);

    expect(convertToNumber(ctx, 0, 0)).toBe(true);
    groupValuesRefresh(ctx);
    expect(val(ctx, 0, 0)).toBe(5);
    expect(cell(ctx, 0, 0).ct.t).toBe("n");

    expect(copyFormulaFromSource(ctx, 1, 2)).toBe(true);
    groupValuesRefresh(ctx);
    expect(cell(ctx, 1, 2).f).toBe("=B2*2");
    expect(val(ctx, 1, 2)).toBe(4);

    expect(updateFormulaToIncludeCells(ctx, 3, 4)).toBe(true);
    groupValuesRefresh(ctx);
    expect(cell(ctx, 3, 4).f).toBe("=SUM(E1:E3)");
    expect(val(ctx, 3, 4)).toBe(6);
    touch(ctx);
    expect(getCellError(ctx, 3, 4)).toBeNull();
  });
});
