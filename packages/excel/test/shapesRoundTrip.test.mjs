// Shapes and text boxes (T112): DrawingML `xdr:sp` / `xdr:cxnSp` /
// `xdr:grpSp` export into the sheet's drawing part and import back as live
// shapes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importXlsx, readWithExcelJS, roundTrip, zipText } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const at = (r, c, dx = 0, dy = 0) => ({ r, c, dx, dy });

const shapes = [
  {
    id: "tb",
    name: "TextBox 1",
    alt: "Title box",
    prst: "rect",
    textBox: true,
    from: at(1, 1),
    to: at(3, 4, 10, 5),
    fill: { color: "#FFFFFF" },
    line: { color: "#000000", width: 1 },
    text: {
      anchor: "t",
      paragraphs: [
        {
          align: "l",
          runs: [
            { text: "Bold ", b: true, size: 14 },
            { text: "red", i: true, u: true, color: "#C00000" },
          ],
        },
        { align: "r", runs: [{ text: "second line" }] },
      ],
    },
  },
  {
    id: "rr",
    name: "Rounded 2",
    prst: "roundRect",
    adj: { adj: 30000 },
    from: at(5, 1, 4, 2),
    to: at(9, 3),
    rot: 30,
    flipH: true,
    fill: { color: "#4472C4", transparency: 0.25 },
    line: { color: "#2F528F", width: 2, dash: "dash" },
    shadow: true,
    text: {
      anchor: "b",
      wrap: false,
      paragraphs: [{ align: "ctr", runs: [{ text: "Plan" }] }],
    },
  },
  {
    id: "ln",
    name: "Arrow 3",
    prst: "line",
    from: at(11, 1),
    to: at(14, 3),
    flipV: true,
    line: { color: "#7030A0", width: 1.5, head: "triangle", tail: "triangle" },
  },
  {
    id: "g1",
    name: "Oval 4",
    prst: "ellipse",
    from: at(5, 5),
    to: at(8, 6),
    fill: { color: "#70AD47" },
    line: null,
    group: "grp",
  },
  {
    id: "g2",
    name: "Star 5",
    prst: "star5",
    from: at(8, 6, 20),
    to: at(12, 8),
    fill: null,
    line: { color: "#BF9000", width: 1 },
    group: "grp",
  },
];

const sheet = (extra = {}) => ({
  name: "Sheet1",
  order: 0,
  celldata: [{ r: 0, c: 0, v: { v: "x", m: "x" } }],
  shapes,
  ...extra,
});

test("shapes are written as DrawingML in one drawing part", async () => {
  const { bytes } = await roundTrip([sheet()]);
  const drawing = await zipText(bytes, "xl/drawings/drawing1.xml");
  assert.ok(drawing, "drawing part written");
  assert.equal(await zipText(bytes, "xl/drawings/drawing2.xml"), null);
  assert.match(drawing, /<xdr:sp macro="" textlink="">/);
  assert.match(drawing, /<xdr:cNvSpPr txBox="1"\/>/);
  assert.match(
    drawing,
    /<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"\/>/
  );
  assert.match(drawing, /<a:xfrm rot="1800000" flipH="1">/);
  assert.match(drawing, /<xdr:cxnSp macro="">/);
  assert.match(
    drawing,
    /<a:headEnd type="triangle"\/><a:tailEnd type="triangle"\/>/
  );
  assert.match(drawing, /<xdr:grpSp>/);
  assert.match(drawing, /<a:outerShdw/);
  assert.match(drawing, /<a:alpha val="75000"\/>/);
  const sheetXml = await zipText(bytes, "xl/worksheets/sheet1.xml");
  assert.match(sheetXml, /<drawing r:id="rId\d+"\/>/);
  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(types, /PartName="\/xl\/drawings\/drawing1.xml"/);
  // exceljs (what Excel-compatible readers see) still opens the file
  const wb = await readWithExcelJS(bytes);
  assert.equal(wb.worksheets[0].name, "Sheet1");
});

test("shapes survive export -> import", async () => {
  const { result } = await roundTrip([sheet()]);
  const back = result.sheets[0].shapes;
  assert.equal(back.length, 5);
  const [tb, rr, ln, g1, g2] = back;

  assert.equal(tb.prst, "rect");
  assert.equal(tb.textBox, true);
  assert.equal(tb.name, "TextBox 1");
  assert.equal(tb.alt, "Title box");
  assert.deepEqual(tb.from, at(1, 1));
  assert.deepEqual(tb.to, at(3, 4, 10, 5));
  assert.equal(tb.text.anchor, "t");
  assert.equal(tb.text.paragraphs.length, 2);
  const [r1, r2] = tb.text.paragraphs[0].runs;
  assert.equal(r1.text, "Bold ");
  assert.equal(r1.b, true);
  assert.equal(r1.size, 14);
  assert.equal(r2.text, "red");
  assert.equal(r2.i, true);
  assert.equal(r2.u, true);
  assert.equal(r2.color, "#C00000");
  assert.equal(tb.text.paragraphs[1].align, "r");

  assert.equal(rr.prst, "roundRect");
  assert.deepEqual(rr.adj, { adj: 30000 });
  assert.equal(rr.rot, 30);
  assert.equal(rr.flipH, true);
  assert.equal(rr.fill.color, "#4472C4");
  assert.equal(rr.fill.transparency, 0.25);
  assert.equal(rr.line.color, "#2F528F");
  assert.equal(rr.line.width, 2);
  assert.equal(rr.line.dash, "dash");
  assert.equal(rr.shadow, true);
  assert.equal(rr.text.anchor, "b");
  assert.equal(rr.text.wrap, false);
  assert.equal(rr.text.paragraphs[0].runs[0].text, "Plan");
  // the white text TinySheet draws on a filled shape is written explicitly
  assert.equal(rr.text.paragraphs[0].runs[0].color, "#FFFFFF");

  assert.equal(ln.prst, "line");
  assert.equal(ln.flipV, true);
  assert.equal(ln.fill, null);
  assert.equal(ln.line.head, "triangle");
  assert.equal(ln.line.tail, "triangle");
  assert.equal(ln.line.width, 1.5);

  assert.ok(g1.group);
  assert.equal(g1.group, g2.group);
  assert.equal(g1.prst, "ellipse");
  assert.equal(g1.line, null);
  assert.equal(g2.fill, null);
  // group children keep their cells (within rounding)
  assert.deepEqual({ r: g1.from.r, c: g1.from.c }, { r: 5, c: 5 });
  assert.deepEqual({ r: g2.to.r, c: g2.to.c }, { r: 12, c: 8 });
  assert.ok(Math.abs(g2.from.dx - 20) < 0.5);
});

test("shapes join the drawing of pictures", async () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const { bytes, result } = await roundTrip([
    sheet({
      images: [
        {
          id: "img1",
          type: "3",
          src: png,
          left: 400,
          top: 10,
          width: 40,
          height: 40,
        },
      ],
    }),
  ]);
  assert.equal(await zipText(bytes, "xl/drawings/drawing2.xml"), null);
  const drawing = await zipText(bytes, "xl/drawings/drawing1.xml");
  assert.match(drawing, /<xdr:pic>/);
  assert.match(drawing, /<xdr:sp /);
  const ids = [...drawing.matchAll(/<xdr:cNvPr id="(\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "object ids are unique");
  assert.equal(result.sheets[0].shapes.length, 5);
  assert.equal((result.sheets[0].images || []).length, 1);
});

test("a Google Sheets drawing group imports as live grouped shapes", async () => {
  const buffer = await fs.readFile(
    path.join(__dirname, "fixtures", "issue17336_drawing_objects.xlsx")
  );
  const result = await importXlsx(buffer, "drawing.xlsx");
  const [s] = result.sheets;
  const live = s.shapes || [];
  assert.equal(live.length, 3);
  assert.deepEqual(
    live.map((x) => x.prst),
    ["rect", "rightArrow", "ellipse"]
  );
  assert.ok(live.every((x) => x.group && x.group === live[0].group));
  assert.equal(live[0].text.paragraphs[0].runs[0].text, "四角い頭が");
  assert.equal(live[0].text.paragraphs[0].runs[0].size, 14);
  assert.equal(live[0].text.anchor, "ctr");
  assert.equal(live[0].fill.color, "#CFE2F3");
  assert.equal(live[0].line.color, "#000000");
  assert.deepEqual(live[1].adj, { adj1: 50000, adj2: 50000 });
  // text without a colour is black, as Excel draws it
  assert.equal(live[2].text.defaults.color, "#000000");
});
