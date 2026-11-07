import test from "node:test";
import assert from "node:assert/strict";
import { Workbook, readXlsx, writeXlsx } from "@lofcz/ts-xlsx";
import { FormulaCache, api } from "@lofcz/tinysheet-core";
import {
  applyExcelImportHydration,
  captureExcelWorkbook,
  exportToXlsx,
  parseExcel,
} from "../dist/index.js";
import { patchZip, zipText } from "./helpers.mjs";

test("import, hydrate, JSON save/reload and edited export retain original package features", async () => {
  const workbook = new Workbook();
  const source = workbook.addWorksheet("Data");
  source.addRows([
    ["Quarter", "Sales"],
    ["Q1", 10],
    ["Q2", 20],
  ]);
  source.getCell("B4").value = { formula: "SUM(B2:B3)", result: 30 };
  source.getCell("B2").font = {
    name: "Aptos",
    color: { theme: 4 },
    bold: true,
  };
  source.addChart(
    {
      type: "column",
      title: "Sales",
      categories: { formula: "Data!A2:A3", values: ["Q1", "Q2"] },
      series: [
        { name: "Sales", values: { formula: "Data!B2:B3", values: [10, 20] } },
      ],
    },
    { tl: { col: 3, row: 0 }, ext: { width: 400, height: 240 } }
  );
  source.addShape(
    { name: "Annotation", text: "Keep me", fill: "AABBCC" },
    { tl: { col: 3, row: 15 }, ext: { width: 200, height: 80 } }
  );
  source.addCheckbox("C2", true);
  const bytes = await patchZip(writeXlsx(workbook), {
    "xl/worksheets/sheet1.xml": (xml) =>
      xml.replace(
        "</worksheet>",
        '<ignoredErrors><ignoredError sqref="B2" numberStoredAsText="1"/></ignoredErrors></worksheet>'
      ),
    "xl/charts/chart1.xml": (xml) =>
      xml.replace(
        "</c:chartSpace>",
        '<c:extLst><c:ext uri="urn:retained"><custom:data xmlns:custom="urn:retained">foreign chart setting</custom:data></c:ext></c:extLst></c:chartSpace>'
      ),
  });
  const imported = await parseExcel(bytes, "source.xlsx");
  assert.ok(imported.preservation?.source);
  const sheet = imported.sheets[0];
  const context = {
    currentSheetId: sheet.id,
    calculateSheetId: sheet.id,
    luckysheetfile: [
      {
        ...sheet,
        data: api.celldataToData(sheet.celldata, sheet.row, sheet.column),
      },
    ],
    config: sheet.config || {},
    insertedImgs: sheet.images,
    defaultrowNum: 84,
    defaultcolumnNum: 60,
    formulaCache: new FormulaCache(),
    groupValuesRefreshData: [],
  };
  context.luckysheetfile[0].calcChain = [
    { r: 3, c: 1, id: sheet.id },
    { r: 3, c: 1, id: sheet.id },
    { r: 10, c: 1, id: sheet.id },
  ];
  applyExcelImportHydration(context, imported);
  assert.deepEqual(context.luckysheetfile[0].calcChain, [{ r: 3, c: 1, id: sheet.id }]);
  assert.equal(context.luckysheetfile[0].data[3][1].v, 30);
  context.luckysheetfile[0].data[1][1].v = 42;
  context.luckysheetfile[0].charts[0].title = "Updated Sales";
  context.luckysheetfile[0].charts[0].formats = {
    chartArea: { fill: "#CCDDFF" },
  };
  context.luckysheetfile[0].shapes[0].text.paragraphs[0].runs[0].text =
    "Updated annotation";
  const saved = captureExcelWorkbook({
    getAllSheets: () => context.luckysheetfile,
    getWorkbookMetadata: () => context.workbookMetadata,
  });
  const reloaded = JSON.parse(JSON.stringify(saved));
  const diagnostics = [];
  const exported = await exportToXlsx(reloaded.sheets, {
    preservation: reloaded.preservation,
    onDiagnostic: (item) => diagnostics.push(item),
  });
  const result = readXlsx(exported).requireWorksheet("Data");
  assert.equal(result.getCell("B2").value, 42);
  assert.deepEqual(result.getCell("B2").font.color, { theme: 4 });
  assert.equal(result.charts.length, 1);
  assert.equal(result.charts[0].options.title, "Updated Sales");
  assert.equal(result.shapes.length, 1);
  assert.deepEqual(result.checkboxes, ["C2"]);
  assert.deepEqual(result.charts[0].options.series[0].values.values, [42, 20]);
  assert.match(
    await zipText(exported, "xl/worksheets/sheet1.xml"),
    /ignoredError sqref="B2"/
  );
  assert.match(
    await zipText(exported, "xl/charts/chart1.xml"),
    /foreign chart setting/
  );
  assert.match(await zipText(exported, "xl/charts/chart1.xml"), /CCDDFF/);
  assert.match(
    await zipText(exported, "xl/drawings/drawing1.xml"),
    /Updated annotation/
  );
  assert.equal(diagnostics.length, 0);
});

test("preservation is optional and survives sanitized names and deletion diagnostics", async () => {
  const workbook = new Workbook();
  workbook.addWorksheet("Kept").getCell("A1").value = 1;
  workbook.addWorksheet("Deleted");
  const bytes = writeXlsx(workbook);
  assert.equal(
    (await parseExcel(bytes, undefined, { preserve: false })).preservation,
    undefined
  );
  const imported = await parseExcel(bytes);
  imported.sheets[0].name = "Renamed:Tab";
  const diagnostics = [];
  const out = await exportToXlsx([imported.sheets[0]], {
    preservation: imported.preservation,
    onDiagnostic: (item) => diagnostics.push(item),
  });
  assert.equal(readXlsx(out).worksheets[0].name, "Renamed_Tab");
  assert.ok(diagnostics.some((item) => item.code === "sheet-deleted"));
});
