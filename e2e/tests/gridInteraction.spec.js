// Mouse and keyboard on the grid outside formula editing: drags that
// auto-scroll past the edge, header hit-testing and resizing, wheel and
// zoom, paging, and where keyboard focus goes. Excel is the reference.
const { test, expect, Sheet } = require("../fixtures");

const blank = (extra = {}) => ({
  name: "Sheet1",
  id: "sheet1",
  order: 0,
  status: 1,
  row: 100,
  column: 26,
  celldata: [],
  ...extra,
});

/** Open the scenario story with the given sheets. */
async function openScenario(page, data) {
  await page.addInitScript((d) => {
    window.__e2eScenario = { data: d };
  }, data);
  const sheet = new Sheet(page);
  await sheet.open("e2e-harness--scenario");
  await page.waitForFunction(() => window.__tinysheet);
  return sheet;
}

/** The sheet's own scroll offsets (what it draws and hit-tests with). */
function contextScroll(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        window.__tinysheet.setContext((ctx) => {
          resolve({ x: ctx.scrollLeft, y: ctx.scrollTop, zoom: ctx.zoomRatio });
        });
      })
  );
}

async function sheetConfig(page) {
  return page.evaluate(() => window.__tinysheet.getSheet().config ?? {});
}

test.describe("drag auto-scroll", () => {
  test("selecting past each edge keeps scrolling while the pointer rests", async ({
    sheet,
    page,
  }) => {
    const { box } = sheet;
    const start = sheet.point(2, 2);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // below the grid, then still: the sheet keeps scrolling
    await page.mouse.move(start.x, box.y + box.height + 30, { steps: 4 });
    await expect
      .poll(async () => (await sheet.scrollPosition()).y)
      .toBeGreaterThan(300);
    // the selection follows to the last visible row, not beyond it
    const down = await sheet.selection();
    expect(down.row[0]).toBe(2);
    const { y } = await sheet.scrollPosition();
    expect(down.row[1]).toBeLessThanOrEqual(Math.ceil((y + box.height) / 20));
    expect(down.row[1]).toBeGreaterThan(40);
    // right of the grid
    await page.mouse.move(box.x + box.width + 30, start.y, { steps: 4 });
    await expect
      .poll(async () => (await sheet.scrollPosition()).x)
      .toBeGreaterThan(200);
    // above and left of the grid (over the headers): back to A1
    await page.mouse.move(box.x - 25, box.y - 15, { steps: 4 });
    await expect.poll(() => sheet.scrollPosition()).toEqual({ x: 0, y: 0 });
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 2], column: [0, 2] });
    await page.mouse.up();
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 2], column: [0, 2] });
  });

  test("with frozen panes, dragging back into them scrolls back first", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({
        row: 200,
        frozen: { type: "both", range: { row_focus: 1, column_focus: 1 } },
      }),
    ]);
    const { box } = sheet;
    const start = sheet.point(4, 2);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, box.y + box.height + 20, { steps: 4 });
    await expect
      .poll(async () => (await sheet.scrollPosition()).y)
      .toBeGreaterThan(200);
    // into the frozen rows: no jump, the scrolling pane scrolls back...
    await page.mouse.move(start.x, box.y + 25, { steps: 4 });
    const midway = await sheet.selection();
    expect(midway.row[0]).toBe(4);
    // ...until it is at its start; then the frozen row joins the selection
    await expect.poll(async () => (await sheet.scrollPosition()).y).toBe(0);
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 4], column: [2, 2] });
    await page.mouse.up();
  });

  test("dragging over the row headers selects whole rows and auto-scrolls", async ({
    sheet,
    page,
  }) => {
    const { box } = sheet;
    const x = box.x - 20;
    // twice: a text selection left by the first drag must not turn the
    // second into a native drag-and-drop
    for (let i = 0; i < 2; i += 1) {
      await page.mouse.move(x, box.y + 20 * 6 + 10);
      await page.mouse.down();
      await page.mouse.move(x, box.y + 20 * 2 + 10, { steps: 4 });
      await page.mouse.up();
      await expect
        .poll(() => sheet.selection())
        .toEqual({ row: [2, 6], column: [0, 25] });
    }
    await page.mouse.move(x, box.y + 20 * 30 + 10);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height + 40, { steps: 4 });
    await expect.poll(async () => (await sheet.selection()).row[1]).toBe(99);
    await page.mouse.up();
    const sel = await sheet.selection();
    expect(sel).toEqual({ row: [30, 99], column: [0, 25] });
    expect((await sheet.scrollPosition()).x).toBe(0);
  });

  test("the fill handle auto-scrolls and fills up to where it is released", async ({
    sheet,
    page,
  }) => {
    const { box } = sheet;
    await sheet.enter(5, 1, "1");
    await sheet.click(5, 1);
    const handle = await page
      .locator(".luckysheet-cs-fillhandle")
      .boundingBox();
    await page.mouse.move(handle.x + 4, handle.y + 4);
    await page.mouse.down();
    await page.mouse.move(handle.x + 4, box.y + box.height + 20, {
      steps: 4,
    });
    await expect
      .poll(async () => (await sheet.scrollPosition()).y)
      .toBeGreaterThan(200);
    await page.mouse.up();
    // released below the grid: filled to the last visible row
    const { y } = await sheet.scrollPosition();
    // the row at the grid's bottom edge (a row ends at its bottom edge)
    const last = Math.min(99, Math.ceil((y + box.height - 1) / 20) - 1);
    await expect
      .poll(async () => (await sheet.selection()).row)
      .toEqual([5, last]);
    expect(await sheet.value(last, 1)).toBe(1);
    expect(await sheet.value(last + 1, 1)).toBeNull();
  });

  test("moving cells near the bottom/right edge drops them there", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(1, 1, "mv");
    let from = [1, 1];
    // dropped with the pointer in the right part of the last whole column
    for (const [r, c, dx] of [
      [35, 1, 0],
      [5, 20, 30],
    ]) {
      await sheet.click(from[0], from[1]);
      const border = await page
        .locator(".luckysheet-cell-selected")
        .boundingBox();
      await page.mouse.move(border.x + border.width / 2, border.y + 1);
      await page.mouse.down();
      const target = sheet.point(r, c);
      await page.mouse.move(target.x + dx, target.y - 8, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(() => sheet.selection())
        .toEqual({ row: [r, r], column: [c, c] });
      expect(await sheet.value(r, c)).toBe("mv");
      expect(await sheet.value(from[0], from[1])).toBeNull();
      from = [r, c];
    }
  });
});

test.describe("headers", () => {
  test("a border can be dragged from either side and a click leaves it", async ({
    sheet,
    page,
  }) => {
    const { box } = sheet;
    // row 2's bottom border, grabbed just below it (in row 3)
    const x = box.x - 20;
    const border = box.y + 40;
    await page.mouse.move(x, border + 8);
    await page.mouse.move(x, border + 1, { steps: 2 });
    await expect(page.locator(".fortune-rows-change-size")).toBeVisible();
    await page.mouse.down();
    await page.mouse.move(x, border + 31, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(async () => (await sheetConfig(page)).rowlen)
      .toEqual({ 1: 49 });
    // column B's right border, grabbed just left of it; a click changes
    // nothing, a drag resizes by the distance dragged
    const y = box.y - 10;
    const colBorder = box.x + 148;
    await page.mouse.move(colBorder - 10, y);
    await page.mouse.move(colBorder - 1, y, { steps: 2 });
    await page.mouse.down();
    await page.mouse.up();
    expect((await sheetConfig(page)).columnlen ?? {}).toEqual({});
    await page.mouse.down();
    await page.mouse.move(colBorder + 39, y, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(async () => (await sheetConfig(page)).columnlen)
      .toEqual({ 1: 113 });
    // the selection was left alone
    expect(await sheet.selection()).toEqual({ row: [0, 0], column: [0, 0] });
  });

  test("resizing at 200% zoom sets the unzoomed size", async ({
    sheet: _sheet,
    page,
  }) => {
    await page.evaluate(() =>
      window.__tinysheet.setContext((ctx) => {
        ctx.zoomRatio = 2;
        ctx.luckysheetfile[0].zoomRatio = 2;
      })
    );
    await expect.poll(async () => (await contextScroll(page)).zoom).toBe(2);
    const area = await page.locator(".fortune-cell-area").boundingBox();
    // column A is (73 + 1) * 2 = 148px wide; drag its border 40px right
    const x = area.x + 148;
    const y = area.y - 10;
    await page.mouse.move(x - 10, y);
    await page.mouse.move(x, y, { steps: 2 });
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(async () => (await sheetConfig(page)).columnlen)
      .toEqual({ 0: 93 });
  });
});

test.describe("wheel and zoom", () => {
  test("the wheel scrolls by its delta, Shift+wheel sideways, never the page", async ({
    page,
  }) => {
    // the grid lower on a taller page: the page must not scroll either
    await page.setViewportSize({ width: 1200, height: 700 });
    const sheet = new Sheet(page);
    await sheet.open();
    const p = sheet.point(5, 5);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => sheet.scrollPosition()).toEqual({ x: 0, y: 100 });
    // a trackpad: many small deltas scroll smoothly, pixel by pixel
    for (let i = 0; i < 10; i += 1) await page.mouse.wheel(0, 3);
    await expect.poll(() => sheet.scrollPosition()).toEqual({ x: 0, y: 130 });
    // (a gesture sticks to its axis for a moment)
    await page.waitForTimeout(100);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 100);
    await page.keyboard.up("Shift");
    await expect.poll(() => sheet.scrollPosition()).toEqual({ x: 100, y: 130 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // the click lands on the cell drawn there
    await page.mouse.click(sheet.box.x + 37, sheet.box.y + 5);
    await sheet.waitForSelection(6, 1);
  });

  test("Ctrl+wheel zooms and keeps the top-left cell", async ({
    sheet,
    page,
  }) => {
    await page.evaluate(() => {
      document.querySelector(".luckysheet-scrollbar-y").scrollTop = 600;
    });
    await expect.poll(async () => (await contextScroll(page)).y).toBe(600);
    const p = sheet.point(5, 5);
    await page.mouse.move(p.x, p.y);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await contextScroll(page)).zoom).toBe(1.1);
    // row 31 (index 30) is still the top row
    const area = await page.locator(".fortune-cell-area").boundingBox();
    await page.mouse.click(area.x + 5, area.y + 3);
    await sheet.waitForSelection(30, 0);
    // the zoom buttons too
    await page.getByRole("button", { name: /zoom out/i }).click();
    await page.getByRole("button", { name: /zoom out/i }).click();
    await expect.poll(async () => (await contextScroll(page)).zoom).toBe(0.9);
    const area2 = await page.locator(".fortune-cell-area").boundingBox();
    await page.mouse.click(area2.x + 5, area2.y + 3);
    await sheet.waitForSelection(30, 0);
  });
});

test.describe("keyboard", () => {
  test("arrow keys move from the initial A1 selection", async ({
    sheet,
    page,
  }) => {
    // A1 is selected as a one-cell range
    expect(await sheet.selection()).toEqual({ row: [0, 0], column: [0, 0] });
    // keyboard focus on the grid without clicking a cell
    await sheet.editor.focus();
    await page.keyboard.press("ArrowDown");
    await sheet.waitForSelection(1, 0);
    await page.keyboard.press("Shift+ArrowRight");
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 1], column: [0, 1] });
  });

  test("PageDown/PageUp page by whole rows and stop at the sheet's end", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.press("PageDown");
    // 37 rows fit the window: the active cell moves as far as the view
    await sheet.waitForSelection(37, 0);
    await expect.poll(() => sheet.scrollPosition()).toEqual({ x: 0, y: 740 });
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("PageDown");
    await sheet.waitForSelection(99, 0);
    // the sheet stops where its scrollbar does: what is drawn at the top
    // left is what a click there hits
    const { y } = await sheet.scrollPosition();
    await expect.poll(async () => (await contextScroll(page)).y).toBe(y);
    await sheet.click(0, 0, { wait: false });
    await sheet.waitForSelection(Math.floor(y / 20), 0);
    await page.keyboard.press("PageUp");
    const top = Math.floor(y / 20);
    await expect.poll(async () => (await contextScroll(page)).y % 20).toBe(0);
    await sheet.waitForSelection(top - 37, 0);
  });

  test("moving up past the top row scrolls it to the top edge", async ({
    sheet,
    page,
  }) => {
    await page.evaluate(() => {
      document.querySelector(".luckysheet-scrollbar-y").scrollTop = 200;
    });
    await expect.poll(async () => (await contextScroll(page)).y).toBe(200);
    await sheet.click(0, 0, { wait: false });
    await sheet.waitForSelection(10, 0);
    await page.keyboard.press("ArrowUp");
    await sheet.waitForSelection(9, 0);
    await expect.poll(async () => (await contextScroll(page)).y).toBe(180);
  });

  test("after Select All the keyboard goes to the grid", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "x");
    await sheet.click(0, 0);
    await sheet.copy();
    await page.locator(".fortune-left-top").click();
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 99], column: [0, 25] });
    await page.keyboard.press("Control+v");
    await expect.poll(() => sheet.value(7, 5)).toBe("x");
  });
});

test.describe("editing in place", () => {
  test("a frozen cell edited while scrolled keeps its selection and editor on it", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({
        frozen: { type: "both", range: { row_focus: 0, column_focus: 0 } },
      }),
    ]);
    const { box } = sheet;
    await page.evaluate(() => {
      document.querySelector(".luckysheet-scrollbar-y").scrollTop = 200;
      document.querySelector(".luckysheet-scrollbar-x").scrollLeft = 148;
    });
    await expect
      .poll(() => contextScroll(page))
      .toEqual({ x: 148, y: 200, zoom: 1 });
    const offset = async (selector) => {
      const b = await page.locator(selector).first().boundingBox();
      return { x: Math.round(b.x - box.x), y: Math.round(b.y - box.y) };
    };
    // A1, frozen at the top-left
    await page.mouse.click(box.x + 5, box.y + 5);
    await sheet.waitForSelection(0, 0);
    await expect
      .poll(() => offset(".luckysheet-cell-selected"))
      .toEqual({ x: -2, y: -2 });
    await page.keyboard.type("abc");
    await expect(sheet.editor).toBeVisible();
    expect(await offset(".luckysheet-input-box")).toEqual({ x: 0, y: 0 });
    // cancelling does not scroll the sheet (the cell is in view anyway)
    await page.keyboard.press("Escape");
    expect(await contextScroll(page)).toEqual({ x: 148, y: 200, zoom: 1 });
    // the scrolling pane still hit-tests with the scroll
    await page.mouse.click(box.x + 5, box.y + 45);
    await sheet.waitForSelection(12, 0);
  });

  test("with several ranges selected, F2 edits the active cell", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(1, 1, "b2");
    await sheet.enter(4, 3, "d5");
    await sheet.click(1, 1);
    await page.keyboard.down("Control");
    await sheet.click(4, 3, { wait: false });
    await page.keyboard.up("Control");
    await expect
      .poll(() => page.evaluate(() => window.__tinysheet.getSelection().length))
      .toBe(2);
    // the click hands the keyboard to the cell editor (after a tick)
    await expect(sheet.editor).toBeFocused();
    await page.waitForTimeout(100);
    await page.keyboard.press("F2");
    await expect(sheet.editor).toHaveText("d5");
    const editor = await page.locator(".luckysheet-input-box").boundingBox();
    expect(Math.round(editor.x - sheet.box.x)).toBe(3 * 74);
    expect(Math.round(editor.y - sheet.box.y)).toBe(4 * 20);
    await page.keyboard.type("q");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(4, 3)).toBe("d5q");
    expect(await sheet.value(1, 1)).toBe("b2");
  });
});
