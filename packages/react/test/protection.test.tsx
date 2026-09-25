import {
  act,
  fireEvent,
  render,
  waitFor as rtlWaitFor,
} from "@testing-library/react";
import React from "react";
import { protectionLocale } from "@lofcz/tinysheet-core";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";
import { showRibbonItem } from "./ribbonHelpers";

const t = protectionLocale({ lang: "en" });

// generous: password hashing runs in plain JS under jsdom
const waitFor = (fn: () => void) => rtlWaitFor(fn, { timeout: 15000 });

function renderBook(sheets: any[]) {
  const ref = React.createRef<WorkbookInstance>();
  const utils = render(<Workbook ref={ref} lang="en" data={sheets} />);
  return { ...utils, ref };
}

const sheet = (extra: Record<string, any> = {}) => ({
  name: "Sheet1",
  id: "s1",
  order: 0,
  celldata: [
    { r: 0, c: 0, v: { v: 1, m: "1", ct: { fa: "General", t: "n" } } },
    { r: 1, c: 0, v: { v: 2, m: "2", f: "=1+1", hi: 1 } },
    { r: 2, c: 0, v: { v: 3, m: "3", lo: 0 } },
  ],
  ...extra,
});

/** The button of ribbon command `id` (Review › Protect). */
function ribbonButton(container: HTMLElement, id: string) {
  return showRibbonItem(container, id)!.querySelector("button")!;
}

function openMenu(container: HTMLElement, testId: string) {
  showRibbonItem(container, testId.replace(/^toolbar-/, ""));
  const item = container.querySelector(`[data-testid="${testId}"]`)!;
  fireEvent.click(item.querySelector(".fortune-toolbar-combo-arrow")!);
}

describe("protection UI", () => {
  it("protects the sheet from the Protection menu and refuses edits", async () => {
    const { container, ref, getByTestId, getByText } = renderBook([sheet()]);
    const protect = ribbonButton(container, "protection");
    expect(protect.getAttribute("aria-label")).toBe("Protect Sheet");
    expect(protect.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(protect);
    const dialog = getByTestId("protect-sheet-dialog");
    // Excel's list of allowed actions, selecting cells checked by default
    const boxes = dialog.querySelectorAll<HTMLInputElement>(
      ".fortune-protection-actions input[type=checkbox]"
    );
    expect(boxes).toHaveLength(15);
    expect(Array.from(boxes).map((b) => b.checked)).toEqual([
      true,
      true,
      ...Array(13).fill(false),
    ]);
    expect(dialog.textContent).toContain(t.actions.filter);
    fireEvent.click(getByTestId("protection-ok"));
    await waitFor(() =>
      expect(ref.current!.getSheet().config?.authority?.sheet).toBe(1)
    );

    act(() => {
      ref.current!.setSelection([{ row: [0, 0], column: [0, 0] }]);
    });
    // a locked cell: the formula bar focus and Delete are refused
    act(() => {
      fireEvent.keyDown(container.querySelector(".luckysheet-cell-input")!, {
        key: "Delete",
        code: "Delete",
      });
    });
    await waitFor(() => expect(getByText(t.protectedMessage)).toBeTruthy());
    expect(ref.current!.getCellValue(0, 0)).toBe(1);
  });

  it("hides formulas of hidden cells in the formula bar", async () => {
    const { container, ref } = renderBook([
      sheet({ config: { authority: { sheet: 1 } } }),
    ]);
    act(() => {
      ref.current!.setSelection([{ row: [1, 1], column: [0, 0] }]);
    });
    const fx = container.querySelector(".fortune-fx-editor [contenteditable]")!;
    await waitFor(() => expect(fx.textContent).toBe(""));
    act(() => {
      ref.current!.setSelection([{ row: [0, 0], column: [0, 0] }]);
    });
    await waitFor(() => expect(fx.textContent).toBe("1"));
  });

  it("asks for the password to unprotect", async () => {
    const { container, ref, getByTestId, getByText } = renderBook([
      // legacy hash of "test"
      sheet({ config: { authority: { sheet: 1, legacyHash: "CBEB" } } }),
    ]);
    expect(ribbonButton(container, "allow-edit-ranges").disabled).toBe(true);
    const unprotect = ribbonButton(container, "protection");
    expect(unprotect.getAttribute("aria-label")).toBe("Unprotect Sheet");
    expect(unprotect.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(unprotect);
    const input = getByTestId("protection-password") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.click(getByTestId("protection-ok"));
    await waitFor(() => expect(getByText(t.wrongPassword)).toBeTruthy());
    expect(ref.current!.getSheet().config?.authority?.sheet).toBe(1);
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(getByTestId("protection-ok"));
    await waitFor(() =>
      expect(ref.current!.getSheet().config?.authority).toBeUndefined()
    );
  });

  it("protects the workbook structure", async () => {
    const { container, ref, getByTestId, getByText } = renderBook([
      sheet(),
      { name: "Sheet2", id: "s2", order: 1, celldata: [] },
    ]);
    fireEvent.click(ribbonButton(container, "protect-workbook"));
    getByTestId("protect-workbook-dialog");
    fireEvent.click(getByTestId("protection-ok"));
    await waitFor(() =>
      expect(
        ref.current!.getAllSheets()[0].workbookProtection?.lockStructure
      ).toBe(true)
    );
    act(() => {
      ref.current!.deleteSheet({ id: "s2" });
    });
    expect(ref.current!.getAllSheets()).toHaveLength(2);
    await waitFor(() =>
      expect(getByText(t.workbookProtectedMessage)).toBeTruthy()
    );
  });

  it("adds an Allow Edit Range", async () => {
    const { container, ref, getByTestId } = renderBook([sheet()]);
    act(() => {
      ref.current!.setSelection([{ row: [1, 2], column: [1, 2] }]);
    });
    fireEvent.click(ribbonButton(container, "allow-edit-ranges"));
    const dialog = getByTestId("allow-edit-ranges-dialog");
    fireEvent.click(
      Array.from(dialog.querySelectorAll<HTMLElement>("[role=button]")).find(
        (b) => b.textContent === t.newRange
      )!
    );
    expect((getByTestId("range-refers-to") as HTMLInputElement).value).toBe(
      "=$B$2:$C$3"
    );
    fireEvent.click(getByTestId("protection-ok"));
    await waitFor(() =>
      expect(ref.current!.getSheet().config?.authority?.allowRangeList).toEqual(
        [{ name: "Range1", sqref: "$B$2:$C$3" }]
      )
    );
  });

  it("toggles gridlines and the formula bar from the View menu", async () => {
    const { container, ref, getByTestId } = renderBook([sheet()]);
    openMenu(container, "toolbar-view-options");
    expect(getByTestId("menu-gridlines").getAttribute("aria-checked")).toBe(
      "true"
    );
    fireEvent.click(getByTestId("menu-gridlines"));
    await waitFor(() => expect(ref.current!.getSheet().showGridLines).toBe(0));
    openMenu(container, "toolbar-view-options");
    fireEvent.click(getByTestId("menu-formula-bar"));
    await waitFor(() =>
      expect(
        container.querySelector(".fortune-fx-editor")!.parentElement!.hidden
      ).toBe(true)
    );
    openMenu(container, "toolbar-view-options");
    fireEvent.click(getByTestId("menu-headings"));
    await waitFor(() =>
      expect(ref.current!.getSheet().showRowColHeaders).toBe(false)
    );
  });
});
