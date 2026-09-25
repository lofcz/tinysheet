// bun's isolated node_modules: resolve the excel package's dependencies
// eslint-disable-next-line import/no-relative-packages
import ExcelJS from "../../../excel/node_modules/@protobi/exceljs";
// eslint-disable-next-line import/no-relative-packages
import JSZip from "../../../excel/node_modules/jszip";
// eslint-disable-next-line import/no-relative-packages
import { FortuneFile } from "../../../excel/src/ToFortuneSheet/FortuneFile";
// eslint-disable-next-line import/no-relative-packages
import {
  addFutureFunctionPrefixes,
  exportDefinedNames,
  importDefinedNames,
  readDefinedNamesXml,
  setDefinedNames,
  stripFutureFunctionPrefixes,
} from "../../../excel/src/common/definedNames";

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Calc" sheetId="2" r:id="rId2"/></sheets>
<definedNames>
<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Data!$A$1:$B$9</definedName>
<definedName name="Rate">0.2</definedName>
<definedName name="Local" localSheetId="1">Calc!$A$1:$A$3</definedName>
<definedName name="Label" comment="a &amp; b">&quot;x &amp; y&quot;</definedName>
<definedName name="Double">_xlfn.LAMBDA(_xlpm.x,_xlpm.x*2)</definedName>
<definedName name="Secret" hidden="1">Data!$C$1</definedName>
</definedNames></workbook>`;

describe("defined names in xlsx", () => {
  test("reading workbook.xml", () => {
    const names = readDefinedNamesXml(WORKBOOK_XML);
    expect(names.map((n) => n.name)).toEqual([
      "_xlnm._FilterDatabase",
      "Rate",
      "Local",
      "Label",
      "Double",
      "Secret",
    ]);
    expect(names[2].localSheetId).toBe(1);
    const bySheet = importDefinedNames(names, ["Data", "Calc"]);
    expect(bySheet.get("Data")).toEqual([
      { name: "Rate", refersTo: "=0.2" },
      { name: "Label", refersTo: '="x & y"', comment: "a & b" },
      { name: "Double", refersTo: "=LAMBDA(x,x*2)" },
      { name: "Secret", refersTo: "=Data!$C$1", hidden: true },
    ]);
    expect(bySheet.get("Calc")).toEqual([
      { name: "Local", refersTo: "=Calc!$A$1:$A$3", local: true },
    ]);
  });

  test("future function prefixes", () => {
    expect(stripFutureFunctionPrefixes('_xlfn.LET(_xlpm.a,1,"_xlpm.a")')).toBe(
      'LET(a,1,"_xlpm.a")'
    );
    expect(addFutureFunctionPrefixes("LAMBDA(x, y, x*y+Sheet1!$A$1)")).toBe(
      "_xlfn.LAMBDA(_xlpm.x, _xlpm.y, _xlpm.x*_xlpm.y+Sheet1!$A$1)"
    );
    expect(addFutureFunctionPrefixes("LET(n, 2, n*SUM(A1:A2))")).toBe(
      "_xlfn.LET(_xlpm.n, 2, _xlpm.n*SUM(A1:A2))"
    );
    expect(addFutureFunctionPrefixes("Sheet1!$A$1:$B$2")).toBe(
      "Sheet1!$A$1:$B$2"
    );
  });

  test("export models", () => {
    const sheets = [
      {
        name: "Data",
        definedNames: [
          { name: "Rate", refersTo: "=0.2" },
          { name: "Fn", refersTo: "=LAMBDA(x,x+1)" },
        ],
      },
      {
        name: "Calc",
        definedNames: [{ name: "Local", refersTo: "=Calc!$A$1", local: true }],
      },
    ];
    expect(exportDefinedNames(sheets, ["Data", "Calc"])).toEqual([
      { name: "Rate", ranges: ["0.2"] },
      { name: "Fn", ranges: ["_xlfn.LAMBDA(_xlpm.x,_xlpm.x+1)"] },
      { name: "Local", localSheetId: 1, ranges: ["Calc!$A$1"] },
    ]);
  });

  test("round trip through an ExcelJS workbook", async () => {
    const sheets = [
      {
        name: "Data",
        definedNames: [
          { name: "Prices", refersTo: "=Data!$B$2:$B$9" },
          { name: "Label", refersTo: '="a<b & c"' },
        ],
      },
      {
        name: "Calc",
        definedNames: [{ name: "Local", refersTo: "=Calc!$A$1", local: true }],
      },
    ];
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Data").getCell("A1").value = 1;
    workbook.addWorksheet("Calc").getCell("A1").value = 2;
    setDefinedNames(workbook, sheets);
    const buffer = await workbook.xlsx.writeBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("xl/workbook.xml").async("string");
    const back = importDefinedNames(readDefinedNamesXml(xml), ["Data", "Calc"]);
    expect(back.get("Data")).toEqual(sheets[0].definedNames);
    expect(back.get("Calc")).toEqual(sheets[1].definedNames);

    // and through the xlsx importer
    const files = {};
    await Promise.all(
      Object.values(zip.files).map(async (entry) => {
        files[entry.name] = await entry.async("string");
      })
    );
    const file = new FortuneFile(files, "names.xlsx");
    file.Parse();
    const out = file.serialize();
    expect(out.sheets.map((s) => s.definedNames)).toEqual([
      sheets[0].definedNames,
      sheets[1].definedNames,
    ]);
  });
});
