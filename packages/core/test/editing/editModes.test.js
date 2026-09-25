import _ from "lodash";
import { makeHost, type, val, cellAt, parseA1 } from "./historyHarness";
import {
  handleGlobalKeyDown,
  handleEndModeKey,
} from "../../src/events/keyboard";
import {
  getEditMode,
  setEditMode,
  isReferenceInsertPosition,
  getEditorArrowAction,
} from "../../src/modules/editMode";
import { luckysheetUpdateCell } from "../../src/modules/cell";
import { setCaretOffset } from "../../src/modules/formulaEditor";

// jsdom has no innerText; the editors read it
const innerTextDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "innerText"
);
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
    set(v) {
      this.textContent = v;
    },
  });
});
afterAll(() => {
  if (innerTextDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "innerText",
      innerTextDescriptor
    );
  } else {
    delete HTMLElement.prototype.innerText;
  }
});

function setup(seed = {}) {
  const host = makeHost();
  Object.entries(seed).forEach(([a1, v]) => type(host, a1, v));
  // plain mutable context for key handling
  const ctx = { ...host.ctx, sheetFocused: true };
  ctx.luckysheetfile = JSON.parse(JSON.stringify(ctx.luckysheetfile));
  const cellInput = document.createElement("div");
  cellInput.contentEditable = "true";
  cellInput.className = "luckysheet-cell-input";
  const fxInput = document.createElement("div");
  fxInput.contentEditable = "true";
  document.body.append(cellInput, fxInput);
  const cache = { undoList: [], redoList: [] };
  const press = (key, opts = {}, target = cellInput) => {
    const e = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      keyCode: opts.keyCode ?? 0,
      ...opts,
    });
    Object.defineProperty(e, "target", { value: target });
    handleGlobalKeyDown(
      ctx,
      cellInput,
      fxInput,
      e,
      cache,
      () => {},
      () => {}
    );
    return e;
  };
  const selectCell = (a1, b1 = a1) => {
    const a = parseA1(a1);
    const b = parseA1(b1);
    ctx.luckysheet_select_save = [
      {
        row: [a.r, b.r],
        column: [a.c, b.c],
        row_focus: a.r,
        column_focus: a.c,
      },
    ];
  };
  /** starts editing the active cell with `text`, caret at the end */
  const edit = (text, mode = "enter") => {
    const sel = ctx.luckysheet_select_save[0];
    ctx.luckysheetCellUpdate = [sel.row_focus, sel.column_focus];
    setEditMode(ctx, mode);
    cellInput.textContent = text;
    cellInput.focus();
    setCaretOffset(cellInput, text.length);
  };
  const active = () => {
    const sel =
      ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
    return [sel.row_focus, sel.column_focus];
  };
  const cleanup = () => {
    cellInput.remove();
    fxInput.remove();
  };
  return { ctx, cellInput, fxInput, press, selectCell, edit, active, cleanup };
}

describe("isReferenceInsertPosition", () => {
  test.each([
    ["=", 1, true],
    ["=SUM(", 5, true],
    ["=SUM(A1,", 8, true],
    ["=A1+", 4, true],
    ["=A1 + ", 6, true],
    ["=A1:", 4, true],
    ["=A1", 3, false],
    ["=SUM(A1)", 8, false],
    ["=5%", 3, false],
    ["abc", 3, false],
    ['="a', 3, false],
    ["=(A1)", 1, false],
    ["=()", 2, true],
  ])("%s at %i -> %s", (text, caret, expected) => {
    expect(isReferenceInsertPosition(text, caret)).toBe(expected);
  });
});

describe("Enter / Edit / Point modes", () => {
  test("Ready when not editing, typing starts Enter mode", () => {
    const t = setup();
    t.selectCell("B2");
    expect(getEditMode(t.ctx)).toBe("ready");
    t.press("a", { keyCode: 65 });
    expect(t.ctx.luckysheetCellUpdate).toEqual([1, 1]);
    expect(getEditMode(t.ctx)).toBe("enter");
    t.cleanup();
  });

  test("F2 starts Edit mode and toggles Edit / Enter", () => {
    const t = setup();
    t.selectCell("B2");
    t.press("F2", { keyCode: 113 });
    expect(getEditMode(t.ctx)).toBe("edit");
    t.press("F2", { keyCode: 113 });
    expect(getEditMode(t.ctx)).toBe("enter");
    t.press("F2", { keyCode: 113 });
    expect(getEditMode(t.ctx)).toBe("edit");
    t.cleanup();
  });

  test("double-click editing is Edit mode; a stale mode is not reused", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("x", "enter");
    luckysheetUpdateCell(t.ctx, 1, 1);
    expect(getEditMode(t.ctx)).toBe("edit");
    // a session on another cell without an explicit mode reads as Edit
    setEditMode(t.ctx, "enter");
    t.ctx.luckysheetCellUpdate = [3, 3];
    expect(getEditMode(t.ctx)).toBe("edit");
    t.cleanup();
  });

  test("Enter mode: arrows commit and move", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("hello");
    const e = t.press("ArrowRight");
    expect(e.defaultPrevented).toBe(true);
    expect(val(t.ctx, "B2")).toBe("hello");
    expect(t.ctx.luckysheetCellUpdate).toEqual([]);
    expect(t.active()).toEqual([1, 2]);
    expect(getEditMode(t.ctx)).toBe("ready");
    t.cleanup();
  });

  test("Enter mode: arrows collapse a multi-cell selection", () => {
    const t = setup();
    t.selectCell("B2", "C4");
    t.edit("v");
    t.press("ArrowDown");
    expect(val(t.ctx, "B2")).toBe("v");
    expect(t.ctx.luckysheet_select_save[0].row).toEqual([2, 2]);
    expect(t.active()).toEqual([2, 1]);
    t.cleanup();
  });

  test("Edit mode: arrows move the caret and do not commit", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("hello", "edit");
    const e = t.press("ArrowLeft");
    expect(e.defaultPrevented).toBe(false);
    expect(t.ctx.luckysheetCellUpdate).toEqual([1, 1]);
    expect(cellAt(t.ctx, "B2")).toBeNull();
    t.cleanup();
  });

  test("Point mode: arrows insert and move a reference", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=");
    t.press("ArrowDown");
    expect(t.cellInput.textContent).toBe("=B3");
    expect(getEditMode(t.ctx)).toBe("point");
    t.press("ArrowDown");
    expect(t.cellInput.textContent).toBe("=B4");
    t.press("ArrowLeft");
    expect(t.cellInput.textContent).toBe("=A4");
    // the formula bar mirrors the editor
    expect(t.fxInput.textContent).toBe("=A4");
    // still editing, nothing committed
    expect(t.ctx.luckysheetCellUpdate).toEqual([1, 1]);
    t.cleanup();
  });

  test("Point mode: Shift extends to a range, typing ends it", () => {
    const t = setup();
    t.selectCell("C3");
    t.edit("=SUM(");
    t.press("ArrowUp");
    expect(t.cellInput.textContent).toBe("=SUM(C2");
    t.press("ArrowRight", { shiftKey: true });
    t.press("ArrowUp", { shiftKey: true });
    expect(t.cellInput.textContent).toBe("=SUM(C1:D2");
    // typing an operator ends Point mode, the next arrow starts over from
    // the edited cell
    t.press("+", { keyCode: 187 });
    expect(getEditMode(t.ctx)).toBe("enter");
    t.cellInput.textContent = "=SUM(C1:D2+";
    setCaretOffset(t.cellInput, t.cellInput.textContent.length);
    t.press("ArrowLeft");
    expect(t.cellInput.textContent).toBe("=SUM(C1:D2+B3");
    t.cleanup();
  });

  test("Point mode: Ctrl+arrow jumps and Ctrl+Shift+arrow extends to the data edge", () => {
    const t = setup({ A1: "1", A2: "2", A3: "3", A4: "4" });
    t.selectCell("C1");
    t.edit("=");
    t.press("ArrowLeft");
    t.press("ArrowLeft");
    expect(t.cellInput.textContent).toBe("=A1");
    t.press("ArrowDown", { ctrlKey: true, shiftKey: true });
    expect(t.cellInput.textContent).toBe("=A1:A4");
    t.press("ArrowDown", { ctrlKey: true });
    expect(t.cellInput.textContent).toBe("=A12");
    t.cleanup();
  });

  test("a formula at a non-reference position commits in Enter mode", () => {
    const t = setup({ A1: "5" });
    t.selectCell("B1");
    t.edit("=A1*2");
    t.press("ArrowDown");
    expect(val(t.ctx, "B1")).toBe(10);
    expect(t.active()).toEqual([1, 1]);
    t.cleanup();
  });

  test("an unclosed formula is closed when an arrow commits it", () => {
    const t = setup({ A1: "5" });
    t.selectCell("B1");
    t.edit("=SUM(A1");
    t.press("ArrowDown");
    expect(cellAt(t.ctx, "B1").f).toBe("=SUM(A1)");
    t.cleanup();
  });

  test("the formula bar always moves the caret", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=");
    expect(
      getEditorArrowAction(t.ctx, { key: "ArrowDown" }, t.fxInput, true)
    ).toBe("caret");
    expect(getEditorArrowAction(t.ctx, { key: "ArrowDown" }, t.cellInput)).toBe(
      "point"
    );
    t.cleanup();
  });

  test("Esc cancels and returns to Ready", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("abc");
    t.press("Escape");
    expect(getEditMode(t.ctx)).toBe("ready");
    expect(cellAt(t.ctx, "B2")).toBeNull();
    t.cleanup();
  });
});

describe("Enter and Tab while editing", () => {
  test("Enter / Shift+Enter wrap inside a multi-cell selection", () => {
    const t = setup();
    t.selectCell("A1", "B2");
    t.edit("1");
    t.press("Enter");
    expect(val(t.ctx, "A1")).toBe(1);
    expect(t.active()).toEqual([1, 0]);
    t.edit("2");
    t.press("Enter");
    // wraps to the top of the next column, selection kept
    expect(t.active()).toEqual([0, 1]);
    expect(t.ctx.luckysheet_select_save[0].row).toEqual([0, 1]);
    t.edit("3");
    t.press("Enter", { shiftKey: true });
    expect(t.active()).toEqual([1, 0]);
    t.cleanup();
  });

  test("Tab / Shift+Tab commit and wrap inside the selection", () => {
    const t = setup();
    t.selectCell("A1", "B2");
    t.edit("a");
    const e = t.press("Tab");
    expect(e.defaultPrevented).toBe(true);
    expect(val(t.ctx, "A1")).toBe("a");
    expect(t.active()).toEqual([0, 1]);
    t.edit("b");
    t.press("Tab");
    expect(t.active()).toEqual([1, 0]);
    t.edit("c");
    t.press("Tab", { shiftKey: true });
    expect(t.active()).toEqual([0, 1]);
    expect(t.ctx.luckysheet_select_save[0].column).toEqual([0, 1]);
    t.cleanup();
  });

  test("Tab from the formula bar commits its text", () => {
    const t = setup();
    t.selectCell("B2");
    t.ctx.luckysheetCellUpdate = [1, 1];
    t.fxInput.textContent = "fx";
    t.press("Tab", {}, t.fxInput);
    expect(val(t.ctx, "B2")).toBe("fx");
    expect(t.active()).toEqual([1, 2]);
    t.cleanup();
  });

  test("Enter after a run of Tabs returns to the starting column", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("1");
    t.press("Tab");
    t.edit("2");
    t.press("Tab");
    t.edit("3");
    t.press("Enter");
    expect(t.active()).toEqual([2, 1]);
    // without editing too
    t.press("Tab");
    t.press("Tab");
    t.press("Enter");
    expect(t.active()).toEqual([3, 1]);
    // a plain move breaks the run
    t.press("Tab");
    t.press("ArrowRight");
    t.press("Enter");
    expect(t.active()).toEqual([4, 3]);
    t.cleanup();
  });
});

describe("End mode", () => {
  test("End then an arrow jumps to the data edge", () => {
    const t = setup({ A1: "1", A2: "2", A3: "3", C1: "x" });
    t.selectCell("A1");
    t.press("End");
    expect(t.ctx.endMode).toBe(true);
    t.press("ArrowDown");
    expect(t.active()).toEqual([2, 0]);
    expect(t.ctx.endMode).toBe(false);
    t.press("ArrowDown");
    expect(t.active()).toEqual([3, 0]);
    t.cleanup();
  });

  test("End, Shift+arrow extends; a Shift keydown does not leave End mode", () => {
    const t = setup({ A1: "1", A2: "2", A3: "3" });
    t.selectCell("A1");
    t.press("End");
    t.press("Shift", { shiftKey: true, keyCode: 16 });
    expect(t.ctx.endMode).toBe(true);
    t.press("ArrowDown", { shiftKey: true });
    expect(t.ctx.luckysheet_select_save[0].row).toEqual([0, 2]);
    t.cleanup();
  });

  test("End twice cancels; other keys leave End mode", () => {
    const t = setup({ A1: "1", A2: "2" });
    t.selectCell("A1");
    t.press("End");
    t.press("End");
    expect(t.ctx.endMode).toBe(false);
    t.press("End");
    t.press("PageDown");
    expect(t.ctx.endMode).toBe(false);
    t.cleanup();
  });

  test("End, Home and End, Enter", () => {
    const t = setup({ A1: "1", B3: "2", D2: "x" });
    t.selectCell("A2");
    const e = new KeyboardEvent("keydown", { key: "End", cancelable: true });
    handleEndModeKey(t.ctx, e);
    handleEndModeKey(
      t.ctx,
      new KeyboardEvent("keydown", { key: "Enter", cancelable: true })
    );
    expect(t.active()).toEqual([1, 3]);
    handleEndModeKey(t.ctx, e);
    handleEndModeKey(
      t.ctx,
      new KeyboardEvent("keydown", { key: "Home", cancelable: true })
    );
    expect(t.active()).toEqual([2, 3]);
    t.cleanup();
  });
});

describe("replayed key events (React rebasing a state update)", () => {
  // React may run the keydown's state updater a second time, on the
  // rebased state, after the first result was committed and the editor
  // cleared. The replay must reach the same result.
  function replay(t, key, opts = {}, afterFirst = () => {}) {
    const e = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      keyCode: opts.keyCode ?? 0,
      ...opts,
    });
    Object.defineProperty(e, "target", { value: t.cellInput });
    const base = _.cloneDeep(_.omit(t.ctx, ["formulaCache", "getRefs"]));
    const cache = { undoList: [], redoList: [] };
    const run = () => {
      const ctx = {
        ..._.cloneDeep(base),
        formulaCache: t.ctx.formulaCache,
        getRefs: t.ctx.getRefs,
      };
      handleGlobalKeyDown(
        ctx,
        t.cellInput,
        t.fxInput,
        e,
        cache,
        () => {},
        () => {}
      );
      return ctx;
    };
    const first = run();
    afterFirst(cache);
    const second = run();
    return { first, second, cache };
  }

  test("Enter commits the same text when replayed after the editor was cleared", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("hello");
    const { first, second } = replay(t, "Enter", {}, () => {
      t.cellInput.innerHTML = "";
    });
    expect(val(first, "B2")).toBe("hello");
    expect(val(second, "B2")).toBe("hello");
    t.cleanup();
  });

  test("an arrow in Point mode keeps its reference when replayed", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=");
    const { second } = replay(t, "ArrowDown");
    expect(t.cellInput.textContent).toBe("=B3");
    expect(getEditMode(second)).toBe("point");
    t.cleanup();
  });

  test("typing the first character does not re-flag overwriteCell on replay", () => {
    const t = setup();
    t.selectCell("B2");
    const { second, cache } = replay(t, "a", { keyCode: 65 }, (c) => {
      // the InputBox consumed the flag when the session started
      // eslint-disable-next-line no-param-reassign
      c.overwriteCell = false;
    });
    expect(second.luckysheetCellUpdate).toEqual([1, 1]);
    expect(cache.overwriteCell).toBe(false);
    t.cleanup();
  });
});
