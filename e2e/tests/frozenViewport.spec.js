const { test, expect, Sheet } = require("../fixtures");

test("large saved headers scroll in small windows and return on resize", async ({
  page,
}) => {
  const frozen = {
    type: "rangeBoth",
    range: { row_focus: 6, column_focus: 2 },
  };
  await page.setViewportSize({ width: 820, height: 650 });
  await page.addInitScript((frozen) => {
    window.__e2eScenario = {
      data: [
        {
          id: "report",
          name: "Report",
          order: 0,
          status: 1,
          row: 100,
          column: 26,
          frozen,
          config: {
            rowlen: Object.fromEntries(
              Array.from({ length: 7 }, (_, i) => [i, 41])
            ),
            columnlen: { 0: 99, 1: 99, 2: 99 },
          },
          celldata: Array.from({ length: 100 }, (_, r) => ({
            r,
            c: 0,
            v: { v: `Row ${r + 1}` },
          })),
        },
      ],
    };
  }, frozen);
  const sheet = new Sheet(page);
  await sheet.open("e2e-harness--scenario");
  await sheet.scroll(0, 400);
  await sheet.click(0, 0, { wait: false });
  await expect
    .poll(async () => (await sheet.selection()).row[0])
    .toBeGreaterThan(6);
  expect((await sheet.sheetInfo()).frozen).toEqual(frozen);

  // Navigation must bring formerly frozen cells back into view.
  await page.keyboard.press("Control+Home");
  await sheet.waitForSelection(0, 3);
  await page.keyboard.press("Home");
  await sheet.waitForSelection(0, 0);
  await sheet.click(0, 0);

  await page.setViewportSize({ width: 820, height: 1100 });
  await expect
    .poll(() => sheet.area.evaluate((el) => el.clientHeight))
    .toBeGreaterThan(650);
  sheet.box = await sheet.area.boundingBox();
  await sheet.scroll(0, 400);
  await sheet.click(0, 0);

  // Narrowing the window suspends the columns independently too.
  await page.setViewportSize({ width: 500, height: 650 });
  await expect
    .poll(() => sheet.area.evaluate((el) => el.clientWidth))
    .toBeLessThan(500);
  sheet.box = await sheet.area.boundingBox();
  await sheet.scroll(400, 0);
  await sheet.scroll(0, 400);
  await sheet.click(0, 0, { wait: false });
  await expect
    .poll(async () => (await sheet.selection()).column[0])
    .toBeGreaterThan(2);
  await expect
    .poll(async () => (await sheet.selection()).row[0])
    .toBeGreaterThan(6);
  expect((await sheet.sheetInfo()).frozen).toEqual(frozen);

  await page.reload();
  await sheet.area.waitFor();
  sheet.box = await sheet.area.boundingBox();
  expect((await sheet.sheetInfo()).frozen).toEqual(frozen);
  await sheet.scroll(0, 400);
  await sheet.click(0, 0, { wait: false });
  await expect
    .poll(async () => (await sheet.selection()).row[0])
    .toBeGreaterThan(6);
});
