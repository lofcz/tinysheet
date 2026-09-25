const { test, expect } = require("../fixtures");

const PROTECTED =
  "The cell or chart you're trying to change is on a protected sheet.";

/** Open a toolbar combo's menu (from the "More" overflow if needed). */
async function openMenu(page, testId) {
  const item = page.locator(`[data-testid="${testId}"]`);
  if ((await item.count()) === 0) {
    await page.locator('.fortune-toolbar [aria-label="More"]').click();
  }
  await item.locator(".fortune-toolbar-combo-arrow").click();
}

async function protectSheet(page, password) {
  await openMenu(page, "toolbar-protection");
  await page.getByTestId("menu-protect-sheet").click();
  const dialog = page.getByTestId("protect-sheet-dialog");
  await expect(dialog.getByText("Use AutoFilter")).toBeVisible();
  if (password) {
    await page.getByTestId("protection-password").fill(password);
    await page.getByTestId("protection-ok").click();
    await page.getByTestId("protection-password-confirm").fill(password);
  }
  await page.getByTestId("protection-ok").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__tinysheet.getSheet().config?.authority?.sheet
      )
    )
    .toBe(1);
}

test.describe("sheet protection", () => {
  test("locked cells refuse edits, unlocked ones take them, Tab skips locked cells", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "keep");
    await page.evaluate(() => {
      window.__tinysheet.setCellFormat(1, 1, "lo", 0);
      window.__tinysheet.setCellFormat(1, 3, "lo", 0);
    });
    await protectSheet(page, "pw");

    // typing into a locked cell shows Excel's message
    await sheet.click(0, 0);
    await page.keyboard.type("x");
    await expect(page.getByText(PROTECTED)).toBeVisible();
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await expect(page.getByText(PROTECTED)).toHaveCount(0);
    expect(await sheet.value(0, 0)).toBe("keep");

    // unlocked cells can be edited
    await sheet.enter(1, 1, "42");
    await expect.poll(() => sheet.value(1, 1)).toBe(42);

    // Tab moves between the unlocked cells
    await sheet.click(1, 1);
    await page.keyboard.press("Tab");
    await sheet.waitForSelection(1, 3);
    await page.keyboard.press("Tab");
    await sheet.waitForSelection(1, 1);

    // unprotecting asks for the password
    await openMenu(page, "toolbar-protection");
    await page.getByTestId("menu-protect-sheet").click();
    await page.getByTestId("protection-password").fill("wrong");
    await page.getByTestId("protection-ok").click();
    await expect(
      page.getByText(/password you supplied is not correct/)
    ).toBeVisible();
    await page.getByTestId("protection-password").fill("pw");
    await page.getByTestId("protection-ok").click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__tinysheet.getSheet().config?.authority)
      )
      .toBeUndefined();
    await sheet.enter(0, 0, "free");
    await expect.poll(() => sheet.value(0, 0)).toBe("free");
  });

  test("workbook structure protection blocks adding sheets", async ({
    sheet,
    page,
  }) => {
    expect(sheet).toBeTruthy();
    await openMenu(page, "toolbar-protection");
    await page.getByTestId("menu-protect-workbook").click();
    await page.getByTestId("protection-ok").click();
    await page.locator(".fortune-sheettab-button").first().click();
    await expect(
      page.getByText("Workbook is protected and cannot be changed.")
    ).toBeVisible();
    expect(
      await page.evaluate(() => window.__tinysheet.getAllSheets().length)
    ).toBe(1);
  });
});

test.describe("view options", () => {
  test("gridlines, headings and formula bar toggle", async ({
    sheet,
    page,
  }) => {
    expect(sheet).toBeTruthy();
    const header = page.locator(".fortune-col-header");
    const headerBox = await header.boundingBox();
    expect(headerBox.height).toBeGreaterThan(10);

    await openMenu(page, "toolbar-view-options");
    await page.getByTestId("menu-headings").click();
    await expect
      .poll(async () => (await header.boundingBox())?.height ?? 0)
      .toBeLessThan(2);

    await openMenu(page, "toolbar-view-options");
    await page.getByTestId("menu-formula-bar").click();
    await expect(page.locator(".fortune-fx-editor")).toBeHidden();

    await openMenu(page, "toolbar-view-options");
    await page.getByTestId("menu-gridlines").click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__tinysheet.getSheet().showGridLines)
      )
      .toBe(0);

    await openMenu(page, "toolbar-view-options");
    await page.getByTestId("menu-headings").click();
    await expect
      .poll(async () => (await header.boundingBox())?.height ?? 0)
      .toBeGreaterThan(10);
  });
});
