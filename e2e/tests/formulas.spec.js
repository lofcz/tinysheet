const { test, expect } = require("../fixtures");

test.describe("typing values and formulas", () => {
  test("numbers and SUM", async ({ sheet }) => {
    await sheet.fillColumn(0, 0, [5, 7, "=SUM(A1:A2)"]);
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual([5, 7, 12]);
    expect(await sheet.formula(2, 0)).toBe("=SUM(A1:A2)");
  });

  test("text stays text", async ({ sheet }) => {
    await sheet.enter(0, 0, "hello world");
    await expect.poll(() => sheet.value(0, 0)).toBe("hello world");
  });

  test("SEQUENCE spills into the cells below", async ({ sheet }) => {
    await sheet.enter(0, 1, "=SEQUENCE(4)");
    await expect.poll(() => sheet.column(1, 0, 4)).toEqual([1, 2, 3, 4, null]);
    // Editing a precedent re-evaluates the spill.
    await sheet.enter(0, 2, "3");
    await sheet.enter(0, 1, "=SEQUENCE(C1)");
    await expect
      .poll(() => sheet.column(1, 0, 4))
      .toEqual([1, 2, 3, null, null]);
  });

  test("XLOOKUP", async ({ sheet }) => {
    await sheet.fillColumn(0, 0, ["apple", "banana", "cherry"]);
    await sheet.fillColumn(0, 1, [10, 20, 30]);
    await sheet.enter(0, 3, '=XLOOKUP("banana",A1:A3,B1:B3)');
    await sheet.enter(1, 3, '=XLOOKUP("kiwi",A1:A3,B1:B3,"none")');
    await expect.poll(() => sheet.column(3, 0, 1)).toEqual([20, "none"]);
  });

  test("LET", async ({ sheet }) => {
    await sheet.enter(0, 0, "4");
    await sheet.enter(0, 1, "=LET(x,A1*2,y,3,x+y)");
    await expect.poll(() => sheet.value(0, 1)).toBe(11);
  });
});

test.describe("formula editing aids", () => {
  test("function autocomplete lists and inserts functions", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("=XLOO");
    const list = page.locator(".luckysheet-formula-search-c");
    await expect(list).toBeVisible();
    await expect(
      list.locator(".luckysheet-formula-search-func").first()
    ).toHaveText("XLOOKUP");
    await page.keyboard.press("Tab");
    await expect(sheet.editor).toHaveText("=XLOOKUP(");
    await expect(list).toBeHidden();
  });

  test("argument hint shows the signature", async ({ sheet, page }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("=SUM(");
    const hint = page.locator(".luckysheet-formula-help-c");
    await expect(hint).toBeVisible();
    await expect(hint.locator(".luckysheet-formula-help-title")).toContainText(
      "SUM(number1"
    );
  });

  test("F4 cycles reference anchoring", async ({ sheet, page }) => {
    await sheet.click(0, 1);
    await page.keyboard.type("=A1");
    const cycle = ["=$A$1", "=A$1", "=$A1", "=A1"];
    for (const expected of cycle) {
      await page.keyboard.press("F4");
      await expect(sheet.editor).toHaveText(expected);
    }
    await page.keyboard.press("F4");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(0, 1)).toBe("=$A$1");
  });
});
