// Header drags with a real mouse: resizing rows and columns by their
// header borders (either side, zoomed, frozen, dark), double-click autofit,
// hiding by dragging a border past its start, unhiding a hidden row or
// column by dragging (or double-clicking) its double line, and the freeze
// handles. Excel is the spec.
const { test, expect } = require("../fixtures");
const {
  blank,
  cells,
  openScenario,
  setZoom,
  cellBox,
  hoverCursor,
  expectIdle,
  ctxValue,
  sheetData,
} = require("../dragHelpers");

const config = async (page) => (await sheetData(page)).config ?? {};

/** Where the header row / column is, for grabbing borders. */
async function headers(page) {
  const area = await page.locator(".fortune-cell-area").boundingBox();
  return { colY: area.y - 10, rowX: area.x - 15, area };
}

/** Drag from (x, y) by (dx, dy), coming to the start from 8px away. */
async function dragFrom(page, x, y, dx, dy, { release = true } = {}) {
  await page.mouse.move(x - Math.sign(dx) * 8, y - Math.sign(dy) * 8);
  await page.mouse.move(x, y, { steps: 2 });
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  if (release) await page.mouse.up();
}

test.describe("column and row resize", () => {
  for (const zoom of [0.75, 1, 1.5]) {
    test(`column border from both sides at ${zoom * 100}%, live line, undo`, async ({
      sheet,
      page,
    }) => {
      if (zoom !== 1) await setZoom(page, zoom);
      const { colY } = await headers(page);
      const b = await cellBox(page, 0, 1);
      // left of the border (inside B)
      expect(await hoverCursor(page, b.right - 2, colY)).toBe("ew-resize");
      await dragFrom(page, b.right - 2, colY, 30, 0, { release: false });
      const line = page.locator(".fortune-change-size-line");
      await expect(line).toBeVisible();
      const lb = await line.boundingBox();
      expect(Math.abs(lb.x + lb.width - (b.right + 30))).toBeLessThan(4);
      await page.mouse.up();
      await expect(line).toBeHidden();
      const w1 = Math.round((b.right - b.left + 30) / zoom) - 1;
      await expect
        .poll(async () => (await config(page)).columnlen?.[1])
        .toBeGreaterThanOrEqual(w1 - 1);
      expect((await config(page)).columnlen[1]).toBeLessThanOrEqual(w1 + 1);
      // right of the border (inside C) makes B narrower again
      const b2 = await cellBox(page, 0, 1);
      expect(await hoverCursor(page, b2.right + 2, colY)).toBe("ew-resize");
      await dragFrom(page, b2.right + 2, colY, -20, 0);
      const w2 = Math.round((b2.right - b2.left - 20) / zoom) - 1;
      await expect
        .poll(async () => Math.abs((await config(page)).columnlen?.[1] - w2))
        .toBeLessThanOrEqual(1);
      // each drag is one undo step
      await page.keyboard.press("Control+z");
      await expect
        .poll(async () => Math.abs((await config(page)).columnlen?.[1] - w1))
        .toBeLessThanOrEqual(1);
      await page.keyboard.press("Control+z");
      await expect
        .poll(async () => (await config(page)).columnlen?.[1])
        .toBeUndefined();
      await expectIdle(page, sheet);
    });
  }

  test("row border at 150% zoom from both sides; a click changes nothing", async ({
    sheet,
    page,
  }) => {
    await setZoom(page, 1.5);
    const { rowX } = await headers(page);
    const r = await cellBox(page, 2, 0);
    expect(await hoverCursor(page, rowX, r.bottom - 2)).toBe("ns-resize");
    await page.mouse.down();
    await page.mouse.up();
    expect((await config(page)).rowlen ?? {}).toEqual({});
    await dragFrom(page, rowX, r.bottom - 2, 0, 30);
    await expect
      .poll(async () => (await config(page)).rowlen?.[2])
      .toBe(Math.round((r.bottom - r.top + 30) / 1.5) - 1);
    const r2 = await cellBox(page, 2, 0);
    await dragFrom(page, rowX, r2.bottom + 2, 0, -15);
    await expect
      .poll(async () => (await config(page)).rowlen?.[2])
      .toBe(Math.round((r2.bottom - r2.top - 15) / 1.5) - 1);
    await expectIdle(page, sheet);
  });

  test("Esc while dragging a border cancels the resize", async ({
    sheet,
    page,
  }) => {
    const { colY } = await headers(page);
    const b = await cellBox(page, 0, 2);
    await dragFrom(page, b.right - 1, colY, 50, 0, { release: false });
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-change-size-line")).toBeHidden();
    await page.mouse.up();
    expect((await config(page)).columnlen ?? {}).toEqual({});
    await expectIdle(page, sheet);
  });

  test("frozen columns, scrolled, dark theme: the scrolled column resizes", async ({
    page,
  }) => {
    const sheet = await openScenario(
      page,
      [
        blank({
          frozen: { type: "column", range: { row_focus: 0, column_focus: 0 } },
        }),
      ],
      { theme: "dark" }
    );
    await sheet.scroll(74 * 3, 0);
    const { colY, area } = await headers(page);
    const scrollLeft = await ctxValue(page, (ctx) => ctx.scrollLeft);
    const edges = await ctxValue(page, (ctx) => ctx.visibledatacolumn);
    // the second scrolled column right of the frozen A
    const frozenW = edges[0];
    const firstScrolled = edges.findIndex((e) => e > scrollLeft + frozenW);
    const c = firstScrolled + 1;
    const right = area.x + edges[c] - scrollLeft;
    await dragFrom(page, right - 1, colY, 25, 0);
    await expect
      .poll(async () => (await config(page)).columnlen)
      .toEqual({ [c]: 73 + 25 });
    await expectIdle(page, sheet);
  });

  test("double-click a border autofits the column / row; one undo step", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({
        celldata: cells({ "0,1": "a rather long piece of text in B1" }),
        config: { rowlen: { 3: 60 } },
      }),
    ]);
    const { colY, rowX } = await headers(page);
    const b = await cellBox(page, 0, 1);
    await page.mouse.move(b.right - 1, colY);
    await page.mouse.dblclick(b.right - 1, colY);
    await expect
      .poll(async () => (await config(page)).columnlen?.[1] ?? 0)
      .toBeGreaterThan(150);
    const r = await cellBox(page, 3, 0);
    await page.mouse.move(rowX, r.bottom - 1);
    await page.mouse.dblclick(rowX, r.bottom - 1);
    await expect
      .poll(async () => (await config(page)).rowlen?.[3] ?? 19)
      .toBeLessThan(30);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await config(page)).rowlen?.[3]).toBe(60);
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await config(page)).columnlen?.[1])
      .toBeUndefined();
    await expectIdle(page, sheet);
  });

  test("dragging a border past the column's start hides it", async ({
    sheet,
    page,
  }) => {
    const { colY } = await headers(page);
    const b = await cellBox(page, 0, 2);
    await dragFrom(page, b.right - 1, colY, -(b.right - b.left) - 10, 0);
    await expect
      .poll(async () => (await config(page)).colhidden)
      .toEqual({ 2: 0 });
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await config(page)).colhidden ?? {})
      .toEqual({});
    await expectIdle(page, sheet);
  });
});

test.describe("unhiding by the double line", () => {
  const hiddenSheet = () =>
    blank({ config: { colhidden: { 2: 0 }, rowhidden: { 3: 0, 4: 0 } } });

  for (const zoom of [1, 1.5]) {
    test(`a hidden column is dragged open from its double line at ${
      zoom * 100
    }%`, async ({ page }) => {
      const sheet = await openScenario(page, [hiddenSheet()]);
      if (zoom !== 1) await setZoom(page, zoom);
      const { colY } = await headers(page);
      // B ends where D starts: C is hidden between them
      const b = await cellBox(page, 0, 1);
      expect(await hoverCursor(page, b.right + 2, colY)).toBe("col-resize");
      expect(await hoverCursor(page, b.right - 2, colY)).toBe("ew-resize");
      await dragFrom(page, b.right + 2, colY, 40, 0);
      await expect
        .poll(async () => (await config(page)).colhidden?.[2])
        .toBeUndefined();
      const w = (await config(page)).columnlen?.[2];
      expect(Math.abs(w - (Math.round(40 / zoom) - 1))).toBeLessThanOrEqual(1);
      // B kept its width
      expect((await config(page)).columnlen?.[1]).toBeUndefined();
      await page.keyboard.press("Control+z");
      await expect
        .poll(async () => (await config(page)).colhidden)
        .toEqual({ 2: 0 });
      await expectIdle(page, sheet);
    });
  }

  test("hidden rows: the last hidden one opens; left of the line resizes", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [hiddenSheet()]);
    const { rowX } = await headers(page);
    const r = await cellBox(page, 2, 0);
    expect(await hoverCursor(page, rowX, r.bottom + 2)).toBe("row-resize");
    await dragFrom(page, rowX, r.bottom + 2, 0, 25);
    await expect
      .poll(async () => (await config(page)).rowhidden)
      .toEqual({ 3: 0 });
    // above the line: row 3 (index 2) resizes, nothing is unhidden
    const r2 = await cellBox(page, 2, 0);
    await dragFrom(page, rowX, r2.bottom - 2, 0, 10);
    await expect.poll(async () => (await config(page)).rowlen?.[2]).toBe(29);
    expect((await config(page)).rowhidden).toEqual({ 3: 0 });
    await expectIdle(page, sheet);
  });

  test("double-clicking the double line unhides and fits the column", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [hiddenSheet()]);
    const { colY } = await headers(page);
    const b = await cellBox(page, 0, 1);
    await page.mouse.move(b.right + 2, colY);
    await page.mouse.dblclick(b.right + 2, colY);
    await expect
      .poll(async () => (await config(page)).colhidden?.[2])
      .toBeUndefined();
    await expectIdle(page, sheet);
  });
});

test.describe("freeze handles", () => {
  test("dragging the column freeze handle freezes columns; dark theme", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [blank()], { theme: "dark" });
    const handle = page.locator(".fortune-cols-freeze-handle");
    const h = await handle.boundingBox();
    expect(await hoverCursor(page, h.x + 1, h.y + h.height / 2)).toBe("grab");
    const c = await cellBox(page, 0, 1);
    await page.mouse.down();
    await page.mouse.move(c.right - 5, h.y + h.height / 2, { steps: 6 });
    await expect(page.locator(".fortune-freeze-drag-line")).toBeVisible();
    await page.mouse.up();
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen)
      .toMatchObject({ range: { column_focus: 1 } });
    await expect(page.locator(".fortune-freeze-drag-line")).toBeHidden();
    await expectIdle(page, sheet);
  });

  test("the row freeze handle, then Esc on a second drag keeps it", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [blank()]);
    const handle = page.locator(".fortune-rows-freeze-handle");
    const h = await handle.boundingBox();
    const r = await cellBox(page, 2, 0);
    await page.mouse.move(h.x + h.width / 2, h.y + 1);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2, r.bottom - 4, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen)
      .toMatchObject({ range: { row_focus: 2 } });
    const h2 = await handle.boundingBox();
    await page.mouse.move(h2.x + h2.width / 2, h2.y + 1);
    await page.mouse.down();
    await page.mouse.move(h2.x + h2.width / 2, h2.y + 100, { steps: 4 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await sheet.sheetInfo()).frozen).toMatchObject({
      range: { row_focus: 2 },
    });
    await expectIdle(page, sheet);
  });
});
