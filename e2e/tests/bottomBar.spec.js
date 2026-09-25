const { test, expect, Sheet } = require("../fixtures");

// The bottom bar: layout (one row, two rows when narrow), the zoom slider,
// the zoom menu, the workbook view buttons and the selection aggregates.

const numbers = [
  [1, 2],
  [3, 4.5],
];

const makeSheets = (count) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Sheet${i + 1}`,
    id: `s${i + 1}`,
    order: i,
    status: i === 0 ? 1 : 0,
    row: 50,
    column: 20,
    color: i === 1 ? "#16a34a" : undefined,
    celldata:
      i === 0
        ? numbers.flatMap((row, r) =>
            row.map((v, c) => ({
              r,
              c,
              v: { v, m: String(v), ct: { t: "n" } },
            }))
          )
        : [],
  }));

async function openWith(page, count, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.localStorage.removeItem("tinysheet.statusBar.stats");
  });
  await page.addInitScript((data) => {
    window.__e2eScenario = { data };
  }, makeSheets(count));
  const sheet = new Sheet(page);
  await sheet.open("e2e-harness--scenario");
  await page.waitForFunction(() => window.__tinysheet);
  return sheet;
}

const zoom = (page) =>
  page.evaluate(() => window.__tinysheet.getSheet().zoomRatio ?? 1);

const ratio = (page) => page.locator(".fortune-zoom-ratio-current");

/** Vertical centre of an element. */
async function midY(locator) {
  const b = await locator.boundingBox();
  return b.y + b.height / 2;
}

test.describe("layout", () => {
  test("wide: tabs, status and zoom share one row; + follows the last tab", async ({
    page,
  }) => {
    await openWith(page, 2, { width: 1600, height: 800 });
    const tabs = page.locator("#fortune-sheettab-container");
    const stats = page.locator(".fortune-status-bar");
    const zoomBox = page.locator(".fortune-zoom-container");
    const views = page.locator(".fortune-view-buttons");
    const y = await midY(tabs);
    for (const el of [stats, zoomBox, views]) {
      expect(Math.abs((await midY(el)) - y)).toBeLessThanOrEqual(2);
    }
    // left to right: list, tabs, +, ..., mode, views, zoom
    const list = await page
      .getByRole("button", { name: "All sheets" })
      .boundingBox();
    const strip = await tabs.boundingBox();
    const add = await page
      .getByRole("button", { name: "New sheet" })
      .boundingBox();
    const mode = await page.locator(".fortune-edit-mode").boundingBox();
    const v = await views.boundingBox();
    const z = await zoomBox.boundingBox();
    expect(list.x).toBeLessThan(strip.x);
    expect(add.x).toBeGreaterThanOrEqual(strip.x + strip.width);
    expect(add.x - (strip.x + strip.width)).toBeLessThan(12);
    expect(mode.x).toBeGreaterThan(add.x);
    expect(v.x).toBeGreaterThan(mode.x);
    expect(z.x).toBeGreaterThan(v.x);
    // the zoom control ends at the right edge of the pane
    const pane = await page.locator(".fortune-bottom-pane").boundingBox();
    expect(pane.x + pane.width - (z.x + z.width)).toBeLessThan(16);
    // one slim row
    expect(pane.height).toBeLessThanOrEqual(46);
    // the coloured tab shows its colour stripe
    await expect(
      page.locator(
        ".luckysheet-sheets-item-colored .luckysheet-sheets-item-color"
      )
    ).toBeVisible();
  });

  test("narrow: the status bar goes under the tabs", async ({ page }) => {
    await openWith(page, 2, { width: 800, height: 700 });
    const strip = await page
      .locator("#fortune-sheettab-container")
      .boundingBox();
    const stats = await page.locator(".fortune-status-bar").boundingBox();
    const zoomBox = await page.locator(".fortune-zoom-container").boundingBox();
    expect(stats.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
    expect(Math.abs(zoomBox.y - stats.y)).toBeLessThanOrEqual(4);
    // Ready on the left, the zoom on the right, nothing out of the pane
    const pane = await page.locator(".fortune-bottom-pane").boundingBox();
    expect(stats.x - pane.x).toBeLessThan(16);
    expect(zoomBox.x + zoomBox.width).toBeLessThanOrEqual(pane.x + pane.width);
  });

  test("many sheets: the strip scrolls, fades and the ‹ › buttons scroll it", async ({
    page,
  }) => {
    await openWith(page, 20, { width: 1300, height: 700 });
    const strip = page.locator("#fortune-sheettab-container-c");
    const scroll = () => strip.evaluate((el) => el.scrollLeft);
    const max = () => strip.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(await max()).toBeGreaterThan(100);
    await expect(page.locator(".boundary-right")).toBeVisible();
    await expect(page.locator(".boundary-left")).toHaveCount(0);
    const right = page.locator("#fortune-sheettab-rightscroll");
    await expect(right).toBeVisible();
    await right.click();
    await expect.poll(scroll).toBeGreaterThan(40);
    await expect(page.locator(".boundary-left")).toBeVisible();
    // Ctrl+click: all the way to the end
    await right.click({ modifiers: ["Control"] });
    await expect
      .poll(async () => (await max()) - (await scroll()))
      .toBeLessThanOrEqual(1);
    await expect(page.locator(".boundary-right")).toHaveCount(0);
    await page
      .locator("#fortune-sheettab-leftscroll")
      .click({ modifiers: ["Control"] });
    await expect.poll(scroll).toBe(0);
    // right-click on an arrow lists all sheets, above the button
    await right.click({ button: "right" });
    const list = page.locator(".fortune-sheet-list");
    await expect(list).toBeVisible();
    const listBox = await list.boundingBox();
    const pane = await page.locator(".fortune-bottom-pane").boundingBox();
    expect(listBox.y + listBox.height).toBeLessThanOrEqual(pane.y + 8);
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
  });
});

test.describe("zoom slider", () => {
  test("dragging the thumb zooms, snapping to 100% in the middle", async ({
    page,
  }) => {
    await openWith(page, 1);
    const track = await page
      .locator(".fortune-zoom-slider-track")
      .boundingBox();
    const thumb = page.locator(".fortune-zoom-slider-thumb");
    const y = track.y + track.height / 2;
    const mid = track.x + track.width / 2;
    let t = await thumb.boundingBox();
    // the thumb starts in the middle (100%)
    expect(Math.abs(t.x + t.width / 2 - mid)).toBeLessThanOrEqual(1);

    // drag to the right end: 400%
    await page.mouse.move(t.x + t.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width + 30, y, { steps: 8 });
    await expect(ratio(page)).toHaveText("400%");
    // back near (not on) the middle: it snaps to 100%
    await page.mouse.move(mid + 3, y, { steps: 8 });
    await expect(ratio(page)).toHaveText("100%");
    // three quarters: 250%
    await page.mouse.move(track.x + track.width * 0.75, y, { steps: 4 });
    await expect(ratio(page)).toHaveText(/^2[45]\d%$/);
    await page.mouse.up();
    await expect.poll(() => zoom(page)).toBeGreaterThan(2.3);

    // a click on the track jumps there: the left end is 10%
    await page.mouse.click(track.x - 2, y);
    await expect(ratio(page)).toHaveText("10%");
    expect(await zoom(page)).toBeCloseTo(0.1, 5);
    t = await thumb.boundingBox();
    expect(Math.abs(t.x + t.width / 2 - track.x)).toBeLessThanOrEqual(1);

    // double-click: back to 100%
    await page.locator(".fortune-zoom-slider").dblclick();
    await expect(ratio(page)).toHaveText("100%");
  });

  test("keyboard: arrows step by 10%, Home / End to the ends", async ({
    page,
  }) => {
    await openWith(page, 1);
    const slider = page.getByRole("slider", { name: "Zoom" });
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(ratio(page)).toHaveText("110%");
    await expect(slider).toHaveAttribute("aria-valuenow", "110");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(ratio(page)).toHaveText("90%");
    await page.keyboard.press("End");
    await expect(ratio(page)).toHaveText("400%");
    await page.keyboard.press("Home");
    await expect(ratio(page)).toHaveText("10%");
  });

  test("the percentage opens the zoom menu: presets and Zoom to Selection", async ({
    page,
  }) => {
    const sheet = await openWith(page, 1);
    await ratio(page).click();
    const menu = page.locator(".fortune-zoom-ratio-menu");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitemradio", { name: "100%" })
    ).toHaveAttribute("aria-checked", "true");
    await menu.getByRole("menuitemradio", { name: "200%" }).click();
    await expect(menu).toHaveCount(0);
    await expect(ratio(page)).toHaveText("200%");
    await expect.poll(() => zoom(page)).toBe(2);

    // Zoom to Selection fits a small selection: a big zoom
    await ratio(page).click();
    await page.getByRole("menuitemradio", { name: "100%" }).click();
    await sheet.select(0, 0, 1, 1);
    await ratio(page).click();
    await page.getByRole("menuitem", { name: "Zoom to Selection" }).click();
    await expect.poll(() => zoom(page)).toBeGreaterThan(2);
  });
});

test.describe("view buttons", () => {
  test("Normal / Page Break Preview switch the view; Page Layout shows the pages", async ({
    page,
  }) => {
    await openWith(page, 1);
    const views = page.locator(".fortune-view-buttons");
    const normal = views.getByRole("button", { name: "Normal", exact: true });
    const breaks = views.getByRole("button", {
      name: "Page Break Preview",
      exact: true,
    });
    await expect(normal).toHaveAttribute("aria-pressed", "true");
    await expect(breaks).toHaveAttribute("aria-pressed", "false");

    await breaks.click();
    await expect(breaks).toHaveAttribute("aria-pressed", "true");
    await expect(normal).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".fortune-page-breaks.preview")).toHaveCount(1);

    await normal.click();
    await expect(normal).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".fortune-page-breaks.preview")).toHaveCount(0);

    await views
      .getByRole("button", { name: "Page Layout", exact: true })
      .click();
    await expect(page.locator(".fortune-print-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-print-preview")).toHaveCount(0);
  });
});

test.describe("selection aggregates", () => {
  test("Average, Count and Sum of the selection; right-click chooses them", async ({
    page,
  }) => {
    const sheet = await openWith(page, 1);
    await sheet.select(0, 0, 1, 1);
    const stats = page.locator(".fortune-status-bar-stats");
    await expect(stats).toHaveText("Average: 2.625Count: 4Sum: 10.5");
    // nothing to add up for one cell
    await sheet.click(5, 5);
    await expect(stats).toHaveText("");
    await sheet.select(0, 0, 1, 1);
    await expect(stats).toContainText("Sum: 10.5");

    // right-click: Customize Status Bar, above the bar
    await stats.click({ button: "right" });
    const menu = page.getByRole("menu", { name: "Customize Status Bar" });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    const pane = await page.locator(".fortune-bottom-pane").boundingBox();
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(pane.y + 1);
    await menu.getByRole("menuitemcheckbox", { name: /Max/ }).click();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(stats).toHaveText("Average: 2.625Count: 4Max: 4.5Sum: 10.5");
    // Sum stays at the right end
    const sum = await page
      .locator('.fortune-status-bar-item[data-stat="sum"]')
      .boundingBox();
    const max = await page
      .locator('.fortune-status-bar-item[data-stat="max"]')
      .boundingBox();
    expect(sum.x).toBeGreaterThan(max.x);

    // the mode indicator: Ready, then Enter while typing
    const mode = page.locator(".fortune-edit-mode");
    await expect(mode).toHaveText("Ready");
    await sheet.click(3, 3);
    await page.keyboard.type("7");
    await expect(mode).toHaveText("Enter");
    await page.keyboard.press("Escape");
    await expect(mode).toHaveText("Ready");
  });
});
