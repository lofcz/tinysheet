// T1: typed arguments versus references in aggregates.
//
// Excel (SUM, AVERAGE, COUNT, MIN, MAX, PRODUCT documentation):
// "Logical values and text representations of numbers that you type directly
// into the list of arguments are counted. If an argument is an array or
// reference, only numbers in that array or reference are counted. Empty
// cells, logical values, or text in the array or reference are ignored.
// If any arguments are error values, or text that cannot be translated into
// numbers, Excel displays errors."
import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

//     A      B       C
// 1   1      "x"     (blank)
// 2   2      "y"     "#N/A"
// 3   3      "x"     "#DIV/0!"
// 4   4      "z"     TRUE
// 5   5      "x"     "10"
describe(".parse() typed arguments and references", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("SUM", () => {
    it("coerces typed arguments", () => {
      expect(value('SUM("3")')).toBe(3);
      expect(value('SUM("3", 1)')).toBe(4);
      expect(value("SUM(TRUE, 1)")).toBe(2);
      expect(value("SUM(FALSE, 1)")).toBe(1);
      expect(value('SUM("1/31/2024")')).toBe(45322);
    });

    it("rejects typed text that is not a number", () => {
      expect(value('SUM("abc")')).toBe("#VALUE!");
      expect(value('SUM(1, "abc")')).toBe("#VALUE!");
      expect(value('SUM("")')).toBe("#VALUE!");
    });

    it("ignores logicals and text in single-cell references", () => {
      expect(value("SUM(C4)")).toBe(0);
      expect(value("SUM(C4, 1)")).toBe(1);
      expect(value("SUM(C5)")).toBe(0);
      expect(value("SUM(B1)")).toBe(0);
      expect(value("SUM(C1)")).toBe(0);
      expect(value("SUM(A1, B1, C4, C5)")).toBe(1);
    });

    it("ignores logicals and text in ranges and arrays", () => {
      expect(value("SUM(A1:C1)")).toBe(1);
      expect(value("SUM(C4:C5)")).toBe(0);
      expect(value('SUM({1,"2",TRUE})')).toBe(1);
    });

    it("propagates errors from references", () => {
      expect(value("SUM(C2)")).toBe("#N/A");
      expect(value("SUM(C1:C3)")).toBe("#N/A");
    });

    it("treats references returned by functions as references", () => {
      expect(value("SUM(IF(TRUE, C4))")).toBe(0);
      expect(value("SUM(IF(TRUE, C4 * 1))")).toBe(1);
      expect(value("SUM(CHOOSE(1, C5, A1))")).toBe(0);
      expect(value("SUM(INDEX(C1:C5, 4))")).toBe(0);
      expect(value("SUM(LET(x, C4, x))")).toBe(0);
    });
  });

  describe("COUNT", () => {
    it("counts typed numbers, logicals and numeric text", () => {
      expect(value('COUNT("3")')).toBe(1);
      expect(value("COUNT(TRUE)")).toBe(1);
      expect(value('COUNT("abc")')).toBe(0);
      expect(value('COUNT(A1, C5, "7")')).toBe(2);
    });

    it("counts only numbers in references", () => {
      expect(value("COUNT(C4)")).toBe(0);
      expect(value("COUNT(C5)")).toBe(0);
      expect(value("COUNT(A1:C5)")).toBe(5);
      expect(value("COUNT(C2)")).toBe(0);
    });

    it("does not count error values", () => {
      expect(value("COUNT(1/0, 1)")).toBe(1);
      expect(value("COUNTA(C4, C5, C1)")).toBe(2);
    });
  });

  describe("AVERAGE, MIN, MAX, PRODUCT", () => {
    it("follow the same rules as SUM", () => {
      expect(value('AVERAGE("abc")')).toBe("#VALUE!");
      expect(value("AVERAGE(TRUE, 3)")).toBe(2);
      expect(value("AVERAGE(C4, 2)")).toBe(2);
      expect(value("AVERAGE(C4)")).toBe("#DIV/0!");
      expect(value('MIN("abc")')).toBe("#VALUE!");
      expect(value("MIN(C4, 3)")).toBe(3);
      expect(value("MAX(C4)")).toBe(0);
      expect(value("MAX(TRUE)")).toBe(1);
      expect(value('MAX(C5, "12")')).toBe(12);
      expect(value('PRODUCT("2", 3)')).toBe(6);
      expect(value("PRODUCT(C5, 3)")).toBe(3);
      expect(value('MEDIAN(C4, 1, "3")')).toBe(2);
      expect(value('STDEV("abc", 1, 2)')).toBe("#VALUE!");
    });
  });

  describe("A-variants", () => {
    it("count logicals and text in references, reject typed text", () => {
      expect(value("AVERAGEA(C4)")).toBe(1);
      expect(value("AVERAGEA(B1, 2)")).toBe(1);
      expect(value("MAXA(C4)")).toBe(1);
      expect(value("MINA(B1, 5)")).toBe(0);
      expect(value('AVERAGEA("abc")')).toBe("#VALUE!");
      expect(value("AVERAGEA(TRUE, 3)")).toBe(2);
    });
  });

  describe("SUBTOTAL and NPV", () => {
    it("treat their reference arguments as references", () => {
      expect(value("SUBTOTAL(9, C4, A2)")).toBe(2);
      expect(value("SUBTOTAL(2, C5, A1)")).toBe(1);
      expect(value("NPV(0, C4, A1)")).toBe(1);
    });
  });

  it("still passes reference descriptors to callFunction listeners", () => {
    let seen = null;

    parser.on("callFunction", (name, params, done, refs) => {
      if (name === "SUM") {
        seen = { params, refs };
      }
    });

    expect(value("SUM(A1, 2)")).toBe(3);
    expect(seen.params).toEqual([[[1]], 2]);
    expect(seen.refs).toEqual([
      {
        sheetName: null,
        startRow: 0,
        startColumn: 0,
        endRow: 0,
        endColumn: 0,
      },
      null,
    ]);
  });
});
