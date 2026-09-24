import Parser from "../../../src/parser";
import mathStats from "../../../src/functions/math-stats";

/**
 * Parser wired to an in-memory sheet: `cells` maps "A1"-style labels to
 * values; ranges arrive as 2D row-major arrays like they do from the core.
 */
function sheet(cells) {
  const parser = new Parser();
  const at = (row, col) => cells[`${String.fromCharCode(65 + col)}${row + 1}`];
  parser.on("callCellValue", ({ row, column }, _options, done) => {
    done(at(row.index, column.index));
  });
  parser.on("callRangeValue", (start, end, _options, done) => {
    const out = [];
    for (let r = start.row.index; r <= end.row.index; r++) {
      const line = [];
      for (let c = start.column.index; c <= end.column.index; c++) {
        line.push(at(r, c));
      }
      out.push(line);
    }
    done(out);
  });
  return (formula) => parser.parse(formula);
}

function column(letter, values) {
  const out = {};
  values.forEach((v, i) => {
    out[`${letter}${i + 1}`] = v;
  });
  return out;
}

const CELLS = {
  // Mixed types: number, numeric text, boolean, blank, text, number.
  ...column("A", [1, "2", true, null, "abc", 5]),
  ...column("B", [10, 20, 30, 40, 50, 60]),
  ...column("C", ["apple", "Banana", "cherry", "", null, "apple pie"]),
  // Error values arrive from the sheet as error strings.
  ...column("D", [1, "#DIV/0!", 3, "#N/A", 5, 6]),
  ...column("F", [10, 20, 20, 30, "x"]),
  // Criteria range and parallel values.
  ...column("G", [5, "5", 10, "Apple", true, -3, null, ""]),
  ...column("H", [1, 2, 3, 4, 5, 6, 7, 8]),
  ...column("I", [43831, 43830, 44000]),
  ...column("J", ["*", "a*", "x"]),
  // FORECAST sample from the Excel documentation.
  ...column("K", [6, 7, 9, 15, 21]),
  ...column("L", [20, 28, 31, 38, 40]),
  ...column("M", [5, 5, 5]),
  N1: 1,
  O1: 3,
  N2: 7,
  O2: 2,
  R1: 2,
  S1: 0,
  R2: 0,
  S2: 2,
  T1: "x",
};

describe("math-stats functions", () => {
  let calc;

  beforeEach(() => {
    calc = sheet(CELLS);
  });

  const ok = (formula, result) =>
    expect(calc(formula)).toMatchObject({ error: null, result });
  const close = (formula, result, precision = 9) =>
    expect(calc(formula)).toBeMatchCloseTo({ error: null, result }, precision);
  const err = (formula, error) =>
    expect(calc(formula)).toMatchObject({ error, result: null });

  describe("SUM / AVERAGE / COUNT family", () => {
    it("SUM ignores text and booleans in ranges but coerces typed arguments", () => {
      ok("SUM(A1:A6)", 6);
      ok('SUM(1, "2", TRUE)', 4);
      ok("SUM(B1:B6, 5)", 215);
      ok("SUM(A5)", 0);
      ok("SUM(C1:C6)", 0);
    });

    it("SUM propagates errors found in ranges", () => {
      err("SUM(D1:D6)", "#DIV/0!");
    });

    it("AVERAGE uses numbers only and returns #DIV/0! when there are none", () => {
      ok("AVERAGE(A1:A6)", 3);
      close('AVERAGE(1, "2", TRUE)', 4 / 3);
      err("AVERAGE(C1:C6)", "#DIV/0!");
    });

    it("AVERAGEA counts text as 0 and TRUE as 1", () => {
      close("AVERAGEA(A1:A6)", 1.4);
    });

    it("COUNT counts numbers in ranges and number-like typed arguments", () => {
      ok("COUNT(A1:A6)", 2);
      ok('COUNT(1, "2", TRUE, "x")', 3);
      ok("COUNT(D1:D6)", 4);
    });

    it("COUNTA counts every non-empty value, including errors and empty text", () => {
      ok("COUNTA(A1:A6)", 5);
      ok("COUNTA(C1:C6)", 5);
      ok("COUNTA(D1:D6)", 6);
    });

    it("COUNTBLANK counts empty cells and empty text", () => {
      ok("COUNTBLANK(C1:C6)", 2);
    });

    it("MIN/MAX skip non-numbers and return 0 for no numbers", () => {
      ok("MAX(A1:A6)", 5);
      ok("MIN(A1:A6)", 1);
      ok("MAX(C1:C6)", 0);
      ok("MIN(C1:C6)", 0);
      ok('MAX(-3, "-5")', -3);
      err("MAX(D1:D6)", "#DIV/0!");
    });

    it("MINA/MAXA treat text as 0", () => {
      ok("MINA(A1:A6)", 0);
      ok("MAXA(A1:A6)", 5);
      ok("MINA(G1:G8)", -3);
    });

    it("PRODUCT and SUMSQ", () => {
      ok("PRODUCT(A1:A6)", 5);
      ok("PRODUCT(C1:C6)", 0);
      ok("SUMSQ(A1:A6)", 26);
    });
  });

  describe("MEDIAN / MODE / LARGE / SMALL", () => {
    it("MEDIAN", () => {
      ok("MEDIAN(A1:A6)", 3);
      ok("MEDIAN(B1:B6)", 35);
      ok("MEDIAN(1, 2, 3, 4, 5)", 3);
      err("MEDIAN(C1:C6)", "#NUM!");
    });

    it("MODE returns the first mode and #N/A without repeats", () => {
      ok("MODE(1, 2, 2, 3, 3)", 2);
      ok("MODE.SNGL(3, 3, 2, 2, 1)", 3);
      err("MODE.SNGL(B1:B6)", "#N/A");
    });

    it("MODE.MULT returns a vertical array", () => {
      ok("MODE.MULT(1, 2, 2, 3, 3)", [[2], [3]]);
    });

    it("LARGE/SMALL validate k (rounded up)", () => {
      ok("LARGE(B1:B6, 2)", 50);
      ok("SMALL(B1:B6, 1)", 10);
      ok("SMALL(B1:B6, 1.5)", 20);
      err("LARGE(B1:B6, 7)", "#NUM!");
      err("LARGE(B1:B6, 0)", "#NUM!");
    });
  });

  describe("STDEV / VAR", () => {
    it("sample and population variants", () => {
      close("STDEV.S(B1:B6)", 18.708286933869708);
      close("STDEV(B1:B6)", 18.708286933869708);
      close("STDEV.P(B1:B6)", 17.07825127659933);
      close("STDEVP(B1:B6)", 17.07825127659933);
      close("VAR.S(B1:B6)", 350);
      close("VAR(B1:B6)", 350);
      close("VAR.P(B1:B6)", 291.6666666666667);
      close("VARP(B1:B6)", 291.6666666666667);
      close("STDEV(A1:A6)", 2.8284271247461903);
    });

    it("need two (sample) or one (population) values", () => {
      err("STDEV.S(1)", "#DIV/0!");
      err("VAR.S(1)", "#DIV/0!");
      err("VAR.P(C1:C6)", "#DIV/0!");
      ok("VAR.P(4)", 0);
    });

    it("A variants count text as 0 and TRUE as 1", () => {
      close("VARA(A1:A6)", 4.3);
      close("STDEVA(A1:A6)", Math.sqrt(4.3));
      close("VARPA(A1:A6)", 3.44);
      close("STDEVPA(A1:A6)", Math.sqrt(3.44));
    });
  });

  describe("RANK / PERCENTILE / QUARTILE", () => {
    it("RANK.EQ and RANK", () => {
      ok("RANK.EQ(20, B1:B6)", 5);
      ok("RANK.EQ(20, B1:B6, 1)", 2);
      ok("RANK(60, B1:B6)", 1);
      ok("RANK.EQ(20, F1:F5)", 2);
      err("RANK(7, B1:B6)", "#N/A");
    });

    it("RANK.AVG averages tied ranks", () => {
      ok("RANK.AVG(20, F1:F5)", 2.5);
      ok("RANK.AVG(20, F1:F5, 1)", 2.5);
      ok("RANK.AVG(30, F1:F5)", 1);
    });

    it("PERCENTILE.INC interpolates on (n-1)k", () => {
      ok("PERCENTILE.INC(B1:B6, 0.3)", 25);
      ok("PERCENTILE(B1:B6, 1)", 60);
      ok("PERCENTILE(B1:B6, 0)", 10);
      err("PERCENTILE.INC(B1:B6, 1.1)", "#NUM!");
      err("PERCENTILE.INC(C1:C6, 0.5)", "#NUM!");
    });

    it("PERCENTILE.EXC interpolates on (n+1)k", () => {
      ok("PERCENTILE.EXC(B1:B6, 0.5)", 35);
      ok("PERCENTILE.EXC(B1:B6, 0.25)", 17.5);
      err("PERCENTILE.EXC(B1:B6, 0.1)", "#NUM!");
      err("PERCENTILE.EXC(B1:B6, 0)", "#NUM!");
    });

    it("QUARTILE.INC / QUARTILE.EXC", () => {
      ok("QUARTILE.INC(B1:B6, 4)", 60);
      ok("QUARTILE(B1:B6, 1)", 22.5);
      ok("QUARTILE(B1:B6, 1.9)", 22.5);
      err("QUARTILE(B1:B6, 5)", "#NUM!");
      ok("QUARTILE.EXC(B1:B6, 1)", 17.5);
      err("QUARTILE.EXC(B1:B6, 0)", "#NUM!");
      err("QUARTILE.EXC(B1:B6, 4)", "#NUM!");
    });
  });

  describe("criteria functions", () => {
    it("numeric criteria match numbers and numeric text", () => {
      ok("COUNTIF(G1:G8, 5)", 2);
      ok('COUNTIF(G1:G8, "5")', 2);
      ok('COUNTIF(G1:G8, "=5")', 2);
    });

    it("comparison criteria only match numbers", () => {
      ok('COUNTIF(G1:G8, ">=5")', 2);
      ok('COUNTIF(G1:G8, "<0")', 1);
      ok('SUMIF(B1:B6, ">=30")', 180);
    });

    it("<> matches everything else, including blanks", () => {
      ok('COUNTIF(G1:G8, "<>5")', 6);
    });

    it("text criteria are case-insensitive and support wildcards", () => {
      ok('COUNTIF(G1:G8, "apple")', 1);
      ok('COUNTIF(G1:G8, "APP*")', 1);
      ok('COUNTIF(G1:G8, "?pple")', 1);
      ok('COUNTIF(G1:G8, "*")', 3);
      ok('COUNTIF(C1:C6, "apple*")', 2);
      ok('COUNTIF(J1:J3, "~*")', 1);
      ok('COUNTIF(J1:J3, "*~*")', 2);
      ok('COUNTIF(G1:G8, ">a")', 1);
    });

    it("blank criteria", () => {
      ok('COUNTIF(G1:G8, "")', 2);
      ok('COUNTIF(G1:G8, "=")', 1);
      ok('COUNTIF(G1:G8, "<>")', 7);
      // A reference to an empty cell behaves as 0.
      ok("COUNTIF(B1:B6, Z1)", 0);
    });

    it("boolean, error and date criteria", () => {
      ok("COUNTIF(G1:G8, TRUE)", 1);
      ok('COUNTIF(G1:G8, "true")', 1);
      ok('COUNTIF(D1:D6, "#N/A")', 1);
      ok('COUNTIF(I1:I3, ">=2020-01-01")', 2);
      ok('COUNTIF(I1:I3, ">=1/1/2020")', 2);
    });

    it("SUMIF with a separate sum range", () => {
      ok('SUMIF(G1:G8, ">0", H1:H8)', 4);
      ok('SUMIF(G1:G8, "apple", H1:H8)', 4);
      ok("SUMIF(G1:G8, 5, H1:H8)", 3);
    });

    it("SUMIFS / COUNTIFS combine criteria and require equal shapes", () => {
      ok('SUMIFS(H1:H8, G1:G8, ">0", G1:G8, "<10")', 1);
      ok('COUNTIFS(G1:G8, "<>", H1:H8, ">4")', 3);
      err('SUMIFS(H1:H8, G1:G8, ">0", B1:B6, ">0")', "#VALUE!");
      err('COUNTIFS(G1:G8, "<>", B1:B6, ">0")', "#VALUE!");
    });

    it("AVERAGEIF(S) returns #DIV/0! without matches", () => {
      ok('AVERAGEIF(G1:G8, ">0", H1:H8)', 2);
      ok('AVERAGEIFS(H1:H8, G1:G8, "<>5")', 5.5);
      err('AVERAGEIF(G1:G8, "zzz", H1:H8)', "#DIV/0!");
    });

    it("MAXIFS / MINIFS return 0 without matches", () => {
      ok('MAXIFS(H1:H8, G1:G8, "*")', 8);
      ok('MINIFS(H1:H8, G1:G8, "*")', 2);
      ok('MAXIFS(H1:H8, G1:G8, "none")', 0);
    });
  });

  describe("rounding", () => {
    it("ROUND rounds half away from zero without binary artefacts", () => {
      ok("ROUND(2.675, 2)", 2.68);
      ok("ROUND(1.005, 2)", 1.01);
      ok("ROUND(0.285, 2)", 0.29);
      ok("ROUND(-1.475, 2)", -1.48);
      ok("ROUND(-2.5, 0)", -3);
      ok("ROUND(1234.5, -2)", 1200);
      ok("ROUND(2.5, 0.9)", 3);
    });

    it("ROUNDUP / ROUNDDOWN", () => {
      ok("ROUNDUP(0.1 + 0.2, 1)", 0.3);
      ok("ROUNDUP(3.2, 0)", 4);
      ok("ROUNDUP(-3.2, 0)", -4);
      ok("ROUNDUP(31415.92654, -2)", 31500);
      ok("ROUNDDOWN(-3.9, 0)", -3);
      ok("ROUNDDOWN(3.14159, 3)", 3.141);
      ok("ROUNDDOWN(0.1 * 3, 1)", 0.3);
    });

    it("MROUND", () => {
      ok("MROUND(10, 3)", 9);
      ok("MROUND(-10, -3)", -9);
      ok("MROUND(1.3, 0.2)", 1.4);
      ok("MROUND(7.5, 5)", 10);
      ok("MROUND(5, 0)", 0);
      err("MROUND(5, -2)", "#NUM!");
    });

    it("MOD takes the sign of the divisor", () => {
      ok("MOD(3, 2)", 1);
      ok("MOD(-3, 2)", 1);
      ok("MOD(3, -2)", -1);
      ok("MOD(-3, -2)", -1);
      ok("MOD(6.2, 3.1)", 0);
      err("MOD(5, 0)", "#DIV/0!");
    });

    it("INT rounds down", () => {
      ok("INT(8.9)", 8);
      ok("INT(-8.9)", -9);
    });

    it("CEILING", () => {
      ok("CEILING(2.5, 1)", 3);
      ok("CEILING(-2.5, 2)", -2);
      ok("CEILING(-2.5, -2)", -4);
      ok("CEILING(0.234, 0.01)", 0.24);
      ok("CEILING(4.42, 0.05)", 4.45);
      ok("CEILING(2.5, 0)", 0);
      err("CEILING(2.5, -2)", "#NUM!");
    });

    it("FLOOR", () => {
      ok("FLOOR(3.7, 2)", 2);
      ok("FLOOR(-2.5, -2)", -2);
      ok("FLOOR(-2.5, 2)", -4);
      ok("FLOOR(0.3, 0.1)", 0.3);
      ok("FLOOR(1.58, 0.1)", 1.5);
      ok("FLOOR(0.234, 0.01)", 0.23);
      err("FLOOR(2.5, -2)", "#NUM!");
      err("FLOOR(2.5, 0)", "#DIV/0!");
    });

    it("CEILING.MATH / FLOOR.MATH", () => {
      ok("CEILING.MATH(24.3, 5)", 25);
      ok("CEILING.MATH(6.7)", 7);
      ok("CEILING.MATH(-8.1, 2)", -8);
      ok("CEILING.MATH(-5.5, 2, -1)", -6);
      ok("FLOOR.MATH(24.3, 5)", 20);
      ok("FLOOR.MATH(6.7)", 6);
      ok("FLOOR.MATH(-8.1, 2)", -10);
      ok("FLOOR.MATH(-5.5, 2, -1)", -4);
    });

    it("CEILING.PRECISE / ISO.CEILING / FLOOR.PRECISE ignore the sign of significance", () => {
      ok("CEILING.PRECISE(4.3)", 5);
      ok("CEILING.PRECISE(-4.3)", -4);
      ok("CEILING.PRECISE(4.3, -2)", 6);
      ok("CEILING.PRECISE(-4.3, -2)", -4);
      ok("ISO.CEILING(-4.6, -2)", -4);
      ok("FLOOR.PRECISE(-3.2, -1)", -4);
      ok("FLOOR.PRECISE(3.2, -1)", 3);
      ok("FLOOR.PRECISE(-3.2)", -4);
    });

    it("missing required arguments are #VALUE!", () => {
      err("ROUND(1)", "#VALUE!");
      err("MOD(1)", "#VALUE!");
      err("CEILING(1)", "#VALUE!");
    });
  });

  describe("SUMPRODUCT", () => {
    it("multiplies matching entries, treating non-numbers as 0", () => {
      ok("SUMPRODUCT(B1:B3, H1:H3)", 140);
      ok("SUMPRODUCT(A1:A3, B1:B3)", 10);
      ok("SUMPRODUCT(B1:B3)", 60);
    });

    it("requires arrays of the same shape", () => {
      err("SUMPRODUCT(B1:B3, H1:H2)", "#VALUE!");
      err("SUMPRODUCT(B1:B3, 2)", "#VALUE!");
    });

    it("propagates errors", () => {
      err("SUMPRODUCT(D1:D2, B1:B2)", "#DIV/0!");
    });
  });

  describe("FORECAST.LINEAR / PERCENTOF", () => {
    it("FORECAST.LINEAR (Excel documentation example)", () => {
      close("FORECAST.LINEAR(30, K1:K5, L1:L5)", 10.607253086419755);
      close("FORECAST(30, K1:K5, L1:L5)", 10.607253086419755);
    });

    it("FORECAST.LINEAR errors", () => {
      err("FORECAST.LINEAR(30, K1:K4, L1:L5)", "#N/A");
      err("FORECAST.LINEAR(1, K1:K3, M1:M3)", "#DIV/0!");
      err('FORECAST.LINEAR("x", K1:K5, L1:L5)', "#VALUE!");
    });

    it("PERCENTOF", () => {
      close("PERCENTOF(B1:B2, B1:B6)", 30 / 210);
      ok("PERCENTOF(A1:A6, A1:A6)", 1);
      err("PERCENTOF(B1, C1:C6)", "#DIV/0!");
    });
  });

  describe("SUBTOTAL / AGGREGATE", () => {
    it("SUBTOTAL", () => {
      ok("SUBTOTAL(9, B1:B6)", 210);
      ok("SUBTOTAL(109, B1:B6)", 210);
      ok("SUBTOTAL(1, B1:B6)", 35);
      ok("SUBTOTAL(2, D1:D6)", 4);
      ok("SUBTOTAL(9, B1:B2, B3)", 60);
      err("SUBTOTAL(12, B1:B6)", "#VALUE!");
      err("SUBTOTAL(9, D1:D6)", "#DIV/0!");
    });

    it("AGGREGATE ignores errors with options 2, 3, 6 and 7", () => {
      ok("AGGREGATE(9, 6, D1:D6)", 15);
      ok("AGGREGATE(9, 7, D1:D6)", 15);
      ok("AGGREGATE(9, 2, D1:D6)", 15);
      ok("AGGREGATE(9, 3, D1:D6)", 15);
      err("AGGREGATE(9, 0, D1:D6)", "#DIV/0!");
      err("AGGREGATE(9, 4, D1:D6)", "#DIV/0!");
    });

    it("AGGREGATE reference functions 1-13", () => {
      ok("AGGREGATE(1, 6, D1:D6)", 3.75);
      ok("AGGREGATE(2, 6, D1:D6)", 4);
      ok("AGGREGATE(3, 6, D1:D6)", 4);
      ok("AGGREGATE(3, 0, D1:D6)", 6);
      ok("AGGREGATE(4, 6, D1:D6)", 6);
      ok("AGGREGATE(5, 6, D1:D6)", 1);
      ok("AGGREGATE(6, 6, D1:D6)", 90);
      close("AGGREGATE(7, 6, B1:B6)", 18.708286933869708);
      close("AGGREGATE(8, 6, B1:B6)", 17.07825127659933);
      ok("AGGREGATE(9, 6, B1:B6)", 210);
      close("AGGREGATE(10, 6, B1:B6)", 350);
      close("AGGREGATE(11, 6, B1:B6)", 291.6666666666667);
      ok("AGGREGATE(12, 6, D1:D6)", 4);
      err("AGGREGATE(13, 6, D1:D6)", "#N/A");
    });

    it("AGGREGATE array functions 14-19 take k", () => {
      ok("AGGREGATE(14, 6, D1:D6, 2)", 5);
      ok("AGGREGATE(15, 6, D1:D6, 1)", 1);
      ok("AGGREGATE(16, 6, B1:B6, 0.3)", 25);
      ok("AGGREGATE(17, 6, B1:B6, 4)", 60);
      ok("AGGREGATE(18, 6, B1:B6, 0.5)", 35);
      ok("AGGREGATE(19, 6, B1:B6, 1)", 17.5);
      err("AGGREGATE(14, 6, B1:B6)", "#VALUE!");
    });

    it("AGGREGATE validates function and option numbers", () => {
      err("AGGREGATE(20, 0, B1:B6)", "#VALUE!");
      err("AGGREGATE(0, 0, B1:B6)", "#VALUE!");
      err("AGGREGATE(9, 8, B1:B6)", "#VALUE!");
    });
  });

  describe("matrices", () => {
    it("MMULT", () => {
      ok("MMULT(N1:O2, R1:S2)", [
        [2, 6],
        [14, 4],
      ]);
      ok("MMULT(2, 3)", [[6]]);
      err("MMULT(N1:O2, R1:R1)", "#VALUE!");
      err("MMULT(N1:O2, T1:U2)", "#VALUE!");
    });

    it("MDETERM", () => {
      expect(
        mathStats.MDETERM([
          [1, 3, 8, 5],
          [1, 3, 6, 1],
          [1, 1, 1, 0],
          [7, 3, 10, 2],
        ])
      ).toBeCloseTo(88, 9);
      expect(
        mathStats.MDETERM([
          [3, 6],
          [1, 1],
        ])
      ).toBeCloseTo(-3, 12);
      expect(
        mathStats.MDETERM([
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ])
      ).toBeCloseTo(0, 9);
      ok("MDETERM(N1:O2)", -19);
      expect(() => mathStats.MDETERM([[1, 2]])).toThrow("VALUE");
      expect(() =>
        mathStats.MDETERM([
          [1, null],
          [1, 2],
        ])
      ).toThrow("VALUE");
    });

    it("MINVERSE", () => {
      const inv = mathStats.MINVERSE([
        [4, -1],
        [2, 0],
      ]);
      expect(inv[0][0]).toBeCloseTo(0, 12);
      expect(inv[0][1]).toBeCloseTo(0.5, 12);
      expect(inv[1][0]).toBeCloseTo(-1, 12);
      expect(inv[1][1]).toBeCloseTo(2, 12);

      const inv3 = mathStats.MINVERSE([
        [1, 2, 1],
        [3, 4, -1],
        [0, 2, 0],
      ]);
      const expected = [
        [0.25, 0.25, -0.75],
        [0, 0, 0.5],
        [0.75, -0.25, -0.25],
      ];
      expected.forEach((row, i) =>
        row.forEach((v, j) => expect(inv3[i][j]).toBeCloseTo(v, 12))
      );

      expect(() =>
        mathStats.MINVERSE([
          [1, 2],
          [2, 4],
        ])
      ).toThrow("NUM");
      expect(() => mathStats.MINVERSE([[1, 2]])).toThrow("VALUE");
    });

    it("MUNIT", () => {
      ok("MUNIT(3)", [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]);
      err("MUNIT(0)", "#VALUE!");
    });
  });
});
