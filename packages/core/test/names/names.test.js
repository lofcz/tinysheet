import { makeContext, input, value, values } from "../formula/helpers";
import {
  createNamesFromSelection,
  defineNameForSelection,
  deleteDefinedName,
  goToNameRange,
  resolveNameBoxInput,
  evaluateDefinedName,
  expandFormulaNames,
  findDefinedName,
  getDefinedNames,
  getNameCandidates,
  looksLikeCellReference,
  nameOfRange,
  normalizeRefersTo,
  parseRangeText,
  resolveNameRange,
  sanitizeName,
  saveDefinedName,
  validateDefinedName,
} from "../../src/modules/names";
import { deleteSheet } from "../../src/modules/sheet";
import { createTable } from "../../src/modules/tables";
import {
  applyFunctionCandidate,
  getExtraFormulaCandidates,
  insertFunctionName,
  refreshFormulaEditorState,
} from "../../src/modules/formulaEditor";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";

function fill(ctx, entries, sheetId = "id_1") {
  Object.entries(entries).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

function define(ctx, name, refersTo, scope = null) {
  const err = saveDefinedName(ctx, { name, refersTo, scope });
  if (err) throw new Error(`${name}: ${err}`);
}

describe("name validation (Excel rules)", () => {
  test("valid and invalid names", () => {
    const ctx = makeContext();
    expect(validateDefinedName(ctx, "Sales")).toBeNull();
    expect(validateDefinedName(ctx, "_tax.rate")).toBeNull();
    expect(validateDefinedName(ctx, "\\back")).toBeNull();
    expect(validateDefinedName(ctx, "Q1_Sales")).toBeNull();
    expect(validateDefinedName(ctx, "")).toBe("empty");
    expect(validateDefinedName(ctx, "1abc")).toBe("invalidChars");
    expect(validateDefinedName(ctx, "my name")).toBe("invalidChars");
    expect(validateDefinedName(ctx, "a-b")).toBe("invalidChars");
    expect(validateDefinedName(ctx, "A1")).toBe("cellReference");
    expect(validateDefinedName(ctx, "xfd1048576")).toBe("cellReference");
    expect(validateDefinedName(ctx, "R1C1")).toBe("cellReference");
    expect(validateDefinedName(ctx, "r")).toBe("cellReference");
    expect(validateDefinedName(ctx, "C")).toBe("cellReference");
    expect(validateDefinedName(ctx, "TRUE")).toBe("reserved");
    expect(validateDefinedName(ctx, "x".repeat(256))).toBe("tooLong");
    // beyond column XFD: not a cell, a valid name
    expect(validateDefinedName(ctx, "XFE1")).toBeNull();
    expect(looksLikeCellReference("TAX2023")).toBe(true);
  });

  test("duplicates are case-insensitive and per scope", () => {
    const ctx = makeContext();
    define(ctx, "Rate", "=0.2");
    expect(validateDefinedName(ctx, "RATE")).toBe("duplicate");
    expect(validateDefinedName(ctx, "rate", "id_1")).toBeNull();
    // the entry being edited does not clash with itself
    expect(
      validateDefinedName(ctx, "RATE", null, { name: "Rate", scope: null })
    ).toBeNull();
  });

  test("sanitizeName turns labels into names", () => {
    expect(sanitizeName("Sales Amount")).toBe("Sales_Amount");
    expect(sanitizeName("2023")).toBe("_2023");
    expect(sanitizeName("A1")).toBe("_A1");
    expect(sanitizeName("a-b")).toBe("a_b");
  });
});

describe("normalising definitions", () => {
  test("references are made absolute and qualified", () => {
    const ctx = makeContext();
    expect(normalizeRefersTo(ctx, "=A1:B2", "id_1")).toBe("=Sheet1!$A$1:$B$2");
    expect(normalizeRefersTo(ctx, "=b3*2", "id_2")).toBe("='My Sheet'!$B$3*2");
    expect(normalizeRefersTo(ctx, "='My Sheet'!A1", "id_1")).toBe(
      "='My Sheet'!A1"
    );
    expect(normalizeRefersTo(ctx, "=SUM(C:C)", "id_1")).toBe(
      "=SUM(Sheet1!$C:$C)"
    );
    expect(normalizeRefersTo(ctx, "12", "id_1")).toBe("=12");
    expect(normalizeRefersTo(ctx, "hello", "id_1")).toBe('="hello"');
    expect(normalizeRefersTo(ctx, '="A1"', "id_1")).toBe('="A1"');
  });
});

describe("names in formulas", () => {
  test("range, constant and formula names", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3", B1: "10" });
    define(ctx, "Data", "=Sheet1!$A$1:$A$3");
    define(ctx, "Rate", "=0.5");
    define(ctx, "Twice", "=Sheet1!$B$1*2");
    input(ctx, "C1", "=SUM(Data)");
    input(ctx, "C2", "=Rate*B1");
    input(ctx, "C3", "=Twice+1");
    input(ctx, "C4", "=ROWS(Data)");
    input(ctx, "C5", "=INDEX(Data,2)");
    input(ctx, "C6", "=data*2");
    expect(values(ctx, "C1", "C5")).toEqual([[6], [5], [21], [3], [2]]);
    // a range name in a scalar context: implicit intersection / array
    expect(value(ctx, "C6")).not.toBe("#NAME?");
  });

  test("unknown names are #NAME?, strings are untouched", () => {
    const ctx = makeContext();
    define(ctx, "Rate", "=0.5");
    input(ctx, "A1", "=Nope+1");
    input(ctx, "A2", '="Rate"&Rate');
    expect(value(ctx, "A1")).toBe("#NAME?");
    expect(value(ctx, "A2")).toBe("Rate0.5");
  });

  test("names are recalculated when their target cells change", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2" });
    define(ctx, "Data", "=Sheet1!$A$1:$A$2");
    input(ctx, "B1", "=SUM(Data)");
    expect(value(ctx, "B1")).toBe(3);
    input(ctx, "A2", "5");
    expect(value(ctx, "B1")).toBe(6);
  });

  test("names on other sheets and formulas on other sheets", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "4" }, "id_2");
    define(ctx, "Other", "='My Sheet'!$A$1");
    input(ctx, "A1", "=Other*10");
    expect(value(ctx, "A1")).toBe(40);
    input(ctx, "A1", "7", "id_2");
    expect(value(ctx, "A1")).toBe(70);
    // a formula on the other sheet reading a name that points to Sheet1
    input(ctx, "C3", "100");
    define(ctx, "Base", "=Sheet1!$C$3");
    input(ctx, "B2", "=Base+1", "id_2");
    expect(value(ctx, "B2", "id_2")).toBe(101);
    input(ctx, "C3", "200");
    expect(value(ctx, "B2", "id_2")).toBe(201);
  });

  test("changing or deleting a definition recalculates formulas", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3" });
    define(ctx, "Data", "=Sheet1!$A$1:$A$2");
    input(ctx, "B1", "=SUM(Data)");
    expect(value(ctx, "B1")).toBe(3);
    saveDefinedName(
      ctx,
      { name: "Data", refersTo: "=Sheet1!$A$1:$A$3" },
      { name: "Data", scope: null }
    );
    expect(value(ctx, "B1")).toBe(6);
    // and the new target is tracked
    input(ctx, "A3", "10");
    expect(value(ctx, "B1")).toBe(13);
    deleteDefinedName(ctx, "Data");
    expect(value(ctx, "B1")).toBe("#NAME?");
  });

  test("defining a name fixes #NAME? formulas", () => {
    const ctx = makeContext();
    input(ctx, "A1", "=Later*2");
    expect(value(ctx, "A1")).toBe("#NAME?");
    define(ctx, "Later", "=21");
    expect(value(ctx, "A1")).toBe(42);
  });

  test("sheet-scoped names win over workbook names on their sheet", () => {
    const ctx = makeContext();
    define(ctx, "Val", "=1");
    define(ctx, "Val", "=2", "id_2");
    input(ctx, "A1", "=Val");
    input(ctx, "A1", "=Val", "id_2");
    input(ctx, "A2", "='My Sheet'!Val");
    input(ctx, "A3", "=Sheet1!Val");
    expect(value(ctx, "A1")).toBe(1);
    expect(value(ctx, "A1", "id_2")).toBe(2);
    expect(value(ctx, "A2")).toBe(2);
    expect(value(ctx, "A3")).toBe(1);
    expect(findDefinedName(ctx, "val", "id_2").refersTo).toBe("=2");
  });

  test("names can use other names; cycles are #NAME?", () => {
    const ctx = makeContext();
    define(ctx, "Net", "=100");
    define(ctx, "Gross", "=Net*1.2");
    define(ctx, "Loop1", "=Loop2+1");
    define(ctx, "Loop2", "=Loop1+1");
    input(ctx, "A1", "=Gross");
    input(ctx, "A2", "=Loop1");
    expect(value(ctx, "A1")).toBe(120);
    expect(value(ctx, "A2")).toBe("#NAME?");
  });

  test("LAMBDA names are callable", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "4" });
    define(ctx, "Double", "=LAMBDA(x, x*2)");
    define(ctx, "Hyp", "=LAMBDA(a,b,SQRT(a^2+b^2))");
    input(ctx, "B1", "=Double(A1)");
    input(ctx, "B2", "=Hyp(3,4)");
    input(ctx, "B3", "=double(double(1))");
    input(ctx, "B4", "=MAP({1,2},Double)");
    expect(values(ctx, "B1", "B3")).toEqual([[8], [5], [4]]);
    expect(value(ctx, "B4")).toBe(2);
    input(ctx, "A1", "5");
    expect(value(ctx, "B1")).toBe(10);
  });

  test("LET variables and LAMBDA parameters shadow names", () => {
    const ctx = makeContext();
    define(ctx, "x", "=100");
    input(ctx, "A1", "=LET(x, 1, x+1)");
    input(ctx, "A2", "=LAMBDA(x, x*3)(2)");
    input(ctx, "A3", "=x");
    expect(values(ctx, "A1", "A3")).toEqual([[2], [6], [100]]);
  });

  test("dynamic named ranges with OFFSET follow their data", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "2", A3: "3" });
    define(ctx, "Dyn", "=OFFSET(Sheet1!$A$1,0,0,COUNT(Sheet1!$A:$A),1)");
    input(ctx, "B1", "=SUM(Dyn)");
    expect(value(ctx, "B1")).toBe(6);
    input(ctx, "A4", "4");
    expect(value(ctx, "B1")).toBe(10);
  });

  test("the expansion keeps references for reference functions", () => {
    const ctx = makeContext();
    define(ctx, "Data", "=Sheet1!$B$2:$B$5");
    expect(expandFormulaNames(ctx, "ROW(Data)+Data", "id_1")).toBe(
      "ROW(Sheet1!$B$2:$B$5)+Sheet1!$B$2:$B$5"
    );
    input(ctx, "A1", "=MIN(ROW(Data))");
    input(ctx, "A2", "=COLUMN(Data)");
    input(ctx, "A3", "=ISREF(Data)");
    expect(values(ctx, "A1", "A3")).toEqual([[2], [2], [true]]);
    // a cell reference that looks like a prefix of a name is left alone
    expect(expandFormulaNames(ctx, "$B$2+Data2", "id_1")).toBe("$B$2+Data2");
  });
});

describe("name ranges and the name box", () => {
  test("parseRangeText", () => {
    const ctx = makeContext();
    expect(parseRangeText(ctx, "B2:D9", "id_1")).toEqual({
      sheetId: "id_1",
      row: [1, 8],
      column: [1, 3],
    });
    expect(parseRangeText(ctx, "'My Sheet'!c3", "id_1")).toEqual({
      sheetId: "id_2",
      row: [2, 2],
      column: [2, 2],
    });
    expect(parseRangeText(ctx, "C:C", "id_1")).toEqual({
      sheetId: "id_1",
      row: [0, 11],
      column: [2, 2],
    });
    expect(parseRangeText(ctx, "2:3", "id_1").row).toEqual([1, 2]);
    expect(parseRangeText(ctx, "Nope!A1", "id_1")).toBeNull();
    expect(parseRangeText(ctx, "Sales", "id_1")).toBeNull();
  });

  test("resolveNameRange and nameOfRange", () => {
    const ctx = makeContext();
    define(ctx, "Block", "=Sheet1!$B$2:$C$4");
    define(ctx, "Const", "=5");
    expect(resolveNameRange(ctx, "block", "id_1")).toEqual({
      sheetId: "id_1",
      row: [1, 3],
      column: [1, 2],
    });
    expect(resolveNameRange(ctx, "Const", "id_1")).toBeNull();
    expect(
      nameOfRange(ctx, { sheetId: "id_1", row: [1, 3], column: [1, 2] })
    ).toBe("Block");
    expect(
      nameOfRange(ctx, { sheetId: "id_1", row: [1, 3], column: [1, 1] })
    ).toBeNull();
  });
});

describe("create from selection", () => {
  test("top row and left column", () => {
    const ctx = makeContext();
    fill(ctx, {
      B1: "Jan",
      C1: "Feb",
      A2: "North",
      A3: "South",
      B2: "1",
      C2: "2",
      B3: "3",
      C3: "4",
    });
    const created = createNamesFromSelection(
      ctx,
      { sheetId: "id_1", row: [0, 2], column: [0, 2] },
      { top: true, left: true }
    );
    expect(created.sort()).toEqual(["Feb", "Jan", "North", "South"]);
    expect(findDefinedName(ctx, "Jan").refersTo).toBe("=Sheet1!$B$2:$B$3");
    expect(findDefinedName(ctx, "South").refersTo).toBe("=Sheet1!$B$3:$C$3");
    input(ctx, "E1", "=SUM(Feb)");
    input(ctx, "E2", "=Jan South");
    expect(value(ctx, "E1")).toBe(6);
    expect(value(ctx, "E2")).toBe(3);
  });
});

describe("storage and structure changes", () => {
  test("names live in the sheet JSON", () => {
    const ctx = makeContext();
    define(ctx, "Rate", "=0.2");
    define(ctx, "Local", "=1", "id_2");
    expect(ctx.luckysheetfile[0].definedNames).toEqual([
      { name: "Rate", refersTo: "=0.2" },
    ]);
    expect(ctx.luckysheetfile[1].definedNames).toEqual([
      { name: "Local", refersTo: "=1", local: true },
    ]);
    expect(getDefinedNames(ctx).map((d) => [d.name, d.scope])).toEqual([
      ["Rate", null],
      ["Local", "id_2"],
    ]);
  });

  test("a loaded workbook with names evaluates them", () => {
    const ctx = makeContext();
    ctx.luckysheetfile[1].definedNames = [{ name: "Seven", refersTo: "=7" }];
    input(ctx, "A1", "=Seven*2");
    expect(value(ctx, "A1")).toBe(14);
  });

  test("workbook names survive deleting the sheet storing them", () => {
    const ctx = makeContext();
    define(ctx, "Rate", "=0.2");
    deleteSheet(ctx, "id_1");
    expect(ctx.luckysheetfile[0].definedNames).toEqual([
      { name: "Rate", refersTo: "=0.2" },
    ]);
  });

  test("inserting and deleting rows shifts name references", () => {
    const ctx = makeContext();
    define(ctx, "Data", "=Sheet1!$A$2:$A$4");
    define(ctx, "Cell", "=Sheet1!$B$6");
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(findDefinedName(ctx, "Data").refersTo).toBe("=Sheet1!$A$4:$A$6");
    insertRowCol(ctx, {
      type: "row",
      index: 4,
      count: 1,
      direction: "rightbottom",
      id: "id_1",
    });
    // inserted inside the range: it grows
    expect(findDefinedName(ctx, "Data").refersTo).toBe("=Sheet1!$A$4:$A$7");
    deleteRowCol(ctx, { type: "row", start: 8, end: 8, id: "id_1" });
    expect(findDefinedName(ctx, "Cell").refersTo).toBe("=#REF!");
    deleteRowCol(ctx, { type: "column", start: 0, end: 0, id: "id_1" });
    expect(findDefinedName(ctx, "Data").refersTo).toBe("=#REF!");
  });
});

describe("display helpers", () => {
  test("evaluateDefinedName and candidates", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "1", A2: "x" });
    define(ctx, "Data", "=Sheet1!$A$1:$A$2");
    define(ctx, "Rate", "=0.25");
    define(ctx, "Fn", "=LAMBDA(x,x)");
    define(ctx, "Hidden", "=1", "id_2");
    const entry = (n) => getDefinedNames(ctx).find((d) => d.name === n);
    expect(evaluateDefinedName(ctx, entry("Data"))).toBe('{1;"x"}');
    expect(evaluateDefinedName(ctx, entry("Rate"))).toBe("0.25");
    expect(evaluateDefinedName(ctx, entry("Fn"))).toBe("LAMBDA");
    const cands = getNameCandidates(ctx);
    expect(cands.map((c) => [c.n, c.kind])).toEqual([
      ["Data", "name"],
      ["Rate", "name"],
      ["Fn", "lambda"],
    ]);
  });
});

describe("formula autocomplete", () => {
  test("names, LAMBDA names and tables are offered and inserted", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "h", A2: "1" });
    define(ctx, "Sales", "=Sheet1!$A$2");
    define(ctx, "SalesTax", "=LAMBDA(x,x*0.2)");
    createTable(ctx, "id_1", { row: [0, 1], column: [0, 0] });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const setText = (text) => {
      el.textContent = text;
      const range = document.createRange();
      range.setStart(el.firstChild, text.length);
      range.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    };
    setText("=SUM(Sal");
    refreshFormulaEditorState(ctx, el);
    const names = ctx.functionCandidates.map((c) => c.n);
    expect(names.slice(0, 2)).toEqual(["Sales", "SalesTax"]);
    applyFunctionCandidate(el, "Sales");
    expect(el.textContent).toBe("=SUM(Sales");
    // a fully typed name is not offered again (Enter commits the formula)
    setText("=SUM(Sales");
    refreshFormulaEditorState(ctx, el);
    expect(ctx.functionCandidates.map((c) => c.n)).toEqual(["SalesTax"]);
    setText("=Sal");
    applyFunctionCandidate(el, "SalesTax");
    expect(el.textContent).toBe("=SalesTax(");
    expect(getExtraFormulaCandidates(ctx).map((c) => c.t)).toEqual([
      "name",
      "lambda",
      "table",
    ]);
    expect(insertFunctionName("=Tab", 4, "Table1", "[")).toEqual({
      text: "=Table1[",
      caret: 8,
    });
  });
});

describe("name box", () => {
  test("interprets references, names, tables and new names", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "h", A2: "1" });
    define(ctx, "Block", "=Sheet1!$B$2:$C$4");
    define(ctx, "Const", "=5");
    createTable(ctx, "id_1", { row: [0, 1], column: [0, 0] });
    const go = (text) => resolveNameBoxInput(ctx, text);
    expect(go("b2")).toEqual({
      kind: "goto",
      range: { sheetId: "id_1", row: [1, 1], column: [1, 1] },
    });
    expect(go("'My Sheet'!C3:D4").range).toEqual({
      sheetId: "id_2",
      row: [2, 3],
      column: [2, 3],
    });
    expect(go("C:C").range.column).toEqual([2, 2]);
    expect(go("block").range.row).toEqual([1, 3]);
    expect(go("Table1").range).toEqual({
      sheetId: "id_1",
      row: [0, 1],
      column: [0, 0],
    });
    expect(go("NewName")).toEqual({ kind: "define", name: "NewName" });
    // a name that is not a range cannot be selected
    expect(go("Const").kind).toBe("error");
    expect(go("1abc").kind).toBe("error");
  });

  test("goToNameRange selects, switching sheets", () => {
    const ctx = makeContext();
    ctx.sheetScrollRecord = {};
    goToNameRange(ctx, { sheetId: "id_2", row: [2, 3], column: [1, 2] });
    expect(ctx.currentSheetId).toBe("id_2");
    expect(ctx.luckysheet_select_save[0]).toMatchObject({
      row: [2, 3],
      column: [1, 2],
      row_focus: 2,
      column_focus: 1,
    });
    // restored by the sheet tab when the sheet is shown
    expect(ctx.sheetScrollRecord.id_2.luckysheet_select_save[0].row).toEqual([
      2, 3,
    ]);
  });

  test("defineNameForSelection", () => {
    const ctx = makeContext();
    ctx.luckysheet_select_save = [{ row: [1, 2], column: [0, 0] }];
    expect(defineNameForSelection(ctx, "Picked")).toBeNull();
    expect(findDefinedName(ctx, "Picked").refersTo).toBe("=Sheet1!$A$2:$A$3");
  });
});
