import _ from "lodash";
import { makeContext, input, cell, value } from "../formula/helpers";
import {
  makeHost,
  type,
  val,
  cellAt,
  snapshot,
} from "../editing/historyHarness";
import {
  applySubtotals,
  getSubtotalRange,
  removeSubtotals,
  findSubtotalRows,
} from "../../src/modules/subtotal";
import {
  getOutlineGroups,
  showOutlineLevel,
  setOutlineGroupCollapsed,
} from "../../src/modules/outline";

const LIST = [
  ["Region", "Item", "Qty"],
  ["East", "a", "1"],
  ["East", "b", "2"],
  ["West", "c", "3"],
  ["North", "d", "4"],
  ["North", "e", "5"],
];

function fillList(ctx) {
  LIST.forEach((row, r) =>
    row.forEach((v, c) => input(ctx, `${"ABC"[c]}${r + 1}`, v))
  );
}

function setup() {
  const ctx = makeContext({ rows: 30, cols: 6 });
  fillList(ctx);
  ctx.luckysheet_select_save = [
    { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
  ];
  return ctx;
}

const texts = (ctx, col, from, to) =>
  _.range(from, to + 1).map((r) => {
    const c = ctx.luckysheetfile[0].data[r][col];
    return c?.f ?? c?.v ?? null;
  });

describe("Data › Subtotal", () => {
  test("the list is the current region around the active cell", () => {
    const ctx = setup();
    expect(getSubtotalRange(ctx)).toEqual({ row: [0, 5], column: [0, 2] });
  });

  test("inserts SUBTOTAL rows, a grand total and a two-level outline", () => {
    const ctx = setup();
    const res = applySubtotals(ctx, {
      range: { row: [0, 5], column: [0, 2] },
      groupBy: 0,
      fn: "sum",
      columns: [2],
    });
    expect(res).toEqual({ ok: true, range: { row: [0, 9], column: [0, 2] } });
    expect(texts(ctx, 0, 0, 9)).toEqual([
      "Region",
      "East",
      "East",
      "East Total",
      "West",
      "West Total",
      "North",
      "North",
      "North Total",
      "Grand Total",
    ]);
    expect(texts(ctx, 2, 3, 3)).toEqual(["=SUBTOTAL(9,C2:C3)"]);
    expect(cell(ctx, "C6").f).toBe("=SUBTOTAL(9,C5:C5)");
    expect(cell(ctx, "C9").f).toBe("=SUBTOTAL(9,C7:C8)");
    expect(cell(ctx, "C10").f).toBe("=SUBTOTAL(9,C2:C9)");
    expect(value(ctx, "C4")).toBe(3);
    expect(value(ctx, "C6")).toBe(3);
    expect(value(ctx, "C9")).toBe(9);
    expect(value(ctx, "C10")).toBe(15);
    expect(cell(ctx, "A4").bl).toBe(1);
    expect(ctx.config.rowOutlineLevel).toEqual({
      1: 2,
      2: 2,
      3: 1,
      4: 2,
      5: 1,
      6: 2,
      7: 2,
      8: 1,
    });
    // level 2 shows subtotals and the grand total only
    showOutlineLevel(ctx, "row", 2);
    expect(Object.keys(ctx.config.rowhidden).map(Number)).toEqual([
      1, 2, 4, 6, 7,
    ]);
    expect(value(ctx, "C10")).toBe(15);
  });

  test("other functions map to SUBTOTAL numbers and labels", () => {
    const ctx = setup();
    applySubtotals(ctx, {
      range: { row: [0, 5], column: [0, 2] },
      groupBy: 0,
      fn: "count",
      columns: [1, 2],
    });
    expect(cell(ctx, "A4").v).toBe("East Count");
    expect(cell(ctx, "B4").f).toBe("=SUBTOTAL(3,B2:B3)");
    expect(value(ctx, "B4")).toBe(2);
    expect(cell(ctx, "A10").v).toBe("Grand Count");
    expect(value(ctx, "C10")).toBe(5);
  });

  test("replacing current subtotals, then Remove All", () => {
    const ctx = setup();
    const range = { row: [0, 5], column: [0, 2] };
    const first = applySubtotals(ctx, {
      range,
      groupBy: 0,
      fn: "sum",
      columns: [2],
    });
    const second = applySubtotals(ctx, {
      range: first.range,
      groupBy: 0,
      fn: "max",
      columns: [2],
      replace: true,
    });
    expect(second.range).toEqual({ row: [0, 9], column: [0, 2] });
    expect(findSubtotalRows(ctx.luckysheetfile[0].data, second.range)).toEqual([
      3, 5, 8, 9,
    ]);
    expect(cell(ctx, "C4").f).toBe("=SUBTOTAL(4,C2:C3)");
    const back = removeSubtotals(ctx, second.range);
    expect(back).toEqual(range);
    expect(texts(ctx, 0, 0, 6)).toEqual([
      "Region",
      "East",
      "East",
      "West",
      "North",
      "North",
      null,
    ]);
    expect(ctx.config.rowOutlineLevel).toBeUndefined();
  });

  test("Remove All shows rows hidden by collapsed groups", () => {
    const ctx = setup();
    const res = applySubtotals(ctx, {
      range: { row: [0, 5], column: [0, 2] },
      groupBy: 0,
      fn: "sum",
      columns: [2],
    });
    showOutlineLevel(ctx, "row", 1);
    removeSubtotals(ctx, res.range);
    expect(Object.keys(ctx.config.rowhidden || {})).toEqual([]);
  });

  test("summary above the data", () => {
    const ctx = setup();
    applySubtotals(ctx, {
      range: { row: [0, 5], column: [0, 2] },
      groupBy: 0,
      fn: "sum",
      columns: [2],
      summaryBelow: false,
    });
    expect(texts(ctx, 0, 0, 9)).toEqual([
      "Region",
      "Grand Total",
      "East Total",
      "East",
      "East",
      "West Total",
      "West",
      "North Total",
      "North",
      "North",
    ]);
    expect(cell(ctx, "C2").f).toBe("=SUBTOTAL(9,C3:C10)");
    expect(cell(ctx, "C3").f).toBe("=SUBTOTAL(9,C4:C5)");
    expect(value(ctx, "C2")).toBe(15);
    expect(ctx.config.outlineSummaryBelow).toBe(false);
    const groups = getOutlineGroups(ctx.config, "row");
    expect(groups[0]).toMatchObject({ level: 1, start: 2, end: 9, summary: 1 });
    expect(groups[1]).toMatchObject({ level: 2, start: 3, end: 4, summary: 2 });
    setOutlineGroupCollapsed(ctx, "row", groups[1], true);
    expect(Object.keys(ctx.config.rowhidden).map(Number)).toEqual([3, 4]);
  });

  test("nested subtotals (replace off) add a level inside each group", () => {
    const ctx = makeContext({ rows: 30, cols: 6 });
    [
      ["Region", "Item", "Qty"],
      ["East", "a", "1"],
      ["East", "a", "2"],
      ["East", "b", "3"],
      ["West", "c", "4"],
    ].forEach((row, r) =>
      row.forEach((v, c) => input(ctx, `${"ABC"[c]}${r + 1}`, v))
    );
    const first = applySubtotals(ctx, {
      range: { row: [0, 4], column: [0, 2] },
      groupBy: 0,
      fn: "sum",
      columns: [2],
    });
    // East(3 rows) +1, West +1, grand +1
    expect(first.range.row).toEqual([0, 7]);
    const second = applySubtotals(ctx, {
      range: first.range,
      groupBy: 1,
      fn: "sum",
      columns: [2],
      replace: false,
    });
    expect(second.ok).toBe(true);
    expect(texts(ctx, 1, 1, 10)).toEqual([
      "a",
      "a",
      "a Total",
      "b",
      "b Total",
      null,
      "c",
      "c Total",
      null,
      null,
    ]);
    expect(value(ctx, "C4")).toBe(3);
    expect(value(ctx, "C11")).toBe(10);
    expect(ctx.config.rowOutlineLevel[1]).toBe(3);
    expect(ctx.config.rowOutlineLevel[3]).toBe(2);
    expect(ctx.config.rowOutlineLevel[6]).toBe(1);
  });

  test("page breaks between groups are recorded", () => {
    const ctx = setup();
    applySubtotals(ctx, {
      range: { row: [0, 5], column: [0, 2] },
      groupBy: 0,
      fn: "sum",
      columns: [2],
      pageBreaks: true,
    });
    expect(ctx.config.rowPageBreaks).toEqual([4, 6]);
  });

  test("errors", () => {
    const ctx = setup();
    expect(
      applySubtotals(ctx, {
        range: { row: [0, 5], column: [0, 2] },
        groupBy: 0,
        fn: "sum",
        columns: [],
      })
    ).toEqual({ ok: false, error: "noColumns" });
    expect(
      applySubtotals(ctx, {
        range: { row: [0, 0], column: [0, 2] },
        groupBy: 0,
        fn: "sum",
        columns: [2],
      })
    ).toEqual({ ok: false, error: "noData" });
  });

  test("formulas outside the list follow the inserted rows", () => {
    const ctx = setup();
    input(ctx, "E12", "=C6");
    applySubtotals(ctx, {
      range: { row: [0, 5], column: [0, 2] },
      groupBy: 0,
      fn: "sum",
      columns: [2],
    });
    // C6 (North, 5) moved below the East and West subtotal rows
    expect(cell(ctx, "E16").f).toBe("=C8");
    expect(value(ctx, "E16")).toBe(5);
  });
});

describe("undo", () => {
  test("Subtotal is one undo step", () => {
    const host = makeHost({ rows: 20, cols: 6 });
    LIST.forEach((row, r) =>
      row.forEach((v, c) => type(host, `${"ABC"[c]}${r + 1}`, v))
    );
    const before = snapshot(host.ctx);
    host.act((d) => {
      applySubtotals(d, {
        range: { row: [0, 5], column: [0, 2] },
        groupBy: 0,
        fn: "sum",
        columns: [2],
      });
    });
    expect(val(host.ctx, "C10")).toBe(15);
    expect(cellAt(host.ctx, "A4").v).toBe("East Total");
    host.undo();
    expect(snapshot(host.ctx).sheets).toEqual(before.sheets);
    expect(host.ctx.config.rowOutlineLevel).toBeUndefined();
    host.redo();
    expect(val(host.ctx, "C10")).toBe(15);
    expect(host.ctx.config.rowOutlineLevel[1]).toBe(2);
  });

  test("undo of an outline change, then of the Subtotal", () => {
    const host = makeHost({ rows: 20, cols: 6 });
    LIST.forEach((row, r) =>
      row.forEach((v, c) => type(host, `${"ABC"[c]}${r + 1}`, v))
    );
    host.act((d) => {
      applySubtotals(d, {
        range: { row: [0, 5], column: [0, 2] },
        groupBy: 0,
        fn: "sum",
        columns: [2],
      });
    });
    host.act((d) => showOutlineLevel(d, "row", 2));
    expect(Object.keys(host.ctx.config.rowhidden)).toEqual([
      "1",
      "2",
      "4",
      "6",
      "7",
    ]);
    host.undo();
    expect(host.ctx.config.rowhidden || {}).toEqual({});
    expect(cellAt(host.ctx, "A4").v).toBe("East Total");
    host.undo();
    expect(cellAt(host.ctx, "A4").v).toBe("West");
    expect(host.ctx.config.rowOutlineLevel).toBeUndefined();
  });
});
