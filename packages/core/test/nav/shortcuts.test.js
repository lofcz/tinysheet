import { contextFactory } from "../factories/context";
import { handleGlobalKeyDown } from "../../src/events/keyboard";

function makeCtx(extra = {}) {
  const data = Array.from({ length: 5 }, () => Array(5).fill(null));
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
    ...extra,
  });
}

function press(ctx, key, opts = {}) {
  const e = new KeyboardEvent("keydown", {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 116,
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

describe("navigation shortcuts", () => {
  test("Ctrl+F opens Find, Ctrl+H opens Replace", () => {
    const ctx = makeCtx();
    const e = press(ctx, "f", { ctrlKey: true });
    expect(ctx.showSearch).toBe(true);
    expect(ctx.showReplace).toBe(false);
    // the browser's own find bar is suppressed
    expect(e.defaultPrevented).toBe(true);
    press(ctx, "h", { ctrlKey: true });
    expect(ctx.showReplace).toBe(true);
  });

  test("Ctrl+G and F5 open Go To", () => {
    const ctx = makeCtx();
    press(ctx, "g", { ctrlKey: true });
    expect(ctx.showGoTo).toBe(true);
    const ctx2 = makeCtx();
    const e = press(ctx2, "F5");
    expect(ctx2.showGoTo).toBe(true);
    expect(e.defaultPrevented).toBe(true);
  });

  test("not while editing a cell, and not with other modifiers", () => {
    const ctx = makeCtx({ luckysheetCellUpdate: [0, 0] });
    press(ctx, "g", { ctrlKey: true });
    expect(ctx.showGoTo).toBeUndefined();
    const ctx2 = makeCtx();
    press(ctx2, "F5", { ctrlKey: true });
    expect(ctx2.showGoTo).toBeUndefined();
  });
});
