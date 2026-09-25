import {
  dataToolsLocale,
  isShowingInvalidDataCircles,
  setInvalidDataCircles,
} from "@lofcz/tinysheet-core";
import React, { useContext } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import Combo from "../Toolbar/Combo";
import { MenuDivider } from "../Toolbar/Divider";
import Select, { Option } from "../Toolbar/Select";
import DataVerification from ".";

/**
 * Toolbar "Data Validation" button: the dialog on click, and a menu with
 * Circle Invalid Data, Clear Validation Circles and the rules sidebar.
 */
const DataVerificationCombo: React.FC<{ tooltip: string }> = ({ tooltip }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const t = dataToolsLocale(context);
  const circles = isShowingInvalidDataCircles(context);

  const open = () => {
    if (context.allowEdit === false) return;
    showDialog(<DataVerification />);
  };

  const items = [
    { value: "dialog", text: t.toolbar.dataValidation, onClick: open },
    { value: "divider" },
    {
      value: "circle",
      text: t.dataValidation.circleInvalid,
      onClick: () => setContext((ctx) => setInvalidDataCircles(ctx, true)),
    },
    {
      value: "clear-circles",
      text: t.dataValidation.clearCircles,
      disabled: !circles,
      onClick: () => setContext((ctx) => setInvalidDataCircles(ctx, false)),
    },
    { value: "divider" },
    {
      value: "rules",
      text: t.toolbar.validationRules,
      onClick: () =>
        setContext((ctx) => {
          ctx.dataVerificationSidebar = !ctx.dataVerificationSidebar;
        }),
    },
  ];

  return (
    <Combo iconId="dataVerification" tooltip={tooltip} onClick={open}>
      {(setOpen) => (
        <Select>
          {items.map((item, index) =>
            item.value === "divider" ? (
              <MenuDivider key={`divider-${index}`} />
            ) : (
              <Option
                key={item.value}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  setOpen(false);
                }}
              >
                <div
                  className="fortune-toolbar-menu-line"
                  style={item.disabled ? { opacity: 0.45 } : undefined}
                  aria-disabled={item.disabled}
                >
                  {item.text}
                </div>
              </Option>
            )
          )}
        </Select>
      )}
    </Combo>
  );
};

export default DataVerificationCombo;
