import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useMemo, useState } from "react";
import { produce } from "immer";
import {
  Context,
  defaultContext,
  defaultSettings,
  getFlowdata,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import FormatCells from "../src/components/FormatCells";
import CellStyles from "../src/components/CellStyles";

const refs: any = {
  globalCache: { undoList: [], redoList: [] },
  cellInput: React.createRef(),
  fxInput: React.createRef(),
  canvas: React.createRef(),
  cellArea: React.createRef(),
  workbookContainer: React.createRef(),
};

function makeContext(): Context {
  const ctx = defaultContext(refs);
  ctx.currentSheetId = "s1";
  ctx.config = {};
  ctx.currency = "$";
  ctx.luckysheetfile = [
    {
      id: "s1",
      name: "Sheet1",
      config: {},
      data: [
        [
          { v: 1234.5, m: "1234.5", ct: { fa: "General", t: "n" } },
          { v: 2, m: "2", ct: { fa: "General", t: "n" } },
        ],
        [null, null],
      ],
    } as any,
  ];
  ctx.luckysheet_select_save = [
    { row: [0, 0], column: [0, 1], row_focus: 0, column_focus: 0 },
  ];
  ctx.formatCellsDialog = { tab: "number" };
  return ctx;
}

let latest: Context;

const Harness: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ctx, setCtx] = useState(makeContext);
  latest = ctx;
  const value = useMemo(
    () => ({
      context: ctx,
      setContext: (recipe: (c: Context) => void) =>
        setCtx((c) => produce(c, recipe)),
      settings: defaultSettings,
      refs,
      handleUndo: () => {},
      handleRedo: () => {},
    }),
    [ctx]
  );
  return (
    <WorkbookContext.Provider value={value}>
      {ctx.formatCellsDialog ? children : null}
    </WorkbookContext.Provider>
  );
};

describe("Format Cells dialog", () => {
  it("shows the active cell's format and a live sample", () => {
    render(
      <Harness>
        <FormatCells />
      </Harness>
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen
        .getByRole("option", { name: "General" })
        .getAttribute("aria-selected")
    ).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "Currency" }));
    expect(screen.getByTestId("format-cells-sample").textContent).toBe(
      "$1,234.50"
    );
  });

  it("OK applies the number format to the whole selection and closes", () => {
    render(
      <Harness>
        <FormatCells />
      </Harness>
    );
    fireEvent.click(screen.getByRole("option", { name: "Percentage" }));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
    });
    const d = getFlowdata(latest)!;
    expect(d[0][0]?.m).toBe("123450.00%");
    expect(d[0][1]?.m).toBe("200.00%");
    expect(latest.formatCellsDialog).toBeUndefined();
  });

  it("only changed fields are applied", () => {
    render(
      <Harness>
        <FormatCells />
      </Harness>
    );
    fireEvent.click(screen.getByRole("tab", { name: "Font" }));
    fireEvent.change(screen.getByLabelText("Font style:"), {
      target: { value: "b" },
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
    });
    const d = getFlowdata(latest)!;
    expect(d[0][0]?.bl).toBe(1);
    expect(d[0][1]?.bl).toBe(1);
    expect(d[0][0]?.ct?.fa).toBe("General");
    expect(d[0][0]?.it).toBeUndefined();
  });

  it("an invalid custom code keeps the dialog open", () => {
    render(
      <Harness>
        <FormatCells />
      </Harness>
    );
    fireEvent.click(screen.getByRole("option", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Type:"), {
      target: { value: '0.0 "kg' },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("alert").textContent).toMatch(/not valid/);
    expect(latest.formatCellsDialog).toBeDefined();
  });

  it("Escape closes without changes", () => {
    render(
      <Harness>
        <FormatCells />
      </Harness>
    );
    act(() => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    });
    expect(latest.formatCellsDialog).toBeUndefined();
    expect(getFlowdata(latest)![0][0]?.ct?.fa).toBe("General");
  });
});

describe("Cell Styles gallery", () => {
  it("applies a style to the selection", () => {
    render(
      <Harness>
        <CellStyles />
      </Harness>
    );
    act(() => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Bad" }));
    });
    const d = getFlowdata(latest)!;
    expect(d[0][0]).toMatchObject({ bg: "#FFC7CE", fc: "#9C0006" });
    expect(d[0][1]).toMatchObject({ bg: "#FFC7CE", fc: "#9C0006" });
  });
});
