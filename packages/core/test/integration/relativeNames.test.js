import { makeContext, input, value, cell } from "../formula/helpers";
import {
  evaluateDefinedName,
  findDefinedName,
  offsetRelativeReferences,
  refersToForActiveCell,
  resolveNameRange,
  saveDefinedName,
} from "../../src/modules/names";
import { insertRowCol } from "../../src/modules/rowcol";
import { groupValuesRefresh } from "../../src/modules/formula";

// Excel semantics for relative references in defined names: a reference
// without `$` is relative to the cell using the name. `=A1` defined while B1
// is active means "the cell to the left" wherever the name is used.

function activate(ctx, r, c) {
  ctx.luckysheet_select_save = [
    { row: [r, r], column: [c, c], row_focus: r, column_focus: c },
  ];
}

function define(ctx, name, refersTo, at, scope) {
  activate(ctx, at[0], at[1]);
  expect(saveDefinedName(ctx, { name, refersTo, scope })).toBeNull();
}

describe("relative references in defined names", () => {
  test("are stored as seen from A1, like xlsx files", () => {
    const ctx = makeContext();
    define(ctx, "Left", "=A1", [0, 1]);
    define(ctx, "Above", "=B1", [1, 1]);
    define(ctx, "RowStart", "=$A2", [1, 2]);
    define(ctx, "Fixed", "=$C$3", [5, 5]);
    expect(findDefinedName(ctx, "Left").refersTo).toBe("=Sheet1!XFD1");
    expect(findDefinedName(ctx, "Above").refersTo).toBe("=Sheet1!A1048576");
    expect(findDefinedName(ctx, "RowStart").refersTo).toBe("=Sheet1!$A1");
    expect(findDefinedName(ctx, "Fixed").refersTo).toBe("=Sheet1!$C$3");
  });

  test("resolve relative to the cell using the name", () => {
    const ctx = makeContext();
    input(ctx, "B5", "7");
    input(ctx, "C2", "3");
    input(ctx, "A2", "4");
    define(ctx, "Left", "=A1", [0, 1]);
    define(ctx, "Above", "=B1", [1, 1]);
    define(ctx, "RowStart", "=$A2", [1, 2]);
    input(ctx, "C5", "=Left");
    input(ctx, "D2", "=Left*2");
    input(ctx, "A3", "=SUM(Above)+1");
    input(ctx, "F2", "=RowStart");
    // the name also works from another sheet (the sheet part is fixed)
    input(ctx, "C5", "=Left", "id_2");
    expect(value(ctx, "C5")).toBe(7);
    expect(value(ctx, "D2")).toBe(6);
    expect(value(ctx, "A3")).toBe(5);
    expect(value(ctx, "F2")).toBe(4);
    expect(value(ctx, "C5", "id_2")).toBe(7);
  });

  test("formulas using them recalculate when the target changes", () => {
    const ctx = makeContext();
    input(ctx, "B5", "7");
    define(ctx, "Left", "=A1", [0, 1]);
    input(ctx, "C5", "=Left+1");
    expect(value(ctx, "C5")).toBe(8);
    input(ctx, "B5", "10");
    groupValuesRefresh(ctx);
    expect(value(ctx, "C5")).toBe(11);
  });

  test("names imported from xlsx (A1-relative) resolve per cell", () => {
    const ctx = makeContext();
    ctx.luckysheetfile[0].definedNames = [
      { name: "Prev", refersTo: "=Sheet1!A1048576" },
    ];
    input(ctx, "B2", "5");
    input(ctx, "B3", "=Prev*3");
    expect(value(ctx, "B3")).toBe(15);
  });

  test("structural changes keep the offsets", () => {
    const ctx = makeContext();
    input(ctx, "B5", "7");
    define(ctx, "Left", "=A1", [0, 1]);
    input(ctx, "C5", "=Left");
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    groupValuesRefresh(ctx);
    expect(findDefinedName(ctx, "Left").refersTo).toBe("=Sheet1!XFD1");
    expect(cell(ctx, "D5").f).toBe("=Left");
    // still the cell to the left: the moved 7
    expect(value(ctx, "D5")).toBe(7);
  });

  test("the Name Manager shows and saves them from the active cell", () => {
    const ctx = makeContext();
    input(ctx, "B5", "7");
    define(ctx, "Left", "=A1", [0, 1]);
    const stored = findDefinedName(ctx, "Left").refersTo;
    activate(ctx, 4, 2);
    expect(refersToForActiveCell(ctx, stored)).toBe("=Sheet1!B5");
    expect(evaluateDefinedName(ctx, findDefinedName(ctx, "Left"))).toBe("7");
    expect(resolveNameRange(ctx, "Left", "id_1")).toEqual({
      sheetId: "id_1",
      row: [4, 4],
      column: [1, 1],
    });
    // editing without changing the text keeps the definition
    saveDefinedName(
      ctx,
      { name: "Left", refersTo: refersToForActiveCell(ctx, stored) },
      { name: "Left", scope: null }
    );
    expect(findDefinedName(ctx, "Left").refersTo).toBe(stored);
  });

  test("offsetRelativeReferences wraps around the grid", () => {
    expect(offsetRelativeReferences("=Sheet1!XFD1048576", 2, 2)).toBe(
      "=Sheet1!B2"
    );
    expect(offsetRelativeReferences("=SUM(A1:B2,$C$3,$D4)", -1, 1)).toBe(
      "=SUM(B1048576:C1,$C$3,$D3)"
    );
    expect(offsetRelativeReferences("=A:A", 5, 1)).toBe("=B:B");
    expect(offsetRelativeReferences('="A1"', 5, 1)).toBe('="A1"');
  });
});
