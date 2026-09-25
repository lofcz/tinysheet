const { test, expect, Sheet } = require("../fixtures");

// The formula bar like Excel's: the Name Box (address, go to, define a name,
// the names list, drag its width), the cancel / enter / fx buttons, the
// formula field (expand, resize, long formulas, the popups under it) and
// its light / dark look.

const fxBar = (page) => page.locator("#luckysheet-functionbox-cell");
const nameBox = (page) => page.getByRole("textbox", { name: "Name Box" });
const cancelButton = (page) =>
  page
    .locator(".fortune-fx-editor")
    .getByRole("button", { name: "Discard Edit" });
const enterButton = (page) =>
  page
    .locator(".fortune-fx-editor")
    .getByRole("button", { name: "Confirm Edit" });
const fxButton = (page) =>
  page
    .locator(".fortune-fx-editor")
    .getByRole("button", { name: "Insert Function" });
const activeId = (page) => page.evaluate(() => document.activeElement?.id);
const cssOf = (locator, prop) =>
  locator.evaluate((el, p) => getComputedStyle(el)[p], prop);

test.describe("Name Box", () => {
  test("shows the active cell and the selected range", async ({
    sheet,
    page,
  }) => {
    await sheet.click(2, 1);
    await expect(nameBox(page)).toHaveValue("B3");
    await sheet.select(1, 1, 3, 2);
    await expect(nameBox(page)).toHaveValue("B2:C4");
  });

  test("typing an address or a range and Enter selects it", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await nameBox(page).click();
    // the text is selected: typing replaces it
    await page.keyboard.type("D7");
    await page.keyboard.press("Enter");
    await sheet.waitForSelection(6, 3);
    await expect(nameBox(page)).toHaveValue("D7");
    // back to the grid: typing edits the cell
    await expect.poll(() => activeId(page)).toBe("luckysheet-rich-text-editor");
    await nameBox(page).click();
    await page.keyboard.type("b2:c5");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 4], column: [1, 2] });
    await expect(nameBox(page)).toHaveValue("B2:C5");
  });

  test("Esc leaves the Name Box unchanged", async ({ sheet, page }) => {
    await sheet.click(1, 1);
    await nameBox(page).click();
    await page.keyboard.type("Z99");
    await page.keyboard.press("Escape");
    await expect(nameBox(page)).toHaveValue("B2");
    await sheet.waitForSelection(1, 1);
  });

  test("typing a new name defines it; the list selects it", async ({
    sheet,
    page,
  }) => {
    await sheet.select(1, 1, 2, 2);
    await nameBox(page).click();
    await page.keyboard.type("Sales");
    await page.keyboard.press("Enter");
    // the Name Box shows the name of exactly the selected range
    await expect(nameBox(page)).toHaveValue("Sales");
    await sheet.click(5, 5);
    await expect(nameBox(page)).toHaveValue("F6");
    // the drop-down lists the defined names
    const arrow = page
      .locator(".fortune-fx-editor")
      .getByRole("button", { name: "Defined names" });
    await arrow.click();
    await expect(arrow).toHaveAttribute("aria-expanded", "true");
    const item = page.getByRole("menuitem", { name: "Sales" });
    await expect(item).toBeVisible();
    await item.click();
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 2], column: [1, 2] });
    await expect(nameBox(page)).toHaveValue("Sales");
    await expect(arrow).toHaveAttribute("aria-expanded", "false");
    // a formula can use it
    await sheet.enter(1, 1, "4");
    await sheet.enter(6, 0, "=SUM(Sales)");
    await expect.poll(() => sheet.value(6, 0)).toBe(4);
  });

  test("the list opens by keyboard (Alt+Down) and says when it is empty", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await nameBox(page).click();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(page.locator(".fortune-name-box-empty")).toHaveText(
      "No names defined yet."
    );
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-name-box-empty")).toHaveCount(0);
  });

  test("an invalid reference is reported", async ({ sheet, page }) => {
    await sheet.click(0, 0);
    await nameBox(page).click();
    await page.keyboard.type("A1:");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("The reference or name isn't valid.")
    ).toBeVisible();
    await sheet.waitForSelection(0, 0);
  });

  test("dragging its right edge resizes it, remembered", async ({
    sheet,
    page,
  }) => {
    expect(sheet).toBeTruthy();
    const field = page.locator(".fortune-name-box-field");
    const grip = page.getByRole("separator", {
      name: "Drag to resize the Name Box",
    });
    const before = (await field.boundingBox()).width;
    const g = await grip.boundingBox();
    const x = g.x + g.width / 2;
    const y = g.y + g.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await page.mouse.move(x + 80, y + 30, { steps: 4 });
    await page.mouse.up();
    const after = (await field.boundingBox()).width;
    expect(after).toBeGreaterThan(before + 70);
    expect(after).toBeLessThan(before + 90);
    // no cell was selected by the drag
    await sheet.waitForSelection(0, 0);
    // kept after a reload
    await page.reload();
    await page.locator(".fortune-cell-area").waitFor();
    await expect
      .poll(async () => (await field.boundingBox()).width)
      .toBeCloseTo(after, 0);
    // keyboard: arrows on the focused grip, double-click restores
    await grip.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => (await field.boundingBox()).width)
      .toBeCloseTo(after - 8, 0);
    await grip.dblclick();
    await expect
      .poll(async () => (await field.boundingBox()).width)
      .toBeCloseTo(before, 0);
    // never narrower than the minimum
    const g2 = await grip.boundingBox();
    await page.mouse.move(g2.x + 4, g2.y + 10);
    await page.mouse.down();
    await page.mouse.move(g2.x - 300, g2.y + 10, { steps: 5 });
    await page.mouse.up();
    expect((await field.boundingBox()).width).toBe(56);
    await page.evaluate(() => window.localStorage.clear());
  });
});

test.describe("cancel and enter buttons", () => {
  test("are live only while a cell is edited", async ({ sheet, page }) => {
    await sheet.click(0, 0);
    await expect(cancelButton(page)).toBeDisabled();
    await expect(enterButton(page)).toBeDisabled();
    await expect(fxButton(page)).toBeEnabled();
    await page.keyboard.type("1");
    await expect(cancelButton(page)).toBeEnabled();
    await expect(enterButton(page)).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(cancelButton(page)).toBeDisabled();
  });

  test("enter commits the formula bar and keeps the active cell", async ({
    sheet,
    page,
  }) => {
    await sheet.click(1, 1);
    await fxBar(page).click();
    await page.keyboard.type("=2*3");
    await enterButton(page).click();
    await expect.poll(() => sheet.value(1, 1)).toBe(6);
    expect(await sheet.formula(1, 1)).toBe("=2*3");
    // unlike Enter, the active cell stays
    await sheet.waitForSelection(1, 1);
    await expect(fxBar(page)).toHaveText("=2*3");
    await expect(enterButton(page)).toBeDisabled();
    // the grid has the keys again
    await expect.poll(() => activeId(page)).toBe("luckysheet-rich-text-editor");
    await page.keyboard.press("ArrowDown");
    await sheet.waitForSelection(2, 1);
  });

  test("enter commits the in-cell editor too (adding the missing paren)", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "5");
    await sheet.click(0, 1);
    await page.keyboard.type("=sum(A1,2");
    await enterButton(page).click();
    await expect.poll(() => sheet.value(0, 1)).toBe(7);
    expect(await sheet.formula(0, 1)).toBe("=SUM(A1,2)");
    await sheet.waitForSelection(0, 1);
  });

  test("cancel restores the cell's content", async ({ sheet, page }) => {
    await sheet.enter(0, 0, "hello");
    await sheet.click(0, 0);
    await fxBar(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" world");
    await expect(page.locator(".fortune-fx-editor")).toHaveClass(
      /fortune-fx-editor-editing/
    );
    await cancelButton(page).click();
    await expect(fxBar(page)).toHaveText("hello");
    expect(await sheet.value(0, 0)).toBe("hello");
    await sheet.waitForSelection(0, 0);
    await expect.poll(() => activeId(page)).toBe("luckysheet-rich-text-editor");
    await expect(page.locator(".fortune-fx-editor")).not.toHaveClass(
      /fortune-fx-editor-editing/
    );
  });

  test("Esc in the formula bar restores it and returns to the grid", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "12");
    await sheet.click(0, 0);
    await fxBar(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type("+99");
    await page.keyboard.press("Escape");
    await expect(fxBar(page)).toHaveText("12");
    await expect.poll(() => activeId(page)).toBe("luckysheet-rich-text-editor");
    expect(await sheet.value(0, 0)).toBe(12);
  });
});

test.describe("fx", () => {
  // fx and Shift+F3 open Excel's Insert Function dialog (the Formulas
  // tab's); the picked function goes into the cell or at the caret
  const insertDialog = (page) =>
    page.getByRole("dialog", { name: "Insert Function" });

  test("opens Insert Function; the picked function starts the formula", async ({
    sheet,
    page,
  }) => {
    await sheet.click(2, 2);
    await fxButton(page).click();
    const dialog = insertDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("searchbox")).toBeFocused();
    await dialog.getByRole("searchbox").fill("AVERAGE");
    await expect(dialog.locator('[data-function="AVERAGE"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await dialog.getByRole("button", { name: "Insert" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(fxBar(page)).toHaveText("=AVERAGE(");
    await page.keyboard.type("2,4");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(2, 2)).toBe(3);
  });

  test("while editing, inserts at the caret; Shift+F3 does the same", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("=1+");
    await page.keyboard.press("Shift+F3");
    const dialog = insertDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("searchbox").fill("SUM");
    await expect(dialog.locator('[data-function="SUM"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    // the in-cell editor keeps the edit
    await expect(sheet.editor).toHaveText("=1+SUM(");
    await expect.poll(() => activeId(page)).toBe("luckysheet-rich-text-editor");
    await page.keyboard.type("2,3");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(0, 0)).toBe(6);
  });

  test("a constant being typed is replaced by a formula", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("abc");
    await fxButton(page).click();
    const dialog = insertDialog(page);
    await dialog.getByRole("searchbox").fill("SUM");
    await page.keyboard.press("Enter");
    await expect(sheet.editor).toHaveText("=SUM(");
    await expect(fxBar(page)).toHaveText("=SUM(");
    await page.keyboard.press("Escape");
    await expect.poll(() => sheet.value(0, 0)).toBeNull();
  });

  test("Cancel leaves the cell as it was", async ({ sheet, page }) => {
    await sheet.enter(0, 0, "7");
    await sheet.click(0, 0);
    await fxButton(page).click();
    const dialog = insertDialog(page);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await sheet.value(0, 0)).toBe(7);
    await expect(fxBar(page)).toHaveText("7");
  });
});

test.describe("formula field", () => {
  test("is one 36px line; long formulas wrap and scroll inside it", async ({
    sheet,
    page,
  }) => {
    const bar = page.locator(".fortune-fx-editor");
    expect((await bar.boundingBox()).height).toBe(36);
    await sheet.click(0, 0);
    await fxBar(page).click();
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const long = `=LEN("${words}")+A2+B3`;
    await page.keyboard.type('=LEN("');
    await page.keyboard.insertText(words);
    await page.keyboard.type('")+A2+B3');
    // the bar keeps its height; the text scrolls to the caret
    expect((await bar.boundingBox()).height).toBe(36);
    const scroll = await fxBar(page).evaluate((el) => ({
      top: el.scrollTop,
      height: el.scrollHeight,
      client: el.clientHeight,
    }));
    expect(scroll.height).toBeGreaterThan(scroll.client);
    expect(scroll.top).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    expect(await sheet.formula(0, 0)).toBe(long);
    expect(await sheet.value(0, 0)).toBe(words.length);
  });

  test("the expand button and dragging the edge resize it", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const bar = page.locator(".fortune-fx-editor");
    const field = page.locator(".fortune-fx-input-container");
    await page.getByRole("button", { name: /Expand Formula Bar/ }).click();
    await expect(bar).toHaveClass(/fortune-fx-editor-expanded/);
    const expanded = (await bar.boundingBox()).height;
    expect(expanded).toBe(96);
    // the field grows with the bar, the Name Box and buttons stay one line
    expect((await field.boundingBox()).height).toBe(expanded - 8);
    expect(
      (await page.locator(".fortune-name-box-field").boundingBox()).height
    ).toBe(28);
    // keyboard on the focused edge: one line per arrow
    const handle = page.getByRole("separator", {
      name: "Drag to resize the formula bar",
    });
    await handle.focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await bar.boundingBox()).height).toBe(116);
    // dragging the edge up past the minimum collapses it
    const h = await handle.boundingBox();
    await page.mouse.move(h.x + 300, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 300, h.y - 120, { steps: 6 });
    await page.mouse.up();
    await expect(bar).not.toHaveClass(/fortune-fx-editor-expanded/);
    expect((await bar.boundingBox()).height).toBe(36);
    await page.evaluate(() => window.localStorage.clear());
  });

  test("the argument hint hangs under the bar while editing there", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await fxBar(page).click();
    await page.keyboard.type("=ROUND(");
    const hint = page.locator(".luckysheet-formula-help-c");
    await expect(hint).toBeVisible();
    const field = await page
      .locator(".fortune-fx-input-container")
      .boundingBox();
    const box = await hint.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(field.y + field.height);
    expect(box.y).toBeLessThan(field.y + field.height + 12);
    await page.keyboard.press("Escape");
  });

  test("references are coloured like their range boxes", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 3);
    await fxBar(page).click();
    await page.keyboard.type("=A1+B2:C3");
    const refs = fxBar(page).locator(".fortune-formula-functionrange-cell");
    await expect(refs).toHaveCount(2);
    const boxes = page.locator(".fortune-formula-functionrange-highlight");
    await expect(boxes).toHaveCount(2);
    for (let i = 0; i < 2; i += 1) {
      const text = await cssOf(refs.nth(i), "color");
      const box = await cssOf(
        boxes.nth(i).locator(".fortune-selection-copy-top"),
        "backgroundColor"
      );
      expect(text).toBe(box);
    }
    expect(await cssOf(refs.nth(0), "color")).not.toBe(
      await cssOf(refs.nth(1), "color")
    );
    await page.keyboard.press("Escape");
  });
});

test.describe("theme", () => {
  const colors = async (page) => ({
    field: await cssOf(
      page.locator(".fortune-fx-input-container"),
      "backgroundColor"
    ),
    nameBox: await cssOf(
      page.locator(".fortune-name-box-field"),
      "backgroundColor"
    ),
    text: await cssOf(fxBar(page), "color"),
    caret: await cssOf(fxBar(page), "caretColor"),
    bar: await cssOf(
      page.locator(".fortune-fx-editor-wrap"),
      "backgroundColor"
    ),
    radius: await cssOf(
      page.locator(".fortune-fx-input-container"),
      "borderTopLeftRadius"
    ),
    font: await cssOf(fxBar(page), "fontFamily"),
  });

  test("light: surface fields on the white pane", async ({ sheet, page }) => {
    expect(sheet).toBeTruthy();
    const c = await colors(page);
    expect(c.bar).toBe("rgb(255, 255, 255)");
    expect(c.field).toBe("rgb(244, 244, 245)");
    expect(c.nameBox).toBe("rgb(244, 244, 245)");
    expect(c.text).toBe("rgb(24, 24, 27)");
    expect(c.caret).toBe("rgb(24, 24, 27)");
    expect(c.radius).toBe("8px");
    expect(c.font).not.toMatch(/mono/i);
  });

  test("dark: dark fields and light text", async ({ page }) => {
    const sheet = new Sheet(page);
    await sheet.open("e2e-harness--dark");
    const c = await colors(page);
    expect(c.bar).toBe("rgb(24, 24, 27)");
    expect(c.field).toBe("rgb(9, 9, 11)");
    expect(c.nameBox).toBe("rgb(9, 9, 11)");
    expect(c.text).toBe("rgb(250, 250, 250)");
    expect(c.caret).toBe("rgb(250, 250, 250)");
    // editing in the bar: the field turns into an input with a ring
    await sheet.click(0, 0);
    await fxBar(page).click();
    await expect(page.locator(".fortune-fx-input-container")).toHaveClass(
      /fortune-fx-input-container-focused/
    );
    // (after the 150ms colour transition)
    await expect
      .poll(() =>
        cssOf(page.locator(".fortune-fx-input-container"), "backgroundColor")
      )
      .toBe("rgb(24, 24, 27)");
    await page.keyboard.press("Escape");
  });
});
