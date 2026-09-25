// Scrolling moves the pixels already on the canvas and redraws only the
// newly exposed strips (blit scrolling). These tests scroll in small steps,
// then force a full redraw at the same position and compare every pixel:
// merged cells across the freeze line and conditional-format data bars and
// icons must look exactly the same either way.
const { test, expect } = require("playwright/test");

function numbers(rows, cols) {
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const v = ((r * 37 + c * 11) % 100) - 20;
      out.push({ r, c, v: { v, m: String(v), ct: { fa: "General", t: "n" } } });
    }
  }
  return out;
}

function merge(celldata, config, r, c, rs, cs, text) {
  config.merge[`${r}_${c}`] = { r, c, rs, cs };
  for (let i = 0; i < rs; i += 1) {
    for (let j = 0; j < cs; j += 1) {
      const k = celldata.findIndex((d) => d.r === r + i && d.c === c + j);
      if (k >= 0) celldata.splice(k, 1);
      celldata.push({
        r: r + i,
        c: c + j,
        v:
          i === 0 && j === 0
            ? { v: text, m: text, mc: { r, c, rs, cs }, bg: "#fde2e2" }
            : { mc: { r, c } },
      });
    }
  }
}

const dataBar = (color, gradient) => ({
  color,
  gradient,
  border: gradient,
  borderColor: color,
  negativeColor: "#FF0000",
  negativeBorderColor: "#FF0000",
  sameNegativeColor: false,
  direction: "context",
  axisPosition: "automatic",
  axisColor: "#000000",
  min: { type: "autoMin" },
  max: { type: "autoMax" },
  showValue: true,
  minLength: 0,
  maxLength: 100,
});

const iconSet = (name, thresholds) => ({
  name,
  thresholds: thresholds.map((value) => ({
    type: "percent",
    value,
    gte: true,
  })),
  reverse: false,
  showValue: true,
});

function sheet(extra) {
  return {
    name: "Sheet1",
    id: "sheet1",
    order: 0,
    status: 1,
    row: 200,
    column: 30,
    ...extra,
  };
}

const scenarios = {
  "merged cells across the freeze lines": () => {
    const celldata = numbers(200, 12);
    const config = { merge: {} };
    merge(celldata, config, 1, 1, 4, 3, "corner");
    merge(celldata, config, 6, 0, 2, 3, "left");
    merge(celldata, config, 0, 4, 5, 1, "top");
    return sheet({
      celldata,
      config,
      frozen: { type: "rangeBoth", range: { row_focus: 2, column_focus: 1 } },
    });
  },
  "conditional-format data bars and icons": () => {
    const col = (c) => [{ row: [0, 199], column: [c, c] }];
    return sheet({
      celldata: numbers(200, 12),
      frozen: { type: "rangeBoth", range: { row_focus: 1, column_focus: 1 } },
      luckysheet_conditionformat_save: [
        {
          type: "dataBar",
          cellrange: col(1),
          dataBar: dataBar("#638EC6", true),
        },
        {
          type: "dataBar",
          cellrange: col(2),
          dataBar: dataBar("#63C384", false),
        },
        {
          type: "icons",
          cellrange: col(3),
          iconSet: iconSet("3Arrows", [33, 67]),
        },
        {
          type: "icons",
          cellrange: col(4),
          iconSet: iconSet("5Rating", [20, 40, 60, 80]),
        },
      ],
    });
  },
};

for (const theme of ["light", "dark"]) {
  for (const [name, make] of Object.entries(scenarios)) {
    test(`blit scrolling matches a full redraw: ${name} (${theme})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1000, height: 600 });
      await page.addInitScript(
        ({ data, theme: t }) => {
          window.__e2eScenario = { data, theme: t };
        },
        { data: [make()], theme }
      );
      await page.goto("/iframe.html?id=e2e-harness--scenario&viewMode=story");
      await page.locator(".fortune-cell-area").waitFor();
      await page.waitForFunction(() => window.__tinysheet);
      const diffs = await page.evaluate(async () => {
        const frame = () =>
          new Promise((r) => {
            requestAnimationFrame(() => r());
          });
        const settle = async () => {
          await frame();
          await frame();
          await frame();
        };
        const canvas = document.querySelector("canvas.fortune-sheet-canvas");
        const grab = () =>
          canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data;
        const out = [];
        for (const axis of ["y", "x"]) {
          const bar = document.querySelector(`.luckysheet-scrollbar-${axis}`);
          const prop = axis === "y" ? "scrollTop" : "scrollLeft";
          let pos = 0;
          for (const step of [7, 13, 33, -9, -23, 41]) {
            pos = Math.max(0, pos + step);
            bar[prop] = pos;
            await settle();
            const blitted = grab();
            // jump away and back: a full redraw at the same position
            const at = bar[prop];
            bar[prop] = at + 3000;
            await settle();
            bar[prop] = at;
            await settle();
            const full = grab();
            let n = 0;
            for (let i = 0; i < full.length; i += 1) {
              if (blitted[i] !== full[i]) n += 1;
            }
            if (n > 0) out.push(`${axis}=${at}: ${n} bytes differ`);
          }
          bar[prop] = 0;
          await settle();
        }
        return out;
      });
      expect(diffs).toEqual([]);
    });
  }
}
