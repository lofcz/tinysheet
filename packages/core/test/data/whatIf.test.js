import {
  makeContext,
  input,
  value,
  values,
  cell,
  pressDelete,
} from "../formula/helpers";
import {
  goalSeek,
  restoreGoalSeek,
  setGoalSeekValue,
  createDataTable,
  recalcDataTables,
  dataTableAt,
  dataTableFormula,
  validateDataTable,
} from "../../src/modules/whatIf";
import { groupValuesRefresh } from "../../src/modules/formula";
import { checkEditGuards } from "../../src/modules/extensions";
import { updateCell } from "../../src/modules/cell";

const at = (a1) => {
  const m = /^([A-Z])(\d+)$/.exec(a1);
  return { r: Number(m[2]) - 1, c: m[1].charCodeAt(0) - 65 };
};

describe("Goal Seek", () => {
  // Excel's documented example: the interest rate for a $100,000 loan over
  // 180 months paid $900 a month (=PMT(B3/12,B2,B1) → about 7.02%).
  test("finds the loan rate for a target payment", () => {
    const ctx = makeContext();
    input(ctx, "B1", "100000");
    input(ctx, "B2", "180");
    input(ctx, "B4", "=PMT(B3/12,B2,B1)");
    const res = goalSeek(ctx, {
      setCell: at("B4"),
      toValue: -900,
      changingCell: at("B3"),
    });
    expect(res.found).toBe(true);
    expect(res.value).toBeCloseTo(0.0702, 3);
    expect(Math.abs(res.result + 900)).toBeLessThan(0.001);
    // the solution is left in the changing cell, the formula follows
    expect(value(ctx, "B3")).toBeCloseTo(0.0702, 3);
    expect(value(ctx, "B4")).toBeCloseTo(-900, 2);
  });

  test("non-linear formula with a starting value", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "B1", "=A1^3-2*A1-5");
    const res = goalSeek(ctx, {
      setCell: at("B1"),
      toValue: 0,
      changingCell: at("A1"),
    });
    expect(res.found).toBe(true);
    expect(res.value).toBeCloseTo(2.0946, 3);
  });

  test("an unreachable target reports no solution with the closest value", () => {
    const ctx = makeContext();
    input(ctx, "A1", "3");
    input(ctx, "B1", "=A1^2+1");
    const res = goalSeek(ctx, {
      setCell: at("B1"),
      toValue: -5,
      changingCell: at("A1"),
    });
    expect(res.found).toBe(false);
    expect(Math.abs(res.value)).toBeLessThan(0.1);
  });

  test("Cancel restores the original value", () => {
    const ctx = makeContext();
    input(ctx, "A1", "2");
    input(ctx, "B1", "=A1*10");
    const res = goalSeek(ctx, {
      setCell: at("B1"),
      toValue: 55,
      changingCell: at("A1"),
    });
    expect(value(ctx, "A1")).toBeCloseTo(5.5, 6);
    restoreGoalSeek(ctx, at("A1"), res.original);
    expect(value(ctx, "A1")).toBe(2);
    expect(value(ctx, "B1")).toBe(20);
    setGoalSeekValue(ctx, at("A1"), res.value);
    expect(value(ctx, "B1")).toBeCloseTo(55, 6);
  });

  test("validation: set cell must be a formula, changing cell a value", () => {
    const ctx = makeContext();
    input(ctx, "A1", "2");
    input(ctx, "B1", "=A1*10");
    expect(
      goalSeek(ctx, { setCell: at("A1"), toValue: 1, changingCell: at("A1") })
        .error
    ).toBe("setCellNotFormula");
    expect(
      goalSeek(ctx, { setCell: at("B1"), toValue: 1, changingCell: at("B1") })
        .error
    ).toBe("changingCellFormula");
  });
});

describe("Data tables", () => {
  // One-variable, column oriented (Excel: "Calculate multiple results by
  // using a data table"): rates down A4:A6, =PMT formula in B3.
  function loanSheet() {
    const ctx = makeContext({ rows: 12, cols: 8 });
    input(ctx, "B1", "0.05"); // rate (column input)
    input(ctx, "D1", "200000"); // amount (row input)
    input(ctx, "B3", "=ROUND(-PMT(B1/12,360,D1),2)");
    input(ctx, "A4", "0.04");
    input(ctx, "A5", "0.05");
    input(ctx, "A6", "0.06");
    return ctx;
  }

  test("one variable, column input", () => {
    const ctx = loanSheet();
    expect(
      createDataTable(ctx, {
        range: { row: [2, 5], column: [0, 1] },
        colInput: at("B1"),
      })
    ).toBeNull();
    groupValuesRefresh(ctx);
    expect(values(ctx, "B4", "B6")).toEqual([[954.83], [1073.64], [1199.1]]);
    // the input cell is restored
    expect(value(ctx, "B1")).toBe(0.05);
    expect(value(ctx, "B3")).toBe(1073.64);
    expect(dataTableFormula(dataTableAt(ctx, 3, 1))).toBe("{=TABLE(,B1)}");
  });

  test("one variable, row input", () => {
    const ctx = makeContext({ rows: 12, cols: 8 });
    input(ctx, "A1", "3");
    input(ctx, "B2", "4");
    input(ctx, "C2", "5");
    input(ctx, "A3", "=A1*10");
    input(ctx, "A4", "=A1+1");
    createDataTable(ctx, {
      range: { row: [1, 3], column: [0, 2] },
      rowInput: at("A1"),
    });
    expect(values(ctx, "B3", "C4")).toEqual([
      [40, 50],
      [5, 6],
    ]);
  });

  test("two variables", () => {
    const ctx = loanSheet();
    // table at A8: formula in A8, amounts across B8:C8, rates down A9:A10
    input(ctx, "A8", "=B3");
    input(ctx, "B8", "100000");
    input(ctx, "C8", "300000");
    input(ctx, "A9", "0.04");
    input(ctx, "A10", "0.06");
    createDataTable(ctx, {
      range: { row: [7, 9], column: [0, 2] },
      rowInput: at("D1"),
      colInput: at("B1"),
    });
    expect(values(ctx, "B9", "C10")).toEqual([
      [477.42, 1432.25],
      [599.55, 1798.65],
    ]);
    expect(dataTableFormula(dataTableAt(ctx, 8, 1))).toBe("{=TABLE(D1,B1)}");
  });

  test("recalculates when the model changes", () => {
    const ctx = loanSheet();
    createDataTable(ctx, {
      range: { row: [2, 5], column: [0, 1] },
      colInput: at("B1"),
    });
    input(ctx, "D1", "100000");
    expect(recalcDataTables(ctx)).toBe(true);
    expect(values(ctx, "B4", "B4")).toEqual([[477.42]]);
    expect(recalcDataTables(ctx)).toBe(false);
  });

  test("the body is read-only as a unit; clearing all of it removes the table", () => {
    const ctx = loanSheet();
    createDataTable(ctx, {
      range: { row: [2, 5], column: [0, 1] },
      colInput: at("B1"),
    });
    expect(
      checkEditGuards(ctx, [{ row: [3, 3], column: [1, 1] }], "edit")
    ).toBe("Cannot change part of a data table.");
    updateCell(ctx, 3, 1, { innerText: "1", innerHTML: "1" }, "1");
    expect(value(ctx, "B4")).toBe(954.83);
    expect(ctx.warnDialog).toBe("Cannot change part of a data table.");
    pressDelete(ctx, "B4", "B5");
    expect(value(ctx, "B4")).toBe(954.83);
    pressDelete(ctx, "B4", "B6");
    expect(cell(ctx, "B4")?.v).toBeUndefined();
    expect(dataTableAt(ctx, 3, 1)).toBeUndefined();
    // the input values and formulas are ordinary cells
    expect(
      checkEditGuards(ctx, [{ row: [3, 3], column: [0, 0] }], "edit")
    ).toBeNull();
  });

  test("validation", () => {
    const ctx = loanSheet();
    expect(
      validateDataTable(ctx, {
        range: { row: [2, 2], column: [0, 1] },
        colInput: at("B1"),
      })
    ).toBe("tooSmall");
    expect(
      validateDataTable(ctx, { range: { row: [2, 5], column: [0, 1] } })
    ).toBe("noInput");
    expect(
      validateDataTable(ctx, {
        range: { row: [2, 5], column: [0, 1] },
        colInput: at("B4"),
      })
    ).toBe("inputInTable");
  });
});
