import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Context,
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  getSheetIndex,
  locale,
  scrollSelectionIntoCorner,
  zoomToSelection,
} from "@lofcz/tinysheet-core";
import { Minus, Plus, Scan } from "lucide-react";
import WorkbookContext from "../../context";
import { IconButton } from "../ui/Button";
import { DropdownMenu, MenuItem, useMenuTrigger } from "../ui/Menu";
import {
  ZOOM_MAX_PERCENT,
  ZOOM_MIN_PERCENT,
  positionToZoom,
  stepZoom,
  zoomToPosition,
} from "./slider";
import "./index.css";

export {
  positionToZoom,
  zoomToPosition,
  stepZoom,
  ZOOM_MIN_PERCENT,
  ZOOM_MAX_PERCENT,
};

const PRESETS = [400, 200, 150, 100, 75, 50, 25, 10];

/**
 * Excel's zoom control at the right end of the status bar: − / + step by
 * 10%, the slider (100% in the middle, snapping there) and the percentage,
 * which opens a menu of preset zooms and Zoom to Selection.
 */
const ZoomControl: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { info, statusBar } = locale(context);
  const menu = useMenuTrigger();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pending = useRef<{ raf: number; value: number }>({
    raf: 0,
    value: 0,
  });

  const percent = Math.round((context.zoomRatio || 1) * 100);

  const zoomTo = useCallback(
    (val: number) => {
      val = parseFloat(val.toFixed(2));
      if (val > MAX_ZOOM_RATIO + 1e-9 || val < MIN_ZOOM_RATIO - 1e-9) {
        return;
      }
      setContext(
        (ctx: Context) => {
          const index = getSheetIndex(ctx, ctx.currentSheetId);
          if (index == null) {
            return;
          }
          if (ctx.zoomRatio === val) return;
          ctx.luckysheetfile[index].zoomRatio = val;
          ctx.zoomRatio = val;
        },
        { noHistory: true }
      );
    },
    [setContext]
  );

  /** Coalesces the zooms of a slider drag into one per frame. */
  const zoomSoon = useCallback(
    (value: number) => {
      pending.current.value = value;
      if (pending.current.raf) return;
      pending.current.raf = window.requestAnimationFrame(() => {
        pending.current.raf = 0;
        zoomTo(pending.current.value / 100);
      });
    },
    [zoomTo]
  );
  useEffect(
    () => () => {
      if (pending.current.raf) window.cancelAnimationFrame(pending.current.raf);
    },
    []
  );

  const zoomAt = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return positionToZoom((clientX - rect.left) / rect.width, rect.width);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.focus({ preventScroll: true });
      const value = zoomAt(e.clientX);
      if (value != null) zoomSoon(value);
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        // the pointer is gone
      }
      setDragging(true);
    },
    [zoomAt, zoomSoon]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const value = zoomAt(e.clientX);
      if (value != null) zoomSoon(value);
    },
    [dragging, zoomAt, zoomSoon]
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // already released
    }
  }, []);

  const onSliderKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        next = stepZoom(percent, -1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        next = stepZoom(percent, 1);
      } else if (e.key === "Home") next = ZOOM_MIN_PERCENT;
      else if (e.key === "End") next = ZOOM_MAX_PERCENT;
      if (next == null) return;
      e.preventDefault();
      e.stopPropagation();
      zoomTo(next / 100);
    },
    [percent, zoomTo]
  );

  const items: MenuItem[] = [
    ...PRESETS.map((p): MenuItem => ({
      id: `zoom-${p}`,
      label: `${p}%`,
      checked: p === percent,
      radio: true,
      onSelect: () => zoomTo(p / 100),
    })),
    { type: "separator" },
    {
      id: "zoom-selection",
      label: statusBar.zoomToSelection,
      icon: Scan,
      onSelect: () => {
        setContext((ctx: Context) => {
          zoomToSelection(ctx);
        });
        // scroll again once the grid is laid out at the new zoom
        window.setTimeout(
          () =>
            setContext(
              (ctx: Context) => {
                scrollSelectionIntoCorner(ctx);
              },
              { noHistory: true }
            ),
          80
        );
      },
    },
  ];

  const pos = zoomToPosition(percent);

  return (
    <div
      role="group"
      aria-label={info.zoomSettings}
      className="fortune-zoom-container"
    >
      <IconButton
        size="sm"
        icon={Minus}
        label={info.zoomOut}
        className="fortune-zoom-button"
        onClick={(e) => {
          e.stopPropagation();
          zoomTo(stepZoom(percent, -1) / 100);
        }}
      />
      <div
        className={`fortune-zoom-slider${dragging ? " dragging" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label={statusBar.zoom}
        aria-valuemin={ZOOM_MIN_PERCENT}
        aria-valuemax={ZOOM_MAX_PERCENT}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => setDragging(false)}
        onDoubleClick={() => zoomTo(1)}
        onKeyDown={onSliderKey}
      >
        <div className="fortune-zoom-slider-track" ref={trackRef}>
          <div className="fortune-zoom-slider-tick" />
          <div
            className="fortune-zoom-slider-thumb"
            style={{ left: `${(pos * 100).toFixed(3)}%` }}
          />
        </div>
      </div>
      <IconButton
        size="sm"
        icon={Plus}
        label={info.zoomIn}
        className="fortune-zoom-button"
        onClick={(e) => {
          e.stopPropagation();
          zoomTo(stepZoom(percent, 1) / 100);
        }}
      />
      <button
        type="button"
        className={`fortune-zoom-ratio-current${menu.open ? " open" : ""}`}
        aria-label={`${info.zoomLevel}: ${percent}%`}
        {...menu.triggerProps}
      >
        {percent}%
      </button>
      <DropdownMenu
        open={menu.open}
        onOpenChange={menu.setOpen}
        anchorRef={menu.anchorRef}
        items={items}
        placement="top-start"
        autoFocus={menu.byKeyboard}
        minWidth={160}
        className="fortune-zoom-ratio-menu"
        aria-label={info.zoomLevel}
      />
    </div>
  );
};

export default ZoomControl;
