const { test, expect } = require("../fixtures");
const {
  openChartBook,
  chartOf,
  chartBox,
  selectChart,
  showTab,
  command,
} = require("../chartHelpers");

// The chart's contextual tabs (Chart Design, Format) and the buttons next
// to a selected chart, driven with the mouse and keyboard.

const tabIds = (page) =>
  page
    .locator(".fortune-ribbon [role=tab]")
    .evaluateAll((els) => els.map((el) => el.dataset.tab));

const activeTab = (page) =>
  page
    .locator('.fortune-ribbon [role=tab][aria-selected="true"]')
    .getAttribute("data-tab");

test.describe("chart contextual tabs", () => {
  test("show while a chart is selected, after the other tabs; deselecting goes back", async ({
    page,
  }) => {
    const sheet = await openChartBook(page);
    await showTab(page, "formulas");
    expect(await tabIds(page)).not.toContain("chartDesign");
    await selectChart(page);
    const ids = await tabIds(page);
    expect(ids.slice(-2)).toEqual(["chartDesign", "chartFormat"]);
    // grouped under the "Chart Tools" header
    await expect(
      page.locator(
        '.fortune-ribbon .ts-tabs-context-caption[data-context="chartTools"]'
      )
    ).toHaveText(/chart tools/i);
    await expect(
      page.locator(
        '.fortune-ribbon .ts-tabs-context[data-context="chartTools"]'
      )
    ).toBeVisible();
    // selecting a chart does not switch tabs (Excel)
    expect(await activeTab(page)).toBe("formulas");
    await showTab(page, "chartFormat");
    await expect(page.getByTestId("chart-element-select")).toBeVisible();
    // a click on a cell deselects: the tabs go, the ribbon returns
    await sheet.click(10, 1);
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
    ).toHaveCount(0);
    expect(await activeTab(page)).toBe("formulas");
  });

  test("keyboard: arrows reach the contextual tabs, Esc deselects the chart", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    const home = page.locator('.fortune-ribbon [role=tab][data-tab="home"]');
    await home.focus();
    await page.keyboard.press("End");
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartFormat"]')
    ).toBeFocused();
    expect(await activeTab(page)).toBe("chartFormat");
    await page.keyboard.press("ArrowLeft");
    expect(await activeTab(page)).toBe("chartDesign");
    // Escape on the chart deselects it
    await chartBox(page).focus();
    await page.keyboard.press("Escape");
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
    ).toHaveCount(0);
    expect(await activeTab(page)).toBe("home");
  });

  test("inserting a chart shows Chart Design", async ({ page }) => {
    const sheet = await openChartBook(page, null);
    await sheet.select(0, 0, 5, 2);
    await showTab(page, "insert");
    await page
      .locator(".fortune-ribbon-commands")
      .getByRole("button", { name: "Insert Column or Bar Chart", exact: true })
      .first()
      .click();
    await expect.poll(() => activeTab(page)).toBe("chartDesign");
    const charts = await page.evaluate(
      () => window.__tinysheet.getSheet().charts
    );
    expect(charts).toHaveLength(1);
  });
});

test.describe("Chart Design", () => {
  test("Add Chart Element: title, legend, data table, axes, gridlines, trendline", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    const open = async (element, item) => {
      await command(page, "Add Chart Element").click();
      const menu = page.locator(".ts-popover [role=menu]").first();
      await menu.locator(`[data-key="${element}"]`).hover();
      await menu.locator(`[data-key="${element}-${item}"]`).click();
    };
    await open("chartTitle", "none");
    await expect.poll(async () => (await chartOf(page)).title).toBeFalsy();
    await open("chartTitle", "overlay");
    await expect
      .poll(async () => (await chartOf(page)).titleOverlay)
      .toBe(true);
    await open("legend", "top");
    await expect.poll(async () => (await chartOf(page)).legend).toBe("top");
    await open("dataTable", "keys");
    await expect(
      chartBox(page).locator('svg [data-chart-el="dataTable"]')
    ).toHaveCount(1);
    await open("axes", "vertical");
    await expect
      .poll(async () => (await chartOf(page)).axes)
      .toEqual({ value: false });
    await open("gridlines", "majorVertical");
    await expect
      .poll(async () => (await chartOf(page)).categoryGridlines)
      .toBe(true);
    await open("axisTitles", "horizontal");
    await expect
      .poll(async () => (await chartOf(page)).categoryAxisTitle)
      .toBe("Axis Title");
    // a trendline on a chart of two series asks for the series
    await open("trendline", "linear");
    const picker = page.getByTestId("chart-series-picker");
    await expect(picker).toBeVisible();
    await picker.getByRole("option", { name: "Cost" }).click();
    await picker.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await chartOf(page)).series[1].trendlines)
      .toEqual([{ type: "linear" }]);
    // undo takes back the last element
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await chartOf(page)).series[1].trendlines)
      .toBeUndefined();
  });

  test("Quick Layout, Change Colors and the style gallery preview and apply", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    await command(page, "Quick Layout").click();
    const gallery = page.locator(".ts-popover .ts-gallery").first();
    await gallery.getByRole("button", { name: "Layout 5" }).click();
    await expect
      .poll(async () => (await chartOf(page)).dataTable)
      .toEqual({ legendKeys: true });
    expect((await chartOf(page)).valueAxisTitle).toBe("Axis Title");

    await command(page, "Change Colors").click();
    const palette = page.locator(
      '.ts-chart-palette[data-palette="monochrome2"]'
    );
    await palette.hover();
    // hover previews on the chart without changing it
    await expect(
      chartBox(page).locator("svg rect[fill='#9E480E']").first()
    ).toBeVisible();
    expect((await chartOf(page)).palette).toBeUndefined();
    await palette.click();
    await expect
      .poll(async () => (await chartOf(page)).palette)
      .toBe("monochrome2");

    await page.locator('.ts-chart-style-strip-tile[data-style="3"]').click();
    await expect.poll(async () => (await chartOf(page)).style).toBe(3);
  });

  test("Switch Row/Column and Change Chart Type", async ({ page }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    await command(page, "Switch Row/Column").click();
    await expect.poll(async () => (await chartOf(page)).series.length).toBe(5);
    await command(page, "Switch Row/Column").click();
    await expect.poll(async () => (await chartOf(page)).series.length).toBe(2);
    await command(page, "Change Chart Type").click();
    const dialog = page.getByRole("dialog", { name: "Change Chart Type" });
    await expect(dialog).toBeVisible();
    // opens on All Charts with the chart's own type selected
    await expect(
      dialog.locator('[data-chart-option="columnClustered"]')
    ).toHaveAttribute("aria-selected", "true");
    await dialog.locator('[data-chart-family="line"]').click();
    await dialog.locator('[data-chart-option="lineMarkers"]').click();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect.poll(async () => (await chartOf(page)).type).toBe("line");
    expect((await chartOf(page)).series).toHaveLength(2);
  });

  test("Move Chart: object in another sheet, then a new sheet", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartDesign");
    await command(page, "Move Chart").click();
    let dialog = page.getByTestId("chart-move");
    await expect(dialog).toContainText(
      "Choose where you want the chart to be placed:"
    );
    await dialog.getByRole("button", { name: "Object in:" }).click();
    await page.locator(".ts-popover [role=menu]").getByText("Other").click();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect.poll(async () => (await chartOf(page)).sheet).toBe("s2");
    // the chart stays selected on the sheet it went to
    await expect(chartBox(page)).toBeVisible();
    await expect(
      page.locator('.fortune-ribbon [role=tab][data-tab="chartDesign"]')
    ).toBeVisible();

    await showTab(page, "chartDesign");
    await command(page, "Move Chart").click();
    dialog = page.getByTestId("chart-move");
    await dialog.getByLabel("New sheet:").first().check();
    await expect(dialog.getByRole("textbox")).toHaveValue("Chart1");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__tinysheet.getAllSheets().map((s) => s.name)
        )
      )
      .toContain("Chart1");
    const moved = await chartOf(page);
    const sheets = await page.evaluate(() =>
      window.__tinysheet.getAllSheets().map((s) => ({ id: s.id, name: s.name }))
    );
    expect(sheets.find((s) => s.id === moved.sheet).name).toBe("Chart1");
    // the series still read the Sales sheet
    expect(moved.series[0].values.sheetId).toBe("s1");
  });
});

test.describe("Format", () => {
  test("element list, Shape Fill, Format Selection, Reset to Match Style, Size", async ({
    page,
  }) => {
    await openChartBook(page);
    await selectChart(page);
    await showTab(page, "chartFormat");
    await page.getByTestId("chart-element-select").getByRole("button").click();
    await page
      .locator(".ts-popover [role=menu]")
      .getByText("Legend", { exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise((resolve) =>
              window.__tinysheet.setContext((ctx) => resolve(ctx.chartElement))
            )
        )
      )
      .toBe("legend");
    // the legend is outlined on the chart
    await expect(
      chartBox(page).locator(
        '.fortune-chart-element-outline[data-element="legend"]'
      )
    ).toBeVisible();
    await command(page, "Shape Fill").click();
    await page
      .locator(".ts-popover")
      .getByRole("button", { name: /Gold, Accent 4$/ })
      .first()
      .click();
    await expect
      .poll(async () => (await chartOf(page)).formats?.legend?.fill)
      .toMatch(/^#/);
    await command(page, "Format Selection").click();
    await expect(
      page.getByRole("complementary", { name: "Format Legend" })
    ).toBeVisible();
    await command(page, "Reset to Match Style").click();
    await expect
      .poll(async () => (await chartOf(page)).formats)
      .toBeUndefined();

    // a click on a series selects it (Excel)
    const bar = chartBox(page)
      .locator('[data-chart-el="series:1"] rect')
      .first();
    await bar.click();
    await expect(
      page.getByRole("complementary", { name: "Format Data Series" })
    ).toBeVisible();

    const width = page.getByTestId("chart-size-width").locator("input");
    await width.fill("6");
    await width.press("Enter");
    await expect.poll(async () => (await chartOf(page)).width).toBe(576);
  });
});

test.describe("chart buttons", () => {
  test("Chart Elements, Chart Styles and Chart Filters", async ({ page }) => {
    await openChartBook(page);
    await selectChart(page);
    const box = chartBox(page);
    // the three buttons sit outside the chart's top right corner
    const b = await box.boundingBox();
    const plus = await page
      .locator('[data-chart-button="elements"]')
      .boundingBox();
    expect(plus.x).toBeGreaterThan(b.x + b.width);
    expect(Math.abs(plus.y - b.y)).toBeLessThan(4);

    await page.locator('[data-chart-button="elements"]').click();
    const elements = page.getByTestId("chart-elements");
    await elements.getByRole("checkbox", { name: "Data Labels" }).check();
    await expect.poll(async () => (await chartOf(page)).dataLabels).toBe(true);
    await elements.getByRole("checkbox", { name: "Legend" }).uncheck();
    await expect.poll(async () => (await chartOf(page)).legend).toBe("none");
    await page.keyboard.press("Escape");

    await selectChart(page);
    await page.locator('[data-chart-button="styles"]').click();
    const styles = page.getByTestId("chart-styles-flyout");
    await styles.getByRole("tab", { name: "Color" }).click();
    await styles.locator('[data-palette="colorful3"]').click();
    await expect
      .poll(async () => (await chartOf(page)).palette)
      .toBe("colorful3");
    await page.keyboard.press("Escape");

    await selectChart(page);
    await page.locator('[data-chart-button="filters"]').click();
    const filters = page.getByTestId("chart-filters");
    // hovering a series emphasises it
    await filters.locator('[data-series="1"]').hover();
    await expect(box).toHaveAttribute("data-focus-series", "1");
    await filters.locator('[data-series="1"]').getByRole("checkbox").uncheck();
    await filters
      .locator('[data-category="1"]')
      .getByRole("checkbox")
      .uncheck();
    // nothing changes before Apply
    expect((await chartOf(page)).series[1].filtered).toBeUndefined();
    await filters.getByRole("button", { name: "Apply" }).click();
    await expect
      .poll(async () => (await chartOf(page)).series[1].filtered)
      .toBe(true);
    expect((await chartOf(page)).hiddenCategories).toEqual([1]);
    await expect(box.locator('svg [data-chart-el="series:1"]')).toHaveCount(0);
    await expect(box.locator("svg text", { hasText: "Feb" })).toHaveCount(0);
    // Select Data… opens the dialog
    await filters.getByRole("button", { name: "Select Data…" }).click();
    await expect(page.getByTestId("chart-select-data")).toBeVisible();
  });
});
