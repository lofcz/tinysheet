// Pictures in cells (R1 / T67): placed pictures become Excel rich values
// (xl/richData + vm metadata), IMAGE() formulas get the _xlfn. prefix, and
// both come back on import.
import test from "node:test";
import assert from "node:assert/strict";
import {
  cellMap,
  importXlsx,
  patchZip,
  readWithExcelJS,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

// a 1x1 PNG
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const DATA_URL = `data:image/png;base64,${PNG}`;
const WEB = "https://example.com/logo.png";

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

const picture = (img) => ({
  v: img.alt ?? "",
  m: img.alt ?? "",
  ct: { fa: "General", t: "g" },
  img,
});

function sheets() {
  return [
    sheet("Pics", {
      "0_0": picture({ src: DATA_URL, alt: "Dot" }),
      "1_0": picture({ src: DATA_URL }),
      "2_0": picture({ src: WEB, alt: "Logo" }),
      "3_0": {
        f: `=IMAGE("${WEB}","Logo",1)`,
        ...picture({ src: WEB, alt: "Logo", sizing: 1 }),
      },
      // a dynamic array shares xl/metadata.xml with the pictures
      "0_2": { f: "=SEQUENCE(2)", v: 1, m: "1", spill: { rs: 2, cs: 1 } },
      "1_2": { v: 2, m: "2", spillFrom: { dr: 1, dc: 0 } },
    }),
  ];
}

test("placed pictures are written as rich values in cells", async () => {
  const { bytes } = await roundTrip(sheets());
  const sheetXml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(sheetXml, /<c r="A1" vm="1"[^>]*t="e"[^>]*><v>#VALUE!<\/v>/);
  assert.match(sheetXml, /<c r="A2" vm="2"/);
  // the dynamic array keeps its cell metadata
  assert.match(sheetXml, /<c r="C1" cm="1"/);

  const metadata = await zipText(bytes, "xl/metadata.xml");
  assert.match(metadata, /<metadataTypes count="2">/);
  assert.match(metadata, /name="XLDAPR"/);
  assert.match(metadata, /<metadataType name="XLRICHVALUE"/);
  assert.match(metadata, /<cellMetadata count="1"><bk><rc t="1" v="0"\/>/);
  assert.match(
    metadata,
    /<valueMetadata count="2"><bk><rc t="2" v="0"\/><\/bk><bk><rc t="2" v="1"\/><\/bk><\/valueMetadata>/
  );
  assert.match(metadata, /<futureMetadata name="XLRICHVALUE" count="2">/);

  const values = await zipText(bytes, "xl/richData/rdrichvalue.xml");
  // the same picture is stored once; alt text goes in the Text key
  assert.match(values, /<rv s="1"><v>0<\/v><v>5<\/v><v>Dot<\/v><\/rv>/);
  assert.match(values, /<rv s="0"><v>0<\/v><v>5<\/v><\/rv>/);
  const structures = await zipText(
    bytes,
    "xl/richData/rdrichvaluestructure.xml"
  );
  assert.match(
    structures,
    /<s t="_localImage"><k n="_rvRel:LocalImageIdentifier"/
  );
  const rels = await zipText(bytes, "xl/richData/_rels/richValueRel.xml.rels");
  assert.match(rels, /Target="\.\.\/media\/cellimage1\.png"/);
  assert.ok(await zipText(bytes, "xl/media/cellimage1.png"));
  assert.ok(await zipText(bytes, "xl/richData/rdRichValueTypes.xml"));

  const wbRels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  for (const type of [
    "sheetMetadata",
    "rdRichValue",
    "rdRichValueStructure",
    "rdRichValueTypes",
    "richValueRel",
  ]) {
    assert.match(wbRels, new RegExp(`/${type}" Target=`));
  }
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(types, /application\/vnd\.ms-excel\.rdrichvalue\+xml/);
  assert.match(types, /application\/vnd\.ms-excel\.richvaluerel\+xml/);
  assert.match(types, /<Default Extension="png"/i);
});

test("web pictures and IMAGE() are _xlfn.IMAGE formulas", async () => {
  const { bytes } = await roundTrip(sheets());
  const ws = (await readWithExcelJS(bytes)).getWorksheet("Pics");
  assert.equal(ws.getCell("A3").formula, `_xlfn.IMAGE("${WEB}","Logo")`);
  assert.equal(ws.getCell("A4").formula, `_xlfn.IMAGE("${WEB}","Logo",1)`);
  const workbookXml = await zipText(bytes, "xl/workbook.xml");
  assert.match(workbookXml, /fullCalcOnLoad="1"/);
});

test("pictures come back on import", async () => {
  const { result } = await roundTrip(sheets());
  const cells = cellMap(sheetByName(result, "Pics"));
  const a1 = cells.get("0_0");
  assert.deepEqual(a1.img, { src: DATA_URL, alt: "Dot" });
  assert.equal(a1.v, "Dot");
  assert.equal(a1.ct.t, "g");
  assert.deepEqual(cells.get("1_0").img, { src: DATA_URL });
  assert.equal(cells.get("1_0").v, "");
  assert.equal(cells.get("2_0").f, `=IMAGE("${WEB}","Logo")`);
  assert.equal(cells.get("3_0").f, `=IMAGE("${WEB}","Logo",1)`);
  // the spilled formula is untouched
  assert.equal(cells.get("0_2").f, "=SEQUENCE(2)");
});

test("IMAGE() results Excel stored as web-image rich values import as pictures", async () => {
  // start from our file and rewrite the first picture as Excel's
  // _webimage rich value of an IMAGE() formula
  const { bytes } = await roundTrip(sheets());
  const patched = await patchZip(bytes, {
    "xl/richData/rdrichvaluestructure.xml": (xml) =>
      xml
        .replace('count="2"', 'count="3"')
        .replace(
          "</rvStructures>",
          '<s t="_webimage"><k n="WebImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/>' +
            '<k n="ComputedImage" t="b"/><k n="ImageSizing" t="i"/><k n="Text" t="s"/></s></rvStructures>'
        ),
    "xl/richData/rdrichvalue.xml": (xml) =>
      xml.replace(
        /<rv s="1">[\s\S]*?<\/rv>/,
        '<rv s="2"><v>0</v><v>1</v><v>1</v><v>1</v><v>Web logo</v></rv>'
      ),
    "xl/richData/rdRichValueWebImage.xml": () =>
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<webImagesSrd xmlns="http://schemas.microsoft.com/office/spreadsheetml/2020/richdatawebimage" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<webImageSrd><address r:id="rId1"/></webImageSrd></webImagesSrd>',
    "xl/richData/_rels/rdRichValueWebImage.xml.rels": () =>
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${WEB}" TargetMode="External"/>` +
      "</Relationships>",
  });
  const result = await importXlsx(patched);
  const a1 = cellMap(sheetByName(result, "Pics")).get("0_0");
  assert.deepEqual(a1.img, { src: WEB, alt: "Web logo", sizing: 1 });
  assert.equal(a1.v, "Web logo");
});
