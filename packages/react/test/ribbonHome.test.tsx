import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import type { Sheet } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "../src";
import {
  FONT_SIZES,
  stepFontSize,
} from "../src/components/Ribbon/commands/home/font";
import { currencySymbolFor } from "../src/components/Ribbon/commands/home/shared";
import { THEME_GRID } from "../src/components/Ribbon/commands/home/ColorPanel";

describe("Home helpers", () => {
  it("steps the font size along Excel's list", () => {
    expect(stepFontSize(11, 1)).toBe(12);
    expect(stepFontSize(12, 1)).toBe(14);
    expect(stepFontSize(13, 1)).toBe(14);
    expect(stepFontSize(72, 1)).toBe(80);
    expect(stepFontSize(14, -1)).toBe(12);
    expect(stepFontSize(8, -1)).toBe(7);
    expect(stepFontSize(1, -1)).toBe(1);
    expect(FONT_SIZES[0]).toBe(8);
  });

  it("uses the language's currency unless the host set one", () => {
    expect(currencySymbolFor({ lang: "en" } as any)).toBe("$");
    expect(currencySymbolFor({ lang: "es" } as any)).toBe("€");
    expect(currencySymbolFor({ lang: "zh-TW" } as any)).toBe("NT$");
    expect(currencySymbolFor({ lang: "en" } as any, "Kč")).toBe("Kč");
  });

  it("builds Excel's theme grid: 6 rows of 10", () => {
    expect(THEME_GRID).toHaveLength(6);
    THEME_GRID.forEach((row) => expect(row).toHaveLength(10));
    expect(THEME_GRID[0][4]).toBe("#4472C4");
  });
});

describe("Home commands", () => {
  const data: Sheet[] = [
    {
      name: "Sheet1",
      celldata: [{ r: 0, c: 0, v: { v: "hello", m: "hello" } }],
    },
  ];
  const renderBook = () => {
    const ref = React.createRef<WorkbookInstance>();
    const utils = render(<Workbook ref={ref} lang="en" data={data} />);
    act(() => {
      ref.current!.setSelection([{ row: [0, 0], column: [0, 0] }]);
    });
    return { ...utils, ref };
  };
  const button = (container: HTMLElement, name: string) =>
    container.querySelector<HTMLElement>(
      `.fortune-ribbon [aria-label="${name}"]`
    )!;

  it("lays the Home groups out like Excel", () => {
    const { container } = renderBook();
    const items = (group: string) =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `[data-ribbon-group="${group}"] .fortune-ribbon-item`
        )
      ).map((el) => el.dataset.item);
    expect(items("clipboard")).toEqual([
      "paste",
      "cut",
      "copy",
      "format-painter",
    ]);
    expect(items("cells")).toEqual([
      "cells-insert",
      "cells-delete",
      "cells-format",
    ]);
    expect(items("editing")).toEqual([
      "autosum",
      "fill",
      "clear-format",
      "sort-filter",
      "search",
    ]);
  });

  it("Bold and Wrap Text toggle and show the active cell", () => {
    const { container, ref } = renderBook();
    const bold = button(container, "Bold");
    expect(bold.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      fireEvent.click(bold);
    });
    expect(ref.current!.getCellValue(0, 0, { type: "bl" })).toBe(1);
    expect(button(container, "Bold").getAttribute("aria-pressed")).toBe("true");
    act(() => {
      fireEvent.click(button(container, "Wrap Text"));
    });
    expect(`${ref.current!.getCellValue(0, 0, { type: "tb" })}`).toBe("2");
    expect(button(container, "Wrap Text").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("the Number Format box names the active cell's format", () => {
    const { container } = renderBook();
    act(() => {
      fireEvent.click(button(container, "Percent Style"));
    });
    expect(
      container.querySelector(".ts-home-field")?.getAttribute("aria-label")
    ).toBe("Number Format: Percentage");
  });
});
