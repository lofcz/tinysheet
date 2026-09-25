// Round trips of sheet / workbook protection and the sheet view options
// (R9): sheetProtection flags and password hashes, protectedRanges,
// workbookProtection, sheetView showGridLines / showRowColHeaders /
// rightToLeft / zoomScale, cell locked / hidden.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ExcelJS from "@protobi/exceljs";
import {
  excelJsBytes,
  importXlsx,
  patchZip,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

function sheet(name, extra = {}, order = 0) {
  return {
    name,
    order,
    celldata: [
      { r: 0, c: 0, v: { v: 1, m: "1", lo: 0 } },
      { r: 1, c: 0, v: { v: 2, m: "2", f: "=1+1", hi: 1 } },
    ],
    ...extra,
  };
}

/** Excel's iterated SHA-512 password hash (as Excel and ExcelJS compute it). */
function excelHash(password, salt, spinCount) {
  let h = createHash("sha512")
    .update(Buffer.concat([salt, Buffer.from(password, "utf16le")]))
    .digest();
  for (let i = 0; i < spinCount; i += 1) {
    const it = Buffer.alloc(4);
    it.writeUInt32LE(i, 0);
    h = createHash("sha512")
      .update(Buffer.concat([h, it]))
      .digest();
  }
  return h.toString("base64");
}

const salt = Buffer.from("0123456789abcdef");
const hash = {
  algorithmName: "SHA-512",
  hashValue: excelHash("secret", salt, 1000),
  saltValue: salt.toString("base64"),
  spinCount: 1000,
};

test("sheet protection, edit ranges and workbook structure round-trip", async () => {
  const authority = {
    sheet: 1,
    selectLockedCells: 1,
    selectunLockedCells: 1,
    formatCells: 1,
    formatColumns: 0,
    formatRows: 0,
    insertColumns: 0,
    insertRows: 1,
    insertHyperlinks: 0,
    deleteColumns: 0,
    deleteRows: 0,
    sort: 1,
    filter: 1,
    usePivotTablereports: 0,
    editObjects: 0,
    editScenarios: 1,
    ...hash,
    allowRangeList: [
      { name: "Inputs", sqref: "$B$2:$C$5 $E$1" },
      { name: "Locked", sqref: "$D$1", legacyHash: "CBEB" },
    ],
  };
  const { bytes, result } = await roundTrip([
    sheet("Prot", {
      config: { authority },
      workbookProtection: { lockStructure: true, legacyHash: "83AF" },
    }),
    sheet("Open", {}, 1),
  ]);

  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  const prot = /<sheetProtection\b[^>]*\/>/.exec(xml)[0];
  assert.match(prot, /sheet="1"/);
  assert.match(prot, /algorithmName="SHA-512"/);
  assert.match(
    prot,
    new RegExp(`hashValue="${hash.hashValue.replace(/[+/]/g, "\\$&")}"`)
  );
  assert.match(prot, /spinCount="1000"/);
  assert.match(prot, /objects="1"/);
  assert.doesNotMatch(prot, /scenarios=/);
  assert.match(prot, /formatCells="0"/);
  assert.match(prot, /insertRows="0"/);
  assert.match(prot, /sort="0"/);
  assert.match(prot, /autoFilter="0"/);
  assert.doesNotMatch(prot, /deleteRows=/);
  assert.doesNotMatch(prot, /selectLockedCells=/);
  // schema order: right after sheetData, before mergeCells etc.
  assert.ok(xml.indexOf("</sheetData>") < xml.indexOf("<sheetProtection"));
  assert.ok(xml.indexOf("<sheetProtection") < xml.indexOf("<protectedRanges>"));
  assert.match(
    xml,
    /<protectedRange sqref="B2:C5 E1" name="Inputs"\/><protectedRange password="CBEB" sqref="D1" name="Locked"\/>/
  );
  const second = await zipText(bytes, "xl/worksheets/sheet2.xml");
  assert.doesNotMatch(second, /sheetProtection/);

  const wb = await zipText(bytes, "xl/workbook.xml");
  assert.match(
    wb,
    /<workbookProtection workbookPassword="83AF" lockStructure="1"\/>/
  );
  assert.ok(wb.indexOf("<workbookProtection") < wb.indexOf("<sheets"));

  // Excel's reader (ExcelJS) sees the protection
  const ws = (await new ExcelJS.Workbook().xlsx.load(bytes)).getWorksheet(
    "Prot"
  );
  assert.equal(ws.sheetProtection.sheet, true);
  assert.equal(ws.sheetProtection.hashValue, hash.hashValue);

  const back = sheetByName(result, "Prot");
  const a = back.config.authority;
  assert.equal(a.sheet, 1);
  [
    "selectLockedCells",
    "selectunLockedCells",
    "formatCells",
    "formatColumns",
    "formatRows",
    "insertColumns",
    "insertRows",
    "insertHyperlinks",
    "deleteColumns",
    "deleteRows",
    "sort",
    "filter",
    "usePivotTablereports",
    "editObjects",
    "editScenarios",
  ].forEach((key) => assert.equal(a[key], authority[key], key));
  assert.equal(a.hashValue, hash.hashValue);
  assert.equal(a.saltValue, hash.saltValue);
  assert.equal(a.spinCount, 1000);
  assert.deepEqual(
    a.allowRangeList.map((r) => [r.name, r.sqref, r.legacyHash]),
    [
      ["Inputs", "$B$2:$C$5 $E$1", undefined],
      ["Locked", "$D$1", "CBEB"],
    ]
  );
  assert.deepEqual(back.workbookProtection, {
    lockStructure: true,
    legacyHash: "83AF",
  });
  assert.equal(sheetByName(result, "Open").config?.authority, undefined);
  assert.equal(sheetByName(result, "Open").workbookProtection, undefined);
});

test("SHA-512 workbook password and legacy sheet password come back", async () => {
  const { bytes, result } = await roundTrip([
    sheet("S", {
      config: { authority: { sheet: 1, legacyHash: "CBEB" } },
      workbookProtection: { lockStructure: true, ...hash },
    }),
  ]);
  const wb = await zipText(bytes, "xl/workbook.xml");
  assert.match(wb, /workbookAlgorithmName="SHA-512"/);
  assert.match(wb, /workbookSpinCount="1000"/);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(
    xml,
    /<sheetProtection password="CBEB" sheet="1" objects="1" scenarios="1"\/>/
  );
  const back = sheetByName(result, "S");
  assert.equal(back.config.authority.legacyHash, "CBEB");
  // defaults: selecting allowed, the rest not
  assert.equal(back.config.authority.selectLockedCells, 1);
  assert.equal(back.config.authority.formatCells, 0);
  assert.equal(back.config.authority.editObjects, 0);
  assert.equal(back.workbookProtection.hashValue, hash.hashValue);
  assert.equal(back.workbookProtection.spinCount, 1000);
});

test("files protected by Excel (ExcelJS) import with their hash", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("X");
  ws.getCell("A1").value = 1;
  await ws.protect("pw", { formatCells: true, spinCount: 500 });
  const result = await importXlsx(await excelJsBytes(wb));
  const a = sheetByName(result, "X").config.authority;
  assert.equal(a.sheet, 1);
  assert.equal(a.formatCells, 1);
  assert.equal(a.insertRows, 0);
  assert.equal(a.algorithmName, "SHA-512");
  assert.equal(a.spinCount, 500);
  assert.equal(
    a.hashValue,
    excelHash("pw", Buffer.from(a.saltValue, "base64"), 500)
  );
});

test("sheet view options round-trip", async () => {
  const { bytes, result } = await roundTrip([
    sheet("V", {
      showGridLines: 0,
      showRowColHeaders: false,
      rightToLeft: true,
      zoomRatio: 1.5,
    }),
    sheet("W", {}, 1),
  ]);
  const xml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  const view = /<sheetView\b[^>]*>/.exec(xml)[0];
  assert.match(view, /showGridLines="0"/);
  assert.match(view, /showRowColHeaders="0"/);
  assert.match(view, /rightToLeft="1"/);
  assert.match(view, /zoomScale="150"/);
  const v = sheetByName(result, "V");
  assert.equal(v.showGridLines, 0);
  assert.equal(v.showRowColHeaders, false);
  assert.equal(v.rightToLeft, true);
  assert.equal(v.zoomRatio, 1.5);
  const w = sheetByName(result, "W");
  assert.equal(w.showGridLines, 1);
  assert.equal(w.showRowColHeaders, undefined);
  assert.equal(w.rightToLeft, undefined);
});

test("protected ranges written by Excel with SHA-512 hashes import", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("R").getCell("A1").value = 1;
  const bytes = await patchZip(await excelJsBytes(wb), {
    "xl/worksheets/sheet1.xml": (xml) =>
      xml.replace(
        "</sheetData>",
        '</sheetData><sheetProtection algorithmName="SHA-512" hashValue="aA==" saltValue="bA==" spinCount="100000" sheet="1" objects="1" scenarios="1" selectLockedCells="1"/>' +
          '<protectedRanges><protectedRange algorithmName="SHA-512" hashValue="cA==" saltValue="dA==" spinCount="100000" sqref="A1:B2" name="Range1"/></protectedRanges>'
      ),
  });
  const a = sheetByName(await importXlsx(bytes), "R").config.authority;
  assert.equal(a.selectLockedCells, 0);
  assert.equal(a.selectunLockedCells, 1);
  assert.deepEqual(a.allowRangeList, [
    {
      name: "Range1",
      sqref: "$A$1:$B$2",
      algorithmName: "SHA-512",
      hashValue: "cA==",
      saltValue: "dA==",
      spinCount: 100000,
    },
  ]);
});
