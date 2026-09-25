const { test, expect, Sheet } = require("../fixtures");

// The sheet tab bar: reordering tabs by dragging, renaming, the tab menu,
// the sheet list, scrolling the strip, and the zoom control.

const makeSheets = (count, extra = {}) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Sheet${i + 1}`,
    id: `s${i + 1}`,
    order: i,
    status: i === 0 ? 1 : 0,
    row: 50,
    column: 20,
    celldata: [],
    ...(extra[i] || {}),
  }));

/** Opens the scenario story with `sheets`. */
async function openWith(page, sheets, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.addInitScript((data) => {
    window.__e2eScenario = { data };
  }, sheets);
  const sheet = new Sheet(page);
  await sheet.open("e2e-harness--scenario");
  await page.waitForFunction(() => window.__tinysheet);
  return sheet;
}

/** Sheet names in tab order, from the model. */
const order = (page) =>
  page.evaluate(() =>
    [...window.__tinysheet.getAllSheets()]
      .sort((a, b) => a.order - b.order)
      .map((s) => s.name)
  );

const current = (page) =>
  page.evaluate(() => window.__tinysheet.getSheet().name);

/** Tab names as shown in the tab strip. */
const shownTabs = (page) =>
  page
    .locator("#fortune-sheettab-container-c .luckysheet-sheets-item-name")
    .allTextContents();

const tab = (page, name) =>
  page.locator("#fortune-sheettab-container-c .luckysheet-sheets-item", {
    has: page.locator(".luckysheet-sheets-item-name", {
      hasText: new RegExp(`^${name.replace(/[()]/g, "\\$&")}$`),
    }),
  });

/**
 * Presses on tab `from`, drags to page x `toX` and releases. `hold` runs
 * while the button is still down.
 */
async function dragTab(page, from, toX, { hold, steps = 8 } = {}) {
  const box = await tab(page, from).boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 12, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps });
  if (hold) await hold();
  await page.mouse.up();
}

async function expectNoDragState(page) {
  await expect(page.locator(".fortune-sheettab-drop-indicator")).toHaveCount(0);
  await expect(page.locator(".luckysheet-sheets-item-dragging")).toHaveCount(0);
  expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
}

test.describe("reordering sheets by dragging tabs", () => {
  test("drag past other tabs, to the first and to the last position", async ({
    page,
  }) => {
    await openWith(page, makeSheets(4));
    // an inactive tab past two others: it goes after Sheet3
    const s3 = await tab(page, "Sheet3").boundingBox();
    await dragTab(page, "Sheet2", s3.x + s3.width - 4, {
      hold: async () => {
        // the insertion point is shown while dragging
        await expect(
          page.locator(".fortune-sheettab-drop-indicator")
        ).toBeVisible();
        await expect(tab(page, "Sheet2")).toHaveClass(/dragging/);
      },
    });
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet3", "Sheet2", "Sheet4"]);
    await expect.poll(() => shownTabs(page)).toEqual(await order(page));
    // the dragged sheet is active
    await expect.poll(() => current(page)).toBe("Sheet2");
    await expectNoDragState(page);

    // the last tab to the first position
    const first = await tab(page, "Sheet1").boundingBox();
    await dragTab(page, "Sheet4", first.x + 2);
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet4", "Sheet1", "Sheet3", "Sheet2"]);
    await expect.poll(() => current(page)).toBe("Sheet4");

    // the active first tab past the end of the last one
    const last = await tab(page, "Sheet2").boundingBox();
    await dragTab(page, "Sheet4", last.x + last.width + 40);
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet3", "Sheet2", "Sheet4"]);
    await expect.poll(() => shownTabs(page)).toEqual(await order(page));
    await expectNoDragState(page);

    // undo restores the order step by step, the sheet stays active
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet4", "Sheet1", "Sheet3", "Sheet2"]);
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3", "Sheet4"]);
    await expect.poll(() => shownTabs(page)).toEqual(await order(page));
    // redo moves it again
    await page.keyboard.press("Control+y");
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet3", "Sheet2", "Sheet4"]);
  });

  test("with two sheets, both directions", async ({ page }) => {
    await openWith(page, makeSheets(2));
    const s2 = await tab(page, "Sheet2").boundingBox();
    await dragTab(page, "Sheet1", s2.x + s2.width - 3);
    await expect.poll(() => order(page)).toEqual(["Sheet2", "Sheet1"]);
    const s2b = await tab(page, "Sheet2").boundingBox();
    await dragTab(page, "Sheet1", s2b.x + 3);
    await expect.poll(() => order(page)).toEqual(["Sheet1", "Sheet2"]);
    await expect.poll(() => current(page)).toBe("Sheet1");
  });

  test("a click or a tiny movement only activates; a click after a drag works", async ({
    page,
  }) => {
    await openWith(page, makeSheets(3));
    await tab(page, "Sheet2").click();
    await expect.poll(() => current(page)).toBe("Sheet2");
    const box = await tab(page, "Sheet3").boundingBox();
    await page.mouse.move(box.x + 12, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 14, box.y + 11);
    await page.mouse.up();
    await expect.poll(() => current(page)).toBe("Sheet3");
    expect(await order(page)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);

    // drop at its own place: nothing moves, the sheet is active
    const s1 = await tab(page, "Sheet1").boundingBox();
    await dragTab(page, "Sheet1", s1.x + s1.width / 2 + 6);
    await expect.poll(() => current(page)).toBe("Sheet1");
    expect(await order(page)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);
    await expectNoDragState(page);
    await tab(page, "Sheet2").click();
    await expect.poll(() => current(page)).toBe("Sheet2");
    expect(await order(page)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);
  });

  test("Esc cancels a drag", async ({ page }) => {
    await openWith(page, makeSheets(3));
    const s3 = await tab(page, "Sheet3").boundingBox();
    await dragTab(page, "Sheet1", s3.x + s3.width - 3, {
      hold: () => page.keyboard.press("Escape"),
    });
    await expectNoDragState(page);
    expect(await order(page)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);
  });

  test("Ctrl+drag puts a copy there", async ({ page }) => {
    await openWith(page, makeSheets(3));
    const s3 = await tab(page, "Sheet3").boundingBox();
    await dragTab(page, "Sheet1", s3.x + s3.width - 3, {
      hold: () => page.keyboard.down("Control"),
    });
    await page.keyboard.up("Control");
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3", "Sheet1 (2)"]);
    await expect.poll(() => current(page)).toBe("Sheet1 (2)");
  });

  test("grouped sheets move together", async ({ page }) => {
    await openWith(page, makeSheets(5));
    await tab(page, "Sheet2").click();
    await tab(page, "Sheet3").click({ modifiers: ["Shift"] });
    const s5 = await tab(page, "Sheet5").boundingBox();
    await dragTab(page, "Sheet3", s5.x + s5.width - 3);
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet4", "Sheet5", "Sheet2", "Sheet3"]);
  });

  test("overflowing tabs: the strip scrolls while dragging at its edge", async ({
    page,
  }) => {
    await openWith(page, makeSheets(20), { width: 1000, height: 600 });
    const strip = page.locator("#fortune-sheettab-container-c");
    const scroll = () => strip.evaluate((el) => el.scrollLeft);
    const maxScroll = () =>
      strip.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(await maxScroll()).toBeGreaterThan(200);
    await expect(page.locator("#fortune-sheettab-rightscroll")).toBeVisible();
    const box = await strip.boundingBox();
    // hold at the right edge until the strip reached its end
    await dragTab(page, "Sheet2", box.x + box.width - 4, {
      hold: async () => {
        await expect
          .poll(async () => (await maxScroll()) - (await scroll()), {
            timeout: 10000,
          })
          .toBeLessThanOrEqual(1);
        await page.mouse.move(box.x + box.width + 30, box.y + 15);
      },
    });
    const names = await order(page);
    expect(names[names.length - 1]).toBe("Sheet2");
    await expect.poll(() => current(page)).toBe("Sheet2");
    await expectNoDragState(page);
    // the active (last) tab is in view
    const active = await page
      .locator(".luckysheet-sheets-item-active")
      .boundingBox();
    expect(active.x + active.width).toBeLessThanOrEqual(box.x + box.width + 1);

    // and back to the first position, scrolling left
    await dragTab(page, "Sheet2", box.x + 3, {
      hold: () =>
        expect.poll(scroll, { timeout: 10000 }).toBeLessThanOrEqual(0),
    });
    await expect.poll(async () => (await order(page))[0]).toBe("Sheet2");
  });
});

test.describe("sheet tabs", () => {
  test("clicking a tab commits the entry and gives keys back to the grid", async ({
    page,
  }) => {
    const sheet = await openWith(page, makeSheets(3));
    await sheet.click(0, 0);
    await page.keyboard.type("abc");
    await tab(page, "Sheet2").click();
    await expect.poll(() => current(page)).toBe("Sheet2");
    expect(
      await page.evaluate(() =>
        window.__tinysheet.getCellValue(0, 0, { id: "s1" })
      )
    ).toBe("abc");
    // keys go to the grid: Ctrl+PageDown, then typing
    await page.keyboard.press("Control+PageDown");
    await expect.poll(() => current(page)).toBe("Sheet3");
    await page.keyboard.press("Control+PageUp");
    await expect.poll(() => current(page)).toBe("Sheet2");
  });

  test("Ctrl+PageDown keeps the active tab in view", async ({ page }) => {
    await openWith(page, makeSheets(20), { width: 1000, height: 600 });
    const sheet = new Sheet(page);
    sheet.box = await sheet.area.boundingBox();
    await sheet.click(2, 2);
    for (let i = 0; i < 17; i += 1) {
      await page.keyboard.press("Control+PageDown");
    }
    await expect.poll(() => current(page)).toBe("Sheet18");
    const strip = await page
      .locator("#fortune-sheettab-container-c")
      .boundingBox();
    const active = await page
      .locator(".luckysheet-sheets-item-active")
      .boundingBox();
    expect(active.x).toBeGreaterThanOrEqual(strip.x - 1);
    expect(active.x + active.width).toBeLessThanOrEqual(
      strip.x + strip.width + 1
    );
    await expect(page.locator("#fortune-sheettab-leftscroll")).toBeVisible();
  });

  test("the + button adds a sheet right after the active one; undo goes back", async ({
    page,
  }) => {
    await openWith(page, makeSheets(3));
    await tab(page, "Sheet2").click();
    await page.getByRole("button", { name: "New sheet" }).click();
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet4", "Sheet3"]);
    await expect.poll(() => current(page)).toBe("Sheet4");
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3"]);
    await expect.poll(() => current(page)).toBe("Sheet2");
  });

  test("switching sheets keeps each sheet's selection; the sheet list does not reset it", async ({
    page,
  }) => {
    const sheet = await openWith(page, makeSheets(2));
    await sheet.click(4, 2);
    await tab(page, "Sheet2").click();
    await expect.poll(() => current(page)).toBe("Sheet2");
    await tab(page, "Sheet1").click();
    await sheet.waitForSelection(4, 2);
    await page.getByRole("button", { name: "All sheets" }).click();
    await expect(page.locator(".fortune-sheet-list")).toBeVisible();
    await page.waitForTimeout(100);
    await sheet.waitForSelection(4, 2);
    // Esc closes the list
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-sheet-list")).toHaveCount(0);
  });
});

test.describe("renaming a sheet", () => {
  test("double-click: Enter commits, Esc cancels, invalid names are refused", async ({
    page,
  }) => {
    await openWith(page, makeSheets(3));
    const name = (n) =>
      tab(page, n).locator(".luckysheet-sheets-item-name").first();

    await name("Sheet2").dblclick();
    await page.keyboard.type("Draft");
    await page.keyboard.press("Escape");
    await expect
      .poll(() => shownTabs(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3"]);
    expect(await order(page)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);

    await name("Sheet2").dblclick();
    await page.keyboard.type("Budget");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Budget", "Sheet3"]);
    await expect
      .poll(() => shownTabs(page))
      .toEqual(["Sheet1", "Budget", "Sheet3"]);
    // keys go back to the grid: undo renames it back
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => shownTabs(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3"]);

    // a taken name (ignoring case) is refused with Excel's message
    await name("Sheet2").dblclick();
    await page.keyboard.type("sheet3");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("That name is already taken. Try a different one.")
    ).toBeVisible();
    await page
      .locator(".fortune-modal-container")
      .getByText("OK", { exact: true })
      .click();
    await expect
      .poll(() => shownTabs(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3"]);
    expect(await order(page)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);

    // blur commits
    await name("Sheet3").dblclick();
    await page.keyboard.type("Notes");
    const sheet = new Sheet(page);
    sheet.box = await sheet.area.boundingBox();
    await sheet.click(3, 3);
    await expect.poll(() => order(page)).toEqual(["Sheet1", "Sheet2", "Notes"]);
  });

  test("Rename from the tab menu renames the clicked sheet of a group", async ({
    page,
  }) => {
    await openWith(page, makeSheets(3));
    await tab(page, "Sheet3").click();
    await tab(page, "Sheet1").click({ modifiers: ["Control"] });
    await tab(page, "Sheet1").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.keyboard.type("First");
    await page.keyboard.press("Enter");
    await expect.poll(() => order(page)).toEqual(["First", "Sheet2", "Sheet3"]);
  });
});

test.describe("tab menu and sheet list", () => {
  test("Insert, Delete (neighbour becomes active), Move right past hidden sheets", async ({
    page,
  }) => {
    await openWith(page, makeSheets(4, { 2: { hide: 1 } }));
    await tab(page, "Sheet2").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Insert", exact: true }).click();
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet5", "Sheet2", "Sheet3", "Sheet4"]);
    await expect.poll(() => current(page)).toBe("Sheet5");
    await page.keyboard.press("Control+z");
    await expect.poll(() => current(page)).toBe("Sheet2");

    // Move right skips the hidden Sheet3
    await tab(page, "Sheet2").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move right" }).click();
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet3", "Sheet4", "Sheet2"]);

    // deleting the active sheet shows its neighbour (the left one here)
    await tab(page, "Sheet2").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page
      .locator(".fortune-modal-container")
      .getByText(/^(Yes|OK)$/)
      .first()
      .click();
    await expect
      .poll(() => order(page))
      .toEqual(["Sheet1", "Sheet3", "Sheet4"]);
    await expect.poll(() => current(page)).toBe("Sheet4");
    await page.keyboard.press("Control+z");
    await expect.poll(() => order(page)).toContain("Sheet2");
  });

  test("the menu closes on an outside click and on Esc", async ({ page }) => {
    const sheet = await openWith(page, makeSheets(2));
    const menu = page.getByRole("menu").filter({ hasText: "Rename" });
    await tab(page, "Sheet2").click({ button: "right" });
    await expect(menu).toBeVisible();
    await sheet.click(5, 5, { wait: false });
    await expect(menu).toHaveCount(0);
    await tab(page, "Sheet2").click({ button: "right" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("the sheet list shows a hidden sheet by unhiding it", async ({
    page,
  }) => {
    await openWith(page, makeSheets(3, { 1: { hide: 1 } }));
    await expect
      .poll(() => shownTabs(page))
      .toEqual(["Sheet1", "Sheet2", "Sheet3"]);
    await expect(tab(page, "Sheet2")).toBeHidden();
    await page.getByRole("button", { name: "All sheets" }).click();
    await page
      .locator(".fortune-sheet-list-item", { hasText: "Sheet2" })
      .click();
    await expect(page.locator(".fortune-sheet-list")).toHaveCount(0);
    await expect.poll(() => current(page)).toBe("Sheet2");
    await expect(tab(page, "Sheet2")).toBeVisible();
  });
});

test.describe("zoom control", () => {
  test("the zoom menu toggles, closes on Esc; buttons step by 10%", async ({
    page,
  }) => {
    await openWith(page, makeSheets(1));
    const current100 = page.locator(".fortune-zoom-ratio-current");
    const menu = page.locator(".fortune-zoom-ratio-menu");
    await current100.click();
    await expect(menu).toBeVisible();
    await current100.click();
    await expect(menu).toHaveCount(0);
    await current100.click();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(current100).toHaveText("110%");
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(current100).toHaveText("90%");
  });
});
