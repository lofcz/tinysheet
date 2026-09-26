const { test, expect, toolbarButton, Sheet } = require("../fixtures");

// Context menus (ui MenuList), colour / border pickers and the galleries
// (Format as Table, Cell Styles, conditional formatting presets): they open
// with Excel's entries, their commands act on the sheet, and they work from
// the keyboard.

const sheetData = (page, path) =>
  page.evaluate((p) => {
    let v = window.__tinysheet.getSheet();
    p.split(".").forEach((k) => {
      v = v == null ? v : v[k];
    });
    return v ?? null;
  }, path);

async function rightClick(sheet, page, r, c) {
  const { x, y } = sheet.point(r, c);
  await page.mouse.click(x, y, { button: "right" });
  const menu = page.locator(".fortune-cell-menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** Labels of the top-level entries of an open menu list. */
const labels = (menu) =>
  menu.evaluate((el) =>
    Array.from(
      el.querySelectorAll(":scope > [role^=menuitem] .ts-menu-label")
    ).map((l) => l.textContent)
  );

/**
 * Open a Home ribbon drop-down by its button's name (a split button's
 * arrow: "More options for Borders"); returns the open popover (the
 * innermost one, so a hovered submenu is found too).
 */
async function dropdown(page, name) {
  await (await toolbarButton(page, name)).click();
  const popup = page.locator(".ts-popover").last();
  await expect(popup).toBeVisible();
  return popup;
}

test.describe("context menus", () => {
  test("cell menu: Excel's entries, icons, shortcuts and Paste Options", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "=1+2");
    const menu = await rightClick(sheet, page, 0, 0);
    const names = await labels(menu);
    expect(names.slice(0, 11)).toEqual([
      "Cut",
      "Copy",
      "Paste Special…",
      "Insert…",
      "Delete…",
      "Clear Contents",
      "Filter",
      "Sort",
      "New Comment",
      "New Note",
      "Format Cells…",
    ]);
    expect(names).toEqual(
      expect.arrayContaining([
        "Pick From Drop-down List…",
        "Define Name…",
        "Link…",
      ])
    );
    // lucide icon column and right-aligned shortcuts
    await expect(
      menu.locator('[data-key="cut"] .ts-menu-icon svg')
    ).toHaveCount(1);
    await expect(
      menu.locator('[data-key="copy"] .ts-menu-shortcut')
    ).toHaveText(/C$/);
    // Paste Options: six icon buttons, Values etc. need a copy first
    const options = page.locator(".fortune-paste-option");
    await expect(options).toHaveCount(6);
    await expect(page.locator('[data-key="paste-values"]')).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // copy A1, then Paste Options › Values into C1 pastes 3, not the formula
    await sheet.click(0, 0);
    await sheet.copy();
    await rightClick(sheet, page, 0, 2);
    await page.locator('[data-key="paste-values"]').click();
    await expect.poll(() => sheet.value(0, 2)).toBe(3);
    expect(await sheet.formula(0, 2)).toBeNull();
    await expect(page.locator(".fortune-cell-menu")).toHaveCount(0);
  });

  test("cell menu keyboard: arrows, paste row, submenu, Escape", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["b", "a", "c"]);
    await sheet.select(0, 0, 2, 0);
    await page.keyboard.press("Shift+F10");
    const menu = page.locator(".fortune-cell-menu");
    await expect(menu).toBeVisible();
    const focused = () =>
      page.evaluate(
        () =>
          document.activeElement?.dataset.key ??
          document.activeElement?.textContent
      );
    await expect.poll(focused).toBe("cut");
    await page.keyboard.press("ArrowDown");
    await expect.poll(focused).toBe("copy");
    // the Paste Options row is one stop; Left / Right move inside it
    await page.keyboard.press("ArrowDown");
    await expect.poll(focused).toBe("paste-all");
    // Paste Special… is disabled (nothing copied yet): skipped
    await page.keyboard.press("ArrowDown");
    await expect.poll(focused).toBe("insert-cells");
    // type-ahead: "s" jumps to Sort, ArrowRight opens its submenu
    await page.keyboard.press("s");
    await expect.poll(focused).toBe("sort-menu");
    await page.keyboard.press("ArrowRight");
    const sub = page.locator(".fortune-cell-submenu");
    await expect(sub).toBeVisible();
    await expect.poll(focused).toBe("sort-az");
    await page.keyboard.press("ArrowLeft");
    await expect(sub).toHaveCount(0);
    await expect.poll(focused).toBe("sort-menu");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual(["a", "b", "c"]);
    await expect(menu).toHaveCount(0);
  });

  test("row and column header menus: Excel's entries and actions", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["1", "2", "3"]);
    const rows = await page.locator(".fortune-row-header").boundingBox();
    // right-click the header of row 2
    await page.mouse.click(rows.x + rows.width / 2, rows.y + 30, {
      button: "left",
    });
    await page.mouse.click(rows.x + rows.width / 2, rows.y + 30, {
      button: "right",
    });
    const menu = page.locator(".fortune-cell-menu");
    await expect(menu).toBeVisible();
    const rowNames = await labels(menu);
    expect(rowNames).toEqual(
      expect.arrayContaining([
        "Cut",
        "Copy",
        "Paste Special…",
        "Insert",
        "Delete",
        "Clear Contents",
        "Format Cells…",
        "Row Height…",
        "Hide",
        "Unhide",
      ])
    );
    expect(rowNames).not.toContain("Column Width…");
    await menu.locator('[data-key="hide-row-hide"]').click();
    await expect
      .poll(() => sheetData(page, "config.rowhidden"))
      .toEqual({ 1: 0 });

    const cols = await page.locator(".fortune-col-header").boundingBox();
    await page.mouse.click(cols.x + 37, cols.y + cols.height / 2);
    await page.mouse.click(cols.x + 37, cols.y + cols.height / 2, {
      button: "right",
    });
    await expect(menu).toBeVisible();
    expect(await labels(menu)).toEqual(
      expect.arrayContaining(["Insert", "Delete", "Column Width…"])
    );
    // Insert before column A moves the values to column B
    await menu.locator('[data-key="insert-rowcol"]').click();
    await expect.poll(() => sheet.value(0, 1)).toBe(1);
    expect(await sheet.value(0, 0)).toBeNull();
  });

  test("sheet tab menu: entries, Tab Color picker, keyboard close", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__e2eScenario = {
        data: ["Sheet1", "Sheet2"].map((name, i) => ({
          name,
          id: `s${i + 1}`,
          order: i,
          status: i === 0 ? 1 : 0,
          row: 50,
          column: 20,
          celldata: [],
        })),
      };
    });
    await new Sheet(page).open("e2e-harness--scenario");
    await page.waitForFunction(() => window.__tinysheet);
    const tab = page
      .locator("#fortune-sheettab-container-c .luckysheet-sheets-item")
      .first();
    await tab.click({ button: "right" });
    const menu = page.locator(".fortune-sheet-tab-menu");
    await expect(menu).toBeVisible();
    const names = await labels(menu);
    expect(names.slice(0, 3)).toEqual(["Insert", "Delete", "Rename"]);
    expect(names).toEqual(expect.arrayContaining(["Tab Color", "Hide"]));
    expect(names.some((n) => n.startsWith("Move or Copy"))).toBe(true);
    expect(names.some((n) => n.startsWith("Protect Sheet"))).toBe(true);
    await menu.locator('[data-key="color"]').hover();
    const picker = page.locator('.ts-color-picker[aria-label="Tab Color"]');
    await expect(picker).toBeVisible();
    await picker
      .getByRole("button", { name: "Green, Accent 6", exact: true })
      .click();
    await expect.poll(() => sheetData(page, "color")).toBe("#70ad47");
    await expect(menu).toHaveCount(0);

    await tab.click({ button: "right" });
    await menu.locator('[data-key="color"]').hover();
    await picker.getByRole("button", { name: "No Color" }).click();
    await expect.poll(() => sheetData(page, "color")).toBeNull();

    await tab.click({ button: "right" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("the filter menu keeps its value list and search", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["Fruit", "apple", "pear", "fig"]);
    await sheet.select(0, 0, 3, 0);
    // cell menu › Filter › Add Filter
    const cellMenu = await rightClick(sheet, page, 1, 0);
    await cellMenu.locator('[data-key="filter-menu"]').hover();
    await page.locator('[data-key="filter-toggle"]').click();
    const button = page.locator(".luckysheet-filter-options").first();
    await expect(button).toBeVisible();
    await button.click();
    const menu = page.locator(".fortune-filter-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".fortune-filter-menu-icon svg")).not.toHaveCount(
      0
    );
    await menu.locator(".filtermenu-input-container input").fill("pe");
    await expect(
      menu.locator(".select-item", { hasText: "apple" })
    ).toBeHidden();
    await expect(
      menu.locator(".select-item", { hasText: "pear" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("colour picker", () => {
  test("theme colour, standard colour, custom hex, No Fill / Automatic", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    // font colour: Theme Colors grid (10 × 6), first row Blue, Accent 1
    let popup = await dropdown(page, "More options for Font Color");
    await expect(popup.locator(".ts-color-grid--theme .ts-swatch")).toHaveCount(
      60
    );
    await expect(
      popup.getByRole("button", { name: "Automatic" })
    ).toBeVisible();
    await popup
      .getByRole("button", { name: "Blue, Accent 1, Lighter 40%", exact: true })
      .click();
    await expect.poll(() => sheet.value(0, 0, "fc")).toBe("#8faadc");
    await expect(popup).toHaveCount(0);

    // fill: Standard Colors
    popup = await dropdown(page, "More options for Fill Color");
    await popup
      .getByRole("button", { name: "Light Green", exact: true })
      .click();
    await expect.poll(() => sheet.value(0, 0, "bg")).toBe("#92d050");

    // More Colors…: hex field, OK; the colour joins Recent Colors
    await dropdown(page, "More options for Fill Color");
    await popup.getByRole("button", { name: "More Colors…" }).click();
    const hex = popup.getByLabel("Hex", { exact: true });
    await hex.fill("12AB34");
    await hex.press("Enter");
    await expect.poll(() => sheet.value(0, 0, "bg")).toBe("#12ab34");
    await dropdown(page, "More options for Fill Color");
    await expect(
      popup.getByRole("button", { name: "#12AB34", exact: true })
    ).toBeVisible();
    // the current fill is marked in the grid
    await expect(popup.locator('.ts-swatch[aria-pressed="true"]')).toHaveCount(
      1
    );

    // keyboard: arrows move between swatches, Enter picks
    const first = popup.locator(".ts-color-grid--theme .ts-swatch").first();
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    // Black, Text 1, Lighter 50%
    await expect.poll(() => sheet.value(0, 0, "bg")).toBe("#808080");

    await dropdown(page, "More options for Fill Color");
    await popup.getByRole("button", { name: "No Fill" }).click();
    await expect.poll(() => sheet.value(0, 0, "bg")).toBeFalsy();
  });

  test("swatches show Excel's names as screen tips", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const swatch = (
      await dropdown(page, "More options for Fill Color")
    ).getByRole("button", { name: "Orange, Accent 2", exact: true });
    await swatch.hover();
    const tip = page.locator(".ts-tooltip");
    await expect(tip).toHaveText("Orange, Accent 2");
    const box = await tip.boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  });
});

test.describe("border picker", () => {
  test("presets, thick box and line style", async ({ sheet, page }) => {
    await sheet.select(1, 1, 2, 2);
    const popup = await dropdown(page, "More options for Borders");
    const menu = popup.locator(".ts-border-picker");
    expect(await labels(menu)).toEqual([
      "Bottom Border",
      "Top Border",
      "Left Border",
      "Right Border",
      "No Border",
      "All Borders",
      "Outside Borders",
      "Thick Outside Borders",
      "Bottom Double Border",
      "Thick Bottom Border",
      "Top and Bottom Border",
      "Top and Thick Bottom Border",
      "Top and Double Bottom Border",
      "Line Color",
      "Line Style",
      "More Borders…",
    ]);
    await menu
      .getByRole("menuitem", { name: "All Borders", exact: true })
      .click();
    const borders = () => sheetData(page, "config.borderInfo");
    await expect
      .poll(async () => (await borders())?.map((b) => b.borderType))
      .toEqual(["border-all"]);

    await dropdown(page, "More options for Borders");
    await popup
      .getByRole("menuitem", { name: "Thick Outside Borders", exact: true })
      .click();
    await expect
      .poll(async () => (await borders())?.[1])
      .toMatchObject({ borderType: "border-outside", style: "13" });

    // Line Style › Dashed, then Bottom Border draws dashed
    await dropdown(page, "More options for Borders");
    await popup.getByRole("menuitem", { name: "Line Style" }).hover();
    await popup
      .getByRole("menuitemradio", { name: "Dashed", exact: true })
      .click();
    await dropdown(page, "More options for Borders");
    await popup
      .getByRole("menuitem", { name: "Bottom Border", exact: true })
      .click();
    await expect
      .poll(async () => (await borders())?.[2])
      .toMatchObject({ borderType: "border-bottom", style: "4" });

    // keyboard: the menu takes the focus, Enter applies
    await dropdown(page, "More options for Borders");
    await page.keyboard.press("End");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await borders())?.[3]?.borderType)
      .toBe("border-top");
  });
});

test.describe("galleries", () => {
  test("Format as Table applies a table style", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, ["Name", "a", "b"]);
    await sheet.select(0, 0, 2, 0);
    const popup = await dropdown(page, "Format as Table");
    const tiles = popup.locator(".ts-gallery-item");
    await expect(tiles).not.toHaveCount(0);
    await popup.getByRole("button", { name: "Green", exact: true }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(() => sheetData(page, "tables.0.style"))
      .toBe("TableStyleMedium7");
  });

  test("Cell Styles applies a style; arrow keys move in the gallery", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const popup = await dropdown(page, "Cell Styles");
    await popup.getByRole("button", { name: "Good", exact: true }).click();
    await expect.poll(() => sheet.value(0, 0, "bg")).toBe("#C6EFCE");

    await sheet.click(1, 0);
    await dropdown(page, "Cell Styles");
    // Normal has the focus; Right moves to Bad
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(1, 0, "bg")).toBe("#FFC7CE");
  });

  test("conditional formatting presets: data bars, colour scales, icon sets", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["1", "2", "3"]);
    const rules = () =>
      page.evaluate(() =>
        (
          window.__tinysheet.getSheet().luckysheet_conditionformat_save || []
        ).map((r) => r.type)
      );
    const preset = async (menuName, tile) => {
      await sheet.select(0, 0, 2, 0);
      const popup = await dropdown(page, "Conditional Formatting");
      await popup.getByRole("menuitem", { name: menuName }).hover();
      await popup
        .locator(`.ts-gallery-item[data-gallery-id="${tile}"]`)
        .click();
      await expect(popup).toHaveCount(0);
    };
    await preset(/data bars/i, "g:#638EC6");
    await expect.poll(rules).toEqual(["dataBar"]);
    await preset(/color scales/i, "0");
    await expect.poll(rules).toEqual(["dataBar", "colorGradation"]);
    await preset(/icon sets/i, "3TrafficLights1");
    await expect.poll(rules).toEqual(["dataBar", "colorGradation", "icons"]);
  });
});
