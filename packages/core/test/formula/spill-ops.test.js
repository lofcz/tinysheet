/**
 * Spills across operations that move or copy cells (Excel behaviour):
 * inserting/deleting rows and columns, sorting, fill, copy/paste, cut/paste
 * and undo/redo. A spill is always re-spilled from where its anchor is after
 * the operation; copies of spilled cells made without their anchor are plain
 * values.
 */
import { enablePatches, produceWithPatches, applyPatches } from "immer";
import { makeContext, input, value, values, cell, parseA1 } from "./helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { groupValuesRefresh } from "../../src/modules/formula";
import { sortSelection } from "../../src/modules/sort";
import { dropCellCache, updateDropCell } from "../../src/modules/dropCell";
import { handleCopy } from "../../src/events/copy";
import { handlePasteByClick } from "../../src/events/paste";
import {
  reconcileSpillsAfterMove,
  getSpillRange,
} from "../../src/modules/spill";

enablePatches();

function seed(ctx) {
  input(ctx, "A1", "1");
  input(ctx, "A2", "2");
  input(ctx, "A3", "3");
  input(ctx, "B1", "10");
  input(ctx, "B2", "20");
  input(ctx, "B3", "30");
}

function select(ctx, from, to = from) {
  const a = parseA1(from);
  const b = parseA1(to);
  ctx.luckysheet_select_save = [
    { row: [a.r, b.r], column: [a.c, b.c], row_focus: a.r, column_focus: a.c },
  ];
}

function insertRows(ctx, index, count = 1) {
  insertRowCol(ctx, {
    type: "row",
    index,
    count,
    direction: "lefttop",
    id: "id_1",
  });
  groupValuesRefresh(ctx);
}

function insertCols(ctx, index, count = 1) {
  insertRowCol(ctx, {
    type: "column",
    index,
    count,
    direction: "lefttop",
    id: "id_1",
  });
  groupValuesRefresh(ctx);
}

/** Every cell of the sheet tagged as spilled, as "A1" strings. */
function spilledCells(ctx, sheetId = "id_1") {
  const { data } = ctx.luckysheetfile.find((s) => s.id === sheetId);
  const out = [];
  data.forEach((row, r) =>
    row.forEach((c, j) => {
      if (c?.spillFrom) out.push(`${String.fromCharCode(65 + j)}${r + 1}`);
    })
  );
  return out;
}

describe("spill after inserting and deleting rows and columns", () => {
  test("inserting rows above moves the anchor and its spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D2", "=A1:A3");
    insertRows(ctx, 0, 2);
    expect(cell(ctx, "D4").f).toBe("=A3:A5");
    expect(values(ctx, "D4", "D6")).toEqual([[1], [2], [3]]);
    expect(cell(ctx, "D4").spill).toEqual({ rs: 3, cs: 1 });
    expect(spilledCells(ctx)).toEqual(["D5", "D6"]);
  });

  test("inserting a row inside the source and the spill re-spills larger", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "=A1:A3");
    insertRows(ctx, 1);
    // A1:A3 became A1:A4 (Excel expands the range) and has an empty cell
    expect(cell(ctx, "C1").f).toBe("=A1:A4");
    expect(values(ctx, "C1", "C4")).toEqual([[1], [0], [2], [3]]);
    expect(cell(ctx, "C1").spill).toEqual({ rs: 4, cs: 1 });
    expect(cell(ctx, "C4").spillFrom).toEqual({ dr: 3, dc: 0 });
  });

  test("inserting a column inside the spill only re-spills it", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:B3");
    insertCols(ctx, 4); // a new column E, between the two spilled columns
    expect(cell(ctx, "D1").f).toBe("=A1:B3");
    expect(values(ctx, "D1", "F3")).toEqual([
      [1, 10, undefined],
      [2, 20, undefined],
      [3, 30, undefined],
    ]);
    expect(spilledCells(ctx)).toEqual(["E1", "D2", "E2", "D3", "E3"]);
  });

  test("a formula reading the spill follows the re-spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "=A1:A3");
    input(ctx, "F1", "=SUM(C1#)");
    expect(value(ctx, "F1")).toBe(6);
    insertRows(ctx, 1);
    input(ctx, "A2", "100");
    expect(values(ctx, "C1", "C4")).toEqual([[1], [100], [2], [3]]);
    expect(value(ctx, "F1")).toBe(106);
  });

  test("deleting the anchor's row removes the whole spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D2", "=A1:B3");
    input(ctx, "G1", "=SUM(E1:E5)");
    expect(value(ctx, "G1")).toBe(60);
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(spilledCells(ctx)).toEqual([]);
    expect(values(ctx, "D1", "E4")).toEqual([
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(value(ctx, "G1")).toBe(0);
  });

  test("deleting a row inside the spill re-spills it", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "=A1:A3");
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "C1").f).toBe("=A1:A2");
    expect(values(ctx, "C1", "C3")).toEqual([[1], [3], [undefined]]);
    expect(spilledCells(ctx)).toEqual(["C2"]);
  });

  test("deleting a column of the spill re-spills it", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "E1", "=A1:B3");
    // delete column D, left of the anchor: everything moves left
    deleteRowCol(ctx, { type: "column", start: 3, end: 3, id: "id_1" });
    groupValuesRefresh(ctx);
    expect(values(ctx, "D1", "E3")).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
    expect(spilledCells(ctx)).toEqual(["E1", "D2", "E2", "D3", "E3"]);
  });

  test("a deletion that unblocks a #SPILL! anchor lets it spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D3", "x");
    input(ctx, "D1", "=A1:A2");
    input(ctx, "D2", "y");
    expect(value(ctx, "D1")).toBe("#SPILL!");
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "id_1" });
    groupValuesRefresh(ctx);
    // the formula lost its second row: a single value now (Excel keeps
    // the collapsed range as A1:A1)
    expect(cell(ctx, "D1").f).toBe("=A1:A1");
    expect(value(ctx, "D1")).toBe(1);
    expect(value(ctx, "D2")).toBe("x");
  });

  test("anchors on another sheet reading the sheet re-spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "A1", "=Sheet1!A1:A3", "id_2");
    insertRows(ctx, 1);
    expect(cell(ctx, "A1", "id_2").f).toBe("=Sheet1!A1:A4");
    expect(values(ctx, "A1", "A4", "id_2")).toEqual([[1], [0], [2], [3]]);
  });
});

describe("spill after sorting", () => {
  test("an anchor sorted to another row spills from there", () => {
    const ctx = makeContext();
    input(ctx, "A1", "3");
    input(ctx, "A2", "1");
    input(ctx, "A3", "2");
    input(ctx, "E1", "5");
    input(ctx, "F1", "6");
    input(ctx, "B2", "=$E$1:$F$1");
    expect(values(ctx, "B2", "C2")).toEqual([[5, 6]]);
    // sort A1:C3 by column A ascending: row 2 (A=1) goes to the top
    select(ctx, "A1", "C3");
    sortSelection(ctx, true, 0);
    groupValuesRefresh(ctx);
    expect(values(ctx, "A1", "A3")).toEqual([[1], [2], [3]]);
    expect(cell(ctx, "B1").f).toBeDefined();
    expect(cell(ctx, "B1").spill).toEqual({ rs: 1, cs: 2 });
    expect(spilledCells(ctx)).toEqual(["C1"]);
    // no stale spilled value is left behind in the old row
    expect(cell(ctx, "C2")).toBeNull();
  });
});

describe("spill after fill", () => {
  function fill(ctx, copyFrom, copyTo, applyFrom, applyTo, direction) {
    const a = parseA1(copyFrom);
    const b = parseA1(copyTo);
    const c = parseA1(applyFrom);
    const d = parseA1(applyTo);
    dropCellCache.copyRange = { row: [a.r, b.r], column: [a.c, b.c] };
    dropCellCache.applyRange = { row: [c.r, d.r], column: [c.c, d.c] };
    dropCellCache.direction = direction;
    dropCellCache.applyType = "1";
    dropCellCache.ctrlKey = false;
    select(ctx, copyFrom, applyTo);
    updateDropCell(ctx);
    groupValuesRefresh(ctx);
  }

  function makeFillContext() {
    const ctx = makeContext();
    ctx.visibledatarow = Array.from({ length: 12 }, (_, i) => (i + 1) * 20);
    ctx.visibledatacolumn = Array.from({ length: 8 }, (_, i) => (i + 1) * 74);
    ctx.luckysheetCellUpdate = [];
    return ctx;
  }

  test("filling an anchor copies the formula, which spills", () => {
    const ctx = makeFillContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    fill(ctx, "D1", "D1", "E1", "E1", "right");
    expect(cell(ctx, "E1").f).toBe("=B1:B3");
    expect(values(ctx, "E1", "E3")).toEqual([[10], [20], [30]]);
    expect(cell(ctx, "E2").spillFrom).toEqual({ dr: 1, dc: 0 });
  });

  test("filling a whole spill range copies only the anchor's formula", () => {
    const ctx = makeFillContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    fill(ctx, "D1", "D3", "E1", "E3", "right");
    expect(cell(ctx, "E1").f).toBe("=B1:B3");
    expect(values(ctx, "E1", "E3")).toEqual([[10], [20], [30]]);
    expect(cell(ctx, "E1").spill).toEqual({ rs: 3, cs: 1 });
  });

  test("filling spilled cells without their anchor fills values", () => {
    const ctx = makeFillContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    fill(ctx, "D2", "D3", "E2", "E3", "right");
    expect(values(ctx, "E2", "E3")).toEqual([[2], [3]]);
    expect(cell(ctx, "E2").spillFrom).toBeUndefined();
    expect(cell(ctx, "E3").spillFrom).toBeUndefined();
    // the original spill is untouched
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [3]]);
  });
});

describe("spill after copy, cut and paste", () => {
  let container;
  beforeAll(() => {
    document.execCommand = jest.fn();
    container = document.createElement("div");
    container.className = "fortune-container";
    document.body.appendChild(container);
  });
  afterAll(() => {
    container.remove();
  });

  function copy(ctx, from, to = from, cut = false) {
    select(ctx, from, to);
    handleCopy(ctx);
    ctx.luckysheet_paste_iscut = cut;
  }

  function paste(ctx, at) {
    select(ctx, at);
    handlePasteByClick(ctx, "", "btn");
    groupValuesRefresh(ctx);
  }

  test("pasting an anchor pastes the formula, which spills", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    copy(ctx, "D1");
    paste(ctx, "E1");
    expect(cell(ctx, "E1").f).toBe("=B1:B3");
    expect(values(ctx, "E1", "E3")).toEqual([[10], [20], [30]]);
    expect(cell(ctx, "E3").spillFrom).toEqual({ dr: 2, dc: 0 });
  });

  test("pasting a whole spill range is the same as pasting its anchor", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A2");
    copy(ctx, "D1", "D2");
    paste(ctx, "E2");
    expect(cell(ctx, "E2").f).toBe("=B2:B3");
    expect(values(ctx, "E2", "E3")).toEqual([[20], [30]]);
    expect(spilledCells(ctx)).toEqual(["D2", "E3"]);
  });

  test("pasting spilled cells pastes values", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    copy(ctx, "D2", "D3");
    paste(ctx, "F5");
    expect(values(ctx, "F5", "F6")).toEqual([[2], [3]]);
    expect(cell(ctx, "F5").spillFrom).toBeUndefined();
    expect(cell(ctx, "F5").f).toBeUndefined();
    // they stay put when the source changes
    input(ctx, "A2", "200");
    expect(value(ctx, "F5")).toBe(2);
    expect(value(ctx, "D2")).toBe(200);
  });

  test("pasting onto a spill range blocks it", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "G1", "hello");
    copy(ctx, "G1");
    paste(ctx, "D3");
    expect(value(ctx, "D1")).toBe("#SPILL!");
    expect(value(ctx, "D3")).toBe("hello");
    expect(spilledCells(ctx)).toEqual([]);
  });

  test("cutting and pasting an anchor moves the spill", () => {
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    input(ctx, "G1", "=SUM(D1:D3)");
    copy(ctx, "D1", "D1", true);
    paste(ctx, "E4");
    // a cut formula keeps its references
    expect(cell(ctx, "E4").f).toBe("=A1:A3");
    expect(values(ctx, "E4", "E6")).toEqual([[1], [2], [3]]);
    expect(values(ctx, "D1", "D3")).toEqual([
      [undefined],
      [undefined],
      [undefined],
    ]);
    expect(spilledCells(ctx)).toEqual(["E5", "E6"]);
  });

  test("moving cells to another sheet re-spills on both sheets", () => {
    // what onCellsMoveEnd and a cross-sheet cut do after moving the data
    const ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    const s1 = ctx.luckysheetfile[0].data;
    const s2 = ctx.luckysheetfile[1].data;
    s2[0][0] = { ...s1[0][3], f: "=Sheet1!A1:A3" };
    s1[0][3] = null;
    reconcileSpillsAfterMove(
      ctx,
      { sheetId: "id_1", range: { row: [0, 0], column: [3, 3] } },
      { sheetId: "id_2", range: { row: [0, 0], column: [0, 0] } }
    );
    expect(values(ctx, "D1", "D3")).toEqual([
      [undefined],
      [undefined],
      [undefined],
    ]);
    expect(values(ctx, "A1", "A3", "id_2")).toEqual([[1], [2], [3]]);
    expect(getSpillRange(ctx, 2, 0, "id_2")).toEqual({
      r: 0,
      c: 0,
      rs: 3,
      cs: 1,
      blocked: false,
    });
  });
});

describe("spill and undo/redo", () => {
  function step(ctx, fn) {
    const [next, patches, inversePatches] = produceWithPatches(ctx, (d) => {
      fn(d);
      groupValuesRefresh(d);
    });
    return { next, patches, inversePatches };
  }

  test("undoing and redoing an insert restores the spill", () => {
    let ctx = makeContext();
    seed(ctx);
    input(ctx, "C1", "=A1:A3");
    const before = JSON.parse(JSON.stringify(ctx.luckysheetfile[0].data));
    const { next, patches, inversePatches } = step(ctx, (d) =>
      insertRowCol(d, {
        type: "row",
        index: 1,
        count: 1,
        direction: "lefttop",
        id: "id_1",
      })
    );
    expect(values(next, "C1", "C4")).toEqual([[1], [0], [2], [3]]);
    ctx = applyPatches(next, inversePatches);
    ctx.formulaCache.formulaCellInfoMap = null;
    expect(ctx.luckysheetfile[0].data).toEqual(before);
    // the restored spill still follows its source
    [ctx] = produceWithPatches(ctx, (d) => {
      input(d, "A3", "33");
    });
    expect(values(ctx, "C1", "C3")).toEqual([[1], [2], [33]]);
    // redo
    ctx = applyPatches(ctx, patches);
    ctx.formulaCache.formulaCellInfoMap = null;
    expect(values(ctx, "C1", "C4")).toEqual([[1], [0], [2], [3]]);
  });

  test("undoing an edit that blocked a spill restores it", () => {
    let ctx = makeContext();
    seed(ctx);
    input(ctx, "D1", "=A1:A3");
    const { next, patches, inversePatches } = step(ctx, (d) =>
      input(d, "D2", "x")
    );
    expect(value(next, "D1")).toBe("#SPILL!");
    ctx = applyPatches(next, inversePatches);
    ctx.formulaCache.updateFormulaCache(
      ctx,
      { patches, inversePatches },
      "undo"
    );
    expect(values(ctx, "D1", "D3")).toEqual([[1], [2], [3]]);
    expect(cell(ctx, "D2").spillFrom).toEqual({ dr: 1, dc: 0 });
    // typing into the restored spill area still blocks it
    [ctx] = produceWithPatches(ctx, (d) => {
      input(d, "D3", "y");
    });
    expect(value(ctx, "D1")).toBe("#SPILL!");
  });
});
