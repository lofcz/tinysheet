import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";
import { registerContextMenuAction } from "../src/components/ContextMenu/actions";
import { STATUS_BAR_STORAGE_KEY } from "../src/components/StatusBar";

const num = (r: number, c: number, v: number) => ({
  r,
  c,
  v: { v, m: String(v), ct: { fa: "General", t: "n" } },
});

function renderBook(extra: Record<string, any> = {}) {
  const ref = React.createRef<WorkbookInstance>();
  const utils = render(
    <Workbook
      ref={ref}
      lang="en"
      data={[
        {
          name: "Sheet1",
          celldata: [
            num(0, 0, 1),
            num(1, 0, 2),
            num(2, 0, 3.5),
            { r: 3, c: 0, v: { v: "text", m: "text", ct: { t: "g" } } },
          ],
        },
      ]}
      {...extra}
    />
  );
  return { ...utils, ref };
}

function select(ref: React.RefObject<WorkbookInstance>, range: any) {
  act(() => {
    ref.current!.setSelection(range);
  });
}

describe("status bar", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STATUS_BAR_STORAGE_KEY);
  });

  it("shows Excel's default aggregates for the selection", async () => {
    const { container, ref } = renderBook();
    select(ref, [{ row: [0, 3], column: [0, 0] }]);
    await waitFor(() =>
      expect(
        container.querySelector(".fortune-status-bar-stats")?.textContent
      ).toBe("Average: 2.166666667Count: 4Sum: 6.5")
    );
  });

  it("lets the user pick aggregates from a right-click menu, persisted", async () => {
    const { container, ref, getByText } = renderBook();
    select(ref, [{ row: [0, 2], column: [0, 0] }]);
    const bar = container.querySelector(".fortune-status-bar")!;
    await waitFor(() => expect(bar.textContent).toContain("Sum: 6.5"));
    fireEvent.contextMenu(bar);
    expect(getByText("Customize Status Bar")).toBeTruthy();
    fireEvent.click(
      container.querySelector('.fortune-status-bar-menu-item[data-stat="max"]')!
    );
    fireEvent.click(
      container.querySelector('.fortune-status-bar-menu-item[data-stat="sum"]')!
    );
    const stats = bar.querySelector(".fortune-status-bar-stats")!;
    expect(stats.textContent).toContain("Max: 3.5");
    expect(stats.textContent).not.toContain("Sum");
    expect(
      JSON.parse(window.localStorage.getItem(STATUS_BAR_STORAGE_KEY)!)
    ).toEqual(["average", "count", "max"]);
  });

  it("copies a value on click", async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container, ref } = renderBook();
    select(ref, [{ row: [0, 2], column: [0, 0] }]);
    await waitFor(() =>
      expect(
        container.querySelector('.fortune-status-bar-item[data-stat="sum"]')
      ).toBeTruthy()
    );
    fireEvent.click(
      container.querySelector('.fortune-status-bar-item[data-stat="sum"]')!
    );
    expect(writeText).toHaveBeenCalledWith("6.5");
  });
});

describe("cell context menu", () => {
  // (the keyboard opener: jsdom has no layout for mouse coordinates)
  const openMenu = (container: HTMLElement) => {
    fireEvent.keyDown(container.querySelector(".fortune-container")!, {
      key: "F10",
      shiftKey: true,
    });
    return container.querySelector(".fortune-cell-menu") as HTMLElement;
  };

  it("lists Excel's items with shortcuts and submenus", () => {
    const { container } = renderBook();
    const menu = openMenu(container);
    expect(menu).toBeTruthy();
    const labels = Array.from(
      menu.querySelectorAll(":scope > [role=menuitem] .fortune-menuitem-label")
    ).map((el) => el.textContent);
    expect(labels).toEqual([
      "Cut",
      "Copy",
      "Paste",
      "Paste Special…",
      "Insert…",
      "Delete…",
      "Clear Contents",
      "Filter",
      "Sort",
      "New Comment",
      "New Note",
      "Format Cells…",
      "Pick From Drop-down List…",
      "Define Name…",
      "Link…",
      "Insert Image…",
      "Place Picture in Cell…",
      "Data Validation…",
      "Insert Chart",
      "Formula Auditing",
    ]);
    // A1 has values below it to pick from
    expect(
      menu
        .querySelector('[data-key="pick-list"]')!
        .getAttribute("aria-disabled")
    ).toBeNull();
    fireEvent.click(menu.querySelector('[data-key="sort-menu"]')!);
    const sub = container.querySelector(".fortune-cell-submenu")!;
    expect(sub.textContent).toContain("Sort A to Z");
  });

  it("shows entries registered by other features", () => {
    const action = jest.fn();
    const unregister = registerContextMenuAction("formatCells", action);
    const { container } = renderBook();
    const menu = openMenu(container);
    const item = menu.querySelector('[data-key="cell-format"]') as HTMLElement;
    expect(item.textContent).toContain("Format Cells…");
    fireEvent.click(item);
    expect(action).toHaveBeenCalled();
    unregister();
  });

  it("opens the Insert… dialog and shifts cells down", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook();
    const menu = openMenu(container);
    fireEvent.click(menu.querySelector('[data-key="insert-cells"]')!);
    fireEvent.click(getByLabelText("Shift cells down"));
    fireEvent.click(getByText("OK"));
    await waitFor(() => expect(ref.current!.getCellValue(1, 0)).toBe(1));
    expect(ref.current!.getCellValue(0, 0) ?? null).toBeNull();
  });

  it("opens with Shift+F10 at the active cell and navigates with arrows", () => {
    const { container } = renderBook();
    const wb = container.querySelector(".fortune-container")!;
    fireEvent.keyDown(wb, { key: "F10", shiftKey: true });
    const menu = container.querySelector(".fortune-cell-menu")!;
    expect(menu).toBeTruthy();
    expect(document.activeElement?.textContent).toContain("Cut");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Copy");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(container.querySelector(".fortune-cell-menu")).toBeNull();
  });

  it("uses the header menu with Row Height… for entire rows", () => {
    const { container, ref, getByText } = renderBook();
    select(ref, [{ row: [1, 2], column: [0, 59], row_select: true }] as any);
    fireEvent.keyDown(container.querySelector(".fortune-container")!, {
      key: "ContextMenu",
    });
    const menu = container.querySelector(".fortune-cell-menu")!;
    expect(menu.textContent).toContain("Row Height…");
    expect(menu.textContent).toContain("AutoFit Row Height");
    expect(menu.textContent).not.toContain("Column Width…");
    fireEvent.click(menu.querySelector('[data-key="set-row-height"]')!);
    const input = container.ownerDocument.querySelector(
      ".fortune-cellmenu-dialog-input"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "40" } });
    fireEvent.click(getByText("OK"));
    expect(ref.current!.getRowHeight([1, 2])).toEqual({ 1: 40, 2: 40 });
  });
});
