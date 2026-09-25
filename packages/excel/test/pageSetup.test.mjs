// Page layout round trip (T94): pageSetup, pageMargins, printOptions,
// headerFooter, rowBreaks/colBreaks, print areas and print titles.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "@protobi/exceljs";
import {
  excelJsBytes,
  importXlsx,
  patchZip,
  readWithExcelJS,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

function sheet(name, pageSetup, extra = {}) {
  return {
    name,
    order: 0,
    celldata: [{ r: 0, c: 0, v: { v: "x", m: "x" } }],
    pageSetup,
    ...extra,
  };
}

const FULL = {
  orientation: "landscape",
  paperSize: "a4",
  margins: {
    top: 1,
    bottom: 1.25,
    left: 0.5,
    right: 0.5,
    header: 0.4,
    footer: 0.45,
  },
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  firstPageNumber: 3,
  printQuality: 600,
  centerHorizontally: true,
  centerVertically: true,
  gridLines: true,
  headings: true,
  blackAndWhite: true,
  draft: true,
  pageOrder: "overThenDown",
  comments: "asDisplayed",
  cellErrors: "dash",
  header: { left: "&B&A", center: "Report", right: "&D" },
  footer: { center: "Page &P of &N" },
  differentFirst: true,
  firstHeader: { center: "Cover" },
  differentOddEven: true,
  evenFooter: { left: "&P" },
  scaleWithDoc: false,
  alignWithMargins: false,
  rowBreaks: [10, 25],
  colBreaks: [4],
  printArea: [
    { row: [0, 39], column: [0, 7] },
    { row: [50, 59], column: [2, 3] },
  ],
  printTitleRows: [0, 1],
  printTitleColumns: [0, 0],
};

test("a full Page Setup survives export -> import", async () => {
  const { bytes, result } = await roundTrip([sheet("Sales Q1", FULL)]);
  const got = sheetByName(result, "Sales Q1").pageSetup;
  assert.deepEqual(got, FULL);

  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(xml, /<colBreaks count="1" manualBreakCount="1"><brk id="4"/);
  assert.match(xml, /cellComments="asDisplayed"/);
  assert.match(xml, /<headerFooter scaleWithDoc="0" alignWithMargins="0"/);
  // schema order: headerFooter, rowBreaks, colBreaks, then drawings/tables
  assert.ok(xml.indexOf("<rowBreaks") < xml.indexOf("<colBreaks"));
  assert.ok(xml.indexOf("</headerFooter>") < xml.indexOf("<rowBreaks"));
  const wb = (await zipText(bytes, "xl/workbook.xml")).replace(/&apos;/g, "'");
  assert.match(
    wb,
    /<definedName name="_xlnm.Print_Area" localSheetId="0">'Sales Q1'!\$A\$1:\$H\$40,'Sales Q1'!\$C\$51:\$D\$60<\/definedName>/
  );
  assert.match(
    wb,
    /<definedName name="_xlnm.Print_Titles" localSheetId="0">'Sales Q1'!\$A:\$A,'Sales Q1'!\$1:\$2<\/definedName>/
  );
});

test("ExcelJS (Excel's view) reads the written page setup", async () => {
  const { bytes } = await roundTrip([sheet("S", FULL)]);
  const ws = (await readWithExcelJS(bytes)).getWorksheet("S");
  assert.equal(ws.pageSetup.orientation, "landscape");
  assert.equal(ws.pageSetup.paperSize, 9);
  assert.equal(ws.pageSetup.fitToPage, true);
  assert.equal(ws.pageSetup.fitToHeight, 0);
  assert.equal(ws.pageSetup.margins.top, 1);
  assert.equal(ws.pageSetup.showGridLines, true);
  assert.equal(ws.headerFooter.oddHeader, "&L&B&A&CReport&R&D");
  assert.equal(ws.pageSetup.printTitlesRow, "1:2");
  assert.match(ws.pageSetup.printArea, /^A1:H40/);
});

test("a sheet without page setup writes Excel's defaults and imports none", async () => {
  const { result } = await roundTrip([sheet("Plain", undefined)]);
  assert.equal(sheetByName(result, "Plain").pageSetup, undefined);
});

test("print names go to the right sheet of a multi-sheet workbook", async () => {
  const { result } = await roundTrip([
    sheet("One", { printArea: [{ row: [0, 4], column: [0, 1] }] }),
    { ...sheet("It's two", { printTitleRows: [2, 2] }), order: 1 },
  ]);
  assert.deepEqual(sheetByName(result, "One").pageSetup, {
    printArea: [{ row: [0, 4], column: [0, 1] }],
  });
  assert.deepEqual(sheetByName(result, "It's two").pageSetup, {
    printTitleRows: [2, 2],
  });
});

test("imports page layout written by other tools", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report", {
    pageSetup: {
      paperSize: 5,
      orientation: "portrait",
      scale: 75,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
      printArea: "A1:D20",
      printTitlesRow: "1:1",
    },
  });
  ws.getCell("A1").value = "Title";
  ws.headerFooter.oddFooter = "&CPage &P";
  ws.getRow(10).addPageBreak();
  const bytes = await patchZip(await excelJsBytes(wb), {
    "xl/worksheets/sheet1.xml": (xml) =>
      xml.replace(
        "</rowBreaks>",
        '</rowBreaks><colBreaks count="1" manualBreakCount="1"><brk id="2" max="1048575" man="1"/></colBreaks>'
      ),
  });
  const result = await importXlsx(bytes);
  const setup = sheetByName(result, "Report").pageSetup;
  assert.equal(setup.paperSize, "legal");
  assert.equal(setup.scale, 75);
  assert.equal(setup.margins.left, 0.25);
  assert.deepEqual(setup.footer, { center: "Page &P" });
  assert.deepEqual(setup.rowBreaks, [10]);
  assert.deepEqual(setup.colBreaks, [2]);
  assert.deepEqual(setup.printArea, [{ row: [0, 19], column: [0, 3] }]);
  assert.deepEqual(setup.printTitleRows, [0, 0]);
  // print names are not user defined names
  assert.equal(
    (sheetByName(result, "Report").definedNames ?? []).some((n) =>
      n.name.startsWith("_xlnm")
    ),
    false
  );
});
