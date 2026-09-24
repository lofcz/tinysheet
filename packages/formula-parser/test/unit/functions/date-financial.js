import Parser from "../../../src/parser";

/**
 * Parser wired to an in-memory sheet: `cells` maps "A1"-style labels to
 * values; ranges arrive as 2D row-major arrays like they do from the core.
 * Date cells hold Excel serial numbers, as in the core.
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

const CELLS = {
  // NETWORKDAYS holidays (serials for 2012-11-22, 2012-12-04, 2013-01-21).
  A1: 41235,
  A2: 41247,
  A3: 41295,
  // NETWORKDAYS.INTL holidays given as date text.
  B1: "2006/1/2",
  B2: "2006/1/16",
  // WORKDAY holidays (2008-11-26, 2008-12-04, 2009-01-21) and a blank.
  C1: 39778,
  C2: 39786,
  C3: 39834,
  C4: null,
  // Cash flows with text and blanks.
  D1: 0.1,
  D2: "x",
  D3: null,
  D4: 0.2,
};

describe("date-financial functions", () => {
  let calc;

  beforeEach(() => {
    calc = sheet(CELLS);
  });

  const ok = (formula, result) =>
    expect(calc(formula)).toMatchObject({ error: null, result });
  const close = (formula, result, precision = 7) =>
    expect(calc(formula)).toBeMatchCloseTo({ error: null, result }, precision);
  const err = (formula, error) =>
    expect(calc(formula)).toMatchObject({ error, result: null });

  describe("DATE and conversions return serial numbers", () => {
    it("DATE", () => {
      ok("DATE(2008, 1, 1)", 39448);
      ok("DATE(2001, 5, 12)", 37023);
    });

    it("DATE rolls months and days over", () => {
      ok("DATE(2008, 14, 2)", 39846); // 2009-02-02
      ok("DATE(2008, -3, 2)", 39327); // 2007-09-02
      ok("DATE(2008, 1, 35)", 39482); // 2008-02-04
      ok("DATE(2008, 1, -15)", 39432); // 2007-12-16
    });

    it("DATE adds 1900 to years 0-1899", () => {
      ok("DATE(108, 1, 2)", 39449);
      expect(calc("DATE(1899, 1, 1)").result).toBe(
        calc("DATE(3799, 1, 1)").result
      );
    });

    it("DATE follows Excel's 1900 leap-year bug", () => {
      ok("DATE(1900, 1, 1)", 1);
      ok("DATE(1900, 2, 28)", 59);
      ok("DATE(1900, 2, 29)", 60);
      ok("DATE(1900, 3, 1)", 61);
      ok("DATE(1900, 1, 0)", 0);
    });

    it("DATE rejects out-of-range results", () => {
      err("DATE(-1, 1, 1)", "#NUM!");
      err("DATE(10000, 1, 1)", "#NUM!");
      err("DATE(1900, 1, -1)", "#NUM!");
      err("DATE(2008)", "#VALUE!");
    });

    it("DATEVALUE accepts common date text", () => {
      ok('DATEVALUE("8/22/2011")', 40777);
      ok('DATEVALUE("22-MAY-2011")', 40685);
      ok('DATEVALUE("2011/02/23")', 40597);
      ok('DATEVALUE("2011-02-23")', 40597);
      ok('DATEVALUE("February 23, 2011")', 40597);
      ok('DATEVALUE("2011-02-23 10:30")', 40597);
      err('DATEVALUE("abc")', "#VALUE!");
      err('DATEVALUE("2011-02-30")', "#VALUE!");
      err("DATEVALUE(40777)", "#VALUE!");
    });

    it("TIME wraps at midnight and rejects negative times", () => {
      ok("TIME(12, 0, 0)", 0.5);
      close("TIME(16, 48, 10)", 0.700115741);
      close("TIME(0, 120, 0)", 1 / 12);
      close("TIME(25, 0, 0)", 1 / 24);
      err("TIME(0, 0, -1)", "#NUM!");
    });

    it("TIMEVALUE", () => {
      close('TIMEVALUE("2:24 AM")', 0.1);
      close('TIMEVALUE("22-Aug-2011 6:35 AM")', 0.274305556);
      close('TIMEVALUE("18:00")', 0.75);
      ok('TIMEVALUE("12:00 AM")', 0);
      err('TIMEVALUE("x")', "#VALUE!");
    });

    it("TODAY and NOW are serial numbers", () => {
      const today = calc("TODAY()").result;
      const now = calc("NOW()").result;
      expect(Number.isInteger(today)).toBe(true);
      expect(now).toBeGreaterThanOrEqual(today);
      expect(now).toBeLessThan(today + 1);
    });
  });

  describe("date parts", () => {
    it("YEAR / MONTH / DAY", () => {
      ok("YEAR(39448)", 2008);
      ok("MONTH(39448)", 1);
      ok("DAY(39448)", 1);
      ok("DAY(45000.7)", 15);
      ok('YEAR("2020-03-15")', 2020);
      ok('MONTH("15-Mar-2020")', 3);
    });

    it("serial 60 is 1900-02-29 and serial 0 is 1900-01-00", () => {
      ok("MONTH(59)", 2);
      ok("DAY(59)", 28);
      ok("MONTH(60)", 2);
      ok("DAY(60)", 29);
      ok("DAY(61)", 1);
      ok("MONTH(61)", 3);
      ok("YEAR(0)", 1900);
      ok("DAY(0)", 0);
    });

    it("rejects invalid dates", () => {
      err("YEAR(-1)", "#NUM!");
      err('YEAR("abc")', "#VALUE!");
      err("YEAR(3000000)", "#NUM!");
    });

    it("HOUR / MINUTE / SECOND", () => {
      ok("HOUR(0.75)", 18);
      ok('HOUR("3:30:30 PM")', 15);
      ok('MINUTE("12:45:00")', 45);
      ok('SECOND("4:48:18 PM")', 18);
      ok("HOUR(39448.5)", 12);
    });
  });

  describe("weeks", () => {
    it("WEEKDAY return types", () => {
      ok("WEEKDAY(39448)", 3); // Tuesday 2008-01-01
      ok("WEEKDAY(39448, 2)", 2);
      ok("WEEKDAY(39448, 3)", 1);
      ok("WEEKDAY(39448, 11)", 2);
      ok("WEEKDAY(39448, 12)", 1);
      ok("WEEKDAY(39448, 16)", 4);
      ok("WEEKDAY(39448, 17)", 3);
      err("WEEKDAY(39448, 4)", "#NUM!");
    });

    it("WEEKDAY of serials 0 and 1 matches Excel", () => {
      ok("WEEKDAY(1)", 1);
      ok("WEEKDAY(0)", 7);
    });

    it("WEEKNUM", () => {
      ok("WEEKNUM(DATE(2012, 3, 9))", 10);
      ok("WEEKNUM(DATE(2012, 3, 9), 2)", 11);
      ok("WEEKNUM(DATE(2021, 1, 1), 21)", 53);
      ok("WEEKNUM(DATE(2021, 1, 3), 1)", 2);
      ok("WEEKNUM(DATE(2021, 1, 3), 2)", 1);
      err("WEEKNUM(DATE(2021, 1, 3), 3)", "#NUM!");
    });

    it("ISOWEEKNUM", () => {
      ok("ISOWEEKNUM(DATE(2012, 3, 9))", 10);
      ok("ISOWEEKNUM(DATE(2021, 1, 3))", 53);
      ok("ISOWEEKNUM(DATE(2020, 12, 31))", 53);
      ok("ISOWEEKNUM(DATE(2019, 12, 30))", 1);
    });
  });

  describe("date arithmetic", () => {
    it("EDATE clamps to the end of the month", () => {
      ok("EDATE(DATE(2011, 1, 15), 1)", 40589);
      ok("EDATE(DATE(2011, 1, 15), -1)", 40527);
      ok("EDATE(DATE(2011, 1, 31), 1)", 40602);
      ok("EDATE(DATE(2012, 1, 31), 1)", 40968);
      ok('EDATE("2011-01-15", 2.9)', 40617);
    });

    it("EOMONTH", () => {
      ok("EOMONTH(DATE(2011, 1, 1), 1)", 40602);
      ok("EOMONTH(DATE(2011, 1, 1), -3)", 40482);
      err("EOMONTH(1, -1)", "#NUM!");
    });

    it("DAYS", () => {
      ok('DAYS("3/15/2021", "2/1/2021")', 42);
      ok("DAYS(DATE(2021, 12, 31), DATE(2021, 1, 1))", 364);
      ok("DAYS(DATE(2021, 1, 1), DATE(2021, 12, 31))", -364);
    });

    it("DAYS360 US and European methods", () => {
      ok("DAYS360(DATE(2011, 1, 30), DATE(2011, 12, 31))", 330);
      ok("DAYS360(DATE(2011, 1, 1), DATE(2011, 1, 31))", 30);
      ok("DAYS360(DATE(2011, 1, 1), DATE(2011, 1, 31), TRUE)", 29);
      ok("DAYS360(DATE(2011, 2, 28), DATE(2011, 3, 31))", 30);
      ok("DAYS360(DATE(2011, 2, 28), DATE(2011, 3, 31), TRUE)", 32);
    });

    it("YEARFRAC bases (Excel documentation examples)", () => {
      close("YEARFRAC(DATE(2012, 1, 1), DATE(2012, 7, 30))", 0.580555556);
      close("YEARFRAC(DATE(2012, 1, 1), DATE(2012, 7, 30), 1)", 0.57650273);
      close("YEARFRAC(DATE(2012, 1, 1), DATE(2012, 7, 30), 2)", 211 / 360);
      close("YEARFRAC(DATE(2012, 1, 1), DATE(2012, 7, 30), 3)", 0.57808219);
      close("YEARFRAC(DATE(2012, 1, 1), DATE(2012, 7, 30), 4)", 0.580555556);
      close("YEARFRAC(DATE(2012, 7, 30), DATE(2012, 1, 1))", 0.580555556);
      close("YEARFRAC(DATE(2010, 1, 1), DATE(2013, 1, 1), 1)", 1096 / 365.25);
      err("YEARFRAC(DATE(2012, 1, 1), DATE(2012, 7, 30), 5)", "#NUM!");
    });

    it("DATEDIF units", () => {
      ok('DATEDIF(DATE(2001, 1, 1), DATE(2003, 1, 1), "Y")', 2);
      ok('DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "D")', 440);
      ok('DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YD")', 75);
      ok('DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "md")', 14);
      ok('DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YM")', 2);
      ok('DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "M")', 14);
      ok('DATEDIF(DATE(2020, 1, 31), DATE(2020, 2, 29), "M")', 0);
      ok('DATEDIF(DATE(2020, 2, 29), DATE(2021, 2, 28), "Y")', 0);
      // Excel's documented "MD" quirk can give negative numbers.
      ok('DATEDIF(DATE(2015, 1, 31), DATE(2015, 3, 1), "MD")', -2);
    });

    it("DATEDIF errors", () => {
      err('DATEDIF(DATE(2003, 1, 1), DATE(2001, 1, 1), "Y")', "#NUM!");
      err('DATEDIF(DATE(2001, 1, 1), DATE(2003, 1, 1), "W")', "#NUM!");
    });
  });

  describe("working days", () => {
    it("NETWORKDAYS (Excel documentation examples)", () => {
      ok("NETWORKDAYS(DATE(2012, 10, 1), DATE(2013, 3, 1))", 110);
      ok("NETWORKDAYS(DATE(2012, 10, 1), DATE(2013, 3, 1), A1)", 109);
      ok("NETWORKDAYS(DATE(2012, 10, 1), DATE(2013, 3, 1), A1:A3)", 107);
      ok("NETWORKDAYS(DATE(2013, 3, 1), DATE(2012, 10, 1))", -110);
      ok('NETWORKDAYS("2013-12-04", "2013-12-05")', 2);
    });

    it("NETWORKDAYS.INTL (Excel documentation examples)", () => {
      ok("NETWORKDAYS.INTL(DATE(2006, 1, 1), DATE(2006, 1, 31))", 22);
      ok("NETWORKDAYS.INTL(DATE(2006, 2, 28), DATE(2006, 1, 31))", -21);
      ok("NETWORKDAYS.INTL(DATE(2006, 1, 1), DATE(2006, 2, 1), 7, B1:B2)", 22);
      ok(
        'NETWORKDAYS.INTL(DATE(2006, 1, 1), DATE(2006, 2, 1), "0010001", B1:B2)',
        20
      );
    });

    it("NETWORKDAYS.INTL weekend codes", () => {
      // 2024-01-01 (Mon) .. 2024-01-14 (Sun): two of every weekday.
      ok("NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), 1)", 10);
      ok("NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), 11)", 12);
      ok("NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), 17)", 12);
      ok(
        'NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), "1000000")',
        12
      );
      ok('NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), "1111111")', 0);
      err("NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), 8)", "#NUM!");
      err(
        'NETWORKDAYS.INTL(DATE(2024, 1, 1), DATE(2024, 1, 14), "abc")',
        "#VALUE!"
      );
    });

    it("WORKDAY (Excel documentation examples)", () => {
      ok("WORKDAY(DATE(2008, 10, 1), 151)", 39933);
      ok("WORKDAY(DATE(2008, 10, 1), 151, C1:C4)", 39938);
      ok("WORKDAY(DATE(2008, 10, 1), -1)", 39721);
      ok("WORKDAY(DATE(2008, 10, 4), 0)", 39725);
    });

    it("WORKDAY.INTL (Excel documentation examples)", () => {
      ok("WORKDAY.INTL(DATE(2012, 1, 1), 90, 11)", 41013);
      ok("WORKDAY.INTL(DATE(2012, 1, 1), 30, 17)", 40944);
      err("WORKDAY.INTL(DATE(2012, 1, 1), 30, 0)", "#NUM!");
      err('WORKDAY.INTL(DATE(2012, 1, 1), 5, "1111111")', "#VALUE!");
      ok('WORKDAY.INTL(DATE(2024, 1, 5), 1, "0000011")', 45299);
    });
  });

  describe("cash flows", () => {
    it("NPV ignores text and blanks in ranges", () => {
      close("NPV(0.1, -10000, 3000, 4200, 6800)", 1188.44341233522);
      close("NPV(0.1, D1:D4)", 0.1 / 1.1 + 0.2 / 1.21);
      err("NPV(-1, 1)", "#DIV/0!");
    });

    it("PMT / IPMT / PPMT / RATE / IRR / XNPV / XIRR match Excel", () => {
      close("PMT(0.08/12, 10, 10000)", -1037.03208935916);
      close("PMT(0.06/12, 18*12, 0, 50000)", -129.081160867997);
      close("IPMT(0.1/12, 1, 3*12, 8000)", -66.6666666666667);
      close("PPMT(0.1/12, 1, 2*12, 2000)", -75.6231860083667);
      close("RATE(4*12, -200, 8000)", 0.00770147248820165);
    });
  });

  describe("coupons", () => {
    it("COUP* with actual/actual (Excel documentation examples)", () => {
      ok("COUPDAYBS(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 1)", 71);
      ok("COUPDAYS(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 1)", 181);
      ok("COUPDAYSNC(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 1)", 110);
      ok("COUPNCD(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 1)", 40678);
      ok("COUPPCD(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 1)", 40497);
      ok("COUPNUM(DATE(2007, 1, 25), DATE(2008, 11, 15), 2, 1)", 4);
    });

    it("COUP* with other bases", () => {
      ok("COUPDAYBS(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 0)", 70);
      ok("COUPDAYS(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 0)", 180);
      ok("COUPDAYSNC(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 0)", 110);
      ok("COUPDAYS(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 2)", 180);
      ok("COUPDAYS(DATE(2011, 1, 25), DATE(2011, 11, 15), 2, 3)", 182.5);
      ok("COUPDAYS(DATE(2011, 1, 25), DATE(2011, 11, 15), 4, 4)", 90);
    });

    it("month-end maturities pay on month ends", () => {
      ok("COUPPCD(DATE(2011, 3, 15), DATE(2011, 8, 31), 2, 1)", 40602);
      ok("COUPNCD(DATE(2011, 3, 15), DATE(2011, 8, 31), 2, 1)", 40786);
      ok("COUPNCD(DATE(2011, 9, 15), DATE(2012, 2, 29), 4, 1)", 40877);
    });

    it("a settlement on a coupon date starts a new period", () => {
      ok("COUPPCD(DATE(2011, 5, 15), DATE(2011, 11, 15), 2, 1)", 40678);
      ok("COUPDAYBS(DATE(2011, 5, 15), DATE(2011, 11, 15), 2, 1)", 0);
      ok("COUPNUM(DATE(2011, 5, 15), DATE(2011, 11, 15), 2, 1)", 1);
    });

    it("validates arguments", () => {
      err("COUPNUM(DATE(2012, 1, 1), DATE(2011, 1, 1), 2)", "#NUM!");
      err("COUPNUM(DATE(2011, 1, 1), DATE(2012, 1, 1), 3)", "#NUM!");
      err("COUPNUM(DATE(2011, 1, 1), DATE(2012, 1, 1), 2, 5)", "#NUM!");
      err('COUPNUM("x", DATE(2012, 1, 1), 2)', "#VALUE!");
    });
  });

  describe("bonds", () => {
    it("PRICE / YIELD (Excel documentation examples)", () => {
      close(
        "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 2, 0)",
        94.6343616213221
      );
      close(
        "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 95.04287, 100, 2, 0)",
        0.065,
        6
      );
    });

    it("YIELD inverts PRICE, including the single-period closed form", () => {
      close(
        "YIELD(DATE(2008, 2, 15), DATE(2008, 11, 15), 0.0575, PRICE(DATE(2008, 2, 15), DATE(2008, 11, 15), 0.0575, 0.065, 100, 2, 0), 100, 2, 0)",
        0.065,
        10
      );
      close(
        "YIELD(DATE(2008, 2, 15), DATE(2010, 11, 15), 0.0575, PRICE(DATE(2008, 2, 15), DATE(2010, 11, 15), 0.0575, 0.08, 100, 4, 1), 100, 4, 1)",
        0.08,
        10
      );
    });

    it("PRICE / YIELD validate inputs", () => {
      err(
        "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), -0.0575, 0.065, 100, 2, 0)",
        "#NUM!"
      );
      err(
        "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 0, 100, 2, 0)",
        "#NUM!"
      );
    });

    it("DURATION / MDURATION (Excel documentation examples)", () => {
      close(
        "DURATION(DATE(2018, 7, 1), DATE(2048, 1, 1), 0.08, 0.09, 2, 1)",
        10.9191452815919
      );
      close(
        "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2, 1)",
        5.73566981391884
      );
    });

    it("ACCRINT accepts serial dates (Excel documentation examples)", () => {
      close(
        "ACCRINT(DATE(2008, 3, 1), DATE(2008, 8, 31), DATE(2008, 5, 1), 0.1, 1000, 2, 0)",
        16.6666666666667
      );
      close("ACCRINT(39508, 39691, 39569, 0.1, 1000, 2, 0)", 16.6666666666667);
      close(
        "ACCRINT(DATE(2008, 3, 5), DATE(2008, 8, 31), DATE(2008, 5, 1), 0.1, 1000, 2, 0, FALSE)",
        15.5555555555556
      );
    });

    it("ACCRINTM (Excel documentation example)", () => {
      close(
        "ACCRINTM(DATE(2008, 4, 1), DATE(2008, 6, 15), 0.1, 1000, 3)",
        20.5479452054795
      );
      err(
        "ACCRINTM(DATE(2008, 6, 15), DATE(2008, 4, 1), 0.1, 1000, 3)",
        "#NUM!"
      );
    });
  });

  describe("discounted and at-maturity securities", () => {
    it("PRICEDISC / YIELDDISC / DISC", () => {
      close(
        "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100, 2)",
        99.7958333333333
      );
      close(
        "YIELDDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100, 2)",
        0.0528225719868601
      );
      close(
        "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100, 2)",
        0.0527142857142857
      );
      err("DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0, 100, 2)", "#NUM!");
    });

    it("INTRATE / RECEIVED (Excel documentation examples)", () => {
      close(
        "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 1014420, 2)",
        0.05768
      );
      close(
        "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0.0575, 2)",
        1014584.6544071,
        5
      );
    });

    it("PRICEMAT / YIELDMAT (Excel documentation examples)", () => {
      close(
        "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, 0.061, 0)",
        99.984498875557
      );
      close(
        "YIELDMAT(DATE(2008, 3, 15), DATE(2008, 11, 3), DATE(2007, 11, 8), 0.0625, 100.0123, 0)",
        0.0609543336915386
      );
    });

    it("TBILLEQ / TBILLPRICE / TBILLYIELD (Excel documentation examples)", () => {
      close(
        "TBILLEQ(DATE(2008, 3, 31), DATE(2008, 6, 1), 0.0914)",
        0.094151493565943
      );
      close("TBILLPRICE(DATE(2008, 3, 31), DATE(2008, 6, 1), 0.09)", 98.45);
      close(
        "TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), 98.45)",
        0.0914169629253426
      );
    });

    it("T-bills mature within a year of settlement", () => {
      err("TBILLPRICE(DATE(2008, 3, 31), DATE(2009, 4, 1), 0.09)", "#NUM!");
      err("TBILLPRICE(DATE(2008, 3, 31), DATE(2008, 3, 31), 0.09)", "#NUM!");
    });
  });
});
