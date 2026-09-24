import {
  parseInput,
  resolveTypedInput,
  dateToSerial,
  formatHasDate,
  formatHasTime,
  isPercentFormat,
} from "../../src/modules/inputParse";
import { formatValue } from "../../src/modules/format";

// Inputs without a year use the current year; pin it for the tests.
const now = new Date(2024, 5, 1);
const parse = (s) => parseInput(s, { now });
/** [type, value, format, display] as Excel (en-US) shows it in a General cell. */
const summary = (s) => {
  const p = parse(s);
  if (p.type === "number" || p.type === "date") {
    return [p.type, p.v, p.fa, formatValue(p.fa, p.v)];
  }
  return [p.type, p.v];
};

describe("dateToSerial (1900 date system)", () => {
  test.each([
    [1900, 1, 1, 1],
    [1900, 2, 28, 59],
    [1900, 2, 29, 60], // Lotus 1-2-3 leap-year bug kept by Excel
    [1900, 3, 1, 61],
    [1999, 12, 31, 36525],
    [2024, 3, 15, 45366],
    [9999, 12, 31, 2958465],
  ])("%i-%i-%i → %i", (y, m, d, serial) => {
    expect(dateToSerial(y, m, d)).toBe(serial);
  });
});

describe("parseInput: numbers", () => {
  test.each([
    ["123", ["number", 123, "General", "123"]],
    ["007", ["number", 7, "General", "7"]], // leading zeros are dropped
    ["-1.5", ["number", -1.5, "General", "-1.5"]],
    ["+5", ["number", 5, "General", "5"]],
    [".5", ["number", 0.5, "General", "0.5"]],
    ["5.", ["number", 5, "General", "5"]],
    ["1.50", ["number", 1.5, "General", "1.5"]],
    [" 42 ", ["number", 42, "General", "42"]],
    ["(5)", ["number", -5, "General", "-5"]], // accounting negative
    ["3-", ["number", -3, "General", "-3"]], // trailing minus
    ["0.1", ["number", 0.1, "General", "0.1"]],
  ])("%j", (input, expected) => {
    expect(summary(input)).toEqual(expected);
  });

  test("thousands separators", () => {
    expect(summary("1,234")).toEqual(["number", 1234, "#,##0", "1,234"]);
    expect(summary("1,234.5")).toEqual([
      "number",
      1234.5,
      "#,##0.00",
      "1,234.50",
    ]);
    expect(summary("-1,234,567")).toEqual([
      "number",
      -1234567,
      "#,##0",
      "-1,234,567",
    ]);
    // Misplaced separators are text in Excel.
    expect(summary("12,34")).toEqual(["text", "12,34"]);
    expect(summary("1,2345")).toEqual(["text", "1,2345"]);
    expect(summary(",123")).toEqual(["text", ",123"]);
  });

  test("currency", () => {
    expect(summary("$1,200")).toEqual(["number", 1200, '"$"#,##0', "$1,200"]);
    expect(summary("$1200.5")).toEqual([
      "number",
      1200.5,
      '"$"#,##0.00',
      "$1,200.50",
    ]);
    expect(summary("-$3")).toEqual(["number", -3, '"$"#,##0', "-$3"]);
    expect(summary("$-3")).toEqual(["number", -3, '"$"#,##0', "-$3"]);
    expect(summary("($3)")).toEqual(["number", -3, '"$"#,##0', "-$3"]);
    expect(summary("€5")).toEqual(["number", 5, '"€"#,##0', "€5"]);
    expect(summary("£2.5")).toEqual(["number", 2.5, '"£"#,##0.00', "£2.50"]);
    expect(summary("5€")).toEqual(["number", 5, '#,##0"€"', "5€"]);
    expect(summary("5 €")).toEqual(["number", 5, '#,##0"€"', "5€"]);
    expect(summary("$")).toEqual(["text", "$"]);
    expect(summary("$$5")).toEqual(["text", "$$5"]);
    expect(summary("$5%")).toEqual(["text", "$5%"]);
  });

  test("percentages", () => {
    expect(summary("12%")).toEqual(["number", 0.12, "0%", "12%"]);
    expect(summary("12.5%")).toEqual(["number", 0.125, "0.00%", "12.50%"]);
    expect(summary("-5%")).toEqual(["number", -0.05, "0%", "-5%"]);
    expect(parse("7%").v).toBe(0.07);
    expect(summary("%")).toEqual(["text", "%"]);
  });

  test("scientific notation", () => {
    expect(summary("1e3")).toEqual(["number", 1000, "0.00E+00", "1.00E+03"]);
    expect(summary("1.5E-4")).toEqual([
      "number",
      0.00015,
      "0.00E+00",
      "1.50E-04",
    ]);
    expect(summary("-2.5e+2")).toEqual([
      "number",
      -250,
      "0.00E+00",
      "-2.50E+02",
    ]);
    expect(summary("1e400")).toEqual(["text", "1e400"]); // overflow
    expect(summary("e3")).toEqual(["text", "e3"]);
  });

  test("more than 15 significant digits are truncated, like Excel", () => {
    expect(parse("1234567890123456789").v).toBe(1234567890123450000);
    expect(parse("12345678901234567").v).toBe(12345678901234500);
    expect(parse("0.12345678901234567").v).toBe(0.123456789012345);
  });

  test("General display: 11 digits, then scientific", () => {
    expect(summary("12345678901")[3]).toBe("12345678901");
    expect(summary("123456789012")[3]).toBe("1.23457E+11");
    expect(summary("1234567890123456789")[3]).toBe("1.23457E+18");
  });
});

describe("parseInput: fractions", () => {
  test("a mixed fraction is a number with a fraction format", () => {
    expect(summary("0 1/2")).toEqual(["number", 0.5, "# ?/?", " 1/2"]);
    expect(summary("1 1/4")).toEqual(["number", 1.25, "# ?/?", "1 1/4"]);
    expect(summary("1 3/16")).toEqual(["number", 1.1875, "# ??/??", "1  3/16"]);
    expect(summary("-2 1/4")).toEqual(["number", -2.25, "# ?/?", "-2 1/4"]);
  });

  test("a bare fraction is a date in Excel en-US", () => {
    expect(summary("1/2")).toEqual(["date", 45293, "d-mmm", "2-Jan"]);
  });

  test("a zero denominator is text", () => {
    expect(summary("1 1/0")).toEqual(["text", "1 1/0"]);
  });
});

describe("parseInput: dates", () => {
  test.each([
    ["2024-03-15", ["date", 45366, "yyyy-mm-dd", "2024-03-15"]],
    ["2024/3/15", ["date", 45366, "yyyy/m/d", "2024/3/15"]],
    ["3/15/2024", ["date", 45366, "m/d/yyyy", "3/15/2024"]],
    ["3-15-2024", ["date", 45366, "m/d/yyyy", "3/15/2024"]],
    ["3/15/24", ["date", 45366, "m/d/yyyy", "3/15/2024"]],
    ["1/1/30", ["date", 10959, "m/d/yyyy", "1/1/1930"]], // 30-99 → 19xx
    ["1/1/29", ["date", 47119, "m/d/yyyy", "1/1/2029"]], // 00-29 → 20xx
    ["15-Mar-2024", ["date", 45366, "d-mmm-yy", "15-Mar-24"]],
    ["15-Mar-24", ["date", 45366, "d-mmm-yy", "15-Mar-24"]],
    ["15 March 2024", ["date", 45366, "d-mmm-yy", "15-Mar-24"]],
    ["Mar 15, 2024", ["date", 45366, "d-mmm-yy", "15-Mar-24"]],
    ["March 15 2024", ["date", 45366, "d-mmm-yy", "15-Mar-24"]],
    ["Friday, March 15, 2024", ["date", 45366, "d-mmm-yy", "15-Mar-24"]],
    ["15-Mar", ["date", 45366, "d-mmm", "15-Mar"]],
    ["Mar-24", ["date", 45375, "d-mmm", "24-Mar"]], // a valid day wins
    ["Mar-45", ["date", 16497, "mmm-yy", "Mar-45"]], // otherwise month-year
    ["March 2024", ["date", 45352, "mmm-yy", "Mar-24"]],
    ["SEPT2", ["date", 45537, "d-mmm", "2-Sep"]], // the infamous gene-name case
    ["3/15", ["date", 45366, "d-mmm", "15-Mar"]],
    ["1/32", ["date", 11689, "mmm-yy", "Jan-32"]], // not a day → Jan 1932
    ["12/2024", ["date", 45627, "mmm-yy", "Dec-24"]],
    ["2/29/1900", ["date", 60, "m/d/yyyy", "2/29/1900"]],
    ["2/29/2024", ["date", 45351, "m/d/yyyy", "2/29/2024"]],
  ])("%j", (input, expected) => {
    expect(summary(input)).toEqual(expected);
  });

  test.each(["13/2", "2/29/2023", "15/3/2024", "0/5", "1/1/1899", "Foo 5"])(
    "%j is text",
    (input) => {
      expect(parse(input)).toEqual({ type: "text", v: input });
    }
  );
});

describe("parseInput: times", () => {
  test.each([
    ["9:30", 9.5 / 24, "h:mm", "9:30"],
    ["09:30", 9.5 / 24, "h:mm", "9:30"],
    ["9:30 PM", 21.5 / 24, "h:mm AM/PM", "9:30 PM"],
    ["9:30pm", 21.5 / 24, "h:mm AM/PM", "9:30 PM"],
    ["12:15 AM", 0.25 / 24, "h:mm AM/PM", "12:15 AM"],
    ["12:15 PM", 12.25 / 24, "h:mm AM/PM", "12:15 PM"],
    ["9 PM", 21 / 24, "h:mm AM/PM", "9:00 PM"],
    ["13:45:10", (13 * 3600 + 45 * 60 + 10) / 86400, "h:mm:ss", "13:45:10"],
    [
      "1:45:10 PM",
      (13 * 3600 + 45 * 60 + 10) / 86400,
      "h:mm:ss AM/PM",
      "1:45:10 PM",
    ],
    ["25:30", 25.5 / 24, "[h]:mm:ss", "25:30:00"],
    ["1:23.5", 83.5 / 86400, "mm:ss.0", "01:23.5"],
  ])("%j", (input, v, fa, display) => {
    const p = parse(input);
    expect(p.type).toBe("date");
    expect(p.v).toBeCloseTo(v, 10);
    expect(p.fa).toBe(fa);
    expect(formatValue(p.fa, p.v)).toBe(display);
  });

  test.each(["1:60", "13:00 PM", "9:30:60", "12"])("%j is not a time", (s) => {
    expect(parse(s).type).not.toBe("date");
  });

  test("date and time together", () => {
    expect(summary("2024-03-15 13:45")).toEqual([
      "date",
      45366 + (13 * 60 + 45) / 1440,
      "yyyy-mm-dd h:mm",
      "2024-03-15 13:45",
    ]);
    expect(summary("3/15/2024 9:30 PM")).toEqual([
      "date",
      45366 + 21.5 / 24,
      "m/d/yyyy h:mm AM/PM",
      "3/15/2024 9:30 PM",
    ]);
    const iso = parse("2024-03-15T13:45:10");
    expect(iso.fa).toBe("yyyy-mm-dd h:mm:ss");
    expect(formatValue(iso.fa, iso.v)).toBe("2024-03-15 13:45:10");
  });
});

describe("parseInput: booleans, errors and text", () => {
  test("booleans are case-insensitive", () => {
    expect(parse("TRUE")).toEqual({ type: "boolean", v: true });
    expect(parse("false")).toEqual({ type: "boolean", v: false });
    expect(parse("True")).toEqual({ type: "boolean", v: true });
  });

  test("error values", () => {
    expect(parse("#N/A")).toEqual({ type: "error", v: "#N/A" });
    expect(parse("#div/0!")).toEqual({ type: "error", v: "#DIV/0!" });
    expect(parse("#VALUE!")).toEqual({ type: "error", v: "#VALUE!" });
  });

  test("text keeps its original spacing", () => {
    expect(parse("  hello ")).toEqual({ type: "text", v: "  hello " });
    expect(parse("abc 1/2")).toEqual({ type: "text", v: "abc 1/2" });
    expect(parse("1 000")).toEqual({ type: "text", v: "1 000" });
  });

  test("non-string values pass through", () => {
    expect(parse(5)).toEqual({ type: "number", v: 5, fa: "General" });
    expect(parse(true)).toEqual({ type: "boolean", v: true });
  });
});

describe("format-code classification", () => {
  test("date and time parts", () => {
    expect(formatHasDate("yyyy-mm-dd")).toBe(true);
    expect(formatHasDate("d-mmm")).toBe(true);
    expect(formatHasDate("h:mm")).toBe(false);
    expect(formatHasDate("mm:ss.0")).toBe(false);
    expect(formatHasDate('0.00 "days"')).toBe(false);
    expect(formatHasTime("h:mm AM/PM")).toBe(true);
    expect(formatHasTime("[h]:mm:ss")).toBe(true);
    expect(formatHasTime("m/d/yyyy")).toBe(false);
    expect(formatHasTime("[Red]0.00")).toBe(false);
  });

  test("percent", () => {
    expect(isPercentFormat("0.00%")).toBe(true);
    expect(isPercentFormat('0 "%"')).toBe(false);
    expect(isPercentFormat("0.00")).toBe(false);
  });
});

describe("resolveTypedInput: typing into a formatted cell", () => {
  const typed = (s, fa) => resolveTypedInput(s, fa, { now });

  test("General cells take the recognised format", () => {
    expect(typed("$5", "General")).toEqual({ v: 5, fa: '"$"#,##0', t: "n" });
    expect(typed("3/15/2024", undefined)).toEqual({
      v: 45366,
      fa: "m/d/yyyy",
      t: "d",
    });
    expect(typed("hello", "General")).toEqual({
      v: "hello",
      fa: "General",
      t: "g",
    });
  });

  test("Text cells keep everything as text", () => {
    expect(typed("123", "@")).toEqual({ v: "123", fa: "@", t: "s" });
    expect(typed("TRUE", "@")).toEqual({ v: "TRUE", fa: "@", t: "s" });
  });

  test("automatic percent entry", () => {
    expect(typed("5", "0%")).toEqual({ v: 0.05, fa: "0%", t: "n" });
    expect(typed("10", "0.00%")).toEqual({ v: 0.1, fa: "0.00%", t: "n" });
    expect(typed("0.5", "0%")).toEqual({ v: 0.5, fa: "0%", t: "n" });
    expect(typed("5%", "0%")).toEqual({ v: 0.05, fa: "0%", t: "n" });
    // Programmatic numbers are stored as given.
    expect(resolveTypedInput(5, "0%")).toEqual({ v: 5, fa: "0%", t: "n" });
  });

  test("numbers keep an explicit number format", () => {
    expect(typed("$5", "0.00")).toEqual({ v: 5, fa: "0.00", t: "n" });
    expect(typed("12%", "0.00")).toEqual({ v: 0.12, fa: "0.00", t: "n" });
    // A date typed into a number-formatted cell shows its serial number.
    expect(typed("3/15/2024", "0.00")).toEqual({
      v: 45366,
      fa: "0.00",
      t: "n",
    });
  });

  test("date formats", () => {
    expect(typed("45366", "yyyy-mm-dd")).toEqual({
      v: 45366,
      fa: "yyyy-mm-dd",
      t: "d",
    });
    expect(typed("3/15/2024", "d-mmm-yy")).toEqual({
      v: 45366,
      fa: "d-mmm-yy",
      t: "d",
    });
    // A time typed into a date-only format switches to the time format.
    expect(typed("9:30", "yyyy-mm-dd")).toEqual({
      v: 9.5 / 24,
      fa: "h:mm",
      t: "d",
    });
    // A date typed into a time-only format switches to the date format.
    expect(typed("3/15/2024", "h:mm")).toEqual({
      v: 45366,
      fa: "m/d/yyyy",
      t: "d",
    });
  });

  test("text, booleans and errors keep the format", () => {
    expect(typed("abc", "0.00")).toEqual({ v: "abc", fa: "0.00", t: "g" });
    expect(typed("true", "0.00")).toEqual({ v: true, fa: "0.00", t: "b" });
    expect(typed("#N/A", "0.00")).toEqual({ v: "#N/A", fa: "0.00", t: "e" });
  });
});
