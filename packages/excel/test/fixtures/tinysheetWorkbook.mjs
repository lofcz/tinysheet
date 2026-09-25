// A TinySheet workbook (sheets as the Workbook API returns them) exercising
// every feature the xlsx export writes. Used by the export and round-trip
// suites.

const rich = {
  ct: {
    fa: "General",
    t: "inlineStr",
    s: [
      { v: "Bold", bl: 1, fc: "#FF0000", fs: 12 },
      { v: " and italic", it: 1 },
    ],
  },
};

export function tinySheetWorkbook() {
  const report = {
    name: "Report",
    id: "report",
    order: 0,
    status: 1,
    color: "#00B050",
    zoomRatio: 1.25,
    showGridLines: 0,
    frozen: { type: "rangeBoth", range: { row_focus: 0, column_focus: 1 } },
    celldata: [
      {
        r: 0,
        c: 0,
        v: {
          v: "Header",
          m: "Header",
          ct: { fa: "General", t: "g" },
          bl: 1,
          it: 1,
          un: 1,
          cl: 1,
          ff: "Arial",
          fs: 14,
          fc: "#FF0000",
          bg: "#FFFF00",
          ht: 0,
          vt: 0,
          tb: "2",
          rt: 45,
        },
      },
      {
        r: 1,
        c: 0,
        v: { v: 1234.5, m: "$1,234.50", ct: { fa: '"$"#,##0.00', t: "n" } },
      },
      {
        r: 2,
        c: 0,
        v: { v: 45000, m: "2023-03-15", ct: { fa: "yyyy-mm-dd", t: "d" } },
      },
      { r: 3, c: 0, v: { v: true, m: "TRUE", ct: { fa: "General", t: "b" } } },
      {
        r: 4,
        c: 0,
        v: {
          f: "=1/0",
          v: "#DIV/0!",
          m: "#DIV/0!",
          ct: { fa: "General", t: "e" },
        },
      },
      {
        r: 5,
        c: 0,
        v: {
          v: "Merged",
          m: "Merged",
          ct: { fa: "General", t: "g" },
          mc: { r: 5, c: 0, rs: 2, cs: 2 },
          ht: 2,
          vt: 1,
        },
      },
      { r: 5, c: 1, v: { mc: { r: 5, c: 0 } } },
      { r: 6, c: 0, v: { mc: { r: 5, c: 0 } } },
      { r: 6, c: 1, v: { mc: { r: 5, c: 0 } } },
      { r: 7, c: 0, v: { v: "b", m: "b", ct: { fa: "General", t: "g" } } },
      { r: 7, c: 1, v: { v: 5, m: "5", ct: { fa: "General", t: "n" } } },
      {
        r: 7,
        c: 2,
        v: { v: 45300, m: "2024-01-09", ct: { fa: "yyyy-mm-dd", t: "d" } },
      },
      { r: 7, c: 3, v: { v: "xyz", m: "xyz", ct: { fa: "General", t: "g" } } },
      { r: 9, c: 0, v: { v: 0.25, m: "25.0%", ct: { fa: "0.0%", t: "n" } } },
      { r: 9, c: 1, v: { v: "007", m: "007", ct: { fa: "@", t: "s" } } },
      { r: 9, c: 2, v: { v: "vertical", tr: "3" } },
      { r: 9, c: 3, v: { v: "down", rt: 135 } },

      // Formulas
      {
        r: 0,
        c: 1,
        v: {
          f: "=XLOOKUP(A2,A2:A3,A2:A3)",
          v: 1234.5,
          m: "1234.5",
          ct: { fa: "General", t: "n" },
        },
      },
      {
        r: 1,
        c: 1,
        v: {
          f: "=SEQUENCE(3)",
          v: 1,
          m: "1",
          ct: { fa: "General", t: "n" },
          spill: { rs: 3, cs: 1 },
        },
      },
      {
        r: 2,
        c: 1,
        v: {
          v: 2,
          m: "2",
          ct: { fa: "General", t: "n" },
          spillFrom: { dr: 1, dc: 0 },
        },
      },
      {
        r: 3,
        c: 1,
        v: {
          v: 3,
          m: "3",
          ct: { fa: "General", t: "n" },
          spillFrom: { dr: 2, dc: 0 },
        },
      },
      {
        r: 0,
        c: 2,
        v: {
          f: "=LET(x,2,x*A2)",
          v: 2469,
          m: "2469",
          ct: { fa: "General", t: "n" },
        },
      },
      {
        r: 1,
        c: 2,
        v: {
          f: "=FILTER(A2:A3,A2:A3>2000)",
          v: 45000,
          m: "45000",
          ct: { fa: "General", t: "n" },
        },
      },
      {
        r: 2,
        c: 2,
        v: { f: "=SUM(B2#)", v: 6, m: "6", ct: { fa: "General", t: "n" } },
      },
      {
        r: 3,
        c: 2,
        v: {
          f: '=CONCAT("a","b")&TEXTJOIN(",",TRUE,"x","y")',
          v: "abx,y",
          m: "abx,y",
          ct: { fa: "General", t: "g" },
        },
      },
      {
        r: 4,
        c: 2,
        v: {
          f: "=SUM(A2:A3)",
          v: 46234.5,
          m: "46234.5",
          ct: { fa: "General", t: "n" },
        },
      },
      {
        r: 5,
        c: 2,
        v: {
          f: "='Other Sheet'!B2",
          v: "target",
          m: "target",
          ct: { fa: "General", t: "g" },
        },
      },

      // Links, notes, rich text
      {
        r: 0,
        c: 3,
        v: {
          v: "site",
          m: "site",
          ct: { fa: "General", t: "g" },
          fc: "#0000FF",
          un: 1,
          hl: { r: 0, c: 3, id: "report" },
        },
      },
      {
        r: 1,
        c: 3,
        v: {
          v: "jump",
          m: "jump",
          ct: { fa: "General", t: "g" },
          hl: { r: 1, c: 3, id: "report" },
        },
      },
      {
        r: 2,
        c: 3,
        v: {
          v: "noted",
          m: "noted",
          ct: { fa: "General", t: "g" },
          ps: {
            left: null,
            top: null,
            width: null,
            height: null,
            value: "A note\nline 2",
            isShow: false,
          },
        },
      },
      { r: 3, c: 3, v: rich },
    ],
    config: {
      merge: { "5_0": { r: 5, c: 0, rs: 2, cs: 2 } },
      columnlen: { 0: 150, 2: 40 },
      rowlen: { 0: 40, 4: 25 },
      rowhidden: { 8: 0 },
      colhidden: { 5: 0 },
      borderInfo: [
        {
          rangeType: "cell",
          value: {
            row_index: 0,
            col_index: 0,
            l: { style: 1, color: "#000000" },
            r: { style: 1, color: "#000000" },
            t: { style: 1, color: "#000000" },
            b: { style: 13, color: "#FF0000" },
          },
        },
      ],
    },
    hyperlink: {
      "0_3": {
        linkType: "webpage",
        linkAddress: "https://example.com/a?b=1&c=2",
      },
      "1_3": { linkType: "cellrange", linkAddress: "'Other Sheet'!B2" },
    },
    dataVerification: {
      "7_0": {
        type: "dropdown",
        type2: null,
        value1: "a,b,c",
        value2: "",
        prohibitInput: true,
        hintShow: true,
        hintValue: "pick one",
      },
      "7_1": {
        type: "number_integer",
        type2: "between",
        value1: "1",
        value2: "10",
        prohibitInput: false,
        hintShow: false,
      },
      "7_2": {
        type: "date",
        type2: "laterThan",
        value1: "2024-01-01",
        value2: "",
        prohibitInput: true,
        hintShow: false,
      },
      "7_3": {
        type: "text_content",
        type2: "include",
        value1: "x",
        value2: "",
        prohibitInput: false,
        hintShow: false,
      },
      "7_4": {
        type: "text_length",
        type2: "lessThanOrEqualTo",
        value1: "5",
        value2: "",
        prohibitInput: true,
        hintShow: false,
      },
    },
  };

  const other = {
    name: "Other Sheet",
    id: "other",
    order: 1,
    hide: 1,
    celldata: [
      {
        r: 1,
        c: 1,
        v: { v: "target", m: "target", ct: { fa: "General", t: "g" } },
      },
    ],
    config: {},
  };

  return [report, other];
}
