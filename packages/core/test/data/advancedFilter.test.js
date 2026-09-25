import { makeContext, input, values } from "../formula/helpers";
import {
  advancedFilter,
  clearAdvancedFilter,
  getAdvancedFilter,
} from "../../src/modules/advancedFilter";
import { parseRefText } from "../../src/modules/cellRef";
import { makeHost, sheetOf, expectUndoRedo } from "../editing/historyHarness";
import { updateCell } from "../../src/modules/cell";

// The sample list of Microsoft's "Filter by using advanced criteria" article.
const LIST = [
  ["Type", "Salesperson", "Sales"],
  ["Beverages", "Suyama", 5122],
  ["Meat", "Davolio", 450],
  ["produce", "Buchanan", 6328],
  ["Produce", "Davolio", 6544],
  ["Beverages", "Davolio", 3000],
];

function setup(rows = 30, cols = 10) {
  const ctx = makeContext({ rows, cols });
  // criteria area on rows 1-4, list from row 6 (A6:C11), like the article
  LIST.forEach((row, i) =>
    row.forEach((v, c) => input(ctx, `${"ABC"[c]}${6 + i}`, `${v}`))
  );
  return ctx;
}

const list = { row: [5, 10], column: [0, 2] };
const hiddenRows = (ctx) =>
  Object.keys(ctx.config.rowhidden || {})
    .map(Number)
    .sort((a, b) => a - b);
const crit = (ctx, cells) =>
  Object.entries(cells).forEach(([a1, v]) => input(ctx, a1, v));

describe("Advanced Filter criteria (Excel semantics)", () => {
  test("text criteria match values beginning with the text, case-insensitively", () => {
    const ctx = setup();
    crit(ctx, { A1: "Type", A2: "Produce" });
    const res = advancedFilter(ctx, {
      list,
      criteria: { row: [0, 1], column: [0, 0] },
    });
    expect(res).toEqual({ matched: 2, total: 5 });
    // rows 7, 8, 10 (0-based 6, 7, 10) hidden
    expect(hiddenRows(ctx)).toEqual([6, 7, 10]);
  });

  test("conditions on one row are AND-ed", () => {
    const ctx = setup();
    crit(ctx, { A1: "Type", B1: "Salesperson", A2: "Produce", B2: "Davolio" });
    expect(
      advancedFilter(ctx, { list, criteria: { row: [0, 1], column: [0, 1] } })
        .matched
    ).toBe(1);
    expect(hiddenRows(ctx)).toEqual([6, 7, 8, 10]);
  });

  test("rows are OR-ed", () => {
    const ctx = setup();
    crit(ctx, {
      A1: "Type",
      B1: "Salesperson",
      A2: "Meat",
      B3: "Suyama",
    });
    expect(
      advancedFilter(ctx, { list, criteria: { row: [0, 2], column: [0, 1] } })
        .matched
    ).toBe(2);
  });

  test("comparison operators and two conditions on the same column", () => {
    const ctx = setup();
    crit(ctx, { A1: "Sales", B1: "Sales", A2: ">3000", B2: "<6500" });
    expect(
      advancedFilter(ctx, { list, criteria: { row: [0, 1], column: [0, 1] } })
        .matched
    ).toBe(2); // 5122, 6328
  });

  test("wildcards and exact matches", () => {
    const ctx = setup();
    crit(ctx, { A1: "Salesperson", A2: "?u*" });
    expect(
      advancedFilter(ctx, { list, criteria: { row: [0, 1], column: [0, 0] } })
        .matched
    ).toBe(2); // Suyama, Buchanan
    crit(ctx, { A2: '="=Davolio"' });
    expect(
      advancedFilter(ctx, { list, criteria: { row: [0, 1], column: [0, 0] } })
        .matched
    ).toBe(3);
  });

  test("computed criteria: a formula relative to the first record", () => {
    const ctx = setup();
    // label that is not a column name; formula written for row 7 (C7)
    crit(ctx, { E1: "Above average", E2: "=C7>AVERAGE($C$7:$C$11)" });
    const res = advancedFilter(ctx, {
      list,
      criteria: { row: [0, 1], column: [4, 4] },
    });
    // average 4288.8: 5122, 6328, 6544
    expect(res.matched).toBe(3);
    expect(hiddenRows(ctx)).toEqual([7, 10]);
  });

  test("unique records only", () => {
    const ctx = setup();
    input(ctx, "A12", "Meat");
    input(ctx, "B12", "Davolio");
    input(ctx, "C12", "450");
    const res = advancedFilter(ctx, {
      list: { row: [5, 11], column: [0, 2] },
      unique: true,
    });
    expect(res).toEqual({ matched: 5, total: 6 });
    expect(hiddenRows(ctx)).toEqual([11]);
  });

  test("an invalid criteria range is reported", () => {
    const ctx = setup();
    expect(
      advancedFilter(ctx, { list, criteria: { row: [0, 0], column: [0, 0] } })
        .error
    ).toBe("invalidCriteria");
  });
});

describe("Advanced Filter actions", () => {
  test("Clear shows the rows again, rows hidden by hand stay hidden", () => {
    const ctx = setup();
    ctx.config.rowhidden = { 20: 0 };
    crit(ctx, { A1: "Type", A2: "Meat" });
    advancedFilter(ctx, { list, criteria: { row: [0, 1], column: [0, 0] } });
    expect(getAdvancedFilter(ctx).hidden).toEqual([6, 8, 9, 10]);
    expect(clearAdvancedFilter(ctx)).toBe(true);
    expect(hiddenRows(ctx)).toEqual([20]);
    expect(getAdvancedFilter(ctx)).toBeUndefined();
  });

  test("copy to another location with all columns", () => {
    const ctx = setup();
    crit(ctx, { A1: "Salesperson", A2: "Davolio" });
    const res = advancedFilter(ctx, {
      list,
      criteria: { row: [0, 1], column: [0, 0] },
      action: "copy",
      copyTo: { row: [13, 13], column: [0, 0] },
    });
    expect(res.matched).toBe(3);
    expect(values(ctx, "A14", "C17")).toEqual([
      ["Type", "Salesperson", "Sales"],
      ["Meat", "Davolio", 450],
      ["Produce", "Davolio", 6544],
      ["Beverages", "Davolio", 3000],
    ]);
    expect(hiddenRows(ctx)).toEqual([]);
  });

  test("copy chosen columns through a header row, unique", () => {
    const ctx = setup();
    input(ctx, "E14", "Salesperson");
    const res = advancedFilter(ctx, {
      list,
      action: "copy",
      copyTo: { row: [13, 13], column: [4, 4] },
      unique: true,
    });
    expect(res.matched).toBe(3);
    expect(values(ctx, "E14", "E18")).toEqual([
      ["Salesperson"],
      ["Suyama"],
      ["Davolio"],
      ["Buchanan"],
      [undefined],
    ]);
  });

  test("copy-to labels must be columns of the list", () => {
    const ctx = setup();
    input(ctx, "E14", "Region");
    expect(
      advancedFilter(ctx, {
        list,
        action: "copy",
        copyTo: { row: [13, 13], column: [4, 4] },
      }).error
    ).toBe("invalidCopyTo");
  });

  test("filter in place and Clear are undoable steps", () => {
    const host = makeHost({ rows: 12, cols: 4 });
    [
      ["A1", "Name"],
      ["A2", "x"],
      ["A3", "y"],
      ["A4", "x"],
      ["C1", "Name"],
      ["C2", "x"],
    ].forEach(([a1, v]) =>
      host.act((d) => {
        const m = /^([A-Z])(\d+)$/.exec(a1);
        const r = Number(m[2]) - 1;
        const c = m[1].charCodeAt(0) - 65;
        updateCell(d, r, c, { innerText: v, innerHTML: v }, v);
      })
    );
    expectUndoRedo(host, (h) =>
      h.act((d) =>
        advancedFilter(d, {
          list: { row: [0, 3], column: [0, 0] },
          criteria: { row: [0, 1], column: [2, 2] },
        })
      )
    );
    expect(sheetOf(host.ctx).config.rowhidden).toEqual({ 2: 0 });
    expectUndoRedo(host, (h) => h.act((d) => clearAdvancedFilter(d)));
  });
});

describe("typed references", () => {
  test("parses cells, ranges, absolute and sheet-qualified references", () => {
    const ctx = makeContext();
    expect(parseRefText(ctx, "$A$1:$C$11")).toEqual({
      sheetId: "id_1",
      row: [0, 10],
      column: [0, 2],
    });
    expect(parseRefText(ctx, "=B2")).toEqual({
      sheetId: "id_1",
      row: [1, 1],
      column: [1, 1],
    });
    expect(parseRefText(ctx, "'My Sheet'!C3").sheetId).toBe("id_2");
    expect(parseRefText(ctx, "not a ref")).toBeNull();
    expect(parseRefText(ctx, "")).toBeNull();
  });
});
