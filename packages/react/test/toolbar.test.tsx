import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import { defaultSettings, ribbonLocale } from "@lofcz/tinysheet-core";
// the package entry, which also registers the built-in toolbar features
import { Workbook, registerRibbonCommand } from "../src";
import { resolveRibbon } from "../src/components/Ribbon";
import { showRibbonItem, showRibbonTab } from "./ribbonHelpers";

const tabIds = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(".fortune-ribbon [role=tab]")
  ).map((t) => t.dataset.tab);

/** Every item of every tab: [tab, item name, wrapper]. */
function ribbonItems(lang = "en") {
  const { container } = render(
    <Workbook lang={lang} data={[{ name: "Sheet1" }]} />
  );
  const out: [string, string, HTMLElement][] = [];
  tabIds(container).forEach((tab) => {
    showRibbonTab(container, tab!);
    container
      .querySelectorAll<HTMLElement>(
        ".fortune-ribbon-commands .fortune-ribbon-item, .fortune-ribbon-quick .fortune-ribbon-item"
      )
      .forEach((el) => out.push([tab!, el.dataset.item!, el]));
  });
  return out;
}

/** Accessible names of an item's buttons. */
const buttonNames = (item: HTMLElement) =>
  Array.from(item.querySelectorAll<HTMLElement>("[role=button], button")).map(
    (el) => el.getAttribute("aria-label") ?? el.textContent ?? ""
  );

describe("translated chrome", () => {
  it.each([
    ["zh", "就绪", "名称管理器"],
    ["zh-TW", "就緒", "名稱管理員"],
    ["es", "Listo", "Administrador de nombres"],
    ["ru", "Готово", "Диспетчер имён"],
    ["hi", "तैयार", "नाम प्रबंधक"],
  ])("%s: mode indicator and Name Manager button", (lang, ready, names) => {
    const { container } = render(
      <Workbook lang={lang} data={[{ name: "Sheet1" }]} />
    );
    expect(container.querySelector(".fortune-edit-mode")?.textContent).toBe(
      ready
    );
    showRibbonItem(container, "nameManager");
    expect(
      container.querySelector(`.fortune-toolbar [aria-label="${names}"]`)
    ).toBeTruthy();
  });

  it("translates the ribbon tabs", () => {
    const { container } = render(
      <Workbook lang="zh" data={[{ name: "Sheet1" }]} />
    );
    const labels = Array.from(
      container.querySelectorAll(".fortune-ribbon [role=tab]")
    ).map((t) => t.textContent);
    expect(labels).toEqual([
      "开始",
      "插入",
      "页面布局",
      "公式",
      "数据",
      "审阅",
      "视图",
    ]);
  });
});

describe("default toolbar items", () => {
  it("keeps the Excel-like grouping of settings.toolbarItems", () => {
    const groups = defaultSettings.toolbarItems.join(" ").split(" | ");
    expect(groups).toEqual([
      "undo redo format-painter",
      "font font-size",
      "bold italic underline strike-through",
      "border background font-color",
      "vertical-align horizontal-align text-wrap text-rotation merge-cell",
      "format currency-format percentage-format number-increase number-decrease",
      "conditionFormat formatAsTable cell-styles",
      "quick-formula clear-format filter search",
      "freeze theme image picture-in-cell chart sparkline shapes pivotTable slicer link comment threaded-comment checkbox",
      "nameManager dataVerification splitColumn outline data-tools locationCondition screenshot",
      "pageLayout print",
      "trace-precedents trace-dependents remove-arrows show-formulas error-checking evaluate-formula watch-window calculation-options",
      "view-options protection",
    ]);
  });

  it("places every toolbar item in a ribbon tab", () => {
    const { tabs, quickAccess, unplaced } = resolveRibbon({
      ribbon: null,
      toolbarItems: defaultSettings.toolbarItems,
      customToolbarItems: 0,
      t: ribbonLocale({ lang: "en" }),
    });
    const placed = new Set(quickAccess);
    tabs.forEach((tab) =>
      tab.groups.forEach((g) =>
        g.columns.forEach((c) =>
          (c.kind === "large" ? [c.item] : c.rows.flat()).forEach((i) =>
            placed.add(i.id)
          )
        )
      )
    );
    const missing = defaultSettings.toolbarItems.filter(
      (n) => n !== "|" && !placed.has(n)
    );
    expect(missing).toEqual([]);
    expect(unplaced).toEqual([]);
    expect(tabs.map((t) => t.id)).toEqual([
      "home",
      "insert",
      "pageLayout",
      "formulas",
      "data",
      "review",
      "view",
    ]);
  });

  it("renders every item of every tab", () => {
    const rendered = new Set(ribbonItems().map(([, name]) => name));
    const missing = defaultSettings.toolbarItems.filter(
      (n) => n !== "|" && !rendered.has(n)
    );
    expect(missing).toEqual([]);
  });

  it.each(["en", "zh", "es", "ru", "hi", "zh-TW"])(
    "gives every button an accessible name and tooltip (%s)",
    (lang) => {
      const unnamed: string[] = [];
      ribbonItems(lang).forEach(([tab, name, item]) => {
        const labels = buttonNames(item);
        if (
          labels.length === 0 ||
          labels.some((l) => !l.trim() || /^:|:\s*$|undefined/.test(l))
        ) {
          unnamed.push(`${tab}/${name}: ${JSON.stringify(labels)}`);
        }
        // legacy items carry their tooltip in the DOM, ribbon commands
        // show one on hover (ui/Tooltip)
        if (item.classList.contains("fortune-ribbon-item--legacy")) {
          const tip =
            item.querySelector(".fortune-tooltip")?.textContent?.trim() ?? "";
          if (!tip) unnamed.push(`${tab}/${name}: no tooltip`);
        }
      });
      expect(unnamed).toEqual([]);
    }
  );
});

describe("ribbon", () => {
  const renderBook = (props: Record<string, any> = {}) =>
    render(<Workbook lang="en" data={[{ name: "Sheet1" }]} {...props} />);

  it("shows Excel's tabs, Home first, as a tab list", () => {
    const { container } = renderBook();
    expect(tabIds(container)).toEqual([
      "home",
      "insert",
      "pageLayout",
      "formulas",
      "data",
      "review",
      "view",
    ]);
    const home = container.querySelector('[role=tab][data-tab="home"]')!;
    expect(home.getAttribute("aria-selected")).toBe("true");
    const panel = container.querySelector(".fortune-ribbon [role=tabpanel]")!;
    expect(panel.getAttribute("aria-labelledby")).toBe(home.id);
    const groups = Array.from(
      container.querySelectorAll<HTMLElement>("[data-ribbon-group]")
    ).map((g) => g.getAttribute("aria-label"));
    expect(groups).toEqual([
      "Clipboard",
      "Font",
      "Alignment",
      "Number",
      "Styles",
      "Editing",
    ]);
  });

  it("switches tabs with a click and the arrow keys", () => {
    const { container } = renderBook();
    showRibbonTab(container, "formulas");
    expect(
      container.querySelector('[data-ribbon-group="formulaAuditing"]')
    ).toBeTruthy();
    expect(container.querySelector('[data-ribbon-group="font"]')).toBeNull();
    const formulas = container.querySelector<HTMLElement>(
      '[role=tab][data-tab="formulas"]'
    )!;
    fireEvent.keyDown(formulas, { key: "ArrowRight" });
    expect(
      container
        .querySelector('[role=tab][data-tab="data"]')!
        .getAttribute("aria-selected")
    ).toBe("true");
  });

  it("collapses to the tab row with Ctrl+F1 and a double-click", () => {
    const { container } = renderBook();
    const root = container.querySelector(".fortune-container")!;
    act(() => {
      root.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F1",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });
    expect(container.querySelector(".fortune-ribbon-commands")).toBeNull();
    // a tab click shows its commands until a click outside
    showRibbonTab(container, "insert");
    expect(container.querySelector(".fortune-ribbon--peek")).toBeTruthy();
    fireEvent.mouseDown(container.querySelector(".fortune-cell-area")!);
    expect(container.querySelector(".fortune-ribbon-commands")).toBeNull();
    fireEvent.doubleClick(
      container.querySelector('[role=tab][data-tab="insert"]')!
    );
    expect(container.querySelector(".fortune-ribbon-commands")).toBeTruthy();
    expect(container.querySelector(".fortune-ribbon--collapsed")).toBeNull();
  });

  it("a custom toolbarItems list shows only those items", () => {
    const { container } = renderBook({
      toolbarItems: ["bold", "italic", "|", "freeze", "unknown-item"],
    });
    expect(tabIds(container)).toEqual(["home", "view"]);
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(".fortune-ribbon-item")
    ).map((i) => i.dataset.item);
    // unknown names land in the Custom group, like the old flat toolbar
    expect(items).toEqual(["bold", "italic", "unknown-item"]);
    expect(
      container.querySelector('[data-ribbon-group="custom"]')
    ).toBeTruthy();
  });

  it("takes a custom layout from settings.ribbon", () => {
    const { container } = renderBook({
      ribbon: [
        {
          id: "mine",
          label: "Mine",
          groups: [
            {
              id: "g",
              label: "Basics",
              items: ["bold", { rows: [["italic"]] }],
            },
          ],
        },
      ],
    });
    expect(tabIds(container)).toEqual(["mine"]);
    expect(
      container
        .querySelector('[data-ribbon-group="g"]')
        ?.getAttribute("aria-label")
    ).toBe("Basics");
  });

  it("renders a registered ribbon command in place of a legacy item", () => {
    const off = registerRibbonCommand("bold", ({ size }) => (
      <button type="button" aria-label="Custom bold" data-size={size} />
    ));
    try {
      const { getByLabelText } = renderBook();
      expect(getByLabelText("Custom bold").dataset.size).toBe("small");
    } finally {
      off();
    }
  });

  it("the File menu offers Print and the host's file actions", () => {
    const onSaveAs = jest.fn();
    const { container, getByText } = renderBook({ onSaveAs });
    fireEvent.click(container.querySelector(".fortune-ribbon-file")!);
    const menu = document.querySelector('[role=menu][aria-label="File"]')!;
    const labels = Array.from(menu.querySelectorAll("[role=menuitem]")).map(
      (m) => m.textContent
    );
    expect(labels).toEqual(["Save As", "Print…Ctrl+P"]);
    fireEvent.click(getByText("Save As"));
    fireEvent.click(getByText("Excel Workbook (.xlsx)"));
    expect(onSaveAs).toHaveBeenCalledWith("xlsx");
  });
});

describe("theme switch", () => {
  const themeOf = (container: HTMLElement) =>
    container.querySelector(".fortune-container")?.getAttribute("data-theme");
  const themeButton = (container: HTMLElement) => {
    showRibbonItem(container, "theme");
    return container.querySelector<HTMLElement>(
      '.fortune-toolbar [aria-label^="Theme: "]'
    )!;
  };
  /** View > Theme > `label` (Light / Dark / System). */
  const pickTheme = (container: HTMLElement, label: string) => {
    fireEvent.click(themeButton(container));
    const option = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".fortune-toolbar-combo-popup [role=menuitemradio]"
      )
    ).find((el) => el.textContent?.includes(label))!;
    fireEvent.click(option);
  };

  it("switches an uncontrolled workbook and reports the choice", () => {
    const onThemeChange = jest.fn();
    const { container } = render(
      <Workbook
        lang="en"
        data={[{ name: "Sheet1" }]}
        onThemeChange={onThemeChange}
      />
    );
    expect(themeOf(container)).toBe("light");
    pickTheme(container, "Dark");
    expect(themeOf(container)).toBe("dark");
    expect(onThemeChange).toHaveBeenLastCalledWith("dark");
    expect(themeButton(container).getAttribute("aria-label")).toBe(
      "Theme: Dark"
    );
    pickTheme(container, "Light");
    expect(themeOf(container)).toBe("light");
  });

  it("starts from defaultTheme", () => {
    const { container } = render(
      <Workbook lang="en" data={[{ name: "Sheet1" }]} defaultTheme="dark" />
    );
    expect(themeOf(container)).toBe("dark");
  });

  it("marks the chosen setting in the menu", () => {
    const { container } = render(
      <Workbook lang="en" data={[{ name: "Sheet1" }]} defaultTheme="auto" />
    );
    fireEvent.click(themeButton(container));
    const checked = Array.from(
      container.querySelectorAll(
        ".fortune-toolbar-combo-popup [role=menuitemradio]"
      )
    )
      .filter((el) => el.getAttribute("aria-checked") === "true")
      .map((el) => el.textContent);
    expect(checked).toEqual([expect.stringContaining("System")]);
  });

  it("only reports the choice while the theme prop controls it", () => {
    const onThemeChange = jest.fn();
    const { container, rerender } = render(
      <Workbook
        lang="en"
        data={[{ name: "Sheet1" }]}
        theme="light"
        onThemeChange={onThemeChange}
      />
    );
    pickTheme(container, "Dark");
    expect(onThemeChange).toHaveBeenLastCalledWith("dark");
    expect(themeOf(container)).toBe("light");
    rerender(
      <Workbook
        lang="en"
        data={[{ name: "Sheet1" }]}
        theme="dark"
        onThemeChange={onThemeChange}
      />
    );
    expect(themeOf(container)).toBe("dark");
  });
});
