import { makeContext, input, value, values, cell } from "../formula/helpers";
import {
  computePivot,
  createPivotTable,
  deletePivotTable,
  findPivotTable,
  getPivotData,
  groupPivotDateField,
  pivotAt,
  pivotCellInfo,
  pivotDrillDown,
  pivotFieldItems,
  pivotFieldList,
  pivotSourceSignature,
  refreshPivotTable,
  suggestPivotSource,
  updatePivotField,
  updatePivotTable,
  PIVOT_HEADER_BG,
  PIVOT_VALUES_FIELD,
  checkNewPivotTable,
  checkPivotUpdate,
  isPivotFieldUsed,
  pivotAreaFields,
  pivotMoveField,
} from "../../src/modules/pivot";
import { createTable } from "../../src/modules/tables";
import { insertRowCol } from "../../src/modules/rowcol";

function fill(ctx, rows, sheetId = "id_1") {
  rows.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v == null) return;
      const a1 = `${String.fromCharCode(65 + c)}${r + 1}`;
      input(ctx, a1, String(v), sheetId);
    });
  });
}

const SALES = [
  ["Region", "Product", "Date", "Sales"],
  ["East", "Pen", "2023-01-15", 10],
  ["East", "Book", "2023-04-20", 20],
  ["West", "Pen", "2023-02-10", 30],
  ["West", "Book", "2024-01-05", 40],
  ["East", "Pen", "2024-03-01", 50],
  ["North", "Cup", "2024-07-07", null],
  ["West", "Cup", "2024-12-24", 60],
];

const SOURCE = { sheetId: "id_1", range: { row: [0, 7], column: [0, 3] } };

/** Sales data on Sheet1 and an empty PivotTable at A3 of "My Sheet". */
function setup(options = {}) {
  const ctx = makeContext({ rows: 30, cols: 10 });
  fill(ctx, SALES);
  const res = createPivotTable(ctx, SOURCE, {
    newSheet: false,
    sheetId: "id_2",
    anchor: { r: 2, c: 0 },
    ...options,
  });
  expect(res.error).toBeUndefined();
  return { ctx, pivot: res.pivot };
}

function update(ctx, pivot, patch, opts) {
  const res = updatePivotTable(ctx, "id_2", pivot.id, patch, opts);
  expect(res.error).toBeUndefined();
  return findPivotTable(ctx, "id_2", pivot.id);
}

const SUM_SALES = { field: "Sales", aggregate: "sum" };

describe("model and creation", () => {
  test("create stores the PivotTable on the host sheet", () => {
    const { ctx, pivot } = setup();
    const sheet = ctx.luckysheetfile[1];
    expect(sheet.pivotTables).toHaveLength(1);
    expect(pivot.name).toBe("PivotTable1");
    expect(pivot.anchor).toEqual({ r: 2, c: 0 });
    expect(pivot.options.layout).toBe("compact");
    // the empty PivotTable's placeholder
    expect(pivot.output).toEqual({ row: [2, 19], column: [0, 2] });
    expect(value(ctx, "A3", "id_2")).toBe("PivotTable1");
    expect(pivotAt(ctx, "id_2", 2, 0).id).toBe(pivot.id);
    expect(pivotAt(ctx, "id_2", 5, 5)).toBeNull();
  });

  test("new sheet: placed before the current sheet at A3", () => {
    const ctx = makeContext({ rows: 30, cols: 10 });
    fill(ctx, SALES);
    const res = createPivotTable(ctx, SOURCE, { newSheetId: "pv" });
    expect(res.sheetId).toBe("pv");
    expect(ctx.currentSheetId).toBe("pv");
    const sheet = ctx.luckysheetfile.find((s) => s.id === "pv");
    expect(sheet.order).toBe(0);
    expect(sheet.pivotTables[0].anchor).toEqual({ r: 2, c: 0 });
    expect(sheet.data[2][0].v).toBe("PivotTable1");
    // the UI activates the new sheet with the report selected (Fields pane)
    const remembered = ctx.sheetScrollRecord.pv.luckysheet_select_save;
    expect(remembered[0].row).toEqual([2, 2]);
  });

  test("source suggestion: current region or table", () => {
    const ctx = makeContext({ rows: 30, cols: 10 });
    fill(ctx, SALES);
    ctx.luckysheet_select_save = [
      { row: [2, 2], column: [1, 1], row_focus: 2, column_focus: 1 },
    ];
    expect(suggestPivotSource(ctx)).toEqual(SOURCE);
    createTable(ctx, "id_1", { row: [0, 7], column: [0, 3] });
    expect(suggestPivotSource(ctx)).toEqual({ table: "Table1" });
  });

  test("errors: headers, source, overlapping data", () => {
    const ctx = makeContext({ rows: 30, cols: 10 });
    fill(ctx, [
      ["A", null],
      [1, 2],
    ]);
    expect(
      createPivotTable(ctx, {
        sheetId: "id_1",
        range: { row: [0, 1], column: [0, 1] },
      }).error
    ).toBe("headers");
    expect(createPivotTable(ctx, { table: "Nope" }).error).toBe("source");
    input(ctx, "A3", "x", "id_2");
    const res = createPivotTable(
      ctx,
      { sheetId: "id_1", range: { row: [0, 1], column: [0, 0] } },
      { newSheet: false, sheetId: "id_2", anchor: { r: 2, c: 0 } }
    );
    expect(res.error).toBe("replaceData");
    expect(ctx.luckysheetfile[1].pivotTables).toBeUndefined();
    expect(value(ctx, "A3", "id_2")).toBe("x");
  });

  test("field list and items", () => {
    const { ctx, pivot } = setup();
    const list = pivotFieldList(ctx, pivot);
    expect(list.map((f) => f.name)).toEqual([
      "Region",
      "Product",
      "Date",
      "Sales",
    ]);
    expect(list.find((f) => f.name === "Date").isDate).toBe(true);
    expect(list.find((f) => f.name === "Sales").isNumeric).toBe(true);
    expect(pivotFieldItems(ctx, pivot, "Region").map((i) => i.label)).toEqual([
      "East",
      "North",
      "West",
    ]);
  });
});

describe("report layout", () => {
  test("rows and a sum", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region"], values: [SUM_SALES] });
    expect(values(ctx, "A3", "B7", "id_2")).toEqual([
      ["Row Labels", "Sum of Sales"],
      ["East", 80],
      ["North", undefined],
      ["West", 130],
      ["Grand Total", 210],
    ]);
    expect(cell(ctx, "A3", "id_2").bl).toBe(1);
    expect(cell(ctx, "A3", "id_2").bg).toBe(PIVOT_HEADER_BG);
    expect(cell(ctx, "B7", "id_2").bg).toBe(PIVOT_HEADER_BG);
  });

  test("rows, columns and grand totals", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Region"],
      columns: ["Product"],
      values: [SUM_SALES],
    });
    expect(values(ctx, "A3", "E8", "id_2")).toEqual([
      ["Sum of Sales", "Column Labels", undefined, undefined, undefined],
      ["Row Labels", "Book", "Cup", "Pen", "Grand Total"],
      ["East", 20, undefined, 60, 80],
      ["North", undefined, undefined, undefined, undefined],
      ["West", 40, 60, 30, 130],
      ["Grand Total", 60, 60, 90, 210],
    ]);
    const next = update(ctx, pivot, {
      options: { grandTotalRow: false, grandTotalColumn: false },
    });
    expect(next.output).toEqual({ row: [2, 6], column: [0, 3] });
    expect(value(ctx, "E4", "id_2")).toBeUndefined();
    expect(value(ctx, "A8", "id_2")).toBeUndefined();
  });

  test("several values: Σ Values on columns or rows", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Region"],
      values: [SUM_SALES, { field: "Sales", aggregate: "count" }],
    });
    expect(values(ctx, "A3", "C4", "id_2")).toEqual([
      ["Row Labels", "Sum of Sales", "Count of Sales"],
      ["East", 80, 3],
    ]);
    update(ctx, pivot, { options: { valuesOnRows: true } });
    expect(values(ctx, "A3", "B7", "id_2")).toEqual([
      ["Row Labels", undefined],
      ["East", undefined],
      ["Sum of Sales", 80],
      ["Count of Sales", 3],
      ["North", undefined],
    ]);
    expect(cell(ctx, "A6", "id_2").ind).toBe(1);
  });

  test("two row fields: compact, outline and tabular with subtotals", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region", "Product"], values: [SUM_SALES] });
    expect(values(ctx, "A4", "B7", "id_2")).toEqual([
      ["East", 80],
      ["Book", 20],
      ["Pen", 60],
      ["North", undefined],
    ]);
    expect(cell(ctx, "A5", "id_2").ind).toBe(1);
    expect(cell(ctx, "A4", "id_2").bl).toBe(1);

    update(ctx, pivot, { options: { subtotals: "bottom" } });
    expect(values(ctx, "A4", "B7", "id_2")).toEqual([
      ["East", undefined],
      ["Book", 20],
      ["Pen", 60],
      ["East Total", 80],
    ]);

    update(ctx, pivot, { options: { layout: "tabular", subtotals: "top" } });
    expect(values(ctx, "A3", "C7", "id_2")).toEqual([
      ["Region", "Product", "Sum of Sales"],
      ["East", "Book", 20],
      [undefined, "Pen", 60],
      ["East Total", undefined, 80],
      ["North", "Cup", undefined],
    ]);

    update(ctx, pivot, { options: { layout: "outline", subtotals: "off" } });
    expect(values(ctx, "A3", "C6", "id_2")).toEqual([
      ["Region", "Product", "Sum of Sales"],
      ["East", undefined, undefined],
      [undefined, "Book", 20],
      [undefined, "Pen", 60],
    ]);
  });

  test("aggregates", () => {
    const { ctx, pivot } = setup();
    const agg = (aggregate) => {
      update(ctx, pivot, {
        rows: [],
        values: [{ field: "Sales", aggregate }],
      });
      return value(ctx, "A4", "id_2");
    };
    expect(agg("sum")).toBe(210);
    expect(agg("count")).toBe(6);
    expect(agg("countNums")).toBe(6);
    expect(agg("average")).toBe(35);
    expect(agg("max")).toBe(60);
    expect(agg("min")).toBe(10);
    expect(agg("product")).toBe(10 * 20 * 30 * 40 * 50 * 60);
    expect(agg("varp")).toBeCloseTo(291.6667, 3);
    expect(agg("var")).toBeCloseTo(350, 6);
    expect(agg("stdDev")).toBeCloseTo(Math.sqrt(350), 6);
    expect(agg("stdDevp")).toBeCloseTo(Math.sqrt(291.6667), 3);
    update(ctx, pivot, { values: [{ field: "Region", aggregate: "count" }] });
    expect(value(ctx, "A3", "id_2")).toBe("Count of Region");
    expect(value(ctx, "A4", "id_2")).toBe(7);
  });

  test("show values as", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Region"],
      columns: ["Product"],
      values: [{ ...SUM_SALES, showAs: "percentOfGrandTotal" }],
    });
    expect(value(ctx, "E8", "id_2")).toBe(1);
    expect(value(ctx, "E5", "id_2")).toBeCloseTo(80 / 210, 10);
    expect(cell(ctx, "E5", "id_2").m).toBe("38.10%");
    update(ctx, pivot, {
      values: [{ ...SUM_SALES, showAs: "percentOfRowTotal" }],
    });
    expect(value(ctx, "B5", "id_2")).toBeCloseTo(20 / 80, 10);
    update(ctx, pivot, {
      values: [{ ...SUM_SALES, showAs: "percentOfColumnTotal" }],
    });
    expect(value(ctx, "B5", "id_2")).toBeCloseTo(20 / 60, 10);
    update(ctx, pivot, {
      values: [
        {
          ...SUM_SALES,
          showAs: "difference",
          baseField: "Product",
          baseItem: "Book",
        },
      ],
    });
    // East: Pen - Book = 60 - 20
    expect(value(ctx, "D5", "id_2")).toBe(40);
    expect(value(ctx, "B5", "id_2")).toBeUndefined();
  });

  test("number format and empty cell text", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Region"],
      columns: ["Product"],
      values: [{ ...SUM_SALES, numberFormat: "#,##0.00" }],
      options: { emptyText: "-" },
    });
    expect(cell(ctx, "B5", "id_2").m).toBe("20.00");
    expect(cell(ctx, "B5", "id_2").ct.fa).toBe("#,##0.00");
    expect(value(ctx, "C5", "id_2")).toBe("-");
  });
});

describe("sorting and filters", () => {
  test("sort descending and by value", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Region"],
      values: [SUM_SALES],
      fields: { Region: { sort: "desc" } },
    });
    expect(values(ctx, "A4", "A6", "id_2").flat()).toEqual([
      "West",
      "North",
      "East",
    ]);
    update(ctx, pivot, {
      fields: { Region: { sort: "asc", sortByValue: 0 } },
    });
    expect(values(ctx, "A4", "A6", "id_2").flat()).toEqual([
      "North",
      "East",
      "West",
    ]);
  });

  test("hidden items, label and value filters change totals", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region"], values: [SUM_SALES] });
    updatePivotField(ctx, "id_2", pivot.id, "Region", {
      hiddenItems: ["s:north"],
    });
    expect(values(ctx, "A4", "B6", "id_2")).toEqual([
      ["East", 80],
      ["West", 130],
      ["Grand Total", 210],
    ]);
    updatePivotField(ctx, "id_2", pivot.id, "Region", {
      hiddenItems: undefined,
      labelFilter: { op: "beginsWith", value: "e" },
    });
    expect(values(ctx, "A4", "B5", "id_2")).toEqual([
      ["East", 80],
      ["Grand Total", 80],
    ]);
    updatePivotField(ctx, "id_2", pivot.id, "Region", {
      labelFilter: undefined,
      valueFilter: { op: "top", valueIndex: 0, value: 1 },
    });
    expect(values(ctx, "A4", "B5", "id_2")).toEqual([
      ["West", 130],
      ["Grand Total", 130],
    ]);
    updatePivotField(ctx, "id_2", pivot.id, "Region", {
      valueFilter: { op: "lessThan", valueIndex: 0, value: 100 },
    });
    expect(values(ctx, "A4", "B5", "id_2")).toEqual([
      ["East", 80],
      ["Grand Total", 80],
    ]);
  });

  test("report filters sit above the report", () => {
    const { ctx, pivot } = setup({ anchor: { r: 0, c: 0 } });
    const next = update(ctx, pivot, {
      rows: ["Region"],
      values: [SUM_SALES],
      filters: [{ field: "Product", selected: ["s:pen"] }],
    });
    expect(next.anchor).toEqual({ r: 2, c: 0 });
    expect(values(ctx, "A1", "B1", "id_2")).toEqual([["Product", "Pen"]]);
    expect(values(ctx, "A3", "B6", "id_2")).toEqual([
      ["Row Labels", "Sum of Sales"],
      ["East", 60],
      ["West", 30],
      ["Grand Total", 90],
    ]);
    expect(pivotCellInfo(ctx, "id_2", 0, 1).kind).toBe("filter");
    update(ctx, pivot, {
      filters: [{ field: "Product", selected: ["s:pen", "s:cup"] }],
    });
    expect(value(ctx, "B1", "id_2")).toBe("(Multiple Items)");
    update(ctx, pivot, { filters: [{ field: "Product" }] });
    expect(value(ctx, "B1", "id_2")).toBe("(All)");
  });
});

describe("dates", () => {
  test("group by years and months", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Date"], values: [SUM_SALES] });
    groupPivotDateField(ctx, "id_2", pivot.id, "Date", ["years", "months"]);
    const next = findPivotTable(ctx, "id_2", pivot.id);
    expect(next.rows).toEqual(["Date|years", "Date"]);
    expect(pivotFieldList(ctx, next).map((f) => f.name)).toContain(
      "Years (Date)"
    );
    expect(values(ctx, "A4", "B8", "id_2")).toEqual([
      ["2023", 60],
      ["Jan", 10],
      ["Feb", 30],
      ["Apr", 20],
      ["2024", 150],
    ]);
    groupPivotDateField(ctx, "id_2", pivot.id, "Date", ["quarters"]);
    expect(findPivotTable(ctx, "id_2", pivot.id).rows).toEqual(["Date"]);
    expect(values(ctx, "A4", "A7", "id_2").flat()).toEqual([
      "Qtr1",
      "Qtr2",
      "Qtr3",
      "Qtr4",
    ]);
    groupPivotDateField(ctx, "id_2", pivot.id, "Date", []);
    expect(findPivotTable(ctx, "id_2", pivot.id).fields.Date).toEqual({});
  });
});

describe("refresh, protection, drill-down", () => {
  test("refresh picks up source changes; signature changes", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region"], values: [SUM_SALES] });
    const before = pivotSourceSignature(ctx, pivot);
    input(ctx, "D2", "100");
    expect(pivotSourceSignature(ctx, pivot)).not.toBe(before);
    expect(value(ctx, "B4", "id_2")).toBe(80);
    refreshPivotTable(ctx, "id_2", pivot.id);
    expect(value(ctx, "B4", "id_2")).toBe(170);
  });

  test("preserve formatting keeps user formats; off resets them", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region"], values: [SUM_SALES] });
    ctx.luckysheetfile[1].data[3][1].fc = "#ff0000";
    refreshPivotTable(ctx, "id_2", pivot.id);
    expect(cell(ctx, "B4", "id_2").fc).toBe("#ff0000");
    update(ctx, pivot, { options: { preserveFormatting: false } });
    expect(cell(ctx, "B4", "id_2").fc).toBeUndefined();
  });

  test("a table source grows with the table", () => {
    const ctx = makeContext({ rows: 30, cols: 10 });
    fill(ctx, SALES);
    createTable(ctx, "id_1", { row: [0, 7], column: [0, 3] });
    const { pivot } = createPivotTable(
      ctx,
      { table: "Table1" },
      { newSheet: false, sheetId: "id_2", anchor: { r: 2, c: 0 } }
    );
    update(ctx, pivot, { values: [SUM_SALES] });
    expect(value(ctx, "A4", "id_2")).toBe(210);
  });

  test("drill-down creates a sheet with the rows behind a value", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Region"],
      columns: ["Product"],
      values: [SUM_SALES],
    });
    const info = pivotCellInfo(ctx, "id_2", 4, 3); // East / Pen
    expect(info.kind).toBe("value");
    const id = pivotDrillDown(ctx, "id_2", 4, 3, "drill");
    expect(id).toBe("drill");
    expect(ctx.currentSheetId).toBe("drill");
    const sheet = ctx.luckysheetfile.find((s) => s.id === "drill");
    expect(sheet.data[0].slice(0, 4).map((c) => c.v)).toEqual([
      "Region",
      "Product",
      "Date",
      "Sales",
    ]);
    expect(sheet.data.slice(1, 3).map((r) => r[3].v)).toEqual([10, 50]);
    expect(sheet.data[3][0]).toBeNull();
    expect(sheet.tables).toHaveLength(1);
    expect(pivotDrillDown(ctx, "id_2", 3, 0)).toBeNull();
  });

  test("inserting rows above moves the report", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region"], values: [SUM_SALES] });
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_2",
    });
    const moved = findPivotTable(ctx, "id_2", pivot.id);
    expect(moved.anchor).toEqual({ r: 4, c: 0 });
    expect(moved.output.row).toEqual([4, 8]);
    expect(pivotAt(ctx, "id_2", 4, 0).id).toBe(pivot.id);
    refreshPivotTable(ctx, "id_2", pivot.id);
    expect(value(ctx, "A5", "id_2")).toBe("Row Labels");
  });

  test("delete clears the report", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, { rows: ["Region"], values: [SUM_SALES] });
    deletePivotTable(ctx, "id_2", pivot.id);
    expect(ctx.luckysheetfile[1].pivotTables).toBeUndefined();
    expect(cell(ctx, "A3", "id_2")).toBeNull();
  });

  test("computePivot reports source errors", () => {
    const { ctx, pivot } = setup();
    expect(
      computePivot(ctx, { ...pivot, source: { table: "Missing" } }).error
    ).toBe("source");
  });
});

describe("GETPIVOTDATA", () => {
  function withReport() {
    const s = setup();
    update(s.ctx, s.pivot, {
      rows: ["Region"],
      columns: ["Product"],
      values: [SUM_SALES],
    });
    return s;
  }

  test("reads values of the report", () => {
    const { ctx } = withReport();
    const get = (...pairs) => getPivotData(ctx, "id_2", 2, 0, "Sales", pairs);
    expect(get()).toBe(210);
    expect(get(["Region", "East"])).toBe(80);
    expect(get(["Region", "east"], ["Product", "Pen"])).toBe(60);
    expect(get(["Product", "Cup"])).toBe(60);
    expect(get(["Region", "Nowhere"])).toBe("#REF!");
    expect(get(["Nope", "East"])).toBe("#REF!");
    expect(getPivotData(ctx, "id_2", 2, 0, "Sum of Sales", [])).toBe(210);
    expect(getPivotData(ctx, "id_2", 2, 0, "Other", [])).toBe("#REF!");
    expect(getPivotData(ctx, "id_2", 20, 9, "Sales", [])).toBe("#REF!");
  });

  test("as a formula, following refreshes", () => {
    const { ctx, pivot } = withReport();
    input(
      ctx,
      "H1",
      '=GETPIVOTDATA("Sales",\'My Sheet\'!$A$3,"Region","West")'
    );
    expect(value(ctx, "H1")).toBe(130);
    input(ctx, "H2", '=GETPIVOTDATA("Sales",\'My Sheet\'!$A$3,"Region","X")');
    expect(value(ctx, "H2")).toBe("#REF!");
    input(ctx, "D4", "100");
    refreshPivotTable(ctx, "id_2", pivot.id);
    expect(value(ctx, "H1")).toBe(200);
  });

  test("date groups and several values", () => {
    const { ctx, pivot } = setup();
    update(ctx, pivot, {
      rows: ["Date"],
      values: [SUM_SALES, { field: "Sales", aggregate: "count" }],
    });
    groupPivotDateField(ctx, "id_2", pivot.id, "Date", ["years"]);
    expect(
      getPivotData(ctx, "id_2", 2, 0, "Sum of Sales", [["Date", 2024]])
    ).toBe(150);
    expect(
      getPivotData(ctx, "id_2", 2, 0, "Count of Sales", [["Date", "2023"]])
    ).toBe(3);
  });
});

describe("fields pane helpers", () => {
  const base = {
    rows: ["Region"],
    columns: [],
    filters: [],
    values: [{ field: "Sales", aggregate: "sum" }],
    options: { layout: "compact" },
  };

  test("moving fields between areas", () => {
    expect(
      pivotMoveField(base, "Product", null, { area: "rows" }).rows
    ).toEqual(["Region", "Product"]);
    expect(
      pivotMoveField(base, "Product", null, { area: "rows", index: 0 }).rows
    ).toEqual(["Product", "Region"]);
    const toCols = pivotMoveField(
      base,
      "Region",
      { area: "rows", index: 0 },
      { area: "columns" }
    );
    expect(toCols.rows).toEqual([]);
    expect(toCols.columns).toEqual(["Region"]);
    const toFilter = pivotMoveField(base, "Region", null, { area: "filters" });
    expect(toFilter.filters).toEqual([{ field: "Region" }]);
    expect(toFilter.rows).toEqual([]);
    const toValues = pivotMoveField(
      base,
      "Region",
      { area: "rows", index: 0 },
      { area: "values" },
      "count"
    );
    expect(toValues.rows).toEqual([]);
    expect(toValues.values[1]).toEqual({ field: "Region", aggregate: "count" });
    const removed = pivotMoveField(
      base,
      "Sales",
      { area: "values", index: 0 },
      null
    );
    expect(removed.values).toEqual([]);
    const unchecked = pivotMoveField(base, "Region", null, null);
    expect(unchecked.rows).toEqual([]);
    const two = { ...base, rows: ["A", "B", "C"] };
    expect(
      pivotMoveField(
        two,
        "A",
        { area: "rows", index: 0 },
        { area: "rows", index: 2 }
      ).rows
    ).toEqual(["B", "A", "C"]);
  });

  test("Σ Values", () => {
    const many = { ...base, values: [base.values[0], base.values[0]] };
    expect(pivotAreaFields(many, "columns")).toEqual([PIVOT_VALUES_FIELD]);
    expect(
      pivotMoveField(many, PIVOT_VALUES_FIELD, null, { area: "rows" }).options
    ).toEqual({ valuesOnRows: true });
    expect(pivotAreaFields(base, "columns")).toEqual([]);
    expect(isPivotFieldUsed(base, "sales")).toBe(true);
    expect(isPivotFieldUsed(base, "Product")).toBe(false);
  });

  test("checks before applying", () => {
    const { ctx, pivot } = setup();
    input(ctx, "D6", "x", "id_2");
    expect(checkPivotUpdate(ctx, "id_2", pivot.id, { rows: ["Region"] })).toBe(
      null
    );
    expect(
      checkPivotUpdate(ctx, "id_2", pivot.id, {
        rows: ["Region"],
        columns: ["Product"],
        values: [SUM_SALES],
      })
    ).toBe("replaceData");
    expect(
      checkNewPivotTable(ctx, SOURCE, {
        newSheet: false,
        sheetId: "id_1",
        anchor: { r: 1, c: 1 },
      })
    ).toBe("location");
    expect(checkNewPivotTable(ctx, SOURCE)).toBeNull();
  });
});
