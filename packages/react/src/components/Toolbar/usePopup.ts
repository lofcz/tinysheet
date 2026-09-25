import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// Space kept between a drop-down and the window edge.
const EDGE = 4;

/** Close callback of the toolbar drop-down that is open, if any. */
let closeOpenPopup: (() => void) | null = null;

const MENU_ITEM_SELECTOR =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

/** Menu items of an open drop-down, in document order. */
export function popupItems(popup: HTMLElement | null): HTMLElement[] {
  if (!popup) return [];
  return Array.from(
    popup.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)
  ).filter(
    (el) =>
      el.getAttribute("aria-disabled") !== "true" &&
      (el.getClientRects().length > 0 ||
        // jsdom has no layout
        typeof navigator === "undefined" ||
        /jsdom/.test(navigator.userAgent))
  );
}

type Options = {
  /** The drop-down's trigger(s) and popup: clicks inside keep it open. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** The popup element (arrow keys move between its menu items). */
  popupRef: React.RefObject<HTMLElement | null>;
  /** Focused again when Escape closes the drop-down. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Called when the drop-down closed and the focus went with it. */
  restoreFocus?: () => void;
  /**
   * false for a panel that holds drop-downs itself (the "More" overflow):
   * it stays open while one of them opens, and Escape closes the inner
   * drop-down first.
   */
  exclusive?: boolean;
  /**
   * false when the caller positions the popup itself (e.g. a portaled,
   * fixed-position popover, see ui/Popover.tsx).
   */
  position?: boolean;
};

/** Whether `node` is inside the drop-down: its trigger(s) or its popup. */
function isInside(
  node: Node | null,
  containerRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>
) {
  if (!node) return false;
  return !!(
    containerRef.current?.contains(node) || popupRef.current?.contains(node)
  );
}

/** Close the toolbar drop-down that is open, if any (e.g. on tab switch). */
export function closeOpenToolbarPopup() {
  closeOpenPopup?.();
}

/**
 * Toolbar drop-down behaviour, as in Excel's ribbon and Google Sheets'
 * toolbar: only one drop-down is open at a time, a click outside, Escape, a
 * window resize closes it, arrow keys move through its items, and
 * the keyboard goes back to the sheet once an item was picked.
 *
 * Returns `onTriggerClick(e, toggle)`: call it from the trigger's click
 * handler; a keyboard activation (Enter / Space) also focuses the first
 * item of the opened menu.
 */
export function useToolbarPopup(
  open: boolean,
  setOpen: (open: boolean) => void,
  {
    containerRef,
    popupRef,
    triggerRef,
    restoreFocus,
    exclusive = true,
    position = true,
  }: Options
) {
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;
  const focusFirstItem = useRef(false);
  const closedByEscape = useRef(false);

  // Keep the menu inside the window: it opens under its button and moves
  // left when it would overflow the right edge (never past the left edge).
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!open || !exclusive || !position || !popup) return;
    popup.style.left = "";
    const rect = popup.getBoundingClientRect();
    const winW = document.documentElement.clientWidth || window.innerWidth;
    const overflow = rect.right - (winW - EDGE);
    if (overflow > 0) {
      const shift = Math.min(overflow, Math.max(0, rect.left - EDGE));
      const base = parseFloat(getComputedStyle(popup).left) || 0;
      popup.style.left = `${base - shift}px`;
    }
  }, [open, exclusive, position, popupRef]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpenRef.current(false);
    if (exclusive) {
      if (closeOpenPopup && closeOpenPopup !== close) closeOpenPopup();
      closeOpenPopup = close;
    }
    closedByEscape.current = false;
    // Escape returns to the button that opened it (the arrow or the main
    // part of a split button)
    const opener = document.activeElement as HTMLElement | null;
    const trigger =
      opener &&
      containerRef.current?.contains(opener) &&
      !popupRef.current?.contains(opener)
        ? opener
        : triggerRef?.current;

    if (focusFirstItem.current) {
      focusFirstItem.current = false;
      const items = popupItems(popupRef.current);
      const checked = items.find(
        (el) => el.getAttribute("aria-checked") === "true"
      );
      (
        checked ??
        items[0] ??
        popupRef.current?.querySelector<HTMLElement>('[tabindex="0"]')
      )?.focus({ preventScroll: true });
    }

    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!isInside(e.target as Node, containerRef, popupRef)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // an inner drop-down (open after this panel) closes first
      if (!exclusive && closeOpenPopup) return;
      const target = e.target as Element | null;
      // an open submenu closes first (ui/Menu.tsx)
      if (target?.closest?.(".ts-submenu")) return;
      // a dialog opened from the menu takes Escape itself
      if (
        target?.closest?.('[role="dialog"], .fortune-modal-container') &&
        !isInside(target, containerRef, popupRef)
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      closedByEscape.current = true;
      close();
    };
    const onResize = () => close();
    // the keyboard left it: Tab past its end, or a dialog opened from it
    const onFocusIn = (e: FocusEvent) => {
      if (!containerRef.current) return;
      if (!isInside(e.target as Node, containerRef, popupRef)) close();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      if (closeOpenPopup === close) closeOpenPopup = null;
      const active = document.activeElement;
      if (closedByEscape.current) {
        // a wrapper anchor (split / large ribbon buttons) is not focusable:
        // its drop-down button is
        const focusable =
          trigger && !trigger.matches("button, [tabindex], input")
            ? (trigger.querySelector<HTMLElement>("[aria-haspopup]") ?? trigger)
            : trigger;
        focusable?.focus({ preventScroll: true });
      } else if (!active || active === document.body) {
        // the focused item was removed with the popup
        restoreFocusRef.current?.();
      }
    };
  }, [open, containerRef, popupRef, triggerRef, exclusive]);

  /** Arrow keys / Home / End move between the popup's menu items. */
  const onPopupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      const items = popupItems(popupRef.current);
      if (items.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const index = items.indexOf(
        (target.closest(MENU_ITEM_SELECTOR) as HTMLElement) ?? target
      );
      let next = 0;
      if (e.key === "End") next = items.length - 1;
      else if (e.key === "ArrowDown")
        next = index < 0 ? 0 : (index + 1) % items.length;
      else if (e.key === "ArrowUp")
        next =
          index < 0
            ? items.length - 1
            : (index - 1 + items.length) % items.length;
      items[next].focus({ preventScroll: true });
    },
    [popupRef]
  );

  /**
   * Trigger click: toggles through `toggle`; a keyboard click (detail 0)
   * then moves the focus into the menu.
   */
  const onTriggerClick = useCallback(
    (e: React.MouseEvent, toggle: () => void) => {
      if (!open && e.detail === 0) focusFirstItem.current = true;
      toggle();
    },
    [open]
  );

  /** ArrowDown on a closed trigger opens the menu, as on a menu button. */
  const onTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        e.stopPropagation();
        focusFirstItem.current = true;
        setOpenRef.current(true);
      } else if (e.key === "ArrowDown" && open) {
        e.preventDefault();
        e.stopPropagation();
        popupItems(popupRef.current)[0]?.focus({ preventScroll: true });
      }
    },
    [open, popupRef]
  );

  return { onPopupKeyDown, onTriggerClick, onTriggerKeyDown };
}
