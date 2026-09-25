import {
  makeContext,
  input,
  put,
  column,
  rules,
  cf,
  marked,
  highlight,
  range,
} from "./helpers";
import { cfClock, cfDatePeriod } from "../../src/modules/ConditionFormat";

// Excel reference: "Highlight Cells Rules" / "Top/Bottom Rules" and
// "Use a formula to determine which cells to format" in the Conditional
// Formatting documentation.

describe("cell value rules", () => {
  test("comparison operators", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 5, 10, "text", null]);
    rules(ctx, [highlight("greaterThan", "A1:A4", ["5"])]);
    // text sorts after every number, like Excel's comparison
    expect(marked(ctx)).toEqual(["A3", "A4"]);
    rules(ctx, [highlight("greaterThanOrEqual", "A1:A3", [5])]);
    expect(marked(ctx)).toEqual(["A2", "A3"]);
    rules(ctx, [highlight("lessThanOrEqual", "A1:A3", [5])]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
    rules(ctx, [highlight("notEqual", "A1:A3", [5])]);
    expect(marked(ctx)).toEqual(["A1", "A3"]);
  });

  test("blank cells count as 0 in value comparisons", () => {
    const ctx = makeContext();
    column(ctx, "A1", [3, null, 7]);
    rules(ctx, [highlight("lessThan", "A1:A3", [5])]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
  });

  test("equal compares text case-insensitively", () => {
    const ctx = makeContext();
    column(ctx, "A1", ["Apple", "apple", "pear", 1]);
    rules(ctx, [highlight("equal", "A1:A4", ["APPLE"])]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
  });

  test("between and not between accept operands in any order", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2, 3, 4, 5]);
    rules(ctx, [highlight("between", "A1:A5", [4, 2])]);
    expect(marked(ctx)).toEqual(["A2", "A3", "A4"]);
    rules(ctx, [highlight("notBetween", "A1:A5", [2, 4])]);
    expect(marked(ctx)).toEqual(["A1", "A5"]);
  });

  test("operand formulas shift relative to the top-left cell", () => {
    const ctx = makeContext();
    column(ctx, "A1", [5, 5, 5]);
    column(ctx, "B1", [4, 6, 1]);
    // each A cell is compared with the B cell of its row
    rules(ctx, [highlight("greaterThan", "A1:A3", ["=B1"])]);
    expect(marked(ctx)).toEqual(["A1", "A3"]);
    // absolute references stay put
    put(ctx, "D1", 4.5);
    rules(ctx, [highlight("greaterThan", "A1:B3", ["=$D$1"])]);
    expect(marked(ctx)).toEqual(["A1", "A2", "A3", "B2"]);
  });

  test("error cells are never formatted by value rules", () => {
    const ctx = makeContext();
    put(ctx, "A1", "#DIV/0!");
    put(ctx, "A2", 9);
    rules(ctx, [highlight("greaterThan", "A1:A2", [1])]);
    expect(marked(ctx)).toEqual(["A2"]);
  });
});

describe("text rules", () => {
  test("contains / does not contain / begins / ends, case-insensitive", () => {
    const ctx = makeContext();
    column(ctx, "A1", ["Hello world", "WORLD", "say hello", null, 1234]);
    rules(ctx, [highlight("textContains", "A1:A5", ["world"])]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
    rules(ctx, [highlight("textBeginsWith", "A1:A5", ["hello"])]);
    expect(marked(ctx)).toEqual(["A1"]);
    rules(ctx, [highlight("textEndsWith", "A1:A5", ["HELLO"])]);
    expect(marked(ctx)).toEqual(["A3"]);
    rules(ctx, [highlight("textContains", "A1:A5", ["23"])]);
    expect(marked(ctx)).toEqual(["A5"]);
    // like Excel's ISERROR(SEARCH(...)): blanks do not contain the text
    rules(ctx, [highlight("textNotContains", "A1:A5", ["world"])]);
    expect(marked(ctx)).toEqual(["A3", "A4", "A5"]);
  });
});

describe("blanks and errors", () => {
  test("blanks / no blanks treat whitespace-only text as blank", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, null, "  ", "x"]);
    rules(ctx, [highlight("blanks", "A1:A4")]);
    expect(marked(ctx)).toEqual(["A2", "A3"]);
    rules(ctx, [highlight("noBlanks", "A1:A4")]);
    expect(marked(ctx)).toEqual(["A1", "A4"]);
  });

  test("errors / no errors", () => {
    const ctx = makeContext();
    input(ctx, "A1", "=1/0");
    input(ctx, "A2", "=NA()");
    put(ctx, "A3", 2);
    rules(ctx, [highlight("errors", "A1:A4")]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
    rules(ctx, [highlight("noErrors", "A1:A4")]);
    expect(marked(ctx)).toEqual(["A3", "A4"]);
  });
});

describe("duplicate and unique values", () => {
  test("duplicates ignore case for text and skip blanks", () => {
    const ctx = makeContext();
    column(ctx, "A1", ["a", "A", 1, "1", 1, null, null, "b"]);
    rules(ctx, [highlight("duplicateValue", "A1:A8", ["0"])]);
    expect(marked(ctx)).toEqual(["A1", "A2", "A3", "A5"]);
    rules(ctx, [highlight("duplicateValue", "A1:A8", ["1"])]);
    expect(marked(ctx)).toEqual(["A4", "A8"]);
  });
});

describe("top / bottom rules", () => {
  const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  test("top and bottom N", () => {
    const ctx = makeContext();
    column(ctx, "A1", data);
    rules(ctx, [highlight("top10", "A1:A10", [3])]);
    expect(marked(ctx)).toEqual(["A8", "A9", "A10"]);
    rules(ctx, [highlight("last10", "A1:A10", [2])]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
  });

  test("ties at the boundary are all included", () => {
    const ctx = makeContext();
    column(ctx, "A1", [5, 9, 9, 1]);
    rules(ctx, [highlight("top10", "A1:A4", [1])]);
    expect(marked(ctx)).toEqual(["A2", "A3"]);
  });

  test("top and bottom N percent (rounded down, at least one)", () => {
    const ctx = makeContext();
    column(ctx, "A1", data);
    rules(ctx, [highlight("top10_percent", "A1:A10", [25])]);
    expect(marked(ctx)).toEqual(["A9", "A10"]);
    rules(ctx, [highlight("last10_percent", "A1:A10", [5])]);
    expect(marked(ctx)).toEqual(["A1"]);
  });
});

describe("above / below average", () => {
  test("strictly above and below, optionally including the average", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2, 3, 4, 5, "x"]);
    rules(ctx, [highlight("aboveAverage", "A1:A6")]);
    expect(marked(ctx)).toEqual(["A4", "A5"]);
    rules(ctx, [highlight("belowAverage", "A1:A6")]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
    rules(ctx, [
      highlight("aboveAverage", "A1:A6", [], { equalAverage: true }),
    ]);
    expect(marked(ctx)).toEqual(["A3", "A4", "A5"]);
  });

  test("standard deviations above / below", () => {
    const ctx = makeContext();
    // mean 10, sample standard deviation 5.477
    column(ctx, "A1", [2, 6, 10, 14, 18]);
    rules(ctx, [highlight("aboveAverage", "A1:A5", [], { stdDev: 1 })]);
    expect(marked(ctx)).toEqual(["A5"]);
    rules(ctx, [highlight("belowAverage", "A1:A5", [], { stdDev: 1 })]);
    expect(marked(ctx)).toEqual(["A1"]);
    rules(ctx, [highlight("aboveAverage", "A1:A5", [], { stdDev: 2 })]);
    expect(marked(ctx)).toEqual([]);
  });
});

describe("dates occurring", () => {
  const realNow = cfClock.now;
  // Wednesday 2024-05-15 (serial 45427)
  beforeAll(() => {
    cfClock.now = () => new Date(2024, 4, 15, 10, 30);
  });
  afterAll(() => {
    cfClock.now = realNow;
  });

  test("periods relative to today (weeks start on Sunday)", () => {
    const today = 45427;
    expect(cfDatePeriod("today")).toEqual([today, today]);
    expect(cfDatePeriod("yesterday")).toEqual([today - 1, today - 1]);
    expect(cfDatePeriod("tomorrow")).toEqual([today + 1, today + 1]);
    expect(cfDatePeriod("last7Days")).toEqual([today - 6, today]);
    // Sunday 2024-05-12 .. Saturday 2024-05-18
    expect(cfDatePeriod("thisWeek")).toEqual([45424, 45430]);
    expect(cfDatePeriod("lastWeek")).toEqual([45417, 45423]);
    expect(cfDatePeriod("nextWeek")).toEqual([45431, 45437]);
    // May 2024 = 45413 .. 45443
    expect(cfDatePeriod("thisMonth")).toEqual([45413, 45443]);
    expect(cfDatePeriod("lastMonth")).toEqual([45383, 45412]);
    expect(cfDatePeriod("nextMonth")).toEqual([45444, 45473]);
    expect(cfDatePeriod("2024-05-01")).toEqual([45413, 45413]);
    expect(cfDatePeriod("2024/05/02 - 2024/05/01")).toEqual([45413, 45414]);
  });

  test("date cells (with a time part) match their day", () => {
    const ctx = makeContext();
    column(ctx, "A1", [45427.75, 45426, 45420, "text"]);
    rules(ctx, [highlight("occurrenceDate", "A1:A4", ["yesterday"])]);
    expect(marked(ctx)).toEqual(["A2"]);
    rules(ctx, [highlight("occurrenceDate", "A1:A4", ["last7Days"])]);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
    rules(ctx, [highlight("occurrenceDate", "A1:A4", ["thisMonth"])]);
    expect(marked(ctx)).toEqual(["A1", "A2", "A3"]);
  });
});

describe("formula rules", () => {
  test("relative references shift per cell, absolute ones stay", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2, 3, 4]);
    column(ctx, "B1", [1, 0, 3, 0]);
    // whole-row highlight: $A fixes the column, the row shifts
    rules(ctx, [highlight("formula", "A1:B4", ["=$A1=$B1"])]);
    expect(marked(ctx)).toEqual(["A1", "A3", "B1", "B3"]);
  });

  test("the formula may reference other sheets and use functions", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2, 3]);
    put(ctx, "A1", 2, "id_2");
    rules(ctx, [
      highlight("formula", "A1:A3", ["=A1>='My Sheet'!$A$1"]),
      highlight("formula", "A1:A3", ["=ISODD(A1)"], {
        format: { textColor: "#0000FF" },
      }),
    ]);
    expect(marked(ctx)).toEqual(["A2", "A3"]);
    expect(marked(ctx, "textColor")).toEqual(["A1", "A3"]);
  });

  test("numbers are truthy when non-zero; errors and text are false", () => {
    const ctx = makeContext();
    column(ctx, "A1", [0, 5, "x"]);
    rules(ctx, [highlight("formula", "A1:A3", ["A1"])]);
    expect(marked(ctx)).toEqual(["A2"]);
    rules(ctx, [highlight("formula", "A1:A3", ["=1/A1"])]);
    expect(marked(ctx)).toEqual(["A2"]);
  });

  test("evaluation does not touch the workbook", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2]);
    rules(ctx, [highlight("formula", "A1:A2", ["=SEQUENCE(3)>0"])]);
    const before = JSON.stringify(ctx.luckysheetfile[0].data);
    expect(marked(ctx)).toEqual(["A1", "A2"]);
    expect(JSON.stringify(ctx.luckysheetfile[0].data)).toBe(before);
    expect(ctx.luckysheetfile[0].calcChain ?? []).toEqual([]);
  });
});

describe("priority, conflicts and stop if true", () => {
  test("the last rule has the highest priority; others fill in", () => {
    const ctx = makeContext();
    column(ctx, "A1", [10]);
    rules(ctx, [
      highlight("greaterThan", "A1", [1], {
        format: { cellColor: "#00FF00", bold: true },
      }),
      highlight("greaterThan", "A1", [5], {
        format: { cellColor: "#FF0000", textColor: "#FFFFFF" },
      }),
    ]);
    expect(cf(ctx, "A1")).toEqual({
      cellColor: "#FF0000",
      textColor: "#FFFFFF",
      bold: true,
    });
  });

  test("stop if true ends lower-priority rules for that cell", () => {
    const ctx = makeContext();
    column(ctx, "A1", [10, 1]);
    rules(ctx, [
      highlight("greaterThan", "A1:A2", [0], { format: { bold: true } }),
      highlight("greaterThan", "A1:A2", [5], { stopIfTrue: true }),
    ]);
    expect(cf(ctx, "A1")).toEqual({ cellColor: "#FF0000" });
    expect(cf(ctx, "A2")).toEqual({ bold: true });
  });

  test("all formats of a highlight rule are applied", () => {
    const ctx = makeContext();
    column(ctx, "A1", [0.5]);
    const format = {
      textColor: "#111111",
      cellColor: "#222222",
      bold: true,
      italic: true,
      strikethrough: true,
      underline: true,
      borderColor: "#333333",
      numberFormat: "0.0%",
    };
    rules(ctx, [highlight("greaterThan", "A1", [0], { format })]);
    expect(cf(ctx, "A1")).toEqual(format);
  });

  test("legacy rules (Luckysheet format) keep working", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 20]);
    rules(ctx, [
      {
        type: "default",
        cellrange: [{ row: [0, 1], column: [0, 0], row_focus: 0 }],
        format: { textColor: "#000000", cellColor: null },
        conditionName: "greaterThan",
        conditionRange: [],
        conditionValue: ["10"],
      },
    ]);
    expect(marked(ctx, "textColor")).toEqual(["A2"]);
    expect(marked(ctx, "cellColor")).toEqual([]);
  });

  test("whole-column applies-to ranges stop at the data", () => {
    const ctx = makeContext();
    column(ctx, "A1", [1, 2]);
    rules(ctx, [highlight("blanks", "A:A")]);
    expect(marked(ctx).length).toBe(10);
    expect(range("A:A")[0].row[1]).toBe(1048575);
  });
});
