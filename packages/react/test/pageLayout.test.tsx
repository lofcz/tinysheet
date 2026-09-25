import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import { Workbook, WorkbookInstance, registerPageLayoutFeature } from "../src";
import { showRibbonItem } from "./ribbonHelpers";

registerPageLayoutFeature();

const num = (r: number, c: number, v: number) => ({
  r,
  c,
  v: { v, m: String(v), ct: { fa: "General", t: "n" } },
});

function renderBook() {
  const ref = React.createRef<WorkbookInstance>();
  const celldata = [];
  for (let r = 0; r < 60; r += 1) celldata.push(num(r, 0, r), num(r, 1, r * 2));
  const utils = render(
    <Workbook
      ref={ref}
      lang="en"
      data={[{ name: "Sheet1", id: "s1", celldata }]}
    />
  );
  return { ...utils, ref };
}

const setup = (ref: React.RefObject<WorkbookInstance>) =>
  ref.current!.getSheet().pageSetup ?? {};

function menu(container: HTMLElement, action: string) {
  showRibbonItem(container, "pageLayout");
  fireEvent.click(
    container.querySelector('.fortune-page-layout-menu [role="button"]')!
  );
  const item = container.querySelector(`[data-action="${action}"]`);
  expect(item).toBeTruthy();
  fireEvent.click(item!.parentElement!);
}

describe("page layout toolbar", () => {
  it("sets and clears the print area from the selection", async () => {
    const { container, ref } = renderBook();
    act(() => ref.current!.setSelection([{ row: [0, 9], column: [0, 1] }]));
    menu(container, "setPrintArea");
    await waitFor(() =>
      expect(setup(ref).printArea).toEqual([{ row: [0, 9], column: [0, 1] }])
    );
    menu(container, "clearPrintArea");
    await waitFor(() => expect(setup(ref).printArea).toBeUndefined());
  });

  it("inserts a page break and shows the break lines", async () => {
    const { container, ref } = renderBook();
    act(() => ref.current!.setSelection([{ row: [20, 20], column: [0, 0] }]));
    menu(container, "insertPageBreak");
    await waitFor(() => expect(setup(ref).rowBreaks).toEqual([20]));
    await waitFor(() =>
      expect(container.querySelector(".fortune-page-break.manual")).toBeTruthy()
    );
    menu(container, "landscape");
    await waitFor(() => expect(setup(ref).orientation).toBe("landscape"));
  });

  it("toggles Page Break Preview with page watermarks", async () => {
    const { container } = renderBook();
    menu(container, "pageBreakPreview");
    await waitFor(() =>
      expect(
        container.querySelector(".fortune-page-breaks.preview")
      ).toBeTruthy()
    );
    expect(container.querySelector(".fortune-page-area")).toBeTruthy();
  });
});

describe("page setup dialog", () => {
  it("edits the setup and applies it on OK", async () => {
    const { container, ref, getByRole, getByLabelText } = renderBook();
    menu(container, "pageSetup");
    const dialog = await waitFor(() => getByRole("dialog"));
    fireEvent.click(getByLabelText("Landscape"));
    fireEvent.click(getByRole("tab", { name: "Sheet" }));
    fireEvent.change(getByLabelText("Rows to repeat at top:"), {
      target: { value: "$1:$1" },
    });
    fireEvent.click(getByLabelText("Gridlines"));
    fireEvent.click(getByRole("tab", { name: "Header/Footer" }));
    fireEvent.change(getByLabelText("Center section"), {
      target: { value: "Page &P" },
    });
    fireEvent.click(getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(setup(ref)).toMatchObject({
        orientation: "landscape",
        printTitleRows: [0, 0],
        gridLines: true,
        header: { center: "Page &P" },
      })
    );
    expect(dialog.isConnected).toBe(false);
  });

  it("rejects an invalid print area", async () => {
    const { container, ref, getByRole, getByLabelText } = renderBook();
    menu(container, "pageSetup");
    await waitFor(() => getByRole("dialog"));
    fireEvent.click(getByRole("tab", { name: "Sheet" }));
    fireEvent.change(getByLabelText("Print area:"), {
      target: { value: "nonsense!!" },
    });
    fireEvent.click(getByRole("button", { name: "OK" }));
    expect(document.querySelector(".fortune-ps-error")?.textContent).toMatch(
      /not valid/
    );
    expect(setup(ref).printArea).toBeUndefined();
  });
});

describe("print preview", () => {
  it("opens from the Print button and pages through the sheet", async () => {
    const { getByRole, container } = renderBook();
    showRibbonItem(container, "print");
    fireEvent.click(getByRole("button", { name: "Print (Ctrl+P)" }));
    await waitFor(() =>
      expect(
        container.ownerDocument.querySelector(".fortune-print-preview")
      ).toBeTruthy()
    );
    const doc = container.ownerDocument;
    await waitFor(() =>
      expect(
        doc.querySelector(".fortune-pp-page .fortune-print-page")
      ).toBeTruthy()
    );
    // 60 rows: two pages at 45 rows per Letter page
    expect(doc.querySelector(".fortune-pp-page-of")?.textContent).toMatch(
      /of 2/
    );
    fireEvent.click(getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(
        (doc.querySelector(".fortune-print-page") as HTMLElement).dataset.page
      ).toBe("2")
    );
  });

  it("prints with an @page stylesheet and window.print()", async () => {
    const print = jest.fn();
    const original = window.print;
    window.print = print;
    try {
      const { getByRole, container } = renderBook();
      showRibbonItem(container, "print");
      fireEvent.click(getByRole("button", { name: "Print (Ctrl+P)" }));
      const button = await waitFor(() =>
        getByRole("button", { name: "Print" })
      );
      fireEvent.click(button);
      expect(print).toHaveBeenCalled();
      const style = document.getElementById("fortune-print-style");
      expect(style?.textContent).toMatch(/size: 8\.5in 11in/);
      expect(
        document.querySelectorAll("#fortune-print-root .fortune-print-page")
      ).toHaveLength(2);
      act(() => {
        window.dispatchEvent(new Event("afterprint"));
      });
      expect(document.getElementById("fortune-print-root")).toBeNull();
    } finally {
      window.print = original;
    }
  });
});
