import { fireEvent, render } from "@testing-library/react";
import React, { useMemo, useState } from "react";
import produce from "immer";
import {
  addTableSlicers,
  createTable,
  defaultContext,
  Context,
  findTable,
  FormulaCache,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import { SlicerLayer, TableOverlay } from "../src/components/Tables";
import { getSheetOverlays } from "../src/extensions";
import { getRibbonCommand } from "../src/components/Ribbon";

const text = (v: string) => ({ v, m: v, ct: { fa: "General", t: "g" } });
const num = (v: number) => ({ v, m: `${v}`, ct: { fa: "General", t: "n" } });

function makeContext(): Context {
  const ctx = defaultContext({} as any);
  const data: any[][] = Array.from({ length: 10 }, () => Array(8).fill(null));
  [
    ["Region", "Qty"],
    ["East", 2],
    ["West", 1],
    ["East", 4],
  ].forEach((row, r) =>
    row.forEach((v, c) => {
      data[r][c] = typeof v === "number" ? num(v) : text(v);
    })
  );
  const base = {
    ...ctx,
    lang: "en",
    currentSheetId: "s1",
    allowEdit: true,
    formulaCache: new FormulaCache(),
    luckysheetfile: [{ name: "Sheet1", id: "s1", order: 0, data, config: {} }],
    config: {},
    visibledatarow: Array.from({ length: 10 }, (_v, i) => (i + 1) * 20),
    visibledatacolumn: Array.from({ length: 8 }, (_v, i) => (i + 1) * 74),
    luckysheet_select_save: [
      { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
    ],
  } as Context;
  return produce(base, (d) => {
    createTable(d, "s1", { row: [0, 3], column: [0, 1] });
    addTableSlicers(d, "Table1", ["Region"]);
  });
}

let current: Context;

const Harness: React.FC<{ initial: Context; children: React.ReactNode }> = ({
  initial,
  children,
}) => {
  const [context, setState] = useState(initial);
  current = context;
  const value = useMemo(
    () => ({
      context,
      setContext: ((recipe: (ctx: Context) => void) => {
        setState((prev) => produce(prev, recipe));
      }) as any,
      refs: {
        workbookContainer: { current: null },
        globalCache: {},
        cellInput: { current: null },
        cellArea: { current: null },
        scrollbarX: { current: { scrollLeft: 0 } },
        scrollbarY: { current: { scrollTop: 0 } },
      } as any,
      settings: {} as any,
    }),
    [context]
  );
  return (
    <WorkbookContext.Provider value={value}>
      {children}
    </WorkbookContext.Provider>
  );
};

describe("tables UI", () => {
  it("registers its overlays; Insert › Slicer is a ribbon command", () => {
    const keys = getSheetOverlays().map((o) => o.key);
    expect(keys).toEqual(expect.arrayContaining(["tables", "slicers"]));
    expect(getRibbonCommand("slicer")).toBeTruthy();
  });

  it("draws header filter buttons that open the table-scoped menu", () => {
    const { container } = render(
      <Harness initial={makeContext()}>
        <TableOverlay />
      </Harness>
    );
    const buttons = container.querySelectorAll(".fortune-table-filter-button");
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute("aria-label")).toBe("Filter: Qty");
    fireEvent.click(buttons[1]);
    expect(current.filterScope).toEqual({ sheetId: "s1", table: "Table1" });
    expect(current.filterContextMenu).toMatchObject({
      col: 1,
      startRow: 0,
      endRow: 3,
      startCol: 0,
      endCol: 1,
    });
    expect(
      container.querySelector(".fortune-table-resize-handle")
    ).toBeTruthy();
  });

  it("slicer buttons filter the table; Clear Filter shows every row", () => {
    const { container, getByRole } = render(
      <Harness initial={makeContext()}>
        <SlicerLayer />
      </Harness>
    );
    const panel = container.querySelector(".fortune-slicer")!;
    expect(panel.getAttribute("aria-label")).toBe("Region");
    const options = () =>
      Array.from(panel.querySelectorAll("[role=option]")).map((o) => [
        o.textContent,
        o.getAttribute("aria-selected"),
      ]);
    expect(options()).toEqual([
      ["East", "true"],
      ["West", "true"],
    ]);
    fireEvent.click(getByRole("option", { name: "West" }));
    expect(options()).toEqual([
      ["East", "false"],
      ["West", "true"],
    ]);
    expect(Object.keys(current.config.rowhidden ?? {})).toEqual(["1", "3"]);
    expect(current.activeSlicer?.name).toBe("Slicer_Region");
    // Ctrl+click adds an item: every item selected is no filter
    fireEvent.click(getByRole("option", { name: "East" }), { ctrlKey: true });
    expect(findTable(current, "Table1")!.table.filters).toBeUndefined();
    fireEvent.click(getByRole("option", { name: "East" }));
    fireEvent.click(getByRole("button", { name: "Clear Filter (Alt+C)" }));
    expect(Object.keys(current.config.rowhidden ?? {})).toEqual([]);
    // multi-select mode toggles items
    fireEvent.click(getByRole("button", { name: "Multi-Select (Alt+S)" }));
    expect(findTable(current, "Table1")!.table.slicers![0].multiSelect).toBe(
      true
    );
    // Delete removes the focused slicer
    fireEvent.keyDown(panel, { key: "Delete" });
    expect(findTable(current, "Table1")!.table.slicers).toBeUndefined();
  });
});
