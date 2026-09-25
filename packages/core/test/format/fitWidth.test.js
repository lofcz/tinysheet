import {
  fitCellToWidth,
  fitNumberToWidth,
  generalCandidates,
} from "../../src/modules/format";

// Monospace measure: every character is 7px wide.
const measure = (s) => s.length * 7;
const fit = (v, fmt, display, chars) =>
  fitNumberToWidth(v, fmt, display, chars * 7, measure);

// Excel: a General number in a narrow column loses decimals, then switches
// to scientific notation, then shows ####. Numbers and dates with another
// format show #### as soon as they don't fit. Text is never changed.
describe("fitNumberToWidth", () => {
  test("fits: unchanged", () => {
    expect(fit(3.14159, "General", "3.14159", 10)).toBe("3.14159");
    expect(fit(45366, "m/d/yyyy", "3/15/2024", 9)).toBe("3/15/2024");
  });

  test.each([
    [3.14159265, "3.14159265", 4, "3.14"],
    [3.14159265, "3.14159265", 1, "3"],
    [-3.14159265, "-3.14159265", 5, "-3.14"],
    [1234.5678, "1234.5678", 6, "1234.6"],
    [1234.5678, "1234.5678", 4, "1235"],
    [123456789, "123456789", 7, "1.2E+08"],
    [123456789, "123456789", 5, "1E+08"],
    [123456789, "123456789", 4, "####"],
    [0.000123456, "0.000123456", 6, "0.0001"],
    [0.000123456, "0.000123456", 5, "1E-04"],
    [123456789012, "1.23457E+11", 8, "1.23E+11"],
    [2.5e-10, "2.5E-10", 6, "3E-10"],
  ])("General %p in %i chars → %s", (v, display, chars, expected) => {
    expect(fit(v, "General", display, chars)).toBe(expected);
  });

  test("formatted numbers and dates show #### when too wide", () => {
    expect(fit(1234.5, "#,##0.00", "1,234.50", 6)).toBe("######");
    expect(fit(45366, "dddd, mmmm d, yyyy", "Friday, March 15, 2024", 10)).toBe(
      "##########"
    );
    expect(fit(0.25, "0.00%", "25.00%", 3)).toBe("###");
  });

  test("negative dates are always ####", () => {
    expect(fit(-5, "m/d/yyyy", "", 10)).toBe("##########");
  });

  test("at least one #", () => {
    expect(fit(123456, "0", "123456", 0)).toBe("#");
  });

  test("text and non-numbers are unchanged", () => {
    expect(fit("a very long text", "General", "a very long text", 3)).toBe(
      "a very long text"
    );
    expect(fit(true, "General", "TRUE", 1)).toBe("TRUE");
  });
});

describe("generalCandidates", () => {
  test("longest first, no repeats", () => {
    expect(generalCandidates(1.5)).toEqual(["1.5", "2", "1.5E+00", "2E+00"]);
    expect(generalCandidates(0)).toEqual(["0"]);
  });
});

describe("fitCellToWidth", () => {
  test("returns the same cell when nothing changes", () => {
    const cell = { v: 1.5, m: "1.5", ct: { fa: "General", t: "n" } };
    expect(fitCellToWidth(cell, 100, measure)).toBe(cell);
    const text = { v: "hello world", m: "hello world", ct: { t: "g" } };
    expect(fitCellToWidth(text, 7, measure)).toBe(text);
    expect(fitCellToWidth(null, 7, measure)).toBe(null);
  });

  test("returns a copy with the fitted text", () => {
    const cell = {
      v: 3.14159265,
      m: "3.14159265",
      ct: { fa: "General", t: "n" },
      bl: 1,
    };
    const fitted = fitCellToWidth(cell, 28, measure);
    expect(fitted).not.toBe(cell);
    expect(fitted).toEqual({ ...cell, m: "3.14" });
    expect(cell.m).toBe("3.14159265");
  });

  test("text-formatted numbers and rotated cells are left alone", () => {
    const asText = { v: 123456, m: "123456", ct: { fa: "@", t: "s" } };
    expect(fitCellToWidth(asText, 7, measure)).toBe(asText);
    const rotated = { v: 123456, m: "123456", ct: { fa: "0" }, tr: "1" };
    expect(fitCellToWidth(rotated, 7, measure)).toBe(rotated);
  });
});
