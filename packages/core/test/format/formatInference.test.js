import { inferFormulaFormat } from "../../src/modules/formatInference";
import { setCellValue } from "../../src/modules/cell";

const DATE = { v: 45366, ct: { fa: "m/d/yyyy", t: "d" } };
const DATE2 = { v: 45370, ct: { fa: "d-mmm-yy", t: "d" } };
const TIME = { v: 0.5, ct: { fa: "h:mm", t: "d" } };
const TIME2 = { v: 0.25, ct: { fa: "h:mm", t: "d" } };
const CURRENCY = { v: 10, ct: { fa: '"$"#,##0.00', t: "n" } };
const ACCOUNTING = {
  v: 5,
  ct: { fa: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)' },
};
const PERCENT = { v: 0.1, ct: { fa: "0%", t: "n" } };
const NUMBER = { v: 3, ct: { fa: "0.00", t: "n" } };
const PLAIN = { v: 4, ct: { fa: "General", t: "n" } };

// A1 date, A2 date, B1 currency, B2 accounting, C1 percent, D1 time,
// D2 time, E1 plain number with 0.00, E2 General number
const grid = [
  [DATE, CURRENCY, PERCENT, TIME, NUMBER],
  [DATE2, ACCOUNTING, null, TIME2, PLAIN],
  [null, CURRENCY, null, null, null],
];
const other = [[{ v: 1, ct: { fa: "0.0%", t: "n" } }]];
const lookup = (sheet, r, c) =>
  sheet === "Other" ? other[r]?.[c] : grid[r]?.[c];

const infer = (f) => inferFormulaFormat(f, lookup);

describe("Excel format inference for formula results", () => {
  test.each([
    // arithmetic on a date keeps the date
    ["=A1+7", "m/d/yyyy"],
    ["=7+A1", "m/d/yyyy"],
    ["=A1-1", "m/d/yyyy"],
    ["=(A1)", "m/d/yyyy"],
    ["=A1", "m/d/yyyy"],
    // date - date is a number of days
    ["=A2-A1", undefined],
    ["=(A2-A1)*24", undefined],
    // currency, percent, time
    ["=B1*1.2", '"$"#,##0.00'],
    ["=-B1", '"$"#,##0.00'],
    ["=B1/E2", '"$"#,##0.00'],
    ["=E2*B1", '"$"#,##0.00'],
    ["=B2+1", ACCOUNTING.ct.fa],
    ["=C1*2", "0%"],
    ["=D1-D2", "h:mm"],
    ["=D1+D2", "h:mm"],
    ["=A1+D1", "m/d/yyyy"],
    // plain number formats are not carried over
    ["=E1*2", undefined],
    ["=E2+1", undefined],
    ["=E1+B1", '"$"#,##0.00'],
    // aggregations
    ["=SUM(B1:B3)", '"$"#,##0.00'],
    ["=SUM(E1:E2,B1)", '"$"#,##0.00'],
    ["=AVERAGE(A1:A2)", "m/d/yyyy"],
    ["=MAX(D1:D2)", "h:mm"],
    ["=ROUND(B1*1.07,2)", '"$"#,##0.00'],
    ['=SUMIF(E1:E2,">0",B1:B2)', '"$"#,##0.00'],
    ["=SUBTOTAL(9,B1:B3)", '"$"#,##0.00'],
    ["=SUM(B:B)", '"$"#,##0.00'],
    ["=SUM(B1:B3)*1.1", '"$"#,##0.00'],
    // branches
    ['=IF(E2>0,B1,"")', '"$"#,##0.00'],
    ["=IFERROR(C1/E2,0)", "0%"],
    // date functions
    ["=TODAY()", "m/d/yyyy"],
    ["=TODAY()+7", "m/d/yyyy"],
    ["=TODAY()-A1", undefined],
    ["=NOW()", "m/d/yyyy h:mm"],
    ["=TIME(1,2,3)", "h:mm AM/PM"],
    // cross-sheet
    ["=Other!A1*2", "0.0%"],
    ["='Other'!A1+E2", "0.0%"],
    // no inference
    ["=COUNT(B1:B3)", undefined],
    ["=LEN(B1)", undefined],
    ["=B1>5", undefined],
    ['=B1&""', undefined],
    ["=B1^2", undefined],
    ["=1+2", undefined],
    ["=YEAR(A1)", undefined],
    ["=SUM(", undefined],
  ])("%s → %s", (formula, fa) => {
    expect(infer(formula)).toBe(fa);
  });
});

describe("setCellValue applies the inferred format", () => {
  const ctx = {
    luckysheetfile: [{ name: "Other", data: other }],
  };

  test("General formula cell over a date shows a date", () => {
    const d = [
      [{ ...DATE }, { f: "=A1+7" }],
      [null, null],
    ];
    setCellValue(ctx, 0, 1, d, { f: "=A1+7", v: 45373 });
    expect(d[0][1].ct).toEqual({ fa: "m/d/yyyy", t: "d" });
    expect(d[0][1].m).toBe("3/22/2024");
  });

  test("currency is carried, an explicit format wins", () => {
    const d = [
      [
        { ...CURRENCY },
        { f: "=A1*1.2" },
        { f: "=A1*2", ct: { fa: "0.0", t: "n" } },
      ],
    ];
    setCellValue(ctx, 0, 1, d, { f: "=A1*1.2", v: 12 });
    expect(d[0][1]).toMatchObject({ m: "$12.00", ct: { fa: '"$"#,##0.00' } });
    setCellValue(ctx, 0, 2, d, { f: "=A1*2", v: 20 });
    expect(d[0][2]).toMatchObject({ m: "20.0", ct: { fa: "0.0" } });
  });

  test("text results are not formatted", () => {
    const d = [[{ ...CURRENCY }, { f: '=A1&"x"' }]];
    setCellValue(ctx, 0, 1, d, { f: '=A1&"x"', v: "10x" });
    expect(d[0][1]).toMatchObject({ m: "10x", ct: { fa: "General", t: "g" } });
  });
});
