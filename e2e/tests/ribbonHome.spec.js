const { test, expect, toolbarButton } = require("../fixtures");

// Home tab of the ribbon: every group's commands, clicked like a user
// would, with their effect on the cells (Excel behaviour).

/** The stored cell object at (r, c), or null. */
const cellAt = (page, r, c) =>
  page.evaluate(
    ([row, col]) => window.__tinysheet.getSheet().data?.[row]?.[col] ?? null,
    [r, c]
  );

/** A field of the active sheet (config, tables, hyperlink, ...). */
const sheetField = (page, field) =>
  page.evaluate((f) => window.__tinysheet.getSheet()[f] ?? null, field);

const setValues = (page, values, r = 0, c = 0) =>
  page.evaluate(
    ([data, row, col]) =>
      window.__tinysheet.setCellValuesByRange(data, {
        row: [row, row + data.length - 1],
        column: [col, col + data[0].length - 1],
      }),
    [values, r, c]
  );

/** Click a ribbon button by its accessible name. */
async function press(page, name) {
  await (await toolbarButton(page, name)).click();
}

/** Open a ribbon drop-down and pick an entry by its id. */
async function pick(page, opener, id, submenu) {
  await press(page, opener);
  if (submenu) {
    await page.locator(`[data-menu-id="${submenu}"]`).hover();
  }
  await page.locator(`[data-menu-id="${id}"]`).click();
}

/** A swatch of the open colour drop-down. */
const swatch = (page, color) =>
  page
    .locator(`.ts-color-picker button[data-color="${color.toLowerCase()}"]`)
    .first();

test.describe("Home › Clipboard", () => {
  test("Copy, Paste Values, Formatting and Paste", async ({ sheet, page }) => {
    await setValues(page, [["alpha"]]);
    await page.evaluate(() => window.__tinysheet.setCellFormat(0, 0, "bl", 1));
    await sheet.click(0, 0);
    await press(page, "Copy");
    await expect(
      page.locator(".fortune-cell-area .fortune-selection-copy").first()
    ).toBeVisible();

    await sheet.click(0, 2);
    await pick(page, "Paste: more options", "paste-values");
    await expect.poll(() => sheet.value(0, 2)).toBe("alpha");
    expect((await cellAt(page, 0, 2)).bl ?? 0).toBe(0);

    await sheet.click(0, 3);
    await pick(page, "Paste: more options", "paste-formatting");
    await expect.poll(async () => (await cellAt(page, 0, 3))?.bl).toBe(1);
    expect(await sheet.value(0, 3)).toBeFalsy();

    await sheet.click(0, 4);
    await press(page, "Paste");
    await expect.poll(() => sheet.value(0, 4)).toBe("alpha");
    expect((await cellAt(page, 0, 4)).bl).toBe(1);
  });

  test("Cut moves the cells", async ({ sheet, page }) => {
    await setValues(page, [["move me"]]);
    await sheet.click(0, 0);
    await press(page, "Cut");
    await sheet.click(2, 1);
    await press(page, "Paste");
    await expect.poll(() => sheet.value(2, 1)).toBe("move me");
    await expect.poll(() => sheet.value(0, 0)).toBeFalsy();
  });

  test("Format Painter: once with a click, sticky with a double-click", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [["a", "b", "c", "d"]]);
    await page.evaluate(() => window.__tinysheet.setCellFormat(0, 0, "it", 1));
    await sheet.click(0, 0);
    const painter = await toolbarButton(page, "Format Painter");
    await painter.click();
    await expect(painter).toHaveAttribute("aria-pressed", "true");
    await sheet.click(0, 1, { wait: false });
    await expect.poll(async () => (await cellAt(page, 0, 1))?.it).toBe(1);
    await expect(painter).toHaveAttribute("aria-pressed", "false");

    await sheet.click(0, 0);
    await painter.dblclick();
    await expect(painter).toHaveAttribute("aria-pressed", "true");
    await sheet.click(0, 2, { wait: false });
    await sheet.click(0, 3, { wait: false });
    await expect.poll(async () => (await cellAt(page, 0, 3))?.it).toBe(1);
    expect((await cellAt(page, 0, 2)).it).toBe(1);
    await expect(painter).toHaveAttribute("aria-pressed", "true");
    await painter.click();
    await expect(painter).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Home › Font", () => {
  test("B I U S toggle and show the active cell's state", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [["text", "plain"]]);
    await sheet.click(0, 0);
    const bold = await toolbarButton(page, "Bold");
    await bold.click();
    await expect.poll(async () => (await cellAt(page, 0, 0)).bl).toBe(1);
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await press(page, "Italic");
    await press(page, "Strikethrough");
    await press(page, "Underline");
    await expect
      .poll(async () => {
        const c = await cellAt(page, 0, 0);
        return [c.it, c.cl, c.un];
      })
      .toEqual([1, 1, 1]);
    await pick(page, "More options for Underline", "double-underline");
    await expect.poll(async () => (await cellAt(page, 0, 0)).un).toBe(2);

    // another cell: the toggles follow it
    await sheet.click(0, 1);
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await sheet.click(0, 0);
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await bold.click();
    await expect.poll(async () => (await cellAt(page, 0, 0)).bl).toBe(0);
  });

  test("font and size boxes take typed values; grow / shrink step", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [["text"]]);
    await sheet.click(0, 0);
    const font = page.getByRole("combobox", { name: "Font", exact: true });
    await font.click();
    await font.fill("Verdana");
    await font.press("Enter");
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).ff)
      .toBe("Verdana");
    await expect(font).toHaveValue("Verdana");

    const size = page.getByRole("combobox", { name: "Font Size" });
    await size.click();
    await size.fill("14");
    await size.press("Enter");
    await expect.poll(async () => (await cellAt(page, 0, 0)).fs).toBe(14);
    await expect(size).toHaveValue("14");
    await press(page, "Increase Font Size");
    await expect.poll(async () => (await cellAt(page, 0, 0)).fs).toBe(16);
    await press(page, "Decrease Font Size");
    await press(page, "Decrease Font Size");
    await expect.poll(async () => (await cellAt(page, 0, 0)).fs).toBe(12);

    // the list
    await page.getByRole("button", { name: "Font Size: open list" }).click();
    await page.getByRole("menuitemradio", { name: "20" }).click();
    await expect.poll(async () => (await cellAt(page, 0, 0)).fs).toBe(20);
  });

  test("Fill Color and Font Color: last colour, grid, reset", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [["x"]]);
    await sheet.click(0, 0);
    await press(page, "Fill Color");
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).bg?.toUpperCase())
      .toBe("#FFFF00");
    await press(page, "More options for Fill Color");
    await swatch(page, "#00B050").click();
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).bg?.toUpperCase())
      .toBe("#00B050");
    // the main part now repeats the picked colour
    await sheet.click(1, 0);
    await press(page, "Fill Color");
    await expect
      .poll(async () => (await cellAt(page, 1, 0))?.bg?.toUpperCase())
      .toBe("#00B050");
    await press(page, "More options for Fill Color");
    await page.getByRole("button", { name: "No Fill" }).click();
    await expect
      .poll(async () => (await cellAt(page, 1, 0))?.bg ?? null)
      .toBe(null);

    await sheet.click(0, 0);
    await press(page, "Font Color");
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).fc?.toUpperCase())
      .toBe("#FF0000");
    await press(page, "More options for Font Color");
    await swatch(page, "#7030A0").click();
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).fc?.toUpperCase())
      .toBe("#7030A0");
    // More Colors…: a hex value
    await press(page, "More options for Font Color");
    await page.getByRole("button", { name: "More Colors…" }).click();
    const hex = page.getByLabel("Hex", { exact: true });
    await hex.fill("#123456");
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).fc?.toUpperCase())
      .toBe("#123456");
  });

  test("Borders: the gallery and the last used border", async ({
    sheet,
    page,
  }) => {
    await sheet.select(1, 1, 2, 2);
    const borders = () =>
      page.evaluate(() =>
        (window.__tinysheet.getSheet().config?.borderInfo ?? []).map((b) => [
          b.borderType,
          b.style,
        ])
      );
    await pick(page, "More options for Borders", "border-all");
    await expect.poll(borders).toEqual([["border-all", "1"]]);
    // the main part repeats it
    await expect(
      await toolbarButton(page, "Borders: All Borders")
    ).toBeVisible();
    await press(page, "Borders: All Borders");
    await expect.poll(async () => (await borders()).length).toBe(2);
    await pick(page, "More options for Borders", "border-thick-outside");
    await expect
      .poll(async () => (await borders()).at(-1))
      .toEqual(["border-outside", "13"]);
    await pick(page, "More options for Borders", "border-top-bottom-double");
    await expect
      .poll(async () => (await borders()).slice(-2))
      .toEqual([
        ["border-top", "1"],
        ["border-bottom", "7"],
      ]);
    await pick(page, "More options for Borders", "border-none");
    await expect
      .poll(async () => (await borders()).at(-1)[0])
      .toBe("border-none");
  });
});

test.describe("Home › Alignment", () => {
  test("vertical and horizontal alignment, wrap, orientation, indent", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [["text", "more"]]);
    await sheet.click(0, 0);
    const top = await toolbarButton(page, "Top Align");
    await top.click();
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).vt}`).toBe("1");
    await expect(top).toHaveAttribute("aria-pressed", "true");
    await press(page, "Bottom Align");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).vt}`).toBe("2");
    await press(page, "Middle Align");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).vt}`).toBe("0");

    const center = await toolbarButton(page, "Center");
    await center.click();
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).ht}`).toBe("0");
    await expect(center).toHaveAttribute("aria-pressed", "true");
    await press(page, "Align Right");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).ht}`).toBe("2");
    // a pressed alignment turns back to General
    await press(page, "Align Right");
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).ht ?? null)
      .toBe(null);
    await press(page, "Align Left");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).ht}`).toBe("1");

    const wrap = await toolbarButton(page, "Wrap Text");
    await wrap.click();
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).tb}`).toBe("2");
    await expect(wrap).toHaveAttribute("aria-pressed", "true");
    await wrap.click();
    await expect
      .poll(async () => (await cellAt(page, 0, 0)).tb ?? null)
      .toBe(null);

    await pick(page, "Orientation", "orientation-ccw");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).tr}`).toBe("1");
    await pick(page, "Orientation", "orientation-vertical");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).tr}`).toBe("3");
    // choosing the one in effect turns it off
    await pick(page, "Orientation", "orientation-vertical");
    await expect.poll(async () => `${(await cellAt(page, 0, 0)).tr}`).toBe("0");

    await press(page, "Increase Indent");
    await press(page, "Increase Indent");
    await expect.poll(async () => (await cellAt(page, 0, 0)).ind).toBe(2);
    await press(page, "Decrease Indent");
    await expect.poll(async () => (await cellAt(page, 0, 0)).ind).toBe(1);
  });

  test("Merge & Center, Merge Across, Unmerge", async ({ sheet, page }) => {
    await setValues(page, [["title", ""]]);
    await sheet.select(0, 0, 0, 2);
    const merge = await toolbarButton(page, "Merge & Center");
    await merge.click();
    await expect
      .poll(async () => (await cellAt(page, 0, 0))?.mc)
      .toMatchObject({ r: 0, c: 0, rs: 1, cs: 3 });
    expect(`${(await cellAt(page, 0, 0)).ht}`).toBe("0");
    await expect(merge).toHaveAttribute("aria-pressed", "true");
    // pressed: a click unmerges
    await merge.click();
    await expect
      .poll(async () => (await cellAt(page, 0, 0))?.mc ?? null)
      .toBe(null);

    await sheet.select(2, 0, 3, 2);
    await pick(page, "More options for Merge & Center", "merge-across");
    await expect
      .poll(async () => [
        (await cellAt(page, 2, 0))?.mc?.cs,
        (await cellAt(page, 3, 0))?.mc?.cs,
      ])
      .toEqual([3, 3]);
    await sheet.click(2, 0, { wait: false });
    await pick(page, "More options for Merge & Center", "merge-cancel");
    await expect
      .poll(async () => (await cellAt(page, 2, 0))?.mc ?? null)
      .toBe(null);
  });
});

test.describe("Home › Number", () => {
  test("format box, accounting, percent, comma, decimals", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [[1234.5]]);
    await sheet.click(0, 0);
    const fa = async () => (await cellAt(page, 0, 0))?.ct?.fa;
    const box = await toolbarButton(page, /^Number Format: /);
    await expect(box).toHaveAttribute("aria-label", "Number Format: General");
    await box.click();
    await page.locator('[data-menu-id="number-format-percentage"]').click();
    await expect.poll(fa).toBe("0.00%");
    await expect(box).toHaveAttribute(
      "aria-label",
      "Number Format: Percentage"
    );
    await box.click();
    await page.locator('[data-menu-id="number-format-longDate"]').click();
    await expect.poll(fa).toBe("dddd, mmmm d, yyyy");
    await box.click();
    await page.locator('[data-menu-id="number-format-text"]').click();
    await expect.poll(fa).toBe("@");

    await press(page, "Accounting Number Format");
    await expect.poll(fa).toContain('"$"');
    await pick(
      page,
      "More options for Accounting Number Format",
      "accounting-euro"
    );
    await expect.poll(fa).toContain('"€"');
    await press(page, "Percent Style");
    await expect.poll(fa).toBe("0%");
    await press(page, "Increase Decimal");
    await expect.poll(fa).toBe("0.0%");
    await press(page, "Decrease Decimal");
    await expect.poll(fa).toBe("0%");
    await press(page, "Comma Style");
    await expect.poll(fa).toMatch(/^_\(\* #,##0\.00_\)/);
    await expect.poll(() => sheet.value(0, 0, "m")).toContain("1,234.50");

    await box.click();
    await page.locator('[data-menu-id="number-format-more"]').click();
    await expect(page.locator(".fortune-format-cells")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Home › Styles", () => {
  test("Conditional Formatting: rules dialog and a data bar", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [[1], [5], [9]]);
    await sheet.select(0, 0, 2, 0);
    await pick(
      page,
      "Conditional Formatting",
      "greaterThan",
      "highlightCellRules"
    );
    await expect(
      page.getByRole("button", { name: "OK" }).first()
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await press(page, "Conditional Formatting");
    await page.locator('[data-menu-id="dataBar"]').hover();
    await page
      .locator(".fortune-cf-preset-gallery .ts-gallery-item")
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (await sheetField(page, "luckysheet_conditionformat_save"))?.length
      )
      .toBe(1);
    await pick(page, "Conditional Formatting", "clear-sheet", "deleteRule");
    await expect
      .poll(
        async () =>
          (await sheetField(page, "luckysheet_conditionformat_save"))?.length ??
          0
      )
      .toBe(0);
  });

  test("Format as Table and Cell Styles", async ({ sheet, page }) => {
    await setValues(page, [
      ["Region", "Qty"],
      ["East", 2],
      ["West", 1],
    ]);
    await sheet.select(0, 0, 2, 1);
    await press(page, "Format as Table");
    await page.getByRole("button", { name: "Blue", exact: true }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect
      .poll(async () => (await sheetField(page, "tables"))?.[0]?.name)
      .toBe("Table1");

    await sheet.click(4, 3);
    await press(page, "Cell Styles");
    await page.getByRole("button", { name: "Bad", exact: true }).click();
    await expect
      .poll(async () => (await cellAt(page, 4, 3))?.bg?.toUpperCase())
      .toBe("#FFC7CE");
  });
});

test.describe("Home › Cells", () => {
  test("Insert and Delete rows, columns, cells and sheets", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [
      ["a1", "b1"],
      ["a2", "b2"],
      ["a3", "b3"],
    ]);
    await sheet.click(1, 0);
    await pick(page, "Insert: more options", "insert-rows");
    await expect
      .poll(() => sheet.column(0, 0, 3))
      .toEqual(["a1", null, "a2", "a3"]);
    await pick(page, "Delete: more options", "delete-rows");
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual(["a1", "a2", "a3"]);

    await sheet.click(0, 1);
    await pick(page, "Insert: more options", "insert-columns");
    await expect.poll(() => sheet.value(0, 2)).toBe("b1");
    await pick(page, "Delete: more options", "delete-columns");
    await expect.poll(() => sheet.value(0, 1)).toBe("b1");

    // the main part: cells, shifted down / up
    await sheet.click(0, 0);
    await press(page, "Insert");
    await expect
      .poll(() => sheet.column(0, 0, 3))
      .toEqual([null, "a1", "a2", "a3"]);
    expect(await sheet.value(0, 1)).toBe("b1");
    await press(page, "Delete");
    await expect.poll(() => sheet.column(0, 0, 2)).toEqual(["a1", "a2", "a3"]);

    // Insert Cells… opens the dialog
    await pick(page, "Insert: more options", "insert-cells");
    await expect(page.getByLabel("Shift cells down")).toBeVisible();
    await page.keyboard.press("Escape");

    const sheets = () =>
      page.evaluate(() => window.__tinysheet.getAllSheets().length);
    await pick(page, "Insert: more options", "insert-sheet");
    await expect.poll(sheets).toBe(2);
    await expect.poll(() => sheet.value(0, 0)).toBeFalsy();
    await pick(page, "Delete: more options", "delete-sheet");
    await expect.poll(sheets).toBe(1);
    await expect.poll(() => sheet.value(0, 0)).toBe("a1");
  });

  test("Format: sizes, hide and unhide, tab colour, lock", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [["x"], ["y"], ["z"]]);
    await sheet.click(1, 0);
    await pick(page, "Format", "format-row-height");
    const input = page.locator("#fortune-row-size-input");
    await input.fill("40");
    await input.press("Enter");
    await expect
      .poll(async () => (await sheetField(page, "config"))?.rowlen?.[1])
      .toBe(40);

    await pick(page, "Format", "format-column-width");
    const width = page.locator("#fortune-column-size-input");
    await width.fill("120");
    await width.press("Enter");
    await expect
      .poll(async () => (await sheetField(page, "config"))?.columnlen?.[0])
      .toBe(120);

    await sheet.click(1, 0);
    await pick(page, "Format", "hide-rows", "format-hide-unhide");
    await expect
      .poll(async () =>
        Object.keys((await sheetField(page, "config"))?.rowhidden ?? {})
      )
      .toEqual(["1"]);
    await page.evaluate(() =>
      window.__tinysheet.setSelection([{ row: [0, 2], column: [0, 0] }])
    );
    await pick(page, "Format", "unhide-rows", "format-hide-unhide");
    await expect
      .poll(async () =>
        Object.keys((await sheetField(page, "config"))?.rowhidden ?? {})
      )
      .toEqual([]);

    await press(page, "Format");
    await page.locator('[data-menu-id="format-tab-color"]').hover();
    await swatch(page, "#FFC000").click();
    await expect
      .poll(async () => (await sheetField(page, "color"))?.toUpperCase())
      .toBe("#FFC000");

    await sheet.click(0, 0);
    await pick(page, "Format", "format-lock-cell");
    await expect
      .poll(async () => `${(await cellAt(page, 0, 0))?.lo}`)
      .toBe("0");
  });
});

test.describe("Home › Editing", () => {
  test("AutoSum and its functions", async ({ sheet, page }) => {
    await setValues(page, [[2], [3], [5]]);
    await sheet.click(3, 0);
    await press(page, "AutoSum");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(3, 0)).toBe("=SUM(A1:A3)");
    await expect.poll(() => sheet.value(3, 0)).toBe(10);

    await sheet.click(3, 1);
    await setValues(page, [[4], [6]], 0, 1);
    await sheet.click(2, 1);
    await pick(page, "More options for AutoSum", "autosum-average");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.formula(2, 1)).toBe("=AVERAGE(B1:B2)");
    await expect.poll(() => sheet.value(2, 1)).toBe(5);
  });

  test("Fill down, right, up, left and Series", async ({ sheet, page }) => {
    await setValues(page, [["top"]], 0, 0);
    await sheet.select(0, 0, 2, 0);
    await pick(page, "Fill", "fill-down");
    await expect
      .poll(() => sheet.column(0, 0, 2))
      .toEqual(["top", "top", "top"]);

    await setValues(page, [["left"]], 5, 0);
    await sheet.select(5, 0, 5, 2);
    await pick(page, "Fill", "fill-right");
    await expect.poll(() => sheet.value(5, 2)).toBe("left");

    await setValues(page, [["bottom"]], 10, 4);
    await sheet.select(8, 4, 10, 4);
    await pick(page, "Fill", "fill-up");
    await expect
      .poll(() => sheet.column(4, 8, 10))
      .toEqual(["bottom", "bottom", "bottom"]);

    await setValues(page, [["right"]], 12, 3);
    await sheet.select(12, 1, 12, 3);
    await pick(page, "Fill", "fill-left");
    await expect.poll(() => sheet.value(12, 1)).toBe("right");

    await setValues(page, [[1]], 14, 0);
    await sheet.select(14, 0, 18, 0);
    await pick(page, "Fill", "fill-series");
    await page.getByRole("spinbutton", { name: "Step value" }).fill("2");
    await page.getByRole("spinbutton", { name: "Step value" }).press("Tab");
    await page.getByRole("button", { name: "OK" }).click();
    await expect.poll(() => sheet.column(0, 14, 18)).toEqual([1, 3, 5, 7, 9]);
  });

  test("Clear: formats, contents, comments, hyperlinks, all", async ({
    sheet,
    page,
  }) => {
    await setValues(page, [[12.5, "keep"]]);
    await page.evaluate(() => {
      const wb = window.__tinysheet;
      wb.setCellFormat(0, 0, "bl", 1);
      wb.setCellFormat(0, 0, "bg", "#ff0000");
    });
    await sheet.click(0, 0);
    await press(page, "Percent Style");
    await expect.poll(async () => (await cellAt(page, 0, 0)).ct?.fa).toBe("0%");
    await pick(page, "Clear", "clear-formats");
    await expect
      .poll(async () => {
        const c = await cellAt(page, 0, 0);
        return [c.bl ?? null, c.bg ?? null, c.ct?.fa, c.v];
      })
      .toEqual([null, null, "General", 12.5]);

    await page.evaluate(() => window.__tinysheet.setCellFormat(0, 1, "it", 1));
    await sheet.click(0, 1);
    await pick(page, "Clear", "clear-contents");
    await expect.poll(() => sheet.value(0, 1)).toBeFalsy();
    expect((await cellAt(page, 0, 1)).it).toBe(1);

    await page.evaluate(() =>
      window.__tinysheet.setCellFormat(0, 1, "ps", { value: "a note" })
    );
    await pick(page, "Clear", "clear-comments");
    await expect
      .poll(async () => (await cellAt(page, 0, 1))?.ps ?? null)
      .toBe(null);

    await setValues(page, [["all"]], 2, 2);
    await page.evaluate(() => window.__tinysheet.setCellFormat(2, 2, "bl", 1));
    await sheet.click(2, 2);
    await pick(page, "Clear", "clear-all");
    await expect
      .poll(async () => {
        const c = await cellAt(page, 2, 2);
        return [c?.v ?? null, c?.bl ?? null];
      })
      .toEqual([null, null]);
  });

  test("Sort & Filter", async ({ sheet, page }) => {
    await setValues(page, [
      ["Name", "Qty"],
      ["pear", 3],
      ["apple", 1],
      ["fig", 2],
    ]);
    await sheet.click(1, 0);
    await pick(page, "Sort & Filter", "sort-az");
    await expect
      .poll(() => sheet.column(0, 0, 3))
      .toEqual(["Name", "apple", "fig", "pear"]);
    await pick(page, "Sort & Filter", "sort-za");
    await expect
      .poll(() => sheet.column(0, 0, 3))
      .toEqual(["Name", "pear", "fig", "apple"]);

    await pick(page, "Sort & Filter", "filter-toggle");
    // a filter button on each column of the data
    await expect(page.locator(".luckysheet-filter-options")).toHaveCount(2);
    await pick(page, "Sort & Filter", "filter-toggle");
    await expect(page.locator(".luckysheet-filter-options")).toHaveCount(0);

    await pick(page, "Sort & Filter", "sort-custom");
    await expect(page.locator(".fortune-sort-dialog")).toBeVisible();
  });

  test("Find & Select", async ({ sheet, page }) => {
    await setValues(page, [
      ["a", 1],
      ["=B1*2", "text"],
    ]);
    await sheet.click(0, 0);
    await pick(page, "Find & Select", "find");
    await expect(page.locator("#fortune-search-replace")).toBeVisible();
    await page.keyboard.press("Escape");

    await sheet.click(4, 4);
    await pick(page, "Find & Select", "select-formulas");
    await expect
      .poll(() => sheet.selection())
      .toEqual({
        row: [1, 1],
        column: [0, 0],
      });

    await pick(page, "Find & Select", "go-to");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Home › keyboard", () => {
  test("arrow keys move between the ribbon's buttons", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const bold = await toolbarButton(page, "Bold");
    await bold.focus();
    await page.keyboard.press("ArrowRight");
    await expect(await toolbarButton(page, "Italic")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(bold).toBeFocused();
    // ArrowDown opens a split button's menu with the first entry focused
    const arrow = await toolbarButton(page, "More options for Borders");
    await arrow.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-menu-id="border-bottom"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(arrow).toBeFocused();
  });
});
