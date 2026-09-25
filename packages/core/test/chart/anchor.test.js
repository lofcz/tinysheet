import { makeContext } from "../formula/helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { insertCells } from "../../src/modules/shiftCells";
import { moveCellRange } from "../../src/modules/moveCells";
import {
  boxToAnchor,
  findChart,
  getChartBox,
  getChartDisplayBox,
  insertChart,
  pasteChart,
  pixelToIndex,
  setChartPlacement,
  updateChart,
} from "../../src/modules/chart";

// Default geometry: rows are 20px (19 + grid line), columns 74px.
function setup(placement) {
  const ctx = makeContext({ rows: 40, cols: 20 });
  const config = {};
  ctx.luckysheetfile[0].config = config;
  ctx.config = config;
  ctx.currentSheetId = "id_1";
  // geometry from the config (no laid-out rows)
  ctx.visibledatarow = [];
  ctx.visibledatacolumn = [];
  // B3 + (10, 5) .. E8 + (0, 0)
  const chart = insertChart(ctx, {
    type: "column",
    range: { sheetId: "id_1", row: [0, 0], column: [0, 0] },
    left: 74 + 10,
    top: 40 + 5,
    width: 3 * 74 - 10,
    height: 5 * 20 - 5,
  });
  if (placement) setChartPlacement(ctx, chart.id, placement);
  const box = () => getChartDisplayBox(ctx, chart.id);
  const get = () => findChart(ctx, chart.id).chart;
  return { ctx, chart: get(), box, get, config: ctx.config };
}

describe("chart anchors", () => {
  test("pixels map to cells and offsets (hidden lines are skipped)", () => {
    const { ctx, config } = setup();
    expect(pixelToIndex(ctx, "id_1", "row", 45)).toEqual({
      index: 2,
      offset: 5,
    });
    config.rowhidden = { 2: 0 };
    expect(pixelToIndex(ctx, "id_1", "row", 45).index).toBe(3);
    const a = boxToAnchor(ctx, "id_1", {
      left: 84,
      top: 0,
      width: 64,
      height: 20,
    });
    expect(a.from).toEqual({ row: 0, col: 1, rowOff: 0, colOff: 10 });
    expect(a.to).toEqual({ row: 1, col: 2, rowOff: 0, colOff: 0 });
  });

  test("inserted charts are anchored and keep their box", () => {
    const { chart, box } = setup();
    expect(chart.anchor.from).toEqual({
      row: 2,
      col: 1,
      rowOff: 5,
      colOff: 10,
    });
    expect(chart.anchor.to).toEqual({ row: 7, col: 4, rowOff: 0, colOff: 0 });
    expect(box()).toEqual({ left: 84, top: 45, width: 212, height: 95 });
  });

  test("move and size with cells: resize, hide and unhide", () => {
    const { box, config } = setup();
    config.rowlen = { 4: 39 }; // row 5 is 20px taller
    expect(box()).toMatchObject({ top: 45, height: 115 });
    config.rowlen = { 1: 39 }; // a row above: the chart moves down
    expect(box()).toMatchObject({ top: 65, height: 95 });
    config.rowlen = {};
    config.colhidden = { 2: 0, 3: 0 };
    expect(box()).toMatchObject({ left: 84, width: 64 });
    // every row of the chart hidden: zero height
    config.rowhidden = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    expect(box().height).toBe(0);
    config.rowhidden = {};
    config.colhidden = {};
    expect(box()).toEqual({ left: 84, top: 45, width: 212, height: 95 });
  });

  test("move but don't size: only the position follows", () => {
    const { box, config } = setup("oneCell");
    config.rowlen = { 4: 39, 0: 39 };
    expect(box()).toEqual({ left: 84, top: 65, width: 212, height: 95 });
  });

  test("don't move or size: nothing follows", () => {
    const { ctx, box, config, get } = setup("absolute");
    config.rowlen = { 0: 39 };
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 3,
      direction: "lefttop",
      id: "id_1",
    });
    expect(box()).toEqual({ left: 84, top: 45, width: 212, height: 95 });
    expect(get().placement).toBe("absolute");
  });

  test("inserting and deleting rows moves, grows and shrinks the chart", () => {
    const { ctx, box, get } = setup();
    // above the chart: moves down
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(get().anchor.from.row).toBe(4);
    expect(box()).toMatchObject({ top: 85, height: 95 });
    expect(get().top).toBe(85);
    // inside the chart: grows
    insertRowCol(ctx, {
      type: "row",
      index: 6,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(box()).toMatchObject({ top: 85, height: 115 });
    expect(get().height).toBe(115);
    // right below the chart's bottom edge: no change
    insertRowCol(ctx, {
      type: "row",
      index: 10,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(box()).toMatchObject({ top: 85, height: 115 });
    // columns inside shrink it
    deleteRowCol(ctx, { type: "column", start: 2, end: 3, id: "id_1" });
    expect(box()).toMatchObject({ left: 84, width: 64 });
    expect(get().width).toBe(64);
    // deleting the start row moves the top to the deletion line
    deleteRowCol(ctx, { type: "row", start: 3, end: 4, id: "id_1" });
    expect(get().anchor.from).toMatchObject({ row: 3, rowOff: 0 });
    expect(box()).toMatchObject({ top: 60 });
  });

  test("cell shifts and cut/paste carry charts whose cells all move", () => {
    const { ctx, box, get } = setup();
    // a shift over every column of the chart moves it
    insertCells(ctx, { row: [0, 0], column: [0, 5] }, "down");
    expect(box()).toMatchObject({ top: 65, left: 84 });
    // a shift over only part of its columns does not
    insertCells(ctx, { row: [0, 0], column: [2, 2] }, "down");
    expect(box()).toMatchObject({ top: 65 });
    // cutting the block under the chart and pasting it elsewhere
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [0, 12], column: [0, 6] } },
      { sheetId: "id_1", row: 20, column: 2 }
    );
    expect(get().anchor.from).toMatchObject({ row: 23, col: 3 });
    expect(box()).toMatchObject({ top: 465, left: 232 });
    // to another sheet: the chart moves there
    moveCellRange(
      ctx,
      { sheetId: "id_1", range: { row: [20, 35], column: [2, 10] } },
      { sheetId: "id_2", row: 0, column: 0 }
    );
    expect(ctx.luckysheetfile[0].charts).toHaveLength(0);
    expect(ctx.luckysheetfile[1].charts).toHaveLength(1);
    expect(ctx.luckysheetfile[1].charts[0].anchor.from).toMatchObject({
      row: 3,
      col: 1,
    });
  });

  test("moving, resizing and pasting re-anchor the chart", () => {
    const { ctx, get } = setup();
    updateChart(ctx, get().id, { left: 0, top: 0 });
    expect(get().anchor.from).toEqual({
      row: 0,
      col: 0,
      rowOff: 0,
      colOff: 0,
    });
    expect(get().anchor.to).toMatchObject({ row: 4, col: 2 });
    const copy = pasteChart(ctx, get(), { left: 148, top: 20 });
    expect(copy.anchor.from).toMatchObject({ row: 1, col: 2 });
    // legacy charts without an anchor use their stored box
    const legacy = { ...get(), anchor: undefined };
    expect(getChartBox(ctx, "id_1", legacy)).toEqual({
      left: legacy.left,
      top: legacy.top,
      width: legacy.width,
      height: legacy.height,
    });
  });
});
