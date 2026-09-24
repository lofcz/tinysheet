import { contextFactory } from "../factories/context";
import {
  autoFillToDataEnd,
  dropCellCache,
  fillSelectionFromEdge,
  getTypeItemHide,
  updateDropCell,
} from "../../src/modules/dropCell";
import { getFlowdata } from "../../src/context";

const grid = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(null));
const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const text = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeCtx(data, extra = {}) {
  return contextFactory({
    luckysheetfile: [{ id: "id_1", name: "Sheet1", order: 0, data }],
    visibledatarow: data.map((_, i) => (i + 1) * 20),
    visibledatacolumn: data[0].map((_, i) => (i + 1) * 74),
    luckysheetCellUpdate: [],
    config: {},
    ...extra,
  });
}

function fill(ctx, copyRange, applyRange, direction, applyType = "1") {
  dropCellCache.copyRange = copyRange;
  dropCellCache.applyRange = applyRange;
  dropCellCache.direction = direction;
  dropCellCache.applyType = applyType;
  dropCellCache.ctrlKey = false;
  updateDropCell(ctx);
}

const col = (ctx, c, from, to) =>
  getFlowdata(ctx)
    .slice(from, to + 1)
    .map((row) => row[c]?.v ?? null);

describe("fill handle", () => {
  test("fills a number series down", () => {
    const data = grid(6, 2);
    data[0][0] = num(1);
    data[1][0] = num(2);
    const ctx = makeCtx(data);
    fill(
      ctx,
      { row: [0, 1], column: [0, 0] },
      { row: [2, 4], column: [0, 0] },
      "down"
    );
    expect(col(ctx, 0, 0, 5)).toEqual([1, 2, 3, 4, 5, null]);
  });

  test("fills up with a decreasing series", () => {
    const data = grid(5, 1);
    data[3][0] = text("Item 3");
    data[4][0] = text("Item 4");
    const ctx = makeCtx(data);
    fill(
      ctx,
      { row: [3, 4], column: [0, 0] },
      { row: [0, 2], column: [0, 0] },
      "up"
    );
    expect(col(ctx, 0, 0, 4)).toEqual([
      "Item 0",
      "Item 1",
      "Item 2",
      "Item 3",
      "Item 4",
    ]);
  });

  test("fills right and left along rows", () => {
    const data = grid(1, 6);
    data[0][2] = text("Mon");
    const ctx = makeCtx(data);
    fill(
      ctx,
      { row: [0, 0], column: [2, 2] },
      { row: [0, 0], column: [3, 5] },
      "right"
    );
    fill(
      ctx,
      { row: [0, 0], column: [2, 2] },
      { row: [0, 0], column: [0, 1] },
      "left"
    );
    expect(getFlowdata(ctx)[0].map((c) => c?.v)).toEqual([
      "Sat",
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
    ]);
  });

  test("adjusts relative references of filled formulas", () => {
    const data = grid(4, 2);
    data[0][0] = num(1);
    data[1][0] = num(2);
    data[2][0] = num(3);
    data[3][0] = num(4);
    data[0][1] = { v: 2, f: "=A1*2", m: "2", ct: { fa: "General", t: "n" } };
    const ctx = makeCtx(data);
    fill(
      ctx,
      { row: [0, 0], column: [1, 1] },
      { row: [1, 3], column: [1, 1] },
      "down"
    );
    const d = getFlowdata(ctx);
    expect(d[1][1].f).toBe("=A2*2");
    expect(d[3][1].f).toBe("=A4*2");
    expect(d[3][1].v).toBe(8);
  });

  test("a multi-row formula block shifts by the block height", () => {
    const data = grid(4, 2);
    [1, 2, 3, 4].forEach((v, i) => {
      data[i][0] = num(v);
    });
    data[0][1] = { v: 1, f: "=A1", m: "1", ct: { fa: "General", t: "n" } };
    data[1][1] = { v: 2, f: "=A2", m: "2", ct: { fa: "General", t: "n" } };
    const ctx = makeCtx(data);
    fill(
      ctx,
      { row: [0, 1], column: [1, 1] },
      { row: [2, 3], column: [1, 1] },
      "down"
    );
    const d = getFlowdata(ctx);
    expect(d[2][1].f).toBe("=A3");
    expect(d[3][1].f).toBe("=A4");
    expect(d[3][1].v).toBe(4);
  });

  test("fills manually hidden rows but skips rows hidden by a filter", () => {
    const data = grid(5, 1);
    data[0][0] = num(1);
    data[1][0] = num(2);
    const ctx = makeCtx(data, {
      config: { rowhidden: { 2: 0, 3: 0 } },
      filter: { 0: { rowhidden: { 3: 0 } } },
    });
    fill(
      ctx,
      { row: [0, 1], column: [0, 0] },
      { row: [2, 4], column: [0, 0] },
      "down"
    );
    expect(col(ctx, 0, 0, 4)).toEqual([1, 2, 3, null, 5]);
  });

  test("getTypeItemHide reports series-capable content", () => {
    const data = grid(2, 2);
    data[0][0] = text("Tue");
    const ctx = makeCtx(data);
    dropCellCache.copyRange = { row: [0, 0], column: [0, 0] };
    expect(getTypeItemHide(ctx).some(Boolean)).toBe(true);
    data[0][0] = text("plain");
    expect(getTypeItemHide(ctx).some(Boolean)).toBe(false);
  });
});

describe("double-click fill handle", () => {
  test("fills down to the end of the adjacent column", () => {
    const data = grid(8, 3);
    [10, 20, 30, 40, 50].forEach((v, i) => {
      data[i][0] = num(v);
    });
    data[0][1] = text("Q1");
    const ctx = makeCtx(data, {
      luckysheet_select_save: [
        { row: [0, 0], column: [1, 1], row_focus: 0, column_focus: 1 },
      ],
    });
    expect(autoFillToDataEnd(ctx)).toBe(true);
    expect(col(ctx, 1, 0, 5)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q1", null]);
    expect(ctx.luckysheet_select_save[0].row).toEqual([0, 4]);
  });

  test("uses the right column when the left one is empty and stops before data", () => {
    const data = grid(8, 3);
    data[0][0] = num(1);
    [1, 2, 3, 4, 5, 6].forEach((v, i) => {
      data[i][1] = num(v);
    });
    data[4][0] = text("stop");
    const ctx = makeCtx(data, {
      luckysheet_select_save: [
        { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
      ],
    });
    expect(autoFillToDataEnd(ctx)).toBe(true);
    expect(col(ctx, 0, 0, 5)).toEqual([1, 1, 1, 1, "stop", null]);
  });

  test("does nothing without adjacent data", () => {
    const data = grid(4, 3);
    data[0][1] = num(1);
    const ctx = makeCtx(data, {
      luckysheet_select_save: [
        { row: [0, 0], column: [1, 1], row_focus: 0, column_focus: 1 },
      ],
    });
    expect(autoFillToDataEnd(ctx)).toBe(false);
  });
});

describe("Ctrl+D / Ctrl+R", () => {
  test("fill down copies the top row and adjusts formulas", () => {
    const data = grid(4, 3);
    data[0][0] = num(5);
    data[0][1] = { v: 5, f: "=A1", m: "5", ct: { fa: "General", t: "n" } };
    data[1][0] = num(6);
    data[2][0] = num(7);
    const ctx = makeCtx(data, {
      luckysheet_select_save: [
        { row: [0, 2], column: [1, 1], row_focus: 0, column_focus: 1 },
      ],
    });
    fillSelectionFromEdge(ctx, "down");
    const d = getFlowdata(ctx);
    expect(d[1][1].f).toBe("=A2");
    expect(d[2][1].f).toBe("=A3");
    expect(d[2][1].v).toBe(7);
    // numbers are copied, not extended
    ctx.luckysheet_select_save = [
      { row: [0, 2], column: [0, 0], row_focus: 0, column_focus: 0 },
    ];
    fillSelectionFromEdge(ctx, "down");
    expect(col(ctx, 0, 0, 2)).toEqual([5, 5, 5]);
  });

  test("with a single row selected, copies the cell above", () => {
    const data = grid(3, 2);
    data[0][0] = text("above");
    const ctx = makeCtx(data, {
      luckysheet_select_save: [
        { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
      ],
    });
    fillSelectionFromEdge(ctx, "down");
    expect(getFlowdata(ctx)[1][0].v).toBe("above");
  });

  test("fill right copies the left column", () => {
    const data = grid(2, 4);
    data[0][0] = num(1);
    data[1][0] = { v: 1, f: "=A1", m: "1", ct: { fa: "General", t: "n" } };
    const ctx = makeCtx(data, {
      luckysheet_select_save: [
        { row: [0, 1], column: [0, 2], row_focus: 0, column_focus: 0 },
      ],
    });
    fillSelectionFromEdge(ctx, "right");
    const d = getFlowdata(ctx);
    expect(d[0].slice(0, 3).map((c) => c.v)).toEqual([1, 1, 1]);
    expect(d[1][1].f).toBe("=B1");
    expect(d[1][2].f).toBe("=C1");
  });
});
