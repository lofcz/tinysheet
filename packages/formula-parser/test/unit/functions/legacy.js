import Parser from "../../../src/parser";
import SUPPORTED_FORMULAS from "../../../src/supported-formulas";
import { LEGACY_FUNCTION_NAMES } from "../../../src/index";

describe("legacy function aliases", () => {
  it("are all supported", () => {
    Object.keys(LEGACY_FUNCTION_NAMES).forEach((name) => {
      expect(SUPPORTED_FORMULAS).toContain(name);
    });
  });

  it("evaluate like their Excel counterparts", () => {
    const parser = new Parser();
    const pairs = [
      ["NORM_S_DIST(1, TRUE)", "NORM.S.DIST(1, TRUE)"],
      ['REGEXMATCH("abc", "b")', 'REGEXTEST("abc", "b")'],
      ["WORKDAY_INTL(45000, 5, 1)", "WORKDAY.INTL(45000, 5, 1)"],
    ];
    pairs.forEach(([legacy, excel]) => {
      const expected = parser.parse(excel);
      expect(expected.error).toBeNull();
      expect(parser.parse(legacy)).toEqual(expected);
    });
  });

  it("resolve every alias target to an implementation", () => {
    const parser = new Parser();
    // Called with no arguments, a missing implementation would be #NAME?.
    Object.keys(LEGACY_FUNCTION_NAMES).forEach((name) => {
      expect(parser.parse(`${name}()`).error).not.toBe("#NAME?");
    });
  });
});
