// Chart behaviour matched to Excel: number formats linked to source,
// per-point outlines, chart data ranges made of several areas, Quick
// Layouts per chart type, chart shapes, effects and WordArt, chart sheets.
import {
  applyChartQuickLayout,
  chartAxisFormats,
  chartNameSources,
  chartQuickLayoutElements,
  chartQuickLayouts,
  chartRangeToText,
  getChartDataRange,
  insertChart,
  parseChartRange,
  setChartDataRange,
  setChartNameSource,
  renderChartToSvg,
  resolveChartModel,
  FormulaCache,
  alignObjects,
  buildPrintJob,
  deleteSheet,
  duplicateSheet,
  hideSheets,
  renameSheet,
  canGroupObjects,
  chartSheetChart,
  isChartSheet,
  moveChartToNewSheet,
  moveChartToObject,
  canRotateObjects,
  chartShapeBox,
  changeChartShape,
  distributeObjects,
  effectsAttr,
  getChartBox,
  groupObjects,
  insertChartShape,
  insertShape,
  regroupObjects,
  rotateObjects,
  selectedObjects,
  selectObjects,
  setChartShapeBox,
  toggleObject,
  ungroupObjects,
} from "../../src";

const num = (v, fa = "General") => ({
  v,
  m: String(v),
  ct: { fa, t: "n" },
});
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeContext(rows, formats = {}) {
  const data = [];
  for (let r = 0; r < 14; r += 1) {
    const row = [];
    for (let c = 0; c < 8; c += 1) {
      const v = rows[r]?.[c];
      if (v == null) row.push(null);
      else if (typeof v === "number") row.push(num(v, formats[c]));
      else row.push(str(v));
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
      { name: "Sheet2", id: "s2", data: [], order: 1, config: {} },
    ],
  };
}

const TABLE = [
  ["Month", "Revenue", "Share"],
  ["Jan", 12000, 0.2],
  ["Feb", 13500, 0.25],
  ["Mar", 15000, 0.3],
  ["Apr", 11000, 0.25],
];

/** Tick labels of the value axis (text of the axis group). */
function valueTicks(svg) {
  const group = /data-chart-el="valueAxis"[^>]*>([\s\S]*?)<\/g>/.exec(svg);
  return group
    ? Array.from(group[1].matchAll(/<text[^>]*>([^<]*)<\/text>/g)).map(
        (m) => m[1]
      )
    : [];
}

describe("axis number format: linked to source (Excel)", () => {
  it("the value axis takes the first value cell's format", () => {
    const ctx = makeContext(TABLE, { 1: "#,##0" });
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 1] }];
    const chart = insertChart(ctx, { type: "column" });
    expect(chartAxisFormats(ctx, chart)).toEqual({ value: "#,##0" });
    const svg = renderChartToSvg(ctx, chart, "light", {
      width: 480,
      height: 288,
    });
    expect(valueTicks(svg)).toContain("12,000");
  });

  it("percentages and currency from the source cells", () => {
    const ctx = makeContext(TABLE, { 2: "0%" });
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [2, 2] }];
    const chart = insertChart(ctx, { type: "line" });
    expect(resolveChartModel(ctx, chart).axisFormats).toEqual({
      value: "0%",
    });
    const svg = renderChartToSvg(ctx, chart, "light", {
      width: 480,
      height: 288,
    });
    expect(valueTicks(svg)).toContain("30%");
  });

  it("an own format code when not linked; General stays plain", () => {
    const ctx = makeContext(TABLE, { 1: "#,##0" });
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 1] }];
    const chart = insertChart(ctx, { type: "column" });
    chart.valueAxis = { numberFormat: '"$"#,##0.00', sourceLinked: false };
    expect(chartAxisFormats(ctx, chart)).toEqual({ value: '"$"#,##0.00' });
    const svg = renderChartToSvg(ctx, chart, "light", {
      width: 480,
      height: 288,
    });
    expect(valueTicks(svg)).toContain("$12,000.00");
    chart.valueAxis = { numberFormat: "General", sourceLinked: false };
    expect(
      valueTicks(
        renderChartToSvg(ctx, chart, "light", { width: 480, height: 288 })
      )
    ).toContain("12000");
  });

  it("scatter X axis links to the X cells; category text keeps its look", () => {
    const ctx = makeContext(
      [
        ["X", "Y"],
        [0.1, 5],
        [0.2, 6],
      ],
      { 0: "0.0%" }
    );
    ctx.luckysheet_select_save = [{ row: [0, 2], column: [0, 1] }];
    const chart = insertChart(ctx, { type: "scatter" });
    expect(chartAxisFormats(ctx, chart)).toEqual({ category: "0.0%" });
    chart.categoryAxisFormat = { numberFormat: "0.00", sourceLinked: false };
    expect(chartAxisFormats(ctx, chart)).toEqual({ category: "0.00" });
  });

  it("histograms count, so they are never linked", () => {
    const ctx = makeContext(TABLE, { 1: "#,##0" });
    ctx.luckysheet_select_save = [{ row: [1, 4], column: [1, 1] }];
    const chart = insertChart(ctx, { type: "histogram" });
    expect(chartAxisFormats(ctx, chart)).toBeUndefined();
  });
});

const UNION_TABLE = [
  ["Month", "Revenue", "Cost", "Profit"],
  ["Jan", 120, 80, 40],
  ["Feb", 135, 90, 45],
  ["Mar", 150, 95, 55],
  ["Apr", 110, 85, 25],
];

describe("chart data range of several areas (Excel)", () => {
  it("columns left out: =A1:A5,C1:D5 plots Cost and Profit", () => {
    const ctx = makeContext(UNION_TABLE);
    const chart = insertChart(ctx, { type: "column" });
    setChartDataRange(
      ctx,
      chart,
      parseChartRange(ctx, "Sheet1!$A$1:$A$5,Sheet1!$C$1:$D$5", "s1")
    );
    expect(chart.series.map((s) => chartRangeToText(ctx, s.values))).toEqual([
      "Sheet1!$C$2:$C$5",
      "Sheet1!$D$2:$D$5",
    ]);
    expect(chartRangeToText(ctx, chart.series[0].categories)).toBe(
      "Sheet1!$A$2:$A$5"
    );
    // shown back as its areas, not "too complex"
    expect(chartRangeToText(ctx, getChartDataRange(chart))).toBe(
      "(Sheet1!$A$1:$A$5,Sheet1!$C$1:$D$5)"
    );
  });

  it("rows left out: each series takes the pieces (a union)", () => {
    const ctx = makeContext(UNION_TABLE);
    const chart = insertChart(ctx, { type: "column" });
    setChartDataRange(ctx, chart, parseChartRange(ctx, "A1:C2,A4:C5", "s1"));
    expect(chart.series).toHaveLength(2);
    expect(chartRangeToText(ctx, chart.series[0].values)).toBe(
      "(Sheet1!$B$2,Sheet1!$B$4:$B$5)"
    );
    expect(chartRangeToText(ctx, getChartDataRange(chart))).toBe(
      "(Sheet1!$A$1:$C$2,Sheet1!$A$4:$C$5)"
    );
  });

  it("irregular series stay too complex", () => {
    const ctx = makeContext(UNION_TABLE);
    const chart = insertChart(ctx, { type: "column" });
    // Cost one point shorter than Revenue (Microsoft's example)
    chart.series[1].values = parseChartRange(ctx, "C2:C4", "s1");
    expect(getChartDataRange(chart)).toBeNull();
    // series out of order
    const other = insertChart(ctx, { type: "column" });
    other.series.reverse();
    expect(getChartDataRange(other)).toBeNull();
  });
});

describe("Quick Layouts per chart type (Excel's gallery)", () => {
  it("column charts: the eleven layouts' elements", () => {
    const ctx = makeContext(UNION_TABLE);
    const chart = insertChart(ctx, { type: "column" });
    expect(chartQuickLayouts(chart)).toHaveLength(11);
    expect(chartQuickLayoutElements(6, chart)).toEqual([
      "chartTitle",
      "dataLabelsLast:outsideEnd",
      "valueAxisTitle",
      "categoryAxis",
      "valueAxis",
      "majorGridlines",
    ]);
    applyChartQuickLayout(chart, 7);
    expect(chart.minorGridlines).toBe(true);
    expect(chart.valueAxisTitle).toBe("Axis Title");
    expect(chart.categoryAxisTitle).toBe("Axis Title");
    expect(chart.title).toBeUndefined();
    applyChartQuickLayout(chart, 5);
    expect(chart.dataTable).toEqual({ legendKeys: true });
    expect(chart.legend).toBe("none");
  });

  it("Layout 6 labels the last category only", () => {
    const ctx = makeContext(UNION_TABLE);
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 1] }];
    const chart = insertChart(ctx, { type: "column" });
    applyChartQuickLayout(chart, 6);
    expect(chart.dataLabelOptions.lastPointOnly).toBe(true);
    const svg = renderChartToSvg(ctx, chart, "light", {
      width: 480,
      height: 288,
    });
    // 110 (Apr, the last point) is labelled, 135 (Feb) is not
    expect(svg).toMatch(/>110<\/text>/);
    expect(svg).not.toMatch(/>135<\/text>/);
    applyChartQuickLayout(chart, 10);
    expect(chart.dataLabelOptions.lastPointOnly).toBeUndefined();
  });

  it("pie charts: seven layouts; 1 and 4 name the slices, 2 and 6 percent", () => {
    const ctx = makeContext(UNION_TABLE);
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 1] }];
    const chart = insertChart(ctx, { type: "pie" });
    expect(chartQuickLayouts(chart)).toHaveLength(7);
    applyChartQuickLayout(chart, 1);
    expect(chart.legend).toBe("none");
    expect(chart.dataLabelOptions).toMatchObject({
      showCategory: true,
      showPercent: true,
      showValue: false,
    });
    applyChartQuickLayout(chart, 6);
    expect(chart.dataLabelOptions).toMatchObject({
      showCategory: false,
      showPercent: true,
    });
    expect(chart.legend).toBe("right");
    applyChartQuickLayout(chart, 3);
    expect(chart.dataLabels).toBe(false);
    expect(chart.legend).toBe("bottom");
  });
});

describe("Chart Filters › Names (Excel)", () => {
  it("lists the header row / column and (None); switching renames", () => {
    const ctx = makeContext(UNION_TABLE);
    ctx.luckysheet_select_save = [{ row: [0, 4], column: [0, 2] }];
    const chart = insertChart(ctx, { type: "column" });
    const sources = chartNameSources(chart);
    expect(sources.series).toEqual({ kind: "row", current: 0, options: [0] });
    expect(sources.categories).toEqual({
      kind: "column",
      current: 0,
      options: [0],
    });
    expect(setChartNameSource(chart, "series", null)).toBe(true);
    const model = resolveChartModel(ctx, chart);
    expect(model.series.map((s) => s.name)).toEqual(["Series1", "Series2"]);
    setChartNameSource(chart, "series", 0);
    expect(resolveChartModel(ctx, chart).series.map((s) => s.name)).toEqual([
      "Revenue",
      "Cost",
    ]);
    setChartNameSource(chart, "categories", null);
    expect(chart.series[0].categories).toBeUndefined();
    expect(resolveChartModel(ctx, chart).categories).toEqual([]);
  });
});

describe("Shape Effects and WordArt on chart elements", () => {
  it("draws shadow, glow, soft edges and bevel as SVG filters", () => {
    const ctx = makeContext(UNION_TABLE);
    const chart = insertChart(ctx, { type: "column" });
    chart.title = "Sales";
    chart.series[0].effects = {
      glow: { color: "#ED7D31", size: 8 },
      softEdges: 5,
    };
    chart.formats = {
      plotArea: { effects: { bevel: { preset: "circle" } } },
      title: {
        textOutline: "#FF0000",
        textEffects: {
          shadow: { kind: "outer", dir: 45, dist: 3, blur: 4 },
          reflection: { size: 0.5 },
        },
      },
    };
    const svg = renderChartToSvg(ctx, chart, "light", {
      width: 480,
      height: 288,
    });
    const series =
      /<g data-chart-el="series:0" filter="url\(#(ts-fx-[a-z0-9]+)\)"/.exec(
        svg
      );
    expect(series).toBeTruthy();
    // its filter is defined once, with a glow and soft edges
    const def = new RegExp(`<filter id="${series[1]}"[^]*?</filter>`).exec(
      svg
    )[0];
    expect(def).toMatch(/feMorphology in="SourceAlpha" operator="erode"/);
    expect(def).toMatch(/flood-color="#ED7D31"/);
    expect(svg).toMatch(/feSpecularLighting/);
    // text outline and a mirrored copy (reflection) of the title
    expect(svg).toMatch(
      /<g data-chart-el="title"><text filter="url\(#ts-fx-[a-z0-9]+\)" stroke="#FF0000"/
    );
    expect(svg).toMatch(/transform="matrix\(1 0 0 -1 0 [\d.]+\)" opacity=/);
    expect(effectsAttr(undefined)).toBe("");
  });
});

describe("shapes drawn in a chart (Insert Shapes)", () => {
  it("insert, move, change and keep them inside the chart", () => {
    const ctx = makeContext(UNION_TABLE);
    const chart = insertChart(ctx, { type: "column" });
    const s = insertChartShape(chart, "rect");
    expect(s.name).toBe("Rectangle 1");
    expect(chartShapeBox(chart, s)).toEqual({
      left: (chart.width - 96) / 2,
      top: (chart.height - 64) / 2,
      width: 96,
      height: 64,
    });
    setChartShapeBox(chart, s.id, {
      left: 1000,
      top: -20,
      width: 50,
      height: 40,
    });
    const box = chartShapeBox(chart, chart.shapes[0]);
    expect(box.left + box.width).toBeCloseTo(chart.width);
    expect(box.top).toBe(0);
    changeChartShape(chart, s.id, "ellipse");
    expect(chart.shapes[0].prst).toBe("ellipse");
    const tb = insertChartShape(chart, "textBox", undefined, "Note");
    expect(tb.textBox).toBe(true);
    expect(tb.text.paragraphs[0].runs[0].text).toBe("Note");
  });
});

describe("Arrange: charts and shapes selected together", () => {
  function twoCharts() {
    const ctx = makeContext(UNION_TABLE);
    const a = insertChart(ctx, { type: "column" });
    const b = insertChart(ctx, { type: "line" });
    a.left = 300;
    a.top = 40;
    b.left = 420;
    b.top = 200;
    delete a.anchor;
    delete b.anchor;
    ctx.luckysheetfile[0].charts = [a, b];
    return { ctx, a, b };
  }

  it("Ctrl+click builds a multi-selection; one chart alone is active", () => {
    const { ctx, a, b } = twoCharts();
    selectObjects(ctx, [{ kind: "chart", id: a.id }]);
    expect(ctx.activeChart).toBe(a.id);
    toggleObject(ctx, { kind: "chart", id: b.id });
    expect(ctx.activeChart).toBeUndefined();
    expect(ctx.selectedCharts).toEqual([a.id, b.id]);
    toggleObject(ctx, { kind: "chart", id: b.id });
    expect(ctx.activeChart).toBe(a.id);
  });

  it("aligns, groups (with a shape), ungroups and regroups", () => {
    const { ctx, a, b } = twoCharts();
    const shape = insertShape(ctx, "rect", {
      box: { left: 100, top: 400, width: 80, height: 40 },
    });
    selectObjects(ctx, [
      { kind: "chart", id: a.id },
      { kind: "chart", id: b.id },
    ]);
    alignObjects(ctx, "left");
    expect(getChartBox(ctx, "s1", b).left).toBe(getChartBox(ctx, "s1", a).left);
    alignObjects(ctx, "top");
    expect(getChartBox(ctx, "s1", b).top).toBe(40);
    toggleObject(ctx, { kind: "shape", id: shape.id });
    expect(selectedObjects(ctx)).toHaveLength(3);
    expect(canGroupObjects(ctx)).toBe(true);
    expect(canRotateObjects(ctx)).toBe(false);
    const group = groupObjects(ctx);
    expect(a.group).toBe(group);
    expect(b.group).toBe(group);
    expect(ctx.luckysheetfile[0].shapes[0].group).toBe(group);
    // a click on one member selects the whole group
    selectObjects(ctx, [{ kind: "chart", id: a.id }]);
    expect(selectedObjects(ctx)).toHaveLength(3);
    ungroupObjects(ctx);
    expect(a.group).toBeUndefined();
    expect(a.ungroupedFrom).toBe(group);
    regroupObjects(ctx);
    expect(a.group).toBe(group);
    expect(ctx.luckysheetfile[0].shapes[0].group).toBe(group);
  });

  it("distributes three objects; rotates shapes only", () => {
    const { ctx, a, b } = twoCharts();
    const shape = insertShape(ctx, "rect", {
      box: { left: 2000, top: 0, width: 100, height: 50 },
    });
    selectObjects(ctx, [
      { kind: "chart", id: a.id },
      { kind: "chart", id: b.id },
      { kind: "shape", id: shape.id },
    ]);
    distributeObjects(ctx, "horizontal");
    const boxes = [getChartBox(ctx, "s1", a), getChartBox(ctx, "s1", b)];
    const gap1 = boxes[1].left - (boxes[0].left + boxes[0].width);
    const gap2 = 2000 - (boxes[1].left + boxes[1].width);
    expect(Math.abs(gap1 - gap2)).toBeLessThan(2);
    selectObjects(ctx, [{ kind: "shape", id: shape.id }]);
    rotateObjects(ctx, "right");
    expect(ctx.luckysheetfile[0].shapes[0].rot).toBe(90);
    rotateObjects(ctx, "flipH");
    expect(ctx.luckysheetfile[0].shapes[0].flipH).toBe(true);
  });
});

describe("chart sheets (Move Chart › New sheet)", () => {
  const settings = { generateSheetId: () => "chart-sheet-1" };

  it("a chart sheet before the chart's sheet; Object in removes it", () => {
    const ctx = makeContext(UNION_TABLE);
    ctx.hooks = {};
    ctx.defaultrowNum = 84;
    ctx.defaultcolumnNum = 60;
    const chart = insertChart(ctx, { type: "column" });
    const id = moveChartToNewSheet(ctx, settings, chart.id, "Chart1");
    expect(id).toBe("chart-sheet-1");
    const sheet = ctx.luckysheetfile.find((s) => s.id === id);
    expect(sheet.chartSheet).toBe(true);
    expect(sheet.showGridLines).toBe(0);
    expect(sheet.showRowColHeaders).toBe(false);
    expect(sheet.charts.map((c) => c.id)).toEqual([chart.id]);
    expect(ctx.luckysheetfile[0].charts).toEqual([]);
    // placed before the worksheet it came from (Excel)
    expect(sheet.order).toBe(0);
    expect(ctx.luckysheetfile[0].order).toBe(1);
    expect(isChartSheet(sheet)).toBe(true);
    expect(chartSheetChart(sheet).id).toBe(chart.id);
    // it prints its chart alone on one landscape page
    const job = buildPrintJob(ctx, { sheetId: id });
    expect(job.pages.map((p) => p.kind)).toEqual(["chart"]);
    expect(job.pages[0].layout.setup.orientation).toBe("landscape");

    moveChartToObject(ctx, chart.id, "s1");
    expect(ctx.luckysheetfile.some((s) => s.id === id)).toBe(false);
    expect(ctx.luckysheetfile[0].charts.map((c) => c.id)).toEqual([chart.id]);
    expect(ctx.luckysheetfile[0].charts[0].width).toBe(480);
  });

  it("copy, rename, hide and delete work on a chart sheet", () => {
    const ctx = makeContext(UNION_TABLE);
    ctx.hooks = {};
    ctx.defaultrowNum = 84;
    ctx.defaultcolumnNum = 60;
    const chart = insertChart(ctx, { type: "column" });
    const id = moveChartToNewSheet(ctx, settings, chart.id, "Chart1");
    const copyId = duplicateSheet(ctx, id);
    const copy = ctx.luckysheetfile.find((s) => s.id === copyId);
    expect(copy.chartSheet).toBe(true);
    expect(copy.charts).toHaveLength(1);
    expect(copy.charts[0].id).not.toBe(chart.id);
    // its series still read the worksheet
    expect(copy.charts[0].series[0].values.sheetId).toBe("s1");
    expect(renameSheet(ctx, id, "Revenue chart")).toBeNull();
    expect(ctx.luckysheetfile.find((s) => s.id === id).name).toBe(
      "Revenue chart"
    );
    expect(hideSheets(ctx, [copyId])).toBe(true);
    deleteSheet(ctx, id);
    expect(ctx.luckysheetfile.some((s) => s.id === id)).toBe(false);
  });
});
