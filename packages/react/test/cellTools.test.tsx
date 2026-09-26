import { act, fireEvent, render, within } from "@testing-library/react";
import React, { useMemo, useState } from "react";
import produce from "immer";
import {
  defaultContext,
  defaultSettings,
  Context,
  updateCell,
  groupValuesRefresh,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import { ModalProvider } from "../src/context/modal";
import { getSheetOverlays } from "../src/extensions";
import { getRibbonCommand } from "../src/components/Ribbon";
import { registerBuiltinRibbonCommands } from "../src/components/Ribbon/commands";
import {
  AdvancedFilter,
  DataTable,
  GoalSeek,
  registerCellTools,
} from "../src/components/CellTools";

function makeContext(cells: Record<string, string> = {}): Context {
  const ctx = defaultContext({} as any);
  const data: any[][] = Array.from({ length: 20 }, () => Array(8).fill(null));
  const base = {
    ...ctx,
    lang: "en",
    currentSheetId: "s1",
    allowEdit: true,
    config: {},
    groupValuesRefreshData: [],
    luckysheetfile: [{ name: "Sheet1", id: "s1", order: 0, data, config: {} }],
    luckysheet_select_save: [
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ],
    visibledatarow: Array.from({ length: 20 }, (_, i) => (i + 1) * 20),
    visibledatacolumn: Array.from({ length: 8 }, (_, i) => (i + 1) * 74),
  } as unknown as Context;
  Object.entries(cells).forEach(([a1, text]) => {
    const m = /^([A-Z])(\d+)$/.exec(a1)!;
    const r = Number(m[2]) - 1;
    const c = m[1].charCodeAt(0) - 65;
    updateCell(base, r, c, { innerText: text, innerHTML: text } as any, text);
    groupValuesRefresh(base);
  });
  return base;
}

let current: Context;

const Harness: React.FC<{
  initial: Context;
  children: React.ReactNode;
}> = ({ initial, children }) => {
  const [context, setState] = useState(initial);
  current = context;
  const value = useMemo(
    () => ({
      context,
      setContext: ((recipe: (ctx: Context) => void) => {
        setState((prev) =>
          produce(prev, (d) => {
            recipe(d as Context);
            if ((d as Context).groupValuesRefreshData?.length) {
              groupValuesRefresh(d as Context);
            }
          })
        );
      }) as any,
      refs: { workbookContainer: { current: null } } as any,
      settings: defaultSettings as any,
      handleUndo: () => {},
      handleRedo: () => {},
    }),
    [context]
  );
  return (
    <WorkbookContext.Provider value={value}>
      <ModalProvider>{children}</ModalProvider>
    </WorkbookContext.Provider>
  );
};

const v = (a1: string) => {
  const m = /^([A-Z])(\d+)$/.exec(a1)!;
  return current.luckysheetfile[0].data![Number(m[2]) - 1][
    m[1].charCodeAt(0) - 65
  ]?.v;
};

const setField = (container: HTMLElement, id: string, value: string) =>
  fireEvent.change(container.querySelector(`#${id}`)!, { target: { value } });

beforeAll(() => {
  registerCellTools();
  registerBuiltinRibbonCommands();
});

/** A ribbon command by id, as the ribbon renders it. */
const command = (id: string) => {
  const { Component } = getRibbonCommand(id)!;
  return <Component id={id} size="large" />;
};

describe("registration", () => {
  it("has ribbon commands, default toolbar names, and overlays", () => {
    expect(getRibbonCommand("checkbox")).toBeTruthy();
    expect(getRibbonCommand("flash-fill")?.options.aliases).toContain(
      "data-tools"
    );
    expect(defaultSettings.toolbarItems).toContain("checkbox");
    expect(defaultSettings.toolbarItems).toContain("data-tools");
    const keys = getSheetOverlays().map((o) => o.key);
    expect(keys).toEqual(
      expect.arrayContaining(["cellToolsNotice", "dataTableRecalc", "refPick"])
    );
  });
});

describe("ribbon commands", () => {
  it("the Checkbox button inserts and removes checkboxes", () => {
    const ctx = makeContext();
    ctx.luckysheet_select_save = [
      { row: [0, 1], column: [0, 0], row_focus: 0, column_focus: 0 },
    ];
    const { getByRole } = render(
      <Harness initial={ctx}>{command("checkbox")}</Harness>
    );
    const button = getByRole("button", { name: "Checkbox" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(v("A1")).toBe(false);
    expect(current.luckysheetfile[0].data![1][0]?.cb).toBe(1);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(current.luckysheetfile[0].data![1][0]?.cb).toBeUndefined();
  });

  it("Flash Fill fills and reports the count", () => {
    const ctx = makeContext({
      A1: "Nancy Davolio",
      B1: "Nancy",
      A2: "Andrew Fuller",
      A3: "Janet Leverling",
    });
    ctx.luckysheet_select_save = [
      { row: [1, 1], column: [1, 1], row_focus: 1, column_focus: 1 },
    ];
    const Notice = getSheetOverlays().find(
      (o) => o.key === "cellToolsNotice"
    )!.Component;
    const { getByRole, getByText } = render(
      <Harness initial={ctx}>
        {command("flash-fill")}
        <Notice />
      </Harness>
    );
    fireEvent.click(getByRole("button", { name: "Flash Fill" }));
    expect([v("B2"), v("B3")]).toEqual(["Andrew", "Janet"]);
    expect(getByText("Flash Fill: 2 cells changed")).toBeTruthy();
  });
});

describe("dialogs", () => {
  it("Goal Seek: status dialog, OK keeps the solution", () => {
    const ctx = makeContext({ A1: "2", B1: "=A1*10" });
    ctx.luckysheet_select_save = [
      { row: [0, 0], column: [1, 1], row_focus: 0, column_focus: 1 },
    ];
    const { container, getByText, queryByText } = render(
      <Harness initial={ctx}>
        <GoalSeek />
      </Harness>
    );
    expect(
      (container.querySelector("#fortune-goal-seek-set") as HTMLInputElement)
        .value
    ).toBe("$B$1");
    setField(container, "fortune-goal-seek-to", "55");
    setField(container, "fortune-goal-seek-changing", "A1");
    fireEvent.click(getByText("OK"));
    expect(
      getByText("Goal Seeking with Cell B1 found a solution.")
    ).toBeTruthy();
    expect(v("A1")).toBeCloseTo(5.5, 6);
    const status = document.querySelector(
      ".fortune-goal-seek-status"
    ) as HTMLElement;
    fireEvent.click(within(status).getByText("OK"));
    expect(queryByText("Goal Seek Status")).toBeNull();
    expect(v("A1")).toBeCloseTo(5.5, 6);
    expect(v("B1")).toBeCloseTo(55, 6);
    expect(current.goalSeekStatus).toBeUndefined();
  });

  it("Goal Seek: Cancel restores the value", () => {
    const ctx = makeContext({ A1: "2", B1: "=A1*10" });
    const { container, getByText } = render(
      <Harness initial={ctx}>
        <GoalSeek />
      </Harness>
    );
    setField(container, "fortune-goal-seek-set", "B1");
    setField(container, "fortune-goal-seek-to", "30");
    setField(container, "fortune-goal-seek-changing", "A1");
    fireEvent.click(getByText("OK"));
    expect(v("A1")).toBeCloseTo(3, 6);
    const status = document.querySelector(
      ".fortune-goal-seek-status"
    ) as HTMLElement;
    fireEvent.click(within(status).getByText("Cancel"));
    expect(v("A1")).toBe(2);
    expect(v("B1")).toBe(20);
  });

  it("Goal Seek: validation errors show inline", () => {
    const ctx = makeContext({ A1: "2" });
    const { container, getByText } = render(
      <Harness initial={ctx}>
        <GoalSeek />
      </Harness>
    );
    setField(container, "fortune-goal-seek-set", "A1");
    setField(container, "fortune-goal-seek-to", "3");
    setField(container, "fortune-goal-seek-changing", "A1");
    fireEvent.click(getByText("OK"));
    expect(container.querySelector(".fortune-dt-error")?.textContent).toBe(
      "The set cell must contain a formula."
    );
  });

  it("Data Table: creates a one-variable table", () => {
    const ctx = makeContext({
      B1: "2",
      B3: "=B1*10",
      A4: "1",
      A5: "3",
    });
    ctx.luckysheet_select_save = [
      { row: [2, 4], column: [0, 1], row_focus: 2, column_focus: 0 },
    ];
    const { container, getByText } = render(
      <Harness initial={ctx}>
        <DataTable />
      </Harness>
    );
    fireEvent.click(getByText("OK"));
    expect(container.querySelector(".fortune-dt-error")?.textContent).toBe(
      "Enter a valid row or column input cell."
    );
    setField(container, "fortune-data-table-col", "$B$1");
    fireEvent.click(getByText("OK"));
    expect([v("B4"), v("B5")]).toEqual([10, 30]);
    expect(current.luckysheetfile[0].dataTables).toHaveLength(1);
  });

  it("Advanced Filter: filters in place with the typed ranges", () => {
    const ctx = makeContext({
      A1: "Name",
      A2: "x",
      A3: "y",
      A4: "x",
      C1: "Name",
      C2: "x",
    });
    ctx.luckysheet_select_save = [
      { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
    ];
    const { container, getByText } = render(
      <Harness initial={ctx}>
        <AdvancedFilter />
      </Harness>
    );
    expect(
      (container.querySelector("#fortune-af-list") as HTMLInputElement).value
    ).toBe("$A$1:$A$4");
    expect(
      (container.querySelector("#fortune-af-copy-to") as HTMLInputElement)
        .disabled
    ).toBe(true);
    setField(container, "fortune-af-criteria", "C1:C2");
    act(() => {
      fireEvent.click(getByText("OK"));
    });
    expect(current.config.rowhidden).toEqual({ 2: 0 });
    expect(current.cellToolsNotice).toMatchObject({
      kind: "advancedFilter",
      count: 2,
      total: 3,
    });
  });
});
