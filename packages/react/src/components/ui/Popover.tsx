import React, { useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import WorkbookContext from "../../context";
import { useToolbarPopup } from "../Toolbar/usePopup";
import {
  Placement,
  portalRootFor,
  themeAt,
  useFloatingPosition,
} from "./floating";
import "./ui.css";

export type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger: the popover opens next to it; clicks on it do not close. */
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: Placement;
  /** "panel" (10px padding, 12px radius) or "menu" (4px padding). */
  variant?: "panel" | "menu" | "bare";
  /**
   * false for a popover that holds drop-downs itself (a collapsed ribbon
   * group): it stays open while one of them opens.
   */
  exclusive?: boolean;
  /** Keyboard focus moves into the popover when it opens (menus). */
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  role?: string;
  "aria-label"?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
};

/**
 * A floating panel next to its trigger (colour pickers, galleries, menus,
 * a collapsed ribbon group). Portaled into the workbook so panes never clip
 * it, kept inside the viewport, and closed by a click outside, Escape
 * (focus goes back to the trigger), a window resize or when another toolbar
 * drop-down opens. Arrow keys move between its menu items.
 */
export const Popover: React.FC<PopoverProps> = ({
  open,
  onOpenChange,
  anchorRef,
  placement = "bottom-start",
  variant = "panel",
  exclusive = true,
  autoFocus,
  className,
  style,
  role,
  onKeyDown,
  children,
  ...rest
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const { refs } = useContext(WorkbookContext);
  const { onPopupKeyDown } = useToolbarPopup(open, onOpenChange, {
    containerRef: anchorRef,
    popupRef,
    triggerRef: anchorRef,
    exclusive,
    position: false,
    restoreFocus: () =>
      refs?.cellInput?.current?.focus({ preventScroll: true }),
  });
  useFloatingPosition(open, anchorRef, popupRef, placement);

  useEffect(() => {
    if (!open || !autoFocus) return;
    const el = popupRef.current;
    const first = el?.querySelector<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"]), button:not([disabled]), input, [tabindex="0"]'
    );
    (first ?? el)?.focus({ preventScroll: true });
  }, [open, autoFocus]);

  if (!open) return null;
  const anchor = anchorRef.current;
  const root = portalRootFor(anchor);
  const inBody = root === document.body;
  return createPortal(
    <div
      ref={popupRef}
      className={[
        "ts-popover",
        `ts-popover--${variant}`,
        inBody ? "ts-theme-root" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-theme={inBody ? themeAt(anchor) : undefined}
      style={style}
      role={role}
      tabIndex={-1}
      aria-label={rest["aria-label"]}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented) onPopupKeyDown(e);
      }}
      // the grid must not see these (selection, context menu)
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    root
  );
};

export default Popover;
