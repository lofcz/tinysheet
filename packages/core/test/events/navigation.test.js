import {
  cellHasValue,
  expandRangeForMerges,
  findDataEdge,
  getCurrentRegion,
  getLastUsedCell,
  nextCellInRange,
  nextVisibleIndex,
} from "../../src/modules/navigation";

describe("findDataEdge (Excel Ctrl+Arrow rule)", () => {
  //               0     1     2     3      4      5     6     7
  const filled = [true, true, true, false, false, true, true, false];
  const isFilled = (i) => filled[i];
  const edge = (pos, dir, isHidden) =>
    findDataEdge(pos, dir, filled.length, isFilled, isHidden);

  test("from a filled cell with a filled neighbour: last filled before a blank", () => {
    expect(edge(0, 1)).toBe(2);
    expect(edge(6, -1)).toBe(5);
    expect(edge(2, -1)).toBe(0);
  });

  test("from a filled cell before a blank: the next filled cell", () => {
    expect(edge(2, 1)).toBe(5);
    expect(edge(5, -1)).toBe(2);
  });

  test("from a blank: the next filled cell", () => {
    expect(edge(3, 1)).toBe(5);
    expect(edge(4, -1)).toBe(2);
    expect(edge(7, -1)).toBe(6);
  });

  test("with no more data: the sheet edge", () => {
    expect(edge(6, 1)).toBe(7);
    expect(edge(7, 1)).toBe(7);
    expect(findDataEdge(0, 1, 10, () => false)).toBe(9);
    expect(findDataEdge(5, -1, 10, () => false)).toBe(0);
  });

  test("skips hidden rows", () => {
    const hidden = (i) => i === 3 || i === 4;
    expect(edge(0, 1, hidden)).toBe(6);
    expect(edge(7, -1, (i) => i === 6)).toBe(5);
    expect(nextVisibleIndex(2, 1, 8, hidden)).toBe(5);
    expect(nextVisibleIndex(7, 1, 8)).toBeNull();
  });
});

describe("getCurrentRegion", () => {
  // A1:B2 filled, C3 touches diagonally, E1 separate
  const cells = new Set(["0,0", "0,1", "1,0", "1,1", "2,2", "0,4"]);
  const isFilled = (r, c) => cells.has(`${r},${c}`);

  test("expands through diagonal neighbours", () => {
    expect(getCurrentRegion(isFilled, 0, 0, 10, 10)).toEqual({
      row: [0, 2],
      column: [0, 2],
    });
  });

  test("includes data around an empty active cell", () => {
    // D4 touches C3 diagonally; the grown region then reaches E1 too
    expect(getCurrentRegion(isFilled, 3, 3, 10, 10)).toEqual({
      row: [0, 3],
      column: [0, 4],
    });
  });

  test("returns null for an isolated empty cell", () => {
    expect(getCurrentRegion(isFilled, 8, 8, 10, 10)).toBeNull();
  });
});

describe("getLastUsedCell", () => {
  test("intersects the last used row and column", () => {
    const data = [
      [null, null, { v: 1 }],
      [null, null, null],
      [{ v: "x" }, null, null],
      [null, { v: null }, null],
    ];
    expect(getLastUsedCell(data)).toEqual([2, 2]);
    expect(getLastUsedCell([[null]])).toEqual([0, 0]);
  });
});

describe("nextCellInRange (Enter/Tab inside a selection)", () => {
  const range = { row: [0, 1], column: [0, 1] };

  test("Enter goes down each column and wraps", () => {
    expect(nextCellInRange(range, 0, 0, "down")).toEqual([1, 0]);
    expect(nextCellInRange(range, 1, 0, "down")).toEqual([0, 1]);
    expect(nextCellInRange(range, 1, 1, "down")).toEqual([0, 0]);
    expect(nextCellInRange(range, 0, 0, "up")).toEqual([1, 1]);
  });

  test("Tab goes right along each row and wraps", () => {
    expect(nextCellInRange(range, 0, 0, "right")).toEqual([0, 1]);
    expect(nextCellInRange(range, 0, 1, "right")).toEqual([1, 0]);
    expect(nextCellInRange(range, 1, 1, "right")).toEqual([0, 0]);
    expect(nextCellInRange(range, 0, 0, "left")).toEqual([1, 1]);
  });

  test("steps over skipped cells", () => {
    expect(
      nextCellInRange(range, 0, 0, "down", (r, c) => r === 1 && c === 0)
    ).toEqual([0, 1]);
  });
});

describe("helpers", () => {
  test("expandRangeForMerges grows until merges are whole", () => {
    const merges = {
      "1_1": { r: 1, c: 1, rs: 2, cs: 2 },
      "2_3": { r: 2, c: 3, rs: 3, cs: 1 },
    };
    expect(
      expandRangeForMerges({ row: [0, 1], column: [0, 1] }, merges)
    ).toEqual({ row: [0, 2], column: [0, 2] });
    expect(
      expandRangeForMerges({ row: [2, 2], column: [2, 3] }, merges)
    ).toEqual({ row: [1, 4], column: [1, 3] });
  });

  test("cellHasValue", () => {
    expect(cellHasValue(null)).toBe(false);
    expect(cellHasValue({})).toBe(false);
    expect(cellHasValue({ v: "" })).toBe(false);
    expect(cellHasValue({ v: 0 })).toBe(true);
    expect(cellHasValue({ f: "=1" })).toBe(true);
    expect(cellHasValue({ ct: { t: "inlineStr", s: [{ v: "a" }] } })).toBe(
      true
    );
    expect(cellHasValue({ bg: "#fff" })).toBe(false);
  });
});
