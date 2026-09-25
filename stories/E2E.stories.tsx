import React, { useCallback, useEffect, useRef, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";

/**
 * Harness for the Playwright suite in e2e/. It renders a blank workbook and
 * exposes the imperative API as `window.__tinysheet` so tests can read cell
 * values back after driving the UI with the mouse and keyboard.
 */
export default {
  title: "E2E/Harness",
  component: Workbook,
} as Meta<typeof Workbook>;

declare global {
  interface Window {
    __tinysheet?: WorkbookInstance | null;
  }
}

const blankSheet = (): Sheet => ({
  name: "Sheet1",
  id: "sheet1",
  order: 0,
  status: 1,
  row: 100,
  column: 26,
  celldata: [],
});

const Template: StoryFn<typeof Workbook> = ({
  // eslint-disable-next-line react/prop-types
  data: data0,
  ...args
}) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data, setData] = useState<Sheet[]>(data0 ?? [blankSheet()]);
  const onChange = useCallback((d: Sheet[]) => {
    setData(d);
  }, []);
  useEffect(() => {
    // A getter, because the instance is recreated whenever the workbook's
    // context changes and a captured one would read stale state.
    Object.defineProperty(window, "__tinysheet", {
      configurable: true,
      get: () => ref.current,
    });
    return () => {
      delete window.__tinysheet;
    };
  }, []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook ref={ref} {...args} data={data} onChange={onChange} />
    </div>
  );
};

export const Blank = Template.bind({});
Blank.args = {};

export const Dark = Template.bind({});
Dark.args = { theme: "dark" };
