import {
  broadcast,
  broadcast2,
  columnCount,
  firstElement,
  map2D,
  to2D,
} from "../../../src/helper/array";

describe("helper/array", () => {
  it("to2D() normalises scalars and 1D arrays", () => {
    expect(to2D(5)).toEqual([[5]]);
    expect(to2D([1, 2])).toEqual([[1, 2]]);
    expect(to2D([[1], [2]])).toEqual([[1], [2]]);
    expect(to2D([])).toEqual([[]]);
  });

  it("columnCount() uses the widest row", () => {
    expect(columnCount([[1], [1, 2, 3], []])).toBe(3);
  });

  it("broadcast() repeats scalars, rows and columns", () => {
    const add = (a, b) => a + b;

    expect(broadcast([[[1, 2]], 10], add)).toEqual([[11, 12]]);
    expect(broadcast([[[1], [2]], [[10, 20]]], add)).toEqual([
      [11, 21],
      [12, 22],
    ]);
    expect(broadcast([1, 2], add)).toEqual([[3]]);
  });

  it("broadcast() pads missing positions with #N/A", () => {
    const result = broadcast([[[1, 2, 3]], [[1, 2]]], (a, b) =>
      b instanceof Error ? b.message : a + b
    );

    expect(result).toEqual([[2, 4, "#N/A"]]);
  });

  it("broadcast() supports any number of inputs", () => {
    expect(
      broadcast([[[1, 2]], [[3], [4]], 100], (a, b, c) => a + b + c)
    ).toEqual([
      [104, 105],
      [105, 106],
    ]);
  });

  it("broadcast2() matches broadcast() for two inputs", () => {
    const add = (a, b) => (b instanceof Error ? b.message : a + b);
    const inputs = [
      [[[1, 2]], 10],
      [[[1], [2]], [[10, 20]]],
      [[[1, 2, 3]], [[1, 2]]],
      [5, 6],
    ];

    inputs.forEach(([a, b]) => {
      expect(broadcast2(a, b, add)).toEqual(broadcast([a, b], add));
    });
  });

  it("map2D() passes element positions", () => {
    expect(
      map2D(
        [
          [1, 2],
          [3, 4],
        ],
        (v, i, j) => `${v}@${i}${j}`
      )
    ).toEqual([
      ["1@00", "2@01"],
      ["3@10", "4@11"],
    ]);
  });

  it("firstElement() returns the top-left value", () => {
    expect(firstElement([[7, 8]])).toBe(7);
    expect(firstElement([9])).toBe(9);
    expect(firstElement("x")).toBe("x");
  });
});
