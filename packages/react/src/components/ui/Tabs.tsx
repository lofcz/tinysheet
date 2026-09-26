import React, { useCallback, useLayoutEffect, useRef } from "react";
import "./ui.css";

export type TabItem = {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
  /**
   * A contextual tab (Excel's Chart Design / Format while a chart is
   * selected): consecutive tabs of one context share an accented header
   * band labelled `label`.
   */
  contextual?: { id: string; label: string };
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
  const bandEls = useRef(new Map<string, HTMLDivElement>());
  const captionEls = useRef(new Map<string, HTMLSpanElement>());
  const ready = useRef(false);

  // contextual groups: runs of tabs with the same context id
  const bands: { id: string; label: string; tabs: string[] }[] = [];
  tabs.forEach((tab) => {
    if (!tab.contextual) return;
    const last = bands[bands.length - 1];
    const prev = tabs[tabs.indexOf(tab) - 1];
    if (last && prev?.contextual?.id === tab.contextual.id)
      last.tabs.push(tab.id);
    else
      bands.push({
        id: tab.contextual.id,
        label: tab.contextual.label,
        tabs: [tab.id],
      });
  });
  const bandKey = bands.map((b) => `${b.id}:${b.tabs.join(",")}`).join("|");
  const selectedContextual = tabs.find((t) => t.id === value)?.contextual;

  const syncPill = useCallback(() => {
    // the accented band behind each contextual group
    bandEls.current.forEach((band, key) => {
      const ids = key.split(",");
      const els = ids
        .map((id) => tabEls.current.get(id))
        .filter((el): el is HTMLButtonElement => !!el && el.offsetWidth > 0);
      if (els.length === 0) {
        band.style.opacity = "0";
        return;
      }
      const caption = captionEls.current.get(key);
      const left = caption ? caption.offsetLeft : els[0].offsetLeft;
      const right =
        els[els.length - 1].offsetLeft + els[els.length - 1].offsetWidth;
      band.style.opacity = "1";
      band.style.width = `${right - left}px`;
      band.style.height = `${els[0].offsetHeight}px`;
      band.style.transform = `translate3d(${left}px, ${els[0].offsetTop}px, 0)`;
    });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, bandKey]);

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
      {bands.map((band) => (
        <div
          key={`${band.id}:${band.tabs.join(",")}`}
          ref={(el) => {
            const key = band.tabs.join(",");
            if (el) bandEls.current.set(key, el);
            else bandEls.current.delete(key);
          }}
          className="ts-tabs-context"
          data-context={band.id}
          aria-hidden="true"
        />
      ))}
      <div
        ref={pillRef}
        className={`ts-tabs-pill${
          selectedContextual ? " ts-tabs-pill--contextual" : ""
        }`}
        aria-hidden="true"
      />
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const band = bands.find((b) => b.tabs[0] === tab.id);
        return (
          <React.Fragment key={tab.id}>
            {band && (
              <span
                ref={(el) => {
                  const key = band.tabs.join(",");
                  if (el) captionEls.current.set(key, el);
                  else captionEls.current.delete(key);
                }}
                className="ts-tabs-context-caption"
                data-context={band.id}
                aria-hidden="true"
              >
                {band.label}
              </span>
            )}
            <button
              ref={(el) => {
                if (el) tabEls.current.set(tab.id, el);
                else tabEls.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
              aria-controls={
                idPrefix ? `${idPrefix}-panel-${tab.id}` : undefined
              }
              aria-selected={selected}
              disabled={tab.disabled}
              tabIndex={tab.id === focusable ? 0 : -1}
              className={`ts-tab${selected ? " ts-tab--selected" : ""}${
                tab.contextual ? " ts-tab--contextual" : ""
              }`}
              data-tab={tab.id}
              data-context={tab.contextual?.id}
              title={tab.contextual?.label}
              onClick={() => {
                if (selected) onActiveTabClick?.(tab.id);
                else onChange(tab.id);
              }}
              onDoubleClick={() => onTabDoubleClick?.(tab.id)}
            >
              {tab.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Tabs;
