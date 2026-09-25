import { sortSelection, drawArrow, insertCells } from "../../src";
import { contextFactory } from "../factories/context";

const note = (value) => ({
  left: null,
  top: null,
  width: null,
  height: null,
  value,
  isShow: false,
});

describe("notes", () => {
  it("stay with their cells when the range is sorted", () => {
    const ctx = contextFactory({
      luckysheet_select_save: [{ row: [0, 2], column: [0, 1] }],
    });
    const d = ctx.luckysheetfile[0].data;
    d[0][0] = { v: 3, m: "3", ct: { t: "n" }, ps: note("three") };
    d[1][0] = { v: 1, m: "1", ct: { t: "n" } };
    d[2][0] = { v: 2, m: "2", ct: { t: "n" } };
    d[1][1] = { v: "b", ps: note("next to one") };
    sortSelection(ctx, true);
    expect(d[0][0].v).toBe(1);
    expect(d[0][1].ps.value).toBe("next to one");
    expect(d[2][0].v).toBe(3);
    expect(d[2][0].ps.value).toBe("three");
  });

  it("move with their cells on Insert > Shift cells down", () => {
    const ctx = contextFactory();
    const d = ctx.luckysheetfile[0].data;
    d[0][2] = { v: "x", ps: note("hello") };
    insertCells(ctx, { row: [0, 0], column: [2, 2] }, "down");
    expect(d[0][2]).toBeNull();
    expect(d[1][2].ps.value).toBe("hello");
  });

  it("draws the connector arrow in the theme's note colour", () => {
    const host = document.createElement("div");
    const canvas = document.createElement("canvas");
    canvas.id = "arrowCanvas-0_0";
    // inherited from the workbook container in browsers; jsdom does not
    // cascade custom properties, so set it on the canvas itself
    canvas.style.setProperty("--fortune-note-arrow", "#123456");
    host.appendChild(canvas);
    document.body.appendChild(host);
    const size = {
      left: 0,
      top: 0,
      width: 30,
      height: 30,
      fromX: 5,
      fromY: 5,
      toX: 25,
      toY: 25,
    };
    const ctx2d = canvas.getContext("2d");
    const strokes = [];
    const orig = ctx2d.stroke.bind(ctx2d);
    ctx2d.stroke = (...args) => {
      strokes.push(ctx2d.strokeStyle);
      return orig(...args);
    };
    drawArrow("0_0", size);
    drawArrow("0_0", size, "#ff0000");
    expect(strokes).toEqual(["#123456", "#ff0000"]);
    // a missing canvas is ignored
    expect(() => drawArrow("9_9", size)).not.toThrow();
    host.remove();
  });
});
