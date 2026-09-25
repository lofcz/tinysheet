const { test, expect, toolbarButton } = require("../fixtures");

// The ribbon (tabs, scaling, collapse), its drop-downs, the context menu
// and dialogs: how they open, close and hand the keyboard around (Excel /
// Google Sheets behaviour).

// Relative luminance (0 = black, 1 = white) of a CSS rgb()/rgba() colour.
const luminance = (css) => {
  const [r, g, b] = css
    .match(/\d+(\.\d+)?/g)
    .slice(0, 3)
    .map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Luminance of the canvas pixel at the centre of cell (r, c). */
async function canvasLuminance(sheet, r, c) {
  const { x, y } = sheet.point(r, c);
  return sheet.page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector(".fortune-sheet-canvas");
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const [red, green, blue] = canvas
        .getContext("2d")
        .getImageData(
          Math.round((px - rect.left) * ratio),
          Math.round((py - rect.top) * ratio),
          1,
          1
        ).data;
      return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    },
    [x, y]
  );
}

const themeMenu = (page) => page.getByRole("menu", { name: "Theme" });

/** View › Appearance › Theme › `label`. */
async function pickTheme(page, label) {
  await (await toolbarButton(page, "Theme")).click();
  await themeMenu(page).getByRole("menuitemradio", { name: label }).click();
}

test.describe("theme switch", () => {
  test("Light / Dark from the toolbar repaint chrome, canvas and dialogs", async ({
    sheet,
    page,
  }) => {
    const container = page.locator(".fortune-container");
    await expect(container).toHaveAttribute("data-theme", "light");
    expect(await canvasLuminance(sheet, 3, 3)).toBeGreaterThan(0.9);

    await pickTheme(page, "Dark");
    await expect(container).toHaveAttribute("data-theme", "dark");
    await expect(themeMenu(page)).toHaveCount(0);
    const toolbarBg = await page
      .locator(".fortune-ribbon-pane")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(luminance(toolbarBg)).toBeLessThan(0.3);
    await expect.poll(() => canvasLuminance(sheet, 3, 3)).toBeLessThan(0.2);
    // the menu checks the theme in effect
    await (await toolbarButton(page, "Theme")).click();
    await expect(
      themeMenu(page).getByRole("menuitemradio", { name: "Dark" })
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    // dialogs rendered outside the workbook follow
    await sheet.click(0, 0);
    await page.keyboard.press("Control+1");
    const modal = page.locator(".fortune-modal-container");
    await expect(modal).toHaveAttribute("data-theme", "dark");
    const dialogBg = await page
      .locator(".fortune-format-cells")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(luminance(dialogBg)).toBeLessThan(0.3);
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);

    await pickTheme(page, "Light");
    await expect(container).toHaveAttribute("data-theme", "light");
    await expect.poll(() => canvasLuminance(sheet, 3, 3)).toBeGreaterThan(0.9);
  });

  test("System follows prefers-color-scheme live", async ({ sheet, page }) => {
    const container = page.locator(".fortune-container");
    await page.emulateMedia({ colorScheme: "dark" });
    await pickTheme(page, "System");
    await expect(container).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(container).toHaveAttribute("data-theme", "light");
    await expect.poll(() => canvasLuminance(sheet, 2, 2)).toBeGreaterThan(0.9);
    // the menu marks the chosen setting, not the resolved theme
    await (await toolbarButton(page, "Theme")).click();
    await expect(
      themeMenu(page).getByRole("menuitemradio", { name: "System" })
    ).toHaveAttribute("aria-checked", "true");
  });
});

// Home's ribbon commands (ui primitives): menus and panels are .ts-popover
const dropdown = (page) =>
  page.locator(".ts-popover:not(.fortune-ribbon-group-popover)");

test.describe("toolbar drop-downs", () => {
  test("the arrow toggles the menu; Escape and a click outside close it", async ({
    sheet,
    page,
  }) => {
    const arrow = page.getByRole("button", {
      name: "More options for Borders",
    });
    await arrow.click();
    await expect(dropdown(page)).toHaveCount(1);
    await arrow.click();
    await expect(dropdown(page)).toHaveCount(0);

    await arrow.click();
    await page.keyboard.press("Escape");
    await expect(dropdown(page)).toHaveCount(0);
    // Escape hands the keyboard back to the button
    await expect(arrow).toBeFocused();

    await arrow.click();
    const { x, y } = sheet.point(6, 6);
    await page.mouse.click(x, y);
    await expect(dropdown(page)).toHaveCount(0);
  });

  test("only one menu is open at a time, also from the keyboard", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page
      .getByRole("button", { name: "More options for Borders" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(dropdown(page)).toHaveCount(1);
    await page
      .getByRole("button", { name: "More options for Fill Color" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(dropdown(page)).toHaveCount(1);
    await expect(dropdown(page).locator(".ts-home-colors")).toBeVisible();
  });

  test("keyboard: open, arrow to an item, pick it, type into the sheet", async ({
    sheet,
    page,
  }) => {
    await sheet.click(1, 1);
    await page.getByRole("combobox", { name: "Font Size" }).focus();
    await page.keyboard.press("Alt+ArrowDown");
    // the current size (the default 11pt) has the focus (and is checked);
    // arrows move on
    const current = dropdown(page).getByRole("menuitemradio", { name: "11" });
    await expect(current).toBeFocused();
    await expect(current).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("End");
    await expect(
      dropdown(page).getByRole("menuitemradio", { name: "72" })
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      dropdown(page).getByRole("menuitemradio", { name: "8", exact: true })
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(
      dropdown(page).getByRole("menuitemradio", { name: "11" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dropdown(page)).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Font Size" })).toHaveValue(
      "11"
    );
    // the sheet has the keyboard again, as after picking in Excel
    await expect(page.locator(".luckysheet-cell-input")).toBeFocused();
    await page.keyboard.type("42");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(1, 1)).toBe(42);
  });

  test("a font size can be typed into the size box", async ({
    sheet,
    page,
  }) => {
    await sheet.click(3, 1);
    const box = page.getByRole("combobox", { name: "Font Size" });
    await expect(box).toHaveValue("11");
    await box.click();
    await box.fill("15");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(3, 1, "fs")).toBe(15);
    await expect(box).toHaveValue("15");
    // out of range (Excel: 1 to 409) or Escape: nothing changes
    await box.fill("999");
    await page.keyboard.press("Enter");
    await box.fill("20");
    await page.keyboard.press("Escape");
    await expect.poll(() => sheet.value(3, 1, "fs")).toBe(15);
    await expect(box).toHaveValue("15");
    // Enter and Escape hand the keyboard back to the sheet
    await expect(page.locator(".luckysheet-cell-input")).toBeFocused();
    await page.keyboard.type("5");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(3, 1)).toBe(5);
  });

  test("picking with the mouse gives the keyboard back to the sheet", async ({
    sheet,
    page,
  }) => {
    await sheet.click(2, 0);
    await page.getByRole("button", { name: "Font: open list" }).click();
    await dropdown(page)
      .getByRole("menuitemradio", { name: "Verdana" })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Font", exact: true })
    ).toHaveValue("Verdana");
    await expect(page.locator(".luckysheet-cell-input")).toBeFocused();
    await page.keyboard.type("x");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(2, 0)).toBe("x");
  });

  test("bold reflects the selected cell", async ({ sheet, page }) => {
    const bold = page.getByRole("button", { name: "Bold", exact: true });
    await sheet.click(0, 0);
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await sheet.click(1, 0);
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await sheet.click(0, 0);
    await expect(bold).toHaveAttribute("aria-pressed", "true");
  });

  test("colour buttons: Excel's red / yellow before any pick, palette colours", async ({
    sheet,
    page,
  }) => {
    const lower = (v) => (v == null ? v : String(v).toLowerCase());
    await sheet.click(0, 0);
    await page.getByRole("button", { name: "Font Color", exact: true }).click();
    await expect
      .poll(async () => lower(await sheet.value(0, 0, "fc")))
      .toBe("#ff0000");
    await page.getByRole("button", { name: "Fill Color", exact: true }).click();
    await expect
      .poll(async () => lower(await sheet.value(0, 0, "bg")))
      .toBe("#ffff00");
    // Standard Colors: dark red, red, orange, yellow, ...
    await page
      .getByRole("button", { name: "More options for Fill Color" })
      .click();
    await dropdown(page)
      .getByRole("button", { name: "Orange", exact: true })
      .click();
    await expect
      .poll(async () => lower(await sheet.value(0, 0, "bg")))
      .toBe("#ffc000");
    // the button now applies the colour picked last
    await sheet.click(1, 0);
    await page.getByRole("button", { name: "Fill Color", exact: true }).click();
    await expect
      .poll(async () => lower(await sheet.value(1, 0, "bg")))
      .toBe("#ffc000");
  });

  test("border menu: line colour submenu from the keyboard, kept between openings", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const arrow = page.getByRole("button", {
      name: "More options for Borders",
    });
    await arrow.click();
    const lineColor = dropdown(page).getByRole("menuitem", {
      name: "Line Color",
    });
    await lineColor.focus();
    await page.keyboard.press("Enter");
    const swatch = dropdown(page).getByRole("button", {
      name: "Blue",
      exact: true,
    });
    await expect(swatch).toBeVisible();
    await swatch.click();
    await expect(dropdown(page)).toHaveCount(0);
    await arrow.click();
    await expect(
      dropdown(page).locator(
        '[data-menu-id="line-color"] .ts-home-swatch-static'
      )
    ).toHaveCSS("background-color", "rgb(0, 112, 192)");
  });
});

test.describe("ribbon scaling", () => {
  test.use({ viewport: { width: 760, height: 700 } });

  test("groups collapse right to left into buttons that open the whole group", async ({
    sheet,
    page,
  }) => {
    const collapsed = page.locator(".fortune-ribbon [data-group-button]");
    const groupPopup = page.locator(".fortune-ribbon-group-popover");
    // Excel's scaling: the rightmost groups go first, never a "More" dump
    await expect(collapsed.first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "More", exact: true })
    ).toHaveCount(0);
    const ids = await collapsed.evaluateAll((els) =>
      els.map((el) => el.dataset.groupButton)
    );
    expect(ids[ids.length - 1]).toBe("editing");
    expect(ids).not.toContain("clipboard");

    // nothing overflows the command row
    const fits = await page
      .locator(".fortune-ribbon-commands")
      .evaluate((el) => {
        const inner = el.querySelector(".fortune-ribbon-groups");
        return (
          inner.getBoundingClientRect().right <=
          el.getBoundingClientRect().right + 0.5
        );
      });
    expect(fits).toBe(true);

    // a collapsed group opens as a whole; its items show the live state
    await sheet.enter(0, 0, "0.25");
    await sheet.click(0, 0);
    await page.locator('[data-group-button="number"]').click();
    await expect(groupPopup).toBeVisible();
    await groupPopup
      .getByRole("button", { name: "Percent Style", exact: true })
      .click();
    await expect.poll(() => sheet.value(0, 0, "m")).toMatch(/^25(\.0+)?%$/);
    // the command gave the keyboard back to the sheet, which closes the
    // group (Excel); opened again, it shows the new format
    await expect(groupPopup).toHaveCount(0);
    await page.locator('[data-group-button="number"]').click();
    await expect(
      groupPopup.getByRole("button", { name: /^Number Format: Percent/ })
    ).toBeVisible();

    // Escape closes an inner drop-down first, then the group
    await groupPopup
      .getByRole("button", { name: /^Number Format: Percent/ })
      .click();
    await expect(dropdown(page)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dropdown(page)).toHaveCount(0);
    await expect(groupPopup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(groupPopup).toHaveCount(0);

    // a dialog opened from a collapsed group closes the group
    await (await toolbarButton(page, "Find & Select")).click();
    await page.locator('[data-menu-id="find"]').click();
    await expect(page.locator("#fortune-search-replace")).toBeVisible();
    await expect(groupPopup).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("#fortune-search-replace")).toHaveCount(0);

    // a wide window shows every group in full, a narrow one collapses again
    await page.setViewportSize({ width: 2400, height: 700 });
    await expect(collapsed).toHaveCount(0);
    await page.setViewportSize({ width: 760, height: 700 });
    await expect(collapsed.first()).toBeVisible();
  });
});

test.describe("ribbon", () => {
  test("tabs switch the command row; the tab list works with the keyboard", async ({
    sheet,
    page,
  }) => {
    expect(sheet).toBeTruthy();
    const home = page.getByRole("tab", { name: "Home" });
    await expect(home).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Formulas" }).click();
    await expect(
      page.locator('[data-ribbon-group="formulaAuditing"]')
    ).toBeVisible();
    await expect(page.locator('[data-ribbon-group="font"]')).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    const data = page.getByRole("tab", { name: "Data" });
    await expect(data).toBeFocused();
    await expect(data).toHaveAttribute("aria-selected", "true");
  });

  test("Ctrl+F1 and a double-click collapse the ribbon to its tabs", async ({
    sheet,
    page,
  }) => {
    const commands = page.locator(".fortune-ribbon-commands");
    const area = page.locator(".fortune-cell-area");
    const top = (await area.boundingBox()).y;
    await sheet.click(0, 0);
    await page.keyboard.press("Control+F1");
    await expect(commands).toHaveCount(0);
    // the grid takes the room
    await expect
      .poll(async () => (await area.boundingBox()).y)
      .toBeLessThan(top);
    // a tab click shows its commands over the grid until a click outside
    await page.getByRole("tab", { name: "Insert" }).click();
    await expect(commands).toBeVisible();
    await page.mouse.click(700, 600);
    await expect(commands).toHaveCount(0);
    await page.getByRole("tab", { name: "Insert" }).dblclick();
    await expect(commands).toBeVisible();
    await expect.poll(async () => (await area.boundingBox()).y).toBe(top);
  });

  test("the File menu opens Print Preview", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    await page.locator(".fortune-ribbon-file").click();
    const menu = page.getByRole("menu", { name: "File" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Print/ }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator(".fortune-print-preview")).toBeVisible();
  });
});

test.describe("context menu", () => {
  test("stays inside the window and closes on Escape, scroll and resize", async ({
    sheet,
    page,
  }) => {
    const menu = page.locator(".fortune-cell-menu").first();
    const viewport = page.viewportSize();
    const open = async (x, y) => {
      await page.mouse.click(x, y, { button: "right" });
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      return box;
    };

    const area = await page.locator(".fortune-cell-area").boundingBox();
    await open(area.x + area.width - 20, area.y + area.height - 10);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // not enough room below or above: kept against the bottom edge
    const box = await open(area.x + 200, area.y + area.height / 2);
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 40);

    // over the grid, left of the menu (the wheel over a menu scrolls it)
    const { x, y } = sheet.point(5, 1);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 200);
    await expect(menu).toHaveCount(0);

    await open(x, y);
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(menu).toHaveCount(0);
  });

  test("row and column header menus open inside the window", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const menu = page.locator(".fortune-cell-menu").first();
    const rows = await page.locator(".fortune-row-header").boundingBox();
    await page.mouse.click(rows.x + 10, rows.y + rows.height - 20, {
      button: "right",
    });
    await expect(menu).toBeVisible();
    let box = await menu.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
    await page.keyboard.press("Escape");

    const cols = await page.locator(".fortune-col-header").boundingBox();
    const right = Math.min(cols.x + cols.width, page.viewportSize().width);
    await page.mouse.click(right - 40, cols.y + 8, { button: "right" });
    await expect(menu).toBeVisible();
    box = await menu.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
});

test.describe("dialogs", () => {
  const focusInside = (page, selector) =>
    page.evaluate(
      (sel) => !!document.querySelector(sel)?.contains(document.activeElement),
      selector
    );

  test("Format Cells from Ctrl+1 keeps Tab inside and gives the sheet back", async ({
    sheet,
    page,
  }) => {
    await sheet.click(2, 2);
    await page.keyboard.press("Control+1");
    const dialog = ".fortune-format-cells";
    await expect(page.locator(dialog)).toBeVisible();
    await expect.poll(() => focusInside(page, dialog)).toBe(true);
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(await focusInside(page, dialog)).toBe(true);
    }
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await focusInside(page, dialog)).toBe(true);
    }
    // Tab never reached the grid: the selection did not move
    await sheet.waitForSelection(2, 2);
    await page.keyboard.press("Escape");
    await expect(page.locator(dialog)).toHaveCount(0);
    await expect(page.locator(".luckysheet-cell-input")).toBeFocused();
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(2, 2)).toBe(7);
  });

  test("message boxes: focus inside, Enter confirms, Escape cancels", async ({
    sheet,
    page,
  }) => {
    // Text to Columns on two columns: "only one column can be split"
    await sheet.select(0, 0, 0, 1);
    await (await toolbarButton(page, "Text to Columns")).click();
    const dialog = page.locator(".fortune-modal-container [role=dialog]");
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => focusInside(page, ".fortune-modal-container"))
      .toBe(true);
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);

    await (await toolbarButton(page, "Text to Columns")).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("a dialog can be dragged by its title bar", async ({ sheet, page }) => {
    await sheet.click(0, 0);
    await page.keyboard.press("Control+1");
    const dialog = page.locator(".fortune-format-cells");
    const before = await dialog.boundingBox();
    const title = page.locator("#fortune-format-cells-title");
    const t = await title.boundingBox();
    await page.mouse.move(t.x + 5, t.y + t.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + 105, t.y + t.height / 2 + 60, { steps: 5 });
    await page.mouse.up();
    const after = await dialog.boundingBox();
    expect(Math.round(after.x - before.x)).toBe(100);
    expect(Math.round(after.y - before.y)).toBe(60);
    // the controls in it still work
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("Find and Replace keeps Tab in the dialog and closes on Escape", async ({
    sheet,
    page,
  }) => {
    await sheet.click(4, 4);
    await (await toolbarButton(page, "Find & Select")).click();
    await page.locator('[data-menu-id="find"]').click();
    const dialog = "#fortune-search-replace";
    await expect(page.locator(dialog)).toBeVisible();
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press("Tab");
      expect(await focusInside(page, dialog)).toBe(true);
    }
    await sheet.waitForSelection(4, 4);
    await page.keyboard.press("Escape");
    await expect(page.locator(dialog)).toHaveCount(0);
  });
});
