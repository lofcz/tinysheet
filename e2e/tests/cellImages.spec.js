const { test, expect } = require("../fixtures");

// Pictures in cells (R1): IMAGE() draws in the cell, pictures placed from
// the cell menu, the clipboard, Place over Cells / Place in Cell, the hover
// tooltip and the formula bar chip.

const svg = (color) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${color}"/></svg>`
  ).toString("base64")}`;
const RED = svg("#ff0000");
const BLUE = svg("#0000ff");

/** Canvas pixel [r, g, b] at the centre of grid cell (r, c). */
async function pixel(sheet, page, r, c) {
  const { x, y } = sheet.point(r, c);
  return page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector(".fortune-sheet-canvas");
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const d = canvas
        .getContext("2d")
        .getImageData(
          Math.round((px - rect.left) * sx),
          Math.round((py - rect.top) * sy),
          1,
          1
        ).data;
      return [d[0], d[1], d[2]];
    },
    [x, y]
  );
}

const cellImg = (page, r, c) =>
  page.evaluate(
    ([row, col]) =>
      window.__tinysheet.getSheet().data?.[row]?.[col]?.img ?? null,
    [r, c]
  );

async function openMenu(sheet, page, r, c) {
  const { x, y } = sheet.point(r, c);
  await page.mouse.click(x, y, { button: "right" });
  const menu = page.locator(".fortune-cell-menu");
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("pictures in cells", () => {
  test("IMAGE() draws the picture in its cell, alt text on hover", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(1, 1, `=IMAGE("${RED}","Red square",1)`);
    await expect
      .poll(() => cellImg(page, 1, 1))
      .toEqual({ src: RED, alt: "Red square", sizing: 1 });
    await expect.poll(() => pixel(sheet, page, 1, 1)).toEqual([255, 0, 0]);
    // text functions see the alt text
    await sheet.enter(1, 2, "=LEN(B2)");
    await expect.poll(() => sheet.value(1, 2)).toBe(10);

    const { x, y } = sheet.point(1, 1);
    await page.mouse.move(x, y);
    await expect(page.locator(".fortune-cell-image-tooltip")).toHaveText(
      "Red square"
    );
    await page.mouse.move(x + 200, y);
    await expect(page.locator(".fortune-cell-image-tooltip")).toHaveCount(0);

    // the formula bar shows the formula, not a chip
    await sheet.click(1, 1);
    await expect(page.locator("#luckysheet-functionbox-cell")).toContainText(
      "=IMAGE("
    );
    await expect(page.locator(".fortune-fx-picture-chip")).toHaveCount(0);
  });

  test("Place Picture in Cell…, alt text, Place over Cells and back", async ({
    sheet,
    page,
  }) => {
    let menu = await openMenu(sheet, page, 2, 1);
    await menu.locator('[data-key="picture-in-cell"]').click();
    await page
      .getByLabel("Picture address (https:// or data:image)")
      .fill(BLUE);
    await page.getByLabel("Alt Text").fill("Blue square");
    await page.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(() => cellImg(page, 2, 1))
      .toEqual({ src: BLUE, alt: "Blue square" });
    await expect.poll(() => pixel(sheet, page, 2, 1)).toEqual([0, 0, 255]);
    await expect(page.locator(".fortune-fx-picture-chip")).toHaveText(
      "Blue square"
    );

    menu = await openMenu(sheet, page, 2, 1);
    await menu.locator('[data-key="picture-alt-text"]').click();
    const alt = page.getByLabel(
      "Describe this picture for people who can't see it"
    );
    await alt.fill("A blue square");
    await alt.press("Enter");
    await expect
      .poll(() => cellImg(page, 2, 1))
      .toEqual({ src: BLUE, alt: "A blue square" });

    // Place over Cells: a floating picture, the cell is empty
    menu = await openMenu(sheet, page, 2, 1);
    await menu.locator('[data-key="picture-over-cells"]').click();
    await expect.poll(() => cellImg(page, 2, 1)).toBeNull();
    const floating = page.locator("#luckysheet-modal-dialog-activeImage");
    await expect(floating).toBeVisible();

    // right-click the floating picture: Place in Cell
    const box = await floating.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5, { button: "right" });
    await page
      .locator('.fortune-cell-menu [data-key="picture-place-in-cell"]')
      .click();
    await expect
      .poll(() => cellImg(page, 2, 1))
      .toEqual({ src: BLUE, alt: "A blue square" });
    await expect(floating).toHaveCount(0);

    // undo puts the floating picture back
    await sheet.click(5, 5);
    await page.keyboard.press("Control+z");
    await expect.poll(() => cellImg(page, 2, 1)).toBeNull();
  });

  test("pasting a picture places it in the active cell", async ({
    sheet,
    page,
  }) => {
    await sheet.click(3, 0);
    await page.evaluate(async (src) => {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "red.svg", { type: "image/svg+xml" });
      const data = new DataTransfer();
      data.items.add(file);
      document.activeElement.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        })
      );
    }, RED);
    await expect
      .poll(() => cellImg(page, 3, 0))
      .toMatchObject({ src: expect.stringMatching(/^data:image\/svg\+xml/) });
    await expect.poll(() => pixel(sheet, page, 3, 0)).toEqual([255, 0, 0]);

    // copy and paste it like a value
    await page.keyboard.press("Control+c");
    await expect(
      page.locator(".fortune-cell-area .fortune-selection-copy").first()
    ).toBeVisible();
    await sheet.click(5, 2);
    await page.keyboard.press("Control+v");
    await expect
      .poll(() => cellImg(page, 5, 2))
      .toMatchObject({ src: expect.stringMatching(/^data:image\/svg\+xml/) });
  });
});
