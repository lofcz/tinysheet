import { contextFactory } from "../factories/context";
import { drawDropdownArrow } from "../../src/modules/dataVerification";

function recorder() {
  const calls = [];
  const g = {};
  for (const key of [
    "save",
    "restore",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
  ]) {
    g[key] = (...args) => calls.push([key, ...args]);
  }
  return { g, calls };
}

describe("dropdown arrow on every list cell", () => {
  const rect = { x: 10, y: 20, w: 120, h: 28 };
  const ctxWith = (item) => {
    const ctx = contextFactory();
    ctx.luckysheetfile[0].dataVerification = { "1_1": item };
    return ctx;
  };

  test("draws a chevron at the right edge when the rule asks for it", () => {
    const { g, calls } = recorder();
    drawDropdownArrow(
      ctxWith({ type: "dropdown", value1: "a,b", arrowAlways: true }),
      g,
      1,
      1,
      rect,
      "#888"
    );
    const strokes = calls.filter(([k]) => k === "stroke");
    const moves = calls.filter(([k]) => k === "moveTo");
    expect(strokes).toHaveLength(1);
    expect(moves[0][1]).toBeGreaterThan(rect.x + rect.w - 20);
  });

  test("draws nothing for plain lists, other rules or hidden arrows", () => {
    for (const item of [
      { type: "dropdown", value1: "a,b" },
      {
        type: "dropdown",
        value1: "a,b",
        arrowAlways: true,
        showDropdown: false,
      },
      {
        type: "number",
        type2: "between",
        value1: "1",
        value2: "2",
        arrowAlways: true,
      },
    ]) {
      const { g, calls } = recorder();
      drawDropdownArrow(ctxWith(item), g, 1, 1, rect, "#888");
      expect(calls).toHaveLength(0);
    }
  });
});
