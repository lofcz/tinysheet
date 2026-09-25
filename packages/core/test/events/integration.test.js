import { produceWithPatches, enablePatches, applyPatches } from "immer";
import {
  getInsertDeleteCellsShortcut,
  getRowColShortcutOp,
  handleGlobalKeyDown,
} from "../../src/events/keyboard";
import { makeContext, input, value, cell } from "../formula/helpers";
import {
  clearGroupedSheetsContents,
  mirrorGroupedSheetEdits,
  toggleSheetInGroup,
} from "../../src/modules/sheet";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  retryDataVerificationAlert,
  setDataVerification,
} from "../../src/modules/dataVerification";
import { getEditMode } from "../../src/modules/editMode";
import { defaultContext } from "../../src/context";

enablePatches();

const key = (opts) =>
  new KeyboardEvent("keydown", { cancelable: true, ctrlKey: true, ...opts });
const minus = () => key({ key: "-", code: "Minus" });
const plus = () => key({ key: "+", code: "Equal", shiftKey: true });

function shortcutCtx(selection) {
  const ctx = makeContext({ rows: 6, cols: 4 });
  ctx.sheetFocused = true;
  ctx.contextMenu = {};
  ctx.luckysheetCellUpdate = [];
  ctx.luckysheet_select_save = [selection];
  return ctx;
}

describe("Ctrl+- / Ctrl+Shift+= on cells", () => {
  test("a plain range asks for the Delete / Insert dialog", () => {
    const ctx = shortcutCtx({ row: [1, 2], column: [0, 1] });
    expect(getInsertDeleteCellsShortcut(ctx, minus())).toBe("delete");
    expect(getInsertDeleteCellsShortcut(ctx, plus())).toBe("insert");
    expect(
      getInsertDeleteCellsShortcut(
        ctx,
        key({ key: "-", code: "NumpadSubtract" })
      )
    ).toBe("delete");
    // not a row/column op
    expect(getRowColShortcutOp(ctx, minus())).toBeNull();
  });

  test("entire rows / columns keep the direct row/column op", () => {
    const ctx = shortcutCtx({ row: [1, 2], column: [0, 3], row_select: true });
    expect(getInsertDeleteCellsShortcut(ctx, minus())).toBeNull();
    expect(getRowColShortcutOp(ctx, minus())).toEqual({
      deleteRowColOp: { type: "row", start: 1, end: 2, id: "id_1" },
    });
    // select all (both flags) behaves like a plain range, as in Excel
    ctx.luckysheet_select_save[0].column_select = true;
    expect(getInsertDeleteCellsShortcut(ctx, minus())).toBe("delete");
  });

  test("other keys and states are left alone", () => {
    const ctx = shortcutCtx({ row: [0, 0], column: [0, 0] });
    // Ctrl+= (no Shift) stays zoom in
    expect(
      getInsertDeleteCellsShortcut(ctx, key({ key: "=", code: "Equal" }))
    ).toBeNull();
    expect(
      getInsertDeleteCellsShortcut(
        ctx,
        key({ key: "-", code: "Minus", altKey: true })
      )
    ).toBeNull();
    ctx.luckysheetCellUpdate = [0, 0];
    expect(getInsertDeleteCellsShortcut(ctx, minus())).toBeNull();
    ctx.luckysheetCellUpdate = [];
    ctx.luckysheet_select_save.push({ row: [3, 3], column: [3, 3] });
    expect(getInsertDeleteCellsShortcut(ctx, minus())).toBeNull();
    ctx.luckysheet_select_save.pop();
    ctx.allowEdit = false;
    expect(getInsertDeleteCellsShortcut(ctx, minus())).toBeNull();
  });
});

describe("Delete with grouped sheets", () => {
  function pressDeleteGrouped(ctx, range) {
    ctx.luckysheet_select_save = [range];
    const cellInput = document.createElement("div");
    const fxInput = document.createElement("div");
    // run like the React layer: key handler, then the grouped-sheet mirror
    return produceWithPatches(ctx, (draft) => {
      handleGlobalKeyDown(
        draft,
        cellInput,
        fxInput,
        new KeyboardEvent("keydown", { key: "Delete", keyCode: 46 }),
        { undoList: [], redoList: [] },
        () => {},
        () => {},
        null
      );
      mirrorGroupedSheetEdits(ctx, draft);
      groupValuesRefresh(draft);
    });
  }

  test("clears the selection on every grouped sheet, keeping each one's formats", () => {
    let ctx = makeContext({ rows: 6, cols: 4 });
    ctx.sheetFocused = true;
    ctx.contextMenu = {};
    ctx.luckysheetCellUpdate = [];
    input(ctx, "A1", "1");
    // A2 is empty on the active sheet but not on the grouped one
    input(ctx, "A1", "5", "id_2");
    input(ctx, "A2", "6", "id_2");
    input(ctx, "C1", "=A1+A2", "id_2");
    ctx.luckysheetfile[1].data[0][0].bl = 1;
    toggleSheetInGroup(ctx, "id_2");
    const before = ctx;
    const [next, , inverse] = pressDeleteGrouped(ctx, {
      row: [0, 1],
      column: [0, 0],
      row_focus: 0,
      column_focus: 0,
    });
    ctx = next;
    expect(value(ctx, "A1")).toBeUndefined();
    expect(value(ctx, "A1", "id_2")).toBeUndefined();
    expect(value(ctx, "A2", "id_2")).toBeUndefined();
    // the grouped sheet keeps its own bold, formulas recalculate
    expect(cell(ctx, "A1", "id_2").bl).toBe(1);
    expect(value(ctx, "C1", "id_2")).toBe(0);
    // one undo step restores both sheets
    const undone = applyPatches(ctx, inverse);
    expect(value(undone, "A2", "id_2")).toBe(6);
    expect(value(undone, "A1", "id_2")).toBe(
      before.luckysheetfile[1].data[0][0].v
    );
  });

  test("without a group only the active sheet changes", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    input(ctx, "A1", "5", "id_2");
    ctx.luckysheet_select_save = [{ row: [0, 0], column: [0, 0] }];
    clearGroupedSheetsContents(ctx);
    expect(value(ctx, "A1", "id_2")).toBe(5);
  });
});

describe("data validation Retry", () => {
  test("reopens the editor in Edit mode with the rejected text", () => {
    const ctx = makeContext({ rows: 6, cols: 4 });
    ctx.lang = "en";
    ctx.dataVerification = {
      ...defaultContext({}).dataVerification,
      dataRegulation: undefined,
    };
    setDataVerification(ctx, "B2", {
      type: "number_integer",
      type2: "between",
      value1: "1",
      value2: "10",
      prohibitInput: true,
      errorStyle: "stop",
    });
    input(ctx, "B2", "50");
    expect(ctx.dataVerificationAlert.value).toBe("50");
    ctx.luckysheet_select_save = [{ row: [2, 2], column: [1, 1] }];
    expect(retryDataVerificationAlert(ctx)).toBe("50");
    expect(ctx.dataVerificationAlert).toBeUndefined();
    expect(ctx.luckysheetCellUpdate).toEqual([1, 1]);
    expect(ctx.luckysheet_select_save[0]).toMatchObject({
      row_focus: 1,
      column_focus: 1,
    });
    expect(getEditMode(ctx)).toBe("edit");
    expect(value(ctx, "B2")).toBeUndefined();
    // nothing to retry
    expect(retryDataVerificationAlert(ctx)).toBeNull();
  });
});
