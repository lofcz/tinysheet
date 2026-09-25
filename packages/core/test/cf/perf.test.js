import { produce } from "immer";
import { makeContext, rules, range } from "./helpers";
import {
  getCFComputeMap,
  makeDataBar,
  colorScaleFromPreset,
  CF_COLOR_SCALE_PRESETS,
} from "../../src/modules/ConditionFormat";

// 20,000 numbers in A1:B10000 with a data bar, a colour scale, a top-10%
// rule and a relative formula rule.
function bigWorkbook() {
  const ctx = makeContext({ rows: 10000, cols: 3 });
  const { data } = ctx.luckysheetfile[0];
  for (let r = 0; r < 10000; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      const v = (r * 7 + c * 13) % 1000;
      data[r][c] = { v, m: `${v}`, ct: { fa: "General", t: "n" } };
    }
  }
  rules(ctx, [
    {
      type: "dataBar",
      cellrange: range("A1:A10000"),
      dataBar: makeDataBar("#638EC6", true),
    },
    {
      type: "colorGradation",
      cellrange: range("B1:B10000"),
      colorScale: { stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]) },
    },
    {
      type: "default",
      cellrange: range("A1:B10000"),
      conditionName: "top10_percent",
      conditionValue: [10],
      format: { bold: true },
    },
    {
      type: "default",
      cellrange: range("A1:A10000"),
      conditionName: "formula",
      conditionValue: ["=$A1>$B1"],
      format: { textColor: "#FF0000" },
    },
  ]);
  return produce(ctx, () => {});
}

test("evaluation is fast and happens once per recalculation, not per paint", () => {
  const state = bigWorkbook();
  const t0 = Date.now();
  const map = getCFComputeMap(state);
  const first = Date.now() - t0;
  expect(Object.keys(map).length).toBe(20000);
  const t1 = Date.now();
  for (let i = 0; i < 100; i += 1) getCFComputeMap(state);
  const repaint = Date.now() - t1;
  // measured: about 0.5 s for the first evaluation, ~0 ms when cached
  expect(first).toBeLessThan(5000);
  expect(repaint).toBeLessThan(50);
});
