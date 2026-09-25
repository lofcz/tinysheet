import { contextFactory } from "../factories/context";
import { handleGlobalKeyDown } from "../../src/events/keyboard";
import { selectionCache } from "../../src/modules/selection";

// Excel: Ctrl+Alt+V opens Paste Special (Ctrl+Shift+V in Google Sheets
// pastes values; here it opens the dialog when there is a copy to paste).

function makeCtx(extra = {}) {
  const data = Array.from({ length: 4 }, () => Array(4).fill(null));
  return contextFactory({
    luckysheetfile: [{ id: "id_1", name: "Sheet1", order: 0, data }],
    luckysheetCellUpdate: [],
    sheetFocused: true,
    config: {},
    contextMenu: {},
    luckysheet_select_save: [
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ],
    ...extra,
  });
}

function press(ctx, opts) {
  const e = new KeyboardEvent("keydown", {
    key: "v",
    code: "KeyV",
    keyCode: 86,
    ctrlKey: true,
    cancelable: true,
    ...opts,
  });
  handleGlobalKeyDown(
    ctx,
    document.createElement("div"),
    document.createElement("div"),
    e,
    {},
    () => {},
    () => {}
  );
  return e;
}

const copied = {
  luckysheet_copy_save: {
    dataSheetId: "id_1",
    copyRange: [{ row: [1, 1], column: [1, 1] }],
    RowlChange: false,
    HasMC: false,
  },
};

beforeEach(() => {
  selectionCache.isPasteAction = false;
});

test("Ctrl+Alt+V opens Paste Special when something was copied", () => {
  const ctx = makeCtx(copied);
  const e = press(ctx, { altKey: true });
  expect(ctx.showPasteSpecial).toBe(true);
  expect(e.defaultPrevented).toBe(true);
  expect(selectionCache.isPasteAction).toBe(false);
});

test("Ctrl+Shift+V opens Paste Special when something was copied", () => {
  const ctx = makeCtx(copied);
  press(ctx, { shiftKey: true });
  expect(ctx.showPasteSpecial).toBe(true);
});

test("without a copy they fall back to a normal paste", () => {
  const ctx = makeCtx();
  press(ctx, { altKey: true });
  expect(ctx.showPasteSpecial).toBeFalsy();
  expect(selectionCache.isPasteAction).toBe(true);
  selectionCache.isPasteAction = false;
  press(ctx, { shiftKey: true });
  expect(ctx.showPasteSpecial).toBeFalsy();
  expect(selectionCache.isPasteAction).toBe(true);
});

test("plain Ctrl+V still pastes", () => {
  const ctx = makeCtx(copied);
  press(ctx, {});
  expect(ctx.showPasteSpecial).toBeFalsy();
  expect(selectionCache.isPasteAction).toBe(true);
});
