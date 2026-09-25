import { render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook from "../src/components/Workbook";

describe("Workbook settings", () => {
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
