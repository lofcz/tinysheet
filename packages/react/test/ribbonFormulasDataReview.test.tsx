import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { locale } from "@lofcz/tinysheet-core";
import { Workbook } from "../src";
import {
  functionSignature,
  functionsOf,
} from "../src/components/Ribbon/commands/functions";
import { showRibbonTab } from "./ribbonHelpers";

const renderBook = (props: Record<string, any> = {}) =>
  render(<Workbook lang="en" data={[{ name: "Sheet1" }]} {...props} />);

/** Group label → accessible names of its buttons, for the active tab. */
function groups(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      ".fortune-ribbon-commands [data-ribbon-group]"
    )
  ).map((g) => [
    g.getAttribute("aria-label"),
    Array.from(g.querySelectorAll("button"))
      .map((b) => b.getAttribute("aria-label")!)
      .filter((l) => !l.endsWith("more options")),
  ]);
}

describe("Formulas, Data and Review tabs", () => {
  it("lay out Excel's groups and commands", () => {
    const { container } = renderBook();
    showRibbonTab(container, "formulas");
    expect(groups(container)).toEqual([
      [
        "Function Library",
        [
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
        ],
      ],
      [
        "Defined Names",
        [
          "Name Manager",
          "Define Name",
          "Use in Formula",
          "Create from Selection",
        ],
      ],
      [
        "Formula Auditing",
        [
          "Trace Precedents",
          "Trace Dependents",
          "Remove Arrows",
          "Show Formulas",
          "Error Checking",
          "Evaluate Formula",
          "Watch Window",
        ],
      ],
      [
        "Calculation",
        ["Calculation Options", "Calculate Now", "Calculate Sheet"],
      ],
    ]);
    showRibbonTab(container, "data");
    expect(groups(container)).toEqual([
      [
        "Sort & Filter",
        [
          "Sort A to Z",
          "Sort Z to A",
          "Sort",
          "Filter",
          "Clear",
          "Reapply",
          "Advanced",
        ],
      ],
      [
        "Data Tools",
        [
          "Text to Columns",
          "Flash Fill",
          "Remove Duplicates",
          "Data Validation",
        ],
      ],
      ["Forecast", ["What-If Analysis"]],
      [
        "Outline",
        ["Group", "Ungroup", "Subtotal", "Show Detail", "Hide Detail"],
      ],
    ]);
    showRibbonTab(container, "review");
    expect(groups(container)).toEqual([
      [
        "Comments",
        ["New Comment", "Delete", "Previous", "Next", "Show Comments"],
      ],
      ["Notes", ["Notes"]],
      ["Protect", ["Protect Sheet", "Protect Workbook", "Allow Edit Ranges"]],
    ]);
  });

  it("translates the commands", () => {
    const { container } = renderBook({ lang: "zh" });
    showRibbonTab(container, "data");
    const names = groups(container).flatMap(([, n]) => n as string[]);
    expect(names).toEqual(expect.arrayContaining(["筛选", "分列", "组合"]));
  });

  it("toggles reflect the state: Show Comments, Show Formulas", () => {
    const { container } = renderBook();
    showRibbonTab(container, "review");
    const pane = container.querySelector<HTMLElement>(
      '[data-item="review-show-comments"] button'
    )!;
    expect(pane.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pane);
    expect(
      container
        .querySelector('[data-item="review-show-comments"] button')!
        .getAttribute("aria-pressed")
    ).toBe("true");
    showRibbonTab(container, "formulas");
    const show = () =>
      container.querySelector<HTMLElement>(
        '[data-item="show-formulas"] button'
      )!;
    fireEvent.click(show());
    expect(show().getAttribute("aria-pressed")).toBe("true");
  });

  it("a custom toolbarItems list shows the commands of a legacy name", () => {
    const { container } = renderBook({ toolbarItems: ["protection"] });
    const labels = Array.from(
      container.querySelectorAll(".fortune-ribbon [data-item] button")
    ).map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Protect Sheet",
      "Protect Workbook",
      "Allow Edit Ranges",
    ]);
  });
});

describe("function catalog", () => {
  const { functionlist } = locale({ lang: "en" } as any);

  it("files every category of the drop-downs", () => {
    (
      [
        "financial",
        "logical",
        "text",
        "dateTime",
        "lookup",
        "math",
        "statistical",
        "engineering",
        "information",
        "compatibility",
        "database",
      ] as const
    ).forEach((c) =>
      expect(functionsOf(functionlist, c).length).toBeGreaterThan(5)
    );
    expect(functionsOf(functionlist, "web").map((f) => f.n)).toEqual([
      "ENCODEURL",
    ]);
    // Web functions are not listed under Text again
    expect(functionsOf(functionlist, "text").map((f) => f.n)).not.toContain(
      "ENCODEURL"
    );
    const logical = functionsOf(functionlist, "logical").map((f) => f.n);
    expect(logical).toEqual([...logical].sort());
    expect(logical).toEqual(expect.arrayContaining(["IF", "IFS", "AND"]));
  });

  it("writes Excel's syntax line", () => {
    const find = (n: string) => functionlist.find((f) => f.n === n)!;
    expect(functionSignature(find("SUM"))).toBe("SUM(number1, [number2], ...)");
    expect(functionSignature(find("ABS"))).toBe("ABS(number)");
    expect(functionSignature(find("VLOOKUP"))).toBe(
      "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])"
    );
  });
});
