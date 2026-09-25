import { makeContext, input, value } from "../formula/helpers";
import {
  createFilter,
  applyFilterCondition,
  clearColumnFilter,
  clearAllFilterConditions,
  clearFilter,
  getFilterRecordCount,
  getFilterColumnKind,
  getColumnFilterCondition,
  matchFilterOperator,
  datePeriodRange,
  saveFilter,
  reapplyFilter,
} from "../../src/modules/filter";
import { dateToSerial } from "../../src/modules/autofill";

function fill(ctx, cells) {
  Object.entries(cells).forEach(([a1, text]) => input(ctx, a1, text));
}

function hiddenRows(ctx) {
  return Object.keys(ctx.config.rowhidden || {})
    .map(Number)
    .sort((a, b) => a - b);
}

/** A1:C9 table: Name, Qty, Date; filter on it. */
function setup() {
  const ctx = makeContext({ rows: 14, cols: 6 });
  fill(ctx, {
    A1: "Name",
    B1: "Qty",
    C1: "Date",
    A2: "apple",
    B2: "10",
    C2: "2024-01-15",
    A3: "banana",
    B3: "20",
    C3: "2024-02-20",
    A4: "cherry",
    B4: "30",
    C4: "2024-03-05",
    A5: "apricot",
    B5: "40",
    C5: "2023-12-31",
    A6: "blueberry",
    B6: "50",
    C6: "2024-07-04",
    A7: "Avocado",
    B7: "60",
    C7: "2024-01-01",
    A8: "date",
    B8: "70",
    C8: "2024-06-30",
    A9: "",
    B9: "80",
    C9: "2024-09-25",
  });
  ctx.luckysheet_select_save = [
    { row: [0, 8], column: [0, 2], row_focus: 0, column_focus: 0 },
  ];
  createFilter(ctx);
  return ctx;
}

describe("custom AutoFilter operators", () => {
  const text = (v) => ({ v, m: v, ct: { t: "g" } });
  const num = (v) => ({ v, m: `${v}`, ct: { t: "n" } });

  test.each([
    ["equals", "apple", text("Apple"), true],
    ["equals", "a*e", text("apple"), true],
    ["equals", "a?ple", text("apple"), true],
    ["equals", "a*", text("banana"), false],
    ["equals", "10", num(10), true],
    ["equals", "", null, true],
    ["notEquals", "apple", text("apple"), false],
    ["beginsWith", "ap", text("Apricot"), true],
    ["notBeginsWith", "ap", text("Apricot"), false],
    ["endsWith", "rry", text("cherry"), true],
    ["notEndsWith", "rry", text("cherry"), false],
    ["contains", "an", text("banana"), true],
    ["contains", "~*", text("5*3"), true],
    ["notContains", "an", text("banana"), false],
    ["greaterThan", "25", num(30), true],
    ["greaterThan", "25", text("zzz"), false],
    ["lessOrEqual", "30", num(30), true],
    ["greaterThan", "b", text("cherry"), true],
    ["lessThan", "b", text("apple"), true],
  ])("%s %j", (op, crit, cell, expected) => {
    expect(matchFilterOperator(cell, op, crit)).toBe(expected);
  });
});

describe("filter conditions", () => {
  test("text filter: begins with (case-insensitive)", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 0, {
      type: "custom",
      op1: "beginsWith",
      value1: "a",
    });
    // rows 2 (apple), 5 (apricot), 7 (Avocado) stay
    expect(hiddenRows(ctx)).toEqual([2, 3, 5, 7, 8]);
    expect(getFilterRecordCount(ctx)).toEqual({ visible: 3, total: 8 });
    expect(getColumnFilterCondition(ctx, 0)).toMatchObject({
      type: "custom",
    });
  });

  test("number filter: between (AND) and OR", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "greaterOrEqual",
      value1: "20",
      join: "and",
      op2: "lessOrEqual",
      value2: "40",
    });
    expect(hiddenRows(ctx)).toEqual([1, 5, 6, 7, 8]);
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "lessThan",
      value1: "20",
      join: "or",
      op2: "greaterThan",
      value2: "70",
    });
    expect(hiddenRows(ctx)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  test("top 10 items / percent and bottom", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 1, { type: "top10", count: 3 });
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 4, 5]);
    applyFilterCondition(ctx, 1, {
      type: "top10",
      count: 25,
      percent: true,
      bottom: true,
    });
    // 25% of 8 values = 2 items: 10, 20
    expect(hiddenRows(ctx)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  test("above / below average", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 1, { type: "average" });
    // average 45
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 4]);
    applyFilterCondition(ctx, 1, { type: "average", below: true });
    expect(hiddenRows(ctx)).toEqual([5, 6, 7, 8]);
  });

  test("date filters: custom before/after and relative periods", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 2, {
      type: "custom",
      op1: "greaterOrEqual",
      value1: "2024-01-01",
      join: "and",
      op2: "lessThan",
      value2: "2024-03-01",
    });
    expect(hiddenRows(ctx)).toEqual([3, 4, 5, 7, 8]);
    const now = new Date(2024, 6, 10); // Wed 10 Jul 2024
    applyFilterCondition(
      ctx,
      2,
      { type: "datePeriod", period: "thisYear" },
      now
    );
    expect(hiddenRows(ctx)).toEqual([4]);
    applyFilterCondition(
      ctx,
      2,
      { type: "datePeriod", period: "lastMonth" },
      now
    );
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 4, 5, 6, 8]);
    applyFilterCondition(ctx, 2, { type: "datePeriod", period: "Q1" }, now);
    expect(hiddenRows(ctx)).toEqual([4, 5, 7, 8]);
    applyFilterCondition(ctx, 2, { type: "datePeriod", period: "M7" }, now);
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 4, 6, 7, 8]);
  });

  test("date period ranges", () => {
    const now = new Date(2024, 6, 10); // Wednesday
    const s = (y, m, d) => dateToSerial(y, m, d);
    expect(datePeriodRange("today", now)).toEqual([
      s(2024, 6, 10),
      s(2024, 6, 10),
    ]);
    expect(datePeriodRange("thisWeek", now)).toEqual([
      s(2024, 6, 7),
      s(2024, 6, 13),
    ]);
    expect(datePeriodRange("lastWeek", now)).toEqual([
      s(2024, 5, 30),
      s(2024, 6, 6),
    ]);
    expect(datePeriodRange("nextMonth", now)).toEqual([
      s(2024, 7, 1),
      s(2024, 7, 31),
    ]);
    expect(datePeriodRange("lastQuarter", now)).toEqual([
      s(2024, 3, 1),
      s(2024, 5, 30),
    ]);
    expect(datePeriodRange("nextQuarter", new Date(2024, 11, 1))).toEqual([
      s(2025, 0, 1),
      s(2025, 2, 31),
    ]);
    expect(datePeriodRange("yearToDate", now)).toEqual([
      s(2024, 0, 1),
      s(2024, 6, 10),
    ]);
  });

  test("filter by cell colour and font colour", () => {
    const ctx = setup();
    const { data } = ctx.luckysheetfile[0];
    data[2][0].bg = "#FFFF00";
    data[4][0].bg = "#ff0";
    data[3][0].fc = "rgb(255, 0, 0)";
    applyFilterCondition(ctx, 0, { type: "cellColor", colors: ["#ffff00"] });
    expect(hiddenRows(ctx)).toEqual([1, 3, 5, 6, 7, 8]);
    applyFilterCondition(ctx, 0, { type: "fontColor", colors: ["#ff0000"] });
    expect(hiddenRows(ctx)).toEqual([1, 2, 4, 5, 6, 7, 8]);
  });
});

describe("multiple columns and clearing", () => {
  test("filters on several columns combine; clear one column", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 0, {
      type: "custom",
      op1: "contains",
      value1: "a",
    });
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "greaterThan",
      value1: "30",
    });
    // A contains "a": apple, banana, apricot, Avocado, date (rows 1,2,4,6,7)
    // B > 30: rows 4..8 -> both: rows 4, 6, 7
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 5, 8]);
    expect(getFilterRecordCount(ctx)).toEqual({ visible: 3, total: 8 });
    clearColumnFilter(ctx, 0);
    expect(hiddenRows(ctx)).toEqual([1, 2, 3]);
    expect(getColumnFilterCondition(ctx, 0)).toBeNull();
  });

  test("rows hidden by hand survive filtering and clearing", () => {
    const ctx = setup();
    ctx.config = { rowhidden: { 11: 0 } };
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "greaterThan",
      value1: "60",
    });
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 4, 5, 6, 11]);
    clearAllFilterConditions(ctx);
    expect(hiddenRows(ctx)).toEqual([11]);
    // the filter range is still there, conditions are gone
    expect(ctx.luckysheet_filter_save).toBeTruthy();
    expect(getFilterRecordCount(ctx)).toBeNull();
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "lessThan",
      value1: "20",
    });
    clearFilter(ctx);
    expect(hiddenRows(ctx)).toEqual([11]);
    expect(ctx.luckysheet_filter_save).toBeUndefined();
  });

  test("reapply re-runs stored conditions on new data", () => {
    const ctx = setup();
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "greaterThan",
      value1: "60",
    });
    input(ctx, "B2", "100");
    reapplyFilter(ctx);
    expect(hiddenRows(ctx)).toEqual([2, 3, 4, 5, 6]);
  });

  test("column kind picks the submenu", () => {
    const ctx = setup();
    expect(getFilterColumnKind(ctx, 0, 0, 8)).toBe("text");
    expect(getFilterColumnKind(ctx, 1, 0, 8)).toBe("number");
    expect(getFilterColumnKind(ctx, 2, 0, 8)).toBe("date");
  });
});

describe("SUBTOTAL respects filtered rows", () => {
  test("recalculates when a filter changes", () => {
    const ctx = setup();
    input(ctx, "E1", "=SUBTOTAL(9,B2:B9)");
    input(ctx, "E2", "=SUBTOTAL(109,B2:B9)");
    input(ctx, "E3", "=SUM(B2:B9)");
    expect(value(ctx, "E1")).toBe(360);
    applyFilterCondition(ctx, 1, {
      type: "custom",
      op1: "greaterThan",
      value1: "60",
    });
    expect(value(ctx, "E1")).toBe(150);
    expect(value(ctx, "E2")).toBe(150);
    expect(value(ctx, "E3")).toBe(360);
    clearColumnFilter(ctx, 1);
    expect(value(ctx, "E1")).toBe(360);
  });

  test("value-list filters (saveFilter) also recalculate", () => {
    const ctx = setup();
    input(ctx, "E1", "=SUBTOTAL(2,B2:B9)");
    saveFilter(ctx, true, { 1: 0, 2: 0 }, { type: "values" }, 0, 8, 1, 0, 2);
    expect(value(ctx, "E1")).toBe(6);
  });
});
