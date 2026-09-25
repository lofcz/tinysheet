// T5: Excel's numeric model. Excel stores IEEE doubles but works to 15
// significant digits: comparisons are made at 15 digits (=0.1+0.2=0.3 is
// TRUE), results show no binary noise (=0.1+0.2 is 0.3), a sum that cancels
// to rounding noise is 0, there is no negative zero, results beyond
// ±1.79769313486232E+308 are #NUM! and division by zero or a blank is
// #DIV/0!.
import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

describe(".parse() numeric model", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("15 significant digits", () => {
    it("compares at 15 significant digits", () => {
      expect(value("0.1+0.2=0.3")).toBe(true);
      expect(value("1-0.9=0.1")).toBe(true);
      expect(value("0.1+0.2<>0.3")).toBe(false);
      expect(value("0.1*3>=0.3")).toBe(true);
      expect(value("1.0000000000000002=1")).toBe(true);
      expect(value("1.00000000000001=1")).toBe(false);
      expect(value('IF(0.1+0.2=0.3,"eq","ne")')).toBe("eq");
    });

    it("removes binary noise from results", () => {
      expect(value("0.1+0.2")).toBe(0.3);
      expect(value("0.1*3")).toBe(0.3);
      expect(value("1.1*3")).toBe(3.3);
      expect(value("1-0.9")).toBe(0.1);
      expect(value("SUM(0.1,0.2)")).toBe(0.3);
      expect(value("{0.1,0.2}+0.2")).toEqual([[0.3, 0.4]]);
      expect(value('(0.1+0.2)&""')).toBe("0.3");
    });

    it("keeps genuinely precise values", () => {
      expect(value("1/3")).toBe(1 / 3);
      expect(value("2/3")).toBe(2 / 3);
      expect(value("PI()/2")).toBe(Math.PI / 2);
      expect(value("2^53")).toBe(2 ** 53);
      // oxlint-disable-next-line no-loss-of-precision -- tests the rounding
      expect(value("123456789012345678")).toBe(123456789012345678);
    });

    it("cancels sums to zero at the noise level", () => {
      expect(value("0.1+0.2-0.3")).toBe(0);
      expect(value("1-0.9-0.1")).toBe(0);
      expect(value("(0.1+0.2-0.3)*1E+20")).toBe(0);
      expect(value("1E-20-0")).toBe(1e-20);
      expect(value("1E+15+1-1E+15")).toBe(1);
    });
  });

  describe("negative zero", () => {
    it("is zero", () => {
      expect(Object.is(parser.parse("0*-1").result, 0)).toBe(true);
      expect(Object.is(parser.parse("-0").result, 0)).toBe(true);
      expect(Object.is(parser.parse("-A1*0").result, 0)).toBe(true);
      expect(Object.is(parser.parse("{1}*-0").result[0][0], 0)).toBe(true);
    });
  });

  describe("overflow", () => {
    it("is #NUM!", () => {
      expect(value("1E+308*10")).toBe("#NUM!");
      expect(value("10^309")).toBe("#NUM!");
      expect(value("1E+309")).toBe("#NUM!");
      expect(value("-1E+308*10")).toBe("#NUM!");
      expect(value("EXP(1000)")).toBe("#NUM!");
      expect(value("FACT(200)")).toBe("#NUM!");
      expect(value('IFERROR(EXP(1000),"big")')).toBe("big");
      expect(value("EXP({1000,0})")).toEqual([["#NUM!", 1]]);
    });

    it("keeps the largest and smallest doubles", () => {
      expect(value("1.79769313486231E+308")).toBe(1.79769313486231e308);
      expect(value("1E-300*1E-300")).toBe(0);
      expect(value("2.2250738585072E-308")).toBe(2.2250738585072e-308);
    });
  });

  describe("division", () => {
    it("by zero or blank is #DIV/0!", () => {
      expect(value("1/0")).toBe("#DIV/0!");
      expect(value("1/C1")).toBe("#DIV/0!");
      expect(value("0/0")).toBe("#DIV/0!");
      expect(value("{1,2}/{1,0}")).toEqual([[1, "#DIV/0!"]]);
      expect(value("MOD(1,0)")).toBe("#DIV/0!");
    });
  });
});
