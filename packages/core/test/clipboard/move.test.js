import { enablePatches, produceWithPatches, applyPatches } from "immer";
import _ from "lodash";
import { makeContext, input, cell, value, values } from "../formula/helpers";
import { moveCellRange } from "../../src/modules/moveCells";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  mockClipboard,
  cut,
  copy,
  paste,
  activate,
  sheetOf,
  written,
} from "./helpers";

// Excel, "Move or copy cells": when cells are moved (cut and paste, or
// dragged), their formulas are not adjusted, and every formula that refers
// to the moved cells now refers to their new location. Formulas that
// referred to the cells overwritten by the move show #REF!.

enablePatches();
beforeEach(mockClipboard);

function setup() {
  const ctx = makeContext();
  input(ctx, "A1", "1");
  input(ctx, "A2", "2");
  input(ctx, "B7", "100");
  input(ctx, "A3", "=SUM(A1:A2)");
  input(ctx, "B1", "=A1*2");
  input(ctx, "B2", "=$A$2+B7");
  input(ctx, "A1", "=Sheet1!A2+1", "id_2");
  return ctx;
}

describe("cut and paste on the same sheet", () => {
  test("references to the moved cells follow them, everywhere", () => {
    const ctx = setup();
    cut(ctx, "A1", "A2");
    paste(ctx, "C5");
    expect(values(ctx, "C5", "C6")).toEqual([[1], [2]]);
    expect(cell(ctx, "A1")).toBeNull();
    expect(cell(ctx, "A2")).toBeNull();
    expect(cell(ctx, "A3").f).toBe("=SUM(C5:C6)");
    expect(cell(ctx, "B1").f).toBe("=C5*2");
    expect(cell(ctx, "B2").f).toBe("=$C$6+B7");
    expect(cell(ctx, "A1", "id_2").f).toBe("=Sheet1!C6+1");
    expect(value(ctx, "A3")).toBe(3);
    expect(value(ctx, "B2")).toBe(102);
    expect(value(ctx, "A1", "id_2")).toBe(3);
  });

  test("moved formulas keep their text", () => {
    const ctx = setup();
    cut(ctx, "B1", "B2");
    paste(ctx, "E1");
    // B1 referenced A1 (not moved): unchanged
    expect(cell(ctx, "E1").f).toBe("=A1*2");
    expect(cell(ctx, "E2").f).toBe("=$A$2+B7");
    expect(value(ctx, "E2")).toBe(102);
  });

  test("a moved block keeps its internal references", () => {
    const ctx = setup();
    cut(ctx, "A1", "B2");
    paste(ctx, "D1");
    expect(cell(ctx, "E1").f).toBe("=D1*2");
    expect(cell(ctx, "E2").f).toBe("=$D$2+B7");
    expect(cell(ctx, "A3").f).toBe("=SUM(D1:D2)");
  });

  test("references to the overwritten cells become #REF!", () => {
    const ctx = setup();
    input(ctx, "D1", "=C5+1");
    cut(ctx, "A1", "A2");
    paste(ctx, "C5");
    expect(cell(ctx, "D1").f).toBe("=#REF!+1");
    expect(value(ctx, "D1")).toBe("#REF!");
  });

  test("ranges only partly moved are left alone", () => {
    const ctx = setup();
    cut(ctx, "A1");
    paste(ctx, "C1");
    expect(cell(ctx, "A3").f).toBe("=SUM(A1:A2)");
    expect(value(ctx, "A3")).toBe(2);
    expect(cell(ctx, "B1").f).toBe("=C1*2");
  });

  test("a cut is pasted only once", () => {
    const ctx = setup();
    cut(ctx, "A1");
    const clip = { ...written };
    paste(ctx, "C1", "id_1", clip);
    paste(ctx, "D1", "id_1", clip);
    expect(cell(ctx, "D1")).toBeNull();
    expect(value(ctx, "C1")).toBe(1);
  });
});

describe("cut and paste across sheets", () => {
  test("references follow the cells to the other sheet", () => {
    const ctx = setup();
    cut(ctx, "A1", "A2");
    paste(ctx, "B2", "id_2");
    expect(values(ctx, "B2", "B3", "id_2")).toEqual([[1], [2]]);
    expect(cell(ctx, "B1").f).toBe("='My Sheet'!B2*2");
    expect(cell(ctx, "A3").f).toBe("=SUM('My Sheet'!B2:B3)");
    // the formula on the destination sheet now points at its own cell
    expect(cell(ctx, "A1", "id_2").f).toBe("='My Sheet'!B3+1");
    expect(value(ctx, "A3")).toBe(3);
    expect(value(ctx, "A1", "id_2")).toBe(3);
  });

  test("moved formulas are qualified with their old sheet", () => {
    const ctx = setup();
    cut(ctx, "B2");
    paste(ctx, "C1", "id_2");
    expect(cell(ctx, "C1", "id_2").f).toBe("=Sheet1!$A$2+Sheet1!B7");
    expect(value(ctx, "C1", "id_2")).toBe(102);
  });
});

describe("moveCellRange (drag and drop)", () => {
  test("formats, merges, comments, validation, links and CF move too", () => {
    const ctx = makeContext();
    activate(ctx, "id_1");
    const file = sheetOf(ctx, "id_1");
    input(ctx, "A1", "x");
    Object.assign(file.data[0][0], {
      bl: 1,
      ps: { value: "note" },
      mc: { r: 0, c: 0, rs: 1, cs: 2 },
    });
    file.data[0][1] = { mc: { r: 0, c: 0 } };
    ctx.config.merge = { "0_0": { r: 0, c: 0, rs: 1, cs: 2 } };
    ctx.config.borderInfo = [
      {
        rangeType: "range",
        borderType: "border-all",
        style: 1,
        color: "#000000",
        range: [{ row: [0, 0], column: [0, 1] }],
      },
    ];
    file.dataVerification = { "0_0": { type: "dropdown", value1: "a,b" } };
    file.hyperlink = { "0_0": { linkType: "webpage", linkAddress: "x.com" } };
    file.luckysheet_conditionformat_save = [
      { type: "default", cellrange: [{ row: [0, 0], column: [0, 1] }] },
    ];

    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 0], column: [0, 1] } },
      { sheetId: "id_1", row: 4, column: 2 }
    );
    groupValuesRefresh(ctx);

    expect(cell(ctx, "A1")).toBeNull();
    expect(cell(ctx, "C5")).toMatchObject({
      v: "x",
      bl: 1,
      ps: { value: "note" },
      mc: { r: 4, c: 2, rs: 1, cs: 2 },
    });
    expect(cell(ctx, "D5")).toEqual({ mc: { r: 4, c: 2 } });
    expect(ctx.config.merge).toEqual({ "4_2": { r: 4, c: 2, rs: 1, cs: 2 } });
    expect(file.dataVerification).toEqual({
      "4_2": { type: "dropdown", value1: "a,b" },
    });
    expect(Object.keys(file.hyperlink)).toEqual(["4_2"]);
    expect(file.luckysheet_conditionformat_save[0].cellrange).toEqual([
      { row: [4, 4], column: [2, 3] },
    ]);
    // the range border was split off the source and re-created as cells
    const cellBorders = ctx.config.borderInfo.filter(
      (b) => b.rangeType === "cell"
    );
    expect(
      cellBorders.map((b) => [b.value.row_index, b.value.col_index])
    ).toEqual([
      [4, 2],
      [4, 3],
    ]);
    expect(
      ctx.config.borderInfo.filter((b) => b.rangeType === "range")
    ).toHaveLength(0);
  });

  test("a move that would cut a merged area is refused", () => {
    const ctx = makeContext();
    activate(ctx, "id_1");
    ctx.config.merge = { "0_0": { r: 0, c: 0, rs: 2, cs: 1 } };
    expect(() =>
      moveCellRange(
        ctx,
        { sheetId: "id_1", range: { row: [0, 0], column: [0, 0] } },
        { sheetId: "id_1", row: 5, column: 5 }
      )
    ).toThrow("partMC");
  });

  test("undo (inverse patches) restores every sheet", () => {
    const ctx = setup();
    activate(ctx, "id_1");
    const before = _.cloneDeep(ctx.luckysheetfile);
    const [next, , inverse] = produceWithPatches(ctx, (draft) => {
      moveCellRange(
        draft,
        { sheetId: "id_1", range: { row: [0, 0], column: [0, 1] } },
        { sheetId: "id_2", row: 3, column: 3 }
      );
    });
    expect(next.luckysheetfile[0].data[1][1].f).toBe("=$A$2+B7");
    expect(next.luckysheetfile[0].data[2][0].f).toBe("=SUM(A1:A2)");
    expect(next.luckysheetfile[0].data[0][0]).toBeNull();
    const undone = applyPatches(next, inverse);
    expect(undone.luckysheetfile).toEqual(before);
  });
});

describe("copy is not a move", () => {
  test("copy + paste leaves references alone", () => {
    const ctx = setup();
    copy(ctx, "A1");
    paste(ctx, "C1");
    expect(cell(ctx, "B1").f).toBe("=A1*2");
    expect(value(ctx, "C1")).toBe(1);
  });
});
