import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

describe(".parse() array constants and array arithmetic", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("{...} constants", () => {
    it("uses commas for columns and semicolons for rows", () => {
      expect(value("{1,2,3}")).toEqual([[1, 2, 3]]);
      expect(value("{1;2;3}")).toEqual([[1], [2], [3]]);
      expect(value("{1,2;3,4}")).toEqual([
        [1, 2],
        [3, 4],
      ]);
      expect(value("{7}")).toEqual([[7]]);
    });

    it("accepts numbers, text, logicals and errors", () => {
      expect(value('{-1.5,"a""b",TRUE,false,#N/A,+2,1E3}')).toEqual([
        [-1.5, 'a"b', true, false, "#N/A", 2, 1000],
      ]);
      expect(value("{1,#DIV/0!;#VALUE!,#REF!}")).toEqual([
        [1, "#DIV/0!"],
        ["#VALUE!", "#REF!"],
      ]);
    });

    it("tolerates whitespace", () => {
      expect(value("{ 1 , 2 ; 3 , 4 }")).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("rejects ragged, empty and non-constant arrays", () => {
      expect(value("{1,2;3}")).toBe("#ERROR!");
      expect(value("{}")).toBe("#ERROR!");
      expect(value("{A1}")).toBe("#ERROR!");
      expect(value("{1+1}")).toBe("#ERROR!");
      expect(value("{1,,2}")).toBe("#ERROR!");
      expect(value("{foo}")).toBe("#ERROR!");
      expect(value("{#FOO!}")).toBe("#ERROR!");
    });

    it("feeds functions with 2D arrays", () => {
      expect(value("SUM({1,2;3,4})")).toBe(10);
      expect(value("ROWS({1,2;3,4;5,6})")).toBe(3);
      expect(value("COLUMNS({1,2,3})")).toBe(3);
      expect(value("INDEX({1,2;3,4},2,1)")).toBe(3);
      expect(value("MAX({1,9;3,4})")).toBe(9);
      expect(value('COUNTA({"a",1,TRUE})')).toBe(3);
    });

    it("returns a fresh array on every evaluation", () => {
      const first = parser.parse("{1,2}").result;

      first[0][0] = 99;
      expect(parser.parse("{1,2}").result).toEqual([[1, 2]]);
    });

    it("keeps the legacy [a,b] argument list working", () => {
      expect(value("SUM([1,2,3])")).toBe(6);
      expect(value("SUM([])")).toBe(0);
    });
  });

  describe("element-wise operators", () => {
    it("combines arrays of the same size", () => {
      expect(value("{1,2}*{3,4}")).toEqual([[3, 8]]);
      expect(value("{1;2}+{10;20}")).toEqual([[11], [22]]);
      expect(value('{"a","b"}&{1,2}')).toEqual([["a1", "b2"]]);
      expect(value("{2,3}^{2,2}")).toEqual([[4, 9]]);
    });

    it("broadcasts scalars", () => {
      expect(value("{1,2,3}*2")).toEqual([[2, 4, 6]]);
      expect(value("10-{1;2}")).toEqual([[9], [8]]);
      expect(value('{1,2}&"x"')).toEqual([["1x", "2x"]]);
    });

    it("broadcasts a row against a column", () => {
      expect(value("{1;2}*{10,20}")).toEqual([
        [10, 20],
        [20, 40],
      ]);
    });

    it("pads mismatched sizes with #N/A", () => {
      expect(value("{1,2,3}+{10,20}")).toEqual([[11, 22, "#N/A"]]);
      expect(value("{1,2;3,4}+{1,2,3;4,5,6;7,8,9}")).toEqual([
        [2, 4, "#N/A"],
        [7, 9, "#N/A"],
        ["#N/A", "#N/A", "#N/A"],
      ]);
    });

    it("keeps errors per element", () => {
      expect(value("1/{1,0,2}")).toEqual([[1, "#DIV/0!", 0.5]]);
      expect(value('{1,"a"}+1')).toEqual([[2, "#VALUE!"]]);
      expect(value("{1,#N/A}*2")).toEqual([[2, "#N/A"]]);
    });

    it("applies unary minus and percent element-wise", () => {
      expect(value("-{1,-2}")).toEqual([[-1, 2]]);
      expect(value("{50,200}%")).toEqual([[0.5, 2]]);
    });

    it("lifts comparisons", () => {
      expect(value("{1,2,3}>1")).toEqual([[false, true, true]]);
      expect(value('{"a","B"}="b"')).toEqual([[false, true]]);
      expect(value("{1;2;3}={1,2,3}")).toEqual([
        [true, false, false],
        [false, true, false],
        [false, false, true],
      ]);
    });

    it("works over ranges", () => {
      expect(value("A1:A3*2")).toEqual([[2], [4], [6]]);
      expect(value('B1:B5="x"')).toEqual([
        [true],
        [false],
        [true],
        [false],
        [true],
      ]);
      expect(value("A1:A2+A4:A5")).toEqual([[5], [7]]);
    });

    it("supports the SUM((range>n)*range) idiom", () => {
      expect(value("SUM((A1:A5>2)*A1:A5)")).toBe(12);
      expect(value('SUM((B1:B5="x")*A1:A5)')).toBe(9);
      expect(value("SUM(({1,2,3,4,5}>2)*{10,20,30,40,50})")).toBe(120);
      expect(value("SUMPRODUCT((A1:A5>1)*1)")).toBe(4);
      expect(value('SUMPRODUCT(--(B1:B5="x"))')).toBe(3);
    });

    it("supports FILTER with lifted comparisons over whole columns", () => {
      expect(value('FILTER(A:A, B:B="x")')).toEqual([[1], [3], [5]]);
      expect(value("FILTER(A1:A5, A1:A5>3)")).toEqual([[4], [5]]);
    });

    it("lifts IF over array conditions", () => {
      expect(value("IF({TRUE,FALSE},1,2)")).toEqual([[1, 2]]);
      expect(value("IF({TRUE,FALSE},{1,2},{3,4})")).toEqual([[1, 4]]);
      expect(value('IF(A1:A3>1,"big","small")')).toEqual([
        ["small"],
        ["big"],
        ["big"],
      ]);
      expect(value("SUM(IF(A1:A5>2,A1:A5))")).toBe(12);
      expect(value("IF({1,0},1/0,2)")).toEqual([["#DIV/0!", 2]]);
      expect(value('IF({"x",1},1,2)')).toEqual([["#VALUE!", 1]]);
    });
  });
});
