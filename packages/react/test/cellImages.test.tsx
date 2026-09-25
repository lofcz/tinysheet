import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";

const URL = "https://example.com/logo.png";

function renderBook(celldata: any[] = []) {
  const ref = React.createRef<WorkbookInstance>();
  const utils = render(
    <Workbook ref={ref} lang="en" data={[{ name: "Sheet1", celldata }]} />
  );
  return { ...utils, ref };
}

const picture = (r: number, c: number, alt?: string) => ({
  r,
  c,
  v: {
    v: alt ?? "",
    m: alt ?? "",
    ct: { fa: "General", t: "g" },
    img: alt ? { src: URL, alt } : { src: URL },
  },
});

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

const cellOf = (ref: React.RefObject<WorkbookInstance>, r: number, c: number) =>
  (ref.current!.getSheet() as any).data[r][c];

describe("pictures in cells", () => {
  it("places a picture from a web address into the active cell", async () => {
    const { container, ref, getByLabelText, getByText } = renderBook();
    select(ref, 1, 1);
    const menu = openMenu(container);
    // only the insert entry on a cell without a picture
    expect(menu.querySelector('[data-key="picture-alt-text"]')).toBeNull();
    expect(menu.querySelector('[data-key="picture-over-cells"]')).toBeNull();
    fireEvent.click(menu.querySelector('[data-key="picture-in-cell"]')!);
    await waitFor(() =>
      expect(getByText("Insert Picture in Cell")).toBeTruthy()
    );

    const url = getByLabelText(
      "Picture address (https:// or data:image)"
    ) as HTMLInputElement;
    // unsafe addresses are refused
    fireEvent.change(url, { target: { value: "file:///etc/passwd" } });
    fireEvent.keyDown(url, { key: "Enter" });
    expect(getByText("Enter an https:// address of a picture.")).toBeTruthy();

    fireEvent.change(url, { target: { value: URL } });
    fireEvent.change(getByLabelText("Alt Text"), {
      target: { value: "Logo" },
    });
    fireEvent.keyDown(url, { key: "Enter" });
    await waitFor(() =>
      expect(cellOf(ref, 1, 1)?.img).toEqual({ src: URL, alt: "Logo" })
    );
    expect(cellOf(ref, 1, 1).v).toBe("Logo");
    // one undo step removes it
    act(() => {
      ref.current!.handleUndo();
    });
    expect(cellOf(ref, 1, 1)?.img).toBeUndefined();
  });

  it("edits the alt text and shows the picture chip in the formula bar", async () => {
    const { container, ref, getByLabelText } = renderBook([
      picture(0, 0, "Logo"),
    ]);
    select(ref, 0, 0);
    const chip = container.querySelector(".fortune-fx-picture-chip");
    expect(chip?.textContent).toBe("Logo");

    const menu = openMenu(container);
    fireEvent.click(menu.querySelector('[data-key="picture-alt-text"]')!);
    const box = (await waitFor(() =>
      getByLabelText("Describe this picture for people who can't see it")
    )) as HTMLTextAreaElement;
    expect(box.value).toBe("Logo");
    fireEvent.change(box, { target: { value: "Company logo" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(cellOf(ref, 0, 0).img).toEqual({ src: URL, alt: "Company logo" })
    );
    expect(
      container.querySelector(".fortune-fx-picture-chip")?.textContent
    ).toBe("Company logo");
  });

  it("Place over Cells turns the cell picture into a floating picture", async () => {
    const { container, ref } = renderBook([picture(0, 0, "Logo")]);
    select(ref, 0, 0);
    const menu = openMenu(container);
    fireEvent.click(menu.querySelector('[data-key="picture-over-cells"]')!);
    await waitFor(() => expect(cellOf(ref, 0, 0)?.img).toBeUndefined());
    const { images } = ref.current!.getSheet() as any;
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ src: URL, alt: "Logo" });
  });

  it("the toolbar item opens the insert dialog", async () => {
    const { container, getByText } = renderBook();
    const button = container.querySelector(
      '.fortune-toolbar-item[aria-label="Picture in Cell"]'
    ) as HTMLElement;
    expect(button).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() =>
      expect(getByText("Insert Picture in Cell")).toBeTruthy()
    );
  });

  it("IMAGE() shows its formula in the formula bar, not a chip", () => {
    const { container, ref } = renderBook();
    act(() => {
      ref.current!.setCellValue(0, 0, `=IMAGE("${URL}","Logo")`);
    });
    expect(cellOf(ref, 0, 0).img).toEqual({ src: URL, alt: "Logo" });
    select(ref, 0, 0);
    expect(container.querySelector(".fortune-fx-picture-chip")).toBeNull();
    const fx = container.querySelector("#luckysheet-functionbox-cell");
    expect(fx?.textContent).toContain("=IMAGE(");
  });
});
