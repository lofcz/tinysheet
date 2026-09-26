import { act, fireEvent, render } from "@testing-library/react";
import React, { useMemo, useState } from "react";
import produce from "immer";
import {
  defaultContext,
  Context,
  getDataVerificationRules,
  setDataVerification,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../src/context";
import DataVerification from "../src/components/DataVerification";
import DataVerificationAlert from "../src/components/DataVerification/Alert";
import DataVerificationSidebar from "../src/components/DataVerification/Sidebar";
import CustomSort from "../src/components/CustomSort";
import RemoveDuplicates from "../src/components/RemoveDuplicates";
import { SplitColumn } from "../src/components/SplitColumn";

const text = (v: string) => ({ v, m: v, ct: { fa: "General", t: "g" } });
const num = (v: number) => ({ v, m: `${v}`, ct: { fa: "General", t: "n" } });

function makeContext(patch: Partial<Context> = {}): Context {
  const ctx = defaultContext({} as any);
  const data: any[][] = Array.from({ length: 8 }, () => Array(5).fill(null));
  data[0][0] = text("Name");
  data[0][1] = text("Qty");
  data[1][0] = text("b");
  data[1][1] = num(2);
  data[2][0] = text("a");
  data[2][1] = num(1);
  data[3][0] = text("b");
  data[3][1] = num(2);
  data[5][0] = text("x;1;y");
  data[6][0] = text("z;2");
  return {
    ...ctx,
    lang: "en",
    currentSheetId: "s1",
    allowEdit: true,
    luckysheetfile: [{ name: "Sheet1", id: "s1", order: 0, data }],
    luckysheet_select_save: [
      { row: [0, 3], column: [0, 1], row_focus: 0, column_focus: 0 },
    ],
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
      refs: { workbookContainer: { current: null } } as any,
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

describe("Data Validation dialog", () => {
  it("has Excel's three tabs and reports errors inline", () => {
    const { getByText, container } = render(
      <Harness initial={makeContext()}>
        <DataVerification />
      </Harness>
    );
    expect(getByText("Settings")).toBeTruthy();
    expect(current.dataVerification?.dataRegulation?.rangeTxt).toBe("A1:B4");
    const allow = container.querySelector(
      "#fortune-dv-allow"
    ) as HTMLSelectElement;
    fireEvent.change(allow, { target: { value: "dropdown" } });
    fireEvent.click(getByText("OK"));
    expect(container.querySelector(".fortune-dt-error")?.textContent).toMatch(
      /cannot be empty/
    );
    fireEvent.click(getByText("Input Message"));
    expect(getByText("Show input message when cell is selected")).toBeTruthy();
    fireEvent.click(getByText("Error Alert"));
    const style = container.querySelector(
      "#fortune-dv-style"
    ) as HTMLSelectElement;
    expect(style.value).toBe("stop");
  });

  it("applies a rule on OK", () => {
    const { getByText, container } = render(
      <Harness initial={makeContext()}>
        <DataVerification />
      </Harness>
    );
    fireEvent.change(container.querySelector("#fortune-dv-allow")!, {
      target: { value: "number_integer" },
    });
    const inputs = container.querySelectorAll(
      ".fortune-dt-input-group .fortune-dt-input"
    );
    // range, minimum, maximum
    fireEvent.change(inputs[1], { target: { value: "1" } });
    fireEvent.change(inputs[2], { target: { value: "5" } });
    fireEvent.click(getByText("OK"));
    const rules = getDataVerificationRules(current);
    expect(rules).toHaveLength(1);
    expect(rules[0].item).toMatchObject({
      type: "number_integer",
      type2: "between",
      value1: "1",
      value2: "5",
    });
  });
});

describe("error alert", () => {
  const alert = (style: "stop" | "warning" | "information") =>
    makeContext({
      dataVerificationAlert: {
        sheetId: "s1",
        r: 1,
        c: 1,
        value: "9",
        style,
        title: "Oops",
        message: "Bad value",
      },
    });

  it("Stop offers Retry / Cancel", () => {
    const { getByText, queryByText } = render(
      <Harness initial={alert("stop")}>
        <DataVerificationAlert />
      </Harness>
    );
    expect(getByText("Oops")).toBeTruthy();
    expect(getByText("Retry")).toBeTruthy();
    expect(queryByText("Yes")).toBeNull();
    fireEvent.click(getByText("Cancel"));
    expect(current.dataVerificationAlert).toBeUndefined();
  });

  it("Warning asks to continue", () => {
    const { getByText } = render(
      <Harness initial={alert("warning")}>
        <DataVerificationAlert />
      </Harness>
    );
    expect(getByText("Continue?")).toBeTruthy();
    expect(getByText("Yes")).toBeTruthy();
    expect(getByText("No")).toBeTruthy();
  });
});

describe("rules sidebar", () => {
  it("lists rules and deletes one", () => {
    const ctx = produce(makeContext(), (draft) => {
      setDataVerification(draft, "A2:A4", { type: "dropdown", value1: "a,b" });
      setDataVerification(draft, "B2", {
        type: "custom",
        value1: "=B2>0",
        placeholder: "Qty",
      });
    });
    const { getByText, getAllByLabelText } = render(
      <Harness initial={ctx}>
        <DataVerificationSidebar />
      </Harness>
    );
    expect(getByText("A2:A4")).toBeTruthy();
    expect(getByText("List: a,b")).toBeTruthy();
    expect(getByText("Custom: =B2>0")).toBeTruthy();
    expect(getByText("2 rules")).toBeTruthy();
    act(() => {
      fireEvent.click(getAllByLabelText("Delete")[0]);
    });
    expect(getDataVerificationRules(current)).toHaveLength(1);
  });
});

describe("sort dialog", () => {
  it("detects the header, adds and removes levels, sorts", () => {
    const { getByText, container } = render(
      <Harness initial={makeContext()}>
        <CustomSort />
      </Harness>
    );
    const headers = container.querySelector(
      ".fortune-sort-dialog input[type=checkbox]"
    ) as HTMLInputElement;
    expect(headers.checked).toBe(true);
    // column names come from the header row
    expect(container.textContent).toContain("Name");
    fireEvent.click(getByText("Add Level"));
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    fireEvent.click(getByText("Delete Level"));
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.click(getByText("OK"));
    const { data } = current.luckysheetfile[0];
    expect(data!.slice(1, 4).map((r) => r[0]?.v)).toEqual(["a", "b", "b"]);
  });
});

describe("remove duplicates dialog", () => {
  it("offers the columns and removes duplicate rows", () => {
    const { getByText } = render(
      <Harness initial={makeContext()}>
        <RemoveDuplicates />
      </Harness>
    );
    expect(getByText("Qty")).toBeTruthy();
    fireEvent.click(getByText("OK"));
    const { data } = current.luckysheetfile[0];
    expect(data!.slice(1, 4).map((r) => r[0]?.v)).toEqual([
      "b",
      "a",
      undefined,
    ]);
  });
});

describe("text to columns dialog", () => {
  it("previews delimited text and applies it", () => {
    const ctx = makeContext({
      luckysheet_select_save: [
        { row: [5, 6], column: [0, 0], row_focus: 5, column_focus: 0 },
      ],
    });
    const { getByText, container } = render(
      <Harness initial={ctx}>
        <SplitColumn />
      </Harness>
    );
    fireEvent.click(getByText("Next"));
    fireEvent.click(getByText("Semicolon"));
    const cells = Array.from(
      container.querySelectorAll(".fortune-ttc-preview tbody td")
    ).map((td) => td.textContent);
    expect(cells).toEqual(["x", "1", "y", "z", "2", ""]);
    fireEvent.click(getByText("Finish"));
    const { data } = current.luckysheetfile[0];
    expect(data![5].slice(0, 3).map((c) => c?.v)).toEqual(["x", 1, "y"]);
  });
});
