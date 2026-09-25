import React from "react";
import SVGIcon from "../SVGIcon";

type Props = {
  tooltip: string;
  iconId: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  disabled?: boolean;
  selected?: boolean;
  children?: React.ReactNode;
};

/** Activate a role="button" div with Enter / Space, like a native button. */
export const activateOnKey = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.click();
  }
};

const Button: React.FC<Props> = ({
  tooltip,
  onClick,
  onDoubleClick,
  iconId,
  disabled,
  selected,
  children,
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
      onDoubleClick={onDoubleClick}
      onKeyDown={activateOnKey}
      tabIndex={0}
      data-tips={tooltip}
      role="button"
      aria-label={tooltip}
      aria-pressed={selected === undefined ? undefined : !!selected}
      aria-disabled={disabled || undefined}
    >
      <SVGIcon name={iconId} />
      {tooltip && (
        <div className="fortune-tooltip" aria-hidden="true">
          {tooltip}
        </div>
      )}
      {children}
    </div>
  );
};

export default Button;
