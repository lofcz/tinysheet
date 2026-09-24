import React, { useState, useCallback } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet, ThemeSetting } from "@lofcz/tinysheet-core";
import { Workbook } from "@lofcz/tinysheet-react";
import cell from "./data/cell";
import formula from "./data/formula";

export default {
  title: "Theming",
  component: Workbook,
  argTypes: {
    theme: {
      control: { type: "inline-radio" },
      options: ["light", "dark", "auto"],
    },
  },
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

/** Pick the theme from the Controls panel. */
export const Light = Template.bind({});
// @ts-ignore
Light.args = { data: [cell, formula], theme: "light" };

export const Dark = Template.bind({});
// @ts-ignore
Dark.args = { data: [cell, formula], theme: "dark" };

/** Follows the operating system's light / dark preference, live. */
export const Auto = Template.bind({});
// @ts-ignore
Auto.args = { data: [cell, formula], theme: "auto" };

const themes: ThemeSetting[] = ["light", "dark", "auto"];
const greenLabel = "green accent (--fortune-accent / --fortune-selection)";

/** An in-page switcher, plus a custom accent set through a CSS variable. */
export const Toggle: StoryFn<typeof Workbook> = () => {
  const [theme, setTheme] = useState<ThemeSetting>("dark");
  const [data, setData] = useState<Sheet[]>([cell, formula]);
  const [green, setGreen] = useState(false);
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <div
        role="radiogroup"
        aria-label="Theme"
        style={{ display: "flex", gap: 12, padding: 8, alignItems: "center" }}
      >
        <strong>Theme</strong>
        {themes.map((t) => (
          <span key={t} style={{ display: "flex", gap: 4 }}>
            <input
              id={`theme-${t}`}
              type="radio"
              name="theme"
              checked={theme === t}
              onChange={() => setTheme(t)}
            />
            <label htmlFor={`theme-${t}`}>{t}</label>
          </span>
        ))}
        <span style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          <input
            id="theme-green-accent"
            type="checkbox"
            checked={green}
            onChange={(e) => setGreen(e.target.checked)}
          />
          <label htmlFor="theme-green-accent">{greenLabel}</label>
        </span>
      </div>
      {green && (
        <style>
          {`.theming-story .fortune-container,
            .theming-story .fortune-modal-container {
              --fortune-accent: #188038;
              --fortune-accent-hover: #137333;
              --fortune-accent-soft: #e6f4ea;
              --fortune-accent-text: #137333;
              --fortune-selection: #188038;
              --fortune-selection-fill: rgba(24, 128, 56, 0.1);
            }`}
        </style>
      )}
      <div className="theming-story" style={{ flex: 1, minHeight: 0 }}>
        <Workbook data={data} onChange={setData} theme={theme} />
      </div>
    </div>
  );
};
