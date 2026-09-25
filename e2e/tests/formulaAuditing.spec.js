const { test, expect, ribbonItem } = require("../fixtures");

// Formulas tab, R4: trace arrows, Show Formulas, Evaluate Formula, Watch
// Window, error-checking smart tag and manual calculation with F9.

async function openMenu(sheet, page, r, c) {
  const { x, y } = sheet.point(r, c);
  await page.mouse.click(x, y, { button: "right" });
  const menu = page.locator(".fortune-cell-menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** Run an entry of the cell menu's Formula Auditing submenu. */
async function auditMenu(sheet, page, r, c, key) {
  const menu = await openMenu(sheet, page, r, c);
  await menu.locator('[data-key="formula-auditing"]').click();
  await page.locator(`[role=menuitem][data-key="${key}"]`).click();
}

/** A toolbar item of the Formulas tab (switching to it in the ribbon). */
async function toolbarItem(page, name) {
  const item = await ribbonItem(page, `[data-item="${name}"]`);
  await expect(item).toBeVisible();
  return item;
}

async function sumSheet(sheet) {
  await sheet.fillColumn(0, 0, [1, 2, 3, "=SUM(A1:A3)", "=A4*2"]);
  await expect.poll(() => sheet.column(0, 0, 4)).toEqual([1, 2, 3, 6, 12]);
}

test.describe("formula auditing", () => {
  test("trace precedents level by level, then remove the arrows", async ({
    sheet,
    page,
  }) => {
    await sumSheet(sheet);
    await sheet.click(4, 0);
    await auditMenu(sheet, page, 4, 0, "trace-precedents");
    const arrows = page.locator(".fortune-trace-arrow");
    await expect(arrows).toHaveCount(1);
    await auditMenu(sheet, page, 4, 0, "trace-precedents");
    await expect(arrows).toHaveCount(2);
    await expect(page.locator(".fortune-trace-range")).toHaveCount(1);
    // the arrow points down from A4 into A5
    const line = arrows.first().locator("line");
    const y1 = Number(await line.getAttribute("y1"));
    const y2 = Number(await line.getAttribute("y2"));
    expect(y2 - y1).toBeCloseTo(20, 0);

    await sheet.click(0, 0);
    await auditMenu(sheet, page, 0, 0, "trace-dependents");
    await expect(
      page.locator('.fortune-trace-arrow[data-kind="dependent"]')
    ).toHaveCount(1);
    await auditMenu(sheet, page, 0, 0, "remove-arrows");
    await expect(page.locator(".fortune-trace-arrows")).toHaveCount(0);
  });

  test("Ctrl+` shows formulas, Evaluate Formula steps through one", async ({
    sheet,
    page,
  }) => {
    await sumSheet(sheet);
    await sheet.click(4, 0);
    await page.keyboard.press("Control+Backquote");
    await expect(
      (await toolbarItem(page, "show-formulas")).locator("button")
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    await auditMenu(sheet, page, 4, 0, "evaluate-formula");
    const text = page.getByTestId("evaluate-level-0");
    await expect(text).toHaveText("A4*2");
    await expect(text.locator(".fortune-evaluate-next")).toHaveText("A4");
    await page.getByRole("button", { name: "Step In" }).click();
    await expect(page.getByTestId("evaluate-level-1")).toHaveText(
      "= SUM(A1:A3)"
    );
    await page.getByRole("button", { name: "Step Out" }).click();
    await expect(text).toHaveText("6*2");
    await page.getByRole("button", { name: "Evaluate", exact: true }).click();
    await expect(text).toHaveText("12");
    await expect(page.getByRole("button", { name: "Restart" })).toBeVisible();
  });

  test("watch window follows the watched cells", async ({ sheet, page }) => {
    await sumSheet(sheet);
    await sheet.click(3, 0);
    await auditMenu(sheet, page, 3, 0, "add-watch");
    const panel = page.locator(".fortune-watch-window");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("watch-value")).toHaveText("6");
    await sheet.enter(0, 0, "10");
    await expect(panel.getByTestId("watch-value")).toHaveText("15");
    await panel.getByTestId("watch-row").click();
    await panel.getByRole("button", { name: "Delete Watch" }).click();
    await expect(panel.getByTestId("watch-row")).toHaveCount(0);
  });

  test("error smart tag converts a number stored as text", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 1, "'123");
    await sheet.click(0, 1);
    const tag = page.locator(".fortune-error-tag-button");
    await expect(tag).toBeVisible();
    await tag.click();
    await expect(page.locator(".fortune-error-tag-title")).toHaveText(
      "Number Stored as Text"
    );
    await page.getByRole("menuitem", { name: "Convert to Number" }).click();
    await expect.poll(() => sheet.value(0, 1)).toBe(123);
    await expect(tag).toHaveCount(0);
  });
});

test.describe("calculation options", () => {
  test("manual calculation waits for F9", async ({ sheet, page }) => {
    await sumSheet(sheet);
    const combo = await toolbarItem(page, "calculation-options");
    await combo.locator("button").first().click();
    await page.getByRole("menuitemradio", { name: /^Manual/ }).click();

    await sheet.enter(0, 0, "10");
    await expect(page.getByTestId("status-calculate")).toBeVisible();
    expect(await sheet.value(3, 0)).toBe(6);
    await sheet.click(0, 1);
    await page.keyboard.press("F9");
    await expect.poll(() => sheet.column(0, 3, 4)).toEqual([15, 30]);
    await expect(page.getByTestId("status-calculate")).toHaveCount(0);
  });

  test("circular references: warning, status bar, iteration", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "10");
    await sheet.enter(0, 1, "=A1+C1/2");
    await sheet.enter(0, 2, "=B1/2");
    await expect(
      page.getByText(/There are one or more circular references/)
    ).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByTestId("status-circular")).toContainText(
      "Circular References: "
    );

    const combo = await toolbarItem(page, "calculation-options");
    await combo.locator("button").first().click();
    await page.getByRole("menuitem", { name: /Iterative Calculation/ }).click();
    await page.getByTestId("calc-iterate").check();
    await page.getByLabel("Maximum Change:").fill("0.000001");
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await expect.poll(() => sheet.value(0, 1)).toBeCloseTo(40 / 3, 4);
    await expect(page.getByTestId("status-circular")).toHaveCount(0);
  });
});
