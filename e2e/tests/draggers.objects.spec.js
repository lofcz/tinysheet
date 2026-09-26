// Floating objects dragged with a real mouse: pictures, shapes (move,
// resize, rotate, adjustment handle, line ends), charts, slicers, the
// table resize handle and note boxes. Cursor, threshold, live feedback,
// result, modifiers (Shift constrains / keeps the aspect, Ctrl copies, Alt
// snaps to the grid), Esc, one undo step, zoom, frozen panes, dark theme,
// and nothing stuck afterwards. Excel is the spec.
const { test, expect } = require("../fixtures");
const {
  blank,
  cells,
  openScenario,
  setZoom,
  cellBox,
  hoverCursor,
  center,
  dragFlags,
  IDLE,
  sheetData,
} = require("../dragHelpers");

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Press at `from`, move by (dx, dy) in `steps`, optionally release. */
async function dragBy(page, from, dx, dy, opts = {}) {
  const { steps = 6, release = true, modifiers = [] } = opts;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(from.x + dx, from.y + dy, { steps });
  if (release) {
    await page.mouse.up();
    for (const m of modifiers) await page.keyboard.up(m);
  }
}

/** No drag state is left and a mouse move over the grid changes nothing. */
async function expectObjectIdle(page, sheet) {
  await expect.poll(() => dragFlags(page)).toEqual(IDLE);
  const before = JSON.stringify(await sheetData(page));
  const sel = await sheet.selection();
  const p = sheet.point(15, 10);
  await page.mouse.move(p.x, p.y);
  await page.mouse.move(p.x + 120, p.y + 50, { steps: 4 });
  expect(JSON.stringify(await sheetData(page))).toBe(before);
  expect(await sheet.selection()).toEqual(sel);
  // the grid still takes a click (at any zoom) and the keyboard
  const cell = await cellBox(page, 16, 1);
  await page.mouse.click(cell.x, cell.y);
  await sheet.waitForSelection(16, 1);
  await page.keyboard.type("k");
  await expect(sheet.editor).toBeFocused();
  await page.keyboard.press("Escape");
}

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

const picture = (extra = {}) => ({
  id: "pic1",
  left: 100,
  top: 60,
  width: 120,
  height: 80,
  src: PNG,
  ...extra,
});

const images = async (page) => (await sheetData(page)).images ?? [];

async function openPicture(page, { theme, zoom } = {}) {
  const sheet = await openScenario(page, [blank({ images: [picture()] })], {
    theme,
  });
  if (zoom) await setZoom(page, zoom);
  await expect(page.locator("#pic1")).toBeVisible();
  return sheet;
}

test.describe("pictures", () => {
  test("one gesture selects and moves it; move cursor; undo", async ({
    page,
  }) => {
    const sheet = await openPicture(page);
    const c = await center(page.locator("#pic1"));
    expect(await hoverCursor(page, c.x, c.y)).toBe("move");
    // a tiny jitter is a click: it selects without moving
    await dragBy(page, c, 1, 1, { steps: 1 });
    await expect(
      page.locator("#luckysheet-modal-dialog-activeImage")
    ).toBeVisible();
    expect((await images(page))[0]).toMatchObject({ left: 100, top: 60 });
    await page.mouse.click(sheet.point(20, 1).x, sheet.point(20, 1).y);
    await expect(
      page.locator("#luckysheet-modal-dialog-activeImage")
    ).toBeHidden();
    // press on the unselected picture and drag it
    await dragBy(page, c, 74, 40, { release: false });
    const live = await page
      .locator("#luckysheet-modal-dialog-activeImage")
      .boundingBox();
    expect(Math.round(live.x - c.box.x)).toBe(74);
    await page.mouse.up();
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 174, top: 100, width: 120, height: 80 });
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 100, top: 60 });
    await expectObjectIdle(page, sheet);
  });

  test("corners keep the aspect ratio (Shift too), edges stretch", async ({
    page,
  }) => {
    const sheet = await openPicture(page);
    await page.locator("#pic1").click();
    const box = page.locator("#luckysheet-modal-dialog-activeImage");
    const rb = await center(
      box.locator(".luckysheet-modal-dialog-resize-item-rb")
    );
    expect(await hoverCursor(page, rb.x, rb.y)).toBe("nwse-resize");
    await dragBy(page, rb, 60, 10);
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 100, top: 60, width: 180, height: 120 });
    const lt = await center(
      box.locator(".luckysheet-modal-dialog-resize-item-lt")
    );
    await dragBy(page, lt, 30, 0, { modifiers: ["Shift"] });
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 130, top: 80, width: 150, height: 100 });
    const rm = await center(
      box.locator(".luckysheet-modal-dialog-resize-item-rm")
    );
    expect(await hoverCursor(page, rm.x, rm.y)).toBe("ew-resize");
    await dragBy(page, rm, 50, 20);
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 130, top: 80, width: 200, height: 100 });
    const mb = await center(
      box.locator(".luckysheet-modal-dialog-resize-item-mb")
    );
    await dragBy(page, mb, 40, -30);
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ width: 200, height: 70 });
    await expectObjectIdle(page, sheet);
  });

  test("Esc cancels a move and a resize; Shift constrains; Alt snaps", async ({
    page,
  }) => {
    const sheet = await openPicture(page);
    const c = await center(page.locator("#pic1"));
    await dragBy(page, c, 90, 50, { release: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    const box = page.locator("#luckysheet-modal-dialog-activeImage");
    expect((await images(page))[0]).toMatchObject({ left: 100, top: 60 });
    const b = await box.boundingBox();
    expect(Math.round(b.x - c.box.x)).toBe(0);
    // Shift: only along the larger movement
    await dragBy(page, c, 60, 15, { modifiers: ["Shift"] });
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 160, top: 60 });
    // Alt: the corner snaps to the cell grid
    const c2 = await center(box);
    await dragBy(page, c2, 30, 30, { modifiers: ["Alt"] });
    await expect
      .poll(async () => {
        const img = (await images(page))[0];
        return [img.left % 74, img.top % 20];
      })
      .toEqual([0, 0]);
    const rb = await center(
      box.locator(".luckysheet-modal-dialog-resize-item-rb")
    );
    const before = (await images(page))[0];
    await dragBy(page, rb, 80, 60, { release: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await images(page))[0]).toEqual(before);
    await expectObjectIdle(page, sheet);
  });

  test("at 150% zoom in the dark theme it moves by the unzoomed distance", async ({
    page,
  }) => {
    const sheet = await openPicture(page, { theme: "dark", zoom: 1.5 });
    const c = await center(page.locator("#pic1"));
    expect(Math.round(c.box.width)).toBe(180);
    await dragBy(page, c, 60, 30);
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ left: 140, top: 80 });
    const rb = await center(
      page.locator(
        "#luckysheet-modal-dialog-activeImage .luckysheet-modal-dialog-resize-item-rb"
      )
    );
    await dragBy(page, rb, 30, 0);
    await expect
      .poll(async () => (await images(page))[0])
      .toMatchObject({ width: 140 });
    await expectObjectIdle(page, sheet);
  });
});

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

const at = (r, c, dx = 0, dy = 0) => ({ r, c, dx, dy });
const shapeSheet = (extra = {}) =>
  blank({
    shapes: [
      {
        id: "box",
        name: "Rectangle 1",
        prst: "roundRect",
        from: at(4, 2),
        to: at(8, 4),
        fill: { color: "#4472C4" },
      },
      {
        id: "ln",
        name: "Line 2",
        prst: "line",
        from: at(12, 1),
        to: at(14, 3),
        line: { color: "#000000", width: 2 },
      },
    ],
    ...extra,
  });

const shapesOf = async (page) => (await sheetData(page)).shapes ?? [];
const shapeById = async (page, id) =>
  (await shapesOf(page)).find((s) => s.id === id);

test.describe("shapes", () => {
  test("move: cursor, threshold, Shift constrains, Esc, undo", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [shapeSheet()]);
    const el = page.locator('[data-shape-id="box"]');
    const c = await center(el);
    expect(await hoverCursor(page, c.x, c.y)).toBe("move");
    await dragBy(page, c, 2, 1, { steps: 1 });
    await expect(el).toHaveAttribute("aria-pressed", "true");
    expect((await shapeById(page, "box")).from).toEqual(at(4, 2));
    // live: the shape follows before the release
    await dragBy(page, c, 74, 40, { release: false });
    const live = await el.boundingBox();
    expect(Math.round(live.x - c.box.x)).toBe(74);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await shapeById(page, "box")).from).toEqual(at(4, 2));
    const back = await el.boundingBox();
    expect(Math.round(back.x - c.box.x)).toBe(0);
    await dragBy(page, c, 74, 12, { modifiers: ["Shift"] });
    await expect
      .poll(async () => (await shapeById(page, "box")).from)
      .toEqual(at(4, 3));
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await shapeById(page, "box")).from)
      .toEqual(at(4, 2));
    await expectObjectIdle(page, sheet);
  });

  test("Ctrl+drag copies, Ctrl+click toggles; Alt snaps to the grid", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [shapeSheet()]);
    const el = page.locator('[data-shape-id="box"]');
    const c = await center(el);
    await dragBy(page, c, 148, 0, { modifiers: ["Control"] });
    await expect.poll(async () => (await shapesOf(page)).length).toBe(3);
    const copy = (await shapesOf(page))[2];
    expect(copy.from).toEqual(at(4, 4));
    expect((await shapeById(page, "box")).from).toEqual(at(4, 2));
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await shapesOf(page)).length).toBe(2);
    // Alt: the moved shape's corner lands on a cell corner
    const c2 = await center(el);
    await dragBy(page, c2, 50, 27, { modifiers: ["Alt"] });
    await expect
      .poll(async () => (await shapeById(page, "box")).from)
      .toMatchObject({ dx: 0, dy: 0 });
    await expectObjectIdle(page, sheet);
  });

  test("resize: corner with Shift keeps the aspect, edge stretches", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [shapeSheet()]);
    const el = page.locator('[data-shape-id="box"]');
    await el.click();
    const rb = await center(el.locator(".fortune-shape-handle-rb"));
    expect(await hoverCursor(page, rb.x, rb.y)).toBe("nwse-resize");
    const before = await el.boundingBox();
    await dragBy(page, rb, 74, 10, { modifiers: ["Shift"] });
    await expect
      .poll(async () => {
        const b = await el.boundingBox();
        return Math.round((b.width / b.height) * 100);
      })
      .toBe(Math.round((before.width / before.height) * 100));
    const mb = await center(el.locator(".fortune-shape-handle-mb"));
    expect(await hoverCursor(page, mb.x, mb.y)).toBe("ns-resize");
    const w = (await el.boundingBox()).width;
    await dragBy(page, mb, 30, 20);
    await expect
      .poll(async () => Math.round((await el.boundingBox()).width))
      .toBe(Math.round(w));
    await expectObjectIdle(page, sheet);
  });

  test("rotate, the adjustment handle and a line's ends", async ({ page }) => {
    const sheet = await openScenario(page, [shapeSheet()]);
    const el = page.locator('[data-shape-id="box"]');
    await el.click();
    const rot = await center(el.locator(".fortune-shape-rotate"));
    const mid = await center(el);
    // to the right of the centre: a quarter turn
    await dragBy(page, rot, mid.x + 150 - rot.x, mid.y - rot.y, {
      modifiers: ["Shift"],
    });
    await expect.poll(async () => (await shapeById(page, "box")).rot).toBe(90);
    const adj = el.locator(".fortune-shape-adjust");
    await expect(adj).toBeVisible();
    const a = await center(adj);
    await dragBy(page, a, 0, 12);
    await expect
      .poll(async () => (await shapeById(page, "box")).adj)
      .toBeTruthy();
    // the line's end handle
    const ln = page.locator('[data-shape-id="ln"]');
    await ln.click({ force: true });
    const ends = ln.locator(".fortune-shape-handle-end");
    await expect(ends).toHaveCount(2);
    const end = await center(ends.nth(1));
    await dragBy(page, end, 74, 0);
    await expect
      .poll(async () => (await shapeById(page, "ln")).to)
      .toEqual(at(14, 4));
    await expectObjectIdle(page, sheet);
  });

  test("at 150% zoom in the dark theme", async ({ page }) => {
    const sheet = await openScenario(page, [shapeSheet()], { theme: "dark" });
    await setZoom(page, 1.5);
    const el = page.locator('[data-shape-id="box"]');
    const c = await center(el);
    await dragBy(page, c, 111, 60);
    await expect
      .poll(async () => (await shapeById(page, "box")).from)
      .toEqual(at(6, 3));
    await expectObjectIdle(page, sheet);
  });
});

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const src = (r1, r2, c1, c2) => ({
  sheetId: "sheet1",
  row: [r1, r2],
  column: [c1, c2],
});
const chartSheet = (extra = {}) =>
  blank({
    celldata: cells({
      "0,0": "M",
      "0,1": "V",
      "1,0": "a",
      "1,1": 1,
      "2,0": "b",
      "2,1": 3,
    }),
    charts: [
      {
        id: "ch1",
        type: "column",
        title: "Chart",
        source: src(0, 2, 0, 1),
        series: [
          {
            nameRef: src(0, 0, 1, 1),
            values: src(1, 2, 1, 1),
            categories: src(1, 2, 0, 0),
          },
        ],
        left: 300,
        top: 100,
        width: 300,
        height: 200,
      },
    ],
    ...extra,
  });

const chartOf = async (page, id = "ch1") =>
  (await sheetData(page)).charts?.find((c) => c.id === id);
const chartBox = async (page, id) => {
  const c = await chartOf(page, id);
  return { left: c.left, top: c.top, width: c.width, height: c.height };
};

test.describe("charts", () => {
  test("move with live preview, Esc, Shift, Ctrl copy, undo", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [chartSheet()]);
    const el = page.locator('.fortune-chart-box[data-chart-id="ch1"]');
    const c = await center(el);
    expect(await hoverCursor(page, c.x, c.y)).toBe("move");
    await dragBy(page, c, 50, 30, { release: false });
    const live = await el.boundingBox();
    expect(Math.round(live.x - c.box.x)).toBe(50);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await chartBox(page, "ch1")).toEqual({
      left: 300,
      top: 100,
      width: 300,
      height: 200,
    });
    await dragBy(page, c, 50, 10, { modifiers: ["Shift"] });
    await expect
      .poll(() => chartBox(page, "ch1"))
      .toMatchObject({ left: 350, top: 100 });
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => chartBox(page, "ch1"))
      .toMatchObject({ left: 300, top: 100 });
    await dragBy(page, c, 0, 250, { modifiers: ["Control"] });
    await expect
      .poll(async () => (await sheetData(page)).charts?.length)
      .toBe(2);
    const copy = (await sheetData(page)).charts[1];
    expect(copy).toMatchObject({ left: 300, top: 350 });
    expect(await chartBox(page, "ch1")).toMatchObject({ left: 300, top: 100 });
    await expectObjectIdle(page, sheet);
  });

  test("resize from each kind of handle; at 75% zoom; dark theme", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [chartSheet()], { theme: "dark" });
    await setZoom(page, 0.75);
    const el = page.locator('.fortune-chart-box[data-chart-id="ch1"]');
    await el.click();
    // at a zoom the chart stays on its cells: compare what is on screen
    const near = (a, b) => Math.abs(a - b) <= 1.5;
    const b0 = await el.boundingBox();
    const rb = await center(el.locator(".fortune-chart-handle-rb"));
    expect(await hoverCursor(page, rb.x, rb.y)).toBe("nwse-resize");
    await dragBy(page, rb, 60, 30);
    await expect
      .poll(async () => {
        const b = await el.boundingBox();
        return [
          near(b.x, b0.x),
          near(b.y, b0.y),
          near(b.width, b0.width + 60),
          near(b.height, b0.height + 30),
        ];
      })
      .toEqual([true, true, true, true]);
    const b1 = await el.boundingBox();
    const lm = await center(el.locator(".fortune-chart-handle-lm"));
    expect(await hoverCursor(page, lm.x, lm.y)).toBe("ew-resize");
    await dragBy(page, lm, 30, 0);
    await expect
      .poll(async () => {
        const b = await el.boundingBox();
        return [
          near(b.x, b1.x + 30),
          near(b.y, b1.y),
          near(b.width, b1.width - 30),
          near(b.height, b1.height),
        ];
      })
      .toEqual([true, true, true, true]);
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => near((await el.boundingBox()).x, b1.x))
      .toBe(true);
    await expectObjectIdle(page, sheet);
  });
});

// ---------------------------------------------------------------------------
// Slicers and the table resize handle
// ---------------------------------------------------------------------------

const tableSheet = (slicer = true) =>
  blank({
    celldata: cells({
      "0,0": "Region",
      "0,1": "Qty",
      "1,0": "East",
      "1,1": 2,
      "2,0": "West",
      "2,1": 1,
      "3,0": "East",
      "3,1": 4,
    }),
    tables: [
      {
        name: "Table1",
        range: { row: [0, 3], column: [0, 1] },
        headerRow: true,
        totalRow: false,
        bandedRows: true,
        bandedColumns: false,
        firstColumn: false,
        lastColumn: false,
        style: "TableStyleMedium2",
        columns: [{ name: "Region" }, { name: "Qty" }],
        slicers: slicer
          ? [
              {
                name: "Slicer_Region",
                column: "Region",
                caption: "Region",
                r: 2,
                c: 5,
                offsetX: 0,
                offsetY: 0,
                width: 180,
                height: 200,
              },
            ]
          : undefined,
      },
    ],
  });

const slicerOf = async (page) => (await sheetData(page)).tables[0].slicers[0];

test.describe("slicers", () => {
  test("move by the header, resize by a handle, Esc, undo", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [tableSheet()]);
    const el = page.locator(".fortune-slicer");
    await expect(el).toBeVisible();
    const header = await center(el.locator(".fortune-slicer-header"));
    await dragBy(page, header, 74, 40);
    await expect
      .poll(() => slicerOf(page))
      .toMatchObject({ r: 4, c: 6, width: 180, height: 200 });
    await page.keyboard.press("Control+z");
    await expect.poll(() => slicerOf(page)).toMatchObject({ r: 2, c: 5 });
    await el.locator(".fortune-slicer-header").click();
    const handle = el.locator(".fortune-slicer-handle-rb");
    await expect(handle).toBeVisible();
    const h = await center(handle);
    expect(await hoverCursor(page, h.x, h.y)).toBe("nwse-resize");
    await dragBy(page, h, 40, 30, { release: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await slicerOf(page)).toMatchObject({ width: 180, height: 200 });
    await dragBy(page, h, 40, 30);
    await expect
      .poll(() => slicerOf(page))
      .toMatchObject({ width: 220, height: 230 });
    await expectObjectIdle(page, sheet);
  });

  test("at 150% zoom in the dark theme", async ({ page }) => {
    const sheet = await openScenario(page, [tableSheet()], { theme: "dark" });
    await setZoom(page, 1.5);
    const el = page.locator(".fortune-slicer");
    const header = await center(el.locator(".fortune-slicer-header"));
    await dragBy(page, header, 111, 60);
    await expect
      .poll(() => slicerOf(page))
      .toMatchObject({ r: 4, c: 6, width: 180, height: 200 });
    await expectObjectIdle(page, sheet);
  });
});

test.describe("table resize handle", () => {
  test("drag grows and shrinks the table; a click changes nothing; Esc", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [tableSheet(false)]);
    const tableRange = async () => (await sheetData(page)).tables[0].range;
    await sheet.click(1, 1);
    const handle = page.locator(".fortune-table-resize-handle");
    await expect(handle).toBeVisible();
    const h = await center(handle);
    expect(await hoverCursor(page, h.x, h.y)).toBe("nwse-resize");
    await page.mouse.down();
    await page.mouse.up();
    expect(await tableRange()).toEqual({ row: [0, 3], column: [0, 1] });
    // two rows down and a column right, with the live outline
    await dragBy(page, h, 74, 40, { release: false });
    await expect(page.locator(".fortune-table-resize-preview")).toBeVisible();
    await page.mouse.up();
    await expect.poll(tableRange).toEqual({ row: [0, 5], column: [0, 2] });
    await page.keyboard.press("Control+z");
    await expect.poll(tableRange).toEqual({ row: [0, 3], column: [0, 1] });
    const h2 = await center(handle);
    await dragBy(page, h2, 0, 60, { release: false });
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-table-resize-preview")).toBeHidden();
    await page.mouse.up();
    expect(await tableRange()).toEqual({ row: [0, 3], column: [0, 1] });
    await expectObjectIdle(page, sheet);
  });
});

// ---------------------------------------------------------------------------
// Note boxes
// ---------------------------------------------------------------------------

test.describe("notes", () => {
  const noteSheet = () =>
    blank({
      celldata: [
        {
          r: 1,
          c: 1,
          v: {
            v: "x",
            m: "x",
            ps: {
              value: "A note",
              isShow: true,
              left: 300,
              top: 60,
              width: 160,
              height: 100,
            },
          },
        },
      ],
    });
  const noteOf = async (page) => (await sheetData(page)).data[1][1].ps;

  test("move by the border, resize by a handle, Esc", async ({ page }) => {
    const sheet = await openScenario(page, [noteSheet()]);
    const box = page.locator(".fortune-note-box");
    await expect(box).toBeVisible();
    const b = await box.boundingBox();
    // the top border strip moves it
    const top = { x: b.x + b.width / 2, y: b.y + 1 };
    expect(await hoverCursor(page, top.x, top.y)).toBe("move");
    await dragBy(page, top, 40, 30);
    await expect
      .poll(() => noteOf(page))
      .toMatchObject({ left: 340, top: 90, width: 160, height: 100 });
    await dragBy(page, { x: top.x + 40, y: top.y + 30 }, 50, 50, {
      release: false,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await noteOf(page)).toMatchObject({ left: 340, top: 90 });
    const nb = await box.boundingBox();
    expect(Math.round(nb.x - b.x)).toBe(40);
    // editing shows the resize handles
    await box.locator(".fortune-note-editor").click();
    const rb = box.locator(".luckysheet-postil-dialog-resize-item-rb");
    await expect(rb).toBeVisible();
    const h = await center(rb);
    await dragBy(page, h, 40, 20);
    await expect
      .poll(() => noteOf(page))
      .toMatchObject({ width: 200, height: 120 });
    await page.keyboard.press("Escape");
    await expectObjectIdle(page, sheet);
  });
});
