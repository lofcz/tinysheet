import React from "react";
import CustomIcon from "./CustomIcon";
import { activateOnKey } from "./Button";

type Props = {
  tooltip?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  selected?: boolean;
  children?: React.ReactNode;
  iconName?: string;
  icon?: React.ReactNode;
};

const CustomButton: React.FC<Props> = ({
  tooltip,
  onClick,
  selected,
  children,
  iconName,
  icon,
}) => {
  const className = [
    "fortune-toolbar-button",
    "fortune-toolbar-item",
    selected ? "fortune-toolbar-button-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={className}
      onClick={onClick}
      onKeyDown={activateOnKey}
      tabIndex={0}
      data-tips={tooltip}
      role="button"
      aria-label={tooltip}
      aria-pressed={selected === undefined ? undefined : !!selected}
    >
      <CustomIcon iconName={iconName} content={icon} />
      {tooltip && (
        <div className="fortune-tooltip" aria-hidden="true">
          {tooltip}
        </div>
      )}
      {children}
    </div>
  );
};

export default CustomButton;
