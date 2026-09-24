import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { defaultContext, Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import FormulaHint from "../src/components/SheetOverlay/FormulaHint";
import FormulaSearch from "../src/components/SheetOverlay/FormulaSearch";

function renderWith(
  ui: React.ReactElement,
  patch: Partial<Context>,
  setContext = jest.fn()
) {
  const context = { ...defaultContext({} as any), lang: "en", ...patch };
  // a fixed catalog entry, independent of the locale function list
  context.formulaCache.functionlistMap = {
    MYSUM: {
      n: "MYSUM",
      d: "Adds numbers.",
      p: [
        { name: "value1", detail: "First value", require: "m", repeat: "n" },
        { name: "value2", detail: "More values", require: "o", repeat: "y" },
      ],
    },
  };
  return render(
    <WorkbookContext.Provider
      value={{ context, setContext, refs: {} as any, settings: {} as any }}
    >
      {ui}
    </WorkbookContext.Provider>
  );
}

describe("FormulaHint", () => {
  it("bolds the argument under the caret and uses locale strings", () => {
    const { container, getByTitle } = renderWith(<FormulaHint />, {
      functionHint: "MYSUM",
      functionHintArgIndex: 3,
    });
    const current = container.querySelector(
      ".luckysheet-arguments-help-parameter-current"
    );
    // MYSUM(value1, [value2], ...): the 4th argument is described by value2
    expect(current?.textContent).toBe("[value2]");
    expect(container.textContent).toContain("More values");
    expect(getByTitle("Close")).toBeTruthy();
    expect(getByTitle("Collapse")).toBeTruthy();
    expect(container.textContent).not.toMatch(/关闭|收起/);
  });

  it("can be collapsed and closed", () => {
    const { container, getByTitle } = renderWith(<FormulaHint />, {
      functionHint: "MYSUM",
      functionHintArgIndex: 0,
    });
    expect(
      container.querySelector(".luckysheet-formula-help-content")
    ).toBeTruthy();
    fireEvent.click(getByTitle("Collapse"));
    expect(container.querySelector(".luckysheet-formula-help-content")).toBe(
      null
    );
    fireEvent.click(getByTitle("Close"));
    expect(container.querySelector(".luckysheet-formula-help-c")).toBe(null);
  });
});

describe("FormulaSearch", () => {
  it("highlights matches and the active item, accepts on click", () => {
    const onSelect = jest.fn();
    const { container } = renderWith(
      <FormulaSearch onSelectCandidate={onSelect} />,
      {
        functionCandidates: [
          { n: "SUM", a: "Sum of numbers", matches: [[0, 2]] },
          { n: "NORM.S.DIST", a: "Normal distribution", matches: [[7, 11]] },
        ],
        functionCandidateIndex: 1,
      }
    );
    const items = container.querySelectorAll(".luckysheet-formula-search-item");
    expect(items).toHaveLength(2);
    expect(
      items[1].classList.contains("luckysheet-formula-search-item-active")
    ).toBe(true);
    expect(
      items[1].querySelector(".luckysheet-formula-search-match")?.textContent
    ).toBe("DIST");
    expect(items[0].textContent).toContain("Sum of numbers");
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledWith("SUM");
  });
});
