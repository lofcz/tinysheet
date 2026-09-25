import { makeContext, input, value, cell } from "../formula/helpers";
import {
  convertTableToRange,
  createTable,
  findTable,
  resizeTable,
  setTableOptions,
  setTableTotalFunction,
  TABLE_STYLES,
  TABLE_STYLE_GROUPS,
  fillCalculatedColumn,
  undoCalculatedColumn,
  checkHeaderRow,
} from "../../src/modules/tables";
import {
  addTableSlicers,
  clearSlicerFilter,
  clearTableFilters,
  findSlicer,
  getSlicerItems,
  reapplyTableFilters,
  removeSlicer,
  selectSlicerItem,
  setSlicerSelection,
  setTableColumnFilter,
  tableFilterScope,
  updateSlicer,
} from "../../src/modules/tableFilter";
import {
  applyFilterCondition,
  clearColumnFilter,
  clearFilter,
  createFilter,
  getColumnFilterCondition,
  saveFilter,
} from "../../src/modules/filter";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import {
  expectUndoRedo,
  makeHost,
  type as typeInto,
  val,
} from "../editing/historyHarness";

function fill(ctx, entries, sheetId = "id_1") {
  Object.entries(entries).forEach(([a1, v]) => input(ctx, a1, v, sheetId));
}

/** A1:C6 = Region / Item / Qty with five rows, as Table1. */
function regionTable(ctx) {
  fill(ctx, {
    A1: "Region",
    B1: "Item",
    C1: "Qty",
    A2: "East",
    B2: "Pen",
    C2: "2",
    A3: "West",
    B3: "Book",
    C3: "1",
    A4: "East",
    B4: "Book",
    C4: "4",
    A5: "North",
    B5: "Cup",
    C5: "3",
    A6: "West",
    B6: "Pen",
    C6: "5",
  });
  const res = createTable(ctx, "id_1", { row: [0, 5], column: [0, 2] });
  expect(res.error).toBeUndefined();
  ctx.config = ctx.luckysheetfile[0].config ?? {};
  return res.table;
}

const hiddenRows = (ctx) =>
  Object.keys(ctx.luckysheetfile[0].config?.rowhidden ?? {})
    .map(Number)
    .sort((a, b) => a - b);

describe("table filters", () => {
  test("a value filter hides rows and the total row follows", () => {
    const ctx = makeContext();
    regionTable(ctx);
    setTableOptions(ctx, "Table1", { totalRow: true });
    expect(value(ctx, "C7")).toBe(15);
    setTableColumnFilter(ctx, "Table1", 0, {
      type: "values",
      hidden: ["West"],
    });
    expect(hiddenRows(ctx)).toEqual([2, 5]);
    const { table } = findTable(ctx, "Table1");
    expect(table.filters[0].condition.hidden).toEqual(["West"]);
    expect(value(ctx, "C7")).toBe(9);
    clearTableFilters(ctx, "Table1");
    expect(hiddenRows(ctx)).toEqual([]);
    expect(value(ctx, "C7")).toBe(15);
  });

  test("conditions and reapply after edits", () => {
    const ctx = makeContext();
    regionTable(ctx);
    setTableColumnFilter(ctx, "Table1", 2, {
      type: "custom",
      op1: "greaterThan",
      value1: "2",
    });
    expect(hiddenRows(ctx)).toEqual([1, 2]);
    input(ctx, "C2", "10");
    reapplyTableFilters(ctx, "Table1");
    expect(hiddenRows(ctx)).toEqual([2]);
  });

  test("the filter menu acts on the table while it has the scope", () => {
    const ctx = makeContext();
    regionTable(ctx);
    ctx.filterScope = { sheetId: "id_1", table: "Table1" };
    expect(tableFilterScope(ctx).table.name).toBe("Table1");
    // checklist: rows 2 and 5 unchecked (West)
    saveFilter(ctx, true, { 2: 0, 5: 0 }, { type: "values" }, 0, 5, 0, 0, 2);
    expect(hiddenRows(ctx)).toEqual([2, 5]);
    expect(findTable(ctx, "Table1").table.filters[0].condition).toEqual({
      type: "values",
      hidden: ["West"],
    });
    expect(ctx.filter ?? {}).toEqual({});
    applyFilterCondition(ctx, 2, { type: "average", below: true });
    expect(getColumnFilterCondition(ctx, 2)).toEqual({
      type: "average",
      below: true,
    });
    // Qty 2,1,4,3,5: average 3, below: 2 and 1 (rows 1, 2); West hides 2, 5
    expect(hiddenRows(ctx)).toEqual([2, 3, 4, 5]);
    clearColumnFilter(ctx, 0);
    expect(hiddenRows(ctx)).toEqual([3, 4, 5]);
    clearFilter(ctx);
    expect(hiddenRows(ctx)).toEqual([]);
    expect(findTable(ctx, "Table1").table.filters).toBeUndefined();
  });

  test("the sheet autofilter and table filters coexist", () => {
    const ctx = makeContext();
    regionTable(ctx);
    fill(ctx, { E1: "N", E2: "1", E3: "2", E4: "3" });
    ctx.luckysheet_select_save = [{ row: [0, 3], column: [4, 4] }];
    createFilter(ctx);
    expect(ctx.luckysheet_filter_save.column).toEqual([4, 4]);
    // the autofilter hides row 3 (E4), the table hides row 1 (East... Pen)
    saveFilter(ctx, true, { 3: 0 }, { type: "values" }, 0, 3, 4, 4, 4);
    setTableColumnFilter(ctx, "Table1", 1, { type: "values", hidden: ["Pen"] });
    expect(hiddenRows(ctx)).toEqual([1, 3, 5]);
    // clearing the autofilter keeps the table's rows hidden
    saveFilter(ctx, false, {}, null, 0, 3, 4, 4, 4);
    expect(hiddenRows(ctx)).toEqual([1, 5]);
    // a row both hide stays hidden until both release it
    saveFilter(ctx, true, { 1: 0 }, { type: "values" }, 0, 3, 4, 4, 4);
    setTableColumnFilter(ctx, "Table1", 1, null);
    expect(hiddenRows(ctx)).toEqual([1]);
  });

  test("Filter inside a table toggles its buttons", () => {
    const ctx = makeContext();
    regionTable(ctx);
    setTableColumnFilter(ctx, "Table1", 0, {
      type: "values",
      hidden: ["East"],
    });
    ctx.luckysheet_select_save = [
      { row: [2, 2], column: [1, 1], row_focus: 2, column_focus: 1 },
    ];
    createFilter(ctx);
    const { table } = findTable(ctx, "Table1");
    expect(table.filterButton).toBe(false);
    expect(table.filters).toBeUndefined();
    expect(hiddenRows(ctx)).toEqual([]);
    expect(ctx.luckysheet_filter_save).toBeUndefined();
    createFilter(ctx);
    expect(findTable(ctx, "Table1").table.filterButton).toBe(true);
  });

  test("filters follow inserted rows and deleted columns", () => {
    const ctx = makeContext({ rows: 14 });
    regionTable(ctx);
    setTableColumnFilter(ctx, "Table1", 2, {
      type: "custom",
      op1: "greaterThan",
      value1: "3",
    });
    expect(
      Object.keys(findTable(ctx, "Table1").table.filters[2].rowhidden)
    ).toEqual(["1", "2", "4"]);
    insertRowCol(ctx, {
      type: "row",
      index: 1,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(
      Object.keys(findTable(ctx, "Table1").table.filters[2].rowhidden)
    ).toEqual(["2", "3", "5"]);
    deleteRowCol(ctx, { type: "column", start: 0, end: 0, id: "id_1" });
    const { table } = findTable(ctx, "Table1");
    expect(table.columns.map((c) => c.name)).toEqual(["Item", "Qty"]);
    expect(Object.keys(table.filters)).toEqual(["1"]);
  });

  test("table filters are undoable", () => {
    const host = makeHost();
    const t = (a1, v) => typeInto(host, a1, v);
    [
      ["A1", "Region"],
      ["B1", "Qty"],
      ["A2", "East"],
      ["B2", "1"],
      ["A3", "West"],
      ["B3", "2"],
    ].forEach(([a1, v]) => t(a1, v));
    host.act((d) => {
      createTable(d, "id_1", { row: [0, 2], column: [0, 1] });
    });
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        setTableColumnFilter(d, "Table1", 0, {
          type: "values",
          hidden: ["West"],
        });
      })
    );
    expect(Object.keys(host.ctx.config.rowhidden)).toEqual(["2"]);
    expect(val(host.ctx, "B2")).toBe(1);
  });
});

describe("slicers", () => {
  test("items, single and multi select, clear", () => {
    const ctx = makeContext();
    regionTable(ctx);
    const [slicer] = addTableSlicers(ctx, "Table1", ["Region"]);
    expect(slicer.name).toBe("Slicer_Region");
    expect(slicer.caption).toBe("Region");
    expect(slicer.c).toBe(4);
    const items = () => {
      const found = findSlicer(ctx, "Slicer_Region");
      return getSlicerItems(ctx, "id_1", found.ref.table, found.slicer);
    };
    expect(items().map((x) => x.text)).toEqual(["East", "North", "West"]);
    expect(items().every((x) => x.selected && x.hasData)).toBe(true);

    selectSlicerItem(ctx, "Slicer_Region", "East", false);
    expect(items().map((x) => x.selected)).toEqual([true, false, false]);
    expect(hiddenRows(ctx)).toEqual([2, 4, 5]);
    // multi-select adds and removes items
    selectSlicerItem(ctx, "Slicer_Region", "West", true);
    expect(hiddenRows(ctx)).toEqual([4]);
    selectSlicerItem(ctx, "Slicer_Region", "East", true);
    expect(items().map((x) => x.selected)).toEqual([false, false, true]);
    // the header filter shows the same state
    expect(findTable(ctx, "Table1").table.filters[0].condition).toEqual({
      type: "values",
      hidden: ["East", "North"],
    });
    clearSlicerFilter(ctx, "Slicer_Region");
    expect(hiddenRows(ctx)).toEqual([]);
    // selecting everything is no filter
    setSlicerSelection(ctx, "Slicer_Region", ["East", "West", "North"]);
    expect(findTable(ctx, "Table1").table.filters).toBeUndefined();
  });

  test("two slicers combine; items with no data are greyed and last", () => {
    const ctx = makeContext();
    regionTable(ctx);
    addTableSlicers(ctx, "Table1", ["Region", "Item"]);
    expect(findSlicer(ctx, "Slicer_Item").slicer.offsetX).toBe(24);
    selectSlicerItem(ctx, "Slicer_Region", "West", false);
    const item = findSlicer(ctx, "Slicer_Item");
    const list = getSlicerItems(ctx, "id_1", item.ref.table, item.slicer);
    expect(list.map((x) => [x.text, x.hasData])).toEqual([
      ["Book", true],
      ["Pen", true],
      ["Cup", false],
    ]);
    selectSlicerItem(ctx, "Slicer_Item", "Pen", false);
    // West AND Pen: only row 6
    expect(hiddenRows(ctx)).toEqual([1, 2, 3, 4]);
    updateSlicer(ctx, "Slicer_Item", { hideNoData: true, columnCount: 3 });
    const again = findSlicer(ctx, "Slicer_Item");
    expect(
      getSlicerItems(ctx, "id_1", again.ref.table, again.slicer).map(
        (x) => x.text
      )
    ).toEqual(["Book", "Pen"]);
    expect(again.slicer.columnCount).toBe(3);
    // removing a slicer clears its filter
    removeSlicer(ctx, "Slicer_Item");
    expect(findSlicer(ctx, "Slicer_Item")).toBeNull();
    expect(hiddenRows(ctx)).toEqual([1, 3, 4]);
  });

  test("slicers follow column renames and go away with their table", () => {
    const ctx = makeContext();
    regionTable(ctx);
    addTableSlicers(ctx, "Table1", ["Region"]);
    selectSlicerItem(ctx, "Slicer_Region", "North", false);
    input(ctx, "A1", "Area");
    expect(findSlicer(ctx, "Slicer_Region").slicer.column).toBe("Area");
    // a second slicer on another table name gets a unique name
    fill(ctx, { A9: "Region", A10: "x" });
    createTable(ctx, "id_1", { row: [8, 9], column: [0, 0] });
    const [second] = addTableSlicers(ctx, "Table2", ["Region"]);
    expect(second.name).toBe("Slicer_Region1");
    convertTableToRange(ctx, "Table1");
    expect(findSlicer(ctx, "Slicer_Region")).toBeNull();
    // the rows the table filter hid are shown again
    expect(hiddenRows(ctx)).toEqual([]);
  });

  test("slicer anchors shift with inserted rows and columns", () => {
    const ctx = makeContext({ rows: 14, cols: 10 });
    regionTable(ctx);
    addTableSlicers(ctx, "Table1", ["Qty"], { r: 2, c: 5 });
    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    insertRowCol(ctx, {
      type: "column",
      index: 4,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    const { slicer } = findSlicer(ctx, "Slicer_Qty");
    expect([slicer.r, slicer.c]).toEqual([4, 6]);
  });

  test("slicer changes are undoable", () => {
    const host = makeHost();
    [
      ["A1", "Region"],
      ["A2", "East"],
      ["A3", "West"],
    ].forEach(([a1, v]) => typeInto(host, a1, v));
    host.act((d) => {
      createTable(d, "id_1", { row: [0, 2], column: [0, 0] });
    });
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        addTableSlicers(d, "Table1", ["Region"]);
      })
    );
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        selectSlicerItem(d, "Slicer_Region", "East", false);
      })
    );
    expectUndoRedo(host, (h) =>
      h.act((d) => {
        updateSlicer(d, "Slicer_Region", { offsetX: 40, width: 300 });
      })
    );
    expect(findSlicer(host.ctx, "Slicer_Region").slicer.width).toBe(300);
  });
});

describe("table polish", () => {
  test("a formula in an empty column becomes a calculated column", () => {
    const ctx = makeContext();
    regionTable(ctx);
    input(ctx, "D1", "Double");
    input(ctx, "D2", "=C2*2");
    expect([2, 3, 4, 5, 6].map((r) => cell(ctx, `D${r}`).f)).toEqual([
      "=C2*2",
      "=C3*2",
      "=C4*2",
      "=C5*2",
      "=C6*2",
    ]);
    expect(value(ctx, "D6")).toBe(10);
    const { table } = findTable(ctx, "Table1");
    expect(table.columns[3].calculatedFormula).toBe("=C2*2");
    expect(ctx.tableAutoCorrect).toMatchObject({
      table: "Table1",
      column: 3,
      kind: "created",
    });
    // new rows inherit it
    input(ctx, "A7", "South");
    expect(cell(ctx, "D7").f).toBe("=C7*2");
    // changing one formula of a calculated column changes the column
    input(ctx, "D3", "=[@Qty]*3");
    expect(cell(ctx, "D6").f).toBe("=[@Qty]*3");
    expect(value(ctx, "D6")).toBe(15);
    // Undo Calculated Column keeps the typed cell only
    undoCalculatedColumn(ctx, "Table1", 3, 2);
    expect(cell(ctx, "D3").f).toBe("=[@Qty]*3");
    expect(value(ctx, "D2")).toBeUndefined();
    expect(
      findTable(ctx, "Table1").table.columns[3].calculatedFormula
    ).toBeUndefined();
  });

  test("a column with data only offers to overwrite", () => {
    const ctx = makeContext();
    regionTable(ctx);
    input(ctx, "C2", "=1+1");
    expect(cell(ctx, "C3").f).toBeUndefined();
    expect(ctx.tableAutoCorrect).toMatchObject({ kind: "overwrite", r: 1 });
    fillCalculatedColumn(ctx, "Table1", 2, 1);
    expect(cell(ctx, "C6").f).toBe("=1+1");
    expect(findTable(ctx, "Table1").table.columns[2].calculatedFormula).toBe(
      "=1+1"
    );
  });

  test("inserted rows and a resized table inherit calculated columns", () => {
    const ctx = makeContext({ rows: 14 });
    regionTable(ctx);
    input(ctx, "D1", "Tax");
    input(ctx, "D2", "=[@Qty]/10");
    insertRowCol(ctx, {
      type: "row",
      index: 3,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cell(ctx, "D4").f).toBe("=[@Qty]/10");
    resizeTable(ctx, "Table1", { row: [0, 8], column: [0, 3] });
    expect(cell(ctx, "D9").f).toBe("=[@Qty]/10");
  });

  test("header row can be turned off and on", () => {
    const ctx = makeContext({ rows: 14 });
    fill(ctx, { A2: "Name", B2: "Qty", A3: "a", B3: "1", A4: "b", B4: "2" });
    createTable(ctx, "id_1", { row: [1, 3], column: [0, 1] });
    input(ctx, "D1", "=SUM(Table1[Qty])");
    expect(setTableOptions(ctx, "Table1", { headerRow: false })).toBeNull();
    let { table } = findTable(ctx, "Table1");
    expect(table.range.row).toEqual([2, 3]);
    expect(value(ctx, "A2")).toBeUndefined();
    expect(value(ctx, "D1")).toBe(3);
    expect(checkHeaderRow(ctx, "Table1")).toBeNull();
    expect(setTableOptions(ctx, "Table1", { headerRow: true })).toBeNull();
    ({ table } = findTable(ctx, "Table1"));
    expect(table.range.row).toEqual([1, 3]);
    expect(value(ctx, "B2")).toBe("Qty");
    // no room above the table
    setTableOptions(ctx, "Table1", { headerRow: false });
    input(ctx, "A2", "x");
    expect(setTableOptions(ctx, "Table1", { headerRow: true })).toBe(
      "noRoomAbove"
    );
  });

  test("style gallery groups and dark styles", () => {
    expect(TABLE_STYLE_GROUPS.light.length).toBeGreaterThan(3);
    expect(TABLE_STYLE_GROUPS.medium).toContain("TableStyleMedium2");
    expect(TABLE_STYLE_GROUPS.dark).toContain("TableStyleDark1");
    const ctx = makeContext();
    regionTable(ctx);
    setTableOptions(ctx, "Table1", { style: "TableStyleDark2" });
    const dark = TABLE_STYLES.TableStyleDark2;
    expect(cell(ctx, "A2").bg).toBe(dark.band);
    expect(cell(ctx, "A3").bg).toBe(dark.fill);
    expect(cell(ctx, "A3").fc).toBe("#FFFFFF");
    setTableOptions(ctx, "Table1", { style: "TableStyleLight1" });
    expect(cell(ctx, "A1").bg).toBeUndefined();
    expect(cell(ctx, "A1").fc).toBe("#000000");
    expect(cell(ctx, "A3").bg).toBeUndefined();
    expect(cell(ctx, "A3").fc).toBeUndefined();
    setTableOptions(ctx, "Table1", { bandedColumns: true, bandedRows: false });
    expect(cell(ctx, "A3").bg).toBe(TABLE_STYLES.TableStyleLight1.band);
    expect(cell(ctx, "B3").bg).toBeUndefined();
  });

  test("total row: qualified SUBTOTAL formulas and custom totals", () => {
    const ctx = makeContext();
    regionTable(ctx);
    setTableOptions(ctx, "Table1", { totalRow: true });
    setTableTotalFunction(ctx, "Table1", 2, "max");
    expect(cell(ctx, "C7").f).toBe("=SUBTOTAL(104,Table1[Qty])");
    expect(value(ctx, "C7")).toBe(5);
    setTableTotalFunction(
      ctx,
      "Table1",
      1,
      "custom",
      undefined,
      "=COUNTA(Table1[Item])"
    );
    expect(value(ctx, "B7")).toBe(5);
    // renaming the table rewrites the stored formulas too
    setTableOptions(ctx, "Table1", { name: "Sales" });
    expect(cell(ctx, "C7").f).toBe("=SUBTOTAL(104,Sales[Qty])");
    expect(findTable(ctx, "Sales").table.columns[1].totalFormula).toBe(
      "=COUNTA(Sales[Item])"
    );
  });
});

describe("total row edits", () => {
  test("typing into the total row makes a custom total or a label", () => {
    const ctx = makeContext();
    regionTable(ctx);
    setTableOptions(ctx, "Table1", { totalRow: true });
    input(ctx, "C7", "=SUM(C2:C6)*2");
    let col = findTable(ctx, "Table1").table.columns[2];
    expect(col.totalFunction).toBe("custom");
    expect(col.totalFormula).toBe("=SUM(C2:C6)*2");
    expect(value(ctx, "C7")).toBe(30);
    input(ctx, "C7", "Sum:");
    [, , col] = findTable(ctx, "Table1").table.columns;
    expect(col.totalFunction).toBe("none");
    expect(col.totalLabel).toBe("Sum:");
  });
});
