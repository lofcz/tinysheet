const { test, expect } = require("../fixtures");

// Formula editing with the mouse, like Excel: Point mode (clicking, dragging,
// Ctrl / Shift clicks, headers), dragging a reference's colour box, the
// wheel over the editing popups, undo inside the editor.

const fxBar = (page) => page.locator("#luckysheet-functionbox-cell");
const refBox = (page, i = 0) =>
  page.locator(".fortune-formula-functionrange-highlight").nth(i);

/** Text offset of the caret in the focused editor. */
const caret = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(sel.focusNode, sel.focusOffset);
    return r.toString().length;
  });

const activeId = (page) => page.evaluate(() => document.activeElement?.id);

async function ctrlClick(sheet, page, r, c) {
  await page.keyboard.down("Control");
  await sheet.click(r, c, { wait: false });
  await page.keyboard.up("Control");
}

/** Drags from the centre of `handle` to the centre of cell (r, c). */
async function dragTo(sheet, page, handle, r, c) {
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  const p = sheet.point(r, c);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();
}

test.describe("wheel over the editing popups", () => {
  test("scrolls the function list, not the sheet", async ({ sheet, page }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("=s");
    const list = page.locator("#luckysheet-formula-search-c");
    await expect(list).toBeVisible();
    const b = await list.boundingBox();
    await page.mouse.move(b.x + 40, b.y + 40);
    await page.mouse.wheel(0, 200);
    await expect
      .poll(() => list.evaluate((e) => e.scrollTop))
      .toBeGreaterThan(0);
    expect(await sheet.scrollPosition()).toEqual({ x: 0, y: 0 });
    // still editing, the list still open
    await expect(sheet.editor).toHaveText("=s");
    await expect(list).toBeVisible();
  });

  test("the argument hint does not scroll the sheet", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("=SUMIFS(");
    const hint = page.locator("#luckysheet-formula-help-c");
    await expect(hint).toBeVisible();
    const b = await hint.boundingBox();
    await page.mouse.move(b.x + 40, b.y + 10);
    await page.mouse.wheel(0, 300);
    await page.mouse.move(b.x + 40, b.y + b.height - 10);
    await page.mouse.wheel(0, 300);
    // the wheel over the grid still scrolls it
    await sheet.scroll(0, 200);
    await expect(hint).toBeVisible();
  });
});

test.describe("Ctrl+click adds a reference", () => {
  test("no separator for the first argument", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=SUM(");
    await ctrlClick(sheet, page, 0, 0);
    await expect(sheet.editor).toHaveText("=SUM(A1");
    await ctrlClick(sheet, page, 0, 1);
    await expect(sheet.editor).toHaveText("=SUM(A1,B1");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=SUM(A1,B1)");
  });

  test("after a clicked reference, a separator", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=SUM(");
    await sheet.click(0, 0, { wait: false });
    await ctrlClick(sheet, page, 0, 1);
    await expect(sheet.editor).toHaveText("=SUM(A1,B1");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=SUM(A1,B1)");
  });

  test("none after a comma or an operator", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=A1+");
    await ctrlClick(sheet, page, 1, 1);
    await expect(sheet.editor).toHaveText("=A1+B2");
    await page.keyboard.type("*MAX(1,");
    await ctrlClick(sheet, page, 2, 2);
    await expect(sheet.editor).toHaveText("=A1+B2*MAX(1,C3");
  });
});

test.describe("dragging a reference's box", () => {
  test("a corner resizes it; focus, caret and Enter work", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "1");
    await sheet.enter(1, 1, "2");
    await sheet.click(5, 5);
    await page.keyboard.type("=SUM(A1)");
    await dragTo(
      sheet,
      page,
      refBox(page).locator(".fortune-selection-highlight-rb"),
      1,
      1
    );
    await expect(sheet.editor).toHaveText("=SUM(A1:B2)");
    await expect(fxBar(page)).toHaveText("=SUM(A1:B2)");
    expect(await activeId(page)).toBe("luckysheet-rich-text-editor");
    expect(await caret(page)).toBe(11);
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=SUM(A1:B2)");
    await expect.poll(() => sheet.value(5, 5)).toBe(3);
    await sheet.waitForSelection(6, 5);
  });

  test("the border moves it, keeping $ and the caret", async ({
    sheet,
    page,
  }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=$A$1+10");
    // F2: Edit mode, the arrows move the caret (before "10")
    await page.keyboard.press("F2");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(sheet.editor).toHaveText("=$A$1+10");
    await dragTo(
      sheet,
      page,
      refBox(page).locator(".fortune-selection-copy-top"),
      2,
      2
    );
    await expect(sheet.editor).toHaveText("=$C$3+10");
    expect(await caret(page)).toBe(6);
    await page.keyboard.type("5");
    await expect(sheet.editor).toHaveText("=$C$3+510");
    await page.keyboard.press("Escape");
    await expect.poll(() => sheet.formula(5, 5)).toBeNull();
  });

  test("a corner of a range keeps the opposite corner", async ({
    sheet,
    page,
  }) => {
    await sheet.click(8, 5);
    await page.keyboard.type("=COUNT(B2:C4)");
    await dragTo(
      sheet,
      page,
      refBox(page).locator(".fortune-selection-highlight-lt"),
      0,
      0
    );
    await expect(sheet.editor).toHaveText("=COUNT(A1:C4)");
  });

  test("in the formula bar", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await fxBar(page).click();
    await page.keyboard.type("=A1*2");
    await dragTo(
      sheet,
      page,
      refBox(page).locator(".fortune-selection-highlight-rb"),
      1,
      1
    );
    await expect(fxBar(page)).toHaveText("=A1:B2*2");
    expect(await activeId(page)).toBe("luckysheet-functionbox-cell");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=A1:B2*2");
  });

  test("released over the edited cell, the drag ends", async ({
    sheet,
    page,
  }) => {
    await sheet.click(1, 1);
    await page.keyboard.type("=A1");
    await dragTo(
      sheet,
      page,
      refBox(page).locator(".fortune-selection-copy-right"),
      1,
      1
    );
    const text = await sheet.editor.textContent();
    // moving the mouse after the release changes nothing
    const p = sheet.point(4, 4);
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await expect(sheet.editor).toHaveText(text);
  });
});

test.describe("Point mode with the mouse", () => {
  test("click, click again, Shift+click, drag", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=");
    await sheet.click(0, 0, { wait: false });
    await expect(sheet.editor).toHaveText("=A1");
    // another click replaces the reference being pointed at
    await sheet.click(1, 1, { wait: false });
    await expect(sheet.editor).toHaveText("=B2");
    await page.keyboard.down("Shift");
    await sheet.click(3, 2, { wait: false });
    await page.keyboard.up("Shift");
    await expect(sheet.editor).toHaveText("=B2:C4");
    await page.keyboard.type("+SUM(");
    await sheet.select(0, 3, 2, 4);
    await expect(sheet.editor).toHaveText("=B2:C4+SUM(D1:E3");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=B2:C4+SUM(D1:E3)");
  });

  test("F4 on the picked reference, then arrows move it", async ({
    sheet,
    page,
  }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=1+");
    await sheet.click(0, 3, { wait: false });
    await page.keyboard.press("F4");
    await expect(sheet.editor).toHaveText("=1+$D$1");
    await page.keyboard.press("ArrowDown");
    await expect(sheet.editor).toHaveText("=1+$D$2");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=1+$D$2");
  });

  test("column and row headers pick whole columns and rows", async ({
    sheet,
    page,
  }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=SUM(");
    const cols = await page.locator(".fortune-col-header").boundingBox();
    const rows = await page.locator(".fortune-row-header").boundingBox();
    const colY = cols.y + cols.height / 2;
    await page.mouse.click(sheet.point(0, 1).x, colY);
    await expect(sheet.editor).toHaveText("=SUM(B:B");
    await page.keyboard.type(",");
    await page.mouse.move(sheet.point(0, 2).x, colY);
    await page.mouse.down();
    await page.mouse.move(sheet.point(0, 4).x, colY, { steps: 4 });
    await page.mouse.up();
    await expect(sheet.editor).toHaveText("=SUM(B:B,C:E");
    await page.keyboard.down("Control");
    await page.mouse.click(rows.x + rows.width / 2, sheet.point(2, 0).y);
    await page.keyboard.up("Control");
    await expect(sheet.editor).toHaveText("=SUM(B:B,C:E,3:3");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=SUM(B:B,C:E,3:3)");
  });

  test("in the formula bar, which keeps the focus", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await fxBar(page).click();
    await page.keyboard.type("=SUM(");
    await sheet.click(0, 0, { wait: false });
    await expect(fxBar(page)).toHaveText("=SUM(A1");
    await page.keyboard.type(",");
    await sheet.click(1, 0, { wait: false });
    await expect(fxBar(page)).toHaveText("=SUM(A1,A2");
    expect(await activeId(page)).toBe("luckysheet-functionbox-cell");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=SUM(A1,A2)");
  });

  test("where no reference can go, a click commits", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "4");
    await sheet.click(5, 5);
    await page.keyboard.type("=sum(a1");
    await sheet.click(2, 2);
    // closed and in Excel's case
    await expect.poll(() => sheet.formula(5, 5)).toBe("=SUM(A1)");
    await expect.poll(() => sheet.value(5, 5)).toBe(4);
  });

  test("clicking into the text leaves Point mode", async ({ sheet, page }) => {
    await sheet.click(5, 5);
    await page.keyboard.type("=1+");
    await sheet.click(0, 0, { wait: false });
    await expect(page.locator(".fortune-edit-mode")).toHaveAttribute(
      "data-mode",
      "point"
    );
    const b = await sheet.editor.boundingBox();
    await page.mouse.click(b.x + 2, b.y + b.height / 2);
    await expect(page.locator(".fortune-edit-mode")).toHaveAttribute(
      "data-mode",
      "edit"
    );
    // Edit mode: arrows move the caret, the text stays
    await page.keyboard.press("ArrowRight");
    await expect(sheet.editor).toHaveText("=1+A1");
    await page.keyboard.press("Escape");
  });
});

test.describe("undo inside the editor", () => {
  test("Ctrl+Z / Ctrl+Y step through the edit", async ({ sheet, page }) => {
    await sheet.click(1, 0);
    await page.keyboard.type("=SUM(");
    await sheet.click(0, 0, { wait: false });
    await page.keyboard.type("+2");
    await page.keyboard.press("Control+z");
    await expect(sheet.editor).toHaveText("=SUM(A1+");
    await page.keyboard.press("Control+z");
    await expect(sheet.editor).toHaveText("=SUM(A1");
    await page.keyboard.press("Control+z");
    await expect(sheet.editor).toHaveText("=SUM(");
    await page.keyboard.press("Control+y");
    await expect(sheet.editor).toHaveText("=SUM(A1");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(1, 0)).toBe("=SUM(A1)");
  });
});
