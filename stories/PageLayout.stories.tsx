import React, { useCallback, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import {
  Sheet,
  makeDataBar,
  parseSqref,
  CFRule,
  Chart,
} from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "Page layout",
  component: Workbook,
} as Meta<typeof Workbook>;

const regions = ["North", "South", "East", "West"];
const products = ["Pens", "Books", "Cups", "Lamps", "Chairs"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

/** A sales report: a merged title, a header row, 120 data rows. */
function reportSheet(): Sheet {
  const celldata: Sheet["celldata"] = [];
  const put = (r: number, c: number, v: any) => celldata.push({ r, c, v });
  put(0, 0, {
    v: "Quarterly sales report",
    m: "Quarterly sales report",
    bl: 1,
    fs: 16,
    mc: { r: 0, c: 0, rs: 1, cs: 7 },
  });
  for (let c = 1; c < 7; c += 1) put(0, c, { mc: { r: 0, c: 0 } });
  const headers = [
    "Region",
    "Product",
    "Month",
    "Units",
    "Price",
    "Revenue",
    "Note",
  ];
  headers.forEach((h, c) =>
    put(1, c, { v: h, m: h, bl: 1, bg: "#1f4e79", fc: "#ffffff" })
  );
  for (let i = 0; i < 120; i += 1) {
    const r = i + 2;
    const units = ((i * 37) % 90) + 10;
    const price = 2 + ((i * 13) % 40) / 2;
    const revenue = units * price;
    put(r, 0, { v: regions[i % 4], m: regions[i % 4] });
    put(r, 1, { v: products[i % 5], m: products[i % 5] });
    put(r, 2, { v: months[i % 6], m: months[i % 6] });
    put(r, 3, { v: units, m: String(units), ct: { fa: "General", t: "n" } });
    put(r, 4, {
      v: price,
      m: `$${price.toFixed(2)}`,
      ct: { fa: "$#,##0.00", t: "n" },
    });
    put(r, 5, {
      v: revenue,
      m: `$${revenue.toFixed(2)}`,
      f: `=D${r + 1}*E${r + 1}`,
      ct: { fa: "$#,##0.00", t: "n" },
      bg: i % 2 ? "#f2f7fc" : undefined,
    });
    if (i % 17 === 0) put(r, 6, { v: "#DIV/0!", m: "#DIV/0!" });
  }
  const rules: CFRule[] = [
    {
      type: "dataBar",
      cellrange: parseSqref("D3:D122")!,
      dataBar: makeDataBar("#638EC6", true),
    },
  ];
  const chart: Chart = {
    id: "report-chart",
    type: "column",
    grouping: "clustered",
    title: "Units",
    series: [
      {
        name: "Units",
        values: { sheetId: "report", row: [2, 9], column: [3, 3] },
        categories: { sheetId: "report", row: [2, 9], column: [1, 1] },
      },
    ],
    left: 560,
    top: 60,
    width: 360,
    height: 220,
  };
  return {
    name: "Report",
    id: "report",
    order: 0,
    status: 1,
    row: 160,
    column: 14,
    celldata,
    config: {
      merge: { "0_0": { r: 0, c: 0, rs: 1, cs: 7 } },
      columnlen: { 0: 90, 6: 110 },
      rowlen: { 0: 32 },
      borderInfo: [
        {
          rangeType: "range",
          borderType: "border-all",
          style: "1",
          color: "#7f7f7f",
          range: [{ row: [1, 121], column: [0, 5] }],
        },
      ],
    },
    luckysheet_conditionformat_save: rules as any,
    charts: [chart],
    pageSetup: {
      printTitleRows: [1, 1],
      header: { left: "&B&A", right: "&D" },
      footer: { center: "Page &P of &N" },
      cellErrors: "dash",
    },
  };
}

function notesSheet(): Sheet {
  return {
    name: "Notes",
    id: "notes",
    order: 1,
    row: 40,
    column: 10,
    celldata: [
      { r: 0, c: 0, v: { v: "Second sheet", m: "Second sheet", bl: 1 } },
      { r: 2, c: 1, v: { v: 42, m: "42", ct: { fa: "General", t: "n" } } },
    ],
    pageSetup: { orientation: "landscape", header: { center: "&A" } },
  };
}

const Template: StoryFn<typeof Workbook> = ({
  // eslint-disable-next-line react/prop-types
  data: data0,
  ...args
}) => {
  const [data, setData] = useState<Sheet[]>(data0);
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook {...args} data={data} onChange={onChange} />
    </div>
  );
};

export const Report = Template.bind({});
Report.args = { data: [reportSheet(), notesSheet()] };

export const ReportDark = Template.bind({});
ReportDark.args = { data: [reportSheet(), notesSheet()], theme: "dark" };
