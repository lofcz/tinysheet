import { makeContext, input, value, values, cell } from "../formula/helpers";
import {
  sortRange,
  sortSelection,
  detectHeaderRow,
  compareCellValues,
  getCurrentRegion,
  matchBuiltinCustomList,
  BUILTIN_CUSTOM_LISTS,
} from "../../src/modules/sort";

function fill(ctx, cells) {
  Object.entries(cells).forEach(([a1, text]) => input(ctx, a1, text));
}

function column(ctx, from, to) {
  return values(ctx, from, to).map((r) => r[0]);
}

function select(ctx, row, cols, focus = [row[0], cols[0]]) {
  ctx.luckysheet_select_save = [
    { row, column: cols, row_focus: focus[0], column_focus: focus[1] },
  ];
}

describe("Excel ordering of mixed types", () => {
  test("numbers < text < booleans < errors, blanks last", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "#N/A",
      A2: "TRUE",
      A3: "banana",
      A4: "10",
      A6: "FALSE",
      A7: "Apple",
      A8: "2",
    });
    const err = sortRange(ctx, {
      range: { row: [0, 7], column: [0, 0] },
      levels: [{ index: 0 }],
    });
    expect(err).toBeNull();
    expect(column(ctx, "A1", "A8")).toEqual([
      2,
      10,
      "Apple",
      "banana",
      false,
      true,
      "#N/A",
      undefined,
    ]);
  });

  test("descending reverses the types, blanks stay last", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "1", A2: "x", A4: "TRUE", A5: "3" });
    sortRange(ctx, {
      range: { row: [0, 4], column: [0, 0] },
      levels: [{ index: 0, order: "desc" }],
    });
    expect(column(ctx, "A1", "A5")).toEqual([true, "x", 3, 1, undefined]);
  });

  test("text compares case-insensitively unless asked", () => {
    expect(
      compareCellValues({ v: "apple" }, { v: "APPLE", ct: { t: "g" } })
    ).toBe(0);
    expect(
      compareCellValues({ v: "apple" }, { v: "APPLE" }, true)
    ).toBeLessThan(0);
    // numbers stored as text sort as text
    expect(
      compareCellValues({ v: "9", ct: { t: "s" } }, { v: 100 })
    ).toBeGreaterThan(0);
  });

  test("the sort is stable", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "b",
      B1: "1",
      A2: "a",
      B2: "2",
      A3: "b",
      B3: "3",
      A4: "a",
      B4: "4",
    });
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 1] },
      levels: [{ index: 0 }],
    });
    expect(values(ctx, "A1", "B4")).toEqual([
      ["a", 2],
      ["a", 4],
      ["b", 1],
      ["b", 3],
    ]);
  });
});

describe("multi-level sort", () => {
  test("second level breaks ties of the first", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "Region",
      B1: "Sales",
      A2: "East",
      B2: "10",
      A3: "West",
      B3: "30",
      A4: "East",
      B4: "50",
      A5: "West",
      B5: "20",
    });
    sortRange(ctx, {
      range: { row: [0, 4], column: [0, 1] },
      hasHeader: true,
      levels: [
        { index: 0, order: "asc" },
        { index: 1, order: "desc" },
      ],
    });
    expect(values(ctx, "A1", "B5")).toEqual([
      ["Region", "Sales"],
      ["East", 50],
      ["East", 10],
      ["West", 30],
      ["West", 20],
    ]);
  });

  test("custom list order (weekdays), unlisted values after", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "Wed", A2: "zzz", A3: "Mon", A4: "Sun", A5: "Tue" });
    const list = matchBuiltinCustomList(["Wed", "Mon", "Sun", "Tue"]);
    expect(list).toBe(BUILTIN_CUSTOM_LISTS[0]);
    sortRange(ctx, {
      range: { row: [0, 4], column: [0, 0] },
      levels: [{ index: 0, customList: list }],
    });
    expect(column(ctx, "A1", "A5")).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "zzz",
    ]);
    sortRange(ctx, {
      range: { row: [0, 4], column: [0, 0] },
      levels: [{ index: 0, customList: ["High", "Medium", "Low"] }],
    });
  });

  test("user custom list", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "low", A2: "High", A3: "Medium", A4: "Low" });
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 0] },
      levels: [{ index: 0, customList: ["High", "Medium", "Low"] }],
    });
    expect(column(ctx, "A1", "A4")).toEqual(["High", "Medium", "low", "Low"]);
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 0] },
      levels: [
        { index: 0, order: "desc", customList: ["High", "Medium", "Low"] },
      ],
    });
    expect(column(ctx, "A1", "A4")).toEqual(["low", "Low", "Medium", "High"]);
  });

  test("sort on cell colour and font colour", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "a", A2: "b", A3: "c", A4: "d" });
    const { data } = ctx.luckysheetfile[0];
    data[1][0].bg = "#FF0000";
    data[3][0].bg = "rgb(255, 0, 0)";
    data[2][0].fc = "#00ff00";
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 0] },
      levels: [{ index: 0, sortOn: "cellColor", color: "#ff0000" }],
    });
    expect(column(ctx, "A1", "A4")).toEqual(["b", "d", "a", "c"]);
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 0] },
      levels: [
        { index: 0, sortOn: "fontColor", color: "#00ff00", position: "bottom" },
      ],
    });
    expect(column(ctx, "A1", "A4")).toEqual(["b", "d", "a", "c"]);
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 0] },
      levels: [{ index: 0, sortOn: "fontColor", color: "#00ff00" }],
    });
    expect(column(ctx, "A1", "A4")).toEqual(["c", "b", "d", "a"]);
  });

  test("sort left to right", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "Name",
      B1: "c",
      C1: "a",
      D1: "b",
      A2: "Qty",
      B2: "3",
      C2: "1",
      D2: "2",
    });
    sortRange(ctx, {
      range: { row: [0, 1], column: [0, 3] },
      orientation: "columns",
      hasHeader: true,
      levels: [{ index: 0 }],
    });
    expect(values(ctx, "A1", "D2")).toEqual([
      ["Name", "a", "b", "c"],
      ["Qty", 1, 2, 3],
    ]);
  });
});

describe("formulas move like Excel", () => {
  test("relative references shift with the row, absolute ones stay", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "3",
      A2: "1",
      A3: "2",
      D1: "100",
      B1: "=A1*10+$D$1",
      B2: "=A2*10+$D$1",
      B3: "=A3*10+$D$1",
      C1: "=SUM(B1:B3)",
    });
    sortRange(ctx, {
      range: { row: [0, 2], column: [0, 1] },
      levels: [{ index: 0 }],
    });
    expect(values(ctx, "A1", "B3")).toEqual([
      [1, 110],
      [2, 120],
      [3, 130],
    ]);
    expect(cell(ctx, "B1").f).toBe("=A1*10+$D$1");
    expect(cell(ctx, "B3").f).toBe("=A3*10+$D$1");
    // dependents still work after the sort
    input(ctx, "A1", "5");
    expect(value(ctx, "B1")).toBe(150);
    expect(value(ctx, "C1")).toBe(150 + 120 + 130);
  });

  test("references outside the range follow the row offset", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "3",
      A2: "1",
      E1: "10",
      E2: "20",
      B1: "=E1",
      B2: "=E2",
    });
    sortRange(ctx, {
      range: { row: [0, 1], column: [0, 1] },
      levels: [{ index: 0 }],
    });
    // the row of A2 (with =E2) moved up: its formula now reads E1
    expect(cell(ctx, "B1").f).toBe("=E1");
    expect(values(ctx, "A1", "B2")).toEqual([
      [1, 10],
      [3, 20],
    ]);
  });
});

describe("header detection and quick sort", () => {
  test("text over numbers is a header", () => {
    const ctx = makeContext();
    fill(ctx, { A1: "Qty", A2: "3", A3: "1" });
    const { data } = ctx.luckysheetfile[0];
    expect(detectHeaderRow(data, { row: [0, 2], column: [0, 0] })).toBeTruthy();
    fill(ctx, { B1: "b", B2: "a" });
    expect(detectHeaderRow(data, { row: [0, 1], column: [1, 1] })).toBeFalsy();
    data[0][1].bl = 1;
    expect(detectHeaderRow(data, { row: [0, 1], column: [1, 1] })).toBeTruthy();
  });

  test("a single cell sorts its current region by its column", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, {
      A1: "Name",
      B1: "Age",
      A2: "Bob",
      B2: "30",
      A3: "Al",
      B3: "40",
      A4: "Cy",
      B4: "20",
      A6: "zz",
    });
    const { data } = ctx.luckysheetfile[0];
    expect(getCurrentRegion(data, 1, 1)).toEqual({
      row: [0, 3],
      column: [0, 1],
    });
    select(ctx, [2, 2], [1, 1]);
    sortSelection(ctx, false);
    expect(values(ctx, "A1", "B4")).toEqual([
      ["Name", "Age"],
      ["Al", 40],
      ["Bob", 30],
      ["Cy", 20],
    ]);
    expect(value(ctx, "A6")).toBe("zz");
  });

  test("hidden rows keep their place", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "3", A2: "9", A3: "1", A4: "2" });
    ctx.config = { rowhidden: { 1: 0 } };
    sortRange(ctx, {
      range: { row: [0, 3], column: [0, 0] },
      levels: [{ index: 0 }],
    });
    expect(column(ctx, "A1", "A4")).toEqual([1, 9, 2, 3]);
  });

  test("data validation moves with the cells", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "2", A2: "1" });
    ctx.luckysheetfile[0].dataVerification = { "0_0": { type: "number" } };
    sortRange(ctx, {
      range: { row: [0, 1], column: [0, 0] },
      levels: [{ index: 0 }],
    });
    expect(Object.keys(ctx.luckysheetfile[0].dataVerification)).toEqual([
      "1_0",
    ]);
  });

  test("merged cells are refused", () => {
    const ctx = makeContext({ rows: 12 });
    fill(ctx, { A1: "2", A2: "1" });
    ctx.luckysheetfile[0].data[0][0].mc = { r: 0, c: 0, rs: 1, cs: 2 };
    expect(
      sortRange(ctx, {
        range: { row: [0, 1], column: [0, 0] },
        levels: [{ index: 0 }],
      })
    ).toMatch(/merged/);
  });
});
