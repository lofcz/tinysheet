// Round trips of phase 2 features through xlsx: cell alignment and
// protection attributes (P9), data validation details (P6), tables (P3) and
// notes shown permanently.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "@protobi/exceljs";
import {
  cellMap,
  excelJsBytes,
  importXlsx,
  readWithExcelJS,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

function sheet(name, cells, extra = {}) {
  return {
    name,
    order: 0,
    celldata: Object.entries(cells).map(([rc, v]) => {
      const [r, c] = rc.split("_").map(Number);
      return { r, c, v };
    }),
    ...extra,
  };
}

test("shrink to fit, indent, locked and hidden survive export -> import", async () => {
  const { bytes, result } = await roundTrip([
    sheet("Fmt", {
      "0_0": { v: "shrunk", m: "shrunk", sk: 1 },
      "1_0": { v: "indented", m: "indented", ht: 1, ind: 3 },
      "2_0": { v: "right", m: "right", ht: 2, ind: 2 },
      "3_0": { v: 1, m: "1", ct: { fa: "General", t: "n" }, lo: 0 },
      "4_0": { v: 2, m: "2", f: "=1+1", hi: 1 },
      "5_0": { v: 3, m: "3", lo: 0, hi: 1 },
      // an indent without left/right alignment has no effect: not written
      "6_0": { v: "plain", m: "plain", ind: 4 },
    }),
  ]);
  const ws = (await readWithExcelJS(bytes)).getWorksheet("Fmt");
  assert.equal(ws.getCell("A1").alignment.shrinkToFit, true);
  assert.equal(ws.getCell("A2").alignment.indent, 3);
  assert.equal(ws.getCell("A2").alignment.horizontal, "left");
  assert.equal(ws.getCell("A3").alignment.indent, 2);
  assert.equal(ws.getCell("A4").protection.locked, false);
  assert.equal(ws.getCell("A5").protection.hidden, true);
  assert.equal(ws.getCell("A7").alignment?.indent, undefined);

  const cells = cellMap(sheetByName(result, "Fmt"));
  assert.equal(cells.get("0_0").sk, 1);
  assert.equal(cells.get("1_0").ind, 3);
  assert.equal(String(cells.get("1_0").ht), "1");
  assert.equal(cells.get("2_0").ind, 2);
  assert.equal(cells.get("3_0").lo, 0);
  assert.equal(cells.get("3_0").hi, undefined);
  assert.equal(cells.get("4_0").hi, 1);
  assert.equal(cells.get("4_0").lo, undefined);
  assert.equal(cells.get("5_0").lo, 0);
  assert.equal(cells.get("5_0").hi, 1);
  assert.equal(cells.get("0_0").lo, undefined);
  assert.equal(cells.get("6_0").ind, undefined);
});

function rule(extra) {
  return {
    type: "custom",
    type2: "",
    value1: "B2>A2",
    value2: "",
    checked: false,
    remote: false,
    prohibitInput: true,
    hintShow: false,
    hintValue: "",
    ...extra,
  };
}

test("data validation: anchors, error styles and input messages", async () => {
  // B2:B4 share one rule anchored at B2 (relative formula B2>A2); D3:D4 keep
  // a rule whose anchor D2 is gone; F2 warns, G2 informs, H2 asks for input
  const anchored = rule({ anchor: { r: 1, c: 1 } });
  const orphan = rule({ value1: "D2>C2", anchor: { r: 1, c: 3 } });
  const dataVerification = {
    "1_1": anchored,
    "2_1": anchored,
    "3_1": anchored,
    "2_3": orphan,
    "3_3": orphan,
    "1_5": {
      ...rule({ type: "number", type2: "lessThan", value1: "10" }),
      errorStyle: "warning",
      errorTitle: "Careful",
      errorMessage: "Should be below 10",
      anchor: { r: 1, c: 5 },
    },
    "1_6": {
      ...rule({ type: "number_integer", type2: "between", value1: "1" }),
      value2: "=$A$1",
      errorStyle: "information",
      anchor: { r: 1, c: 6 },
    },
    "1_7": {
      ...rule({
        type: "dropdown",
        type2: "",
        value1: "yes,no",
        prohibitInput: false,
        hintShow: true,
        hintValue: "Pick one",
        hintTitle: "Answer",
        ignoreBlank: false,
      }),
      anchor: { r: 1, c: 7 },
    },
  };
  const { bytes, result } = await roundTrip([
    sheet("DV", { "0_0": { v: 5, m: "5" } }, { dataVerification }),
  ]);

  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  // one rule per rectangle, its formula relative to the top-left cell
  assert.match(xml, /sqref="B2:B4"[^>]*>\s*<formula1>B2&gt;A2<\/formula1>/);
  assert.match(xml, /sqref="D3:D4"[^>]*>\s*<formula1>D3&gt;C3<\/formula1>/);
  assert.match(xml, /errorStyle="warning"/);
  assert.match(xml, /errorStyle="information"/);
  assert.match(xml, /promptTitle="Answer"/);
  assert.match(xml, /<formula2>\$A\$1<\/formula2>/);

  const dv = sheetByName(result, "DV").dataVerification;
  ["1_1", "2_1", "3_1"].forEach((key) => {
    assert.equal(dv[key].value1, "B2>A2");
    assert.deepEqual(dv[key].anchor, { r: 1, c: 1 });
  });
  // re-anchored at the rule's new top-left cell, formula shifted with it
  assert.equal(dv["2_3"].value1, "D3>C3");
  assert.deepEqual(dv["2_3"].anchor, { r: 2, c: 3 });

  assert.equal(dv["1_5"].type, "number");
  assert.equal(dv["1_5"].prohibitInput, true);
  assert.equal(dv["1_5"].errorStyle, "warning");
  assert.equal(dv["1_5"].errorTitle, "Careful");
  assert.equal(dv["1_5"].errorMessage, "Should be below 10");
  assert.equal(dv["1_6"].errorStyle, "information");
  assert.equal(dv["1_6"].value2, "=$A$1");
  assert.equal(dv["1_1"].errorStyle, "stop");

  assert.equal(dv["1_7"].prohibitInput, false);
  assert.equal(dv["1_7"].errorStyle, undefined);
  assert.equal(dv["1_7"].hintShow, true);
  assert.equal(dv["1_7"].hintValue, "Pick one");
  assert.equal(dv["1_7"].hintTitle, "Answer");
  assert.equal(dv["1_7"].ignoreBlank, false);
  assert.equal(dv["1_1"].ignoreBlank, true);
});

test("tables become xlsx table parts and come back", async () => {
  const tables = [
    {
      name: "Sales",
      range: { row: [0, 3], column: [0, 2] },
      headerRow: true,
      totalRow: true,
      bandedRows: true,
      bandedColumns: false,
      firstColumn: false,
      lastColumn: true,
      style: "TableStyleMedium3",
      columns: [
        { name: "Item", totalFunction: "none", totalLabel: "Total" },
        { name: "Price", totalFunction: "average" },
        { name: "Double", totalFunction: "sum" },
      ],
    },
  ];
  const cells = {
    "0_0": { v: "Item", m: "Item" },
    "0_1": { v: "Price", m: "Price" },
    "0_2": { v: "Double", m: "Double" },
    "1_0": { v: "a", m: "a" },
    "1_1": { v: 2, m: "2", ct: { fa: "General", t: "n" } },
    "1_2": { v: 4, m: "4", f: "=[@Price]*2" },
    "2_0": { v: "b", m: "b" },
    "2_1": { v: 3, m: "3", ct: { fa: "General", t: "n" } },
    "2_2": { v: 6, m: "6", f: "=[@Price]*2" },
    "3_0": { v: "Total", m: "Total" },
    "3_1": { v: 2.5, m: "2.5", f: "=SUBTOTAL(101,[Price])" },
    "3_2": { v: 10, m: "10", f: "=SUBTOTAL(109,[Double])" },
    "5_0": { v: 2.5, m: "2.5", f: "=AVERAGE(Sales[Price])" },
  };
  const { bytes, result } = await roundTrip([sheet("T", cells, { tables })]);

  const part = await zipText(bytes, "xl/tables/table1.xml");
  assert.ok(part, "table part written");
  assert.match(part, /displayName="Sales"/);
  assert.match(part, /ref="A1:C4"/);
  assert.match(part, /totalsRowCount="1"/);
  assert.match(part, /name="Price"[^>]*totalsRowFunction="average"/);
  assert.match(part, /name="TableStyleMedium3"/);
  assert.match(part, /showRowStripes="1"/);
  assert.match(part, /showLastColumn="1"/);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  // structured references as Excel stores them
  assert.match(xml, /<f>Sales\[\[#This Row\],\[Price\]\]\*2<\/f>/);
  assert.match(xml, /<f>SUBTOTAL\(109,Sales\[Double\]\)<\/f>/);
  assert.match(xml, /<f>AVERAGE\(Sales\[Price\]\)<\/f>/);

  const back = sheetByName(result, "T");
  assert.deepEqual(back.tables, tables);
  const map = cellMap(back);
  assert.equal(map.get("1_2").f, "=[@Price]*2");
  assert.equal(map.get("3_1").f, "=SUBTOTAL(101,[Price])");
  assert.equal(map.get("3_2").f, "=SUBTOTAL(109,[Double])");
  assert.equal(map.get("5_0").f, "=AVERAGE(Sales[Price])");
  assert.equal(map.get("0_1").v, "Price");
  assert.equal(map.get("1_1").v, 2);
});

test("tables made in Excel get TinySheet's table look", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("X");
  ws.addTable({
    name: "People",
    ref: "B2",
    headerRow: true,
    style: { theme: "TableStyleMedium7", showRowStripes: true },
    columns: [{ name: "Name" }, { name: "Age" }],
    rows: [
      ["Ann", 31],
      ["Bob", 42],
    ],
  });
  ws.getCell("D3").value = { formula: "People[[#This Row],[Age]]+1" };
  const result = await importXlsx(await excelJsBytes(wb));
  const sheetX = sheetByName(result, "X");
  assert.deepEqual(sheetX.tables[0].range, { row: [1, 3], column: [1, 2] });
  assert.deepEqual(
    sheetX.tables[0].columns.map((c) => c.name),
    ["Name", "Age"]
  );
  const map = cellMap(sheetX);
  // header fill and font, first band filled, second band plain
  assert.equal(map.get("1_1").bg, "#70AD47");
  assert.equal(map.get("1_1").bl, 1);
  assert.equal(map.get("2_2").bg, "#E2EFDA");
  assert.equal(map.get("3_2").bg, undefined);
  // outside the table: references stay qualified
  assert.equal(map.get("2_3").f, "=People[[#This Row],[Age]]+1");
});

test("notes shown permanently keep Excel's visible flag", async () => {
  const note = (value, isShow) => ({
    left: null,
    top: null,
    width: null,
    height: null,
    value,
    isShow,
  });
  const { bytes, result } = await roundTrip([
    sheet("N", {
      "0_0": { v: 1, m: "1", ps: note("shown", true) },
      "2_1": { v: 2, m: "2", ps: note("hidden", false) },
    }),
  ]);
  const vml = await zipText(bytes, "xl/drawings/vmlDrawing1.vml");
  assert.equal((vml.match(/<x:Visible\/>/g) || []).length, 1);
  const cells = cellMap(sheetByName(result, "N"));
  assert.equal(cells.get("0_0").ps.value, "shown");
  assert.equal(cells.get("0_0").ps.isShow, true);
  assert.equal(cells.get("2_1").ps.value, "hidden");
  assert.equal(cells.get("2_1").ps.isShow, false);
});
