/**
 * Cell controls and data tools: Insert › Checkbox, Flash Fill, Advanced
 * Filter, Goal Seek and Data Tables: the dialogs and sheet overlays (the
 * ribbon commands are in ../Ribbon); the logic lives in core (checkbox.ts,
 * flashFill.ts, advancedFilter.ts, whatIf.ts).
 */
import { registerSheetOverlay } from "../../extensions";
import AdvancedFilter from "./AdvancedFilter";
import DataTable from "./DataTable";
import GoalSeek from "./GoalSeek";
import { CellToolsNotice, DataTableAutoRecalc } from "./overlays";
import { RefPickBar } from "./refPick";
import "../DataVerification/dataTools.css";
import "./index.css";

let registered = false;

/**
 * Register the sheet overlays (called by features.ts; calling it again is a
 * no-op). The ribbon commands (Insert › Checkbox, Data › Flash Fill,
 * Advanced, What-If Analysis) are in ../Ribbon.
 */
export function registerCellTools() {
  if (registered) return;
  registered = true;
  registerSheetOverlay("cellToolsNotice", CellToolsNotice);
  registerSheetOverlay("dataTableRecalc", DataTableAutoRecalc);
  registerSheetOverlay("refPick", RefPickBar);
}

export { AdvancedFilter, DataTable, GoalSeek };
export { GoalSeekStatus } from "./GoalSeek";
