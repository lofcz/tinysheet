import { fireEvent, render } from "@testing-library/react";
import React, { useMemo, useState } from "react";
import produce from "immer";
import { defaultContext, Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import DataVerificationAlert from "../src/components/DataVerification/Alert";

describe("data validation Stop alert", () => {
  it("Retry reopens the editor with the rejected text", () => {
    const ctx = {
      ...defaultContext({} as any),
      lang: "en",
      currentSheetId: "s1",
      allowEdit: true,
      luckysheetfile: [
        {
          name: "Sheet1",
          id: "s1",
          order: 0,
          data: Array.from({ length: 4 }, () => Array(4).fill(null)),
        },
      ],
      luckysheet_select_save: [
        { row: [2, 2], column: [1, 1], row_focus: 2, column_focus: 1 },
      ],
      dataVerificationAlert: {
        sheetId: "s1",
        r: 1,
        c: 1,
        value: "50",
        style: "stop",
        title: "Oops",
        message: "1 to 10 please",
      },
    } as Context;
    const cellInput = document.createElement("div");
    const fxInput = document.createElement("div");
    const globalCache: any = {};
    let current = ctx;
    const Harness: React.FC = () => {
      const [context, setState] = useState(ctx);
      current = context;
      const value = useMemo(
        () => ({
          context,
          setContext: ((recipe: (c: Context) => void) => {
            setState((prev) => produce(prev, recipe));
          }) as any,
          refs: {
            cellInput: { current: cellInput },
            fxInput: { current: fxInput },
            globalCache,
          } as any,
          settings: {} as any,
        }),
        [context]
      );
      return (
        <WorkbookContext.Provider value={value}>
          <DataVerificationAlert />
        </WorkbookContext.Provider>
      );
    };
    const { getByText } = render(<Harness />);
    fireEvent.click(getByText("Retry"));
    expect(current.dataVerificationAlert).toBeUndefined();
    expect(current.luckysheetCellUpdate).toEqual([1, 1]);
    expect(current.editState?.mode).toBe("edit");
    expect(cellInput.innerText).toBe("50");
    expect(fxInput.innerText).toBe("50");
    // the editor keeps the text instead of loading the cell
    expect(globalCache.ignoreWriteCell).toBe(true);
  });
});
