const {
  test,
  expect,
  Sheet,
  ribbonItem,
  ribbonTab,
  storyUrl,
} = require("../fixtures");

// The ribbon's Formulas, Data and Review tabs and the File menu: every
// command, driven from the ribbon (and the keyboard shortcuts its tooltips
// name), checked against the model.

/** The (main) button of ribbon command `id`, on whichever tab holds it. */
async function command(page, id) {
  const button = await ribbonItem(page, `[data-item="${id}"] button`);
  await expect(button).toBeVisible();
  return button;
}

/** The drop-down arrow of a split command (or its only button). */
async function arrow(page, id) {
  return ribbonItem(page, `[data-item="${id}"] button[aria-haspopup]`);
}

const run = async (page, id) => (await command(page, id)).click();

const editorText = (page) =>
  page.evaluate(
    () => document.querySelector(".luckysheet-cell-input")?.textContent ?? ""
  );

const dialog = (page) => page.locator("[role=dialog]").last();

async function cancelEdit(page) {
  await page.keyboard.press("Escape");
  await expect.poll(() => editorText(page)).toBe("");
}

test.describe("Formulas tab", () => {
  test("shows Excel's groups and labels", async ({ sheet, page }) => {
    await ribbonTab(page, "formulas");
    const groups = page.locator(".fortune-ribbon [data-ribbon-group]");
    await expect(groups).toHaveText([
      /Function Library/,
      /Defined Names/,
      /Formula Auditing/,
      /Calculation/,
    ]);
    for (const name of [
      "Insert Function",
      "AutoSum",
      "Recently Used",
      "Financial",
      "Logical",
      "Text",
      "Date & Time",
      "Lookup & Reference",
      "Math & Trig",
      "More Functions",
      "Name Manager",
      "Define Name",
      "Use in Formula",
      "Create from Selection",
      "Trace Precedents",
      "Trace Dependents",
      "Remove Arrows",
      "Show Formulas",
      "Error Checking",
      "Evaluate Formula",
      "Watch Window",
      "Calculation Options",
      "Calculate Now",
      "Calculate Sheet",
    ]) {
      await expect(
        page
          .locator(".fortune-ribbon")
          .getByRole("button", { name, exact: true })
      ).toBeVisible();
    }
    // a tooltip names the command and its shortcut
    await page
      .locator(".fortune-ribbon")
      .getByRole("button", { name: "Insert Function", exact: true })
      .hover();
    const tip = page.locator(".ts-tooltip");
    await expect(tip).toContainText("Insert Function");
    await expect(tip).toContainText("Shift+F3");
    void sheet;
  });

  test("Insert Function: search, categories, description, insert", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    await run(page, "insert-function");
    const d = dialog(page);
    await expect(d).toContainText("Insert Function");
    // the search field has the keyboard; the Recently Used list shows
    await expect(d.getByRole("searchbox")).toBeFocused();
    await expect(
      d.locator('[role=option][aria-selected="true"]').first()
    ).toContainText("Most Recently Used");
    // a category lists its functions, the selected one is described
    await d.locator('[data-category="math"]').click();
    await d.locator('[data-function="ABS"]').click();
    await expect(d.locator(".fortune-insert-function-sig")).toHaveText(
      "ABS(number)"
    );
    await expect(d.locator(".fortune-insert-function-desc")).toContainText(
      "absolute value"
    );
    // search, arrow keys and Enter
    await d.getByRole("searchbox").fill("vlook");
    await expect(d.locator('[data-function="VLOOKUP"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");
    await expect(d).toHaveCount(0);
    await expect.poll(() => editorText(page)).toBe("=VLOOKUP(");
    await cancelEdit(page);

    // Shift+F3 opens it too; a double-click inserts
    await sheet.click(1, 0);
    await page.keyboard.press("Shift+F3");
    await expect(dialog(page)).toContainText("Insert Function");
    await dialog(page).locator('[data-category="logical"]').click();
    await dialog(page).locator('[data-function="IF"]').dblclick();
    await expect.poll(() => editorText(page)).toBe("=IF(");
    await cancelEdit(page);
    // the function used last heads Recently Used
    await run(page, "insert-function");
    await expect(
      dialog(page).locator(".fortune-insert-function-item").first()
    ).toHaveAttribute("data-function", "IF");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test("AutoSum sums the cells above; its menu picks the function", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["1", "2", "3"]);
    await sheet.click(3, 0);
    await run(page, "formulas-autosum");
    await expect.poll(() => editorText(page)).toBe("=SUM(A1:A3)");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(3, 0)).toBe(6);

    await sheet.click(0, 1);
    await sheet.fillColumn(0, 1, ["4", "8"]);
    await sheet.click(2, 1);
    await (await arrow(page, "formulas-autosum")).click();
    const menu = page.getByRole("menu", { name: "AutoSum" });
    await expect(menu.getByRole("menuitem")).toHaveText([
      /Sum/,
      /Average/,
      /Count Numbers/,
      /Max/,
      /Min/,
      /More Functions/,
    ]);
    await menu.getByRole("menuitem", { name: /Average/ }).click();
    await expect.poll(() => editorText(page)).toBe("=AVERAGE(B1:B2)");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(2, 1)).toBe(6);

    // Alt+= is AutoSum
    await sheet.fillColumn(0, 2, ["5", "5"]);
    await sheet.click(2, 2);
    await page.keyboard.press("Alt+Equal");
    await expect.poll(() => editorText(page)).toBe("=SUM(C1:C2)");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(2, 2)).toBe(10);
  });

  test("category menus list functions with their syntax and insert one", async ({
    sheet,
    page,
  }) => {
    test.slow(); // many menus and dialogs
    await sheet.click(0, 0);
    const categories = [
      ["functions-financial", "PMT"],
      ["functions-logical", "IF"],
      ["functions-text", "CONCAT"],
      ["functions-datetime", "TODAY"],
      ["functions-lookup", "XLOOKUP"],
      ["functions-math", "SUM"],
      ["functions-recent", "AVERAGE"],
    ];
    for (const [id, fn] of categories) {
      await (await arrow(page, id)).click();
      const menu = page.locator(".fortune-fn-menu");
      await expect(menu).toBeVisible();
      const item = menu.locator(`[data-menu-id="fn:${fn}"]`);
      await item.scrollIntoViewIfNeeded();
      await item.hover();
      await expect(menu.locator(".fortune-fn-menu-sig")).toContainText(
        `${fn}(`
      );
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }
    // keyboard: open, type-ahead, Enter inserts
    const logical = await arrow(page, "functions-logical");
    await logical.focus();
    await page.keyboard.press("Enter");
    const menu = page.locator(".fortune-fn-menu");
    await expect(
      menu.locator('[role=menuitem][data-menu-id="fn:AND"]')
    ).toBeFocused();
    await page.keyboard.press("i");
    await expect(menu.locator('[data-menu-id="fn:IF"]')).toBeFocused();
    await expect(menu.locator(".fortune-fn-menu-sig")).toContainText(
      "IF(logical_test"
    );
    await page.keyboard.press("Enter");
    await expect.poll(() => editorText(page)).toBe("=IF(");
    await cancelEdit(page);

    // More Functions: category submenus
    await sheet.click(0, 0);
    await (await arrow(page, "functions-more")).click();
    await expect(
      menu.locator("[role=menuitem][data-menu-id^='cat:']")
    ).toHaveText([
      "Statistical",
      "Engineering",
      "Information",
      "Compatibility",
      "Web",
    ]);
    await menu.locator('[data-menu-id="cat:statistical"]').click();
    await menu.locator('[data-menu-id="fn:statistical:MEDIAN"]').click();
    await expect.poll(() => editorText(page)).toBe("=MEDIAN(");
    await cancelEdit(page);

    // while a formula is typed, the function goes in at the caret
    await sheet.click(3, 3);
    await page.keyboard.type("=1+");
    await (await arrow(page, "functions-math")).click();
    await menu.locator('[data-menu-id="fn:ABS"]').click();
    await expect.poll(() => editorText(page)).toBe("=1+ABS(");
    await page.keyboard.type("-3)");
    await page.keyboard.press("Enter");
    await expect.poll(() => sheet.value(3, 3)).toBe(4);

    // Insert Function… under a list opens the dialog on that category
    await (await arrow(page, "functions-text")).click();
    await menu.locator('[data-menu-id="insert-function"]').click();
    await expect(
      dialog(page).locator('[data-category="text"]')
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
  });

  test("Defined Names: Create from Selection, Use in Formula, Name Manager, Define Name", async ({
    sheet,
    page,
  }) => {
    test.slow(); // many menus and dialogs
    await sheet.fillColumn(0, 0, ["Price", "10", "20"]);
    await sheet.select(0, 0, 2, 0);
    await run(page, "create-from-selection");
    await dialog(page).getByRole("button", { name: "OK" }).click();
    // Name Manager lists the new name
    await expect(dialog(page)).toContainText("Price");
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);

    await sheet.click(0, 2);
    await (await arrow(page, "use-in-formula")).click();
    await page.getByRole("menuitem", { name: "Price" }).click();
    await expect.poll(() => editorText(page)).toBe("=Price");
    await page.keyboard.type(")");
    await cancelEdit(page);

    await run(page, "nameManager");
    await expect(dialog(page)).toContainText("Name Manager");
    await expect(dialog(page)).toContainText("=Sheet1!$A$2:$A$3");
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);
    // Ctrl+F3 opens it from the grid
    await sheet.click(4, 4);
    await page.keyboard.press("Control+F3");
    await expect(dialog(page)).toContainText("Name Manager");
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);
    // Ctrl+Shift+F3: Create from Selection
    await sheet.select(0, 0, 2, 0);
    await page.keyboard.press("Control+Shift+F3");
    await expect(dialog(page)).toContainText("Top row");
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);

    await sheet.click(1, 0);
    await run(page, "define-name");
    await expect(dialog(page)).toContainText("New Name");
    await page.keyboard.press("Escape");
  });

  test("Formula Auditing from the ribbon", async ({ sheet, page }) => {
    await sheet.fillColumn(0, 0, [1, 2, 3, "=SUM(A1:A3)", "=A4*2"]);
    await expect.poll(() => sheet.column(0, 0, 4)).toEqual([1, 2, 3, 6, 12]);
    await sheet.click(4, 0);
    await run(page, "trace-precedents");
    await expect(page.locator(".fortune-trace-arrow")).toHaveCount(1);
    await expect(await command(page, "remove-arrows")).toBeEnabled();
    await sheet.click(0, 0);
    await run(page, "trace-dependents");
    await expect(
      page.locator('.fortune-trace-arrow[data-kind="dependent"]')
    ).toHaveCount(1);
    // Remove Arrows ▾: only the precedent arrows, then all
    await (await arrow(page, "remove-arrows")).click();
    await page
      .getByRole("menuitem", { name: "Remove Precedent Arrows" })
      .click();
    await expect(page.locator(".fortune-trace-arrow")).toHaveCount(1);
    await run(page, "remove-arrows");
    await expect(page.locator(".fortune-trace-arrows")).toHaveCount(0);
    await expect(await command(page, "remove-arrows")).toBeDisabled();

    // Show Formulas is a toggle
    const show = await command(page, "show-formulas");
    await expect(show).toHaveAttribute("aria-pressed", "false");
    await show.click();
    await expect(show).toHaveAttribute("aria-pressed", "true");
    await show.click();
    await expect(show).toHaveAttribute("aria-pressed", "false");

    // Error Checking goes to the next cell with an error
    await sheet.enter(0, 3, "=1/0");
    await sheet.click(0, 0);
    await run(page, "error-checking");
    await sheet.waitForSelection(0, 3);
    await (await arrow(page, "error-checking")).click();
    await expect(page.getByRole("menuitem")).toContainText([
      "Error Checking…",
      "Trace Error",
      "Circular References",
      "Error Checking Options…",
    ]);
    await page.keyboard.press("Escape");

    // Evaluate Formula and the Watch Window
    await sheet.click(4, 0);
    await run(page, "evaluate-formula");
    await expect(dialog(page)).toContainText("Evaluate Formula");
    await page.keyboard.press("Escape");
    const watch = await command(page, "watch-window");
    await watch.click();
    await expect(page.locator(".fortune-watch-window")).toBeVisible();
    await expect(watch).toHaveAttribute("aria-pressed", "true");
    await watch.click();
    await expect(page.locator(".fortune-watch-window")).toHaveCount(0);
  });

  test("Calculation: Options › Manual, Calculate Sheet, Calculate Now", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, [1, 2, 3, "=SUM(A1:A3)"]);
    await expect.poll(() => sheet.value(3, 0)).toBe(6);
    await run(page, "calculation-options");
    await page.getByRole("menuitemradio", { name: "Manual" }).click();
    await run(page, "calculation-options");
    await expect(
      page.getByRole("menuitemradio", { name: "Manual" })
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await sheet.enter(0, 0, "=10");
    await expect.poll(() => sheet.value(3, 0)).toBe(6);
    await run(page, "calculate-sheet");
    await expect.poll(() => sheet.value(3, 0)).toBe(15);
    await sheet.enter(0, 0, "=20");
    await run(page, "calculate-now");
    await expect.poll(() => sheet.value(3, 0)).toBe(25);
    await run(page, "calculation-options");
    await page
      .getByRole("menuitemradio", { name: "Automatic", exact: true })
      .click();
  });
});

test.describe("Data tab", () => {
  test("Sort A to Z / Z to A, Sort…, Filter toggle and its shortcut", async ({
    sheet,
    page,
  }) => {
    await sheet.fillColumn(0, 0, ["pear", "apple", "fig"]);
    await sheet.select(0, 0, 2, 0);
    await run(page, "data-sort-asc");
    await expect
      .poll(() => sheet.column(0, 0, 2))
      .toEqual(["apple", "fig", "pear"]);
    await run(page, "data-sort-desc");
    await expect
      .poll(() => sheet.column(0, 0, 2))
      .toEqual(["pear", "fig", "apple"]);
    await run(page, "data-sort");
    await expect(page.locator("[role=dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);

    // Filter: pressed while the sheet has filter buttons
    await sheet.click(0, 0);
    const filter = await command(page, "data-filter");
    await expect(filter).toHaveAttribute("aria-pressed", "false");
    await expect(await command(page, "data-filter-clear")).toBeDisabled();
    await expect(await command(page, "data-filter-reapply")).toBeDisabled();
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(() => !!window.__tinysheet.getSheet().filter_select)
      )
      .toBe(true);
    await sheet.click(1, 0);
    await page.keyboard.press("Control+Shift+L");
    await expect(filter).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Control+Shift+L");
    await expect(filter).toHaveAttribute("aria-pressed", "true");
  });

  test("Data Tools: Text to Columns, Flash Fill, Remove Duplicates, Data Validation", async ({
    sheet,
    page,
  }) => {
    test.slow(); // many menus and dialogs
    await sheet.fillColumn(0, 0, ["a,b", "a,b", "c,d"]);
    await sheet.select(0, 0, 2, 0);
    await run(page, "splitColumn");
    await expect(page.locator("[role=dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);

    await sheet.select(0, 0, 2, 0);
    await run(page, "remove-duplicates");
    await expect(page.locator("[role=dialog]")).toContainText(
      /Remove Duplicates/i
    );
    await page.keyboard.press("Escape");

    await sheet.fillColumn(4, 0, [
      "nancy.davolio@contoso.com",
      "andrew.fuller@contoso.com",
    ]);
    await sheet.enter(4, 1, "Nancy Davolio");
    await sheet.click(5, 1);
    await run(page, "flash-fill");
    await expect.poll(() => sheet.value(5, 1)).toBe("Andrew Fuller");

    await sheet.click(0, 3);
    await run(page, "dataVerification");
    await expect(page.locator("[role=dialog]")).toContainText(
      /Data Validation/i
    );
    await page.keyboard.press("Escape");
    await (await arrow(page, "dataVerification")).click();
    await expect(
      page.getByRole("menu", { name: "Data Validation" })
    ).toContainText("Circle Invalid Data");
    const rules = page.getByRole("menuitemcheckbox", {
      name: /Validation Rules/,
    });
    await expect(rules).toHaveAttribute("aria-checked", "false");
    await rules.click();
    await (await arrow(page, "dataVerification")).click();
    await expect(rules).toHaveAttribute("aria-checked", "true");
    await rules.click();
  });

  test("What-If Analysis and Outline: Group, Hide / Show Detail, Ungroup, Subtotal", async ({
    sheet,
    page,
  }) => {
    await run(page, "data-tools");
    const whatIf = page.getByRole("menu", { name: "What-If Analysis" });
    await expect(whatIf.getByRole("menuitem")).toHaveText([
      /Goal Seek/,
      /Data Table/,
      /Recalculate Data Tables/,
    ]);
    await page.keyboard.press("Escape");

    await sheet.fillColumn(0, 0, ["Head", "1", "2", "3"]);
    await sheet.select(1, 0, 2, 0);
    await run(page, "outline");
    // a plain range asks "Rows or Columns?"
    await dialog(page).getByRole("button", { name: "OK" }).click();
    await expect(
      page.getByRole("button", { name: "Collapse group (rows 2–3)" })
    ).toBeVisible();
    // the outline gutter moved the cells
    sheet.box = await sheet.area.boundingBox();
    await sheet.click(1, 0);
    await run(page, "outline-hide-detail");
    await expect(
      page.getByRole("button", { name: "Expand group (rows 2–3)" })
    ).toBeVisible();
    await run(page, "outline-show-detail");
    await expect(
      page.getByRole("button", { name: "Collapse group (rows 2–3)" })
    ).toBeVisible();
    await sheet.select(1, 0, 2, 0);
    await run(page, "outline-ungroup");
    await dialog(page).getByRole("button", { name: "OK" }).click();
    await expect(
      page.getByRole("button", { name: "Collapse group (rows 2–3)" })
    ).toHaveCount(0);
    sheet.box = await sheet.area.boundingBox();

    await sheet.click(1, 0);
    await run(page, "outline-subtotal");
    await expect(page.getByTestId("subtotal-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Review tab", () => {
  const STORY = "features-threaded-comments--light";

  test("Comments: New, Previous / Next, Delete, Show Comments", async ({
    page,
  }) => {
    const sheet = new Sheet(page);
    await sheet.open(STORY);
    const threads = () =>
      page.evaluate(
        () => window.__tinysheet.getSheet().threadedComments?.length ?? 0
      );
    const before = await threads();
    await sheet.click(0, 0);
    await run(page, "review-next-comment");
    await expect(page.locator(".fortune-thread-card")).toBeVisible();
    const first = await sheet.selection();
    await run(page, "review-next-comment");
    await expect.poll(() => sheet.selection()).not.toEqual(first);
    await run(page, "review-previous-comment");
    await expect.poll(() => sheet.selection()).toEqual(first);

    await sheet.click(10, 5);
    await run(page, "review-new-comment");
    const card = page.locator(".fortune-thread-card");
    await expect(card.locator("textarea")).toBeFocused();
    await page.keyboard.type("Check this");
    await page.keyboard.press("Control+Enter");
    await expect.poll(threads).toBe(before + 1);
    await page.keyboard.press("Escape");

    await sheet.click(10, 5);
    await expect(await command(page, "review-delete-comment")).toBeEnabled();
    await run(page, "review-delete-comment");
    await expect.poll(threads).toBe(before);

    const pane = await command(page, "review-show-comments");
    await pane.click();
    await expect(pane).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".fortune-comments-pane")).toBeVisible();
    await pane.click();
    await expect(pane).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".fortune-comments-pane")).toHaveCount(0);
  });

  test("Notes menu: New, Show / Hide, Next, Delete, Convert to Comments", async ({
    sheet,
    page,
  }) => {
    const note = (r, c) =>
      page.evaluate(
        ([row, col]) =>
          window.__tinysheet.getSheet().data?.[row]?.[col]?.ps ?? null,
        [r, c]
      );
    await sheet.click(1, 1);
    await run(page, "review-notes");
    const menu = page.getByRole("menu", { name: "Notes" });
    await expect(
      menu.getByRole("menuitem", { name: /Delete Note/ })
    ).toHaveAttribute("aria-disabled", "true");
    await menu.getByRole("menuitem", { name: /New Note/ }).click();
    await expect.poll(() => note(1, 1)).not.toBeNull();
    await page.keyboard.type("Remember");
    await sheet.click(5, 5);

    // Shift+F2 on another cell adds a second note
    await sheet.click(3, 2);
    await page.keyboard.press("Shift+F2");
    await expect.poll(() => note(3, 2)).not.toBeNull();
    await page.keyboard.type("Second");
    await sheet.click(0, 0);

    await run(page, "review-notes");
    await menu.getByRole("menuitem", { name: "Next Note" }).click();
    await sheet.waitForSelection(1, 1);
    await run(page, "review-notes");
    await menu.getByRole("menuitem", { name: "Next Note" }).click();
    await sheet.waitForSelection(3, 2);

    await run(page, "review-notes");
    await menu
      .getByRole("menuitemcheckbox", { name: "Show/Hide Note" })
      .click();
    await expect.poll(async () => (await note(3, 2))?.isShow).toBe(true);
    await run(page, "review-notes");
    await menu.getByRole("menuitem", { name: /Delete Note/ }).click();
    await expect.poll(() => note(3, 2)).toBeNull();

    await run(page, "review-notes");
    await menu.getByRole("menuitem", { name: "Convert to Comments" }).click();
    await page
      .getByRole("button", { name: /Yes|OK|Confirm/ })
      .first()
      .click();
    await expect.poll(() => note(1, 1)).toBeNull();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__tinysheet.getSheet().threadedComments?.[0]?.text
        )
      )
      .toBe("Remember");
  });

  test("Protect: Protect / Unprotect Sheet toggles, Protect Workbook, Allow Edit Ranges", async ({
    sheet,
    page,
  }) => {
    await sheet.click(0, 0);
    const protect = await command(page, "protection");
    await expect(protect).toHaveAccessibleName("Protect Sheet");
    await expect(protect).toHaveAttribute("aria-pressed", "false");
    await run(page, "allow-edit-ranges");
    await expect(page.getByTestId("allow-edit-ranges-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);

    await protect.click();
    await page.getByTestId("protection-ok").click();
    await expect(protect).toHaveAccessibleName("Unprotect Sheet");
    await expect(protect).toHaveAttribute("aria-pressed", "true");
    await expect(await command(page, "allow-edit-ranges")).toBeDisabled();
    await protect.click();
    await expect(protect).toHaveAccessibleName("Protect Sheet");

    const book = await command(page, "protect-workbook");
    await book.click();
    await page.getByTestId("protection-ok").click();
    await expect(book).toHaveAccessibleName("Unprotect Workbook");
    await expect(book).toHaveAttribute("aria-pressed", "true");
    await book.click();
    await expect(book).toHaveAccessibleName("Protect Workbook");
  });
});

test.describe("File menu", () => {
  test("New, Open…, Save As ▸, Print… by mouse and keyboard", async ({
    page,
  }) => {
    await page.goto(storyUrl("e2e-harness--file-actions"));
    await page.locator(".fortune-cell-area").waitFor();
    const actions = () => page.evaluate(() => window.__fileActions ?? []);
    const file = page.locator(".fortune-ribbon-file");
    const menu = page.getByRole("menu", { name: "File" });

    await file.click();
    await expect(
      menu.locator(":scope > [role=menuitem] .fortune-file-entry-title")
    ).toHaveText(["New", "Open…", "Save As", "Print…"]);
    await menu.getByRole("menuitem", { name: /^New/ }).click();
    await expect(menu).toHaveCount(0);
    await expect.poll(actions).toEqual(["new"]);

    // Save As ▸ by keyboard: Alt+F, arrows, Enter
    await page.locator(".fortune-cell-area").click();
    await page.keyboard.press("Alt+f");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^New/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(
      menu.getByRole("menuitem", { name: /^Save As/ })
    ).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const xlsx = page.getByRole("menuitem", { name: /Excel Workbook/ });
    await expect(xlsx).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /CSV/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(actions).toEqual(["new", "save:csv"]);
    await expect(menu).toHaveCount(0);

    // Escape closes and gives the keyboard back to the File button
    await file.focus();
    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(file).toBeFocused();

    // Open… picks a file
    await file.click();
    const chooser = page.waitForEvent("filechooser");
    await menu.getByRole("menuitem", { name: /^Open/ }).click();
    await (
      await chooser
    ).setFiles({
      name: "book.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("a,b\n1,2\n"),
    });
    await expect.poll(actions).toEqual(["new", "save:csv", "open:book.csv"]);

    // Print… opens the print preview
    await file.click();
    await expect(menu.getByRole("menuitem", { name: /^Print/ })).toContainText(
      "Ctrl+P"
    );
    await menu.getByRole("menuitem", { name: /^Print/ }).click();
    await expect(menu).toHaveCount(0);
  });
});
