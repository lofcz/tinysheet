const { test, expect } = require("../fixtures");

// Page layout and printing (stream R8): print area, page breaks, Page
// Break Preview, Page Setup, Print Preview and the browser print flow.

async function menu(page, action) {
  const button = page.getByRole("button", { name: "Page Layout", exact: true });
  // the default toolbar may move the item into the "More" overflow
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "More", exact: true }).click();
  }
  await button.click();
  await page.locator(`[data-action="${action}"]`).click();
}

const pageSetup = (page) =>
  page.evaluate(() => window.__tinysheet.getSheet().pageSetup ?? {});

test.describe("page layout", () => {
  test("Set Print Area, page break and Page Break Preview", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["a", "b", "c", "d"]);
    await sheet.select(0, 0, 3, 1);
    await menu(page, "setPrintArea");
    await expect
      .poll(() => pageSetup(page))
      .toEqual({ printArea: [{ row: [0, 3], column: [0, 1] }] });

    await sheet.click(2, 0);
    await menu(page, "insertPageBreak");
    await expect.poll(() => pageSetup(page)).toMatchObject({ rowBreaks: [2] });

    await menu(page, "pageBreakPreview");
    const area = page.locator(".fortune-page-area");
    await expect(area).toHaveCount(1);
    const box = await area.boundingBox();
    // the print area A1:B4 at 100%
    expect(Math.round(box.width)).toBe(148);
    expect(Math.round(box.height)).toBe(80);
    await expect(page.locator(".fortune-page-watermark")).toHaveText([
      "Page 1",
      "Page 2",
    ]);

    // drag the manual break from row 3 down to row 4
    const line = page.locator(".fortune-page-break.manual");
    const lb = await line.boundingBox();
    await page.mouse.move(lb.x + 20, lb.y + lb.height / 2);
    await page.mouse.down();
    await page.mouse.move(lb.x + 20, lb.y + 20, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => pageSetup(page)).toMatchObject({ rowBreaks: [3] });

    await menu(page, "resetPageBreaks");
    await expect
      .poll(async () => (await pageSetup(page)).rowBreaks)
      .toBeUndefined();
  });

  test("Page Setup dialog applies orientation, titles and footer", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "Title");
    await menu(page, "pageSetup");
    const dialog = page.getByRole("dialog", { name: "Page Setup" });
    await dialog.getByLabel("Landscape").check();
    await dialog.getByRole("tab", { name: "Sheet" }).click();
    await dialog.getByLabel("Rows to repeat at top:").fill("$1:$1");
    await dialog.getByRole("tab", { name: "Header/Footer" }).click();
    await dialog.getByLabel("Editing:").selectOption("footer");
    await dialog.getByLabel("Center section").fill("Page ");
    await dialog.getByRole("button", { name: "Page number" }).click();
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(() => pageSetup(page))
      .toEqual({
        orientation: "landscape",
        printTitleRows: [0, 0],
        footer: { center: "Page &P" },
      });
  });

  test("Ctrl+P opens Print Preview and prints through window.print", async ({
    sheet,
    page,
  }) => {
    await sheet.enter(0, 0, "top");
    // a value far down: the used range needs two Letter pages
    await page.evaluate(() => window.__tinysheet.setCellValue(60, 0, "bottom"));
    await sheet.click(0, 1);
    await page.keyboard.press("Control+p");
    const preview = page.locator(".fortune-print-preview");
    await expect(preview).toBeVisible();
    await expect(preview.locator(".fortune-print-page")).toHaveCount(1);
    await expect(preview.locator(".fortune-pp-page-of")).toContainText("of 2");
    await preview.getByRole("button", { name: "Next page" }).click();
    await expect(preview.locator(".fortune-print-page")).toHaveAttribute(
      "data-page",
      "2"
    );
    await page.evaluate(() => {
      window.__printed = 0;
      window.print = () => {
        window.__printed += document.querySelectorAll(
          "#fortune-print-root .fortune-print-page"
        ).length;
      };
    });
    await preview.getByRole("button", { name: "Print", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__printed)).toBe(2);
    await expect(page.locator("#fortune-print-style")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    // Excel shows the automatic page breaks after a preview
    await expect(page.locator(".fortune-page-break").first()).toBeAttached();
  });
});
