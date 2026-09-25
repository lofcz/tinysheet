// Bun installs packages per workspace: the excel package's own copies.
// eslint-disable-next-line import/no-relative-packages
import ExcelJS from "../../../excel/node_modules/@protobi/exceljs";
// eslint-disable-next-line import/no-relative-packages
import JSZip from "../../../excel/node_modules/jszip";
import {
  setConditionalFormatting,
  finalizeConditionalFormatting,
  cfRuleToExcel,
} from "../../../excel/src/ToExcel/ExcelConditionFormat";
import {
  readConditionalFormats,
  readDxfStyles,
  parseXmlTree,
} from "../../../excel/src/ToFortuneSheet/FortuneConditionFormat";
import { parseExcel } from "../../../excel/src/parse/parseExcel";
import { makeContext, column, rules, range } from "./helpers";
import {
  computeCFRules,
  makeDataBar,
  makeIconSet,
  colorScaleFromPreset,
  CF_COLOR_SCALE_PRESETS,
} from "../../src/modules/ConditionFormat";

const style = { cellColor: "#FFC7CE", textColor: "#9C0006" };

function hl(name, sqref, conditionValue = [], extra = {}) {
  return {
    type: "default",
    cellrange: range(sqref),
    conditionName: name,
    conditionValue,
    format: style,
    ...extra,
  };
}

const ALL_RULES = [
  hl("greaterThan", "A1:A12", [5]),
  hl("between", "A1:A12", [2, 4], {
    format: { bold: true, italic: true, borderColor: "#0000FF" },
  }),
  hl("equal", "B1:B12", ["apple"]),
  hl("notEqual", "A1:A12", ["=$C$1"]),
  hl("textContains", "B1:B12", ["an"]),
  hl("textNotContains", "B1:B12", ["x"]),
  hl("textBeginsWith", "B1:B12", ["ba"]),
  hl("textEndsWith", "B1:B12", ["na"], { format: { strikethrough: true } }),
  hl("occurrenceDate", "C1:C12", ["last7Days"]),
  hl("blanks", "B1:B12"),
  hl("noBlanks", "B1:B12"),
  hl("errors", "A1:A12"),
  hl("noErrors", "A1:A12"),
  hl("duplicateValue", "B1:B12", ["0"]),
  hl("duplicateValue", "B1:B12", ["1"], { format: { underline: true } }),
  hl("top10", "A1:A12", [3]),
  hl("last10_percent", "A1:A12", [20]),
  hl("aboveAverage", "A1:A12"),
  hl("belowAverage", "A1:A12", [], { equalAverage: true }),
  hl("aboveAverage", "A1:A12", [], { stdDev: 1 }),
  hl("formula", "A1:B12", ["=MOD(ROW(),2)=0"], {
    stopIfTrue: true,
    format: { numberFormat: "0.0%" },
  }),
  {
    type: "dataBar",
    cellrange: range("A1:A12"),
    dataBar: makeDataBar("#638EC6", true, {
      axisPosition: "midpoint",
      negativeColor: "#00FF00",
      direction: "rightToLeft",
    }),
  },
  {
    type: "dataBar",
    cellrange: range("D1:D12"),
    dataBar: makeDataBar("#63C384", false, {
      min: { type: "num", value: 2 },
      max: { type: "percentile", value: 90 },
      showValue: false,
    }),
  },
  {
    type: "colorGradation",
    cellrange: range("A1:A12"),
    colorScale: { stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]) },
  },
  {
    type: "icons",
    cellrange: range("A1:A12"),
    iconSet: makeIconSet("4Arrows", {
      reverse: true,
      showValue: false,
      thresholds: [
        { type: "percent", value: 25, gte: false },
        { type: "num", value: 6, gte: false },
        { type: "percent", value: 75, gte: true },
      ],
    }),
  },
  {
    type: "icons",
    cellrange: range("D1:D12"),
    iconSet: makeIconSet("3Stars", {
      thresholds: [
        { type: "num", value: 3, gte: false },
        { type: "percentile", value: 80, gte: true },
      ],
    }),
  },
];

function workbookWithData() {
  const ctx = makeContext({ rows: 14, cols: 6 });
  column(ctx, "A1", [1, 2, 3, 4, 5, 6, 7, 8, 9, -3, 11, 12]);
  column(ctx, "B1", [
    "apple",
    "banana",
    "Apple",
    null,
    "  ",
    "cherry",
    "x",
    "banana",
    "kiwi",
    "na",
    "an",
    1,
  ]);
  column(ctx, "C1", [5, 45000, 46000, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  column(ctx, "D1", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  return ctx;
}

async function roundTrip(list) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.getCell("A1").value = 1;
  setConditionalFormatting({ luckysheet_conditionformat_save: list }, ws);
  const buffer = await finalizeConditionalFormatting(
    wb,
    await wb.xlsx.writeBuffer()
  );
  const zip = await JSZip.loadAsync(buffer);
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  const stylesXml = await zip.file("xl/styles.xml").async("string");
  return {
    sheetXml,
    stylesXml,
    rules: readConditionalFormats(sheetXml, readDxfStyles(stylesXml)),
  };
}

describe("xlsx export and import (T24)", () => {
  test("every rule type survives an export/import round trip", async () => {
    const { rules: back, sheetXml } = await roundTrip(ALL_RULES);
    expect(sheetXml).toContain("<conditionalFormatting");
    expect(sheetXml).toContain("x14:dataBar");
    // the gradient bar keeps its extension; "bar only" and ">" survive
    expect(sheetXml).not.toMatch(
      /x14:dataBar[^>]*gradient="0"[^>]*axisPosition="middle"/
    );
    expect(sheetXml).toContain('<dataBar showValue="0">');
    expect(sheetXml).toMatch(/<cfvo gte="0" type="num" val="6"\/>/);
    expect(back).toHaveLength(ALL_RULES.length);
    // same order (priority) and types
    expect(back.map((r) => r.type)).toEqual(ALL_RULES.map((r) => r.type));
    // same result on real data, cell by cell
    const ctx = workbookWithData();
    const expected = computeCFRules(ctx, ALL_RULES, ctx.luckysheetfile[0].data);
    const actual = computeCFRules(ctx, back, ctx.luckysheetfile[0].data);
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    Object.keys(expected).forEach((k) => {
      expect([k, actual[k]]).toEqual([k, expected[k]]);
    });
  });

  test("one rule at a time: formats and settings are kept", async () => {
    const ctx = workbookWithData();
    for (let i = 0; i < ALL_RULES.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { rules: back } = await roundTrip([ALL_RULES[i]]);
      expect(back).toHaveLength(1);
      const expected = computeCFRules(
        ctx,
        [ALL_RULES[i]],
        ctx.luckysheetfile[0].data
      );
      const actual = computeCFRules(ctx, back, ctx.luckysheetfile[0].data);
      expect([i, actual]).toEqual([i, expected]);
    }
  });

  test("native rule types are written as such", () => {
    expect(cfRuleToExcel(hl("greaterThan", "A1:A3", [5]))).toMatchObject({
      type: "cellIs",
      operator: "greaterThan",
      formulae: ["5"],
    });
    expect(cfRuleToExcel(hl("equal", "A1:A3", ['say "hi"'])).formulae).toEqual([
      '"say ""hi"""',
    ]);
    expect(cfRuleToExcel(hl("top10_percent", "A1:A3", [15]))).toMatchObject({
      type: "top10",
      rank: 15,
      percent: true,
      bottom: false,
    });
    expect(
      cfRuleToExcel(hl("occurrenceDate", "A1:A3", ["thisMonth"]))
    ).toMatchObject({
      type: "timePeriod",
      timePeriod: "thisMonth",
    });
    expect(cfRuleToExcel(hl("blanks", "B2:B5"))).toMatchObject({
      type: "expression",
      formulae: ["LEN(TRIM(B2))=0"],
    });
  });

  test("Excel files: dxf styles, theme colours, extension data bars and icon sets", () => {
    const stylesXml = `<styleSheet><dxfs count="2">
      <dxf><font><b/><i val="0"/><color theme="1"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>
      <dxf><font><u/><strike/></font><numFmt numFmtId="164" formatCode="0.00&quot;x&quot;"/><border><left style="thin"><color rgb="FF0000FF"/></left></border></dxf>
    </dxfs></styleSheet>`;
    const dxfs = readDxfStyles(stylesXml, (a) =>
      a.theme === "1" ? "#112233" : undefined
    );
    expect(dxfs).toEqual([
      { bold: true, textColor: "#112233", cellColor: "#FFC7CE" },
      {
        underline: true,
        strikethrough: true,
        numberFormat: '0.00"x"',
        borderColor: "#0000FF",
      },
    ]);
    const sheetXml = `<worksheet><sheetData/>
      <conditionalFormatting sqref="A1:A10 C1:C3">
        <cfRule type="containsText" dxfId="0" priority="3" operator="containsText" text="a&amp;b"><formula>NOT(ISERROR(SEARCH("a&amp;b",A1)))</formula></cfRule>
        <cfRule type="dataBar" priority="2"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF638EC6"/></dataBar>
          <extLst><ext uri="{B025F937-C7B1-47D3-B67F-A62EFF666E3E}"><x14:id>{AAA-1}</x14:id></ext></extLst></cfRule>
        <cfRule type="duplicateValues" dxfId="1" priority="1" stopIfTrue="1"/>
      </conditionalFormatting>
      <extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}"><x14:conditionalFormattings>
        <x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">
          <x14:cfRule type="dataBar" id="{AAA-1}"><x14:dataBar minLength="0" maxLength="100" border="1" negativeBarBorderColorSameAsPositive="0" axisPosition="middle">
            <x14:cfvo type="autoMin"/><x14:cfvo type="autoMax"/><x14:borderColor rgb="FF638EC6"/><x14:negativeFillColor rgb="FFFF0000"/><x14:axisColor rgb="FF000000"/></x14:dataBar></x14:cfRule>
          <xm:sqref>A1:A10</xm:sqref>
        </x14:conditionalFormatting>
        <x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">
          <x14:cfRule type="iconSet" priority="4" id="{BBB-2}"><x14:iconSet iconSet="3Stars" showValue="0"><x14:cfvo type="percent"><xm:f>0</xm:f></x14:cfvo><x14:cfvo type="num" gte="0"><xm:f>5</xm:f></x14:cfvo><x14:cfvo type="percent"><xm:f>67</xm:f></x14:cfvo></x14:iconSet></x14:cfRule>
          <xm:sqref>B1:B10</xm:sqref>
        </x14:conditionalFormatting>
      </x14:conditionalFormattings></ext></extLst></worksheet>`;
    const list = readConditionalFormats(sheetXml, dxfs);
    expect(list.map((r) => r.type)).toEqual([
      "icons",
      "default",
      "dataBar",
      "default",
    ]);
    const [icons, text, bar, dup] = list;
    expect(icons.iconSet).toEqual({
      name: "3Stars",
      thresholds: [
        { type: "num", value: 5, gte: false },
        { type: "percent", value: 67, gte: true },
      ],
      reverse: undefined,
      showValue: false,
    });
    expect(text).toMatchObject({
      conditionName: "textContains",
      conditionValue: ["a&b"],
      cellrange: range("A1:A10,C1:C3"),
      format: dxfs[0],
    });
    expect(bar.dataBar).toMatchObject({
      color: "#638EC6",
      border: true,
      axisPosition: "midpoint",
      min: { type: "autoMin" },
      max: { type: "autoMax" },
      negativeColor: "#FF0000",
    });
    expect(dup).toMatchObject({
      conditionName: "duplicateValue",
      conditionValue: ["0"],
      stopIfTrue: true,
      format: dxfs[1],
    });
  });

  test("the XML reader handles entities, CDATA and self-closing tags", () => {
    const root = parseXmlTree(
      '<?xml version="1.0"?><a x="1 &lt; 2"><b/><c><![CDATA[<raw>]]></c><d>&#65;&#x42;</d></a>'
    );
    const a = root.children[0];
    expect(a.attrs.x).toBe("1 < 2");
    expect(a.children.map((n) => n.name)).toEqual(["b", "c", "d"]);
    expect(a.children[1].text).toBe("<raw>");
    expect(a.children[2].text).toBe("AB");
  });

  test("parseExcel imports the rules of each sheet", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data");
    ws.getCell("A1").value = 1;
    const list = [ALL_RULES[0], ALL_RULES[21], ALL_RULES[24]];
    setConditionalFormatting({ luckysheet_conditionformat_save: list }, ws);
    const buffer = await finalizeConditionalFormatting(
      wb,
      await wb.xlsx.writeBuffer()
    );
    const { sheets } = await parseExcel(buffer, "cf.xlsx");
    const imported = sheets[0].luckysheet_conditionformat_save;
    expect(imported.map((r) => r.type)).toEqual([
      "default",
      "dataBar",
      "icons",
    ]);
    expect(imported[0].format).toEqual(style);
    expect(imported[1].dataBar).toMatchObject({
      gradient: true,
      axisPosition: "midpoint",
      direction: "rightToLeft",
      negativeColor: "#00FF00",
    });
  });

  test("sheets without rules add nothing", () => {
    rules(makeContext(), []);
    expect(readConditionalFormats("<worksheet/>", [])).toEqual([]);
  });
});
