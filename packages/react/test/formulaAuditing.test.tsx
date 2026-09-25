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
          celldata: [
            num(0, 0, 1),
            num(1, 0, 2),
            num(2, 0, 3),
            { r: 3, c: 0, v: { v: 6, m: "6", f: "=SUM(A1:A3)" } },
            { r: 4, c: 0, v: { v: 12, m: "12", f: "=A4*2" } },
            // number stored as text
            { r: 0, c: 2, v: { v: "42", m: "42", ct: { fa: "@", t: "s" } } },
          ],
          calcChain: [
            { r: 3, c: 0, id: "0" },
            { r: 4, c: 0, id: "0" },
          ],
        },
      ]}
      {...extra}
    />
  );
  return { ...utils, ref };
}

function select(ref: React.RefObject<WorkbookInstance>, r: number, c: number) {
  act(() => {
    ref.current!.setSelection([{ row: [r, r], column: [c, c] }]);
  });
}

const button = (container: HTMLElement, name: string) =>
  container.querySelector(
    `[data-name="${name}"][role=button], [data-name="${name}"] [role=button]`
  ) as HTMLElement;

describe("formula auditing toolbar", () => {
  it("traces precedents and removes the arrows", async () => {
    const { container, ref } = renderBook();
    select(ref, 4, 0);
    fireEvent.click(button(container, "trace-precedents"));
    await waitFor(() =>
      expect(container.querySelectorAll(".fortune-trace-arrow")).toHaveLength(1)
    );
    fireEvent.click(button(container, "trace-precedents"));
    await waitFor(() =>
      expect(container.querySelectorAll(".fortune-trace-arrow")).toHaveLength(2)
    );
    // the second level is the range A1:A3 (boxed)
    expect(container.querySelector(".fortune-trace-range")).toBeTruthy();
    fireEvent.click(button(container, "remove-arrows"));
    await waitFor(() =>
      expect(container.querySelector(".fortune-trace-arrows")).toBeNull()
    );
  });

  it("says so when the active cell has no formula", async () => {
    const { container, ref, findByText } = renderBook();
    select(ref, 0, 0);
    fireEvent.click(button(container, "trace-precedents"));
    expect(
      await findByText(
        "The active cell does not contain a formula that refers to a valid reference."
      )
    ).toBeTruthy();
  });

  it("toggles Show Formulas", () => {
    const { container } = renderBook();
    const b = button(container, "show-formulas");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(b);
    expect(
      button(container, "show-formulas").getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("manual calculation shows Calculate until F9", async () => {
    const { container, ref, getByText } = renderBook();
    fireEvent.click(
      container.querySelector(
        '[data-name="calculation-options"] .fortune-toolbar-combo-button'
      )!
    );
    fireEvent.click(getByText("Manual"));
    act(() => {
      // a formula edit recalculates dependents (a plain API value does not)
      ref.current!.setCellValue(0, 0, "=10");
    });
    const calc = await waitFor(() => {
      const el = container.querySelector(
        '[data-testid="status-calculate"]'
      ) as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    expect(ref.current!.getCellValue(3, 0)).toBe(6);
    fireEvent.click(calc);
    await waitFor(() => expect(ref.current!.getCellValue(3, 0)).toBe(15));
    expect(ref.current!.getCellValue(4, 0)).toBe(30);
    expect(
      container.querySelector('[data-testid="status-calculate"]')
    ).toBeNull();
    expect(ref.current!.getAllSheets()[0].calcSettings?.mode).toBe("manual");
  });

  it("warns about circular references and shows them in the status bar", async () => {
    const { container, ref, findByText } = renderBook();
    act(() => {
      ref.current!.setCellValue(0, 1, "=B2+1");
    });
    act(() => {
      ref.current!.setCellValue(1, 1, "=B1+1");
    });
    expect(
      await findByText(/There are one or more circular references/)
    ).toBeTruthy();
    const status = container.querySelector(
      '[data-testid="status-circular"]'
    ) as HTMLElement;
    expect(status.textContent).toMatch(/^Circular References: B[12]$/);
  });

  it("watch window lists live values", async () => {
    const { container, ref } = renderBook();
    fireEvent.click(button(container, "watch-window"));
    const panel = container.querySelector(".fortune-watch-window")!;
    expect(panel).toBeTruthy();
    select(ref, 3, 0);
    fireEvent.click(panel.querySelector(".fortune-watch-window-button")!);
    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="watch-value"]')?.textContent
      ).toBe("6")
    );
    act(() => {
      ref.current!.setCellValue(0, 0, "=5");
    });
    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="watch-value"]')?.textContent
      ).toBe("10")
    );
  });

  it("evaluates a formula step by step", async () => {
    const { container, ref, getByText } = renderBook();
    select(ref, 4, 0);
    fireEvent.click(button(container, "evaluate-formula"));
    const text = () =>
      document.querySelector('[data-testid="evaluate-level-0"]')!;
    expect(text().textContent).toBe("A4*2");
    expect(text().querySelector(".fortune-evaluate-next")!.textContent).toBe(
      "A4"
    );
    fireEvent.click(getByText("Evaluate"));
    expect(text().textContent).toBe("6*2");
    fireEvent.click(getByText("Evaluate"));
    expect(text().textContent).toBe("12");
    expect(getByText("Restart")).toBeTruthy();
  });
});

describe("error checking smart tag", () => {
  it("converts a number stored as text", async () => {
    const { container, ref } = renderBook();
    select(ref, 0, 2);
    const tag = await waitFor(() => {
      const el = container.querySelector(
        ".fortune-error-tag-button"
      ) as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    fireEvent.click(tag);
    expect(
      container.querySelector(".fortune-error-tag-title")!.textContent
    ).toBe("Number Stored as Text");
    const convert = Array.from(
      container.querySelectorAll(".fortune-error-tag-item")
    ).find((el) => el.textContent === "Convert to Number") as HTMLElement;
    fireEvent.click(convert);
    await waitFor(() => expect(ref.current!.getCellValue(0, 2)).toBe(42));
    expect(container.querySelector(".fortune-error-tag")).toBeNull();
  });

  it("ignores an error", async () => {
    const { container, ref } = renderBook();
    select(ref, 0, 2);
    fireEvent.click(
      await waitFor(() => {
        const el = container.querySelector(".fortune-error-tag-button");
        expect(el).toBeTruthy();
        return el as HTMLElement;
      })
    );
    const ignore = Array.from(
      container.querySelectorAll(".fortune-error-tag-item")
    ).find((el) => el.textContent === "Ignore Error") as HTMLElement;
    fireEvent.click(ignore);
    await waitFor(() =>
      expect(container.querySelector(".fortune-error-tag")).toBeNull()
    );
    expect(ref.current!.getAllSheets()[0].data![0][2]?.ie).toEqual([
      "numberAsText",
    ]);
  });

  it("can be switched off with the errorChecking setting", () => {
    const { container, ref } = renderBook({
      errorChecking: { enabled: false },
    });
    select(ref, 0, 2);
    expect(container.querySelector(".fortune-error-tag")).toBeNull();
  });
});

describe("cell menu", () => {
  it("has a Formula Auditing submenu", () => {
    const { container, ref } = renderBook();
    select(ref, 4, 0);
    fireEvent.keyDown(container.querySelector(".fortune-container")!, {
      key: "F10",
      shiftKey: true,
    });
    const item = container.querySelector(
      '.fortune-cell-menu [data-key="formula-auditing"]'
    ) as HTMLElement;
    expect(item.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(item);
    const labels = Array.from(
      container.querySelectorAll(".fortune-menuitem-label")
    ).map((el) => el.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Trace Precedents",
        "Trace Dependents",
        "Evaluate Formula…",
        "Add Watch",
      ])
    );
  });
});
