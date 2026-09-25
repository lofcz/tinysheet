import { makeContext, input, cell, value } from "../formula/helpers";
import { deleteSheet, editSheetName } from "../../src/modules/sheet";
import { setSheetName } from "../../src/api/workbook";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  registerReferenceAdjuster,
  adjustReferences,
} from "../../src/modules/refAdjust";

// Excel: renaming a sheet updates every formula that refers to it; deleting
// a sheet turns references to it into #REF!.

function setup() {
  const ctx = makeContext();
  input(ctx, "A1", "5", "id_2");
  input(ctx, "B1", "='My Sheet'!A1*2");
  input(ctx, "B2", '="My Sheet!A1"');
  input(ctx, "B3", "=A1+1", "id_2");
  return ctx;
}

describe("rename sheet", () => {
  test("setSheetName rewrites sheet-qualified references", () => {
    const ctx = setup();
    setSheetName(ctx, "Data", { id: "id_2" });
    expect(cell(ctx, "B1").f).toBe("=Data!A1*2");
    expect(cell(ctx, "B2").f).toBe('="My Sheet!A1"');
    expect(cell(ctx, "B3", "id_2").f).toBe("=A1+1");
  });

  test("names that need quotes get quoted", () => {
    const ctx = setup();
    setSheetName(ctx, "Q1 2026", { id: "id_2" });
    expect(cell(ctx, "B1").f).toBe("='Q1 2026'!A1*2");
    input(ctx, "A1", "7", "id_2");
    expect(value(ctx, "B1")).toBe(14);
  });

  test("editing the tab name rewrites references", () => {
    const ctx = setup();
    ctx.currentSheetId = "id_2";
    const editable = { innerText: "Other", dataset: { oldText: "My Sheet" } };
    editSheetName(ctx, editable);
    expect(ctx.luckysheetfile[1].name).toBe("Other");
    expect(cell(ctx, "B1").f).toBe("=Other!A1*2");
  });
});

describe("delete sheet", () => {
  test("references to the deleted sheet become #REF!", () => {
    const ctx = setup();
    ctx.luckysheetfile.push({
      name: "Third",
      id: "id_3",
      order: 2,
      data: [[null]],
    });
    deleteSheet(ctx, "id_2");
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B1").f).toBe("=#REF!*2");
    expect(value(ctx, "B1")).toBe("#REF!");
    expect(cell(ctx, "B2").f).toBe('="My Sheet!A1"');
  });
});

describe("reference adjuster registry", () => {
  test("registered adjusters see every change and can rewrite formulas", () => {
    const ctx = setup();
    const names = { Total: { ref: "='My Sheet'!$A$1", host: "id_1" } };
    const seen = [];
    const unregister = registerReferenceAdjuster(
      "test-names",
      (c, change, api) => {
        seen.push(change.type);
        Object.values(names).forEach((n) => {
          n.ref = api.rewriteFormula(n.ref, n.host);
        });
      }
    );
    try {
      adjustReferences(ctx, {
        type: "insert",
        sheetId: "id_2",
        axis: "row",
        index: 0,
        count: 2,
      });
      expect(names.Total.ref).toBe("='My Sheet'!$A$3");
      setSheetName(ctx, "Stats", { id: "id_2" });
      expect(names.Total.ref).toBe("=Stats!$A$3");
      expect(seen).toEqual(["insert", "renameSheet"]);
    } finally {
      unregister();
    }
    adjustReferences(ctx, {
      type: "insert",
      sheetId: "id_2",
      axis: "row",
      index: 0,
      count: 2,
    });
    expect(seen).toHaveLength(2);
  });
});
