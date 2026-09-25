import { makeContext, input } from "../formula/helpers";
import { createTable } from "../../src/modules/tables";
import { saveDefinedName } from "../../src/modules/names";
import {
  applyFunctionCandidate,
  getCallArgumentRanges,
  getCompletionItems,
  getCompletionQuery,
  getExtraFormulaCandidates,
  getCaretOffset,
  refreshFormulaEditorState,
  selectCallArgument,
  setCaretOffset,
  sheetNameForReference,
} from "../../src/modules/formulaEditor";

/** caret position marked with `|` */
const at = (s) => [s.replace("|", ""), s.indexOf("|")];

function workbook() {
  const ctx = makeContext();
  [
    ["A1", "Item"],
    ["B1", "Qty"],
    ["C1", "Unit Price"],
    ["A2", "Pen"],
    ["B2", "2"],
    ["C2", "1.5"],
  ].forEach(([a1, v]) => input(ctx, a1, v));
  const res = createTable(ctx, "id_1", { row: [0, 1], column: [0, 2] });
  expect(res.error).toBeUndefined();
  return ctx;
}

/** A contenteditable editor holding `text` with the caret at `|`. */
function editor(marked) {
  const [text, caret] = at(marked);
  const el = document.createElement("div");
  el.contentEditable = "true";
  document.body.appendChild(el);
  el.textContent = text;
  setCaretOffset(el, caret);
  return el;
}

describe("getCompletionQuery", () => {
  test.each([
    ["=Table1[|", { table: "Table1", thisRow: false, query: "" }],
    ["=SUM(Table1[Q|", { table: "Table1", thisRow: false, query: "Q" }],
    ["=Table1[@Un|", { table: "Table1", thisRow: true, query: "Un" }],
    ["=[@Q|", { table: null, thisRow: true, query: "Q" }],
    ["=Table1[#A|", { table: "Table1", thisRow: false, query: "#A" }],
  ])("%s is a table column", (marked, expected) => {
    const [text, caret] = at(marked);
    expect(getCompletionQuery(text, caret)).toEqual({
      kind: "tableColumn",
      ...expected,
      start: caret - expected.query.length,
      end: caret,
    });
  });

  test.each([
    ["='My S|", "My S", 1],
    ["=SUM('|", "", 5],
    ["=1+'It''s|", "It's", 3],
  ])("%s is a quoted sheet name", (marked, query, start) => {
    const [text, caret] = at(marked);
    expect(getCompletionQuery(text, caret)).toEqual({
      kind: "sheet",
      query,
      start,
      end: caret,
    });
  });

  test.each(["=Table1[Qty]|", '="Table1[|', "=SUM(A1|", "Table1[|", "=A1'|"])(
    "%s completes nothing special",
    (marked) => {
      const [text, caret] = at(marked);
      expect(getCompletionQuery(text, caret)).toBeNull();
    }
  );
});

describe("completion items", () => {
  test("columns and special items of a table", () => {
    const ctx = workbook();
    const items = getCompletionItems(ctx, getCompletionQuery("=Table1[", 8));
    expect(items.map((i) => i.n)).toEqual([
      "Item",
      "Qty",
      "Unit Price",
      "#All",
      "#Data",
      "#Headers",
      "@",
    ]);
    expect(items[2].insert).toBe("Unit Price]");
    expect(items.find((i) => i.n === "#All").insert).toBe("#All]");
  });

  test("[@ inside a table lists the columns of the edited cell's table", () => {
    const ctx = workbook();
    ctx.luckysheetCellUpdate = [1, 3];
    expect(getCompletionItems(ctx, getCompletionQuery("=[@", 3))).toEqual([]);
    ctx.luckysheetCellUpdate = [1, 2];
    const items = getCompletionItems(ctx, getCompletionQuery("=[@", 3));
    expect(items.map((i) => i.n)).toEqual(["Item", "Qty", "Unit Price"]);
  });

  test("quoted sheet names", () => {
    const ctx = makeContext();
    const items = getCompletionItems(ctx, getCompletionQuery("='My", 4));
    expect(items.map((i) => [i.n, i.insert])).toEqual([
      ["Sheet1", "'Sheet1'!"],
      ["My Sheet", "'My Sheet'!"],
    ]);
  });

  test("identifiers also complete defined names, tables and sheets", () => {
    const ctx = workbook();
    saveDefinedName(ctx, { name: "Rate", refersTo: "=0.2" });
    const extra = getExtraFormulaCandidates(ctx);
    expect(extra.map((c) => [c.n, c.t])).toEqual(
      expect.arrayContaining([
        ["Rate", "name"],
        ["Table1", "table"],
        ["Sheet1", "sheet"],
        ["My Sheet", "sheet"],
      ])
    );
  });

  test("sheet names are quoted when they have to be", () => {
    expect(sheetNameForReference("Sheet2")).toBe("Sheet2");
    expect(sheetNameForReference("My Sheet")).toBe("'My Sheet'");
    expect(sheetNameForReference("A1")).toBe("'A1'");
    expect(sheetNameForReference("R2C3")).toBe("'R2C3'");
    expect(sheetNameForReference("2024")).toBe("'2024'");
    expect(sheetNameForReference("It's")).toBe("'It''s'");
  });
});

describe("accepting completions in the editor", () => {
  test("a table column closes the bracket", () => {
    const ctx = workbook();
    const el = editor("=SUM(Table1[Un|");
    refreshFormulaEditorState(ctx, el);
    expect(ctx.functionCandidates.map((c) => c.n)).toEqual(["Unit Price"]);
    applyFunctionCandidate(el, "Unit Price");
    expect(el.textContent).toBe("=SUM(Table1[Unit Price]");
    expect(getCaretOffset(el)).toBe(el.textContent.length);
    el.remove();
  });

  test("an already typed ] is not repeated", () => {
    const ctx = workbook();
    const el = editor("=Table1[Q|]");
    refreshFormulaEditorState(ctx, el);
    applyFunctionCandidate(el, "Qty");
    expect(el.textContent).toBe("=Table1[Qty]");
    el.remove();
  });

  test("a quoted sheet name gets its closing quote and !", () => {
    const ctx = workbook();
    const el = editor("=SUM('My|");
    refreshFormulaEditorState(ctx, el);
    expect(ctx.functionCandidates[0]).toMatchObject({ n: "My Sheet" });
    applyFunctionCandidate(el, "My Sheet");
    expect(el.textContent).toBe("=SUM('My Sheet'!");
    el.remove();
  });

  test("a typed sheet name completes with !", () => {
    const ctx = workbook();
    const el = editor("=My|");
    refreshFormulaEditorState(ctx, el);
    expect(ctx.functionCandidates.map((c) => c.n)).toContain("My Sheet");
    applyFunctionCandidate(el, "My Sheet");
    expect(el.textContent).toBe("='My Sheet'!");
    el.remove();
  });

  test("a table name completes with [", () => {
    const ctx = workbook();
    const el = editor("=SUM(Tab|");
    refreshFormulaEditorState(ctx, el);
    applyFunctionCandidate(el, "Table1");
    expect(el.textContent).toBe("=SUM(Table1[");
    // ...and then lists its columns
    refreshFormulaEditorState(ctx, el);
    expect(ctx.functionCandidates[0]).toMatchObject({ n: "Item", t: "column" });
    el.remove();
  });
});

describe("argument hint: selecting an argument", () => {
  test("argument ranges of a call", () => {
    const text = "=IF(A1>0, SUM(B1,B2) , )";
    expect(
      getCallArgumentRanges(text, 3).map((r) => text.slice(r.start, r.end))
    ).toEqual(["A1>0", "SUM(B1,B2)", ""]);
    // unclosed call
    expect(
      getCallArgumentRanges("=SUM(1,2", 4).map((r) => [r.start, r.end])
    ).toEqual([
      [5, 6],
      [7, 8],
    ]);
  });

  test("selects the argument's text in the editor", () => {
    const el = editor("=VLOOKUP(A1, B1:C9|, 2)");
    expect(selectCallArgument(el, 2)).toBe(true);
    expect(window.getSelection().toString()).toBe("2");
    expect(selectCallArgument(el, 1)).toBe(true);
    expect(window.getSelection().toString()).toBe("B1:C9");
    expect(selectCallArgument(el, 3)).toBe(false);
    el.remove();
  });
});
