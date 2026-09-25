// Dragging a formula reference's colour box while editing, with a real
// mouse (see also formulaPointMode.spec.js): cursors, move and resize at
// 75% / 150% zoom, with frozen panes, in the dark theme, in the cell and in
// the formula bar, and that the editor keeps the focus throughout.
const { test, expect } = require("../fixtures");
const {
  blank,
  openScenario,
  setZoom,
  cellBox,
  hoverCursor,
  dragFlags,
  IDLE,
} = require("../dragHelpers");

const fxBar = (page) => page.locator("#luckysheet-functionbox-cell");
const refBox = (page, i = 0) =>
  page.locator(".fortune-formula-functionrange-highlight").nth(i);
const activeId = (page) => page.evaluate(() => document.activeElement?.id);

/** Drag from the centre of `handle` to the centre of cell (r, c). */
async function dragHandleTo(page, handle, r, c, { release = true } = {}) {
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  const p = await cellBox(page, r, c);
  await page.mouse.move(p.x, p.y, { steps: 6 });
  if (release) await page.mouse.up();
}

/** Start editing (r, c) by clicking it (any zoom) and typing `text`. */
async function editAt(page, sheet, r, c, text) {
  const p = await cellBox(page, r, c);
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() => sheet.selection())
    .toEqual({ row: [r, r], column: [c, c] });
  await page.keyboard.type(text);
}

test.describe("reference box drag", () => {
  test("cursors: move on the border, diagonal on the corners", async ({
    sheet,
    page,
  }) => {
    await editAt(page, sheet, 6, 4, "=SUM(B2:C4)");
    const box = refBox(page);
    await expect(box).toBeVisible();
    const top = await box.locator(".fortune-selection-copy-top").boundingBox();
    expect(
      await hoverCursor(page, top.x + top.width / 2, top.y + top.height / 2)
    ).toBe("move");
    const expected = {
      lt: /nwse-resize|nw-resize/,
      rb: /nwse-resize|se-resize/,
      rt: /nesw-resize|ne-resize/,
      lb: /nesw-resize|sw-resize/,
    };
    for (const [corner, cursor] of Object.entries(expected)) {
      const c = await box
        .locator(`.fortune-selection-highlight-${corner}`)
        .boundingBox();
      expect(
        await hoverCursor(page, c.x + c.width / 2, c.y + c.height / 2)
      ).toMatch(cursor);
    }
    await page.keyboard.press("Escape");
  });

  for (const zoom of [0.75, 1.5]) {
    test(`move and resize at ${zoom * 100}% zoom, keeping the focus`, async ({
      sheet,
      page,
    }) => {
      await setZoom(page, zoom);
      await editAt(page, sheet, 7, 5, "=A1+1");
      await dragHandleTo(
        page,
        refBox(page).locator(".fortune-selection-copy-left"),
        2,
        1
      );
      await expect(sheet.editor).toHaveText("=B3+1");
      expect(await activeId(page)).toBe("luckysheet-rich-text-editor");
      await dragHandleTo(
        page,
        refBox(page).locator(".fortune-selection-highlight-rb"),
        4,
        3
      );
      await expect(sheet.editor).toHaveText("=B3:D5+1");
      expect(await activeId(page)).toBe("luckysheet-rich-text-editor");
      expect(await dragFlags(page)).toEqual(IDLE);
      // typing goes on in the editor
      await page.keyboard.press("End");
      await page.keyboard.type("0");
      await expect(sheet.editor).toHaveText("=B3:D5+10");
      await page.keyboard.press("Escape");
    });
  }

  test("live: the formula follows before the release", async ({
    sheet,
    page,
  }) => {
    await editAt(page, sheet, 5, 5, "=A1");
    await dragHandleTo(
      page,
      refBox(page).locator(".fortune-selection-highlight-rb"),
      2,
      2,
      { release: false }
    );
    await expect(sheet.editor).toHaveText("=A1:C3");
    await expect(fxBar(page)).toHaveText("=A1:C3");
    const p = await cellBox(page, 3, 1);
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await expect(sheet.editor).toHaveText("=A1:B4");
    await page.mouse.up();
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(5, 5)).toBe("=A1:B4");
  });

  test("frozen panes, dark theme: from the frozen rows into the grid", async ({
    page,
  }) => {
    const sheet = await openScenario(
      page,
      [
        blank({
          frozen: { type: "row", range: { row_focus: 1, column_focus: 0 } },
        }),
      ],
      { theme: "dark" }
    );
    await editAt(page, sheet, 8, 4, "=B1");
    await dragHandleTo(
      page,
      refBox(page).locator(".fortune-selection-copy-bottom"),
      5,
      2
    );
    await expect(sheet.editor).toHaveText("=C6");
    expect(await activeId(page)).toBe("luckysheet-rich-text-editor");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(8, 4)).toBe("=C6");
  });

  test("from the formula bar at 150% zoom, the bar keeps the focus", async ({
    sheet,
    page,
  }) => {
    await setZoom(page, 1.5);
    const p = await cellBox(page, 6, 4);
    await page.mouse.click(p.x, p.y);
    await fxBar(page).click();
    await page.keyboard.type("=B2*3");
    await dragHandleTo(
      page,
      refBox(page).locator(".fortune-selection-copy-top"),
      3,
      3
    );
    await expect(fxBar(page)).toHaveText("=D4*3");
    expect(await activeId(page)).toBe("luckysheet-functionbox-cell");
    await dragHandleTo(
      page,
      refBox(page).locator(".fortune-selection-highlight-lt"),
      1,
      1
    );
    await expect(fxBar(page)).toHaveText("=B2:D4*3");
    expect(await activeId(page)).toBe("luckysheet-functionbox-cell");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(6, 4)).toBe("=B2:D4*3");
    expect(await dragFlags(page)).toEqual(IDLE);
  });
});
