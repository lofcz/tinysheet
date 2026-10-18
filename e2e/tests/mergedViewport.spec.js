// Sparse XLSX merges can omit every follower cell. Culling must use the
// complete merged rectangle, including in the frozen band and after resizing.
const { test, expect } = require("playwright/test");

for (const freeze of [false, true]) {
  test(`merged anchors remain visible outside the viewport (freeze=${freeze})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 650 });
    await page.addInitScript(
      ({ freeze }) => {
        window.__e2eScenario = {
          data: [
            {
              id: "sheet1",
              name: "Sheet1",
              row: 100,
              column: 30,
              config: {
                columnlen: { 0: 270, 1: 198, 2: 182 },
                rowlen: { 0: 60 },
                merge: {
                  "0_0": { r: 0, c: 0, rs: 1, cs: 12 },
                  "12_0": { r: 12, c: 0, rs: 4, cs: 12 },
                },
              },
              celldata: [
                {
                  r: 0,
                  c: 0,
                  v: {
                    v: "Wide title",
                    bg: "#17365D",
                    mc: { r: 0, c: 0, rs: 1, cs: 12 },
                  },
                },
                {
                  r: 12,
                  c: 0,
                  v: {
                    v: "Tall note",
                    bg: "#17365D",
                    mc: { r: 12, c: 0, rs: 4, cs: 12 },
                  },
                },
              ],
              ...(freeze
                ? {
                    frozen: {
                      type: "rangeRow",
                      range: { row_focus: 2, column_focus: 0 },
                    },
                  }
                : {}),
            },
          ],
        };
      },
      { freeze }
    );
    await page.goto("/iframe.html?id=e2e-harness--scenario&viewMode=story");
    await page.locator("canvas.fortune-sheet-canvas").waitFor();
    await page.waitForFunction(() => window.__tinysheet);
    const pixels = await page.evaluate(
      async ({ freeze }) => {
        const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
        const barX = document.querySelector(".luckysheet-scrollbar-x");
        const barY = document.querySelector(".luckysheet-scrollbar-y");
        const canvas = document.querySelector("canvas.fortune-sheet-canvas");
        const pixel = (y) =>
          Array.from(canvas.getContext("2d").getImageData(400, y, 1, 1).data);
        const out = [];
        await settle();
        for (const left of [300, 600, 0, 350]) {
          barX.scrollLeft = left;
          await settle();
          out.push(pixel(25));
        }
        if (freeze) {
          barY.scrollTop = 220;
          await settle();
          out.push(pixel(25));
        }
        // Stretch the first column; still render the merged rectangle once its
        // resized anchor column disappears.
        window.__tinysheet.setColumnWidth({ 0: 360 });
        await settle();
        barX.scrollLeft = 400;
        await settle();
        out.push(pixel(25));
        if (!freeze) {
          // Row 13 starts above the viewport; its four-row merge still
          // intersects it after the first row is resized.
          window.__tinysheet.setRowHeight({ 12: 80 });
          await settle();
          barY.scrollTop = 320;
          await settle();
          out.push(pixel(25));
        }
        return out;
      },
      { freeze }
    );
    for (const pixel of pixels) expect(pixel.slice(0, 3)).toEqual([23, 54, 93]);
  });
}
