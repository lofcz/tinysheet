import { input, makeContext, value, cell } from "../formula/helpers";
import {
  createMatcher,
  findAllMatches,
  findNextMatch,
  getCellSearchText,
  replaceAllMatches,
  replaceNextMatch,
  wildcardToRegExpSource,
  searchNext,
  replaceAll,
} from "../../src/modules/searchReplace";
import { groupValuesRefresh } from "../../src/modules/formula";

function select(ctx, r, c, r2 = r, c2 = c) {
  ctx.luckysheet_select_save = [
    { row: [r, r2], column: [c, c2], row_focus: r, column_focus: c },
  ];
}

function active(ctx) {
  const last =
    ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
  return [ctx.currentSheetId, last.row_focus, last.column_focus];
}

/**
 * Sheet1:        A        B          C
 *   1          apple    Apple pie   =A1&"s"
 *   2          banana   5
 *   3          a*c      APPLE
 * My Sheet: A1 "apple tart", B2 "pineapple"
 */
function workbook() {
  const ctx = makeContext({ rows: 6, cols: 4 });
  input(ctx, "A1", "apple");
  input(ctx, "B1", "Apple pie");
  input(ctx, "C1", '=A1&"s"');
  input(ctx, "A2", "banana");
  input(ctx, "B2", "5");
  input(ctx, "A3", "a*c");
  input(ctx, "B3", "APPLE");
  input(ctx, "A1", "apple tart", "id_2");
  input(ctx, "B2", "pineapple", "id_2");
  select(ctx, 0, 0);
  return ctx;
}

const where = (ms) => ms.map((m) => `${m.sheetName}!${m.cellPosition}`);

describe("wildcards (Excel: * any characters, ? one character, ~ escapes)", () => {
  test("pattern translation", () => {
    expect(wildcardToRegExpSource("a*c")).toBe("a[\\s\\S]*c");
    expect(wildcardToRegExpSource("a?c")).toBe("a[\\s\\S]c");
    expect(wildcardToRegExpSource("a~*c")).toBe("a\\*c");
    expect(wildcardToRegExpSource("~~")).toBe("~");
    expect(wildcardToRegExpSource("1.5$")).toBe("1\\.5\\$");
  });

  test("matching is case-insensitive unless Match case", () => {
    expect(createMatcher("APP").test("apple")).toBe(true);
    expect(createMatcher("APP", { matchCase: true }).test("apple")).toBe(false);
  });

  test("Match entire cell contents", () => {
    const m = createMatcher("apple", { matchEntire: true });
    expect(m.test("apple")).toBe(true);
    expect(m.test("apple pie")).toBe(false);
    expect(createMatcher("a*e", { matchEntire: true }).test("apple")).toBe(
      true
    );
    expect(createMatcher("a?", { matchEntire: true }).test("abc")).toBe(false);
  });

  test("replace substitutes every occurrence, literal replacement text", () => {
    expect(createMatcher("a").replace("banana", "$&")).toBe("b$&n$&n$&");
    expect(createMatcher("a*", {}).replace("banana", "Z")).toBe("bZ");
    expect(createMatcher("x", { matchEntire: true }).replace("x", "yy")).toBe(
      "yy"
    );
  });

  test("an empty search text matches nothing", () => {
    expect(createMatcher("")).toBeNull();
  });
});

describe("look in formulas / values / notes", () => {
  test("formula text vs displayed value", () => {
    const f = { f: '=A1&"s"', v: "apples", m: "apples" };
    expect(getCellSearchText(f, "formulas")).toBe('=A1&"s"');
    expect(getCellSearchText(f, "values")).toBe("apples");
    const pct = { v: 0.5, m: "50%", ct: { fa: "0%", t: "n" } };
    expect(getCellSearchText(pct, "formulas")).toBe("0.5");
    expect(getCellSearchText(pct, "values")).toBe("50%");
    const note = { v: 1, ps: { value: "check me" } };
    expect(getCellSearchText(note, "notes")).toBe("check me");
    expect(getCellSearchText({ v: 1 }, "notes")).toBeNull();
  });

  test("Find All in values finds formula results; in formulas it does not", () => {
    const ctx = workbook();
    expect(where(findAllMatches(ctx, "apples"))).toEqual(["Sheet1!C1"]);
    expect(findAllMatches(ctx, "apples", { lookIn: "formulas" })).toEqual([]);
    expect(where(findAllMatches(ctx, "A1&", { lookIn: "formulas" }))).toEqual([
      "Sheet1!C1",
    ]);
  });

  test("result rows carry sheet, cell, value and formula", () => {
    const ctx = workbook();
    const [m] = findAllMatches(ctx, "apples");
    expect(m).toMatchObject({
      sheetId: "id_1",
      sheetName: "Sheet1",
      cellPosition: "C1",
      r: 0,
      c: 2,
      value: "apples",
      formula: '=A1&"s"',
    });
  });
});

describe("Find All scope and order", () => {
  test("sheet scope, by rows (default)", () => {
    const ctx = workbook();
    expect(where(findAllMatches(ctx, "apple"))).toEqual([
      "Sheet1!A1",
      "Sheet1!B1",
      "Sheet1!C1",
      "Sheet1!B3",
    ]);
  });

  test("by columns", () => {
    const ctx = workbook();
    expect(
      where(findAllMatches(ctx, "apple", { searchBy: "columns" }))
    ).toEqual(["Sheet1!A1", "Sheet1!B1", "Sheet1!B3", "Sheet1!C1"]);
  });

  test("match case and entire cell", () => {
    const ctx = workbook();
    expect(
      where(
        findAllMatches(ctx, "APPLE", { matchCase: true, matchEntire: true })
      )
    ).toEqual(["Sheet1!B3"]);
    expect(where(findAllMatches(ctx, "apple", { matchEntire: true }))).toEqual([
      "Sheet1!A1",
      "Sheet1!B3",
    ]);
  });

  test("workbook scope searches every visible sheet in tab order", () => {
    const ctx = workbook();
    expect(where(findAllMatches(ctx, "tart", { scope: "workbook" }))).toEqual([
      "My Sheet!A1",
    ]);
    ctx.luckysheetfile[1].hide = 1;
    expect(findAllMatches(ctx, "tart", { scope: "workbook" })).toEqual([]);
  });

  test("a multi-cell selection limits a sheet search", () => {
    const ctx = workbook();
    select(ctx, 0, 1, 2, 1);
    expect(where(findAllMatches(ctx, "apple"))).toEqual([
      "Sheet1!B1",
      "Sheet1!B3",
    ]);
  });

  test("~* finds a literal asterisk", () => {
    const ctx = workbook();
    expect(where(findAllMatches(ctx, "a~*c"))).toEqual(["Sheet1!A3"]);
    expect(where(findAllMatches(ctx, "b?n*"))).toEqual(["Sheet1!A2"]);
  });

  test("notes", () => {
    const ctx = workbook();
    ctx.luckysheetfile[0].data[1][1].ps = { value: "to check" };
    expect(where(findAllMatches(ctx, "check", { lookIn: "notes" }))).toEqual([
      "Sheet1!B2",
    ]);
  });
});

describe("Find Next / Find Previous", () => {
  test("starts after the active cell and wraps", () => {
    const ctx = workbook();
    select(ctx, 0, 0);
    findNextMatch(ctx, "apple");
    expect(active(ctx)).toEqual(["id_1", 0, 1]);
    findNextMatch(ctx, "apple");
    expect(active(ctx)).toEqual(["id_1", 0, 2]);
    findNextMatch(ctx, "apple");
    expect(active(ctx)).toEqual(["id_1", 2, 1]);
    findNextMatch(ctx, "apple");
    expect(active(ctx)).toEqual(["id_1", 0, 0]);
  });

  test("Find Previous goes backwards", () => {
    const ctx = workbook();
    select(ctx, 0, 0);
    findNextMatch(ctx, "apple", {}, true);
    expect(active(ctx)).toEqual(["id_1", 2, 1]);
  });

  test("workbook scope moves to the next sheet", () => {
    const ctx = workbook();
    select(ctx, 2, 1);
    const m = findNextMatch(ctx, "apple", { scope: "workbook" });
    expect(m.sheetName).toBe("My Sheet");
    expect(active(ctx)).toEqual(["id_2", 0, 0]);
    findNextMatch(ctx, "apple", { scope: "workbook" });
    expect(active(ctx)).toEqual(["id_2", 1, 1]);
    findNextMatch(ctx, "apple", { scope: "workbook" });
    expect(active(ctx)).toEqual(["id_1", 0, 0]);
  });

  test("within a selection the range stays selected and the active cell moves", () => {
    const ctx = workbook();
    select(ctx, 0, 1, 2, 1);
    findNextMatch(ctx, "apple");
    expect(ctx.luckysheet_select_save).toHaveLength(1);
    expect(ctx.luckysheet_select_save[0].row).toEqual([0, 2]);
    expect(active(ctx)).toEqual(["id_1", 2, 1]);
  });

  test("legacy searchNext reports when nothing is found", () => {
    const ctx = workbook();
    expect(searchNext(ctx, "zzz", {})).toBe("The content was not found");
    expect(searchNext(ctx, "banana", {})).toBeNull();
  });
});

describe("Replace / Replace All", () => {
  test("Replace replaces the active match then selects the next", () => {
    const ctx = workbook();
    select(ctx, 0, 0);
    const res = replaceNextMatch(ctx, "apple", "pear");
    groupValuesRefresh(ctx);
    expect(res.replaced).toBe(1);
    expect(value(ctx, "A1")).toBe("pear");
    expect(active(ctx)).toEqual(["id_1", 0, 1]);
    // the formula depending on A1 was recalculated
    expect(value(ctx, "C1")).toBe("pears");
  });

  test("Replace on a non-matching active cell only finds", () => {
    const ctx = workbook();
    select(ctx, 1, 0);
    const res = replaceNextMatch(ctx, "apple", "pear");
    expect(res.replaced).toBe(0);
    expect(active(ctx)).toEqual(["id_1", 2, 1]);
  });

  test("Replace All counts replacements; case-insensitive by default", () => {
    const ctx = workbook();
    const n = replaceAllMatches(ctx, "apple", "Kiwi");
    groupValuesRefresh(ctx);
    // A1, B1, B3; C1's formula text doesn't contain "apple"
    expect(n).toBe(3);
    expect(value(ctx, "A1")).toBe("Kiwi");
    expect(value(ctx, "B1")).toBe("Kiwi pie");
    expect(value(ctx, "B3")).toBe("Kiwi");
    expect(value(ctx, "C1")).toBe("Kiwis");
  });

  test("replacing inside formulas rewrites and recalculates them", () => {
    const ctx = workbook();
    const n = replaceAllMatches(ctx, '"s"', '"!"', { lookIn: "formulas" });
    expect(n).toBe(1);
    expect(cell(ctx, "C1").f).toBe('=A1&"!"');
    expect(value(ctx, "C1")).toBe("apple!");
  });

  test("replaced numbers are parsed as numbers", () => {
    const ctx = workbook();
    replaceAllMatches(ctx, "5", "42", { matchEntire: true });
    expect(value(ctx, "B2")).toBe(42);
  });

  test("workbook scope replaces on every sheet", () => {
    const ctx = workbook();
    const n = replaceAllMatches(ctx, "apple", "fig", { scope: "workbook" });
    expect(n).toBe(5);
    expect(value(ctx, "B2", "id_2")).toBe("pinefig");
    expect(ctx.currentSheetId).toBe("id_1");
  });

  test("legacy replaceAll returns the count message", () => {
    const ctx = workbook();
    expect(replaceAll(ctx, "banana", "x", {})).toBe(
      "All done. We made 1 replacements."
    );
    expect(replaceAll(ctx, "zzz", "x", {})).toBe("There is nothing to replace");
  });
});
