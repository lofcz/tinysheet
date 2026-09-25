// Outline (Data › Group, Subtotal) round trips: outlineLevel / collapsed /
// hidden on rows and columns, sheetFormatPr outlineLevelRow/Col and
// outlinePr summaryBelow/summaryRight.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "@protobi/exceljs";
import {
  excelJsBytes,
  importXlsx,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

function sheet(name, cells, config) {
  return {
    name,
    order: 0,
    celldata: Object.entries(cells).map(([rc, v]) => {
      const [r, c] = rc.split("_").map(Number);
      return { r, c, v };
    }),
    config,
  };
}

const n = (v) => ({ v, m: `${v}`, ct: { fa: "General", t: "n" } });

test("row and column outline levels, collapsed groups and summary position", async () => {
  // rows 2-3 (level 2) collapsed under summary row 4; rows 2-5 level 1
  // (summary row 6); columns B-C grouped with the summary in A (left)
  const config = {
    rowOutlineLevel: { 1: 2, 2: 2, 3: 1, 4: 1 },
    rowOutlineCollapsed: { 3: 2 },
    rowhidden: { 1: 0, 2: 0 },
    colOutlineLevel: { 1: 1, 2: 1 },
    colOutlineCollapsed: { 0: 1 },
    colhidden: { 1: 0, 2: 0 },
    outlineSummaryRight: false,
  };
  const cells = {};
  for (let r = 0; r < 6; r += 1) cells[`${r}_0`] = n(r);
  cells["5_3"] = n(9);
  const { bytes, result } = await roundTrip([sheet("Outline", cells, config)]);

  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(xml, /<sheetFormatPr[^>]*outlineLevelRow="2"/);
  assert.match(xml, /<sheetFormatPr[^>]*outlineLevelCol="1"/);
  assert.match(xml, /<outlinePr[^>]*summaryRight="0"/);
  assert.match(xml, /<row r="2"[^>]*hidden="1"[^>]*outlineLevel="2"/);
  assert.match(xml, /<row r="4"[^>]*outlineLevel="1" collapsed="1"/);
  // detail rows are not "collapsed" (ExcelJS would mark every deepest row)
  assert.doesNotMatch(xml, /<row r="2"[^>]*collapsed/);
  assert.match(xml, /<col min="1" max="1"[^>]*collapsed="1"/);
  assert.match(
    xml,
    /<col min="2" max="[23]"[^>]*hidden="1"[^>]*outlineLevel="1"/
  );
  // rows with cells keep their default height
  assert.doesNotMatch(xml, /<row r="5"[^>]*customHeight/);

  const cfg = sheetByName(result, "Outline").config;
  assert.deepEqual(cfg.rowOutlineLevel, config.rowOutlineLevel);
  assert.deepEqual(cfg.colOutlineLevel, config.colOutlineLevel);
  assert.deepEqual(cfg.rowOutlineCollapsed, config.rowOutlineCollapsed);
  assert.deepEqual(cfg.colOutlineCollapsed, config.colOutlineCollapsed);
  assert.equal(cfg.outlineSummaryRight, false);
  assert.equal(cfg.outlineSummaryBelow, undefined);
  assert.deepEqual(Object.keys(cfg.rowhidden).sort(), ["1", "2"]);
});

test("a collapsed summary row past the data is still written", async () => {
  const config = {
    rowOutlineLevel: { 1: 1, 2: 1 },
    rowOutlineCollapsed: { 3: 1 },
    rowhidden: { 1: 0, 2: 0 },
  };
  const { bytes, result } = await roundTrip([
    sheet("Tail", { "0_0": n(1), "1_0": n(2), "2_0": n(3) }, config),
  ]);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(xml, /<row r="4"[^>]*collapsed="1"/);
  const cfg = sheetByName(result, "Tail").config;
  assert.deepEqual(cfg.rowOutlineCollapsed, { 3: 1 });
});

test("outlines written by Excel (ExcelJS) are read", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("FromExcel");
  for (let r = 1; r <= 6; r += 1) ws.getCell(r, 1).value = r;
  ws.getRow(2).outlineLevel = 1;
  ws.getRow(3).outlineLevel = 1;
  ws.getColumn(2).outlineLevel = 1;
  ws.properties.outlineLevelRow = 1;
  ws.properties.outlineLevelCol = 1;
  ws.properties.outlineProperties = { summaryBelow: false, summaryRight: true };
  const result = await importXlsx(await excelJsBytes(wb));
  const cfg = sheetByName(result, "FromExcel").config;
  assert.deepEqual(cfg.rowOutlineLevel, { 1: 1, 2: 1 });
  assert.deepEqual(cfg.colOutlineLevel, { 1: 1 });
  assert.equal(cfg.outlineSummaryBelow, false);
  // ExcelJS marks level-1 rows "collapsed" although nothing is hidden:
  // no group is collapsed then
  assert.equal(cfg.rowOutlineCollapsed, undefined);
});

test("sheets without an outline write no outline attributes", async () => {
  const { bytes, result } = await roundTrip([sheet("Plain", { "0_0": n(1) })]);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.doesNotMatch(xml, /outlineLevel|outlinePr/);
  const cfg = sheetByName(result, "Plain").config || {};
  assert.equal(cfg.rowOutlineLevel, undefined);
});
