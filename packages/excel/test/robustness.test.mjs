// T118: xlsx import robustness corpus. Workbooks are generated with ExcelJS
// (and patched at the zip level for what ExcelJS cannot produce), imported,
// and checked for crash-freedom and fidelity. A mutation pass drops or
// damages random parts of a rich workbook: the import must either succeed
// or fail with an ExcelImportError, never with a TypeError & co.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import ExcelJS from "@protobi/exceljs";
import {
  ExcelImportError,
  decodeExcelImportResult,
  encodeExcelImportResult,
  exportToXlsx,
} from "../dist/index.js";
import {
  cellMap,
  excelJsBytes,
  importXlsx,
  patchZip,
  sheetByName,
} from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function rewriteZip(bytes, fn) {
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  await fn(zip);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Import and check the result is plain JSON-safe data. */
async function importOk(bytes, label) {
  const result = await importXlsx(bytes);
  assert.ok(Array.isArray(result.sheets), `${label}: sheets`);
  for (const sheet of result.sheets) {
    assert.ok(Array.isArray(sheet.celldata), `${label}: celldata`);
    for (const cell of sheet.celldata) {
      assert.ok(Number.isInteger(cell.r) && cell.r >= 0, `${label}: r`);
      assert.ok(Number.isInteger(cell.c) && cell.c >= 0, `${label}: c`);
    }
  }
  // what the worker path transfers
  const decoded = decodeExcelImportResult(encodeExcelImportResult(result));
  assert.equal(decoded.sheets.length, result.sheets.length);
  return result;
}

async function richWorkbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data", {
    properties: { tabColor: { argb: "FF00B050" } },
  });
  ws.columns = [{ width: 20 }, { width: 12 }, { width: 12 }];
  ws.getRow(1).values = ["Name", "Qty", "Price", "Total"];
  ws.getRow(1).font = { bold: true, color: { theme: 1 } };
  for (let r = 2; r <= 20; r += 1) {
    ws.getCell(r, 1).value = `Item ${r}`;
    ws.getCell(r, 2).value = r;
    ws.getCell(r, 3).value = r * 1.5;
    ws.getCell(r, 3).numFmt = "#,##0.00";
    ws.getCell(r, 4).value = {
      formula: `B${r}*C${r}`,
      result: r * r * 1.5,
      ...(r === 2 ? { shareType: "shared", ref: "D2:D20" } : {}),
    };
    if (r > 2)
      ws.getCell(r, 4).value = { sharedFormula: "D2", result: r * r * 1.5 };
  }
  ws.getCell("F1").value = {
    formula: "_xlfn.SEQUENCE(3)",
    result: 1,
    shareType: "array",
    ref: "F1:F3",
  };
  ws.getCell("F2").value = 2;
  ws.getCell("F3").value = 3;
  ws.getCell("A22").note = "a note";
  ws.getCell("A23").value = { text: "link", hyperlink: "https://example.com" };
  ws.getCell("A24").value = {
    richText: [
      { text: "rich ", font: { bold: true } },
      { text: "text", font: { italic: true, color: { argb: "FFFF0000" } } },
    ],
  };
  ws.mergeCells("B22:C24");
  ws.getRow(23).hidden = true;
  ws.getCell("E2").dataValidation = { type: "list", formulae: ['"a,b"'] };
  ws.addConditionalFormatting({
    ref: "B2:B20",
    rules: [
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: [10],
        priority: 1,
        style: { font: { bold: true } },
      },
    ],
  });
  ws.addTable({
    name: "Sales",
    ref: "H1",
    headerRow: true,
    columns: [{ name: "K" }, { name: "V" }],
    rows: [
      ["a", 1],
      ["b", 2],
    ],
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  const img = wb.addImage({
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    extension: "png",
  });
  ws.addImage(img, "H6:I8");
  const other = wb.addWorksheet("Q'uote ü 日本");
  other.getCell("A1").value = { formula: "Data!B2*2", result: 4 };
  wb.definedNames.add("Data!$B$2:$B$20", "Qty");
  return excelJsBytes(wb);
}

// ---------------------------------------------------------------------------
// Generated corpus
// ---------------------------------------------------------------------------

test("corpus: empty workbook sheet and one-cell sheet", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Empty");
  wb.addWorksheet("One").getCell("A1").value = 42;
  const result = await importOk(await excelJsBytes(wb), "empty");
  assert.equal(sheetByName(result, "Empty").celldata.length, 0);
  assert.equal(cellMap(sheetByName(result, "One")).get("0_0").v, 42);
});

test("corpus: extreme addresses (XFD1, A1048576, XFD1048576)", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Far");
  ws.getCell("XFD1").value = "right";
  ws.getCell("A1048576").value = "bottom";
  ws.getCell("XFD1048576").value = "corner";
  const result = await importOk(await excelJsBytes(wb), "far");
  const cells = cellMap(sheetByName(result, "Far"));
  assert.equal(cells.get("0_16383").v, "right");
  assert.equal(cells.get("1048575_0").v, "bottom");
  assert.equal(cells.get("1048575_16383").v, "corner");
});

test("corpus: unicode sheet names with quotes survive formulas and names", async () => {
  const bytes = await richWorkbook();
  const result = await importOk(bytes, "rich");
  const names = result.sheets.map((s) => s.name);
  assert.deepEqual(names, ["Data", "Q'uote ü 日本"]);
  // and back out and in again
  const again = await importOk(await exportToXlsx(result.sheets), "rich2");
  assert.deepEqual(
    again.sheets.map((s) => s.name),
    names
  );
  const data = cellMap(sheetByName(again, "Data"));
  assert.equal(data.get("19_3").f, "=B20*C20");
  assert.equal(data.get("0_5").f, "=SEQUENCE(3)");
});

test("corpus: every error value, booleans, rich text, long strings", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Values");
  const errors = [
    "#NULL!",
    "#DIV/0!",
    "#VALUE!",
    "#REF!",
    "#NAME?",
    "#NUM!",
    "#N/A",
  ];
  errors.forEach((e, i) => {
    ws.getCell(i + 1, 1).value = { error: e };
  });
  ws.getCell("B1").value = true;
  ws.getCell("B2").value = false;
  ws.getCell("C1").value = "x".repeat(32767);
  ws.getCell("C2").value = 'tab\tand\nnewline & <tag> "quotes"';
  ws.getCell("C3").value = "  leading and trailing spaces  ";
  ws.getCell("C4").value = "😀 emoji and ünïcödé";
  const result = await importOk(await excelJsBytes(wb), "values");
  const cells = cellMap(sheetByName(result, "Values"));
  errors.forEach((e, i) => {
    assert.equal(cells.get(`${i}_0`).v, e);
    assert.equal(cells.get(`${i}_0`).ct.t, "e");
  });
  assert.equal(cells.get("0_1").v, true);
  assert.equal(cells.get("1_1").v, false);
  assert.equal(cells.get("0_2").v.length, 32767);
  assert.equal(
    cells
      .get("1_2")
      .ct.s.map((r) => r.v)
      .join(""),
    'tab\tand\r\nnewline & <tag> "quotes"'
  );
  assert.equal(cells.get("2_2").v, "  leading and trailing spaces  ");
  assert.equal(cells.get("3_2").v, "😀 emoji and ünïcödé");
});

test("corpus: dates in the 1900 and 1904 systems", async () => {
  for (const date1904 of [false, true]) {
    const wb = new ExcelJS.Workbook();
    wb.properties.date1904 = date1904;
    const ws = wb.addWorksheet("Dates");
    ws.getCell("A1").value = new Date(Date.UTC(2024, 1, 29));
    ws.getCell("A1").numFmt = "yyyy-mm-dd";
    ws.getCell("A2").value = new Date(Date.UTC(1900, 0, 1));
    ws.getCell("A2").numFmt = "yyyy-mm-dd";
    const result = await importOk(await excelJsBytes(wb), `1904=${date1904}`);
    const cells = cellMap(sheetByName(result, "Dates"));
    assert.equal(cells.get("0_0").m, "2024-02-29", `1904=${date1904}`);
    assert.equal(cells.get("0_0").v, 45351, `1904=${date1904}`);
    assert.equal(cells.get("0_0").ct.t, "d");
  }
});

test("corpus: merged range over hidden rows", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("M");
  ws.getCell("A1").value = "merged";
  ws.mergeCells("A1:B5");
  ws.getRow(2).hidden = true;
  ws.getRow(3).hidden = true;
  const result = await importOk(await excelJsBytes(wb), "merge");
  const sheet = sheetByName(result, "M");
  assert.deepEqual(sheet.config.merge["0_0"], { r: 0, c: 0, rs: 5, cs: 2 });
  assert.deepEqual(Object.keys(sheet.config.rowhidden).sort(), ["1", "2"]);
  const cells = cellMap(sheet);
  assert.deepEqual(cells.get("0_0").mc, { r: 0, c: 0, rs: 5, cs: 2 });
  assert.deepEqual(cells.get("2_1").mc, { r: 0, c: 0 });
  assert.deepEqual(cells.get("0_1").mc, { r: 0, c: 0 });
});

test("corpus: validation and links over whole columns stay bounded", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Big");
  ws.getCell("A1").value = 1;
  ws.dataValidations.add("B1:B1048576", { type: "list", formulae: ['"x,y"'] });
  const bytes = await excelJsBytes(wb);
  const t0 = Date.now();
  const result = await importOk(bytes, "big");
  assert.ok(
    Date.now() - t0 < 10000,
    "whole-column validation is not expanded cell by cell"
  );
  const dv = sheetByName(result, "Big").dataVerification;
  const keys = Object.keys(dv);
  assert.ok(keys.length >= 1000 && keys.length <= 1000, `${keys.length} cells`);
  assert.equal(dv["999_1"].type, "dropdown");
});

// ---------------------------------------------------------------------------
// Hand-made package oddities (zip level)
// ---------------------------------------------------------------------------

const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

test("oddities: prefixed SpreadsheetML namespace, single quotes, no r attributes", async () => {
  const bytes = await rewriteZip(await richWorkbook(), async (zip) => {
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<?xml version='1.0' encoding='UTF-8'?>
<x:worksheet xmlns:x='${SHEET_NS}'><x:sheetData>
<x:row><x:c t='inlineStr'><x:is><x:t>first</x:t></x:is></x:c><x:c><x:v>2</x:v></x:c></x:row>
<x:row r='5'><x:c r='C5' t='b'><x:v>1</x:v></x:c><x:c><x:v>7</x:v></x:c></x:row>
<x:row><x:c t='d'><x:v>2024-01-02T00:00:00Z</x:v></x:c></x:row>
</x:sheetData></x:worksheet>`
    );
    zip.remove("xl/worksheets/_rels/sheet1.xml.rels");
  });
  const result = await importOk(bytes, "prefixed");
  const cells = cellMap(sheetByName(result, "Data"));
  assert.equal(cells.get("0_0").v, "first");
  assert.equal(cells.get("0_1").v, 2);
  assert.equal(cells.get("4_2").v, true);
  assert.equal(cells.get("4_3").v, 7);
  assert.equal(cells.get("5_0").v, 45293);
});

test("oddities: workbook part elsewhere, absolute and upper-case targets", async () => {
  const bytes = await rewriteZip(await richWorkbook(), async (zip) => {
    const move = async (from, to) => {
      const data = await zip.file(from).async("nodebuffer");
      zip.remove(from);
      zip.file(to, data);
    };
    await move("xl/workbook.xml", "xl/book.xml");
    await move("xl/_rels/workbook.xml.rels", "xl/_rels/book.xml.rels");
    await move("xl/sharedStrings.xml", "xl/Strings.xml");
    await move("xl/styles.xml", "xl/Styles.XML");
    let root = await zip.file("_rels/.rels").async("string");
    root = root.replace("xl/workbook.xml", "/xl/book.xml");
    zip.file("_rels/.rels", root);
    let rels = await zip.file("xl/_rels/book.xml.rels").async("string");
    rels = rels
      .replace(/Target="sharedStrings.xml"/, 'Target="/xl/strings.xml"')
      .replace(/Target="styles.xml"/, 'Target="Styles.XML"')
      .replace(
        /Target="worksheets\/sheet1.xml"/,
        'Target="/xl/worksheets/sheet1.xml"'
      );
    zip.file("xl/_rels/book.xml.rels", rels);
  });
  const result = await importOk(bytes, "moved");
  const cells = cellMap(sheetByName(result, "Data"));
  assert.equal(cells.get("1_0").v, "Item 2");
  assert.equal(cells.get("1_2").ct.fa, "#,##0.00");
  assert.equal(cells.get("0_0").bl, 1);
});

test("oddities: missing optional parts and dangling relationships", async () => {
  const optional = [
    "xl/styles.xml",
    "xl/theme/theme1.xml",
    "docProps/core.xml",
    "docProps/app.xml",
    "xl/sharedStrings.xml",
    "xl/drawings/drawing1.xml",
    "xl/media/image1.png",
    "xl/tables/table1.xml",
    "xl/comments1.xml",
    "xl/drawings/_rels/drawing1.xml.rels",
    "xl/worksheets/_rels/sheet1.xml.rels",
    "[Content_Types].xml",
  ];
  const base = await richWorkbook();
  for (const part of optional) {
    // eslint-disable-next-line no-await-in-loop
    const bytes = await rewriteZip(base, async (zip) => zip.remove(part));
    // eslint-disable-next-line no-await-in-loop
    const result = await importOk(bytes, `without ${part}`);
    assert.equal(result.sheets.length, 2, part);
  }
});

test("oddities: stale calcChain, empty <v/>, unknown cell types, bad style ids", async () => {
  const bytes = await patchZip(await richWorkbook(), {
    "xl/calcChain.xml": () =>
      `<calcChain xmlns="${SHEET_NS}"><c r="ZZ99" i="1"/><c r="D3"/><c i="7" r="A1"/><c/></calcChain>`,
    "xl/worksheets/sheet2.xml": (xml) =>
      xml.replace(
        /<sheetData>[\s\S]*<\/sheetData>/,
        `<sheetData><row r="1"><c r="A1" s="999"><v/></c><c r="B1" t="weird"><v>x</v></c><c r="C1" t="s"><v>99999</v></c><c r="D1" t="n"><v>not a number</v></c><c r="E1" t="e"/><c r="F1"><f/></c></row></sheetData>`
      ),
  });
  const result = await importOk(bytes, "stale");
  const cells = cellMap(sheetByName(result, "Q'uote ü 日本"));
  assert.equal(cells.get("0_3").v, "not a number");
});

test("not an xlsx: legacy .xls, random bytes, zip without workbook", async () => {
  const xls = Buffer.from([
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0,
  ]);
  await assert.rejects(
    importXlsx(xls),
    (e) => e instanceof ExcelImportError && e.code === "unsupported-format"
  );
  await assert.rejects(
    importXlsx(Buffer.from("hello world")),
    (e) => e instanceof ExcelImportError && e.code === "not-a-zip"
  );
  const zip = new JSZip();
  zip.file("hello.txt", "hi");
  await assert.rejects(
    importXlsx(await zip.generateAsync({ type: "nodebuffer" })),
    (e) => e instanceof ExcelImportError && e.code === "no-workbook"
  );
});

// ---------------------------------------------------------------------------
// Mutation ("fuzz-ish") pass
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function importMustNotCrash(bytes, label) {
  try {
    await importOk(bytes, label);
  } catch (e) {
    if (e instanceof ExcelImportError) return;
    throw new Error(`${label}: ${e?.stack ?? e}`);
  }
}

test("mutations: dropping or damaging random parts never crashes", async () => {
  const fixtures = [await richWorkbook()];
  for (const name of [
    "xls_preview.xlsx",
    "issue17336_drawing_objects.xlsx",
    "openpyxl_bar_chart.xlsx",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    fixtures.push(await fs.readFile(path.resolve(__dirname, "fixtures", name)));
  }
  const random = rng(20260925);
  let runs = 0;
  for (const base of fixtures) {
    // eslint-disable-next-line no-await-in-loop
    const zip = await JSZip.loadAsync(base);
    const parts = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
    for (let i = 0; i < 12; i += 1) {
      const mode = i % 3;
      const count = 1 + Math.floor(random() * 3);
      const picked = Array.from(
        { length: count },
        () => parts[Math.floor(random() * parts.length)]
      );
      // eslint-disable-next-line no-await-in-loop
      const bytes = await rewriteZip(base, async (z) => {
        for (const part of picked) {
          if (mode === 0) z.remove(part);
          else {
            // eslint-disable-next-line no-await-in-loop
            const text = await z.file(part)?.async("string");
            if (text == null) continue;
            const cut = Math.floor(random() * text.length);
            z.file(
              part,
              mode === 1
                ? text.slice(0, cut)
                : text.slice(0, cut) + "<<>&\"'" + text.slice(cut + 7)
            );
          }
        }
      });
      // eslint-disable-next-line no-await-in-loop
      await importMustNotCrash(bytes, `mode ${mode} ${picked.join(",")}`);
      runs += 1;
    }
  }
  assert.equal(runs, 48);
});
