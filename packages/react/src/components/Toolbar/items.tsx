/**
 * The legacy toolbar item renderer: what the ribbon (../Ribbon) draws for
 * an item id that has no ribbon command. Every built-in name of
 * `settings.toolbarItems` has ribbon commands now (the same id, or commands
 * that list the name in their `aliases`), so this only draws
 *
 *  - "|" (a divider),
 *  - items registered by hosts and features with `registerToolbarItem`,
 *  - other names (a host's `toolbarItems` list, shown in the Custom group):
 *    a button running the core toolbar handler of that name, if any
 *    (`toolbarItemClickHandler`, e.g. "sort-cell", "merge-all").
 */
import React, { useCallback, useContext } from "react";
import {
  getFlowdata,
  locale,
  toolbarItemClickHandler,
  toolbarItemSelectedFunc,
} from "@lofcz/tinysheet-core";
import { getToolbarItemRenderer } from "../../extensions";
import WorkbookContext from "../../context";
import "./index.css";
import Button from "./Button";
import Divider from "./Divider";

/** Items whose tooltip key in `locale().toolbar` differs from the name. */
const toolbarTooltipAliases: Record<string, string> = {
  link: "insertLink",
  image: "insertImage",
  conditionFormat: "conditionalFormat",
  "horizontal-align": "horizontalAlign",
  "vertical-align": "verticalAlign",
  "text-wrap": "textWrap",
  "text-rotation": "textRotate",
  search: "findAndReplace",
};

/**
 * `render(name, key)`: the control of the toolbar item `name` ("|" is a
 * divider). Re-renders with the selection (a toggle shows the current
 * cell's state).
 */
export function useToolbarItemRenderer() {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { toolbar } = locale(context);
  const firstSelection = context.luckysheet_select_save?.[0];
  const flowdata = getFlowdata(context);
  const row = firstSelection?.row_focus;
  const col = firstSelection?.column_focus;
  const cell =
    flowdata && row != null && col != null ? flowdata?.[row]?.[col] : undefined;

  return useCallback(
    (name: string, i: number | string) => {
      const tooltipKey = toolbarTooltipAliases[name] ?? name;
      const tooltip: string =
        (toolbar as Record<string, string>)[tooltipKey] ?? "";
      if (name === "|") {
        return <Divider key={i} />;
      }
      // items registered by hosts and features (extensions.tsx)
      const registered = getToolbarItemRenderer(name);
      if (registered) {
        return (
          <React.Fragment key={name}>
            {registered({ name, tooltip })}
          </React.Fragment>
        );
      }
      return (
        <Button
          iconId={name}
          tooltip={tooltip || name}
          key={name}
          selected={toolbarItemSelectedFunc(name)?.(cell)}
          onClick={() =>
            setContext((draftCtx) => {
              toolbarItemClickHandler(name)?.(
                draftCtx,
                refs.cellInput.current!,
                refs.globalCache
              );
            })
          }
        />
      );
    },
    [toolbar, cell, setContext, refs.cellInput, refs.globalCache]
  );
}
