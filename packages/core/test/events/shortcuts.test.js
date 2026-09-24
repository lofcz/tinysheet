import { contextFactory } from "../factories/context";
import {
  applyRowColShortcutOp,
  getRowColShortcutOp,
  handleGlobalKeyDown,
} from "../../src/events/keyboard";
import { getFlowdata } from "../../src/context";

const grid = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(null));
const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });

function makeCtx(data, extra = {}) {
  return contextFactory({
    luckysheetfile: [{ id: "id_1", name: "Sheet1", order: 0, data }],
    visibledatarow: data.map((_, i) => (i + 1) * 20),
    visibledatacolumn: data[0].map((_, i) => (i + 1) * 74),
    luckysheetCellUpdate: [],
    sheetFocused: true,
    cellmainHeight: 100,
    cellmainWidth: 300,
    config: {},
    contextMenu: {},
    luckysheet_select_save: [
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ],
    ...extra,
  });
}

function press(ctx, key, opts = {}, cellInput = document.createElement("div")) {
  const codes = {
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
    Enter: 13,
    Tab: 9,
    Backspace: 8,
    Delete: 46,
    Home: 36,
    End: 35,
    PageUp: 33,
    PageDown: 34,
    " ": 32,
  };
  const e = new KeyboardEvent("keydown", {
    key,
    keyCode: codes[key] ?? key.toUpperCase().charCodeAt(0),
    cancelable: true,
    ...opts,
  });
  handleGlobalKeyDown(
    ctx,
    cellInput,
    document.createElement("div"),
    e,
    {},
    () => {},
    () => {}
  );
  return e;
}

const sel = (ctx) => {
  const s = ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
  return {
    row: s.row,
    column: s.column,
    focus: [s.row_focus, s.column_focus],
  };
};

// Column A: 1..3, blank, 5..6, blank x3 (10 rows); row 0: A..C filled
function dataSheet() {
  const data = grid(10, 5);
  [1, 2, 3].forEach((v, i) => {
    data[i][0] = num(v);
  });
  data[4][0] = num(5);
  data[5][0] = num(6);
  data[0][1] = num(10);
  data[0][2] = num(20);
  return data;
}

describe("navigation keys", () => {
  test("Ctrl+Arrow jumps between data region edges", () => {
    const ctx = makeCtx(dataSheet());
    press(ctx, "ArrowDown", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([2, 0]);
    press(ctx, "ArrowDown", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([4, 0]);
    press(ctx, "ArrowDown", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([5, 0]);
    press(ctx, "ArrowDown", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([9, 0]);
    press(ctx, "ArrowUp", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([5, 0]);
    press(ctx, "ArrowRight", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([5, 4]);
  });

  test("Cmd+Arrow works like Ctrl+Arrow (Mac)", () => {
    const ctx = makeCtx(dataSheet());
    press(ctx, "ArrowRight", { metaKey: true });
    expect(sel(ctx).focus).toEqual([0, 2]);
  });

  test("Ctrl+Shift+Arrow extends to the edge and keeps the anchor", () => {
    const ctx = makeCtx(dataSheet());
    press(ctx, "ArrowDown", { ctrlKey: true, shiftKey: true });
    expect(sel(ctx)).toEqual({ row: [0, 2], column: [0, 0], focus: [0, 0] });
    press(ctx, "ArrowDown", { ctrlKey: true, shiftKey: true });
    expect(sel(ctx).row).toEqual([0, 4]);
    press(ctx, "ArrowRight", { ctrlKey: true, shiftKey: true });
    expect(sel(ctx).column).toEqual([0, 2]);
  });

  test("Shift+Arrow grows and shrinks from the moving edge", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      { row: [3, 3], column: [1, 1], row_focus: 3, column_focus: 1 },
    ];
    press(ctx, "ArrowDown", { shiftKey: true });
    press(ctx, "ArrowRight", { shiftKey: true });
    expect(sel(ctx)).toEqual({ row: [3, 4], column: [1, 2], focus: [3, 1] });
    press(ctx, "ArrowUp", { shiftKey: true });
    press(ctx, "ArrowUp", { shiftKey: true });
    expect(sel(ctx).row).toEqual([2, 3]);
  });

  test("arrows skip hidden rows and columns", () => {
    const ctx = makeCtx(dataSheet(), {
      config: { rowhidden: { 1: 0, 2: 0 }, colhidden: { 1: 0 } },
    });
    press(ctx, "ArrowDown");
    expect(sel(ctx).focus).toEqual([3, 0]);
    press(ctx, "ArrowRight");
    expect(sel(ctx).focus).toEqual([3, 2]);
    press(ctx, "ArrowUp");
    expect(sel(ctx).focus).toEqual([0, 2]);
  });

  test("arrows step over merged cells", () => {
    const data = grid(5, 3);
    data[1][0] = { mc: { r: 1, c: 0, rs: 2, cs: 2 }, v: "m" };
    data[1][1] = { mc: { r: 1, c: 0 } };
    data[2][0] = { mc: { r: 1, c: 0 } };
    data[2][1] = { mc: { r: 1, c: 0 } };
    const ctx = makeCtx(data, {
      config: { merge: { "1_0": { r: 1, c: 0, rs: 2, cs: 2 } } },
    });
    press(ctx, "ArrowDown");
    expect(sel(ctx)).toEqual({ row: [1, 2], column: [0, 1], focus: [1, 0] });
    press(ctx, "ArrowDown");
    expect(sel(ctx).focus).toEqual([3, 0]);
  });

  test("Home, Ctrl+Home and Ctrl+End", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      { row: [7, 7], column: [3, 3], row_focus: 7, column_focus: 3 },
    ];
    press(ctx, "Home");
    expect(sel(ctx).focus).toEqual([7, 0]);
    press(ctx, "End", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([5, 2]);
    press(ctx, "Home", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([0, 0]);
    press(ctx, "End", { ctrlKey: true, shiftKey: true });
    expect(sel(ctx)).toEqual({ row: [0, 5], column: [0, 2], focus: [0, 0] });
  });

  test("Ctrl+Home goes to the first cell below frozen panes", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheetfile[0].frozen = {
      type: "rangeBoth",
      range: { row_focus: 1, column_focus: 0 },
    };
    ctx.luckysheet_select_save = [
      { row: [7, 7], column: [3, 3], row_focus: 7, column_focus: 3 },
    ];
    press(ctx, "Home", { ctrlKey: true });
    expect(sel(ctx).focus).toEqual([2, 1]);
  });

  test("PageDown / PageUp move by a screen of rows, Alt by columns", () => {
    const ctx = makeCtx(grid(30, 20));
    press(ctx, "PageDown");
    expect(sel(ctx).focus).toEqual([5, 0]);
    expect(ctx.scrollTop).toBe(100);
    press(ctx, "PageDown");
    expect(sel(ctx).focus).toEqual([10, 0]);
    press(ctx, "PageUp");
    expect(sel(ctx).focus).toEqual([5, 0]);
    press(ctx, "PageDown", { altKey: true });
    expect(sel(ctx).focus[1]).toBeGreaterThanOrEqual(4);
    press(ctx, "PageDown", { shiftKey: true });
    expect(sel(ctx).row).toEqual([5, 10]);
  });

  test("Ctrl+A selects the current region, then the whole sheet", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
    ];
    press(ctx, "a", { ctrlKey: true, code: "KeyA" });
    // A1:C3 is bounded by the blank row 4
    expect(sel(ctx)).toEqual({ row: [0, 2], column: [0, 2], focus: [1, 0] });
    press(ctx, "a", { ctrlKey: true, code: "KeyA" });
    expect(sel(ctx).row).toEqual([0, 9]);
    expect(sel(ctx).column).toEqual([0, 4]);
    expect(ctx.luckysheet_select_save[0].row_select).toBe(true);
  });

  test("Shift+Space / Ctrl+Space select rows / columns", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      { row: [2, 3], column: [1, 1], row_focus: 2, column_focus: 1 },
    ];
    press(ctx, " ", { shiftKey: true, code: "Space" });
    expect(sel(ctx).row).toEqual([2, 3]);
    expect(sel(ctx).column).toEqual([0, 4]);
    expect(ctx.luckysheet_select_save[0].row_select).toBe(true);
    ctx.luckysheet_select_save = [
      { row: [2, 2], column: [1, 2], row_focus: 2, column_focus: 1 },
    ];
    press(ctx, " ", { ctrlKey: true, code: "Space" });
    expect(sel(ctx).row).toEqual([0, 9]);
    expect(sel(ctx).column).toEqual([1, 2]);
    expect(ctx.luckysheet_select_save[0].column_select).toBe(true);
    expect(ctx.luckysheetCellUpdate).toEqual([]);
  });

  test("Enter/Tab move and wrap inside a multi-cell selection", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      { row: [0, 1], column: [0, 1], row_focus: 0, column_focus: 0 },
    ];
    press(ctx, "Enter");
    expect(sel(ctx)).toEqual({ row: [0, 1], column: [0, 1], focus: [1, 0] });
    press(ctx, "Enter");
    expect(sel(ctx).focus).toEqual([0, 1]);
    press(ctx, "Tab");
    expect(sel(ctx).focus).toEqual([1, 0]);
    press(ctx, "Tab", { shiftKey: true });
    expect(sel(ctx).focus).toEqual([0, 1]);
    press(ctx, "Enter", { shiftKey: true });
    expect(sel(ctx).focus).toEqual([1, 0]);
    expect(sel(ctx).row).toEqual([0, 1]);
  });

  test("Enter and Tab on a single cell move down / right", () => {
    const ctx = makeCtx(dataSheet());
    press(ctx, "Enter");
    expect(sel(ctx).focus).toEqual([1, 0]);
    press(ctx, "Tab");
    expect(sel(ctx).focus).toEqual([1, 1]);
    expect(ctx.luckysheetCellUpdate).toEqual([]);
  });
});

describe("editing keys", () => {
  test("F2 starts editing the active cell", () => {
    const ctx = makeCtx(dataSheet());
    press(ctx, "F2", { keyCode: 113 });
    expect(ctx.luckysheetCellUpdate).toEqual([0, 0]);
  });

  test("Enter commits and moves inside the selection", () => {
    const ctx = makeCtx(grid(4, 4));
    ctx.luckysheet_select_save = [
      { row: [0, 1], column: [0, 1], row_focus: 1, column_focus: 1 },
    ];
    ctx.luckysheetCellUpdate = [1, 1];
    const input = document.createElement("div");
    input.innerText = "hello";
    press(ctx, "Enter", {}, input);
    expect(getFlowdata(ctx)[1][1].v).toBe("hello");
    expect(sel(ctx)).toEqual({ row: [0, 1], column: [0, 1], focus: [0, 0] });
  });

  test("Shift+Enter commits and moves up", () => {
    const ctx = makeCtx(grid(4, 4));
    ctx.luckysheet_select_save = [
      { row: [2, 2], column: [0, 0], row_focus: 2, column_focus: 0 },
    ];
    ctx.luckysheetCellUpdate = [2, 0];
    const input = document.createElement("div");
    input.innerText = "x";
    press(ctx, "Enter", { shiftKey: true }, input);
    expect(sel(ctx).focus).toEqual([1, 0]);
  });

  test("Ctrl+Enter fills the entry into the whole selection", () => {
    const data = grid(4, 4);
    [1, 2, 3].forEach((v, i) => {
      data[i][0] = num(v);
    });
    const ctx = makeCtx(data);
    ctx.luckysheet_select_save = [
      { row: [0, 2], column: [1, 2], row_focus: 0, column_focus: 1 },
    ];
    ctx.luckysheetCellUpdate = [0, 1];
    const input = document.createElement("div");
    input.innerText = "=A1*10";
    press(ctx, "Enter", { ctrlKey: true }, input);
    const d = getFlowdata(ctx);
    expect(d[0][1].v).toBe(10);
    expect(d[2][1].f).toBe("=A3*10");
    expect(d[2][1].v).toBe(30);
    expect(d[1][2].f).toBe("=B2*10");
    expect(sel(ctx)).toEqual({ row: [0, 2], column: [1, 2], focus: [0, 1] });
    expect(ctx.luckysheetCellUpdate).toEqual([]);

    ctx.luckysheetCellUpdate = [0, 1];
    input.innerText = "same";
    press(ctx, "Enter", { ctrlKey: true }, input);
    expect(d[2][2].v).toBe("same");
  });

  test("Delete clears contents but keeps formatting", () => {
    const data = grid(2, 2);
    data[0][0] = {
      v: 5,
      m: "5",
      bl: 1,
      bg: "#ff0000",
      ct: { fa: "0.00", t: "n" },
    };
    const ctx = makeCtx(data);
    press(ctx, "Delete");
    expect(getFlowdata(ctx)[0][0]).toEqual({
      bl: 1,
      bg: "#ff0000",
      ct: { fa: "0.00", t: "n" },
    });
  });

  test("Backspace starts editing the active cell with empty content", () => {
    const data = grid(2, 2);
    data[0][1] = num(7);
    const ctx = makeCtx(data);
    ctx.luckysheet_select_save = [
      { row: [0, 1], column: [0, 1], row_focus: 0, column_focus: 1 },
    ];
    const cache = {};
    const input = document.createElement("div");
    input.innerHTML = "old";
    const e = new KeyboardEvent("keydown", { key: "Backspace", keyCode: 8 });
    handleGlobalKeyDown(
      ctx,
      input,
      null,
      e,
      cache,
      () => {},
      () => {}
    );
    expect(ctx.luckysheetCellUpdate).toEqual([0, 1]);
    expect(cache.overwriteCell).toBe(true);
    expect(input.innerHTML).toBe("");
    // the stored value only changes when the edit is committed
    expect(getFlowdata(ctx)[0][1].v).toBe(7);
  });

  test("Ctrl+; and Ctrl+Shift+; start editing with the date / time", () => {
    const ctx = makeCtx(grid(2, 2));
    const input = document.createElement("div");
    press(ctx, ";", { ctrlKey: true, code: "Semicolon" }, input);
    expect(ctx.luckysheetCellUpdate).toEqual([0, 0]);
    expect(input.innerText).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const ctx2 = makeCtx(grid(2, 2));
    const input2 = document.createElement("div");
    press(
      ctx2,
      ":",
      { ctrlKey: true, shiftKey: true, code: "Semicolon" },
      input2
    );
    expect(input2.innerText).toMatch(/^\d{2}:\d{2}$/);
  });

  test("Ctrl+D fills down (with formula adjustment)", () => {
    const data = grid(3, 2);
    [1, 2, 3].forEach((v, i) => {
      data[i][0] = num(v);
    });
    data[0][1] = { v: 2, f: "=A1+1", m: "2", ct: { fa: "General", t: "n" } };
    const ctx = makeCtx(data);
    ctx.luckysheet_select_save = [
      { row: [0, 2], column: [1, 1], row_focus: 0, column_focus: 1 },
    ];
    press(ctx, "d", { ctrlKey: true, code: "KeyD" });
    expect(getFlowdata(ctx)[2][1].f).toBe("=A3+1");
    expect(getFlowdata(ctx)[2][1].v).toBe(4);
  });

  test("Ctrl+B/I/U/5 toggle font styles", () => {
    const data = grid(2, 2);
    data[0][0] = num(1);
    const ctx = makeCtx(data);
    press(ctx, "b", { ctrlKey: true, code: "KeyB" });
    press(ctx, "i", { ctrlKey: true, code: "KeyI" });
    press(ctx, "u", { ctrlKey: true, code: "KeyU" });
    press(ctx, "5", { ctrlKey: true, code: "Digit5" });
    expect(getFlowdata(ctx)[0][0]).toMatchObject({
      bl: 1,
      it: 1,
      un: 1,
      cl: 1,
    });
    press(ctx, "b", { ctrlKey: true, code: "KeyB" });
    expect(getFlowdata(ctx)[0][0].bl).toBe(0);
  });

  test("Ctrl+Shift+1..6 apply number formats", () => {
    const data = grid(2, 2);
    data[0][0] = num(1234.5);
    const ctx = makeCtx(data);
    const fmt = (code, key) => {
      press(ctx, key, { ctrlKey: true, shiftKey: true, code });
      return getFlowdata(ctx)[0][0].ct.fa;
    };
    expect(fmt("Digit1", "!")).toBe("#,##0.00");
    expect(getFlowdata(ctx)[0][0].m).toBe("1,234.50");
    expect(fmt("Digit5", "%")).toBe("0%");
    expect(fmt("Digit6", "^")).toBe("0.00E+00");
    expect(fmt("Digit3", "#")).toBe("yyyy-MM-dd");
    expect(fmt("Digit2", "@")).toBe("hh:mm AM/PM");
    expect(fmt("Backquote", "~")).toBe("General");
  });

  test("Ctrl+9 / Ctrl+0 hide rows / columns, with Shift unhide", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      { row: [2, 3], column: [1, 1], row_focus: 2, column_focus: 1 },
    ];
    press(ctx, "9", { ctrlKey: true, code: "Digit9" });
    expect(Object.keys(ctx.config.rowhidden)).toEqual(["2", "3"]);
    ctx.luckysheet_select_save = [
      { row: [1, 4], column: [1, 1], row_focus: 1, column_focus: 1 },
    ];
    press(ctx, "(", { ctrlKey: true, shiftKey: true, code: "Digit9" });
    expect(ctx.config.rowhidden).toEqual({});
    press(ctx, "0", { ctrlKey: true, code: "Digit0" });
    expect(Object.keys(ctx.config.colhidden)).toEqual(["1"]);
  });
});

describe("row/column shortcuts", () => {
  test("Ctrl+- / Ctrl++ produce delete/insert ops for whole rows or columns", () => {
    const ctx = makeCtx(dataSheet());
    const minus = new KeyboardEvent("keydown", {
      key: "-",
      code: "Minus",
      ctrlKey: true,
    });
    const plus = new KeyboardEvent("keydown", {
      key: "+",
      code: "Equal",
      ctrlKey: true,
      shiftKey: true,
    });
    // not a full row selection: nothing to do (Ctrl+- stays zoom)
    expect(getRowColShortcutOp(ctx, minus)).toBeNull();

    ctx.luckysheet_select_save = [
      {
        row: [1, 2],
        column: [0, 4],
        row_focus: 1,
        column_focus: 0,
        row_select: true,
      },
    ];
    expect(getRowColShortcutOp(ctx, minus)).toEqual({
      deleteRowColOp: { type: "row", start: 1, end: 2, id: "id_1" },
    });
    expect(getRowColShortcutOp(ctx, plus)).toEqual({
      insertRowColOp: {
        type: "row",
        index: 1,
        count: 2,
        direction: "lefttop",
        id: "id_1",
      },
    });

    ctx.luckysheet_select_save = [
      {
        row: [0, 9],
        column: [2, 2],
        row_focus: 0,
        column_focus: 2,
        column_select: true,
      },
    ];
    expect(getRowColShortcutOp(ctx, minus)).toEqual({
      deleteRowColOp: { type: "column", start: 2, end: 2, id: "id_1" },
    });
  });

  test("applying the delete op removes the rows", () => {
    const ctx = makeCtx(dataSheet());
    ctx.luckysheet_select_save = [
      {
        row: [0, 0],
        column: [0, 4],
        row_focus: 0,
        column_focus: 0,
        row_select: true,
      },
    ];
    const op = getRowColShortcutOp(
      ctx,
      new KeyboardEvent("keydown", { key: "-", code: "Minus", ctrlKey: true })
    );
    applyRowColShortcutOp(ctx, op);
    expect(getFlowdata(ctx)[0][0].v).toBe(2);
  });
});
