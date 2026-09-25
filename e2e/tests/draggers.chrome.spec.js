// Drags of the workbook's chrome with a real mouse: split bars, the side
// pane separator, the formula bar's height, dialogs by their title, the
// Watch Window, the Find dialog, page break lines and sheet tabs at a
// device zoom (scrollbar thumbs: draggers.scrollbar.spec.js). Cursor, live feedback, result,
// Esc, zoom, dark theme and nothing stuck afterwards. Excel is the spec.
const { test, expect, storyUrl, toolbarButton } = require("../fixtures");
const {
  blank,
  cells,
  openScenario,
  setZoom,
  hoverCursor,
  center,
  expectIdle,
  sheetData,
  ctxValue,
} = require("../dragHelpers");

async function dragBy(page, from, dx, dy, { release = true } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  if (release) await page.mouse.up();
}

// ---------------------------------------------------------------------------
// Split panes
// ---------------------------------------------------------------------------

const splitSheet = () =>
  blank({
    frozen: {
      type: "rangeBoth",
      split: true,
      range: { row_focus: 4, column_focus: 2 },
    },
  });
const frozenOf = async (page) => (await sheetData(page)).frozen;

test.describe("split bars", () => {
  test("cursors, a click stays, drag snaps to a row, Esc, undo", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [splitSheet()]);
    const h = page.locator(".fortune-split-bar-h");
    const v = page.locator(".fortune-split-bar-v");
    const hc = await center(h);
    const vc = await center(v);
    expect(await hoverCursor(page, hc.x + 200, hc.y)).toBe("row-resize");
    expect(await hoverCursor(page, vc.x, vc.y + 200)).toBe("col-resize");
    // a click on the bar leaves the split where it is
    await page.mouse.down();
    await page.mouse.up();
    expect((await frozenOf(page)).range).toEqual({
      row_focus: 4,
      column_focus: 2,
    });
    // live ghost, then three rows lower
    await dragBy(page, { x: hc.x + 200, y: hc.y }, 0, 61, { release: false });
    await expect(page.locator(".fortune-split-ghost-h")).toBeVisible();
    await page.mouse.up();
    await expect(page.locator(".fortune-split-ghost-h")).toBeHidden();
    await expect
      .poll(async () => (await frozenOf(page)).range)
      .toEqual({ row_focus: 7, column_focus: 2 });
    // Esc while dragging the vertical bar
    const vc2 = await center(v);
    await dragBy(page, { x: vc2.x, y: vc2.y + 200 }, 148, 0, {
      release: false,
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-split-ghost-v")).toBeHidden();
    await page.mouse.up();
    expect((await frozenOf(page)).range.column_focus).toBe(2);
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await frozenOf(page)).range)
      .toEqual({ row_focus: 4, column_focus: 2 });
    await expectIdle(page, sheet);
  });

  test("at 150% zoom; dragged onto the headers the split goes", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [splitSheet()], { theme: "dark" });
    await setZoom(page, 1.5);
    const v = page.locator(".fortune-split-bar-v");
    const vc = await center(v);
    // one column (111px at 150%) to the right
    await dragBy(page, { x: vc.x, y: vc.y + 200 }, 111, 0);
    await expect
      .poll(async () => (await frozenOf(page)).range.column_focus)
      .toBe(3);
    const h = page.locator(".fortune-split-bar-h");
    const hc = await center(h);
    const area = await page.locator(".fortune-cell-area").boundingBox();
    await dragBy(page, { x: hc.x + 300, y: hc.y }, 0, area.y - hc.y - 10);
    await expect
      .poll(async () => (await frozenOf(page)).type)
      .toBe("rangeColumn");
    await expect(h).toHaveCount(0);
    await expectIdle(page, sheet, { keyboard: false });
  });
});

// ---------------------------------------------------------------------------
// Side pane, formula bar
// ---------------------------------------------------------------------------

test.describe("side pane separator", () => {
  test("drags the pane's width, clamped; Esc restores", async ({ page }) => {
    await page.goto(storyUrl("shell--suite"));
    await page.locator(".fortune-cell-area").waitFor();
    await (await toolbarButton(page, "Task Pane")).click();
    const pane = page.locator(".fortune-side-slot");
    await expect(pane).toBeVisible();
    const sep = page.locator(".fortune-side-separator");
    // the pane slides in: wait until it stands still
    let last = null;
    await expect
      .poll(async () => {
        const b = await sep.boundingBox();
        const still = last != null && b != null && b.x === last.x;
        last = b;
        return still;
      })
      .toBe(true);
    const s = await center(sep);
    expect(await hoverCursor(page, s.x, s.y)).toBe("col-resize");
    const w0 = (await pane.boundingBox()).width;
    await dragBy(page, s, -40, 0, { release: false });
    await expect(sep).toHaveClass(/is-active/);
    await page.mouse.up();
    await expect(sep).not.toHaveClass(/is-active/);
    await expect
      .poll(async () => Math.round((await pane.boundingBox()).width))
      .toBe(Math.round(Math.min(360, w0 + 40)));
    // past the maximum: clamped
    const s2 = await center(sep);
    await dragBy(page, s2, -400, 0);
    await expect
      .poll(async () => Math.round((await pane.boundingBox()).width))
      .toBe(360);
    // Esc puts it back
    const s3 = await center(sep);
    await dragBy(page, s3, 60, 0, { release: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await pane.boundingBox()).width))
      .toBe(360);
    expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
  });
});

test.describe("formula bar height", () => {
  test("drag, Esc, double-click toggles; the grid keeps the keyboard", async ({
    sheet,
    page,
  }) => {
    const bar = page.locator("#luckysheet-functionbox-cell");
    const handle = page.locator(".fortune-fx-resize-handle");
    const h = await center(handle);
    expect(await hoverCursor(page, h.x, h.y)).toBe("row-resize");
    const h0 = (await bar.boundingBox()).height;
    await dragBy(page, h, 0, 60);
    await expect
      .poll(async () => (await bar.boundingBox()).height)
      .toBeGreaterThan(h0 + 40);
    const h1 = (await bar.boundingBox()).height;
    const h2 = await center(handle);
    await dragBy(page, h2, 0, 80, { release: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await bar.boundingBox()).height))
      .toBe(Math.round(h1));
    // double-click collapses it again
    const h3 = await center(handle);
    await page.mouse.dblclick(h3.x, h3.y);
    await expect
      .poll(async () => Math.round((await bar.boundingBox()).height))
      .toBeLessThan(Math.round(h1));
    // the grid's hit-testing follows the moved cell area
    sheet.box = await page.locator(".fortune-cell-area").boundingBox();
    await sheet.click(2, 2);
    await expectIdle(page, sheet);
  });
});

// ---------------------------------------------------------------------------
// Dialogs, Watch Window, Find
// ---------------------------------------------------------------------------

test.describe("dialogs", () => {
  test("a dialog is dragged by its title; Esc during the drag keeps it open", async ({
    sheet,
    page,
  }) => {
    await sheet.click(1, 1);
    await page.keyboard.press("Control+1");
    const dialog = page.locator(".fortune-format-cells, [role=dialog]").first();
    await expect(dialog).toBeVisible();
    const title = dialog
      .locator(
        "[data-dialog-drag-handle], .fortune-modal-dialog-header, .fortune-fc-header"
      )
      .first();
    const t = await title.boundingBox();
    const grab = { x: t.x + 30, y: t.y + t.height / 2 };
    // a title bar keeps the arrow cursor (like a Windows title bar)
    expect(await hoverCursor(page, grab.x, grab.y)).not.toMatch(/resize|text/);
    const d0 = await dialog.boundingBox();
    await dragBy(page, grab, 120, 60);
    await expect
      .poll(async () => {
        const d = await dialog.boundingBox();
        return [Math.round(d.x - d0.x), Math.round(d.y - d0.y)];
      })
      .toEqual([120, 60]);
    const g2 = { x: grab.x + 120, y: grab.y + 60 };
    await dragBy(page, g2, -200, 40, { release: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    const d2 = await dialog.boundingBox();
    expect([Math.round(d2.x - d0.x), Math.round(d2.y - d0.y)]).toEqual([
      120, 60,
    ]);
    expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
    // a second Esc closes it; the grid has the keyboard again
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectIdle(page, sheet);
  });

  test("the Watch Window moves by its title; Esc puts it back", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, [1, "=A1*2"]);
    const p = sheet.point(1, 0);
    await page.mouse.click(p.x, p.y, { button: "right" });
    const menu = page.locator(".fortune-cell-menu");
    await menu.locator('[data-key="formula-auditing"]').click();
    await page.locator('[role=menuitem][data-key="add-watch"]').click();
    const panel = page.locator(".fortune-watch-window");
    await expect(panel).toBeVisible();
    const title = panel.locator(".fortune-watch-window-title");
    const tb = await title.boundingBox();
    const grab = { x: tb.x + 20, y: tb.y + tb.height / 2 };
    expect(await hoverCursor(page, grab.x, grab.y)).toBe("move");
    const p0 = await panel.boundingBox();
    await dragBy(page, grab, -150, -100);
    await expect
      .poll(async () => {
        const b = await panel.boundingBox();
        return [Math.round(b.x - p0.x), Math.round(b.y - p0.y)];
      })
      .toEqual([-150, -100]);
    await dragBy(page, { x: grab.x - 150, y: grab.y - 100 }, 50, 50, {
      release: false,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    const b = await panel.boundingBox();
    expect([Math.round(b.x - p0.x), Math.round(b.y - p0.y)]).toEqual([
      -150, -100,
    ]);
    await expectIdle(page, sheet);
  });

  test("the Find dialog moves by its frame", async ({ sheet, page }) => {
    await sheet.click(1, 1);
    await page.keyboard.press("Control+f");
    const dialog = page.locator("#fortune-search-replace");
    await expect(dialog).toBeVisible();
    const d0 = await dialog.boundingBox();
    // the frame around the content (not a field)
    const grab = { x: d0.x + d0.width / 2, y: d0.y + 3 };
    expect(await hoverCursor(page, grab.x, grab.y)).toBe("move");
    await dragBy(page, grab, -100, 80);
    await expect
      .poll(async () => {
        const d = await dialog.boundingBox();
        return [Math.round(d.x - d0.x), Math.round(d.y - d0.y)];
      })
      .toEqual([-100, 80]);
    // released: moving the mouse does not move it on
    await page.mouse.move(grab.x + 200, grab.y + 200, { steps: 3 });
    const d1 = await dialog.boundingBox();
    expect(Math.round(d1.x - d0.x)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// Page Break Preview
// ---------------------------------------------------------------------------

test.describe("page break preview", () => {
  test("break lines and print area edges drag to rows; Esc; undo", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({
        celldata: cells({ "0,0": "a", "9,3": "z" }),
        pageSetup: {
          printArea: [{ row: [0, 9], column: [0, 3] }],
          rowBreaks: [4],
        },
      }),
    ]);
    const setup = async () => (await sheetData(page)).pageSetup;
    await (await toolbarButton(page, "Page Layout")).click();
    await page.locator('[data-action="pageBreakPreview"]').click();
    const line = page.locator(".fortune-page-break.manual");
    await expect(line).toHaveCount(1);
    const lb = await line.boundingBox();
    const grab = { x: lb.x + 30, y: lb.y + lb.height / 2 };
    expect(await hoverCursor(page, grab.x, grab.y)).toBe("ns-resize");
    await dragBy(page, grab, 0, 40, { release: false });
    await expect(page.locator(".fortune-page-break-ghost")).toBeVisible();
    await page.mouse.up();
    await expect.poll(async () => (await setup()).rowBreaks).toEqual([6]);
    // Esc while dragging
    const lb2 = await line.boundingBox();
    await dragBy(page, { x: lb2.x + 30, y: lb2.y + lb2.height / 2 }, 0, 40, {
      release: false,
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-page-break-ghost")).toHaveCount(0);
    await page.mouse.up();
    expect((await setup()).rowBreaks).toEqual([6]);
    // the print area's right edge, one column narrower
    const edge = page
      .locator(".fortune-page-area-edge.fortune-page-break-column")
      .nth(1);
    const eb = await edge.boundingBox();
    await dragBy(page, { x: eb.x + eb.width / 2, y: eb.y + 30 }, -74, 0);
    await expect
      .poll(async () => (await setup()).printArea)
      .toEqual([{ row: [0, 9], column: [0, 2] }]);
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await setup()).printArea)
      .toEqual([{ row: [0, 9], column: [0, 3] }]);
    // at 150% a break moves by zoomed rows
    await setZoom(page, 1.5);
    const lb3 = await line.boundingBox();
    await dragBy(page, { x: lb3.x + 30, y: lb3.y + lb3.height / 2 }, 0, 60);
    await expect.poll(async () => (await setup()).rowBreaks).toEqual([8]);
    expect(await ctxValue(page, (ctx) => !!ctx.luckysheet_scroll_status)).toBe(
      false
    );
    // the keyboard is back on the grid
    await expect(sheet.editor).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Outline gutter (buttons: a press dragged off a button does nothing)
// ---------------------------------------------------------------------------

test.describe("outline gutter", () => {
  test("a press dragged off a button does nothing; a click collapses", async ({
    page,
  }) => {
    await page.goto(storyUrl("outline-and-subtotals--frozen-dark"));
    await page.locator(".fortune-cell-area").waitFor();
    // (this story has no test API: the toggle's state tells)
    const toggle = page
      .locator('.fortune-outline-rows .fortune-outline-toggle[data-start="1"]')
      .first();
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute("aria-expanded");
    const t = await center(toggle);
    await dragBy(page, t, 150, 80);
    await expect(toggle).toHaveAttribute("aria-expanded", before);
    // the drag off the gutter did not start a cell selection
    const sel = page.locator(".luckysheet-cell-selected");
    const s0 = await sel.first().boundingBox();
    await page.mouse.move(t.x + 400, t.y + 200, { steps: 3 });
    expect(await sel.first().boundingBox()).toEqual(s0);
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-expanded", before);
    await page.keyboard.press("Control+z");
    await expect(toggle).toHaveAttribute("aria-expanded", before);
  });
});

// ---------------------------------------------------------------------------
// Sheet tabs at a device zoom (see sheetTabs.spec.js for the rest)
// ---------------------------------------------------------------------------

test.describe("sheet tabs at 150% device zoom, overflowing", () => {
  test.use({ deviceScaleFactor: 1.5, viewport: { width: 900, height: 700 } });

  test("drag to the end of an overflowing strip; Esc cancels", async ({
    page,
  }) => {
    const sheets = Array.from({ length: 14 }, (_, i) =>
      blank({
        name: `Sheet${i + 1}`,
        id: `s${i + 1}`,
        order: i,
        status: i === 0 ? 1 : 0,
      })
    );
    const sheet = await openScenario(page, sheets);
    await setZoom(page, 1.5);
    const order = () =>
      page.evaluate(() =>
        [...window.__tinysheet.getAllSheets()]
          .sort((a, b) => a.order - b.order)
          .map((s) => s.name)
      );
    const tab = (name) =>
      page.locator("#fortune-sheettab-container-c .luckysheet-sheets-item", {
        has: page.locator(".luckysheet-sheets-item-name", {
          hasText: new RegExp(`^${name}$`),
        }),
      });
    const t2 = await tab("Sheet2").boundingBox();
    const t3 = await tab("Sheet3").boundingBox();
    const from = { x: t2.x + 12, y: t2.y + t2.height / 2 };
    await dragBy(page, from, t3.x + t3.width - 4 - from.x, 0);
    await expect
      .poll(order)
      .toEqual([
        "Sheet1",
        "Sheet3",
        "Sheet2",
        ...Array.from({ length: 11 }, (_, i) => `Sheet${i + 4}`),
      ]);
    // Esc cancels
    const t1 = await tab("Sheet1").boundingBox();
    await dragBy(page, { x: t1.x + 12, y: t1.y + t1.height / 2 }, 150, 0, {
      release: false,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await order())[0]).toBe("Sheet1");
    await expect(page.locator(".fortune-sheettab-drop-indicator")).toHaveCount(
      0
    );
    expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
    await expect(sheet.area).toBeVisible();
  });
});
