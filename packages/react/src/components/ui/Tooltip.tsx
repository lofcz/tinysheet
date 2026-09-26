import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { portalRootFor, themeAt, useFloatingPosition } from "./floating";
import "./ui.css";

/** Hover delay before a tooltip shows (ms); moving between buttons is instant. */
const SHOW_DELAY = 450;
/** A tooltip shown less than this ago makes the next one show at once. */
const WARM_WINDOW = 600;
let lastHidden = 0;

export type TooltipProps = {
  /** Command name ("Bold"). */
  label: React.ReactNode;
  /** Keyboard shortcut ("Ctrl+B"), shown muted after the name. */
  shortcut?: string;
  /** One line of help under the name. */
  description?: React.ReactNode;
  /** Suppress (e.g. while the button's menu is open). */
  disabled?: boolean;
  placement?: "bottom" | "bottom-start" | "top-start" | "right-start";
  children: React.ReactElement;
};

/**
 * Excel-style screen tip: the command name, its shortcut and optional help,
 * after a short hover (or on keyboard focus). Wraps one element; the
 * tooltip is portaled so a clipping pane never cuts it off. Decorative for
 * assistive tech (the trigger carries its own `aria-label`).
 */
export const Tooltip: React.FC<TooltipProps> = ({
  label,
  shortcut,
  description,
  disabled,
  placement = "bottom",
  children,
}) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback(() => {
    clear();
    const warm = Date.now() - lastHidden < WARM_WINDOW;
    timer.current = setTimeout(() => setOpen(true), warm ? 0 : SHOW_DELAY);
  }, []);
  const hide = useCallback(() => {
    clear();
    setOpen((was) => {
      if (was) lastHidden = Date.now();
      return false;
    });
  }, []);
  useEffect(() => clear, []);
  useEffect(() => {
    if (disabled) hide();
  }, [disabled, hide]);

  useFloatingPosition(open && !disabled, anchorRef, tipRef, placement, 6);

  const anchor = anchorRef.current;
  const root = open ? portalRootFor(anchor) : null;
  return (
    <span
      ref={anchorRef}
      className="ts-tooltip-anchor"
      onMouseEnter={() => !disabled && show()}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={(e) => {
        // keyboard focus only (a click focuses too)
        if (!disabled && e.target.matches?.(":focus-visible")) show();
      }}
      onBlur={hide}
    >
      {children}
      {open &&
        !disabled &&
        root &&
        createPortal(
          <div
            ref={tipRef}
            className={`ts-tooltip${root === document.body ? " ts-theme-root" : ""}`}
            data-theme={root === document.body ? themeAt(anchor) : undefined}
            role="presentation"
            aria-hidden="true"
          >
            <div className="ts-tooltip-title">
              <span>{label}</span>
              {shortcut && (
                <span className="ts-tooltip-shortcut">{shortcut}</span>
              )}
            </div>
            {description && (
              <div className="ts-tooltip-description">{description}</div>
            )}
          </div>,
          root
        )}
    </span>
  );
};

export default Tooltip;
