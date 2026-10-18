import "../../src";
import { Canvas } from "../../src/canvas";
import { contextFactory, selectionFactory } from "../factories/context";
import { HIDDEN_HEADER_SIZE } from "../../src/modules/viewOptions";

// With the headings hidden the header strips are 2 px wide; the 2 px accent
// edge of the selected header would then paint over the first row/column.
describe("selected-header accent with hidden headings", () => {
  const setup = (size) => {
    const ctx = contextFactory({
      luckysheet_select_save: selectionFactory([0, 0], [0, 0], 0, 0),
      luckysheetfile: [
        {
          id: "id_1",
          data: [
            [{ v: 1 }, null],
            [null, null],
          ],
        },
      ],
    });
    ctx.rowHeaderWidth = size;
    ctx.columnHeaderHeight = size;
    const canvas = new Canvas(document.createElement("canvas"), ctx);
    const g = canvas.canvasElement.getContext("2d");
    const accentRects = [];
    const fillRect = g.fillRect.bind(g);
    g.fillRect = (...args) => {
      if (String(g.fillStyle).toLowerCase() === "#2563eb")
        accentRects.push(args);
      return fillRect(...args);
    };
    return { canvas, accentRects };
  };

  test("draws no accent edge when the headings are hidden", () => {
    const { canvas, accentRects } = setup(HIDDEN_HEADER_SIZE);
    canvas.drawRowHeader(0, 40, HIDDEN_HEADER_SIZE);
    canvas.drawColumnHeader(0, 200, HIDDEN_HEADER_SIZE);
    expect(accentRects).toHaveLength(0);
  });

  test("keeps the accent edge on visible headings", () => {
    const { canvas, accentRects } = setup(46);
    canvas.drawRowHeader(0, 40, 20);
    canvas.drawColumnHeader(0, 200, 46);
    expect(accentRects.length).toBeGreaterThan(0);
  });
});
