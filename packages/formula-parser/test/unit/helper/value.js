import formulajs from "../../../src/formulajs";
import {
  compare,
  dateToSerial,
  equals,
  errorCode,
  formatGeneral,
  isErrorString,
  parseNumericText,
  toBoolean,
  toErrorValue,
  toNumber,
  toText,
} from "../../../src/helper/value";

describe("helper/value", () => {
  describe("error values", () => {
    it("reuses the formulajs error singletons", () => {
      const { errors } = formulajs.utils;

      expect(toErrorValue("N/A")).toBe(errors.na);
      expect(toErrorValue("#DIV/0!")).toBe(errors.div0);
      expect(toErrorValue(new Error("VALUE"))).toBe(errors.value);
      expect(toErrorValue("#CALC!").message).toBe("#CALC!");
      expect(toErrorValue("#SPILL!").message).toBe("#SPILL!");
    });

    it("maps unknown failures to #ERROR! and stack overflows to #NUM!", () => {
      expect(toErrorValue(new TypeError("x is undefined")).message).toBe(
        "#ERROR!"
      );
      expect(toErrorValue(new RangeError("Maximum call stack")).message).toBe(
        "#NUM!"
      );
    });

    it("normalises error codes", () => {
      expect(errorCode("DIV/0")).toBe("#DIV/0!");
      expect(errorCode(new Error("#N/A"))).toBe("#N/A");
      expect(errorCode("nope")).toBe("#ERROR!");
    });

    it("recognises error literals in text", () => {
      expect(isErrorString("#N/A")).toBe(true);
      expect(isErrorString("#VALUE!")).toBe(true);
      expect(isErrorString("#n/a")).toBe(false);
      expect(isErrorString("# hashtag")).toBe(false);
      expect(isErrorString(5)).toBe(false);
    });
  });

  describe("toNumber()", () => {
    it("coerces scalars like Excel arithmetic", () => {
      expect(toNumber(5)).toBe(5);
      expect(toNumber(true)).toBe(1);
      expect(toNumber(false)).toBe(0);
      expect(toNumber(null)).toBe(0);
      expect(toNumber(void 0)).toBe(0);
      expect(toNumber("12.5")).toBe(12.5);
      expect(toNumber([[7, 8]])).toBe(7);
      expect(toNumber(new Date(2024, 0, 2))).toBe(45293);
    });

    it("throws #VALUE! for text and the error for error values", () => {
      expect(() => toNumber("abc")).toThrow("#VALUE!");
      expect(() => toNumber("")).toThrow("#VALUE!");
      expect(() => toNumber(() => 1)).toThrow("#VALUE!");
      expect(() => toNumber(toErrorValue("REF"))).toThrow("#REF!");
    });
  });

  describe("parseNumericText()", () => {
    it("accepts Excel's numeric text forms", () => {
      expect(parseNumericText(" -1,234.5 ")).toBe(-1234.5);
      expect(parseNumericText("+3")).toBe(3);
      expect(parseNumericText("2.5E+3")).toBe(2500);
      expect(parseNumericText("12.5%")).toBe(0.125);
      expect(parseNumericText("$1,000")).toBe(1000);
      expect(parseNumericText("-$5")).toBe(-5);
      expect(parseNumericText("(7)")).toBe(-7);
      expect(parseNumericText(".5")).toBe(0.5);
    });

    it("accepts dates and times", () => {
      expect(parseNumericText("2024-01-02")).toBe(45293);
      expect(parseNumericText("1/2/2024")).toBe(45293);
      expect(parseNumericText("1/2/24")).toBe(45293);
      expect(parseNumericText("18:00")).toBe(0.75);
      expect(parseNumericText("12:00 AM")).toBe(0);
      expect(parseNumericText("2024-01-02 12:00")).toBe(45293.5);
    });

    it("rejects everything else", () => {
      expect(parseNumericText("")).toBe(null);
      expect(parseNumericText("abc")).toBe(null);
      expect(parseNumericText("1,23")).toBe(null);
      expect(parseNumericText("2024-02-30")).toBe(null);
      expect(parseNumericText("25:61")).toBe(null);
      expect(parseNumericText("(-5)")).toBe(null);
      expect(parseNumericText("13:00 PM")).toBe(null);
    });
  });

  describe("toText() / formatGeneral()", () => {
    it("formats numbers with 15 significant digits", () => {
      expect(formatGeneral(0)).toBe("0");
      expect(formatGeneral(-0)).toBe("0");
      expect(formatGeneral(42)).toBe("42");
      expect(formatGeneral(0.1 + 0.2)).toBe("0.3");
      expect(formatGeneral(2 / 3)).toBe("0.666666666666667");
      expect(formatGeneral(123456789012345)).toBe("123456789012345");
      expect(formatGeneral(1e15)).toBe("1E+15");
      expect(formatGeneral(-1.5e-12)).toBe("-1.5E-12");
      expect(formatGeneral(0.000001)).toBe("0.000001");
      expect(formatGeneral(1e100)).toBe("1E+100");
    });

    it("converts other scalars", () => {
      expect(toText("a")).toBe("a");
      expect(toText(true)).toBe("TRUE");
      expect(toText(null)).toBe("");
      expect(toText(void 0)).toBe("");
      expect(() => toText(toErrorValue("NUM"))).toThrow("#NUM!");
    });
  });

  describe("toBoolean()", () => {
    it("coerces like IF()", () => {
      expect(toBoolean(1)).toBe(true);
      expect(toBoolean(0)).toBe(false);
      expect(toBoolean("true")).toBe(true);
      expect(toBoolean("FALSE")).toBe(false);
      expect(toBoolean(null)).toBe(false);
      expect(() => toBoolean("yes")).toThrow("#VALUE!");
    });
  });

  describe("compare()", () => {
    it("orders numbers < text < logicals", () => {
      expect(compare(1e9, "")).toBe(-1);
      expect(compare("zzz", false)).toBe(-1);
      expect(compare(true, 1)).toBe(1);
    });

    it("compares text case-insensitively", () => {
      expect(compare("abc", "ABC")).toBe(0);
      expect(compare("a", "B")).toBe(-1);
      expect(compare("é", "e")).not.toBe(0);
    });

    it("treats blanks as the other operand's empty value", () => {
      expect(compare(null, 0)).toBe(0);
      expect(compare(void 0, "")).toBe(0);
      expect(compare(null, false)).toBe(0);
      expect(compare(null, null)).toBe(0);
      expect(compare(null, -1)).toBe(1);
    });

    it("rounds numbers to 15 significant digits", () => {
      expect(equals(0.1 + 0.2, 0.3)).toBe(true);
      expect(equals(1, 1.0000001)).toBe(false);
    });

    it("throws error operands, left first", () => {
      expect(() => compare(toErrorValue("N/A"), toErrorValue("REF"))).toThrow(
        "#N/A"
      );
      expect(() => compare(1, toErrorValue("REF"))).toThrow("#REF!");
    });
  });

  it("dateToSerial() uses local calendar components", () => {
    expect(dateToSerial(new Date(1900, 2, 1))).toBe(61);
    expect(dateToSerial(new Date(2024, 0, 1, 6))).toBe(45292.25);
  });
});
