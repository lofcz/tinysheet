import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "Data tools",
  component: Workbook,
} as Meta<typeof Workbook>;

const header = ["Name", "Region", "Qty", "Date", "Status", "Code"];
const rows: [string, string, number, number, string, string][] = [
  ["apple", "East", 10, 45306, "Open", "A1"],
  ["banana", "West", 20, 45342, "Closed", "B2"],
  ["cherry", "East", 30, 45356, "Open", "C3"],
  ["apricot", "North", 40, 45291, "Pending", "D4"],
  ["blueberry", "West", 50, 45477, "Open", "E5"],
  ["avocado", "East", 60, 45292, "Closed", "F6"],
  ["date", "South", 70, 45473, "Open", "G7"],
  ["elderberry", "North", 80, 45560, "Bogus", "H8"],
  ["banana", "West", 20, 45342, "Closed", "B2"],
];

function cell(v: any, date = false) {
  if (typeof v === "number") {
    return date
      ? {
          v,
          m: new Date(Date.UTC(1899, 11, 30) + v * 86400000)
            .toISOString()
            .slice(0, 10),
          ct: { fa: "yyyy-mm-dd", t: "d" },
        }
      : { v, m: `${v}`, ct: { fa: "General", t: "n" } };
  }
  return { v, m: v, ct: { fa: "General", t: "g" } };
}

function makeSheet(): Sheet {
  const celldata: any[] = [];
  header.forEach((h, c) =>
    celldata.push({ r: 0, c, v: { ...cell(h), bl: 1 } })
  );
  rows.forEach((row, i) => {
    row.forEach((v, c) => {
      const value: any = cell(v, c === 3);
      if (c === 1 && v === "East") value.bg = "#fff2cc";
      if (c === 1 && v === "West") value.bg = "#d9ead3";
      if (c === 0 && i % 3 === 0) value.fc = "#cc0000";
      celldata.push({ r: i + 1, c, v: value });
    });
  });
  // list source for the Status column
  ["Open", "Closed", "Pending"].forEach((v, i) =>
    celldata.push({ r: i, c: 8, v: cell(v) })
  );
  celldata.push({
    r: 12,
    c: 0,
    v: cell("Split me: Smith, John;42;15/01/2024"),
  });
  celldata.push({ r: 13, c: 0, v: cell("Doe, Jane;7;02/03/2024") });

  const dataVerification: Record<string, any> = {};
  const list = {
    type: "dropdown",
    type2: "",
    value1: "=$I$1:$I$3",
    value2: "",
    prohibitInput: true,
    errorStyle: "warning",
    hintShow: true,
    hintTitle: "Status",
    hintValue: "Pick a status from the list.",
    anchor: { r: 1, c: 4 },
  };
  const qty = {
    type: "number_integer",
    type2: "between",
    value1: "1",
    value2: "75",
    prohibitInput: true,
    errorStyle: "stop",
    errorTitle: "Quantity",
    errorMessage: "Enter a whole number from 1 to 75.",
    hintShow: false,
    hintValue: "",
    anchor: { r: 1, c: 2 },
  };
  const note = {
    type: "any",
    type2: "",
    value1: "",
    value2: "",
    prohibitInput: false,
    hintShow: false,
    hintValue: "",
    placeholder: "Add a note…",
    anchor: { r: 1, c: 6 },
  };
  for (let r = 1; r <= rows.length; r += 1) {
    dataVerification[`${r}_4`] = list;
    dataVerification[`${r}_2`] = qty;
    dataVerification[`${r}_6`] = note;
  }
  return {
    name: "Data",
    id: "data-tools",
    order: 0,
    celldata,
    dataVerification,
    config: { columnlen: { 0: 120, 5: 60, 6: 140 } },
    filter_select: { row: [0, rows.length], column: [0, 5] },
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

/** Sort, filter, validation, remove duplicates and text to columns. */
export const Light = Template.bind({});
// @ts-ignore
Light.args = { data: [makeSheet()], theme: "light" };

export const Dark = Template.bind({});
// @ts-ignore
Dark.args = { data: [makeSheet()], theme: "dark" };
