const { test, expect } = require("../fixtures");

test.describe("fill handle", () => {
  test("dragging extends a numeric series", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, [1, 2]);
    await sheet.select(0, 0, 1, 0);
    const handle = page.locator(".luckysheet-cs-fillhandle");
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const target = sheet.point(5, 0);
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();
    await expect
      .poll(() => sheet.column(0, 0, 6))
      .toEqual([1, 2, 3, 4, 5, 6, null]);
  });

  test("dragging a formula adjusts relative references", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, [1, 2, 3]);
    await sheet.enter(0, 1, "=A1*10");
    await sheet.click(0, 1);
    const box = await page.locator(".luckysheet-cs-fillhandle").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const target = sheet.point(2, 1);
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => sheet.column(1, 0, 2)).toEqual([10, 20, 30]);
    expect(await sheet.formula(2, 1)).toBe("=A3*10");
  });
});

test.describe("clipboard", () => {
  test("copy and paste a range within the sheet", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, [1, 2]);
    await sheet.select(0, 0, 1, 0);
    await sheet.copy();
    await sheet.click(0, 3);
    await page.keyboard.press("Control+v");
    await expect.poll(() => sheet.column(3, 0, 2)).toEqual([1, 2, null]);
    // The source is untouched.
    expect(await sheet.column(0, 0, 1)).toEqual([1, 2]);
  });

  test("pasted formulas keep relative references", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, [1, 2]);
    await sheet.enter(0, 1, "=A1+100");
    await sheet.click(0, 1);
    await sheet.copy();
    await sheet.click(1, 1);
    await page.keyboard.press("Control+v");
    await expect.poll(() => sheet.value(1, 1)).toBe(102);
    expect(await sheet.formula(1, 1)).toBe("=A2+100");
  });
});
