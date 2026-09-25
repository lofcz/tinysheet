/**
 * Cell controls and data tools: Insert › Checkbox, Flash Fill, Advanced
 * Filter, Goal Seek and Data Tables. Everything plugs in through the
 * extension registries (toolbar items "checkbox" and "data-tools", sheet
 * overlays); the logic lives in core (checkbox.ts, flashFill.ts,
 * advancedFilter.ts, whatIf.ts).
 */
import {
  cellToolsLocale,
  clearAdvancedFilter,
  getAdvancedFilter,
  getFlowdata,
  hasDataTables,
  recalcDataTables,
  runFlashFillCommand,
  selectionHasCheckboxes,
  toggleCheckboxFormat,
} from "@lofcz/tinysheet-core";
import React, { useContext } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import Button from "../Toolbar/Button";
import Combo from "../Toolbar/Combo";
import { MenuDivider } from "../Toolbar/Divider";
import Select, { Option } from "../Toolbar/Select";
import AdvancedFilter from "./AdvancedFilter";
import DataTable from "./DataTable";
import GoalSeek from "./GoalSeek";
import { CellToolsIcons } from "./icons";
import { CellToolsNotice, DataTableAutoRecalc } from "./overlays";
import { RefPickBar } from "./refPick";
import "../DataVerification/dataTools.css";
import "./index.css";

/** Insert › Checkbox: toggles the checkbox format of the selection. */
export const CheckboxButton: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = cellToolsLocale(context);
  const on = selectionHasCheckboxes(
    getFlowdata(context),
    context.luckysheet_select_save
  );
  return (
    <>
      <CellToolsIcons />
      <Button
        iconId="fortune-cell-checkbox"
        tooltip={t.toolbar.checkbox}
        selected={on}
        disabled={context.allowEdit === false}
        onClick={() => {
          if (context.allowEdit === false) return;
          setContext((ctx) => {
            toggleCheckboxFormat(ctx);
          });
        }}
      />
    </>
  );
};

type Item =
  | { value: "divider" }
  | {
      value: string;
      text: string;
      hint?: string;
      disabled?: boolean;
      onClick: () => void;
    };

/** Data tools menu: Flash Fill, Advanced Filter, What-If Analysis. */
export const DataToolsCombo: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const t = cellToolsLocale(context).toolbar;
  const editable = context.allowEdit !== false;
  const items: Item[] = [
    {
      value: "flash-fill",
      text: t.flashFill,
      hint: t.flashFillShortcut,
      disabled: !editable,
      onClick: () =>
        setContext((ctx) => {
          runFlashFillCommand(ctx);
        }),
    },
    { value: "divider" },
    {
      value: "advanced-filter",
      text: t.advancedFilter,
      disabled: !editable,
      onClick: () => showDialog(<AdvancedFilter />),
    },
    {
      value: "clear-advanced-filter",
      text: t.clearAdvancedFilter,
      disabled: !getAdvancedFilter(context),
      onClick: () =>
        setContext((ctx) => {
          clearAdvancedFilter(ctx);
        }),
    },
    { value: "divider" },
    {
      value: "goal-seek",
      text: t.goalSeek,
      disabled: !editable,
      onClick: () => showDialog(<GoalSeek />),
    },
    {
      value: "data-table",
      text: t.dataTable,
      disabled: !editable,
      onClick: () => showDialog(<DataTable />),
    },
    {
      value: "recalc-data-tables",
      text: t.recalcDataTables,
      disabled: !hasDataTables(context),
      onClick: () =>
        setContext(
          (ctx) => {
            recalcDataTables(ctx);
          },
          { noHistory: true }
        ),
    },
  ];
  return (
    <>
      <CellToolsIcons />
      <Combo iconId="fortune-cell-data-tools" tooltip={t.dataTools}>
        {(setOpen) => (
          <Select>
            {items.map((item, index) =>
              !("text" in item) ? (
                <MenuDivider key={`divider-${index}`} />
              ) : (
                <Option
                  key={item.value}
                  onClick={() => {
                    if (item.disabled) return;
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  <div
                    className="fortune-toolbar-menu-line"
                    data-value={item.value}
                    style={item.disabled ? { opacity: 0.45 } : undefined}
                    aria-disabled={item.disabled}
                  >
                    {item.text}
                    <span className="fortune-cell-tools-menu-hint">
                      {item.hint ?? ""}
                    </span>
                  </div>
                </Option>
              )
            )}
          </Select>
        )}
      </Combo>
    </>
  );
};

let registered = false;

/**
 * Register the toolbar items ("checkbox", "data-tools") and sheet overlays
 * (called by features.ts; calling it again is a no-op).
 */
export function registerCellTools() {
  if (registered) return;
  registered = true;
  registerToolbarItem("checkbox", () => <CheckboxButton />);
  registerToolbarItem("data-tools", () => <DataToolsCombo />);
  registerSheetOverlay("cellToolsNotice", CellToolsNotice);
  registerSheetOverlay("dataTableRecalc", DataTableAutoRecalc);
  registerSheetOverlay("refPick", RefPickBar);
}

export { AdvancedFilter, DataTable, GoalSeek };
export { GoalSeekStatus } from "./GoalSeek";
