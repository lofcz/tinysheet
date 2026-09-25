import { contextFactory } from "../factories/context";
import {
  freezePanes,
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
    scrollTop: 100,
    scrollLeft: 50,
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

  test("a frozen part larger than the window is refused", () => {
    const ctx = makeCtx(30, 1);
    expect(freezePanes(ctx, "panes")).toBe("tooLarge");
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
