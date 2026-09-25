const { test, expect, Sheet } = require("../fixtures");

// Relative luminance (0 = black, 1 = white) of a CSS rgb()/rgba() colour.
const luminance = (css) => {
  const [r, g, b] = css
    .match(/\d+(\.\d+)?/g)
    .slice(0, 3)
    .map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

test.describe("theme", () => {
  test("light is the default", async ({ sheet, page }) => {
    await expect(page.locator(".fortune-container")).toHaveAttribute(
      "data-theme",
      "light"
    );
    expect(sheet).toBeTruthy();
  });

  test("settings.theme = dark renders dark chrome", async ({ page }) => {
    const sheet = new Sheet(page);
    await sheet.open("e2e-harness--dark");
    const container = page.locator(".fortune-container");
    await expect(container).toHaveAttribute("data-theme", "dark");
    const toolbarBg = await page
      .locator(".fortune-toolbar")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(luminance(toolbarBg)).toBeLessThan(0.3);
    // Editing still works in dark mode.
    await sheet.enter(0, 0, "=1+1");
    await expect.poll(() => sheet.value(0, 0)).toBe(2);
  });

  test("theme auto follows prefers-color-scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/iframe.html?id=theming--auto&viewMode=story");
    const container = page.locator(".fortune-container");
    await expect(container).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(container).toHaveAttribute("data-theme", "light");
  });
});

test.describe("zoom", () => {
  test("zoom buttons change the sheet zoom ratio", async ({ sheet, page }) => {
    const ratio = page.locator(".fortune-zoom-ratio-current");
    await expect(ratio).toHaveText("100%");
    await page.getByRole("button", { name: /zoom in/i }).click();
    await expect(ratio).toHaveText("110%");
    await expect
      .poll(async () => (await sheet.sheetInfo()).zoomRatio)
      .toBe(1.1);
    await page.getByRole("button", { name: /zoom out/i }).click();
    await page.getByRole("button", { name: /zoom out/i }).click();
    await expect(ratio).toHaveText("90%");
  });
});

test.describe("freeze", () => {
  test("toolbar Freeze freezes rows and columns at the selection", async ({
    sheet,
    page,
  }) => {
    await sheet.click(3, 2);
    await page
      .locator('.fortune-toolbar-combo-button[data-tips="Freeze"]')
      .click();
    // rows 1-3 and columns A-B: above and left of the active cell C4
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen)
      .toEqual({
        type: "rangeBoth",
        range: { row_focus: 2, column_focus: 1 },
      });

    // Scroll far down and right: the frozen rows and columns stay in place,
    // so clicking the top-left cell's position still selects A1.
    await sheet.scroll(0, 1000);
    await sheet.scroll(1000, 0);
    await sheet.click(0, 0);
    // A cell outside the frozen panes has scrolled away.
    await sheet.click(8, 8, { wait: false });
    await expect
      .poll(async () => {
        const { row, column } = await sheet.selection();
        return row[0] > 8 && column[0] > 8;
      })
      .toBe(true);
  });

  test("Freeze Panes freezes from the scrolled position (Excel)", async ({
    sheet,
    page,
  }) => {
    await sheet.scroll(0, 200);
    await sheet.scroll(148, 0);
    // the top-left visible cell, and the active cell three rows / two
    // columns further
    await sheet.click(0, 0, { wait: false });
    await expect.poll(() => sheet.selection()).not.toBeNull();
    const topLeft = await sheet.selection();
    const top = topLeft.row[0];
    const left = topLeft.column[0];
    expect(top).toBeGreaterThan(0);
    expect(left).toBeGreaterThan(0);
    await sheet.click(3, 2, { wait: false });
    await sheet.waitForSelection(top + 3, left + 2);

    await page
      .locator('.fortune-toolbar-combo-button[data-tips="Freeze"]')
      .click();
    // the rows/columns from the top-left visible cell up to the active cell
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen)
      .toEqual({
        type: "rangeBoth",
        range: { row_focus: top + 2, column_focus: left + 1 },
        top,
        left,
      });
    // the frozen pane starts at the old top-left cell, the scrolling pane
    // continues at the active cell
    await sheet.click(0, 0, { wait: false });
    await sheet.waitForSelection(top, left);
    await sheet.click(3, 2, { wait: false });
    await sheet.waitForSelection(top + 3, left + 2);
    // scrolling moves only the scrolling pane
    await sheet.scroll(0, 400);
    await sheet.click(1, 1, { wait: false });
    await sheet.waitForSelection(top + 1, left + 1);

    // zooming keeps the frozen rows/columns
    const frozenBefore = (await sheet.sheetInfo()).frozen;
    await page.getByRole("button", { name: /zoom in/i }).click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).zoomRatio)
      .toBe(1.1);
    expect((await sheet.sheetInfo()).frozen).toEqual(frozenBefore);
    await page.getByRole("button", { name: /zoom out/i }).click();
    await expect.poll(async () => (await sheet.sheetInfo()).zoomRatio).toBe(1);

    // Unfreeze: the old top-left cell is at the top-left of the window again
    await page
      .locator('.fortune-toolbar-combo-button[data-tips="Freeze"]')
      .click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen ?? null)
      .toBeNull();
    await sheet.click(0, 0, { wait: false });
    await sheet.waitForSelection(top, left);
  });

  test("Freeze Top Row freezes the top visible row", async ({
    sheet,
    page,
  }) => {
    await sheet.scroll(0, 200);
    await sheet.click(0, 0, { wait: false });
    await expect.poll(() => sheet.selection()).not.toBeNull();
    const top = (await sheet.selection()).row[0];
    await page
      .locator('.fortune-toolbar-combo-arrow[data-tips="Freeze"]')
      .click();
    await page.getByText("Freeze Top Row", { exact: true }).click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen)
      .toEqual({
        type: "rangeRow",
        range: { row_focus: top, column_focus: 0 },
        top,
      });
    await sheet.scroll(0, 400);
    await sheet.click(0, 0, { wait: false });
    await sheet.waitForSelection(top, 0);
  });
});
