/**
 * Outline tools (Data › Group / Ungroup, Show / Hide Detail, Auto Outline,
 * Clear Outline, Subtotal, outline settings), plugged in through the
 * extension registries: the "outline" toolbar item and a sheet overlay that
 * asks rows-or-columns for Shift+Alt+Right / Left on a plain range. The
 * gutter itself is rendered by the sheet (./OutlineGutter).
 */
import {
  autoOutline,
  clearOutline,
  groupSelection,
  outlineLocale,
  selectionOutlineAxis,
  showHideDetail,
} from "@lofcz/tinysheet-core";
import React, { useContext, useEffect } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import Combo from "../Toolbar/Combo";
import { MenuDivider } from "../Toolbar/Divider";
import Select, { Option } from "../Toolbar/Select";
import { GroupDialog, OutlineSettingsDialog, SubtotalDialog } from "./dialogs";
import OutlineGutterView from "./OutlineGutter";
import "./index.css";

export { GroupDialog, OutlineSettingsDialog, SubtotalDialog } from "./dialogs";

const ICON_ID = "fortune-outline-icon";

/** The toolbar icon: rows with an outline bracket and a − button. */
const IconSymbol: React.FC = () => (
  <svg
    width="0"
    height="0"
    style={{ position: "absolute" }}
    aria-hidden="true"
    focusable="false"
  >
    <symbol id={ICON_ID} viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 5.5h10M10 9.5h10M10 13.5h10M10 18.5h10" />
        <path d="M5 5.5h2M5 5.5v9" />
        <rect x="2.75" y="15.75" width="4.5" height="4.5" rx="0.5" />
        <path d="M3.75 18h2.5" />
      </g>
    </symbol>
  </svg>
);

type Item =
  | { value: "divider" }
  | {
      value: string;
      text: string;
      disabled?: boolean;
      onClick: () => void;
    };

/** Toolbar "Group & Outline" menu (Excel's Data › Outline group). */
export const OutlineToolbarItem: React.FC<{ tooltip?: string }> = ({
  tooltip,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const t = outlineLocale(context);
  const editable = context.allowEdit !== false;

  const group = (ungroup: boolean) => {
    if (selectionOutlineAxis(context)) {
      setContext((ctx) => {
        groupSelection(ctx, ungroup);
      });
    } else showDialog(<GroupDialog ungroup={ungroup} />);
  };

  const items: Item[] = [
    {
      value: "group",
      text: t.menu.group,
      disabled: !editable,
      onClick: () => group(false),
    },
    {
      value: "ungroup",
      text: t.menu.ungroup,
      disabled: !editable,
      onClick: () => group(true),
    },
    { value: "divider" },
    {
      value: "show-detail",
      text: t.menu.showDetail,
      onClick: () =>
        setContext((ctx) => {
          showHideDetail(ctx, true);
        }),
    },
    {
      value: "hide-detail",
      text: t.menu.hideDetail,
      onClick: () =>
        setContext((ctx) => {
          showHideDetail(ctx, false);
        }),
    },
    { value: "divider" },
    {
      value: "auto-outline",
      text: t.menu.autoOutline,
      disabled: !editable,
      onClick: () =>
        setContext((ctx) => {
          autoOutline(ctx);
        }),
    },
    {
      value: "clear-outline",
      text: t.menu.clearOutline,
      disabled: !editable,
      onClick: () =>
        setContext((ctx) => {
          const sel = ctx.luckysheet_select_save?.[0];
          const single =
            !sel ||
            (sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1]);
          clearOutline(
            ctx,
            single ? undefined : { row: sel!.row, column: sel!.column }
          );
        }),
    },
    { value: "divider" },
    {
      value: "subtotal",
      text: t.menu.subtotal,
      disabled: !editable,
      onClick: () => showDialog(<SubtotalDialog />),
    },
    {
      value: "settings",
      text: t.menu.settings,
      disabled: !editable,
      onClick: () => showDialog(<OutlineSettingsDialog />),
    },
  ];

  return (
    <>
      <IconSymbol />
      <Combo iconId={ICON_ID} tooltip={tooltip || t.toolbar.outline}>
        {(setOpen) => (
          // mouse moves here must not queue sheet updates that React would
          // replay the menu command on top of (a doubled undo step)
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div onMouseMove={(e) => e.buttons === 0 && e.stopPropagation()}>
            <Select>
              {items.map((item, index) =>
                !("text" in item) ? (
                  // eslint-disable-next-line react/no-array-index-key
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
                      <span />
                    </div>
                  </Option>
                )
              )}
            </Select>
          </div>
        )}
      </Combo>
    </>
  );
};

/**
 * Asks "Rows or Columns?" when Group / Ungroup was requested (keyboard) for
 * a range that is neither whole rows nor whole columns.
 */
export const OutlinePrompt: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const prompt = context.outlinePrompt;
  useEffect(() => {
    if (!prompt) return;
    setContext(
      (ctx) => {
        delete ctx.outlinePrompt;
      },
      { noHistory: true }
    );
    showDialog(<GroupDialog ungroup={prompt === "ungroup"} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);
  return null;
};

registerToolbarItem("outline", ({ tooltip }) => (
  <OutlineToolbarItem tooltip={tooltip} />
));
registerSheetOverlay("outlinePrompt", OutlinePrompt);

/**
 * The outline gutter, rendered by the sheet. Defined here (not re-exported)
 * so that using it evaluates this module, which registers the toolbar item
 * and the prompt above even in bundles that skip side-effect-free modules.
 */
export const OutlineGutter: React.FC = () => <OutlineGutterView />;
