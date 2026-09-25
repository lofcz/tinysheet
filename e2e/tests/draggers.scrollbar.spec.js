// The grid's scrollbar thumbs dragged with a real mouse. Headless Chromium
// hides scrollbars by default; this file launches it with them shown.
const { test, expect } = require("../fixtures");
const { blank, openScenario, ctxValue } = require("../dragHelpers");

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await page.mouse.up();
}

// ---------------------------------------------------------------------------
// Scrollbar thumbs (Chromium without --hide-scrollbars)
// ---------------------------------------------------------------------------

test.describe("scrollbar thumbs", () => {
  test("dragging a thumb scrolls the sheet; the grid follows", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [blank({ row: 1000 })]);
    const barY = page.locator(".luckysheet-scrollbar-y");
    const b = await barY.boundingBox();
    // the thumb sits at the top of the track
    await dragBy(page, { x: b.x + b.width - 4, y: b.y + 8 }, 0, 120);
    await expect
      .poll(async () => (await sheet.scrollPosition()).y)
      .toBeGreaterThan(500);
    const { y } = await sheet.scrollPosition();
    await expect.poll(() => ctxValue(page, (ctx) => ctx.scrollTop)).toBe(y);
    // the cell under the pointer is the scrolled one (click the middle of
    // a row: the scroll offset need not be a whole row)
    const p = sheet.point(2, 1);
    const py = sheet.box.y + 50 - (y % 20);
    await page.mouse.click(p.x, py);
    const row = Math.floor((y + py - sheet.box.y) / 20);
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [row, row], column: [1, 1] });
    const barX = page.locator(".luckysheet-scrollbar-x");
    const bx = await barX.boundingBox();
    await dragBy(page, { x: bx.x + 8, y: bx.y + bx.height - 4 }, 200, 0);
    await expect
      .poll(async () => (await sheet.scrollPosition()).x)
      .toBeGreaterThan(0);
    await expect
      .poll(() => ctxValue(page, (ctx) => ctx.scrollLeft))
      .toBe((await sheet.scrollPosition()).x);
    expect(await ctxValue(page, (ctx) => !!ctx.luckysheet_select_status)).toBe(
      false
    );
  });
});
