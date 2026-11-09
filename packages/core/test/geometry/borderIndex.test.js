import produce from "immer";
import { makeContext } from "../formula/helpers";
import { getBorderInfoComputeRange } from "../../src/modules/border";
import { Canvas } from "../../src/canvas";
import {
  createSourceMatrix,
  getSourceMatrixStats,
} from "../../src/modules/rowStore";

test("rendering a filtered viewport does not decode the hidden rows between visible rows", () => {
  const ctx = makeContext({ rows: 1, cols: 2 });
  const data = createSourceMatrix(50001, 2, () => ({ v: "value" }));
  ctx.luckysheetfile[0].data = data;
  ctx.config = {
    sourceBorders: true,
    rowhidden: Object.fromEntries(
      Array.from({ length: 49999 }, (_, r) => [r + 1, 0])
    ),
  };
  getBorderInfoComputeRange(ctx, 0, 50000, 0, 1);
  const canvas = new Canvas(document.createElement("canvas"), ctx);
  canvas.getCellOverflowMap(
    document.createElement("canvas").getContext("2d"),
    0,
    1,
    0,
    50000
  );
  expect(getSourceMatrixStats(data).decodedCells).toBe(4);
  expect(getSourceMatrixStats(data).materializedRows).toBeLessThan(5);
});

test("source borders read only the viewport and editor overrides retain priority", () => {
  const ctx = makeContext({ rows: 1, cols: 2 });
  const edge = { style: "1", color: "red" };
  const data = createSourceMatrix(50000, 2, (_r, c) =>
    c === 0 ? { sourceBorder: { l: edge } } : null
  );
  ctx.luckysheetfile[0].data = data;
  ctx.config = { sourceBorders: true };
  const compute = () => getBorderInfoComputeRange(ctx, 8, 12, 0, 1);
  expect(compute()["8_0"].l).toEqual(edge);
  expect(compute()["8_0"].r).toBeNull();
  expect(getSourceMatrixStats(data).decodedCells).toBe(10);
  ctx.config.borderInfo = [
    {
      rangeType: "range",
      borderType: "border-left",
      color: "blue",
      style: "1",
      range: [{ row: [8, 12], column: [0, 1] }],
    },
  ];
  expect(compute()["8_0"].l.color).toBe("blue");
  expect(data[8][0].sourceBorder.l.color).toBe("red");
});

test("indexed cell borders preserve range overrides and invalidate after edits", () => {
  const ctx = makeContext({ rows: 2001, cols: 2 });
  const edge = (color) => ({ color, style: "1" });
  const borders = Array.from({ length: 2000 }, (_, r) => ({
    rangeType: "cell",
    value: { row_index: r, col_index: 0, l: edge("red") },
  }));
  borders.splice(10, 0, {
    rangeType: "range",
    borderType: "border-left",
    color: "blue",
    style: "1",
    range: [{ row: [0, 1999], column: [0, 1] }],
  });
  const compute = (c) => getBorderInfoComputeRange(c, 8, 12, 0, 1);
  ctx.config = { borderInfo: borders };
  const expected = compute(ctx);
  ctx.config.borderInfo = Object.freeze(borders.slice());
  expect(compute(ctx)).toEqual(expected);
  expect(compute(ctx)["8_0"].l.color).toBe("blue");
  expect(compute(ctx)["12_0"].l.color).toBe("red");
  const next = produce(ctx, (draft) => {
    draft.config.borderInfo[13].value.l.color = "green";
  });
  expect(compute(next)["12_0"].l.color).toBe("green");
  expect(compute(ctx)["12_0"].l.color).toBe("red");
  // Public mutable configurations are never cached, including nested edits.
  ctx.config = {
    borderInfo: borders.map((b) =>
      b.rangeType === "cell"
        ? { ...b, value: { ...b.value, l: { ...b.value.l } } }
        : b
    ),
  };
  compute(ctx);
  ctx.config.borderInfo[13].value.l.color = "orange";
  expect(compute(ctx)["12_0"].l.color).toBe("orange");
});
