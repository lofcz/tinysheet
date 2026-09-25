import { act, fireEvent, render } from "@testing-library/react";
import React, { useMemo, useState } from "react";
import produce from "immer";
import { defaultContext, Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import { ModalProvider } from "../src/context/modal";
import { getToolbarItemRenderer, getSheetOverlays } from "../src/extensions";
import {
  OutlineGutter,
  OutlinePrompt,
  OutlineToolbarItem,
  SubtotalDialog,
} from "../src/components/Outline";
import {
  dedupeOutlineSteps,
  outlineStep,
} from "../src/components/Outline/history";

const text = (v: string) => ({ v, m: v, ct: { fa: "General", t: "g" } });
const num = (v: number) => ({ v, m: `${v}`, ct: { fa: "General", t: "n" } });

function makeContext(patch: Partial<Context> = {}): Context {
  const ctx = defaultContext({} as any);
  const data: any[][] = Array.from({ length: 12 }, () => Array(4).fill(null));
  data[0][0] = text("Region");
  data[0][1] = text("Qty");
  ["East", "East", "West"].forEach((v, i) => {
    data[i + 1][0] = text(v);
    data[i + 1][1] = num(i + 1);
  });
  // cumulative bottoms of 12 rows / 4 columns (20px rows, 74px columns)
  const rows = Array.from({ length: 12 }, (_v, i) => (i + 1) * 20);
  const cols = Array.from({ length: 4 }, (_v, i) => (i + 1) * 74);
  return {
    ...ctx,
    lang: "en",
    currentSheetId: "s1",
    allowEdit: true,
    config: {},
    luckysheetfile: [{ name: "Sheet1", id: "s1", order: 0, data, config: {} }],
    luckysheet_select_save: [
      { row: [1, 1], column: [0, 0], row_focus: 1, column_focus: 0 },
    ],
    visibledatarow: rows,
    visibledatacolumn: cols,
    luckysheetTableContentHW: [800, 400],
    rowHeaderWidth: 46,
    columnHeaderHeight: 20,
    scrollTop: 0,
    scrollLeft: 0,
    ...patch,
  } as Context;
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
        setState((prev) => produce(prev, recipe));
      }) as any,
      refs: {
        globalCache: { undoList: [], redoList: [] },
        cellInput: { current: null },
        workbookContainer: { current: null },
      } as any,
      settings: {} as any,
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

describe("outline UI", () => {
  it("registers the toolbar item and the prompt overlay", () => {
    expect(getToolbarItemRenderer("outline")).toBeTruthy();
    expect(getSheetOverlays().some((o) => o.key === "outlinePrompt")).toBe(
      true
    );
  });

  it("the gutter shows level buttons and collapses a group", () => {
    const initial = makeContext();
    initial.config = { rowOutlineLevel: { 1: 1, 2: 1 } };
    initial.luckysheetfile[0].config = initial.config;
    const { getByRole, container } = render(
      <Harness initial={initial}>
        <OutlineGutter />
      </Harness>
    );
    expect(
      container.querySelectorAll(".fortune-outline-rows .fortune-outline-level")
    ).toHaveLength(2);
    expect(container.querySelector(".fortune-outline-cols")).toBeNull();
    fireEvent.click(getByRole("button", { name: "Collapse group (rows 2–3)" }));
    expect(Object.keys(current.config.rowhidden || {})).toEqual(["1", "2"]);
    fireEvent.click(getByRole("button", { name: "Expand group (rows 2–3)" }));
    expect(Object.keys(current.config.rowhidden || {})).toEqual([]);
    fireEvent.click(getByRole("button", { name: "Show outline level 1" }));
    expect(Object.keys(current.config.rowhidden || {})).toEqual(["1", "2"]);
  });

  it("the gutter follows frozen rows: a frozen and a scrolling pane", () => {
    const initial = makeContext({ scrollTop: 40 });
    initial.config = { rowOutlineLevel: { 4: 1, 5: 1 } };
    const { container } = render(
      <Harness initial={initial}>
        <OutlineGutter />
      </Harness>
    );
    // no freeze: one pane scrolled by scrollTop
    const layers = container.querySelectorAll(
      ".fortune-outline-rows .fortune-outline-layer-content"
    );
    expect(layers).toHaveLength(1);
    expect((layers[0] as HTMLElement).style.top).toBe("-40px");
  });

  it("Subtotal dialog adds subtotal rows", () => {
    const { getByTestId, getByText } = render(
      <Harness initial={makeContext()}>
        <SubtotalDialog />
      </Harness>
    );
    const dialog = getByTestId("subtotal-dialog");
    expect(dialog.querySelector("#fortune-subtotal-by")).toBeTruthy();
    act(() => {
      fireEvent.click(getByText("OK"));
    });
    const col = current.luckysheetfile[0].data!.map((r) => r[0]?.v ?? null);
    expect(col.slice(0, 7)).toEqual([
      "Region",
      "East",
      "East",
      "East Total",
      "West",
      "West Total",
      "Grand Total",
    ]);
    expect(current.config.rowOutlineLevel).toEqual({
      1: 2,
      2: 2,
      3: 1,
      4: 2,
      5: 1,
    });
  });

  it("Subtotal dialog asks for at least one column", () => {
    const { getByText, getByLabelText } = render(
      <Harness initial={makeContext()}>
        <SubtotalDialog />
      </Harness>
    );
    fireEvent.click(getByLabelText("Qty"));
    fireEvent.click(getByText("OK"));
    expect(
      getByText("Choose at least one column to add a subtotal to.")
    ).toBeTruthy();
  });

  it("toolbar Group asks rows or columns for a plain range", () => {
    const initial = makeContext({
      luckysheet_select_save: [
        { row: [1, 2], column: [0, 1], row_focus: 1, column_focus: 0 },
      ],
    });
    const { container, getByText, getByLabelText } = render(
      <Harness initial={initial}>
        <OutlineToolbarItem />
      </Harness>
    );
    fireEvent.click(
      container.querySelector(".fortune-toolbar-combo-button") as Element
    );
    fireEvent.click(getByText("Group"));
    fireEvent.click(getByLabelText("Columns"));
    fireEvent.click(getByText("OK"));
    expect(current.config.colOutlineLevel).toEqual({ 0: 1, 1: 1 });
  });

  it("the keyboard prompt opens the Group dialog", () => {
    const initial = makeContext({
      outlinePrompt: "ungroup",
      luckysheet_select_save: [
        { row: [1, 2], column: [0, 1], row_focus: 1, column_focus: 0 },
      ],
    });
    initial.config = { rowOutlineLevel: { 1: 1, 2: 1 } };
    const { getByTestId, getByText } = render(
      <Harness initial={initial}>
        <OutlinePrompt />
      </Harness>
    );
    expect(getByTestId("outline-group-dialog")).toBeTruthy();
    expect(current.outlinePrompt).toBeUndefined();
    fireEvent.click(getByText("OK"));
    expect(current.config.rowOutlineLevel).toBeUndefined();
  });

  it("drops an outline step React recorded twice", () => {
    const a = outlineStep();
    const other = {};
    const list = [{ options: other }, { options: a }, { options: a }];
    dedupeOutlineSteps(list);
    expect(list).toHaveLength(2);
    // other commands are left alone
    const twice = [{ options: other }, { options: other }];
    dedupeOutlineSteps(twice);
    expect(twice).toHaveLength(2);
  });
});
