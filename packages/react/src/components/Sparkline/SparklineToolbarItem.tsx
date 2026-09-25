import React, { useContext } from "react";
import { sparklineLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import Combo from "../Toolbar/Combo";
import Select, { Option } from "../Toolbar/Select";
import { MenuDivider } from "../Toolbar/Divider";
import { editCommands, insertCommands, openInsertDialog } from "./commands";
import {
  SparklineToolbarSymbol,
  SparklineTypeIcon,
  SPARKLINE_TOOLBAR_ICON,
} from "./icons";

/**
 * Toolbar "Sparklines": the button opens Insert Sparklines (line); the
 * arrow lists the three types and, when the selection has sparklines, the
 * editing commands (settings, data, group/ungroup, clear).
 */
const SparklineToolbarItem: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const t = sparklineLocale(context);
  const helpers = { context, setContext, showDialog };

  return (
    <>
      <SparklineToolbarSymbol />
      <Combo
        iconId={SPARKLINE_TOOLBAR_ICON}
        tooltip={t.insertSparklines}
        onClick={() => {
          if (context.allowEdit === false) return;
          openInsertDialog(helpers, "line");
        }}
      >
        {(setOpen) => {
          const inserts = insertCommands(helpers);
          const edits = editCommands(helpers).filter((c) => !c.disabled);
          return (
            <div className="fortune-sparkline-menu">
              <Select>
                {inserts.map((cmd, i) => (
                  <Option
                    key={cmd.key}
                    onClick={() => {
                      setOpen(false);
                      if (!cmd.disabled) cmd.run();
                    }}
                  >
                    <div className="fortune-sparkline-menu-option">
                      <SparklineTypeIcon
                        type={(["line", "column", "winloss"] as const)[i]}
                        size={18}
                      />
                      <span>{cmd.label}</span>
                    </div>
                  </Option>
                ))}
                {edits.length > 0 && <MenuDivider />}
                {edits.map((cmd) => (
                  <Option
                    key={cmd.key}
                    onClick={() => {
                      setOpen(false);
                      cmd.run();
                    }}
                  >
                    <div className="fortune-sparkline-menu-option">
                      <span>{cmd.label}</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>
          );
        }}
      </Combo>
    </>
  );
};

export default SparklineToolbarItem;
