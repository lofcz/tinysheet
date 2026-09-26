// Chart data assignment (Select Data Source, Edit Series, Chart Filters,
// Hidden and Empty Cells) survives xlsx export -> import: the SERIES
// formula of every series, filtered series and categories, and the chart
// elements of the Chart Design / Format tabs.
import test from "node:test";
import assert from "node:assert/strict";
import { seriesFormula } from "@lofcz/tinysheet-core";
import { roundTrip, zipText } from "./helpers.mjs";

const cell = (r, c, v) => ({
  r,
  c,
  v:
    typeof v === "number"
      ? { v, m: String(v), ct: { fa: "General", t: "n" } }
      : { v, m: v, ct: { fa: "General", t: "g" } },
});

const rows = (table) =>
  table.flatMap((row, r) =>
    row.map((v, c) => (v == null ? null : cell(r, c, v))).filter(Boolean)
  );

const ref = (sheetId, r1, r2, c1, c2) => ({
  sheetId,
  row: [r1, r2],
  column: [c1, c2],
});

function book() {
  const data = {
    name: "Data",
    id: "d1",
    order: 0,
    celldata: rows([
      ["Month", "Revenue", "Cost"],
      ["Jan", 120, 80],
      ["Feb", 135, 90],
      ["Mar", 150, 95],
      ["Apr", 110, 85],
    ]),
    charts: [
      {
        id: "c1",
        type: "line",
        grouping: "clustered",
        markers: true,
        series: [
          {
            nameRef: ref("d1", 0, 0, 1, 1),
            categories: ref("d1", 1, 4, 0, 0),
            values: ref("d1", 1, 4, 1, 1),
          },
          {
            // from another sheet, and a non-contiguous range
            nameRef: ref("o1", 0, 0, 0, 0),
            categories: ref("d1", 1, 4, 0, 0),
            values: {
              ...ref("d1", 1, 2, 2, 2),
              areas: [ref("d1", 4, 4, 2, 2)],
            },
          },
          {
            name: "Plan",
            categories: ref("d1", 1, 4, 0, 0),
            values: ref("d1", 1, 4, 2, 2),
            filtered: true,
          },
        ],
        hiddenCategories: [1],
        displayBlanksAs: "span",
        plotVisibleOnly: false,
        displayNaAsBlank: true,
        dataTable: { legendKeys: false },
        axes: { value: false },
        categoryGridlines: true,
        minorGridlines: true,
        dropLines: true,
        upDownBars: true,
        titleOverlay: true,
        title: "Sales",
        legend: "bottom",
        formats: {
          chartArea: { fill: "#fff2cc", line: null },
          plotArea: { fill: "#deebf7" },
          title: { text: "#c00000" },
          legend: { text: "#7030a0" },
        },
        left: 300,
        top: 20,
        width: 480,
        height: 288,
      },
    ],
  };
  const other = {
    name: "Other",
    id: "o1",
    order: 1,
    celldata: rows([
      ["Forecast", 7],
      [null, 8],
      [null, 9],
    ]),
  };
  return [data, other];
}

test("series assignments round-trip as the same SERIES formulas", async () => {
  const sheets = book();
  const before = sheets[0].charts[0].series.map((_, i) =>
    seriesFormula({ luckysheetfile: sheets }, sheets[0].charts[0], i)
  );
  assert.deepEqual(before, [
    "=SERIES(Data!$B$1,Data!$A$2:$A$5,Data!$B$2:$B$5,1)",
    "=SERIES(Other!$A$1,Data!$A$2:$A$5,(Data!$C$2:$C$3,Data!$C$5),2)",
    '=SERIES("Plan",Data!$A$2:$A$5,Data!$C$2:$C$5,3)',
  ]);
  const { bytes, result } = await roundTrip(sheets);
  const xml = await zipText(bytes, "xl/charts/chart1.xml");
  // Excel's own forms: union references, a filtered series, a full ref
  assert.match(xml, /<c:f>\(Data!\$C\$2:\$C\$3,Data!\$C\$5\)<\/c:f>/);
  assert.match(xml, /<c15:filteredLineSeries><c15:ser>/);
  assert.match(xml, /<c15:fullRef><c15:sqref>Data!\$B\$2:\$B\$5<\/c15:sqref>/);
  assert.match(xml, /<c:dispBlanksAs val="span"\/>/);
  assert.match(xml, /<c:plotVisOnly val="0"\/>/);
  assert.match(xml, /<c16r3:dispNaAsBlank val="1"\/>/);

  const imported = result.sheets.find((s) => s.name === "Data");
  const [chart] = imported.charts;
  const after = chart.series.map((_, i) =>
    seriesFormula({ luckysheetfile: result.sheets }, chart, i)
  );
  assert.deepEqual(after, before);
  assert.equal(chart.series[2].filtered, true);
  assert.deepEqual(chart.hiddenCategories, [1]);
  assert.equal(chart.displayBlanksAs, "span");
  assert.equal(chart.plotVisibleOnly, false);
  assert.equal(chart.displayNaAsBlank, true);
});

test("chart elements and formats round-trip", async () => {
  const { result } = await roundTrip(book());
  const [chart] = result.sheets.find((s) => s.name === "Data").charts;
  assert.deepEqual(chart.dataTable, { legendKeys: false });
  assert.deepEqual(chart.axes, { value: false });
  assert.equal(chart.categoryGridlines, true);
  assert.equal(chart.minorGridlines, true);
  assert.equal(chart.dropLines, true);
  assert.equal(chart.upDownBars, true);
  assert.equal(chart.titleOverlay, true);
  assert.equal(chart.legend, "bottom");
  assert.deepEqual(chart.formats.chartArea, { fill: "#FFF2CC", line: null });
  assert.deepEqual(chart.formats.plotArea, { fill: "#DEEBF7" });
  assert.equal(chart.formats.title.text, "#C00000");
  assert.equal(chart.formats.legend.text, "#7030A0");
});
