import { makeContext, input, value, values, cell } from "./helpers";
import {
  parseReference,
  rewriteReferenceArgs,
  decodeRef,
} from "../../src/modules/formulaFunctions";

function fill(ctx, entries, sheetId = "id_1") {
  Object.entries(entries).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

describe("reference rewriting", () => {
  test("reference arguments become markers, other text is untouched", () => {
    const ctx = makeContext();
    const out = rewriteReferenceArgs(ctx, 'ROW(B5)+LEN("ROW(A1)")', "id_1");
    expect(out).toBe('ROW("\u0001TSREF:4,1,4,1,id_1")+LEN("ROW(A1)")');
    expect(rewriteReferenceArgs(ctx, "SUM(A1:A3)", "id_1")).toBe("SUM(A1:A3)");
    expect(rewriteReferenceArgs(ctx, 'ROW("A1")', "id_1")).toBe('ROW("A1")');
  });

  test("OFFSET/INDIRECT in reference positions return references", () => {
    const ctx = makeContext();
    expect(rewriteReferenceArgs(ctx, "ROWS(OFFSET(A1,0,0,3))", "id_1")).toBe(
      'ROWS(TSREF.OFFSET("\u0001TSREF:0,0,0,0,id_1",0,0,3))'
    );
    // OFFSET's own first argument is a reference; the call itself stays
    // value-returning outside reference positions.
    expect(rewriteReferenceArgs(ctx, "SUM(OFFSET(A1,0,0,3))", "id_1")).toBe(
      'SUM(OFFSET("\u0001TSREF:0,0,0,0,id_1",0,0,3))'
    );
  });

  test("parseReference handles A1, R1C1, sheets and whole rows/columns", () => {
    const ctx = makeContext();
    expect(parseReference(ctx, "$B$2:c3", "id_1")).toEqual({
      sheetId: "id_1",
      r1: 1,
      c1: 1,
      r2: 2,
      c2: 2,
    });
    expect(parseReference(ctx, "'My Sheet'!A1", "id_1").sheetId).toBe("id_2");
    expect(parseReference(ctx, "my sheet!A1", "id_1")).toBeNull();
    expect(parseReference(ctx, "sheet1!A1", "id_2").sheetId).toBe("id_1");
    expect(parseReference(ctx, "B:C", "id_1")).toMatchObject({
      r1: 0,
      r2: 11,
      c1: 1,
      c2: 2,
    });
    expect(parseReference(ctx, "2:3", "id_1")).toMatchObject({
      r1: 1,
      r2: 2,
      c1: 0,
      c2: 7,
    });
    expect(parseReference(ctx, "R2C3", "id_1", false)).toMatchObject({
      r1: 1,
      c1: 2,
    });
    expect(parseReference(ctx, "R[-1]C[2]", "id_1", false, 5, 5)).toMatchObject(
      { r1: 4, c1: 7 }
    );
    expect(parseReference(ctx, "RC", "id_1", false, 3, 4)).toMatchObject({
      r1: 3,
      c1: 4,
    });
    expect(parseReference(ctx, "A0", "id_1")).toBeNull();
    expect(parseReference(ctx, "Nope!A1", "id_1")).toBeNull();
    expect(decodeRef("plain")).toBeNull();
  });
});

describe("ROW / COLUMN / ROWS / COLUMNS", () => {
  test("no argument uses the formula cell", () => {
    const ctx = makeContext();
    input(ctx, "C4", "=ROW()");
    input(ctx, "D4", "=COLUMN()");
    expect(value(ctx, "C4")).toBe(4);
    expect(value(ctx, "D4")).toBe(4);
  });

  test("single references", () => {
    const ctx = makeContext();
    fill(ctx, {
      A1: "=ROW(C5)",
      A2: "=COLUMN(C5)",
      A3: "=ROW($D$7)+COLUMN(Sheet1!$E7)",
      A4: "=ROW('My Sheet'!B9)",
      A5: "=row(a6)",
      A6: "=ROW(B2:D4)*0+ROWS(B2:D4)*10+COLUMNS(B2:D4)",
    });
    expect(value(ctx, "A1")).toBe(5);
    expect(value(ctx, "A2")).toBe(3);
    expect(value(ctx, "A3")).toBe(12);
    expect(value(ctx, "A4")).toBe(9);
    expect(value(ctx, "A5")).toBe(6);
  });

  test("ranges return arrays", () => {
    const ctx = makeContext();
    input(ctx, "A1", "=ROW(B3:B5)");
    expect(values(ctx, "A1", "A3")).toEqual([[3], [4], [5]]);
    input(ctx, "C1", "=COLUMN(B7:D7)");
    expect(values(ctx, "C1", "E1")).toEqual([[2, 3, 4]]);
    input(ctx, "G1", "=SUM(ROW(A1:A4))");
    expect(value(ctx, "G1")).toBe(10);
  });

  test("ROWS / COLUMNS over references and nested INDIRECT/OFFSET", () => {
    const ctx = makeContext();
    fill(ctx, {
      A1: "=ROWS(A1:B3)",
      A2: "=COLUMNS(A1:B3)",
      A3: "=ROWS(C1)",
      A4: "=COLUMNS(Sheet1!A1:D1)",
      A5: "=ROWS(OFFSET(A1,0,0,5,2))",
      A6: '=COLUMNS(INDIRECT("B1:D1"))',
      A7: "=ROWS(C:C)",
    });
    expect(values(ctx, "A1", "A7")).toEqual([
      [3],
      [2],
      [1],
      [4],
      [5],
      [3],
      [12],
    ]);
  });
});

describe("ISREF / ISFORMULA / FORMULATEXT", () => {
  test("ISREF", () => {
    const ctx = makeContext();
    fill(ctx, {
      A1: "=ISREF(B1)",
      A2: '=ISREF("B1")',
      A3: "=ISREF(5)",
      A4: '=ISREF(INDIRECT("B2"))',
      A5: '=ISREF(INDIRECT("no such"))',
      A6: "=ISREF(B1:C4)",
    });
    expect(values(ctx, "A1", "A6")).toEqual([
      [true],
      [false],
      [false],
      [true],
      [false],
      [true],
    ]);
  });

  test("ISFORMULA and FORMULATEXT", () => {
    const ctx = makeContext();
    fill(ctx, { B1: "5", B2: "=B1*2", B3: "=ROW(B1:B2)" });
    fill(ctx, {
      A1: "=ISFORMULA(B1)",
      A2: "=ISFORMULA(B2)",
      A3: "=FORMULATEXT(B2)",
      A4: "=FORMULATEXT(B1)",
      A5: '=ISFORMULA("B2")',
      A6: "=FORMULATEXT(B4)",
      A7: "=ISFORMULA(B4)",
      A8: "=FORMULATEXT(C9)",
    });
    expect(value(ctx, "A1")).toBe(false);
    expect(value(ctx, "A2")).toBe(true);
    expect(value(ctx, "A3")).toBe("=B1*2");
    expect(value(ctx, "A4")).toBe("#N/A");
    expect(value(ctx, "A5")).toBe("#VALUE!");
    // B4 is spilled from B3: it shows B3's formula.
    expect(value(ctx, "A6")).toBe("=ROW(B1:B2)");
    expect(value(ctx, "A7")).toBe(true);
    expect(value(ctx, "A8")).toBe("#N/A");
  });

  test("ISFORMULA follows edits of the referenced cell", () => {
    const ctx = makeContext();
    input(ctx, "A1", "=ISFORMULA(B1)");
    expect(value(ctx, "A1")).toBe(false);
    input(ctx, "B1", "=1+1");
    expect(value(ctx, "A1")).toBe(true);
    input(ctx, "B1", "3");
    expect(value(ctx, "A1")).toBe(false);
  });
});

describe("INDIRECT", () => {
  test("A1 and R1C1 text, sheets and ranges", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "10", A2: "20", A3: "30", B2: "A3" });
    fill(ctx, { B2: "7" }, "id_2");
    fill(ctx, {
      C1: '=INDIRECT("A1")',
      C2: "=INDIRECT(B2)",
      C3: '=INDIRECT("A"&2)',
      C4: "=INDIRECT(\"'My Sheet'!B2\")",
      C5: '=INDIRECT("R2C1",FALSE)',
      C6: '=INDIRECT("R[-3]C[-2]",FALSE)',
      C7: '=SUM(INDIRECT("A1:A3"))',
      C8: '=INDIRECT("Nope!A1")',
      C9: '=INDIRECT("not a ref")',
      C10: '=IFERROR(INDIRECT("zz"),"bad")',
    });
    expect(values(ctx, "C1", "C10")).toEqual([
      [10],
      [30],
      [20],
      [7],
      [20],
      [30],
      [60],
      ["#REF!"],
      ["#REF!"],
      ["bad"],
    ]);
  });

  test("a range result spills", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", B1: "3", B2: "4" });
    input(ctx, "D1", '=INDIRECT("A1:B2")');
    expect(values(ctx, "D1", "E2")).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  test("recalculates when the target or the text changes", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", B1: "A1" });
    input(ctx, "C1", "=INDIRECT(B1)*10");
    expect(value(ctx, "C1")).toBe(10);
    input(ctx, "A1", "5");
    expect(value(ctx, "C1")).toBe(50);
    input(ctx, "B1", "A2");
    expect(value(ctx, "C1")).toBe(20);
    input(ctx, "A2", "3");
    expect(value(ctx, "C1")).toBe(30);
  });

  test("recalculates when a target formula changes, in order", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "=A1*2" });
    input(ctx, "B1", '=INDIRECT("A2")+1');
    expect(value(ctx, "B1")).toBe(3);
    input(ctx, "A1", "10");
    expect(value(ctx, "A2")).toBe(20);
    expect(value(ctx, "B1")).toBe(21);
  });
});

describe("OFFSET", () => {
  test("single cells, ranges and errors", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3", B1: "4", B2: "5", B3: "6" });
    fill(ctx, {
      D1: "=OFFSET(A1,1,0)",
      D2: "=OFFSET(A1,2,1)",
      D3: "=SUM(OFFSET(A1,0,0,3,1))",
      D4: "=SUM(OFFSET(A1:B1,1,0,2))",
      D5: "=OFFSET(A1,-1,0)",
      D6: "=OFFSET(A1,0,0,0,1)",
      D7: '=OFFSET("A1",0,0)',
      D8: "=SUM(OFFSET(B3,0,-1,-2,1))",
    });
    expect(values(ctx, "D1", "D8")).toEqual([
      [2],
      [6],
      [6],
      [16],
      ["#REF!"],
      ["#REF!"],
      ["#VALUE!"],
      [5],
    ]);
  });

  test("spills a range and recalculates when its target changes", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3", E1: "2" });
    input(ctx, "C1", "=OFFSET(A1,0,0,E1,1)");
    expect(values(ctx, "C1", "C3")).toEqual([[1], [2], [undefined]]);
    input(ctx, "E1", "3");
    expect(values(ctx, "C1", "C3")).toEqual([[1], [2], [3]]);
    input(ctx, "A3", "30");
    expect(value(ctx, "C3")).toBe(30);
    input(ctx, "E1", "1");
    expect(values(ctx, "C1", "C3")).toEqual([[1], [undefined], [undefined]]);
  });
});

describe("ADDRESS", () => {
  test.each([
    ["=ADDRESS(2,3)", "$C$2"],
    ["=ADDRESS(2,3,2)", "C$2"],
    ["=ADDRESS(2,3,3)", "$C2"],
    ["=ADDRESS(2,3,4)", "C2"],
    ["=ADDRESS(2,3,1,FALSE)", "R2C3"],
    ["=ADDRESS(2,3,2,FALSE)", "R2C[3]"],
    ["=ADDRESS(2,3,3,FALSE)", "R[2]C3"],
    ["=ADDRESS(2,3,4,FALSE)", "R[2]C[3]"],
    ['=ADDRESS(2,3,1,TRUE,"Sheet1")', "Sheet1!$C$2"],
    // (a leading ' in a formula result is eaten by setCellValue, so check
    // the quoted form through LEN/MID)
    ['=LEN(ADDRESS(2,3,1,TRUE,"My Sheet"))', 15],
    ['=SUBSTITUTE(ADDRESS(2,3,1,TRUE,"My Sheet"),"\'","|")', "|My Sheet|!$C$2"],
    ['=ADDRESS(1,1,4,FALSE,"S")', "S!R[1]C[1]"],
    ["=ADDRESS(1,28)", "$AB$1"],
    ["=ADDRESS(1048576,16384)", "$XFD$1048576"],
    ["=ADDRESS(0,1)", "#VALUE!"],
    ["=ADDRESS(1,1,5)", "#VALUE!"],
    ["=ADDRESS(1,16385)", "#VALUE!"],
  ])("%s", (formula, expected) => {
    const ctx = makeContext();
    input(ctx, "A1", formula);
    expect(value(ctx, "A1")).toBe(expected);
  });

  test("round-trips through INDIRECT", () => {
    const ctx = makeContext();
    input(ctx, "C3", "42");
    input(ctx, "A1", "=INDIRECT(ADDRESS(3,3))");
    expect(value(ctx, "A1")).toBe(42);
  });
});

describe("SHEET / SHEETS", () => {
  test("sheet numbers and counts", () => {
    const ctx = makeContext();
    fill(ctx, {
      A1: "=SHEET()",
      A2: "=SHEET('My Sheet'!A1)",
      A3: '=SHEET("my sheet")',
      A4: '=SHEET("Nope")',
      A5: "=SHEETS()",
      A6: "=SHEETS(A1:B2)",
    });
    expect(values(ctx, "A1", "A6")).toEqual([
      [1],
      [2],
      [2],
      ["#N/A"],
      [2],
      [1],
    ]);
    input(ctx, "A1", "=SHEET()", "id_2");
    expect(value(ctx, "A1", "id_2")).toBe(2);
  });

  test("SHEET follows sheet order, not storage order", () => {
    const ctx = makeContext();
    ctx.luckysheetfile[0].order = 1;
    ctx.luckysheetfile[1].order = 0;
    input(ctx, "A1", "=SHEET()");
    expect(value(ctx, "A1")).toBe(2);
  });
});

describe("CELL", () => {
  test("info types", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "5", A2: "text" });
    fill(ctx, {
      C1: '=CELL("address",B3)',
      C2: '=CELL("row",B3)',
      C3: '=CELL("col",B3)',
      C4: '=CELL("contents",A1)',
      C5: '=CELL("type",A1)',
      C6: '=CELL("type",A2)',
      C7: '=CELL("type",A9)',
      C8: '=CELL("filename")',
      C9: '=SUBSTITUTE(CELL("address",\'My Sheet\'!A1),"\'","|")',
      C10: '=CELL("bogus",A1)',
      C11: '=CELL("row")',
      C12: '=CELL("format",A1)',
    });
    expect(values(ctx, "C1", "C12")).toEqual([
      ["$B$3"],
      [3],
      [2],
      [5],
      ["v"],
      ["l"],
      ["b"],
      ["[Book1]Sheet1"],
      ["|My Sheet|!$A$1"],
      ["#VALUE!"],
      [11],
      ["G"],
    ]);
  });

  test("is volatile", () => {
    const ctx = makeContext();
    input(ctx, "C1", '=CELL("contents",A1)');
    input(ctx, "A1", "8");
    expect(value(ctx, "C1")).toBe(8);
  });
});

describe("HYPERLINK", () => {
  test("returns the friendly name, or the link", () => {
    const ctx = makeContext();
    input(ctx, "A1", '=HYPERLINK("https://example.com")');
    input(ctx, "A2", '=HYPERLINK("https://example.com","Example")');
    input(ctx, "A3", '=HYPERLINK("#Sheet1!A1",5)');
    expect(values(ctx, "A1", "A3")).toEqual([
      ["https://example.com"],
      ["Example"],
      [5],
    ]);
  });
});

describe("SUBTOTAL", () => {
  function setup() {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3", A4: "4", A5: "5" });
    return ctx;
  }

  test.each([
    [1, 3],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 1],
    [6, 120],
    [7, Math.sqrt(2.5)],
    [8, Math.sqrt(2)],
    [9, 15],
    [10, 2.5],
    [11, 2],
  ])("function %i over visible rows", (fn, expected) => {
    const ctx = setup();
    input(ctx, "C1", `=SUBTOTAL(${fn},A1:A5)`);
    input(ctx, "C2", `=SUBTOTAL(${fn + 100},A1:A5)`);
    expect(value(ctx, "C1")).toBeCloseTo(expected, 10);
    expect(value(ctx, "C2")).toBeCloseTo(expected, 10);
  });

  test("101-111 ignore hidden rows, 1-11 only filtered-out rows", () => {
    const ctx = setup();
    // row 2 hidden by hand, row 4 hidden by a filter
    const rowhidden = { 1: 0, 3: 0 };
    ctx.config = { rowhidden };
    ctx.luckysheetfile[0].config = { rowhidden };
    ctx.luckysheetfile[0].filter = { 0: { rowhidden: { 3: 0 } } };
    fill(ctx, {
      C1: "=SUBTOTAL(9,A1:A5)",
      C2: "=SUBTOTAL(109,A1:A5)",
      C3: "=SUBTOTAL(102,A1:A5)",
      C4: "=SUBTOTAL(9,A1:A2,A5)",
    });
    expect(values(ctx, "C1", "C4")).toEqual([[11], [9], [3], [8]]);
  });

  test("ignores nested subtotals and propagates errors", () => {
    const ctx = setup();
    input(ctx, "A6", "=SUBTOTAL(9,A1:A5)");
    input(ctx, "C1", "=SUBTOTAL(9,A1:A6)");
    expect(value(ctx, "C1")).toBe(15);
    input(ctx, "C2", "=SUBTOTAL(12,A1:A6)");
    expect(value(ctx, "C2")).toBe("#VALUE!");
    input(ctx, "B1", "=1/0");
    input(ctx, "C3", "=SUBTOTAL(9,A1:B1)");
    expect(value(ctx, "C3")).toBe("#DIV/0!");
    input(ctx, "C4", "=SUBTOTAL(1,B5:B6)");
    expect(value(ctx, "C4")).toBe("#DIV/0!");
  });

  test("recalculates when the data changes", () => {
    const ctx = setup();
    input(ctx, "C1", "=SUBTOTAL(109,A1:A5)");
    input(ctx, "A5", "50");
    expect(value(ctx, "C1")).toBe(60);
    expect(cell(ctx, "C1").f).toBe("=SUBTOTAL(109,A1:A5)");
  });
});

describe("references through the parser", () => {
  test("OFFSET and INDIRECT (A1 and R1C1) are range operands", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3", B1: "4", B2: "5", B3: "6" });
    fill(ctx, {
      D1: "=SUM(OFFSET(A1,1,0):A3)",
      D2: '=SUM(INDIRECT("R1C1",FALSE):INDIRECT("R2C2",FALSE))',
      D3: '=ROWS(INDIRECT("R1C1:R3C2",FALSE))',
      D4: '=SUM(INDIRECT("R[-3]C[-3]:R[-1]C[-3]",FALSE))',
      D5: "=INDEX(OFFSET(A1,0,0,3,2),3,2)",
      D6: '=COLUMNS(INDIRECT("A1:B1"):C1)',
      D7: '=ROW(INDIRECT("R3C1",FALSE))',
      D8: "=ISREF(OFFSET(A1,1,1))",
    });
    expect(values(ctx, "D1", "D8")).toEqual([
      [5],
      [12],
      [3],
      [6],
      [6],
      [3],
      [3],
      [true],
    ]);
  });

  test("reference functions do not read (or fail on) their argument", () => {
    const ctx = makeContext();
    fill(ctx, { B1: "=1/0", B2: "=NA()", B3: "7" });
    fill(ctx, {
      A1: "=ISFORMULA(B1)",
      A2: '=CELL("type",B1)',
      A3: "=ROW(B2)",
      A4: "=FORMULATEXT(B2)",
      A5: "=OFFSET(B1,2,0)",
      A6: "=SHEET(B2)",
    });
    expect(values(ctx, "A1", "A6")).toEqual([
      [true],
      ["v"],
      [2],
      ["=NA()"],
      [7],
      [1],
    ]);
  });

  test("OFFSET/INDIRECT range operands recalculate with their targets", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3" });
    input(ctx, "C1", '=SUM(INDIRECT("R1C1",FALSE):A3)');
    input(ctx, "C2", "=SUM(OFFSET(A1,1,0):OFFSET(A1,2,0))");
    expect(value(ctx, "C1")).toBe(6);
    expect(value(ctx, "C2")).toBe(5);
    input(ctx, "A2", "20");
    expect(value(ctx, "C1")).toBe(24);
    expect(value(ctx, "C2")).toBe(23);
  });

  test("AREAS counts the areas of unions", () => {
    const ctx = makeContext();
    fill(ctx, {
      A1: "=AREAS(B1:C3)",
      A2: "=AREAS((B1:C3,E1,F2:F4))",
      A3: '=AREAS(INDIRECT("B1:C2"))',
      A4: "=AREAS((B1,OFFSET(B1,1,1)))",
    });
    expect(values(ctx, "A1", "A4")).toEqual([[1], [3], [1], [2]]);
  });

  test("formulas rewritten with legacy markers still evaluate", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3" });
    const expr = rewriteReferenceArgs(ctx, "ROWS(OFFSET(A1,0,0,3))", "id_1");
    input(ctx, "C1", `=${expr}`);
    expect(value(ctx, "C1")).toBe(3);
  });
});
