const { test, expect } = require("../fixtures");

// Cell menu entries backed by other features, and Excel's Ctrl+- / Ctrl++
// on cell ranges (integration of the phase 2 UI).

async function openMenu(sheet, page, r, c) {
  const { x, y } = sheet.point(r, c);
  await page.mouse.click(x, y, { button: "right" });
  const menu = page.locator(".fortune-cell-menu");
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("cell menu", () => {
  test("Format Cells…, Define Name… and Paste Special… open their dialogs", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["1", "2", "3"]);
    await sheet.select(0, 0, 2, 0);

    let menu = await openMenu(sheet, page, 1, 0);
    await menu.locator('[data-key="cell-format"]').click();
    await expect(page.locator("#fortune-format-cells-title")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#fortune-format-cells-title")).toHaveCount(0);

    menu = await openMenu(sheet, page, 1, 0);
    await menu.locator('[data-key="define-name"]').click();
    const refersTo = page.getByLabel("Refers to:");
    await expect(refersTo).toHaveValue("=Sheet1!$A$1:$A$3");
    await page.getByLabel("Name:").fill("Nums");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.locator(".fortune-name-editor")).toHaveCount(0);
    await sheet.enter(4, 0, "=SUM(Nums)");
    await expect.poll(() => sheet.value(4, 0)).toBe(6);

    await sheet.click(0, 0);
    await sheet.copy();
    menu = await openMenu(sheet, page, 0, 2);
    await menu.locator('[data-key="paste-special"]').click();
    const dialog = page.locator(".fortune-paste-special");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Values", { exact: true }).check();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect.poll(() => sheet.value(0, 2)).toBe(1);
  });

  test("Ctrl+- on cells asks how to shift them", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, ["a", "b", "c"]);
    await sheet.click(0, 0);
    await page.keyboard.press("Control+-");
    const dialog = page.locator(".fortune-cellmenu-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Shift cells up").check();
    await page.getByRole("button", { name: "OK" }).click();
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual(["b", "c", null]);

    await sheet.click(0, 0);
    await page.keyboard.press("Control+Shift+Equal");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
