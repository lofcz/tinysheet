import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { defaultContext, Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import PasteSpecial from "../src/components/PasteSpecial";

function makeCtx(): Context {
  const ctx = { ...defaultContext({} as any), lang: "en" } as Context;
  const data: any[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => null)
  );
  data[0][0] = { v: 2, m: "2", ct: { fa: "General", t: "n" }, bl: 1 };
  data[0][2] = { v: 10, m: "10", ct: { fa: "General", t: "n" } };
  ctx.luckysheetfile = [{ name: "Sheet1", id: "s1", order: 0, data } as any];
  ctx.currentSheetId = "s1";
  ctx.config = {};
  ctx.allowEdit = true;
  ctx.showPasteSpecial = true;
  ctx.luckysheet_copy_save = {
    dataSheetId: "s1",
    copyRange: [{ row: [0, 0], column: [0, 0] }],
    RowlChange: false,
    HasMC: false,
  };
  ctx.luckysheet_select_save = [
    { row: [0, 0], column: [2, 2], row_focus: 0, column_focus: 2 },
  ];
  return ctx;
}

function renderDialog(ctx: Context) {
  const setContext = jest.fn((fn: (c: Context) => void) => fn(ctx));
  const utils = render(
    <WorkbookContext.Provider
      value={{
        context: ctx,
        setContext: setContext as any,
        refs: {} as any,
        settings: {} as any,
      }}
    >
      <PasteSpecial />
    </WorkbookContext.Provider>
  );
  return { ...utils, setContext };
}

describe("PasteSpecial dialog", () => {
  it("lists Excel's paste options and operations", () => {
    const { getByLabelText, getByText } = renderDialog(makeCtx());
    [
      "All",
      "Formulas",
      "Values",
      "Formats",
      "Comments",
      "Validation",
      "All except borders",
      "Column widths",
      "Formulas and number formats",
      "Values and number formats",
      "Add",
      "Subtract",
      "Multiply",
      "Divide",
      "Skip blanks",
      "Transpose",
    ].forEach((label) => expect(getByLabelText(label)).toBeTruthy());
    expect(getByText("Paste Link")).toBeTruthy();
  });

  it("pastes values with an operation on OK", () => {
    const ctx = makeCtx();
    const { getByLabelText, getByText } = renderDialog(ctx);
    fireEvent.click(getByLabelText("Values"));
    fireEvent.click(getByLabelText("Multiply"));
    fireEvent.click(getByText("OK"));
    expect(ctx.showPasteSpecial).toBe(false);
    expect(ctx.luckysheetfile[0].data![0][2]!.v).toBe(20);
    expect(ctx.luckysheetfile[0].data![0][2]!.bl).toBeUndefined();
  });

  it("operations are disabled for formats-only pastes", () => {
    const { getByLabelText } = renderDialog(makeCtx());
    fireEvent.click(getByLabelText("Formats"));
    const fieldset = (getByLabelText("Add") as HTMLInputElement).closest(
      "fieldset"
    );
    expect(fieldset?.disabled).toBe(true);
  });

  it("Paste Link writes a link formula", () => {
    const ctx = makeCtx();
    const { getByText } = renderDialog(ctx);
    fireEvent.click(getByText("Paste Link"));
    expect(ctx.luckysheetfile[0].data![0][2]!.f).toBe("=$A$1");
  });

  it("Escape closes without pasting", () => {
    const ctx = makeCtx();
    const { getByRole } = renderDialog(ctx);
    fireEvent.keyDown(getByRole("dialog"), { key: "Escape" });
    expect(ctx.showPasteSpecial).toBe(false);
    expect(ctx.luckysheetfile[0].data![0][2]!.v).toBe(10);
  });
});
