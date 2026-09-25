import { produceWithPatches, enablePatches, applyPatches } from "immer";
import { input, makeContext, value, cell } from "../formula/helpers";
import {
  duplicateSheet,
  generateDuplicateSheetName,
  getGroupedSheetIds,
  hideSheets,
  mirrorGroupedSheetEdits,
  moveSheet,
  onSheetTabActivated,
  renameSheet,
  rewriteSheetReferences,
  selectAllSheets,
  selectSheetRange,
  setSheetTabColor,
  toggleSheetInGroup,
  unhideSheets,
  validateSheetName,
  editSheetName,
} from "../../src/modules/sheet";
import { groupValuesRefresh } from "../../src/modules/formula";
import { updateCell } from "../../src/modules/cell";
import { copySheet } from "../../src/api/sheet";

enablePatches();

const names = (ctx) =>
  [...ctx.luckysheetfile].sort((a, b) => a.order - b.order).map((s) => s.name);

function threeSheets() {
  const ctx = makeContext({ rows: 6, cols: 4 });
  ctx.luckysheetfile.push({
    name: "Data",
    id: "id_3",
    order: 2,
    data: Array.from({ length: 6 }, () => Array(4).fill(null)),
  });
  return ctx;
}

describe("sheet names (Excel rules)", () => {
  test("validation", () => {
    const ctx = makeContext();
    expect(validateSheetName(ctx, "")).toBe("blank");
    expect(validateSheetName(ctx, "   ")).toBe("blank");
    expect(validateSheetName(ctx, "a".repeat(31))).toBeNull();
    expect(validateSheetName(ctx, "a".repeat(32))).toBe("tooLong");
    ["a/b", "a\\b", "a?b", "a*b", "a[b", "a]b", "a:b"].forEach((n) => {
      expect(validateSheetName(ctx, n)).toBe("invalidChars");
    });
    expect(validateSheetName(ctx, "'abc")).toBe("apostrophe");
    expect(validateSheetName(ctx, "abc'")).toBe("apostrophe");
    expect(validateSheetName(ctx, "it's")).toBeNull();
    expect(validateSheetName(ctx, "history")).toBe("reserved");
    // unique, ignoring case; the renamed sheet itself doesn't count
    expect(validateSheetName(ctx, "SHEET1")).toBe("duplicate");
    expect(validateSheetName(ctx, "sheet1", "id_1")).toBeNull();
    expect(validateSheetName(ctx, "Budget 2024 (final)")).toBeNull();
  });

  test("renameSheet rewrites references to the sheet", () => {
    const ctx = makeContext();
    input(ctx, "A1", "5");
    input(ctx, "A1", "=Sheet1!A1*2", "id_2");
    input(ctx, "A2", '="Sheet1!A1"', "id_2");
    expect(renameSheet(ctx, "id_1", "My:Sheet")).toBe("invalidChars");
    expect(renameSheet(ctx, "id_1", "Costs 2024")).toBeNull();
    expect(ctx.luckysheetfile[0].name).toBe("Costs 2024");
    expect(cell(ctx, "A1", "id_2").f).toBe("='Costs 2024'!A1*2");
    // string literals are not references
    expect(cell(ctx, "A2", "id_2").f).toBe('="Sheet1!A1"');
    input(ctx, "A1", "7");
    expect(value(ctx, "A1", "id_2")).toBe(14);
  });

  test("editSheetName throws the rule's message", () => {
    const ctx = makeContext();
    const el = document.createElement("span");
    el.dataset.oldText = "Sheet1";
    el.innerText = "My Sheet";
    expect(() => editSheetName(ctx, el)).toThrow(
      "That name is already taken. Try a different one."
    );
    expect(el.innerText).toBe("Sheet1");
  });
});

describe("rewriteSheetReferences", () => {
  test("qualified cells, ranges and quoted names", () => {
    expect(
      rewriteSheetReferences("=Sheet1!A1+A2", "Sheet1", "Sheet1 (2)")
    ).toBe("='Sheet1 (2)'!A1+A2");
    expect(
      rewriteSheetReferences("=SUM('My Sheet'!A1:B2)", "My Sheet", "Other")
    ).toBe("=SUM(Other!A1:B2)");
    expect(
      rewriteSheetReferences("=SUM(sheet1!A1:Sheet1!B2)", "Sheet1", "X")
    ).toBe("=SUM(X!A1:X!B2)");
    expect(rewriteSheetReferences("=Sheet10!A1", "Sheet1", "X")).toBe(
      "=Sheet10!A1"
    );
    expect(rewriteSheetReferences("=SUM(Sheet1!A:A)", "Sheet1", "Y")).toBe(
      "=SUM(Y!A:A)"
    );
  });

  test("spill references (A1#) are references too", () => {
    expect(rewriteSheetReferences("=SUM(Sheet1!B2#)", "Sheet1", "Z Z")).toBe(
      "=SUM('Z Z'!B2#)"
    );
    expect(rewriteSheetReferences("=COUNT(B2#)", "Sheet1", "Z")).toBe(
      "=COUNT(B2#)"
    );
  });

  test("duplicating a sheet keeps spill references pointing at the copy", () => {
    const ctx = makeContext({ rows: 8, cols: 6 });
    input(ctx, "A1", "=SEQUENCE(3)");
    input(ctx, "C1", "=SUM(Sheet1!A1#)");
    const id = duplicateSheet(ctx, "id_1");
    expect(cell(ctx, "C1", id).f).toBe("=SUM('Sheet1 (2)'!A1#)");
    expect(value(ctx, "C1", id)).toBe(6);
  });
});

describe("duplicate / move", () => {
  test("Excel names copies Name (2), Name (3)", () => {
    const ctx = makeContext();
    expect(generateDuplicateSheetName(ctx, "Sheet1")).toBe("Sheet1 (2)");
    ctx.luckysheetfile[1].name = "sheet1 (2)";
    expect(generateDuplicateSheetName(ctx, "Sheet1")).toBe("Sheet1 (3)");
    expect(generateDuplicateSheetName(ctx, "Sheet1 (2)")).toBe("Sheet1 (3)");
    const long = "x".repeat(31);
    expect(generateDuplicateSheetName(ctx, long)).toBe(`${"x".repeat(27)} (2)`);
  });

  test("duplicate goes right after the original; its self-references point at the copy", () => {
    const ctx = threeSheets();
    input(ctx, "A1", "3");
    input(ctx, "B1", "=Sheet1!A1+A1");
    input(ctx, "C1", "='My Sheet'!A1");
    const id = duplicateSheet(ctx, "id_1");
    expect(names(ctx)).toEqual(["Sheet1", "Sheet1 (2)", "My Sheet", "Data"]);
    // appended to the file list (undo/collab ops rely on it)
    expect(ctx.luckysheetfile[3].id).toBe(id);
    expect(cell(ctx, "B1", id).f).toBe("='Sheet1 (2)'!A1+A1");
    expect(cell(ctx, "C1", id).f).toBe("='My Sheet'!A1");
    expect(cell(ctx, "B1").f).toBe("=Sheet1!A1+A1");
    // the copy is independent and its formulas are live
    input(ctx, "A1", "10", id);
    expect(value(ctx, "B1", id)).toBe(20);
    expect(value(ctx, "B1")).toBe(6);
  });

  test("copy before a given sheet, or at the end", () => {
    const ctx = threeSheets();
    duplicateSheet(ctx, "id_3", { beforeSheetId: "id_1" });
    expect(names(ctx)).toEqual(["Data (2)", "Sheet1", "My Sheet", "Data"]);
    duplicateSheet(ctx, "id_1", { beforeSheetId: null });
    expect(names(ctx)).toEqual([
      "Data (2)",
      "Sheet1",
      "My Sheet",
      "Data",
      "Sheet1 (2)",
    ]);
  });

  test("api.copySheet uses the Excel behaviour", () => {
    const ctx = makeContext();
    copySheet(ctx, "id_2");
    expect(names(ctx)).toEqual(["Sheet1", "My Sheet", "My Sheet (2)"]);
  });

  test("move before a sheet / to the end", () => {
    const ctx = threeSheets();
    moveSheet(ctx, "id_3", "id_1");
    expect(names(ctx)).toEqual(["Data", "Sheet1", "My Sheet"]);
    moveSheet(ctx, "id_3", null);
    expect(names(ctx)).toEqual(["Sheet1", "My Sheet", "Data"]);
    moveSheet(ctx, "id_1", "id_3");
    expect(names(ctx)).toEqual(["My Sheet", "Sheet1", "Data"]);
  });
});

describe("tab colour, hide / unhide", () => {
  test("tab colour on several sheets and reset", () => {
    const ctx = threeSheets();
    setSheetTabColor(ctx, ["id_1", "id_3"], "#ff0000");
    expect(ctx.luckysheetfile.map((s) => s.color)).toEqual([
      "#ff0000",
      undefined,
      "#ff0000",
    ]);
    setSheetTabColor(ctx, ["id_1"], undefined);
    expect("color" in ctx.luckysheetfile[0]).toBe(false);
  });

  test("hiding keeps one sheet visible and activates the next one", () => {
    const ctx = threeSheets();
    expect(hideSheets(ctx, ["id_1", "id_2", "id_3"])).toBe(false);
    expect(ctx.luckysheetfile.some((s) => s.hide === 1)).toBe(false);
    expect(hideSheets(ctx, ["id_1", "id_2"])).toBe(true);
    expect(ctx.currentSheetId).toBe("id_3");
    unhideSheets(ctx, ["id_1", "id_2"]);
    expect(ctx.luckysheetfile.some((s) => s.hide === 1)).toBe(false);
    // the last unhidden sheet becomes active
    expect(ctx.currentSheetId).toBe("id_2");
  });
});

describe("grouped sheets", () => {
  test("Ctrl+click toggles, Shift+click selects a span, all sheets", () => {
    const ctx = threeSheets();
    toggleSheetInGroup(ctx, "id_3");
    expect(getGroupedSheetIds(ctx)).toEqual(["id_1", "id_3"]);
    toggleSheetInGroup(ctx, "id_3");
    expect(getGroupedSheetIds(ctx)).toEqual([]);
    selectSheetRange(ctx, "id_3");
    expect(getGroupedSheetIds(ctx)).toEqual(["id_1", "id_2", "id_3"]);
    ctx.luckysheetfile[1].hide = 1;
    expect(getGroupedSheetIds(ctx)).toEqual(["id_1", "id_3"]);
    ctx.luckysheetfile[1].hide = undefined;
    selectAllSheets(ctx);
    expect(getGroupedSheetIds(ctx)).toHaveLength(3);
  });

  test("clicking a tab: inside a partial group keeps it, outside ungroups", () => {
    const ctx = threeSheets();
    toggleSheetInGroup(ctx, "id_2");
    onSheetTabActivated(ctx, "id_2");
    expect(getGroupedSheetIds(ctx)).toEqual(["id_1", "id_2"]);
    onSheetTabActivated(ctx, "id_3");
    expect(getGroupedSheetIds(ctx)).toEqual([]);
    selectAllSheets(ctx);
    onSheetTabActivated(ctx, "id_2");
    expect(getGroupedSheetIds(ctx)).toEqual([]);
  });

  function editGrouped(ctx, recipe) {
    const [next, patches, inverse] = produceWithPatches(ctx, (draft) => {
      recipe(draft);
      mirrorGroupedSheetEdits(ctx, draft);
      groupValuesRefresh(draft);
    });
    return { next, patches, inverse };
  }

  test("value, formula and format edits apply to every grouped sheet in one step", () => {
    let ctx = threeSheets();
    input(ctx, "A1", "2", "id_2");
    input(ctx, "A1", "5", "id_3");
    toggleSheetInGroup(ctx, "id_3");
    const before = ctx;
    const r1 = editGrouped(ctx, (d) => {
      updateCell(d, 0, 1, null, "=A1*10");
      d.luckysheetfile[0].data[1][0] = { v: "x", m: "x", bl: 1 };
      d.luckysheetfile[0].config = { columnlen: { 2: 150 } };
    });
    ctx = r1.next;
    expect(value(ctx, "B1", "id_3")).toBe(50);
    expect(cell(ctx, "B1", "id_3").f).toBe("=A1*10");
    expect(cell(ctx, "A2", "id_3")).toMatchObject({ v: "x", bl: 1 });
    expect(ctx.luckysheetfile[2].config.columnlen).toEqual({ 2: 150 });
    // not grouped: untouched
    expect(cell(ctx, "B1", "id_2")).toBeNull();
    // one undo step restores every grouped sheet
    const undone = applyPatches(ctx, r1.inverse);
    expect(cell(undone, "B1", "id_3")).toBe(
      before.luckysheetfile[2].data[0][1]
    );
    expect(cell(undone, "A2", "id_3")).toBeNull();
  });

  test("structural changes and sheet switches are not mirrored", () => {
    const ctx = threeSheets();
    selectAllSheets(ctx);
    const { next } = editGrouped(ctx, (d) => {
      d.luckysheetfile[0].data.push([null, null, null, null]);
      d.luckysheetfile[0].data[0][0] = { v: 1 };
    });
    expect(cell(next, "A1", "id_2")).toBeNull();
    const r2 = editGrouped(ctx, (d) => {
      d.currentSheetId = "id_2";
      d.luckysheetfile[0].data[0][0] = { v: 1 };
    });
    expect(cell(r2.next, "A1", "id_3")).toBeNull();
  });
});
