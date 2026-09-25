import React, { CSSProperties } from "react";
import SVGIcon from "../SVGIcon";
import { activateOnKey } from "./Button";

const Select: React.FC<{
  children?: React.ReactNode;
  style?: CSSProperties;
}> = ({ children, style }) => {
  return (
    <div className="fortune-toolbar-select" style={style} role="menu">
      {children}
    </div>
  );
};

type OptionProps = {
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  iconId?: string;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  /** One of a set of choices (e.g. a theme): announced as a radio item. */
  checked?: boolean;
};

const Option: React.FC<React.PropsWithChildren<OptionProps>> = ({
  iconId,
  onClick,
  children,
  onMouseLeave,
  onMouseEnter,
  checked,
}) => {
  return (
    <div
      onClick={onClick}
      onKeyDown={activateOnKey}
      tabIndex={0}
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      className="fortune-toolbar-select-option"
      onMouseLeave={(e) => onMouseLeave?.(e)}
      onMouseEnter={(e) => onMouseEnter?.(e)}
    >
      {iconId && <SVGIcon name={iconId} />}
      <div className="fortuen-toolbar-text">{children}</div>
    </div>
  );
};

export { Option };

export default Select;
