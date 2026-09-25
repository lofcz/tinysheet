import {
  parseRef,
  formatRef,
  offsetFormula,
  transposeFormula,
  rewriteFormula,
  createSheetLookup,
  getFormulaReferences,
  sheetPrefix,
  adjustRangeForChange,
  indexToColumn,
  columnToIndex,
} from "../../src/modules/refAdjust";

// Excel reference-adjustment rules, see "Move or copy cells, rows, and
// columns" and "Insert or delete rows and columns" on support.microsoft.com:
// references follow the cells they point at, ranges grow when rows/columns
// are inserted inside them and shrink when part of them is deleted, and a
// reference to a deleted cell becomes #REF!.

const sheets = [
  { id: "s1", name: "Sheet1" },
  { id: "s2", name: "My Sheet" },
  { id: "s3", name: "Bob's" },
  { id: "s4", name: "Data" },
];

const ins = (axis, index, count, sheetId = "s1") => ({
  type: "insert",
  sheetId,
  axis,
  index,
  count,
});
const del = (axis, start, end, sheetId = "s1") => ({
  type: "delete",
  sheetId,
  axis,
  start,
  end,
});
const rw = (f, change, host = "s1", newHost = host) =>
  rewriteFormula(f, change, host, createSheetLookup(sheets, change), newHost);

describe("parseRef / formatRef", () => {
  test("cells, ranges, whole columns and rows", () => {
    expect(parseRef("A1")).toMatchObject({
      kind: "cell",
      r1: 0,
      c1: 0,
      ar1: false,
      ac1: false,
    });
    expect(parseRef("$B$3")).toMatchObject({ r1: 2, c1: 1, ar1: true });
    expect(parseRef("A1:C5")).toMatchObject({
      kind: "range",
      r1: 0,
      c1: 0,
      r2: 4,
      c2: 2,
    });
    expect(parseRef("B:D")).toMatchObject({ kind: "cols", c1: 1, c2: 3 });
    expect(parseRef("$2:5")).toMatchObject({
      kind: "rows",
      r1: 1,
      r2: 4,
      ar1: true,
      ar2: false,
    });
    expect(parseRef("'My Sheet'!A1")).toMatchObject({
      sheet: "My Sheet",
      prefix: "'My Sheet'!",
    });
    expect(parseRef("'Bob''s'!A1").sheet).toBe("Bob's");
    expect(parseRef("A0")).toBeNull();
    expect(parseRef("A1:B2:C3")).toBeNull();
  });

  test("reversed ranges are normalised like Excel", () => {
    expect(formatRef(parseRef("B2:A1"))).toBe("A1:B2");
    expect(formatRef(parseRef("B$2:$A1"))).toBe("$A1:B$2");
    expect(formatRef(parseRef("C:A"))).toBe("A:C");
    expect(formatRef(parseRef("5:2"))).toBe("2:5");
  });

  test("column letters", () => {
    expect(indexToColumn(0)).toBe("A");
    expect(indexToColumn(25)).toBe("Z");
    expect(indexToColumn(26)).toBe("AA");
    expect(indexToColumn(16383)).toBe("XFD");
    expect(columnToIndex("XFD")).toBe(16383);
    expect(columnToIndex("aa")).toBe(26);
  });

  test("sheet prefixes are quoted when needed", () => {
    expect(sheetPrefix("Sheet1")).toBe("Sheet1!");
    expect(sheetPrefix("My Sheet")).toBe("'My Sheet'!");
    expect(sheetPrefix("Bob's")).toBe("'Bob''s'!");
    expect(sheetPrefix("A1")).toBe("'A1'!");
    expect(sheetPrefix("R1C1")).toBe("'R1C1'!");
    expect(sheetPrefix("2020")).toBe("'2020'!");
    expect(sheetPrefix("Données")).toBe("Données!");
  });
});

describe("scanning", () => {
  test("strings, structured references and names are not references", () => {
    const refs = getFormulaReferences(
      '=SUM(A1,"B2",Table1[C3],Table1[[#This Row],[D4]],[@E5],F6#)+LOG10(G7)+name1'
    ).map(formatRef);
    expect(refs).toEqual(["A1", "F6", "G7"]);
  });

  test("functions named like cells are not references", () => {
    expect(
      getFormulaReferences("=LOG10(A1)+ATAN2(1,2)").map(formatRef)
    ).toEqual(["A1"]);
  });
});

describe("offsetFormula (copy/paste, fill)", () => {
  test("relative parts shift, absolute parts are kept", () => {
    expect(offsetFormula("=A1+$A$1+A$1+$A1", 2, 3)).toBe("=D3+$A$1+D$1+$A3");
  });

  test("ranges, whole columns and whole rows", () => {
    expect(offsetFormula("=SUM(A1:B2)", 1, 1)).toBe("=SUM(B2:C3)");
    expect(offsetFormula("=SUM(A:A)", 5, 1)).toBe("=SUM(B:B)");
    expect(offsetFormula("=SUM($A:A)", 5, 1)).toBe("=SUM($A:B)");
    expect(offsetFormula("=SUM(1:1)", 2, 7)).toBe("=SUM(3:3)");
  });

  test("mixed-anchor ranges are re-normalised when the ends cross", () => {
    expect(offsetFormula("=SUM(A1:$B$2)", 2, 1)).toBe("=SUM($B$2:B3)");
  });

  test("sheet prefixes are kept", () => {
    expect(offsetFormula("='My Sheet'!A1+Sheet1!$B2", 1, 0)).toBe(
      "='My Sheet'!A2+Sheet1!$B3"
    );
  });

  test("references pushed off the grid become #REF!", () => {
    expect(offsetFormula("=A1+B2", -1, 0)).toBe("=#REF!+B1");
    expect(offsetFormula("=SUM(A1:A3)", 0, -1)).toBe("=SUM(#REF!)");
    expect(offsetFormula("=XFD1", 0, 1)).toBe("=#REF!");
  });

  test("strings and structured references are untouched", () => {
    expect(offsetFormula('="A1"&T[A1]&A1', 1, 0)).toBe('="A1"&T[A1]&A2');
  });

  test("zero offset returns the same string", () => {
    const f = "=A1";
    expect(offsetFormula(f, 0, 0)).toBe(f);
  });
});

describe("transposeFormula (Paste Special > Transpose)", () => {
  test("relative references are transposed around the formula cell", () => {
    // C1 =A1+B1 pasted transposed at E3: the cells two and one columns to
    // the left become two and one rows above
    expect(transposeFormula("=A1+B1", 0, 2, 2, 4)).toBe("=E1+E2");
    expect(transposeFormula("=SUM(A1:B1)", 0, 2, 2, 4)).toBe("=SUM(E1:E2)");
  });

  test("absolute and mixed references are shifted like a plain paste", () => {
    expect(transposeFormula("=$A$1+$A1", 0, 2, 2, 4)).toBe("=$A$1+$A3");
  });

  test("transposing off the grid gives #REF!", () => {
    expect(transposeFormula("=A1", 0, 3, 0, 0)).toBe("=#REF!");
  });
});

describe("insert rows/columns", () => {
  test("references at or below the insertion point move down", () => {
    expect(rw("=A1+A3+A5", ins("row", 2, 2))).toBe("=A1+A5+A7");
  });

  test("absolute references move too", () => {
    expect(rw("=$A$3+A$3", ins("row", 2, 1))).toBe("=$A$4+A$4");
  });

  test("ranges grow when rows are inserted inside them", () => {
    expect(rw("=SUM(A1:A5)", ins("row", 2, 3))).toBe("=SUM(A1:A8)");
  });

  test("inserting just below a range does not grow it", () => {
    expect(rw("=SUM(A1:A5)", ins("row", 5, 3))).toBe("=SUM(A1:A5)");
  });

  test("inserting at the first row of a range moves it", () => {
    expect(rw("=SUM(A3:A5)", ins("row", 2, 1))).toBe("=SUM(A4:A6)");
  });

  test("whole-column references are unchanged by row inserts", () => {
    expect(rw("=SUM(A:A)+SUM(B:C)", ins("row", 0, 5))).toBe(
      "=SUM(A:A)+SUM(B:C)"
    );
  });

  test("whole-row references shift with row inserts", () => {
    expect(rw("=SUM(3:4)", ins("row", 0, 1))).toBe("=SUM(4:5)");
    expect(rw("=SUM(3:4)", ins("row", 3, 1))).toBe("=SUM(3:5)");
  });

  test("column inserts", () => {
    expect(rw("=A1+C1+SUM(B1:D1)+C:C+1:1", ins("column", 2, 2))).toBe(
      "=A1+E1+SUM(B1:F1)+E:E+1:1"
    );
  });

  test("only references to the changed sheet move", () => {
    expect(rw("=A5+Sheet1!A5+'My Sheet'!A5", ins("row", 0, 1), "s2")).toBe(
      "=A5+Sheet1!A6+'My Sheet'!A5"
    );
    expect(rw("=A5+'My Sheet'!A5", ins("row", 0, 1, "s2"), "s1")).toBe(
      "=A5+'My Sheet'!A6"
    );
  });

  test("sheet names are case-insensitive, prefix text is preserved", () => {
    expect(rw("=sheet1!A5", ins("row", 0, 1), "s2")).toBe("=sheet1!A6");
  });

  test("quoted names with apostrophes", () => {
    expect(rw("='Bob''s'!B2", ins("column", 0, 1, "s3"), "s1")).toBe(
      "='Bob''s'!C2"
    );
  });

  test("strings containing reference-like text are untouched", () => {
    expect(rw('=A5&"A5"&"Sheet1!A5"', ins("row", 0, 1))).toBe(
      '=A6&"A5"&"Sheet1!A5"'
    );
  });

  test("structured references are untouched", () => {
    expect(rw("=SUM(Table1[A5])+A5", ins("row", 0, 1))).toBe(
      "=SUM(Table1[A5])+A6"
    );
  });

  test("unknown sheets and external references are left alone", () => {
    expect(rw("=Nope!A5+[1]Sheet9!A5", ins("row", 0, 1))).toBe(
      "=Nope!A5+[1]Sheet9!A5"
    );
  });

  test("spill references keep their #", () => {
    expect(rw("=SUM(A5#)", ins("row", 0, 1))).toBe("=SUM(A6#)");
  });
});

describe("delete rows/columns", () => {
  test("references below the deleted rows move up", () => {
    expect(rw("=A1+A10", del("row", 2, 4))).toBe("=A1+A7");
  });

  test("references to deleted cells become #REF!", () => {
    expect(rw("=A3+1", del("row", 2, 4))).toBe("=#REF!+1");
    expect(rw("=Sheet1!$A$3", del("row", 2, 2), "s2")).toBe("=#REF!");
  });

  test("ranges spanning the deleted rows shrink", () => {
    expect(rw("=SUM(A1:A10)", del("row", 2, 4))).toBe("=SUM(A1:A7)");
  });

  test("ranges starting inside the deleted rows are clipped", () => {
    expect(rw("=SUM(A4:A10)", del("row", 2, 4))).toBe("=SUM(A3:A7)");
  });

  test("ranges ending inside the deleted rows are clipped", () => {
    expect(rw("=SUM(A1:A4)", del("row", 2, 4))).toBe("=SUM(A1:A2)");
  });

  test("ranges entirely inside the deleted rows become #REF!", () => {
    expect(rw("=SUM(A3:B5)", del("row", 2, 4))).toBe("=SUM(#REF!)");
  });

  test("whole-column references are unchanged by row deletes", () => {
    expect(rw("=SUM(A:A)", del("row", 0, 5))).toBe("=SUM(A:A)");
  });

  test("whole-column references shrink or break on column deletes", () => {
    expect(rw("=SUM(A:D)", del("column", 1, 2))).toBe("=SUM(A:B)");
    expect(rw("=SUM(B:C)", del("column", 1, 2))).toBe("=SUM(#REF!)");
  });

  test("whole-row references on row deletes", () => {
    expect(rw("=SUM(2:6)", del("row", 0, 1))).toBe("=SUM(1:4)");
    expect(rw("=SUM(1:2)", del("row", 0, 1))).toBe("=SUM(#REF!)");
  });

  test("$ flags survive", () => {
    expect(rw("=SUM($A$1:$A$10)+$B$10", del("row", 0, 0))).toBe(
      "=SUM($A$1:$A$9)+$B$9"
    );
  });

  test("column deletes", () => {
    expect(rw("=C1+SUM(A1:E1)+B1", del("column", 1, 1))).toBe(
      "=B1+SUM(A1:D1)+#REF!"
    );
  });
});

describe("insert/delete cells with shift", () => {
  const range = { row: [2, 3], column: [1, 2] }; // B3:C4
  test("shift down moves references inside the column band", () => {
    const change = { type: "insertCells", sheetId: "s1", range, shift: "down" };
    expect(rw("=B3+C10+A3+D3+SUM(B1:C5)+SUM(A1:C5)", change)).toBe(
      "=B5+C12+A3+D3+SUM(B1:C7)+SUM(A1:C5)"
    );
  });

  test("shift right moves references inside the row band", () => {
    const change = {
      type: "insertCells",
      sheetId: "s1",
      range,
      shift: "right",
    };
    expect(rw("=B3+E4+B2+B5", change)).toBe("=D3+G4+B2+B5");
  });

  test("delete shift up: deleted cells become #REF!, below moves up", () => {
    const change = { type: "deleteCells", sheetId: "s1", range, shift: "up" };
    expect(rw("=B3+B6+A6+SUM(B1:B10)+SUM(B3:C4)", change)).toBe(
      "=#REF!+B4+A6+SUM(B1:B8)+SUM(#REF!)"
    );
  });

  test("delete shift left", () => {
    const change = { type: "deleteCells", sheetId: "s1", range, shift: "left" };
    expect(rw("=E3+E5+C4", change)).toBe("=C3+E5+#REF!");
  });
});

describe("move (cut/paste, drag)", () => {
  const move = (range, toRow, toColumn, toSheetId = "s1", sheetId = "s1") => ({
    type: "move",
    sheetId,
    range,
    toSheetId,
    toRow,
    toColumn,
  });
  const A1B2 = { row: [0, 1], column: [0, 1] };

  test("references inside the moved block follow it", () => {
    expect(rw("=A1+B2+SUM(A1:B2)", move(A1B2, 4, 2))).toBe("=C5+D6+SUM(C5:D6)");
  });

  test("absolute references follow too", () => {
    expect(rw("=$A$1+$B2", move(A1B2, 4, 2))).toBe("=$C$5+$D6");
  });

  test("ranges only partly inside the block are unchanged", () => {
    expect(rw("=SUM(A1:A5)", move(A1B2, 4, 2))).toBe("=SUM(A1:A5)");
  });

  test("references to the overwritten destination become #REF!", () => {
    expect(rw("=C5+E7", move(A1B2, 4, 2))).toBe("=#REF!+E7");
  });

  test("references from other sheets follow, with a new prefix", () => {
    expect(rw("=Sheet1!A1*2", move(A1B2, 0, 0, "s2"), "s4")).toBe(
      "='My Sheet'!A1*2"
    );
  });

  test("moved formulas keep references outside the block, qualified", () => {
    // formula at A1 on Sheet1 moved to 'My Sheet'
    expect(rw("=B2+C3", move(A1B2, 0, 0, "s2"), "s1", "s2")).toBe(
      "=B2+Sheet1!C3"
    );
  });

  test("moving onto the sheet a formula already lives on drops no prefix", () => {
    expect(rw("=Sheet1!A1", move(A1B2, 5, 5, "s2"), "s2")).toBe(
      "='My Sheet'!F6"
    );
    expect(rw("=A1", move(A1B2, 5, 5, "s2"), "s1")).toBe("='My Sheet'!F6");
  });
});

describe("sheet rename/delete", () => {
  test("rename rewrites qualified references only", () => {
    const change = {
      type: "renameSheet",
      sheetId: "s1",
      oldName: "Sheet1",
      newName: "Q 1",
    };
    expect(rw('=Sheet1!A1+A1+"Sheet1!A1"+SHEET1!B2', change, "s2")).toBe(
      "='Q 1'!A1+A1+\"Sheet1!A1\"+'Q 1'!B2"
    );
  });

  test("rename works when the sheet object already has the new name", () => {
    const change = {
      type: "renameSheet",
      sheetId: "s1",
      oldName: "Sheet1",
      newName: "Sales",
    };
    const renamed = createSheetLookup(
      [{ id: "s1", name: "Sales" }, ...sheets.slice(1)],
      change
    );
    expect(rewriteFormula("=Sheet1!A1", change, "s2", renamed)).toBe(
      "=Sales!A1"
    );
  });

  test("deleting a sheet breaks references to it", () => {
    const change = { type: "deleteSheet", sheetId: "s2", name: "My Sheet" };
    expect(rw("='My Sheet'!A1+A1+SUM('My Sheet'!A:A)", change, "s1")).toBe(
      "=#REF!+A1+SUM(#REF!)"
    );
  });
});

describe("adjustRangeForChange", () => {
  test("ranges follow inserts and deletes", () => {
    const r = { row: [2, 5], column: [0, 1] };
    expect(adjustRangeForChange(r, ins("row", 0, 2), "s1")).toEqual({
      row: [4, 7],
      column: [0, 1],
    });
    expect(adjustRangeForChange(r, del("row", 2, 5), "s1")).toBeNull();
    expect(adjustRangeForChange(r, del("row", 2, 5), "s2")).toEqual(r);
  });
});
