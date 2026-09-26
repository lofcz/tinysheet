const { test, expect, Sheet } = require("../fixtures");

// Dialogs (DialogShell: title, close button, footer, focus trap, Escape,
// Enter, drag by the title) and the side pane dock (Comments, Watch Window,
// Data Validation, Format Shape, PivotTable Fields, Chart editor: open,
// resize, stack, close). The E2E/Dialogs story exposes
// `window.__tinysheetDialogs.open(name)` to show each dialog the way its
// command does; the common ones are also opened with the keyboard and the
// mouse here.

const HARNESS = "e2e-dialogs--light";

async function openHarness(page, id = HARNESS) {
  const sheet = new Sheet(page);
  await sheet.open(id);
  await page.waitForFunction(() => !!window.__tinysheetDialogs);
  return sheet;
}

const openDialog = (page, name) =>
  page.evaluate((n) => window.__tinysheetDialogs.open(n), name);

/** The dialog on top (a DialogShell or a message box). */
const topDialog = (page) =>
  page.locator(".ts-dialog[role=dialog]").filter({ visible: true }).last();

const focusIn = (page, locator) =>
  locator.evaluate((el) => el.contains(document.activeElement));

async function expectTabTrapped(page, dialog, presses = 14) {
  await expect.poll(() => focusIn(page, dialog)).toBe(true);
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press("Tab");
    expect(await focusIn(page, dialog)).toBe(true);
  }
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(await focusIn(page, dialog)).toBe(true);
  }
}

const setCtx = (page, src) =>
  page.evaluate(
    (s) =>
      // eslint-disable-next-line no-new-func
      window.__tinysheet.setContext(new Function("ctx", s), {
        noHistory: true,
      }),
    src
  );

test.describe("dialogs", () => {
  test("every dialog is a DialogShell: title, close, focus trap, Escape", async ({
    page,
  }) => {
    test.setTimeout(240000);
    await openHarness(page);
    const names = await page.evaluate(() => window.__tinysheetDialogs.names);
    expect(names.length).toBeGreaterThan(40);
    for (const name of names) {
      await openDialog(page, name);
      const dialog = topDialog(page);
      await expect(dialog, name).toBeVisible();
      // 16px radius, a title and a close button
      await expect(
        dialog.locator(".ts-dialog-title").first(),
        name
      ).not.toBeEmpty();
      expect(
        await dialog.evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
        name
      ).toBe("16px");
      await expect(
        dialog.locator(".ts-dialog-close").first(),
        name
      ).toBeVisible();
      await expectTabTrapped(page, dialog, 6);
      await page.keyboard.press("Escape");
      await expect(page.locator(".ts-dialog[role=dialog]"), name).toHaveCount(
        0
      );
    }
  });

  test("the close button closes, secondary before primary in the footer", async ({
    page,
  }) => {
    await openHarness(page);
    for (const name of ["sort", "nameManager", "subtotal", "zoom"]) {
      await openDialog(page, name);
      const dialog = topDialog(page);
      await expect(dialog).toBeVisible();
      const footer = dialog.locator(".ts-dialog-footer");
      const primary = footer.locator(".ts-btn--primary");
      if ((await primary.count()) > 0) {
        // the primary (ink) button is the last one
        const last = footer.locator(".ts-btn").last();
        await expect(last).toHaveClass(/ts-btn--primary/);
      }
      await dialog.locator(".ts-dialog-close").click();
      await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
    }
  });

  test("Enter confirms: Zoom, Row Height and a message box", async ({
    page,
  }) => {
    const sheet = await openHarness(page);
    await openDialog(page, "zoom");
    await topDialog(page).getByLabel("75%").check();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
    await expect
      .poll(async () => (await sheet.sheetInfo()).zoomRatio)
      .toBe(0.75);

    await openDialog(page, "rowHeight");
    const input = topDialog(page).locator("input[type=number]");
    await input.fill("40");
    await page.keyboard.press("Enter");
    await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__tinysheet.getRowHeight([1])[1]))
      .toBe(40);

    await openDialog(page, "message");
    await expect(topDialog(page)).toContainText("A message from the workbook.");
    await expect(
      topDialog(page).getByRole("button", { name: "OK" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
  });

  test("keyboard opens Format Cells, Find and Replace, Go To, Insert and Delete", async ({
    page,
  }) => {
    const sheet = await openHarness(page);
    await sheet.click(2, 2);
    await page.keyboard.press("Control+1");
    let dialog = page.getByRole("dialog", { name: "Format Cells" });
    await expect(dialog).toBeVisible();
    // Excel's six tabs; arrows move between them
    await expect(dialog.getByRole("tab")).toHaveCount(6);
    await dialog.getByRole("tab", { name: "Number" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      dialog.getByRole("tab", { name: "Alignment" })
    ).toHaveAttribute("aria-selected", "true");
    await expectTabTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await sheet.click(2, 2);
    await page.keyboard.press("Control+h");
    dialog = page.locator("#fortune-search-replace");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Replace" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expectTabTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await sheet.click(2, 2);
    await page.keyboard.press("Control+g");
    dialog = page.getByRole("dialog", { name: "Go To" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("D5");
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [4, 4], column: [3, 3] });

    await page.keyboard.press("Control+Shift+Equal");
    dialog = topDialog(page);
    await expect(dialog.locator(".ts-dialog-title")).toHaveText("Insert");
    await page.keyboard.press("Escape");
    await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
  });

  test("mouse opens Format Cells and Define Name from the cell menu", async ({
    page,
  }) => {
    const sheet = await openHarness(page);
    const { x, y } = sheet.point(1, 1);
    await page.mouse.click(x, y, { button: "right" });
    await page.locator('.fortune-cell-menu [data-key="cell-format"]').click();
    const format = page.getByRole("dialog", { name: "Format Cells" });
    await expect(format).toBeVisible();
    await format.getByRole("tab", { name: "Border" }).click();
    await expect(format.getByRole("tab", { name: "Border" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await format.getByRole("button", { name: "Cancel" }).click();
    await expect(format).toHaveCount(0);

    await page.mouse.click(x, y, { button: "right" });
    await page.locator('.fortune-cell-menu [data-key="define-name"]').click();
    const name = page.getByRole("dialog", { name: "New Name" });
    await expect(name).toBeVisible();
    await name.getByLabel("Name:").fill("Prices");
    await name.getByRole("button", { name: "OK" }).click();
    await expect(name).toHaveCount(0);
  });

  test("a dialog shown by showDialog drags by its title", async ({ page }) => {
    await openHarness(page);
    await openDialog(page, "sort");
    const dialog = topDialog(page);
    const before = await dialog.boundingBox();
    const title = dialog.locator(".ts-dialog-title");
    const t = await title.boundingBox();
    await page.mouse.move(t.x + 5, t.y + t.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + 85, t.y + t.height / 2 + 50, { steps: 5 });
    await page.mouse.up();
    const after = await dialog.boundingBox();
    expect(Math.round(after.x - before.x)).toBe(80);
    expect(Math.round(after.y - before.y)).toBe(50);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
  });

  test("the Text to Columns wizard steps with Next / Back", async ({
    page,
  }) => {
    await openHarness(page);
    await openDialog(page, "textToColumns");
    const dialog = topDialog(page);
    await expect(dialog).toContainText("Step 1 of 3");
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog).toContainText("Step 2 of 3");
    await dialog.getByLabel("Semicolon").check();
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog).toContainText("Step 3 of 3");
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog).toContainText("Step 2 of 3");
    await dialog.getByRole("button", { name: "Finish" }).click();
    await expect(page.locator(".ts-dialog[role=dialog]")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__tinysheet.getCellValue(0, 8)))
      .toBe("c");
  });

  test("dialogs follow the dark theme", async ({ page }) => {
    await openHarness(page, "e2e-dialogs--dark");
    await openDialog(page, "sort");
    const dialog = topDialog(page);
    await expect(dialog).toBeVisible();
    const bg = await dialog.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe("rgb(24, 24, 27)");
    await page.keyboard.press("Escape");
    await openDialog(page, "formatCells");
    const fc = page.getByRole("dialog", { name: "Format Cells" });
    expect(
      await fc.evaluate((el) => getComputedStyle(el).backgroundColor)
    ).toBe("rgb(24, 24, 27)");
  });
});

test.describe("side pane dock", () => {
  const slot = (page) => page.locator(".fortune-side-slot");

  test("Watch Window opens in the dock, resizes, stacks and closes", async ({
    page,
  }) => {
    await openHarness(page);
    await setCtx(page, "ctx.watchWindow = { open: true, watches: [] };");
    await expect(slot(page)).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Watch Window" })
    ).toBeVisible();
    await expect(slot(page).locator(".fortune-watch-window")).toBeVisible();

    // resize: drag the separator 40px to the left
    const sep = page.locator(".fortune-side-separator");
    const w0 = (await slot(page).boundingBox()).width;
    const s = await sep.boundingBox();
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width / 2 - 40, s.y + s.height / 2, {
      steps: 4,
    });
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await slot(page).boundingBox()).width))
      .toBe(Math.round(w0 + 40));
    // and with the keyboard (clamped to 360px)
    await sep.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(sep).toHaveAttribute("aria-valuenow", "360");

    // a second pane stacks: the header becomes a segmented switch
    await setCtx(page, "ctx.dataVerificationSidebar = true;");
    const tabs = slot(page).locator(".fortune-side-pane-tabs [role=tab]");
    await expect(tabs).toHaveCount(2);
    await expect(slot(page).locator(".fortune-dv-sidebar")).toBeVisible();
    await tabs.first().click();
    await expect(slot(page).locator(".fortune-watch-window")).toBeVisible();

    // close both
    await slot(page).getByRole("button", { name: "Close pane" }).click();
    await expect(tabs).toHaveCount(0);
    await expect(slot(page).locator(".fortune-dv-sidebar")).toBeVisible();
    await slot(page).getByRole("button", { name: "Close pane" }).click();
    await expect(slot(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => window.__tinysheet.getSheet() && true)
    ).toBe(true);
  });

  test("Comments pane lives in the dock", async ({ page }) => {
    const sheet = new Sheet(page);
    await sheet.open("features-threaded-comments--light");
    await setCtx(page, "ctx.threadedCommentsPane = true;");
    const pane = page.getByRole("complementary", { name: "Comments" });
    await expect(pane).toBeVisible();
    await expect(pane.locator(".fortune-comments-item")).toHaveCount(2);
    // keys typed in the pane do not reach the grid
    await pane.getByRole("button", { name: "Resolved", exact: true }).focus();
    await page.keyboard.press("Delete");
    expect(await sheet.value(1, 1)).toBe(1200);
    await pane.getByRole("button", { name: "Close pane" }).click();
    await expect(pane).toHaveCount(0);
  });

  test("Format Shape pane: Shape Options and Text Options", async ({
    page,
  }) => {
    await page.goto("/iframe.html?id=shapes--gallery&viewMode=story");
    const rect = page.locator('[data-shape-id="rect"]');
    await rect.click({ button: "right", position: { x: 20, y: 20 } });
    await page.getByRole("menuitem", { name: /Format Shape/ }).click();
    const pane = page.getByRole("complementary", { name: "Format Shape" });
    await expect(pane).toBeVisible();
    await expect(pane.getByText("Fill", { exact: true })).toBeVisible();
    await pane.getByRole("button", { name: "Text Options" }).click();
    await expect(pane.getByRole("button", { name: "Bold" })).toBeVisible();
    // the separator resizes the pane without deselecting the shape
    const sep = page.locator(".fortune-side-separator");
    const s = await sep.boundingBox();
    await page.mouse.move(s.x + s.width / 2, s.y + 100);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width / 2 - 30, s.y + 100, { steps: 3 });
    await page.mouse.up();
    await expect(pane).toBeVisible();
    await pane.getByRole("button", { name: "Close pane" }).click();
    await expect(pane).toHaveCount(0);
  });

  test("PivotTable Fields and the chart editor open in the dock", async ({
    page,
  }) => {
    const sheet = new Sheet(page);
    await sheet.open("pivottables--report");
    // the pane shows while the active cell is in the report
    await sheet.click(4, 0, { wait: false });
    const fields = page.getByTestId("pivot-fields-pane");
    await expect(fields).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "PivotTable Fields" })
    ).toBeVisible();
    await expect(fields.locator(".fortune-pivot-area")).toHaveCount(4);

    await page.goto("/iframe.html?id=charts--gallery&viewMode=story");
    const box = page.locator(".fortune-chart-box[role=figure]").first();
    await box.dblclick();
    const editor = page.locator(".fortune-side-slot .fortune-chart-editor");
    await expect(editor).toBeVisible();
    await page
      .locator(".fortune-side-slot")
      .getByRole("button", { name: "Close pane" })
      .click();
    await expect(editor).toHaveCount(0);
  });
});
