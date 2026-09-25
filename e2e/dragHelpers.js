// Helpers shared by the drag specs (e2e/tests/draggers*.spec.js): open a
// workbook with given sheets, zoom, read the cursor under the pointer and
// check that a drag left nothing behind (no drag state, focus on the grid).
const { expect, Sheet } = require("./fixtures");

/** A blank sheet with `extra` fields merged in. */
const blank = (extra = {}) => ({
  name: "Sheet1",
  id: "sheet1",
  order: 0,
  status: 1,
  row: 100,
  column: 26,
  celldata: [],
  ...extra,
});

/** Cells as celldata from { "r,c": value }. */
const cells = (map) =>
  Object.entries(map).map(([k, v]) => {
    const [r, c] = k.split(",").map(Number);
    if (typeof v === "string" && v.startsWith("=")) {
      return { r, c, v: { f: v } };
    }
    return { r, c, v: { v, m: String(v) } };
  });

/** Open the scenario story with `data` (sheets) and `theme`. */
async function openScenario(page, data, { theme } = {}) {
  await page.addInitScript(
    ([d, t]) => {
      window.__e2eScenario = { data: d, theme: t };
    },
    [data, theme]
  );
  const sheet = new Sheet(page);
  await sheet.open("e2e-harness--scenario");
  await page.waitForFunction(() => window.__tinysheet);
  return sheet;
}

/** Read `pick(ctx)` from the live context. */
function ctxValue(page, pick) {
  return page.evaluate(
    (src) =>
      new Promise((resolve) => {
        // eslint-disable-next-line no-new-func
        const fn = new Function("ctx", `return (${src})(ctx);`);
        window.__tinysheet.setContext((ctx) => {
          resolve(JSON.parse(JSON.stringify(fn(ctx) ?? null)));
        });
      }),
    pick.toString()
  );
}

/** Set the zoom of the current sheet; waits until it applies. */
async function setZoom(page, zoom) {
  await page.evaluate(
    (z) =>
      window.__tinysheet.setContext((ctx) => {
        ctx.zoomRatio = z;
        ctx.luckysheetfile[0].zoomRatio = z;
      }),
    zoom
  );
  await expect.poll(() => ctxValue(page, (ctx) => ctx.zoomRatio)).toBe(zoom);
  // the layout (headers, cell geometry) follows on the next frames
  await page.waitForTimeout(100);
}

/**
 * Page geometry of cell (r, c) at any zoom (no frozen panes): its box and
 * centre, from the sheet's own row/column edges and scroll.
 */
async function cellBox(page, r, c) {
  const g = await ctxValue(page, (ctx) => ({
    rows: ctx.visibledatarow,
    cols: ctx.visibledatacolumn,
    sl: ctx.scrollLeft,
    st: ctx.scrollTop,
  }));
  const area = await page.locator(".fortune-cell-area").boundingBox();
  const left = area.x + (c > 0 ? g.cols[c - 1] : 0) - g.sl;
  const top = area.y + (r > 0 ? g.rows[r - 1] : 0) - g.st;
  const right = area.x + g.cols[c] - g.sl;
  const bottom = area.y + g.rows[r] - g.st;
  return {
    left,
    top,
    right,
    bottom,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

/** The CSS cursor shown at page point (x, y). */
function cursorAt(page, x, y) {
  return page.evaluate(
    ([px, py]) => {
      let el = document.elementFromPoint(px, py);
      while (el) {
        const c = window.getComputedStyle(el).cursor;
        if (c && c !== "auto") return c;
        el = el.parentElement;
      }
      return "auto";
    },
    [x, y]
  );
}

/** Hover (x, y) coming from a few px away, then read the cursor there. */
async function hoverCursor(page, x, y) {
  await page.mouse.move(x - 6, y - 6);
  await page.mouse.move(x, y, { steps: 3 });
  return cursorAt(page, x, y);
}

/** Every grid drag flag, which must all be off when no drag is going on. */
function dragFlags(page) {
  return ctxValue(page, (ctx) => ({
    select: !!ctx.luckysheet_select_status,
    scroll: !!ctx.luckysheet_scroll_status,
    rows: !!ctx.luckysheet_rows_selected_status,
    cols: !!ctx.luckysheet_cols_selected_status,
    move: !!ctx.luckysheet_cell_selected_move,
    extend: !!ctx.luckysheet_cell_selected_extend,
    colSize: !!ctx.luckysheet_cols_change_size,
    rowSize: !!ctx.luckysheet_rows_change_size,
    colFreeze: !!ctx.luckysheet_cols_freeze_drag,
    rowFreeze: !!ctx.luckysheet_rows_freeze_drag,
    refDrag: !!ctx.formulaCache?.referenceDrag,
  }));
}

const IDLE = {
  select: false,
  scroll: false,
  rows: false,
  cols: false,
  move: false,
  extend: false,
  colSize: false,
  rowSize: false,
  colFreeze: false,
  rowFreeze: false,
  refDrag: false,
};

/**
 * After a drag: no drag state is left, moving the mouse with no button
 * changes nothing, and the keyboard goes to the grid (typing edits the
 * active cell; Esc throws the edit away).
 */
async function expectIdle(page, sheet, { keyboard = true } = {}) {
  await expect.poll(() => dragFlags(page)).toEqual(IDLE);
  const before = await sheet.selection();
  const a = sheet.point(3, 3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.move(a.x + 150, a.y + 60, { steps: 3 });
  expect(await sheet.selection()).toEqual(before);
  if (keyboard) {
    await page.keyboard.type("k");
    await expect(sheet.editor).toBeFocused();
    await expect(sheet.editor).toHaveText("k");
    await page.keyboard.press("Escape");
    await expect(sheet.editor).toHaveText("");
  }
}

/** Drag from a to b with the primary button, with `steps` moves. */
async function drag(page, a, b, { steps = 6, modifiers = [] } = {}) {
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

/** Centre of a locator's box, with the box. */
async function center(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

/** The current sheet's data as it is saved. */
function sheetData(page) {
  return page.evaluate(() => window.__tinysheet.getSheet());
}

module.exports = {
  blank,
  cells,
  openScenario,
  ctxValue,
  setZoom,
  cellBox,
  cursorAt,
  hoverCursor,
  dragFlags,
  expectIdle,
  drag,
  center,
  sheetData,
  IDLE,
};
