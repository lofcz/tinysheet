import { makeContext, input, cell, value, values } from "../formula/helpers";
import { handlePasteSpecial } from "../../src/events/paste";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  mockClipboard,
  copy,
  paste,
  select,
  activate,
  sheetOf,
  written,
} from "./helpers";

// Excel: "Copy and paste specific cell contents" (Paste Special) and
// "Move or copy cells": copied formulas keep absolute references and shift
// relative ones by the paste offset.

beforeEach(mockClipboard);

function specialPaste(ctx, at, options, sheetId = "id_1") {
  activate(ctx, sheetId);
  const [from, to] = at.split(":");
  select(ctx, from, to || from);
  const ok = handlePasteSpecial(ctx, options);
  groupValuesRefresh(ctx);
  return ok;
}

describe("copy/paste of formulas", () => {
  test("relative references shift, absolute ones are kept", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "A2", "2");
    input(ctx, "B1", "10");
    input(ctx, "C1", "=A1*$B$1+A$1+$A1");
    copy(ctx, "C1");
    paste(ctx, "D2");
    expect(cell(ctx, "D2").f).toBe("=B2*$B$1+B$1+$A2");
    expect(value(ctx, "D2")).toBe(0 * 10 + 10 + 2);
  });

  test("a block keeps its internal references", () => {
    const ctx = makeContext();
    input(ctx, "A1", "3");
    input(ctx, "B1", "=A1*2");
    input(ctx, "C1", "=SUM(A1:B1)");
    copy(ctx, "A1", "C1");
    paste(ctx, "A3");
    expect(cell(ctx, "B3").f).toBe("=A3*2");
    expect(cell(ctx, "C3").f).toBe("=SUM(A3:B3)");
    expect(values(ctx, "A3", "C3")).toEqual([[3, 6, 9]]);
  });

  test("pasting on another sheet keeps unqualified references relative to it", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "B1", "=A1+100");
    input(ctx, "A3", "7", "id_2");
    copy(ctx, "B1");
    paste(ctx, "B3", "id_2");
    expect(cell(ctx, "B3", "id_2").f).toBe("=A3+100");
    expect(value(ctx, "B3", "id_2")).toBe(107);
  });

  test("sheet-qualified references shift too", () => {
    const ctx = makeContext();
    input(ctx, "A2", "5", "id_2");
    input(ctx, "B1", "='My Sheet'!A1+1");
    copy(ctx, "B1");
    paste(ctx, "B2");
    expect(cell(ctx, "B2").f).toBe("='My Sheet'!A2+1");
    expect(value(ctx, "B2")).toBe(6);
  });

  test("references pushed off the sheet become #REF!", () => {
    const ctx = makeContext();
    input(ctx, "B2", "=A1");
    copy(ctx, "B2");
    paste(ctx, "A1");
    expect(cell(ctx, "A1").f).toBe("=#REF!");
    expect(value(ctx, "A1")).toBe("#REF!");
  });

  test("a selection that is a multiple of the copy is filled by repeating it", () => {
    const ctx = makeContext();
    input(ctx, "B4", "1");
    input(ctx, "B5", "2");
    input(ctx, "B6", "3");
    input(ctx, "A1", "=B1*10");
    copy(ctx, "A1");
    paste(ctx, "D1:D3");
    expect(cell(ctx, "D3").f).toBe("=E3*10");
    paste(ctx, "A4:A6");
    expect(values(ctx, "A4", "A6")).toEqual([[10], [20], [30]]);
    // not a multiple: pasted once
    copy(ctx, "B4", "B5");
    paste(ctx, "H1:H3");
    expect(values(ctx, "H1", "H2")).toEqual([[1], [2]]);
    expect(cell(ctx, "H3")).toBeNull();
  });

  test("dependents of the pasted cells are recalculated", () => {
    const ctx = makeContext();
    input(ctx, "A1", "4");
    input(ctx, "E1", "=D1*2");
    copy(ctx, "A1");
    paste(ctx, "D1");
    expect(value(ctx, "E1")).toBe(8);
  });

  test("copy writes HTML and TSV that other apps accept", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1.5");
    input(ctx, "B1", "=A1*2");
    copy(ctx, "A1", "B1");
    expect(written.text).toBe("1.5\t3");
    expect(written.html).toContain('x:num="3"');
    expect(written.html).toContain("<table");
  });

  test("a changed source is pasted as it is now (live copy)", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    copy(ctx, "A1");
    input(ctx, "A1", "2");
    paste(ctx, "C1");
    expect(value(ctx, "C1")).toBe(2);
  });
});

function styled(ctx) {
  activate(ctx, "id_1");
  const d = sheetOf(ctx, "id_1").data;
  input(ctx, "A1", "2");
  input(ctx, "A2", "=A1*10");
  Object.assign(d[0][0], {
    bl: 1,
    fc: "#ff0000",
    bg: "#ffff00",
    ct: { fa: "0.00", t: "n" },
    m: "2.00",
    ps: { value: "note", isShow: false },
  });
  d[1][0].it = 1;
  const file = sheetOf(ctx, "id_1");
  file.config.borderInfo = [
    {
      rangeType: "cell",
      value: {
        row_index: 0,
        col_index: 0,
        l: null,
        r: null,
        t: { style: 1, color: "#000000" },
        b: null,
      },
    },
  ];
  file.dataVerification = {
    "0_0": { type: "number", type2: "between", value1: "1", value2: "5" },
  };
  // target cells with their own format and value
  input(ctx, "C1", "7");
  d[0][2].fc = "#0000ff";
  d[0][2].ct = { fa: "0.0%", t: "n" };
  d[0][2].m = "700.0%";
  return ctx;
}

describe("Paste Special", () => {
  test("values: computed values only, target formatting kept", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1", "A2");
    specialPaste(ctx, "C1", { paste: "values" });
    expect(cell(ctx, "C1")).toMatchObject({ v: 2, fc: "#0000ff", m: "200.0%" });
    expect(cell(ctx, "C1").bl).toBeUndefined();
    expect(cell(ctx, "C2").v).toBe(20);
    expect(cell(ctx, "C2").f).toBeUndefined();
  });

  test("formulas: formulas and constants, no formatting", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1", "A2");
    specialPaste(ctx, "C1", { paste: "formulas" });
    expect(cell(ctx, "C2").f).toBe("=C1*10");
    expect(cell(ctx, "C2").it).toBeUndefined();
    expect(value(ctx, "C2")).toBe(20);
    expect(cell(ctx, "C1").fc).toBe("#0000ff");
  });

  test("formats: styles, number formats, borders; values kept", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { paste: "formats" });
    expect(cell(ctx, "C1")).toMatchObject({
      v: 7,
      bl: 1,
      fc: "#ff0000",
      bg: "#ffff00",
      ct: { fa: "0.00" },
      m: "7.00",
    });
    expect(cell(ctx, "C1").ps).toBeUndefined();
    const b = ctx.config.borderInfo.find(
      (x) => x.value?.row_index === 0 && x.value?.col_index === 2
    );
    expect(b.value.t).toEqual({ style: 1, color: "#000000" });
  });

  test("values and number formats", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { paste: "valuesAndNumberFormats" });
    expect(cell(ctx, "C1")).toMatchObject({
      v: 2,
      m: "2.00",
      fc: "#0000ff",
      ct: { fa: "0.00" },
    });
    expect(cell(ctx, "C1").bl).toBeUndefined();
  });

  test("formulas and number formats", () => {
    const ctx = styled(makeContext());
    sheetOf(ctx, "id_1").data[1][0].ct = { fa: "0.000", t: "n" };
    copy(ctx, "A2");
    specialPaste(ctx, "C2", { paste: "formulasAndNumberFormats" });
    expect(cell(ctx, "C2")).toMatchObject({ f: "=C1*10", ct: { fa: "0.000" } });
    expect(cell(ctx, "C2").it).toBeUndefined();
  });

  test("comments only", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { paste: "comments" });
    expect(cell(ctx, "C1")).toMatchObject({ v: 7, ps: { value: "note" } });
    expect(cell(ctx, "C1").bl).toBeUndefined();
  });

  test("validation only", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { paste: "validation" });
    expect(sheetOf(ctx, "id_1").dataVerification["0_2"]).toMatchObject({
      type: "number",
      value1: "1",
    });
    expect(cell(ctx, "C1").v).toBe(7);
  });

  test("all except borders", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { paste: "allExceptBorders" });
    expect(cell(ctx, "C1")).toMatchObject({
      v: 2,
      bl: 1,
      ps: { value: "note" },
    });
    expect(
      (ctx.config.borderInfo || []).some((x) => x.value?.col_index === 2)
    ).toBe(false);
  });

  test("column widths only", () => {
    const ctx = styled(makeContext());
    ctx.config.columnlen = { 0: 150 };
    copy(ctx, "A1");
    specialPaste(ctx, "C5", { paste: "columnWidths" });
    expect(ctx.config.columnlen[2]).toBe(150);
    expect(cell(ctx, "C5")).toBeNull();
  });

  test("all: everything including validation and comments", () => {
    const ctx = styled(makeContext());
    copy(ctx, "A1", "A2");
    specialPaste(ctx, "E1", { paste: "all" });
    expect(cell(ctx, "E1")).toMatchObject({
      v: 2,
      bl: 1,
      ps: { value: "note" },
    });
    expect(cell(ctx, "E2").f).toBe("=E1*10");
    expect(sheetOf(ctx, "id_1").dataVerification["0_4"]).toBeDefined();
  });

  test("transpose: rows become columns, formulas adjusted per cell", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "B1", "2");
    input(ctx, "C1", "=A1+B1");
    copy(ctx, "A1", "C1");
    specialPaste(ctx, "E1", { paste: "all", transpose: true });
    expect(values(ctx, "E1", "E3")).toEqual([[1], [2], [3]]);
    expect(value(ctx, "F1")).toBeUndefined();
    // C1 (=A1+B1) lands on E3 and its references are transposed with it
    expect(cell(ctx, "E3").f).toBe("=E1+E2");
  });

  test("transpose keeps absolute references", () => {
    const ctx = makeContext();
    input(ctx, "A1", "4");
    input(ctx, "B1", "=$A$1*2");
    copy(ctx, "A1", "B1");
    specialPaste(ctx, "D1", { paste: "formulas", transpose: true });
    expect(cell(ctx, "D2").f).toBe("=$A$1*2");
    expect(value(ctx, "D2")).toBe(8);
  });

  test("skip blanks keeps the target where the source is empty", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    input(ctx, "A3", "3");
    input(ctx, "C1", "x");
    input(ctx, "C2", "y");
    input(ctx, "C3", "z");
    copy(ctx, "A1", "A3");
    specialPaste(ctx, "C1", { paste: "all", skipBlanks: true });
    expect(values(ctx, "C1", "C3")).toEqual([[1], ["y"], [3]]);
  });

  test("operations: add, subtract, multiply, divide", () => {
    const ctx = makeContext();
    input(ctx, "A1", "2");
    ["C1", "D1", "E1", "F1"].forEach((a) => input(ctx, a, "10"));
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { paste: "values", operation: "add" });
    specialPaste(ctx, "D1", { paste: "values", operation: "subtract" });
    specialPaste(ctx, "E1", { paste: "values", operation: "multiply" });
    specialPaste(ctx, "F1", { paste: "values", operation: "divide" });
    expect(values(ctx, "C1", "F1")).toEqual([[12, 8, 20, 5]]);
  });

  test("operations: blanks count as 0, text targets are left alone", () => {
    const ctx = makeContext();
    input(ctx, "A1", "0");
    input(ctx, "C1", "5");
    input(ctx, "D1", "text");
    copy(ctx, "A1");
    specialPaste(ctx, "C1:D1", { paste: "values", operation: "divide" });
    expect(value(ctx, "C1")).toBe("#DIV/0!");
    expect(value(ctx, "D1")).toBe("text");
    specialPaste(ctx, "E1", { paste: "values", operation: "add" });
    expect(value(ctx, "E1")).toBe(0);
  });

  test("operations combine with target formulas and source formulas", () => {
    const ctx = makeContext();
    input(ctx, "A1", "3");
    input(ctx, "B1", "=A1*2");
    input(ctx, "C1", "=A1+1");
    copy(ctx, "B1");
    specialPaste(ctx, "C1", { paste: "formulas", operation: "multiply" });
    // C1 = (A1+1) * (B1's formula shifted one column right)
    expect(cell(ctx, "C1").f).toBe("=(A1+1)*(B1*2)");
    expect(value(ctx, "C1")).toBe(4 * 12);
    input(ctx, "D1", "10");
    copy(ctx, "A1");
    specialPaste(ctx, "E1", { paste: "values", operation: "add" });
    expect(value(ctx, "E1")).toBe(3);
  });

  test("paste link: absolute for one cell, relative for a range, qualified across sheets", () => {
    const ctx = makeContext();
    input(ctx, "A1", "5");
    input(ctx, "A2", "6");
    copy(ctx, "A1");
    specialPaste(ctx, "C1", { pasteLink: true });
    expect(cell(ctx, "C1").f).toBe("=$A$1");
    expect(value(ctx, "C1")).toBe(5);
    copy(ctx, "A1", "A2");
    specialPaste(ctx, "B1", { pasteLink: true }, "id_2");
    expect(cell(ctx, "B1", "id_2").f).toBe("=Sheet1!A1");
    expect(cell(ctx, "B2", "id_2").f).toBe("=Sheet1!A2");
    expect(value(ctx, "B2", "id_2")).toBe(6);
  });

  test("merged cells are pasted with all/formats", () => {
    const ctx = makeContext();
    activate(ctx, "id_1");
    const file = sheetOf(ctx, "id_1");
    input(ctx, "A1", "m");
    file.data[0][0].mc = { r: 0, c: 0, rs: 1, cs: 2 };
    file.data[0][1] = { mc: { r: 0, c: 0 } };
    file.config.merge = { "0_0": { r: 0, c: 0, rs: 1, cs: 2 } };
    ctx.config = file.config;
    copy(ctx, "A1", "B1");
    specialPaste(ctx, "A4", { paste: "all" });
    expect(ctx.config.merge["3_0"]).toEqual({ r: 3, c: 0, rs: 1, cs: 2 });
    expect(cell(ctx, "A4").mc).toEqual({ r: 3, c: 0, rs: 1, cs: 2 });
    expect(cell(ctx, "B4").mc).toEqual({ r: 3, c: 0 });
  });

  test("conditional formats of the copied cells are copied", () => {
    const ctx = makeContext();
    input(ctx, "A1", "1");
    sheetOf(ctx, "id_1").luckysheet_conditionformat_save = [
      { type: "default", cellrange: [{ row: [0, 5], column: [0, 0] }] },
    ];
    copy(ctx, "A1");
    specialPaste(ctx, "C3", { paste: "formats" });
    const cf = sheetOf(ctx, "id_1").luckysheet_conditionformat_save;
    expect(cf).toHaveLength(2);
    expect(cf[1].cellrange).toEqual([{ row: [2, 2], column: [2, 2] }]);
  });

  test("nothing copied: nothing pasted", () => {
    const ctx = makeContext();
    ctx.luckysheet_copy_save = undefined;
    expect(specialPaste(ctx, "A1", { paste: "values" })).toBe(false);
  });
});
