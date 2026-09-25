import type React from "react";

export type PointerDragHandlers = {
  /** every pointer move of the drag */
  onMove: (e: MouseEvent) => void;
  /** the button was released */
  onEnd: (e: MouseEvent) => void;
  /**
   * Esc, a cancelled pointer (pointercancel) or the window losing focus:
   * the drag must leave everything as it was.
   */
  onCancel?: () => void;
};

// The pointer of the latest pointer down: a drag started from a mousedown
// handler (which follows the pointerdown) captures that pointer.
let lastPointerId: number | null = null;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (ev) => {
      lastPointerId = ev.pointerId;
    },
    true
  );
}

/**
 * Track a drag started by a pointer (or mouse) down: pointer capture on the
 * pressed element (so moves and the release reach it wherever the pointer
 * goes, and it keeps its cursor), moves and the release of that pointer
 * only, Esc / pointercancel / window blur cancel. Returns a function that
 * ends the tracking without calling a handler.
 *
 * A drag started from a mousedown follows the mouse events (same integer
 * coordinates as its start); one started from a pointerdown follows the
 * pointer events (their compatibility mouse events may be suppressed).
 *
 * Every drag of the workbook's chrome and floating objects uses this (see
 * docs/DESIGN.md, "Interaction rules").
 */
export function trackPointerDrag(
  e: React.PointerEvent | React.MouseEvent | PointerEvent | MouseEvent,
  handlers: PointerDragHandlers,
  capture: Element | null = (e.currentTarget as Element | null) ?? null
) {
  const native = ("nativeEvent" in e ? e.nativeEvent : e) as
    | PointerEvent
    | MouseEvent;
  const fromPointer =
    "pointerId" in native && typeof native.pointerId === "number";
  const pointerId = fromPointer
    ? (native as PointerEvent).pointerId
    : lastPointerId;
  if (pointerId != null && capture) {
    try {
      capture.setPointerCapture(pointerId);
    } catch {
      // the pointer is already gone: its up / cancel ends the drag
    }
  }
  const moveType = fromPointer ? "pointermove" : "mousemove";
  const upType = fromPointer ? "pointerup" : "mouseup";
  const ours = (ev: MouseEvent) =>
    !fromPointer ||
    pointerId == null ||
    (ev as PointerEvent).pointerId === pointerId;
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    window.removeEventListener(moveType, move, true);
    window.removeEventListener(upType, up, true);
    window.removeEventListener("pointercancel", lost, true);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", cancel);
    if (pointerId != null && capture?.hasPointerCapture?.(pointerId)) {
      try {
        capture.releasePointerCapture(pointerId);
      } catch {
        // already released
      }
    }
  };
  function cancel() {
    if (done) return;
    stop();
    handlers.onCancel?.();
  }
  function move(ev: MouseEvent) {
    if (!done && ours(ev)) handlers.onMove(ev);
  }
  function up(ev: MouseEvent) {
    if (done || !ours(ev)) return;
    stop();
    handlers.onEnd(ev);
  }
  function lost(ev: PointerEvent) {
    if (pointerId == null || ev.pointerId === pointerId) cancel();
  }
  function key(ev: KeyboardEvent) {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    cancel();
  }
  // capture phase: the drag sees them before anything under the pointer
  window.addEventListener(moveType, move, true);
  window.addEventListener(upType, up, true);
  window.addEventListener("pointercancel", lost, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", cancel);
  return stop;
}
