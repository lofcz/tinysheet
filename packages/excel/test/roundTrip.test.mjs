// T58: round-trip suite.
//
// 1. TinySheet sheets -> export -> import: everything the sheets set survives.
// 2. xlsx (fixtures, and a generated feature workbook) -> import -> export ->
//    import: the second import equals the first (values, formulas, styles,
//    merges, sizes, hidden rows/columns, freeze, validation, links, notes).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "@protobi/exceljs";
import { exportToXlsx } from "../dist/index.js";
import {
  cellMap,
  comparableCell,
  comparableSheet,
  excelJsBytes,
  importXlsx,
  roundTrip,
  sheetByName,
} from "./helpers.mjs";
import { tinySheetWorkbook } from "./fixtures/tinysheetWorkbook.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Every key of `expected` is present (recursively) with the same value in `actual`. */
function assertSubset(actual, expected, where) {
  if (expected === null || typeof expected !== "object") {
    assert.deepEqual(actual, expected, where);
    return;
  }
  assert.ok(actual != null && typeof actual === "object", `${where}: missing`);
  for (const key of Object.keys(expected)) {
    assertSubset(actual[key], expected[key], `${where}.${key}`);
  }
}

function sheetConfig(sheet) {
  const config = sheet.config || {};
  const hiddenRows = config.rowhidden || {};
  const rowlen = Object.fromEntries(
    Object.entries(config.rowlen || {}).filter(([r]) => !(r in hiddenRows))
  );
  return {
    merge: config.merge || {},
    columnlen: config.columnlen || {},
    rowlen,
    rowhidden: Object.keys(hiddenRows).sort(),
    colhidden: Object.keys(config.colhidden || {}).sort(),
  };
}

function validation(sheet) {
  const out = {};
  for (const [key, dv] of Object.entries(sheet.dataVerification || {})) {
    out[key] = {
      type: dv.type,
      type2: dv.type2 ?? null,
      value1: String(dv.value1 ?? ""),
      value2: String(dv.value2 ?? ""),
      prohibitInput: !!dv.prohibitInput,
      hintShow: !!dv.hintShow,
      hintValue: dv.hintShow ? dv.hintValue || "" : "",
    };
  }
  return out;
}

function links(sheet) {
  const out = {};
  for (const [key, link] of Object.entries(sheet.hyperlink || {})) {
    out[key] = { linkType: link.linkType, linkAddress: link.linkAddress };
  }
  return out;
}

function borders(sheet) {
  const out = {};
  for (const item of sheet.config?.borderInfo || []) {
    if (item.rangeType !== "cell") continue;
    const { row_index: r, col_index: c, ...sides } = item.value;
    out[`${r}_${c}`] = Object.fromEntries(
      Object.entries(sides).map(([side, v]) => [
        side,
        { style: Number(v.style), color: String(v.color).toUpperCase() },
      ])
    );
  }
  return out;
}

function sheetSnapshot(sheet) {
  return {
    name: sheet.name,
    hide: sheet.hide ? 1 : 0,
    color: sheet.color ? String(sheet.color).toUpperCase() : undefined,
    frozen: sheet.frozen,
    cells: comparableSheet(sheet),
    config: sheetConfig(sheet),
    borders: borders(sheet),
    validation: validation(sheet),
    links: links(sheet),
  };
}

// ---------------------------------------------------------------------------
// 1. TinySheet -> xlsx -> TinySheet
// ---------------------------------------------------------------------------

test("TinySheet workbook survives export -> import", async () => {
  const original = tinySheetWorkbook();
  const { result } = await roundTrip(original);
  assert.deepEqual(
    result.sheets.map((s) => s.name),
    ["Report", "Other Sheet"]
  );
  const [src] = original;
  const back = sheetByName(result, "Report");
  const cells = cellMap(back);

  for (const { r, c, v } of src.celldata) {
    const expected = comparableCell(v);
    // Border-only or empty cells have nothing comparable.
    if (!expected || Object.keys(expected).length === 0) continue;
    assertSubset(
      comparableCell(cells.get(`${r}_${c}`)),
      expected,
      `cell ${r}_${c}`
    );
  }
  // Explicit vertical alignment.
  assert.equal(cells.get("0_0").vt, 0);
  assert.equal(cells.get("5_0").vt, 1);

  const snapshot = sheetSnapshot(back);
  assert.equal(snapshot.color, "#00B050");
  assert.deepEqual(snapshot.frozen, src.frozen);
  assert.deepEqual(snapshot.config.merge, src.config.merge);
  assertSubset(snapshot.config.columnlen, { 0: 150, 2: 40 }, "columnlen");
  assertSubset(snapshot.config.rowlen, { 0: 40, 4: 25 }, "rowlen");
  assert.deepEqual(snapshot.config.rowhidden, ["8"]);
  assert.deepEqual(snapshot.config.colhidden, ["5"]);
  assert.deepEqual(snapshot.links, src.hyperlink);
  assert.deepEqual(snapshot.validation, validation(src));
  assert.deepEqual(snapshot.borders["0_0"], {
    l: { style: 1, color: "#000000" },
    r: { style: 1, color: "#000000" },
    t: { style: 1, color: "#000000" },
    b: { style: 13, color: "#FF0000" },
  });
  // Default column width round-trips: no column gets a materialised width.
  assert.equal(snapshot.config.columnlen[1], undefined);

  const other = sheetByName(result, "Other Sheet");
  assert.equal(other.hide, 1);
  assert.equal(cellMap(other).get("1_1").v, "target");
});

test("column widths and row heights survive export -> import exactly", async () => {
  const widths = {};
  const heights = {};
  for (let i = 0; i < 40; i += 1) {
    widths[i] = 20 + i * 7;
    heights[i] = 12 + i * 3;
  }
  const { result } = await roundTrip([
    {
      name: "Sizes",
      celldata: [],
      config: { columnlen: widths, rowlen: heights },
    },
  ]);
  const { config } = result.sheets[0];
  assert.deepEqual(
    config.columnlen,
    Object.fromEntries(Object.entries(widths).map(([k, v]) => [k, v]))
  );
  assert.deepEqual(config.rowlen, heights);
});

// ---------------------------------------------------------------------------
// 2. xlsx -> TinySheet -> xlsx -> TinySheet
// ---------------------------------------------------------------------------

async function assertStableRoundTrip(bytes, label) {
  const first = await importXlsx(bytes);
  const exported = await exportToXlsx(first.sheets);
  const second = await importXlsx(exported);
  assert.equal(
    second.sheets.length,
    first.sheets.length,
    `${label}: sheet count`
  );
  first.sheets.forEach((sheet, i) => {
    const a = sheetSnapshot(sheet);
    const b = sheetSnapshot(second.sheets[i]);
    for (const key of Object.keys(a)) {
      assert.deepEqual(b[key], a[key], `${label} / ${sheet.name}: ${key}`);
    }
  });
  return { first, second };
}

async function featureWorkbookBytes() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Features", {
    properties: { tabColor: { argb: "FF7030A0" } },
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  ws.columns = [{ width: 18 }, { width: 10 }, { width: 30 }];
  ws.getRow(1).height = 24;
  ws.getRow(1).font = { bold: true, name: "Calibri", size: 12 };
  ws.getRow(1).values = ["Item", "Qty", "Note"];
  const rows = [
    ["Apples", 3, "fresh"],
    ["Pears", 5, "ripe"],
    ["Plums", 8, "sour"],
  ];
  rows.forEach((row, i) => {
    ws.getRow(i + 2).values = row;
  });
  ws.getCell("B5").value = { formula: "SUM(B2:B4)", result: 16 };
  ws.getCell("B6").value = {
    formula: '_xlfn.XLOOKUP("Pears",A2:A4,B2:B4)',
    result: 5,
  };
  ws.getCell("D2").value = {
    formula: "B2*2",
    result: 6,
    shareType: "shared",
    ref: "D2:D4",
  };
  ws.getCell("D3").value = { sharedFormula: "D2", result: 10 };
  ws.getCell("D4").value = { sharedFormula: "D2", result: 16 };
  ws.getCell("E2").value = {
    formula: "_xlfn._xlws.SORT(B2:B4,1,-1)",
    result: 8,
    shareType: "array",
    ref: "E2:E4",
  };
  ws.getCell("E3").value = 5;
  ws.getCell("E4").value = 3;
  ws.getCell("B2").numFmt = "0.00";
  ws.getCell("C2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { theme: 6, tint: 0.5999938962981048 },
  };
  ws.getCell("C3").alignment = {
    wrapText: true,
    horizontal: "center",
    vertical: "top",
  };
  ws.getCell("C4").border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "double", color: { argb: "FF0000FF" } },
  };
  ws.getCell("A8").value = {
    text: "Docs",
    hyperlink: "https://example.org/docs",
  };
  ws.getCell("A9").value = 45123.5;
  ws.getCell("A9").numFmt = "m/d/yyyy h:mm";
  ws.getCell("A10").note = "Remember";
  ws.getCell("A11").value = {
    richText: [
      { text: "Mixed ", font: { italic: true } },
      { text: "runs", font: { bold: true } },
    ],
  };
  ws.mergeCells("C8:D9");
  ws.getCell("C8").value = "merged";
  ws.getRow(12).hidden = true;
  ws.getColumn(7).hidden = true;
  ws.getCell("F2").dataValidation = {
    type: "list",
    formulae: ['"Yes,No"'],
    showErrorMessage: true,
  };
  ws.getCell("F3").dataValidation = {
    type: "whole",
    operator: "greaterThanOrEqual",
    formulae: [0],
  };
  const hidden = wb.addWorksheet("Lists");
  hidden.state = "hidden";
  hidden.getCell("A1").value = "Yes";
  return excelJsBytes(wb);
}

test("generated feature workbook: import -> export -> import is stable", async () => {
  const { first } = await assertStableRoundTrip(
    await featureWorkbookBytes(),
    "features"
  );
  // Sanity: the features were actually imported the first time.
  const sheet = sheetByName(first, "Features");
  const cells = cellMap(sheet);
  assert.equal(cells.get("3_3").f, "=B4*2");
  assert.equal(cells.get("1_4").f, "=SORT(B2:B4,1,-1)");
  assert.deepEqual(cells.get("1_4").spill, { rs: 3, cs: 1 });
  assert.equal(cells.get("5_1").f, '=XLOOKUP("Pears",A2:A4,B2:B4)');
  assert.equal(cells.get("9_0").ps.value, "Remember");
  assert.equal(sheet.frozen.type, "rangeBoth");
  assert.ok(sheet.config.merge["7_2"]);
  assert.equal(sheet.dataVerification["1_5"].type, "dropdown");
  assert.equal(sheetByName(first, "Lists").hide, 1);
});

for (const fixture of [
  "xls_preview.xlsx",
  "issue17336_drawing_objects.xlsx",
  "openpyxl_bar_chart.xlsx",
  "tmp_nochart.xlsx",
]) {
  test(`fixture ${fixture}: import -> export -> import is stable`, async () => {
    const bytes = await fs.readFile(
      path.resolve(__dirname, "fixtures", fixture)
    );
    await assertStableRoundTrip(bytes, fixture);
  });
}
