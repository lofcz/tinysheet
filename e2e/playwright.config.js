// Playwright configuration for the e2e suite. Tests run against the static
// Storybook build in storybook-static/, served by e2e/serve.mjs.
// Use `bun run test:e2e` (see e2e/run.mjs), which builds Storybook and finds a
// Playwright installation.
const path = require("path");

const port = Number(process.env.E2E_PORT || 6107);
const baseURL = `http://127.0.0.1:${port}`;
const root = path.resolve(__dirname, "..");

module.exports = {
  testDir: path.join(__dirname, "tests"),
  outputDir: path.join(root, "test-results", "e2e"),
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL,
    viewport: { width: 1600, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `node "${path.join(__dirname, "serve.mjs")}" "${path.join(
      root,
      "storybook-static"
    )}" ${port}`,
    url: `${baseURL}/iframe.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
};
