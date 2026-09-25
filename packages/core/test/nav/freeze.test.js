import { contextFactory } from "../factories/context";
import {
  clampFrozenScroll,
  freezePanes,
  frozenScrollMin,
  getFrozenCells,
  getPaneState,
  initFreeze,
  scrollSplitPane,
  setSplitPosition,
  toggleSplitPanes,
} from "../../src/modules/freeze";
import { handleFreeze } from "../../src/modules/toolbar";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";

const grid = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(null));

function makeCtx(activeR, activeC, extra = {}) {
  return contextFactory({
    luckysheetfile: [
      { id: "id_1", name: "Sheet1", order: 0, data: grid(40, 12) },
    ],
    visibledatarow: Array.from({ length: 40 }, (_, i) => (i + 1) * 20),
    visibledatacolumn: Array.from({ length: 12 }, (_, i) => (i + 1) * 70),
    cellmainHeight: 400,
    cellmainWidth: 560,
    columnHeaderHeight: 20,
    rowHeaderWidth: 46,
    scrollTop: 0,
    scrollLeft: 0,
    config: {},
    luckysheet_select_save: [
      {
        row: [activeR, activeR],
        column: [activeC, activeC],
        row_focus: activeR,
        column_focus: activeC,
      },
    ],
    ...extra,
  });
}

const frozen = (ctx) => ctx.luckysheetfile[0].frozen;

describe("Freeze Panes (Excel View > Freeze Panes)", () => {
  test("at C4 freezes rows 1-3 and columns A-B", () => {
    const ctx = makeCtx(3, 2);
    expect(freezePanes(ctx, "panes")).toBe("ok");
    expect(frozen(ctx)).toEqual({
      type: "rangeBoth",
      range: { row_focus: 2, column_focus: 1 },
    });
    // the scrolling pane starts right after the frozen part
    expect(ctx.scrollTop).toBe(0);
    expect(ctx.scrollLeft).toBe(0);
  });

  test("in column A freezes rows only; in row 1 columns only", () => {
    const ctx = makeCtx(5, 0);
    freezePanes(ctx, "panes");
    expect(frozen(ctx)).toMatchObject({
      type: "rangeRow",
      range: { row_focus: 4 },
    });
    const ctx2 = makeCtx(0, 3);
    freezePanes(ctx2, "panes");
    expect(frozen(ctx2)).toMatchObject({
      type: "rangeColumn",
      range: { column_focus: 2 },
    });
  });

  test("at A1 freezes in the middle of the window", () => {
    const ctx = makeCtx(0, 0);
    freezePanes(ctx, "panes");
    // 400px / 2 = 200px -> row 10, 560px / 2 = 280px -> column D
    expect(frozen(ctx)).toEqual({
      type: "rangeBoth",
      range: { row_focus: 9, column_focus: 3 },
    });
  });

  test("merged active cell freezes above/left of the merge", () => {
    const ctx = makeCtx(4, 3);
    ctx.luckysheetfile[0].data[4][3] = { mc: { r: 3, c: 2, rs: 2, cs: 2 } };
    freezePanes(ctx, "panes");
    expect(frozen(ctx).range).toEqual({ row_focus: 2, column_focus: 1 });
  });

  test("top row, first column, unfreeze", () => {
    const ctx = makeCtx(10, 5);
    freezePanes(ctx, "topRow");
    expect(frozen(ctx)).toEqual({
      type: "rangeRow",
      range: { row_focus: 0, column_focus: 0 },
    });
    freezePanes(ctx, "firstColumn");
    expect(frozen(ctx)).toEqual({
      type: "rangeColumn",
      range: { row_focus: 0, column_focus: 0 },
    });
    freezePanes(ctx, "unfreeze");
    expect(frozen(ctx)).toBeUndefined();
  });

  test("a frozen part larger than the window is allowed (clipped)", () => {
    const ctx = makeCtx(30, 1);
    expect(freezePanes(ctx, "panes", { dryRun: true })).toBe("ok");
    expect(freezePanes(ctx, "panes")).toBe("ok");
    expect(frozen(ctx)).toEqual({
      type: "rangeBoth",
      range: { row_focus: 29, column_focus: 0 },
    });
  });

  test("freezes from the scrolled position (Excel)", () => {
    // scrolled to row 6 / column C: the top-left visible cell is C6
    const ctx = makeCtx(9, 4, { scrollTop: 100, scrollLeft: 140 });
    expect(freezePanes(ctx, "panes")).toBe("ok");
    // rows 6-9 and columns C-D frozen, rows 1-5 / columns A-B hidden
    expect(frozen(ctx)).toEqual({
      type: "rangeBoth",
      range: { row_focus: 8, column_focus: 3 },
      top: 5,
      left: 2,
    });
    expect(getFrozenCells(ctx.luckysheetfile[0])).toEqual({
      top: 5,
      rows: 4,
      left: 2,
      columns: 2,
      split: false,
    });
    // the scrolling pane continues right after the frozen part, and cannot
    // scroll back over it
    expect(ctx.scrollTop).toBe(100);
    expect(ctx.scrollLeft).toBe(140);
    const cache = {};
    initFreeze(ctx, cache, "id_1");
    const h = cache.freezen.id_1.horizontal.freezenhorizontaldata;
    // the frozen pane shows rows 6-9: 100px to 180px
    expect(h[0]).toBe(180);
    expect(h[1]).toBe(9);
    expect(h[2]).toBe(100);
    const v = cache.freezen.id_1.vertical.freezenverticaldata;
    expect(v[0]).toBe(280);
    expect(v[2]).toBe(140);
  });

  test("a row mostly scrolled out does not count as visible", () => {
    const ctx = makeCtx(9, 0, { scrollTop: 105 });
    freezePanes(ctx, "panes");
    expect(frozen(ctx)).toEqual({
      type: "rangeRow",
      range: { row_focus: 8, column_focus: 0 },
      top: 5,
    });
    const ctx2 = makeCtx(9, 0, { scrollTop: 115 });
    freezePanes(ctx2, "panes");
    expect(frozen(ctx2).top).toBe(6);
  });

  test("at the top-left visible cell freezes the middle of the window", () => {
    const ctx = makeCtx(5, 2, { scrollTop: 100, scrollLeft: 140 });
    freezePanes(ctx, "panes");
    // 100px + 200px -> row 15, 140px + 280px -> column G
    expect(frozen(ctx)).toEqual({
      type: "rangeBoth",
      range: { row_focus: 14, column_focus: 5 },
      top: 5,
      left: 2,
    });
  });

  test("Freeze Top Row / First Column freeze the top visible row/column", () => {
    const ctx = makeCtx(10, 5, { scrollTop: 100, scrollLeft: 140 });
    freezePanes(ctx, "topRow");
    expect(frozen(ctx)).toEqual({
      type: "rangeRow",
      range: { row_focus: 5, column_focus: 0 },
      top: 5,
    });
    expect(ctx.scrollTop).toBe(100);
    freezePanes(ctx, "unfreeze");
    ctx.scrollLeft = 140;
    freezePanes(ctx, "firstColumn");
    expect(frozen(ctx)).toEqual({
      type: "rangeColumn",
      range: { row_focus: 0, column_focus: 2 },
      left: 2,
    });
  });

  test("the scrolling pane can't scroll back over the frozen part", () => {
    const ctx = makeCtx(9, 4, { scrollTop: 100, scrollLeft: 140 });
    freezePanes(ctx, "panes");
    expect(frozenScrollMin(ctx)).toEqual({ top: 100, left: 140 });
    ctx.scrollTop = 20;
    ctx.scrollLeft = 500;
    expect(clampFrozenScroll(ctx)).toBe(true);
    expect(ctx.scrollTop).toBe(100);
    expect(ctx.scrollLeft).toBe(500);
    // unscrolled freezes and split panes scroll freely
    freezePanes(ctx, "unfreeze");
    expect(frozenScrollMin(ctx)).toEqual({ top: 0, left: 0 });
    toggleSplitPanes(ctx);
    expect(frozenScrollMin(ctx)).toEqual({ top: 0, left: 0 });
  });

  test("unfreeze scrolls back to the first frozen row and column", () => {
    const ctx = makeCtx(9, 4, { scrollTop: 100, scrollLeft: 140 });
    freezePanes(ctx, "panes");
    ctx.scrollTop = 300;
    ctx.scrollLeft = 70;
    freezePanes(ctx, "unfreeze");
    expect(frozen(ctx)).toBeUndefined();
    expect(ctx.scrollTop).toBe(100);
    expect(ctx.scrollLeft).toBe(140);
  });

  test("scrolled frozen panes follow inserted and deleted rows/columns", () => {
    const ctx = makeCtx(9, 4, { scrollTop: 100, scrollLeft: 140 });
    ctx.luckysheetfile[0].config = {};
    freezePanes(ctx, "panes");
    // above the hidden rows: everything moves down
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(frozen(ctx)).toMatchObject({ top: 7, range: { row_focus: 10 } });
    // inside the frozen rows: the frozen part grows
    insertRowCol(ctx, {
      type: "row",
      index: 8,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(frozen(ctx)).toMatchObject({ top: 7, range: { row_focus: 11 } });
    // below: nothing changes
    insertRowCol(ctx, {
      type: "row",
      index: 20,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(frozen(ctx)).toMatchObject({ top: 7, range: { row_focus: 11 } });
    deleteRowCol(ctx, { type: "row", start: 0, end: 1, id: "id_1" });
    expect(frozen(ctx)).toMatchObject({ top: 5, range: { row_focus: 9 } });
    // the first frozen rows deleted: the next row becomes the first
    deleteRowCol(ctx, { type: "row", start: 4, end: 6, id: "id_1" });
    expect(frozen(ctx)).toMatchObject({ top: 4, range: { row_focus: 6 } });
    deleteRowCol(ctx, { type: "column", start: 0, end: 0, id: "id_1" });
    expect(frozen(ctx)).toMatchObject({
      left: 1,
      range: { column_focus: 2 },
    });
    // every frozen column deleted: only the rows stay frozen
    deleteRowCol(ctx, { type: "column", start: 1, end: 2, id: "id_1" });
    expect(frozen(ctx)).toEqual({
      type: "rangeRow",
      range: { row_focus: 6, column_focus: 0 },
      top: 4,
    });
    deleteRowCol(ctx, { type: "row", start: 4, end: 6, id: "id_1" });
    expect(frozen(ctx)).toBeUndefined();
  });

  test("toolbar menu values delegate to freezePanes", () => {
    const ctx = makeCtx(3, 2);
    expect(handleFreeze(ctx, "freeze-panes")).toBe("ok");
    expect(frozen(ctx).type).toBe("rangeBoth");
    handleFreeze(ctx, "freeze-top-row");
    expect(frozen(ctx).type).toBe("rangeRow");
    handleFreeze(ctx, "freeze-first-column");
    expect(frozen(ctx).type).toBe("rangeColumn");
    handleFreeze(ctx, "unfreeze");
    expect(frozen(ctx)).toBeUndefined();
  });

  test("read-only workbooks can't freeze", () => {
    const ctx = makeCtx(3, 2, { allowEdit: false });
    expect(freezePanes(ctx, "panes")).toBe("noop");
    expect(frozen(ctx)).toBeUndefined();
  });

  test("frozen rows follow inserted and deleted rows above them", () => {
    const ctx = makeCtx(3, 2);
    ctx.luckysheetfile[0].config = {};
    freezePanes(ctx, "panes");
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(frozen(ctx).range.row_focus).toBe(4);
    deleteRowCol(ctx, { type: "row", start: 0, end: 0, id: "id_1" });
    expect(frozen(ctx).range.row_focus).toBe(3);
  });

  test("the render cache follows zoom (row/column sizes)", () => {
    const ctx = makeCtx(3, 2);
    freezePanes(ctx, "panes");
    const cache = {};
    initFreeze(ctx, cache, "id_1");
    expect(cache.freezen.id_1.horizontal.freezenhorizontaldata[0]).toBe(60);
    ctx.visibledatarow = ctx.visibledatarow.map((v) => v * 2);
    initFreeze(ctx, cache, "id_1");
    expect(cache.freezen.id_1.horizontal.freezenhorizontaldata[0]).toBe(120);
    expect(cache.freezen.id_1.vertical.freezenverticaldata[0]).toBe(140);
  });
});

describe("Split panes", () => {
  test("toggle a split at the active cell, and off again", () => {
    const ctx = makeCtx(5, 2);
    expect(toggleSplitPanes(ctx)).toBe(true);
    expect(frozen(ctx)).toEqual({
      type: "rangeBoth",
      range: { row_focus: 4, column_focus: 1 },
      split: true,
      top: 0,
      left: 0,
    });
    expect(getPaneState(ctx)).toBe("split");
    toggleSplitPanes(ctx);
    expect(getPaneState(ctx)).toBe("none");
  });

  test("the top pane scrolls on its own and the render cache follows", () => {
    const ctx = makeCtx(5, 2);
    toggleSplitPanes(ctx);
    expect(scrollSplitPane(ctx, "row", 3)).toBe(true);
    expect(frozen(ctx)).toMatchObject({ top: 3, range: { row_focus: 7 } });
    const cache = {};
    initFreeze(ctx, cache, "id_1");
    const h = cache.freezen.id_1.horizontal.freezenhorizontaldata;
    // pane shows rows 4-8: from 60px to 160px
    expect(h[0]).toBe(160);
    expect(h[1]).toBe(8);
    expect(h[2]).toBe(60);
    expect(scrollSplitPane(ctx, "row", -10)).toBe(true);
    expect(frozen(ctx)).toMatchObject({ top: 0, range: { row_focus: 4 } });
    expect(scrollSplitPane(ctx, "row", -1)).toBe(false);
  });

  test("dragging the bars moves or removes them", () => {
    const ctx = makeCtx(5, 2);
    toggleSplitPanes(ctx);
    setSplitPosition(ctx, "row", 8);
    expect(frozen(ctx).range.row_focus).toBe(8);
    setSplitPosition(ctx, "column", null);
    expect(frozen(ctx).type).toBe("rangeRow");
    setSplitPosition(ctx, "row", null);
    expect(frozen(ctx)).toBeUndefined();
  });

  test("freezing replaces a split, unfreeze removes it", () => {
    const ctx = makeCtx(5, 2);
    toggleSplitPanes(ctx);
    freezePanes(ctx, "panes");
    expect(getPaneState(ctx)).toBe("frozen");
    toggleSplitPanes(ctx);
    expect(getPaneState(ctx)).toBe("split");
    freezePanes(ctx, "unfreeze");
    expect(getPaneState(ctx)).toBe("none");
  });
});
