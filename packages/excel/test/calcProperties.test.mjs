// Workbook calculation options (core calculation.ts) <-> xlsx <calcPr>.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "@protobi/exceljs";
import {
  excelJsBytes,
  importXlsx,
  patchZip,
  roundTrip,
  zipText,
} from "./helpers.mjs";

function sheet(name, extra = {}) {
  return {
    name,
    order: 0,
    celldata: [{ r: 0, c: 0, v: { v: 1, m: "1", f: "=1" } }],
    ...extra,
  };
}

test("manual mode and iterative calculation survive export -> import", async () => {
  const calcSettings = {
    mode: "manual",
    iterate: true,
    maxIterations: 50,
    maxChange: 0.0001,
    fullCalcOnLoad: true,
  };
  const { bytes, result } = await roundTrip([
    sheet("One", { calcSettings }),
    sheet("Two", { order: 1 }),
  ]);
  const xml = await zipText(bytes, "xl/workbook.xml");
  const calcPr = /<calcPr\b[^>]*>/.exec(xml)[0];
  assert.match(calcPr, /calcMode="manual"/);
  assert.match(calcPr, /iterate="1"/);
  assert.match(calcPr, /iterateCount="50"/);
  assert.match(calcPr, /iterateDelta="0.0001"/);
  assert.match(calcPr, /fullCalcOnLoad="1"/);
  assert.equal((xml.match(/<calcPr\b/g) || []).length, 1);
  // every imported sheet carries the options
  result.sheets.forEach((s) => assert.deepEqual(s.calcSettings, calcSettings));
});

test("default options write a plain calcPr and import as nothing", async () => {
  const { bytes, result } = await roundTrip([
    sheet("Plain", { calcSettings: { mode: "auto" } }),
  ]);
  const calcPr = /<calcPr\b[^>]*>/.exec(
    await zipText(bytes, "xl/workbook.xml")
  )[0];
  assert.doesNotMatch(calcPr, /calcMode|iterate/);
  assert.equal(result.sheets[0].calcSettings, undefined);
});

test("calcPr written by other applications is read", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("S").getCell("A1").value = 1;
  const bytes = await patchZip(await excelJsBytes(wb), {
    "xl/workbook.xml": (xml) =>
      xml.replace(
        /<calcPr\b[^>]*\/>/,
        '<calcPr calcId="191029" calcMode="autoNoTable" iterate="true"/>'
      ),
  });
  const result = await importXlsx(bytes);
  assert.deepEqual(result.sheets[0].calcSettings, {
    mode: "autoNoTable",
    iterate: true,
  });
});
