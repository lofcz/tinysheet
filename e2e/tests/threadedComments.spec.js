const { test, expect, Sheet } = require("../fixtures");

// Threaded comments (Excel's "Comments"): the story's workbook has a thread
// on B3 (with a reply), a resolved one on B2 and a note on A4.

const STORY = "features-threaded-comments--light";

async function open(page) {
  const sheet = new Sheet(page);
  await sheet.open(STORY);
  return sheet;
}

const threads = (page) =>
  page.evaluate(() => window.__tinysheet.getSheet().threadedComments ?? []);

test.describe("threaded comments", () => {
  test("hover preview, new comment with @mention, Ctrl+Enter, undo", async ({
    page,
  }) => {
    const sheet = await open(page);

    // hovering the purple corner shows the thread
    const { x, y } = sheet.point(2, 1);
    await page.mouse.move(x, y);
    const preview = page.locator(".fortune-thread-card-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Is this before or after");
    await expect(preview.locator(".fortune-thread-mention")).toHaveText(
      "@Ann Lee"
    );
    await sheet.click(14, 8);
    await expect(preview).toHaveCount(0);

    // right-click › New Comment
    const p = sheet.point(14, 8);
    await page.mouse.click(p.x, p.y, { button: "right" });
    await page.locator('.fortune-cell-menu [data-key="new-comment"]').click();
    const card = page.locator(".fortune-thread-card");
    await expect(card).toBeVisible();
    const box = card.locator("textarea");
    await expect(box).toBeFocused();
    await page.keyboard.type("Numbers for @da");
    const option = card.locator(".fortune-mention-option");
    await expect(option).toHaveText(/Dana Ortiz/);
    await page.keyboard.press("Enter");
    await page.keyboard.type("please");
    await expect(box).toHaveValue("Numbers for @Dana Ortiz please");
    await page.keyboard.press("Control+Enter");

    await expect(card.locator(".fortune-thread-mention")).toHaveText(
      "@Dana Ortiz"
    );
    await expect
      .poll(
        async () =>
          (await threads(page)).find((t) => t.r === 14 && t.c === 8)?.text
      )
      .toBe("Numbers for @[Dana Ortiz](dana) please");
    const events = await page.evaluate(() => window.__commentEvents);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "mention", detail: ["dana"] }),
      ])
    );

    // Escape closes the card; Ctrl+Z removes the thread again
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await threads(page)).length).toBe(2);
  });

  test("comments follow inserted rows; Ctrl+Shift+F2, resolve and the pane", async ({
    page,
  }) => {
    const sheet = await open(page);
    await page.evaluate(() =>
      window.__tinysheet.insertRowOrColumn("row", 0, 2, "lefttop")
    );
    await expect
      .poll(async () =>
        (await threads(page)).map((t) => `${t.r}_${t.c}`).sort()
      )
      .toEqual(["3_1", "4_1"]);

    // Ctrl+Shift+F2 on a commented cell opens its thread
    await sheet.click(4, 1);
    await page.keyboard.press("Control+Shift+F2");
    const card = page.locator(
      ".fortune-thread-card:not(.fortune-thread-card-preview)"
    );
    await expect(card).toContainText("Before. I'll update it next week.");
    await card.locator('[aria-label="Resolve thread"]').click();
    await expect(card).toContainText("Resolved");

    // the pane: filter and navigate
    await page.evaluate(() =>
      window.__tinysheet.setContext(
        (ctx) => {
          ctx.threadedCommentsPane = true;
        },
        { noHistory: true }
      )
    );
    const pane = page.locator(".fortune-comments-pane");
    await expect(pane.locator(".fortune-comments-item")).toHaveCount(2);
    await pane.getByRole("button", { name: "Active", exact: true }).click();
    await expect(pane.locator(".fortune-comments-item")).toHaveCount(0);
    await pane.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(pane.locator(".fortune-comments-item")).toHaveCount(2);
    await pane.locator(".fortune-comments-item").first().click();
    await expect(page.locator(".fortune-thread-card")).toHaveAttribute(
      "data-cell",
      "3_1"
    );
    await expect
      .poll(() => sheet.selection())
      .toEqual({ row: [3, 3], column: [1, 1] });
  });
});
