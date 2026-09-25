import {
  addToPrintArea,
  adjustPageSetupForChange,
  adjustRangeForChange,
  buildPrintJob,
  clearPrintArea,
  computeSheetPageLayout,
  defaultContext,
  getPageSetup,
  getPrintUsedRange,
  hasPageBreakAt,
  insertPageBreak,
  isPageBreakPreview,
  movePageBreak,
  pagePaperPx,
  parsePrintRanges,
  parseTitleColumns,
  parseTitleRows,
  printRangesToText,
  removePageBreak,
  renderPrintPage,
  requestPrintPreview,
  resetAllPageBreaks,
  resolvePageSetup,
  setPageBreakPreview,
  setPrintArea,
  titleColumnsToText,
  titleRowsToText,
  updatePageSetup,
} from "../../src";

function grid(rows, cols, fill) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (__, c) => (fill ? fill(r, c) : null))
  );
}

/** A 100 x 10 sheet filled with values (default 19/73 px cells). */
function makeCtx(setup, { rows = 100, cols = 10 } = {}) {
  const ctx = defaultContext({});
  ctx.defaultrowlen = 19;
  ctx.defaultcollen = 73;
  ctx.currentSheetId = "s1";
  ctx.luckysheetfile = [
    {
      name: "Data",
      id: "s1",
      order: 0,
      data: grid(rows, cols, (r, c) => ({
        v: r * cols + c,
        m: `${r * cols + c}`,
      })),
      pageSetup: setup,
    },
    { name: "Empty", id: "s2", order: 1, data: grid(5, 5) },
  ];
  ctx.luckysheet_select_save = [
    { row: [10, 10], column: [1, 1], row_focus: 10, column_focus: 1 },
  ];
  return ctx;
}

describe("page setup model", () => {
  test("defaults follow Excel", () => {
    const s = resolvePageSetup();
    expect(s.orientation).toBe("portrait");
    expect(s.paperSize).toBe("letter");
    expect(s.scale).toBe(100);
    expect(s.margins).toEqual({
      top: 0.75,
      bottom: 0.75,
      left: 0.7,
      right: 0.7,
      header: 0.3,
      footer: 0.3,
    });
    expect(pagePaperPx(s)).toEqual({ width: 816, height: 1056 });
    const a4 = pagePaperPx(
      resolvePageSetup({ paperSize: "a4", orientation: "landscape" })
    );
    expect(a4.width).toBeCloseTo((297 / 25.4) * 96, 0);
    expect(a4.height).toBeCloseTo((210 / 25.4) * 96, 0);
  });

  test("updatePageSetup merges and drops empty values", () => {
    const ctx = makeCtx();
    updatePageSetup(ctx, {
      orientation: "landscape",
      header: { center: "&A" },
    });
    updatePageSetup(ctx, { header: {}, scale: 80 });
    expect(getPageSetup(ctx)).toEqual({ orientation: "landscape", scale: 80 });
  });

  test("print area from the selection, add and clear", () => {
    const ctx = makeCtx();
    ctx.luckysheet_select_save = [
      { row: [0, 4], column: [0, 2], row_focus: 0, column_focus: 0 },
    ];
    setPrintArea(ctx);
    expect(getPageSetup(ctx).printArea).toEqual([
      { row: [0, 4], column: [0, 2] },
    ]);
    ctx.luckysheet_select_save = [
      { row: [8, 9], column: [5, 6], row_focus: 8, column_focus: 5 },
    ];
    addToPrintArea(ctx);
    expect(printRangesToText(getPageSetup(ctx).printArea)).toBe(
      "$A$1:$C$5,$F$9:$G$10"
    );
    clearPrintArea(ctx);
    expect(getPageSetup(ctx).printArea).toBeUndefined();
  });

  test("range text round trips", () => {
    expect(parsePrintRanges("$A$1:$C$5, Sheet1!F9:G10")).toEqual([
      { row: [0, 4], column: [0, 2] },
      { row: [8, 9], column: [5, 6] },
    ]);
    expect(parsePrintRanges("A1:B2,nope")).toBeNull();
    expect(parseTitleRows("$1:$2")).toEqual([0, 1]);
    expect(parseTitleColumns("$A:$B")).toEqual([0, 1]);
    expect(parseTitleRows("")).toBeUndefined();
    expect(parseTitleRows("x")).toBeNull();
    expect(titleRowsToText([0, 1])).toBe("$1:$2");
    expect(titleColumnsToText([2, 3])).toBe("$C:$D");
  });
});

describe("page breaks", () => {
  test("insert at the active cell adds a row and a column break", () => {
    const ctx = makeCtx();
    insertPageBreak(ctx);
    expect(getPageSetup(ctx).rowBreaks).toEqual([10]);
    expect(getPageSetup(ctx).colBreaks).toEqual([1]);
    expect(hasPageBreakAt(ctx)).toBe(true);
    removePageBreak(ctx);
    expect(getPageSetup(ctx).rowBreaks).toBeUndefined();
    expect(hasPageBreakAt(ctx)).toBe(false);
  });

  test("a cell in column A only breaks rows, a cell in row 1 only columns", () => {
    const ctx = makeCtx();
    insertPageBreak(ctx, { r: 20, c: 0 });
    insertPageBreak(ctx, { r: 0, c: 4 });
    expect(getPageSetup(ctx)).toEqual({ rowBreaks: [20], colBreaks: [4] });
    resetAllPageBreaks(ctx);
    expect(getPageSetup(ctx)).toEqual({});
  });

  test("dragging a break moves it (and makes it manual)", () => {
    const ctx = makeCtx({ rowBreaks: [30] });
    movePageBreak(ctx, "row", 30, 25);
    expect(getPageSetup(ctx).rowBreaks).toEqual([25]);
    // an automatic break becomes manual where it is dropped
    movePageBreak(ctx, "row", 45, 40);
    expect(getPageSetup(ctx).rowBreaks).toEqual([25, 40]);
    // dropped outside the area: removed
    movePageBreak(ctx, "row", 40, 200, [0, 99]);
    expect(getPageSetup(ctx).rowBreaks).toEqual([25]);
  });

  test("breaks, titles and print areas follow inserted and deleted rows", () => {
    const ctx = makeCtx({
      rowBreaks: [10, 20],
      printTitleRows: [2, 3],
      printArea: [{ row: [5, 30], column: [0, 3] }],
    });
    const run = (change) =>
      adjustPageSetupForChange(ctx, change, {
        adjustRange: (r, id) => adjustRangeForChange(r, change, id),
      });
    run({ type: "insert", sheetId: "s1", axis: "row", index: 0, count: 2 });
    expect(getPageSetup(ctx)).toMatchObject({
      rowBreaks: [12, 22],
      printTitleRows: [4, 5],
      printArea: [{ row: [7, 32], column: [0, 3] }],
    });
    run({ type: "delete", sheetId: "s1", axis: "row", start: 12, end: 14 });
    expect(getPageSetup(ctx).rowBreaks).toEqual([19]);
  });
});

describe("pagination", () => {
  test("Letter portrait at 100%: 9 columns and 45 rows per page", () => {
    const ctx = makeCtx();
    const layout = computeSheetPageLayout(ctx);
    expect(layout.scale).toBe(1);
    const [area] = layout.areas;
    expect(area.colBands).toEqual([
      [0, 8],
      [9, 9],
    ]);
    expect(area.rowBands).toEqual([
      [0, 44],
      [45, 89],
      [90, 99],
    ]);
    expect(area.rowBreaks).toEqual([
      { index: 45, manual: false },
      { index: 90, manual: false },
    ]);
    // down, then over
    expect(layout.pages.map((p) => [p.rows[0], p.cols[0]])).toEqual([
      [0, 0],
      [45, 0],
      [90, 0],
      [0, 9],
      [45, 9],
      [90, 9],
    ]);
    // over, then down
    updatePageSetup(ctx, { pageOrder: "overThenDown" });
    expect(
      computeSheetPageLayout(ctx).pages.map((p) => [p.rows[0], p.cols[0]])
    ).toEqual([
      [0, 0],
      [0, 9],
      [45, 0],
      [45, 9],
      [90, 0],
      [90, 9],
    ]);
  });

  test("manual breaks start pages; fit to page ignores them", () => {
    const ctx = makeCtx({ rowBreaks: [10] });
    const layout = computeSheetPageLayout(ctx);
    expect(layout.areas[0].rowBands[0]).toEqual([0, 9]);
    expect(layout.areas[0].rowBreaks[0]).toEqual({ index: 10, manual: true });
    updatePageSetup(ctx, { fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
    const fit = computeSheetPageLayout(ctx);
    expect(fit.scale).toBe(0.92);
    expect(fit.areas[0].colBands).toEqual([[0, 9]]);
    expect(fit.areas[0].rowBands[0][0]).toBe(0);
    expect(fit.areas[0].rowBands[0][1]).toBeGreaterThan(10);
  });

  test("fit to one page scales everything onto a single page", () => {
    const ctx = makeCtx({ fitToPage: true, fitToWidth: 1, fitToHeight: 1 });
    const layout = computeSheetPageLayout(ctx);
    expect(layout.pages).toHaveLength(1);
    expect(layout.scale).toBeLessThan(0.5);
    expect(layout.pages[0].height * layout.scale).toBeLessThanOrEqual(912);
  });

  test("adjust-to scaling and landscape change the bands", () => {
    const ctx = makeCtx({ scale: 50, orientation: "landscape" });
    const layout = computeSheetPageLayout(ctx);
    expect(layout.areas[0].colBands).toEqual([[0, 9]]);
    expect(layout.areas[0].rowBands).toHaveLength(2);
  });

  test("title rows and columns repeat on later pages only", () => {
    const ctx = makeCtx({ printTitleRows: [0, 0], printTitleColumns: [0, 0] });
    const layout = computeSheetPageLayout(ctx);
    const [first, second] = layout.pages;
    expect(first.titleRows).toBeNull();
    expect(second.rows[0]).toBe(45);
    expect(second.titleRows).toEqual([0, 0]);
    // the repeated title row takes one row of room
    expect(second.rows[1]).toBe(88);
    const right = layout.pages.find((p) => p.cols[0] > 0);
    expect(right.titleCols).toEqual([0, 0]);
  });

  test("print area, headings and centring", () => {
    const ctx = makeCtx({
      printArea: [
        { row: [0, 4], column: [0, 1] },
        { row: [10, 11], column: [3, 3] },
      ],
      headings: true,
      centerHorizontally: true,
    });
    const layout = computeSheetPageLayout(ctx);
    expect(layout.pages).toHaveLength(2);
    const [p] = layout.pages;
    expect(p.headingHeight).toBe(20);
    expect(p.width).toBe(p.headingWidth + 148);
    expect(p.x).toBeCloseTo(0.7 * 96 + (681.6 - p.width) / 2);
  });

  test("used range includes fills and pictures", () => {
    const ctx = makeCtx(undefined, { rows: 5, cols: 5 });
    const sheet = ctx.luckysheetfile[1];
    expect(getPrintUsedRange(ctx, sheet)).toBeNull();
    sheet.data[3][2] = { bg: "#ff0000" };
    sheet.images = [
      { id: "i", src: "x", left: 0, top: 0, width: 10, height: 10 },
    ];
    expect(getPrintUsedRange(ctx, sheet)).toEqual({
      row: [0, 3],
      column: [0, 2],
    });
  });
});

describe("print job", () => {
  test("numbers pages across the workbook and honours first page number", () => {
    const ctx = makeCtx({ firstPageNumber: 5 });
    ctx.luckysheetfile[1].data[0][0] = { v: "x", m: "x" };
    const job = buildPrintJob(ctx, { scope: "workbook" });
    expect(job.pages.map((p) => p.number)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(job.pages[6].sheetName).toBe("Empty");
  });

  test("selection scope prints the selection", () => {
    const ctx = makeCtx();
    ctx.luckysheet_select_save = [
      { row: [0, 2], column: [0, 1], row_focus: 0, column_focus: 0 },
    ];
    const job = buildPrintJob(ctx, { scope: "selection" });
    expect(job.pages).toHaveLength(1);
    expect(job.pages[0].info.rows).toEqual([0, 2]);
  });

  test("notes print at the end of the sheet", () => {
    const ctx = makeCtx({ comments: "atEnd" });
    ctx.luckysheetfile[0].data[1][1].ps = { value: "Check me" };
    const job = buildPrintJob(ctx);
    const last = job.pages[job.pages.length - 1];
    expect(last.kind).toBe("notes");
    expect(last.notes).toEqual([{ ref: "B2", text: "Check me" }]);
  });

  test("renders a page element with header, footer and content", () => {
    const ctx = makeCtx({
      header: { center: "&A" },
      footer: { right: "Page &P of &N" },
    });
    const job = buildPrintJob(ctx, { fileName: "Book.xlsx" });
    const el = renderPrintPage(ctx, job, 1);
    expect(el.style.width).toBe("816px");
    expect(el.querySelector(".fortune-print-header").textContent).toBe("Data");
    expect(el.querySelector(".fortune-print-footer").textContent).toBe(
      "Page 2 of 6"
    );
    expect(el.querySelector("canvas")).toBeTruthy();
  });

  test("view state helpers", () => {
    const ctx = makeCtx();
    setPageBreakPreview(ctx, true);
    expect(isPageBreakPreview(ctx)).toBe(true);
    setPageBreakPreview(ctx, false);
    expect(isPageBreakPreview(ctx)).toBe(false);
    requestPrintPreview(ctx);
    expect(ctx.pageLayout.printPreviewRequest).toBeGreaterThan(0);
  });
});
