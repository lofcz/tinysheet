// Round trips of table details through xlsx (stream R14, T115): filter
// state, filter buttons, calculated columns, custom totals, style options
// and table slicers.
import test from "node:test";
import assert from "node:assert/strict";
import {
  importXlsx,
  patchZip,
  readWithExcelJS,
  roundTrip,
  sheetByName,
  zipText,
} from "./helpers.mjs";

function sheet(name, cells, extra = {}) {
  return {
    name,
    order: 0,
    celldata: Object.entries(cells).map(([rc, v]) => {
      const [r, c] = rc.split("_").map(Number);
      return { r, c, v };
    }),
    ...extra,
  };
}

const text = (s) => ({ v: s, m: s });
const num = (n) => ({ v: n, m: String(n), ct: { fa: "General", t: "n" } });

/** A1:C6 Region / Qty / Double (calculated), filtered to East + blank. */
function regionSheet(tableExtra = {}, sheetExtra = {}) {
  const cells = {
    "0_0": text("Region"),
    "0_1": text("Qty"),
    "0_2": text("Double"),
    "1_0": text("East"),
    "1_1": num(2),
    "2_0": text("West"),
    "2_1": num(1),
    "3_0": text("East"),
    "3_1": num(4),
    "4_0": text("North"),
    "4_1": num(3),
    "5_0": text("West"),
    "5_1": num(5),
    "6_0": text("Total"),
    "6_2": { v: 30, m: "30", f: "=SUM(Sales[Double])" },
  };
  for (let r = 1; r <= 5; r += 1) {
    const qty = cells[`${r}_1`].v;
    cells[`${r}_2`] = { v: qty * 2, m: String(qty * 2), f: "=[@Qty]*2" };
  }
  const table = {
    name: "Sales",
    range: { row: [0, 6], column: [0, 2] },
    headerRow: true,
    totalRow: true,
    bandedRows: true,
    bandedColumns: true,
    firstColumn: true,
    lastColumn: false,
    style: "TableStyleDark3",
    columns: [
      { name: "Region", totalFunction: "none", totalLabel: "Total" },
      { name: "Qty", totalFunction: "none" },
      {
        name: "Double",
        totalFunction: "custom",
        totalFormula: "=SUM(Sales[Double])",
        calculatedFormula: "=[@Qty]*2",
      },
    ],
    filters: {
      0: {
        condition: { type: "values", hidden: ["West", "North"] },
        rowhidden: { 2: 0, 4: 0, 5: 0 },
      },
      1: {
        condition: { type: "custom", op1: "greaterThan", value1: "1" },
        rowhidden: { 2: 0 },
      },
    },
    ...tableExtra,
  };
  return sheet("T", cells, {
    tables: [table],
    config: { rowhidden: { 2: 0, 4: 0, 5: 0 } },
    ...sheetExtra,
  });
}

test("table filters, calculated columns and custom totals are written", async () => {
  const { bytes, result } = await roundTrip([regionSheet()]);
  const part = await zipText(bytes, "xl/tables/table1.xml");
  assert.match(part, /<autoFilter ref="A1:C6">/);
  assert.match(
    part,
    /<filterColumn colId="0"><filters><filter val="East"\/><\/filters><\/filterColumn>/
  );
  assert.match(
    part,
    /<filterColumn colId="1"><customFilters><customFilter operator="greaterThan" val="1"\/><\/customFilters><\/filterColumn>/
  );
  assert.match(
    part,
    /<calculatedColumnFormula>Sales\[\[#This Row\],\[Qty\]\]\*2<\/calculatedColumnFormula>/
  );
  assert.match(
    part,
    /totalsRowFunction="custom"><calculatedColumnFormula>[^<]*<\/calculatedColumnFormula><totalsRowFormula>SUM\(Sales\[Double\]\)<\/totalsRowFormula>/
  );
  assert.match(part, /name="TableStyleDark3"/);
  assert.match(part, /showColumnStripes="1"/);
  assert.match(part, /showFirstColumn="1"/);
  // ExcelJS still reads the file
  const ws = (await readWithExcelJS(bytes)).getWorksheet("T");
  assert.ok(ws);

  const back = sheetByName(result, "T").tables[0];
  assert.equal(back.filterButton, undefined);
  assert.deepEqual(back.filters[0].condition.hidden.sort(), ["North", "West"]);
  assert.deepEqual(Object.keys(back.filters[0].rowhidden), ["2", "4", "5"]);
  assert.deepEqual(back.filters[1].condition, {
    type: "custom",
    op1: "greaterThan",
    value1: "1",
  });
  assert.equal(back.columns[2].calculatedFormula, "=[@Qty]*2");
  assert.equal(back.columns[2].totalFunction, "custom");
  // formulas inside the table read back unqualified, like its cells
  assert.equal(back.columns[2].totalFormula, "=SUM([Double])");
  assert.equal(back.style, "TableStyleDark3");
});

test("more filter kinds and filter buttons off", async () => {
  const on = await roundTrip([
    regionSheet({
      filters: {
        0: {
          condition: {
            type: "custom",
            op1: "beginsWith",
            value1: "E",
            join: "or",
            op2: "contains",
            value2: "or",
          },
          rowhidden: {},
        },
        1: {
          condition: { type: "top10", count: 2, bottom: true, percent: true },
          rowhidden: {},
        },
        2: { condition: { type: "average", below: true }, rowhidden: {} },
      },
    }),
  ]);
  const part = await zipText(on.bytes, "xl/tables/table1.xml");
  assert.match(
    part,
    /<customFilters><customFilter val="E\*"\/><customFilter val="\*or\*"\/><\/customFilters>/
  );
  assert.match(part, /<top10 top="0" percent="1" val="2"\/>/);
  assert.match(part, /<dynamicFilter type="belowAverage"\/>/);
  const back = sheetByName(on.result, "T").tables[0];
  assert.deepEqual(back.filters[0].condition, {
    type: "custom",
    op1: "beginsWith",
    value1: "E",
    join: "or",
    op2: "contains",
    value2: "or",
  });
  assert.deepEqual(back.filters[1].condition, {
    type: "top10",
    count: 2,
    bottom: true,
    percent: true,
  });
  assert.deepEqual(back.filters[2].condition, {
    type: "average",
    below: true,
  });

  const off = await roundTrip([
    regionSheet({ filterButton: false, filters: undefined }),
  ]);
  const offPart = await zipText(off.bytes, "xl/tables/table1.xml");
  assert.doesNotMatch(offPart, /<autoFilter/);
  assert.equal(sheetByName(off.result, "T").tables[0].filterButton, false);
});

test("table slicers round-trip through xl/slicers and xl/slicerCaches", async () => {
  const slicers = [
    {
      name: "Slicer_Region",
      column: "Region",
      caption: "Pick a region",
      showCaption: true,
      r: 1,
      c: 5,
      offsetX: 10,
      offsetY: 4,
      width: 200,
      height: 180,
      columnCount: 2,
      buttonHeight: 30,
      style: "SlicerStyleDark2",
      sortOrder: "descending",
      noDataLast: false,
    },
    {
      name: "Slicer_Qty",
      column: "Qty",
      caption: "Qty",
      showCaption: false,
      r: 12,
      c: 1,
      offsetX: 0,
      offsetY: 0,
      width: 150,
      height: 120,
      columnCount: 1,
      buttonHeight: 26,
      style: "SlicerStyleLight3",
    },
  ];
  const { bytes, result } = await roundTrip([regionSheet({ slicers })]);

  const cache = await zipText(bytes, "xl/slicerCaches/slicerCache1.xml");
  assert.match(cache, /name="Slicer_Region" sourceName="Region"/);
  assert.match(
    cache,
    /<x15:tableSlicerCache tableId="1" column="1" sortOrder="descending" crossFilter="showItemsWithNoData"\/>/
  );
  const part = await zipText(bytes, "xl/slicers/slicer1.xml");
  assert.match(
    part,
    /<slicer name="Pick a region" cache="Slicer_Region" caption="Pick a region" columnCount="2" style="SlicerStyleDark2" rowHeight="285750"\/>/
  );
  assert.match(part, /cache="Slicer_Qty"[^>]*showCaption="0"/);
  const wb = await zipText(bytes, "xl/workbook.xml");
  assert.match(wb, /<definedName name="Slicer_Region">#N\/A<\/definedName>/);
  assert.match(wb, /<x15:slicerCaches[^>]*><x14:slicerCache r:id="rId\d+"\/>/);
  const wbRels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  assert.match(
    wbRels,
    /relationships\/slicerCache" Target="slicerCaches\/slicerCache1.xml"/
  );
  const sheetXml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(sheetXml, /<x14:slicerList[^>]*><x14:slicer r:id="rId\d+"\/>/);
  assert.match(sheetXml, /<drawing r:id="rId\d+"\/>/);
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(
    types,
    /\/xl\/slicers\/slicer1.xml" ContentType="application\/vnd.ms-excel.slicer\+xml"/
  );
  assert.match(types, /\/xl\/slicerCaches\/slicerCache2.xml"/);
  const drawing = await zipText(bytes, "xl/drawings/drawing1.xml");
  assert.match(drawing, /<sle:slicer [^>]*name="Pick a region"\/>/);
  assert.match(
    drawing,
    /<xdr:from><xdr:col>5<\/xdr:col><xdr:colOff>95250<\/xdr:colOff><xdr:row>1<\/xdr:row><xdr:rowOff>38100<\/xdr:rowOff><\/xdr:from>/
  );

  const back = sheetByName(result, "T").tables[0];
  assert.equal(back.slicers.length, 2);
  const [region, qty] = back.slicers;
  assert.deepEqual(
    {
      ...region,
    },
    { ...slicers[0] }
  );
  assert.equal(qty.name, "Slicer_Qty");
  assert.equal(qty.column, "Qty");
  assert.equal(qty.showCaption, false);
  assert.equal(qty.style, "SlicerStyleLight3");
  assert.deepEqual([qty.r, qty.c, qty.width, qty.height], [12, 1, 150, 120]);
  // the slicer's selection is the table's filter
  assert.deepEqual(back.filters[0].condition.hidden.sort(), ["North", "West"]);
});

test("slicer caches of another table and pivot slicers are skipped", async () => {
  const { bytes } = await roundTrip([
    regionSheet({
      slicers: [
        {
          name: "Slicer_Region",
          column: "Region",
          caption: "Region",
          r: 0,
          c: 5,
          offsetX: 0,
          offsetY: 0,
          width: 180,
          height: 240,
        },
      ],
    }),
  ]);
  // point the cache at a table id that does not exist
  const patched = await patchZip(bytes, {
    "xl/slicerCaches/slicerCache1.xml": (xml) =>
      xml.replace('tableId="1"', 'tableId="9"'),
  });
  const result = await importXlsx(patched);
  const back = sheetByName(result, "T").tables[0];
  assert.equal(back.slicers, undefined);
});
