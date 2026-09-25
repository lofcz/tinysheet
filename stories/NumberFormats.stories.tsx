import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet, formatValue } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";

export default {
  title: "Number formats",
  component: Workbook,
} as Meta<typeof Workbook>;

type CellInput = {
  v?: any;
  fa?: string;
  t?: string;
  tb?: string;
  bl?: number;
};

function cell(r: number, c: number, x: CellInput) {
  const v: any = {};
  if (x.v !== undefined) v.v = x.v;
  if (x.v !== undefined) v.m = formatValue(x.fa ?? "General", x.v);
  if (x.fa) v.ct = { fa: x.fa, t: x.t ?? "n" };
  else if (typeof x.v === "string") v.ct = { fa: "General", t: "g" };
  if (x.tb) v.tb = x.tb;
  if (x.bl) v.bl = x.bl;
  return { r, c, v };
}

const ACCOUNTING =
  '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)';

/**
 * Column B holds formatted values; type the formulas of column F into
 * column C to see their format inferred like Excel. Column E is narrow, so
 * General numbers shorten and dates show ####.
 */
const formats: Sheet = {
  name: "Formats",
  id: "formats",
  status: 1,
  order: 0,
  config: {
    columnlen: { 0: 120, 1: 120, 2: 120, 3: 24, 4: 46, 5: 120 },
  },
  celldata: [
    cell(0, 0, { v: "Kind", bl: 1 }),
    cell(0, 1, { v: "Value", bl: 1 }),
    cell(0, 2, { v: "Formula (General)", bl: 1 }),
    cell(0, 4, { v: "Narrow", bl: 1 }),
    cell(0, 5, { v: "Formula text", bl: 1 }),
    cell(1, 0, { v: "Date" }),
    cell(1, 1, { v: 45366, fa: "m/d/yyyy", t: "d" }),
    cell(1, 5, { v: "=B2+7" }),
    cell(2, 0, { v: "Currency" }),
    cell(2, 1, { v: 1234.5, fa: '"$"#,##0.00' }),
    cell(2, 5, { v: "=B3*1.2" }),
    cell(3, 0, { v: "Percent" }),
    cell(3, 1, { v: 0.125, fa: "0.0%" }),
    cell(3, 5, { v: "=B4*2" }),
    cell(4, 0, { v: "Time" }),
    cell(4, 1, { v: 0.5625, fa: "h:mm", t: "d" }),
    cell(4, 5, { v: "=B5-B6" }),
    cell(5, 0, { v: "Time 2" }),
    cell(5, 1, { v: 0.25, fa: "h:mm", t: "d" }),
    cell(5, 5, { v: "=SUM(B3:B3,B7)" }),
    cell(6, 0, { v: "Accounting" }),
    cell(6, 1, { v: -42, fa: ACCOUNTING }),
    cell(6, 5, { v: "=TODAY()-B2" }),
    cell(7, 0, { v: "General" }),
    cell(7, 1, { v: 3.14159265358979 }),
    cell(7, 5, { v: "=B8*2" }),
    cell(1, 4, { v: 3.14159265 }),
    cell(2, 4, { v: 123456789 }),
    cell(3, 4, { v: 1234.5678, fa: "#,##0.00" }),
    cell(4, 4, { v: 45366, fa: "m/d/yyyy", t: "d" }),
    cell(5, 4, { v: 0.000123456 }),
    cell(6, 4, { v: "text overflows", tb: "1" }),
  ] as any,
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

export const Formats = Template.bind({});
// @ts-ignore
Formats.args = { data: [formats], currency: "$" };

export const FormatsDark = Template.bind({});
// @ts-ignore
FormatsDark.args = {
  data: [formats],
  currency: "$",
  theme: "dark",
};
