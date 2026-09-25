import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  edit,
} from "./recalc-helpers";
import {
  addWatchesForSelection,
  createFormulaEvaluation,
  deleteWatches,
  evaluateNextStep,
  getEvaluationView,
  getFormulaPrecedents,
  getTraceArrows,
  getWatchRows,
  isShowFormulas,
  removeTraceArrows,
  restartEvaluation,
  runShortcut,
  stepIn,
  stepOut,
  toggleShowFormulas,
  traceDependents,
  tracePrecedents,
  registerFormulaAuditingCore,
  valueToLiteral,
  getCalcSettings,
  setCalcSettings,
  isCalculationPending,
} from "../../src";

function select(ctx, r, c, r2 = r, c2 = c) {
  ctx.luckysheet_select_save = [
    { row: [r, r2], column: [c, c2], row_focus: r, column_focus: c },
  ];
}

function workbook() {
  const s1 = makeSheet("Sheet1", "s1", 10, 6);
  const s2 = makeSheet("Data", "s2", 4, 4, 1);
  putValue(s1, 0, 0, 1); // A1
  putValue(s1, 1, 0, 2); // A2
  putValue(s1, 2, 0, 3); // A3
  putFormula(s1, 3, 0, "=SUM(A1:A3)", 6); // A4
  putFormula(s1, 4, 0, "=A4*2+Data!A1", 12); // A5
  putFormula(s1, 5, 0, "=A5+1", 13); // A6
  putValue(s2, 0, 0, 0);
  const ctx = makeCtx([s1, s2]);
  loadWorkbook(ctx);
  return ctx;
}

const describeArrow = (a) =>
  `${a.kind}:${a.from.sheetId}!${a.from.row.join("-")},${a.from.column.join(
    "-"
  )}->${a.to.sheetId}!${a.to.r},${a.to.c}`;

describe("trace precedents / dependents", () => {
  test("precedents of a formula, level by level", () => {
    const ctx = workbook();
    expect(getFormulaPrecedents(ctx, "s1", 4, 0)).toEqual([
      { sheetId: "s1", row: [3, 3], column: [0, 0] },
      { sheetId: "s2", row: [0, 0], column: [0, 0] },
    ]);
    select(ctx, 5, 0);
    expect(tracePrecedents(ctx)).toBe("added");
    expect(getTraceArrows(ctx).map(describeArrow)).toEqual([
      "precedent:s1!4-4,0-0->s1!5,0",
    ]);
    tracePrecedents(ctx);
    tracePrecedents(ctx);
    expect(getTraceArrows(ctx).map(describeArrow)).toEqual([
      "precedent:s1!4-4,0-0->s1!5,0",
      "precedent:s1!3-3,0-0->s1!4,0",
      "precedent:s2!0-0,0-0->s1!4,0",
      "precedent:s1!0-2,0-0->s1!3,0",
    ]);
    // nothing further to trace
    expect(tracePrecedents(ctx)).toBe("none");
    // the other sheet only sees the cross-sheet arrow
    expect(getTraceArrows(ctx, "s2")).toHaveLength(1);

    select(ctx, 0, 0);
    expect(tracePrecedents(ctx)).toBe("noFormula");
  });

  test("dependents, error arrows and Remove Arrows", () => {
    const ctx = workbook();
    select(ctx, 0, 0);
    expect(traceDependents(ctx)).toBe("added");
    expect(getTraceArrows(ctx).map(describeArrow)).toEqual([
      "dependent:s1!0-0,0-0->s1!3,0",
    ]);
    traceDependents(ctx);
    traceDependents(ctx);
    expect(getTraceArrows(ctx).map(describeArrow)).toEqual([
      "dependent:s1!0-0,0-0->s1!3,0",
      "dependent:s1!3-3,0-0->s1!4,0",
      "dependent:s1!4-4,0-0->s1!5,0",
    ]);
    select(ctx, 5, 0);
    tracePrecedents(ctx);
    removeTraceArrows(ctx, "dependent");
    expect(getTraceArrows(ctx).map((a) => a.kind)).toEqual(["precedent"]);
    removeTraceArrows(ctx);
    expect(ctx.traceArrows).toBeUndefined();

    // a precedent holding an error gives a red arrow
    edit(ctx, 0, 1, "=1/0"); // B1
    edit(ctx, 1, 1, "=B1+1"); // B2
    select(ctx, 1, 1);
    tracePrecedents(ctx);
    expect(getTraceArrows(ctx)[0].error).toBe(true);
  });
});

describe("show formulas and watch window", () => {
  test("Ctrl+` toggles show formulas for the sheet", () => {
    const ctx = workbook();
    const off = registerFormulaAuditingCore();
    expect(isShowFormulas(ctx)).toBe(false);
    const e = {
      key: "`",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(runShortcut(ctx, e, false)).toBe(true);
    expect(isShowFormulas(ctx)).toBe(true);
    expect(isShowFormulas(ctx, "s2")).toBe(false);
    toggleShowFormulas(ctx);
    expect(isShowFormulas(ctx)).toBe(false);

    // F9 in manual mode
    setCalcSettings(ctx, { mode: "manual" });
    edit(ctx, 0, 0, "10");
    expect(isCalculationPending(ctx)).toBe(true);
    runShortcut(
      ctx,
      {
        key: "F9",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      },
      false
    );
    expect(isCalculationPending(ctx)).toBe(false);
    expect(ctx.luckysheetfile[0].data[3][0].v).toBe(15);
    expect(getCalcSettings(ctx).mode).toBe("manual");
    off();
  });

  test("watches list live values and can be deleted", () => {
    const ctx = workbook();
    select(ctx, 3, 0, 4, 0);
    addWatchesForSelection(ctx);
    addWatchesForSelection(ctx); // no duplicates
    let rows = getWatchRows(ctx);
    expect(rows.map((w) => [w.sheet, w.cell, w.value, w.formula])).toEqual([
      ["Sheet1", "$A$4", "6", "=SUM(A1:A3)"],
      ["Sheet1", "$A$5", "12", "=A4*2+Data!A1"],
    ]);
    edit(ctx, 0, 0, "11");
    rows = getWatchRows(ctx);
    expect(rows[0].value).toBe("16");
    deleteWatches(ctx, [rows[0].key]);
    expect(getWatchRows(ctx)).toHaveLength(1);
    expect(ctx.watchWindow.open).toBe(true);
  });
});

function view(ctx, session) {
  return getEvaluationView(ctx, session)
    .levels.map((l) => {
      let out = "";
      let inNext = false;
      l.segments.forEach((s) => {
        if (!!s.next !== inNext) {
          out += "_";
          inNext = !!s.next;
        }
        out += s.evaluated ? `'${s.text}'` : s.text;
      });
      return inNext ? `${out}_` : out;
    })
    .join(" | ");
}

describe("evaluate formula", () => {
  test("steps through references and operations", () => {
    const ctx = workbook();
    const session = createFormulaEvaluation(ctx, "s1", 4, 0); // =A4*2+Data!A1
    expect(view(ctx, session)).toBe("_A4_*2+Data!A1");
    evaluateNextStep(ctx, session);
    expect(view(ctx, session)).toBe("_'6'*2_+Data!A1");
    evaluateNextStep(ctx, session);
    expect(view(ctx, session)).toBe("'12'+_Data!A1_");
    evaluateNextStep(ctx, session);
    expect(view(ctx, session)).toBe("_'12'+'0'_");
    evaluateNextStep(ctx, session);
    expect(view(ctx, session)).toBe("'12'");
    expect(getEvaluationView(ctx, session).finished).toBe(true);
    restartEvaluation(ctx, session);
    expect(view(ctx, session)).toBe("_A4_*2+Data!A1");
  });

  test("step in and out of a referenced formula", () => {
    const ctx = workbook();
    const session = createFormulaEvaluation(ctx, "s1", 5, 0); // =A5+1
    expect(getEvaluationView(ctx, session).canStepIn).toBe(true);
    stepIn(ctx, session);
    const v = getEvaluationView(ctx, session);
    expect(v.levels.map((l) => l.reference)).toEqual([
      "Sheet1!$A$6",
      "Sheet1!$A$5",
    ]);
    expect(v.canStepOut).toBe(true);
    stepOut(ctx, session);
    expect(view(ctx, session)).toBe("_'12'+1_");
  });

  test("IF evaluates only the branch taken; functions and literals", () => {
    const ctx = workbook();
    edit(ctx, 0, 2, '=IF(A1>0,SUM(A1:A3)*2,"no")');
    const session = createFormulaEvaluation(ctx, "s1", 0, 2);
    const steps = [];
    for (
      let i = 0;
      i < 10 && !getEvaluationView(ctx, session).finished;
      i += 1
    ) {
      steps.push(view(ctx, session));
      evaluateNextStep(ctx, session);
    }
    steps.push(view(ctx, session));
    expect(steps).toEqual([
      'IF(_A1_>0,SUM(A1:A3)*2,"no")',
      "IF(_'1'>0_,SUM(A1:A3)*2,\"no\")",
      "IF('TRUE',_SUM(A1:A3)_*2,\"no\")",
      "IF('TRUE',_'6'*2_,\"no\")",
      "_IF('TRUE','12',\"no\")_",
      "'12'",
    ]);
    expect(
      valueToLiteral([
        [1, "a"],
        [true, null],
      ])
    ).toBe('{1,"a";TRUE,0}');
    expect(valueToLiteral("#N/A")).toBe("#N/A");
  });
});
