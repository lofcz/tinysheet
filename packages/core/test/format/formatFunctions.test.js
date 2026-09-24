import { Parser } from "@lofcz/tinysheet-formula-parser";
import {
  TEXT,
  DOLLAR,
  FIXED,
  registerFormatFunctions,
} from "../../src/modules/formatFunctions";

const errorOf = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return null;
};

// Expected values are Excel's documented / observed results.
describe("TEXT", () => {
  test.each([
    [1234.567, "$#,##0.00", "$1,234.57"],
    [0.285, "0.0%", "28.5%"],
    [45366, "dddd, mmmm d, yyyy", "Friday, March 15, 2024"],
    [45366, "mm/dd/yy", "03/15/24"],
    [45366, "yyyy-mm-dd", "2024-03-15"],
    [0.75, "h:mm AM/PM", "6:00 PM"],
    [1.5, "[h]:mm", "36:00"],
    [4.34, "# ?/?", "4 1/3"],
    [1234, "0000000", "0001234"],
    [12200000, "0.00E+00", "1.22E+07"],
    [123456789, "000-00-0000", "123-45-6789"],
    [1234.5678, "0.00", "1234.57"],
    [1234.5678, "#,##0", "1,235"],
    [-5, "0;(0)", "(5)"],
    [0, '0;-0;"zero"', "zero"],
    [5, '0" items"', "5 items"],
    [1234.5678, "General", "1234.5678"],
    [1, "[Red]0.00", "1.00"],
    [12345678, '0.0,,"M"', "12.3M"],
  ])("TEXT(%p, %p) = %p", (v, fmt, expected) => {
    expect(TEXT(v, fmt)).toBe(expected);
  });

  test("numeric text is converted before formatting", () => {
    expect(TEXT("1234.5", "#,##0")).toBe("1,235");
    expect(TEXT("12%", "0.0")).toBe("0.1");
    expect(TEXT("3/15/2024", "yyyy-mm-dd")).toBe("2024-03-15");
    expect(TEXT("12:30", "h:mm AM/PM")).toBe("12:30 PM");
  });

  test("other text goes through the text section", () => {
    expect(TEXT("abc", "0.00")).toBe("abc");
    expect(TEXT("abc", '0;-0;0;"<"@">"')).toBe("<abc>");
  });

  test("booleans, blanks and numeric format arguments", () => {
    expect(TEXT(true, "0")).toBe("TRUE");
    expect(TEXT(null, "0.00")).toBe("0.00");
    expect(TEXT(undefined, "0.00")).toBe("0.00");
    expect(TEXT(5, "")).toBe("");
    expect(TEXT(1234.5, 0)).toBe("1235");
  });

  test("ranges use their first value", () => {
    expect(TEXT([[0.5, 2]], [["0%"]])).toBe("50%");
  });

  test("errors", () => {
    expect(errorOf(() => TEXT(new Error("DIV/0"), "0"))).toBe("DIV/0");
    expect(errorOf(() => TEXT("#N/A", "0"))).toBe("#N/A");
    expect(errorOf(() => TEXT(5, "0.0.0.0;;;;;"))).toBe("VALUE");
    expect(errorOf(() => TEXT(-1, "yyyy"))).toBe("VALUE");
    expect(errorOf(() => TEXT(5))).toBe("N/A");
  });
});

describe("DOLLAR", () => {
  test.each([
    [[1234.567, 2], "$1,234.57"],
    [[1234.567, -2], "$1,200"],
    [[-1234.567, -2], "($1,200)"],
    [[-0.123, 4], "($0.1230)"],
    [[99.888], "$99.89"],
    [[1.005, 2], "$1.01"],
    [[1234.5, 0], "$1,235"],
    [["1,234.5"], "$1,234.50"],
    [[true], "$1.00"],
  ])("DOLLAR(%p) = %p", (args, expected) => {
    expect(DOLLAR(...args)).toBe(expected);
  });

  test("errors", () => {
    expect(errorOf(() => DOLLAR("abc"))).toBe("VALUE");
    expect(errorOf(() => DOLLAR(1, 128))).toBe("VALUE");
  });
});

describe("FIXED", () => {
  test.each([
    [[1234.567, 1], "1,234.6"],
    [[1234.567, -1], "1,230"],
    [[-1234.567, -1, true], "-1230"],
    [[44.332], "44.33"],
    [[1.005, 2], "1.01"],
    [[-2.5, 0], "-3"],
    [[1234567.891, 2, false], "1,234,567.89"],
    [[1234567.891, 2, true], "1234567.89"],
    [[0.5, 0], "1"],
  ])("FIXED(%p) = %p", (args, expected) => {
    expect(FIXED(...args)).toBe(expected);
  });

  test("errors", () => {
    expect(errorOf(() => FIXED("abc"))).toBe("VALUE");
  });
});

describe("registered on the formula parser", () => {
  const parser = registerFormatFunctions(new Parser());

  test.each([
    ['TEXT(1234.567, "$#,##0.00")', "$1,234.57"],
    ['text(0.5, "0%")', "50%"],
    ['Text(45366, "d-mmm-yy")', "15-Mar-24"],
    ['TEXT(1/3, "# ?/?")', " 1/3"],
    ['"Total: "&TEXT(1234.5, "#,##0.00")', "Total: 1,234.50"],
    ["DOLLAR(-1234.567, -2)", "($1,200)"],
    ["FIXED(1234.567, 1)", "1,234.6"],
  ])("=%s", (formula, expected) => {
    expect(parser.parse(formula)).toEqual({ error: null, result: expected });
  });

  test("errors surface as Excel error values", () => {
    expect(parser.parse('TEXT(1, "0.0.0.0;;;;;")').error).toBe("#VALUE!");
    expect(parser.parse('TEXT(1/0, "0")').error).toBe("#DIV/0!");
  });
});
