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

// ---------------------------------------------------------------------------
// Round 2: combo, radar, bubble, waterfall, histogram, Pareto, funnel, stock,
// trendlines and error bars.
// ---------------------------------------------------------------------------

const SHEET2 = "charts2";

const table2: (string | number | null)[][] = [
  ["Day", "Open", "High", "Low", "Close", "Volume", "Score", "Step", "Flow"],
  ["Mon", 44, 55, 11, 25, 120, 55, "Visits", 1000],
  ["Tue", 25, 57, 12, 38, 90, 61, "Leads", 420],
  ["Wed", 38, 57, 13, 50, 150, 64, "Trials", 180],
  ["Thu", 50, 58, 11, 34, 80, 68, "Deals", 60],
  ["Fri", 34, 58, 25, 43, 110, 71, null, null],
  [null, null, null, null, null, null, 73, null, null],
  [null, null, null, null, null, null, 75, null, null],
  [null, null, null, null, null, null, 78, null, null],
  [null, null, null, null, null, null, 81, null, null],
  [null, null, null, null, null, null, 88, null, null],
  [null, null, null, null, null, null, 92, null, null],
];

function celldata2() {
  const out: Sheet["celldata"] = [];
  table2.forEach((cells, r) =>
    cells.forEach((v, c) => {
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

const r2 = (r1: number, rr: number, c1: number, c2: number) => ({
  sheetId: SHEET2,
  row: [r1, rr] as [number, number],
  column: [c1, c2] as [number, number],
});

const days = r2(1, 5, 0, 0);
const s2 = (c: number, extra: Partial<Chart["series"][number]> = {}) => ({
  nameRef: r2(0, 0, c, c),
  values: r2(1, 5, c, c),
  categories: days,
  ...extra,
});

const base2 = (i: number, chart: Partial<Chart>): Chart => ({
  id: `story2-chart-${i}`,
  type: "column",
  series: [],
  legend: "bottom",
  left: 700 + (i % 3) * (W + 16),
  top: 10 + Math.floor(i / 3) * (H + 16),
  width: W,
  height: H,
  ...chart,
});

const charts2: Chart[] = [
  base2(0, {
    title: "Combo: close + volume",
    type: "combo",
    series: [
      s2(5, { type: "column" }),
      s2(4, { type: "line", secondary: true }),
    ],
    markers: true,
  }),
  base2(1, {
    title: "Radar",
    type: "radar",
    radarStyle: "marker",
    series: [s2(1), s2(4)],
  }),
  base2(2, {
    title: "Bubble",
    type: "bubble",
    series: [
      {
        nameRef: r2(0, 0, 4, 4),
        values: r2(1, 5, 4, 4),
        categories: r2(1, 5, 1, 1),
        sizes: r2(1, 5, 5, 5),
      },
    ],
    legend: "none",
  }),
  base2(3, {
    title: "Waterfall",
    type: "waterfall",
    series: [
      {
        name: "Cash",
        values: r2(1, 5, 1, 1),
        categories: days,
      },
    ],
    waterfallTotals: [0],
    dataLabels: true,
    legend: "top",
  }),
  base2(4, {
    title: "Histogram",
    type: "histogram",
    series: [{ nameRef: r2(0, 0, 6, 6), values: r2(1, 11, 6, 6) }],
    binning: { mode: "width", width: 10 },
    legend: "none",
  }),
  base2(5, {
    title: "Funnel",
    type: "funnel",
    series: [
      {
        nameRef: r2(0, 0, 8, 8),
        values: r2(1, 4, 8, 8),
        categories: r2(1, 4, 7, 7),
      },
    ],
    legend: "none",
  }),
  base2(6, {
    title: "Stock (OHLC)",
    type: "stock",
    stockVariant: "ohlc",
    series: [s2(1), s2(2), s2(3), s2(4)],
  }),
  base2(7, {
    title: "Trendline and error bars",
    type: "scatter",
    markers: true,
    series: [
      {
        nameRef: r2(0, 0, 4, 4),
        values: r2(1, 5, 4, 4),
        categories: r2(1, 5, 1, 1),
        trendlines: [
          {
            type: "linear",
            displayEquation: true,
            displayRSquared: true,
            forward: 5,
          },
        ],
        errorBars: { type: "percentage", value: 10 },
      },
    ],
    legend: "bottom",
  }),
  base2(8, {
    title: "Pareto",
    type: "pareto",
    series: [
      { nameRef: r2(0, 0, 5, 5), values: r2(1, 5, 5, 5), categories: days },
    ],
    style: 5,
    legend: "top",
  }),
];

const chartSheet2: Sheet = {
  name: "Charts 2",
  id: SHEET2,
  status: 1,
  order: 0,
  row: 40,
  column: 30,
  celldata: celldata2(),
  charts: charts2,
};

/** Round 2 chart types, trendlines and error bars. */
export const MoreTypes = Template.bind({});
// @ts-ignore
MoreTypes.args = { data: [chartSheet2], theme: "light" };

export const MoreTypesDark = Template.bind({});
// @ts-ignore
MoreTypesDark.args = { data: [chartSheet2], theme: "dark" };
