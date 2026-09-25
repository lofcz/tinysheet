import React, { useCallback, useEffect, useRef, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";

/**
 * Cell controls and data tools: checkboxes, Flash Fill, Goal Seek, Data
 * Tables and Advanced Filter, on sample data laid out like Microsoft's
 * documentation examples.
 */
export default {
  title: "Cell controls and data tools",
  component: Workbook,
} as Meta<typeof Workbook>;

const text = (v: string, extra: Record<string, any> = {}) => ({
  v,
  m: v,
  ct: { fa: "General", t: "g" },
  ...extra,
});
const num = (v: number, fa = "General") => ({
  v,
  m: `${v}`,
  ct: { fa, t: "n" },
});
const bool = (v: boolean, extra: Record<string, any> = {}) => ({
  v,
  m: v ? "TRUE" : "FALSE",
  ct: { fa: "General", t: "b" },
  ...extra,
});

function makeSheet(): Sheet {
  const celldata: any[] = [];
  const put = (r: number, c: number, v: any) => celldata.push({ r, c, v });
  // A-B: a task list with checkboxes (B) and a count of done tasks
  put(0, 0, text("Task", { bl: 1 }));
  put(0, 1, text("Done", { bl: 1 }));
  ["Order parts", "Call supplier", "Ship", "Invoice"].forEach((t, i) => {
    put(i + 1, 0, text(t));
    put(i + 1, 1, bool(i % 2 === 0, { cb: 1 }));
  });
  put(5, 0, text("Done"));
  put(5, 1, {
    f: "=COUNTIF(B2:B5,TRUE)",
    v: 2,
    m: "2",
    ct: { fa: "General", t: "n" },
  });
  put(6, 0, text("All done"));
  put(6, 1, {
    f: "=B6=4",
    v: false,
    m: "FALSE",
    ct: { fa: "General", t: "b" },
    cb: 1,
  });
  // D-F: Flash Fill (names and e-mails, first names to fill)
  put(0, 3, text("Full name", { bl: 1 }));
  put(0, 4, text("E-mail", { bl: 1 }));
  put(0, 5, text("First name", { bl: 1 }));
  [
    ["Nancy Davolio", "nancy.davolio@contoso.com"],
    ["Andrew Fuller", "andrew.fuller@contoso.com"],
    ["Janet Leverling", "janet.leverling@contoso.com"],
    ["Margaret Peacock", "margaret.peacock@contoso.com"],
    ["Steven Buchanan", "steven.buchanan@contoso.com"],
  ].forEach(([n, e], i) => {
    put(i + 1, 3, text(n));
    put(i + 1, 4, text(e));
  });
  put(1, 5, text("Nancy"));
  // H-I: loan model for Goal Seek and a data table
  put(0, 7, text("Loan amount", { bl: 1 }));
  put(0, 8, num(100000));
  put(1, 7, text("Term (months)"));
  put(1, 8, num(180));
  put(2, 7, text("Interest rate"));
  put(2, 8, num(0.05, "0.00%"));
  put(3, 7, text("Payment"));
  put(3, 8, {
    f: "=PMT(I3/12,I2,I1)",
    v: -790.79,
    m: "-790.79",
    ct: { fa: "0.00", t: "n" },
  });
  put(5, 7, text("Rate", { bl: 1 }));
  put(5, 8, { f: "=I4", v: -790.79, m: "-790.79", ct: { fa: "0.00", t: "n" } });
  [0.04, 0.045, 0.05, 0.055, 0.06].forEach((rate, i) =>
    put(6 + i, 7, num(rate, "0.00%"))
  );
  // A13:C18 Advanced Filter list, criteria in E13:E14
  put(12, 0, text("Type", { bl: 1 }));
  put(12, 1, text("Salesperson", { bl: 1 }));
  put(12, 2, text("Sales", { bl: 1 }));
  [
    ["Beverages", "Suyama", 5122],
    ["Meat", "Davolio", 450],
    ["Produce", "Buchanan", 6328],
    ["Produce", "Davolio", 6544],
    ["Beverages", "Davolio", 3000],
  ].forEach(([t, s, v], i) => {
    put(13 + i, 0, text(t as string));
    put(13 + i, 1, text(s as string));
    put(13 + i, 2, num(v as number));
  });
  put(12, 4, text("Salesperson", { bl: 1 }));
  put(13, 4, text("Davolio"));
  return {
    name: "Tools",
    id: "tools",
    order: 0,
    status: 1,
    row: 60,
    column: 20,
    celldata,
    config: { columnlen: { 0: 110, 3: 130, 4: 200, 5: 90, 7: 110 } },
    calcChain: celldata
      .filter((x) => x.v?.f)
      .map(({ r, c }) => ({ r, c, id: "tools" })),
  };
}

const Template: StoryFn<typeof Workbook> = ({ ...args }) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data, setData] = useState<Sheet[]>(() => [makeSheet()]);
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  useEffect(() => {
    Object.defineProperty(window, "__tinysheet", {
      configurable: true,
      get: () => ref.current,
    });
    return () => {
      delete (window as any).__tinysheet;
    };
  }, []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook ref={ref} {...args} data={data} onChange={onChange} />
    </div>
  );
};

export const Light = Template.bind({});
Light.args = {};

export const Dark = Template.bind({});
Dark.args = { theme: "dark" };
