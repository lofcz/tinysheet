import React, { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import {
  Workbook,
  defaultRibbon,
  registerRibbonCommand,
  useSidePane,
  IconButton,
  Checkbox,
  Switch,
  NumberInput,
  Select,
  Button,
} from "@lofcz/tinysheet-react";
import type { RibbonTabConfig } from "@lofcz/tinysheet-core";
import type { Sheet } from "@lofcz/tinysheet-core";
import cell from "./data/cell";

const data = [cell as unknown as Sheet];

/**
 * The suite shell: ribbon, grid pane, bottom pane and the side pane dock,
 * in the "suite" chrome (padded panes) and the "compact" one (embedding).
 */
export default {
  title: "Shell",
  component: Workbook,
} as Meta<typeof Workbook>;

/** Side pane content built from the ui primitives. */
const PaneBody: React.FC = () => {
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(false);
  const [size, setSize] = useState<number | null>(12);
  const [unit, setUnit] = useState("pt");
  return (
    <div
      style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <Checkbox checked={grid} onChange={setGrid} label="Show gridlines" />
      <Switch checked={snap} onChange={setSnap} label="Snap to cells" />
      <div style={{ display: "flex", gap: 8 }}>
        <NumberInput
          value={size}
          onChange={setSize}
          min={1}
          max={72}
          aria-label="Size"
          width={120}
        />
        <Select
          value={unit}
          onChange={setUnit}
          aria-label="Unit"
          width={90}
          options={[
            { value: "pt", label: "pt" },
            { value: "px", label: "px" },
            { value: "cm", label: "cm" },
          ]}
        />
      </div>
      <Button variant="primary">Apply</Button>
    </div>
  );
};

/** View › Task Pane: toggles a docked side pane. */
const TaskPaneCommand: React.FC = () => {
  const { isSidePaneOpen, toggleSidePane } = useSidePane();
  const open = isSidePaneOpen("task-pane");
  return (
    <IconButton
      icon="side-pane"
      label="Task Pane"
      pressed={open}
      onClick={() =>
        toggleSidePane("task-pane", <PaneBody />, { title: "Task Pane" })
      }
    />
  );
};
registerRibbonCommand("story-task-pane", TaskPaneCommand);

const ribbon: RibbonTabConfig[] = defaultRibbon.map((tab) =>
  tab.id === "view"
    ? {
        ...tab,
        groups: [
          ...tab.groups,
          { id: "panes", label: "Panes", items: ["story-task-pane"] },
        ],
      }
    : tab
);

// only these args: the on* ones are implicit Storybook actions
const Template: StoryFn<typeof Workbook> = ({ chrome, defaultTheme }) => (
  <div style={{ width: "100%", height: "100vh" }}>
    <Workbook
      chrome={chrome}
      defaultTheme={defaultTheme}
      data={data}
      ribbon={ribbon}
    />
  </div>
);

export const Suite = Template.bind({});
Suite.args = { chrome: "suite" };

export const Compact = Template.bind({});
Compact.args = { chrome: "compact" };

export const Dark = Template.bind({});
Dark.args = { chrome: "suite", defaultTheme: "dark" };
