import React, { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MenuItem, MenuList } from "./Menu";
import { portalRootFor, themeAt, VIEWPORT_EDGE } from "./floating";
import "./ui.css";
import "./pickers.css";

export type ContextMenuCloseReason =
  | "select"
  | "escape"
  | "outside"
  | "scroll"
  | "resize";

export type ContextMenuPopupProps = {
  /** Where the menu opens (viewport coordinates, e.g. the pointer). */
  x: number;
  y: number;
  items: MenuItem[];
  /**
   * Esc, a click / wheel / scroll outside, a resize, or an item picked.
   * Give the keyboard back to the sheet unless the reason is "outside"
   * (the click already moves the focus where it belongs).
   */
  onClose: (reason: ContextMenuCloseReason) => void;
  /**
   * An element of the workbook the menu belongs to: the menu is portaled
   * into that workbook so it inherits its theme (else into the body).
   */
  within?: HTMLElement | null;
  /** Focus the first item when opened (default true). */
  autoFocus?: boolean;
  /** Class of the menu list (`role="menu"`). */
  className?: string;
  /** Class of the floating panel around it. */
  popupClassName?: string;
  /** Class of the submenus. */
  submenuClassName?: string;
  minWidth?: number;
  "aria-label"?: string;
  /** Rendered above the list inside the panel (e.g. a title). */
  header?: React.ReactNode;
  /** Extra attributes of the floating panel (e.g. data-* for tests). */
  panelProps?: React.HTMLAttributes<HTMLDivElement> &
    Record<`data-${string}`, string | undefined>;
};

/** Top-left of a `w` × `h` menu opened at (x, y): flipped, then clamped. */
export function placeAtPoint(x: number, y: number, w: number, h: number) {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;
  const edge = VIEWPORT_EDGE;
  let left = x;
  let top = y;
  if (left + w > vw - edge) left = x - w >= edge ? x - w : vw - edge - w;
  if (top + h > vh - edge) top = y - h >= edge ? y - h : vh - edge - h;
  return {
    left: Math.round(Math.max(edge, left)),
    top: Math.round(Math.max(edge, top)),
  };
}

/**
 * A context menu at a point (right-click, Shift+F10): a `MenuList` in a
 * floating panel that opens right / below the point and flips to the other
 * side when it does not fit, stays inside the viewport, and closes on
 * Escape, a click, wheel or scroll outside, and a window resize. Submenus,
 * keyboard navigation and type-ahead come from `MenuList`.
 *
 *   {menu && <ContextMenuPopup x={menu.x} y={menu.y} items={items}
 *     within={containerRef.current} onClose={() => setMenu(null)} />}
 */
export const ContextMenuPopup: React.FC<ContextMenuPopupProps> = ({
  x,
  y,
  items,
  onClose,
  within,
  autoFocus = true,
  className,
  popupClassName,
  submenuClassName,
  minWidth = 200,
  header,
  panelProps,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // placed before paint, again whenever the content changes size
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    el.style.maxHeight = `${vh - 2 * VIEWPORT_EDGE}px`;
    const rect = el.getBoundingClientRect();
    const pos = placeAtPoint(x, y, rect.width, rect.height);
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
  });

  useLayoutEffect(() => {
    if (!autoFocus) return;
    const first = ref.current?.querySelector<HTMLElement>(
      '[role="menu"] > [role^="menuitem"]:not([aria-disabled="true"]), [role="menu"] > .ts-menu-custom [role="menuitem"]'
    );
    (first ?? ref.current)?.focus({ preventScroll: true });
    // a new position (keyboard re-open) focuses again
  }, [autoFocus, x, y]);

  useEffect(() => {
    const inside = (t: EventTarget | null) =>
      !!(t instanceof Node && ref.current?.contains(t));
    const onDown = (e: MouseEvent) => {
      if (!inside(e.target)) closeRef.current("outside");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current("escape");
      }
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) closeRef.current("scroll");
    };
    const onResize = () => closeRef.current("resize");
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScroll, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const root = portalRootFor(within ?? null);
  const inBody = root === document.body;
  return createPortal(
    <div
      {...panelProps}
      ref={ref}
      className={[
        "ts-popover",
        "ts-popover--menu",
        "ts-context-menu",
        inBody ? "ts-theme-root" : "",
        popupClassName ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-theme={inBody ? themeAt(within ?? null) : undefined}
      tabIndex={-1}
      style={{ left: x, top: y }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeRef.current("escape");
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {header}
      <MenuList
        items={items}
        onClose={() => closeRef.current("select")}
        minWidth={minWidth}
        className={className}
        submenuClassName={submenuClassName}
        aria-label={rest["aria-label"]}
      />
    </div>,
    root
  );
};

export default ContextMenuPopup;
