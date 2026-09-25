const { test, expect } = require("../fixtures");

test.describe("keyboard navigation", () => {
  test("Enter moves down and Tab moves right", async ({ sheet, page }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("a");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 1], column: [0, 0] });
    await page.keyboard.type("b");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 1], column: [1, 1] });
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 1], column: [0, 0] });
    await page.keyboard.press("Shift+Enter");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 0], column: [0, 0] });
    await expect.poll(() => sheet.column(0, 0, 1)).toEqual(["a", "b"]);
  });

  test("arrow keys move the selection", async ({ sheet, page }) => {
    await sheet.click(2, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [3, 3], column: [3, 3] });
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [2, 2], column: [2, 2] });
  });

  test("Ctrl+Arrow jumps to the edge of the data region", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, [1, 2, 3, 4]);
    await sheet.click(0, 0);
    await page.keyboard.press("Control+ArrowDown");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [3, 3], column: [0, 0] });
    await page.keyboard.press("Control+ArrowUp");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 0], column: [0, 0] });
    await page.keyboard.press("Control+Shift+ArrowDown");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 3], column: [0, 0] });
  });

  test("undo and redo", async ({ sheet, page }) => {
    await sheet.enter(0, 0, "first");
    await sheet.enter(0, 0, "second");
    await expect.poll(() => sheet.value(0, 0)).toBe("second");
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.value(0, 0)).toBe("first");
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.value(0, 0)).toBeNull();
    await page.keyboard.press("Control+y");
    await expect.poll(() => sheet.value(0, 0)).toBe("first");
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => sheet.value(0, 0)).toBe("second");
  });
});
