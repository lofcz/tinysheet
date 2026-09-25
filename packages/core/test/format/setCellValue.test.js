import { setCellValue } from "../../src/modules/cell";

/** Type `value` into a cell (optionally pre-formatted) and return the cell. */
const typeInto = (value, cell = null) => {
  const d = [[cell]];
  setCellValue(null, 0, 0, d, value);
  return d[0][0];
};

describe("typing into a General cell", () => {
  test.each([
    ["123", 123, "123", { fa: "General", t: "n" }],
    ["007", 7, "7", { fa: "General", t: "n" }],
    ["1,234.5", 1234.5, "1,234.50", { fa: "#,##0.00", t: "n" }],
    ["$1,200", 1200, "$1,200", { fa: '"$"#,##0', t: "n" }],
    ["($3)", -3, "-$3", { fa: '"$"#,##0', t: "n" }],
    ["12%", 0.12, "12%", { fa: "0%", t: "n" }],
    ["1e3", 1000, "1.00E+03", { fa: "0.00E+00", t: "n" }],
    ["0 1/2", 0.5, " 1/2", { fa: "# ?/?", t: "n" }],
    ["2024-03-15", 45366, "2024-03-15", { fa: "yyyy-mm-dd", t: "d" }],
    ["3/15/2024", 45366, "3/15/2024", { fa: "m/d/yyyy", t: "d" }],
    ["15-Mar-2024", 45366, "15-Mar-24", { fa: "d-mmm-yy", t: "d" }],
    ["9:30 PM", 21.5 / 24, "9:30 PM", { fa: "h:mm AM/PM", t: "d" }],
    ["true", true, "TRUE", { fa: "General", t: "b" }],
    ["#N/A", "#N/A", "#N/A", { fa: "General", t: "e" }],
    ["hello", "hello", "hello", { fa: "General", t: "g" }],
    ["123456789012", 123456789012, "1.23457E+11", { fa: "General", t: "n" }],
  ])("%j", (input, v, m, ct) => {
    const cell = typeInto(input);
    expect(cell.v).toBe(v);
    expect(cell.m).toBe(m);
    expect(cell.ct).toEqual(ct);
  });

  test("a leading apostrophe forces text and is not shown", () => {
    const cell = typeInto("'007");
    expect(cell).toMatchObject({ v: "007", m: "007", qp: 1 });
    expect(cell.ct).toEqual({ fa: "@", t: "s" });
  });

  test("style attributes survive", () => {
    const cell = typeInto({ v: "12%" }, { bl: 1, fc: "#ff0000" });
    expect(cell).toMatchObject({ v: 0.12, m: "12%", bl: 1, fc: "#ff0000" });
  });
});

describe("typing into a formatted cell", () => {
  test("percent cell: automatic percent entry", () => {
    const cell = typeInto({ v: "5" }, { ct: { fa: "0%", t: "n" } });
    expect(cell).toMatchObject({ v: 0.05, m: "5%", ct: { fa: "0%" } });
  });

  test("number format is kept", () => {
    const cell = typeInto({ v: "$5" }, { ct: { fa: "0.00", t: "n" } });
    expect(cell).toMatchObject({ v: 5, m: "5.00", ct: { fa: "0.00", t: "n" } });
  });

  test("date format is kept for serial numbers", () => {
    const cell = typeInto({ v: "45366" }, { ct: { fa: "d-mmm-yy", t: "d" } });
    expect(cell).toMatchObject({ v: 45366, m: "15-Mar-24" });
  });

  test("text cell keeps text", () => {
    const cell = typeInto({ v: "00123" }, { ct: { fa: "@", t: "s" } });
    expect(cell).toMatchObject({ v: "00123", m: "00123" });
  });

  test("text in a number-formatted cell keeps the format", () => {
    const cell = typeInto(
      { v: "abc" },
      { ct: { fa: '0.00;-0.00;0;"note: "@', t: "n" } }
    );
    expect(cell).toMatchObject({ v: "abc", m: "note: abc" });
    expect(cell.ct.fa).toBe('0.00;-0.00;0;"note: "@');
  });
});

describe("formula results", () => {
  test("numbers use the cell format, or General", () => {
    expect(typeInto({ v: 0.1 + 0.2, f: "=0.1+0.2" })).toMatchObject({
      v: 0.1 + 0.2,
      m: "0.3",
      ct: { fa: "General", t: "n" },
    });
    expect(
      typeInto({ v: 1234.5, f: "=A1" }, { ct: { fa: "#,##0.00", t: "n" } })
    ).toMatchObject({ m: "1,234.50" });
  });

  test("text results are not re-parsed as typed input", () => {
    const cell = typeInto({ v: "1/2", f: '="1/2"' });
    expect(cell).toMatchObject({ v: "1/2", m: "1/2", ct: { t: "g" } });
  });

  test("booleans and errors", () => {
    expect(typeInto({ v: true, f: "=1=1" })).toMatchObject({
      v: true,
      m: "TRUE",
      ct: { t: "b" },
    });
    expect(typeInto({ v: "#DIV/0!", f: "=1/0" })).toMatchObject({
      v: "#DIV/0!",
      m: "#DIV/0!",
      ct: { t: "e" },
    });
  });

  test("date/time functions format a General cell like Excel", () => {
    expect(typeInto({ v: 45366, f: "=DATE(2024,3,15)" })).toMatchObject({
      m: "3/15/2024",
      ct: { fa: "m/d/yyyy", t: "d" },
    });
    expect(typeInto({ v: 45366.5, f: "=now()" })).toMatchObject({
      m: "3/15/2024 12:00",
      ct: { t: "d" },
    });
    expect(typeInto({ v: 0.75, f: "=TIME(18,0,0)" })).toMatchObject({
      m: "6:00 PM",
    });
    // An explicit format wins, and only a leading date function counts.
    expect(
      typeInto({ v: 45366, f: "=TODAY()" }, { ct: { fa: "0.00", t: "n" } })
    ).toMatchObject({ m: "45366.00" });
    expect(typeInto({ v: 3, f: "=YEAR(TODAY())-2021" })).toMatchObject({
      m: "3",
      ct: { fa: "General" },
    });
  });
});
