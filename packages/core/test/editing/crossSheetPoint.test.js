import { makeHost, type, val, cellAt, parseA1 } from "./historyHarness";
import { handleGlobalKeyDown } from "../../src/events/keyboard";
import {
  getEditMode,
  getEditingSheetId,
  returnToEditSheet,
  setEditMode,
  switchSheetWhileEditing,
} from "../../src/modules/editMode";
import { createRangeHightlight } from "../../src/modules/formula";
import { setCaretOffset } from "../../src/modules/formulaEditor";

// Excel's Point mode across sheets: while a formula is edited, clicking
// another sheet's tab shows that sheet and keeps editing; references picked
// there get the sheet name; Enter commits on the edited cell's sheet.

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

function setup() {
  const host = makeHost();
  type(host, "C4", "5", "id_2");
  type(host, "C5", "7", "id_2");
  const ctx = { ...host.ctx, sheetFocused: true };
  ctx.luckysheetfile = JSON.parse(JSON.stringify(ctx.luckysheetfile));
  const cellInput = document.createElement("div");
  cellInput.contentEditable = "true";
  const fxInput = document.createElement("div");
  fxInput.contentEditable = "true";
  document.body.append(cellInput, fxInput);
  const cache = { undoList: [], redoList: [] };
  const press = (key, opts = {}) => {
    const e = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    });
    Object.defineProperty(e, "target", { value: cellInput });
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
  const selectCell = (a1) => {
    const { r, c } = parseA1(a1);
    ctx.luckysheet_select_save = [
      { row: [r, r], column: [c, c], row_focus: r, column_focus: c },
    ];
  };
  const edit = (text) => {
    const sel = ctx.luckysheet_select_save[0];
    ctx.luckysheetCellUpdate = [sel.row_focus, sel.column_focus];
    setEditMode(ctx, "enter");
    cellInput.textContent = text;
    cellInput.focus();
    setCaretOffset(cellInput, text.length);
  };
  /** like clicking a tab: the tab bar then restores the sheet's selection */
  const showSheet = (id, activeA1) => {
    expect(switchSheetWhileEditing(ctx, id, cellInput)).toBe(true);
    if (activeA1) selectCell(activeA1);
  };
  const cleanup = () => {
    cellInput.remove();
    fxInput.remove();
  };
  return { ctx, cellInput, press, selectCell, edit, showSheet, cleanup };
}

describe("Point mode across sheets", () => {
  test("switching sheets keeps editing; arrows pick Sheet2 references", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=SUM(");
    t.showSheet("id_2", "C3");
    expect(t.ctx.currentSheetId).toBe("id_2");
    expect(getEditingSheetId(t.ctx)).toBe("id_1");
    expect(t.ctx.luckysheetCellUpdate).toEqual([1, 1]);
    expect(getEditMode(t.ctx)).toBe("enter");
    // the first arrow starts at Sheet2's active cell
    t.press("ArrowDown");
    expect(t.cellInput.textContent).toBe("=SUM(Sheet2!C4");
    t.press("ArrowDown", { shiftKey: true });
    expect(t.cellInput.textContent).toBe("=SUM(Sheet2!C4:C5");
    expect(getEditMode(t.ctx)).toBe("point");

    // Enter commits on Sheet1 and moves down there
    t.press("Enter");
    expect(t.ctx.currentSheetId).toBe("id_1");
    expect(t.ctx.formulaEditOrigin).toBeUndefined();
    expect(cellAt(t.ctx, "B2").f).toBe("=SUM(Sheet2!C4:C5)");
    expect(val(t.ctx, "B2")).toBe(12);
    expect(t.ctx.luckysheet_select_save[0]).toMatchObject({
      row_focus: 2,
      column_focus: 1,
    });
    // the tab bar does not restore Sheet1's old selection over the move
    expect(t.ctx.sheetScrollRestoredFor).toBe("id_1");
    t.cleanup();
  });

  test("sheet names that need quotes are quoted", () => {
    const t = setup();
    t.ctx.luckysheetfile[1].name = "My Data";
    t.selectCell("A1");
    t.edit("=1+");
    t.showSheet("id_2", "B1");
    t.press("ArrowRight");
    expect(t.cellInput.textContent).toBe("=1+'My Data'!C1");
    t.cleanup();
  });

  test("Esc cancels and returns to the edited cell's sheet", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=SUM(");
    t.showSheet("id_2", "C3");
    t.press("Escape");
    expect(t.ctx.currentSheetId).toBe("id_1");
    expect(t.ctx.luckysheetCellUpdate).toEqual([]);
    expect(cellAt(t.ctx, "B2")).toBeNull();
    t.cleanup();
  });

  test("clicking the edited cell's tab goes back and keeps editing", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=SUM(");
    t.showSheet("id_2", "C3");
    t.ctx.sheetScrollRecord.id_1.scrollTop = 40;
    t.showSheet("id_1");
    expect(t.ctx.currentSheetId).toBe("id_1");
    expect(t.ctx.formulaEditOrigin).toBeUndefined();
    expect(t.ctx.luckysheetCellUpdate).toEqual([1, 1]);
    // Sheet1's own selection and scroll come back
    expect(t.ctx.luckysheet_select_save[0].row_focus).toBe(1);
    expect(t.ctx.scrollTop).toBe(40);
    // references picked on Sheet1 again have no sheet name
    t.press("ArrowRight");
    expect(t.cellInput.textContent).toBe("=SUM(C2");
    t.cleanup();
  });

  test("only formulas switch sheets while editing", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("text");
    expect(switchSheetWhileEditing(t.ctx, "id_2", t.cellInput)).toBe(false);
    expect(t.ctx.currentSheetId).toBe("id_1");
    t.ctx.luckysheetCellUpdate = [];
    t.cellInput.textContent = "=1";
    expect(switchSheetWhileEditing(t.ctx, "id_2", t.cellInput)).toBe(false);
    t.cleanup();
  });

  test("reference boxes: unqualified references are on the edited sheet", () => {
    const t = setup();
    t.selectCell("B2");
    t.edit("=A1+Sheet2!C4");
    t.showSheet("id_2", "C3");
    createRangeHightlight(
      t.ctx,
      '=<span class="fortune-formula-functionrange-cell" rangeindex="0">A1</span>+<span class="fortune-formula-functionrange-cell" rangeindex="1">Sheet2!C4</span>'
    );
    expect(t.ctx.formulaRangeHighlight.map((h) => h.rangeIndex)).toEqual([1]);
    expect(returnToEditSheet(t.ctx)).toBe(true);
    expect(returnToEditSheet(t.ctx)).toBe(false);
    t.cleanup();
  });
});
