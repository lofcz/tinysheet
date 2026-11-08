import { performance } from "node:perf_hooks";
import { makeContext } from "../formula/helpers";
import {
  getFilterColumnValues,
  getFilterColumnColors,
} from "../../src/modules/filter";
import { highlight, rules } from "../cf/helpers";

function contextFor(values, hidden = {}) {
  const ctx = makeContext({ rows: values.length + 1, cols: 1 });
  ctx.luckysheetfile[0].data = [
    [{ v: "Header", m: "Header" }],
    ...values.map((v) => [v]),
  ];
  ctx.filter = { 0: { rowhidden: hidden, cindex: 0 } };
  return ctx;
}

test("50k repeated values and blanks collect rows in linear time", () => {
  for (const cell of [null, { v: "same", m: "same" }]) {
    const ctx = contextFor(Array(50000).fill(cell));
    const start = performance.now();
    const result = getFilterColumnValues(ctx, 0, 0, 50000, 0);
    const elapsed = performance.now() - start;
    expect(result.values).toHaveLength(1);
    expect(result.values[0].rows).toHaveLength(50000);
    expect(result.valueRowMap[result.values[0].key]).toEqual(
      result.visibleRows
    );
    expect(result.values[0].rows[49999]).toBe(50000);
    // An allocation regression copied 1.25 billion row indices per value.
    expect(elapsed).toBeLessThan(5000);
  }
});

test("50k excluded unique values do not repeatedly union the exclusion list", () => {
  const cells = Array.from({ length: 50000 }, (_, r) => ({
    v: r,
    m: String(r),
  }));
  const hidden = Object.fromEntries(cells.map((_, r) => [r + 1, 0]));
  const ctx = contextFor(cells, hidden);
  const start = performance.now();
  const result = getFilterColumnValues(ctx, 0, 0, cells.length, 0);
  expect(performance.now() - start).toBeLessThan(5000);
  expect(result.valuesUncheck).toHaveLength(50000);
  expect(result.valuesUncheck).toEqual(result.values.map((v) => v.key));
});

test("date search includes every distinct day, with unique descendant keys", () => {
  const cell = (v) => ({ v, ct: { t: "d", fa: "yyyy-mm-dd" } });
  const ctx = contextFor([cell(45292), cell(45292), cell(45293), cell(45323)]);
  const result = getFilterColumnValues(ctx, 0, 0, 4, 0);
  expect(result.flattenValues).toEqual([
    "2024-01-01",
    "2024-01-02",
    "2024-02-01",
  ]);
  expect(result.dateRowMap["2024-01-01"]).toEqual([1, 2]);
  expect(result.dates[0].rows).toEqual([1, 2, 3, 4]);
  expect(result.dates[0].dateValues).toEqual(result.flattenValues);
});

test("color grouping retains defaults, shorthand, hidden rows and conditional formatting", () => {
  const ctx = contextFor([
    { v: 1, bg: "#abc", fc: "rgb(255, 0, 0)" },
    { v: 2, bg: "#aabbcc", fc: "#f00" },
    { v: 3 },
    null,
  ]);
  ctx.config.rowhidden = { 2: 0 };
  let result = getFilterColumnColors(ctx, 0, 0, 4);
  expect(result.bgColors).toEqual([
    { color: "#aabbcc", checked: false, rows: [1, 2] },
    { color: "#ffffff", checked: true, rows: [3, 4] },
  ]);
  expect(result.fcColors.map((c) => c.rows)).toEqual([[1, 2], [3]]);
  rules(ctx, [
    highlight("greaterThan", "A2:A4", [2], {
      format: { cellColor: "#00ff00", textColor: "#0000ff" },
    }),
  ]);
  result = getFilterColumnColors(ctx, 0, 0, 4);
  expect(result.bgColors.find((c) => c.color === "#00ff00").rows).toEqual([3]);
  expect(result.fcColors.find((c) => c.color === "#0000ff").rows).toEqual([3]);
});

test("grouping excludes other filters and preserves distinct display masks", () => {
  const ctx = contextFor(
    [{ v: 1, m: "1" }, { v: 1, m: "1.00" }, { v: 1, m: "1" }, { v: "raw" }],
    { 1: 0 }
  );
  ctx.filter[1] = { cindex: 1, rowhidden: { 3: 0 } };
  const result = getFilterColumnValues(ctx, 0, 0, 4, 0);
  expect(result.values.map((v) => [v.text, v.rows])).toEqual([
    ["1", [1]],
    ["1.00", [2]],
    ["raw", [4]],
  ]);
  expect(result.valuesUncheck).toEqual([result.values[0].key]);
});
