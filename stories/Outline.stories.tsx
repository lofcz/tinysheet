import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "Outline and subtotals",
  component: Workbook,
} as Meta<typeof Workbook>;

const header = ["Region", "Rep", "Q1", "Q2", "Q3", "Q4", "Year"];
const rows: [string, string, number, number, number, number][] = [
  ["East", "Ana", 120, 130, 110, 150],
  ["East", "Ben", 90, 95, 100, 105],
  ["North", "Cleo", 60, 70, 80, 75],
  ["North", "Dev", 200, 180, 190, 210],
  ["North", "Eli", 40, 45, 50, 55],
  ["West", "Fay", 150, 160, 170, 165],
  ["West", "Gus", 80, 85, 70, 95],
];

function num(v: number) {
  return { v, m: `${v}`, ct: { fa: "General", t: "n" } };
}

function text(v: string, bold = false) {
  return { v, m: v, ct: { fa: "General", t: "g" }, ...(bold ? { bl: 1 } : {}) };
}

/**
 * A sales list with Data › Subtotal applied (a SUBTOTAL row per region and a
 * grand total, two row levels) and the quarters grouped as columns.
 */
function makeSheet(name: string, frozen = false): Sheet {
  const celldata: any[] = [];
  header.forEach((h, c) => celldata.push({ r: 0, c, v: text(h, true) }));
  let r = 1;
  const levels: Record<string, number> = {};
  const grand = [0, 0, 0, 0, 0];
  const regions = [...new Set(rows.map((x) => x[0]))];
  const formula = (f: string, v: number) => ({ ...num(v), f, bl: 1 });
  regions.forEach((region) => {
    const first = r;
    const sums = [0, 0, 0, 0, 0];
    rows
      .filter((x) => x[0] === region)
      .forEach((row) => {
        row.forEach((v, c) =>
          celldata.push({
            r,
            c,
            v: typeof v === "number" ? num(v) : text(v),
          })
        );
        const quarters = row.slice(2) as number[];
        const year = quarters.reduce((a, b) => a + b, 0);
        celldata.push({
          r,
          c: 6,
          v: { ...num(year), f: `=SUM(C${r + 1}:F${r + 1})` },
        });
        [...quarters, year].forEach((v, k) => {
          sums[k] += v;
          grand[k] += v;
        });
        levels[r] = 2;
        r += 1;
      });
    celldata.push({ r, c: 0, v: text(`${region} Total`, true) });
    for (let c = 2; c <= 6; c += 1) {
      const col = String.fromCharCode(65 + c);
      celldata.push({
        r,
        c,
        v: formula(`=SUBTOTAL(9,${col}${first + 1}:${col}${r})`, sums[c - 2]),
      });
    }
    levels[r] = 1;
    r += 1;
  });
  celldata.push({ r, c: 0, v: text("Grand Total", true) });
  for (let c = 2; c <= 6; c += 1) {
    const col = String.fromCharCode(65 + c);
    celldata.push({
      r,
      c,
      v: formula(`=SUBTOTAL(9,${col}2:${col}${r})`, grand[c - 2]),
    });
  }
  return {
    name,
    id: name,
    order: 0,
    status: 1,
    row: 40,
    column: 12,
    celldata,
    config: {
      rowOutlineLevel: levels,
      colOutlineLevel: { 2: 1, 3: 1, 4: 1, 5: 1 },
    },
    ...(frozen
      ? {
          frozen: {
            type: "rangeBoth",
            range: { row_focus: 0, column_focus: 1 },
          },
        }
      : {}),
  } as Sheet;
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

export const Subtotals = Template.bind({});
Subtotals.args = { data: [makeSheet("Sales")] };

export const FrozenDark = Template.bind({});
FrozenDark.args = {
  data: [makeSheet("Sales", true)],
  theme: "dark",
};
