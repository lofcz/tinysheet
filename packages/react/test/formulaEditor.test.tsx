import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { defaultContext, Context, locale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import FormulaHint from "../src/components/SheetOverlay/FormulaHint";
import FormulaSearch from "../src/components/SheetOverlay/FormulaSearch";

function renderWith(
  ui: React.ReactElement,
  patch: Partial<Context>,
  setContext = jest.fn()
) {
  const context = { ...defaultContext({} as any), lang: "en", ...patch };
  return render(
    <WorkbookContext.Provider
      value={{ context, setContext, refs: {} as any, settings: {} as any }}
    >
      {ui}
    </WorkbookContext.Provider>
  );
}

describe("FormulaHint", () => {
  it.each(["en", "cs", "sk", "pl"])(
    "%s uses the real function catalog and bolds repeated arguments",
    (lang) => {
      const { functionlist, formulaMore } = locale({ lang });
      const sum = functionlist.find((fn) => fn.n === "SUM")!;
      const { container, getByTitle } = renderWith(<FormulaHint />, {
        lang,
        functionHint: "SUM",
        functionHintArgIndex: 3,
      });
      const current = container.querySelector(
        ".luckysheet-arguments-help-parameter-current"
      );
      // SUM(number1, [number2], ...): the 4th argument repeats number2.
      expect(current?.textContent).toBe(`[${sum.p[1].name}]`);
      expect(container.textContent).toContain(sum.p[1].detail);
      expect(container.textContent).toContain(sum.d);
      expect(getByTitle(formulaMore.helpClose)).toBeTruthy();
      expect(getByTitle(formulaMore.helpCollapse)).toBeTruthy();
      expect(container.textContent).not.toMatch(/关闭|收起/);
    }
  );

  it("can be collapsed and closed", () => {
    const { container, getByTitle } = renderWith(<FormulaHint />, {
      functionHint: "SUM",
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
