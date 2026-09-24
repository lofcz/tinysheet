import Parser from "../../../../src/parser";
import { attachSheet } from "./sheet-fixture.mjs";

describe(".parse() Excel operator semantics", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    attachSheet(parser);
  });

  const ok = (formula, result) =>
    expect(parser.parse(formula)).toEqual({ error: null, result });
  const err = (formula, error) =>
    expect(parser.parse(formula)).toEqual({ error, result: null });

  describe("precedence", () => {
    it("binds negation tighter than ^ (-2^2 = 4)", () => {
      ok("-2^2", 4);
      ok("0-2^2", -4);
      ok("-(2^2)", -4);
      ok("2^-2", 0.25);
      ok("--3", 3);
    });

    it("evaluates ^ left to right", () => {
      ok("2^3^2", 64);
    });

    it("applies % as a postfix operator above ^", () => {
      ok("50%", 0.5);
      ok("200%%", 0.02);
      ok("50%^2", 0.25);
      ok("-5%", -0.05);
      ok("A2%", 0.02);
      ok("(1+1)%", 0.02);
    });

    it("puts * and / above + and -", () => {
      ok("1+2*3", 7);
      ok("10-4/2", 8);
      ok("2*3^2", 18);
    });

    it("puts & below arithmetic", () => {
      ok("1+2&3", "33");
      ok('"a"&2*3', "a6");
      ok("2^2&2", "42");
    });

    it("puts comparisons below & and evaluates them left to right", () => {
      ok('"a"&"b"="ab"', true);
      ok("1+1=2", true);
      ok("1<2=TRUE", true);
      ok("3>2>1", true); // TRUE > 1: logicals sort after numbers
      ok("1<2<1", false);
      ok("1=1=TRUE", true);
    });
  });

  describe("arithmetic coercion", () => {
    it("coerces numeric text", () => {
      ok('"1"+1', 2);
      ok('"3"*"4"', 12);
      ok('" 7 "+0', 7);
      ok('"1e2"+0', 100);
      ok('"1,234.5"+0', 1234.5);
      ok('"50%"*2', 1);
      ok('"$5"+1', 6);
      ok('"(5)"+0', -5);
    });

    it("coerces date and time text to serial numbers", () => {
      ok('"2024-01-02"+0', 45293);
      ok('"1/2/2024"+0', 45293);
      ok('"12:00"*2', 1);
      ok('"6:00 PM"*4', 3);
    });

    it("rejects non-numeric text with #VALUE!", () => {
      err('"abc"+1', "#VALUE!");
      err('""+1', "#VALUE!");
      err('-"abc"', "#VALUE!");
      err('"1/2/3/4"*1', "#VALUE!");
    });

    it("treats logicals as 1 and 0", () => {
      ok("TRUE+1", 2);
      ok("TRUE*TRUE", 1);
      ok("FALSE*5", 0);
      ok("-TRUE", -1);
    });

    it("treats blank cells as 0 and empty text", () => {
      ok("C1+5", 5);
      ok("C1*3", 0);
      ok('C1&"x"', "x");
      ok("-C1", 0);
    });

    it("keeps unary plus as a no-op like Excel", () => {
      ok('+"abc"', "abc");
      ok("+TRUE", true);
      ok("+B1", "x");
    });

    it("reports division by zero and invalid numbers", () => {
      err("1/0", "#DIV/0!");
      err("0/0", "#DIV/0!");
      err("1/C1", "#DIV/0!");
      err("0^0", "#NUM!");
      err("0^-1", "#DIV/0!");
      err("(-8)^(1/3)", "#NUM!");
      err("1E308*10", "#NUM!");
    });

    it("parses scientific number literals", () => {
      ok("1E3+1", 1001);
      ok("1.5e-2*100", 1.5);
      ok(".5+.25", 0.75);
    });
  });

  describe("concatenation", () => {
    it("formats numbers like Excel's General format", () => {
      ok('0.1+0.2&""', "0.3");
      ok('1/3&""', "0.333333333333333");
      ok('123456789&""', "123456789");
      ok('1E+20&""', "1E+20");
      ok('123456789012345678&""', "1.23456789012346E+17");
      ok('0.000000000123&""', "1.23E-10");
      ok('-0.5&""', "-0.5");
    });

    it("formats logicals as TRUE and FALSE", () => {
      ok('TRUE&""', "TRUE");
      ok('"is "&(1>2)', "is FALSE");
    });

    it("unescapes doubled quotes in string literals", () => {
      ok('"say ""hi"""', 'say "hi"');
      ok('""""', '"');
    });
  });

  describe("comparison", () => {
    it("compares text case-insensitively", () => {
      ok('"a"="A"', true);
      ok('"apple"<"Banana"', true);
      ok('"ABC"<>"abc"', false);
      ok('"b">"A"', true);
    });

    it("orders numbers < text < logicals", () => {
      ok('1<"0"', true);
      ok('"z"<TRUE', true);
      ok("FALSE>1000", true);
      ok("FALSE<TRUE", true);
      ok('"1"=1', false);
    });

    it("compares blanks as 0, empty text or FALSE", () => {
      ok("C1=0", true);
      ok('C1=""', true);
      ok("C1=FALSE", true);
      ok("C1<1", true);
      ok("C1>-1", true);
      ok('C1<"a"', true);
    });

    it("compares numbers with 15 significant digits", () => {
      ok("0.1+0.2=0.3", true);
      ok("1+1E-16=1", true);
      ok("10 > 10.00001", false);
    });
  });

  describe("error propagation", () => {
    it("returns the first error in evaluation order", () => {
      err("1/0+#N/A", "#DIV/0!");
      err("#N/A+1/0", "#N/A");
      err("#N/A&1/0", "#N/A");
      err("SUM(1/0, #N/A)", "#DIV/0!");
      err('"a"+#REF!', "#REF!");
    });

    it("turns error text read from cells into error values", () => {
      err("C2", "#N/A");
      err("C2+1", "#N/A");
      err("C3*0", "#DIV/0!");
      err("SUM(C1:C3)", "#N/A");
      ok("ISERROR(C3)", true);
      ok("ISNA(C2)", true);
      ok("IFERROR(C2, 0)", 0);
    });

    it("passes error values to error-tolerant functions", () => {
      ok("ISERROR(1/0)", true);
      ok("ISERR(#N/A)", false);
      ok("ISNUMBER(1/0)", false);
      ok("COUNT(1, 1/0, 3)", 2);
      ok("COUNTA(1, 1/0, 3)", 3);
    });

    it("keeps syntax errors as #ERROR!", () => {
      err("1+", "#ERROR!");
      err("(1", "#ERROR!");
      err("1 2", "#ERROR!");
      err("SUM(1,2", "#ERROR!");
    });
  });

  describe("missing arguments", () => {
    it("passes omitted arguments as undefined", () => {
      ok("ROUND(1.5,)", 2);
      ok("SUM(1,,2)", 3);
    });

    it("keeps f() as a call without arguments", () => {
      const calls = [];

      parser.setFunction("ARGS", (params) => {
        calls.push(params);

        return params.length;
      });

      ok("ARGS()", 0);
      ok("ARGS(,)", 2);
      expect(calls[1]).toEqual([undefined, undefined]);
    });
  });

  describe("names and references", () => {
    it("treats identifiers beyond the grid as names", () => {
      err("XFE1", "#NAME?");
      err("ABCD1", "#NAME?");
      err("A0", "#NAME?");

      parser.setVariable("XFE1", 7);
      parser.setVariable("rate2x", 3);

      ok("XFE1*2", 14);
      ok("rate2x+1", 4);
    });

    it("still reads the last grid cell", () => {
      const labels = [];

      parser.on("callCellValue", (cell) => labels.push(cell.label));
      parser.parse("XFD1048576");

      expect(labels).toContain("XFD1048576");
    });

    it("strips the _xlfn. / _xlws. prefixes of imported functions", () => {
      ok("_xlfn.SUM(1,2)", 3);
      ok("_xlws.SUM(1,2)", 3);
    });

    it("accepts unicode letters in names", () => {
      parser.setVariable("částka", 5);

      ok("částka*2", 10);
      ok("LET(délka, 3, délka^2)", 9);
    });
  });
});
