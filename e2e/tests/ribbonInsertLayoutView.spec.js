const { test, expect, toolbarButton, ribbonTab } = require("../fixtures");

// The ribbon's Insert, Page Layout and View tabs: every command, its menu
// or gallery, its toggle state and its keyboard access.

// each test walks a whole group of commands
test.describe.configure({ timeout: 90000 });

// a 2 x 2 red PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==",
  "base64"
);

const sheetData = (page) => page.evaluate(() => window.__tinysheet.getSheet());
const pageSetup = async (page) => (await sheetData(page)).pageSetup ?? {};

/** A ribbon button by name, then a menu item of its drop-down. */
async function menuPick(page, button, item, { arrow = false } = {}) {
  const name = arrow ? `${button}: more options` : button;
  await (await toolbarButton(page, name)).click();
  await page
    .getByRole("menuitem", { name: item })
    .or(page.getByRole("menuitemradio", { name: item }))
    .first()
    .click();
}

async function fillSales(sheet) {
  await sheet.fillColumn(0, 0, ["Region", "North", "South", "East"]);
  await sheet.fillColumn(0, 1, ["Q1", "10", "20", "30"]);
  await sheet.fillColumn(0, 2, ["Q2", "15", "25", "5"]);
}

const charts = async (page) => (await sheetData(page)).charts ?? [];

test.describe("Insert tab", () => {
  test("Tables: PivotTable and Table", async ({ sheet, page }) => {
    await fillSales(sheet);
    await sheet.click(1, 0);
    await (await toolbarButton(page, "PivotTable")).click();
    const pivot = page.getByTestId("pivot-create-dialog");
    await expect(pivot).toBeVisible();
    await pivot.getByRole("button", { name: "Cancel" }).click();
    await expect(pivot).toBeHidden();

    await sheet.click(1, 1);
    await (await toolbarButton(page, "Table")).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await sheetData(page)).tables?.[0]?.style)
      .toBe("TableStyleMedium2");
  });

  test("Pictures: Place in Cell and Place over Cells", async ({
    sheet,
    page,
  }) => {
    await sheet.click(1, 1);
    await (await toolbarButton(page, "Pictures")).click();
    // Place in Cell › This Device… opens the file picker
    await page.getByRole("menuitem", { name: "Place in Cell" }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "This Device…" }).click();
    await (
      await chooser
    ).setFiles({ name: "red.png", mimeType: "image/png", buffer: PNG });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window.__tinysheet.getCellValue(1, 1, { type: "img" })?.src ?? ""
          ).slice(0, 10)
        )
      )
      .toBe("data:image");

    // Place in Cell › From a Web Address… is the Insert Picture dialog
    await (await toolbarButton(page, "Pictures")).click();
    await page.getByRole("menuitem", { name: "Place in Cell" }).click();
    await page.getByRole("menuitem", { name: "From a Web Address…" }).click();
    await expect(page.locator(".fortune-cell-image-dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Place over Cells › This Device… inserts a floating picture
    await (await toolbarButton(page, "Pictures")).click();
    await page.getByRole("menuitem", { name: "Place over Cells" }).click();
    const chooser2 = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "This Device…" }).click();
    await (
      await chooser2
    ).setFiles({ name: "red.png", mimeType: "image/png", buffer: PNG });
    await expect
      .poll(
        async () => Object.keys((await sheetData(page)).images ?? {}).length
      )
      .toBe(1);
  });

  test("Shapes gallery draws a shape; Text Box arms drawing", async ({
    sheet,
    page,
  }) => {
    const shapes = async () => (await sheetData(page)).shapes ?? [];
    await (await toolbarButton(page, "Shapes")).click();
    await expect(page.locator(".ts-shape-gallery")).toBeVisible();
    await page.locator('.ts-shape-gallery [data-shape-key="hexagon"]').click();
    const a = sheet.point(3, 3);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 120, a.y + 80, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await shapes()).length).toBe(1);
    expect((await shapes())[0].prst).toBe("hexagon");

    await page.keyboard.press("Escape");
    const textBox = await toolbarButton(page, "Text Box");
    await textBox.click();
    await expect(textBox).toHaveAttribute("aria-pressed", "true");
    const b = sheet.point(10, 1);
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.mouse.move(b.x + 150, b.y + 60, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(async () => (await shapes()).filter((s) => s.textBox).length)
      .toBe(1);
    await expect(textBox).toHaveAttribute("aria-pressed", "false");
  });

  test("Screenshot shows a picture of the selection", async ({
    sheet,
    page,
  }) => {
    await fillSales(sheet);
    await sheet.select(0, 0, 2, 1);
    await (await toolbarButton(page, "Screenshot")).click();
    await expect(page.locator(".ts-screenshot-result img")).toBeVisible();
  });

  test("Charts: family buttons, galleries and Recommended Charts", async ({
    sheet,
    page,
  }) => {
    await fillSales(sheet);
    await sheet.select(0, 0, 3, 2);
    // the main part inserts the family's first type
    await (await toolbarButton(page, "Insert Column or Bar Chart")).click();
    await expect.poll(async () => (await charts(page)).length).toBe(1);
    expect((await charts(page))[0]).toMatchObject({
      type: "column",
      grouping: "clustered",
    });

    // each gallery inserts the picked type
    const families = [
      ["Insert Line or Area Chart", "Stacked area", "area", "stacked"],
      ["Insert Pie or Doughnut Chart", "Doughnut", "doughnut"],
      ["Insert Scatter (X, Y) or Bubble Chart", "Bubble", "bubble"],
      [
        "Insert Waterfall, Statistic, Stock, Radar or Combo Chart",
        "Funnel",
        "funnel",
      ],
    ];
    for (const [family, option, type, grouping] of families) {
      await sheet.select(0, 0, 3, 2);
      await (await toolbarButton(page, `${family}: more options`)).click();
      await page.getByRole("menuitem", { name: option, exact: true }).click();
      await expect
        .poll(async () => (await charts(page)).at(-1)?.type)
        .toBe(type);
      if (grouping) expect((await charts(page)).at(-1).grouping).toBe(grouping);
    }
    expect((await charts(page)).length).toBe(5);

    // Recommended Charts: the Insert Chart dialog with live previews
    await sheet.select(0, 0, 3, 2);
    await (await toolbarButton(page, "Recommended Charts")).click();
    const dialog = page.getByRole("dialog", { name: "Insert Chart" });
    await expect(dialog).toBeVisible();
    const recommended = dialog.getByRole("option");
    expect(await recommended.count()).toBeGreaterThanOrEqual(4);
    await expect(dialog.locator(".ts-chart-dialog-preview svg")).toBeVisible();
    await recommended.nth(1).click();
    await expect(recommended.nth(1)).toHaveAttribute("aria-selected", "true");
    // All Charts: families and their types
    await dialog.getByRole("tab", { name: "All Charts" }).click();
    await dialog.locator('[data-chart-family="radar"]').click();
    await dialog.locator('[data-chart-option="radarFilled"]').click();
    await expect(dialog.locator(".ts-chart-dialog-name")).toHaveText(
      "Filled radar"
    );
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => (await charts(page)).at(-1))
      .toMatchObject({ type: "radar", radarStyle: "filled" });

    // More Charts… in a gallery opens the dialog on All Charts
    await (
      await toolbarButton(page, "Insert Column or Bar Chart: more options")
    ).click();
    await page.getByRole("menuitem", { name: "More Charts…" }).click();
    await expect(
      dialog.getByRole("tab", { name: "All Charts" })
    ).toHaveAttribute("aria-selected", "true");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("Sparklines open Insert Sparklines with their type", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["1", "-2"]);
    await sheet.select(0, 0, 1, 0);
    for (const [name, radio] of [
      ["Line", "Line"],
      ["Column", "Column"],
      ["Win/Loss", "Win/Loss"],
    ]) {
      await (await toolbarButton(page, name)).click();
      const dialog = page.locator(".fortune-sparkline-dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("radio", { name: radio, exact: true })
      ).toHaveAttribute("aria-checked", "true");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
    }
  });

  test("Slicer, Link, Comment, Note, Header & Footer, Checkbox", async ({
    sheet,
    page,
  }) => {
    // Slicer outside a table explains itself
    await sheet.click(5, 5);
    await (await toolbarButton(page, "Slicer")).click();
    await expect(
      page.getByText("Select a cell in a table to insert a slicer.")
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Link, and Ctrl+K
    await sheet.click(2, 2);
    await (await toolbarButton(page, "Link")).click();
    await expect(
      page.locator(".fortune-link-modify-modal").first()
    ).toBeVisible();
    await page
      .locator(".fortune-link-modify-modal")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.locator(".fortune-link-modify-modal")).toHaveCount(0);
    await sheet.click(3, 2);
    await page.keyboard.press("Control+k");
    await expect(
      page.locator(".fortune-link-modify-modal").first()
    ).toBeVisible();
    await page
      .locator(".fortune-link-modify-modal")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.locator(".fortune-link-modify-modal")).toHaveCount(0);

    // Comment starts a threaded comment
    await sheet.click(4, 1);
    await (await toolbarButton(page, "Comment")).click();
    await expect(page.locator(".fortune-thread-card")).toBeVisible();
    await page.keyboard.press("Escape");

    // Note adds a note; the button then edits it
    await sheet.click(6, 1);
    await (await toolbarButton(page, "Note")).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => !!window.__tinysheet.getCellValue(6, 1, { type: "ps" })
        )
      )
      .toBe(true);
    await sheet.click(7, 7, { wait: false });
    await sheet.click(6, 1);
    await expect(await toolbarButton(page, "Edit Note")).toBeVisible();

    // Header & Footer opens Page Setup on its tab
    await (await toolbarButton(page, "Header & Footer")).click();
    const setup = page.getByRole("dialog", { name: "Page Setup" });
    await expect(
      setup.getByRole("tab", { name: "Header/Footer" })
    ).toHaveAttribute("aria-selected", "true");
    await setup.getByRole("button", { name: "Cancel" }).click();

    // Checkbox formats the selection and shows as pressed there
    await sheet.select(10, 0, 12, 0);
    const checkbox = await toolbarButton(page, "Checkbox");
    await checkbox.click();
    await expect
      .poll(() => sheet.column(0, 10, 12))
      .toEqual([false, false, false]);
    await expect(checkbox).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Page Layout tab", () => {
  test("Margins, Orientation, Size", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    await menuPick(page, "Margins", /^Wide/);
    await expect
      .poll(async () => (await pageSetup(page)).margins)
      .toMatchObject({ top: 1, bottom: 1, left: 1, right: 1 });
    // the chosen preset is checked
    await (await toolbarButton(page, "Margins")).click();
    await expect(
      page.getByRole("menuitemradio", { name: /^Wide/ })
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitem", { name: "Custom Margins…" }).click();
    const setup = page.getByRole("dialog", { name: "Page Setup" });
    await expect(setup.getByRole("tab", { name: "Margins" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await setup.getByRole("button", { name: "Cancel" }).click();

    await menuPick(page, "Orientation", "Landscape");
    await expect
      .poll(async () => (await pageSetup(page)).orientation)
      .toBe("landscape");
    await menuPick(page, "Size", /^A4/);
    await expect.poll(async () => (await pageSetup(page)).paperSize).toBe("a4");
  });

  test("Print Area, Breaks, Print Titles, Page Setup, Print Preview", async ({
    sheet,
    page,
  }) => {
    await sheet.select(0, 0, 3, 1);
    await menuPick(page, "Print Area", "Set Print Area");
    await expect
      .poll(async () => (await pageSetup(page)).printArea)
      .toEqual([{ row: [0, 3], column: [0, 1] }]);
    await sheet.select(6, 0, 7, 1);
    await menuPick(page, "Print Area", "Add to Print Area");
    await expect
      .poll(async () => (await pageSetup(page)).printArea?.length)
      .toBe(2);
    await menuPick(page, "Print Area", "Clear Print Area");
    await expect
      .poll(async () => (await pageSetup(page)).printArea)
      .toBeUndefined();

    await sheet.click(4, 0);
    await menuPick(page, "Breaks", "Insert Page Break");
    await expect
      .poll(async () => (await pageSetup(page)).rowBreaks)
      .toEqual([4]);
    await menuPick(page, "Breaks", "Remove Page Break");
    await expect
      .poll(async () => (await pageSetup(page)).rowBreaks ?? [])
      .toEqual([]);
    await menuPick(page, "Breaks", "Insert Page Break");
    await menuPick(page, "Breaks", "Reset All Page Breaks");
    await expect
      .poll(async () => (await pageSetup(page)).rowBreaks ?? [])
      .toEqual([]);

    const setup = page.getByRole("dialog", { name: "Page Setup" });
    await (await toolbarButton(page, "Print Titles")).click();
    await expect(setup.getByRole("tab", { name: "Sheet" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await setup.getByRole("button", { name: "Cancel" }).click();
    await (await toolbarButton(page, "Page Setup…")).click();
    await expect(setup.getByRole("tab", { name: "Page" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await setup.getByRole("button", { name: "Cancel" }).click();

    await (await toolbarButton(page, "Print Preview")).click();
    await expect(page.locator(".fortune-print-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-print-preview")).toBeHidden();
  });

  test("Scale to Fit and Sheet Options", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    await ribbonTab(page, "pageLayout");
    const width = page.getByRole("button", { name: "Width" });
    const scale = page.getByRole("spinbutton", { name: "Scale" });
    await width.click();
    await page.getByRole("menuitemradio", { name: "1 page" }).click();
    await expect
      .poll(() => pageSetup(page))
      .toMatchObject({ fitToPage: true, fitToWidth: 1 });
    // Scale is only for Automatic width and height
    await expect(scale).toBeDisabled();
    await width.click();
    await page.getByRole("menuitemradio", { name: "Automatic" }).click();
    await expect
      .poll(async () => (await pageSetup(page)).fitToPage)
      .toBeFalsy();
    await expect(scale).toBeEnabled();
    await scale.fill("80");
    await scale.press("Enter");
    await expect.poll(async () => (await pageSetup(page)).scale).toBe(80);

    // Sheet Options: Gridlines / Headings, View and Print
    const box = (name) => page.getByRole("checkbox", { name, exact: true });
    await expect(box("Gridlines: View")).toBeChecked();
    await box("Gridlines: View").uncheck({ force: true });
    await expect
      .poll(async () => (await sheetData(page)).showGridLines)
      .toBe(0);
    await box("Gridlines: Print").check({ force: true });
    await expect.poll(async () => (await pageSetup(page)).gridLines).toBe(true);
    await box("Headings: Print").check({ force: true });
    await expect.poll(async () => (await pageSetup(page)).headings).toBe(true);
    const header = page.locator(".fortune-col-header");
    await box("Headings: View").uncheck({ force: true });
    await expect
      .poll(async () => (await header.boundingBox())?.height ?? 0)
      .toBeLessThan(2);
    await box("Headings: View").check({ force: true });
    await expect
      .poll(async () => (await header.boundingBox())?.height ?? 0)
      .toBeGreaterThan(10);
  });
});

test.describe("View tab", () => {
  test("Workbook Views switch and show which one is on", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "x");
    await page.evaluate(() => window.__tinysheet.setCellValue(80, 3, "far"));
    const normal = await toolbarButton(page, "Normal");
    await expect(normal).toHaveAttribute("aria-pressed", "true");
    await (await toolbarButton(page, "Page Break Preview")).click();
    await expect(page.locator(".fortune-page-breaks.preview")).toBeAttached();
    await expect(
      await toolbarButton(page, "Page Break Preview")
    ).toHaveAttribute("aria-pressed", "true");
    await (await toolbarButton(page, "Page Layout")).click();
    await expect(page.locator(".fortune-page-breaks.preview")).toHaveCount(0);
    await expect(
      page.locator(".fortune-page-layout-page").first()
    ).toBeVisible();
    await expect(normal).toHaveAttribute("aria-pressed", "false");
    await normal.click();
    await expect(page.locator(".fortune-page-layout-page")).toHaveCount(0);
    await expect(normal).toHaveAttribute("aria-pressed", "true");
  });

  test("Show: Gridlines, Formula Bar, Headings", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    await ribbonTab(page, "view");
    const box = (name) =>
      page
        .locator(".fortune-ribbon")
        .getByRole("checkbox", { name, exact: true });
    await box("Formula Bar").uncheck({ force: true });
    await expect(page.locator(".fortune-fx-editor")).toBeHidden();
    await box("Formula Bar").check({ force: true });
    await expect(page.locator(".fortune-fx-editor")).toBeVisible();
    await box("Gridlines").uncheck({ force: true });
    await expect
      .poll(async () => (await sheetData(page)).showGridLines)
      .toBe(0);
    await box("Gridlines").check({ force: true });
    await expect
      .poll(async () => (await sheetData(page)).showGridLines)
      .toBe(1);
    await box("Headings").uncheck({ force: true });
    await expect
      .poll(async () => (await sheetData(page)).showRowColHeaders)
      .toBe(false);
  });

  test("Zoom dialog, 100% and Zoom to Selection", async ({ sheet, page }) => {
    await (await toolbarButton(page, "Zoom")).click();
    const dialog = page.getByRole("dialog", { name: "Zoom" });
    await dialog.getByLabel("75%").check({ force: true });
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).zoomRatio)
      .toBe(0.75);

    await (await toolbarButton(page, "Zoom")).click();
    await dialog.getByRole("spinbutton").fill("150");
    await dialog.getByRole("spinbutton").press("Tab");
    await expect(dialog.getByLabel("Custom:")).toBeChecked();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).zoomRatio)
      .toBe(1.5);

    await (await toolbarButton(page, "100%")).click();
    await expect.poll(async () => (await sheet.sheetInfo()).zoomRatio).toBe(1);

    await sheet.select(0, 0, 3, 2);
    await (await toolbarButton(page, "Zoom to Selection")).click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).zoomRatio)
      .toBeGreaterThan(2);
  });

  test("Freeze Panes menu and Split", async ({ sheet, page }) => {
    await sheet.click(2, 1);
    const freeze = await toolbarButton(page, "Freeze Panes");
    await freeze.click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen?.type)
      .toBe("rangeBoth");
    await expect(freeze).toHaveAttribute("aria-pressed", "true");
    // the menu offers Unfreeze Panes while frozen
    await menuPick(page, "Freeze Panes", /^Unfreeze Panes/, { arrow: true });
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen ?? null)
      .toBeNull();
    await menuPick(page, "Freeze Panes", /^Freeze Top Row/, { arrow: true });
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen?.type)
      .toBe("rangeRow");
    await menuPick(page, "Freeze Panes", /^Freeze First Column/, {
      arrow: true,
    });
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen?.type)
      .toBe("rangeColumn");

    const split = await toolbarButton(page, "Split");
    await split.click();
    await expect
      .poll(async () => !!(await sheet.sheetInfo()).frozen?.split)
      .toBe(true);
    await expect(split).toHaveAttribute("aria-pressed", "true");
    await split.click();
    await expect
      .poll(async () => (await sheet.sheetInfo()).frozen ?? null)
      .toBeNull();
  });

  test("Theme: Light, Dark, System", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    const container = page.locator(".fortune-container");
    await menuPick(page, "Theme", "Dark");
    await expect(container).toHaveAttribute("data-theme", "dark");
    await (await toolbarButton(page, "Theme")).click();
    await expect(
      page.getByRole("menuitemradio", { name: "Dark" })
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(container).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await menuPick(page, "Theme", "System");
    await expect(container).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("keyboard and screen tips", () => {
  test("menus open from the keyboard; tips name the shortcut", async ({
    sheet,
    page,
  }) => {
    expect(sheet).toBeTruthy();
    // Page Layout › Orientation (Home has a text Orientation too)
    await ribbonTab(page, "pageLayout");
    const orientation = await toolbarButton(page, "Orientation");
    await orientation.focus();
    await page.keyboard.press("ArrowDown");
    // the checked entry takes the focus
    await expect(
      page.getByRole("menuitemradio", { name: "Portrait" })
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await pageSetup(page)).orientation)
      .toBe("landscape");

    // arrow keys move along the command row
    await orientation.focus();
    await page.keyboard.press("ArrowRight");
    await expect(await toolbarButton(page, "Size")).toBeFocused();

    // Enter on a gallery tile inserts at once (no drawing)
    await (await toolbarButton(page, "Shapes")).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".ts-shape-gallery")).toBeVisible();
    await page.locator('.ts-shape-gallery [data-shape-key="rect"]').focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => ((await sheetData(page)).shapes ?? []).length)
      .toBe(1);

    // hover shows the screen tip with its shortcut
    const link = await toolbarButton(page, "Link");
    await link.hover();
    const tip = page.locator(".ts-tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Link");
    await expect(tip).toContainText("Ctrl+K");
  });

  test("collapsed groups keep every command reachable", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["1", "2", "3"]);
    await sheet.select(0, 0, 2, 0);
    await page.setViewportSize({ width: 560, height: 800 });
    await ribbonTab(page, "insert");
    // the wide groups (Charts) collapse into one button; one-button groups
    // (Controls) stay as they are
    await expect(
      page.locator('.fortune-ribbon [data-group-button="charts"]')
    ).toBeVisible();
    await expect(
      page.locator('.fortune-ribbon [data-group-button="controls"]')
    ).toHaveCount(0);
    // a command of a group that stayed
    await sheet.click(5, 5);
    await (await toolbarButton(page, "Checkbox")).click();
    await expect.poll(() => sheet.value(5, 5)).toBe(false);
    // a command inside a collapsed group
    await sheet.select(0, 0, 2, 0);
    await (await toolbarButton(page, "Insert Column or Bar Chart")).click();
    await expect.poll(async () => (await charts(page)).length).toBe(1);
  });
});
