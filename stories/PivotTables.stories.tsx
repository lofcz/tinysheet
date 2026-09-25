import React, { useCallback, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { PivotTable, Sheet } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "PivotTables",
  component: Workbook,
} as Meta<typeof Workbook>;

const REGIONS = ["East", "West", "North", "South"];
const PRODUCTS = ["Pen", "Book", "Cup", "Lamp"];

/** Days since 1899-12-30 of a UTC date. */
const serial = (y: number, m: number, d: number) =>
  Date.UTC(y, m - 1, d) / 86400000 + 25569;

function salesSheet(): Sheet {
  const celldata: Sheet["celldata"] = [];
  const head = ["Region", "Product", "Date", "Units", "Revenue"];
  head.forEach((v, c) =>
    celldata.push({ r: 0, c, v: { v, m: v, bl: 1, bg: "#E7E6E6" } })
  );
  for (let i = 0; i < 40; i += 1) {
    const r = i + 1;
    const region = REGIONS[(i * 7) % 4];
    const product = PRODUCTS[(i * 3 + Math.floor(i / 4)) % 4];
    const date = serial(
      2023 + (i % 2),
      1 + ((i * 5) % 12),
      1 + ((i * 11) % 28)
    );
    const units = 5 + ((i * 13) % 20);
    const revenue = units * (3 + PRODUCTS.indexOf(product) * 4);
    celldata.push({ r, c: 0, v: { v: region, m: region } });
    celldata.push({ r, c: 1, v: { v: product, m: product } });
    celldata.push({
      r,
      c: 2,
      v: { v: date, ct: { fa: "yyyy-mm-dd", t: "d" } },
    });
    celldata.push({
      r,
      c: 3,
      v: { v: units, m: String(units), ct: { fa: "General", t: "n" } },
    });
    celldata.push({
      r,
      c: 4,
      v: { v: revenue, m: String(revenue), ct: { fa: "General", t: "n" } },
    });
  }
  return {
    name: "Sales",
    id: "sales",
    order: 1,
    row: 60,
    column: 12,
    celldata,
    config: { columnlen: { 2: 90 } },
  };
}

function pivotSheet(): Sheet {
  const pivot: PivotTable = {
    id: "pivot1",
    name: "PivotTable1",
    source: { sheetId: "sales", range: { row: [0, 40], column: [0, 4] } },
    anchor: { r: 2, c: 0 },
    rows: ["Region", "Product"],
    columns: ["Date"],
    values: [{ field: "Revenue", aggregate: "sum", numberFormat: "#,##0" }],
    filters: [],
    fields: { Date: { dateGroups: ["years"] } },
    options: {
      layout: "compact",
      subtotals: "top",
      grandTotalRow: true,
      grandTotalColumn: true,
      preserveFormatting: true,
      autoRefresh: true,
    },
  };
  return {
    name: "Pivot",
    id: "pivot",
    order: 0,
    row: 60,
    column: 12,
    celldata: [
      {
        r: 0,
        c: 6,
        v: {
          f: '=GETPIVOTDATA("Revenue",$A$3,"Region","East")',
        },
      },
    ],
    calcChain: [{ r: 0, c: 6, id: "pivot" }],
    config: { columnlen: { 0: 120, 6: 90 } },
    pivotTables: [pivot],
  };
}

const Template: StoryFn<typeof Workbook> = ({
  // eslint-disable-next-line react/prop-types
  data: data0,
  ...args
}) => {
  const [data, setData] = useState<Sheet[]>(
    data0 ?? [pivotSheet(), salesSheet()]
  );
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook {...args} data={data} onChange={onChange} />
    </div>
  );
};

/** A report by region and product over years, with GETPIVOTDATA in G1. */
export const Report = Template.bind({});
Report.args = {};

export const ReportDark = Template.bind({});
ReportDark.args = { theme: "dark" };

/** Only the source: select a cell of it and use Insert › PivotTable. */
export const FromScratch = Template.bind({});
FromScratch.args = { data: [{ ...salesSheet(), order: 0, status: 1 }] };
