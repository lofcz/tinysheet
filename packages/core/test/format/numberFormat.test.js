import {
  adjustDecimals,
  buildFormatCode,
  customFormatList,
  describeFormat,
  getFormatCategory,
  isValidFormatCode,
  DATE_FORMATS,
  TIME_FORMATS,
  FRACTION_FORMATS,
  SPECIAL_FORMATS,
} from "../../src/modules/numberFormat";
import { formatValue } from "../../src/modules/format";

// Codes below are the ones Excel's Format Cells dialog (en-US) stores.
describe("buildFormatCode", () => {
  test.each([
    ["general", {}, "General"],
    ["text", {}, "@"],
    ["number", { decimals: 2 }, "0.00"],
    ["number", { decimals: 0, thousands: true }, "#,##0"],
    ["number", { decimals: 2, negative: "red" }, "0.00;[Red]0.00"],
    ["number", { decimals: 1, negative: "parens" }, "0.0_);(0.0)"],
    [
      "number",
      { decimals: 2, thousands: true, negative: "redParens" },
      "#,##0.00_);[Red](#,##0.00)",
    ],
    ["currency", { decimals: 2, symbol: "$" }, '"$"#,##0.00'],
    [
      "currency",
      { decimals: 2, symbol: "$", negative: "redParens" },
      '"$"#,##0.00_);[Red]("$"#,##0.00)',
    ],
    [
      "currency",
      { decimals: 0, symbol: "€", symbolPosition: "after", negative: "red" },
      '#,##0 "€";[Red]#,##0 "€"',
    ],
    ["currency", { decimals: 2, symbol: "" }, "#,##0.00"],
    [
      "accounting",
      { decimals: 2, symbol: "$" },
      '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
    ],
    [
      "accounting",
      { decimals: 0, symbol: "" },
      '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)',
    ],
    [
      "accounting",
      { decimals: 2, symbol: "€", symbolPosition: "after" },
      '_-* #,##0.00 "€"_-;-* #,##0.00 "€"_-;_-* "-"?? "€"_-;_-@_-',
    ],
    ["percentage", { decimals: 0 }, "0%"],
    ["percentage", { decimals: 2 }, "0.00%"],
    ["scientific", { decimals: 2 }, "0.00E+00"],
    ["scientific", { decimals: 0 }, "0E+00"],
    ["date", { code: "d-mmm-yy" }, "d-mmm-yy"],
    ["custom", { code: "0.0,," }, "0.0,,"],
  ])("%s %j → %s", (category, options, code) => {
    expect(buildFormatCode(category, options)).toBe(code);
  });

  test("dialog codes render like Excel", () => {
    const acc = buildFormatCode("accounting", { decimals: 2, symbol: "$" });
    expect(formatValue(acc, 1234.5)).toBe(" $1,234.50 ");
    expect(formatValue(acc, -1234.5)).toBe(" $(1,234.50)");
    expect(formatValue(acc, 0)).toBe(" $-   ");
    const cur = buildFormatCode("currency", {
      decimals: 2,
      symbol: "$",
      negative: "parens",
    });
    expect(formatValue(cur, -1234.5)).toBe("($1,234.50)");
  });
});

describe("describeFormat", () => {
  test("round-trips every dialog option", () => {
    const options = [
      ["number", { decimals: 3, thousands: true, negative: "red" }],
      ["number", { decimals: 0, thousands: false, negative: "parens" }],
      [
        "currency",
        { decimals: 1, symbol: "£", symbolPosition: "before", negative: "red" },
      ],
      [
        "currency",
        {
          decimals: 2,
          symbol: "Kč",
          symbolPosition: "after",
          negative: "redParens",
        },
      ],
      ["accounting", { decimals: 0, symbol: "$", symbolPosition: "before" }],
      ["accounting", { decimals: 2, symbol: "€", symbolPosition: "after" }],
      ["percentage", { decimals: 1 }],
      ["scientific", { decimals: 3 }],
    ];
    options.forEach(([category, opts]) => {
      const code = buildFormatCode(category, opts);
      const described = describeFormat(code);
      expect(described.category).toBe(category);
      expect(buildFormatCode(described.category, described.options)).toBe(code);
    });
  });

  test("list categories", () => {
    DATE_FORMATS.forEach((c) =>
      expect(describeFormat(c).category).toBe("date")
    );
    TIME_FORMATS.filter((c) => !DATE_FORMATS.includes(c)).forEach((c) =>
      expect(describeFormat(c).category).toBe("time")
    );
    FRACTION_FORMATS.forEach((c) =>
      expect(describeFormat(c).category).toBe("fraction")
    );
    SPECIAL_FORMATS.forEach((c) =>
      expect(describeFormat(c).category).toBe("special")
    );
  });

  test("general, text and custom", () => {
    expect(describeFormat(undefined).category).toBe("general");
    expect(describeFormat("General").category).toBe("general");
    expect(describeFormat("@").category).toBe("text");
    expect(describeFormat('0.0 "kg"')).toEqual({
      category: "custom",
      options: { code: '0.0 "kg"' },
    });
  });

  test("codes produced by typed input are recognised", () => {
    expect(describeFormat('"$"#,##0').category).toBe("currency");
    expect(describeFormat("#,##0.00").category).toBe("number");
    expect(describeFormat("0%").category).toBe("percentage");
    expect(describeFormat("0.00E+00").category).toBe("scientific");
    expect(describeFormat("# ?/?").category).toBe("fraction");
    expect(describeFormat("h:mm AM/PM").category).toBe("time");
    expect(describeFormat("yyyy-mm-dd").category).toBe("date");
  });

  test("getFormatCategory is lenient for dates and percents", () => {
    expect(getFormatCategory("dd.mm.yyyy")).toBe("date");
    expect(getFormatCategory("hh:mm:ss.000")).toBe("time");
    expect(getFormatCategory('0.0%" up"')).toBe("percentage");
    expect(getFormatCategory('0.0 "kg"')).toBe("custom");
  });
});

// Excel: Home > Number > Increase Decimal / Decrease Decimal.
describe("adjustDecimals", () => {
  test.each([
    ["0", 1, "0.0"],
    ["0.00", 1, "0.000"],
    ["0.00", -1, "0.0"],
    ["0.0", -1, "0"],
    ["0", -1, null],
    ["#,##0", 1, "#,##0.0"],
    ["0%", 1, "0.0%"],
    ["0.00%", -2, "0%"],
    ["0.00E+00", 1, "0.000E+00"],
    ["0E+00", -1, null],
    ["0.0E+00", -1, "0E+00"],
    [
      '"$"#,##0.00_);[Red]("$"#,##0.00)',
      1,
      '"$"#,##0.000_);[Red]("$"#,##0.000)',
    ],
    ['"$"#,##0_);("$"#,##0)', 1, '"$"#,##0.0_);("$"#,##0.0)'],
    ["#,##0,", 1, "#,##0.0,"],
    ['0.00 "kg";-0.00 "kg";"zero";@', 1, '0.000 "kg";-0.000 "kg";"zero";@'],
    [
      '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
      1,
      '_("$"* #,##0.000_);_("$"* \\(#,##0.000\\);_("$"* "-"???_);_(@_)',
    ],
    [
      '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
      -2,
      '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)',
    ],
    [
      '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)',
      2,
      '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
    ],
    ["@", 1, null],
    ["m/d/yyyy", 1, null],
    ["h:mm:ss", -1, null],
    ["# ?/?", 1, null],
  ])("%s %d → %s", (code, delta, expected) => {
    expect(adjustDecimals(code, delta)).toBe(expected);
  });

  test("General starts from the decimals shown", () => {
    expect(adjustDecimals("General", 1, 1.25)).toBe("0.000");
    expect(adjustDecimals("General", -1, 1.25)).toBe("0.0");
    expect(adjustDecimals("General", 1, 7)).toBe("0.0");
    expect(adjustDecimals("General", -1, 7)).toBe(null);
    expect(adjustDecimals("General", 1, undefined)).toBe("0.0");
    expect(adjustDecimals("General", 1, 123456789012)).toBe("0.000000E+00");
    expect(adjustDecimals(undefined, 1, 0.5)).toBe("0.00");
  });

  test("the resulting codes format as expected", () => {
    const code = adjustDecimals('"$"#,##0.00_);[Red]("$"#,##0.00)', -1);
    expect(formatValue(code, -1234.56)).toBe("($1,234.6)");
    expect(formatValue(adjustDecimals("0.00%", 1), 0.12345)).toBe("12.345%");
  });
});

describe("customFormatList and isValidFormatCode", () => {
  test("built-ins first, extras appended once", () => {
    const list = customFormatList(["0.0", '0.0 "kg"', '0.0 "kg"']);
    expect(list[0]).toBe("General");
    expect(list.filter((c) => c === '0.0 "kg"')).toHaveLength(1);
    expect(list).toContain("0.0");
    expect(list).toContain("[h]:mm:ss");
  });

  test("validation", () => {
    expect(isValidFormatCode("0.00")).toBe(true);
    expect(isValidFormatCode('0.0 "kg')).toBe(false);
    expect(isValidFormatCode("0;0;0;@;0")).toBe(false);
    expect(isValidFormatCode("")).toBe(false);
  });
});
