import {
  addMonthsToSerial,
  addWorkdaysToSerial,
  classifyFillValue,
  dateToSerial,
  generateFillSeries,
  linearTrend,
  serialToDateParts,
  setCustomFillLists,
} from "../../src/modules/autofill";

const num = (v, fa = "General") => ({ v, m: String(v), ct: { fa, t: "n" } });
const text = (v) => ({ v, m: v, ct: { fa: "General", t: "g" } });
const date = (y, m, d, fa = "yyyy-MM-dd") => ({
  v: dateToSerial(y, m - 1, d),
  ct: { fa, t: "d" },
});
const time = (h, min = 0) => ({
  v: (h * 60 + min) / 1440,
  ct: { fa: "hh:mm", t: "d" },
});

const values = (cells) => cells.map((c) => (c == null ? null : c.v));
const ymd = (serial) => {
  const p = serialToDateParts(serial);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(
    2,
    "0"
  )}`;
};
const dates = (cells) => cells.map((c) => ymd(c.v));

describe("date serial helpers (Excel 1900 system)", () => {
  test("round-trips calendar dates", () => {
    expect(dateToSerial(2024, 0, 1)).toBe(45292);
    expect(serialToDateParts(45292)).toMatchObject({ y: 2024, m: 0, d: 1 });
    // Excel's fictitious 1900-02-29 is serial 60
    expect(serialToDateParts(59)).toMatchObject({ y: 1900, m: 1, d: 28 });
    expect(serialToDateParts(61)).toMatchObject({ y: 1900, m: 2, d: 1 });
    expect(dateToSerial(1900, 2, 1)).toBe(61);
    expect(dateToSerial(1900, 0, 1)).toBe(1);
  });

  test("EDATE clamps to the end of the month", () => {
    const jan31 = dateToSerial(2024, 0, 31);
    expect(ymd(addMonthsToSerial(jan31, 1))).toBe("2024-02-29");
    expect(ymd(addMonthsToSerial(jan31, 2))).toBe("2024-03-31");
    expect(ymd(addMonthsToSerial(jan31, -2))).toBe("2023-11-30");
    expect(ymd(addMonthsToSerial(jan31, 13))).toBe("2025-02-28");
  });

  test("WORKDAY skips weekends", () => {
    const fri = dateToSerial(2024, 0, 5);
    expect(ymd(addWorkdaysToSerial(fri, 1))).toBe("2024-01-08");
    expect(ymd(addWorkdaysToSerial(fri, 5))).toBe("2024-01-12");
    expect(ymd(addWorkdaysToSerial(fri, 6))).toBe("2024-01-15");
    expect(ymd(addWorkdaysToSerial(fri, -5))).toBe("2023-12-29");
  });
});

describe("numbers", () => {
  test("a single number is copied; Ctrl makes it count up", () => {
    expect(values(generateFillSeries([num(5)], 3))).toEqual([5, 5, 5]);
    expect(values(generateFillSeries([num(5)], 3, { ctrl: true }))).toEqual([
      6, 7, 8,
    ]);
  });

  test("two or more numbers extend the linear step", () => {
    expect(values(generateFillSeries([num(1), num(2)], 3))).toEqual([3, 4, 5]);
    expect(values(generateFillSeries([num(1), num(3)], 2))).toEqual([5, 7]);
    expect(values(generateFillSeries([num(10), num(8)], 3))).toEqual([6, 4, 2]);
    expect(values(generateFillSeries([num(0.1), num(0.2)], 2))).toEqual([
      0.3, 0.4,
    ]);
  });

  test("uneven numbers follow the best-fit line (Excel's trend)", () => {
    // Excel fills 1, 3, 4 with 5.66666666666667, 7.16666666666667
    const out = values(generateFillSeries([num(1), num(3), num(4)], 2));
    expect(out[0]).toBeCloseTo(17 / 3, 10);
    expect(out[1]).toBeCloseTo(43 / 6, 10);
    expect(linearTrend([1, 3, 4]).slope).toBeCloseTo(1.5, 10);
  });

  test("growth trend is only used when asked for", () => {
    expect(
      values(generateFillSeries([num(1), num(2), num(4)], 2, { type: "9" }))
    ).toEqual([8, 16]);
    const linear = values(generateFillSeries([num(1), num(2), num(4)], 1));
    expect(linear[0]).toBeCloseTo(16 / 3, 10);
  });

  test("Ctrl copies a multi-cell number series", () => {
    expect(
      values(generateFillSeries([num(1), num(2)], 3, { ctrl: true }))
    ).toEqual([1, 2, 1]);
  });

  test("filling up/left produces the decreasing series", () => {
    expect(
      values(generateFillSeries([num(1), num(2)], 3, { reverse: true }))
    ).toEqual([0, -1, -2]);
  });

  test("keeps the number format of the source", () => {
    const [cell] = generateFillSeries([num(1, "0.00"), num(2, "0.00")], 1);
    expect(cell.v).toBe(3);
    expect(cell.m).toBe("3.00");
    expect(cell.ct.fa).toBe("0.00");
  });

  test("copy type repeats the source", () => {
    expect(
      values(generateFillSeries([num(1), num(2)], 3, { type: "0" }))
    ).toEqual([1, 2, 1]);
  });
});

describe("dates and times", () => {
  test("a single date steps by one day", () => {
    expect(dates(generateFillSeries([date(2024, 2, 28)], 3))).toEqual([
      "2024-02-29",
      "2024-03-01",
      "2024-03-02",
    ]);
  });

  test("Ctrl copies a single date", () => {
    expect(
      dates(generateFillSeries([date(2024, 2, 28)], 2, { ctrl: true }))
    ).toEqual(["2024-02-28", "2024-02-28"]);
  });

  test("detects day, month and year steps", () => {
    expect(
      dates(generateFillSeries([date(2024, 1, 1), date(2024, 1, 8)], 2))
    ).toEqual(["2024-01-15", "2024-01-22"]);
    expect(
      dates(generateFillSeries([date(2024, 1, 15), date(2024, 2, 15)], 3))
    ).toEqual(["2024-03-15", "2024-04-15", "2024-05-15"]);
    expect(
      dates(generateFillSeries([date(2020, 3, 1), date(2021, 3, 1)], 2))
    ).toEqual(["2022-03-01", "2023-03-01"]);
  });

  test("keeps the display format", () => {
    const [cell] = generateFillSeries([date(2024, 1, 1)], 1);
    expect(cell.m).toBe("2024-01-02");
    expect(cell.ct).toEqual({ fa: "yyyy-MM-dd", t: "d" });
  });

  test("fill types force days, weekdays, months or years", () => {
    const fri = date(2024, 1, 5);
    expect(dates(generateFillSeries([fri], 3, { type: "5" }))).toEqual([
      "2024-01-08",
      "2024-01-09",
      "2024-01-10",
    ]);
    expect(
      dates(generateFillSeries([date(2024, 1, 31)], 3, { type: "6" }))
    ).toEqual(["2024-02-29", "2024-03-31", "2024-04-30"]);
    expect(
      dates(generateFillSeries([date(2024, 2, 29)], 2, { type: "7" }))
    ).toEqual(["2025-02-28", "2026-02-28"]);
    expect(
      dates(
        generateFillSeries([date(2024, 1, 1), date(2024, 1, 3)], 2, {
          type: "4",
        })
      )
    ).toEqual(["2024-01-05", "2024-01-07"]);
  });

  test("filling up counts dates backwards", () => {
    expect(
      dates(generateFillSeries([date(2024, 3, 1)], 2, { reverse: true }))
    ).toEqual(["2024-02-29", "2024-02-28"]);
  });

  test("a single time steps by one hour, two times by their difference", () => {
    // (the display text of times is left to the number-format engine)
    const out = generateFillSeries([time(9)], 2);
    expect(out[0].v).toBeCloseTo(10 / 24, 9);
    expect(out[1].v).toBeCloseTo(11 / 24, 9);
    expect(out[0].ct).toEqual({ fa: "hh:mm", t: "d" });
    const half = generateFillSeries([time(9), time(9, 30)], 2);
    expect(half[0].v * 24).toBeCloseTo(10, 9);
    expect(half[1].v * 24).toBeCloseTo(10.5, 9);
    const up = generateFillSeries([time(9)], 1, { reverse: true });
    expect(up[0].v * 24).toBeCloseTo(8, 9);
  });
});

describe("lists", () => {
  test("weekday and month names continue and wrap", () => {
    expect(values(generateFillSeries([text("Mon")], 3))).toEqual([
      "Tue",
      "Wed",
      "Thu",
    ]);
    expect(values(generateFillSeries([text("Saturday")], 2))).toEqual([
      "Sunday",
      "Monday",
    ]);
    expect(values(generateFillSeries([text("Nov")], 3))).toEqual([
      "Dec",
      "Jan",
      "Feb",
    ]);
    expect(values(generateFillSeries([text("January")], 1))).toEqual([
      "February",
    ]);
  });

  test("keeps the letter case of the source", () => {
    expect(values(generateFillSeries([text("MON")], 2))).toEqual([
      "TUE",
      "WED",
    ]);
    expect(values(generateFillSeries([text("january")], 1))).toEqual([
      "february",
    ]);
  });

  test("uses the step between two items", () => {
    expect(values(generateFillSeries([text("Jan"), text("Mar")], 3))).toEqual([
      "May",
      "Jul",
      "Sep",
    ]);
    expect(values(generateFillSeries([text("Mon"), text("Wed")], 3))).toEqual([
      "Fri",
      "Sun",
      "Tue",
    ]);
  });

  test("filling up goes backwards", () => {
    expect(
      values(generateFillSeries([text("Mon")], 2, { reverse: true }))
    ).toEqual(["Sun", "Sat"]);
    expect(
      values(
        generateFillSeries([text("Mon"), text("Tue")], 2, { reverse: true })
      )
    ).toEqual(["Sun", "Sat"]);
  });

  test("Ctrl copies list items", () => {
    expect(
      values(generateFillSeries([text("Mon")], 2, { ctrl: true }))
    ).toEqual(["Mon", "Mon"]);
  });

  test("quarters", () => {
    expect(values(generateFillSeries([text("Q1")], 4))).toEqual([
      "Q2",
      "Q3",
      "Q4",
      "Q1",
    ]);
    expect(values(generateFillSeries([text("Qtr 3")], 2))).toEqual([
      "Qtr 4",
      "Qtr 1",
    ]);
    expect(values(generateFillSeries([text("Quarter 4")], 1))).toEqual([
      "Quarter 1",
    ]);
  });

  test("Chinese weekdays and numbers", () => {
    expect(values(generateFillSeries([text("周六")], 2))).toEqual([
      "周日",
      "周一",
    ]);
    expect(values(generateFillSeries([text("星期一")], 1))).toEqual(["星期二"]);
    expect(values(generateFillSeries([text("九")], 3))).toEqual([
      "十",
      "十一",
      "十二",
    ]);
  });

  test("custom lists", () => {
    setCustomFillLists([["Low", "Medium", "High"]]);
    try {
      expect(values(generateFillSeries([text("Medium")], 3))).toEqual([
        "High",
        "Low",
        "Medium",
      ]);
    } finally {
      setCustomFillLists([]);
    }
    expect(values(generateFillSeries([text("Medium")], 1))).toEqual(["Medium"]);
  });
});

describe("text with numbers", () => {
  test("increments a trailing number", () => {
    expect(values(generateFillSeries([text("Item 1")], 3))).toEqual([
      "Item 2",
      "Item 3",
      "Item 4",
    ]);
    expect(
      values(generateFillSeries([text("Item 1"), text("Item 3")], 2))
    ).toEqual(["Item 5", "Item 7"]);
  });

  test("keeps leading zeros", () => {
    expect(values(generateFillSeries([text("A098")], 3))).toEqual([
      "A099",
      "A100",
      "A101",
    ]);
  });

  test("increments a leading number when there is no trailing one", () => {
    expect(values(generateFillSeries([text("1 apple")], 2))).toEqual([
      "2 apple",
      "3 apple",
    ]);
  });

  test("going below zero mirrors like Excel", () => {
    expect(
      values(generateFillSeries([text("Item 1")], 3, { reverse: true }))
    ).toEqual(["Item 0", "Item 1", "Item 2"]);
  });

  test("ordinals", () => {
    expect(values(generateFillSeries([text("1st")], 4))).toEqual([
      "2nd",
      "3rd",
      "4th",
      "5th",
    ]);
    expect(values(generateFillSeries([text("10th")], 4))).toEqual([
      "11th",
      "12th",
      "13th",
      "14th",
    ]);
    expect(values(generateFillSeries([text("21ST")], 1))).toEqual(["22ND"]);
  });

  test("different prefixes form separate series", () => {
    expect(values(generateFillSeries([text("a1"), text("b1")], 4))).toEqual([
      "a2",
      "b2",
      "a3",
      "b3",
    ]);
  });
});

describe("mixed sources", () => {
  test("each run continues its own series and the pattern repeats", () => {
    expect(values(generateFillSeries([num(1), num(2), text("x")], 6))).toEqual([
      3,
      4,
      "x",
      5,
      6,
      "x",
    ]);
  });

  test("plain text, booleans, blanks and formulas are copied", () => {
    const f = { v: 2, f: "=A1*2", ct: { fa: "General", t: "n" } };
    const out = generateFillSeries(
      [text("abc"), null, { v: true, ct: { t: "b" } }, f],
      4
    );
    expect(out[0].v).toBe("abc");
    expect(out[1]).toBeNull();
    expect(out[2].v).toBe(true);
    expect(out[3]).toEqual(f);
    expect(out[3]).not.toBe(f);
  });

  test("classifies values", () => {
    expect(classifyFillValue(num(1)).kind).toBe("number");
    expect(classifyFillValue(date(2024, 1, 1)).kind).toBe("date");
    expect(classifyFillValue(text("Tue")).kind).toBe("list");
    expect(classifyFillValue(text("Item 7")).kind).toBe("textnum");
    expect(classifyFillValue(text("hello")).kind).toBe("copy");
    expect(classifyFillValue({ v: 1, f: "=1" }).kind).toBe("copy");
  });
});
