import { contextFactory } from "../factories/context";
import {
  cellFocus,
  dropdownArrowPressed,
} from "../../src/modules/dataVerification";

const LIST = { type: "dropdown", value1: "a,b", prohibitInput: true };

function listCtx() {
  const ctx = contextFactory();
  ctx.luckysheetfile[0].dataVerification = { "1_1": LIST };
  ctx.visibledatarow = [20, 40, 60, 80];
  ctx.visibledatacolumn = [100, 200, 300, 400];
  ctx.zoomRatio = 1;
  return ctx;
}

function mountChrome() {
  document.body.innerHTML =
    '<div id="luckysheet-dataVerification-showHintBox"></div>' +
    '<div id="luckysheet-dataVerification-dropdown-btn" style="display:none"></div>';
  return {
    hint: document.getElementById("luckysheet-dataVerification-showHintBox"),
    btn: document.getElementById("luckysheet-dataVerification-dropdown-btn"),
  };
}

describe("focus of a list cell", () => {
  test("shows the arrow even when the selection it replaces was read-only", () => {
    const { btn } = mountChrome();
    const ctx = listCtx();
    // the previous click sat on a read-only column
    ctx.config = { colReadOnly: { 0: 1 } };
    ctx.luckysheet_select_save = [
      { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
    ];
    cellFocus(ctx, 1, 1, true);
    expect(btn.style.display).toBe("block");
  });

  test("shows no arrow on a read-only list cell", () => {
    const { btn } = mountChrome();
    const ctx = listCtx();
    ctx.config = { colReadOnly: { 1: 1 } };
    cellFocus(ctx, 1, 1, true);
    expect(btn.style.display).toBe("none");
  });
});

describe("press on the chevron of a list cell", () => {
  test("opens the list only in the last 20px of the cell", () => {
    mountChrome();
    const ctx = listCtx();
    expect(dropdownArrowPressed(ctx, 1, 1, 150, 200)).toBe(false);
    expect(dropdownArrowPressed(ctx, 1, 1, 185, 200)).toBe(true);
  });

  test("hides the invalid-value hint the focus showed", () => {
    const { hint } = mountChrome();
    hint.style.display = "block";
    const ctx = listCtx();
    expect(dropdownArrowPressed(ctx, 1, 1, 190, 200)).toBe(true);
    expect(hint.style.display).toBe("none");
  });

  test("ignores other cells and read-only list cells", () => {
    mountChrome();
    const ctx = listCtx();
    expect(dropdownArrowPressed(ctx, 0, 0, 95, 100)).toBe(false);
    ctx.config = { colReadOnly: { 1: 1 } };
    expect(dropdownArrowPressed(ctx, 1, 1, 190, 200)).toBe(false);
  });
});
