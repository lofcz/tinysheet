// T116: the zip post-processor registry and the exceljs gaps it fills
// (list validation without the in-cell arrow, tables without data rows,
// text over Excel's cell limit, entity decoding).
import test from "node:test";
import assert from "node:assert/strict";
import {
  addContentTypeOverride,
  addExtension,
  addRelationship,
  exportToXlsx,
  insertWorksheetElement,
  registerXlsxPostProcessor,
  relativeTarget,
  resolveTarget,
  xlsxPostProcessors,
} from "../dist/index.js";
import {
  cellMap,
  readWithExcelJS,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

const text = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });

test("built-in post-processors run in a documented order", () => {
  assert.deepEqual(
    xlsxPostProcessors.map((p) => p.name),
    [
      "conditional-formatting",
      "dynamic-arrays",
      "cell-images",
      "internal-hyperlinks",
      "visible-notes",
      "threaded-comments",
      "sheet-xml-fixups",
      "worksheet-exts",
      "cell-hyperlinks",
      "data-validation",
      "tables",
      "charts",
      "shapes",
      "feature-fixups",
    ]
  );
});

test("registerXlsxPostProcessor: order, replacement, unregister, context", async () => {
  const seen = [];
  const offA = registerXlsxPostProcessor("test-a", async (ctx) => {
    seen.push("a");
    const ws = ctx.worksheets[0];
    assert.equal(ws.name, "Data");
    assert.equal(ws.sheet.name, "Data");
    assert.equal(ws.path, "xl/worksheets/sheet1.xml");
    const xml = await ctx.readText(ws.path);
    ctx.writeText(
      ws.path,
      insertWorksheetElement(
        xml,
        "sheetProtection",
        '<sheetProtection sheet="1"/>'
      )
    );
    ctx.writeText("customXml/item1.xml", "<root/>");
    await ctx.addContentType("/customXml/item1.xml", "application/xml");
    const id = await ctx.addRelationship(
      "xl/workbook.xml",
      "http://example.com/custom",
      "../customXml/item1.xml"
    );
    assert.match(id, /^rId\d+$/);
  });
  const offB = registerXlsxPostProcessor(
    "test-b",
    () => {
      seen.push("b");
    },
    { before: "test-a" }
  );
  // same name again: replaced in place
  const offB2 = registerXlsxPostProcessor(
    "test-b",
    () => {
      seen.push("b2");
    },
    { before: "test-a" }
  );
  try {
    const names = xlsxPostProcessors.map((p) => p.name);
    assert.equal(names.filter((n) => n === "test-b").length, 1);
    assert.ok(names.indexOf("test-b") < names.indexOf("test-a"));

    const bytes = await exportToXlsx([
      { name: "Data", celldata: [{ r: 0, c: 0, v: text("x") }] },
    ]);
    assert.deepEqual(seen, ["b2", "a"]);
    const sheet = await zipText(bytes, "xl/worksheets/sheet1.xml");
    // schema order: sheetProtection after sheetData, before pageMargins
    assert.ok(
      sheet.indexOf("</sheetData><sheetProtection") > 0 ||
        /<\/sheetData>[\s\S]*<sheetProtection[\s\S]*<pageMargins/.test(sheet)
    );
    assert.match(
      await zipText(bytes, "[Content_Types].xml"),
      /PartName="\/customXml\/item1.xml"/
    );
    assert.match(
      await zipText(bytes, "xl/_rels/workbook.xml.rels"),
      /Target="..\/customXml\/item1.xml"/
    );
    // ExcelJS still reads it
    await readWithExcelJS(bytes);
  } finally {
    offA();
    offB();
    offB2();
  }
  assert.ok(!xlsxPostProcessors.some((p) => p.name.startsWith("test-")));
});

test("xlsxParts helpers", () => {
  assert.equal(
    resolveTarget("xl/worksheets/sheet1.xml", "../drawings/d1.xml"),
    "xl/drawings/d1.xml"
  );
  assert.equal(
    relativeTarget("xl/worksheets/sheet1.xml", "xl/drawings/d1.xml"),
    "../drawings/d1.xml"
  );
  const rels = addRelationship(null, "t:x", "a.xml");
  assert.equal(rels.id, "rId1");
  const again = addRelationship(rels.xml, "t:x", "a.xml");
  assert.equal(again.id, "rId1");
  assert.equal(addRelationship(rels.xml, "t:y", "b.xml").id, "rId2");
  const types = addContentTypeOverride("<Types></Types>", "xl/a.xml", "ct");
  assert.equal(addContentTypeOverride(types, "/xl/a.xml", "ct"), types);
  const sheet =
    '<worksheet><sheetData/><pageMargins left="1"/><tableParts count="0"/></worksheet>';
  const withBreaks = insertWorksheetElement(sheet, "rowBreaks", "<rowBreaks/>");
  assert.match(withBreaks, /<pageMargins left="1"\/><rowBreaks\/><tableParts/);
  const ext = addExtension(sheet, "{A}", '<ext uri="{A}"><a/></ext>');
  assert.match(
    ext,
    /<tableParts count="0"\/><extLst><ext uri="\{A\}"><a\/><\/ext><\/extLst><\/worksheet>/
  );
  const replaced = addExtension(ext, "{A}", '<ext uri="{A}"><b/></ext>');
  assert.match(replaced, /<ext uri="\{A\}"><b\/><\/ext><\/extLst>/);
  assert.doesNotMatch(replaced, /<a\/>/);
});

test("dropdown without the in-cell arrow: showDropDown=1 (Excel's inverted flag)", async () => {
  const { bytes, result } = await roundTrip([
    {
      name: "DV",
      celldata: [],
      dataVerification: {
        "0_0": {
          type: "dropdown",
          value1: "a,b",
          value2: "",
          showDropdown: false,
        },
        "1_0": {
          type: "dropdown",
          value1: "a,b",
          value2: "",
          showDropdown: false,
        },
        "2_0": { type: "dropdown", value1: "a,b", value2: "" },
        "0_1": {
          type: "dropdown",
          value1: "x,y",
          value2: "",
          showDropdown: true,
        },
      },
    },
  ]);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  const rules = xml.match(/<dataValidation\b[^>]*>/g);
  const hidden = rules.filter((r) => /showDropDown="1"/.test(r));
  assert.equal(hidden.length, 1);
  assert.match(hidden[0], /sqref="A1:A2"/);
  const dv = sheetByName(result, "DV").dataVerification;
  assert.equal(dv["0_0"].showDropdown, false);
  assert.equal(dv["1_0"].showDropdown, false);
  assert.equal(dv["2_0"].showDropdown, undefined);
  assert.equal(dv["0_1"].showDropdown, undefined);
});

test("a table without data rows is written with Excel's insert row", async () => {
  const { bytes, result } = await roundTrip([
    {
      name: "T",
      celldata: [
        { r: 0, c: 0, v: text("Name") },
        { r: 0, c: 1, v: text("Qty") },
      ],
      tables: [
        {
          name: "Empty",
          range: { row: [0, 0], column: [0, 1] },
          headerRow: true,
          totalRow: false,
          bandedRows: true,
          style: "TableStyleLight9",
          columns: [
            { name: "Name", totalFunction: "none" },
            { name: "Qty", totalFunction: "none" },
          ],
        },
      ],
    },
  ]);
  const part = await zipText(bytes, "xl/tables/table1.xml");
  assert.match(part, /ref="A1:B2"/);
  assert.match(part, /insertRow="1"/);
  const ws = (await readWithExcelJS(bytes)).getWorksheet("T");
  assert.ok(ws);
  const [table] = sheetByName(result, "T").tables;
  assert.equal(table.name, "Empty");
  assert.deepEqual(table.range, { row: [0, 0], column: [0, 1] });
  assert.equal(table.style, "TableStyleLight9");
});

test("text over 32767 characters is cut to Excel's cell limit", async () => {
  const long = "x".repeat(40000);
  const { result } = await roundTrip([
    {
      name: "Long",
      celldata: [
        { r: 0, c: 0, v: text(long) },
        {
          r: 1,
          c: 0,
          v: {
            ct: {
              fa: "General",
              t: "inlineStr",
              s: [
                { v: "a".repeat(30000), bl: 1 },
                { v: "b".repeat(30000), it: 1 },
              ],
            },
          },
        },
      ],
    },
  ]);
  const cells = cellMap(sheetByName(result, "Long"));
  assert.equal(cells.get("0_0").v.length, 32767);
  const runs = cells.get("1_0").ct.s;
  assert.equal(runs.map((r) => r.v).join("").length, 32767);
});

test("escaped entities are decoded once", async () => {
  const tricky = "a &amp; b &lt;c&gt; &#38; &quot;q&quot; & < > \" '";
  const { result } = await roundTrip([
    { name: "E", celldata: [{ r: 0, c: 0, v: text(tricky) }] },
  ]);
  assert.equal(cellMap(sheetByName(result, "E")).get("0_0").v, tricky);
});

test("links on formula cells and empty cells are kept", async () => {
  const hyperlink = {
    "0_0": {
      linkType: "webpage",
      linkAddress: "https://example.com/f?a=1&b=2",
      linkTooltip: "tip",
    },
    "1_0": { linkType: "cellrange", linkAddress: "'L k'!C3" },
    "5_5": { linkType: "webpage", linkAddress: "https://example.com/empty" },
    "2_0": { linkType: "webpage", linkAddress: "https://example.com/value" },
  };
  const { bytes, result } = await roundTrip([
    {
      name: "L k",
      celldata: [
        {
          r: 0,
          c: 0,
          v: { f: "=1+1", v: 2, m: "2", ct: { fa: "General", t: "n" } },
        },
        { r: 1, c: 0, v: { f: '="x"&"y"', v: "xy", m: "xy" } },
        { r: 2, c: 0, v: text("value") },
      ],
      hyperlink,
    },
  ]);
  const ws = (await readWithExcelJS(bytes)).getWorksheet("L k");
  assert.ok(ws);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(xml, /<c r="A1"[^>]*><f>1\+1<\/f>/);
  assert.match(xml, /<hyperlinks>[\s\S]*ref="A1"[\s\S]*<\/hyperlinks>/);
  // schema order: hyperlinks before pageMargins
  assert.ok(xml.indexOf("<hyperlinks>") < xml.indexOf("<pageMargins"));
  const back = sheetByName(result, "L k");
  const simple = (links) =>
    Object.fromEntries(
      Object.entries(links).map(([k, l]) => [k, [l.linkType, l.linkAddress]])
    );
  assert.deepEqual(simple(back.hyperlink), simple(hyperlink));
  assert.equal(back.hyperlink["0_0"].linkTooltip, "tip");
  assert.equal(cellMap(back).get("0_0").f, "=1+1");
});
