import {
  computeSelectionStats,
  createSelectionStatsTask,
  visibleSelectionStats,
  formatSelectionStat,
  getActiveCellNumberFormat,
  STATUS_BAR_STAT_KEYS,
  DEFAULT_STATUS_BAR_STATS,
} from "../../src";
import { contextFactory } from "../factories/context";

const num = (v, fa = "General") => ({ v, m: String(v), ct: { fa, t: "n" } });
const text = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });
const range = (r1, r2, c1, c2) => ({ row: [r1, r2], column: [c1, c2] });

describe("selection stats (status bar)", () => {
  const data = [
    [num(1), num(2), text("abc"), null],
    [num(3), { v: true, m: "TRUE", ct: { t: "b" } }, { bg: "#f00" }, null],
    [{ v: "4", m: "4", ct: { fa: "@", t: "s" } }, null, null, null],
  ];

  it("counts non-empty cells and aggregates numbers only", () => {
    const s = computeSelectionStats(data, [range(0, 2, 0, 3)]);
    expect(s.count).toBe(6); // the style-only cell is blank
    expect(s.numericalCount).toBe(3);
    expect(s.sum).toBe(6);
    expect(s.min).toBe(1);
    expect(s.max).toBe(3);
    expect(s.average).toBe(2);
    expect(s.hasError).toBe(false);
  });

  it("counts numbers stored as text and booleans without summing them", () => {
    const s = computeSelectionStats(data, [range(1, 2, 0, 1)]);
    expect(s.count).toBe(3);
    expect(s.numericalCount).toBe(1);
    expect(s.sum).toBe(3);
  });

  it("is multi-range aware and counts overlaps per range like Excel", () => {
    const s = computeSelectionStats(data, [
      range(0, 0, 0, 1),
      range(0, 1, 0, 0),
    ]);
    expect(s.numericalCount).toBe(4);
    expect(s.sum).toBe(1 + 2 + 1 + 3);
  });

  it("clamps whole-column selections to the stored data", () => {
    const s = computeSelectionStats(data, [range(0, 1048575, 0, 0)]);
    expect(s.sum).toBe(4);
    expect(s.count).toBe(3);
  });

  it("counts formulas returning empty text (COUNTA) and flags errors", () => {
    const d = [
      [
        { f: '=""', v: "" },
        { f: "=1/0", v: "#DIV/0!", ct: { t: "e" } },
        num(5),
      ],
    ];
    const s = computeSelectionStats(d, [range(0, 0, 0, 2)]);
    expect(s.count).toBe(3);
    expect(s.hasError).toBe(true);
    expect(visibleSelectionStats(s, STATUS_BAR_STAT_KEYS)).toEqual(["count"]);
  });

  it("scans incrementally with the same result", () => {
    const big = [];
    for (let r = 0; r < 300; r += 1) big.push([num(r), num(1), null]);
    const task = createSelectionStatsTask(big, [range(0, 299, 0, 2)]);
    let steps = 0;
    while (!task.step(50)) steps += 1;
    expect(steps).toBeGreaterThan(5);
    const s = task.result();
    expect(s).toEqual(computeSelectionStats(big, [range(0, 299, 0, 2)]));
    expect(s.sum).toBe((299 * 300) / 2 + 300);
  });

  it("shows nothing below two non-empty cells, and the enabled items otherwise", () => {
    const one = computeSelectionStats(data, [range(0, 0, 0, 0)]);
    expect(visibleSelectionStats(one, STATUS_BAR_STAT_KEYS)).toEqual([]);
    const s = computeSelectionStats(data, [range(0, 2, 0, 3)]);
    expect(visibleSelectionStats(s, DEFAULT_STATUS_BAR_STATS)).toEqual([
      "average",
      "count",
      "sum",
    ]);
    const onlyText = computeSelectionStats(
      [[text("a"), text("b")]],
      [range(0, 0, 0, 1)]
    );
    expect(visibleSelectionStats(onlyText, STATUS_BAR_STAT_KEYS)).toEqual([
      "count",
      "numericalCount",
    ]);
  });

  it("formats values with the active cell's number format", () => {
    const s = computeSelectionStats(
      [[num(1.5), num(2.25)]],
      [range(0, 0, 0, 1)]
    );
    expect(formatSelectionStat("sum", s, "General")).toBe("3.75");
    expect(formatSelectionStat("sum", s, "0.00")).toBe("3.75");
    expect(formatSelectionStat("average", s, "$#,##0.00")).toBe("$1.88");
    expect(formatSelectionStat("sum", s, "0%")).toBe("375%");
    expect(formatSelectionStat("count", s, "0.00")).toBe("2");
    expect(formatSelectionStat("sum", s, "@")).toBe("3.75");
    expect(formatSelectionStat("sum", s, "yyyy-mm-dd")).toBe("1900-01-03");
  });

  it("reads the active cell's format", () => {
    const ctx = contextFactory({
      luckysheet_select_save: [
        { row: [0, 1], column: [0, 1], row_focus: 1, column_focus: 1 },
      ],
    });
    ctx.luckysheetfile[0].data[1][1] = num(3, "0.000");
    expect(getActiveCellNumberFormat(ctx)).toBe("0.000");
  });
});
