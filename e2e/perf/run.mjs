// Production-browser regression, using our XLSX writer, importer and Workbook.
// bun run test:perf (PLAYWRIGHT_MODULE_DIR / CHROMIUM_PATH override installations)
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  copyFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { largeTableBytes } from "../../packages/excel/test/largeTableFixture.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require.resolve("playwright");
} catch {
  const globalRoot = spawnSync("npm", ["root", "-g"], {
    encoding: "utf8",
  }).stdout.trim();
  playwright = path.join(
    process.env.PLAYWRIGHT_MODULE_DIR || path.join(globalRoot, "playwright"),
    "index.mjs"
  );
}
const { chromium } = await import(pathToFileURL(playwright).href);
const dir = mkdtempSync(path.join(tmpdir(), "tinysheet-perf-"));
const port = Number(process.env.PERF_PORT || 6110);
let server, browser;
const report = {
  fixture:
    "ts-xlsx: 50000 rows, 10 columns, 3 sheets, banded table, outside borders",
  scenarios: [],
  budgetFailures: [],
  workerBytes: 0,
};
const checkBudget = (condition, message) => {
  if (!condition) report.budgetFailures.push(message);
};
const scenarios = process.env.PERF_SCENARIOS?.split(",") ?? [
  "import",
  "import-shared",
  "import-slicer",
  "autofilter",
];
try {
  // Workers have their own module graph. A single Bun multi-entry build keeps
  // main-thread imports alive in the worker as well, hiding accidental coupling.
  for (const entry of ["e2e/perf/entry.tsx", "e2e/perf/import.worker.ts"]) {
    const build = spawnSync(
      "bun",
      [
        "build",
        entry,
        "--outdir",
        dir,
        "--target",
        "browser",
        "--minify",
        "--sourcemap=external",
        "--define",
        'process.env.NODE_ENV="production"',
      ],
      { cwd: root, stdio: "inherit" }
    );
    assert.equal(build.status, 0, "browser bundle");
  }
  report.workerBytes = statSync(path.join(dir, "import.worker.js")).size;
  checkBudget(
    report.workerBytes < 2000000,
    "import worker must not pull in the live editor model"
  );
  if (process.env.PERF_PROFILE)
    copyFileSync(
      path.join(dir, "entry.js.map"),
      `${process.env.PERF_PROFILE}.map`
    );
  copyFileSync(
    path.join(root, "e2e/perf/iframe.html"),
    path.join(dir, "iframe.html")
  );
  writeFileSync(path.join(dir, "large-table.xlsx"), await largeTableBytes());
  if (scenarios.includes("import-shared"))
    writeFileSync(
      path.join(dir, "large-table-shared.xlsx"),
      await largeTableBytes(50000, true)
    );
  server = spawn(process.execPath, ["e2e/serve.mjs", dir, String(port)], {
    cwd: root,
    stdio: "inherit",
  });
  const url = `http://127.0.0.1:${port}/iframe.html`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* server starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const executablePath =
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({ executablePath });
  for (const scenario of scenarios) {
    const imported = scenario.startsWith("import");
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
    });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__perf = { tasks: [], clicks: [], ticks: 0 };
      new PerformanceObserver((list) =>
        window.__perf.tasks.push(
          ...list
            .getEntries()
            .map((e) => ({ start: e.startTime, ms: e.duration }))
        )
      ).observe({ type: "longtask", buffered: true });
      document.addEventListener(
        "click",
        () => (window.__perf.clicked = performance.now()),
        true
      );
      setInterval(() => window.__perf.ticks++, 50);
    });
    await page.goto(`${url}?${scenario}`);
    const profiler =
      process.env.PERF_PROFILE && imported
        ? await page.context().newCDPSession(page)
        : null;
    if (profiler) {
      await profiler.send("Profiler.enable");
      await profiler.send("Profiler.start");
    }
    if (imported) {
      await page.getByRole("button", { name: "Import workbook" }).click();
      await page.waitForFunction(() => window.__largeTable?.ready, undefined, {
        timeout: 60000,
      });
    }
    const buttons = page.locator(
      imported ? ".fortune-table-filter-button" : ".luckysheet-filter-options"
    );
    await buttons.first().waitFor({ timeout: 60000 });
    const metrics = await page.evaluate(() => {
      const m = window.__largeTable;
      return {
        importMs: m.parsed ? m.parsed - m.started : null,
        mountMs: (m.ready || performance.now()) - (m.parsed || m.started),
        ticks: window.__perf.ticks,
        source: m.sourceStats?.(),
        tasks: window.__perf.tasks.slice(),
        filters: [],
        applyMs: [],
      };
    });
    console.log(scenario, "load", JSON.stringify(metrics));
    metrics.scenario = scenario;
    report.scenarios.push(metrics);
    if (profiler) {
      const { profile } = await profiler.send("Profiler.stop");
      writeFileSync(process.env.PERF_PROFILE, JSON.stringify(profile));
    }
    checkBudget(metrics.mountMs < 2000, `mount took ${metrics.mountMs}ms`);
    if (metrics.importMs != null) {
      checkBudget(
        metrics.importMs + metrics.mountMs < 2000,
        `XLSX file-to-interactive took ${metrics.importMs + metrics.mountMs}ms`
      );
      assert.ok(
        metrics.source?.decodedCells <
          (scenario.includes("slicer") ? 52000 : 2000),
        "initial rendering must not expand the workbook"
      );
      assert.ok(
        metrics.ticks > metrics.importMs / 150,
        "page heartbeat continues while worker parses"
      );
    }
    const wildcardStart = Date.now();
    assert.deepEqual(await page.evaluate(() => window.__auditWildcards()), [
      false,
      false,
      true,
    ]);
    metrics.wildcardMs = Date.now() - wildcardStart;
    checkBudget(
      metrics.wildcardMs < 500,
      "wildcard search and filter must not block the page"
    );
    if (scenario.includes("slicer")) {
      const panel = page.locator(".fortune-slicer");
      const options = panel.getByRole("option");
      assert.ok((await options.count()) < 50, "slicer options are windowed");
      const start = Date.now();
      const slicerProfiler = process.env.PERF_PROFILE
        ? await page.context().newCDPSession(page)
        : null;
      if (slicerProfiler) {
        await slicerProfiler.send("Profiler.enable");
        await slicerProfiler.send("Profiler.start");
      }
      await options.first().focus();
      await page.keyboard.press("End");
      await panel
        .getByRole("option", { name: "ID-50000", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        "ID-50000"
      );
      metrics.slicerNavigation = await page.evaluate(() =>
        window.__largeTable.sourceStats()
      );
      console.log(
        "slicer navigation",
        Date.now() - start,
        metrics.slicerNavigation
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () =>
          Object.keys(
            window.__largeTable.workbook.getSheet().config?.rowhidden || {}
          ).length === 49999
      );
      metrics.slicerSelectMs = Date.now() - start;
      metrics.afterSlicer = await page.evaluate(() =>
        window.__largeTable.sourceStats()
      );
      console.log(
        "slicer selection",
        metrics.slicerSelectMs,
        metrics.afterSlicer
      );
      if (slicerProfiler) {
        const { profile } = await slicerProfiler.send("Profiler.stop");
        writeFileSync(
          `${process.env.PERF_PROFILE}.slicer`,
          JSON.stringify(profile)
        );
      }
      checkBudget(
        metrics.slicerSelectMs < 1000,
        `slicer selection took ${metrics.slicerSelectMs}ms`
      );
      assert.ok((await options.count()) < 50);
      await panel.getByRole("button", { name: "Clear Filter (Alt+C)" }).click();
      await page.waitForFunction(
        () =>
          Object.keys(
            window.__largeTable.workbook.getSheet().config?.rowhidden || {}
          ).length === 0
      );
      await panel.focus();
      await page.keyboard.press("Delete");
      await panel.waitFor({ state: "detached" });
      if (process.env.PERF_PROFILE_SLICER) {
        await page.close();
        continue;
      }
    }
    const menu = page.locator(".fortune-filter-menu");
    const list = page.locator("#luckysheet-filter-byvalue-select");
    const open = async (col) => {
      if (profiler) await profiler.send("Profiler.start");
      await buttons.nth(col).click();
      await list.locator("input").first().waitFor();
      const ms = await page.evaluate(
        () => performance.now() - window.__perf.clicked
      );
      metrics.filters.push({
        col,
        ms,
        mounted: await list.locator("input").count(),
      });
      console.log(scenario, "filter", col, Math.round(ms), "ms");
      if (profiler) {
        const { profile } = await profiler.send("Profiler.stop");
        writeFileSync(
          `${process.env.PERF_PROFILE}.filter-${metrics.filters.length}`,
          JSON.stringify(profile)
        );
      }
      checkBudget(ms < 1000, `column ${col} menu took ${ms}ms`);
      assert.ok(
        (await list.locator("input").count()) < 40,
        "value list is windowed"
      );
    };
    const hidden = () =>
      page.evaluate(
        () =>
          Object.keys(
            window.__largeTable.workbook.getSheet().config?.rowhidden || {}
          ).length
      );
    const confirm = async () => {
      if (profiler) await profiler.send("Profiler.start");
      await menu.getByText("Confirm", { exact: true }).click();
      await menu.waitFor({ state: "hidden" });
      const ms = await page.evaluate(
        () => performance.now() - window.__perf.clicked
      );
      console.log(scenario, "apply", Math.round(ms), "ms");
      metrics.applyMs.push(ms);
      if (profiler) {
        const { profile } = await profiler.send("Profiler.stop");
        writeFileSync(
          `${process.env.PERF_PROFILE}.apply-${metrics.filters.length}`,
          JSON.stringify(profile)
        );
      }
      checkBudget(ms < 500, `applying a filter took ${ms}ms`);
    };
    if (process.env.PERF_PROFILE_COLUMN) {
      await open(Number(process.env.PERF_PROFILE_COLUMN));
      await page.close();
      continue;
    }
    await open(0);
    // Keyboard navigation crosses the virtual window and can select the tail.
    await list.getByRole("checkbox").first().focus();
    await page.keyboard.press("End");
    const last = list.getByRole("checkbox", { name: "ID-50000", exact: true });
    await last.waitFor();
    await last.uncheck();
    await menu.locator('input[type="text"]').fill("ID-50000");
    assert.equal(await list.getByRole("checkbox").count(), 1);
    assert.equal(await last.isChecked(), false);
    await confirm();
    assert.equal(await hidden(), 1);
    await page.evaluate(() => window.__largeTable.workbook.handleUndo());
    assert.equal(await hidden(), 0, "undo restores visibility");
    await page.evaluate(() => window.__largeTable.workbook.handleRedo());
    assert.equal(await hidden(), 1, "redo reapplies the filter");
    await open(0);
    await menu.locator('input[type="text"]').fill("ID-50000");
    assert.equal(await list.getByRole("checkbox").isChecked(), false);
    await menu.locator(".fortune-byvalue-btn").first().click();
    await confirm();
    assert.equal(await hidden(), 0);
    await open(1);
    await list.getByRole("checkbox", { name: "West", exact: true }).uncheck();
    await confirm();
    assert.equal(await hidden(), 25000);
    // Other-column exclusions reduce choices without losing the first filter.
    await open(0);
    await menu.locator('input[type="text"]').fill("ID-00002");
    await list
      .getByRole("checkbox", { name: "ID-00002", exact: true })
      .uncheck();
    await confirm();
    assert.equal(await hidden(), 25001);
    await open(0);
    await menu.locator(".fortune-byvalue-btn").first().click();
    await confirm();
    assert.equal(await hidden(), 25000);
    await open(1);
    await menu.locator(".fortune-byvalue-btn").nth(1).click();
    await menu.locator(".fortune-byvalue-btn").nth(2).click();
    await confirm();
    assert.equal(await hidden(), 0);
    // Dates, blanks, and numeric values all open without unbounded DOM/work.
    for (const col of [2, 3, 4]) {
      await open(col);
      await page.keyboard.press("Escape");
    }
    await open(1);
    await list.getByRole("checkbox", { name: "West", exact: true }).uncheck();
    await page.keyboard.press("Escape");
    assert.equal(await hidden(), 0, "cancel does not apply draft selection");
    await open(1);
    const bandColors = await page.evaluate(() =>
      [1, 2].map((r) =>
        window.__largeTable.workbook.getCellValue(r, 1, { type: "bg" })
      )
    );
    assert.notEqual(
      bandColors[0],
      bandColors[1],
      `banded row colors: ${bandColors}`
    );
    await menu.locator(".filter-bycolor-container").first().hover();
    const colorMenu = page.locator(
      ".luckysheet-filter-bycolor-submenu:not(.fortune-filter-condition-submenu)"
    );
    await colorMenu.locator(".color-list .item").first().click();
    await colorMenu.getByText("Confirm", { exact: true }).click();
    await menu.waitFor({ state: "hidden" });
    assert.equal(await hidden(), 25000, "banded row colors filter correctly");
    await open(1);
    await menu.locator(".fortune-byvalue-btn").first().click();
    await confirm();
    assert.equal(await hidden(), 0);
    await page.evaluate(() =>
      window.__largeTable.workbook.setCellValue(50000, 0, "Updated last row")
    );
    assert.equal(
      await page.evaluate(() =>
        window.__largeTable.workbook.getCellValue(50000, 0)
      ),
      "Updated last row"
    );
    await open(0);
    await menu.locator('input[type="text"]').fill("Updated last row");
    await list
      .getByRole("checkbox", { name: "Updated last row", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    if (imported) {
      metrics.afterFiltering = await page.evaluate(() =>
        window.__largeTable.sourceStats()
      );
      assert.ok(
        metrics.afterFiltering.decodedCells < 300000,
        "filtering five columns must not decode the unrelated columns"
      );
    }
    metrics.scrollMs = await page.evaluate(async () => {
      const start = performance.now();
      window.__largeTable.workbook.scroll({ targetRow: 49999 });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      return performance.now() - start;
    });
    checkBudget(metrics.scrollMs < 1000, `scroll took ${metrics.scrollMs}ms`);
    if (scenario.includes("slicer")) {
      await page.locator("#luckysheet-rich-text-editor").focus();
      await page.keyboard.press("Control+f");
      const dialog = page.locator("#fortune-search-replace");
      await dialog.locator("#fortune-find-what").fill("ID-");
      const searchStart = Date.now();
      await dialog.locator("#searchAllBtn").click();
      await dialog.locator('[role="table"][aria-rowcount="50000"]').waitFor();
      metrics.findAllMs = Date.now() - searchStart;
      checkBudget(
        metrics.findAllMs < 2000,
        `Find All took ${metrics.findAllMs}ms`
      );
      const rows = dialog.locator(".boxItem");
      assert.ok((await rows.count()) < 20, "Find All results are windowed");
      await rows.first().focus();
      await page.keyboard.press("End");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("aria-rowindex")
        ),
        "50000"
      );
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
    }
    await page.evaluate(() =>
      window.__largeTable.workbook.activateSheet({
        index: 1,
      })
    );
    await page.waitForFunction(
      () => window.__largeTable.workbook.getCellValue(0, 0) === "Lookup 0"
    );
    assert.equal(
      await page.evaluate(() =>
        window.__largeTable.workbook.getCellValue(0, 0)
      ),
      "Lookup 0"
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(report.budgetFailures, [], "performance budgets");
} catch (error) {
  report.error = String(error);
  if (browser) {
    for (const context of browser.contexts())
      for (const page of context.pages()) {
        console.error(
          "Browser failure:",
          await page.locator("body").innerText()
        );
        await page.screenshot({
          path: process.env.PERF_REPORT
            ? `${process.env.PERF_REPORT}.png`
            : "/tmp/tinysheet-perf-failure.png",
        });
      }
  }
  throw error;
} finally {
  if (process.env.PERF_REPORT)
    writeFileSync(process.env.PERF_REPORT, JSON.stringify(report, null, 2));
  await browser?.close();
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
}
