import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";
import conditionFormat from "./data/conditionFormat";

export default {
  title: "Conditional formatting",
  component: Workbook,
} as Meta<typeof Workbook>;

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

/** Data bars, colour scales, icon sets and highlight rules. */
export const Light = Template.bind({});
// @ts-ignore
Light.args = { data: [conditionFormat], theme: "light" };

export const Dark = Template.bind({});
// @ts-ignore
Dark.args = { data: [conditionFormat], theme: "dark" };
