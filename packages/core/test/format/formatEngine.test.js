import {
  formatValue,
  formatGeneral,
  getFormatColor,
  getCellFormatColor,
  genarate,
  setFormatLocale,
  update,
} from "../../src/modules/format";

// Expected strings are what Excel shows for the value with that format code.
describe("General format", () => {
  test.each([
    [0.1 + 0.2, "0.3"],
    [1 / 3, "0.333333333"],
    [2 / 3, "0.666666667"],
    [-0.5, "-0.5"],
    [100000, "100000"],
    [1234567.5, "1234567.5"],
    [1234.56789012345, "1234.56789"],
    [12345678901, "12345678901"],
    [99999999999, "99999999999"],
    [12345678901.5, "12345678902"],
    [123456789012, "1.23457E+11"],
    [-1234567890123, "-1.23457E+12"],
    [1e21, "1E+21"],
    [0.0001, "0.0001"],
    [1e-10, "1E-10"],
    [45366.5, "45366.5"],
    [true, "TRUE"],
    ["text", "text"],
  ])("%p → %p", (v, expected) => {
    expect(formatGeneral(v)).toBe(expected);
  });
});

describe("number format codes", () => {
  test.each([
    // decimals and rounding (half away from zero, on the decimal value)
    ["0.00", 1234.567, "1234.57"],
    ["0.00", 1.005, "1.01"],
    ["#,##0.00", 2.675, "2.68"],
    ["#,##0.00", -2.675, "-2.68"],
    ["0", 2.5, "3"],
    ["0", -2.5, "-3"],
    ["0.0", -0.25, "-0.3"],
    ["0.0#", 1.234, "1.23"],
    ["#.##", 0.5, ".5"],
    ["00000", 42, "00042"],
    ["000-00-0000", 123456789, "123-45-6789"],
    // thousands separator and scaling
    ["#,##0.00", 1234567.891, "1,234,567.89"],
    ["#,##0", -1234, "-1,234"],
    ["#,##0,,", 1234567890, "1,235"],
    ['#,##0,"K"', 12345, "12K"],
    ['0.00,,"M"', 12345678, "12.35M"],
    // percent and scientific
    ["0%", 0.125, "13%"],
    ["0.00%", 0.125, "12.50%"],
    ["0.00E+00", 12345, "1.23E+04"],
    ["0.00E+00", 0.000123, "1.23E-04"],
    ["##0.0E+0", 12345, "12.3E+3"],
    ["0E+0", 1234, "1E+3"],
    // fractions: closest fraction with the allowed denominator digits
    ["# ?/?", 1.25, "1 1/4"],
    ["# ?/?", 4.34, "4 1/3"],
    ["# ?/?", -1.5, "-1 1/2"],
    ["?/?", 0.3, "2/7"],
    ["# ??/??", 3.14159, "3 14/99"],
    ["# ?/8", 0.3, " 2/8"],
    // literals, escapes, padding and fill
    ['"Total: "0', 5, "Total: 5"],
    ['0" days"', 3, "3 days"],
    ["\\$0.00", 5, "$5.00"],
    ['"$"#,##0.00', 1234.5, "$1,234.50"],
    ['#,##0.00 "€"', 5, "5.00 €"],
    ["[$€-2] #,##0.00", 5, "€ 5.00"],
    ["[$-409]#,##0", 5, "5"],
    ["$#,##0.00_);($#,##0.00)", 1234.5, "$1,234.50 "],
    ["$#,##0.00_);($#,##0.00)", -1234.5, "($1,234.50)"],
    ["* #,##0", 5, "5"],
    ['_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)', 0, " - "],
    [
      '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
      -12.5,
      " $(12.50)",
    ],
  ])("%p with %p → %p", (fmt, v, expected) => {
    expect(formatValue(fmt, v)).toBe(expected);
  });
});

describe("sections and conditions", () => {
  test.each([
    ["0.00;[Red]-0.00", -5, "-5.00"],
    ["0.00;[Red](0.00)", -5, "(5.00)"],
    ["#,##0;(#,##0)", -5, "(5)"],
    ['#,##0.00;-#,##0.00;"-"', 0, "-"],
    ["0.00;;", 0, ""],
    ['0;-0;"zero";"text: "@', 0, "zero"],
    ['0;-0;"zero";"text: "@', "abc", "text: abc"],
    ['@" units"', "abc", "abc units"],
    ["0.00", "abc", "abc"],
    ['[>=100]"big";[<0]"neg";"small"', 150, "big"],
    ['[>=100]"big";[<0]"neg";"small"', -3, "neg"],
    ['[>=100]"big";[<0]"neg";"small"', 5, "small"],
    ['[<1000]0;0.0,"K"', 500, "500"],
    ['[<1000]0;0.0,"K"', 5000, "5.0K"],
    ["[Red]0.00", 5, "5.00"],
    ["[Color10]0", 5, "5"],
    ["[Blue]#,##0;[Red]-#,##0;[Green]0", 0, "0"],
  ])("%p with %p → %p", (fmt, v, expected) => {
    expect(formatValue(fmt, v)).toBe(expected);
  });
});

describe("dates and times", () => {
  test.each([
    ["yyyy-mm-dd", 45366, "2024-03-15"],
    ["m/d/yyyy", 45366, "3/15/2024"],
    ["d-mmm-yy", 45366, "15-Mar-24"],
    ["d-mmm", 45366, "15-Mar"],
    ["mmm-yy", 45366, "Mar-24"],
    ["dddd, mmmm d, yyyy", 45366, "Friday, March 15, 2024"],
    ["ddd", 45366, "Fri"],
    ["mmmmm", 45366, "M"],
    ["[$-409]mmmm d, yyyy", 45366, "March 15, 2024"],
    ["m/d/yyyy h:mm", 45366.5, "3/15/2024 12:00"],
    ["dd/mm/yyyy hh:mm:ss", 45366.75, "15/03/2024 18:00:00"],
    ["yyyy", 1, "1900"],
    ["m/d/yyyy", 60, "2/29/1900"],
    ["yyyy-mm-dd", 0, "1900-01-00"],
    // times below one day
    ["h:mm", 9.5 / 24, "9:30"],
    ["h:mm", 0, "0:00"],
    ["h:mm AM/PM", 0.75, "6:00 PM"],
    ["h:mm:ss AM/PM", (13 * 3600 + 45 * 60 + 40) / 86400, "1:45:40 PM"],
    ["hh:mm:ss", 0.5 + 5 / 86400, "12:00:05"],
    ["h:mm A/P", 0.25, "6:00 A"],
    ["mm:ss.0", 83.5 / 86400, "01:23.5"],
    // elapsed time
    ["[h]:mm:ss", 1.5, "36:00:00"],
    ["[h]:mm", 2.25, "54:00"],
    ["[mm]:ss", 0.05, "72:00"],
  ])("%p with %p → %p", (fmt, v, expected) => {
    expect(formatValue(fmt, v)).toBe(expected);
  });
});

describe("robustness", () => {
  test("invalid format codes never throw", () => {
    expect(formatValue("0.0.0.0;;;;;", 5)).toBe("5");
    expect(update("0.0.0.0;;;;;", 5)).toBe(5);
  });

  test("empty values", () => {
    expect(formatValue("0.00", null)).toBe("");
    expect(formatValue("0.00", undefined)).toBe("");
  });

  test("the 15-digit value is formatted, not the float noise", () => {
    expect(formatValue("0.00000000000000000", 0.1 + 0.2)).toBe(
      "0.30000000000000000"
    );
  });
});

describe("format colours", () => {
  test.each([
    ["0.00;[Red]-0.00", -5, "#FF0000"],
    ["0.00;[Red]-0.00", 5, null],
    ["[Blue]0;[Red]-0;[Green]0", 1, "#0000FF"],
    ["[Blue]0;[Red]-0;[Green]0", -1, "#FF0000"],
    ["[Blue]0;[Red]-0;[Green]0", 0, "#00FF00"],
    ["[Blue]0;[Red]-0;[Green]0;[Magenta]@", "x", "#FF00FF"],
    ["[red]0", 1, "#FF0000"],
    ["[Color10]0", 1, "#008000"],
    ["[Color 3]0", 1, "#FF0000"],
    ["[Color57]0", 1, null],
    ["[>=100][Green]0;[<0][Red]0;[Blue]0", 150, "#00FF00"],
    ["[>=100][Green]0;[<0][Red]0;[Blue]0", -1, "#FF0000"],
    ["[>=100][Green]0;[<0][Red]0;[Blue]0", 50, "#0000FF"],
    ['"[Red]"0', 1, null],
    ["0.00", 1, null],
    ["General", 1, null],
  ])("%p with %p → %p", (fmt, v, expected) => {
    expect(getFormatColor(fmt, v)).toBe(expected);
  });

  test("from a cell", () => {
    expect(
      getCellFormatColor({ v: -3, ct: { fa: "#,##0;[Red]-#,##0", t: "n" } })
    ).toBe("#FF0000");
    expect(getCellFormatColor({ v: 3 })).toBeNull();
    expect(getCellFormatColor(null)).toBeNull();
  });
});

describe("genarate (text → [m, ct, v])", () => {
  test("recognises input like Excel", () => {
    expect(genarate("$1,200")).toEqual([
      "$1,200",
      { fa: '"$"#,##0', t: "n" },
      1200,
    ]);
    expect(genarate("12%")).toEqual(["12%", { fa: "0%", t: "n" }, 0.12]);
    expect(genarate("2024-03-15")).toEqual([
      "2024-03-15",
      { fa: "yyyy-mm-dd", t: "d" },
      45366,
    ]);
    expect(genarate("true")).toEqual(["TRUE", { fa: "General", t: "b" }, true]);
    expect(genarate("#N/A")).toEqual([
      "#N/A",
      { fa: "General", t: "e" },
      "#N/A",
    ]);
    expect(genarate("hello")).toEqual([
      "hello",
      { fa: "General", t: "g" },
      "hello",
    ]);
    expect(genarate("'007")).toEqual(["007", { fa: "@", t: "s" }, "007"]);
    expect(genarate(null)).toBeNull();
    expect(genarate("1/2")[1]).toEqual({ fa: "d-mmm", t: "d" });
  });

  test("plain decimals keep the decimals they were written with", () => {
    expect(genarate("1.50")).toEqual(["1.50", { fa: "0.00", t: "n" }, 1.5]);
    expect(genarate(1.25)).toEqual(["1.25", { fa: "0.00", t: "n" }, 1.25]);
    expect(genarate(7)).toEqual(["7", { fa: "General", t: "n" }, 7]);
    expect(genarate(0.1 + 0.2)).toEqual([
      "0.3",
      { fa: "0.0", t: "n" },
      0.1 + 0.2,
    ]);
  });
});

describe("localised month and day names", () => {
  afterEach(() => {
    setFormatLocale({
      months: [
        ["Jan", "January"],
        ["Feb", "February"],
        ["Mar", "March"],
        ["Apr", "April"],
        ["May", "May"],
        ["Jun", "June"],
        ["Jul", "July"],
        ["Aug", "August"],
        ["Sep", "September"],
        ["Oct", "October"],
        ["Nov", "November"],
        ["Dec", "December"],
      ],
      days: [
        ["Sun", "Sunday"],
        ["Mon", "Monday"],
        ["Tue", "Tuesday"],
        ["Wed", "Wednesday"],
        ["Thu", "Thursday"],
        ["Fri", "Friday"],
        ["Sat", "Saturday"],
      ],
    });
  });

  test("formats and typed input use the configured names", () => {
    setFormatLocale({
      months: [
        ["janv.", "janvier"],
        ["févr.", "février"],
        ["mars", "mars"],
        ["avr.", "avril"],
        ["mai", "mai"],
        ["juin", "juin"],
        ["juil.", "juillet"],
        ["août", "août"],
        ["sept.", "septembre"],
        ["oct.", "octobre"],
        ["nov.", "novembre"],
        ["déc.", "décembre"],
      ],
      days: [
        ["dim.", "dimanche"],
        ["lun.", "lundi"],
        ["mar.", "mardi"],
        ["mer.", "mercredi"],
        ["jeu.", "jeudi"],
        ["ven.", "vendredi"],
        ["sam.", "samedi"],
      ],
    });
    expect(formatValue("dddd d mmmm yyyy", 45366)).toBe(
      "vendredi 15 mars 2024"
    );
    expect(formatValue("d mmm", 45323)).toBe("1 févr.");
    expect(genarate("15 février 2024")[2]).toBe(45337);
  });
});
