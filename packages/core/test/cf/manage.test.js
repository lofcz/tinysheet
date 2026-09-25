import {
  produce,
  enablePatches,
  produceWithPatches,
  applyPatches,
} from "immer";
import { makeContext, rules, range } from "./helpers";
import {
  addCFRule,
  addDataBarRule,
  addHighlightRule,
  clearCFRules,
  cfRulesInRanges,
  deleteCFRule,
  getCFRules,
  moveCFRule,
  setCFRules,
  updateCFRule,
  subtractRange,
  parseSqref,
  formatSqref,
  rulesByPriority,
  makeDataBar,
  shiftCFFormula,
  compileCFFormula,
} from "../../src/modules/ConditionFormat";

enablePatches();

function rule(name, sqref = "A1:A3") {
  return {
    type: "default",
    cellrange: range(sqref),
    conditionName: name,
    conditionValue: [1],
    format: { cellColor: "#FF0000" },
  };
}

describe("applies-to ranges", () => {
  test("parse and format A1 lists (comma or space separated)", () => {
    expect(parseSqref("A1:B3, D5")).toEqual([
      { row: [0, 2], column: [0, 1] },
      { row: [4, 4], column: [3, 3] },
    ]);
    expect(parseSqref("$C$3:$A$1 E:F 2:4")).toEqual([
      { row: [0, 2], column: [0, 2] },
      { row: [0, 1048575], column: [4, 5] },
      { row: [1, 3], column: [0, 16383] },
    ]);
    expect(parseSqref("Sheet1!AA10")).toEqual([
      { row: [9, 9], column: [26, 26] },
    ]);
    expect(parseSqref("A1:B")).toBeNull();
    expect(parseSqref("")).toBeNull();
    expect(formatSqref(parseSqref("A1:B3,D5,E:F,2:4"))).toBe(
      "A1:B3,D5,E:F,2:4"
    );
    expect(formatSqref(parseSqref("A1:B3,D5"), " ")).toBe("A1:B3 D5");
  });

  test("subtracting a selection splits a range into rectangles", () => {
    const parts = subtractRange(
      { row: [0, 9], column: [0, 9] },
      { row: [2, 3], column: [2, 3] }
    );
    expect(formatSqref(parts)).toBe("A1:J2,A5:J10,A3:B4,E3:J4");
    expect(
      subtractRange(
        { row: [0, 1], column: [0, 1] },
        { row: [5, 6], column: [5, 6] }
      )
    ).toEqual([{ row: [0, 1], column: [0, 1] }]);
  });
});

describe("formula shifting", () => {
  test("relative parts shift, absolute parts and strings stay", () => {
    expect(shiftCFFormula("A1+$B$2+C$3+$D4", 2, 1)).toBe("B3+$B$2+D$3+$D6");
    expect(shiftCFFormula('COUNTIF($A:$A,A1)>1&"B2"', 3, 0)).toBe(
      'COUNTIF($A:$A,A4)>1&"B2"'
    );
    expect(shiftCFFormula("SUM(A:B)+SUM(1:2)", 1, 1)).toBe("SUM(B:C)+SUM(2:3)");
    expect(shiftCFFormula("'My Sheet'!A1+Sheet2!B1", 1, 0)).toBe(
      "'My Sheet'!A2+Sheet2!B2"
    );
    // function names that look like cells are left alone
    expect(shiftCFFormula("LOG10(A1)+ATAN2(A1,B1)", 1, 0)).toBe(
      "LOG10(A2)+ATAN2(A2,B2)"
    );
    expect(shiftCFFormula("A1", -1, 0)).toBe("#REF!");
    expect(compileCFFormula("$A$1>0").relative).toBe(false);
    expect(compileCFFormula("ROW()=1").positional).toBe(true);
  });
});

describe("editing rules", () => {
  test("add, update, move, delete; the last rule has the highest priority", () => {
    const ctx = makeContext();
    expect(addCFRule(ctx, rule("greaterThan"))).toBe(0);
    expect(addCFRule(ctx, rule("lessThan"))).toBe(1);
    expect(
      rulesByPriority(getCFRules(ctx)).map((r) => r.conditionName)
    ).toEqual(["lessThan", "greaterThan"]);
    expect(updateCFRule(ctx, 0, rule("equal"))).toBe(true);
    expect(getCFRules(ctx)[0].conditionName).toBe("equal");
    expect(moveCFRule(ctx, 0, 1)).toBe(1);
    expect(getCFRules(ctx).map((r) => r.conditionName)).toEqual([
      "lessThan",
      "equal",
    ]);
    expect(moveCFRule(ctx, 1, 1)).toBe(1);
    expect(deleteCFRule(ctx, 0)).toBe(true);
    expect(getCFRules(ctx).map((r) => r.conditionName)).toEqual(["equal"]);
    expect(deleteCFRule(ctx, 4)).toBe(false);
  });

  test("rules are stored as plain copies (selection extras dropped)", () => {
    const ctx = makeContext();
    const r = rule("greaterThan");
    r.cellrange = [{ row: [0, 1], column: [0, 0], row_focus: 0, left: 5 }];
    addCFRule(ctx, r);
    expect(getCFRules(ctx)[0].cellrange).toEqual([
      { row: [0, 1], column: [0, 0] },
    ]);
    expect(getCFRules(ctx)[0]).not.toBe(r);
  });

  test("gallery helpers apply to the selection", () => {
    const ctx = makeContext();
    ctx.luckysheet_select_save = [
      { row: [1, 4], column: [2, 2], row_focus: 1, column_focus: 2 },
    ];
    addDataBarRule(ctx, makeDataBar("#638EC6", true));
    addHighlightRule(ctx, "blanks", [], { bold: true }, { stopIfTrue: true });
    const [bar, hl] = getCFRules(ctx);
    expect(bar.type).toBe("dataBar");
    expect(formatSqref(bar.cellrange)).toBe("C2:C5");
    expect(hl).toMatchObject({
      conditionName: "blanks",
      stopIfTrue: true,
      format: { bold: true },
    });
  });

  test("clear rules from the selection or the whole sheet", () => {
    const ctx = makeContext();
    rules(ctx, [rule("greaterThan", "A1:A10"), rule("lessThan", "B1:B2")]);
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 1] }];
    expect(cfRulesInRanges(ctx, parseSqref("A6"))).toEqual([0]);
    clearCFRules(ctx, "selection");
    const left = getCFRules(ctx);
    expect(left).toHaveLength(1);
    expect(formatSqref(left[0].cellrange)).toBe("A6:A10");
    clearCFRules(ctx, "sheet");
    expect(getCFRules(ctx)).toEqual([]);
  });

  test("protected sheets refuse edits", () => {
    const ctx = makeContext();
    ctx.luckysheetfile[0].config = {
      authority: { sheet: 1, hintText: "protected" },
    };
    expect(addCFRule(ctx, rule("greaterThan"))).toBe(-1);
    expect(ctx.warnDialog).toBe("protected");
    expect(setCFRules(ctx, [rule("equal")])).toBe(false);
  });

  test("every edit is undoable through immer patches", () => {
    const base = produce(makeContext(), () => {});
    const [next, patches, inverse] = produceWithPatches(base, (draft) => {
      addCFRule(draft, rule("greaterThan"));
      addCFRule(draft, rule("lessThan"));
    });
    expect(getCFRules(next)).toHaveLength(2);
    // all changes are recorded under luckysheetfile, which the history keeps
    expect(patches.every((p) => p.path[0] === "luckysheetfile")).toBe(true);
    const undone = applyPatches(next, inverse);
    expect(getCFRules(undone)).toEqual([]);
    const [moved, , back] = produceWithPatches(next, (draft) => {
      moveCFRule(draft, 0, 1);
    });
    expect(getCFRules(moved)[1].conditionName).toBe("greaterThan");
    expect(getCFRules(applyPatches(moved, back))[1].conditionName).toBe(
      "lessThan"
    );
  });
});
