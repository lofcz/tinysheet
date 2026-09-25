/**
 * xlsx import/export of the round 2 chart features: combo charts with a
 * secondary axis, radar, bubble, stock, chartex types (waterfall,
 * histogram, Pareto, funnel), trendlines, error bars, data label options
 * and the anchoring mode.
 */
// eslint-disable-next-line import/no-relative-packages
import JSZip from "../../../excel/node_modules/jszip";
// eslint-disable-next-line import/no-relative-packages
import ExcelJS from "../../../excel/node_modules/@protobi/exceljs";
import { importChartXml } from "../../../excel/src/chart/importXlsx";
import {
  addChartsToXlsx,
  chartToXml,
} from "../../../excel/src/chart/exportXlsx";
import {
  chartExToXml,
  importChartExXml,
} from "../../../excel/src/chart/chartEx";
import { exportSheetExcel } from "../../../excel/src/ToExcel/ExcelFile";
import { parseExcel } from "../../../excel/src/parse/parseExcel";
import { IFileType } from "../../../excel/src/common/ICommon";
import { parseChartRange } from "../../src";

const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeSheet() {
  const rows = [
    ["Month", "Revenue", "Cost", "Size"],
    ["Jan", 120, 80, 5],
    ["Feb", 135, 90, 7],
    ["Mar", 150, 95, 9],
  ];
  const data = [];
  for (let r = 0; r < 10; r += 1) {
    const row = [];
    for (let c = 0; c < 6; c += 1) {
      const v = rows[r]?.[c];
      if (v == null) row.push(null);
      else row.push(typeof v === "number" ? num(v) : str(v));
    }
    data.push(row);
  }
  return { name: "Data", id: "1", order: 0, data, config: {} };
}

const range = (r1, r2, c1, c2) => ({
  sheetId: "1",
  row: [r1, r2],
  column: [c1, c2],
});

function makeChart(extra = {}) {
  return {
    id: "c1",
    type: "column",
    grouping: "clustered",
    series: [1, 2].map((c) => ({
      nameRef: range(0, 0, c, c),
      values: range(1, 3, c, c),
      categories: range(1, 3, 0, 0),
    })),
    title: "T",
    legend: "right",
    left: 300,
    top: 40,
    width: 480,
    height: 288,
    ...extra,
  };
}

const ctxFor = (sheet) => ({ luckysheetfile: [sheet] });
const opts = (sheet) => ({
  resolveRange: (ref) => parseChartRange(ctxFor(sheet), ref, "1"),
});
const roundTrip = (chart) => {
  const sheet = makeSheet();
  const xml = chartToXml(ctxFor(sheet), chart);
  return { xml, back: importChartXml(xml, opts(sheet)) };
};

describe("DrawingML round 2", () => {
  test("combo with a line on the secondary axis", () => {
    const chart = makeChart({
      type: "combo",
      secondaryValueAxisTitle: "Cost axis",
      secondaryValueAxis: { max: 200 },
    });
    chart.series[0].type = "column";
    chart.series[1].type = "line";
    chart.series[1].secondary = true;
    const { xml, back } = roundTrip(chart);
    expect(xml).toContain("<c:barChart>");
    expect(xml).toContain("<c:lineChart>");
    expect(xml).toContain('<c:axPos val="r"/>');
    expect(xml).toContain('<c:crosses val="max"/>');
    expect(back.type).toBe("combo");
    expect(back.series.map((s) => s.type)).toEqual(["column", "line"]);
    expect(back.series[1].secondary).toBe(true);
    expect(back.series[0].secondary).toBeUndefined();
    expect(back.secondaryValueAxisTitle).toBe("Cost axis");
    expect(back.secondaryValueAxis).toEqual({ max: 200 });
  });

  test("a column chart with a secondary series stays a column chart", () => {
    const chart = makeChart();
    chart.series[1].secondary = true;
    const { xml, back } = roundTrip(chart);
    expect((xml.match(/<c:barChart>/g) || []).length).toBe(2);
    expect(back.type).toBe("column");
    expect(back.series[1].secondary).toBe(true);
  });

  test("radar, bubble and stock charts", () => {
    const radar = roundTrip(makeChart({ type: "radar", radarStyle: "filled" }));
    expect(radar.xml).toContain('<c:radarStyle val="filled"/>');
    expect(radar.back.type).toBe("radar");
    expect(radar.back.radarStyle).toBe("filled");

    const bubbleChart = makeChart({ type: "bubble", bubbleScale: 50 });
    bubbleChart.series = [
      {
        nameRef: range(0, 0, 1, 1),
        values: range(1, 3, 1, 1),
        categories: range(1, 3, 2, 2),
        sizes: range(1, 3, 3, 3),
      },
    ];
    const bubble = roundTrip(bubbleChart);
    expect(bubble.xml).toContain("<c:bubbleSize><c:numRef><c:f>Data!$D$2:$D$4");
    expect(bubble.back.type).toBe("bubble");
    expect(bubble.back.series[0].sizes).toEqual(range(1, 3, 3, 3));
    expect(bubble.back.series[0].cache.sizes).toEqual([5, 7, 9]);
    expect(bubble.back.bubbleScale).toBe(50);

    const stockChart = makeChart({ type: "stock", stockVariant: "ohlc" });
    stockChart.series = [1, 2, 3, 1].map((c) => ({
      values: range(1, 3, c, c),
      categories: range(1, 3, 0, 0),
    }));
    const stock = roundTrip(stockChart);
    expect(stock.xml).toContain("<c:hiLowLines>");
    expect(stock.xml).toContain("<c:upDownBars>");
    expect(stock.back.type).toBe("stock");
    expect(stock.back.stockVariant).toBe("ohlc");
  });

  test("trendlines, error bars and data label options", () => {
    const chart = makeChart({
      type: "line",
      dataLabels: true,
      dataLabelOptions: {
        showCategory: true,
        position: "above",
        numberFormat: "0.0",
        separator: "; ",
      },
    });
    chart.series[0].trendlines = [
      {
        type: "polynomial",
        order: 3,
        forward: 2,
        displayEquation: true,
        displayRSquared: true,
      },
      { type: "movingAverage", period: 2 },
    ];
    chart.series[1].errorBars = {
      type: "custom",
      plus: range(1, 3, 3, 3),
      include: "plus",
      endCap: false,
    };
    const { xml, back } = roundTrip(chart);
    // schema order inside c:ser: trendline before errBars before cat/val
    expect(xml.indexOf("<c:trendline>")).toBeLessThan(xml.indexOf("<c:cat>"));
    expect(xml).toContain('<c:trendlineType val="poly"/><c:order val="3"/>');
    expect(xml).toContain('<c:dLblPos val="t"/>');
    expect(back.series[0].trendlines).toEqual([
      {
        type: "polynomial",
        order: 3,
        forward: 2,
        displayEquation: true,
        displayRSquared: true,
        color: "#4472C4",
      },
      { type: "movingAverage", period: 2, color: "#4472C4" },
    ]);
    expect(back.series[1].errorBars).toEqual({
      type: "custom",
      include: "plus",
      endCap: false,
      plus: range(1, 3, 3, 3),
    });
    expect(back.dataLabels).toBe(true);
    expect(back.dataLabelOptions).toEqual({
      showCategory: true,
      position: "above",
      numberFormat: "0.0",
      separator: "; ",
    });
  });

  test("positions Excel rejects for a chart type are not written", () => {
    const { xml } = roundTrip(
      makeChart({
        grouping: "stacked",
        dataLabels: true,
        dataLabelOptions: { position: "outsideEnd" },
      })
    );
    expect(xml).not.toContain("<c:dLblPos");
  });
});

describe("chartex parts", () => {
  const exRoundTrip = (chart) => {
    const sheet = makeSheet();
    const xml = chartExToXml(ctxFor(sheet), chart);
    return { xml, back: importChartExXml(xml, opts(sheet)) };
  };
  const single = (extra) => {
    const chart = makeChart(extra);
    chart.series = [chart.series[0]];
    return chart;
  };

  test("waterfall with totals and no connectors", () => {
    const { xml, back } = exRoundTrip(
      single({
        type: "waterfall",
        waterfallTotals: [2],
        waterfallConnectors: false,
        dataLabels: true,
      })
    );
    expect(xml).toContain('layoutId="waterfall"');
    expect(xml).toContain('<cx:subtotals><cx:idx val="2"/></cx:subtotals>');
    expect(back.type).toBe("waterfall");
    expect(back.waterfallTotals).toEqual([2]);
    expect(back.waterfallConnectors).toBe(false);
    expect(back.series[0].values).toEqual(range(1, 3, 1, 1));
    expect(back.series[0].categories).toEqual(range(1, 3, 0, 0));
    expect(back.title).toBe("T");
    expect(back.dataLabels).toBe(true);
  });

  test("histogram bins and Pareto", () => {
    const hist = exRoundTrip(
      single({
        type: "histogram",
        binning: { mode: "width", width: 10, overflow: 140 },
      })
    );
    expect(hist.xml).toContain('<cx:binSize val="10"/>');
    expect(hist.back.type).toBe("histogram");
    expect(hist.back.binning).toEqual({
      mode: "width",
      width: 10,
      overflow: 140,
    });
    const pareto = exRoundTrip(single({ type: "pareto" }));
    expect(pareto.xml).toContain('layoutId="paretoLine"');
    expect(pareto.xml).toContain("<cx:aggregation/>");
    expect(pareto.back.type).toBe("pareto");
  });

  test("funnel", () => {
    const { xml, back } = exRoundTrip(
      single({ type: "funnel", legend: "none" })
    );
    expect(xml).toContain('layoutId="funnel"');
    expect(back.type).toBe("funnel");
    expect(back.legend).toBe("none");
    expect(
      importChartExXml("<cx:chartSpace/>", { resolveRange: () => null })
    ).toBeNull();
  });

  test("addChartsToXlsx writes chartex parts with an AlternateContent anchor", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Data").getCell("A1").value = "x";
    const buffer = await workbook.xlsx.writeBuffer();
    const sheet = makeSheet();
    sheet.charts = [
      single({ type: "waterfall" }),
      makeChart({ id: "c2", placement: "absolute" }),
    ];
    const zip = await JSZip.loadAsync(await addChartsToXlsx(buffer, [sheet]));
    expect(zip.file("xl/charts/chartEx1.xml")).toBeTruthy();
    expect(zip.file("xl/charts/chart1.xml")).toBeTruthy();
    const types = await zip.file("[Content_Types].xml").async("string");
    expect(types).toContain(
      'PartName="/xl/charts/chartEx1.xml" ContentType="application/vnd.ms-office.chartex+xml"'
    );
    const drawing = await zip.file("xl/drawings/drawing1.xml").async("string");
    expect(drawing).toContain('Requires="cx1"');
    expect(drawing).toContain('editAs="absolute"');
    const rels = await zip
      .file("xl/drawings/_rels/drawing1.xml.rels")
      .async("string");
    expect(rels).toContain(
      "http://schemas.microsoft.com/office/2014/relationships/chartEx"
    );
  });
});

describe("xlsx round trip of new charts and anchoring", () => {
  test("types, anchors and placement survive export and import", async () => {
    const sheet = makeSheet();
    const combo = makeChart({ type: "combo", placement: "oneCell" });
    combo.series[0].type = "column";
    combo.series[1].type = "line";
    combo.series[1].secondary = true;
    const waterfall = makeChart({
      id: "c2",
      type: "waterfall",
      top: 400,
      waterfallTotals: [0],
    });
    waterfall.series = [waterfall.series[0]];
    sheet.charts = [
      {
        ...combo,
        anchor: {
          from: { row: 2, col: 4, rowOff: 5, colOff: 10 },
          to: { row: 16, col: 10, rowOff: 0, colOff: 0 },
        },
      },
      waterfall,
    ];
    const blob = await exportSheetExcel(
      { current: { getAllSheets: () => [sheet], getSheet: () => sheet } },
      IFileType.XLSX,
      false
    );
    const buffer = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(blob);
    });
    const result = await parseExcel(buffer, "roundtrip2.xlsx");
    const [imported] = result.sheets;
    expect(imported.charts).toHaveLength(2);
    const [c1, c2] = imported.charts;
    expect(c1.type).toBe("combo");
    expect(c1.series[1].secondary).toBe(true);
    expect(c1.placement).toBe("oneCell");
    expect(c1.anchor.from).toMatchObject({ row: 2, col: 4 });
    expect(Math.round(c1.anchor.from.colOff)).toBe(10);
    expect(c2.type).toBe("waterfall");
    expect(c2.waterfallTotals).toEqual([0]);
    expect(c2.placement).toBe("twoCell");
    // the text-box fallback of the chartex anchor is not imported
    expect(imported.images ?? []).toHaveLength(0);
  });
});
