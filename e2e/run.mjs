#!/usr/bin/env node
// Runs the Playwright e2e suite against a static Storybook build.
//
//   bun run test:e2e                 build Storybook, then run every test
//   bun run test:e2e -- --no-build   reuse the existing storybook-static/
//   bun run test:e2e -- -g "F4"      extra arguments go to `playwright test`
//
// Playwright is not a project dependency. The runner uses, in order: a
// `playwright` package resolvable from the repo, the directory named by
// $PLAYWRIGHT_MODULE_DIR, or the global npm installation (`npm i -g
// playwright` then `playwright install chromium`, as CI does).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const noBuild = args.includes("--no-build") || !!process.env.E2E_SKIP_BUILD;
const passthrough = args.filter((a) => a !== "--no-build");

function findPlaywright() {
  const candidates = [];
  try {
    const require = createRequire(path.join(root, "package.json"));
    candidates.push(path.dirname(require.resolve("playwright/package.json")));
  } catch {
    // not installed locally
  }
  if (process.env.PLAYWRIGHT_MODULE_DIR) {
    candidates.push(process.env.PLAYWRIGHT_MODULE_DIR);
  }
  const npmRoot = spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
  if (npmRoot.status === 0) {
    candidates.push(path.join(npmRoot.stdout.trim(), "playwright"));
  }
  return candidates.find((dir) => existsSync(path.join(dir, "cli.js")));
}

const pwDir = findPlaywright();
if (!pwDir) {
  console.error(
    "Playwright not found. Install it with `npm i -g playwright` and " +
      "`playwright install chromium`, or set PLAYWRIGHT_MODULE_DIR."
  );
  process.exit(1);
}

if (
  !noBuild ||
  !existsSync(path.join(root, "storybook-static", "iframe.html"))
) {
  const build = spawnSync(
    "npx",
    [
      "storybook",
      "build",
      "--quiet",
      "--disable-telemetry",
      "-o",
      "storybook-static",
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1", CI: "1" },
    }
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
}

// Test files `require("playwright/test")`; NODE_PATH lets that resolve to the
// same installation that runs the CLI.
const nodePath = [path.dirname(pwDir), process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
const result = spawnSync(
  process.execPath,
  [
    path.join(pwDir, "cli.js"),
    "test",
    "--config",
    path.join(here, "playwright.config.js"),
    ...passthrough,
  ],
  { cwd: root, stdio: "inherit", env: { ...process.env, NODE_PATH: nodePath } }
);
process.exit(result.status ?? 1);
