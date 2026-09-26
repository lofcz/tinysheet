const { test, expect, Sheet } = require("../fixtures");

// The grid's look (docs/DESIGN.md, core/src/theme.ts): Excel's structure in
// the suite's palette. Canvas pixels are sampled where no text is drawn.

const COL = 74;
const ROW = 20;

// canvas palette (core/src/theme.ts)
const LIGHT = {
  cell: [255, 255, 255],
  header: [244, 244, 245],
  headerSelected: [223, 229, 244],
  headerFull: [203, 215, 243],
  accent: [37, 99, 235],
};
const DARK = {
  cell: [28, 28, 31],
  header: [20, 20, 23],
  headerSelected: [32, 43, 59],
  accent: [96, 165, 250],
};

/** Canvas pixel [r, g, b] under page point (x, y). */
function canvasPixel(page, x, y) {
  return page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector(".fortune-sheet-canvas");
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const d = canvas
        .getContext("2d")
        .getImageData(
          Math.floor((px - rect.left) * ratio),
          Math.floor((py - rect.top) * ratio),
          1,
          1
        ).data;
      return [d[0], d[1], d[2]];
    },
    [x, y]
  );
}

const near = (a, b, tol = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

/** Poll until the canvas pixel at (x, y) is (close to) `rgb`. */
async function expectPixel(page, x, y, rgb) {
  await expect
    .poll(async () => {
      const got = await canvasPixel(page, x, y);
      return near(got, rgb) ? rgb : got;
    })
    .toEqual(rgb);
}

// Header points clear of the labels, and the accent edges (the 2px on the
// side facing the cells: the header line and the pixel before it).
const colHeader = (sheet, c) => [sheet.box.x + c * COL + 8, sheet.box.y - 14];
const colEdge = (sheet, c) => [sheet.box.x + c * COL + 8, sheet.box.y - 1.5];
const rowHeader = (sheet, r) => [sheet.box.x - 40, sheet.box.y + r * ROW + 4];
const rowEdge = (sheet, r) => [sheet.box.x - 1.5, sheet.box.y + r * ROW + 4];

test.describe("grid visuals", () => {
  test("headers of the selection: accent tint and a 2px accent edge", async ({
    sheet,
    page,
  }) => {
    await sheet.click(2, 2);
    await expectPixel(page, ...colHeader(sheet, 2), LIGHT.headerSelected);
    await expectPixel(page, ...colEdge(sheet, 2), LIGHT.accent);
    await expectPixel(page, ...rowHeader(sheet, 2), LIGHT.headerSelected);
    await expectPixel(page, ...rowEdge(sheet, 2), LIGHT.accent);
    // other headers stay plain
    await expectPixel(page, ...colHeader(sheet, 3), LIGHT.header);
    await expectPixel(page, ...rowHeader(sheet, 4), LIGHT.header);

    // a whole column: its header is stronger, every row header is tinted
    await page.mouse.click(
      sheet.box.x + 3 * COL + COL / 2,
      sheet.box.y - ROW / 2
    );
    await expectPixel(page, ...colHeader(sheet, 3), LIGHT.headerFull);
    await expectPixel(page, ...colHeader(sheet, 2), LIGHT.header);
    await expectPixel(page, ...rowHeader(sheet, 6), LIGHT.headerSelected);

    // Select All: every header full, the corner triangle in the accent
    const corner = page.locator(".fortune-left-top");
    await expect(corner).not.toHaveAttribute("data-all-selected", /.*/);
    await corner.click();
    await expect(corner).toHaveAttribute("data-all-selected", "true");
    await expectPixel(page, ...colHeader(sheet, 0), LIGHT.headerFull);
    await expectPixel(page, ...rowHeader(sheet, 0), LIGHT.headerFull);
  });

  test("selection: accent border, clear active cell, fill handle", async ({
    sheet,
    page,
  }) => {
    await sheet.select(1, 1, 3, 3);
    const box = page.locator(".luckysheet-cell-selected").first();
    await expect(box).toHaveCSS("border-top-color", "rgb(37, 99, 235)");
    await expect(box).toHaveCSS("border-top-width", "2px");
    const handle = box.locator(".luckysheet-cs-fillhandle");
    await expect(handle).toHaveCSS("background-color", "rgb(37, 99, 235)");
    await expect(handle).toHaveCSS("border-top-color", "rgb(255, 255, 255)");
    // the fill leaves the active cell (B2) clear
    const fill = box.locator(".luckysheet-cs-fill");
    await expect(fill).toHaveCSS("clip-path", /evenodd/);
    await expect(fill).toHaveCSS("background-color", "rgba(37, 99, 235, 0.08)");

    // one cell: no fill at all
    await sheet.click(6, 6);
    await expect(
      page.locator(".luckysheet-cell-selected .luckysheet-cs-fill")
    ).toHaveCSS("display", "none");

    // Ctrl+click adds a range: fills only, the active cell outlined
    await page.keyboard.down("Control");
    const p = sheet.point(8, 2);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up("Control");
    await expect(page.locator(".luckysheet-cell-selected")).toHaveCount(2);
    await expect(page.locator(".luckysheet-cell-selected").first()).toHaveCSS(
      "border-top-color",
      "rgba(0, 0, 0, 0)"
    );
    await expect(page.locator(".luckysheet-cell-selected-focus")).toHaveCSS(
      "outline-color",
      "rgb(37, 99, 235)"
    );
  });

  test("copy marquee: marching ants on the grid lines", async ({ sheet }) => {
    await sheet.click(1, 1);
    await sheet.copy();
    const top = sheet.page
      .locator("#fortune-selection-copy .fortune-selection-copy-top")
      .first();
    await expect(top).toHaveCSS("animation-name", "ts-ants-x");
    await expect(top).toHaveCSS("height", "2px");
    await sheet.page.keyboard.press("Escape");
  });

  test("formula references: Excel's colours, same in the text and the grid", async ({
    sheet,
    page,
  }) => {
    await sheet.click(6, 0);
    await page.keyboard.type("=A1+B2+A1");
    const boxes = page.locator(".fortune-formula-functionrange-highlight");
    await expect(boxes).toHaveCount(2);
    const edge = (i) => boxes.nth(i).locator(".fortune-selection-copy-top");
    await expect(edge(0)).toHaveCSS("background-color", "rgb(91, 151, 255)");
    await expect(edge(1)).toHaveCSS("background-color", "rgb(255, 97, 107)");
    // 10% fill of the colour
    await expect(boxes.nth(0).locator(".fortune-selection-copy-hc")).toHaveCSS(
      "opacity",
      "0.1"
    );
    const refs = page.locator(
      ".luckysheet-input-box .fortune-formula-functionrange-cell"
    );
    await expect(refs.nth(0)).toHaveCSS("color", "rgb(91, 151, 255)");
    await expect(refs.nth(1)).toHaveCSS("color", "rgb(255, 97, 107)");
    // A1 again: A1's colour
    await expect(refs.nth(2)).toHaveCSS("color", "rgb(91, 151, 255)");
    await page.keyboard.press("Escape");
  });

  test("cells default to a Calibri-like sans at 11pt", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await page.keyboard.type("x");
    const editor = page.locator(".luckysheet-input-box-inner");
    await expect(editor).toHaveCSS("font-family", /^Calibri, Carlito/);
    await expect(editor).toHaveCSS("font-size", /^14\.6/);
    await page.keyboard.press("Escape");
  });
});

test.describe("grid visuals: dark", () => {
  test("dark cells, headers and selection; light fills adapted", async ({
    page,
  }) => {
    const data = [
      {
        name: "Sheet1",
        id: "s1",
        order: 0,
        status: 1,
        row: 60,
        column: 20,
        celldata: [
          { r: 0, c: 4, v: { bg: "#f2f2f2" } },
          { r: 0, c: 5, v: { bg: "#ffff00" } },
          { r: 0, c: 6, v: { bg: "#ffffff" } },
        ],
      },
    ];
    await page.addInitScript((d) => {
      window.__e2eScenario = { data: d, theme: "dark" };
    }, data);
    const sheet = new Sheet(page);
    await sheet.open("e2e-harness--scenario");
    await page.waitForFunction(() => window.__tinysheet);
    await expect(page.locator(".fortune-container")).toHaveAttribute(
      "data-theme",
      "dark"
    );

    const at = (r, c) => {
      const { x, y } = sheet.point(r, c);
      return [x, y];
    };
    await expectPixel(page, ...at(3, 3), DARK.cell);
    await expectPixel(page, ...colHeader(sheet, 3), DARK.header);
    // very light fills become dark tints, strong fills stay
    await expectPixel(page, ...at(0, 4), [40, 40, 40]);
    await expectPixel(page, ...at(0, 5), [255, 255, 0]);
    await expectPixel(page, ...at(0, 6), [28, 28, 28]);

    await sheet.click(2, 2);
    await expectPixel(page, ...colHeader(sheet, 2), DARK.headerSelected);
    await expectPixel(page, ...colEdge(sheet, 2), DARK.accent);
    await expect(page.locator(".luckysheet-cell-selected")).toHaveCSS(
      "border-top-color",
      "rgb(96, 165, 250)"
    );

    // the editor: cell colour, light automatic text
    await page.keyboard.type("x");
    const editor = page.locator(".luckysheet-input-box-inner");
    await expect(editor).toHaveCSS("background-color", "rgb(28, 28, 31)");
    await expect(editor).toHaveCSS("color", "rgb(228, 228, 231)");
    await page.keyboard.press("Escape");
  });
});
