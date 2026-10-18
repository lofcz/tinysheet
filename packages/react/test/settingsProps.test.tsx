import { render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook from "../src/components/Workbook";

describe("Workbook settings", () => {
  it("switches the full ribbon between host languages without replacing workbook data", async () => {
    const ref = React.createRef<any>();
    const data = [{ id: "data", name: "Data", data: [[{ v: "Keep me" }]] }];
    const { container, rerender } = render(
      <Workbook ref={ref} data={data} lang="cs" />
    );
    for (const [lang, home, undo] of [
      ["cs", "Domů", "Zpět"],
      ["sk", "Domov", "Späť"],
      ["pl", "Narzędzia główne", "Cofnij"],
      ["en", "Home", "Undo"],
    ]) {
      rerender(<Workbook ref={ref} data={data} lang={lang} />);
      await waitFor(() => {
        expect(
          container.querySelector(".fortune-ribbon")?.textContent
        ).toContain(home);
        expect(
          container.querySelector(`[aria-label="${undo}"]`)
        ).not.toBeNull();
      });
      expect(ref.current.getCellValue(0, 0)).toBe("Keep me");
    }
  });
  it("applies a prop that is added after mount", async () => {
    const data = [{ name: "Sheet1" }];
    const { container, rerender } = render(<Workbook data={data} />);
    const undo = () =>
      container.querySelector('[aria-label="Undo"], [aria-label="撤销"]');
    await waitFor(() =>
      expect(undo()?.getAttribute("aria-label")).toBe("Undo")
    );

    rerender(<Workbook data={data} lang="zh" />);
    await waitFor(() =>
      expect(undo()?.getAttribute("aria-label")).toBe("撤销")
    );
  });
});
