import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

describe(".parse() references", () => {
  let parser;
  let log;

  beforeEach(() => {
    parser = new Parser();
    log = attachSheet(parser);
  });

  const value = (formula, options) => {
    const { error, result } = parser.parse(formula, options);

    return error === null ? plain(result) : error;
  };
  const lastRange = () => {
    const entry = log.filter((e) => e[0] === "range").pop();

    return { start: entry[1], end: entry[2] };
  };

  describe("whole columns", () => {
    it("emits callRangeValue with row index -1", () => {
      expect(value("SUM(A:A)")).toBe(15);
      const { start, end } = lastRange();

      expect(start).toEqual({
        sheetName: null,
        row: { index: -1, label: "", isAbsolute: false },
        column: { index: 0, label: "A", isAbsolute: false },
        label: "A",
      });
      expect(end).toEqual({
        row: { index: -1, label: "", isAbsolute: false },
        column: { index: 0, label: "A", isAbsolute: false },
        label: "A",
      });
    });

    it("supports absolute and multi-column spans", () => {
      value("$A:$C");
      const { start, end } = lastRange();

      expect(start.column).toEqual({ index: 0, label: "A", isAbsolute: true });
      expect(end.column).toEqual({ index: 2, label: "C", isAbsolute: true });
      expect(start.label).toBe("$A");
      expect(end.label).toBe("$C");
      expect(start.row.index).toBe(-1);
    });

    it("normalises reversed spans", () => {
      value("C:$A");
      const { start, end } = lastRange();

      expect(start.column).toMatchObject({ index: 0, isAbsolute: true });
      expect(end.column).toMatchObject({ index: 2, isAbsolute: false });
    });

    it("supports sheet-qualified columns", () => {
      expect(value("SUM(Sheet2!B:B)")).toBe(600);
      expect(lastRange().start.sheetName).toBe("Sheet2");
      expect(lastRange().start.column.index).toBe(1);

      value("'My Sheet'!B:D");
      expect(lastRange().start.sheetName).toBe("My Sheet");
      expect(lastRange().end.column.index).toBe(3);

      value("'It''s'!A:A");
      expect(lastRange().start.sheetName).toBe("It's");
    });

    it("supports multi-letter columns", () => {
      value("AA:XFD");
      expect(lastRange().start.column.index).toBe(26);
      expect(lastRange().end.column.index).toBe(16383);
      expect(value("A:XFE")).toBe("#REF!");
    });
  });

  describe("whole rows", () => {
    it("emits callRangeValue with column index -1", () => {
      expect(value("SUM(1:1)")).toBe(1);
      const { start, end } = lastRange();

      expect(start).toEqual({
        sheetName: null,
        row: { index: 0, label: "1", isAbsolute: false },
        column: { index: -1, label: "", isAbsolute: false },
        label: "1",
      });
      expect(end.row).toEqual({ index: 0, label: "1", isAbsolute: false });
      expect(end.column.index).toBe(-1);
    });

    it("supports absolute and multi-row spans", () => {
      value("$3:$5");
      const { start, end } = lastRange();

      expect(start.row).toEqual({ index: 2, label: "3", isAbsolute: true });
      expect(end.row).toEqual({ index: 4, label: "5", isAbsolute: true });
      expect(start.label).toBe("$3");
      expect(end.label).toBe("$5");
    });

    it("supports sheet-qualified rows", () => {
      expect(value("SUM(Sheet2!2:2)")).toBe(700);
      expect(lastRange().start.sheetName).toBe("Sheet2");

      value("'My Sheet'!2:2");
      expect(lastRange().start.sheetName).toBe("My Sheet");
      expect(lastRange().start.row.index).toBe(1);
    });

    it("rejects row 0", () => {
      expect(value("0:1")).toBe("#REF!");
    });
  });

  describe("cells and ranges", () => {
    it("keeps the existing callCellValue contract", () => {
      expect(value("'My Sheet'!A1")).toBe(100);
      expect(log.pop()).toEqual(["cell", "A1", "My Sheet"]);
      expect(value("Sheet2!$B$2")).toBe(400);
    });

    it("keeps the existing callRangeValue contract", () => {
      expect(value("SUM(Sheet2!A1:B2)")).toBe(1000);
      expect(lastRange().start).toMatchObject({
        sheetName: "Sheet2",
        label: "A1",
      });
      expect(lastRange().end).toMatchObject({ label: "B2" });
    });
  });

  describe("intersection (space operator)", () => {
    it("reads the overlapping range", () => {
      expect(value("SUM(A1:B5 A2:A3)")).toBe(5);
      const { start, end } = lastRange();

      expect(start.label).toBe("A2");
      expect(end.label).toBe("A3");
    });

    it("reads a single cell for a row/column crossing", () => {
      expect(value("A:A 3:3")).toBe(3);
      expect(log.pop()).toEqual(["cell", "A3", null]);
      expect(value("B:B 2:2")).toBe("y");
    });

    it("returns #NULL! for disjoint references", () => {
      expect(value("A1:A2 C1:C2")).toBe("#NULL!");
    });

    it("returns #VALUE! for non-references", () => {
      expect(value("(1) (2)")).toBe("#VALUE!");
      expect(value("A1:A3 SUM(1)")).toBe("#VALUE!");
    });

    it("does not treat spaces around operators as intersections", () => {
      expect(value("A1 + A2")).toBe(3);
      expect(value("SUM( A1:A2 , A3 )")).toBe(6);
      expect(value("( A1 )")).toBe(1);
    });
  });

  describe("@ implicit intersection", () => {
    it("returns the top-left value of an array", () => {
      expect(value("@{5,6;7,8}")).toBe(5);
      expect(value("@7")).toBe(7);
    });

    it("reads a single-cell reference directly", () => {
      expect(value("@A2")).toBe(2);
    });

    it("uses the formula position from the parse options", () => {
      expect(value("@A1:A5", { row: 3 })).toBe(4);
      expect(value("@A1:C1", { column: 1 })).toBe("x");
      expect(value("@A1:A5")).toBe("#VALUE!");
      expect(value("@A1:A5", { row: 9 })).toBe("#VALUE!");
    });
  });

  describe("reference info", () => {
    it("passes refs to custom functions", () => {
      let seen;

      parser.setFunction("REFS", (params, refs) => {
        seen = refs;

        return params.length;
      });

      expect(value("REFS(A1, 5, B2:C3, Sheet2!D:D, 2:3, LET(x, 1, x))")).toBe(
        6
      );
      expect(seen).toEqual([
        {
          sheetName: null,
          startRow: 0,
          startColumn: 0,
          endRow: 0,
          endColumn: 0,
        },
        null,
        {
          sheetName: null,
          startRow: 1,
          startColumn: 1,
          endRow: 2,
          endColumn: 2,
        },
        {
          sheetName: "Sheet2",
          startRow: -1,
          startColumn: 3,
          endRow: -1,
          endColumn: 3,
        },
        {
          sheetName: null,
          startRow: 1,
          startColumn: -1,
          endRow: 2,
          endColumn: -1,
        },
        null,
      ]);
    });

    it("passes refs as the last argument of callFunction listeners", () => {
      let seen;

      parser.on("callFunction", (name, params, done, refs) => {
        if (name === "SUM") {
          seen = refs;
        }
      });
      value("SUM(A1:A2, 3)");

      expect(seen).toEqual([
        {
          sheetName: null,
          startRow: 0,
          startColumn: 0,
          endRow: 1,
          endColumn: 0,
        },
        null,
      ]);
    });

    it("lists the references of a formula with getReferences()", () => {
      expect(
        parser.getReferences(
          'SUM(A1:B2, Sheet2!C:C, 3:3) + LET(x1, 2, x1 + A5) + LEN("D4")'
        )
      ).toEqual([
        {
          sheetName: null,
          startRow: 0,
          startColumn: 0,
          endRow: 1,
          endColumn: 1,
        },
        {
          sheetName: "Sheet2",
          startRow: -1,
          startColumn: 2,
          endRow: -1,
          endColumn: 2,
        },
        {
          sheetName: null,
          startRow: 2,
          startColumn: -1,
          endRow: 2,
          endColumn: -1,
        },
        {
          sheetName: null,
          startRow: 4,
          startColumn: 0,
          endRow: 4,
          endColumn: 0,
        },
      ]);
      expect(parser.getReferences("LAMBDA(a1, a1 + b1)(1)")).toEqual([
        {
          sheetName: null,
          startRow: 0,
          startColumn: 1,
          endRow: 0,
          endColumn: 1,
        },
      ]);
      expect(() => parser.getReferences("SUM(")).toThrow();
    });
  });
});
