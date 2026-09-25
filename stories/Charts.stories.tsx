import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Chart, Sheet } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "Charts",
  component: Workbook,
  argTypes: {
    theme: {
      control: { type: "inline-radio" },
      options: ["light", "dark", "auto"],
    },
  },
} as Meta<typeof Workbook>;

const SHEET_ID = "charts";

const table: (string | number | null)[][] = [
  ["Month", "Revenue", "Cost", "Profit"],
  ["Jan", 120, 80, 40],
  ["Feb", 135, 90, 45],
  ["Mar", 150, 95, 55],
  ["Apr", 110, 85, 25],
  ["May", 170, 100, 70],
  ["Jun", 190, 110, 80],
];

function celldata() {
  const out: Sheet["celldata"] = [];
  table.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v == null) return;
      out!.push({
        r,
        c,
        v:
          typeof v === "number"
            ? { v, m: String(v), ct: { fa: "General", t: "n" } }
            : { v, m: v, ct: { fa: "General", t: "g" } },
      });
    })
  );
  return out;
}

const range = (r1: number, r2: number, c1: number, c2: number) => ({
  sheetId: SHEET_ID,
  row: [r1, r2] as [number, number],
  column: [c1, c2] as [number, number],
});

const seriesFor = (cols: number[]) =>
  cols.map((c) => ({
    nameRef: range(0, 0, c, c),
    values: range(1, 6, c, c),
    categories: range(1, 6, 0, 0),
  }));

const W = 360;
const H = 230;
const col = (i: number) => 330 + (i % 3) * (W + 16);
const row = (i: number) => 10 + Math.floor(i / 3) * (H + 16);

const base = (i: number, chart: Partial<Chart>): Chart => ({
  id: `story-chart-${i}`,
  type: "column",
  source: range(0, 6, 0, 3),
  series: seriesFor([1, 2, 3]),
  legend: "bottom",
  left: col(i),
  top: row(i),
  width: W,
  height: H,
  ...chart,
});

const charts: Chart[] = [
  base(0, { title: "Clustered column", grouping: "clustered" }),
  base(1, {
    title: "Stacked bar",
    type: "bar",
    grouping: "stacked",
    series: seriesFor([2, 3]),
  }),
  base(2, {
    title: "Line with markers",
    type: "line",
    grouping: "clustered",
    markers: true,
    dataLabels: true,
    series: seriesFor([1, 2]),
  }),
  base(3, {
    title: "100% stacked area",
    type: "area",
    grouping: "percentStacked",
    series: seriesFor([2, 3]),
  }),
  base(4, {
    title: "Revenue share",
    type: "pie",
    series: seriesFor([1]),
    legend: "right",
    dataLabels: true,
  }),
  base(5, {
    title: "Doughnut",
    type: "doughnut",
    series: seriesFor([2, 3]),
    legend: "right",
  }),
  base(6, {
    title: "Cost vs revenue",
    type: "scatter",
    markers: true,
    series: [
      {
        nameRef: range(0, 0, 2, 2),
        values: range(1, 6, 2, 2),
        categories: range(1, 6, 1, 1),
      },
    ],
    categoryAxisTitle: "Revenue",
    valueAxisTitle: "Cost",
    legend: "none",
  }),
];

const chartSheet: Sheet = {
  name: "Charts",
  id: SHEET_ID,
  status: 1,
  order: 0,
  row: 40,
  column: 26,
  celldata: celldata(),
  charts,
};

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

/** Every chart type, fed by the table in A1:D7 (edit a cell to see it update). */
export const Gallery = Template.bind({});
// @ts-ignore
Gallery.args = { data: [chartSheet], theme: "light" };

export const GalleryDark = Template.bind({});
// @ts-ignore
GalleryDark.args = { data: [chartSheet], theme: "dark" };

/** Frozen first row: the top charts stay pinned, the others scroll under it. */
export const GalleryFrozen = Template.bind({});
// @ts-ignore
GalleryFrozen.args = {
  data: [{ ...chartSheet, frozen: { type: "row" } }],
  theme: "light",
};

/** Select A1:D7 and use the toolbar's "Insert chart" button. */
export const InsertFromSelection = Template.bind({});
// @ts-ignore
InsertFromSelection.args = {
  data: [{ ...chartSheet, charts: [] }],
  theme: "light",
};
