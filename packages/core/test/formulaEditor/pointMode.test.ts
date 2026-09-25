import {
  formatReferenceLike,
  normalizeFormulaCase,
  recordEditorState,
  redoEditorState,
  setCaretOffset,
  undoEditorState,
  EditorHistory,
} from "../../src/modules/formulaEditor";
import { endsWithOperand } from "../../src/modules/editMode";

describe("endsWithOperand (Ctrl+click adds a separator only after one)", () => {
  it.each([
    ["=SUM(", false],
    ["=SUM(A1,", false],
    ["=", false],
    ["=A1+", false],
    ["=A1 * ", false],
    ["=SUM(A1", true],
    ["=SUM(A1:B2 ", true],
    ["=SUM(1", true],
    ['=CONCAT("a"', true],
    ["=SUM(ABS(1)", true],
    ["=10%", true],
    ["=TRUE", true],
  ])("%s → %s", (text, expected) => {
    expect(endsWithOperand(text, text.length)).toBe(expected);
  });
});

describe("formatReferenceLike (moving / resizing a reference's box)", () => {
  it("moves a cell keeping its anchoring and sheet name", () => {
    expect(formatReferenceLike("A1", [2, 2], [1, 1])).toBe("B3");
    expect(formatReferenceLike("$A$1", [2, 2], [1, 1])).toBe("$B$3");
    expect(formatReferenceLike("A$1", [2, 2], [1, 1])).toBe("B$3");
    expect(formatReferenceLike("Sheet2!A1", [0, 0], [2, 2])).toBe("Sheet2!C1");
    expect(formatReferenceLike("'My sheet'!$A1", [4, 4], [0, 0])).toBe(
      "'My sheet'!$A5"
    );
  });

  it("resizes a cell into a range and a range back into a cell", () => {
    expect(formatReferenceLike("A1", [0, 2], [0, 1])).toBe("A1:B3");
    expect(formatReferenceLike("$A$1", [0, 2], [0, 1])).toBe("$A$1:$B$3");
    expect(formatReferenceLike("A1:$B$3", [1, 4], [0, 27])).toBe("A2:$AB$5");
    expect(formatReferenceLike("A1:B3", [1, 1], [2, 2])).toBe("C2");
  });

  it("keeps whole columns and rows whole", () => {
    expect(formatReferenceLike("A:B", null, [2, 4])).toBe("C:E");
    expect(formatReferenceLike("$A:$A", null, [3, 3])).toBe("$D:$D");
    expect(formatReferenceLike("1:2", [4, 9], null)).toBe("5:10");
  });

  it("returns null for text that is not a reference", () => {
    expect(formatReferenceLike("SUM", [0, 0], [0, 0])).toBeNull();
  });
});

describe("normalizeFormulaCase (commit)", () => {
  const known = (name: string) => ["SUM", "IF", "ABS"].includes(name);
  it("upper-cases references, booleans and known functions", () => {
    expect(normalizeFormulaCase("=sum(a1:b$2)", known)).toBe("=SUM(A1:B$2)");
    expect(normalizeFormulaCase("=if(true,abs(-1),false)", known)).toBe(
      "=IF(TRUE,ABS(-1),FALSE)"
    );
  });
  it("keeps strings, sheet names, names and unknown functions", () => {
    expect(
      normalizeFormulaCase('=myFn(Sheet2!a1,"abc",total)&"x"', known)
    ).toBe('=myFn(Sheet2!A1,"abc",total)&"x"');
  });
  it("leaves plain text alone", () => {
    expect(normalizeFormulaCase("sum(a1)", known)).toBe("sum(a1)");
  });
});

describe("editor undo / redo", () => {
  const type = (el: HTMLElement, h: EditorHistory, text: string) => {
    recordEditorState(h, el);
    el.textContent = text;
    setCaretOffset(el, text.length);
    recordEditorState(h, el);
  };

  it("steps back and forth through the typed states", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const h: EditorHistory = { undo: [], redo: [] };
    type(el, h, "=");
    type(el, h, "=SUM(");
    // a reference picked with the mouse: no key event records it
    el.textContent = "=SUM(A1";
    expect(undoEditorState(h, el)).toBe(true);
    expect(el.textContent).toBe("=SUM(");
    expect(undoEditorState(h, el)).toBe(true);
    expect(el.textContent).toBe("=");
    expect(redoEditorState(h, el)).toBe(true);
    expect(el.textContent).toBe("=SUM(");
    expect(redoEditorState(h, el)).toBe(true);
    expect(el.textContent).toBe("=SUM(A1");
    expect(redoEditorState(h, el)).toBe(false);
    // typing after an undo drops the redo steps
    undoEditorState(h, el);
    type(el, h, "=SUM(B");
    expect(redoEditorState(h, el)).toBe(false);
    el.remove();
  });

  it("does nothing without earlier states", () => {
    const el = document.createElement("div");
    el.textContent = "=1";
    const h: EditorHistory = { undo: [], redo: [] };
    expect(undoEditorState(h, el)).toBe(false);
    expect(el.textContent).toBe("=1");
  });
});
