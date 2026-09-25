/**
 * Placement of floating UI (popovers, menus, submenus, tooltips): fixed
 * positioning next to an anchor, flipped and clamped so it always stays
 * inside the viewport.
 */
import { useLayoutEffect } from "react";

/** Space kept between floating UI and the window edge. */
export const VIEWPORT_EDGE = 4;

export type Placement =
  | "bottom-start"
  | "bottom-end"
  | "bottom"
  | "top-start"
  | "right-start"
  | "left-start";

type Rect = { left: number; top: number; right: number; bottom: number };

function viewport() {
  const w = document.documentElement.clientWidth || window.innerWidth;
  const h = document.documentElement.clientHeight || window.innerHeight;
  return { w, h };
}

/**
 * Where to put a `width` x `height` box next to `anchor` (viewport
 * coordinates). Flips to the other side when it does not fit and clamps
 * into the viewport.
 */
export function computePosition(
  anchor: Rect,
  width: number,
  height: number,
  placement: Placement = "bottom-start",
  offset = 4
) {
  const { w, h } = viewport();
  let left: number;
  let top: number;
  if (placement === "right-start" || placement === "left-start") {
    const rightSide = anchor.right + offset;
    const leftSide = anchor.left - offset - width;
    const preferRight = placement === "right-start";
    if (preferRight) {
      left = rightSide + width <= w - VIEWPORT_EDGE ? rightSide : leftSide;
    } else {
      left = leftSide >= VIEWPORT_EDGE ? leftSide : rightSide;
    }
    top = anchor.top - 4;
  } else {
    if (placement === "bottom-end") left = anchor.right - width;
    else if (placement === "bottom")
      left = (anchor.left + anchor.right) / 2 - width / 2;
    else left = anchor.left;
    const below = anchor.bottom + offset;
    const above = anchor.top - offset - height;
    const fitsBelow = below + height <= h - VIEWPORT_EDGE;
    if (placement === "top-start") {
      top = above >= VIEWPORT_EDGE || !fitsBelow ? above : below;
    } else {
      top = fitsBelow || above < VIEWPORT_EDGE ? below : above;
    }
  }
  left = Math.max(VIEWPORT_EDGE, Math.min(left, w - VIEWPORT_EDGE - width));
  top = Math.max(VIEWPORT_EDGE, Math.min(top, h - VIEWPORT_EDGE - height));
  return { left: Math.round(left), top: Math.round(top) };
}

/**
 * Keeps `floating` (position: fixed) next to `anchor` while `open`: placed
 * before paint, again on window resize and when the floating element
 * changes size. Also caps its height to the viewport.
 */
export function useFloatingPosition(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
  floating: React.RefObject<HTMLElement | null>,
  placement: Placement = "bottom-start",
  offset = 4
) {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const a = anchor.current;
      const f = floating.current;
      if (!a || !f) return;
      const { h } = viewport();
      f.style.maxHeight = `${h - 2 * VIEWPORT_EDGE}px`;
      const rect = f.getBoundingClientRect();
      const pos = computePosition(
        a.getBoundingClientRect(),
        rect.width,
        rect.height,
        placement,
        offset
      );
      f.style.left = `${pos.left}px`;
      f.style.top = `${pos.top}px`;
    };
    place();
    window.addEventListener("resize", place);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && floating.current) {
      observer = new ResizeObserver(place);
      observer.observe(floating.current);
    }
    return () => {
      window.removeEventListener("resize", place);
      observer?.disconnect();
    };
  }, [open, anchor, floating, placement, offset]);
}

/**
 * Where floating UI for `anchor` is portaled: the popover it is in (so a
 * click in a nested menu counts as inside its parent popover), else the
 * workbook (or dialog backdrop) it belongs to, so it inherits the theme
 * tokens; the body otherwise (the caller then adds `.ts-theme-root` and
 * `data-theme`).
 */
export function portalRootFor(anchor: HTMLElement | null): HTMLElement {
  return (
    (anchor?.closest(
      ".ts-popover, .fortune-modal-container, .fortune-container, .ts-theme-root"
    ) as HTMLElement | null) ?? document.body
  );
}

/** The `data-theme` in effect at `el` ("light" when none). */
export function themeAt(el: HTMLElement | null): string {
  return (
    (el?.closest("[data-theme]") as HTMLElement | null)?.dataset.theme ??
    "light"
  );
}
