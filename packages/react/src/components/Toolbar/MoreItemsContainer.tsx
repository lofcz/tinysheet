import React, { CSSProperties, useLayoutEffect, useState } from "react";

// Space kept between the panel and the window edge.
const EDGE = 4;

/**
 * The "More" overflow panel: the toolbar items that do not fit, under the
 * More button (right-aligned to it, kept inside the window).
 */
const MoreItemsContaier = React.forwardRef<
  HTMLDivElement,
  { children?: React.ReactNode; label?: string }
>(({ children, label }, ref) => {
  const [style, setStyle] = useState<CSSProperties>({ right: 0 });
  useLayoutEffect(() => {
    const el = (ref as React.RefObject<HTMLDivElement | null>)?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const winW = document.documentElement.clientWidth || window.innerWidth;
    if (rect.left < EDGE) {
      setStyle({ right: rect.left - EDGE });
    } else if (rect.right > winW - EDGE) {
      setStyle({ right: rect.right - (winW - EDGE) });
    }
  }, [ref]);
  return (
    <div
      ref={ref}
      className="fortune-toolbar-more-container"
      style={style}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
});

export default MoreItemsContaier;
