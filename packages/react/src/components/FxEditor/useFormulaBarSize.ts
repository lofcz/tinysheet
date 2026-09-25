import {
  clampFormulaBarHeight,
  FORMULA_BAR_COLLAPSED_HEIGHT,
  FORMULA_BAR_DEFAULT_HEIGHT,
  setFormulaBarHeight,
  toggleFormulaBar,
} from "@lofcz/tinysheet-core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import WorkbookContext from "../../context";

/** localStorage key prefix of a workbook's formula bar state. */
export const FORMULA_BAR_STORAGE_KEY = "tinysheet.formulaBar";

type Stored = { expanded: boolean; height: number };

/** The largest expanded height: most of the window. */
function maxHeight() {
  return typeof window === "undefined"
    ? 600
    : Math.max(96, Math.round(window.innerHeight * 0.6));
}

/**
 * Expanded / collapsed state and height of the formula bar: Ctrl+Shift+U
 * toggles it, the bottom edge drags its height. The state lives in the
 * workbook's context and is remembered per workbook (keyed by its first
 * sheet id) in localStorage.
 */
export function useFormulaBarSize() {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const expanded = !!context.formulaBarExpanded;
  const height = context.formulaBarHeight ?? FORMULA_BAR_DEFAULT_HEIGHT;
  // live height while dragging (committed to the context on release)
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const storageKey = (() => {
    const ids = context.luckysheetfile
      .map((s) => s.id)
      .filter(Boolean)
      .sort();
    return ids.length ? `${FORMULA_BAR_STORAGE_KEY}.${ids[0]}` : null;
  })();

  // restore once per workbook
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!storageKey || restoredFor.current === storageKey) return;
    restoredFor.current = storageKey;
    let stored: Stored | null = null;
    try {
      const raw = window.localStorage?.getItem(storageKey);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      // unavailable or corrupt storage
    }
    if (!stored || typeof stored !== "object") return;
    setContext((ctx) => {
      ctx.formulaBarExpanded = !!stored!.expanded;
      ctx.formulaBarHeight = clampFormulaBarHeight(
        Number(stored!.height),
        maxHeight()
      );
    });
  }, [setContext, storageKey]);

  useEffect(() => {
    if (!storageKey || restoredFor.current !== storageKey) return;
    try {
      window.localStorage?.setItem(
        storageKey,
        JSON.stringify({ expanded, height } as Stored)
      );
    } catch (e) {
      // private mode etc.: remembered for this session only
    }
  }, [expanded, height, storageKey]);

  // the sheet below gets the rest of the height
  const shownHeight = dragHeight ?? (expanded ? height : null);
  const firstLayout = useRef(true);
  useLayoutEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    if (dragHeight != null) return;
    window.dispatchEvent(new Event("resize"));
  }, [shownHeight, dragHeight]);

  const toggle = useCallback(() => {
    setContext((ctx) => {
      toggleFormulaBar(ctx);
    });
  }, [setContext]);

  // Ctrl+Shift+U anywhere in the workbook, editing or not
  useEffect(() => {
    const container = refs.workbookContainer.current;
    if (!container) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "u"
      ) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    container.addEventListener("keydown", onKeyDown, true);
    return () => container.removeEventListener("keydown", onKeyDown, true);
  }, [refs.workbookContainer, toggle]);

  const commit = useCallback(
    (h: number) => {
      setDragHeight(null);
      setContext((ctx) => {
        setFormulaBarHeight(ctx, h, maxHeight());
      });
    },
    [setContext]
  );

  /** Pointer down on the bottom edge: drag the height. */
  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startY = e.clientY;
      const start = expanded ? height : FORMULA_BAR_COLLAPSED_HEIGHT;
      let current = start;
      const move = (ev: PointerEvent) => {
        current = Math.min(
          maxHeight(),
          Math.max(FORMULA_BAR_COLLAPSED_HEIGHT, start + ev.clientY - startY)
        );
        setDragHeight(current);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (current !== start) commit(current);
        else setDragHeight(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [commit, expanded, height]
  );

  /** Arrow keys on the focused edge resize by one line. */
  const onResizeKey = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      e.stopPropagation();
      const now = expanded ? height : FORMULA_BAR_COLLAPSED_HEIGHT;
      commit(now + (e.key === "ArrowDown" ? 20 : -20));
    },
    [commit, expanded, height]
  );

  return {
    expanded:
      dragHeight != null ? dragHeight > FORMULA_BAR_COLLAPSED_HEIGHT : expanded,
    height: shownHeight,
    toggle,
    onResizeStart,
    onResizeKey,
  };
}
