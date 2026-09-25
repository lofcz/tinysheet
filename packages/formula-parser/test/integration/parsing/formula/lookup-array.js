import Parser from "../../../../src/parser";

// Sheet used by the range-based tests (A1:D6):
//   A        B      C     D
// 1 Name     Dept   Age   Score
// 2 Tom      Sales  52    7
// 3 fred     Ops    65    9
// 4 Amy      Sales  22    (blank)
// 5 Sal      IT     65    5
// 6 (blank)  (blank)(blank)(blank)
const SHEET = [
  ["Name", "Dept", "Age", "Score"],
  ["Tom", "Sales", 52, 7],
  ["fred", "Ops", 65, 9],
  ["Amy", "Sales", 22, null],
  ["Sal", "IT", 65, 5],
  [null, null, null, null],
];

function rangeOf(start, end) {
  const rows = [];
  for (let r = start.row.index; r <= end.row.index; r += 1) {
    const line = [];
    for (let c = start.column.index; c <= end.column.index; c += 1) {
      line.push(SHEET[r]?.[c] ?? null);
    }
    rows.push(line);
  }
  return rows;
}

describe(".parse() lookup & dynamic-array formulas", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    parser.on("callCellValue", (cell, _options, done) => {
      done(SHEET[cell.row.index]?.[cell.column.index] ?? null);
    });
    parser.on("callRangeValue", (start, end, _options, done) => {
      done(rangeOf(start, end));
    });
    parser.setVariable("keys", [["a"], ["b"], ["c"]]);
    parser.setVariable("vals", [[1], [2], [3]]);
    parser.setVariable("nums", [[10], [20], [30], [40]]);
  });
  afterEach(() => {
    parser = null;
  });

  it("XLOOKUP", () => {
    expect(parser.parse('XLOOKUP("b", keys, vals)')).toMatchObject({
      error: null,
      result: 2,
    });
    expect(parser.parse('XLOOKUP("z", keys, vals)')).toMatchObject({
      error: "#N/A",
      result: null,
    });
    expect(parser.parse('XLOOKUP("z", keys, vals, "missing")')).toMatchObject({
      error: null,
      result: "missing",
    });
    expect(parser.parse("XLOOKUP(25, nums, nums, 0, -1)")).toMatchObject({
      error: null,
      result: 20,
    });
    expect(parser.parse("XLOOKUP(25, nums, nums, 0, 1, 2)")).toMatchObject({
      error: null,
      result: 30,
    });
    expect(parser.parse('XLOOKUP("a", keys, vals, 0, 2, 2)')).toMatchObject({
      error: "#VALUE!",
      result: null,
    });
    // Range based: whole-row return and wildcard + reverse search.
    expect(parser.parse('XLOOKUP("FRED", A2:A5, B2:D5)')).toMatchObject({
      error: null,
      result: [["Ops", 65, 9]],
    });
    expect(
      parser.parse('XLOOKUP("S*", B2:B5, A2:A5, "", 2, -1)')
    ).toMatchObject({ error: null, result: "Amy" });
    expect(parser.parse('XLOOKUP("Age", A1:D1, A2:D3)')).toMatchObject({
      error: null,
      result: [[52], [65]],
    });
    // A blank result cell reads as 0.
    expect(parser.parse('XLOOKUP("Amy", A2:A5, D2:D5)')).toMatchObject({
      error: null,
      result: 0,
    });
  });

  it("XMATCH", () => {
    expect(parser.parse('XMATCH("c", keys)')).toMatchObject({
      error: null,
      result: 3,
    });
    expect(parser.parse("XMATCH(65, C2:C5, 0, -1)")).toMatchObject({
      error: null,
      result: 4,
    });
    expect(parser.parse("XMATCH(35, nums, 1)")).toMatchObject({
      error: null,
      result: 4,
    });
    expect(parser.parse("XMATCH(1, A1:B2)")).toMatchObject({
      error: "#VALUE!",
      result: null,
    });
  });

  it("MATCH", () => {
    expect(parser.parse("MATCH(25, nums)")).toMatchObject({
      error: null,
      result: 2,
    });
    expect(parser.parse('MATCH("?al", A2:A5, 0)')).toMatchObject({
      error: null,
      result: 4,
    });
    expect(parser.parse("MATCH(5, nums, 1)")).toMatchObject({
      error: "#N/A",
      result: null,
    });
  });

  it("VLOOKUP / HLOOKUP / LOOKUP / INDEX", () => {
    expect(parser.parse('VLOOKUP("sal", A2:D5, 3, FALSE)')).toMatchObject({
      error: null,
      result: 65,
    });
    expect(parser.parse('VLOOKUP("sal", A2:D5, 5, FALSE)')).toMatchObject({
      error: "#REF!",
      result: null,
    });
    expect(parser.parse('HLOOKUP("Score", A1:D3, 3, FALSE)')).toMatchObject({
      error: null,
      result: 9,
    });
    expect(parser.parse("LOOKUP(35, nums, vals)")).toMatchObject({
      error: null,
      result: 3,
    });
    // The match (40) lies beyond the shorter result vector.
    expect(parser.parse("LOOKUP(45, nums, vals)")).toMatchObject({
      error: "#N/A",
      result: null,
    });
    expect(parser.parse("LOOKUP(25, nums)")).toMatchObject({
      error: null,
      result: 20,
    });
    expect(parser.parse("INDEX(A1:D5, 3, 1)")).toMatchObject({
      error: null,
      result: "fred",
    });
    expect(parser.parse("INDEX(A2:D5, 0, 3)")).toMatchObject({
      error: null,
      result: [[52], [65], [22], [65]],
    });
    expect(parser.parse("INDEX(A2:D5, 9, 1)")).toMatchObject({
      error: "#REF!",
      result: null,
    });
    expect(
      parser.parse('INDEX(A2:D5, MATCH("amy", A2:A5, 0), 2)')
    ).toMatchObject({ error: null, result: "Sales" });
  });

  it("FILTER", () => {
    parser.setVariable("mask", [[true], [false], [true], [false]]);
    expect(parser.parse("FILTER(A2:B5, mask)")).toMatchObject({
      error: null,
      result: [
        ["Tom", "Sales"],
        ["Amy", "Sales"],
      ],
    });
    parser.setVariable("none", [[false], [false], [false], [false]]);
    expect(parser.parse("FILTER(A2:B5, none)")).toMatchObject({
      error: "#CALC!",
      result: null,
    });
    expect(parser.parse('FILTER(A2:B5, none, "empty")')).toMatchObject({
      error: null,
      result: "empty",
    });
  });

  it("SORT / SORTBY / UNIQUE", () => {
    expect(parser.parse("SORT(C2:C5)")).toMatchObject({
      error: null,
      result: [[22], [52], [65], [65]],
    });
    expect(parser.parse("SORT(A2:C5, 3, -1)")).toMatchObject({
      error: null,
      result: [
        ["fred", "Ops", 65],
        ["Sal", "IT", 65],
        ["Tom", "Sales", 52],
        ["Amy", "Sales", 22],
      ],
    });
    expect(parser.parse("SORT(A2:A5)")).toMatchObject({
      error: null,
      result: [["Amy"], ["fred"], ["Sal"], ["Tom"]],
    });
    expect(parser.parse("SORTBY(A2:A5, C2:C5, -1, A2:A5, 1)")).toMatchObject({
      error: null,
      result: [["fred"], ["Sal"], ["Tom"], ["Amy"]],
    });
    expect(parser.parse("UNIQUE(B2:B5)")).toMatchObject({
      error: null,
      result: [["Sales"], ["Ops"], ["IT"]],
    });
    expect(parser.parse("UNIQUE(B2:B5, FALSE, TRUE)")).toMatchObject({
      error: null,
      result: [["Ops"], ["IT"]],
    });
  });

  it("SEQUENCE / RANDARRAY", () => {
    expect(parser.parse("SEQUENCE(2, 3)")).toMatchObject({
      error: null,
      result: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    });
    expect(parser.parse("SEQUENCE(3, 1, 10, -5)")).toMatchObject({
      error: null,
      result: [[10], [5], [0]],
    });
    expect(parser.parse("SEQUENCE(0)")).toMatchObject({
      error: "#CALC!",
      result: null,
    });
    expect(parser.parse("SUM(SEQUENCE(10))")).toMatchObject({
      error: null,
      result: 55,
    });
    const { result } = parser.parse("RANDARRAY(2, 2, 1, 6, TRUE)");
    expect(result).toHaveLength(2);
    result.flat().forEach((v) => {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    });
  });

  it("TAKE / DROP / EXPAND", () => {
    expect(parser.parse("TAKE(A2:D5, 2, 1)")).toMatchObject({
      error: null,
      result: [["Tom"], ["fred"]],
    });
    expect(parser.parse("TAKE(A2:D5, -1, -2)")).toMatchObject({
      error: null,
      result: [[65, 5]],
    });
    expect(parser.parse("DROP(A2:C5, 3, 1)")).toMatchObject({
      error: null,
      result: [["IT", 65]],
    });
    expect(parser.parse("DROP(A2:C5, 4)")).toMatchObject({
      error: "#CALC!",
      result: null,
    });
    expect(parser.parse("EXPAND(SEQUENCE(2), 2, 2, 0)")).toMatchObject({
      error: null,
      result: [
        [1, 0],
        [2, 0],
      ],
    });
    expect(parser.parse("SUM(TAKE(SEQUENCE(10), -3))")).toMatchObject({
      error: null,
      result: 27,
    });
  });

  it("TOCOL / TOROW / WRAPROWS / WRAPCOLS", () => {
    expect(parser.parse("TOROW(C2:D3)")).toMatchObject({
      error: null,
      result: [[52, 7, 65, 9]],
    });
    expect(parser.parse("TOCOL(C2:D3, 0, TRUE)")).toMatchObject({
      error: null,
      result: [[52], [65], [7], [9]],
    });
    expect(parser.parse("TOROW(D2:D6, 1)")).toMatchObject({
      error: null,
      result: [[7, 9, 5]],
    });
    expect(parser.parse("WRAPROWS(SEQUENCE(1, 6), 3)")).toMatchObject({
      error: null,
      result: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    });
    expect(parser.parse("WRAPCOLS(SEQUENCE(5), 2, 0)")).toMatchObject({
      error: null,
      result: [
        [1, 3, 5],
        [2, 4, 0],
      ],
    });
    expect(parser.parse("WRAPCOLS(SEQUENCE(5), 0)")).toMatchObject({
      error: "#NUM!",
      result: null,
    });
  });

  it("CHOOSEROWS / CHOOSECOLS / HSTACK / VSTACK", () => {
    expect(parser.parse("CHOOSEROWS(A2:B5, 1, -1)")).toMatchObject({
      error: null,
      result: [
        ["Tom", "Sales"],
        ["Sal", "IT"],
      ],
    });
    expect(parser.parse("CHOOSECOLS(A1:D2, 4, 1)")).toMatchObject({
      error: null,
      result: [
        ["Score", "Name"],
        [7, "Tom"],
      ],
    });
    expect(parser.parse("CHOOSECOLS(A1:D2, 5)")).toMatchObject({
      error: "#VALUE!",
      result: null,
    });
    expect(parser.parse("HSTACK(A2:A3, C2:C3)")).toMatchObject({
      error: null,
      result: [
        ["Tom", 52],
        ["fred", 65],
      ],
    });
    expect(parser.parse("VSTACK(A1:B1, A5:B5)")).toMatchObject({
      error: null,
      result: [
        ["Name", "Dept"],
        ["Sal", "IT"],
      ],
    });
  });

  it("TRIMRANGE", () => {
    expect(parser.parse("TRIMRANGE(C4:D6)")).toMatchObject({
      error: null,
      result: [
        [22, null],
        [65, 5],
      ],
    });
    expect(parser.parse("TRIMRANGE(C4:D6, 0)")).toMatchObject({
      error: null,
      result: [
        [22, null],
        [65, 5],
        [null, null],
      ],
    });
  });
});
