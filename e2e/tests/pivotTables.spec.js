const { test, expect, toolbarButton } = require("../fixtures");

// PivotTables (stream R2): Insert › PivotTable, the Fields pane, protected
// report cells, drill-down and the context menu.

const DATA = [
  ["Region", "Product", "Sales"],
  ["East", "Pen", 10],
  ["East", "Book", 20],
  ["West", "Pen", 30],
  ["West", "Book", 40],
];

async function fillData(page) {
  await page.evaluate((rows) => {
    rows.forEach((row, r) =>
      row.forEach((v, c) => window.__tinysheet.setCellValue(r, c, v))
    );
  }, DATA);
}

async function sheetName(page) {
  return page.evaluate(() => window.__tinysheet.getSheet().name);
}

async function values(page, r1, c1, r2, c2) {
  return page.evaluate(
    ([a, b, x, y]) => {
      const out = [];
      for (let r = a; r <= x; r += 1) {
        const row = [];
        for (let c = b; c <= y; c += 1) {
          row.push(window.__tinysheet.getCellValue(r, c) ?? null);
        }
        out.push(row);
      }
      return out;
    },
    [r1, c1, r2, c2]
  );
}

/** Insert › PivotTable on a new sheet, from the data around A1. */
async function insertPivot(sheet, page) {
  await fillData(page);
  await sheet.click(1, 0);
  await (await toolbarButton(page, "PivotTable")).click();
  const dialog = page.getByTestId("pivot-create-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Table/Range")).toHaveValue(
    "Sheet1!$A$1:$C$5"
  );
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(dialog).toBeHidden();
  const pane = page.getByTestId("pivot-fields-pane");
  await expect(pane).toBeVisible();
  return pane;
}

test.describe("PivotTables", () => {
  test("build a report in the Fields pane", async ({ sheet, page }) => {
    const pane = await insertPivot(sheet, page);
    expect(await sheetName(page)).not.toBe("Sheet1");
    await pane.getByLabel("Region", { exact: true }).check();
    await pane.getByLabel("Sales", { exact: true }).check();
    await expect
      .poll(() => values(page, 2, 0, 5, 1))
      .toEqual([
        ["Row Labels", "Sum of Sales"],
        ["East", 30],
        ["West", 70],
        ["Grand Total", 100],
      ]);
    // drag Product to Columns
    await pane
      .locator('.fortune-pivot-field[data-field="Product"]')
      .dragTo(pane.locator('.fortune-pivot-area[data-area="columns"]'));
    await expect
      .poll(() => values(page, 2, 0, 6, 3))
      .toEqual([
        ["Sum of Sales", "Column Labels", null, null],
        ["Row Labels", "Book", "Pen", "Grand Total"],
        ["East", 20, 10, 30],
        ["West", 40, 30, 70],
        ["Grand Total", 60, 40, 100],
      ]);
    // Value Field Settings: Count
    await pane
      .locator(
        '.fortune-pivot-area[data-area="values"] .fortune-pivot-chip-button'
      )
      .click();
    await page.getByRole("menuitem", { name: "Value Field Settings…" }).click();
    const settings = page.getByTestId("pivot-value-settings");
    await settings.getByLabel("Summarize value field by").selectOption("count");
    await settings.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(() => values(page, 2, 0, 2, 0))
      .toEqual([["Count of Sales"]]);
    await expect.poll(() => values(page, 6, 3, 6, 3)).toEqual([[4]]);
  });

  test("report cells are protected; double-click drills down", async ({
    sheet,
    page,
  }) => {
    const pane = await insertPivot(sheet, page);
    await pane.getByLabel("Region", { exact: true }).check();
    await pane.getByLabel("Sales", { exact: true }).check();
    await expect.poll(() => values(page, 4, 1, 4, 1)).toEqual([[70]]);
    const pivotSheet = await sheetName(page);

    await sheet.click(4, 1);
    await page.keyboard.type("5");
    await expect(
      page.getByText("You can't change this part of a PivotTable.")
    ).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect.poll(() => values(page, 4, 1, 4, 1)).toEqual([[70]]);
    await expect(sheet.editor).not.toContainText("5");

    // West's value: its two source rows on a new sheet
    const { x, y } = sheet.point(4, 1);
    await page.mouse.dblclick(x, y);
    await expect.poll(() => sheetName(page)).not.toBe(pivotSheet);
    await expect
      .poll(() => values(page, 0, 0, 3, 2))
      .toEqual([
        ["Region", "Product", "Sales"],
        ["West", "Pen", 30],
        ["West", "Book", 40],
        [null, null, null],
      ]);
  });

  test("context menu: Refresh follows source edits", async ({
    sheet,
    page,
  }) => {
    const pane = await insertPivot(sheet, page);
    await pane.getByLabel("Sales", { exact: true }).check();
    await expect.poll(() => values(page, 3, 0, 3, 0)).toEqual([[100]]);
    const pivotSheet = await page.evaluate(
      () => window.__tinysheet.getSheet().id
    );
    await page.evaluate(() => {
      const src = window.__tinysheet
        .getAllSheets()
        .find((s) => s.name === "Sheet1");
      window.__tinysheet.setCellValue(1, 2, 110, { id: src.id });
    });
    await expect.poll(() => values(page, 3, 0, 3, 0)).toEqual([[100]]);
    const { x, y } = sheet.point(3, 0);
    await page.mouse.click(x, y, { button: "right" });
    await page.getByRole("menuitem", { name: "Refresh" }).click();
    await expect.poll(() => values(page, 3, 0, 3, 0)).toEqual([[200]]);
    expect(await page.evaluate(() => window.__tinysheet.getSheet().id)).toBe(
      pivotSheet
    );
    // close the pane; the menu brings it back
    // the pane is docked: the dock's header closes it
    await page
      .locator(".fortune-side-slot")
      .getByRole("button", { name: "Close pane" })
      .click();
    await expect(pane).toBeHidden();
    await page.mouse.click(x, y, { button: "right" });
    await page.getByRole("menuitem", { name: "Show Field List" }).click();
    await expect(page.getByTestId("pivot-fields-pane")).toBeVisible();
  });
});
