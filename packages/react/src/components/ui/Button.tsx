import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Icon,
  ICON_LARGE_SIZE,
  ICON_SIZE,
  ICON_STROKE,
  LucideIcon,
} from "./icons";
import { Tooltip } from "./Tooltip";
import { DropdownMenu, MenuItem } from "./Menu";
import { Popover } from "./Popover";
import "./ui.css";

type IconSource = string | LucideIcon;

const renderIcon = (icon: IconSource | undefined, size = ICON_SIZE) => {
  if (!icon) return null;
  return typeof icon === "string" ? (
    <Icon name={icon} size={size} />
  ) : (
    <Icon icon={icon} size={size} />
  );
};

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> & {
  /** primary: ink; secondary: surface; ghost: transparent until hovered. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: IconSource;
  /** Submit button of a form (default "button"). */
  type?: "button" | "submit";
};

/** A text button: dialog footers, panes, cards. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      className,
      children,
      type = "button",
      ...rest
    },
    ref
  ) => (
    <button
      ref={ref}
      // eslint-disable-next-line react/button-has-type
      type={type}
      className={cx(
        "ts-btn",
        `ts-btn--${variant}`,
        size === "sm" && "ts-btn--sm",
        className
      )}
      {...rest}
    >
      {renderIcon(icon)}
      {children != null && <span className="ts-btn-label">{children}</span>}
    </button>
  )
);
Button.displayName = "Button";

export type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "aria-label"
> & {
  icon: IconSource;
  /** Accessible name and tooltip ("Bold"). */
  label: string;
  /** Shown in the tooltip ("Ctrl+B"). */
  shortcut?: string;
  /** Tooltip help line. */
  description?: React.ReactNode;
  /** A toggle: `true` shows the ink pill and sets aria-pressed. */
  pressed?: boolean;
  /** Visible text next to the icon (small ribbon buttons with labels). */
  text?: React.ReactNode;
  /** Replaces the icon (e.g. a colour bar under the glyph). */
  children?: React.ReactNode;
  size?: "sm" | "md";
  tooltip?: boolean;
};

/**
 * A 32px icon button with a tooltip (name + shortcut). `pressed` makes it
 * a toggle (bold, wrap text, ...): the ink pill, aria-pressed.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      shortcut,
      description,
      pressed,
      text,
      children,
      className,
      size = "md",
      tooltip = true,
      ...rest
    },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        type="button"
        className={cx(
          "ts-icon-btn",
          size === "sm" && "ts-icon-btn--sm",
          text != null && "ts-icon-btn--text",
          pressed && "ts-pressed",
          className
        )}
        aria-label={label}
        aria-pressed={pressed === undefined ? undefined : pressed}
        {...rest}
      >
        {children ?? renderIcon(icon)}
        {text != null && <span className="ts-icon-btn-text">{text}</span>}
      </button>
    );
    return tooltip ? (
      <Tooltip label={label} shortcut={shortcut} description={description}>
        {button}
      </Tooltip>
    ) : (
      button
    );
  }
);
IconButton.displayName = "IconButton";

type DropdownContent =
  | { menu: MenuItem[]; popover?: never }
  | {
      menu?: never;
      /** A custom panel (colour picker, gallery); `close` closes it. */
      popover: (close: () => void) => React.ReactNode;
    };

export type SplitButtonProps = {
  icon: IconSource;
  label: string;
  shortcut?: string;
  description?: React.ReactNode;
  /** The main part: runs the default (last used) action. */
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  /** Visible text next to the icon. */
  text?: React.ReactNode;
  /** Replaces the icon of the main part. */
  children?: React.ReactNode;
  className?: string;
  /** Accessible name of the arrow ("More options for Borders"). */
  arrowLabel?: string;
} & DropdownContent;

/**
 * Main action + arrow (Borders, Fill Color, Merge & Center): the main part
 * repeats the default, the arrow opens its menu or panel.
 */
export const SplitButton: React.FC<SplitButtonProps> = ({
  icon,
  label,
  shortcut,
  description,
  onClick,
  pressed,
  disabled,
  text,
  children,
  className,
  arrowLabel,
  menu,
  popover,
}) => {
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <Tooltip
      label={label}
      shortcut={shortcut}
      description={description}
      disabled={open}
    >
      <div
        ref={anchorRef}
        className={cx(
          "ts-split",
          pressed && "ts-pressed",
          open && "ts-open",
          className
        )}
      >
        <button
          type="button"
          className="ts-split-main"
          aria-label={label}
          aria-pressed={pressed === undefined ? undefined : pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children ?? renderIcon(icon)}
          {text != null && <span className="ts-icon-btn-text">{text}</span>}
        </button>
        <button
          type="button"
          className="ts-split-arrow"
          aria-label={arrowLabel ?? `${label}: more options`}
          aria-haspopup={menu ? "menu" : "dialog"}
          aria-expanded={open}
          disabled={disabled}
          onClick={(e) => {
            setByKeyboard(e.detail === 0);
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              setByKeyboard(true);
              setOpen(true);
            }
          }}
        >
          <ChevronDown size={12} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <DropdownPart
          open={open}
          setOpen={setOpen}
          anchorRef={anchorRef}
          autoFocus={byKeyboard}
          menu={menu}
          popover={popover}
          label={label}
        />
      </div>
    </Tooltip>
  );
};

const DropdownPart: React.FC<{
  open: boolean;
  setOpen: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  autoFocus: boolean;
  menu?: MenuItem[];
  popover?: (close: () => void) => React.ReactNode;
  label: string;
}> = ({ open, setOpen, anchorRef, autoFocus, menu, popover, label }) => {
  if (menu) {
    return (
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        items={menu}
        autoFocus={autoFocus}
        aria-label={label}
      />
    );
  }
  if (popover) {
    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        autoFocus={autoFocus}
        role="dialog"
        aria-label={label}
      >
        {popover(() => setOpen(false))}
      </Popover>
    );
  }
  return null;
};

export type LargeButtonProps = {
  icon: IconSource;
  /** The visible label under the icon (may wrap to two lines). */
  label: string;
  shortcut?: string;
  description?: React.ReactNode;
  /**
   * The action. With a `menu` / `popover` too, the button is split: the
   * top runs this, the bottom (label + arrow) opens the drop-down.
   */
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
} & Partial<DropdownContent>;

/**
 * Ribbon large button: 20px icon over its label (Paste, Conditional
 * Formatting, PivotTable, AutoSum). With a drop-down but no `onClick` the
 * whole button opens it; with both it is a split button (arrow below).
 */
export const LargeButton: React.FC<LargeButtonProps> = ({
  icon,
  label,
  shortcut,
  description,
  onClick,
  pressed,
  disabled,
  className,
  menu,
  popover,
}) => {
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const hasDropdown = !!(menu || popover);
  const split = hasDropdown && !!onClick;
  const toggle = (e: React.MouseEvent) => {
    setByKeyboard(e.detail === 0);
    setOpen((o) => !o);
  };
  const onArrowKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setByKeyboard(true);
      setOpen(true);
    }
  };
  const iconEl = renderIcon(icon, ICON_LARGE_SIZE);
  return (
    <Tooltip
      label={label}
      shortcut={shortcut}
      description={description}
      disabled={open}
    >
      <div
        ref={anchorRef}
        className={cx(
          "ts-large",
          split && "ts-large--split",
          pressed && "ts-pressed",
          open && "ts-open",
          className
        )}
      >
        {split ? (
          <>
            <button
              type="button"
              className="ts-large-main"
              aria-label={label}
              aria-pressed={pressed === undefined ? undefined : pressed}
              disabled={disabled}
              onClick={onClick}
            >
              {iconEl}
            </button>
            <button
              type="button"
              className="ts-large-arrow"
              aria-label={`${label}: more options`}
              aria-haspopup={menu ? "menu" : "dialog"}
              aria-expanded={open}
              disabled={disabled}
              onClick={toggle}
              onKeyDown={onArrowKey}
            >
              <span className="ts-large-label">{label}</span>
              <ChevronDown size={12} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ts-large-main ts-large-whole"
            aria-label={label}
            aria-pressed={pressed === undefined ? undefined : pressed}
            aria-haspopup={hasDropdown ? (menu ? "menu" : "dialog") : undefined}
            aria-expanded={hasDropdown ? open : undefined}
            disabled={disabled}
            onClick={hasDropdown ? toggle : onClick}
            onKeyDown={hasDropdown ? onArrowKey : undefined}
          >
            {iconEl}
            <span className="ts-large-label">
              {label}
              {hasDropdown && (
                <ChevronDown size={12} strokeWidth={ICON_STROKE} aria-hidden />
              )}
            </span>
          </button>
        )}
        {hasDropdown && (
          <DropdownPart
            open={open}
            setOpen={setOpen}
            anchorRef={anchorRef}
            autoFocus={byKeyboard}
            menu={menu}
            popover={popover}
            label={label}
          />
        )}
      </div>
    </Tooltip>
  );
};

export type MenuButtonProps = Omit<IconButtonProps, "onClick" | "popover"> & {
  /** Keep the chevron hidden (icon-only drop-down). */
  hideChevron?: boolean;
} & DropdownContent;

/** A small button that only opens a drop-down (Clear▾, Fill▾). */
export const MenuButton: React.FC<MenuButtonProps> = ({
  icon,
  label,
  shortcut,
  description,
  text,
  menu,
  popover,
  hideChevron,
  className,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Tooltip
        label={label}
        shortcut={shortcut}
        description={description}
        disabled={open}
      >
        <button
          ref={anchorRef}
          type="button"
          className={cx(
            "ts-icon-btn",
            "ts-menu-btn",
            text != null && "ts-icon-btn--text",
            open && "ts-open",
            className
          )}
          aria-label={label}
          aria-haspopup={menu ? "menu" : "dialog"}
          aria-expanded={open}
          disabled={disabled}
          onClick={(e) => {
            setByKeyboard(e.detail === 0);
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              setByKeyboard(true);
              setOpen(true);
            }
          }}
        >
          {renderIcon(icon)}
          {text != null && <span className="ts-icon-btn-text">{text}</span>}
          {!hideChevron && (
            <ChevronDown
              className="ts-menu-btn-chevron"
              size={12}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
          )}
        </button>
      </Tooltip>
      <DropdownPart
        open={open}
        setOpen={setOpen}
        anchorRef={anchorRef}
        autoFocus={byKeyboard}
        menu={menu}
        popover={popover}
        label={label}
      />
    </>
  );
};
