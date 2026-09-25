import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { defaultSettings } from "@lofcz/tinysheet-core";
// the package entry, which also registers the built-in toolbar features
import { Workbook } from "../src";

function toolbarItems(lang = "en") {
  const { container } = render(
    <Workbook lang={lang} data={[{ name: "Sheet1" }]} />
  );
  // jsdom has no layout, so every item renders (no "More" overflow)
  const bar = container.querySelector(".fortune-toolbar")!;
  return Array.from(bar.querySelectorAll<HTMLElement>(".fortune-toolbar-item"));
}

/** Accessible names of an item's buttons. */
const buttonNames = (item: HTMLElement) =>
  Array.from(
    item.matches("[role=button]")
      ? [item]
      : item.querySelectorAll<HTMLElement>("[role=button]")
  ).map((el) => el.getAttribute("aria-label") ?? "");

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
    expect(
      container.querySelector(`.fortune-toolbar [aria-label="${names}"]`)
    ).toBeTruthy();
  });
});

describe("default toolbar", () => {
  it("is grouped Excel-like with separators", () => {
    const items = defaultSettings.toolbarItems;
    const groups = items.join(" ").split(" | ");
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

  it("renders one toolbar item per entry, so the More overflow maps back", () => {
    expect(toolbarItems()).toHaveLength(defaultSettings.toolbarItems.length);
  });

  it.each(["en", "zh", "es", "ru", "hi", "zh-TW"])(
    "gives every button an accessible name and tooltip (%s)",
    (lang) => {
      const unnamed: string[] = [];
      toolbarItems(lang).forEach((item, i) => {
        const name = defaultSettings.toolbarItems[i];
        if (name === "|") return;
        const labels = buttonNames(item);
        if (
          labels.length === 0 ||
          labels.some((l) => !l.trim() || /^:|:\s*$|undefined/.test(l))
        ) {
          unnamed.push(`${name}: ${JSON.stringify(labels)}`);
        }
        const tip =
          item.querySelector(".fortune-tooltip")?.textContent?.trim() ?? "";
        if (!tip) unnamed.push(`${name}: no tooltip`);
      });
      expect(unnamed).toEqual([]);
    }
  );
});

describe("theme switch", () => {
  const themeOf = (container: HTMLElement) =>
    container.querySelector(".fortune-container")?.getAttribute("data-theme");
  const themeButton = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(
      '.fortune-toolbar [aria-label^="Theme: "]'
    )!;
  /** Toolbar > Theme > `label` (Light / Dark / System). */
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
