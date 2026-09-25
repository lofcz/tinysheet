// Shared Playwright fixtures: open a Storybook story, drive the canvas grid by
// cell coordinates, and read values back through the harness story's
// `window.__tinysheet` workbook API (see stories/E2E.stories.tsx).
const { test: base, expect } = require("playwright/test");

// Default geometry (settings.defaultColWidth / defaultRowHeight plus the
// 1px grid line) of an unzoomed sheet.
const COL_WIDTH = 74;
const ROW_HEIGHT = 20;

// Messages that are not application errors (e.g. resources the static build
// never ships). Keep this list short and specific.
const IGNORED_CONSOLE = [/favicon\.ico/];

const storyUrl = (id) => `/iframe.html?id=${id}&viewMode=story`;

class Sheet {
  constructor(page) {
    this.page = page;
    this.area = page.locator(".fortune-cell-area");
  }

  async open(id = "e2e-harness--blank") {
    await this.page.goto(storyUrl(id));
    await this.area.waitFor();
    this.box = await this.area.boundingBox();
  }

  /** Page coordinates of the centre of cell (r, c) at 100% zoom. */
  point(r, c) {
    return {
      x: this.box.x + c * COL_WIDTH + COL_WIDTH / 2,
      y: this.box.y + r * ROW_HEIGHT + ROW_HEIGHT / 2,
    };
  }

  /**
   * Click the cell drawn at grid position (r, c). Unless `wait` is false
   * (e.g. when scrolled or frozen), waits until that cell is selected.
   */
  async click(r, c, { wait = true } = {}) {
    const { x, y } = this.point(r, c);
    await this.page.mouse.click(x, y);
    if (wait) await this.waitForSelection(r, c);
  }

  async waitForSelection(r, c) {
    await expect
      .poll(() => this.selection())
      .toEqual({ row: [r, r], column: [c, c] });
  }

  /** Ctrl+C, then wait for the copy marquee and the system clipboard. */
  async copy() {
    await this.page.keyboard.press("Control+c");
    await expect(
      this.page.locator(".fortune-cell-area .fortune-selection-copy").first()
    ).toBeVisible();
    await expect
      .poll(() => this.page.evaluate(() => navigator.clipboard.readText()))
      .not.toBe("");
  }

  /** Scroll with the mouse wheel over the grid, in steps the sheet honours. */
  async scroll(dx, dy) {
    const { x, y } = this.point(8, 4);
    await this.page.mouse.move(x, y);
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 100);
    const before = await this.scrollPosition();
    for (let i = 0; i < steps; i += 1) {
      await this.page.mouse.wheel(dx / steps, dy / steps);
    }
    // Wheel events are applied asynchronously (the sheet batches scrolling
    // per animation frame): wait until the scrollbars moved and settled
    // before the next click is hit-tested against the scrolled grid.
    let last = null;
    await expect
      .poll(async () => {
        const now = await this.scrollPosition();
        const moved =
          (dx === 0 || now.x !== before.x) && (dy === 0 || now.y !== before.y);
        const settled = last != null && now.x === last.x && now.y === last.y;
        last = now;
        return moved && settled;
      })
      .toBe(true);
  }

  /** Scroll offsets of the sheet's scrollbars. */
  scrollPosition() {
    return this.page.evaluate(() => {
      const x = document.querySelector(".luckysheet-scrollbar-x");
      const y = document.querySelector(".luckysheet-scrollbar-y");
      return { x: x?.scrollLeft ?? 0, y: y?.scrollTop ?? 0 };
    });
  }

  /** Drag-select from (r1, c1) to (r2, c2). */
  async select(r1, c1, r2, c2) {
    const a = this.point(r1, c1);
    const b = this.point(r2, c2);
    await this.page.mouse.move(a.x, a.y);
    await this.page.mouse.down();
    await this.page.mouse.move(b.x, b.y, { steps: 5 });
    await this.page.mouse.up();
  }

  /** Type each entry into consecutive cells of a column, committing with Enter. */
  async fillColumn(r, c, values) {
    await this.click(r, c);
    for (let i = 0; i < values.length; i += 1) {
      await this.page.keyboard.type(String(values[i]));
      await this.page.keyboard.press("Enter");
      // Enter commits and moves down; wait for it before typing on.
      await this.waitForSelection(r + i + 1, c);
    }
  }

  /** Type into (r, c) and commit with Enter. */
  async enter(r, c, text) {
    await this.fillColumn(r, c, [text]);
  }

  /** Computed value of (r, c); `type` picks another cell field (e.g. "m"). */
  value(r, c, type) {
    return this.page.evaluate(
      ([row, col, t]) =>
        window.__tinysheet.getCellValue(row, col, t ? { type: t } : undefined),
      [r, c, type]
    );
  }

  /** Raw formula text of (r, c), or null. */
  formula(r, c) {
    return this.page.evaluate(
      ([row, col]) =>
        window.__tinysheet.getSheet().data?.[row]?.[col]?.f ?? null,
      [r, c]
    );
  }

  column(c, from, to) {
    return this.page.evaluate(
      ([col, r0, r1]) => {
        const out = [];
        for (let r = r0; r <= r1; r += 1) {
          out.push(window.__tinysheet.getCellValue(r, col));
        }
        return out;
      },
      [c, from, to]
    );
  }

  selection() {
    return this.page.evaluate(() => {
      const [s] = window.__tinysheet.getSelection() || [];
      return s ? { row: s.row, column: s.column } : null;
    });
  }

  sheetInfo() {
    return this.page.evaluate(() => {
      const s = window.__tinysheet.getSheet();
      return { zoomRatio: s.zoomRatio, frozen: s.frozen };
    });
  }

  /** The in-cell editor, while editing. */
  get editor() {
    return this.page.locator("#luckysheet-rich-text-editor");
  }
}

const test = base.extend({
  // Fails any test whose page logs an error or throws.
  consoleErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (!IGNORED_CONSOLE.some((re) => re.test(text))) {
          errors.push(`console.error: ${text}`);
        }
      });
      await use(errors);
      expect(errors, "console errors / uncaught exceptions").toEqual([]);
    },
    { auto: true },
  ],
  sheet: async ({ page }, use) => {
    const sheet = new Sheet(page);
    await sheet.open();
    await use(sheet);
  },
});

module.exports = { test, expect, Sheet, storyUrl };
