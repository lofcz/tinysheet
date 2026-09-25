// T4: functions that return references. Excel: "INDEX returns a reference"
// in the reference form (=A1:INDEX(B:B,5), =ROW(INDEX(A1:C5,2,0))), CHOOSE
// and IF return whichever reference argument they select, and OFFSET and
// INDIRECT return references usable as range endpoints (=OFFSET(A1,1,0):A4).
import Parser from "../../../../src/parser";
import { createReference } from "../../../../src/index";
import { attachSheet, plain } from "./sheet-fixture.mjs";

//     A      B       C
// 1   1      "x"     (blank)
// 2   2      "y"     "#N/A"
// 3   3      "x"     "#DIV/0!"
// 4   4      "z"     TRUE
// 5   5      "x"     "10"
describe(".parse() reference-returning functions", () => {
  let parser;
  let log;

  beforeEach(() => {
    parser = new Parser();
    log = attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("INDEX", () => {
    it("is a range endpoint", () => {
      expect(value("SUM(A1:INDEX(A:A,3))")).toBe(6);
      expect(value("SUM(INDEX(A:A,2):A4)")).toBe(9);
      expect(value("SUM(INDEX(A1:A5,2):INDEX(A1:A5,4))")).toBe(9);
      expect(value("COUNTA(A1:INDEX(B:B,2))")).toBe(4);
      expect(value("SUM(Sheet2!A1:INDEX(Sheet2!B:B,2))")).toBe(1000);
    });

    it("reads only the selected cells", () => {
      log.length = 0;
      expect(value("INDEX(A1:C5,2,2)")).toBe("y");
      expect(log).toEqual([["cell", "B2", null]]);
    });

    it("returns whole rows and columns as references", () => {
      expect(value("ROW(INDEX(A1:C5,2,0))")).toBe(2);
      expect(value("COLUMN(INDEX(A1:C5,0,3))")).toBe(3);
      expect(value("ROWS(INDEX(A1:C5,0,1))")).toBe(5);
      expect(value("COLUMNS(INDEX(A1:C5,2,0))")).toBe(3);
      expect(value("SUM(INDEX(A1:C5,0,1))")).toBe(15);
      expect(value("INDEX(A1:C5,2,0)")).toEqual([[2, "y", "#N/A"]]);
      expect(value("INDEX(A1:E1,3)")).toBe(null);
      expect(value("INDEX(A1:A5,3)")).toBe(3);
    });

    it("follows Excel's errors", () => {
      expect(value("INDEX(A1:A5,6)")).toBe("#REF!");
      expect(value("INDEX(A1:A5,1,2)")).toBe("#REF!");
      expect(value("INDEX(A1:C5,-1,1)")).toBe("#VALUE!");
    });

    it("keeps array row/column arguments on the value path", () => {
      expect(value("INDEX(A1:A5,{1,3})")).toEqual([[1, 3]]);
      expect(value("INDEX({1,2;3,4},2,2)")).toBe(4);
    });

    it("works with CELL", () => {
      expect(value('CELL("row", INDEX(A1:C5,4,1))')).toBe(4);
      expect(value('CELL("col", INDEX(A1:C5,4,3))')).toBe(3);
      expect(value('CELL("address", INDEX(A1:C5,2,3))')).toBe("$C$2");
      expect(value('CELL("address", INDEX(Sheet2!A1:B2,2,2))')).toBe(
        "Sheet2!$B$2"
      );
      expect(value('CELL("contents", INDEX(A1:C5,2,2))')).toBe("y");
    });

    it("passes the resolved reference to custom functions", () => {
      let refs = null;

      parser.setFunction("REFS", (params, r) => {
        refs = r;

        return params.length;
      });
      value("REFS(INDEX(A1:C5,2,2), 1)");
      expect(refs).toEqual([
        {
          sheetName: null,
          startRow: 1,
          startColumn: 1,
          endRow: 1,
          endColumn: 1,
        },
        null,
      ]);
    });
  });

  describe("IF, CHOOSE, IFS, SWITCH, LET", () => {
    it("return the selected reference", () => {
      expect(value("SUM(IF(TRUE,A1,B1):A5)")).toBe(15);
      expect(value("SUM(IF(FALSE,A1,A2):A3)")).toBe(5);
      expect(value("SUM(CHOOSE(2,A1:A2,A3:A5))")).toBe(12);
      expect(value("ROWS(CHOOSE(2,A1:A2,A3:A5))")).toBe(3);
      expect(value("ROWS(IFS(FALSE,A1,TRUE,A1:A4))")).toBe(4);
      expect(value('ROWS(SWITCH("b","a",A1,"b",A1:A2))')).toBe(2);
      expect(value("LET(r, A1:A5, ROWS(r))")).toBe(5);
      expect(value("LET(r, A1:A3, SUM(r))")).toBe(6);
      expect(value("SUM(A1:CHOOSE(2,A1,A3))")).toBe(6);
    });

    it("ISREF sees references returned by functions", () => {
      expect(value("ISREF(INDEX(A1:A5,2))")).toBe(true);
      expect(value("ISREF(A1)")).toBe(true);
      expect(value("ISREF(IF(TRUE,1))")).toBe(false);
      expect(value("ISREF(IF(TRUE,A1:A2))")).toBe(true);
    });
  });

  describe("OFFSET and INDIRECT as references", () => {
    it("are range endpoints", () => {
      expect(value("SUM(OFFSET(A1,1,0):A4)")).toBe(9);
      expect(value("SUM(A1:OFFSET(A1,2,0))")).toBe(6);
      expect(value('SUM(INDIRECT("A2"):A3)')).toBe(5);
      expect(value('SUM(INDIRECT("Sheet2!A1"):Sheet2!B2)')).toBe(1000);
    });

    it("feed ROWS, COLUMNS and INDEX", () => {
      expect(value("ROWS(OFFSET(A1,0,0,3,2))")).toBe(3);
      expect(value("COLUMNS(OFFSET(A1,0,0,3,2))")).toBe(2);
      expect(value("ROWS(OFFSET(A5,0,0,-2))")).toBe(2);
      expect(value("ROW(OFFSET(A5,0,0,-2,1))")).toEqual([[4], [5]]);
      expect(value('ROWS(INDIRECT("A1:A4"))')).toBe(4);
      expect(value("INDEX(OFFSET(A1,1,0,3,2),2,2)")).toBe("x");
    });

    it("follow Excel's errors", () => {
      expect(value("SUM(OFFSET(A1,-1,0):A2)")).toBe("#REF!");
      expect(value("ROWS(OFFSET(A1,0,0,0))")).toBe("#REF!");
      expect(value('SUM(INDIRECT("nope"):A2)')).toBe("#REF!");
      expect(value('SUM(INDIRECT("A1",FALSE):A2)')).toBe("#REF!");
    });

    it("are left to the host elsewhere", () => {
      parser.on("callFunction", (name, params, done) => {
        if (name === "OFFSET") {
          done("host");
        }
      });

      expect(value("OFFSET(A1,1,0)")).toBe("host");
    });
  });

  describe("host references", () => {
    it("createReference results are references", () => {
      parser.setFunction("MYREF", () =>
        createReference({ startRow: 1, startColumn: 0, endRow: 3 })
      );

      expect(value("SUM(MYREF())")).toBe(9);
      expect(value("SUM(MYREF():A5)")).toBe(14);
      expect(value("MYREF()")).toEqual([[2], [3], [4]]);
      expect(value("ROWS(MYREF())")).toBe(3);
    });

    it("variables resolved through resolveReference are references", () => {
      const MARKER = "\u0001REF:B";

      parser.setVariable("Letters", MARKER);
      parser.on("resolveReference", (v, _options, done) => {
        if (v === MARKER) {
          done({
            sheetName: null,
            startRow: 0,
            startColumn: 1,
            endRow: 4,
            endColumn: 1,
          });
        }
      });

      expect(value("ROWS(Letters)")).toBe(5);
      expect(value("COUNTA(Letters:C1)")).toBe(9);
      expect(value('COUNTIF(Letters,"x")')).toBe(3);
      expect(value("INDEX(Letters,4)")).toBe("z");
    });
  });

  it("reports the spanned area in getReferences", () => {
    expect(parser.getReferences("SUM(A1:INDEX(B:B,5))")).toEqual([
      { sheetName: null, startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 },
      {
        sheetName: null,
        startRow: -1,
        startColumn: 1,
        endRow: -1,
        endColumn: 1,
      },
      {
        sheetName: null,
        startRow: -1,
        startColumn: 0,
        endRow: -1,
        endColumn: 1,
      },
    ]);
  });
});
