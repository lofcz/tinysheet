const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const React = require("react");
const ReactDOMClient = require("react-dom/client");
const { JSDOM } = require("jsdom");
const ExcelJS = require("@protobi/exceljs");

const { transformExcelToFortune } = require("../dist/main.js");

const fixturePath = path.resolve(__dirname, "fixtures", "xls_preview.xlsx");
const drawingObjectsFixturePath = path.resolve(
  __dirname,
  "fixtures",
  "issue17336_drawing_objects.xlsx"
);
const openpyxlBarChartFixturePath = path.resolve(
  __dirname,
  "fixtures",
  "openpyxl_bar_chart.xlsx"
);

const toBuffer = (part) => {
  if (Buffer.isBuffer(part)) {
    return part;
  }

  if (part instanceof ArrayBuffer) {
    return Buffer.from(part);
  }

  if (ArrayBuffer.isView(part)) {
    return Buffer.from(part.buffer, part.byteOffset, part.byteLength);
  }

  if (typeof part === "string") {
    return Buffer.from(part);
  }

  throw new TypeError(`Unsupported file part: ${typeof part}`);
};

global.File = function TestFile(parts, name, options = {}) {
  const buffer = Buffer.concat(parts.map(toBuffer));
  buffer.name = name;
  buffer.type = options.type ?? "";
  buffer.lastModified = options.lastModified ?? Date.now();
  buffer.arrayBuffer = async () =>
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  buffer.text = async () => buffer.toString();
  return buffer;
};

global.window = {
  navigator: {
    userAgent: "node-test",
  },
};

const waitForDeferredSizing = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

const getCell = (sheet, row, column) =>
  sheet.celldata.find((cell) => cell.r === row && cell.c === column);

const loadWorkbookBufferIntoFortune = async (fileBuffer, fileName) => {
  const file = new File(
    [fileBuffer],
    fileName,
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );

  const setSheetsCalls = [];
  const setKeyCalls = [];
  const columnWidthCalls = [];
  const rowHeightCalls = [];

  const setSheets = (sheets) => {
    setSheetsCalls.push(sheets);
  };

  const setKey = (updater) => {
    setKeyCalls.push(updater);
  };

  const sheetRef = {
    current: {
      setColumnWidth: (config, meta) => {
        columnWidthCalls.push([config, meta]);
      },
      setRowHeight: (config, meta) => {
        rowHeightCalls.push([config, meta]);
      },
    },
  };

  await transformExcelToFortune(file, setSheets, setKey, sheetRef);
  await waitForDeferredSizing();

  return {
    setSheetsCalls,
    setKeyCalls,
    columnWidthCalls,
    rowHeightCalls,
  };
};

const loadFixtureIntoFortune = async () => {
  const fileBuffer = await fs.readFile(fixturePath);
  return loadWorkbookBufferIntoFortune(fileBuffer, "xls_preview.xlsx");
};

test("transformExcelToFortune converts xls_preview.xlsx into Fortune sheets", async () => {
  const {
    setSheetsCalls,
    setKeyCalls,
    columnWidthCalls,
    rowHeightCalls,
  } = await loadFixtureIntoFortune();

  assert.equal(setSheetsCalls.length, 1);
  assert.equal(setKeyCalls.length, 1);
  assert.equal(typeof setKeyCalls[0], "function");
  assert.equal(setKeyCalls[0](0), 1);

  const [sheets] = setSheetsCalls;
  assert.equal(sheets.length, 1);

  const [sheet] = sheets;
  assert.equal(sheet.name, "Feuille1");
  assert.equal(sheet.status, "1");
  assert.equal(sheet.order, "0");
  assert.equal(sheet.showGridLines, "1");
  assert.deepEqual(sheet.luckysheet_select_save, [
    {
      row: [10, 10],
      column: [5, 5],
      sheetIndex: "1",
    },
  ]);

  const b2 = getCell(sheet, 1, 1);
  assert.ok(b2);
  assert.equal(b2.v.v, "552150");

  const c2 = getCell(sheet, 1, 2);
  assert.ok(c2);
  assert.equal(c2.v.f, "=$B$4");
  assert.equal(c2.v.v, "552150");

  const i3 = getCell(sheet, 2, 8);
  assert.ok(i3);
  assert.equal(i3.v.v, "max");

  const p7 = getCell(sheet, 6, 15);
  assert.ok(p7);
  assert.equal(p7.v.f, "=N7-O7");
  assert.equal(p7.v.v, "1300");

  const images = sheet.images || [];
  assert.equal(images.length, 1);
  assert.match(images[0].src, /^data:image\/png;base64,/);
  assert.equal(images[0].id.startsWith("image_"), true);
  assert.equal(images[0].left, 116.13333333333333);
  assert.equal(images[0].top, 312.2);
  assert.equal(images[0].width, 252.73333333333335);
  assert.equal(images[0].height, 273.06666666666666);
  assert.equal(images[0].type, "2");
  assert.equal(images[0].fromCol, 1);
  assert.equal(images[0].fromRow, 11);
  assert.equal(images[0].toCol, 4);
  assert.equal(images[0].toRow, 21);

  assert.equal(columnWidthCalls.length, 1);
  assert.deepEqual(columnWidthCalls[0], [sheet.config.columnlen || {}, { id: sheet.id }]);

  assert.equal(rowHeightCalls.length, 1);
  assert.deepEqual(rowHeightCalls[0], [sheet.config.rowlen || {}, { id: sheet.id }]);
});

test("transformExcelToFortune keeps one-cell anchored drawing objects visible", async () => {
  const fileBuffer = await fs.readFile(drawingObjectsFixturePath);
  const { setSheetsCalls } = await loadWorkbookBufferIntoFortune(
    fileBuffer,
    "issue17336_drawing_objects.xlsx"
  );
  const [[sheet]] = setSheetsCalls;
  const images = sheet.images || [];

  assert.equal(images.length, 3);

  const pngImage = images.find((image) =>
    image.src.startsWith("data:image/png;base64,")
  );
  assert.ok(pngImage);
  assert.equal(pngImage.type, "2");
  assert.equal(pngImage.left, 340);
  assert.equal(pngImage.top, 11);
  assert.equal(pngImage.width, 100);
  assert.equal(pngImage.height, 114);
  assert.equal(pngImage.fromCol, 3);
  assert.equal(pngImage.fromRow, 0);
  assert.equal(pngImage.toCol, 4);
  assert.equal(pngImage.toRow, 5);

  const svgImages = images.filter((image) =>
    image.src.startsWith("data:image/svg+xml")
  );
  assert.equal(svgImages.length, 2);
  assert.ok(svgImages.every((image) => image.width > 0 && image.height > 0));

  const chartImage = svgImages.find((image) => image.width === 600);
  assert.ok(chartImage);
  const chartSvg = decodeURIComponent(chartImage.src.split(",")[1]);
  assert.match(chartSvg, /<svg /);
  assert.match(chartSvg, /#4472C4/);

  const shapeImage = svgImages.find((image) => image.width === 587);
  assert.ok(shapeImage);
  const shapeSvg = decodeURIComponent(shapeImage.src.split(",")[1]);
  assert.match(shapeSvg, /<rect /);
  assert.match(shapeSvg, /<polygon /);
  assert.match(shapeSvg, /<ellipse /);
  assert.match(shapeSvg, /#CFE2F3/);
});

test("transformExcelToFortune imports openpyxl default-namespace bar charts", async () => {
  const fileBuffer = await fs.readFile(openpyxlBarChartFixturePath);
  const { setSheetsCalls } = await loadWorkbookBufferIntoFortune(
    fileBuffer,
    "openpyxl_bar_chart.xlsx"
  );

  const [[sheet]] = setSheetsCalls;
  const images = Object.values(sheet.images || {});
  assert.ok(images.length >= 1, "expected at least one chart image");

  const chartImage = images.find((image) =>
    typeof image.src === "string" && image.src.startsWith("data:image/svg+xml")
  );
  assert.ok(chartImage, "expected chart SVG image");
  assert.ok(chartImage.width > 0);
  assert.ok(chartImage.height > 0);
  assert.equal(chartImage.fromCol, 6);
  assert.equal(chartImage.fromRow, 2);

  const chartSvg = decodeURIComponent(chartImage.src.split(",")[1]);
  assert.match(chartSvg, /<svg /);
  assert.match(chartSvg, /Anna Nováková|Anna Nov/);
  assert.match(chartSvg, /#4472C4/);
});

test("transformExcelToFortune formats numeric serial values with date formats as dates", async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Dates");

  worksheet.getCell("A1").value = 46205;
  worksheet.getCell("A1").numFmt = "yyyy/m/d";
  worksheet.getCell("B1").value = 46205;
  worksheet.getCell("B1").numFmt = "0.0";

  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const { setSheetsCalls } = await loadWorkbookBufferIntoFortune(
    workbookBuffer,
    "dates.xlsx"
  );
  const [[sheet]] = setSheetsCalls;

  const a1 = getCell(sheet, 0, 0);
  assert.ok(a1);
  assert.equal(a1.v.v, "46205");
  assert.equal(a1.v.m, "2026/7/2");
  assert.equal(a1.v.ct.fa, "yyyy/m/d");
  assert.equal(a1.v.ct.t, "d");

  const b1 = getCell(sheet, 0, 1);
  assert.ok(b1);
  assert.equal(b1.v.v, "46205");
  assert.equal(b1.v.m, undefined);
  assert.equal(b1.v.ct.fa, "0.0");
  assert.equal(b1.v.ct.t, "n");
});

test("transformExcelToFortune keeps formula text without empty cached values", async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Grades");

  worksheet.getCell("A1").value = 1;
  worksheet.getCell("A2").value = 3;
  worksheet.getCell("A3").value = { formula: "AVERAGE(A1:A2)" };

  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const { setSheetsCalls } = await loadWorkbookBufferIntoFortune(
    workbookBuffer,
    "formulas.xlsx"
  );
  const [[sheet]] = setSheetsCalls;

  const a3 = getCell(sheet, 2, 0);
  assert.ok(a3);
  assert.equal(a3.v.f, "=AVERAGE(A1:A2)");
  assert.equal(a3.v.v, undefined);
  assert.equal(a3.v.m, undefined);
});

test("converted xls_preview.xlsx sheets can be mounted in Workbook", async () => {
  const { setSheetsCalls } = await loadFixtureIntoFortune();
  const [sheets] = setSheetsCalls;
  const { Workbook } = await import("@fortune-sheet/react/dist/index.esm.js");
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='root'></div></body></html>",
    { pretendToBeVisual: true, url: "http://localhost/" }
  );

  const previousGlobals = {
    window: global.window,
    document: global.document,
    navigator: global.navigator,
    HTMLElement: global.HTMLElement,
    MutationObserver: global.MutationObserver,
    getComputedStyle: global.getComputedStyle,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
    ResizeObserver: global.ResizeObserver,
    DOMParser: global.DOMParser,
  };

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.MutationObserver = dom.window.MutationObserver;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.DOMParser = dom.window.DOMParser;

  const root = ReactDOMClient.createRoot(document.getElementById("root"));
  const originalGetContext = dom.window.HTMLCanvasElement.prototype.getContext;
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;

  try {
    root.render(React.createElement(Workbook, { data: sheets }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    root.unmount();
    dom.window.HTMLCanvasElement.prototype.getContext = originalGetContext;
    dom.window.close();
    global.window = previousGlobals.window;
    global.document = previousGlobals.document;
    global.navigator = previousGlobals.navigator;
    global.HTMLElement = previousGlobals.HTMLElement;
    global.MutationObserver = previousGlobals.MutationObserver;
    global.getComputedStyle = previousGlobals.getComputedStyle;
    global.requestAnimationFrame = previousGlobals.requestAnimationFrame;
    global.cancelAnimationFrame = previousGlobals.cancelAnimationFrame;
    global.ResizeObserver = previousGlobals.ResizeObserver;
    global.DOMParser = previousGlobals.DOMParser;
  }
});
