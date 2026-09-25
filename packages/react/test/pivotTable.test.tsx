import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";
import { registerContextMenuItem } from "../src/extensions";

const cell = (r: number, c: number, v: string | number) => ({
  r,
  c,
  v:
    typeof v === "number"
      ? { v, m: String(v), ct: { fa: "General", t: "n" } }
      : { v, m: v, ct: { fa: "General", t: "g" } },
});

const SALES: (string | number)[][] = [
  ["Region", "Sales"],
  ["East", 10],
  ["West", 20],
  ["East", 5],
];

function renderBook() {
  const ref = React.createRef<WorkbookInstance>();
  const celldata = SALES.flatMap((row, r) => row.map((v, c) => cell(r, c, v)));
  const utils = render(
    <Workbook
      ref={ref}
      lang="en"
      data={[
        {
          name: "Report",
          id: "report",
          order: 0,
          celldata: [],
          pivotTables: [
            {
              id: "p1",
              name: "PivotTable1",
              source: {
                sheetId: "data",
                range: { row: [0, 3], column: [0, 1] },
              },
              anchor: { r: 0, c: 0 },
              rows: ["Region"],
              columns: [],
              values: [{ field: "Sales", aggregate: "sum" }],
              filters: [],
              options: {
                layout: "compact",
                subtotals: "top",
                grandTotalRow: true,
                grandTotalColumn: true,
                preserveFormatting: true,
                autoRefresh: false,
              },
            },
          ],
        } as any,
        { name: "Data", id: "data", order: 1, celldata },
      ]}
    />
  );
  return { ...utils, ref };
}

const workbookEl = (container: HTMLElement) =>
  container.querySelector(".fortune-container") as HTMLElement;

function openMenu(container: HTMLElement) {
  fireEvent.keyDown(workbookEl(container), { key: "F10", shiftKey: true });
  return container.querySelector(".fortune-cell-menu") as HTMLElement;
}

function select(ref: React.RefObject<WorkbookInstance>, r: number, c: number) {
  act(() => {
    ref.current!.setSelection([{ row: [r, r], column: [c, c] }]);
  });
}

describe("PivotTable UI", () => {
  it("a saved PivotTable is refreshed once its source is loaded", async () => {
    const { ref } = renderBook();
    await waitFor(
      () => expect(ref.current!.getCellValue(3, 0)).toBe("Grand Total"),
      { timeout: 5000 }
    );
    expect(ref.current!.getCellValue(0, 0)).toBe("Row Labels");
    expect(ref.current!.getCellValue(1, 1)).toBe(15);
    expect(ref.current!.getCellValue(3, 1)).toBe(35);
  });

  it("shows the Fields pane and the pivot menu entries inside the report", async () => {
    const { ref, container } = renderBook();
    await waitFor(
      () => expect(ref.current!.getCellValue(3, 0)).toBe("Grand Total"),
      { timeout: 5000 }
    );
    select(ref, 1, 1);
    await waitFor(() =>
      expect(
        document.querySelector('[data-testid="pivot-fields-pane"]')
      ).toBeTruthy()
    );
    let menu = openMenu(container);
    expect(menu.querySelector('[data-key="pivot-refresh"]')).toBeTruthy();
    expect(
      menu.querySelector('[data-key="pivot-value-settings"]')
    ).toBeTruthy();
    fireEvent.click(menu.querySelector('[data-key="pivot-field-list"]')!);
    await waitFor(() =>
      expect(
        document.querySelector('[data-testid="pivot-fields-pane"]')
      ).toBeNull()
    );
    // outside the report: no pivot entries, no pane
    select(ref, 8, 5);
    menu = openMenu(container);
    expect(menu.querySelector('[data-key="pivot-refresh"]')).toBeNull();
  });

  it("the Fields pane changes the report", async () => {
    const { ref } = renderBook();
    await waitFor(
      () => expect(ref.current!.getCellValue(3, 0)).toBe("Grand Total"),
      { timeout: 5000 }
    );
    select(ref, 1, 0);
    const pane = await waitFor(() => {
      const el = document.querySelector(
        '[data-testid="pivot-fields-pane"]'
      ) as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    const region = Array.from(pane.querySelectorAll("label")).find(
      (l) => l.textContent === "Region"
    )!;
    const box = region.querySelector("input") as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    await waitFor(() => expect(ref.current!.getCellValue(1, 0)).toBe(35));
    expect(ref.current!.getCellValue(0, 0)).toBe("Sum of Sales");
  });
});

describe("registerContextMenuItem", () => {
  it("adds an entry where its name is listed", async () => {
    const onSelect = jest.fn();
    const off = registerContextMenuItem("test-entry", {
      label: () => "Test entry",
      onSelect,
    });
    const ref = React.createRef<WorkbookInstance>();
    const { container } = render(
      <Workbook
        ref={ref}
        lang="en"
        cellContextMenu={["copy", "test-entry"]}
        data={[{ name: "Sheet1", celldata: [] }]}
      />
    );
    const menu = openMenu(container);
    const entry = menu.querySelector('[data-key="test-entry"]') as HTMLElement;
    expect(entry.textContent).toContain("Test entry");
    fireEvent.click(entry);
    expect(onSelect).toHaveBeenCalledTimes(1);
    off();
    const again = openMenu(container);
    expect(again.querySelector('[data-key="test-entry"]')).toBeNull();
  });
});
