import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";

const cell = (r: number, c: number, v: number | string) => ({
  r,
  c,
  v:
    typeof v === "number"
      ? { v, m: String(v), ct: { fa: "General", t: "n" } }
      : { v, m: v, ct: { fa: "General", t: "g" } },
});

const celldata = [
  cell(0, 1, "Sales"),
  cell(0, 2, "Share"),
  cell(1, 0, "Jan"),
  cell(1, 1, 10),
  cell(1, 2, 0.2),
  cell(2, 0, "Feb"),
  cell(2, 1, 20),
  cell(2, 2, 0.3),
  cell(3, 0, "Mar"),
  cell(3, 1, 30),
  cell(3, 2, 0.5),
];

function renderBook() {
  const ref = React.createRef<WorkbookInstance>();
  const utils = render(
    <Workbook
      ref={ref}
      lang="en"
      data={[
        {
          name: "Sheet1",
          celldata,
          charts: [
            {
              id: "c1",
              type: "column",
              grouping: "clustered",
              series: [1, 2].map((c) => ({
                nameRef: { sheetId: "s1", row: [0, 0], column: [c, c] },
                values: { sheetId: "s1", row: [1, 3], column: [c, c] },
                categories: { sheetId: "s1", row: [1, 3], column: [0, 0] },
              })),
              left: 300,
              top: 40,
              width: 320,
              height: 200,
            },
          ],
          id: "s1",
        } as any,
      ]}
    />
  );
  return { ...utils, ref };
}

const chartOf = (ref: React.RefObject<WorkbookInstance>) =>
  (ref.current!.getSheet() as any).charts[0];

describe("chart UI, round 2", () => {
  it("anchors charts from older files to their cells", async () => {
    const { ref } = renderBook();
    await waitFor(() => expect(chartOf(ref).anchor).toBeTruthy());
    expect(chartOf(ref).anchor.from.col).toBe(4);
  });

  it("right-click opens the chart menu with picture export entries", async () => {
    const { container } = renderBook();
    const box = await waitFor(() => {
      const el = container.querySelector(".fortune-chart-box");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.contextMenu(box, { clientX: 20, clientY: 30 });
    const menu = container.querySelector(".fortune-chart-menu") as HTMLElement;
    expect(menu).toBeTruthy();
    const keys = Array.from(menu.querySelectorAll("[data-chart-menu]")).map(
      (el) => el.getAttribute("data-chart-menu")
    );
    expect(keys).toEqual([
      "cut",
      "copy",
      "copyAsImage",
      "exportPng",
      "exportSvg",
      "edit",
      "delete",
    ]);
    fireEvent.click(menu.querySelector('[data-chart-menu="edit"]')!);
    expect(container.querySelector(".fortune-chart-menu")).toBeNull();
    expect(container.querySelector(".fortune-chart-editor")).toBeTruthy();
  });

  it("the editor switches to a combo with a secondary axis, styles and palettes", async () => {
    const { container, ref } = renderBook();
    const box = await waitFor(() => {
      const el = container.querySelector(".fortune-chart-box");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.doubleClick(box);
    const editor = container.querySelector(
      ".fortune-chart-editor"
    ) as HTMLElement;
    const typeSelect = editor.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, {
      target: { value: "comboColumnLineSecondary" },
    });
    let chart = chartOf(ref);
    expect(chart.type).toBe("combo");
    expect(chart.series.map((s: any) => s.type)).toEqual(["column", "line"]);
    expect(chart.series[1].secondary).toBe(true);

    // style gallery: 8 live thumbnails
    const tiles = editor.querySelectorAll(".fortune-chart-style-tile");
    expect(tiles).toHaveLength(8);
    fireEvent.click(tiles[1]);
    chart = chartOf(ref);
    expect(chart.style).toBe(2);
    expect(chart.dataLabels).toBe(true);

    fireEvent.click(
      editor.querySelectorAll(".fortune-chart-palette")[4] as HTMLElement
    );
    expect(chartOf(ref).palette).toBe("monochrome1");

    // placement
    const radios = editor.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[2]);
    expect(chartOf(ref).placement).toBe("absolute");
  });

  it("trendlines and error bars are set per series", async () => {
    const { container, ref } = renderBook();
    const box = await waitFor(() => {
      const el = container.querySelector(".fortune-chart-box");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.doubleClick(box);
    const analysis = container.querySelector(
      ".fortune-chart-series-analysis"
    ) as HTMLElement;
    const [trend] = Array.from(analysis.querySelectorAll("select"));
    fireEvent.change(trend, { target: { value: "polynomial" } });
    expect(chartOf(ref).series[0].trendlines).toEqual([{ type: "polynomial" }]);
    const selects = container
      .querySelector(".fortune-chart-series-analysis")!
      .querySelectorAll("select");
    fireEvent.change(selects[selects.length - 1], {
      target: { value: "percentage" },
    });
    expect(chartOf(ref).series[0].errorBars).toEqual({ type: "percentage" });
    // the chart renders the trendline (dotted path)
    await waitFor(() =>
      expect(
        container.querySelector('.fortune-chart-svg [stroke-dasharray="2 3"]')
      ).toBeTruthy()
    );
  });

  it("hidden rows collapse a move-and-size chart", async () => {
    const { container, ref } = renderBook();
    await waitFor(() => expect(chartOf(ref).anchor).toBeTruthy());
    const { from, to } = chartOf(ref).anchor;
    act(() => {
      ref.current!.hideRowOrColumn(
        Array.from({ length: to.row - from.row + 1 }, (_, i) =>
          String(from.row + i)
        ),
        "row"
      );
    });
    await waitFor(() =>
      expect(container.querySelector(".fortune-chart-box")).toBeNull()
    );
  });
});
