const { test, expect } = require("../fixtures");
const { openScenario } = require("../dragHelpers");
const {
  chartBook,
  chartOf,
  chartBox,
  openChartBook,
  selectChart,
  showTab,
  command,
} = require("../chartHelpers");

// Chart behaviour matched to Excel: the Format tab's Insert Shapes, Shape
// Effects, WordArt Styles and Arrange; Quick Layouts; Chart Filters' Names;
// several-area data ranges; frozen panes; the cell selection while a chart
// is selected; number formats linked to source; chart sheets.

const allCharts = (page) =>
  page.evaluate(() =>
    window.__tinysheet.getAllSheets().flatMap((s) => s.charts || [])
  );

/** Click the chart area near the top right corner. */
async function clickChart(page, id = "ch1", modifiers = []) {
  const b = await chartBox(page, id).boundingBox();
  await page.mouse.move(b.x + b.width - 10, b.y + 10);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

test.describe("Format tab", () => {
  test("Insert Shapes: pick a shape, drag in the chart; Delete removes it", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartFormat");
    await command(page, "Shapes").click();
    await page
      .getByTestId("chart-shape-gallery")
      .locator('[data-shape-key="ellipse"]')
      .click();
    const b = await chartBox(page).boundingBox();
    await page.mouse.move(b.x + 100, b.y + 60);
    await page.mouse.down();
    await page.mouse.move(b.x + 196, b.y + 108, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await chartOf(page)).shapes?.length).toBe(1);
    const [shape] = (await chartOf(page)).shapes;
    expect(shape.prst).toBe("ellipse");
    expect(shape.x).toBeCloseTo(100 / 480, 2);
    expect(shape.w).toBeCloseTo(96 / 480, 2);
    // the shape is the selected element; it moves with the chart
    await expect(page.getByTestId("chart-element-select")).toContainText(
      "Oval 1"
    );
    await expect(
      chartBox(page).locator(`[data-chart-shape="${shape.id}"]`)
    ).toBeVisible();
    // Edit Shape › Change Shape
    await command(page, "Edit Shape").click();
    await page.getByRole("menuitem", { name: "Change Shape" }).hover();
    await page
      .getByTestId("chart-shape-gallery")
      .locator('[data-shape-key="rect"]')
      .click();
    await expect
      .poll(async () => (await chartOf(page)).shapes[0].prst)
      .toBe("rect");
    // click the shape (select it), then Delete
    const s = await chartBox(page)
      .locator(`[data-chart-shape="${shape.id}"]`)
      .boundingBox();
    await page.mouse.click(s.x + s.width / 2, s.y + s.height / 2);
    await page.keyboard.press("Delete");
    await expect.poll(async () => (await chartOf(page)).shapes).toBeUndefined();
    // the chart stays
    expect(await chartOf(page)).not.toBeNull();
  });

  test("Shape Effects › Glow on the chart area; WordArt and Text Effects on the title", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartFormat");
    await command(page, "Shape Effects").click();
    await page.getByRole("menuitem", { name: "Glow" }).hover();
    await page
      .getByTestId("chart-fx-glow")
      .getByRole("button", { name: "Glow: 8 point; Orange, Accent color 2" })
      .click();
    await expect
      .poll(async () => (await chartOf(page)).formats?.chartArea?.effects)
      .toEqual({ glow: { color: "#ED7D31", size: 8 } });
    // drawn outside the chart box, like Excel's glow
    await expect(chartBox(page).locator(".fortune-chart-svg")).toHaveCSS(
      "filter",
      /drop-shadow/
    );

    // the title: WordArt style 2 (blue with a shadow)
    const b = await chartBox(page).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + 20);
    await expect(page.getByTestId("chart-element-select")).toContainText(
      "Chart Title"
    );
    await page.locator('[data-wordart="2"]').click();
    await expect
      .poll(async () => (await chartOf(page)).formats?.title?.wordArt)
      .toBe(2);
    expect((await chartOf(page)).formats.title.text).toBe("#4472C4");
    await command(page, "Text Effects").click();
    await page.getByRole("menuitem", { name: "Reflection" }).hover();
    await page
      .getByTestId("chart-fx-reflection")
      .getByRole("button", { name: "Half Reflection: Touching" })
      .click();
    await expect
      .poll(async () => (await chartOf(page)).formats?.title?.textEffects)
      .toMatchObject({ reflection: { size: 0.5 } });
    // the title's text is drawn with its filter and a mirrored copy
    await expect(
      chartBox(page).locator('svg [data-chart-el="title"] text[transform]')
    ).toHaveCount(1);
  });

  test("Rotate is disabled for a chart (charts cannot be rotated)", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartFormat");
    await expect(command(page, "Rotate")).toBeDisabled();
    // Align with one chart: only the snapping options
    await command(page, "Align").click();
    await expect(
      page.getByRole("menuitem", { name: "Align Left" })
    ).toBeDisabled();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Snap to Grid" })
    ).toBeEnabled();
  });
});

test.describe("Arrange with several objects", () => {
  test("Ctrl+click two charts: Shape Format; Align Left and Group", async ({
    page,
  }) => {
    const book = chartBook();
    book[0].charts.push({
      ...book[0].charts[0],
      id: "ch2",
      type: "line",
      title: "Trend",
      left: 520,
      top: 340,
    });
    await openScenario(page, book);
    await clickChart(page, "ch1");
    await clickChart(page, "ch2", ["Control"]);
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="shapeFormat"]')
    ).toBeVisible();
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
    ).toHaveCount(0);
    await showTab(page, "shapeFormat");
    await command(page, "Align").click();
    await page.getByRole("menuitem", { name: "Align Left" }).click();
    await expect
      .poll(async () => (await allCharts(page)).map((c) => c.left))
      .toEqual([380, 380]);
    await command(page, "Group").click();
    await page.getByRole("menuitem", { name: "Group", exact: true }).click();
    await expect
      .poll(
        async () => new Set((await allCharts(page)).map((c) => c.group)).size
      )
      .toBe(1);
    expect((await allCharts(page))[0].group).toBeTruthy();
    // a click on one member selects the group; dragging moves both
    await page.mouse.click(10, 800);
    await clickChart(page, "ch1");
    const b = await chartBox(page, "ch1").boundingBox();
    await page.mouse.move(b.x + b.width - 10, b.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width + 30, b.y + 10, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => (await allCharts(page)).map((c) => c.left))
      .toEqual([420, 420]);
  });
});

test.describe("Quick Layout and Chart Filters", () => {
  test("Layout 6 labels only the last category", async ({ page }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    await command(page, "Quick Layout").click();
    await page
      .locator(".ts-popover .ts-gallery")
      .first()
      .getByRole("button", { name: "Layout 6" })
      .click();
    await expect
      .poll(async () => (await chartOf(page)).dataLabelOptions?.lastPointOnly)
      .toBe(true);
    // one label per series, on May (170 and 100)
    const labels = await chartBox(page).locator("svg > text").allTextContents();
    expect(labels).toEqual(expect.arrayContaining(["170", "100"]));
    expect(labels).not.toContain("120");
  });

  test("Names: series names from (None); the pencil opens Edit Series", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await page.locator('[data-chart-button="filters"]').click();
    const filters = page.getByTestId("chart-filters");
    await filters.getByRole("tab", { name: "Names" }).click();
    await filters
      .getByRole("combobox", { name: "Series names" })
      .selectOption({ label: "(None)" });
    await expect
      .poll(async () => (await chartOf(page)).series.map((s) => s.name))
      .toEqual(["Series1", "Series2"]);
    await expect(filters.locator('[data-series="0"]')).toContainText("Series1");
    await filters
      .getByRole("combobox", { name: "Series names" })
      .selectOption({ label: "Row 1" });
    await expect
      .poll(async () => (await chartOf(page)).series[0].nameRef)
      .toBeTruthy();
    // Edit Series from the pencil of a series row
    await filters.locator('[data-series="1"]').hover();
    await filters
      .locator('[data-series="1"]')
      .getByRole("button", { name: /Edit Series/ })
      .click();
    const dialog = page.getByTestId("chart-edit-series");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("chart-select-data")).toHaveCount(0);
    const name = page.getByTestId("series-name").locator("input");
    await name.fill("Costs");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await chartOf(page)).series[1].name)
      .toBe("Costs");
  });

  test("Select Data: a chart data range of several areas", async ({ page }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    await command(page, "Select Data").click();
    const dialog = page.getByTestId("chart-select-data");
    const range = page.getByTestId("chart-data-range").locator("input");
    await range.fill("=Sales!$A$1:$A$6,Sales!$C$1:$D$6");
    await expect(dialog.getByTestId("chart-series-list")).toContainText("Cost");
    await expect(dialog.getByTestId("chart-series-list")).toContainText(
      "Profit"
    );
    await expect(dialog.getByTestId("chart-series-list")).not.toContainText(
      "Revenue"
    );
    await expect(dialog).not.toContainText("too complex");
    await dialog.getByRole("button", { name: "OK" }).click();
    await selectChart(page);
    await command(page, "Select Data").click();
    await expect(range).toHaveValue("=Sales!$A$1:$A$6,Sales!$C$1:$D$6");
  });
});

test.describe("sheet interplay", () => {
  test("a selected chart hides the cell selection; Esc brings it back", async ({
    page,
  }) => {
    await openChartBook(page);
    await expect(
      page.locator(".luckysheet-cell-selected").first()
    ).toBeVisible();
    const fx = page.locator(".fortune-fx-input");
    const cellText = (await fx.innerText()).trim();
    expect(cellText).not.toBe("");
    await selectChart(page);
    await expect(
      page.locator(".luckysheet-cell-selected").first()
    ).toBeHidden();
    await expect(page.locator(".luckysheet-cell-selected-focus")).toBeHidden();
    // the formula bar shows no cell while the chart is selected
    await expect(fx).toHaveText("");
    // the keyboard goes to the chart
    await expect(chartBox(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.locator(".luckysheet-cell-selected").first()
    ).toBeVisible();
    await expect(fx).toHaveText(cellText);
  });

  test("frozen panes: the source ranges show in the frozen rows too", async ({
    page,
  }) => {
    const book = chartBook();
    book[0].frozen = { type: "row" };
    const sheet = await openScenario(page, book);
    await selectChart(page);
    // names (row 1) are in the frozen row: one copy
    await expect(
      page.locator('.fortune-chart-range[data-part="names"]')
    ).toHaveCount(1);
    await sheet.scroll(0, 60);
    // the chart's top is under the frozen row now: click lower down
    const b = await chartBox(page).boundingBox();
    await page.mouse.click(b.x + b.width - 10, b.y + b.height - 30);
    // scrolled: the names row stays in the frozen pane, drawn there
    await expect(
      page.locator(
        '.fortune-chart-range[data-part="names"][data-pane="frozen"]'
      )
    ).toHaveCount(1);
    const names = await page
      .locator('.fortune-chart-range[data-part="names"]')
      .boundingBox();
    const header = await page.locator(".fortune-col-header").boundingBox();
    expect(names.y).toBeLessThan(header.y + header.height + 24);
  });

  test("number formats linked to source; Format Axis › Number", async ({
    page,
  }) => {
    const book = chartBook();
    book[0].celldata.forEach((cell) => {
      if (typeof cell.v.v === "number") {
        cell.v.v *= 100;
        cell.v.m = cell.v.v.toLocaleString("en-US");
        cell.v.ct = { fa: "#,##0", t: "n" };
      }
    });
    await openScenario(page, book);
    const ticks = () =>
      chartBox(page)
        .locator('svg [data-chart-el="valueAxis"] text')
        .allTextContents();
    await expect.poll(ticks).toContain("12,000");
    await selectChart(page);
    const b = await chartBox(page).boundingBox();
    // double-click the value axis: Format Axis
    const axis = await chartBox(page)
      .locator('svg [data-chart-el="valueAxis"] text')
      .first()
      .boundingBox();
    await page.mouse.dblclick(axis.x + 4, axis.y + axis.height / 2);
    const number = page.getByTestId("chart-number-format");
    await expect(number).toBeVisible();
    await expect(number.getByLabel("Linked to source")).toBeChecked();
    await number.getByLabel("Format Code").fill('"$"#,##0.00');
    await number.getByRole("button", { name: "Add" }).click();
    await expect
      .poll(async () => (await chartOf(page)).valueAxis)
      .toEqual({ numberFormat: '"$"#,##0.00', sourceLinked: false });
    await expect.poll(ticks).toContain("$12,000.00");
    await expect(number.getByLabel("Linked to source")).not.toBeChecked();
    await number.getByLabel("Linked to source").check();
    await expect.poll(ticks).toContain("12,000");
    expect(b).toBeTruthy();
  });

  test("data labels: linked to source; Format Data Labels › Number", async ({
    page,
  }) => {
    const book = chartBook({ dataLabels: true });
    book[0].celldata.forEach((cell) => {
      if (typeof cell.v.v === "number") {
        cell.v.v *= 100;
        cell.v.m = cell.v.v.toLocaleString("en-US");
        cell.v.ct = { fa: "#,##0", t: "n" };
      }
    });
    await openScenario(page, book);
    const texts = () => chartBox(page).locator("svg text").allTextContents();
    // linked: the labels show the cells' #,##0 (13,500 is no axis tick)
    await expect.poll(texts).toContain("13,500");
    await selectChart(page);
    const b = await chartBox(page).boundingBox();
    await page.mouse.dblclick(b.x + b.width - 10, b.y + 10);
    const number = page.getByTestId("chart-number-format");
    await expect(number).toBeVisible();
    await expect(number.getByLabel("Linked to source")).toBeChecked();
    await number.getByLabel("Format Code").fill("0.0");
    await number.getByRole("button", { name: "Add" }).click();
    await expect
      .poll(async () => (await chartOf(page)).dataLabelOptions?.numberFormat)
      .toBe("0.0");
    await expect.poll(texts).toContain("13500.0");
    await number.getByLabel("Linked to source").check();
    await expect.poll(texts).toContain("13,500");
    expect(
      (await chartOf(page)).dataLabelOptions?.numberFormat
    ).toBeUndefined();
  });

  test("Move Chart › New sheet makes a chart sheet; Object in brings it back", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    await command(page, "Move Chart").click();
    const dialog = page.getByTestId("chart-move");
    await dialog.getByLabel("New sheet:").first().check();
    await dialog.getByRole("button", { name: "OK" }).click();
    // a new tab before Sales, active, holding only the chart
    const tabs = page.locator(
      ".fortune-sheettab-container .luckysheet-sheets-item-name"
    );
    await expect(tabs.first()).toHaveText("Chart1");
    const sheets = await page.evaluate(() =>
      [...window.__tinysheet.getAllSheets()]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          name: s.name,
          chartSheet: !!s.chartSheet,
          charts: (s.charts || []).length,
        }))
    );
    expect(sheets[0]).toEqual({ name: "Chart1", chartSheet: true, charts: 1 });
    expect(sheets[1].charts).toBe(0);
    await expect(page.locator(".fortune-container")).toHaveAttribute(
      "data-chart-sheet",
      "true"
    );
    await expect(page.locator(".fortune-sheet-canvas")).toBeHidden();
    // the chart fills the window, selected, with its contextual tabs
    const box = await chartBox(page).boundingBox();
    const area = await page.locator(".fortune-cell-area").boundingBox();
    expect(box.width).toBeGreaterThan(area.width - 80);
    // the chart buttons stay in the window
    const plus = await page
      .locator('[data-chart-button="elements"]')
      .boundingBox();
    expect(plus.x + plus.width).toBeLessThanOrEqual(area.x + area.width);
    expect(box.height).toBeGreaterThan(area.height - 40);
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
    ).toBeVisible();
    // it cannot be dragged away
    await page.mouse.move(box.x + box.width - 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 120, box.y + 80, { steps: 5 });
    await page.mouse.up();
    const after = await chartBox(page).boundingBox();
    expect(Math.round(after.x)).toBe(Math.round(box.x));
    // Object in: back on Sales, the chart sheet removed
    await showTab(page, "chartDesign");
    await command(page, "Move Chart").click();
    await expect(dialog.getByLabel("New sheet:").first()).toBeChecked();
    await dialog.getByLabel("Object in:").first().check();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(tabs.first()).toHaveText("Sales");
    const back = await page.evaluate(() =>
      window.__tinysheet
        .getAllSheets()
        .map((s) => [s.name, (s.charts || []).length])
    );
    expect(back).toEqual([
      ["Sales", 1],
      ["Other", 0],
    ]);
    await expect(page.locator(".fortune-container")).not.toHaveAttribute(
      "data-chart-sheet",
      "true"
    );
  });
});
