import {
  autofitColumns,
  autofitRows,
  autoGrowRowAfterEdit,
  getAutofitTargets,
  canvasAutofitMeasure,
} from "../../src";
import { contextFactory } from "../factories/context";

// 7px per character; wrapped text breaks into lines of `colWidth / 7`
// characters, 18px per line at 10pt.
const measure = {
  width: (cell) => `${cell.m ?? cell.v}`.length * 7,
  height: (cell, r, c, colWidth) => {
    const text = `${cell.m ?? cell.v}`;
    const fs = cell.fs || 10;
    const lineH = fs * 1.8;
    if (`${cell.tb}` !== "2") return lineH;
    const perLine = Math.max(1, Math.floor(colWidth / 7));
    return Math.ceil(text.length / perLine) * lineH;
  },
};

function makeCtx() {
  const data = [];
  for (let r = 0; r < 5; r += 1) data.push(new Array(4).fill(null));
  const ctx = contextFactory({
    defaultrowlen: 19,
    defaultcollen: 73,
    luckysheetfile: [{ name: "S", id: "id_1", data, order: 0, config: {} }],
  });
  return { ctx, data, sheet: ctx.luckysheetfile[0] };
}

describe("autofit", () => {
  it("fits a column to its widest displayed text and ignores merges and hidden rows", () => {
    const { ctx, data, sheet } = makeCtx();
    data[0][1] = { v: 1234.5, m: "$1,234.50" }; // formatted text is measured
    data[1][1] = { v: "short" };
    data[2][1] = {
      v: "a very long merged text",
      mc: { r: 2, c: 1, rs: 1, cs: 2 },
    };
    data[3][1] = { v: "hidden row with long text" };
    sheet.config = { rowhidden: { 3: 0 }, customWidth: { 1: 1 } };
    autofitColumns(ctx, [1], { measure });
    expect(sheet.config.columnlen[1]).toBe(9 * 7 + 6);
    expect(sheet.config.customWidth[1]).toBeUndefined();
    expect(ctx.config).toBe(sheet.config);
  });

  it("resets an empty column to the default width", () => {
    const { ctx, sheet } = makeCtx();
    sheet.config = { columnlen: { 2: 200 } };
    autofitColumns(ctx, [2], { measure });
    expect(sheet.config.columnlen[2]).toBeUndefined();
  });

  it("fits row heights to fonts and wrapped text, clearing the custom flag", () => {
    const { ctx, data, sheet } = makeCtx();
    data[0][0] = { v: "big", fs: 20 };
    data[1][0] = { v: "x".repeat(30), tb: "2" }; // 73px wide column: 10 chars/line
    sheet.config = { rowlen: { 2: 50 }, customHeight: { 1: 1 } };
    autofitRows(ctx, [0, 1, 2], { measure });
    expect(sheet.config.rowlen[0]).toBe(36);
    expect(sheet.config.rowlen[1]).toBe(54);
    expect(sheet.config.rowlen[2]).toBeUndefined(); // empty: default height
    expect(sheet.config.customHeight[1]).toBeUndefined();
  });

  it("autofits every selected column when the border belongs to the selection", () => {
    const { ctx } = makeCtx();
    ctx.luckysheet_select_save = [
      { row: [0, 4], column: [1, 2], column_select: true },
      { row: [0, 4], column: [3, 3], column_select: true },
    ];
    expect(getAutofitTargets(ctx, "column", 2)).toEqual([1, 2, 3]);
    expect(getAutofitTargets(ctx, "column", 0)).toEqual([0]);
    expect(getAutofitTargets(ctx, "row", 1)).toEqual([1]);
  });

  it("grows and shrinks wrapped rows after an edit unless the height is custom", () => {
    const { ctx, data, sheet } = makeCtx();
    data[0][0] = { v: "x".repeat(25), tb: "2" };
    autoGrowRowAfterEdit(ctx, 0, 0, { measure });
    expect(sheet.config.rowlen[0]).toBe(54);
    data[0][0] = { v: "short", tb: "2" };
    autoGrowRowAfterEdit(ctx, 0, 0, { measure });
    expect(sheet.config.rowlen[0]).toBeUndefined();

    sheet.config.customHeight = { 0: 1 };
    sheet.config.rowlen[0] = 30;
    data[0][0] = { v: "x".repeat(40), tb: "2" };
    autoGrowRowAfterEdit(ctx, 0, 0, { measure });
    expect(sheet.config.rowlen[0]).toBe(30);

    // plain edits don't touch the row height
    sheet.config.rowlen[1] = 33;
    data[1][0] = { v: "plain" };
    autoGrowRowAfterEdit(ctx, 1, 0, { measure });
    expect(sheet.config.rowlen[1]).toBe(33);
  });

  it("measures with the canvas layout engine by default", () => {
    const { ctx } = makeCtx();
    const m = canvasAutofitMeasure(ctx);
    expect(m).not.toBeNull();
    expect(m.width({ v: "hello", m: "hello" }, 0, 0)).toBeGreaterThan(0);
  });
});
