import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { SearchResults } from "../src/components/SearchReplace/Results";

test("Find All windows large results and keeps the last result reachable", () => {
  const results = Array.from({ length: 150000 }, (_, r) => ({
    sheetId: "s1",
    sheetName: "Data",
    r,
    c: 0,
    cellPosition: `A${r + 1}`,
    value: `Match ${r + 1}`,
  }));
  const onSelect = jest.fn();
  const { getAllByRole, rerender } = render(
    <SearchResults results={results} onSelect={onSelect} />
  );
  expect(getAllByRole("row").length).toBeLessThan(20);
  const first = getAllByRole("row")[0];
  first.focus();
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement?.getAttribute("aria-rowindex")).toBe("150001");
  fireEvent.click(document.activeElement!);
  expect(onSelect).toHaveBeenCalledWith(results[149999]);
  expect(getAllByRole("row").length).toBeLessThan(20);
  rerender(<SearchResults results={results.slice(0, 2)} onSelect={onSelect} />);
  expect(getAllByRole("row")).toHaveLength(2);
  expect(getAllByRole("row")[0].getAttribute("tabindex")).toBe("0");
});
