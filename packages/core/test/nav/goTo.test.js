import { input, makeContext } from "../formula/helpers";
import {
  applyGoToSpecial,
  cellsToRanges,
  cellValueKind,
  formatGoToTarget,
  getGoToSpecialRanges,
  goToReference,
  parseGoToReference,
  relativeFormulaSignature,
} from "../../src/modules/goTo";

function select(ctx, r, c, r2 = r, c2 = c) {
  ctx.luckysheet_select_save = [
    { row: [r, r2], column: [c, c2], row_focus: r, column_focus: c },
  ];
}

const rg = (r1, c1, r2 = r1, c2 = c1) => ({
  row: [r1, r2],
  column: [c1, c2],
});

function plain(sel) {
  return sel.map((s) => ({ row: s.row, column: s.column }));
}

describe("Go To reference box", () => {
  test("cells, ranges, whole rows and columns", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    expect(parseGoToReference(ctx, "B3")).toEqual({
      sheetId: "id_1",
      ranges: [rg(2, 1)],
    });
    expect(parseGoToReference(ctx, "$b$2:c4").ranges).toEqual([rg(1, 1, 3, 2)]);
    expect(parseGoToReference(ctx, "C:D").ranges).toEqual([rg(0, 2, 9, 3)]);
    expect(parseGoToReference(ctx, "2:3").ranges).toEqual([rg(1, 0, 2, 5)]);
  });

  test("sheet-qualified references, quoted names, case-insensitive", () => {
    const ctx = makeContext();
    expect(parseGoToReference(ctx, "'My Sheet'!A2")).toEqual({
      sheetId: "id_2",
      ranges: [rg(1, 0)],
    });
    expect(parseGoToReference(ctx, "sheet1!B1").sheetId).toBe("id_1");
  });

  test("several areas on one sheet become a multi-range selection", () => {
    const ctx = makeContext();
    expect(parseGoToReference(ctx, "A1,C3:D4").ranges).toEqual([
      rg(0, 0),
      rg(2, 2, 3, 3),
    ]);
    // areas on different sheets are not a valid reference
    expect(parseGoToReference(ctx, "A1,'My Sheet'!B2")).toBeNull();
  });

  test("invalid references", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    ["", "A", "foo bar", "Nope!A1", "Z1", "A99", "A1:"].forEach((t) => {
      expect(parseGoToReference(ctx, t)).toBeNull();
    });
  });

  test("names resolve through a resolver", () => {
    const ctx = makeContext();
    const resolve = (name) =>
      name.toLowerCase() === "totals"
        ? { sheetId: "id_2", ranges: [rg(4, 1)] }
        : null;
    expect(parseGoToReference(ctx, "Totals", resolve)).toEqual({
      sheetId: "id_2",
      ranges: [rg(4, 1)],
    });
    expect(parseGoToReference(ctx, "Other", resolve)).toBeNull();
  });

  test("goToReference selects and switches sheets", () => {
    const ctx = makeContext();
    ctx.sheetScrollRecord = {};
    expect(goToReference(ctx, "'My Sheet'!B2:C3")).toBe(true);
    expect(ctx.currentSheetId).toBe("id_2");
    expect(plain(ctx.luckysheet_select_save)).toEqual([rg(1, 1, 2, 2)]);
    // the tab components restore the selection from this record
    expect(plain(ctx.sheetScrollRecord.id_2.luckysheet_select_save)).toEqual([
      rg(1, 1, 2, 2),
    ]);
    expect(goToReference(ctx, "xyz")).toBe(false);
  });

  test("recent-list text", () => {
    const ctx = makeContext();
    expect(
      formatGoToTarget(ctx, {
        sheetId: "id_2",
        ranges: [rg(0, 0, 1, 1), rg(4, 2)],
      })
    ).toBe("'My Sheet'!$A$1:$B$2,$C$5");
    expect(formatGoToTarget(ctx, { sheetId: "id_1", ranges: [rg(0, 0)] })).toBe(
      "Sheet1!$A$1"
    );
  });
});

describe("cellsToRanges", () => {
  test("merges row runs into rectangles", () => {
    expect(
      cellsToRanges([
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [1, 3],
        [3, 0],
      ])
    ).toEqual([rg(0, 0, 1, 1), rg(1, 3), rg(3, 0)]);
  });
});

describe("cell value kinds (Go To Special types)", () => {
  test("numbers, text, logicals, errors, blanks", () => {
    expect(cellValueKind({ v: 1, ct: { t: "n" } })).toBe("numbers");
    expect(cellValueKind({ v: 45000, ct: { t: "d" } })).toBe("numbers");
    expect(cellValueKind({ v: "x" })).toBe("text");
    expect(cellValueKind({ v: true })).toBe("logicals");
    expect(cellValueKind({ v: "#DIV/0!" })).toBe("errors");
    expect(cellValueKind({ v: "" })).toBeNull();
    expect(cellValueKind(null)).toBeNull();
    expect(cellValueKind({ ct: { t: "inlineStr", s: [{ v: "a" }] } })).toBe(
      "text"
    );
  });
});

/**
 *        A      B        C
 *   1    1      text     =A1*2
 *   2    TRUE   (blank)  =1/0
 *   3    3      4        =B1
 */
function sheet() {
  const ctx = makeContext({ rows: 8, cols: 6 });
  input(ctx, "A1", "1");
  input(ctx, "B1", "text");
  input(ctx, "C1", "=A1*2");
  input(ctx, "A2", "TRUE");
  input(ctx, "C2", "=1/0");
  input(ctx, "A3", "3");
  input(ctx, "B3", "4");
  input(ctx, "C3", "=B1");
  select(ctx, 0, 0);
  return ctx;
}

describe("Go To Special", () => {
  test("constants by type within the used range", () => {
    const ctx = sheet();
    expect(getGoToSpecialRanges(ctx, "constants")).toEqual([
      rg(0, 0, 0, 1),
      rg(1, 0),
      rg(2, 0, 2, 1),
    ]);
    expect(
      getGoToSpecialRanges(ctx, "constants", {
        valueTypes: {
          numbers: true,
          text: false,
          logicals: false,
          errors: false,
        },
      })
    ).toEqual([rg(0, 0), rg(2, 0, 2, 1)]);
    expect(
      getGoToSpecialRanges(ctx, "constants", {
        valueTypes: {
          numbers: false,
          text: false,
          logicals: true,
          errors: false,
        },
      })
    ).toEqual([rg(1, 0)]);
  });

  test("formulas by result type", () => {
    const ctx = sheet();
    expect(getGoToSpecialRanges(ctx, "formulas")).toEqual([rg(0, 2, 2, 2)]);
    expect(
      getGoToSpecialRanges(ctx, "formulas", {
        valueTypes: {
          numbers: false,
          text: false,
          logicals: false,
          errors: true,
        },
      })
    ).toEqual([rg(1, 2)]);
    expect(
      getGoToSpecialRanges(ctx, "formulas", {
        valueTypes: {
          numbers: false,
          text: true,
          logicals: false,
          errors: false,
        },
      })
    ).toEqual([rg(2, 2)]);
  });

  test("blanks are limited to the used range", () => {
    const ctx = sheet();
    expect(getGoToSpecialRanges(ctx, "blanks")).toEqual([rg(1, 1)]);
  });

  test("a multi-cell selection limits the search", () => {
    const ctx = sheet();
    select(ctx, 0, 0, 1, 0);
    expect(getGoToSpecialRanges(ctx, "constants")).toEqual([rg(0, 0, 1, 0)]);
  });

  test("current region, last cell", () => {
    const ctx = sheet();
    select(ctx, 1, 1);
    expect(getGoToSpecialRanges(ctx, "currentRegion")).toEqual([
      rg(0, 0, 2, 2),
    ]);
    expect(getGoToSpecialRanges(ctx, "lastCell")).toEqual([rg(2, 2)]);
  });

  test("current array selects the whole spill range", () => {
    const ctx = makeContext({ rows: 8, cols: 6 });
    input(ctx, "B2", "=SEQUENCE(3,2)");
    select(ctx, 3, 2);
    expect(getGoToSpecialRanges(ctx, "currentArray")).toEqual([rg(1, 1, 3, 2)]);
    select(ctx, 0, 0);
    expect(getGoToSpecialRanges(ctx, "currentArray")).toEqual([]);
  });

  test("row differences compare with the active cell's column", () => {
    const ctx = makeContext({ rows: 8, cols: 6 });
    input(ctx, "A1", "1");
    input(ctx, "B1", "1");
    input(ctx, "C1", "2");
    input(ctx, "A2", "5");
    input(ctx, "B2", "6");
    input(ctx, "C2", "5");
    select(ctx, 0, 0, 1, 2);
    expect(getGoToSpecialRanges(ctx, "rowDifferences")).toEqual([
      rg(0, 2),
      rg(1, 1),
    ]);
    expect(getGoToSpecialRanges(ctx, "columnDifferences")).toEqual([
      rg(1, 0, 1, 2),
    ]);
  });

  test("row differences treat copied relative formulas as equal", () => {
    expect(relativeFormulaSignature("=A1*2", 0, 1)).toBe(
      relativeFormulaSignature("=A2*2", 1, 1)
    );
    expect(relativeFormulaSignature("=$A$1", 0, 1)).not.toBe(
      relativeFormulaSignature("=$A$1", 1, 1).replace("R1", "R2")
    );
    const ctx = makeContext({ rows: 8, cols: 6 });
    input(ctx, "A1", "1");
    input(ctx, "A2", "2");
    input(ctx, "B1", "=A1*2");
    input(ctx, "B2", "=A2*2");
    input(ctx, "C1", "=A1*2");
    input(ctx, "C2", "=A2*3");
    select(ctx, 0, 1, 1, 2);
    expect(getGoToSpecialRanges(ctx, "columnDifferences")).toEqual([rg(1, 2)]);
  });

  test("direct precedents and dependents on the sheet", () => {
    const ctx = sheet();
    input(ctx, "D1", "=SUM(A1:B3)+'My Sheet'!A1");
    select(ctx, 0, 3);
    expect(getGoToSpecialRanges(ctx, "precedents")).toEqual([rg(0, 0, 2, 1)]);
    select(ctx, 0, 1);
    // C3 (=B1) and D1 (=SUM(A1:B3)) depend on B1
    expect(getGoToSpecialRanges(ctx, "dependents")).toEqual([
      rg(0, 3),
      rg(2, 2),
    ]);
  });

  test("visible cells only skips hidden rows and columns", () => {
    const ctx = sheet();
    ctx.config = { rowhidden: { 1: 0 }, colhidden: { 1: 0 } };
    select(ctx, 0, 0, 2, 2);
    expect(getGoToSpecialRanges(ctx, "visibleCells")).toEqual([
      rg(0, 0),
      rg(0, 2),
      rg(2, 0),
      rg(2, 2),
    ]);
  });

  test("notes, conditional formats and data validation (all / same)", () => {
    const ctx = sheet();
    const s = ctx.luckysheetfile[0];
    s.data[2][1].ps = { value: "note" };
    expect(getGoToSpecialRanges(ctx, "notes")).toEqual([rg(2, 1)]);
    s.luckysheet_conditionformat_save = [
      { type: "default", cellrange: [rg(0, 0, 1, 0)] },
      { type: "default", cellrange: [rg(4, 4)] },
    ];
    expect(getGoToSpecialRanges(ctx, "conditionalFormats")).toEqual([
      rg(0, 0, 1, 0),
      rg(4, 4),
    ]);
    select(ctx, 4, 4);
    expect(
      getGoToSpecialRanges(ctx, "conditionalFormats", { sameOnly: true })
    ).toEqual([rg(4, 4)]);
    const list = { type: "dropdown", value1: "a,b" };
    s.dataVerification = {
      "0_1": { ...list },
      "1_1": { ...list },
      "5_5": { type: "number", value1: "1" },
    };
    expect(getGoToSpecialRanges(ctx, "dataValidation")).toEqual([
      rg(0, 1, 1, 1),
      rg(5, 5),
    ]);
    select(ctx, 0, 1);
    expect(
      getGoToSpecialRanges(ctx, "dataValidation", { sameOnly: true })
    ).toEqual([rg(0, 1, 1, 1)]);
  });

  test("applyGoToSpecial selects the result; nothing found keeps the selection", () => {
    const ctx = sheet();
    expect(applyGoToSpecial(ctx, "formulas")).toBe(1);
    expect(plain(ctx.luckysheet_select_save)).toEqual([rg(0, 2, 2, 2)]);
    select(ctx, 0, 0);
    expect(applyGoToSpecial(ctx, "notes")).toBe(0);
    expect(plain(ctx.luckysheet_select_save)).toEqual([rg(0, 0)]);
    expect(applyGoToSpecial(ctx, "constants")).toBe(3);
    expect(ctx.luckysheet_select_save).toHaveLength(3);
  });
});
