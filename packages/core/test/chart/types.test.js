import {
  renderChartSvg,
  histogramBars,
  insertChart,
  findChart,
  setChartType,
  setChartSource,
  resolveChartModel,
  renderChartToSvg,
  chartThemeFor,
  chartThemes,
  adjustChartsForInsert,
  FormulaCache,
} from "../../src";

const count = (svg, re) => (svg.match(re) || []).length;
const cats = ["Jan", "Feb", "Mar", "Apr"];

describe("new chart types render", () => {
  test("combo: columns and a line on a secondary axis", () => {
    const svg = renderChartSvg(
      {
        type: "combo",
        categories: cats,
        secondaryValueAxisTitle: "Share",
        series: [
          { name: "Sales", color: "#111111", values: [100, 200, 300, 400] },
          {
            name: "Share",
            color: "#222222",
            values: [0.1, 0.2, 0.3, 0.4],
            type: "line",
            secondary: true,
          },
        ],
      },
      400,
      300
    );
    expect(count(svg, /<rect[^>]*fill="#111111"/g)).toBe(4 + 1);
    expect(count(svg, /<path d="M[^"]+" fill="none" stroke="#222222"/g)).toBe(
      1
    );
    // both axes have their own ticks
    expect(svg).toContain(">400</text>");
    expect(svg).toContain(">0.4</text>");
    expect(svg).toContain(">Share</text>");
  });

  test("radar styles", () => {
    const model = (radarStyle) => ({
      type: "radar",
      radarStyle,
      categories: ["A", "B", "C", "D", "E"],
      series: [{ name: "S", color: "#123456", values: [1, 2, 3, 4, 5] }],
    });
    const marker = renderChartSvg(model("marker"), 300, 300);
    expect(count(marker, /<circle[^>]*fill="#123456"/g)).toBe(5 + 1);
    const filled = renderChartSvg(model("filled"), 300, 300);
    expect(filled).toMatch(/<path d="M[^"]+Z" fill="#123456" fill-opacity/);
    expect(filled).toContain(">E</text>");
  });

  test("bubble sizes scale by area", () => {
    const svg = renderChartSvg(
      {
        type: "bubble",
        categories: [],
        series: [
          {
            name: "B",
            color: "#123456",
            values: [1, 2],
            xValues: [1, 2],
            sizes: [1, 4],
          },
        ],
      },
      400,
      300
    );
    const radii = [
      ...svg.matchAll(/<circle[^>]*r="([\d.]+)" fill="#123456" fill-opacity/g),
    ].map((m) => parseFloat(m[1]));
    expect(radii).toHaveLength(2);
    expect(radii[1] / radii[0]).toBeCloseTo(2, 1);
  });

  test("waterfall: floating bars, totals, connectors", () => {
    const svg = renderChartSvg(
      {
        type: "waterfall",
        categories: ["Start", "Up", "Down", "End"],
        waterfallTotals: [0, 3],
        waterfallColors: ["#00aa00", "#aa0000", "#777777"],
        series: [{ name: "W", color: "#000", values: [100, 50, -30, 120] }],
      },
      400,
      300
    );
    expect(count(svg, /<rect[^>]*fill="#00aa00"/g)).toBe(1 + 1);
    expect(count(svg, /<rect[^>]*fill="#aa0000"/g)).toBe(1 + 1);
    expect(count(svg, /<rect[^>]*fill="#777777"/g)).toBe(2 + 1);
    expect(count(svg, /stroke-dasharray="2 2"/g)).toBe(3);
    expect(svg).toContain(">Increase</text>");
  });

  test("histogram and Pareto bars", () => {
    const hist = {
      type: "histogram",
      categories: [],
      binning: { mode: "width", width: 5 },
      series: [{ name: "H", color: "#123456", values: [1, 2, 6, 7, 8, 12] }],
    };
    expect(histogramBars(hist)).toEqual([
      { label: "[1, 6]", value: 3 },
      { label: "(6, 11]", value: 2 },
      { label: "(11, 16]", value: 1 },
    ]);
    expect(renderChartSvg(hist, 400, 300)).toContain(">(6, 11]</text>");
    const pareto = {
      type: "pareto",
      categories: ["a", "b", "a", "c"],
      series: [{ name: "P", color: "#123456", values: [1, 5, 2, 1] }],
    };
    expect(histogramBars(pareto)).toEqual([
      { label: "b", value: 5 },
      { label: "a", value: 3 },
      { label: "c", value: 1 },
    ]);
    const svg = renderChartSvg(pareto, 400, 300);
    expect(svg).toContain(">100%</text>");
    expect(svg).toContain(">Cumulative %</text>");
  });

  test("funnel bars shrink with their values", () => {
    const svg = renderChartSvg(
      {
        type: "funnel",
        legend: "none",
        categories: ["A", "B"],
        dataLabels: true,
        series: [{ name: "F", color: "#123456", values: [100, 50] }],
      },
      400,
      300
    );
    const widths = [
      ...svg.matchAll(/<rect[^>]*width="([\d.]+)"[^>]*fill="#123456"/g),
    ].map((m) => parseFloat(m[1]));
    expect(widths[1] / widths[0]).toBeCloseTo(0.5, 1);
    expect(svg).toContain(">100</text>");
  });

  test("stock: high-low lines and up/down bars", () => {
    const series = ["Open", "High", "Low", "Close"].map((name, i) => ({
      name,
      color: `#00000${i}`,
      values: [
        [10, 20],
        [15, 25],
        [5, 15],
        [12, 18],
      ][i],
    }));
    const svg = renderChartSvg(
      { type: "stock", stockVariant: "ohlc", categories: ["d1", "d2"], series },
      400,
      300
    );
    // one up bar (white) and one down bar (dark)
    expect(count(svg, /<rect[^>]*fill="#ffffff" stroke="#404040"/g)).toBe(1);
    expect(count(svg, /<rect[^>]*fill="#404040" stroke="#404040"/g)).toBe(1);
  });

  test("trendlines, R² and error bars", () => {
    const svg = renderChartSvg(
      {
        type: "scatter",
        categories: [],
        series: [
          {
            name: "S",
            color: "#123456",
            xValues: [1, 2, 3],
            values: [2, 4, 6],
            trendlines: [
              { type: "linear", displayEquation: true, displayRSquared: true },
            ],
            errorBars: { type: "fixed", value: 1 },
          },
        ],
      },
      400,
      300
    );
    expect(svg).toContain("y = 2x");
    expect(svg).toContain("R² = 1.0000");
    expect(svg).toContain(">Linear (S)</text>");
    expect(svg).toMatch(/stroke-dasharray="2 3"/);
    // 3 error bars with two caps each
    expect(count(svg, /<line[^>]*stroke="#404040" stroke-width="1"\/>/g)).toBe(
      9
    );
  });

  test("data label options: parts, number format, pie percentages", () => {
    const col = renderChartSvg(
      {
        type: "column",
        categories: ["Jan"],
        dataLabels: true,
        dataLabelOptions: {
          showSeriesName: true,
          showCategory: true,
          numberFormat: "0.00",
          separator: "; ",
        },
        series: [{ name: "S", color: "#123456", values: [3], labels: ["3"] }],
      },
      300,
      200
    );
    expect(col).toContain(">S; Jan; 3.00</text>");
    const pie = renderChartSvg(
      {
        type: "pie",
        categories: ["a", "b"],
        dataLabels: true,
        dataLabelOptions: { showValue: false, showPercent: true },
        series: [{ name: "P", color: "#000", values: [1, 3] }],
      },
      300,
      200
    );
    expect(pie).toContain(">25%</text>");
    expect(pie).toContain(">75%</text>");
  });

  test("chart styles change the chrome", () => {
    const model = {
      type: "column",
      categories: cats,
      style: { plotFill: "#abcdef", barRadius: 3, titleBold: true },
      title: "T",
      series: [{ name: "S", color: "#123456", values: [1, 2, 3, 4] }],
    };
    const svg = renderChartSvg(model, 300, 200);
    expect(svg).toContain('fill="#abcdef"');
    expect(svg).toContain('rx="3"');
    expect(svg).toContain('font-weight="700"');
  });
});

const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeContext(rows) {
  const data = [];
  for (let r = 0; r < 12; r += 1) {
    const row = [];
    for (let c = 0; c < 8; c += 1) {
      const v = rows[r]?.[c];
      if (v == null) row.push(null);
      else row.push(typeof v === "number" ? num(v) : str(v));
    }
    data.push(row);
  }
  return {
    currentSheetId: "s1",
    allowEdit: true,
    config: {},
    zoomRatio: 1,
    defaultrowlen: 19,
    defaultcollen: 73,
    visibledatarow: [],
    visibledatacolumn: [],
    formulaCache: new FormulaCache(),
    luckysheet_select_save: [{ row: [0, 3], column: [0, 3] }],
    luckysheetfile: [{ name: "Sheet1", id: "s1", data, order: 0, config: {} }],
  };
}

describe("chart model", () => {
  const table = [
    ["", "X", "Y", "Size"],
    ["a", 1, 10, 5],
    ["b", 2, 20, 10],
    ["c", 3, 30, 20],
  ];

  test("combo presets and per-series options", () => {
    const ctx = makeContext(table);
    const chart = insertChart(ctx, { type: "combo", comboSecondary: true });
    expect(chart.series.map((s) => s.type)).toEqual(["column", "line", "line"]);
    expect(chart.series[2].secondary).toBe(true);
    const model = resolveChartModel(ctx, chart);
    expect(model.series[1].type).toBe("line");
    expect(model.series[2].secondary).toBe(true);
    // leaving combo drops the per-series types
    setChartType(ctx, chart.id, "column");
    const c = findChart(ctx, chart.id).chart;
    expect(c.series.every((s) => s.type == null)).toBe(true);
    expect(c.series[2].secondary).toBe(true);
    setChartType(ctx, chart.id, "pie");
    expect(findChart(ctx, chart.id).chart.series[2].secondary).toBeUndefined();
  });

  test("bubble charts read X, Y and size columns", () => {
    const ctx = makeContext([
      ["X", "Y", "Size"],
      [1, 10, 5],
      [2, 20, 10],
    ]);
    ctx.luckysheet_select_save = [{ row: [0, 2], column: [0, 2] }];
    const chart = insertChart(ctx, { type: "bubble" });
    expect(chart.series).toHaveLength(1);
    expect(chart.series[0].sizes.column).toEqual([2, 2]);
    const model = resolveChartModel(ctx, chart);
    expect(model.series[0].xValues).toEqual([1, 2]);
    expect(model.series[0].sizes).toEqual([5, 10]);
    // sizes follow inserted columns
    adjustChartsForInsert(ctx, "s1", "column", 0, 1);
    expect(findChart(ctx, chart.id).chart.series[0].sizes.column).toEqual([
      3, 3,
    ]);
    // back to column: plain series (in rows for this shape), no sizes
    setChartType(ctx, chart.id, "column");
    setChartSource(ctx, chart.id, {
      sheetId: "s1",
      row: [0, 2],
      column: [1, 3],
    });
    expect(findChart(ctx, chart.id).chart.series).toHaveLength(2);
  });

  test("type defaults, palettes, custom error ranges and styles", () => {
    const ctx = makeContext(table);
    const wf = insertChart(ctx, { type: "waterfall" });
    expect(wf.dataLabels).toBe(true);
    const stock = insertChart(ctx, { type: "stock" });
    expect(stock.stockVariant).toBe("hlc");
    const radar = insertChart(ctx, { type: "radar" });
    expect(radar.radarStyle).toBe("marker");
    const chart = insertChart(ctx, { type: "column" });
    chart.palette = "monochrome2";
    chart.series[0].errorBars = {
      type: "custom",
      plus: { sheetId: "s1", row: [1, 3], column: [3, 3] },
    };
    chart.series[0].trendlines = [{ type: "linear" }];
    const model = resolveChartModel(ctx, chart);
    expect(model.series[0].color).toBe("#ED7D31");
    expect(model.series[1].color).toBe("#9E480E");
    expect(model.series[0].errorBars.plusValues).toEqual([5, 10, 20]);
    expect(model.series[0].trendlines).toHaveLength(1);
    // pie charts have no trendlines
    setChartType(ctx, chart.id, "pie");
    expect(resolveChartModel(ctx, chart).series[0].trendlines).toBeUndefined();
    chart.style = 6;
    expect(chartThemeFor(chart, "light").background).toBe("#404040");
    expect(chartThemeFor(chart, "dark").background).toBe("#111214");
    expect(chartThemeFor({}, "dark")).toBe(chartThemes.dark);
    expect(renderChartToSvg(ctx, chart, "dark")).toContain('fill="#111214"');
    // localised legend labels
    expect(resolveChartModel({ ...ctx, lang: "zh" }, wf).labels.increase).toBe(
      "增加"
    );
  });
});
