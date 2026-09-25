/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect", "expectClose"] }] */
import { produce } from "immer";
import { makeContext, put, column, rules, cf, range } from "./helpers";
import {
  makeDataBar,
  makeIconSet,
  colorScaleFromPreset,
  CF_COLOR_SCALE_PRESETS,
  CF_ICON_SET_NAMES,
  CF_ICON_SETS,
  defaultIconThresholds,
  getCFComputeMap,
  normalizeRule,
  mixCFColors,
  dataBarGeometry,
  cfTextCell,
  drawCFDecorations,
} from "../../src/modules/ConditionFormat";

function bar(ctx, a1) {
  return cf(ctx, a1)?.dataBar;
}

function expectClose(obj, expected) {
  Object.keys(expected).forEach((k) => {
    if (typeof expected[k] === "number") {
      expect(obj[k]).toBeCloseTo(expected[k], 6);
    } else {
      expect(obj[k]).toEqual(expected[k]);
    }
  });
}

describe("data bars (T20)", () => {
  test("automatic min/max: 0 .. highest value for positive data", () => {
    const ctx = makeContext();
    column(ctx, "A1", [0, 25, 50, 100, "x"]);
    rules(ctx, [
      {
        type: "dataBar",
        cellrange: range("A1:A5"),
        dataBar: makeDataBar("#638EC6", true),
      },
    ]);
    expectClose(bar(ctx, "A1"), { start: 0, end: 0, axis: null });
    expectClose(bar(ctx, "A2"), { start: 0, end: 0.25 });
    expectClose(bar(ctx, "A4"), {
      start: 0,
      end: 1,
      color: "#638EC6",
      gradient: true,
    });
    expect(bar(ctx, "A4").borderColor).toBe("#638EC6");
    expect(bar(ctx, "A5")).toBeUndefined();
  });

  test("lowest / highest value, number, percent, percentile and formula", () => {
    const ctx = makeContext();
    column(ctx, "A1", [10, 20, 30, 40, 50]);
    put(ctx, "C1", 45);
    const make = (min, max) => [
      {
        type: "dataBar",
        cellrange: range("A1:A5"),
        dataBar: makeDataBar("#63C384", false, { min, max }),
      },
    ];
    rules(ctx, make({ type: "min" }, { type: "max" }));
    expectClose(bar(ctx, "A1"), { end: 0 });
    expectClose(bar(ctx, "A3"), { end: 0.5 });
    rules(ctx, make({ type: "num", value: 20 }, { type: "num", value: 40 }));
    expectClose(bar(ctx, "A1"), { end: 0 });
    expectClose(bar(ctx, "A2"), { end: 0 });
    expectClose(bar(ctx, "A3"), { end: 0.5 });
    expectClose(bar(ctx, "A5"), { end: 1 });
    // percent of the span 10..50
    rules(
      ctx,
      make({ type: "percent", value: 25 }, { type: "percent", value: 75 })
    );
    expectClose(bar(ctx, "A3"), { end: 0.5 });
    expectClose(bar(ctx, "A2"), { end: 0 });
    // PERCENTILE.INC(10..50, 0.25) = 20, 0.75 = 40
    rules(
      ctx,
      make({ type: "percentile", value: 25 }, { type: "percentile", value: 75 })
    );
    expectClose(bar(ctx, "A4"), { end: 1 });
    expectClose(bar(ctx, "A3"), { end: 0.5 });
    rules(
      ctx,
      make(
        { type: "formula", value: "=MIN(A1:A5)" },
        { type: "formula", value: "=$C$1" }
      )
    );
    expectClose(bar(ctx, "A2"), { end: 10 / 35 });
    expect(bar(ctx, "A1").gradient).toBe(false);
    expect(bar(ctx, "A1").borderColor).toBeNull();
  });

  test("negative values: automatic axis, negative colour, midpoint", () => {
    const ctx = makeContext();
    column(ctx, "A1", [-50, 0, 50, 150]);
    const db = makeDataBar("#638EC6", true);
    rules(ctx, [{ type: "dataBar", cellrange: range("A1:A4"), dataBar: db }]);
    // axis at 50 / (150 + 50) = 0.25 of the width
    expectClose(bar(ctx, "A1"), {
      start: 0,
      end: 0.25,
      axis: 0.25,
      color: "#FF0000",
      solidSide: "right",
    });
    expectClose(bar(ctx, "A2"), { start: 0.25, end: 0.25 });
    expectClose(bar(ctx, "A3"), { start: 0.25, end: 0.5, solidSide: "left" });
    expectClose(bar(ctx, "A4"), { start: 0.25, end: 1, color: "#638EC6" });

    rules(ctx, [
      {
        type: "dataBar",
        cellrange: range("A1:A4"),
        dataBar: { ...db, axisPosition: "midpoint", sameNegativeColor: true },
      },
    ]);
    expectClose(bar(ctx, "A1"), {
      start: 0,
      end: 0.5,
      axis: 0.5,
      color: "#638EC6",
    });
    expectClose(bar(ctx, "A3"), { start: 0.5, end: 0.5 + 0.5 / 3 });

    rules(ctx, [
      {
        type: "dataBar",
        cellrange: range("A1:A4"),
        dataBar: {
          ...db,
          axisPosition: "none",
          min: { type: "min" },
          max: { type: "max" },
        },
      },
    ]);
    expectClose(bar(ctx, "A1"), { start: 0, end: 0, axis: null });
    expectClose(bar(ctx, "A3"), { start: 0, end: 0.5 });
  });

  test("all-negative data grows leftwards from the right edge", () => {
    const g = dataBarGeometry(-5, -10, 0, makeDataBar("#000", false));
    expectClose(g, { start: 0.5, end: 1, axis: 1 });
  });

  test("right-to-left direction mirrors the bar", () => {
    const g = dataBarGeometry(
      25,
      0,
      100,
      makeDataBar("#000", true, { direction: "rightToLeft" })
    );
    expectClose(g, { start: 0.75, end: 1, axis: null, solidSide: "right" });
  });

  test("minimum and maximum bar length", () => {
    const g = dataBarGeometry(
      0,
      0,
      100,
      makeDataBar("#000", true, { minLength: 10, maxLength: 90 })
    );
    expectClose(g, { end: 0.1 });
    const h = dataBarGeometry(
      100,
      0,
      100,
      makeDataBar("#000", true, { minLength: 10, maxLength: 90 })
    );
    expectClose(h, { end: 0.9 });
  });

  test("show bar only hides the value", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2]);
    rules(ctx, [
      {
        type: "dataBar",
        cellrange: range("A1:A2"),
        dataBar: makeDataBar("#638EC6", false, { showValue: false }),
      },
    ]);
    expect(cf(ctx, "A1").hideValue).toBe(true);
    const cell = ctx.luckysheetfile[0].data[0][0];
    expect(cfTextCell(cell, cf(ctx, "A1")).m).toBe("");
  });

  test("legacy data bars (colour arrays) are converted", () => {
    const rule = normalizeRule({
      type: "dataBar",
      cellrange: [],
      format: ["#FF0000", "#FFFFFF"],
    });
    expect(rule.dataBar).toMatchObject({ color: "#FF0000", gradient: true });
    const solid = normalizeRule({
      type: "dataBar",
      cellrange: [],
      format: ["#00FF00"],
    });
    expect(solid.dataBar.gradient).toBe(false);
  });
});

describe("colour scales (T21)", () => {
  test("two-colour scale interpolates linearly between min and max", () => {
    const ctx = makeContext();
    column(ctx, "A1", [0, 50, 100, "x"]);
    rules(ctx, [
      {
        type: "colorGradation",
        cellrange: range("A1:A4"),
        colorScale: {
          stops: [
            { type: "min", color: "#000000" },
            { type: "max", color: "#FFFFFF" },
          ],
        },
      },
    ]);
    expect(cf(ctx, "A1").cellColor).toBe("#000000");
    expect(cf(ctx, "A2").cellColor).toBe("#808080");
    expect(cf(ctx, "A3").cellColor).toBe("#FFFFFF");
    expect(cf(ctx, "A4")).toBeNull();
  });

  test("three-colour scale with the 50th percentile as midpoint", () => {
    const ctx = makeContext();
    // median 10: values below use the min..mid segment
    column(ctx, "A1", [0, 5, 10, 55, 100]);
    rules(ctx, [
      {
        type: "colorGradation",
        cellrange: range("A1:A5"),
        colorScale: { stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]) },
      },
    ]);
    expect(cf(ctx, "A1").cellColor).toBe("#F8696B");
    expect(cf(ctx, "A2").cellColor).toBe(
      mixCFColors("#F8696B", "#FFEB84", 0.5)
    );
    expect(cf(ctx, "A3").cellColor).toBe("#FFEB84");
    expect(cf(ctx, "A4").cellColor).toBe(
      mixCFColors("#FFEB84", "#63BE7B", 0.5)
    );
    expect(cf(ctx, "A5").cellColor).toBe("#63BE7B");
  });

  test("number, percent and formula stops clamp outside values", () => {
    const ctx = makeContext();
    column(ctx, "A1", [0, 20, 40, 60, 100]);
    put(ctx, "C1", 60);
    rules(ctx, [
      {
        type: "colorGradation",
        cellrange: range("A1:A5"),
        colorScale: {
          stops: [
            { type: "num", value: 20, color: "#000000" },
            { type: "percent", value: 40, color: "#FF0000" },
            { type: "formula", value: "=$C$1", color: "#FFFFFF" },
          ],
        },
      },
    ]);
    expect(cf(ctx, "A1").cellColor).toBe("#000000");
    expect(cf(ctx, "A2").cellColor).toBe("#000000");
    expect(cf(ctx, "A3").cellColor).toBe("#FF0000");
    expect(cf(ctx, "A4").cellColor).toBe("#FFFFFF");
    expect(cf(ctx, "A5").cellColor).toBe("#FFFFFF");
  });

  test("legacy colour arrays are [top, (middle), bottom]", () => {
    const rule = normalizeRule({
      type: "colorGradation",
      cellrange: [],
      format: ["rgb(99, 190, 123)", "rgb(248, 105, 107)"],
    });
    expect(rule.colorScale.stops).toEqual([
      { type: "min", color: "rgb(248, 105, 107)" },
      { type: "max", color: "rgb(99, 190, 123)" },
    ]);
    expect(mixCFColors("rgb(0, 0, 0)", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("icon sets (T22)", () => {
  test("every set has 3, 4 or 5 icons and default thresholds", () => {
    expect(CF_ICON_SET_NAMES).toHaveLength(20);
    CF_ICON_SET_NAMES.forEach((name) => {
      const n = CF_ICON_SETS[name].length;
      expect([3, 4, 5]).toContain(n);
      expect(makeIconSet(name).thresholds).toHaveLength(n - 1);
    });
    expect(defaultIconThresholds(3).map((t) => t.value)).toEqual([33, 67]);
    expect(defaultIconThresholds(4).map((t) => t.value)).toEqual([25, 50, 75]);
    expect(defaultIconThresholds(5).map((t) => t.value)).toEqual([
      20, 40, 60, 80,
    ]);
  });

  test("percent thresholds with >= pick the icon", () => {
    const ctx = makeContext();
    column(ctx, "A1", [0, 32, 33, 66, 67, 100]);
    rules(ctx, [
      {
        type: "icons",
        cellrange: range("A1:A6"),
        iconSet: makeIconSet("3Arrows"),
      },
    ]);
    const idx = (a) => cf(ctx, a).icon.index;
    expect(["A1", "A2", "A3", "A4", "A5", "A6"].map(idx)).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
    expect(cf(ctx, "A1").icon.set).toBe("3Arrows");
  });

  test("> instead of >=, number and percentile thresholds, reverse, icon only", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2, 3, 4, 5]);
    rules(ctx, [
      {
        type: "icons",
        cellrange: range("A1:A5"),
        iconSet: makeIconSet("3TrafficLights1", {
          thresholds: [
            { type: "num", value: 2, gte: false },
            { type: "percentile", value: 75, gte: true },
          ],
          reverse: true,
          showValue: false,
        }),
      },
    ]);
    // raw indexes 0,0,1,2,2 (percentile 75 of 1..5 = 4), reversed
    expect(
      ["A1", "A2", "A3", "A4", "A5"].map((a) => cf(ctx, a).icon.index)
    ).toEqual([2, 2, 1, 0, 0]);
    expect(cf(ctx, "A1").hideValue).toBe(true);
  });

  test("formula thresholds", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 5, 9]);
    put(ctx, "B1", 4);
    rules(ctx, [
      {
        type: "icons",
        cellrange: range("A1:A3"),
        iconSet: makeIconSet("4Rating", {
          thresholds: [
            { type: "formula", value: "=$B$1", gte: true },
            { type: "formula", value: "=$B$1*2", gte: true },
            { type: "num", value: 100, gte: true },
          ],
        }),
      },
    ]);
    expect(["A1", "A2", "A3"].map((a) => cf(ctx, a).icon.index)).toEqual([
      0, 1, 2,
    ]);
  });

  test("legacy Luckysheet icon rules map to named sets", () => {
    const rule = normalizeRule({
      type: "icons",
      cellrange: [],
      format: { len: 3, leftMin: 0, top: 4 },
    });
    expect(rule.iconSet.name).toBe("3TrafficLights1");
  });

  test("icons draw on a canvas without throwing", () => {
    const canvas = document.createElement("canvas");
    const rc = canvas.getContext("2d");
    CF_ICON_SET_NAMES.forEach((set) => {
      CF_ICON_SETS[set].forEach((_def, index) => {
        drawCFDecorations(rc, { icon: { set, index } }, 0, 0, 80, 20);
      });
    });
    drawCFDecorations(
      rc,
      {
        borderColor: "#FF0000",
        dataBar: {
          start: 0.2,
          end: 0.8,
          color: "#638EC6",
          borderColor: "#638EC6",
          gradient: true,
          solidSide: "left",
          axis: 0.2,
          axisColor: "#000000",
        },
      },
      0,
      0,
      80,
      20
    );
    const events = rc.__getEvents().map((e) => e.type);
    expect(events).toContain("arc");
    expect(events).toContain("fillRect");
    expect(events).toContain("strokeRect");
  });
});

describe("text styles for painting", () => {
  test("bold/italic/strike/underline and number format", () => {
    const cell = { v: 0.256, m: "0.256", ct: { fa: "General", t: "n" } };
    const res = {
      bold: true,
      italic: true,
      strikethrough: true,
      underline: true,
      numberFormat: "0.0%",
    };
    const out = cfTextCell(cell, res);
    expect(out).toMatchObject({ bl: 1, it: 1, cl: 1, un: 1, m: "25.6%" });
    expect(cell.m).toBe("0.256");
    // memoised per cell and result
    expect(cfTextCell(cell, res)).toBe(out);
    expect(cfTextCell(cell, { cellColor: "#fff" })).toBe(cell);
  });
});

describe("caching per recalculation", () => {
  function frozenWorkbook() {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2, 3]);
    rules(ctx, [
      {
        type: "default",
        cellrange: range("A1:A3"),
        conditionName: "formula",
        conditionValue: ["=A1>1"],
        format: { cellColor: "#FF0000" },
      },
    ]);
    // immer freezes produced state like the React workbook does
    return produce(ctx, () => {});
  }

  test("the map is reused while the cells and rules are unchanged", () => {
    const state = frozenWorkbook();
    const a = getCFComputeMap(state);
    const b = getCFComputeMap(state);
    expect(a).toBe(b);
    expect(Object.keys(a)).toEqual(["1_0", "2_0"]);
  });

  test("a cell edit (new frozen matrix) recomputes", () => {
    const state = frozenWorkbook();
    const a = getCFComputeMap(state);
    const next = produce(state, (d) => {
      d.luckysheetfile[0].data[0][0] = { v: 5, ct: { t: "n", fa: "General" } };
    });
    const b = getCFComputeMap(next);
    expect(b).not.toBe(a);
    expect(Object.keys(b).sort()).toEqual(["0_0", "1_0", "2_0"]);
    // an edit on another sheet also invalidates (formulas may read it)
    const other = produce(next, (d) => {
      d.luckysheetfile[1].data[0][0] = { v: 1 };
    });
    expect(getCFComputeMap(other)).not.toBe(b);
    // unrelated state changes keep the cache
    const scrolled = produce(other, (d) => {
      d.scrollTop = 100;
    });
    expect(getCFComputeMap(scrolled)).toBe(getCFComputeMap(other));
  });

  test("mutable (unfrozen) workbooks are never served stale results", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1]);
    rules(ctx, [
      {
        type: "default",
        cellrange: range("A1"),
        conditionName: "greaterThan",
        conditionValue: [1],
        format: { cellColor: "#FF0000" },
      },
    ]);
    expect(getCFComputeMap(ctx)).toEqual({});
    put(ctx, "A1", 2);
    expect(getCFComputeMap(ctx)).toEqual({ "0_0": { cellColor: "#FF0000" } });
  });
});
