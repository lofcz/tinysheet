// T55: xlsx export fidelity. The exported file is read back with ExcelJS
// (and as raw XML where ExcelJS hides details) to check what Excel sees.
import test from "node:test";
import assert from "node:assert/strict";
import { exportToXlsx, toExcelFormula } from "../dist/index.js";
import { readWithExcelJS, zipText } from "./helpers.mjs";
import { tinySheetWorkbook } from "./fixtures/tinysheetWorkbook.mjs";

let exported;
async function exportedFile() {
  if (!exported) {
    const bytes = await exportToXlsx(tinySheetWorkbook());
    exported = { bytes, wb: await readWithExcelJS(bytes) };
  }
  return exported;
}

test("formulas are written with Excel future-function prefixes", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  assert.equal(ws.getCell("B1").formula, "_xlfn.XLOOKUP(A2,A2:A3,A2:A3)");
  assert.equal(ws.getCell("C1").formula, "_xlfn.LET(_xlpm.x,2,_xlpm.x*A2)");
  assert.equal(
    ws.getCell("C2").formula,
    "_xlfn._xlws.FILTER(A2:A3,A2:A3>2000)"
  );
  assert.equal(ws.getCell("C3").formula, "SUM(_xlfn.ANCHORARRAY(B2))");
  assert.equal(
    ws.getCell("C4").formula,
    '_xlfn.CONCAT("a","b")&_xlfn.TEXTJOIN(",",TRUE,"x","y")'
  );
  assert.equal(ws.getCell("C5").formula, "SUM(A2:A3)");
  assert.equal(ws.getCell("C6").formula, "'Other Sheet'!B2");
});

test("formula cached values are written", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  assert.equal(ws.getCell("B1").result, 1234.5);
  assert.equal(ws.getCell("C4").result, "abx,y");
  assert.deepEqual(ws.getCell("A5").result, { error: "#DIV/0!" });
});

test("spilling formulas become dynamic-array formulas with cm metadata", async () => {
  const { bytes, wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  const b2 = ws.getCell("B2");
  assert.equal(b2.formula, "_xlfn.SEQUENCE(3)");
  assert.equal(b2.model.shareType, "array");
  assert.equal(b2.model.ref, "B2:B4");
  assert.equal(ws.getCell("B3").value, 2);
  assert.equal(ws.getCell("B4").value, 3);

  const sheetXml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(sheetXml, /<c r="B2" cm="1"/);
  assert.match(sheetXml, /<f t="array" ref="B2:B4">_xlfn.SEQUENCE\(3\)<\/f>/);
  // FILTER / LET / A1# are dynamic-array formulas even when they fit one cell.
  assert.match(sheetXml, /<c r="C2" cm="1"/);
  assert.match(sheetXml, /<c r="C3" cm="1"/);
  // Plain formulas stay plain.
  assert.doesNotMatch(sheetXml, /<c r="C5" cm="1"/);

  const metadata = await zipText(bytes, "xl/metadata.xml");
  assert.match(metadata, /XLDAPR/);
  assert.match(metadata, /fDynamic="1"/);
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(types, /\/xl\/metadata\.xml/);
  const rels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  assert.match(rels, /relationships\/sheetMetadata" Target="metadata.xml"/);
});

test("values and number formats", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  assert.equal(ws.getCell("A2").value, 1234.5);
  assert.equal(ws.getCell("A2").numFmt, '"$"#,##0.00');
  assert.equal(ws.getCell("A3").numFmt, "yyyy-mm-dd");
  // ExcelJS turns date-formatted serials into Dates: 45000 = 2023-03-15.
  assert.equal(ws.getCell("A3").value.toISOString().slice(0, 10), "2023-03-15");
  assert.equal(ws.getCell("A4").value, true);
  assert.equal(ws.getCell("A10").numFmt, "0.0%");
  assert.equal(ws.getCell("B10").value, "007");
  assert.equal(ws.getCell("B10").numFmt, "@");
});

test("fonts, fills, alignment, wrap and rotation", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  const a1 = ws.getCell("A1");
  assert.equal(a1.font.name, "Arial");
  assert.equal(a1.font.size, 14);
  assert.equal(a1.font.bold, true);
  assert.equal(a1.font.italic, true);
  assert.equal(a1.font.underline, true);
  assert.equal(a1.font.strike, true);
  assert.equal(a1.font.color.argb, "FFFF0000");
  assert.equal(a1.fill.fgColor.argb, "FFFFFF00");
  assert.equal(a1.alignment.horizontal, "center");
  assert.equal(a1.alignment.vertical, "middle");
  assert.equal(a1.alignment.wrapText, true);
  assert.equal(a1.alignment.textRotation, 45);
  assert.equal(ws.getCell("C10").alignment.textRotation, "vertical");
  assert.equal(ws.getCell("D10").alignment.textRotation, -45);
  assert.equal(ws.getCell("A6").alignment.horizontal, "right");
  assert.equal(ws.getCell("A6").alignment.vertical, "top");
});

test("borders", async () => {
  const { wb } = await exportedFile();
  const border = wb.getWorksheet("Report").getCell("A1").border;
  assert.equal(border.left.style, "thin");
  assert.equal(border.bottom.style, "thick");
  assert.equal(border.bottom.color.argb, "FFFF0000");
});

test("merges, column widths, row heights and hidden rows/columns", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  assert.ok(ws.model.merges.includes("A6:B7"));
  assert.ok(Math.abs(ws.getColumn(1).width - 18.955) < 0.01);
  assert.ok(Math.abs(ws.getColumn(3).width - 5.205) < 0.01);
  assert.equal(ws.getRow(1).height, 30);
  assert.equal(ws.getRow(5).height, 18.75);
  assert.equal(ws.getRow(9).hidden, true);
  assert.equal(ws.getColumn(6).hidden, true);
  assert.equal(ws.getColumn(2).hidden, false);
});

test("freeze panes, gridlines and zoom", async () => {
  const { wb } = await exportedFile();
  const [view] = wb.getWorksheet("Report").views;
  assert.equal(view.state, "frozen");
  assert.equal(view.xSplit, 2);
  assert.equal(view.ySplit, 1);
  assert.equal(view.topLeftCell, "C2");
  assert.equal(view.showGridLines, false);
  assert.equal(view.zoomScale, 125);
});

test("hyperlinks: external targets and internal locations", async () => {
  const { bytes, wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  assert.equal(ws.getCell("D1").hyperlink, "https://example.com/a?b=1&c=2");
  assert.equal(ws.getCell("D1").text, "site");

  const sheetXml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  const internal = /<hyperlink [^>]*ref="D2"[^>]*\/>/.exec(sheetXml)[0];
  assert.match(internal, /location="'Other Sheet'!B2"/);
  assert.doesNotMatch(internal, /r:id=/);
  const rels = await zipText(bytes, "xl/worksheets/_rels/sheet1.xml.rels");
  assert.doesNotMatch(rels, /Target="#/);
  assert.match(rels, /https:\/\/example.com/);
});

test("notes, rich text, tab colour and hidden sheets", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  const note = ws.getCell("D3").note;
  const noteText =
    typeof note === "string" ? note : note.texts.map((t) => t.text).join("");
  assert.equal(noteText, "A note\nline 2");

  const rich = ws.getCell("D4").value.richText;
  assert.equal(rich[0].text, "Bold");
  assert.equal(rich[0].font.bold, true);
  assert.equal(rich[0].font.color.argb, "FFFF0000");
  assert.equal(rich[1].text, " and italic");
  assert.equal(rich[1].font.italic, true);

  assert.equal(ws.properties.tabColor.argb, "FF00B050");
  assert.equal(wb.getWorksheet("Other Sheet").state, "hidden");
});

test("data validation", async () => {
  const { wb } = await exportedFile();
  const ws = wb.getWorksheet("Report");
  const list = ws.getCell("A8").dataValidation;
  assert.equal(list.type, "list");
  assert.deepEqual(list.formulae, ['"a,b,c"']);
  assert.equal(list.showErrorMessage, true);
  assert.equal(list.prompt, "pick one");

  const whole = ws.getCell("B8").dataValidation;
  assert.equal(whole.type, "whole");
  assert.equal(whole.operator, "between");
  assert.deepEqual(whole.formulae.map(Number), [1, 10]);

  const date = ws.getCell("C8").dataValidation;
  assert.equal(date.type, "date");
  assert.equal(date.operator, "greaterThan");

  const custom = ws.getCell("D8").dataValidation;
  assert.equal(custom.type, "custom");
  assert.deepEqual(custom.formulae, ['ISNUMBER(SEARCH("x",D8))']);

  const length = ws.getCell("E8").dataValidation;
  assert.equal(length.type, "textLength");
  assert.equal(length.operator, "lessThanOrEqual");
});

test("sheets given as loaded data matrices export like celldata", async () => {
  const [report] = tinySheetWorkbook();
  const data = [];
  for (const { r, c, v } of report.celldata) {
    while (data.length <= r) data.push([]);
    data[r][c] = v;
  }
  const bytes = await exportToXlsx([{ ...report, celldata: undefined, data }]);
  const ws = (await readWithExcelJS(bytes)).getWorksheet("Report");
  assert.equal(ws.getCell("B1").formula, "_xlfn.XLOOKUP(A2,A2:A3,A2:A3)");
  assert.equal(ws.getCell("A2").value, 1234.5);
});

test("sheet names are made valid and unique for Excel", async () => {
  const bytes = await exportToXlsx([
    { name: "a/b", celldata: [] },
    { name: "A/B", celldata: [] },
    { name: "x".repeat(40), celldata: [] },
  ]);
  const wb = await readWithExcelJS(bytes);
  assert.deepEqual(
    wb.worksheets.map((ws) => ws.name),
    ["a_b", "A_B (2)", "x".repeat(31)]
  );
});

test("toExcelFormula leaves strings, sheet names and existing prefixes alone", () => {
  assert.equal(toExcelFormula('="XLOOKUP(1)"&A1').formula, '"XLOOKUP(1)"&A1');
  assert.equal(
    toExcelFormula("='FILTER'!A1+SORT!B2").formula,
    "'FILTER'!A1+SORT!B2"
  );
  assert.equal(
    toExcelFormula("=_xlfn.XLOOKUP(1,A:A,B:B)").formula,
    "_xlfn.XLOOKUP(1,A:A,B:B)"
  );
  assert.equal(
    toExcelFormula("=sort(A1:A3)").formula,
    "_xlfn._xlws.sort(A1:A3)"
  );
  assert.equal(
    toExcelFormula("=LAMBDA(a,b,a+b)(1,2)").formula,
    "_xlfn.LAMBDA(_xlpm.a,_xlpm.b,_xlpm.a+_xlpm.b)(1,2)"
  );
  assert.equal(
    toExcelFormula("=MAP(A1:A3,LAMBDA(v,v*2))").formula,
    "_xlfn.MAP(A1:A3,_xlfn.LAMBDA(_xlpm.v,_xlpm.v*2))"
  );
  assert.equal(toExcelFormula("=@A1:A10").formula, "_xlfn.SINGLE(A1:A10)");
  assert.equal(
    toExcelFormula("=STDEV.S(A1:A3)").formula,
    "_xlfn.STDEV.S(A1:A3)"
  );
  assert.equal(
    toExcelFormula("=Sheet2!A1#").formula,
    "_xlfn.ANCHORARRAY(Sheet2!A1)"
  );
  assert.equal(toExcelFormula("=IF(A1,#N/A,1)").formula, "IF(A1,#N/A,1)");
  assert.equal(toExcelFormula("=SUM(A1:B2)").dynamic, false);
  assert.equal(toExcelFormula("=UNIQUE(A1:B2)").dynamic, true);
});
