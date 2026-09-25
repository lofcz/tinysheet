import {
  clearAllFilterConditions,
  createFilter,
  dataToolsLocale,
  handleSort,
  locale,
  reapplyFilter,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useContext } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import Combo from "../Toolbar/Combo";
import { MenuDivider } from "../Toolbar/Divider";
import Select, { Option } from "../Toolbar/Select";
import SVGIcon from "../SVGIcon";
import CustomSort from ".";
import RemoveDuplicates from "../RemoveDuplicates";

type Item =
  | { value: "divider" }
  | {
      value: string;
      text: string;
      iconId?: string;
      disabled?: boolean;
      onClick: () => void;
    };

/** Toolbar "Sort & Filter" menu. */
const SortFilterCombo: React.FC<{ tooltip: string }> = ({ tooltip }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { sort, filter } = locale(context);
  const t = dataToolsLocale(context);
  const hasFilter = !_.isEmpty(context.luckysheet_filter_save);
  const hasConditions = hasFilter && !_.isEmpty(context.filter);
  const editable = context.allowEdit !== false;

  const items: Item[] = [
    {
      iconId: "sort-asc",
      value: "sort-asc",
      text: sort.asc,
      onClick: () => setContext((ctx) => handleSort(ctx, true)),
    },
    {
      iconId: "sort-desc",
      value: "sort-desc",
      text: sort.desc,
      onClick: () => setContext((ctx) => handleSort(ctx, false)),
    },
    {
      iconId: "sort",
      value: "custom-sort",
      text: t.toolbar.sort,
      disabled: !editable,
      onClick: () => showDialog(<CustomSort />),
    },
    { value: "divider" },
    {
      iconId: "filter1",
      value: "filter",
      text: filter.filter,
      onClick: () => setContext((ctx) => createFilter(ctx)),
    },
    {
      iconId: "eraser",
      value: "clear",
      text: t.filter.clearAll,
      disabled: !hasConditions,
      onClick: () => setContext((ctx) => clearAllFilterConditions(ctx)),
    },
    {
      value: "reapply",
      text: t.filter.reapply,
      disabled: !hasConditions,
      onClick: () => setContext((ctx) => reapplyFilter(ctx)),
    },
    { value: "divider" },
    {
      value: "remove-duplicates",
      text: t.toolbar.removeDuplicates,
      disabled: !editable,
      onClick: () => showDialog(<RemoveDuplicates />),
    },
  ];

  return (
    <Combo iconId="filter" tooltip={tooltip}>
      {(setOpen) => (
        <Select>
          {items.map((item, index) =>
            item.value === "divider" || !("text" in item) ? (
              <MenuDivider key={`divider-${index}`} />
            ) : (
              <Option
                key={item.value}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
              >
                <div
                  className="fortune-toolbar-menu-line"
                  style={item.disabled ? { opacity: 0.45 } : undefined}
                  aria-disabled={item.disabled}
                >
                  {item.text}
                  {item.iconId ? <SVGIcon name={item.iconId} /> : <span />}
                </div>
              </Option>
            )
          )}
        </Select>
      )}
    </Combo>
  );
};

export default SortFilterCombo;
