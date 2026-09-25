import React, { useEffect, useMemo, useRef } from "react";
import { MenuItem, MenuList } from "./Menu";
import { Tooltip } from "./Tooltip";
import "./ui.css";
import "./pickers.css";

export type GalleryItem = {
  id: string;
  /** Accessible name and screen tip ("Blue, Table Style Medium 2"). */
  label: string;
  /** The tile (a table / cell style / rule preview). */
  preview: React.ReactNode;
  /** Section heading the item is listed under ("Light", "Good, Bad…"). */
  group?: string;
  /** Second line of the screen tip. */
  description?: string;
  disabled?: boolean;
};

export type GalleryProps = {
  items: GalleryItem[];
  /** A tile was picked (click, Enter / Space). */
  onPick: (id: string) => void;
  /**
   * Hover / keyboard focus on a tile (live preview), `null` when the
   * pointer / focus leaves the gallery.
   */
  onPreview?: (id: string | null) => void;
  /** The current one (outlined). */
  selectedId?: string;
  /** Tiles per row (default 7); arrow keys move in this grid. */
  columns?: number;
  /** Tile size (px, default 48 × 38). */
  itemWidth?: number;
  itemHeight?: number;
  /** Commands under the tiles (New Table Style…, Clear…). */
  footer?: MenuItem[];
  /** After a pick or a footer command (close the popover). */
  onClose?: () => void;
  /** Focus the selected (or first) tile on mount. */
  autoFocus?: boolean;
  /** Scroll height of the tile area (default none). */
  maxHeight?: number;
  className?: string;
  "aria-label"?: string;
};

/**
 * Excel's galleries (Format as Table, Cell Styles, conditional formatting
 * presets): tiles grouped under headings, a screen tip naming each tile,
 * hover / focus preview (`onPreview`), arrow-key navigation, and optional
 * menu commands underneath.
 *
 *   <Gallery items={styles.map((s) => ({ id: s.id, label: s.name,
 *     group: s.group, preview: <Swatch s={s} /> }))}
 *     onPick={apply} onClose={close} />
 */
export const Gallery: React.FC<GalleryProps> = ({
  items,
  onPick,
  onPreview,
  selectedId,
  columns = 7,
  itemWidth = 48,
  itemHeight = 38,
  footer,
  onClose,
  autoFocus,
  maxHeight,
  className,
  ...rest
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const out: { name: string | undefined; items: GalleryItem[] }[] = [];
    items.forEach((item) => {
      const last = out[out.length - 1];
      if (last && last.name === item.group) last.items.push(item);
      else out.push({ name: item.group, items: [item] });
    });
    return out;
  }, [items]);

  const focusId =
    items.find((i) => i.id === selectedId && !i.disabled)?.id ??
    items.find((i) => !i.disabled)?.id;

  useEffect(() => {
    if (!autoFocus) return;
    rootRef.current
      ?.querySelector<HTMLElement>('.ts-gallery-item[tabindex="0"]')
      ?.focus({ preventScroll: true });
  }, [autoFocus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tiles = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(
        ".ts-gallery-item:not([disabled])"
      ) ?? []
    );
    const i = tiles.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const current = tiles[i];
    const rect = (el: HTMLElement) => el.getBoundingClientRect();
    // rows by DOM geometry (sections may be shorter than `columns`);
    // jsdom has no layout: fall back to the column count
    const hasLayout = rect(current).width > 0;
    let next = -1;
    if (e.key === "ArrowRight") next = i + 1;
    else if (e.key === "ArrowLeft") next = i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tiles.length - 1;
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const down = e.key === "ArrowDown";
      if (!hasLayout) next = i + (down ? columns : -columns);
      else {
        const r = rect(current);
        const cx = r.left + r.width / 2;
        let best = -1;
        let bestScore = Infinity;
        tiles.forEach((t, j) => {
          const tr = rect(t);
          const dy = down ? tr.top - r.bottom : r.top - tr.bottom;
          if (dy < -1) return;
          const score = dy * 1000 + Math.abs(tr.left + tr.width / 2 - cx);
          if (score < bestScore) {
            bestScore = score;
            best = j;
          }
        });
        next = best;
      }
      if (next < 0 || next >= tiles.length) {
        // below the last row: the footer commands
        if (down && footer?.length) {
          const first = rootRef.current?.querySelector<HTMLElement>(
            '.ts-gallery-footer [role^="menuitem"]:not([aria-disabled="true"])'
          );
          if (first) {
            e.preventDefault();
            e.stopPropagation();
            first.focus({ preventScroll: true });
          }
        }
        return;
      }
    } else return;
    e.preventDefault();
    e.stopPropagation();
    tiles[Math.max(0, Math.min(tiles.length - 1, next))]?.focus({
      preventScroll: true,
    });
  };

  return (
    <div
      ref={rootRef}
      className={`ts-gallery${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={rest["aria-label"]}
      style={
        {
          "--ts-gallery-w": `${itemWidth}px`,
          "--ts-gallery-h": `${itemHeight}px`,
          "--ts-gallery-cols": columns,
        } as React.CSSProperties
      }
      onMouseLeave={() => onPreview?.(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onPreview?.(null);
        }
      }}
    >
      <div
        className="ts-gallery-scroll"
        style={maxHeight ? { maxHeight } : undefined}
        onKeyDown={onKeyDown}
      >
        {groups.map((g, gi) => (
          <div key={g.name ?? `g${gi}`} className="ts-gallery-section">
            {g.name && <div className="ts-gallery-heading">{g.name}</div>}
            <div className="ts-gallery-grid">
              {g.items.map((item) => (
                <Tooltip
                  key={item.id}
                  label={item.label}
                  description={item.description}
                  placement="bottom"
                >
                  <button
                    type="button"
                    className={`ts-gallery-item${
                      item.id === selectedId ? " ts-gallery-item--selected" : ""
                    }`}
                    data-gallery-id={item.id}
                    aria-label={item.label}
                    aria-pressed={item.id === selectedId}
                    disabled={item.disabled}
                    tabIndex={item.id === focusId ? 0 : -1}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => onPreview?.(item.id)}
                    onFocus={() => onPreview?.(item.id)}
                    onClick={() => {
                      onPreview?.(null);
                      onPick(item.id);
                      onClose?.();
                    }}
                  >
                    {item.preview}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
      {footer && footer.length > 0 && (
        <div className="ts-gallery-footer">
          <div className="ts-menu-separator" role="separator" />
          <MenuList items={footer} onClose={() => onClose?.()} />
        </div>
      )}
    </div>
  );
};

export default Gallery;
