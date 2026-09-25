const { test, expect } = require("../fixtures");

// Sort, filter, remove duplicates and data validation (stream P6).

async function openSortFilterMenu(page) {
  await page
    .locator('.fortune-toolbar-combo-arrow[data-tips="Sort and filter"]')
    .click();
}

test.describe("data tools", () => {
  test("Sort dialog sorts by a column, header detected", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["Name", "pear", "apple", "fig"]);
    await sheet.fillColumn(0, 1, ["Qty", "3", "1", "2"]);
    await sheet.click(1, 0);
    await openSortFilterMenu(page);
    await page.getByText("Sort...", { exact: true }).click();
    const dialog = page.locator(".fortune-sort-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("input[type=checkbox]").first()).toBeChecked();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(() => sheet.column(0, 0, 3))
      .toEqual(["Name", "apple", "fig", "pear"]);
    await expect.poll(() => sheet.column(1, 1, 3)).toEqual([1, 2, 3]);
  });

  test("Remove Duplicates reports what it removed", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, ["City", "Oslo", "Rome", "oslo", "Rome"]);
    await sheet.click(1, 0);
    await openSortFilterMenu(page);
    await page.getByText("Remove Duplicates", { exact: true }).click();
    // text over text: no header guessed, so tick it
    const headers = page.getByLabel("My data has headers");
    await expect(headers).not.toBeChecked();
    await headers.check();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(
      page.getByText(
        "2 duplicate values found and removed; 2 unique values remain."
      )
    ).toBeVisible();
    await expect
      .poll(() => sheet.column(0, 0, 4))
      .toEqual(["City", "Oslo", "Rome", null, null]);
  });

  test("number filter hides rows and shows the record count", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["Qty", "10", "20", "30", "40"]);
    await sheet.select(0, 0, 4, 0);
    await openSortFilterMenu(page);
    await page.getByText("create filter", { exact: true }).click();
    await page.locator(".luckysheet-filter-options").first().click();
    await page.getByText("Number Filters", { exact: true }).hover();
    await page.getByText("Above Average", { exact: true }).click();
    await expect(page.getByText("2 of 4 records found")).toBeVisible();
    const hidden = await page.evaluate(
      () => window.__tinysheet.getSheet().config?.rowhidden
    );
    expect(Object.keys(hidden || {}).sort()).toEqual(["1", "2"]);
  });
});
