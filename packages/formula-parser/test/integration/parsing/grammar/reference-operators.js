// T3: the reference union operator (a comma inside parentheses,
// =SUM((A1:A2,C1:C2))) and the intersection operator (a space,
// =B1:B5 A3:D3). Excel: functions that take several areas (SUM, COUNT,
// AVERAGE, MIN, MAX, LARGE, SMALL, RANK, INDEX's area_num, AREAS) accept a
// union; an intersection that shares no cell is #NULL!.
import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

//     A      B       C
// 1   1      "x"     (blank)
// 2   2      "y"     "#N/A"
// 3   3      "x"     "#DIV/0!"
// 4   4      "z"     TRUE
// 5   5      "x"     "10"
describe(".parse() reference union and intersection", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("union", () => {
    it("feeds every area to the aggregates", () => {
      expect(value("SUM((A1:A2,A4:A5))")).toBe(12);
      expect(value("SUM((A1,A3),A5)")).toBe(9);
      expect(value("SUM(((A1,A2),A3))")).toBe(6);
      expect(value("COUNT((A1:A2,C1:C2))")).toBe(2);
      expect(value("COUNTA((B1:B2,C1:C2))")).toBe(3);
      expect(value("AVERAGE((A1,A5))")).toBe(3);
      expect(value("MIN((A2:A3,A5))")).toBe(2);
      expect(value("MAX((A1,A5))")).toBe(5);
      expect(value("SUM((A1,C4,C5))")).toBe(1);
    });

    it("works with LARGE, SMALL and RANK", () => {
      expect(value("LARGE((A1:A2,A4:A5),1)")).toBe(5);
      expect(value("SMALL((A1:A2,A4:A5),2)")).toBe(2);
      expect(value("RANK(4,(A1:A2,A4:A5))")).toBe(2);
    });

    it("selects an area with INDEX's area_num", () => {
      expect(value("INDEX((A1:A2,A4:A5),1,1,2)")).toBe(4);
      expect(value("INDEX((A1:A2,B4:B5),2,1,2)")).toBe("x");
      expect(value("INDEX((A1:A2,A4:A5),1,1,3)")).toBe("#REF!");
      expect(value("INDEX((A1:A2,A4:A5),1,1,0)")).toBe("#VALUE!");
      expect(value("SUM(INDEX((A1:A2,A4:A5),0,0,2))")).toBe(9);
    });

    it("counts areas with AREAS", () => {
      expect(value("AREAS((A1:A2,A4:A5,B1))")).toBe(3);
      expect(value("AREAS(A1:B2)")).toBe(1);
      expect(value("AREAS(B1:B5 A3:D3)")).toBe(1);
      expect(value("AREAS(1)")).toBe("#VALUE!");
    });

    it("is #VALUE! where a single value or area is expected", () => {
      expect(value("(A1,A2)")).toBe("#VALUE!");
      expect(value("ABS((A1,A2))")).toBe("#VALUE!");
      expect(value("ROWS((A1,A2))")).toBe("#REF!");
      expect(value("SUM((A1,Sheet2!A1))")).toBe("#VALUE!");
      expect(value("SUM((A1,1))")).toBe("#VALUE!");
    });

    it("spreads areas and their descriptors to custom functions", () => {
      const calls = [];

      parser.on("callFunction", (name, params, done, refs) => {
        if (name === "SUM") {
          calls.push(refs.map((r) => r && [r.startRow, r.endRow]));
        }
      });
      value("SUM((A1:A2,A4:A5))");
      expect(calls).toEqual([
        [
          [0, 1],
          [3, 4],
        ],
      ]);
    });

    it("lists every area in getReferences", () => {
      expect(parser.getReferences("SUM((A1:A2,C1))")).toEqual([
        {
          sheetName: null,
          startRow: 0,
          startColumn: 0,
          endRow: 1,
          endColumn: 0,
        },
        {
          sheetName: null,
          startRow: 0,
          startColumn: 2,
          endRow: 0,
          endColumn: 2,
        },
      ]);
    });
  });

  describe("intersection", () => {
    it("returns the shared cells", () => {
      expect(value("B1:B5 A3:D3")).toBe("x");
      expect(value("SUM(A1:A5 A2:C3)")).toBe(5);
      expect(value("ROWS(A1:C3 B2:D4)")).toBe(2);
      expect(value("A:A 4:4")).toBe(4);
    });

    it("is #NULL! when the areas do not meet", () => {
      expect(value("SUM(A1:A2 C1:C2)")).toBe("#NULL!");
      expect(value("A1 B1")).toBe("#NULL!");
    });

    it("intersects each area of a union", () => {
      expect(value("SUM((A1:A2,A4:A5) A2:B4)")).toBe(6);
    });

    it("works with references returned by functions", () => {
      expect(value("INDEX(A1:C5,0,1) A3:C3")).toBe(3);
      expect(value("IF(TRUE,A1:A5) A4:B4")).toBe(4);
    });
  });
});
