/**
 * Sparklines UI (Insert › Sparklines and sparkline editing), plugged in
 * through the extension registries (the ribbon commands, Insert ›
 * Sparklines, are in ../Ribbon):
 *
 * - cell menu item "sparkline" (settings.cellContextMenu): a "Sparklines"
 *   submenu on cells with sparklines,
 * - the range-picker bar as a sheet overlay.
 *
 * The model, drawing and xlsx support live in core (modules/sparkline.ts,
 * sparklineRender.ts) and excel.
 */
import React from "react";
import { sparklineLocale } from "@lofcz/tinysheet-core";
import { registerSheetOverlay } from "../../extensions";
import { registerContextMenuItem } from "../ContextMenu/actions";
import { editCommands } from "./commands";
import { SparklineRangePicker } from "./rangePicker";
import "./index.css";

let installed = false;

/** Register the sparkline menu entries and picker (idempotent). */
export function installSparklineUI() {
  if (installed) return;
  installed = true;
  registerSheetOverlay("sparklineRangePicker", SparklineRangePicker);
  registerContextMenuItem("sparkline", (helpers) => {
    const commands = editCommands(helpers);
    if (commands.length === 0) return [];
    return [
      {
        key: "sparkline",
        label: sparklineLocale(helpers.context).editSparklines,
        icon: "sparkline",
        children: commands.map((cmd) => ({
          key: cmd.key,
          label: cmd.label,
          icon: cmd.icon,
          disabled: cmd.disabled,
          onSelect: cmd.run,
        })),
      },
    ];
  });
}

export { default as SparklineDataDialog } from "./SparklineDataDialog";
export { default as SparklineSettingsDialog } from "./SparklineSettingsDialog";
