import { makeContext, input, value } from "../formula/helpers";
import {
  autoOutline,
  clearOutline,
  getCollapsedIndices,
  getOutlineConfig,
  getOutlineGroups,
  getOutlineGutterSize,
  getOutlineMaxLevel,
  groupOutline,
  groupSelection,
  selectionOutlineAxis,
  setOutlineGroupCollapsed,
  setOutlineSettings,
  showHideDetail,
  showOutlineLevel,
  ungroupOutline,
} from "../../src/modules/outline";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { runShortcut } from "../../src/modules/extensions";

function hidden(ctx, key = "rowhidden") {
  return Object.keys(ctx.config[key] || {})
    .map(Number)
    .sort((a, b) => a - b);
}

function groups(ctx, axis = "row") {
  return getOutlineGroups(getOutlineConfig(ctx), axis).map(
    ({ level, start, end, summary, collapsed }) => ({
      level,
      start,
      end,
      summary,
      collapsed,
    })
  );
}

function select(ctx, row, column, extra = {}) {
  ctx.luckysheet_select_save = [
    { row, column, row_focus: row[0], column_focus: column[0], ...extra },
  ];
}

describe("group / ungroup", () => {
  test("levels nest and groups are maximal runs", () => {
    const ctx = makeContext({ rows: 20, cols: 6 });
    groupOutline(ctx, "row", 1, 8);
    groupOutline(ctx, "row", 2, 4);
    groupOutline(ctx, "row", 6, 7);
    expect(getOutlineMaxLevel(ctx.config, "row")).toBe(2);
    expect(groups(ctx)).toEqual([
      { level: 1, start: 1, end: 8, summary: 9, collapsed: false },
      { level: 2, start: 2, end: 4, summary: 5, collapsed: false },
      { level: 2, start: 6, end: 7, summary: 8, collapsed: false },
    ]);
    // stored on the sheet too
    expect(ctx.luckysheetfile[0].config.rowOutlineLevel).toEqual(
      ctx.config.rowOutlineLevel
    );
    ungroupOutline(ctx, "row", 2, 4);
    expect(groups(ctx).map((g) => [g.level, g.start, g.end])).toEqual([
      [1, 1, 8],
      [2, 6, 7],
    ]);
  });

  test("at most 7 group levels (8 level buttons)", () => {
    const ctx = makeContext({ rows: 20, cols: 6 });
    for (let k = 0; k < 7; k += 1) {
      expect(groupOutline(ctx, "row", 1, 3).ok).toBe(true);
    }
    expect(groupOutline(ctx, "row", 1, 3)).toEqual({
      ok: false,
      error: "maxLevel",
    });
    expect(getOutlineMaxLevel(ctx.config, "row")).toBe(7);
  });

  test("ungrouping rows that are not grouped reports an error", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    expect(ungroupOutline(ctx, "row", 1, 3)).toEqual({
      ok: false,
      error: "notGrouped",
    });
  });

  test("columns have their own outline", () => {
    const ctx = makeContext({ rows: 10, cols: 8 });
    groupOutline(ctx, "column", 1, 3);
    expect(groups(ctx, "column")).toEqual([
      { level: 1, start: 1, end: 3, summary: 4, collapsed: false },
    ]);
    expect(groups(ctx, "row")).toEqual([]);
    setOutlineGroupCollapsed(ctx, "column", { level: 1, start: 1 }, true);
    expect(hidden(ctx, "colhidden")).toEqual([1, 2, 3]);
  });
});

describe("collapse / expand", () => {
  function nested() {
    const ctx = makeContext({ rows: 20, cols: 6 });
    groupOutline(ctx, "row", 1, 8);
    groupOutline(ctx, "row", 2, 4);
    return ctx;
  }

  test("collapsing hides the rows, expanding shows them", () => {
    const ctx = nested();
    setOutlineGroupCollapsed(ctx, "row", { level: 2, start: 2 }, true);
    expect(hidden(ctx)).toEqual([2, 3, 4]);
    expect(ctx.config.rowOutlineCollapsed).toEqual({ 5: 2 });
    expect(groups(ctx)[1].collapsed).toBe(true);
    setOutlineGroupCollapsed(ctx, "row", { level: 2, start: 2 }, false);
    expect(hidden(ctx)).toEqual([]);
    expect(ctx.config.rowOutlineCollapsed).toBeUndefined();
  });

  test("expanding a parent keeps a collapsed child collapsed", () => {
    const ctx = nested();
    setOutlineGroupCollapsed(ctx, "row", { level: 2, start: 2 }, true);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 1 }, true);
    expect(hidden(ctx)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 1 }, false);
    expect(hidden(ctx)).toEqual([2, 3, 4]);
  });

  test("rows hidden by a filter stay hidden when a group expands", () => {
    const ctx = nested();
    ctx.filter = { 0: { rowhidden: { 3: 0 } } };
    ctx.config.rowhidden = { 3: 0 };
    setOutlineGroupCollapsed(ctx, "row", { level: 2, start: 2 }, true);
    setOutlineGroupCollapsed(ctx, "row", { level: 2, start: 2 }, false);
    expect(hidden(ctx)).toEqual([3]);
  });

  test("level buttons collapse every group of that level and deeper", () => {
    const ctx = nested();
    showOutlineLevel(ctx, "row", 2);
    expect(hidden(ctx)).toEqual([2, 3, 4]);
    showOutlineLevel(ctx, "row", 1);
    expect(hidden(ctx)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(groups(ctx).every((g) => g.collapsed)).toBe(true);
    showOutlineLevel(ctx, "row", 3);
    expect(hidden(ctx)).toEqual([]);
    expect(groups(ctx).some((g) => g.collapsed)).toBe(false);
  });

  test("SUBTOTAL 109 skips collapsed rows, SUBTOTAL 9 does not", () => {
    const ctx = makeContext({ rows: 12, cols: 4 });
    ["1", "2", "3", "4"].forEach((v, i) => input(ctx, `A${i + 1}`, v));
    input(ctx, "B1", "=SUBTOTAL(109,A1:A4)");
    input(ctx, "C1", "=SUBTOTAL(9,A1:A4)");
    groupOutline(ctx, "row", 1, 2);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 1 }, true);
    expect(value(ctx, "B1")).toBe(5);
    expect(value(ctx, "C1")).toBe(10);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 1 }, false);
    expect(value(ctx, "B1")).toBe(10);
  });

  test("Show / Hide Detail act on the active cell's group", () => {
    const ctx = nested();
    select(ctx, [3, 3], [0, 0]);
    showHideDetail(ctx, false);
    expect(hidden(ctx)).toEqual([2, 3, 4]);
    // on the summary row
    select(ctx, [5, 5], [0, 0]);
    showHideDetail(ctx, true);
    expect(hidden(ctx)).toEqual([]);
    select(ctx, [15, 15], [0, 0]);
    expect(showHideDetail(ctx, false)).toBe(false);
    expect(ctx.warnDialog).toBeTruthy();
  });

  test("ungrouping a collapsed group shows its rows", () => {
    const ctx = nested();
    setOutlineGroupCollapsed(ctx, "row", { level: 2, start: 2 }, true);
    ungroupOutline(ctx, "row", 2, 4);
    expect(hidden(ctx)).toEqual([]);
    expect(ctx.config.rowOutlineCollapsed).toBeUndefined();
  });

  test("Clear Outline removes all levels and shows collapsed rows", () => {
    const ctx = nested();
    groupOutline(ctx, "column", 1, 2);
    showOutlineLevel(ctx, "row", 1);
    clearOutline(ctx);
    expect(ctx.config.rowOutlineLevel).toBeUndefined();
    expect(ctx.config.colOutlineLevel).toBeUndefined();
    expect(hidden(ctx)).toEqual([]);
  });

  test("Clear Outline of a range keeps the rest", () => {
    const ctx = nested();
    groupOutline(ctx, "row", 12, 14);
    clearOutline(ctx, { row: [10, 15], column: [0, 0] });
    expect(groups(ctx).map((g) => [g.level, g.start, g.end])).toEqual([
      [1, 1, 8],
      [2, 2, 4],
    ]);
  });
});

describe("selection commands and shortcuts", () => {
  test("the axis follows whole-row / whole-column selections", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    select(ctx, [1, 3], [0, 5]);
    expect(selectionOutlineAxis(ctx)).toBe("row");
    select(ctx, [0, 9], [1, 2]);
    expect(selectionOutlineAxis(ctx)).toBe("column");
    select(ctx, [1, 2], [1, 2]);
    expect(selectionOutlineAxis(ctx)).toBe(null);
  });

  test("Shift+Alt+Right groups, Shift+Alt+Left ungroups", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    select(ctx, [1, 3], [0, 5], { row_select: true });
    const key = (k) =>
      runShortcut(
        ctx,
        {
          key: k,
          shiftKey: true,
          altKey: true,
          ctrlKey: false,
          metaKey: false,
        },
        false
      );
    expect(key("ArrowRight")).toBe(true);
    expect(ctx.config.rowOutlineLevel).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(key("ArrowLeft")).toBe(true);
    expect(ctx.config.rowOutlineLevel).toBeUndefined();
  });

  test("a plain range asks rows or columns", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    select(ctx, [1, 2], [1, 2]);
    groupSelection(ctx);
    expect(ctx.outlinePrompt).toBe("group");
    groupSelection(ctx, false, "column");
    expect(ctx.config.colOutlineLevel).toEqual({ 1: 1, 2: 1 });
  });

  test("the gutter only appears when there is an outline", () => {
    const ctx = makeContext({ rows: 10, cols: 6 });
    expect(getOutlineGutterSize(ctx)).toMatchObject({ left: 0, top: 0 });
    groupOutline(ctx, "row", 1, 2);
    groupOutline(ctx, "row", 1, 1);
    const size = getOutlineGutterSize(ctx);
    expect(size.left).toBeGreaterThan(0);
    expect(size.rowLevels).toBe(2);
    expect(size.top).toBe(0);
  });
});

describe("structural changes", () => {
  test("inserting rows shifts levels and grows the group", () => {
    const ctx = makeContext({ rows: 20, cols: 6 });
    groupOutline(ctx, "row", 2, 4);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 2 }, true);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 2 }, false);
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(groups(ctx).map((g) => [g.start, g.end])).toEqual([[4, 6]]);
    // inside the group: the new row joins it
    insertRowCol(ctx, {
      type: "row",
      index: 4,
      count: 1,
      direction: "rightbottom",
      id: "id_1",
    });
    expect(groups(ctx).map((g) => [g.start, g.end])).toEqual([[4, 7]]);
  });

  test("collapsed flags and page breaks follow deleted rows", () => {
    const ctx = makeContext({ rows: 20, cols: 6 });
    groupOutline(ctx, "row", 5, 7);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 5 }, true);
    ctx.config.rowPageBreaks = [9, 12];
    deleteRowCol(ctx, { type: "row", start: 0, end: 1, id: "id_1" });
    expect(groups(ctx)).toEqual([
      { level: 1, start: 3, end: 5, summary: 6, collapsed: true },
    ]);
    expect(ctx.config.rowPageBreaks).toEqual([7, 10]);
    expect(hidden(ctx)).toEqual([3, 4, 5]);
  });

  test("columns shift on column insert", () => {
    const ctx = makeContext({ rows: 6, cols: 10 });
    groupOutline(ctx, "column", 2, 3);
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(groups(ctx, "column").map((g) => [g.start, g.end])).toEqual([
      [3, 4],
    ]);
  });
});

describe("Auto Outline and settings", () => {
  test("builds nested groups from SUM / SUBTOTAL formulas", () => {
    const ctx = makeContext({ rows: 20, cols: 6 });
    // A1 header, 2-3 detail, 4 subtotal, 5-6 detail, 7 subtotal, 8 grand
    input(ctx, "B1", "Qty");
    ["1", "2"].forEach((v, i) => input(ctx, `B${i + 2}`, v));
    input(ctx, "B4", "=SUBTOTAL(9,B2:B3)");
    ["3", "4"].forEach((v, i) => input(ctx, `B${i + 5}`, v));
    input(ctx, "B7", "=SUBTOTAL(9,B5:B6)");
    input(ctx, "B8", "=SUBTOTAL(9,B2:B7)");
    expect(autoOutline(ctx)).toBe(true);
    expect(ctx.config.rowOutlineLevel).toEqual({
      1: 2,
      2: 2,
      3: 1,
      4: 2,
      5: 2,
      6: 1,
    });
    expect(ctx.config.outlineSummaryBelow).toBeUndefined();
  });

  test("column groups from summaries to the right, rows above", () => {
    const ctx = makeContext({ rows: 10, cols: 8 });
    ["1", "2", "3"].forEach((v, i) => input(ctx, `${"ABC"[i]}1`, v));
    input(ctx, "D1", "=SUM(A1:C1)");
    input(ctx, "F2", "=SUM(F3:F5)");
    autoOutline(ctx);
    expect(ctx.config.colOutlineLevel).toEqual({ 0: 1, 1: 1, 2: 1 });
    expect(ctx.config.rowOutlineLevel).toEqual({ 2: 1, 3: 1, 4: 1 });
    expect(ctx.config.outlineSummaryBelow).toBe(false);
    expect(groups(ctx)[0].summary).toBe(1);
  });

  test("reports when there is nothing to outline", () => {
    const ctx = makeContext({ rows: 10, cols: 8 });
    input(ctx, "A1", "5");
    expect(autoOutline(ctx)).toBe(false);
    expect(ctx.warnDialog).toBeTruthy();
  });

  test("changing the summary position keeps groups collapsed", () => {
    const ctx = makeContext({ rows: 20, cols: 6 });
    groupOutline(ctx, "row", 3, 5);
    setOutlineGroupCollapsed(ctx, "row", { level: 1, start: 3 }, true);
    setOutlineSettings(ctx, { summaryBelow: false });
    expect(ctx.config.outlineSummaryBelow).toBe(false);
    expect(groups(ctx)).toEqual([
      { level: 1, start: 3, end: 5, summary: 2, collapsed: true },
    ]);
    setOutlineSettings(ctx, { summaryBelow: true });
    expect(ctx.config.outlineSummaryBelow).toBeUndefined();
    expect(getCollapsedIndices(ctx.config, "row")).toEqual(new Set([3, 4, 5]));
  });
});
