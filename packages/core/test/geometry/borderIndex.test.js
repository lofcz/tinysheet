import produce from "immer";
import { makeContext } from "../formula/helpers";
import { getBorderInfoComputeRange } from "../../src/modules/border";

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
