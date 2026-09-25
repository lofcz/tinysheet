// load the package entry first (module cycles resolve like in the app)
import { makeContext } from "../formula/helpers";
import {
  parseTsv,
  toTsv,
  tsvField,
  parseClipboardHtml,
  parseBorder,
  parseMsoNumberFormat,
  cssUnescape,
  normalizeColor,
  parseStyleSheet,
  parseCssDeclarations,
  rangeToClipboard,
} from "../../src/modules/clipboard";
import { pastedHtmlFactory } from "../factories/pasted-html";

const fontjson = { "times new roman": 0, arial: 1, tahoma: 2, verdana: 3 };

describe("TSV", () => {
  test("plain rows and columns, CRLF or LF", () => {
    expect(parseTsv("a\tb\r\nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseTsv("1\t2\n3\t4\n")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  test("quoted fields hold tabs, line breaks and quotes (Excel)", () => {
    expect(parseTsv('"line1\nline2"\t"say ""hi"""\r\nx\t"a\tb"')).toEqual([
      ["line1\nline2", 'say "hi"'],
      ["x", "a\tb"],
    ]);
  });

  test("a quote inside an unquoted field is literal", () => {
    expect(parseTsv('5" screen\tok')).toEqual([['5" screen', "ok"]]);
    expect(parseTsv('"abc"def\t1')).toEqual([['"abc"def', "1"]]);
  });

  test("ragged rows are padded, empty fields kept", () => {
    expect(parseTsv("a\t\tc\nd")).toEqual([
      ["a", "", "c"],
      ["d", "", ""],
    ]);
  });

  test("serialisation quotes only when needed and round-trips", () => {
    expect(tsvField("plain")).toBe("plain");
    expect(tsvField("a\tb")).toBe('"a\tb"');
    expect(tsvField('say "x"')).toBe('"say ""x"""');
    const rows = [
      ["a", "multi\nline", 'q"uote'],
      ["", "1", "tab\there"],
    ];
    expect(parseTsv(toTsv(rows))).toEqual(rows);
    expect(
      toTsv([
        ["1", "2"],
        ["3", "4"],
      ])
    ).toBe("1\t2\r\n3\t4");
  });
});

describe("CSS helpers", () => {
  test("declarations keep quoted values with semicolons", () => {
    expect(
      parseCssDeclarations(
        'color:red; mso-number-format:"0\\;0"; font-weight:700'
      )
    ).toEqual({
      color: "red",
      "mso-number-format": '"0\\;0"',
      "font-weight": "700",
    });
  });

  test("stylesheets map selectors to declarations", () => {
    const rules = parseStyleSheet(
      "<!--td {color:black;}\n.xl65, .xl66\n\t{font-weight:700;}\n-->"
    );
    expect(rules.td).toEqual({ color: "black" });
    expect(rules[".xl65"]).toEqual({ "font-weight": "700" });
    expect(rules[".xl66"]).toEqual({ "font-weight": "700" });
  });

  test("CSS escapes as written by Excel", () => {
    expect(cssUnescape("0\\.00")).toBe("0.00");
    expect(cssUnescape("\\0022$\\0022\\#\\,\\#\\#0\\.00")).toBe('"$"#,##0.00');
    expect(cssUnescape("\\0022kg\\0022")).toBe('"kg"');
  });

  test("colours are normalised to #rrggbb", () => {
    expect(normalizeColor("#ED7D31")).toBe("#ed7d31");
    expect(normalizeColor("rgb(237, 125, 49)")).toBe("#ed7d31");
    expect(normalizeColor("#abc")).toBe("#aabbcc");
    expect(normalizeColor("windowtext")).toBe("#000000");
    expect(normalizeColor("transparent")).toBeNull();
    expect(normalizeColor("rgba(0, 0, 0, 0)")).toBeNull();
  });
});

describe("number formats (mso-number-format)", () => {
  test("named Excel formats", () => {
    expect(parseMsoNumberFormat("General")).toBe("General");
    expect(parseMsoNumberFormat("Percent")).toBe("0.00%");
    expect(parseMsoNumberFormat('"Short Date"')).toBe("m/d/yyyy");
    expect(parseMsoNumberFormat("Standard")).toBe("#,##0.00");
    expect(parseMsoNumberFormat("Fixed")).toBe("0.00");
    expect(parseMsoNumberFormat("Scientific")).toBe("0.00E+00");
  });

  test("escaped custom formats", () => {
    expect(parseMsoNumberFormat('"0\\.000"')).toBe("0.000");
    expect(parseMsoNumberFormat('"\\@"')).toBe("@");
    expect(parseMsoNumberFormat('"yyyy\\-mm\\-dd"')).toBe("yyyy-mm-dd");
  });
});

describe("borders", () => {
  test("Excel border shorthands map to our styles", () => {
    expect(parseBorder(".5pt solid windowtext")).toEqual({
      style: 1,
      color: "#000000",
    });
    expect(parseBorder("1.0pt solid #FF0000")).toEqual({
      style: 8,
      color: "#ff0000",
    });
    expect(parseBorder("1.5pt solid black")).toEqual({
      style: 13,
      color: "#000000",
    });
    expect(parseBorder("2.0pt double black").style).toBe(7);
    expect(parseBorder(".5pt dashed black").style).toBe(4);
    expect(parseBorder("1.0pt dashed black").style).toBe(9);
    expect(parseBorder(".5pt dotted black").style).toBe(3);
    expect(parseBorder(".5pt hairline black").style).toBe(2);
    expect(parseBorder("1px solid rgb(0, 0, 255)")).toEqual({
      style: 1,
      color: "#0000ff",
    });
    expect(parseBorder("2px solid #000").style).toBe(8);
    expect(parseBorder("3px solid #000").style).toBe(13);
    expect(parseBorder("none")).toBeNull();
    expect(parseBorder("0px solid black")).toBeNull();
  });
});

const EXCEL_HTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta name=ProgId content=Excel.Sheet><meta name=Generator content="Microsoft Excel 15">
<style>
<!--table {mso-displayed-decimal-separator:"\\.";}
td {padding-top:1px; color:black; font-size:11.0pt; font-weight:400; font-style:normal;
  text-decoration:none; font-family:Calibri, sans-serif; mso-number-format:General;
  text-align:general; vertical-align:bottom; border:none; white-space:nowrap;}
.xl65 {font-weight:700; mso-number-format:"\\#\\,\\#\\#0\\.00";}
.xl66 {color:#FF0000; mso-number-format:Percent; text-align:center;}
.xl67 {mso-number-format:"Short Date"; border-top:.5pt solid windowtext;
  border-right:none; border-bottom:1.5pt solid windowtext; border-left:none;}
.xl68 {mso-number-format:"\\@"; white-space:normal; vertical-align:top;}
.xl69 {background:#FFFF00; mso-pattern:black none; text-decoration:line-through;}
.xl70 {text-align:center; border:.5pt solid windowtext;}
-->
</style></head><body>
<table border=0 cellpadding=0 cellspacing=0 width=261 style='border-collapse:collapse;width:195pt'>
<!--StartFragment-->
 <col width=87 style='width:65pt'>
 <col width=120 style='mso-width-source:userset;width:90pt'>
 <col width=64 style='width:48pt'>
 <tr height=20 style='height:15.0pt'>
  <td height=20 class=xl65 align=right style='height:15.0pt'>1,234.50</td>
  <td class=xl66 align=center>12.50%</td>
  <td class=xl67 align=right>1/15/2024</td>
 </tr>
 <tr height=40 style='height:30.0pt'>
  <td height=40 class=xl68 style='height:30.0pt'>00123<br>
  second line</td>
  <td class=xl69>struck<span style='mso-spacerun:yes'>  </span>text</td>
  <td align=right>42</td>
 </tr>
 <tr height=20 style='height:15.0pt'>
  <td colspan=2 rowspan=2 height=40 class=xl70 style='height:30.0pt'>merged</td>
  <td>x</td>
 </tr>
 <tr height=20 style='height:15.0pt'>
  <td>y</td>
 </tr>
<!--EndFragment-->
</table></body></html>`;

const GOOGLE_HTML = `<meta charset="utf-8"><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style><table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1" style="table-layout:fixed;font-size:10pt;font-family:Arial;width:0px;border-collapse:collapse;border:none" data-sheets-root="1"><colgroup><col width="100"/><col width="140"/></colgroup><tbody><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;font-weight:bold;" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Name&quot;}">Name</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:1234.5}" data-sheets-numberformat="{&quot;1&quot;:2,&quot;2&quot;:&quot;#,##0.00&quot;,&quot;3&quot;:1}">1,234.50</td></tr><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;background-color:#ffff00;color:#ff0000;font-style:italic;text-decoration:underline line-through;border-bottom:2px solid #000000;wrap-strategy:4;white-space:normal;word-wrap:break-word;" colspan="2" rowspan="1" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;0042&quot;}">0042</td></tr><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;font-size:14pt;font-family:Georgia;" data-sheets-value="{&quot;1&quot;:4,&quot;4&quot;:1}">TRUE</td><td></td></tr></tbody></table></google-sheets-html-origin>`;

describe("parseClipboardHtml: Excel", () => {
  const parsed = parseClipboardHtml(EXCEL_HTML, { fontjson });
  const at = (r, c) => parsed.cells[r][c];

  test("source and shape", () => {
    expect(parsed.source).toBe("excel");
    expect(parsed.cells).toHaveLength(4);
    expect(parsed.cells[0]).toHaveLength(3);
  });

  test("numbers with number formats keep their value and format", () => {
    expect(at(0, 0)).toMatchObject({
      v: 1234.5,
      m: "1,234.50",
      ct: { fa: "#,##0.00", t: "n" },
      bl: 1,
    });
    expect(at(0, 1)).toMatchObject({
      v: 0.125,
      ct: { fa: "0.00%", t: "n" },
      fc: "#ff0000",
      ht: 0,
    });
    expect(at(0, 2)).toMatchObject({
      ct: { fa: "m/d/yyyy", t: "d" },
      m: "1/15/2024",
    });
    expect(at(0, 2).v).toBe(45306);
  });

  test("General alignment is not turned into explicit alignment", () => {
    expect(at(0, 0).ht).toBeUndefined();
    expect(at(1, 2).ht).toBeUndefined();
    expect(at(1, 2).v).toBe(42);
  });

  test("text format, line breaks and wrap", () => {
    expect(at(1, 0)).toMatchObject({
      v: "00123\nsecond line",
      ct: { fa: "@", t: "s" },
      tb: "2",
      vt: 1,
    });
  });

  test("fills, strike-through and mso-spacerun spaces", () => {
    expect(at(1, 1)).toMatchObject({ bg: "#ffff00", cl: 1, v: "struck  text" });
  });

  test("the Normal style font comes from the td rule", () => {
    expect(at(0, 0).fs).toBe(11);
    expect(at(0, 0).ff).toBe("Calibri");
    expect(at(0, 0).fc).toBeUndefined();
    expect(at(0, 0).vt).toBe(2);
  });

  test("merges from rowspan/colspan", () => {
    expect(at(2, 0)).toMatchObject({
      v: "merged",
      ht: 0,
      mc: { r: 2, c: 0, rs: 2, cs: 2 },
    });
    expect(at(2, 1)).toEqual({ mc: { r: 2, c: 0 } });
    expect(at(3, 0)).toEqual({ mc: { r: 2, c: 0 } });
    expect(at(3, 1)).toEqual({ mc: { r: 2, c: 0 } });
    expect(at(2, 2).v).toBe("x");
    expect(at(3, 2).v).toBe("y");
  });

  test("borders, including the outline of a merged area", () => {
    expect(parsed.borders["0_2"]).toEqual({
      t: { style: 1, color: "#000000" },
      b: { style: 13, color: "#000000" },
    });
    expect(parsed.borders["2_0"]).toMatchObject({
      t: { style: 1 },
      l: { style: 1 },
    });
    expect(parsed.borders["3_1"]).toMatchObject({
      b: { style: 1 },
      r: { style: 1 },
    });
    expect(parsed.borders["2_1"].l).toBeUndefined();
  });

  test("column widths and row heights in px", () => {
    expect(parsed.colWidths).toEqual([87, 120, 64]);
    expect(parsed.rowHeights[0]).toBe(20);
    expect(parsed.rowHeights[1]).toBe(40);
  });
});

describe("parseClipboardHtml: Google Sheets", () => {
  const parsed = parseClipboardHtml(GOOGLE_HTML, { fontjson });
  const at = (r, c) => parsed.cells[r][c];

  test("detects Google Sheets and uses data-sheets-value", () => {
    expect(parsed.source).toBe("google");
    expect(at(0, 0)).toMatchObject({ v: "Name", bl: 1, fs: 10, ff: 1 });
    expect(at(0, 1)).toMatchObject({
      v: 1234.5,
      ct: { fa: "#,##0.00", t: "n" },
      ht: 2,
    });
    // a text value that looks like a number stays text
    expect(at(1, 0).v).toBe("0042");
    expect(at(2, 0)).toMatchObject({ v: true, fs: 14, ff: "Georgia" });
  });

  test("gridline borders from the generic td rule are ignored", () => {
    expect(parsed.borders["0_0"]).toBeUndefined();
    expect(parsed.borders["1_0"].b).toEqual({ style: 8, color: "#000000" });
    expect(parsed.borders["1_1"].b).toEqual({ style: 8, color: "#000000" });
  });

  test("styles, wrap and colspan merges", () => {
    expect(at(1, 0)).toMatchObject({
      bg: "#ffff00",
      fc: "#ff0000",
      it: 1,
      un: 1,
      cl: 1,
      tb: "2",
      mc: { r: 1, c: 0, rs: 1, cs: 2 },
    });
    expect(at(1, 1)).toEqual({ mc: { r: 1, c: 0 } });
    expect(parsed.colWidths).toEqual([100, 140]);
  });
});

describe("parseClipboardHtml: WPS and plain web tables", () => {
  test("WPS inline styles", () => {
    const parsed = parseClipboardHtml(pastedHtmlFactory("WPS"), { fontjson });
    expect(parsed.source).toBe("wps");
    expect(parsed.cells[0][1]).toMatchObject({ v: 2, bl: 1, fs: 12 });
    expect(parsed.cells[1][0].bg).toBe("#ed7d31");
    expect(parsed.cells[2][0].un).toBe(1);
    expect(parsed.cells[3][0].it).toBe(1);
  });

  test("a web page table: th, b tags, align attribute", () => {
    const parsed = parseClipboardHtml(
      "<table><tr><th>Head</th><td align='right'><b>bold</b></td></tr>" +
        "<tr><td>&nbsp;a&nbsp;</td><td bgcolor='#00ff00'>3.5</td></tr></table>"
    );
    expect(parsed.source).toBe("html");
    expect(parsed.cells[0][0]).toMatchObject({ v: "Head", bl: 1 });
    expect(parsed.cells[0][1]).toMatchObject({ v: "bold", bl: 1, ht: 2 });
    expect(parsed.cells[1][0].v).toBe(" a ");
    expect(parsed.cells[1][1]).toMatchObject({ v: 3.5, bg: "#00ff00" });
  });

  test("no table: null", () => {
    expect(parseClipboardHtml("<p>hello</p>")).toBeNull();
  });
});

describe("rangeToClipboard (our copy)", () => {
  function sheet() {
    const ctx = makeContext({ rows: 4, cols: 4 });
    const d = ctx.luckysheetfile[0].data;
    d[0][0] = {
      v: 1234.5,
      m: "1,234.50",
      ct: { fa: "#,##0.00", t: "n" },
      bl: 1,
      it: 1,
      fc: "#ff0000",
      bg: "#ffff00",
      fs: 14,
      ht: 0,
      vt: 1,
    };
    d[0][1] = { v: "a\tb", m: "a\tb", ct: { fa: "General", t: "g" } };
    d[1][0] = {
      v: "multi\nline",
      m: "multi\nline",
      ct: { fa: "General", t: "g" },
      tb: "2",
      un: 1,
      cl: 1,
      mc: { r: 1, c: 0, rs: 1, cs: 2 },
    };
    d[1][1] = { mc: { r: 1, c: 0 } };
    d[2][0] = { v: "00123", m: "00123", ct: { fa: "@", t: "s" } };
    d[2][1] = { v: 0.25, m: "25%", ct: { fa: "0%", t: "n" }, f: "=1/4" };
    ctx.luckysheetfile[0].config = {
      columnlen: { 0: 120 },
      merge: { "1_0": { r: 1, c: 0, rs: 1, cs: 2 } },
      borderInfo: [
        {
          rangeType: "cell",
          value: {
            row_index: 0,
            col_index: 0,
            l: null,
            r: null,
            t: { style: 1, color: "#000000" },
            b: { style: 8, color: "#0000ff" },
          },
        },
      ],
    };
    ctx.config = ctx.luckysheetfile[0].config;
    return ctx;
  }
  const range = [{ row: [0, 2], column: [0, 1] }];

  test("TSV with Excel quoting, merged cells blank", () => {
    const { text } = rangeToClipboard(sheet(), "id_1", range, "tok");
    expect(text).toBe('1,234.50\t"a\tb"\r\n"multi\nline"\t\r\n00123\t25%');
  });

  test("HTML carries styles, numbers, formats, merges and borders", () => {
    const { html } = rangeToClipboard(sheet(), "id_1", range, "tok");
    expect(html).toContain('data-fortune-copy="tok"');
    expect(html).toContain("fortune-copy-action-table");
    expect(html).toContain('x:num="1234.5"');
    expect(html).toContain("font-weight:700");
    expect(html).toContain("mso-number-format:&quot;#,##0.00&quot;");
    expect(html).toContain('colspan="2"');
    expect(html).toContain("border-top:0.5pt solid #000000");
    expect(html).toContain("border-bottom:1.0pt solid #0000ff");
    expect(html).toContain('<col width="120"');
    expect(html).toContain("x:str");
  });

  test("round trip: what we write is what we read", () => {
    const { html } = rangeToClipboard(sheet(), "id_1", range, "tok");
    const parsed = parseClipboardHtml(html, { fontjson });
    const c = parsed.cells;
    expect(parsed.source).toBe("tinysheet");
    expect(c[0][0]).toMatchObject({
      v: 1234.5,
      ct: { fa: "#,##0.00", t: "n" },
      bl: 1,
      it: 1,
      fc: "#ff0000",
      bg: "#ffff00",
      fs: 14,
      ht: 0,
      vt: 1,
    });
    expect(c[0][1].v).toBe("a\tb");
    expect(c[1][0]).toMatchObject({
      v: "multi\nline",
      tb: "2",
      un: 1,
      cl: 1,
      mc: { r: 1, c: 0, rs: 1, cs: 2 },
    });
    expect(c[2][0]).toMatchObject({ v: "00123", ct: { fa: "@" } });
    expect(c[2][1]).toMatchObject({ v: 0.25, m: "25%", ct: { fa: "0%" } });
    expect(parsed.borders["0_0"]).toEqual({
      t: { style: 1, color: "#000000" },
      b: { style: 8, color: "#0000ff" },
    });
    expect(parsed.colWidths[0]).toBe(120);
  });
});
