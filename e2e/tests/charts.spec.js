const { test, expect, storyUrl } = require("../fixtures");

// Charts, round 2: the new chart types render, the chart context menu
// exports pictures, and the editor's galleries restyle a chart.

async function openMoreTypes(page) {
  await page.goto(storyUrl("charts--more-types"));
  await page.locator(".fortune-chart-box").first().waitFor();
}

test.describe("charts", () => {
  test("combo, radar, bubble, waterfall, histogram, funnel, stock and Pareto render", async ({
    page,
  }) => {
    await openMoreTypes(page);
    const boxes = page.locator(".fortune-chart-box[role=figure]");
    await expect(boxes).toHaveCount(9);
    const labels = await boxes.evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label"))
    );
    expect(labels).toEqual([
      "Combo: close + volume",
      "Radar",
      "Bubble",
      "Waterfall",
      "Histogram",
      "Funnel",
      "Stock (OHLC)",
      "Trendline and error bars",
      "Pareto",
    ]);
    // the trendline equation and R² are drawn on the chart
    await expect(
      page.locator(".fortune-chart-box[role=figure] svg text", {
        hasText: "R² =",
      })
    ).toHaveCount(1);
  });

  test("the chart menu saves SVG and PNG pictures and copies one", async ({
    page,
  }) => {
    await openMoreTypes(page);
    const box = page.locator(".fortune-chart-box[role=figure]").nth(3);
    await box.click({ button: "right" });
    const menu = page.locator(".fortune-chart-menu");
    await expect(menu).toBeVisible();

    const [svg] = await Promise.all([
      page.waitForEvent("download"),
      menu.locator('[data-key="exportSvg"]').click(),
    ]);
    expect(svg.suggestedFilename()).toBe("Waterfall.svg");

    await box.click({ button: "right" });
    const [png] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('.fortune-chart-menu [data-key="exportPng"]').click(),
    ]);
    expect(png.suggestedFilename()).toBe("Waterfall.png");

    await box.click({ button: "right" });
    await page.locator('.fortune-chart-menu [data-key="copyAsImage"]').click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const items = await navigator.clipboard.read();
          return items.flatMap((i) => i.types);
        })
      )
      .toContain("image/png");
  });

  test("style gallery restyles the chart in the dark theme", async ({
    page,
  }) => {
    await page.goto(storyUrl("charts--more-types-dark"));
    const box = page.locator(".fortune-chart-box[role=figure]").first();
    // the chart area (a double-click on a series formats the series)
    await box.dblclick({ position: { x: 6, y: 6 } });
    const editor = page.locator(".fortune-chart-editor");
    await expect(editor).toBeVisible();
    await expect(editor.locator(".fortune-chart-style-tile")).toHaveCount(8);
    await editor.locator(".fortune-chart-style-tile").nth(5).click();
    // style 6 on the dark theme: a near-black chart area
    await expect(box.locator("svg > rect").first()).toHaveAttribute(
      "fill",
      "#111214"
    );
  });
});
