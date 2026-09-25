import React, { useCallback, useEffect, useRef, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Shape, Sheet } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";

/**
 * Shapes and text boxes (Insert › Shapes): preset shapes anchored to cells,
 * with fill, outline, shadow, rotation, groups and rich text. The workbook
 * API is exposed as `window.__tinysheet` for the e2e suite.
 */
export default {
  title: "Shapes",
  component: Workbook,
  argTypes: {
    theme: {
      control: { type: "inline-radio" },
      options: ["light", "dark", "auto"],
    },
  },
} as Meta<typeof Workbook>;

const at = (r: number, c: number, dx = 0, dy = 0) => ({ r, c, dx, dy });

const shapes: Shape[] = [
  {
    id: "title",
    name: "TextBox 1",
    prst: "rect",
    textBox: true,
    from: at(1, 1),
    to: at(3, 4, 40),
    fill: { color: "#FFFFFF" },
    line: { color: "#000000", width: 1 },
    text: {
      anchor: "t",
      paragraphs: [
        {
          align: "l",
          runs: [
            { text: "Quarterly ", b: true, size: 14 },
            { text: "review", b: true, i: true, size: 14, color: "#C00000" },
          ],
        },
        { align: "l", runs: [{ text: "Text boxes hold rich text." }] },
      ],
    },
  },
  {
    id: "rect",
    name: "Rectangle 2",
    prst: "roundRect",
    from: at(5, 1),
    to: at(10, 2, 60),
    fill: { color: "#4472C4" },
    line: { color: "#2F528F", width: 1 },
    shadow: true,
    text: {
      anchor: "ctr",
      paragraphs: [{ align: "ctr", runs: [{ text: "Plan" }] }],
    },
  },
  {
    id: "arrow",
    name: "Arrow: Right 3",
    prst: "rightArrow",
    from: at(6, 3),
    to: at(9, 4),
    fill: { color: "#ED7D31" },
    line: null,
    group: "g1",
  },
  {
    id: "oval",
    name: "Oval 4",
    prst: "ellipse",
    from: at(5, 4, 30),
    to: at(10, 6),
    fill: { color: "#70AD47", transparency: 0.2 },
    line: { color: "#507E32", width: 2, dash: "dash" },
    text: {
      anchor: "ctr",
      paragraphs: [{ align: "ctr", runs: [{ text: "Do", u: true }] }],
    },
    group: "g1",
  },
  {
    id: "line",
    name: "Straight Arrow Connector 5",
    prst: "line",
    from: at(12, 1),
    to: at(15, 4),
    line: { color: "#7030A0", width: 2, tail: "triangle" },
  },
  {
    id: "star",
    name: "Star: 5 Points 6",
    prst: "star5",
    from: at(12, 5),
    to: at(18, 7),
    rot: 15,
    fill: { color: "#FFC000" },
    line: { color: "#BF9000", width: 1 },
  },
  {
    id: "callout",
    name: "Speech Bubble 7",
    prst: "wedgeRoundRectCallout",
    from: at(1, 6),
    to: at(4, 8),
    fill: { color: "#FFF2CC" },
    line: { color: "#BF9000", width: 1 },
    text: {
      anchor: "ctr",
      paragraphs: [
        {
          align: "ctr",
          runs: [{ text: "Callouts point at cells", color: "#000000" }],
        },
      ],
    },
  },
];

const sheet = (): Sheet => ({
  name: "Shapes",
  id: "shapes",
  order: 0,
  status: 1,
  row: 100,
  column: 26,
  celldata: [
    {
      r: 0,
      c: 0,
      v: { v: "Shapes demo", m: "Shapes demo", ct: { fa: "General", t: "g" } },
    },
  ],
  shapes,
});

const Template: StoryFn<typeof Workbook> = ({
  // eslint-disable-next-line react/prop-types
  data: data0,
  ...args
}) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data, setData] = useState<Sheet[]>(data0 ?? [sheet()]);
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  useEffect(() => {
    Object.defineProperty(window, "__tinysheet", {
      configurable: true,
      get: () => ref.current,
    });
    return () => {
      delete (window as any).__tinysheet;
    };
  }, []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook ref={ref} {...args} data={data} onChange={onChange} />
    </div>
  );
};

export const Gallery = Template.bind({});
Gallery.args = {};

export const Dark = Template.bind({});
Dark.args = { theme: "dark" };

export const Empty = Template.bind({});
Empty.args = {
  data: [
    {
      name: "Sheet1",
      id: "sheet1",
      order: 0,
      status: 1,
      row: 100,
      column: 26,
      celldata: [],
    },
  ],
};
