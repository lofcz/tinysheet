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

function pieBook(series) {
  return [
    {
      name: "Pie",
      id: "p1",
      order: 0,
      celldata: rows([
        ["Region", "Sales"],
        ["North", 10],
        ["South", 20],
        ["East", 30],
      ]),
      charts: [
        {
          id: "pie",
          type: "pie",
          series: [
            {
              nameRef: ref("p1", 0, 0, 1, 1),
              categories: ref("p1", 1, 3, 0, 0),
              values: ref("p1", 1, 3, 1, 1),
              ...series,
            },
          ],
          left: 200,
          top: 20,
          width: 320,
          height: 240,
        },
      ],
    },
  ];
}

test("pie outlines: no outline and per-slice outlines round-trip", async () => {
  const { bytes, result } = await roundTrip(
    pieBook({ outline: null, pointOutlines: { 1: "#FF0000", 2: null } })
  );
  const xml = await zipText(bytes, "xl/charts/chart1.xml");
  // the series' <a:ln><a:noFill/></a:ln>, and an a:ln inside each c:dPt
  assert.match(xml, /<c:tx>[^]*?<a:ln><a:noFill\/><\/a:ln><\/c:spPr>/);
  assert.match(
    xml,
    /<c:dPt><c:idx val="1"\/>[^]*?<a:ln w="9525"><a:solidFill><a:srgbClr val="FF0000"\/>/
  );
  const [chart] = result.sheets[0].charts;
  assert.equal(chart.series[0].outline, null);
  // point 2 has no outline like its series: nothing of its own
  assert.deepEqual(chart.series[0].pointOutlines, { 1: "#FF0000" });
});

test("pie default separators stay theme-coloured (no explicit outline)", async () => {
  const { bytes, result } = await roundTrip(pieBook({}));
  const xml = await zipText(bytes, "xl/charts/chart1.xml");
  assert.match(xml, /<a:schemeClr val="lt1"\/>/);
  const [chart] = result.sheets[0].charts;
  assert.equal(chart.series[0].outline, undefined);
  assert.equal(chart.series[0].pointOutlines, undefined);
});

test("axis number formats: linked to source and own codes round-trip", async () => {
  const money = (v) => ({
    v,
    m: v.toLocaleString("en-US"),
    ct: { fa: "#,##0", t: "n" },
  });
  const sheets = [
    {
      name: "Fmt",
      id: "f1",
      order: 0,
      celldata: [
        cell(0, 0, "Q"),
        cell(0, 1, "Sales"),
        cell(1, 0, "Q1"),
        { r: 1, c: 1, v: money(12000) },
        cell(2, 0, "Q2"),
        { r: 2, c: 1, v: money(15500) },
      ],
      charts: ["linked", "own"].map((id, i) => ({
        id,
        type: "column",
        series: [
          {
            nameRef: ref("f1", 0, 0, 1, 1),
            categories: ref("f1", 1, 2, 0, 0),
            values: ref("f1", 1, 2, 1, 1),
          },
        ],
        ...(id === "own"
          ? { valueAxis: { numberFormat: "0.0%", sourceLinked: false } }
          : {}),
        left: 200,
        top: 20 + i * 300,
        width: 320,
        height: 240,
      })),
    },
  ];
  // the cell matrix the app keeps next to celldata (chart caches read it)
  sheets[0].data = [0, 1, 2].map((r) =>
    [0, 1].map((c) => sheets[0].celldata.find((x) => x.r === r && x.c === c).v)
  );
  const { bytes, result } = await roundTrip(sheets);
  const linked = await zipText(bytes, "xl/charts/chart1.xml");
  assert.match(
    linked,
    /<c:valAx>[^]*<c:numFmt formatCode="#,##0" sourceLinked="1"\/>/
  );
  const own = await zipText(bytes, "xl/charts/chart2.xml");
  assert.match(
    own,
    /<c:valAx>[^]*<c:numFmt formatCode="0.0%" sourceLinked="0"\/>/
  );
  const [a, b] = result.sheets[0].charts;
  assert.equal(a.valueAxis?.sourceLinked, undefined);
  assert.deepEqual(b.valueAxis, { numberFormat: "0.0%", sourceLinked: false });
});

test("Shape Effects, Text Effects and WordArt round-trip", async () => {
  const sheets = pieBook({});
  const chart = sheets[0].charts[0];
  chart.type = "column";
  chart.title = "Sales";
  chart.series[0].effects = {
    glow: { color: "#ED7D31", size: 8 },
    softEdges: 2.5,
  };
  chart.formats = {
    chartArea: {
      effects: {
        shadow: { kind: "outer", dir: 45, dist: 3, blur: 4 },
        bevel: { preset: "circle" },
        rotation3d: "isometricLeftDown",
      },
    },
    plotArea: {
      effects: { shadow: { kind: "inner", dir: 90, dist: 3, blur: 5 } },
    },
    title: {
      text: "#4472C4",
      textOutline: "#FFFFFF",
      textEffects: {
        shadow: { kind: "outer", dir: 45, dist: 2, blur: 0, transparency: 0 },
        reflection: { size: 0.5, dist: 0 },
      },
    },
    legend: { textEffects: { glow: { color: "#70AD47", size: 5 } } },
  };
  const { bytes, result } = await roundTrip(sheets);
  const xml = await zipText(bytes, "xl/charts/chart1.xml");
  assert.match(xml, /<a:glow rad="101600">/);
  assert.match(xml, /<a:softEdge rad="31750"\/>/);
  assert.match(xml, /<a:camera prst="isometricLeftDown"\/>/);
  assert.match(xml, /<a:bevelT w="76200" h="76200" prst="circle"\/>/);
  assert.match(xml, /<a:innerShdw /);
  // the title run: outline, fill, effects in the schema's order
  assert.match(
    xml,
    /<a:rPr lang="en-US" sz="1400" b="0"><a:ln w="9525"><a:solidFill><a:srgbClr val="FFFFFF"\/><\/a:solidFill><\/a:ln><a:solidFill><a:srgbClr val="4472C4"\/><\/a:solidFill><a:effectLst>/
  );
  const [back] = result.sheets[0].charts;
  assert.deepEqual(back.series[0].effects, {
    glow: { color: "#ED7D31", size: 8 },
    softEdges: 2.5,
  });
  assert.deepEqual(back.formats.chartArea.effects, {
    shadow: { kind: "outer", dir: 45, dist: 3, blur: 4 },
    bevel: { preset: "circle" },
    rotation3d: "isometricLeftDown",
  });
  assert.equal(back.formats.plotArea.effects.shadow.kind, "inner");
  assert.equal(back.formats.title.textOutline, "#FFFFFF");
  assert.equal(back.formats.title.text, "#4472C4");
  assert.equal(back.formats.title.textEffects.shadow.blur, 0);
  assert.equal(back.formats.title.textEffects.reflection.size, 0.5);
  assert.deepEqual(back.formats.legend.textEffects, {
    glow: { color: "#70AD47", size: 5 },
  });
});

test("shapes drawn in a chart round-trip as its c:userShapes", async () => {
  const sheets = pieBook({});
  sheets[0].charts[0].shapes = [
    {
      id: "sh1",
      name: "Oval 1",
      prst: "ellipse",
      x: 0.1,
      y: 0.2,
      w: 0.3,
      h: 0.25,
      fill: { color: "#FFC000" },
      line: { color: "#000000", width: 1 },
      text: {
        paragraphs: [{ runs: [{ text: "Peak" }], align: "ctr" }],
        anchor: "ctr",
      },
      effects: { glow: { color: "#4472C4", size: 5 } },
    },
  ];
  const { bytes, result } = await roundTrip(sheets);
  const chartXml = await zipText(bytes, "xl/charts/chart1.xml");
  assert.match(
    chartXml,
    /<c:userShapes r:id="rIdUserShapes"\/><\/c:chartSpace>/
  );
  const rels = await zipText(bytes, "xl/charts/_rels/chart1.xml.rels");
  assert.match(
    rels,
    /relationships\/chartUserShapes" Target="..\/drawings\/drawing\d+\.xml"/
  );
  const target = /Target="..\/drawings\/(drawing\d+\.xml)"/.exec(rels)[1];
  const drawing = await zipText(bytes, `xl/drawings/${target}`);
  assert.match(
    drawing,
    /<cdr:relSizeAnchor[^>]*><cdr:from><cdr:x>0.1<\/cdr:x><cdr:y>0.2<\/cdr:y><\/cdr:from><cdr:to><cdr:x>0.4<\/cdr:x><cdr:y>0.45<\/cdr:y>/
  );
  assert.match(drawing, /<a:prstGeom prst="ellipse">/);
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(types, /drawingml\.chartshapes\+xml/);
  const [chart] = result.sheets[0].charts;
  assert.equal(chart.shapes.length, 1);
  const [s] = chart.shapes;
  assert.equal(s.prst, "ellipse");
  assert.equal(s.name, "Oval 1");
  assert.deepEqual([s.x, s.y, s.w, s.h], [0.1, 0.2, 0.3, 0.25]);
  assert.equal(s.fill.color, "#FFC000");
  assert.equal(s.text.paragraphs[0].runs[0].text, "Peak");
  assert.deepEqual(s.effects, { glow: { color: "#4472C4", size: 5 } });
});

test("Quick Layout 6: labels on the last point round-trip as c:dLbl", async () => {
  const sheets = pieBook({});
  const chart = sheets[0].charts[0];
  chart.type = "column";
  chart.dataLabels = true;
  chart.dataLabelOptions = { position: "outsideEnd", lastPointOnly: true };
  sheets[0].data = [0, 1, 2, 3].map((r) =>
    [0, 1].map((c) => sheets[0].celldata.find((x) => x.r === r && x.c === c)?.v)
  );
  const { bytes, result } = await roundTrip(sheets);
  const xml = await zipText(bytes, "xl/charts/chart1.xml");
  assert.match(
    xml,
    /<c:ser>[^]*<c:dLbls><c:dLbl><c:idx val="2"\/><c:dLblPos val="outEnd"\/><c:showLegendKey val="0"\/><c:showVal val="1"\/>/
  );
  const [back] = result.sheets[0].charts;
  assert.equal(back.dataLabels, true);
  assert.equal(back.dataLabelOptions.lastPointOnly, true);
  assert.equal(back.dataLabelOptions.position, "outsideEnd");
});

test("a chart sheet is written as a chartsheet part and read back", async () => {
  const [data] = pieBook({});
  const chart = data.charts[0];
  delete data.charts;
  const chartSheet = {
    name: "Chart1",
    id: "cs1",
    order: 1,
    chartSheet: true,
    showGridLines: 0,
    showRowColHeaders: false,
    celldata: [],
    charts: [{ ...chart, left: 0, top: 0, width: 864, height: 624 }],
  };
  const { bytes, result } = await roundTrip([data, chartSheet]);
  const part = await zipText(bytes, "xl/chartsheets/sheet1.xml");
  assert.match(
    part,
    /^<\?xml[^]*<chartsheet [^>]*>[^]*<drawing r:id="rId1"\/><\/chartsheet>$/
  );
  assert.match(part, /<pageSetup orientation="landscape"\/>/);
  const wbRels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  assert.match(
    wbRels,
    /Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/chartsheet" Target="chartsheets\/sheet1\.xml"/
  );
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(
    types,
    /PartName="\/xl\/chartsheets\/sheet1\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.chartsheet\+xml"/
  );
  // the drawing: one absolute anchor of the page size
  const rels = await zipText(bytes, "xl/chartsheets/_rels/sheet1.xml.rels");
  const drawing = /Target="..\/drawings\/(drawing\d+\.xml)"/.exec(rels)[1];
  const drawingXml = await zipText(bytes, `xl/drawings/${drawing}`);
  assert.match(
    drawingXml,
    /<xdr:absoluteAnchor><xdr:pos x="0" y="0"\/><xdr:ext cx="8229600" cy="5943600"\/>/
  );

  assert.equal(result.sheets.length, 2);
  const back = result.sheets.find((s) => s.name === "Chart1");
  assert.equal(back.chartSheet, true);
  assert.equal(back.charts.length, 1);
  assert.equal(back.charts[0].type, "pie");
  assert.equal(back.charts[0].width, 864);
  assert.equal(
    seriesFormula({ luckysheetfile: result.sheets }, back.charts[0], 0),
    "=SERIES(Pie!$B$1,Pie!$A$2:$A$4,Pie!$B$2:$B$4,1)"
  );
});
