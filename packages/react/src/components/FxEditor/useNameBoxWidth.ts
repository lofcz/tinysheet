import React, { useCallback, useEffect, useRef, useState } from "react";

/** localStorage key of the Name Box width (px), shared by all workbooks. */
export const NAME_BOX_WIDTH_STORAGE_KEY = "tinysheet.nameBoxWidth";
export const NAME_BOX_DEFAULT_WIDTH = 104;
export const NAME_BOX_MIN_WIDTH = 56;
const NAME_BOX_MAX_WIDTH = 480;

function readStored() {
  try {
    const v = Number(window.localStorage?.getItem(NAME_BOX_WIDTH_STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch (e) {
    return null;
  }
}

function store(width: number) {
  try {
    window.localStorage?.setItem(NAME_BOX_WIDTH_STORAGE_KEY, String(width));
  } catch (e) {
    // private mode etc.: remembered for this session only
  }
}

/**
 * Width of the Name Box: dragging the grip on its right edge (pointer
 * capture) or the arrow keys on the focused grip change it, a double-click
 * restores the default. At most half of the formula bar, remembered in
 * localStorage like Excel remembers it.
 */
export function useNameBoxWidth(boxRef: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number>(
    () => readStored() ?? NAME_BOX_DEFAULT_WIDTH
  );
  const [max, setMax] = useState(NAME_BOX_MAX_WIDTH);
  const widthRef = useRef(width);
  widthRef.current = width;

  const maxWidth = useCallback(() => {
    const bar = boxRef.current?.closest(".fortune-fx-editor");
    const barWidth = bar?.getBoundingClientRect().width ?? 0;
    return barWidth > 0
      ? Math.max(
          NAME_BOX_MIN_WIDTH,
          Math.min(NAME_BOX_MAX_WIDTH, Math.round(barWidth / 2))
        )
      : NAME_BOX_MAX_WIDTH;
  }, [boxRef]);

  const clamp = useCallback(
    (w: number) =>
      Math.round(Math.min(maxWidth(), Math.max(NAME_BOX_MIN_WIDTH, w))),
    [maxWidth]
  );

  // a narrow window shrinks a wide Name Box (its stored width is kept)
  useEffect(() => {
    const update = () => setMax(maxWidth());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [maxWidth]);

  const commit = useCallback(
    (w: number) => {
      const next = clamp(w);
      setWidth(next);
      store(next);
    },
    [clamp]
  );

  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const { pointerId } = e;
      const startX = e.clientX;
      const start = widthRef.current;
      setMax(maxWidth());
      try {
        handle.setPointerCapture(pointerId);
      } catch (err) {
        // synthetic events without an active pointer
      }
      handle.classList.add("fortune-name-box-grip-active");
      const move = (ev: PointerEvent) => {
        setWidth(clamp(start + ev.clientX - startX));
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        handle.removeEventListener("lostpointercapture", end);
        handle.classList.remove("fortune-name-box-grip-active");
        store(widthRef.current);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
      handle.addEventListener("lostpointercapture", end);
    },
    [clamp, maxWidth]
  );

  const onResizeKey = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const step = e.shiftKey ? 32 : 8;
      if (e.key === "ArrowLeft") commit(widthRef.current - step);
      else if (e.key === "ArrowRight") commit(widthRef.current + step);
      else if (e.key === "Home") commit(NAME_BOX_MIN_WIDTH);
      else if (e.key === "End") commit(maxWidth());
      else return;
      e.preventDefault();
      e.stopPropagation();
    },
    [commit, maxWidth]
  );

  const reset = useCallback(() => {
    commit(NAME_BOX_DEFAULT_WIDTH);
  }, [commit]);

  return {
    width: Math.min(width, max),
    min: NAME_BOX_MIN_WIDTH,
    max,
    onResizeStart,
    onResizeKey,
    reset,
  };
}
