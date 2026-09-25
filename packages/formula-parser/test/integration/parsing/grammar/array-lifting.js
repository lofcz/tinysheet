// T2: implicit array lifting. In Excel 365 a function that expects a single
// value and receives an array (or a multi-cell range) is evaluated once per
// element and returns an array of the same shape ("lifting"), e.g.
// =ABS({-1,2}) → {1,2}, =LEN(A1:A3) spills three lengths. Aggregates and
// lookup arrays (SUM, SUMPRODUCT, MATCH's lookup_array, ...) are not lifted.
import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

//     A      B       C
// 1   1      "x"     (blank)
// 2   2      "y"     "#N/A"
// 3   3      "x"     "#DIV/0!"
// 4   4      "z"     TRUE
// 5   5      "x"     "10"
describe(".parse() array lifting", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("formulajs and built-in scalar functions", () => {
    it("lift over array constants", () => {
      expect(value("ABS({-1,2})")).toEqual([[1, 2]]);
      expect(value("ABS({-1;-2})")).toEqual([[1], [2]]);
      expect(value("SQRT({4,9;16,25})")).toEqual([
        [2, 3],
        [4, 5],
      ]);
      expect(value('UPPER({"a","b"})')).toEqual([["A", "B"]]);
      expect(value("NOT({TRUE,FALSE})")).toEqual([[false, true]]);
    });

    it("lift over ranges", () => {
      expect(value("ROUND(A1:A3/3, 1)")).toEqual([[0.3], [0.7], [1]]);
      expect(value("ROUND(A1:A3, 0)")).toEqual([[1], [2], [3]]);
      expect(value("LEN(B1:B3)")).toEqual([[1], [1], [1]]);
      expect(value("ISNUMBER(A1:C1)")).toEqual([[true, false, false]]);
      expect(value("ISTEXT(B1:B2)")).toEqual([[true], [true]]);
      expect(value('CONCATENATE(B1:B3, "!")')).toEqual([
        ["x!"],
        ["y!"],
        ["x!"],
      ]);
    });

    it("lift date functions", () => {
      expect(value("DATE(2020, {1,2}, 1)")).toEqual([[43831, 43862]]);
      expect(value("YEAR(DATE({2020;2021}, 1, 1))")).toEqual([[2020], [2021]]);
    });

    it("broadcast several array arguments", () => {
      expect(value("ROUND({1.25,2.35}, {1;0})")).toEqual([
        [1.3, 2.4],
        [1, 2],
      ]);
      expect(value("ROUND({1.5,2.5,3.5}, {0,0})")).toEqual([[2, 3, "#N/A"]]);
    });

    it("keeps errors per element", () => {
      expect(value("ABS(C1:C3)")).toEqual([[0], ["#N/A"], ["#DIV/0!"]]);
      expect(value("SQRT({4,-1})")).toEqual([[2, "#NUM!"]]);
      expect(value('IFERROR(SQRT({4,-1}), "neg")')).toEqual([[2, "neg"]]);
      expect(value("ISERROR(C1:C3)")).toEqual([[false], [true], [true]]);
    });

    it("returns a scalar for a single element", () => {
      expect(value("ABS({-5})")).toBe(5);
    });
  });

  describe("functions that take arrays are not lifted", () => {
    it("aggregates", () => {
      expect(value("SUM(A1:A3)")).toBe(6);
      expect(value("SUMPRODUCT({1,2}, {3,4})")).toBe(11);
      expect(value("AND({TRUE,FALSE})")).toBe(false);
      expect(value("COUNTA(B1:B5)")).toBe(5);
      expect(value("TYPE({1,2})")).toBe(64);
    });

    it("lookup arrays, but not the lookup value", () => {
      expect(value("MATCH(3, A1:A5, 0)")).toBe(3);
      expect(value("MATCH({2,4}, A1:A5, 0)")).toEqual([[2, 4]]);
      expect(value("LARGE(A1:A5, {1,2})")).toEqual([[5, 4]]);
      expect(value("RANK(A1:A2, A1:A5)")).toEqual([[5], [4]]);
    });

    it("criteria of the *IF functions are lifted", () => {
      expect(value('COUNTIF(A1:A5, {">2","<2"})')).toEqual([[3, 1]]);
      expect(value('SUMIF(B1:B5, {"x";"y"}, A1:A5)')).toEqual([[9], [2]]);
    });
  });

  describe("custom functions", () => {
    it("receive arrays unchanged by default", () => {
      parser.setFunction("SHAPE", ([x]) =>
        Array.isArray(x) ? `${x.length}x${x[0].length}` : "scalar"
      );

      expect(value("SHAPE({1,2;3,4})")).toBe("2x2");
      expect(value("SHAPE(A1:A3)")).toBe("3x1");
    });

    it("are lifted when they declare their array parameters", () => {
      const twice = ([x, factor]) => x * (factor === undefined ? 2 : factor);

      twice.arrayParams = [];
      parser.setFunction("TWICE", twice);
      expect(value("TWICE({1,2})")).toEqual([[2, 4]]);
      expect(value("TWICE(A1:A2, {10,100})")).toEqual([
        [10, 100],
        [20, 200],
      ]);

      const total = ([values, add]) =>
        values.flat().reduce((sum, v) => sum + v, 0) + add;

      total.arrayParams = [0];
      parser.setFunction("TOTALPLUS", total);
      expect(value("TOTALPLUS(A1:A3, {0,10})")).toEqual([[6, 16]]);
    });

    it("pass per-element references when lifted", () => {
      const seen = [];
      const probe = (params, refs) => {
        seen.push(refs[0]);

        return params[0];
      };

      probe.arrayParams = [];
      parser.setFunction("PROBE", probe);
      expect(value("PROBE(A2:A3)")).toEqual([[2], [3]]);
      expect(seen.map((r) => [r.startRow, r.startColumn])).toEqual([
        [1, 0],
        [2, 0],
      ]);
    });

    it("an override of an Excel function follows its traits", () => {
      parser.setFunction("ABS", ([x]) => (x < 0 ? -x * 10 : x * 10));

      expect(value("ABS({-1,2})")).toEqual([[10, 20]]);
    });

    it("emits callFunction once per element", () => {
      let calls = 0;

      parser.on("callFunction", (name) => {
        if (name === "ABS") {
          calls += 1;
        }
      });
      value("ABS(A1:A4)");
      expect(calls).toBe(4);
    });
  });
});
