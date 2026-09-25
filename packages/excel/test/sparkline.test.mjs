// Sparklines (R5, T82): x14:sparklineGroups in the worksheet extLst.
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

function sheet(name, cells, extra = {}) {
  return {
    name,
    order: 0,
    celldata: Object.entries(cells).map(([rc, v]) => {
      const [r, c] = rc.split("_").map(Number);
      return { r, c, v: { v, m: String(v), ct: { fa: "General", t: "n" } } };
    }),
    ...extra,
  };
}

const colors = {
  series: "#112233",
  negative: "#FF0000",
  axis: "#000000",
  markers: "#445566",
  first: "#778899",
  last: "#AABBCC",
  high: "#00FF00",
  low: "#0000FF",
};

const groups = [
  {
    id: "g1",
    type: "line",
    colors,
    markers: true,
    high: true,
    low: true,
    first: true,
    last: true,
    negative: true,
    displayXAxis: true,
    displayEmptyCellsAs: "gap",
    lineWeight: 1.5,
    sparklines: [
      { r: 0, c: 4, f: "Data!A1:D1" },
      { r: 1, c: 4, f: "Data!A2:D2" },
    ],
  },
  {
    id: "g2",
    type: "column",
    colors,
    displayEmptyCellsAs: "zero",
    minAxisType: "custom",
    manualMin: -5,
    maxAxisType: "group",
    sparklines: [{ r: 2, c: 4, f: "Data!A3:D3" }],
  },
  {
    id: "g3",
    type: "winloss",
    colors,
    negative: true,
    displayEmptyCellsAs: "span",
    displayHidden: true,
    rightToLeft: true,
    dateAxis: "Data!A5:D5",
    sparklines: [{ r: 3, c: 4, f: "Data!A4:D4" }],
  },
];

const data = {
  "0_0": 1,
  "0_1": 3,
  "0_2": 2,
  "0_3": 5,
  "1_0": -1,
  "1_1": 4,
  "1_2": 0,
  "1_3": 2,
  "2_0": 7,
  "2_1": 8,
  "2_2": 9,
  "2_3": 3,
  "3_0": 1,
  "3_1": -1,
  "3_2": 1,
  "3_3": 1,
  "4_0": 45000,
  "4_1": 45001,
  "4_2": 45003,
  "4_3": 45010,
};

const strip = (g) => {
  const rest = { ...g };
  delete rest.id;
  return rest;
};

test("sparkline groups survive export -> import with every option", async () => {
  const { bytes, result } = await roundTrip([
    sheet("Data", data, { sparklineGroups: groups }),
  ]);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(
    xml,
    /<extLst><ext uri="\{05C60535-1F16-4fd2-B633-F4F36F0B64E0\}" xmlns:x14=/
  );
  assert.match(
    xml,
    /<x14:sparklineGroup lineWeight="1.5" displayEmptyCellsAs="gap" markers="1" high="1" low="1" first="1" last="1" negative="1" displayXAxis="1">/
  );
  assert.match(xml, /type="stacked" dateAxis="1"/);
  assert.match(xml, /<x14:colorSeries rgb="FF112233"\/>/);
  assert.match(
    xml,
    /<x14:sparkline><xm:f>Data!A1:D1<\/xm:f><xm:sqref>E1<\/xm:sqref><\/x14:sparkline>/
  );
  // still a valid workbook for other readers
  const wb = await readWithExcelJS(bytes);
  assert.equal(wb.getWorksheet("Data").getCell("A1").value, 1);

  const imported = sheetByName(result, "Data").sparklineGroups;
  assert.equal(imported.length, 3);
  imported.forEach((g) => assert.match(g.id, /^spk_/));
  assert.deepEqual(imported.map(strip), groups.map(strip));
});

test("sparklines share the extLst with conditional-format extensions", async () => {
  const { bytes, result } = await roundTrip([
    sheet("Data", data, {
      sparklineGroups: [groups[0]],
      luckysheet_conditionformat_save: [
        {
          type: "dataBar",
          cellrange: [{ row: [0, 3], column: [0, 0] }],
          dataBar: {
            color: "#638EC6",
            gradient: true,
            border: true,
            borderColor: "#638EC6",
            negativeColor: "#FF0000",
            negativeBorderColor: "#FF0000",
            sameNegativeColor: false,
            direction: "context",
            axisPosition: "automatic",
            axisColor: "#000000",
            min: { type: "autoMin" },
            max: { type: "autoMax" },
            showValue: true,
            minLength: 0,
            maxLength: 100,
          },
        },
      ],
    }),
  ]);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  // one worksheet extLst (the last child) holding both extensions
  const tail = xml.slice(xml.lastIndexOf("<extLst>"));
  assert.match(tail, /\{78C0D931-6437-407d-A8EE-F0AAD7539E65\}/);
  assert.match(tail, /\{05C60535-1F16-4fd2-B633-F4F36F0B64E0\}/);
  assert.ok(
    xml.trim().endsWith("</x14:sparklineGroups></ext></extLst></worksheet>")
  );
  assert.match(xml, /<x14:conditionalFormattings>/);
  assert.equal(sheetByName(result, "Data").sparklineGroups.length, 1);
});

test("imports Excel-written sparklines with theme colours and defaults", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.getCell("A1").value = 1;
  ws.getCell("B1").value = 2;
  const ext =
    '<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" ' +
    'xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main">' +
    '<x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">' +
    '<x14:sparklineGroup displayEmptyCellsAs="gap" high="1" xr2:uid="{1}">' +
    '<x14:colorSeries theme="4" tint="-0.499984740745262"/>' +
    '<x14:colorNegative theme="5"/><x14:colorAxis rgb="FF000000"/>' +
    '<x14:colorMarkers theme="4" tint="-0.499984740745262"/>' +
    '<x14:colorFirst theme="4" tint="0.39997558519241921"/>' +
    '<x14:colorLast theme="4" tint="0.39997558519241921"/>' +
    '<x14:colorHigh rgb="FF00B050"/><x14:colorLow theme="4"/>' +
    "<x14:sparklines><x14:sparkline><xm:f>Sheet1!A1:B1</xm:f>" +
    "<xm:sqref>C1</xm:sqref></x14:sparkline></x14:sparklines>" +
    "</x14:sparklineGroup>" +
    '<x14:sparklineGroup type="column">' +
    "<x14:sparklines><x14:sparkline><xm:f>'My &amp; Sheet'!A1:B1</xm:f>" +
    "<xm:sqref>D1</xm:sqref></x14:sparkline></x14:sparklines>" +
    "</x14:sparklineGroup>" +
    "</x14:sparklineGroups></ext></extLst>";
  const bytes = await patchZip(await excelJsBytes(wb), {
    "xl/worksheets/sheet1.xml": (xml) =>
      xml.replace("</worksheet>", `${ext}</worksheet>`),
  });
  const result = await importXlsx(bytes);
  const [line, column] = sheetByName(result, "Sheet1").sparklineGroups;
  assert.equal(line.type, "line");
  assert.equal(line.high, true);
  assert.equal(line.displayEmptyCellsAs, "gap");
  assert.equal(line.colors.high, "#00B050");
  assert.match(line.colors.series, /^#[0-9A-F]{6}$/i);
  assert.notEqual(line.colors.series, line.colors.first);
  assert.deepEqual(line.sparklines, [{ r: 0, c: 2, f: "Sheet1!A1:B1" }]);
  assert.equal(column.type, "column");
  // no displayEmptyCellsAs: the schema default
  assert.equal(column.displayEmptyCellsAs, "zero");
  assert.equal(column.sparklines[0].f, "'My & Sheet'!A1:B1");
});
