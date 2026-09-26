import {
  adjustChartsForDelete,
  adjustChartsForInsert,
  chartRangeToText,
  deleteChart,
  detectChartSeries,
  findChart,
  getChartSourceRegion,
  insertChart,
  parseChartRange,
  pasteChart,
  readChartCell,
  renderChartToSvg,
  resolveChartModel,
  setChartSource,
  setChartType,
  shiftSpanForDelete,
  shiftSpanForInsert,
  switchChartRowColumn,
  updateChart,
  insertRowCol,
  deleteRowCol,
  FormulaCache,
} from "../../src";

const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeContext(rows, extra = {}) {
  const width = Math.max(...rows.map((r) => r.length), 6);
  const data = [];
  for (let r = 0; r < Math.max(rows.length, 12); r += 1) {
    const row = [];
    for (let c = 0; c < width + 2; c += 1) {
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
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ],
    formulaCache: new FormulaCache(),
    luckysheetfile: [
      { name: "Sheet1", id: "s1", data, order: 0, config: {} },
      { name: "My Data", id: "s2", data: [[num(1)]], order: 1, config: {} },
    ],
    ...extra,
  };
}

const table = [
  [null, "Q1", "Q2", "Q3"],
  ["North", 10, 20, 30],
  ["South", 15, 25, 35],
];

describe("chart ranges", () => {
  test("parse and format A1 references", () => {
    const ctx = makeContext(table);
    expect(parseChartRange(ctx, "Sheet1!$B$2:$D$3", "s1")).toEqual({
      sheetId: "s1",
      row: [1, 2],
      column: [1, 3],
    });
    expect(parseChartRange(ctx, "='My Data'!A1", "s1")).toEqual({
      sheetId: "s2",
      row: [0, 0],
      column: [0, 0],
    });
    expect(parseChartRange(ctx, "C3:A1", "s1")).toEqual({
      sheetId: "s1",
      row: [0, 2],
      column: [0, 2],
    });
    expect(parseChartRange(ctx, "B:B", "s1").column).toEqual([1, 1]);
    expect(parseChartRange(ctx, "Nope!A1", "s1")).toBeNull();
    // unions (non-contiguous references) are supported
    expect(parseChartRange(ctx, "A1,B2", "s1").areas).toHaveLength(1);
    expect(parseChartRange(ctx, "A1,Nope!B2", "s1")).toBeNull();
    expect(
      chartRangeToText(ctx, { sheetId: "s2", row: [0, 3], column: [1, 1] })
    ).toBe("'My Data'!$B$1:$B$4");
    expect(
      chartRangeToText(
        ctx,
        { sheetId: "s1", row: [0, 0], column: [0, 0] },
        { absolute: false }
      )
    ).toBe("Sheet1!A1");
    expect(chartRangeToText(ctx, null)).toBe("#REF!");
  });

  test("readChartCell distinguishes numbers, text and dates", () => {
    expect(readChartCell(num(3)).numeric).toBe(3);
    expect(readChartCell(str("x")).text).toBe(true);
    expect(readChartCell({ v: "5", ct: { t: "n" } }).numeric).toBe(5);
    expect(
      readChartCell({
        v: 45000,
        m: "3/15/2023",
        ct: { fa: "m/d/yyyy", t: "d" },
      }).date
    ).toBe(true);
    expect(readChartCell(null).numeric).toBeNull();
  });

  test("current region expands a single cell to the data block", () => {
    const ctx = makeContext(table);
    expect(getChartSourceRegion(ctx.luckysheetfile[0].data, 1, 1)).toEqual({
      row: [0, 2],
      column: [0, 3],
    });
  });
});

describe("series detection", () => {
  test("empty top-left: header row and column, series along the short side", () => {
    const ctx = makeContext(table);
    const d = detectChartSeries(ctx, {
      sheetId: "s1",
      row: [0, 2],
      column: [0, 3],
    });
    expect(d.headerRow).toBe(true);
    expect(d.headerColumn).toBe(true);
    // 2 data rows x 3 data columns -> series in rows
    expect(d.seriesInRows).toBe(true);
    expect(d.series).toHaveLength(2);
    expect(d.series[0].values).toEqual({
      sheetId: "s1",
      row: [1, 1],
      column: [1, 3],
    });
    expect(d.series[0].nameRef.column).toEqual([0, 0]);
    expect(d.series[0].categories).toEqual({
      sheetId: "s1",
      row: [0, 0],
      column: [1, 3],
    });
  });

  test("tall data: series in columns with names from the header row", () => {
    const ctx = makeContext([
      ["Month", "Sales", "Cost"],
      ["Jan", 1, 2],
      ["Feb", 3, 4],
      ["Mar", 5, 6],
    ]);
    const d = detectChartSeries(ctx, {
      sheetId: "s1",
      row: [0, 3],
      column: [0, 2],
    });
    expect(d.seriesInRows).toBe(false);
    expect(d.series).toHaveLength(2);
    const model = resolveChartModel(ctx, {
      id: "x",
      type: "column",
      series: d.series,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    expect(model.categories).toEqual(["Jan", "Feb", "Mar"]);
    expect(model.series.map((s) => s.name)).toEqual(["Sales", "Cost"]);
    expect(model.series[1].values).toEqual([2, 4, 6]);
  });

  test("numbers only: Series1.. names and no categories", () => {
    const ctx = makeContext([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    const d = detectChartSeries(ctx, {
      sheetId: "s1",
      row: [0, 2],
      column: [0, 1],
    });
    expect(d.headerRow).toBe(false);
    expect(d.headerColumn).toBe(false);
    expect(d.series.map((s) => s.name)).toEqual(["Series1", "Series2"]);
    const model = resolveChartModel(ctx, {
      id: "x",
      type: "line",
      series: d.series,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    expect(model.categories).toEqual([]);
    expect(model.series[0].values).toEqual([1, 3, 5]);
  });

  test("scatter uses the first numeric column as X values", () => {
    const ctx = makeContext([
      ["x", "y"],
      [1, 10],
      [2, 20],
      [4, 40],
    ]);
    const d = detectChartSeries(
      ctx,
      { sheetId: "s1", row: [0, 3], column: [0, 1] },
      { type: "scatter" }
    );
    expect(d.series).toHaveLength(1);
    expect(d.series[0].categories.column).toEqual([0, 0]);
    const model = resolveChartModel(ctx, {
      id: "x",
      type: "scatter",
      series: d.series,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    expect(model.series[0].xValues).toEqual([1, 2, 4]);
    expect(model.series[0].values).toEqual([10, 20, 40]);
    expect(model.series[0].name).toBe("y");
  });

  test("forced orientation", () => {
    const ctx = makeContext(table);
    const d = detectChartSeries(
      ctx,
      { sheetId: "s1", row: [0, 2], column: [0, 3] },
      { seriesInRows: false }
    );
    expect(d.series).toHaveLength(3);
    expect(d.series[2].values.column).toEqual([3, 3]);
  });
});

describe("chart objects", () => {
  test("insert from a single selected cell uses the current region", () => {
    const ctx = makeContext(table);
    ctx.luckysheet_select_save = [{ row: [1, 1], column: [1, 1] }];
    const chart = insertChart(ctx, { type: "column" });
    expect(chart).not.toBeNull();
    expect(ctx.activeChart).toBe(chart.id);
    const stored = ctx.luckysheetfile[0].charts;
    expect(stored).toHaveLength(1);
    expect(stored[0].source).toEqual({
      sheetId: "s1",
      row: [0, 2],
      column: [0, 3],
    });
    expect(stored[0].grouping).toBe("clustered");
    // placed right of the data, aligned with its first row
    expect(stored[0].left).toBe(4 * 74 + 16);
    expect(stored[0].top).toBe(0);
    expect(stored[0].width).toBe(480);
  });

  test("allowEdit=false blocks insertion", () => {
    const ctx = makeContext(table, { allowEdit: false });
    expect(insertChart(ctx)).toBeNull();
  });

  test("update, type change, switch row/column, paste and delete", () => {
    const ctx = makeContext(table);
    ctx.luckysheet_select_save = [{ row: [0, 2], column: [0, 3] }];
    const chart = insertChart(ctx, { type: "column" });
    updateChart(ctx, chart.id, { title: "Sales", legend: "bottom" });
    expect(findChart(ctx, chart.id).chart.title).toBe("Sales");

    setChartType(ctx, chart.id, "bar", "stacked");
    expect(findChart(ctx, chart.id).chart.grouping).toBe("stacked");
    setChartType(ctx, chart.id, "pie");
    expect(findChart(ctx, chart.id).chart.grouping).toBeUndefined();
    expect(findChart(ctx, chart.id).chart.gridlines).toBe(false);

    expect(findChart(ctx, chart.id).chart.series).toHaveLength(2);
    switchChartRowColumn(ctx, chart.id);
    const switched = findChart(ctx, chart.id).chart;
    expect(switched.seriesInRows).toBe(false);
    expect(switched.series).toHaveLength(3);

    updateChart(ctx, chart.id, {
      series: switched.series.map((s, i) =>
        i === 0 ? { ...s, color: "#123456" } : s
      ),
    });
    setChartSource(ctx, chart.id, switched.source, true);
    expect(findChart(ctx, chart.id).chart.series[0].color).toBe("#123456");

    const copy = pasteChart(ctx, findChart(ctx, chart.id).chart, {
      left: 5,
      top: 6,
    });
    expect(copy.id).not.toBe(chart.id);
    expect(ctx.luckysheetfile[0].charts).toHaveLength(2);
    expect(ctx.activeChart).toBe(copy.id);
    expect(copy.left).toBe(5);

    deleteChart(ctx);
    expect(ctx.luckysheetfile[0].charts).toHaveLength(1);
    expect(ctx.activeChart).toBeUndefined();
    deleteChart(ctx, chart.id);
    expect(ctx.luckysheetfile[0].charts).toHaveLength(0);
  });

  test("renders live values from the sheet", () => {
    const ctx = makeContext(table);
    ctx.luckysheet_select_save = [{ row: [0, 2], column: [0, 3] }];
    const chart = insertChart(ctx, { type: "column", title: "Regions" });
    let svg = renderChartToSvg(ctx, chart);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("Regions");
    expect(svg).toContain("North");
    expect(svg).toContain("Q3");
    ctx.luckysheetfile[0].data[1][0] = str("West");
    svg = renderChartToSvg(ctx, chart);
    expect(svg).toContain("West");
    expect(svg).not.toContain("North");
    // dark theme uses the dark chrome
    expect(renderChartToSvg({ ...ctx, theme: "dark" }, chart)).toContain(
      "#1e1f22"
    );
  });
});

describe("reference adjustment", () => {
  test("span helpers", () => {
    expect(shiftSpanForInsert([2, 5], 3, 2)).toEqual([2, 7]);
    expect(shiftSpanForInsert([2, 5], 2, 1)).toEqual([3, 6]);
    expect(shiftSpanForInsert([2, 5], 6, 1)).toEqual([2, 5]);
    expect(shiftSpanForDelete([2, 5], 0, 0)).toEqual([1, 4]);
    expect(shiftSpanForDelete([2, 5], 3, 4)).toEqual([2, 3]);
    expect(shiftSpanForDelete([2, 5], 1, 3)).toEqual([1, 2]);
    expect(shiftSpanForDelete([2, 5], 2, 5)).toBeNull();
    expect(shiftSpanForDelete([2, 5], 6, 9)).toEqual([2, 5]);
  });

  test("insert/delete rewrites series ranges and moves the chart", () => {
    const ctx = makeContext(table);
    ctx.luckysheet_select_save = [{ row: [0, 2], column: [0, 3] }];
    const chart = insertChart(ctx, { type: "line", top: 100, left: 10 });
    const other = insertChart(ctx, { type: "line", top: 5, left: 10 });
    adjustChartsForInsert(ctx, "s1", "row", 1, 2);
    let c = findChart(ctx, chart.id).chart;
    expect(c.series[0].values.row).toEqual([3, 3]);
    expect(c.series[0].categories.row).toEqual([0, 0]);
    expect(c.source.row).toEqual([0, 4]);
    // the chart sits below row 1, so it moves down by two default rows
    expect(c.top).toBe(140);

    adjustChartsForInsert(ctx, "s1", "row", 0, 1);
    c = findChart(ctx, chart.id).chart;
    expect(c.top).toBe(160);
    // a chart above the insertion point stays put
    expect(findChart(ctx, other.id).chart.top).toBe(25);
    expect(c.source.row).toEqual([1, 5]);

    adjustChartsForDelete(ctx, "s1", "column", 1, 1);
    c = findChart(ctx, chart.id).chart;
    expect(c.series[0].values.column).toEqual([1, 2]);

    adjustChartsForDelete(ctx, "s1", "row", 4, 4);
    c = findChart(ctx, chart.id).chart;
    // series 1 lived on the deleted row (#REF!), series 2 moved up
    expect(c.series[0].values).toBeNull();
    expect(c.series[1].values.row).toEqual([4, 4]);
    // other sheets are untouched
    adjustChartsForInsert(ctx, "s2", "row", 0, 5);
    expect(findChart(ctx, chart.id).chart.series[1].values.row).toEqual([4, 4]);
    // a deleted reference renders without throwing
    expect(renderChartToSvg(ctx, findChart(ctx, chart.id).chart)).toMatch(
      /<svg/
    );
  });

  test("insertRowCol and deleteRowCol hook into the adjuster", () => {
    const ctx = makeContext(table);
    ctx.luckysheet_select_save = [{ row: [0, 2], column: [0, 3] }];
    const chart = insertChart(ctx, { type: "column" });
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "s1",
    });
    let c = findChart(ctx, chart.id).chart;
    expect(c.source.row).toEqual([1, 3]);
    insertRowCol(ctx, {
      type: "column",
      index: 3,
      count: 2,
      direction: "rightbottom",
      id: "s1",
    });
    c = findChart(ctx, chart.id).chart;
    // inserted after column D: the range does not grow
    expect(c.source.column).toEqual([0, 3]);
    deleteRowCol(ctx, { type: "column", start: 1, end: 1, id: "s1" });
    c = findChart(ctx, chart.id).chart;
    expect(c.source.column).toEqual([0, 2]);
    expect(c.series[0].values.column).toEqual([1, 2]);
  });
});
