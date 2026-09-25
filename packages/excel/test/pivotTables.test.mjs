// PivotTables through xlsx: the report's cells are values; the definition
// (pivotCacheDefinition / pivotCacheRecords / pivotTable parts) is written
// so Excel opens a live PivotTable, and read back into sheet.pivotTables.
import test from "node:test";
import assert from "node:assert/strict";
import { cellMap, importXlsx, sheetByName, zipText } from "./helpers.mjs";
import { exportToXlsx, parsePivotTableXml } from "../dist/index.js";

const SALES = [
  ["Region", "Product", "Sales"],
  ["East", "Pen", 10],
  ["East", "Book", 20],
  ["West", "Pen", 30],
  ["West", "Book", 40],
  ["North", "Cup", 5],
];

async function workbookWithPivot(patch) {
  const core = await import("@lofcz/tinysheet-core");
  const grid = (rows, cols) =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );
  const data = grid(20, 8);
  SALES.forEach((row, r) =>
    row.forEach((v, c) => {
      data[r][c] =
        typeof v === "number"
          ? { v, m: String(v), ct: { fa: "General", t: "n" } }
          : { v, m: v, ct: { fa: "General", t: "g" } };
    })
  );
  const ctx = {
    ...core.defaultContext({ globalCache: {} }),
    currentSheetId: "data",
    luckysheetfile: [
      { name: "Data", id: "data", order: 0, data },
      { name: "Report", id: "report", order: 1, data: grid(30, 10) },
    ],
    formulaCache: new core.FormulaCache(),
    groupValuesRefreshData: [],
    hooks: {},
  };
  const { pivot, error } = core.createPivotTable(
    ctx,
    { sheetId: "data", range: { row: [0, 5], column: [0, 2] } },
    { newSheet: false, sheetId: "report", anchor: { r: 2, c: 0 } }
  );
  assert.equal(error, undefined);
  const res = core.updatePivotTable(ctx, "report", pivot.id, patch);
  assert.equal(res.error, undefined);
  return { core, ctx, pivot: ctx.luckysheetfile[1].pivotTables[0] };
}

test("export writes the report values and the PivotTable parts", async () => {
  const { ctx } = await workbookWithPivot({
    rows: ["Region"],
    columns: ["Product"],
    values: [{ field: "Sales", aggregate: "sum" }],
    fields: { Region: { sort: "desc", hiddenItems: ["s:north"] } },
    options: { grandTotalColumn: false },
  });
  const bytes = await exportToXlsx(ctx.luckysheetfile);
  const table = await zipText(bytes, "xl/pivotTables/pivotTable1.xml");
  const cache = await zipText(bytes, "xl/pivotCache/pivotCacheDefinition1.xml");
  const records = await zipText(bytes, "xl/pivotCache/pivotCacheRecords1.xml");
  assert.ok(table && cache && records);
  assert.match(cache, /<worksheetSource ref="A1:C6" sheet="Data"\/>/);
  assert.match(cache, /refreshOnLoad="1"/);
  assert.match(cache, /<cacheField name="Region"[^>]*><sharedItems count="3">/);
  assert.match(records, /count="5"/);
  assert.match(
    table,
    /<location ref="A3:C7" firstHeaderRow="1" firstDataRow="2" firstDataCol="1"\/>/
  );
  assert.match(table, /<pivotField axis="axisRow"[^>]*sortType="descending"/);
  assert.match(table, /<item x="1" h="1"\/>/);
  assert.match(table, /<rowFields count="1"><field x="0"\/><\/rowFields>/);
  assert.match(table, /<colFields count="1"><field x="1"\/><\/colFields>/);
  assert.match(table, /<dataField name="Sum of Sales" fld="2"/);
  assert.match(table, /rowGrandTotals="0"/);
  const workbook = await zipText(bytes, "xl/workbook.xml");
  assert.match(
    workbook,
    /<pivotCaches><pivotCache cacheId="100" r:id="rId\d+"\/><\/pivotCaches>/
  );
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(types, /pivotTable\+xml/);
  const rels = await zipText(bytes, "xl/worksheets/_rels/sheet2.xml.rels");
  assert.match(rels, /relationships\/pivotTable/);
  // values are in the cells
  const result = await importXlsx(bytes);
  const cells = cellMap(sheetByName(result, "Report"));
  assert.equal(cells.get("2_0").v, "Sum of Sales");
  assert.equal(cells.get("4_0").v, "West");
  assert.equal(cells.get("4_2").v, 30);
});

test("import reads the definition back into sheet.pivotTables", async () => {
  const { ctx, core } = await workbookWithPivot({
    rows: ["Region"],
    values: [
      { field: "Sales", aggregate: "sum" },
      { field: "Sales", aggregate: "average", showAs: "percentOfGrandTotal" },
    ],
    filters: [{ field: "Product", selected: ["s:pen"] }],
    options: { layout: "tabular", subtotals: "off", grandTotalRow: false },
  });
  const bytes = await exportToXlsx(ctx.luckysheetfile);
  const result = await importXlsx(bytes);
  const report = sheetByName(result, "Report");
  const data = sheetByName(result, "Data");
  assert.equal(report.pivotTables.length, 1);
  const [p] = report.pivotTables;
  assert.equal(p.name, "PivotTable1");
  assert.deepEqual(p.source, {
    sheetId: data.id,
    range: { row: [0, 5], column: [0, 2] },
  });
  assert.deepEqual(p.rows, ["Region"]);
  assert.deepEqual(p.filters, [{ field: "Product", selected: ["s:pen"] }]);
  assert.deepEqual(
    p.values.map((v) => [v.field, v.aggregate, v.showAs, v.name]),
    [
      ["Sales", "sum", undefined, undefined],
      ["Sales", "average", "percentOfGrandTotal", undefined],
    ]
  );
  assert.equal(p.options.layout, "tabular");
  assert.equal(p.options.grandTotalRow, false);
  assert.equal(p.options.grandTotalColumn, true);
  assert.deepEqual(p.anchor, { r: 2, c: 0 });
  assert.deepEqual(p.output.row, [0, 4]);

  // the imported model refreshes to the same report in TinySheet
  const grid = (sheet, rows, cols) => {
    const m = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );
    sheet.celldata.forEach((c) => {
      m[c.r][c.c] = c.v;
    });
    return m;
  };
  const ctx2 = {
    ...core.defaultContext({ globalCache: {} }),
    currentSheetId: data.id,
    luckysheetfile: [
      { ...data, data: grid(data, 20, 8) },
      { ...report, data: grid(report, 30, 10) },
    ],
    formulaCache: new core.FormulaCache(),
    groupValuesRefreshData: [],
    hooks: {},
  };
  const before = ctx.luckysheetfile[1].data
    .slice(0, 6)
    .map((r) => r.slice(0, 3).map((c) => c?.v ?? null));
  assert.equal(core.refreshPivotTable(ctx2, report.id, p.id).error, undefined);
  const after = ctx2.luckysheetfile[1].data
    .slice(0, 6)
    .map((r) => r.slice(0, 3).map((c) => c?.v ?? null));
  assert.deepEqual(after, before);
});

test("date-grouped PivotTables export their values only", async () => {
  const { ctx } = await workbookWithPivot({
    rows: ["Region"],
    values: [{ field: "Sales", aggregate: "sum" }],
    fields: { Region: {} },
  });
  ctx.luckysheetfile[1].pivotTables[0].rows = ["Region|years"];
  const bytes = await exportToXlsx(ctx.luckysheetfile);
  assert.equal(await zipText(bytes, "xl/pivotTables/pivotTable1.xml"), null);
});

test("Excel's date groups and page items are understood", async () => {
  const cache =
    '<pivotCacheDefinition><cacheSource type="worksheet"><worksheetSource ref="A1:C9" sheet="Data"/></cacheSource><cacheFields count="4">' +
    '<cacheField name="Date" numFmtId="14"><sharedItems containsSemiMixedTypes="0" containsNonDate="0" containsDate="1"/><fieldGroup par="3" base="0"><rangePr groupBy="months"/><groupItems count="14"><s v="&lt;1/1/2023"/><s v="Jan"/><s v="Feb"/></groupItems></fieldGroup></cacheField>' +
    '<cacheField name="Region" numFmtId="0"><sharedItems count="2"><s v="East"/><s v="West"/></sharedItems></cacheField>' +
    '<cacheField name="Sales" numFmtId="0"><sharedItems containsNumber="1"/></cacheField>' +
    '<cacheField name="Years" numFmtId="0" databaseField="0"><fieldGroup base="0"><rangePr groupBy="years"/><groupItems count="3"><s v="&lt;1/1/2023"/><s v="2023"/><s v="2024"/></groupItems></fieldGroup></cacheField>' +
    "</cacheFields></pivotCacheDefinition>";
  const table =
    '<pivotTableDefinition name="Sales by date" cacheId="1" dataCaption="Values"><location ref="A3:B10" firstHeaderRow="1" firstDataRow="1" firstDataCol="1" rowPageCount="1" colPageCount="1"/>' +
    '<pivotFields count="4"><pivotField axis="axisRow" showAll="0"><items count="3"><item x="0"/><item x="1"/><item t="default"/></items></pivotField>' +
    '<pivotField axis="axisPage" showAll="0"><items count="3"><item x="0"/><item x="1"/><item t="default"/></items></pivotField>' +
    '<pivotField dataField="1" showAll="0"/><pivotField axis="axisRow" showAll="0"/></pivotFields>' +
    '<rowFields count="2"><field x="3"/><field x="0"/></rowFields>' +
    '<pageFields count="1"><pageField fld="1" item="1" hier="-1"/></pageFields>' +
    '<dataFields count="1"><dataField name="Total" fld="2" subtotal="max"/></dataFields></pivotTableDefinition>';
  const p = parsePivotTableXml(table, cache, () => "sheet-data", "p1");
  assert.deepEqual(p.rows, ["Date|years", "Date"]);
  assert.deepEqual(p.fields.Date.dateGroups, ["years", "months"]);
  assert.deepEqual(p.filters, [{ field: "Region", selected: ["s:west"] }]);
  assert.deepEqual(p.values, [
    { field: "Sales", aggregate: "max", name: "Total" },
  ]);
  assert.deepEqual(p.output, { row: [0, 9], column: [0, 1] });
});
