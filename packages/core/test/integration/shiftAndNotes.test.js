import { makeContext, cell } from "../formula/helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { insertCells, deleteCells } from "../../src/modules/shiftCells";
import { moveCellRange } from "../../src/modules/moveCells";

// Insert/Delete cells with a shift keep cell-keyed data in step, like row
// and column operations do; note boxes follow their cells for every
// structural change.

const note = (value, left = null, top = null) => ({
  left,
  top,
  width: null,
  height: null,
  value,
  isShow: left != null,
});

describe("insert/delete cells: cell-keyed data", () => {
  function setup() {
    const ctx = makeContext({ rows: 12, cols: 8 });
    const sheet = ctx.luckysheetfile[0];
    sheet.luckysheet_conditionformat_save = [
      { type: "default", cellrange: [{ row: [0, 5], column: [0, 3] }] },
      { type: "default", cellrange: [{ row: [0, 1], column: [0, 3] }] },
    ];
    sheet.luckysheet_alternateformat_save = [
      { cellrange: { row: [0, 5], column: [0, 1] } },
    ];
    sheet.filter_select = { row: [0, 5], column: [0, 1] };
    sheet.filter = {
      1: {
        cindex: 1,
        stc: 0,
        edc: 1,
        str: 0,
        edr: 5,
        rowhidden: { 4: 0 },
        optionstate: true,
        caljs: {},
      },
    };
    sheet.dataVerification = {
      "4_0": { type: "number", value1: "1" },
      "0_3": { type: "number", value1: "2" },
    };
    const mc = { r: 4, c: 0, rs: 1, cs: 2 };
    ctx.config = { merge: { "4_0": mc } };
    sheet.config = ctx.config;
    sheet.data[4][0] = { v: "m", mc };
    sheet.data[4][1] = { mc: { r: 4, c: 0 } };
    return { ctx, sheet };
  }

  test("Insert > Shift cells down", () => {
    const { ctx, sheet } = setup();
    insertCells(ctx, { row: [2, 3], column: [0, 1] }, "down");
    // the applies-to range is split: only the part in the band moves
    expect(sheet.luckysheet_conditionformat_save[0].cellrange).toEqual([
      { row: [0, 7], column: [0, 1] },
      { row: [0, 5], column: [2, 3] },
    ]);
    // a range above the inserted cells is not split
    expect(sheet.luckysheet_conditionformat_save[1].cellrange).toEqual([
      { row: [0, 1], column: [0, 3] },
    ]);
    expect(sheet.luckysheet_alternateformat_save[0].cellrange).toEqual({
      row: [0, 7],
      column: [0, 1],
    });
    expect(sheet.filter_select).toEqual({ row: [0, 7], column: [0, 1] });
    expect(sheet.filter[1]).toMatchObject({
      cindex: 1,
      str: 0,
      edr: 7,
      rowhidden: { 6: 0 },
    });
    expect(ctx.luckysheet_filter_save).toEqual(sheet.filter_select);
    expect(Object.keys(sheet.dataVerification).sort()).toEqual(["0_3", "6_0"]);
    expect(ctx.config.merge).toEqual({
      "6_0": { r: 6, c: 0, rs: 1, cs: 2 },
    });
    expect(sheet.data[6][0].v).toBe("m");
    expect(sheet.data[6][1].mc).toEqual({ r: 6, c: 0 });
  });

  test("Delete > Shift cells up removes what was deleted", () => {
    const { ctx, sheet } = setup();
    deleteCells(ctx, { row: [4, 4], column: [0, 1] }, "up");
    expect(sheet.dataVerification["4_0"]).toBeUndefined();
    expect(ctx.config.merge).toEqual({});
    expect(sheet.filter_select).toEqual({ row: [0, 4], column: [0, 1] });
    // the hidden row was the deleted one
    expect(sheet.filter[1].rowhidden).toEqual({});
    expect(sheet.luckysheet_conditionformat_save[0].cellrange).toEqual([
      { row: [0, 4], column: [0, 1] },
      { row: [0, 5], column: [2, 3] },
    ]);
  });

  test("deleting every cell of the filter range removes the filter", () => {
    const { ctx, sheet } = setup();
    deleteCells(ctx, { row: [0, 5], column: [0, 1] }, "up");
    expect(sheet.filter_select).toBeUndefined();
    expect(sheet.filter).toBeUndefined();
    expect(sheet.luckysheet_alternateformat_save).toEqual([]);
  });

  test("Delete > Shift cells left moves keys and ranges along the row", () => {
    const { ctx, sheet } = setup();
    deleteCells(ctx, { row: [0, 0], column: [1, 1] }, "left");
    expect(sheet.dataVerification["0_2"]).toEqual({
      type: "number",
      value1: "2",
    });
    // the CF range spans more rows than the band: only row 0 shifts
    expect(sheet.luckysheet_conditionformat_save[0].cellrange).toEqual([
      { row: [0, 0], column: [0, 2] },
      { row: [1, 5], column: [0, 3] },
    ]);
  });
});

describe("notes follow their cells", () => {
  // default geometry: rows are 20px, columns 74px (grid line included)
  function setup() {
    const ctx = makeContext({ rows: 12, cols: 8 });
    const d = ctx.luckysheetfile[0].data;
    d[2][1] = { v: "x", ps: note("placed", 300, 30) };
    d[2][3] = { v: "y", ps: note("auto") };
    return { ctx, d };
  }

  test("inserting and deleting rows and columns moves placed notes once", () => {
    const { ctx } = setup();
    const ps = () => cell(ctx, "B3").ps;
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cell(ctx, "B5").ps).toMatchObject({ left: 300, top: 70 });
    deleteRowCol(ctx, { type: "row", start: 0, end: 1, id: "id_1" });
    expect(ps()).toMatchObject({ value: "placed", left: 300, top: 30 });
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cell(ctx, "C3").ps).toMatchObject({ left: 374, top: 30 });
    deleteRowCol(ctx, { type: "column", start: 0, end: 0, id: "id_1" });
    expect(ps()).toMatchObject({ left: 300, top: 30 });
    // a row inserted below the note does not move it
    insertRowCol(ctx, {
      type: "row",
      index: 5,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(ps()).toMatchObject({ left: 300, top: 30 });
    // notes without a placed box keep following their cell by themselves
    expect(cell(ctx, "D3").ps).toMatchObject({ value: "auto", left: null });
  });

  test("Insert > Shift cells down moves the note with its cell", () => {
    const { ctx } = setup();
    insertCells(ctx, { row: [0, 1], column: [1, 1] }, "down");
    expect(cell(ctx, "B3")).toBeNull();
    expect(cell(ctx, "B5").ps).toMatchObject({ value: "placed", top: 70 });
    // column D was not shifted
    expect(cell(ctx, "D3").ps.value).toBe("auto");
  });

  test("Delete > Shift cells left moves the note with its cell", () => {
    const { ctx } = setup();
    deleteCells(ctx, { row: [2, 2], column: [0, 0] }, "left");
    expect(cell(ctx, "A3").ps).toMatchObject({ value: "placed", left: 226 });
  });

  test("cut/paste carries notes and moves placed boxes", () => {
    const { ctx } = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [2, 2], column: [1, 1] } },
      { sheetId: "id_1", row: 5, column: 3 }
    );
    expect(cell(ctx, "B3")).toBeNull();
    // two columns right (148px), three rows down (60px)
    expect(cell(ctx, "D6").ps).toMatchObject({
      value: "placed",
      left: 448,
      top: 90,
    });
  });

  test("cut/paste to another sheet carries the note", () => {
    const { ctx } = setup();
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [2, 3], column: [1, 3] } },
      { sheetId: "id_2", row: 0, column: 0 }
    );
    expect(cell(ctx, "B3")).toBeNull();
    expect(cell(ctx, "A1", "id_2").ps).toMatchObject({
      value: "placed",
      left: 226,
      top: -10,
    });
    expect(cell(ctx, "C1", "id_2").ps.value).toBe("auto");
  });
});
