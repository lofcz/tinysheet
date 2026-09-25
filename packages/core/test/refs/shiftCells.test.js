import { makeContext, input, cell, value, values } from "../formula/helpers";
import { insertCells, deleteCells } from "../../src/modules/shiftCells";
import { groupValuesRefresh } from "../../src/modules/formula";

// Excel: Insert > "Shift cells down/right" and Delete > "Shift cells
// up/left" move only the cells in the band of the selection; references to
// moved cells follow them and references to deleted cells become #REF!.

const B2C3 = { row: [1, 2], column: [1, 2] };

function setup() {
  const ctx = makeContext();
  ctx.luckysheetfile[0].config = {};
  ctx.config = ctx.luckysheetfile[0].config;
  input(ctx, "B2", "1");
  input(ctx, "B4", "4");
  input(ctx, "C4", "5");
  input(ctx, "A4", "7");
  input(ctx, "D4", "8");
  input(ctx, "F1", "=B4+C4+A4+D4");
  input(ctx, "F2", "=SUM(B1:B6)");
  input(ctx, "F3", "=B2*10");
  return ctx;
}

describe("insert cells", () => {
  test("shift down moves only the band and rewrites references", () => {
    const ctx = setup();
    insertCells(ctx, B2C3, "down");
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B2")).toBeNull();
    expect(value(ctx, "B4")).toBe(1);
    expect(value(ctx, "B6")).toBe(4);
    expect(value(ctx, "C6")).toBe(5);
    expect(value(ctx, "A4")).toBe(7);
    expect(value(ctx, "D4")).toBe(8);
    expect(cell(ctx, "F1").f).toBe("=B6+C6+A4+D4");
    expect(cell(ctx, "F2").f).toBe("=SUM(B1:B8)");
    expect(cell(ctx, "F3").f).toBe("=B4*10");
    expect(value(ctx, "F1")).toBe(24);
    expect(value(ctx, "F3")).toBe(10);
  });

  test("shift right moves only the rows of the range", () => {
    const ctx = setup();
    input(ctx, "C2", "2");
    insertCells(ctx, { row: [1, 1], column: [1, 1] }, "right");
    groupValuesRefresh(ctx);
    expect(values(ctx, "B2", "D2")).toEqual([[undefined, 1, 2]]);
    // F3 is not in row 2: it stays where it is, its reference moves
    expect(cell(ctx, "F3").f).toBe("=C2*10");
    expect(value(ctx, "F3")).toBe(10);
    // F2 is in row 2 and shifts right to G2
    expect(cell(ctx, "G2").f).toBe("=SUM(B1:B6)");
  });

  test("the grid grows when cells would be pushed off", () => {
    const ctx = makeContext({ rows: 4, cols: 4 });
    input(ctx, "A4", "x");
    insertCells(ctx, { row: [0, 1], column: [0, 0] }, "down");
    expect(ctx.luckysheetfile[0].data.length).toBeGreaterThanOrEqual(6);
    expect(value(ctx, "A6")).toBe("x");
  });

  test("data validation, links, merges and CF ranges follow", () => {
    const ctx = setup();
    const file = ctx.luckysheetfile[0];
    file.dataVerification = { "3_1": { type: "dropdown", value1: "a,b" } };
    file.hyperlink = { "3_2": { linkType: "webpage", linkAddress: "x" } };
    file.luckysheet_conditionformat_save = [
      { type: "default", cellrange: [{ row: [3, 4], column: [1, 2] }] },
    ];
    ctx.config.merge = { "4_1": { r: 4, c: 1, rs: 2, cs: 2 } };
    insertCells(ctx, B2C3, "down");
    expect(Object.keys(file.dataVerification)).toEqual(["5_1"]);
    expect(Object.keys(file.hyperlink)).toEqual(["5_2"]);
    expect(file.luckysheet_conditionformat_save[0].cellrange).toEqual([
      { row: [5, 6], column: [1, 2] },
    ]);
    expect(ctx.config.merge).toEqual({ "6_1": { r: 6, c: 1, rs: 2, cs: 2 } });
  });

  test("a merge straddling the band blocks the shift", () => {
    const ctx = setup();
    ctx.config.merge = { "5_0": { r: 5, c: 0, rs: 1, cs: 2 } };
    expect(() => insertCells(ctx, B2C3, "down")).toThrow("partMC");
  });
});

describe("delete cells", () => {
  test("shift up: deleted references become #REF!, ranges shrink", () => {
    const ctx = setup();
    deleteCells(ctx, B2C3, "up");
    groupValuesRefresh(ctx);
    expect(value(ctx, "B2")).toBe(4);
    expect(value(ctx, "C2")).toBe(5);
    expect(cell(ctx, "B4")).toBeNull();
    expect(value(ctx, "A4")).toBe(7);
    expect(cell(ctx, "F1").f).toBe("=B2+C2+A4+D4");
    expect(cell(ctx, "F2").f).toBe("=SUM(B1:B4)");
    expect(cell(ctx, "F3").f).toBe("=#REF!*10");
    expect(value(ctx, "F3")).toBe("#REF!");
    expect(value(ctx, "F1")).toBe(24);
  });

  test("shift left", () => {
    const ctx = setup();
    input(ctx, "E4", "=D4*2");
    deleteCells(ctx, { row: [3, 3], column: [0, 1] }, "left");
    groupValuesRefresh(ctx);
    expect(values(ctx, "A4", "C4")).toEqual([[5, 8, 16]]);
    expect(cell(ctx, "C4").f).toBe("=B4*2");
    expect(cell(ctx, "F1").f).toBe("=#REF!+A4+#REF!+B4");
  });

  test("deleted formula cells leave the calc chain", () => {
    const ctx = setup();
    deleteCells(ctx, { row: [0, 2], column: [5, 5] }, "up");
    const chain = ctx.luckysheetfile[0].calcChain || [];
    expect(chain.some((c) => c.c === 5 && c.r <= 2)).toBe(false);
  });
});
