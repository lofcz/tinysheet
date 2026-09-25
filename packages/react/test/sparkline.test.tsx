import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";
import { showRibbonItem } from "./ribbonHelpers";

const num = (r: number, c: number, v: number) => ({
  r,
  c,
  v: { v, m: String(v), ct: { fa: "General", t: "n" } },
});

const cells = [
  num(0, 0, 1),
  num(0, 1, 3),
  num(0, 2, 2),
  num(1, 0, -1),
  num(1, 1, 4),
  num(1, 2, 2),
];

function renderBook(extra: Record<string, any> = {}) {
  const ref = React.createRef<WorkbookInstance>();
  const utils = render(
    <Workbook
      ref={ref}
      lang="en"
      data={[{ name: "Sheet1", celldata: cells, ...extra }]}
    />
  );
  return { ...utils, ref };
}

const groupsOf = (ref: React.RefObject<WorkbookInstance>) =>
  (ref.current!.getSheet() as any).sparklineGroups;

function select(ref: React.RefObject<WorkbookInstance>, range: any) {
  act(() => {
    ref.current!.setSelection(range);
  });
}

const workbookEl = (container: HTMLElement) =>
  container.querySelector(".fortune-container") as HTMLElement;

function openMenu(container: HTMLElement) {
  fireEvent.keyDown(workbookEl(container), { key: "F10", shiftKey: true });
  return container.querySelector(".fortune-cell-menu") as HTMLElement;
}

const existing = [
  {
    id: "g1",
    type: "line",
    displayEmptyCellsAs: "gap",
    sparklines: [
      { r: 0, c: 3, f: "Sheet1!A1:C1" },
      { r: 1, c: 3, f: "Sheet1!A2:C2" },
    ],
  },
];

describe("sparklines UI", () => {
  it("Insert Sparklines from the toolbar creates a group; undo removes it", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook();
    select(ref, [{ row: [0, 1], column: [0, 2] }]);
    showRibbonItem(container, "sparkline");
    const button = container.querySelector(
      '[data-tips="Insert Sparklines"]'
    ) as HTMLElement;
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(getByText("Create Sparklines")).toBeTruthy();
    expect((getByLabelText("Data Range") as HTMLInputElement).value).toBe(
      "A1:C2"
    );
    fireEvent.click(getByText("Column"));
    // the location must match the data
    fireEvent.change(getByLabelText("Location Range"), {
      target: { value: "D1:D4" },
    });
    fireEvent.click(getByText("OK"));
    expect(
      document.querySelector(".fortune-sparkline-error")!.textContent
    ).toMatch(/must match the location range/);
    fireEvent.change(getByLabelText("Location Range"), {
      target: { value: "D1:D2" },
    });
    fireEvent.click(getByText("OK"));
    await waitFor(() => expect(groupsOf(ref)).toHaveLength(1));
    expect(groupsOf(ref)[0]).toMatchObject({
      type: "column",
      sparklines: [
        { r: 0, c: 3, f: "Sheet1!A1:C1" },
        { r: 1, c: 3, f: "Sheet1!A2:C2" },
      ],
    });
    act(() => {
      ref.current!.handleUndo();
    });
    expect(groupsOf(ref)).toBeUndefined();
  });

  it("the cell menu has a Sparklines submenu only on sparkline cells", () => {
    const { container, ref } = renderBook({ sparklineGroups: existing });
    select(ref, [{ row: [0, 0], column: [0, 0] }]);
    let menu = openMenu(container);
    expect(menu.querySelector('[data-key="sparkline"]')).toBeNull();
    fireEvent.keyDown(workbookEl(container), { key: "Escape" });

    select(ref, [{ row: [0, 0], column: [3, 3] }]);
    menu = openMenu(container);
    const parent = menu.querySelector('[data-key="sparkline"]') as HTMLElement;
    expect(parent.textContent).toContain("Sparklines");
    fireEvent.click(parent);
    const clear = container.querySelector(
      '[data-key="sparkline-clear"]'
    ) as HTMLElement;
    fireEvent.click(clear);
    expect(groupsOf(ref)[0].sparklines).toEqual([
      { r: 1, c: 3, f: "Sheet1!A2:C2" },
    ]);
  });

  it("Sparkline Settings changes the group's options", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook({
      sparklineGroups: existing,
    });
    select(ref, [{ row: [1, 1], column: [3, 3] }]);
    const menu = openMenu(container);
    fireEvent.click(menu.querySelector('[data-key="sparkline"]')!);
    fireEvent.click(
      container.querySelector('[data-key="sparkline-settings"]') as HTMLElement
    );
    expect(getByText("Sparkline Settings")).toBeTruthy();
    fireEvent.click(getByLabelText("High Point"));
    fireEvent.click(getByLabelText("Plot Data Right-to-Left"));
    fireEvent.click(getByLabelText("Zero"));
    fireEvent.change(getByLabelText("Vertical Axis Minimum Value"), {
      target: { value: "custom" },
    });
    fireEvent.change(
      getByLabelText("Vertical Axis Minimum Value: Custom Value"),
      { target: { value: "-3" } }
    );
    fireEvent.click(getByLabelText("Style 2"));
    fireEvent.click(getByText("OK"));
    await waitFor(() => expect(groupsOf(ref)[0].high).toBe(true));
    expect(groupsOf(ref)[0]).toMatchObject({
      rightToLeft: true,
      displayEmptyCellsAs: "zero",
      minAxisType: "custom",
      manualMin: -3,
      colors: { series: "#773F19" },
    });
  });

  it("Edit Group Location & Data moves the group", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook({
      sparklineGroups: existing,
    });
    select(ref, [{ row: [0, 0], column: [3, 3] }]);
    const menu = openMenu(container);
    fireEvent.click(menu.querySelector('[data-key="sparkline"]')!);
    fireEvent.click(
      container.querySelector(
        '[data-key="sparkline-edit-group"]'
      ) as HTMLElement
    );
    expect((getByLabelText("Data Range") as HTMLInputElement).value).toBe(
      "A1:C2"
    );
    expect((getByLabelText("Location Range") as HTMLInputElement).value).toBe(
      "D1:D2"
    );
    fireEvent.change(getByLabelText("Location Range"), {
      target: { value: "F1:F2" },
    });
    fireEvent.click(getByText("OK"));
    await waitFor(() =>
      expect(groupsOf(ref)[0].sparklines.map((s: any) => s.c)).toEqual([5, 5])
    );
  });

  it("the range picker collapses the dialog and brings the selection back", async () => {
    const { container, ref, getByLabelText, getByText, getByRole } =
      renderBook();
    select(ref, [{ row: [0, 0], column: [4, 4] }]);
    showRibbonItem(container, "sparkline");
    fireEvent.click(
      container.querySelector('[data-tips="Insert Sparklines"]') as HTMLElement
    );
    // a single empty cell prefills the location
    expect((getByLabelText("Location Range") as HTMLInputElement).value).toBe(
      "E1"
    );
    fireEvent.click(getByLabelText("Select a range on the sheet: Data Range"));
    await waitFor(() =>
      expect(getByRole("dialog", { name: "Data Range" })).toBeTruthy()
    );
    select(ref, [{ row: [1, 1], column: [0, 2] }]);
    fireEvent.click(getByText("OK"));
    await waitFor(() =>
      expect((getByLabelText("Data Range") as HTMLInputElement).value).toBe(
        "A2:C2"
      )
    );
    expect((getByLabelText("Location Range") as HTMLInputElement).value).toBe(
      "E1"
    );
  });
});
