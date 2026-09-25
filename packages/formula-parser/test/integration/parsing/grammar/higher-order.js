import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

describe(".parse() higher-order LAMBDA functions", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("MAP", () => {
    it("maps every element", () => {
      expect(value("MAP({1,2,3}, LAMBDA(x, x * 2))")).toEqual([[2, 4, 6]]);
      expect(value("MAP({1,2;3,4}, LAMBDA(x, x^2))")).toEqual([
        [1, 4],
        [9, 16],
      ]);
      expect(value("MAP(A1:A3, LAMBDA(v, v + 10))")).toEqual([
        [11],
        [12],
        [13],
      ]);
      expect(value('MAP(B1:B3, LAMBDA(v, IF(v = "x", "yes", "no")))')).toEqual([
        ["yes"],
        ["no"],
        ["yes"],
      ]);
    });

    it("zips several arrays", () => {
      expect(value("MAP({1,2}, {10,20}, LAMBDA(a, b, a + b))")).toEqual([
        [11, 22],
      ]);
      expect(value("MAP({1,2,3}, {10,20}, LAMBDA(a, b, a + b))")).toEqual([
        [11, 22, "#N/A"],
      ]);
    });

    it("accepts a LAMBDA stored in LET", () => {
      expect(value("LET(f, LAMBDA(x, x * 3), MAP({1,2}, f))")).toEqual([
        [3, 6],
      ]);
      expect(value("SUM(MAP({1,2,3}, LAMBDA(x, x * x)))")).toBe(14);
    });

    it("keeps errors per element", () => {
      expect(value("MAP({1,0,2}, LAMBDA(x, 1 / x))")).toEqual([
        [1, "#DIV/0!", 0.5],
      ]);
      expect(value("MAP({1,2}, LAMBDA(x, {1,2}))")).toEqual([
        ["#CALC!", "#CALC!"],
      ]);
      expect(value("MAP({1,2}, LAMBDA(x, {7}))")).toEqual([[7, 7]]);
    });

    it("validates the LAMBDA", () => {
      expect(value("MAP({1,2}, LAMBDA(a, b, a))")).toBe("#VALUE!");
      expect(value("MAP({1,2}, 5)")).toBe("#VALUE!");
      expect(value("MAP(LAMBDA(x, x))")).toBe("#VALUE!");
    });
  });

  describe("REDUCE", () => {
    it("folds row by row", () => {
      expect(value("REDUCE(0, {1,2,3}, LAMBDA(a, b, a + b))")).toBe(6);
      expect(value("REDUCE(1, {1,2;3,4}, LAMBDA(a, b, a * b))")).toBe(24);
      expect(value('REDUCE("", {"a","b";"c","d"}, LAMBDA(a, b, a & b))')).toBe(
        "abcd"
      );
      expect(
        value("REDUCE(0, A1:A5, LAMBDA(acc, v, IF(v > 2, acc + 1, acc)))")
      ).toBe(3);
    });

    it("starts from blank when the initial value is omitted", () => {
      expect(value("REDUCE(, {1,2,3}, LAMBDA(a, b, a + b))")).toBe(6);
    });

    it("can accumulate arrays", () => {
      expect(value("REDUCE({0,0}, {1,2}, LAMBDA(a, b, a + b))")).toEqual([
        [3, 3],
      ]);
    });

    it("propagates errors from the steps", () => {
      expect(value("REDUCE(0, {1,0}, LAMBDA(a, b, a + 1 / b))")).toBe(
        "#DIV/0!"
      );
      expect(value("REDUCE(0, {1,2}, LAMBDA(a, a))")).toBe("#VALUE!");
    });
  });

  describe("SCAN", () => {
    it("returns the running accumulator in the shape of the array", () => {
      expect(value("SCAN(0, {1,2,3}, LAMBDA(a, b, a + b))")).toEqual([
        [1, 3, 6],
      ]);
      expect(value("SCAN(1, {1,2;3,4}, LAMBDA(a, b, a * b))")).toEqual([
        [1, 2],
        [6, 24],
      ]);
      expect(value('SCAN("", {"a","b","c"}, LAMBDA(a, b, a & b))')).toEqual([
        ["a", "ab", "abc"],
      ]);
    });

    it("keeps errors per element", () => {
      expect(value("SCAN(0, {1,#N/A,2}, LAMBDA(a, b, b))")).toEqual([
        [1, "#N/A", 2],
      ]);
    });
  });

  describe("BYROW / BYCOL", () => {
    it("applies the LAMBDA to each row", () => {
      expect(value("BYROW({1,2;3,4}, LAMBDA(r, SUM(r)))")).toEqual([[3], [7]]);
      expect(value("BYROW({1,2,3;4,5,6}, LAMBDA(r, COLUMNS(r)))")).toEqual([
        [3],
        [3],
      ]);
      expect(value("BYROW(A1:A3, LAMBDA(r, r * 2))")).toEqual([[2], [4], [6]]);
    });

    it("applies the LAMBDA to each column", () => {
      expect(value("BYCOL({1,2;3,4}, LAMBDA(c, SUM(c)))")).toEqual([[4, 6]]);
      expect(value("BYCOL({1,2;3,4;5,6}, LAMBDA(c, ROWS(c)))")).toEqual([
        [3, 3],
      ]);
      expect(value("BYCOL({1,9;3,4}, LAMBDA(c, MAX(c)))")).toEqual([[3, 9]]);
    });

    it("reports #CALC! for array results", () => {
      expect(value("BYROW({1,2;3,4}, LAMBDA(r, r))")).toEqual([
        ["#CALC!"],
        ["#CALC!"],
      ]);
    });

    it("validates the LAMBDA", () => {
      expect(value("BYROW({1,2}, LAMBDA(a, b, a))")).toBe("#VALUE!");
      expect(value("BYCOL({1,2}, 1)")).toBe("#VALUE!");
    });
  });

  describe("MAKEARRAY", () => {
    it("builds an array from 1-based indexes", () => {
      expect(value("MAKEARRAY(2, 3, LAMBDA(r, c, r * c))")).toEqual([
        [1, 2, 3],
        [2, 4, 6],
      ]);
      expect(value("MAKEARRAY(3, 3, LAMBDA(r, c, IF(r = c, 1, 0)))")).toEqual([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]);
      expect(value("MAKEARRAY(2.9, 1, LAMBDA(r, c, r))")).toEqual([[1], [2]]);
      expect(value('MAKEARRAY(1, 2, LAMBDA(r, c, "x" & c))')).toEqual([
        ["x1", "x2"],
      ]);
    });

    it("rejects invalid sizes and LAMBDAs", () => {
      expect(value("MAKEARRAY(0, 1, LAMBDA(r, c, 1))")).toBe("#VALUE!");
      expect(value('MAKEARRAY("a", 1, LAMBDA(r, c, 1))')).toBe("#VALUE!");
      expect(value("MAKEARRAY(1, 1, LAMBDA(r, 1))")).toBe("#VALUE!");
      expect(value("MAKEARRAY(1/0, 1, LAMBDA(r, c, 1))")).toBe("#DIV/0!");
    });
  });

  it("composes with the other array features", () => {
    expect(
      value(
        "LET(data, {1,2,3,4}, double, LAMBDA(x, x * 2), SUM(MAP(data, double)) + REDUCE(0, data, LAMBDA(a, v, a + v)))"
      )
    ).toBe(30);
    expect(
      value(
        "SUM(BYROW(MAKEARRAY(3, 2, LAMBDA(r, c, r + c)), LAMBDA(row, MAX(row))))"
      )
    ).toBe(12);
  });
});
