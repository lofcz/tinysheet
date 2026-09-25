import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet, TABLE_STYLES } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "Names and tables",
  component: Workbook,
} as Meta<typeof Workbook>;

const style = TABLE_STYLES.TableStyleMedium2;

const rows: (string | number)[][] = [
  ["Item", "Qty", "Price"],
  ["Pen", 2, 1.5],
  ["Book", 1, 12],
  ["Cup", 4, 3],
  ["Lamp", 1, 25],
];

function salesSheet(): Sheet {
  const celldata: Sheet["celldata"] = [];
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      const cell: any = { v, m: String(v) };
      if (typeof v === "number") cell.ct = { fa: "General", t: "n" };
      if (r === 0)
        Object.assign(cell, { bg: style.header, fc: "#FFFFFF", bl: 1 });
      else if (r % 2 === 1) cell.bg = style.band;
      celldata.push({ r, c, v: cell });
    })
  );
  // formula cells carry their last computed value, as saved workbooks do
  const formulas: [number, number, string, number?][] = [
    [0, 5, "Total qty"],
    [1, 5, "=SUM(Table1[Qty])", 8],
    [2, 5, "Revenue"],
    [3, 5, "=SUMPRODUCT(Table1[Qty],Table1[Price])", 52],
    [4, 5, "With tax"],
    [5, 5, "=WithTax(F4)", 62.92],
  ];
  formulas.forEach(([r, c, v, value]) => {
    celldata.push({
      r,
      c,
      v: v.startsWith("=") ? { f: v, v: value, m: String(value) } : { v, m: v },
    });
  });
  return {
    name: "Sales",
    id: "sales",
    order: 0,
    row: 40,
    column: 12,
    celldata,
    calcChain: [
      { r: 1, c: 5, id: "sales" },
      { r: 3, c: 5, id: "sales" },
      { r: 5, c: 5, id: "sales" },
    ],
    definedNames: [
      { name: "TaxRate", refersTo: "=0.21", comment: "VAT" },
      { name: "WithTax", refersTo: "=LAMBDA(x, x*(1+TaxRate))" },
      { name: "Prices", refersTo: "=Sales!$C$2:$C$5" },
    ],
    tables: [
      {
        name: "Table1",
        range: { row: [0, 4], column: [0, 2] },
        headerRow: true,
        totalRow: false,
        bandedRows: true,
        bandedColumns: false,
        firstColumn: false,
        lastColumn: false,
        style: "TableStyleMedium2",
        columns: [{ name: "Item" }, { name: "Qty" }, { name: "Price" }],
      },
    ],
  };
}

function summarySheet(): Sheet {
  return {
    name: "Summary",
    id: "summary",
    order: 1,
    row: 40,
    column: 12,
    celldata: [
      { r: 0, c: 0, v: { v: "Max price", m: "Max price" } },
      { r: 0, c: 1, v: { f: "=MAX(Prices)", v: 25, m: "25" } },
      { r: 1, c: 0, v: { v: "Tax rate", m: "Tax rate" } },
      { r: 1, c: 1, v: { f: "=TaxRate", v: 0.21, m: "0.21" } },
    ],
    calcChain: [
      { r: 0, c: 1, id: "summary" },
      { r: 1, c: 1, id: "summary" },
    ],
  };
}

const Template: StoryFn<typeof Workbook> = ({
  // eslint-disable-next-line react/prop-types
  data: data0,
  ...args
}) => {
  const [data, setData] = useState<Sheet[]>(data0);
  const onChange = useCallback((d: Sheet[]) => {
    setData(d);
  }, []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook {...args} data={data} onChange={onChange} />
    </div>
  );
};

/**
 * Defined names (a constant, a LAMBDA and a range) and a table with
 * structured references. Try the Name Box, the Name Manager and Format as
 * Table in the toolbar.
 */
export const Basic = Template.bind({});
// @ts-ignore
Basic.args = { data: [salesSheet(), summarySheet()] };

export const Dark = Template.bind({});
// @ts-ignore
Dark.args = { data: [salesSheet(), summarySheet()], theme: "dark" };
