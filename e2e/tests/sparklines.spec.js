const { test, expect } = require("../fixtures");

// Sparklines (stream R5): Insert › Sparklines with the range picker, the
// cell menu's Sparklines submenu, settings, drawing and undo.

/** Pixels of cell (r, c) on the grid canvas that differ from white. */
async function inkInCell(page, sheet, r, c) {
  const { x, y } = sheet.point(r, c);
  return page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector(".fortune-sheet-canvas");
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const ctx = canvas.getContext("2d");
      const w = Math.round(60 * scale);
      const h = Math.round(14 * scale);
      const { data } = ctx.getImageData(
        Math.round((px - rect.left) * scale - w / 2),
        Math.round((py - rect.top) * scale - h / 2),
        w,
        h
      );
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) ink += 1;
      }
      return ink;
    },
    [x, y]
  );
}

const groups = (page) =>
  page.evaluate(() => window.__tinysheet.getSheet().sparklineGroups ?? null);

test.describe("sparklines", () => {
  test("insert, edit settings, clear and undo", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, ["1", "-2"]);
    await sheet.fillColumn(0, 1, ["4", "3"]);
    await sheet.fillColumn(0, 2, ["2", "5"]);
    await sheet.select(0, 0, 1, 2);

    await page
      .locator('.fortune-toolbar-combo-button[data-tips="Insert Sparklines"]')
      .click();
    const dialog = page.locator(".fortune-sparkline-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Data Range", { exact: true })).toHaveValue(
      "A1:C2"
    );

    // pick the location on the sheet
    await dialog
      .getByRole("button", {
        name: "Select a range on the sheet: Location Range",
      })
      .click();
    const picker = page.locator(".fortune-sparkline-picker");
    await expect(picker).toBeVisible();
    await sheet.select(0, 3, 1, 3);
    await expect(picker.locator("input")).toHaveValue("D1:D2");
    await picker.getByRole("button", { name: "OK" }).click();
    await expect(
      dialog.getByLabel("Location Range", { exact: true })
    ).toHaveValue("D1:D2");
    await dialog.getByRole("radio", { name: "Column", exact: true }).click();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => (await groups(page))?.[0]?.type)
      .toBe("column");
    expect((await groups(page))[0].sparklines).toEqual([
      { r: 0, c: 3, f: "Sheet1!A1:C1" },
      { r: 1, c: 3, f: "Sheet1!A2:C2" },
    ]);
    await expect.poll(() => inkInCell(page, sheet, 0, 3)).toBeGreaterThan(20);
    expect(await inkInCell(page, sheet, 0, 4)).toBe(0);

    // Sparklines › Sparkline Settings… from the cell menu
    const { x, y } = sheet.point(0, 3);
    await page.mouse.click(x, y, { button: "right" });
    const menu = page.locator(".fortune-cell-menu");
    await menu.locator('[data-key="sparkline"]').hover();
    await page.locator('[data-key="sparkline-settings"]').click();
    const settings = page.locator(".fortune-sparkline-settings");
    await expect(settings).toBeVisible();
    await settings.getByRole("radio", { name: "Line", exact: true }).click();
    await settings.getByLabel("Markers", { exact: true }).check();
    await settings.getByLabel("Show Axis").check();
    await settings.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await groups(page))[0])
      .toMatchObject({
        type: "line",
        markers: true,
        displayXAxis: true,
      });

    // clear, then undo brings the sparklines back
    await page.mouse.click(x, y, { button: "right" });
    await menu.locator('[data-key="sparkline"]').hover();
    await page.locator('[data-key="sparkline-clear-groups"]').click();
    await expect.poll(() => groups(page)).toBe(null);
    await expect.poll(() => inkInCell(page, sheet, 0, 3)).toBe(0);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await groups(page))?.[0]?.type).toBe("line");
  });

  test("sparklines follow inserted rows", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, ["1", "2", "3"]);
    await sheet.select(0, 0, 2, 0);
    await page
      .locator('.fortune-toolbar-combo-button[data-tips="Insert Sparklines"]')
      .click();
    const dialog = page.locator(".fortune-sparkline-dialog");
    await dialog.getByLabel("Location Range", { exact: true }).fill("B4");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect.poll(async () => (await groups(page))?.length).toBe(1);

    await page.evaluate(() =>
      window.__tinysheet.insertRowOrColumn("row", 0, 2, "lefttop")
    );
    await expect
      .poll(async () => (await groups(page))[0].sparklines)
      .toEqual([{ r: 5, c: 1, f: "Sheet1!A3:A5" }]);
  });
});
