const { test, expect, Sheet, toolbarButton } = require("../fixtures");

// Shapes and text boxes (Insert › Shapes): draw, select, move, resize,
// rotate, edit text, format, z-order, keyboard and undo, in the browser.

const shapes = (page) =>
  page.evaluate(() => window.__tinysheet.getAllSheets()[0].shapes || []);

async function openStory(page, id = "shapes--gallery") {
  const sheet = new Sheet(page);
  await sheet.open(id);
  return sheet;
}

/** Open the Insert › Shapes gallery. */
async function openGallery(page) {
  await (await toolbarButton(page, "Shapes")).click();
  await expect(page.locator(".ts-shape-gallery")).toBeVisible();
}

async function center(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

test.describe("shapes", () => {
  test("draw a shape from the gallery, then undo", async ({ page }) => {
    const sheet = await openStory(page, "shapes--empty");
    await openGallery(page);
    await page.locator('[data-shape-key="hexagon"]').click();
    const area = sheet.box;
    await page.mouse.move(area.x + 200, area.y + 100);
    await page.mouse.down();
    await page.mouse.move(area.x + 320, area.y + 180, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await shapes(page)).length).toBe(1);
    const [hex] = await shapes(page);
    expect(hex.prst).toBe("hexagon");
    const el = page.locator(`[data-shape-id="${hex.id}"]`);
    await expect(el).toBeFocused();
    const b = await el.boundingBox();
    expect(Math.round(b.width)).toBe(120);
    expect(Math.round(b.height)).toBe(80);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await shapes(page)).length).toBe(0);
  });

  test("select, move by drag and keyboard, delete", async ({ page }) => {
    await openStory(page);
    const rect = page.locator('[data-shape-id="rect"]');
    const start = await center(rect);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 74, start.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(rect).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await shapes(page)).find((s) => s.id === "rect").from)
      .toEqual({ r: 7, c: 2, dx: 0, dy: 0 });
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(
        async () => (await shapes(page)).find((s) => s.id === "rect").from.dx
      )
      .toBe(1);
    await page.keyboard.press("Delete");
    await expect(rect).toHaveCount(0);
  });

  test("resize with a handle and rotate with the rotate handle", async ({
    page,
  }) => {
    await openStory(page);
    const star = page.locator('[data-shape-id="callout"]');
    await star.click({ position: { x: 20, y: 20 } });
    const handle = star.locator(".fortune-shape-handle-rb");
    const h = await center(handle);
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(h.x + 50, h.y + 30, { steps: 4 });
    await page.mouse.up();
    const before = (await shapes(page)).find((s) => s.id === "callout");
    expect(before.to.c).toBeGreaterThan(8 - 1);
    const rot = await center(star.locator(".fortune-shape-rotate"));
    const body = await center(star);
    await page.mouse.move(rot.x, rot.y);
    await page.mouse.down();
    // drag to the right of the centre: 90°
    await page.mouse.move(body.x + 150, body.y, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () =>
        Math.round((await shapes(page)).find((s) => s.id === "callout").rot)
      )
      .toBe(90);
  });

  test("double-click edits rich text; the format pane styles it", async ({
    page,
  }) => {
    await openStory(page);
    const rect = page.locator('[data-shape-id="rect"]');
    const c = await center(rect);
    await page.mouse.dblclick(c.x, c.y);
    const editor = rect.locator(".fortune-shape-editor");
    await expect(editor).toBeFocused();
    await page.keyboard.type(" ahead");
    await page.keyboard.press("Escape");
    await expect(rect).toBeFocused();
    await expect
      .poll(async () =>
        (await shapes(page))
          .find((s) => s.id === "rect")
          .text.paragraphs[0].runs.map((r) => r.text)
          .join("")
      )
      .toBe("Plan ahead");
    await rect.click({ button: "right" });
    await page.getByRole("menuitem", { name: /Format shape/ }).click();
    const pane = page.getByRole("complementary", { name: "Format shape" });
    await expect(pane).toBeVisible();
    await pane.getByRole("button", { name: "Bold" }).click();
    await pane.getByLabel("Shadow").uncheck();
    await expect
      .poll(async () => {
        const s = (await shapes(page)).find((x) => x.id === "rect");
        return [s.text.paragraphs[0].runs[0].b, !!s.shadow];
      })
      .toEqual([true, false]);
  });

  test("group with Ctrl+G, z-order, duplicate with Ctrl+D", async ({
    page,
  }) => {
    await openStory(page);
    const rect = page.locator('[data-shape-id="rect"]');
    const star = page.locator('[data-shape-id="star"]');
    await rect.click({ position: { x: 20, y: 20 } });
    const s = await center(star);
    await page.keyboard.down("Shift");
    await page.mouse.click(s.x, s.y);
    await page.keyboard.up("Shift");
    await page.keyboard.press("Control+g");
    await expect
      .poll(async () => {
        const all = await shapes(page);
        const g = all.find((x) => x.id === "rect").group;
        return !!g && g === all.find((x) => x.id === "star").group;
      })
      .toBe(true);
    // the group moves to the topmost member: rect is now just below star
    const order = (await shapes(page)).map((x) => x.id);
    expect(order.indexOf("star") - order.indexOf("rect")).toBe(1);
    await page.keyboard.press("Control+d");
    await expect.poll(async () => (await shapes(page)).length).toBe(9);
  });

  test("dark theme renders shapes and the gallery with dark chrome", async ({
    page,
  }) => {
    await openStory(page, "shapes--dark");
    await expect(page.locator(".fortune-container")).toHaveAttribute(
      "data-theme",
      "dark"
    );
    await expect(page.locator("[data-shape-id]")).toHaveCount(7);
    await openGallery(page);
    const bg = await page
      .locator(".ts-shape-gallery")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });
});
