const { test, expect, toolbarButton } = require("../fixtures");

// Tables and slicers (stream R14): header filter buttons, the total-row
// dropdown, calculated columns and slicers.

async function makeTable(sheet, page) {
  await sheet.fillColumn(0, 0, ["Region", "East", "West", "East", "North"]);
  await sheet.fillColumn(0, 1, ["Qty", "2", "1", "4", "3"]);
  await sheet.select(0, 0, 4, 1);
  await (await toolbarButton(page, "Format as Table")).click();
  await page.getByRole("button", { name: "Blue", exact: true }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__tinysheet.getSheet().tables?.[0]?.name)
    )
    .toBe("Table1");
}

const hiddenRows = (page) =>
  page.evaluate(() =>
    Object.keys(window.__tinysheet.getSheet().config?.rowhidden || {}).sort()
  );

test.describe("tables", () => {
  test("header filter buttons filter the table", async ({ sheet, page }) => {
    await makeTable(sheet, page);
    const buttons = page.locator(".fortune-table-filter-button");
    await expect(buttons).toHaveCount(2);
    await buttons.first().click();
    const menu = page.locator(".fortune-filter-menu");
    await expect(menu).toBeVisible();
    await menu
      .locator(".select-item", { hasText: "West" })
      .locator("input")
      .uncheck();
    await menu.getByText("Confirm", { exact: true }).click();
    await expect.poll(() => hiddenRows(page)).toEqual(["2"]);
    await expect(
      page.locator(
        ".fortune-table-filter-button.luckysheet-filter-options-active"
      )
    ).toHaveCount(1);
  });

  test("a formula fills a calculated column", async ({ sheet, page }) => {
    await makeTable(sheet, page);
    await sheet.enter(0, 2, "Double");
    await sheet.enter(1, 2, "=[@Qty]*2");
    await expect.poll(() => sheet.column(2, 1, 4)).toEqual([4, 2, 8, 6]);
    await expect(page.locator(".fortune-table-autocorrect")).toBeVisible();
  });

  test("total row function dropdown", async ({ sheet, page }) => {
    await makeTable(sheet, page);
    await sheet.click(1, 0);
    await (await toolbarButton(page, "Format as Table")).click();
    await page.getByText("Table Design…", { exact: true }).click();
    await page.getByLabel("Total row").check();
    await page
      .locator(".fortune-table-design")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await sheet.click(5, 1);
    await page.getByRole("button", { name: "Total row function" }).click();
    await page.getByRole("option", { name: "Max" }).click();
    await expect
      .poll(() => sheet.formula(5, 1))
      .toBe("=SUBTOTAL(104,Table1[Qty])");
    await expect.poll(() => sheet.value(5, 1)).toBe(4);
  });

  test("slicers filter the table", async ({ sheet, page }) => {
    await makeTable(sheet, page);
    await sheet.click(2, 0);
    await (await toolbarButton(page, "Slicer")).click();
    const dialog = page.locator(".fortune-slicer-insert");
    await dialog.getByLabel("Region").check();
    await dialog.getByRole("button", { name: "OK" }).click();
    const slicer = page.locator(".fortune-slicer");
    await expect(slicer).toBeVisible();
    await expect(slicer.getByRole("option")).toHaveText([
      "East",
      "North",
      "West",
    ]);
    await slicer.getByRole("option", { name: "East" }).click();
    await expect.poll(() => hiddenRows(page)).toEqual(["2", "4"]);
    // Ctrl+click adds an item
    await slicer
      .getByRole("option", { name: "West" })
      .click({ modifiers: ["Control"] });
    await expect.poll(() => hiddenRows(page)).toEqual(["4"]);
    // the header button shows the filter; Clear Filter shows every row
    await expect(
      page.locator(
        ".fortune-table-filter-button.luckysheet-filter-options-active"
      )
    ).toHaveCount(1);
    await slicer.getByRole("button", { name: "Clear Filter (Alt+C)" }).click();
    await expect.poll(() => hiddenRows(page)).toEqual([]);
    // undo brings the filter back
    await page.keyboard.press("Control+z");
    await expect.poll(() => hiddenRows(page)).toEqual(["4"]);
  });
});
