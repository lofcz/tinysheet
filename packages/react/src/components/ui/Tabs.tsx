import React, { useCallback, useLayoutEffect, useRef } from "react";
import "./ui.css";

export type TabItem = {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  tabs: TabItem[];
  /** The selected tab id (`null`: none, e.g. a collapsed ribbon). */
  value: string | null;
  onChange: (id: string) => void;
  /** Double-click on a tab (the ribbon collapses / expands). */
  onTabDoubleClick?: (id: string) => void;
  /** Click on the tab that is already selected. */
  onActiveTabClick?: (id: string) => void;
  "aria-label"?: string;
  /** Ids of the tab panels: `${idPrefix}-panel-${id}` (aria-controls). */
  idPrefix?: string;
  /** Stretch the tabs to the full width (dialog tabs) or hug them. */
  fill?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Fika's segmented tabs: a surface track with an ink pill that slides to
 * the selected tab (420ms, cubic-bezier(0.16, 1, 0.3, 1)). role="tablist"
 * with roving focus: Left / Right / Home / End move and select.
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  value,
  onChange,
  onTabDoubleClick,
  onActiveTabClick,
  idPrefix,
  fill,
  size = "md",
  className,
  ...rest
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const tabEls = useRef(new Map<string, HTMLButtonElement>());
  const ready = useRef(false);

  const syncPill = useCallback(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const tab = value != null ? tabEls.current.get(value) : undefined;
    if (!tab || tab.offsetWidth === 0) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.opacity = "1";
    pill.style.width = `${tab.offsetWidth}px`;
    pill.style.height = `${tab.offsetHeight}px`;
    pill.style.transform = `translate3d(${tab.offsetLeft}px, ${tab.offsetTop}px, 0)`;
  }, [value]);

  useLayoutEffect(() => {
    syncPill();
    // no slide on the first placement
    if (!ready.current) {
      ready.current = true;
      const id = requestAnimationFrame(() =>
        pillRef.current?.setAttribute("data-ready", "")
      );
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [syncPill, tabs]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => syncPill());
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncPill]);

  const enabled = tabs.filter((t) => !t.disabled);
  const focusTab = (id: string) => {
    tabEls.current.get(id)?.focus();
    onChange(id);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = enabled.findIndex(
      (t) => tabEls.current.get(t.id) === e.target
    );
    if (index < 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % enabled.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next == null) return;
    e.preventDefault();
    e.stopPropagation();
    focusTab(enabled[next].id);
  };

  const focusable = value ?? enabled[0]?.id;
  return (
    <div
      ref={trackRef}
      className={[
        "ts-tabs",
        fill ? "ts-tabs--fill" : "",
        size === "sm" ? "ts-tabs--sm" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={rest["aria-label"]}
      onKeyDown={onKeyDown}
    >
      <div ref={pillRef} className="ts-tabs-pill" aria-hidden="true" />
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabEls.current.set(tab.id, el);
              else tabEls.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${tab.id}` : undefined}
            aria-selected={selected}
            disabled={tab.disabled}
            tabIndex={tab.id === focusable ? 0 : -1}
            className={`ts-tab${selected ? " ts-tab--selected" : ""}`}
            data-tab={tab.id}
            onClick={() => {
              if (selected) onActiveTabClick?.(tab.id);
              else onChange(tab.id);
            }}
            onDoubleClick={() => onTabDoubleClick?.(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
