import { makeContext, input, cell, value } from "../formula/helpers";
import {
  clampFormulaBarHeight,
  FORMULA_BAR_DEFAULT_HEIGHT,
  FORMULA_BAR_MIN_HEIGHT,
  lineIndentAt,
  setFormulaBarHeight,
  toggleFormulaBar,
} from "../../src/modules/formulaEditor";

describe("formula bar size", () => {
  test("Ctrl+Shift+U toggles an expanded bar of the default height", () => {
    const ctx = makeContext();
    toggleFormulaBar(ctx);
    expect(ctx.formulaBarExpanded).toBe(true);
    expect(ctx.formulaBarHeight).toBe(FORMULA_BAR_DEFAULT_HEIGHT);
    toggleFormulaBar(ctx);
    expect(ctx.formulaBarExpanded).toBe(false);
    // the height is kept for the next expand
    ctx.formulaBarHeight = 150;
    toggleFormulaBar(ctx);
    expect(ctx.formulaBarHeight).toBe(150);
  });

  test("dragging sets the height; dragging it small collapses", () => {
    const ctx = makeContext();
    setFormulaBarHeight(ctx, 130.4, 400);
    expect(ctx).toMatchObject({
      formulaBarExpanded: true,
      formulaBarHeight: 130,
    });
    setFormulaBarHeight(ctx, 900, 400);
    expect(ctx.formulaBarHeight).toBe(400);
    setFormulaBarHeight(ctx, 50, 400);
    expect(ctx.formulaBarHeight).toBe(FORMULA_BAR_MIN_HEIGHT);
    setFormulaBarHeight(ctx, 30, 400);
    expect(ctx.formulaBarExpanded).toBe(false);
    expect(clampFormulaBarHeight(NaN)).toBe(FORMULA_BAR_DEFAULT_HEIGHT);
  });
});

describe("formulas on several lines", () => {
  test("Alt+Enter keeps the current line's indentation", () => {
    expect(lineIndentAt("=IF(A1,", 7)).toBe("");
    expect(lineIndentAt('=IF(A1,\n  "a",', 13)).toBe("  ");
    expect(lineIndentAt("=LET(x,1,\n\tx", 11)).toBe("\t");
    // only the whitespace before the caret counts
    expect(lineIndentAt("=A1+\n    B1", 7)).toBe("  ");
  });

  test("a formula with line breaks and indentation is kept and computed", () => {
    const ctx = makeContext();
    input(ctx, "A1", '=IF(1>0,\n  "yes",\n  "no")');
    expect(cell(ctx, "A1").f).toBe('=IF(1>0,\n  "yes",\n  "no")');
    expect(value(ctx, "A1")).toBe("yes");
    expect(cell(ctx, "A1").ct?.t).not.toBe("inlineStr");
  });
});
