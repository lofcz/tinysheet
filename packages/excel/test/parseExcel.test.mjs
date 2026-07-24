import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "@protobi/exceljs";
import * as core from "@lofcz/tinysheet-core";
import {
  parseExcel,
  applyExcelImportHydration,
  refreshSheetChartImages,
  resolveChartSpecToSeries,
  computeAxisScale,
  computeNiceAxisMax,
  formatAxisTick,
  renderChartSvgFromSeries,
  DEFAULT_CHART_COLORS,
} from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const toBuffer = (part) => {
  if (Buffer.isBuffer(part)) return part;
  if (part instanceof ArrayBuffer) return Buffer.from(part);
  if (ArrayBuffer.isView(part)) {
    return Buffer.from(part.buffer, part.byteOffset, part.byteLength);
  }
  if (typeof part === "string") return Buffer.from(part);
  throw new TypeError(`Unsupported file part: ${typeof part}`);
};

globalThis.File = function TestFile(parts, name, options = {}) {
  const buffer = Buffer.concat(parts.map(toBuffer));
  buffer.name = name;
  buffer.type = options.type ?? "";
  buffer.lastModified = options.lastModified ?? Date.now();
  buffer.arrayBuffer = async () =>
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  buffer.text = async () => buffer.toString();
  return buffer;
};

const fixturePath = path.resolve(__dirname, "fixtures", "xls_preview.xlsx");
const drawingObjectsFixturePath = path.resolve(
  __dirname,
  "fixtures",
  "issue17336_drawing_objects.xlsx"
);
const openpyxlBarChartFixturePath = path.resolve(
  __dirname,
  "fixtures",
  "openpyxl_bar_chart.xlsx"
);

const getCell = (sheet, row, column) =>
  sheet.celldata.find((cell) => cell.r === row && cell.c === column);

const toFile = async (filePath, fileName) => {
  const buffer = await fs.readFile(filePath);
  return new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

test("parseExcel converts xls_preview.xlsx into Prospera sheets", async () => {
  const result = await parseExcel(await toFile(fixturePath, "xls_preview.xlsx"));
  assert.equal(result.sheets.length, 1);
  const [sheet] = result.sheets;
  assert.equal(sheet.name, "Feuille1");
  assert.ok(result.sizing[0].id);

  const b2 = getCell(sheet, 1, 1);
  assert.ok(b2);
  assert.equal(b2.v.v, "552150");
});

test("parseExcel keeps one-cell anchored drawing objects visible", async () => {
  const result = await parseExcel(
    await toFile(drawingObjectsFixturePath, "issue17336_drawing_objects.xlsx")
  );
  const [sheet] = result.sheets;
  const images = sheet.images || [];
  assert.ok(images.length >= 3);

  const svgImages = images.filter((image) =>
    String(image.src).startsWith("data:image/svg+xml")
  );
  assert.ok(svgImages.length >= 2);
});

test("parseExcel imports openpyxl default-namespace bar charts with chartSpec", async () => {
  const result = await parseExcel(
    await toFile(openpyxlBarChartFixturePath, "openpyxl_bar_chart.xlsx")
  );
  const [sheet] = result.sheets;
  const images = sheet.images || [];
  assert.ok(images.length >= 1);

  const chartImage = images.find((image) => image.chartSpec);
  assert.ok(chartImage, "expected chartSpec on chart image");
  assert.equal(chartImage.chartSpec.type, "bar");
  assert.equal(chartImage.fromCol, 6);
  assert.equal(chartImage.fromRow, 2);
  assert.ok(chartImage.chartSpec.series.length >= 1);
  assert.equal(chartImage.chartSpec.series[0].mode, "category");
});

test("parseExcel keeps formula text without empty cached values", async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Grades");
  worksheet.getCell("A1").value = 1;
  worksheet.getCell("A2").value = 3;
  worksheet.getCell("A3").value = { formula: "AVERAGE(A1:A2)" };

  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await parseExcel(
    new File([workbookBuffer], "formulas.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  const a3 = getCell(result.sheets[0], 2, 0);
  assert.ok(a3);
  assert.equal(a3.v.f, "=AVERAGE(A1:A2)");
  assert.equal(a3.v.v, undefined);
});

test("applyExcelImportHydration calculates formulas and refreshes chart SVGs", async () => {
  const result = await parseExcel(
    await toFile(openpyxlBarChartFixturePath, "openpyxl_bar_chart.xlsx")
  );
  const [sheet] = result.sheets;

  const FormulaCache = core.FormulaCache;
  assert.ok(FormulaCache, "core should export FormulaCache");

  const ctx = {
    currentSheetId: sheet.id,
    calculateSheetId: sheet.id,
    luckysheetfile: [
      {
        ...sheet,
        data: null,
      },
    ],
    config: sheet.config || {},
    insertedImgs: sheet.images,
    defaultrowNum: 84,
    defaultcolumnNum: 60,
    formulaCache: new FormulaCache(),
    groupValuesRefreshData: [],
  };

  ctx.luckysheetfile[0].data = core.api.celldataToData(
    sheet.celldata,
    sheet.row,
    sheet.column
  );

  applyExcelImportHydration(ctx, result);

  const live = ctx.luckysheetfile[0];
  const e4 = live.data[3][4];
  assert.ok(e4);
  assert.ok(typeof e4.v === "number" || e4.v != null);

  const chartImage = (live.images || []).find((image) => image.chartSpec);
  assert.ok(chartImage);
  const chartSvg = decodeURIComponent(String(chartImage.src).split(",")[1]);
  assert.match(chartSvg, /<svg /);
  assert.match(chartSvg, /Anna Nov/);
  // Single-series category charts vary point colors (Office palette).
  assert.match(chartSvg, /#4472C4/);
  assert.match(chartSvg, /#ED7D31/);
  assert.equal(ctx.insertedImgs, live.images);
  assert.equal(chartImage.chartSpec.varyColors, true);
  assert.ok(chartImage.chartSpec.title);
  assert.ok(chartImage.chartSpec.categoryAxisTitle);
  assert.ok(chartImage.chartSpec.valueAxisTitle);
  assert.match(chartSvg, new RegExp(chartImage.chartSpec.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(
    chartSvg,
    new RegExp(chartImage.chartSpec.valueAxisTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("chart axis uses Excel-like 1-2-5 step ticks", () => {
  // data max 2.67 → pad 5% → ~2.80 → step 0.5 → ticks 0..3
  const scale = computeAxisScale(1.33, 2.67);
  assert.equal(scale.step, 0.5);
  assert.equal(scale.min, 0);
  assert.equal(scale.max, 3);
  assert.deepEqual(scale.ticks, [0, 0.5, 1, 1.5, 2, 2.5, 3]);
  assert.equal(computeNiceAxisMax(2.67), 3);

  assert.equal(formatAxisTick(0, 0.5), "0");
  assert.equal(formatAxisTick(0.5, 0.5), "0.5");
  assert.equal(formatAxisTick(1.5, 0.5), "1.5");
  assert.equal(formatAxisTick(3, 0.5), "3");

  const svg = renderChartSvgFromSeries(
    [
      { label: "A", value: 1.33, color: DEFAULT_CHART_COLORS[0] },
      { label: "B", value: 2.67, color: DEFAULT_CHART_COLORS[1] },
    ],
    320,
    200,
  );
  assert.match(svg, />0\.5<\/text>/);
  assert.match(svg, />1\.5<\/text>/);
  assert.match(svg, />2\.5<\/text>/);
  assert.doesNotMatch(svg, />1<\/text>[\s\S]*>1<\/text>/);
  assert.match(svg, /#4472C4/);
  assert.match(svg, /#ED7D31/);
});

test("chart axis honors explicit min/max/majorUnit overrides", () => {
  const scale = computeAxisScale(1.33, 2.67, {
    min: 0,
    max: 4,
    majorUnit: 1,
  });
  assert.equal(scale.min, 0);
  assert.equal(scale.max, 4);
  assert.equal(scale.step, 1);
  assert.deepEqual(scale.ticks, [0, 1, 2, 3, 4]);

  const maxOnly = computeAxisScale(1.33, 2.67, { max: 2.5 });
  assert.equal(maxOnly.max, 2.5);
  assert.ok(maxOnly.ticks[maxOnly.ticks.length - 1] <= 2.5 + 1e-9);

  const unitOnly = computeAxisScale(1.33, 2.67, { majorUnit: 0.25 });
  assert.equal(unitOnly.step, 0.25);
  assert.ok(unitOnly.ticks.includes(0.25));
  assert.ok(unitOnly.ticks.includes(2.75) || unitOnly.max >= 2.75);

  const svg = renderChartSvgFromSeries(
    [
      { label: "A", value: 1.33, color: DEFAULT_CHART_COLORS[0] },
      { label: "B", value: 2.67, color: DEFAULT_CHART_COLORS[1] },
    ],
    320,
    200,
    { valueAxis: { min: 0, max: 4, majorUnit: 1 } },
  );
  assert.match(svg, />4<\/text>/);
  assert.doesNotMatch(svg, />0\.5<\/text>/);
});

test("parseExcel imports value-axis scaling overrides from chart XML", async () => {
  const JSZip = (await import("jszip")).default;
  const fixture = await fs.readFile(openpyxlBarChartFixturePath);
  const zip = await JSZip.loadAsync(fixture);
  const chartPath = Object.keys(zip.files).find((name) =>
    /xl\/charts\/chart\d*\.xml$/i.test(name),
  );
  assert.ok(chartPath, "expected chart xml in fixture");
  let chartXml = await zip.file(chartPath).async("string");

  chartXml = chartXml.replace(
    /(<(?:c:)?valAx\b[\s\S]*?<(?:c:)?scaling>)([\s\S]*?)(<\/(?:c:)?scaling>)([\s\S]*?)(<\/(?:c:)?valAx>)/,
    (_, scaleOpen, scaleInner, scaleClose, mid, valClose) => {
      const ns = scaleOpen.includes("c:") ? "c:" : "";
      return (
        scaleOpen +
        scaleInner +
        `<${ns}min val="0"/><${ns}max val="5"/>` +
        scaleClose +
        mid +
        `<${ns}majorUnit val="1"/>` +
        valClose
      );
    },
  );
  assert.match(chartXml, /min val="0"/);
  assert.match(chartXml, /majorUnit val="1"/);

  zip.file(chartPath, chartXml);
  const patched = await zip.generateAsync({ type: "nodebuffer" });
  const result = await parseExcel(
    new File([patched], "openpyxl_bar_chart_axis.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const chartImage = (result.sheets[0].images || []).find(
    (image) => image.chartSpec,
  );
  assert.ok(chartImage);
  assert.deepEqual(chartImage.chartSpec.valueAxis, {
    min: 0,
    max: 5,
    majorUnit: 1,
  });

  const chartSvg = decodeURIComponent(String(chartImage.src).split(",")[1]);
  assert.match(chartSvg, />5<\/text>/);
  assert.match(chartSvg, />1<\/text>/);
});

test("resolveChartSpecToSeries prefers live resolver over empty caches", () => {
  const spec = {
    type: "bar",
    width: 100,
    height: 80,
    series: [
      {
        color: "#4472C4",
        mode: "category",
        categoryRef: "A1:A2",
        valueRef: "B1:B2",
        cachedValues: [0, 0],
      },
    ],
  };
  const series = resolveChartSpecToSeries(spec, (ref) => {
    if (ref === "A1:A2") {
      return [
        { display: "A", numeric: null },
        { display: "B", numeric: null },
      ];
    }
    return [
      { display: "2", numeric: 2 },
      { display: "4", numeric: 4 },
    ];
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].value, 2);
  assert.equal(series[1].value, 4);

  const refreshed = refreshSheetChartImages(
    [{ id: "1", src: "old", chartSpec: spec }],
    (ref) => {
      if (ref === "A1:A2") {
        return [
          { display: "A", numeric: null },
          { display: "B", numeric: null },
        ];
      }
      return [
        { display: "2", numeric: 2 },
        { display: "4", numeric: 4 },
      ];
    }
  );
  assert.ok(refreshed[0].src.startsWith("data:image/svg+xml"));
  assert.notEqual(refreshed[0].src, "old");
});
