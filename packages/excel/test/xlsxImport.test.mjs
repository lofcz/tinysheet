// T56: xlsx import fidelity. Workbooks are generated with ts-xlsx (and
// patched at the XML level where ts-xlsx can't express a feature).
import test from "node:test";
import assert from "node:assert/strict";
import { Workbook } from "@lofcz/ts-xlsx";
import { fromExcelFormula, shiftFormula } from "../dist/index.js";
import {
  cellMap,
  xlsxBytes,
  importXlsx,
  patchZip,
  sheetByName,
} from "./helpers.mjs";

async function importWorkbook(build, patches) {
  const wb = new Workbook();
  await build(wb);
  let bytes = await xlsxBytes(wb);
  if (patches) bytes = await patchZip(bytes, patches);
  return importXlsx(bytes);
}

test("shared formulas are registered once with and without a calculation chain", async () => {
  for (const chain of [
    null,
    '<c r="B1" i="1"/><c r="B2"/><c r="B2"/><c r="B3"/>',
  ]) {
    const result = await importWorkbook(
      (wb) => {
        const ws = wb.addWorksheet("Data");
        ws.getCell("B1").value = { formula: "A1*2", result: 2 };
        ws.getCell("B2").value = { sharedFormula: "B1", result: 4 };
        ws.getCell("B3").value = { sharedFormula: "B1", result: 6 };
      },
      chain
        ? {
            "xl/calcChain.xml": () =>
              `<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${chain}</calcChain>`,
            "xl/_rels/workbook.xml.rels": (xml) =>
              xml.replace(
                "</Relationships>",
                '<Relationship Id="rIdChain" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>'
              ),
          }
        : {}
    );
    const sheet = result.sheets[0];
    assert.deepEqual(sheet.calcChain.map((c) => `${c.r}_${c.c}`).sort(), [
      "0_1",
      "1_1",
      "2_1",
    ]);
    assert.equal(cellMap(sheet).get("2_1").f, "=A3*2");
  }
});

test("shared formulas are expanded with relative references shifted", async () => {
  const result = await importWorkbook((wb) => {
    const ws = wb.addWorksheet("S");
    for (let r = 1; r <= 3; r += 1) ws.getCell(`A${r}`).value = r;
    ws.getCell("B1").value = {
      formula: "A1*$A$1+SUM(A$1:A1)",
      result: 2,
    };
    ws.getCell("B2").value = { sharedFormula: "B1", result: 5 };
    ws.getCell("B3").value = { sharedFormula: "B1", result: 9 };
    ws.getCell("C1").value = { sharedFormula: "B1", result: 0 };
  });
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("0_1").f, "=A1*$A$1+SUM(A$1:A1)");
  assert.equal(cells.get("1_1").f, "=A2*$A$1+SUM(A$1:A2)");
  assert.equal(cells.get("2_1").f, "=A3*$A$1+SUM(A$1:A3)");
  assert.equal(cells.get("0_2").f, "=B1*$A$1+SUM(B$1:B1)");
  assert.equal(cells.get("2_1").v, 9);
});

test("shiftFormula handles whole rows/columns, sheets, strings and #REF!", () => {
  assert.equal(shiftFormula("=SUM(A:A)+B$2", 1, 1), "=SUM(B:B)+C$2");
  assert.equal(shiftFormula("=SUM(1:1)", 2, 0), "=SUM(3:3)");
  assert.equal(
    shiftFormula("='My Sheet'!A1&\"A1\"", 1, 0),
    "='My Sheet'!A2&\"A1\""
  );
  assert.equal(shiftFormula("=LOG10(A1)", 1, 0), "=LOG10(A2)");
  assert.equal(shiftFormula("=A1", -1, 0), "=#REF!");
  assert.equal(shiftFormula("=Table1[Col]+A1", 1, 0), "=Table1[Col]+A2");
});

test("future-function prefixes are stripped", () => {
  assert.equal(
    fromExcelFormula("_xlfn.XLOOKUP(1,A:A,B:B)"),
    "=XLOOKUP(1,A:A,B:B)"
  );
  assert.equal(
    fromExcelFormula("_xlfn._xlws.FILTER(A1:A9,A1:A9>0)"),
    "=FILTER(A1:A9,A1:A9>0)"
  );
  assert.equal(
    fromExcelFormula("_xlfn.LET(_xlpm.x,1,_xlpm.x+1)"),
    "=LET(x,1,x+1)"
  );
  assert.equal(fromExcelFormula("SUM(_xlfn.ANCHORARRAY(B2))"), "=SUM(B2#)");
  assert.equal(fromExcelFormula("_xlfn.SINGLE(A1:A3)"), "=@A1:A3");
  assert.equal(fromExcelFormula("_xlfn.SINGLE(A1:A3+1)"), "=@(A1:A3+1)");
  assert.equal(
    fromExcelFormula('"_xlfn.X"&_xlfn.CONCAT(A1)'),
    '="_xlfn.X"&CONCAT(A1)'
  );
});

test("array and dynamic-array formulas become spill anchors", async () => {
  const result = await importWorkbook(
    (wb) => {
      const ws = wb.addWorksheet("A");
      ws.getCell("A1").value = {
        formula: "_xlfn.SEQUENCE(3,2)",
        result: 1,
        shareType: "array",
        ref: "A1:B3",
      };
      ws.getCell("B1").value = 2;
      ws.getCell("A2").value = 3;
      ws.getCell("B2").value = 4;
      ws.getCell("A3").value = 5;
      ws.getCell("B3").value = 6;
    },
    {
      // Excel marks dynamic arrays with cm="1".
      "xl/worksheets/sheet1.xml": (xml) =>
        xml.replace('<c r="A1"', '<c r="A1" cm="1"'),
    }
  );
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("0_0").f, "=SEQUENCE(3,2)");
  assert.deepEqual(cells.get("0_0").spill, { rs: 3, cs: 2 });
  assert.equal(cells.get("0_0").v, 1);
  assert.deepEqual(cells.get("2_1").spillFrom, { dr: 2, dc: 1 });
  assert.equal(cells.get("2_1").v, 6);
  assert.equal(cells.get("2_1").f, undefined);
});

test("theme colours with tint and indexed colours", async () => {
  const result = await importWorkbook((wb) => {
    const ws = wb.addWorksheet("C");
    ws.getCell("A1").value = "theme";
    ws.getCell("A1").font = { color: { theme: 4, tint: 0.3999755851924192 } };
    ws.getCell("A2").value = "dark";
    ws.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { theme: 1 },
    };
    ws.getCell("A3").value = "indexed";
    ws.getCell("A3").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { indexed: 13 },
    };
    ws.getCell("A4").value = "darker";
    ws.getCell("A4").font = { color: { theme: 5, tint: -0.25 } };
  });
  const cells = cellMap(result.sheets[0]);
  // Office theme: accent1 4472C4, accent2 ED7D31, text1 = black.
  assert.equal(cells.get("0_0").fc.toUpperCase(), "#8FAADC");
  assert.equal(cells.get("1_0").bg.toUpperCase(), "#000000");
  assert.equal(cells.get("2_0").bg.toUpperCase(), "#FFFF00");
  assert.equal(cells.get("3_0").fc.toUpperCase(), "#C55A11");
});

test("rich text runs, inline strings and line breaks", async () => {
  const result = await importWorkbook(
    (wb) => {
      const ws = wb.addWorksheet("R");
      ws.getCell("A1").value = {
        richText: [
          { text: "Red ", font: { color: { argb: "FFFF0000" }, bold: true } },
          { text: "big", font: { size: 18, italic: true, underline: true } },
        ],
      };
      ws.getCell("A2").value = "line1\nline2";
      ws.getCell("A3").value = "inline";
    },
    {
      // An inline rich string (t="inlineStr") as some generators write them.
      "xl/worksheets/sheet1.xml": (xml) =>
        xml.replace(
          /<c\b[^>]*\br="A3"[^>]*>[\s\S]*?<\/c>/,
          '<c r="A3" t="inlineStr"><is><r><rPr><b/></rPr><t>in</t></r><r><t>line</t></r></is></c>'
        ),
    }
  );
  const cells = cellMap(result.sheets[0]);
  const a1 = cells.get("0_0").ct;
  assert.equal(a1.t, "inlineStr");
  assert.equal(a1.s[0].v, "Red ");
  assert.equal(a1.s[0].bl, 1);
  assert.equal(a1.s[0].fc.toUpperCase(), "#FF0000");
  assert.equal(a1.s[1].v, "big");
  assert.equal(a1.s[1].fs, 18);
  assert.equal(a1.s[1].it, 1);
  assert.equal(a1.s[1].un, 1);
  const a2 = cells.get("1_0").ct;
  assert.equal(a2.t, "inlineStr");
  assert.equal(a2.s[0].v, "line1\r\nline2");
  const a3 = cells.get("2_0").ct;
  assert.equal(a3.t, "inlineStr");
  assert.deepEqual(
    a3.s.map((run) => [run.v, run.bl ?? 0]),
    [
      ["in", 1],
      ["line", 0],
    ]
  );
});

test("number formats: built-in ids and custom codes", async () => {
  const result = await importWorkbook(
    (wb) => {
      const ws = wb.addWorksheet("N");
      ws.getCell("A1").value = 1234.5;
      ws.getCell("A1").numFmt = "#,##0.00"; // built-in 4
      ws.getCell("A2").value = 0.125;
      ws.getCell("A2").numFmt = "0.00%"; // built-in 10
      ws.getCell("A3").value = 45000;
      ws.getCell("A3").numFmt = "[$-409]d mmmm yyyy;@"; // custom
      ws.getCell("A4").value = -5;
      ws.getCell("A4").numFmt = "0.00;[Red]-0.00";
      ws.getCell("A5").value = 1234.5;
      ws.getCell("A5").numFmt = "0.00"; // patched to built-in id 7 below
    },
    {
      "xl/styles.xml": (xml) => {
        // Point the "0.00" (id 2) cell style at built-in currency id 7 and
        // add a date style with built-in id 14.
        const id =
          /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="0.00"/.exec(
            xml
          )?.[1] ?? "2";
        return xml.replace(
          new RegExp(`(<xf\\b[^>]*numFmtId=")${id}("[^>]*>)`, "g"),
          "$17$2"
        );
      },
    }
  );
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("0_0").ct.fa, "#,##0.00");
  assert.equal(cells.get("0_0").m, "1,234.50");
  assert.equal(cells.get("1_0").ct.fa, "0.00%");
  assert.equal(cells.get("1_0").m, "12.50%");
  assert.equal(cells.get("2_0").ct.fa, "[$-409]d mmmm yyyy;@");
  assert.equal(cells.get("2_0").ct.t, "d");
  assert.equal(cells.get("2_0").m, "15 March 2023");
  assert.equal(cells.get("3_0").m, "-5.00");
  assert.equal(cells.get("4_0").ct.fa, '"$"#,##0.00_);\\("$"#,##0.00\\)');
  assert.equal(cells.get("4_0").m, "$1,234.50 ");
});

test("booleans, errors and string formula results", async () => {
  const result = await importWorkbook((wb) => {
    const ws = wb.addWorksheet("V");
    ws.getCell("A1").value = true;
    ws.getCell("A2").value = { formula: "1/0", result: { error: "#DIV/0!" } };
    ws.getCell("A3").value = { formula: '"a"&"b"', result: "ab" };
  });
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("0_0").v, true);
  assert.equal(cells.get("0_0").ct.t, "b");
  assert.equal(cells.get("1_0").v, "#DIV/0!");
  assert.equal(cells.get("1_0").ct.t, "e");
  assert.equal(cells.get("2_0").v, "ab");
  assert.equal(cells.get("2_0").f, '="a"&"b"');
});

test("date1904 workbooks are shifted to the 1900 date system", async () => {
  const result = await importWorkbook((wb) => {
    wb.dateEpoch = true ? 1904 : 1900;
    const ws = wb.addWorksheet("D");
    ws.getCell("A1").value = 0;
    ws.getCell("A1").numFmt = "yyyy-mm-dd";
    ws.getCell("A2").value = 7;
  });
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("0_0").v, 1462);
  assert.equal(cells.get("0_0").m, "1904-01-01");
  // Plain numbers are not dates and are not shifted.
  assert.equal(cells.get("1_0").v, 7);
});

test("column widths from default and custom widths, row heights", async () => {
  const result = await importWorkbook((wb) => {
    const ws = wb.addWorksheet("W");
    ws.properties.defaultColWidth = 20;
    ws.getColumn(2).width = 5;
    ws.getRow(2).height = 30;
    ws.getCell("C3").value = "x";
    const plain = wb.addWorksheet("Plain");
    plain.getCell("A1").value = 1;
  });
  const sheet = sheetByName(result, "W");
  assert.equal(sheet.config.columnlen[1], 38); // (5 - 0.83) * 8 + 5
  assert.equal(sheet.config.columnlen[0], 158); // sheet default 20 chars
  assert.equal(sheet.config.columnlen[2], 158);
  assert.equal(sheet.config.rowlen[1], 40);
  // No explicit default: Excel's standard width is left to TinySheet.
  assert.equal(sheetByName(result, "Plain").config.columnlen, undefined);
});

test("hidden and very hidden sheets, tab colours", async () => {
  const result = await importWorkbook((wb) => {
    wb.addWorksheet("Visible").tabColor = { argb: "FF00B050" };
    const hidden = wb.addWorksheet("Hidden");
    hidden.state = "hidden";
    const very = wb.addWorksheet("Very");
    very.state = "veryHidden";
    wb.addWorksheet("Themed").tabColor = { theme: 5 };
  });
  assert.equal(sheetByName(result, "Visible").color.toUpperCase(), "#00B050");
  assert.equal(sheetByName(result, "Visible").hide, 0);
  assert.equal(sheetByName(result, "Hidden").hide, 1);
  assert.equal(sheetByName(result, "Very").hide, 1);
  assert.equal(sheetByName(result, "Themed").color.toUpperCase(), "#ED7D31");
});

test("hyperlinks: external and internal", async () => {
  const result = await importWorkbook(
    (wb) => {
      const ws = wb.addWorksheet("L");
      ws.getCell("A1").value = "web";
      ws.addHyperlink({ ref: "A1", target: "https://example.com/?a=1&b=2" });
      ws.getCell("A2").value = "inside";
      ws.addHyperlink({ ref: "A2", target: "https://placeholder" });
      wb.addWorksheet("Other Sheet");
    },
    {
      "xl/worksheets/sheet1.xml": (xml) =>
        xml.replace(
          /<hyperlink ref="A2" r:id="[^"]*"\/>/,
          '<hyperlink ref="A2" location="\'Other Sheet\'!B2" display="inside"/>'
        ),
    }
  );
  const sheet = sheetByName(result, "L");
  assert.deepEqual(sheet.hyperlink["0_0"].linkType, "webpage");
  assert.equal(
    sheet.hyperlink["0_0"].linkAddress,
    "https://example.com/?a=1&b=2"
  );
  assert.equal(sheet.hyperlink["1_0"].linkType, "cellrange");
  assert.equal(sheet.hyperlink["1_0"].linkAddress, "'Other Sheet'!B2");
  const cells = cellMap(sheet);
  assert.deepEqual(cells.get("0_0").hl, { r: 0, c: 0, id: sheet.id });
});

test("notes and threaded comments", async () => {
  const result = await importWorkbook(
    (wb) => {
      const ws = wb.addWorksheet("N");
      ws.getCell("A1").value = "x";
      ws.getCell("A1").note = "plain note";
      ws.getCell("B2").note = "Author:\nsecond line";
    },
    {
      "xl/threadedComments/threadedComment1.xml": () =>
        '<?xml version="1.0" encoding="UTF-8"?><ThreadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments">' +
        '<threadedComment ref="B2" id="{1}" personId="{p}"><text>Thread start</text></threadedComment>' +
        '<threadedComment ref="B2" id="{2}" parentId="{1}" personId="{p}"><text>A reply &amp; more</text></threadedComment>' +
        "</ThreadedComments>",
      "xl/worksheets/_rels/sheet1.xml.rels": (xml) =>
        xml.replace(
          "</Relationships>",
          '<Relationship Id="rIdT1" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment1.xml"/></Relationships>'
        ),
    }
  );
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("0_0").ps.value, "plain note");
  assert.equal(cells.get("0_0").v, "x");
  // the thread's legacy note is not a note: the thread is read instead
  assert.equal(cells.get("1_1")?.ps, undefined);
  const [thread] = result.sheets[0].threadedComments;
  assert.equal(thread.r, 1);
  assert.equal(thread.c, 1);
  assert.equal(thread.text, "Thread start");
  assert.deepEqual(
    thread.replies.map((p) => p.text),
    ["A reply & more"]
  );
});

test("imported spills and shared formulas recalculate without #SPILL!", async () => {
  const core = await import("@lofcz/tinysheet-core");
  const { applyExcelImportHydration } = await import("../dist/index.js");
  const result = await importWorkbook(
    (wb) => {
      const ws = wb.addWorksheet("H");
      ws.getCell("A1").value = 10;
      ws.getCell("A2").value = 20;
      ws.getCell("A3").value = 30;
      // Stale cached values: hydration must recompute them.
      ws.getCell("B1").value = {
        formula: "_xlfn._xlws.SORT(A1:A3,1,-1)",
        result: 0,
        shareType: "array",
        ref: "B1:B3",
      };
      ws.getCell("B2").value = 0;
      ws.getCell("B3").value = 0;
      ws.getCell("C1").value = {
        formula: "A1*2",
        result: 0,
      };
      ws.getCell("C2").value = { sharedFormula: "C1", result: 0 };
      ws.getCell("C3").value = { sharedFormula: "C1", result: 0 };
    },
    {
      "xl/worksheets/sheet1.xml": (xml) =>
        xml.replace('<c r="B1"', '<c r="B1" cm="1"'),
    }
  );
  const [sheet] = result.sheets;
  const ctx = {
    currentSheetId: sheet.id,
    calculateSheetId: sheet.id,
    luckysheetfile: [{ ...sheet, data: null }],
    config: sheet.config || {},
    defaultrowNum: 20,
    defaultcolumnNum: 10,
    formulaCache: new core.FormulaCache(),
    groupValuesRefreshData: [],
  };
  ctx.luckysheetfile[0].data = core.api.celldataToData(sheet.celldata, 20, 10);
  applyExcelImportHydration(ctx, result);
  const data = ctx.luckysheetfile[0].data;
  // The imported spill range belongs to the anchor, so it is not blocked.
  // (Spilled cell writes are queued for the Workbook's setContext.)
  assert.equal(data[0][1].v, 30);
  assert.equal(data[0][1].f, "=SORT(A1:A3,1,-1)");
  assert.deepEqual(
    [0, 1, 2].map((r) => data[r][2].v),
    [20, 40, 60]
  );
});

test("freeze panes and data validation", async () => {
  const result = await importWorkbook((wb) => {
    const ws = wb.addWorksheet("F");
    Object.assign(ws.view, { state: "frozen", xSplit: 2, ySplit: 3 });
    ws.addDataValidation("A1", {
      type: "list",
      formulae: ['"x,y,z"'],
      showErrorMessage: true,
      showInputMessage: true,
      prompt: "choose",
    });
    ws.addDataValidation("B1", {
      type: "decimal",
      operator: "greaterThan",
      formulae: [2.5],
    });
    ws.addDataValidation("C1", {
      type: "date",
      operator: "lessThan",
      formulae: [45322],
    });
    ws.addDataValidation("D1", { type: "list", formulae: ["$H$1:$H$3"] });
    ws.addDataValidation("E1", {
      type: "custom",
      formulae: ["LEN(E1)>2"],
    });
    const only = wb.addWorksheet("Rows");
    Object.assign(only.view, { state: "frozen", ySplit: 1 });
  });
  const sheet = sheetByName(result, "F");
  assert.deepEqual(sheet.frozen, {
    type: "rangeBoth",
    range: { row_focus: 2, column_focus: 1 },
  });
  assert.deepEqual(sheetByName(result, "Rows").frozen, {
    type: "rangeRow",
    range: { row_focus: 0, column_focus: 0 },
  });
  const dv = sheet.dataVerification;
  assert.equal(dv["0_0"].type, "dropdown");
  assert.equal(dv["0_0"].value1, "x,y,z");
  assert.equal(dv["0_0"].prohibitInput, true);
  assert.equal(dv["0_0"].hintShow, true);
  assert.equal(dv["0_0"].hintValue, "choose");
  assert.equal(dv["0_1"].type, "number");
  assert.equal(dv["0_1"].type2, "moreThanThe");
  assert.equal(dv["0_1"].value1, "2.5");
  assert.equal(dv["0_2"].type, "date");
  assert.equal(dv["0_2"].type2, "earlierThan");
  assert.equal(dv["0_2"].value1, "2024-01-31");
  assert.equal(dv["0_3"].value1, "$H$1:$H$3");
  assert.equal(dv["0_4"].type, "custom");
  assert.equal(dv["0_4"].value1, "LEN(E1)>2");
});

test("date validation bounds are independent of timezone and daylight saving", async () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Europe/Prague", "America/New_York"]) {
      process.env.TZ = timezone;
      for (const date1904 of [false, true]) {
        const result = await importWorkbook(
          (wb) => {
            wb.dateEpoch = date1904 ? 1904 : 1900;
            const ws = wb.addWorksheet("Dates");
            for (const [cell, month] of [
              ["A1", 0],
              ["B1", 6],
            ]) {
              ws.addDataValidation(cell, {
                type: "date",
                operator: "between",
                formulae: [
                  (Date.UTC(2024, month, 1) - Date.UTC(1899, 11, 30)) /
                    86400000,
                  (Date.UTC(2024, month, 31) - Date.UTC(1899, 11, 30)) /
                    86400000,
                ],
              });
            }
          },
          date1904
            ? {
                // Validation operands are raw serials: encode the workbook's epoch.
                "xl/worksheets/sheet1.xml": (xml) =>
                  xml.replace(
                    /(<formula[12]>)(\d+)(<\/formula[12]>)/g,
                    (_, open, value, close) =>
                      `${open}${Number(value) - 1462}${close}`
                  ),
              }
            : undefined
        );
        const rules = sheetByName(result, "Dates").dataVerification;
        assert.equal(
          rules["0_0"].value1,
          "2024-01-01",
          `${timezone}, 1904=${date1904}`
        );
        assert.equal(rules["0_0"].value2, "2024-01-31");
        assert.equal(rules["0_1"].value1, "2024-07-01");
        assert.equal(rules["0_1"].value2, "2024-07-31");
      }
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
