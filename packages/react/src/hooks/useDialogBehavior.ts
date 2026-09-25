import React, { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/** Close buttons: focused last, clicked by Escape when nothing else is. */
export const DIALOG_CLOSE_SELECTOR =
  "[data-dialog-close], .fortune-modal-dialog-icon-close, .fortune-fc-close";

/** Where a dialog can be grabbed to move it. */
const DRAG_HANDLE_SELECTOR = [
  "[data-dialog-drag-handle]",
  ".fortune-modal-dialog-header",
  ".fortune-fc-header",
  ".dialog-title",
  ".modal-title",
  ".title",
  ".condition-rules-title",
  ".fortune-sort-title",
].join(",");

const INTERACTIVE_SELECTOR =
  "input, select, textarea, button, a, label, [role=button], [role=tab], [contenteditable=true]";

/** Keyboard-focusable elements inside `root`, in tab order. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => {
      if (el.closest("[inert]")) return false;
      // roving tabindex (tab lists, radio groups): only the current one
      if (el.getAttribute("tabindex") === "-1") return false;
      // a radio group is one tab stop: its checked (or first) radio
      if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
        const group = Array.from(
          root.querySelectorAll<HTMLInputElement>('input[type="radio"]')
        ).filter((r) => r.name === el.name);
        const stop = group.find((r) => r.checked) ?? group[0];
        if (stop !== el) return false;
      }
      // rendered (not display:none / collapsed) and not hidden
      if (el.getClientRects().length === 0) return false;
      return getComputedStyle(el).visibility !== "hidden";
    }
  );
}

/**
 * Focus a dialog's first control (one marked autofocus first; its close
 * button last), or the dialog itself when it has none.
 */
export function focusFirstIn(root: HTMLElement) {
  const items = focusableIn(root);
  const target =
    items.find((el) => el.hasAttribute("autofocus")) ??
    items.find((el) => !el.matches(DIALOG_CLOSE_SELECTOR)) ??
    items[0];
  if (target) {
    target.focus({ preventScroll: true });
    return;
  }
  if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
  root.focus({ preventScroll: true });
}

type Options = {
  /**
   * Modal: focus that leaves the dialog for the workbook (a Tab past the
   * last control, or the sheet grabbing the keyboard) comes back to it.
   * Modeless dialogs (Find and Replace) only keep Tab inside.
   */
  modal?: boolean;
  /** Escape (not handled by a control inside) closes the dialog. */
  onEscape?: () => void;
  /** Element moved when a drag handle inside the root is dragged. */
  getDragTarget?: () => HTMLElement | null;
  /**
   * Focused on close when the element focused before the dialog opened is
   * gone (e.g. the context-menu item that opened it): usually the sheet.
   */
  fallbackFocus?: () => void;
  /** Off while the dialog is hidden (e.g. while picking a range). */
  enabled?: boolean;
};

function isInWorkbook(el: Element | null) {
  return !!el?.closest(".fortune-container");
}

/**
 * Dialog keyboard and mouse behaviour, as in Excel's dialogs: focus moves
 * into the dialog when it opens and goes back where it was when it closes,
 * Tab / Shift+Tab cycle through the dialog's controls, Escape closes it and
 * the title bar drags it.
 */
export function useDialogBehavior(
  ref: React.RefObject<HTMLElement | null>,
  {
    modal = true,
    onEscape,
    getDragTarget,
    fallbackFocus,
    enabled = true,
  }: Options = {}
) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const getDragTargetRef = useRef(getDragTarget);
  getDragTargetRef.current = getDragTarget;
  const fallbackFocusRef = useRef(fallbackFocus);
  fallbackFocusRef.current = fallbackFocus;

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return undefined;
    const previous = document.activeElement as HTMLElement | null;

    const focusFirst = () => focusFirstIn(root);
    // controls inside may already have focused themselves (autoFocus)
    if (!root.contains(document.activeElement)) focusFirst();

    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && root.contains(active);
      if (!inside && !(modal && isInWorkbook(active))) return;
      const items = focusableIn(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const index = inside ? items.indexOf(active!) : -1;
      let next: HTMLElement | null = null;
      if (index === -1) next = e.shiftKey ? items[items.length - 1] : items[0];
      else if (e.shiftKey && index === 0) next = items[items.length - 1];
      else if (!e.shiftKey && index === items.length - 1) next = items[0];
      if (next) {
        e.preventDefault();
        e.stopPropagation();
        next.focus({ preventScroll: true });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      const active = document.activeElement;
      const focusLost = !active || active === document.body;
      if (!(active && root.contains(active)) && !(modal && focusLost)) return;
      if (!onEscapeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      onEscapeRef.current();
    };

    // the sheet (or anything else in the workbook) must not take the
    // keyboard from a modal dialog
    const onFocusIn = (e: FocusEvent) => {
      if (!modal) return;
      const target = e.target as HTMLElement | null;
      if (!target || root.contains(target) || !isInWorkbook(target)) return;
      focusFirst();
    };

    let drag: {
      el: HTMLElement;
      startX: number;
      startY: number;
      baseX: number;
      baseY: number;
    } | null = null;
    const onMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      e.preventDefault();
      const { el } = drag;
      let x = drag.baseX + e.clientX - drag.startX;
      let y = drag.baseY + e.clientY - drag.startY;
      // keep the title bar reachable
      el.style.transform = `translate(${x}px, ${y}px)`;
      const rect = el.getBoundingClientRect();
      const margin = 40;
      if (rect.top < 0) y -= rect.top;
      if (rect.top > window.innerHeight - margin)
        y -= rect.top - (window.innerHeight - margin);
      if (rect.right < margin) x += margin - rect.right;
      if (rect.left > window.innerWidth - margin)
        x -= rect.left - (window.innerWidth - margin);
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.dataset.dialogOffset = `${x},${y}`;
    };
    const onMouseUp = () => {
      drag = null;
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const el = getDragTargetRef.current?.();
      if (!el || !target || !el.contains(target)) return;
      const handle = target.closest(DRAG_HANDLE_SELECTOR);
      if (!handle || !el.contains(handle)) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      e.preventDefault();
      const [baseX, baseY] = (el.dataset.dialogOffset ?? "0,0")
        .split(",")
        .map(Number);
      drag = { el, startX: e.clientX, startY: e.clientY, baseX, baseY };
      window.addEventListener("mousemove", onMouseMove, true);
      window.addEventListener("mouseup", onMouseUp, true);
    };

    document.addEventListener("keydown", onKeyDownCapture, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    root.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDownCapture, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("mousedown", onMouseDown);
      onMouseUp();
      // give the keyboard back unless the dialog's own close handler (or a
      // click elsewhere) already moved it
      const active = document.activeElement;
      if (!active || active === document.body || root.contains(active)) {
        // a dialog opened from the toolbar gives the keyboard back to the
        // sheet, as in Excel; others go back where they came from
        if (
          previous?.isConnected &&
          previous !== document.body &&
          !(fallbackFocusRef.current && previous.closest(".fortune-toolbar"))
        ) {
          previous.focus({ preventScroll: true });
        } else {
          fallbackFocusRef.current?.();
        }
      }
    };
  }, [ref, modal, enabled]);
}
