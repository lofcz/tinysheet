import { makeContext, input, values, cell } from "../formula/helpers";
import {
  removeDuplicates,
  detectDuplicatesHeader,
  analyzeDuplicates,
} from "../../src/modules/removeDuplicates";

function fill(ctx, cells) {
  Object.entries(cells).forEach(([a1, text]) => input(ctx, a1, text));
}

function setup() {
  const ctx = makeContext({ rows: 12, cols: 6 });
  fill(ctx, {
    A1: "Name",
    B1: "City",
    A2: "Ann",
    B2: "Oslo",
    A3: "Bob",
    B3: "Rome",
    A4: "ann",
    B4: "OSLO",
    A5: "Ann",
    B5: "Paris",
    A6: "Bob",
    B6: "Rome",
    A8: "below",
  });
  return ctx;
}

describe("Remove Duplicates", () => {
  test("all columns, header row kept, case-insensitive", () => {
    const ctx = setup();
    expect(
      detectDuplicatesHeader(ctx, { row: [0, 5], column: [0, 1] })
    ).toBeFalsy();
    const res = removeDuplicates(ctx, {
      range: { row: [0, 5], column: [0, 1] },
      hasHeader: true,
    });
    expect(res).toEqual({ removed: 2, unique: 3 });
    expect(values(ctx, "A1", "B6")).toEqual([
      ["Name", "City"],
      ["Ann", "Oslo"],
      ["Bob", "Rome"],
      ["Ann", "Paris"],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    // rows below the range do not move
    expect(values(ctx, "A8", "A8")).toEqual([["below"]]);
  });

  test("chosen columns only", () => {
    const ctx = setup();
    const res = removeDuplicates(ctx, {
      range: { row: [0, 5], column: [0, 1] },
      columns: [0],
      hasHeader: true,
    });
    expect(res).toEqual({ removed: 3, unique: 2 });
    expect(values(ctx, "A2", "B3")).toEqual([
      ["Ann", "Oslo"],
      ["Bob", "Rome"],
    ]);
  });

  test("without a header the first row takes part", () => {
    const ctx = makeContext({ rows: 6, cols: 3 });
    fill(ctx, { A1: "x", A2: "x", A3: "y" });
    expect(
      removeDuplicates(ctx, { range: { row: [0, 2], column: [0, 0] } })
    ).toEqual({ removed: 1, unique: 2 });
  });

  test("values compare as displayed", () => {
    const ctx = makeContext({ rows: 6, cols: 3 });
    fill(ctx, { A1: "1", A2: "1", A3: "100%", A4: "1" });
    // the same value shown as "1.00" is not a duplicate of "1"
    const { data } = ctx.luckysheetfile[0];
    data[1][0] = { v: 1, m: "1.00", ct: { fa: "0.00", t: "n" } };
    expect(
      removeDuplicates(ctx, { range: { row: [0, 3], column: [0, 0] } })
    ).toEqual({ removed: 1, unique: 3 });
  });

  test("formulas in moved rows keep their relative references", () => {
    const ctx = makeContext({ rows: 8, cols: 4 });
    fill(ctx, {
      A1: "a",
      A2: "a",
      A3: "b",
      D3: "5",
      B3: "=D3*2",
    });
    removeDuplicates(ctx, {
      range: { row: [0, 2], column: [0, 1] },
      columns: [0],
    });
    expect(cell(ctx, "B2").f).toBe("=D2*2");
    expect(values(ctx, "A1", "A3")).toEqual([["a"], ["b"], [undefined]]);
  });
});

test("analyzeDuplicates does not change the sheet", () => {
  const ctx = setup();
  const { data } = ctx.luckysheetfile[0];
  const res = analyzeDuplicates(data, {
    range: { row: [0, 5], column: [0, 1] },
    hasHeader: true,
  });
  expect(res).toEqual({ start: 1, keep: [1, 2, 4], removed: 2 });
  expect(values(ctx, "A6", "B6")).toEqual([["Bob", "Rome"]]);
});
