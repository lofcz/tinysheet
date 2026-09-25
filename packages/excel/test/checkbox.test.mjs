// Cell checkboxes (Excel 365 Insert > Checkbox) through xlsx: the checkbox
// is a cell format feature (xfComplement -> featurePropertyBag), see
// src/ToExcel/ExcelCheckbox.ts.
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  cellMap,
  importXlsx,
  readWithExcelJS,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

const bool = (v, extra = {}) => ({
  v,
  m: v ? "TRUE" : "FALSE",
  ct: { fa: "General", t: "b" },
  ...extra,
});

function sheet(name, cells) {
  return {
    name,
    order: 0,
    celldata: Object.entries(cells).map(([rc, v]) => {
      const [r, c] = rc.split("_").map(Number);
      return { r, c, v };
    }),
  };
}

test("checkbox cells export a feature property bag and round-trip", async () => {
  const { bytes, result } = await roundTrip([
    sheet("Tasks", {
      "0_0": bool(true, { cb: 1 }),
      "1_0": bool(false, { cb: 1, bl: 1 }),
      "2_0": bool(true), // a plain boolean shares the format of A1
      "3_0": { v: "text", m: "text", cb: 1 }, // non-boolean keeps the format
      "0_1": {
        f: "=A1",
        v: true,
        m: "TRUE",
        ct: { fa: "General", t: "b" },
        cb: 1,
      },
    }),
  ]);

  const bag = await zipText(
    bytes,
    "xl/featurePropertyBag/featurePropertyBag.xml"
  );
  assert.match(bag, /<bag type="Checkbox"\/>/);
  assert.match(bag, /<bag type="XFControls"><bagId k="CellControl">0<\/bagId>/);
  assert.match(bag, /<a k="MappedFeaturePropertyBags"><bagId>2<\/bagId><\/a>/);
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(
    types,
    /PartName="\/xl\/featurePropertyBag\/featurePropertyBag.xml" ContentType="application\/vnd.ms-excel.featurepropertybag\+xml"/
  );
  const rels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  assert.match(
    rels,
    /Type="http:\/\/schemas.microsoft.com\/office\/2022\/11\/relationships\/FeaturePropertyBag" Target="featurePropertyBag\/featurePropertyBag.xml"/
  );
  const styles = await zipText(bytes, "xl/styles.xml");
  assert.match(
    styles,
    /<ext uri="\{C7286773-470A-42A8-94C5-96B5CB345126\}" xmlns:xfpb="http:\/\/schemas.microsoft.com\/office\/spreadsheetml\/2022\/featurepropertybag"><xfpb:xfComplement i="0"\/><\/ext>/
  );
  // cellXfs count matches its entries
  const cellXfs = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(styles);
  const xfCount = (cellXfs[2].match(/<xf\b/g) || []).length;
  assert.equal(Number(cellXfs[1]), xfCount);

  // booleans stay booleans, the file still opens in ExcelJS, bold kept
  const ws = (await readWithExcelJS(bytes)).getWorksheet("Tasks");
  assert.equal(ws.getCell("A1").value, true);
  assert.equal(ws.getCell("A2").value, false);
  assert.equal(ws.getCell("A2").font?.bold, true);

  const cells = cellMap(sheetByName(result, "Tasks"));
  assert.equal(cells.get("0_0").cb, 1);
  assert.equal(cells.get("1_0").cb, 1);
  assert.equal(cells.get("1_0").bl, 1);
  assert.equal(cells.get("2_0").cb, undefined);
  assert.equal(cells.get("3_0").cb, 1);
  assert.equal(cells.get("0_1").cb, 1);
});

test("sheets without checkboxes get no feature property bag", async () => {
  const { bytes } = await roundTrip([sheet("Plain", { "0_0": bool(true) })]);
  assert.equal(
    await zipText(bytes, "xl/featurePropertyBag/featurePropertyBag.xml"),
    null
  );
  assert.doesNotMatch(await zipText(bytes, "xl/styles.xml"), /xfComplement/);
});

test("imports checkboxes written the way Excel writes them", async () => {
  // start from an exported file and rewrite its parts like Excel 365
  const { bytes } = await roundTrip([
    sheet("S", { "0_0": bool(false), "1_0": bool(true) }),
  ]);
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  let styles = await zip.file("xl/styles.xml").async("string");
  styles = styles.replace(
    /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/,
    (_m, count, inner) =>
      `<cellXfs count="${Number(count) + 1}">${inner}` +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><extLst>' +
      '<ext uri="{C7286773-470A-42A8-94C5-96B5CB345126}" xmlns:xfpb="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag">' +
      '<xfpb:xfComplement i="0"/></ext></extLst></xf></cellXfs>'
  );
  const index = Number(/<cellXfs count="(\d+)">/.exec(styles)[1]) - 1;
  zip.file("xl/styles.xml", styles);
  let ws = await zip.file("xl/worksheets/sheet1.xml").async("string");
  ws = ws.replace(/<c r="A2"[^>]*>/, (tag) =>
    /\ss="\d+"/.test(tag)
      ? tag.replace(/\ss="\d+"/, ` s="${index}"`)
      : tag.replace('<c r="A2"', `<c r="A2" s="${index}"`)
  );
  zip.file("xl/worksheets/sheet1.xml", ws);
  zip.file(
    "xl/featurePropertyBag/featurePropertyBag.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<FeaturePropertyBags xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag">' +
      '<bag type="Checkbox"/><bag type="XFControls"><bagId k="CellControl">0</bagId></bag>' +
      '<bag type="XFComplement"><bagId k="XFControls">1</bagId></bag>' +
      '<bag type="XFComplements" extRef="XFComplementsMapperExtRef"><a k="MappedFeaturePropertyBags"><bagId>2</bagId></a></bag>' +
      "</FeaturePropertyBags>"
  );
  const patched = await zip.generateAsync({ type: "nodebuffer" });
  const cells = cellMap(sheetByName(await importXlsx(patched), "S"));
  assert.equal(cells.get("1_0").cb, 1);
  assert.equal(cells.get("0_0").cb, undefined);
});
