/**
 * xlsx chart import/export (packages/excel/src/chart). Lives with the chart
 * tests so it runs under the root jest config.
 */
// jszip and exceljs are dependencies of the excel package only; the root
// jest config cannot resolve them from here, so import them by path.
// eslint-disable-next-line import/no-relative-packages
import JSZip from "../../../excel/node_modules/jszip";
// eslint-disable-next-line import/no-relative-packages
import ExcelJS from "../../../excel/node_modules/@protobi/exceljs";
import { importChartXml } from "../../../excel/src/chart/importXlsx";
import {
  addChartsToXlsx,
  chartToXml,
  pixelToCell,
} from "../../../excel/src/chart/exportXlsx";
import { parseXml, find } from "../../../excel/src/chart/xml";
import { exportSheetExcel } from "../../../excel/src/ToExcel/ExcelFile";
import { parseExcel } from "../../../excel/src/parse/parseExcel";
import { IFileType } from "../../../excel/src/common/ICommon";
import { parseChartRange, resolveChartModel } from "../../src";

const num = (v) => ({ v, m: String(v), ct: { fa: "General", t: "n" } });
const str = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

function makeSheet() {
  const rows = [
    ["Month", "Revenue", "Cost"],
    ["Jan", 120, 80],
    ["Feb", 135, 90],
    ["Mar", 150, 95],
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
  return { name: "My Sheet", id: "1", order: 0, data, config: {} };
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
    title: "Sales & costs",
    categoryAxisTitle: "Month",
    valueAxisTitle: "USD",
    legend: "bottom",
    dataLabels: true,
    left: 300,
    top: 40,
    width: 480,
    height: 288,
    ...extra,
  };
}

const ctxFor = (sheet) => ({ luckysheetfile: [sheet] });
const resolver = (sheet) => (ref) => parseChartRange(ctxFor(sheet), ref, "1");

describe("xml helper", () => {
  test("parses prefixed and default-namespace elements", () => {
    const tree = parseXml(
      '<?xml version="1.0"?><c:a x="1&amp;2"><b>t&lt;x</b><c:d/></c:a>'
    );
    expect(find(tree, "a").attrs.x).toBe("1&2");
    expect(find(tree, "b").text).toBe("t<x");
    expect(find(tree, "d")).toBeTruthy();
  });
});

describe("chart XML import", () => {
  test("reads an openpyxl-style bar chart (default namespace)", () => {
    const xml =
      '<chartSpace xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns="http://schemas.openxmlformats.org/drawingml/2006/chart"><chart><title><tx><rich><a:bodyPr /><a:p><a:r><a:t>Grades</a:t></a:r></a:p></rich></tx></title><plotArea><barChart><barDir val="bar" /><grouping val="stacked" /><ser><idx val="0" /><order val="0" /><tx><strRef><f>\'My Sheet\'!B1</f></strRef></tx><cat><numRef><f>\'My Sheet\'!$A$2:$A$4</f></numRef></cat><val><numRef><f>\'My Sheet\'!$B$2:$B$4</f></numRef></val></ser><axId val="10" /><axId val="100" /></barChart><catAx><axId val="10" /><title><tx><rich><a:p><a:r><a:t>Pupil</a:t></a:r></a:p></rich></tx></title></catAx><valAx><axId val="100" /><scaling><orientation val="minMax"/><max val="5"/></scaling><majorGridlines /></valAx></plotArea><legend><legendPos val="t" /></legend></chart></chartSpace>';
    const sheet = makeSheet();
    const chart = importChartXml(xml, { resolveRange: resolver(sheet) });
    expect(chart.type).toBe("bar");
    expect(chart.grouping).toBe("stacked");
    expect(chart.title).toBe("Grades");
    expect(chart.categoryAxisTitle).toBe("Pupil");
    expect(chart.legend).toBe("top");
    expect(chart.gridlines).toBe(true);
    expect(chart.valueAxis).toEqual({ max: 5 });
    expect(chart.series[0].values).toEqual(range(1, 3, 1, 1));
    expect(chart.series[0].nameRef).toEqual(range(0, 0, 1, 1));
    const model = resolveChartModel(ctxFor(sheet), {
      ...chart,
      id: "x",
      left: 0,
      top: 0,
      width: 10,
      height: 10,
    });
    expect(model.series[0].name).toBe("Revenue");
    expect(model.categories).toEqual(["Jan", "Feb", "Mar"]);
  });

  test("unsupported families return null; caches back unresolved refs", () => {
    expect(
      importChartXml(
        "<c:chartSpace><c:chart><c:plotArea><c:radarChart/></c:plotArea></c:chart></c:chartSpace>",
        { resolveRange: () => null }
      )
    ).toBeNull();
    const chart = importChartXml(
      '<c:chartSpace><c:chart><c:plotArea><c:pieChart><c:varyColors val="1"/><c:ser><c:tx><c:v>Lit</c:v></c:tx><c:dPt><c:idx val="1"/><c:spPr><a:solidFill><a:srgbClr val="ff0000"/></a:solidFill></c:spPr></c:dPt><c:cat><c:strRef><c:f>[1]Other!$A$1:$A$2</c:f><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>a</c:v></c:pt><c:pt idx="1"><c:v>b</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numLit><c:ptCount val="2"/><c:pt idx="0"><c:v>1</c:v></c:pt><c:pt idx="1"><c:v>3</c:v></c:pt></c:numLit></c:val></c:ser></c:pieChart></c:plotArea></c:chart></c:chartSpace>',
      { resolveRange: () => null }
    );
    expect(chart.type).toBe("pie");
    expect(chart.legend).toBe("none");
    expect(chart.series[0].name).toBe("Lit");
    expect(chart.series[0].values).toBeNull();
    expect(chart.series[0].cache).toEqual({
      categories: ["a", "b"],
      values: [1, 3],
    });
    expect(chart.series[0].pointColors).toEqual(["", "#FF0000"]);
  });
});

describe("chart XML export", () => {
  test.each([
    ["column", "clustered", "barChart"],
    ["bar", "percentStacked", "barChart"],
    ["line", "stacked", "lineChart"],
    ["area", "clustered", "areaChart"],
    ["pie", undefined, "pieChart"],
    ["doughnut", undefined, "doughnutChart"],
    ["scatter", undefined, "scatterChart"],
  ])("%s %s round-trips through importChartXml", (type, grouping, element) => {
    const sheet = makeSheet();
    const chart = makeChart({ type, grouping, markers: type === "line" });
    const xml = chartToXml(ctxFor(sheet), chart);
    expect(xml).toContain(`<c:${element}>`);
    expect(xml).toContain("Sales &amp; costs");
    expect(xml).toContain("<c:f>'My Sheet'!$B$2:$B$4</c:f>");
    const back = importChartXml(xml, { resolveRange: resolver(sheet) });
    expect(back.type).toBe(type);
    expect(back.grouping).toBe(grouping);
    expect(back.title).toBe("Sales & costs");
    expect(back.legend).toBe("bottom");
    expect(back.dataLabels).toBe(true);
    expect(back.series).toHaveLength(2);
    expect(back.series[1].values).toEqual(range(1, 3, 2, 2));
    expect(back.series[1].cache.values).toEqual([80, 90, 95]);
    const axes = type !== "pie" && type !== "doughnut";
    expect(back.categoryAxisTitle).toBe(axes ? "Month" : undefined);
    expect(back.valueAxisTitle).toBe(axes ? "USD" : undefined);
  });

  test("pixelToCell accounts for grid lines and hidden columns", () => {
    const sizes = () => 73;
    expect(pixelToCell(0, sizes, () => false)).toEqual({
      index: 0,
      offsetPx: 0,
    });
    expect(pixelToCell(80, sizes, () => false)).toEqual({
      index: 1,
      offsetPx: 6,
    });
    // column A hidden: 80px lands 6px into column C
    expect(pixelToCell(80, sizes, (i) => i === 0)).toEqual({
      index: 2,
      offsetPx: 6,
    });
  });

  test("addChartsToXlsx adds chart parts next to exceljs output", async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("My Sheet");
    ws.getCell("A1").value = "x";
    const buffer = await workbook.xlsx.writeBuffer();
    const sheet = makeSheet();
    sheet.charts = [makeChart(), makeChart({ id: "c2", type: "pie" })];
    const out = await addChartsToXlsx(buffer, [sheet]);
    const zip = await JSZip.loadAsync(out);
    expect(zip.file("xl/charts/chart1.xml")).toBeTruthy();
    expect(zip.file("xl/charts/chart2.xml")).toBeTruthy();
    const types = await zip.file("[Content_Types].xml").async("string");
    expect(types).toContain("/xl/charts/chart2.xml");
    expect(types).toContain("/xl/drawings/drawing1.xml");
    const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
    expect(sheetXml).toMatch(/<drawing r:id="rId\d+"\/>/);
    const drawing = await zip.file("xl/drawings/drawing1.xml").async("string");
    expect((drawing.match(/<xdr:graphicFrame/g) || []).length).toBe(2);
    const rels = await zip
      .file("xl/drawings/_rels/drawing1.xml.rels")
      .async("string");
    expect(rels).toContain("../charts/chart2.xml");
  });
});

describe("xlsx round trip", () => {
  test("exported charts import as live chart objects", async () => {
    const sheet = makeSheet();
    sheet.charts = [
      makeChart(),
      makeChart({ id: "c2", type: "line", markers: false, left: 10, top: 300 }),
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
    const result = await parseExcel(buffer, "roundtrip.xlsx");
    const [imported] = result.sheets;
    expect(imported.charts).toHaveLength(2);
    const [column, line] = imported.charts;
    expect(column.type).toBe("column");
    expect(column.title).toBe("Sales & costs");
    expect(column.series[0].values.row).toEqual([1, 3]);
    expect(column.series[0].values.sheetId).toBe(imported.id);
    expect(line.type).toBe("line");
    expect(line.markers).toBe(false);
    // Charts are anchored to cells; pixel positions drift only by the
    // default column width conversion of the export/import pair.
    expect(Math.abs(column.left - 300)).toBeLessThan(12);
    expect(Math.abs(column.top - 40)).toBeLessThan(6);
    expect(Math.abs(column.width - 480)).toBeLessThan(24);
    // no chart images for converted charts
    expect(imported.images ?? []).toHaveLength(0);
  });
});
