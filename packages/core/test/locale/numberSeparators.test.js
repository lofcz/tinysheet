import {
  formatValue,
  parseInput,
  resolveTypedInput,
  setNumberSeparators,
  numberSeparatorsForLocale,
} from "../../src/modules/format";

const NBSP = " ";

describe("Czech number separators", () => {
  beforeEach(() => setNumberSeparators({ decimal: ",", group: NBSP }));
  afterEach(() => setNumberSeparators());

  test("formats money and decimals with a space group and a decimal comma", () => {
    expect(formatValue('#,##0 "Kč"', 12345)).toBe(`12${NBSP}345 Kč`);
    expect(formatValue("#,##0.00", 1234567.5)).toBe(`1${NBSP}234${NBSP}567,50`);
    expect(formatValue("General", 12.5)).toBe("12,5");
    expect(formatValue("0%", 0.25)).toBe("25%");
  });

  test("leaves dates and text alone", () => {
    expect(formatValue('d"."m"."yyyy', 45000)).toBe("15.3.2023");
    expect(formatValue("h:mm:ss.0", 0.5)).toBe("12:00:00.0");
    expect(formatValue("@", "1.5")).toBe("1.5");
  });

  test("reads Czech typed numbers", () => {
    expect(parseInput("12 000,5")).toMatchObject({
      type: "number",
      v: 12000.5,
    });
    expect(parseInput(`12${NBSP}000`)).toMatchObject({
      type: "number",
      v: 12000,
    });
    expect(parseInput("1.234,5")).toMatchObject({ type: "number", v: 1234.5 });
    expect(parseInput("0,25")).toMatchObject({ type: "number", v: 0.25 });
    expect(parseInput("-3,5")).toMatchObject({ type: "number", v: -3.5 });
    expect(parseInput("12 000 Kč")).toMatchObject({
      type: "number",
      v: 12000,
      fa: '#,##0 "Kč"',
    });
    expect(parseInput("Lektor").type).toBe("text");
  });

  test("keeps a money format when a number is typed into it", () => {
    expect(resolveTypedInput("1 500", '#,##0 "Kč"')).toMatchObject({
      v: 1500,
      fa: '#,##0 "Kč"',
    });
  });

  test("derives separators from a locale", () => {
    const cs = numberSeparatorsForLocale("cs-CZ");
    expect(cs.decimal).toBe(",");
    expect(numberSeparatorsForLocale("en-US")).toEqual({
      decimal: ".",
      group: ",",
    });
  });
});

describe("default separators", () => {
  test("stay en-US", () => {
    expect(formatValue("#,##0.00", 1234.5)).toBe("1,234.50");
    expect(parseInput("1,234")).toMatchObject({ type: "number", v: 1234 });
    expect(parseInput("12000 Kč")).toMatchObject({ type: "number", v: 12000 });
  });
});
