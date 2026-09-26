const { test, expect } = require("../fixtures");
const {
  openChartBook,
  chartOf,
  chartBox,
  selectChart,
  showTab,
  command,
} = require("../chartHelpers");

// Chart data assignment as in Excel: the Select Data Source dialog (series,
// axis labels, reference boxes that pick cells on any sheet, collapsed or
// not, Switch Row/Column, Hidden and Empty Cells, Cancel), the colour
// outlines of the data on the sheet and their handles, and the chart
// following its cells.

async function openSelectData(page) {
  await selectChart(page);
  await showTab(page, "chartDesign");
  await command(page, "Select Data").click();
  const dialog = page.getByTestId("chart-select-data");
  await expect(dialog).toBeVisible();
  return dialog;
}

const seriesNames = (dialog) =>
  dialog
    .getByTestId("chart-series-list")
    .locator("[role=option]")
    .allInnerTexts();

test.describe("Select Data Source", () => {
  test("shows the data range, series and axis labels as Excel", async ({
    page,
  }) => {
    await openChartBook(page);
    const dialog = await openSelectData(page);
    await expect(
      dialog.getByRole("heading", { name: "Select Data Source" })
    ).toBeVisible();
    await expect(
      dialog.getByTestId("chart-data-range").locator("input")
    ).toHaveValue("=Sales!$A$1:$C$6");
    expect(await seriesNames(dialog)).toEqual(["Revenue", "Cost"]);
    await expect(
      dialog.getByTestId("chart-category-list").locator("[role=option]")
    ).toHaveText(["Jan", "Feb", "Mar", "Apr", "May"]);
    for (const name of [
      "Switch Row/Column",
      "Add",
      "Edit",
      "Remove",
      "Move Up",
      "Move Down",
      "Hidden and Empty Cells",
      "OK",
      "Cancel",
    ]) {
      await expect(
        dialog.getByRole("button", { name, exact: true }).first()
      ).toBeVisible();
    }
    await expect(dialog.getByText("Legend Entries (Series)")).toBeVisible();
    await expect(
      dialog.getByText("Horizontal (Category) Axis Labels")
    ).toBeVisible();
  });

  test("add, edit, remove and reorder series; axis labels; OK is one undo step", async ({
    page,
  }) => {
    await openChartBook(page);
    const dialog = await openSelectData(page);
    // Add: Edit Series with a name and values typed in
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    const edit = page.getByTestId("chart-edit-series");
    await expect(
      edit.getByTestId("series-values").locator("input")
    ).toHaveValue("={1}");
    await edit.getByTestId("series-name").locator("input").fill("=Sales!$D$1");
    await expect(edit.getByTestId("series-name")).toContainText("= Profit");
    await edit
      .getByTestId("series-values")
      .locator("input")
      .fill("=Sales!$D$2:$D$6");
    await expect(edit.getByTestId("series-values")).toContainText(
      "= 40, 45, 55, 25, 70"
    );
    // the chart shows it while the dialog is open
    await expect(
      chartBox(page).locator('svg [data-chart-el="series:2"]')
    ).toHaveCount(1);
    await edit.getByRole("button", { name: "OK" }).click();
    expect(await seriesNames(dialog)).toEqual(["Revenue", "Cost", "Profit"]);
    // Move Up
    await dialog.getByRole("button", { name: "Move Up" }).click();
    expect(await seriesNames(dialog)).toEqual(["Revenue", "Profit", "Cost"]);
    // Edit the selected series' name to a typed text
    await dialog
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await edit.getByTestId("series-name").locator("input").fill("Margin");
    await edit.getByRole("button", { name: "OK" }).click();
    expect(await seriesNames(dialog)).toEqual(["Revenue", "Margin", "Cost"]);
    // Remove the first
    await dialog.getByTestId("chart-series-list").getByText("Revenue").click();
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
    expect(await seriesNames(dialog)).toEqual(["Margin", "Cost"]);
    // Axis labels typed as text
    await dialog
      .getByRole("button", { name: "Edit", exact: true })
      .nth(1)
      .click();
    const labels = page.getByTestId("chart-axis-labels");
    await labels.locator("input").fill("Q1,Q2,Q3,Q4,Q5");
    await expect(labels).toContainText("= Q1, Q2, Q3, Q4, Q5");
    await labels.getByRole("button", { name: "OK" }).click();
    await expect(
      dialog.getByTestId("chart-category-list").locator("[role=option]")
    ).toHaveText(["Q1", "Q2", "Q3", "Q4", "Q5"]);
    // the data is no longer one block: Excel's note
    await expect(dialog).toContainText("too complex to be displayed");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(dialog).toHaveCount(0);
    const chart = await chartOf(page);
    expect(chart.series.map((s) => s.name ?? null)).toEqual(["Margin", null]);
    expect(chart.series[0].values.column).toEqual([3, 3]);
    expect(chart.series[1].cache.categories).toEqual([
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "Q5",
    ]);
    // the chart is still selected on its sheet
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
    ).toBeVisible();
    // one undo step brings the chart back
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () =>
        (await chartOf(page)).series.map((s) => s.values.column)
      )
      .toEqual([
        [1, 1],
        [2, 2],
      ]);
  });

  test("Cancel reverts every change made in the dialog", async ({ page }) => {
    await openChartBook(page);
    const before = await chartOf(page);
    const dialog = await openSelectData(page);
    await dialog.getByRole("button", { name: "Switch Row/Column" }).click();
    expect(await seriesNames(dialog)).toHaveLength(5);
    await dialog
      .getByTestId("chart-series-list")
      .locator("[role=option]")
      .first()
      .getByRole("checkbox")
      .uncheck();
    await dialog
      .getByRole("button", { name: "Hidden and Empty Cells" })
      .click();
    const hidden = page.getByTestId("chart-hidden-empty");
    await expect(
      hidden.getByRole("heading", { name: "Hidden and Empty Cell Settings" })
    ).toBeVisible();
    await hidden.getByLabel("Zero").check();
    await hidden.getByLabel("Show data in hidden rows and columns").check();
    await hidden.getByLabel("Show #N/A as an empty cell").check();
    await hidden.getByRole("button", { name: "OK" }).click();
    // live on the chart
    await expect.poll(async () => (await chartOf(page)).series.length).toBe(5);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    const after = await chartOf(page);
    expect(after.series).toEqual(before.series);
    expect(after.displayBlanksAs).toBeUndefined();
    expect(after.plotVisibleOnly).toBeUndefined();
    expect(after.displayNaAsBlank).toBeUndefined();
  });

  test("Hidden and Empty Cells settings are kept on OK", async ({ page }) => {
    await openChartBook(page, { type: "line", markers: true });
    const dialog = await openSelectData(page);
    await dialog
      .getByRole("button", { name: "Hidden and Empty Cells" })
      .click();
    const hidden = page.getByTestId("chart-hidden-empty");
    await expect(hidden.getByLabel("Gaps")).toBeChecked();
    await hidden.getByLabel("Connect data points with line").check();
    await hidden.getByLabel("Show data in hidden rows and columns").check();
    await hidden.getByRole("button", { name: "OK" }).click();
    await dialog.getByRole("button", { name: "OK" }).click();
    const chart = await chartOf(page);
    expect(chart.displayBlanksAs).toBe("span");
    expect(chart.plotVisibleOnly).toBe(false);
  });

  test("reference boxes: select on the sheet, collapse, another sheet, expand", async ({
    page,
  }) => {
    const sheet = await openChartBook(page);
    const dialog = await openSelectData(page);
    // with the dialog open, a selection on the sheet fills Chart data range
    const range = dialog.getByTestId("chart-data-range").locator("input");
    await range.click();
    await sheet.select(0, 0, 5, 1);
    await expect(range).toHaveValue("=Sales!$A$1:$B$6");
    expect(await seriesNames(dialog)).toEqual(["Revenue"]);
    await expect(range).toBeFocused();

    // Edit Series › Series values: collapse, pick on "Other", expand
    await dialog
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    const edit = page.getByTestId("chart-edit-series");
    await edit
      .getByTestId("series-values")
      .getByRole("button", { name: "Collapse dialog" })
      .click();
    // only the one box is left; the Select Data dialog is hidden
    await expect(edit.getByTestId("series-name")).toHaveCount(0);
    await expect(dialog).toBeHidden();
    await page
      .locator(".fortune-sheettab-container")
      .getByText("Other", { exact: true })
      .click();
    await sheet.select(1, 0, 5, 0);
    await expect(
      edit.getByTestId("series-values").locator("input")
    ).toHaveValue("=Other!$A$2:$A$6");
    await edit
      .getByTestId("series-values")
      .getByRole("button", { name: "Expand dialog" })
      .click();
    await expect(edit.getByTestId("series-name")).toBeVisible();
    await expect(edit.getByTestId("series-values")).toContainText(
      "= 100, 110, 120, 130, 140"
    );
    await edit.getByRole("button", { name: "OK" }).click();
    await dialog.getByRole("button", { name: "OK" }).click();
    // back on the chart's sheet with the chart selected
    await expect(chartBox(page)).toBeVisible();
    const chart = await chartOf(page);
    expect(chart.series[0].values).toEqual({
      sheetId: "s2",
      row: [1, 5],
      column: [0, 0],
    });
  });

  test("series formula style references: non-contiguous values", async ({
    page,
  }) => {
    await openChartBook(page);
    const dialog = await openSelectData(page);
    await dialog
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    const edit = page.getByTestId("chart-edit-series");
    await edit
      .getByTestId("series-values")
      .locator("input")
      .fill("=(Sales!$B$2:$B$3,Sales!$B$6)");
    await expect(edit.getByTestId("series-values")).toContainText(
      "= 120, 135, 170"
    );
    await edit.getByRole("button", { name: "OK" }).click();
    await dialog.getByRole("button", { name: "OK" }).click();
    const chart = await chartOf(page);
    expect(chart.series[0].values.areas).toEqual([
      { sheetId: "s1", row: [5, 5], column: [1, 1] },
    ]);
  });
});

test.describe("SERIES formula", () => {
  test("a selected series shows and takes its =SERIES() formula in the formula bar", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await chartBox(page)
      .locator('[data-chart-el="series:1"] rect')
      .first()
      .click();
    const bar = page.getByTestId("series-formula");
    await expect(bar).toHaveValue(
      "=SERIES(Sales!$C$1,Sales!$A$2:$A$6,Sales!$C$2:$C$6,2)"
    );
    // only this series is outlined on the sheet
    await expect(page.locator(".fortune-chart-range")).toHaveCount(3);
    await bar.fill("=SERIES(Sales!$D$1,Sales!$A$2:$A$6,Sales!$D$2:$D$6,1)");
    await bar.press("Enter");
    await expect
      .poll(async () =>
        (await chartOf(page)).series.map((s) => s.values.column)
      )
      .toEqual([
        [3, 3],
        [1, 1],
      ]);
    // the order moved the series first; it stays selected
    await expect(bar).toHaveValue(
      "=SERIES(Sales!$D$1,Sales!$A$2:$A$6,Sales!$D$2:$D$6,1)"
    );
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () =>
        (await chartOf(page)).series.map((s) => s.values.column)
      )
      .toEqual([
        [1, 1],
        [2, 2],
      ]);
  });
});

test.describe("the chart's data on the sheet", () => {
  const outline = (page, part) =>
    page.locator(`.fortune-chart-range[data-part="${part}"]`);

  test("outlines in Excel's colours with corner handles", async ({ page }) => {
    await openChartBook(page);
    await selectChart(page);
    await expect(outline(page, "names")).toHaveCount(1);
    await expect(outline(page, "categories")).toHaveCount(1);
    await expect(outline(page, "values")).toHaveCount(1);
    const colors = await page
      .locator(".fortune-chart-range")
      .evaluateAll((els) =>
        Object.fromEntries(
          els.map((el) => [
            el.dataset.part,
            getComputedStyle(el).borderTopColor,
          ])
        )
      );
    expect(colors).toEqual({
      names: "rgb(255, 97, 107)",
      categories: "rgb(169, 112, 240)",
      values: "rgb(91, 151, 255)",
    });
    await expect(
      outline(page, "values").locator(".fortune-chart-range-handle")
    ).toHaveCount(4);
    // the outlines go with the chart's selection
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-chart-range")).toHaveCount(0);
  });

  test("dragging the values' corner adds a series and points; one undo step", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    const handle = outline(page, "values").locator(
      ".fortune-chart-range-handle.rb"
    );
    const h = await handle.boundingBox();
    const x = h.x + h.width / 2;
    const y = h.y + h.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    // one column right (Profit), no extra rows
    await page.mouse.move(x + 74, y - 4, { steps: 6 });
    // live: the chart shows three series before the release
    await expect(
      chartBox(page).locator('svg [data-chart-el="series:2"]')
    ).toHaveCount(1);
    await page.mouse.up();
    let chart = await chartOf(page);
    expect(chart.series).toHaveLength(3);
    expect(chart.series[2].nameRef).toEqual({
      sheetId: "s1",
      row: [0, 0],
      column: [3, 3],
    });
    // shrink by two rows from the bottom
    const h2 = await outline(page, "values")
      .locator(".fortune-chart-range-handle.rb")
      .boundingBox();
    await page.mouse.move(h2.x + 3, h2.y + 3);
    await page.mouse.down();
    await page.mouse.move(h2.x + 3, h2.y + 3 - 40, { steps: 6 });
    await page.mouse.up();
    chart = await chartOf(page);
    expect(chart.series[0].values.row).toEqual([1, 3]);
    expect(chart.series[0].categories.row).toEqual([1, 3]);
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await chartOf(page)).series[0].values.row)
      .toEqual([1, 5]);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await chartOf(page)).series.length).toBe(2);
  });

  test("dragging an edge moves the data; Esc cancels a drag", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    const edge = outline(page, "values").locator(
      ".fortune-chart-range-edge.right"
    );
    const e = await edge.boundingBox();
    const x = e.x + e.width / 2;
    const y = e.y + e.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 74, y, { steps: 6 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await chartOf(page)).series[0].values.column).toEqual([1, 1]);
    await selectChart(page);
    const e2 = await outline(page, "values")
      .locator(".fortune-chart-range-edge.right")
      .boundingBox();
    await page.mouse.move(e2.x + e2.width / 2, e2.y + e2.height / 2);
    await page.mouse.down();
    await page.mouse.move(e2.x + e2.width / 2 + 74, e2.y + e2.height / 2, {
      steps: 6,
    });
    await page.mouse.up();
    const chart = await chartOf(page);
    // Cost and Profit now, names follow along the header row
    expect(chart.series.map((s) => s.values.column)).toEqual([
      [2, 2],
      [3, 3],
    ]);
    expect(chart.series[1].nameRef.column).toEqual([3, 3]);
  });

  test("the chart follows edits and inserted rows inside its data", async ({
    page,
  }) => {
    const sheet = await openChartBook(page);
    const bars = () =>
      chartBox(page)
        .locator('svg [data-chart-el="series:0"] rect')
        .evaluateAll((els) => els.map((el) => el.getAttribute("height")));
    const before = await bars();
    await sheet.enter(1, 1, "300");
    await expect.poll(bars).not.toEqual(before);
    await page.evaluate(() =>
      window.__tinysheet.insertRowOrColumn("row", 2, 2)
    );
    await expect
      .poll(async () => (await chartOf(page)).series[0].values.row)
      .toEqual([1, 7]);
    await page.evaluate(() =>
      window.__tinysheet.deleteRowOrColumn("row", 3, 4)
    );
    await expect
      .poll(async () => (await chartOf(page)).series[0].values.row)
      .toEqual([1, 5]);
  });
});
