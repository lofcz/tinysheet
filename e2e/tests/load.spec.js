const { test, expect, Sheet } = require("../fixtures");

// Every story used by the suite, plus the main feature stories, must render
// the grid without console errors (asserted by the consoleErrors fixture).
const stories = [
  "e2e-harness--blank",
  "e2e-harness--dark",
  "features--basic",
  "features--formula",
  "features--freeze",
  "features--tabs",
  "theming--dark",
];

for (const id of stories) {
  test(`story ${id} loads without errors`, async ({ page }) => {
    const sheet = new Sheet(page);
    await sheet.open(id);
    await expect(page.locator(".fortune-container")).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.locator(".fortune-toolbar")).toBeVisible();
    await expect(page.locator(".fortune-sheettab-container")).toBeVisible();
  });
}
