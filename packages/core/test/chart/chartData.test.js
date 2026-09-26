import {
  adjustChartsForDelete,
  adjustChartsForInsert,
  applyChartDataBlock,
  applyChartElement,
  applyChartQuickLayout,
  applySeriesFormula,
  chartDataBlockRects,
  chartFieldPreview,
  chartRangeToText,
  chartSelectableElements,
  chartElementToggles,
  getChartDataBlock,
  getChartDataRange,
  insertChart,
  parseChartLiteral,
  parseChartRange,
  parseSeriesFormula,
  readChartRange,
  renderChartToSvg,
  reshapeChartDataBlock,
  resolveChartModel,
  seriesFormula,
  setChartDataRange,
  setSeriesCategories,
  setSeriesName,
  setSeriesValues,
  switchChartDataRowColumn,
  FormulaCache,
} from "../../src";

const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeContext(rows) {
  const data = [];
  for (let r = 0; r < 14; r += 1) {
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
    visibledatarow: data.map((_, i) => (i + 1) * 20),
    visibledatacolumn: data[0].map((_, i) => (i + 1) * 74),
    luckysheet_select_save: [
      { row: [0, 4], column: [0, 2], row_focus: 0, column_focus: 0 },
    ],
    formulaCache: new FormulaCache(),
    luckysheetfile: [
      { name: "Sheet1", id: "s1", data, order: 0, config: {} },
      {
        name: "Other data",
        id: "s2",
        data: [
          [str("Q"), num(7)],
          [str("R"), num(8)],
          [str("S"), num(9)],
        ],
        order: 1,
        config: {},
      },
    ],
  };
}

const TABLE = [
  ["Month", "Revenue", "Cost"],
  ["Jan", 120, 80],
  ["Feb", 135, 90],
  ["Mar", 150, 95],
  ["Apr", 110, 85],
];

describe("union references", () => {
  it("parse, print and read non-contiguous ranges", () => {
    const ctx = makeContext(TABLE);
    const r = parseChartRange(ctx, "=(Sheet1!$B$2:$B$3,Sheet1!$B$5)", "s1");
    expect(r.row).toEqual([1, 2]);
    expect(r.areas).toEqual([{ sheetId: "s1", row: [4, 4], column: [1, 1] }]);
    expect(chartRangeToText(ctx, r)).toBe("(Sheet1!$B$2:$B$3,Sheet1!$B$5)");
    expect(readChartRange(ctx, r).map((c) => c.numeric)).toEqual([
      120, 135, 110,
    ]);
    // quoted sheet names with commas and other sheets
    const q = parseChartRange(ctx, "'Other data'!$B$1:$B$2,Sheet1!C2", "s1");
    expect(q.sheetId).toBe("s2");
    expect(q.areas[0].sheetId).toBe("s1");
    expect(chartRangeToText(ctx, q)).toBe(
      "('Other data'!$B$1:$B$2,Sheet1!$C$2)"
    );
  });

  it("row insertion and deletion move every area; a deleted area drops", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "column" });
    chart.series[0].values = parseChartRange(ctx, "(B2:B3,B5)", "s1");
    adjustChartsForInsert(ctx, "s1", "row", 3, 2);
    expect(chartRangeToText(ctx, chart.series[0].values)).toBe(
      "(Sheet1!$B$2:$B$3,Sheet1!$B$7)"
    );
    adjustChartsForDelete(ctx, "s1", "row", 6, 6);
    expect(chartRangeToText(ctx, chart.series[0].values)).toBe(
      "Sheet1!$B$2:$B$3"
    );
  });
});

describe("SERIES formulas", () => {
  it("round-trip names, categories, values and order", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "column" });
    expect(seriesFormula(ctx, chart, 0)).toBe(
      "=SERIES(Sheet1!$B$1,Sheet1!$A$2:$A$5,Sheet1!$B$2:$B$5,1)"
    );
    expect(seriesFormula(ctx, chart, 1)).toBe(
      "=SERIES(Sheet1!$C$1,Sheet1!$A$2:$A$5,Sheet1!$C$2:$C$5,2)"
    );
    const parsed = parseSeriesFormula(
      ctx,
      "=SERIES('Other data'!$A$1,,('Other data'!$B$1:$B$2,Sheet1!$B$5),3)",
      "s1"
    );
    expect(parsed.order).toBe(3);
    expect(parsed.nameRef.sheetId).toBe("s2");
    expect(parsed.categories).toBeUndefined();
    applySeriesFormula(chart.series[1], parsed);
    expect(seriesFormula(ctx, chart, 1)).toBe(
      "=SERIES('Other data'!$A$1,,('Other data'!$B$1:$B$2,Sheet1!$B$5),2)"
    );
    const model = resolveChartModel(ctx, chart);
    expect(model.series[1].name).toBe("Q");
    expect(model.series[1].values).toEqual([7, 8, 110]);
  });

  it("literals: typed names, value arrays and label lists", () => {
    const ctx = makeContext(TABLE);
    const p = parseSeriesFormula(
      ctx,
      '=SERIES("Plan",{"a","b"},{1,2.5},1)',
      "s1"
    );
    expect(p.name).toBe("Plan");
    expect(p.categoryLiteral).toEqual(["a", "b"]);
    expect(p.valueLiteral).toEqual([1, 2.5]);
    expect(parseChartLiteral("Q1,Q2,Q3", { plainList: true })).toEqual([
      "Q1",
      "Q2",
      "Q3",
    ]);
    expect(parseSeriesFormula(ctx, "=SUM(A1)", "s1")).toBeNull();
  });
});

describe("Edit Series fields", () => {
  it("set name, values and axis labels from text", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "line" });
    const s = chart.series[0];
    expect(setSeriesName(ctx, s, "Budget", "s1")).toBeNull();
    expect(s.name).toBe("Budget");
    expect(setSeriesName(ctx, s, "='Other data'!$A$2", "s1")).toBeNull();
    expect(s.nameRef.sheetId).toBe("s2");
    expect(setSeriesValues(ctx, s, "={4,5,6,7}", "s1")).toBeNull();
    expect(s.values).toBeNull();
    expect(resolveChartModel(ctx, chart).series[0].values).toEqual([
      4, 5, 6, 7,
    ]);
    expect(setSeriesValues(ctx, s, "=Nope!A1", "s1")).toBe("invalidReference");
    expect(setSeriesCategories(ctx, s, "Q1,Q2,Q3,Q4", "s1")).toBeNull();
    expect(s.cache.categories).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(chartFieldPreview(ctx, "=Sheet1!$B$2:$B$4", "s1")).toBe(
      "= 120, 135, 150"
    );
    expect(chartFieldPreview(ctx, "=Sheet1!$B$1", "s1", { name: true })).toBe(
      "= Revenue"
    );
  });
});

describe("data range and block", () => {
  it("derives the chart data range and switches row / column", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "column" });
    expect(chartRangeToText(ctx, getChartDataRange(chart))).toBe(
      "Sheet1!$A$1:$C$5"
    );
    expect(switchChartDataRowColumn(ctx, chart)).toBe(true);
    expect(chart.seriesInRows).toBe(true);
    expect(chart.series).toHaveLength(4);
    expect(chartRangeToText(ctx, chart.series[0].values)).toBe(
      "Sheet1!$B$2:$C$2"
    );
    switchChartDataRowColumn(ctx, chart);
    expect(chart.series).toHaveLength(2);
    // a series from elsewhere makes the range "too complex"
    chart.series[1].values = parseChartRange(ctx, "'Other data'!B1:B3", "s1");
    expect(getChartDataRange(chart)).toBeNull();
    setChartDataRange(ctx, chart, parseChartRange(ctx, "A1:B5", "s1"));
    expect(chart.series).toHaveLength(1);
  });

  it("resizing the values outline adds points and series; moving shifts", () => {
    const ctx = makeContext([
      ...TABLE,
      ["May", 170, 100, 5],
      ["Jun", 190, 110, 6],
    ]);
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 2] }];
    const chart = insertChart(ctx, { type: "column" });
    chart.series[1].color = "#ff0000";
    const block = getChartDataBlock(chart);
    expect(block).toMatchObject({
      points: [1, 4],
      series: [1, 2],
      nameAt: 0,
      categoryAt: 0,
    });
    const rects = chartDataBlockRects(block);
    expect(rects.values).toEqual({
      sheetId: "s1",
      row: [1, 4],
      column: [1, 2],
    });
    // drag the blue corner two rows down and one column right
    const next = reshapeChartDataBlock(block, "values", {
      sheetId: "s1",
      row: [1, 6],
      column: [1, 3],
    });
    applyChartDataBlock(chart, next);
    expect(chart.series).toHaveLength(3);
    expect(chart.series[1].color).toBe("#ff0000");
    expect(chartRangeToText(ctx, chart.series[2].values)).toBe(
      "Sheet1!$D$2:$D$7"
    );
    expect(chartRangeToText(ctx, chart.series[0].categories)).toBe(
      "Sheet1!$A$2:$A$7"
    );
    expect(chartRangeToText(ctx, chart.source)).toBe("Sheet1!$A$1:$D$7");
    // the purple outline moves one column: categories come from column B
    const moved = reshapeChartDataBlock(
      getChartDataBlock(chart),
      "categories",
      {
        sheetId: "s1",
        row: [2, 6],
        column: [0, 0],
      }
    );
    applyChartDataBlock(chart, moved);
    expect(chartRangeToText(ctx, chart.series[0].values)).toBe(
      "Sheet1!$B$3:$B$7"
    );
  });
});

describe("hidden and empty cells, filters", () => {
  const ctxWithGap = () => {
    const ctx = makeContext([
      ["M", "V"],
      ["a", 1],
      ["b", null],
      ["c", 3],
      ["d", "#N/A"],
      ["e", 5],
    ]);
    ctx.luckysheet_select_save = [{ row: [0, 5], column: [0, 1] }];
    return ctx;
  };

  it("gaps, zero, connected lines and #N/A", () => {
    const ctx = ctxWithGap();
    const chart = insertChart(ctx, { type: "line" });
    let m = resolveChartModel(ctx, chart);
    expect(m.series[0].values).toEqual([1, null, 3, null, 5]);
    expect(m.series[0].connect).toEqual([
      undefined,
      undefined,
      undefined,
      true,
    ]);
    chart.displayBlanksAs = "zero";
    m = resolveChartModel(ctx, chart);
    expect(m.series[0].values).toEqual([1, 0, 3, null, 5]);
    chart.displayNaAsBlank = true;
    m = resolveChartModel(ctx, chart);
    expect(m.series[0].values).toEqual([1, 0, 3, 0, 5]);
    chart.displayBlanksAs = "span";
    m = resolveChartModel(ctx, chart);
    expect(m.series[0].connect.filter(Boolean)).toHaveLength(2);
    // the line is one path across the gaps
    const svg = renderChartToSvg(ctx, chart, "light");
    const path = /<path d="([^"]+)" fill="none"/.exec(svg)[1];
    expect(path.match(/M/g)).toHaveLength(1);
  });

  it("hidden rows are not plotted unless shown; filters hide points and series", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "column" });
    ctx.luckysheetfile[0].config.rowhidden = { 2: 0 };
    let m = resolveChartModel(ctx, chart);
    expect(m.hiddenPoints).toEqual([undefined, true]);
    chart.plotVisibleOnly = false;
    m = resolveChartModel(ctx, chart);
    expect(m.hiddenPoints).toBeUndefined();
    chart.hiddenCategories = [0];
    chart.series[1].filtered = true;
    m = resolveChartModel(ctx, chart);
    expect(m.hiddenPoints).toEqual([true]);
    expect(m.series[1].hidden).toBe(true);
    const svg = renderChartToSvg(ctx, chart, "light");
    expect(svg).toContain('data-chart-el="series:0"');
    expect(svg).not.toContain('data-chart-el="series:1"');
  });
});

describe("chart elements and layouts", () => {
  it("Add Chart Element options and the Current Selection list", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "column" });
    applyChartElement(chart, "chartTitle", "above");
    expect(chart.title).toBe("Chart Title");
    applyChartElement(chart, "axisTitles", "vertical");
    expect(chart.valueAxisTitle).toBe("Axis Title");
    applyChartElement(chart, "gridlines", "majorVertical");
    expect(chart.categoryGridlines).toBe(true);
    expect(chartElementToggles(chart, "gridlines")).toMatchObject({
      majorHorizontal: true,
      majorVertical: true,
    });
    applyChartElement(chart, "axes", "horizontal");
    expect(chart.axes).toEqual({ category: false });
    applyChartElement(chart, "dataTable", "keys");
    expect(chart.dataTable).toEqual({ legendKeys: true });
    applyChartElement(chart, "errorBars", "percentage", undefined, [1]);
    expect(chart.series[0].errorBars).toBeUndefined();
    expect(chart.series[1].errorBars).toEqual({ type: "percentage", value: 5 });
    applyChartElement(chart, "trendline", "linearForecast", undefined, [0]);
    expect(chart.series[0].trendlines).toEqual([
      { type: "linear", forward: 2 },
    ]);
    expect(chartSelectableElements(chart)).toEqual([
      "chartArea",
      "title",
      "legend",
      "plotArea",
      "series:0",
      "series:1",
      "valueAxis",
      "majorGridlines",
      "valueAxisTitle",
    ]);
    const svg = renderChartToSvg(ctx, chart, "light");
    expect(svg).toContain('data-chart-el="dataTable"');
    expect(svg).not.toContain('data-chart-el="categoryAxis"');
  });

  it("Quick Layout 5 shows a data table and a value axis title", () => {
    const ctx = makeContext(TABLE);
    const chart = insertChart(ctx, { type: "column" });
    applyChartQuickLayout(chart, 5);
    expect(chart).toMatchObject({
      title: "Chart Title",
      legend: "none",
      dataTable: { legendKeys: true },
      valueAxisTitle: "Axis Title",
    });
    applyChartQuickLayout(chart, 2);
    expect(chart.dataTable).toBeUndefined();
    expect(chart.axes).toEqual({ value: false });
    expect(chart.dataLabelOptions.position).toBe("outsideEnd");
  });
});
