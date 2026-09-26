const { test, expect, toolbarButton } = require("../fixtures");

// Editing gaps (stream R11): Point mode across sheets, the formula bar
// (expand, resize, several lines), formula autocomplete and the AutoFilter
// moving with cut/paste.

const tab = (page, name) =>
  page.locator(".luckysheet-sheets-item", {
    has: page.locator(".luckysheet-sheets-item-name", { hasText: name }),
  });

const currentSheetName = (page) =>
  page.evaluate(() => window.__tinysheet.getSheet().name);

/** Adds Sheet2 (with values in C3:C4) and goes back to Sheet1. */
async function withSecondSheet(sheet, page) {
  await page.getByRole("button", { name: "New sheet" }).click();
  await expect.poll(() => currentSheetName(page)).toBe("Sheet2");
  // the new sheet may still be settling (its selection is restored after
  // the switch): retry until the values are in
  await expect(async () => {
    await sheet.fillColumn(2, 2, [5, 7]);
  }).toPass({ timeout: 30000 });
  await tab(page, "Sheet1").click();
  await expect.poll(() => currentSheetName(page)).toBe("Sheet1");
}

test.describe("Point mode across sheets", () => {
  test("pick a range on another sheet, Enter commits on the first", async ({
    sheet,
    page,
  }) => {
    await withSecondSheet(sheet, page);
    await sheet.click(0, 0);
    await page.keyboard.type("=SUM(");
    await tab(page, "Sheet2").click();
    await expect.poll(() => currentSheetName(page)).toBe("Sheet2");
    // still editing: the formula bar shows it
    await expect(page.locator("#luckysheet-functionbox-cell")).toHaveText(
      "=SUM("
    );
    await sheet.select(2, 2, 3, 2);
    await expect(page.locator("#luckysheet-functionbox-cell")).toHaveText(
      "=SUM(Sheet2!C3:C4"
    );
    await page.keyboard.press("Enter");
    await expect.poll(() => currentSheetName(page)).toBe("Sheet1");
    await expect.poll(() => sheet.formula(0, 0)).toBe("=SUM(Sheet2!C3:C4)");
    await expect.poll(() => sheet.value(0, 0)).toBe(12);
    await sheet.waitForSelection(1, 0);
  });

  test("arrow keys pick references there; Esc cancels and returns", async ({
    sheet,
    page,
  }) => {
    await withSecondSheet(sheet, page);
    await sheet.click(1, 1);
    await page.keyboard.type("=1+");
    await tab(page, "Sheet2").click();
    await expect.poll(() => currentSheetName(page)).toBe("Sheet2");
    await page.keyboard.press("ArrowDown");
    // Sheet2's active cell is C4 (after filling C3:C4): one row down
    await expect(page.locator("#luckysheet-functionbox-cell")).toHaveText(
      /^=1\+Sheet2!C\d+$/
    );
    await page.keyboard.press("Escape");
    await expect.poll(() => currentSheetName(page)).toBe("Sheet1");
    await expect.poll(() => sheet.formula(1, 1)).toBeNull();
    await sheet.waitForSelection(1, 1);
  });
});

test.describe("formula bar", () => {
  const bar = (page) => page.locator(".fortune-fx-editor");

  test("Ctrl+Shift+U and the button expand and collapse it", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const collapsed = (await bar(page).boundingBox()).height;
    await page.keyboard.press("Control+Shift+U");
    await expect(bar(page)).toHaveClass(/fortune-fx-editor-expanded/);
    const expanded = (await bar(page).boundingBox()).height;
    expect(expanded).toBeGreaterThan(collapsed + 30);
    // the grid below moved down with it
    const area = await page.locator(".fortune-cell-area").boundingBox();
    expect(area.y).toBeGreaterThan(sheet.box.y + 30);
    await page.getByRole("button", { name: /Collapse Formula Bar/ }).click();
    await expect(bar(page)).not.toHaveClass(/fortune-fx-editor-expanded/);
    // remembered for the workbook
    await page.getByRole("button", { name: /Expand Formula Bar/ }).click();
    await page.reload();
    await page.locator(".fortune-cell-area").waitFor();
    await expect(bar(page)).toHaveClass(/fortune-fx-editor-expanded/);
    await page.evaluate(() => window.localStorage.clear());
  });

  test("dragging the bottom edge resizes it", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    const handle = page.locator(".fortune-fx-resize-handle");
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 90, { steps: 5 });
    await page.mouse.up();
    await expect(bar(page)).toHaveClass(/fortune-fx-editor-expanded/);
    const { height } = await bar(page).boundingBox();
    expect(height).toBeGreaterThan(100);
    await page.evaluate(() => window.localStorage.clear());
  });

  test("Alt+Enter breaks a formula into lines, keeping the indentation", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const fx = page.locator("#luckysheet-functionbox-cell");
    await fx.click();
    await page.keyboard.type("=IF(1>0,");
    await page.keyboard.press("Alt+Enter");
    await page.keyboard.type('  "yes",');
    await page.keyboard.press("Alt+Enter");
    await page.keyboard.type('"no")');
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(0, 0)).toBe("yes");
    expect(await sheet.formula(0, 0)).toBe('=IF(1>0,\n  "yes",\n  "no")');
  });
});

test.describe("formula autocomplete", () => {
  test("sheet names after a quote", async ({ sheet, page }) => {
    await withSecondSheet(sheet, page);
    await sheet.click(0, 0);
    await page.keyboard.type("='Sh");
    const list = page.locator("#luckysheet-formula-search-c");
    await expect(list).toBeVisible();
    await expect(list.locator("[data-func]")).toHaveText([/Sheet1/, /Sheet2/]);
    await list.locator('[data-func="Sheet2"]').click();
    await page.keyboard.type("C3*2");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(0, 0)).toBe(10);
    expect(await sheet.formula(0, 0)).toBe("='Sheet2'!C3*2");
  });

  test("clicking an argument in the hint selects it", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("=IF(A1>0,10,20");
    const hint = page.locator("#luckysheet-formula-help-c");
    await expect(hint).toBeVisible();
    await hint
      .locator(".luckysheet-arguments-help-parameter-link")
      .first()
      .click();
    await expect
      .poll(() => page.evaluate(() => window.getSelection().toString()))
      .toBe("A1>0");
    await page.keyboard.press("Escape");
  });
});

test.describe("AutoFilter and moves", () => {
  test("cut and paste of the filtered range moves the filter", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["Qty", "10", "20", "30"]);
    await sheet.select(0, 0, 3, 0);
    // Home › Sort & Filter › Filter
    await (await toolbarButton(page, "Sort & Filter")).click();
    await page.locator('[data-menu-id="filter-toggle"]').click();
    const filterRange = () =>
      page.evaluate(() => window.__tinysheet.getSheet().filter_select ?? null);
    await expect.poll(filterRange).toMatchObject({
      row: [0, 3],
      column: [0, 0],
    });
    await sheet.select(0, 0, 3, 0);
    await page.keyboard.press("Control+x");
    await sheet.click(0, 3);
    await page.keyboard.press("Control+v");
    await expect.poll(() => sheet.column(3, 0, 3)).toEqual(["Qty", 10, 20, 30]);
    await expect.poll(filterRange).toMatchObject({
      row: [0, 3],
      column: [3, 3],
    });
    // the filter button follows
    await expect(page.locator(".luckysheet-filter-options")).toHaveCount(1);
  });
});
