import { makeContext, input, values, cell } from "../formula/helpers";
import {
  splitTextLine,
  parseTextToColumns,
  suggestFixedWidthBreaks,
  parseDateByOrder,
  convertTextToColumnsField,
  applyTextToColumns,
} from "../../src/modules/splitColumn";

describe("delimited split", () => {
  const comma = { mode: "delimited", delimiters: { comma: true } };

  test("one delimiter", () => {
    expect(splitTextLine("a,b,,c", comma)).toEqual(["a", "b", "", "c"]);
  });

  test("several delimiters, consecutive treated as one", () => {
    const opts = {
      mode: "delimited",
      delimiters: { comma: true, space: true, other: "|" },
      treatConsecutiveAsOne: true,
    };
    expect(splitTextLine("a, b  c|d", opts)).toEqual(["a", "b", "c", "d"]);
    expect(
      splitTextLine("a, b", { ...opts, treatConsecutiveAsOne: false })
    ).toEqual(["a", "", "b"]);
  });

  test("text qualifier keeps delimiters and unescapes doubled quotes", () => {
    expect(splitTextLine('"Smith, John",42,"say ""hi"""', comma)).toEqual([
      "Smith, John",
      "42",
      'say "hi"',
    ]);
    expect(splitTextLine("'a,b',c", { ...comma, textQualifier: "'" })).toEqual([
      "a,b",
      "c",
    ]);
    expect(splitTextLine('"a,b",c', { ...comma, textQualifier: "" })).toEqual([
      '"a',
      'b"',
      "c",
    ]);
  });

  test("tab and semicolon", () => {
    expect(
      splitTextLine("a\tb;c", {
        mode: "delimited",
        delimiters: { tab: true, semicolon: true },
      })
    ).toEqual(["a", "b", "c"]);
  });

  test("the preview pads rows to the widest", () => {
    expect(parseTextToColumns(["a,b,c", "d"], comma)).toEqual([
      ["a", "b", "c"],
      ["d", "", ""],
    ]);
  });
});

describe("fixed width", () => {
  test("splits at break positions and trims padding", () => {
    const opts = { mode: "fixed", breaks: [6, 10] };
    expect(splitTextLine("Alice 30  NY", opts)).toEqual(["Alice", "30", "NY"]);
  });

  test("suggests breaks where every line starts a field", () => {
    expect(suggestFixedWidthBreaks(["Alice 30  NY", "Bob   4   LA"])).toEqual([
      6, 10,
    ]);
  });
});

describe("column formats", () => {
  test("date orders", () => {
    const serial = (s) => parseDateByOrder(s, "YMD");
    expect(parseDateByOrder("15/01/2024", "DMY")).toBe(serial("2024-01-15"));
    expect(parseDateByOrder("01/15/2024", "MDY")).toBe(serial("2024-01-15"));
    expect(parseDateByOrder("1/15/24", "MDY")).toBe(serial("2024-01-15"));
    expect(parseDateByOrder("31/02/2024", "DMY")).toBeNull();
    expect(serial("2024-01-15")).toBe(45306);
  });

  test("general parses, text keeps, date converts", () => {
    expect(convertTextToColumnsField("007", "general")).toMatchObject({
      v: 7,
    });
    expect(convertTextToColumnsField("007", "text")).toEqual({
      v: "007",
      m: "007",
      ct: { fa: "@", t: "s" },
    });
    expect(convertTextToColumnsField("15.1.2024", "DMY")).toMatchObject({
      v: 45306,
      ct: { t: "d" },
    });
    expect(convertTextToColumnsField("x", "skip")).toBeNull();
  });
});

describe("applyTextToColumns", () => {
  test("writes to the destination with per-column formats, skipping", () => {
    const ctx = makeContext({ rows: 6, cols: 8 });
    input(ctx, "A1", "Ann;007;15/01/2024;x");
    input(ctx, "A2", "Bob;42;02/03/2024;y");
    ctx.luckysheetfile[0].data[0][3] = { bg: "#ff0000" };
    applyTextToColumns(
      ctx,
      { row: [0, 1], column: [0, 0] },
      {
        mode: "delimited",
        delimiters: { semicolon: true },
        columnFormats: ["general", "text", "DMY", "skip"],
        destination: { r: 0, c: 1 },
      }
    );
    expect(values(ctx, "B1", "D2")).toEqual([
      ["Ann", "007", 45306],
      ["Bob", "42", 45353],
    ]);
    // the source column stays when the destination is elsewhere
    expect(cell(ctx, "A1").v).toBe("Ann;007;15/01/2024;x");
    // destination style is kept
    expect(cell(ctx, "D1").bg).toBe("#ff0000");
    expect(cell(ctx, "E1")).toBeNull();
  });

  test("in place by default", () => {
    const ctx = makeContext({ rows: 6, cols: 8 });
    input(ctx, "A1", "1 2 3");
    applyTextToColumns(
      ctx,
      { row: [0, 0], column: [0, 0] },
      { mode: "delimited", delimiters: { space: true } }
    );
    expect(values(ctx, "A1", "C1")).toEqual([[1, 2, 3]]);
  });
});
