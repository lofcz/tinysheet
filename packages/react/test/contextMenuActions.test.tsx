import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";

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
          celldata: [num(0, 0, 1), num(1, 0, 2), num(2, 0, 3), num(0, 1, 10)],
        },
      ]}
      {...extra}
    />
  );
  return { ...utils, ref };
}

const workbookEl = (container: HTMLElement) =>
  container.querySelector(".fortune-container") as HTMLElement;

// the keyboard opener: jsdom has no layout for mouse coordinates
function openMenu(container: HTMLElement) {
  fireEvent.keyDown(workbookEl(container), { key: "F10", shiftKey: true });
  return container.querySelector(".fortune-cell-menu") as HTMLElement;
}

function clickEntry(container: HTMLElement, key: string) {
  const menu = openMenu(container);
  const item = menu.querySelector(`[data-key="${key}"]`) as HTMLElement;
  expect(item).toBeTruthy();
  fireEvent.click(item);
  return item;
}

function select(ref: React.RefObject<WorkbookInstance>, range: any) {
  act(() => {
    ref.current!.setSelection(range);
  });
}

describe("cell menu entries backed by other features", () => {
  it("Format Cells… opens the Format Cells dialog", async () => {
    const { container } = renderBook();
    clickEntry(container, "cell-format");
    await waitFor(() =>
      expect(document.getElementById("fortune-format-cells-title")).toBeTruthy()
    );
  });

  it("Paste Special… is disabled until something is copied, then opens the dialog", async () => {
    const { container } = renderBook();
    const menu = openMenu(container);
    expect(
      menu
        .querySelector('[data-key="paste-special"]')!
        .getAttribute("aria-disabled")
    ).toBe("true");
    fireEvent.click(menu.querySelector('[data-key="copy"]')!);
    clickEntry(container, "paste-special");
    await waitFor(() =>
      expect(document.querySelector(".fortune-paste-special")).toBeTruthy()
    );
  });

  it("Insert Chart adds a chart of the selection", () => {
    const { container, ref } = renderBook();
    select(ref, [{ row: [0, 2], column: [0, 1] }]);
    clickEntry(container, "chart");
    const { charts } = ref.current!.getSheet() as any;
    expect(charts).toHaveLength(1);
    expect(charts[0]).toMatchObject({ type: "column", grouping: "clustered" });
    expect(charts[0].source).toMatchObject({ row: [0, 2], column: [0, 1] });
  });

  it("Define Name… opens New Name for the selection and saves it", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook();
    select(ref, [{ row: [0, 2], column: [0, 0] }]);
    clickEntry(container, "define-name");
    expect(getByText("New Name")).toBeTruthy();
    expect((getByLabelText("Refers to:") as HTMLInputElement).value).toBe(
      "=Sheet1!$A$1:$A$3"
    );
    fireEvent.change(getByLabelText("Name:"), { target: { value: "Items" } });
    fireEvent.click(getByText("OK"));
    // the dialog closes (no Name Manager list behind it)
    await waitFor(() => expect(() => getByText("New Name")).toThrow());
    expect(document.querySelector(".fortune-name-manager")).toBeNull();
    act(() => {
      ref.current!.setCellValue(4, 0, "=SUM(Items)");
    });
    expect(ref.current!.getCellValue(4, 0)).toBe(6);
  });

  it("Data Validation… opens the validation dialog", () => {
    const { container } = renderBook();
    clickEntry(container, "data");
    expect(
      container.ownerDocument.getElementById("fortune-data-verification")
    ).toBeTruthy();
  });

  it("Delete… shifts cells up", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook();
    clickEntry(container, "delete-cells");
    fireEvent.click(getByLabelText("Shift cells up"));
    fireEvent.click(getByText("OK"));
    await waitFor(() => expect(ref.current!.getCellValue(0, 0)).toBe(2));
  });

  it("Insert… refuses to tear a table apart, with Excel's message", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook({
      data: [
        {
          name: "Sheet1",
          celldata: [num(0, 0, 1), num(1, 0, 2), num(2, 0, 3)],
          tables: [
            {
              name: "Table1",
              range: { row: [0, 2], column: [0, 1] },
              headerRow: true,
              totalRow: false,
              bandedRows: true,
              bandedColumns: false,
              firstColumn: false,
              lastColumn: false,
              style: "TableStyleMedium2",
              columns: [{ name: "A" }, { name: "B" }],
            },
          ],
        },
      ],
    });
    select(ref, [{ row: [1, 1], column: [1, 1] }]);
    clickEntry(container, "insert-cells");
    fireEvent.click(getByLabelText("Shift cells down"));
    // the refusal is reported from a timer once the edit has run: run that
    // timer and the alert's render inside act, so a loaded machine cannot
    // outrun a polling timeout
    await act(async () => {
      fireEvent.click(getByText("OK"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      getByText(
        "This operation is not allowed. The operation is attempting to shift cells in a table on your worksheet."
      )
    ).toBeTruthy();
    expect(ref.current!.getCellValue(1, 0)).toBe(2);
  });

  it("Esc closes the Insert… dialog wherever the focus is", () => {
    const { container, getByLabelText, queryByLabelText } = renderBook();
    clickEntry(container, "insert-cells");
    expect(getByLabelText("Shift cells down")).toBeTruthy();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(queryByLabelText("Shift cells down")).toBeNull();
  });
});

describe("Ctrl+- / Ctrl+Shift+= keyboard", () => {
  // the sheet only takes shortcuts while it has the focus
  const focusSheet = (ref: React.RefObject<WorkbookInstance>) =>
    select(ref, [{ row: [0, 0], column: [0, 0] }]);

  it("opens the Delete… dialog for a cell range", () => {
    const { container, ref, getByLabelText, getByRole } = renderBook();
    focusSheet(ref);
    select(ref, [{ row: [0, 1], column: [0, 0] }]);
    fireEvent.keyDown(workbookEl(container), {
      key: "-",
      code: "Minus",
      ctrlKey: true,
    });
    // the dialog by its title (the ribbon has a Delete button too)
    expect(getByRole("dialog", { name: "Delete" })).toBeTruthy();
    expect(getByLabelText("Shift cells up")).toBeTruthy();
  });

  it("opens the Insert… dialog with Ctrl+Shift+=", () => {
    const { container, ref, getByLabelText } = renderBook();
    focusSheet(ref);
    fireEvent.keyDown(workbookEl(container), {
      key: "+",
      code: "Equal",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(getByLabelText("Shift cells down")).toBeTruthy();
  });
});
