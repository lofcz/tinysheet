const { test, expect } = require("../fixtures");

// Outline and subtotals (stream R3): Data › Subtotal, the outline gutter,
// Group / Ungroup with Shift+Alt+Right / Left.

async function openOutlineMenu(page) {
  const item = page.locator('[data-tips="Group & Outline"]').first();
  if (!(await item.isVisible())) {
    await page.locator('[data-tips="More"]').first().click();
  }
  await item.click();
}

function config(page) {
  return page.evaluate(() => window.__tinysheet.getSheet().config || {});
}

async function hiddenRows(page) {
  const cfg = await config(page);
  return Object.keys(cfg.rowhidden || {})
    .map(Number)
    .sort((a, b) => a - b);
}

test.describe("outline", () => {
  test("Subtotal inserts totals, the gutter collapses them, undo restores", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["Region", "East", "East", "West"]);
    await sheet.fillColumn(0, 1, ["Qty", "1", "2", "3"]);
    await sheet.click(1, 0);
    await openOutlineMenu(page);
    await page.getByText("Subtotal…", { exact: true }).click();
    const dialog = page.getByTestId("subtotal-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Qty")).toBeChecked();
    await dialog.getByRole("button", { name: "OK" }).click();

    await expect
      .poll(() => sheet.column(0, 0, 6))
      .toEqual([
        "Region",
        "East",
        "East",
        "East Total",
        "West",
        "West Total",
        "Grand Total",
      ]);
    await expect.poll(() => sheet.column(1, 3, 6)).toEqual([3, 3, 3, 6]);
    expect(await sheet.formula(6, 1)).toBe("=SUBTOTAL(9,B2:B6)");

    const gutter = page.locator(".fortune-outline-rows");
    await expect(gutter).toBeVisible();
    await gutter.getByRole("button", { name: "Show outline level 2" }).click();
    await expect.poll(() => hiddenRows(page)).toEqual([1, 2, 4]);
    await gutter.getByRole("button", { name: "Show outline level 3" }).click();
    await expect.poll(() => hiddenRows(page)).toEqual([]);
    await gutter
      .getByRole("button", { name: "Collapse group (rows 2–3)" })
      .click();
    await expect.poll(() => hiddenRows(page)).toEqual([1, 2]);
    // the total skips nothing (SUBTOTAL 9), the collapsed rows stay counted
    await expect.poll(() => sheet.value(6, 1)).toBe(6);

    // collapse, the level buttons and Subtotal are one undo step each
    await page.keyboard.press("Control+z");
    await expect.poll(() => hiddenRows(page)).toEqual([]);
    await page.keyboard.press("Control+z");
    await expect.poll(() => hiddenRows(page)).toEqual([1, 2, 4]);
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => sheet.column(0, 0, 4))
      .toEqual(["Region", "East", "East", "West", null]);
    await expect(gutter).toHaveCount(0);
  });

  test("Shift+Alt+Right / Left group and ungroup rows and columns", async ({
    sheet,
    page,
  }) => {
    // a plain range: asked whether to group rows or columns
    await sheet.select(1, 1, 2, 3);
    await page.keyboard.press("Shift+Alt+ArrowRight");
    const dialog = page.getByTestId("outline-group-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Columns").check();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await config(page)).colOutlineLevel)
      .toEqual({ 1: 1, 2: 1, 3: 1 });
    await expect(page.locator(".fortune-outline-cols")).toBeVisible();

    await page.keyboard.press("Shift+Alt+ArrowLeft");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Columns").check();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await config(page)).colOutlineLevel)
      .toBeUndefined();
    await expect(page.locator(".fortune-outline-cols")).toHaveCount(0);

    // whole rows: grouped directly, the gutter's button collapses them
    const header = await page.locator(".fortune-row-header").boundingBox();
    const y = (r) => header.y + r * 20 + 10;
    await page.mouse.click(header.x + 10, y(1));
    await page.keyboard.down("Shift");
    await page.mouse.click(header.x + 10, y(3));
    await page.keyboard.up("Shift");
    await page.keyboard.press("Shift+Alt+ArrowRight");
    await expect
      .poll(async () => (await config(page)).rowOutlineLevel)
      .toEqual({ 1: 1, 2: 1, 3: 1 });
    await page
      .locator(".fortune-outline-rows")
      .getByRole("button", { name: "Collapse group (rows 2–4)" })
      .click();
    await expect.poll(() => hiddenRows(page)).toEqual([1, 2, 3]);
    await page
      .locator(".fortune-outline-rows")
      .getByRole("button", { name: "Expand group (rows 2–4)" })
      .click();
    await expect.poll(() => hiddenRows(page)).toEqual([]);
  });
});
