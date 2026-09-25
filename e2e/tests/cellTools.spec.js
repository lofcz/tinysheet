const { test, expect } = require("../fixtures");

// Cell checkboxes, Flash Fill, Goal Seek, Data Tables and Advanced Filter
// (stream R7).

/** A toolbar button, opening the "More" overflow menu when it is there. */
async function toolbarButton(page, name) {
  const inBar = page.locator(
    `.fortune-toolbar [role=button][aria-label="${name}"]`
  );
  if (!(await inBar.first().isVisible().catch(() => false))) {
    await page
      .locator('.fortune-toolbar [role=button][aria-label="More"]')
      .click();
  }
  return page.locator(`[role=button][aria-label="${name}"]`).first();
}

async function openDataTools(page) {
  await (await toolbarButton(page, "Data tools")).click();
}

test.describe("cell controls and data tools", () => {
  test("checkboxes: insert, click the box, Space, Delete", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 1, "=COUNTIF(A1:A3,TRUE)");
    await sheet.select(0, 0, 2, 0);
    await (await toolbarButton(page, "Checkbox")).click();
    await expect
      .poll(() => sheet.column(0, 0, 2))
      .toEqual([false, false, false]);
    // the box is centred in the cell: a click on it toggles
    await sheet.click(1, 0);
    await expect.poll(() => sheet.value(1, 0)).toBe(true);
    await expect.poll(() => sheet.value(0, 1)).toBe(1);
    // a click in the cell margin only selects
    const { x, y } = sheet.point(2, 0);
    await page.mouse.click(x - 30, y);
    await sheet.waitForSelection(2, 0);
    await expect.poll(() => sheet.value(2, 0)).toBe(false);
    // Space toggles the selection: mixed -> all checked
    await sheet.select(0, 0, 2, 0);
    await page.keyboard.press("Space");
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual([true, true, true]);
    await expect.poll(() => sheet.value(0, 1)).toBe(3);
    // Delete unchecks
    await page.keyboard.press("Delete");
    await expect
      .poll(() => sheet.column(0, 0, 2))
      .toEqual([false, false, false]);
    // undo restores the checked boxes
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual([true, true, true]);
  });

  test("Flash Fill with Ctrl+E fills the column and reports the count", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, [
      "nancy.davolio@contoso.com",
      "andrew.fuller@contoso.com",
      "janet.leverling@contoso.com",
    ]);
    await sheet.enter(0, 1, "Nancy Davolio");
    await sheet.click(1, 1);
    await page.keyboard.press("Control+e");
    await expect
      .poll(() => sheet.column(1, 0, 2))
      .toEqual(["Nancy Davolio", "Andrew Fuller", "Janet Leverling"]);
    await expect(page.getByText("Flash Fill: 2 cells changed")).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.column(1, 1, 2)).toEqual([null, null]);
  });

  test("Goal Seek finds the input value, OK keeps it", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "2");
    await sheet.enter(0, 1, "=A1*A1");
    await sheet.click(0, 1);
    await openDataTools(page);
    await page.getByText("Goal Seek…", { exact: true }).click();
    const dialog = page.locator(".fortune-goal-seek");
    await expect(dialog.locator("#fortune-goal-seek-set")).toHaveValue("$B$1");
    await dialog.locator("#fortune-goal-seek-to").fill("49");
    await dialog.locator("#fortune-goal-seek-changing").fill("A1");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(
      page.getByText("Goal Seeking with Cell B1 found a solution.")
    ).toBeVisible();
    await page
      .locator(".fortune-goal-seek-status")
      .getByRole("button", { name: "OK" })
      .click();
    await expect
      .poll(async () => Math.abs((await sheet.value(0, 0)) - 7))
      .toBeLessThan(0.001);
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.value(0, 0)).toBe(2);
  });

  test("Data Table fills its body and follows the model", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "2"); // input cell A1
    await sheet.enter(2, 1, "=A1*10"); // formula B3
    await sheet.fillColumn(3, 0, ["1", "5"]); // input values A4:A5
    await sheet.select(2, 0, 4, 1);
    await openDataTools(page);
    await page.getByText("Data Table…", { exact: true }).click();
    const dialog = page.locator(".fortune-data-table");
    await dialog.locator("#fortune-data-table-col").fill("A1");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect.poll(() => sheet.column(1, 3, 4)).toEqual([10, 50]);
    // the formula changes: the body follows
    await sheet.enter(2, 1, "=A1*100");
    await expect.poll(() => sheet.column(1, 3, 4)).toEqual([100, 500]);
    // part of the body can't be edited
    await sheet.click(3, 1);
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Cannot change part of a data table.")
    ).toBeVisible();
    await expect.poll(() => sheet.value(3, 1)).toBe(100);
  });

  test("Advanced Filter: criteria range, in place, then Clear", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 3, ["Salesperson", "Davolio"]); // criteria D1:D2
    await sheet.fillColumn(4, 0, [
      "Salesperson",
      "Suyama",
      "Davolio",
      "Fuller",
      "Davolio",
    ]);
    await sheet.click(5, 0);
    await openDataTools(page);
    await page.getByText("Advanced Filter…", { exact: true }).click();
    const dialog = page.locator(".fortune-advanced-filter");
    await expect(dialog.locator("#fortune-af-list")).toHaveValue("$A$5:$A$9");
    await dialog.locator("#fortune-af-criteria").fill("D1:D2");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("2 of 4 records found.")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(window.__tinysheet.getSheet().config.rowhidden || {})
        )
      )
      .toEqual(["5", "7"]);
    await openDataTools(page);
    await page.getByText("Clear Advanced Filter", { exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(window.__tinysheet.getSheet().config.rowhidden || {})
        )
      )
      .toEqual([]);
  });
});
