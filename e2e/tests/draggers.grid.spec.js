// Drags on the grid itself, with a real mouse: selecting cells and whole
// rows/columns, the fill handle and moving a selection by its border.
// Each checks the cursor, the live feedback, the result on release, the
// modifiers Excel honours, Esc, undo as one step, zoom, frozen panes, the
// dark theme and that nothing is left stuck afterwards. Excel is the spec.
const { test, expect } = require("../fixtures");
const {
  blank,
  cells,
  openScenario,
  setZoom,
  cellBox,
  cursorAt,
  hoverCursor,
  dragFlags,
  expectIdle,
  ctxValue,
} = require("../dragHelpers");

/** Press the mouse at (r1, c1), move to (r2, c2) (any zoom), keep it down. */
async function pressAndMove(page, from, to, steps = 6) {
  const a = await cellBox(page, ...from);
  const b = await cellBox(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
}

test.describe("cell selection drag", () => {
  test("cell cursor, live feedback, result, no stuck state", async ({
    sheet,
    page,
  }) => {
    const p = sheet.point(4, 4);
    expect(await hoverCursor(page, p.x, p.y)).toBe("cell");
    await pressAndMove(page, [1, 1], [5, 3]);
    // live: the selection follows before the button is released
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [1, 5], column: [1, 3] });
    // back over the anchor's other side
    const up = await cellBox(page, 0, 0);
    await page.mouse.move(up.x, up.y, { steps: 3 });
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 1], column: [0, 1] });
    await page.mouse.up();
    expect(await sheet.selection()).toEqual({ row: [0, 1], column: [0, 1] });
    await expectIdle(page, sheet);
  });

  test("Shift extends and Ctrl adds a range", async ({ sheet, page }) => {
    await sheet.click(2, 2);
    await page.keyboard.down("Shift");
    const b = sheet.point(4, 5);
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up("Shift");
    expect(await sheet.selection()).toEqual({ row: [2, 4], column: [2, 5] });
    await page.keyboard.down("Control");
    await pressAndMove(page, [8, 1], [9, 2]);
    await page.mouse.up();
    await page.keyboard.up("Control");
    const all = await page.evaluate(() =>
      window.__tinysheet
        .getSelection()
        .map((s) => ({ row: s.row, column: s.column }))
    );
    expect(all).toEqual([
      { row: [2, 4], column: [2, 5] },
      { row: [8, 9], column: [1, 2] },
    ]);
    await expectIdle(page, sheet);
  });

  for (const zoom of [0.75, 1.5]) {
    test(`hit-tests the cells at ${zoom * 100}% zoom`, async ({
      sheet,
      page,
    }) => {
      await setZoom(page, zoom);
      await pressAndMove(page, [2, 1], [6, 4]);
      await page.mouse.up();
      expect(await sheet.selection()).toEqual({ row: [2, 6], column: [1, 4] });
      // near a cell's bottom-right corner, still that cell
      const c = await cellBox(page, 3, 2);
      await page.mouse.click(c.right - 2, c.bottom - 2);
      await expect
        .poll(() => sheet.selection())
        .toEqual({ row: [3, 3], column: [2, 2] });
      await expectIdle(page, sheet);
    });
  }

  test("in the dark theme", async ({ page }) => {
    const sheet = await openScenario(page, [blank()], { theme: "dark" });
    const p = sheet.point(3, 3);
    expect(await hoverCursor(page, p.x, p.y)).toBe("cell");
    await sheet.select(1, 1, 4, 2);
    expect(await sheet.selection()).toEqual({ row: [1, 4], column: [1, 2] });
    await expectIdle(page, sheet);
  });

  test("with frozen panes, from the frozen part into the scrolled part", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({
        row: 200,
        frozen: { type: "both", range: { row_focus: 1, column_focus: 1 } },
      }),
    ]);
    await sheet.scroll(0, 400);
    const { y } = await sheet.scrollPosition();
    const firstScrolled = Math.round(y / 20) + 2;
    // A1 (frozen) to the second visible scrolled row
    const a = sheet.point(0, 0);
    const b = sheet.point(3, 3);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    const sel = await sheet.selection();
    expect(sel.column).toEqual([0, 3]);
    expect(sel.row[0]).toBe(0);
    expect(sel.row[1]).toBe(firstScrolled + 1);
    await expectIdle(page, sheet, { keyboard: false });
  });
});

test.describe("header drag selection", () => {
  test("column headers: drag selects whole columns, both ways", async ({
    sheet,
    page,
  }) => {
    const y = sheet.box.y - 10;
    const x = (c) => sheet.box.x + c * 74 + 37;
    await page.mouse.move(x(5), y);
    await page.mouse.down();
    await page.mouse.move(x(7), y, { steps: 4 });
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 99], column: [5, 7] });
    await page.mouse.move(x(2), y, { steps: 4 });
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [0, 99], column: [2, 5] });
    await page.mouse.up();
    // header hover is not a resize cursor away from a border
    expect(await cursorAt(page, x(3), y)).not.toMatch(/resize/);
    await expectIdle(page, sheet);
  });

  test("row headers at 150% zoom, then Undo leaves the selection", async ({
    sheet,
    page,
  }) => {
    await setZoom(page, 1.5);
    const area = await page.locator(".fortune-cell-area").boundingBox();
    const x = area.x - 15;
    const a = await cellBox(page, 3, 0);
    const b = await cellBox(page, 7, 0);
    await page.mouse.move(x, a.y);
    await page.mouse.down();
    await page.mouse.move(x, b.y, { steps: 5 });
    await page.mouse.up();
    expect(await sheet.selection()).toEqual({ row: [3, 7], column: [0, 25] });
    await expectIdle(page, sheet);
  });

  test("dark theme, frozen columns: header drag across the freeze line", async ({
    page,
  }) => {
    const sheet = await openScenario(
      page,
      [
        blank({
          frozen: { type: "column", range: { row_focus: 0, column_focus: 1 } },
        }),
      ],
      { theme: "dark" }
    );
    const y = sheet.box.y - 10;
    await page.mouse.move(sheet.box.x + 37, y);
    await page.mouse.down();
    await page.mouse.move(sheet.box.x + 4 * 74 + 37, y, { steps: 5 });
    await page.mouse.up();
    expect(await sheet.selection()).toEqual({ row: [0, 99], column: [0, 4] });
    await expectIdle(page, sheet);
  });
});

/** The fill handle of the selection. */
const fillHandle = (page) => page.locator(".luckysheet-cs-fillhandle");

async function dragFillHandle(
  page,
  to,
  { modifiers = [], release = true } = {}
) {
  const h = await fillHandle(page).boundingBox();
  const b = await cellBox(page, ...to);
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  if (release) {
    await page.mouse.up();
    for (const m of modifiers) await page.keyboard.up(m);
  }
}

test.describe("fill handle", () => {
  test("crosshair, live dashed range, fills a series down; undo in one step", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "1,1": 1, "2,1": 2 }) }),
    ]);
    await sheet.select(1, 1, 2, 1);
    const h = await fillHandle(page).boundingBox();
    expect(await hoverCursor(page, h.x + h.width / 2, h.y + h.height / 2)).toBe(
      "crosshair"
    );
    // a click on the handle fills nothing
    await page.mouse.down();
    await page.mouse.up();
    expect(await sheet.column(1, 1, 4)).toEqual([1, 2, null, null]);
    await dragFillHandle(page, [5, 1], { release: false });
    const extend = page.locator(".fortune-cell-selected-extend");
    await expect(extend).toBeVisible();
    const box = await extend.boundingBox();
    const bottom = await cellBox(page, 5, 1);
    expect(Math.abs(box.y + box.height - bottom.bottom)).toBeLessThan(4);
    await page.mouse.up();
    await expect(extend).toBeHidden();
    expect(await sheet.column(1, 1, 6)).toEqual([1, 2, 3, 4, 5, null]);
    expect(await sheet.selection()).toEqual({ row: [1, 5], column: [1, 1] });
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => sheet.column(1, 1, 6))
      .toEqual([1, 2, null, null, null, null]);
    await expectIdle(page, sheet);
  });

  test("one number copies; Ctrl makes it a series; up, right and left", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "5,5": 7 }) }),
    ]);
    await sheet.click(5, 5);
    await dragFillHandle(page, [8, 5]);
    expect(await sheet.column(5, 5, 8)).toEqual([7, 7, 7, 7]);
    await page.keyboard.press("Control+z");
    await sheet.click(5, 5);
    await dragFillHandle(page, [8, 5], { modifiers: ["Control"] });
    expect(await sheet.column(5, 5, 8)).toEqual([7, 8, 9, 10]);
    // up (series with Ctrl goes backwards)
    await sheet.click(5, 5);
    await dragFillHandle(page, [3, 5], { modifiers: ["Control"] });
    expect(await sheet.column(5, 3, 5)).toEqual([5, 6, 7]);
    // right and left, on row 5
    await sheet.click(5, 5);
    await dragFillHandle(page, [5, 7]);
    expect(await sheet.value(5, 7)).toBe(7);
    await sheet.click(5, 5);
    await dragFillHandle(page, [5, 3]);
    expect(await sheet.value(5, 3)).toBe(7);
    expect(await sheet.value(5, 4)).toBe(7);
    await expectIdle(page, sheet);
  });

  test("Esc while dragging cancels the fill", async ({ page }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "1,1": 1, "2,1": 2 }) }),
    ]);
    await sheet.select(1, 1, 2, 1);
    await dragFillHandle(page, [6, 1], { release: false });
    await page.keyboard.press("Escape");
    await expect(page.locator(".fortune-cell-selected-extend")).toBeHidden();
    await page.mouse.up();
    expect(await sheet.column(1, 1, 6)).toEqual([1, 2, null, null, null, null]);
    expect(await sheet.selection()).toEqual({ row: [1, 2], column: [1, 1] });
    await expectIdle(page, sheet);
  });

  test("double-click fills down as far as the data next to it", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({
        celldata: cells({
          "0,0": 1,
          "1,0": 2,
          "2,0": 3,
          "3,0": 4,
          "4,0": 5,
        }),
      }),
    ]);
    await sheet.enter(0, 1, "=A1*2");
    await sheet.click(0, 1);
    const h = await fillHandle(page).boundingBox();
    await page.mouse.dblclick(h.x + h.width / 2, h.y + h.height / 2);
    await expect
      .poll(() => sheet.column(1, 0, 5))
      .toEqual([2, 4, 6, 8, 10, null]);
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => sheet.column(1, 0, 5))
      .toEqual([2, null, null, null, null, null]);
    await expectIdle(page, sheet);
  });

  for (const zoom of [0.75, 1.5]) {
    test(`at ${zoom * 100}% zoom the fill ends at the cell released on`, async ({
      page,
    }) => {
      const sheet = await openScenario(page, [
        blank({ celldata: cells({ "1,2": "Mon" }) }),
      ]);
      await setZoom(page, zoom);
      const c = await cellBox(page, 1, 2);
      await page.mouse.click(c.x, c.y);
      await expect
        .poll(() => sheet.selection())
        .toEqual({ row: [1, 1], column: [2, 2] });
      await dragFillHandle(page, [4, 2]);
      expect(await sheet.column(2, 1, 5)).toEqual([
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        null,
      ]);
      await expectIdle(page, sheet);
    });
  }

  test("with frozen rows and in the dark theme", async ({ page }) => {
    const sheet = await openScenario(
      page,
      [
        blank({
          celldata: cells({ "0,1": 10 }),
          frozen: { type: "row", range: { row_focus: 1, column_focus: 0 } },
        }),
      ],
      { theme: "dark" }
    );
    await sheet.click(0, 1);
    // from the frozen row down into the scrolling rows
    await dragFillHandle(page, [4, 1], { modifiers: ["Control"] });
    expect(await sheet.column(1, 0, 4)).toEqual([10, 11, 12, 13, 14]);
    await expectIdle(page, sheet);
  });
});

/** Grab the selection's border (top edge, middle) and drag to cell `to`. */
async function dragBorder(
  page,
  to,
  { modifiers = [], release = true, dy = 0 } = {}
) {
  const sel = await page.locator(".luckysheet-cell-selected").boundingBox();
  const b = await cellBox(page, ...to);
  await page.mouse.move(sel.x + sel.width / 2, sel.y + 3);
  await page.mouse.down();
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(b.x, b.y + dy, { steps: 8 });
  if (release) {
    await page.mouse.up();
    for (const m of modifiers) await page.keyboard.up(m);
  }
}

test.describe("moving a selection by its border", () => {
  test("move cursor, live outline, moves; undo in one step", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "1,1": "a", "2,1": "b", "0,5": "=B2" }) }),
    ]);
    await sheet.select(1, 1, 2, 1);
    const sel = await page.locator(".luckysheet-cell-selected").boundingBox();
    expect(await hoverCursor(page, sel.x + sel.width / 2, sel.y + 1)).toBe(
      "move"
    );
    expect(await hoverCursor(page, sel.x + 1, sel.y + sel.height / 2)).toBe(
      "move"
    );
    // a click on the border moves nothing
    await page.mouse.down();
    await page.mouse.up();
    expect(await sheet.value(1, 1)).toBe("a");
    await sheet.select(1, 1, 2, 1);
    await dragBorder(page, [6, 3], { release: false });
    const ghost = page.locator("#fortune-cell-selected-move");
    await expect(ghost).toBeVisible();
    const g = await ghost.boundingBox();
    const target = await cellBox(page, 6, 3);
    expect(Math.abs(g.x - target.left)).toBeLessThan(4);
    await page.mouse.up();
    await expect(ghost).toBeHidden();
    expect(await sheet.column(3, 6, 7)).toEqual(["a", "b"]);
    expect(await sheet.column(1, 1, 2)).toEqual([null, null]);
    // references follow the moved cells
    expect(await sheet.formula(0, 5)).toBe("=D7");
    expect(await sheet.selection()).toEqual({ row: [6, 7], column: [3, 3] });
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.column(1, 1, 2)).toEqual(["a", "b"]);
    expect(await sheet.column(3, 6, 7)).toEqual([null, null]);
    expect(await sheet.formula(0, 5)).toBe("=B2");
    await expectIdle(page, sheet);
  });

  test("Ctrl copies instead of moving", async ({ page }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "1,1": "a", "2,1": "b" }) }),
    ]);
    await sheet.select(1, 1, 2, 1);
    await dragBorder(page, [1, 4], { modifiers: ["Control"] });
    expect(await sheet.column(4, 1, 2)).toEqual(["a", "b"]);
    expect(await sheet.column(1, 1, 2)).toEqual(["a", "b"]);
    expect(await sheet.selection()).toEqual({ row: [1, 2], column: [4, 4] });
    await page.keyboard.press("Control+z");
    await expect.poll(() => sheet.column(4, 1, 2)).toEqual([null, null]);
    expect(await sheet.column(1, 1, 2)).toEqual(["a", "b"]);
    await expectIdle(page, sheet);
  });

  test("Shift inserts the cells, shifting the others", async ({ page }) => {
    const sheet = await openScenario(page, [
      blank({
        celldata: cells({ "1,1": "x", "4,1": "p", "5,1": "q" }),
      }),
    ]);
    await sheet.click(1, 1);
    // drop between p and q (on q's top border): x goes there, q moves down
    await dragBorder(page, [5, 1], { modifiers: ["Shift"], dy: -7 });
    expect(await sheet.column(1, 1, 6)).toEqual([
      null,
      null,
      "p",
      "x",
      "q",
      null,
    ]);
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => sheet.column(1, 1, 6))
      .toEqual(["x", null, null, "p", "q", null]);
    await expectIdle(page, sheet);
  });

  test("Esc while dragging cancels the move", async ({ page }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "1,1": "a" }) }),
    ]);
    await sheet.click(1, 1);
    await dragBorder(page, [5, 5], { release: false });
    await page.keyboard.press("Escape");
    await expect(page.locator("#fortune-cell-selected-move")).toBeHidden();
    await page.mouse.up();
    expect(await sheet.value(1, 1)).toBe("a");
    expect(await sheet.value(5, 5)).toBeNull();
    await expectIdle(page, sheet);
  });

  for (const zoom of [0.75, 1.5]) {
    test(`at ${zoom * 100}% zoom it drops on the cell under the pointer`, async ({
      page,
    }) => {
      const sheet = await openScenario(page, [
        blank({ celldata: cells({ "1,1": "z" }) }),
      ]);
      await setZoom(page, zoom);
      const c = await cellBox(page, 1, 1);
      await page.mouse.click(c.x, c.y);
      await expect
        .poll(() => sheet.selection())
        .toEqual({ row: [1, 1], column: [1, 1] });
      await dragBorder(page, [4, 3]);
      expect(await sheet.value(4, 3)).toBe("z");
      expect(await sheet.value(1, 1)).toBeNull();
      await expectIdle(page, sheet);
    });
  }

  test("frozen panes, dark theme: from the frozen row into the grid", async ({
    page,
  }) => {
    const sheet = await openScenario(
      page,
      [
        blank({
          celldata: cells({ "0,2": "h" }),
          frozen: { type: "row", range: { row_focus: 1, column_focus: 0 } },
        }),
      ],
      { theme: "dark" }
    );
    await sheet.click(0, 2);
    await dragBorder(page, [5, 2]);
    expect(await sheet.value(5, 2)).toBe("h");
    expect(await sheet.value(0, 2)).toBeNull();
    expect(await dragFlags(page)).toMatchObject({ move: false });
    await expectIdle(page, sheet);
  });
});

test("the drag state never survives a release outside the window", async ({
  sheet,
  page,
}) => {
  // released over the ribbon (outside the grid): the selection drag ends
  const a = sheet.point(2, 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 100, 20, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => ctxValue(page, (ctx) => !!ctx.luckysheet_select_status))
    .toBe(false);
  const sel = await sheet.selection();
  await page.mouse.move(a.x + 300, a.y + 200, { steps: 4 });
  expect(await sheet.selection()).toEqual(sel);
});

test.describe("at a device pixel ratio of 1.5", () => {
  test.use({ deviceScaleFactor: 1.5 });

  test("selection, fill handle and border move hit the right cells", async ({
    page,
  }) => {
    const sheet = await openScenario(page, [
      blank({ celldata: cells({ "1,1": 5 }) }),
    ]);
    await pressAndMove(page, [2, 2], [5, 4]);
    await page.mouse.up();
    expect(await sheet.selection()).toEqual({ row: [2, 5], column: [2, 4] });
    await sheet.click(1, 1);
    await dragFillHandle(page, [3, 1], { modifiers: ["Control"] });
    expect(await sheet.column(1, 1, 3)).toEqual([5, 6, 7]);
    await sheet.click(1, 1);
    await dragBorder(page, [8, 5]);
    expect(await sheet.value(8, 5)).toBe(5);
    await expectIdle(page, sheet);
  });
});
