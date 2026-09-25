import _ from "lodash";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  updateCell,
  addSheet,
  locale,
  moveSheet,
  moveSheets,
  duplicateSheet,
  getGroupedSheetIds,
  isEditingFormula,
  isWorkbookStructureProtected,
} from "@lofcz/tinysheet-core";
// @ts-ignore
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import "./index.css";
import SheetItem from "./SheetItem";
import ZoomControl from "../ZoomControl";
import { activateOnKey } from "../Toolbar/Button";
import { registerProtectionFeatures } from "../Protection";
import { activateSheetTab, restoreSheetView } from "./activate";

// protection and View options plug into the toolbar and cell area through
// the registries (an explicit call: the package is side-effect free)
registerProtectionFeatures();

/** Pixels the pointer must travel before a press on a tab becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Width of the zone at each end of the tab strip that scrolls it. */
const AUTO_SCROLL_EDGE = 28;
const AUTO_SCROLL_MAX_SPEED = 14;

type DragGesture = {
  pointerId: number;
  sheetId: string;
  el: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  dragging: boolean;
  /** insertion point: the sheet the dragged one goes before (null: end) */
  beforeId: string | null | undefined;
  speed: number;
  raf: number;
  cleanup: () => void;
};

/** The tabs shown in the strip (hidden sheets are not), left to right. */
function visibleTabs(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(".luckysheet-sheets-item")
  ).filter((el) => el.getClientRects().length > 0);
}

/** Swallows the click that ends a drag (it would activate or group). */
function suppressNextClick() {
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => {
    window.removeEventListener("click", stop, { capture: true });
  }, 0);
}

const SheetTab: React.FC = () => {
  const { context, setContext, settings, refs } = useContext(WorkbookContext);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    overflow: false,
    atStart: true,
    atEnd: true,
  });
  const [drag, setDrag] = useState<{
    sheetId: string;
    indicator: number | null;
  } | null>(null);
  const gesture = useRef<DragGesture | null>(null);
  const { info } = locale(context);

  // the latest values for the window listeners of a drag
  const latest = useRef({ context, setContext, refs });
  latest.current = { context, setContext, refs };

  const scrollDelta = 150;

  const updateScrollState = useCallback(() => {
    const el = tabContainerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = {
      overflow: max > 2,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= max - 1,
    };
    setScrollState((prev) =>
      prev.overflow === next.overflow &&
      prev.atStart === next.atStart &&
      prev.atEnd === next.atEnd
        ? prev
        : next
    );
  }, []);

  const scrollBy = useCallback((amount: number) => {
    tabContainerRef.current?.scrollBy({
      left: amount,
      behavior: "smooth",
    });
  }, []);

  // the view (scroll, selection) of the sheet being shown comes back
  const restoredFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (restoredFor.current === context.currentSheetId) return;
    restoredFor.current = context.currentSheetId;
    setContext((draftCtx) => {
      restoreSheetView(draftCtx);
    });
  }, [context.currentSheetId, setContext]);

  const tabsKey = _.sortBy(context.luckysheetfile, (s) => Number(s.order))
    .map((s) => `${s.id}:${s.hide === 1 ? 0 : 1}:${s.name}:${s.color ?? ""}`)
    .join("|");

  useLayoutEffect(() => {
    updateScrollState();
  }, [tabsKey, updateScrollState]);

  useEffect(() => {
    const el = tabContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => updateScrollState());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollState]);

  // the active tab is always scrolled into view (switching sheets with
  // Ctrl+PageDown, adding, moving or unhiding a sheet)
  useLayoutEffect(() => {
    const container = tabContainerRef.current;
    if (!container || gesture.current?.dragging) return;
    const tab = visibleTabs(container).find(
      (el) => el.dataset.sheetId === context.currentSheetId
    );
    if (!tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < container.scrollLeft) {
      container.scrollLeft = left;
    } else if (right > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = right - container.clientWidth;
    }
    updateScrollState();
  }, [context.currentSheetId, tabsKey, updateScrollState]);

  const onAddSheetClick = useCallback(
    () =>
      setTimeout(() => {
        setContext(
          (draftCtx) => {
            if (draftCtx.luckysheetCellUpdate.length > 0) {
              updateCell(
                draftCtx,
                draftCtx.luckysheetCellUpdate[0],
                draftCtx.luckysheetCellUpdate[1],
                refs.cellInput.current!
              );
            }
            const previous = draftCtx.currentSheetId;
            const ordered = _.sortBy(draftCtx.luckysheetfile, (s) =>
              Number(s.order)
            );
            const at = ordered.findIndex((s) => s.id === previous);
            const count = draftCtx.luckysheetfile.length;
            addSheet(draftCtx, settings);
            if (draftCtx.luckysheetfile.length === count) return;
            const added =
              draftCtx.luckysheetfile[draftCtx.luckysheetfile.length - 1];
            // Excel inserts the new sheet right after the active one
            if (added?.id && at >= 0) {
              moveSheet(draftCtx, added.id, ordered[at + 1]?.id ?? null);
            }
            if (draftCtx.currentSheetId !== previous) {
              draftCtx.sheetScrollRecord[previous] = {
                scrollLeft: draftCtx.scrollLeft,
                scrollTop: draftCtx.scrollTop,
                luckysheet_select_status: draftCtx.luckysheet_select_status,
                luckysheet_select_save: draftCtx.luckysheet_select_save,
                luckysheet_selection_range: draftCtx.luckysheet_selection_range,
              };
              draftCtx.groupedSheetIds = undefined;
              draftCtx.zoomRatio = 1;
            }
          },
          { addSheetOp: true }
        );
      }),
    [refs.cellInput, setContext, settings]
  );

  /* ---- reordering tabs by dragging ------------------------------------ */

  /** Finds the insertion point under `x` and draws the indicator there. */
  const updateDrop = useCallback((x: number) => {
    const g = gesture.current;
    const container = tabContainerRef.current;
    if (!g || !container) return;
    const tabs = visibleTabs(container);
    if (tabs.length === 0) return;
    let slot = tabs.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return x < r.left + r.width / 2;
    });
    if (slot < 0) slot = tabs.length;
    g.beforeId = slot < tabs.length ? tabs[slot].dataset.sheetId! : null;
    const last = tabs[tabs.length - 1];
    // kept inside the strip, which clips its content
    const indicator = Math.min(
      Math.max(
        1,
        slot < tabs.length
          ? tabs[slot].offsetLeft
          : last.offsetLeft + last.offsetWidth
      ),
      container.scrollWidth - 1
    );
    setDrag((prev) =>
      prev?.sheetId === g.sheetId && prev.indicator === indicator
        ? prev
        : { sheetId: g.sheetId, indicator }
    );
    // near (or past) an end of the strip: scroll it
    const rect = container.getBoundingClientRect();
    let speed = 0;
    if (x < rect.left + AUTO_SCROLL_EDGE && container.scrollLeft > 0) {
      speed = -Math.min(
        AUTO_SCROLL_MAX_SPEED,
        Math.ceil((rect.left + AUTO_SCROLL_EDGE - x) / 3)
      );
    } else if (
      x > rect.right - AUTO_SCROLL_EDGE &&
      container.scrollLeft < container.scrollWidth - container.clientWidth
    ) {
      speed = Math.min(
        AUTO_SCROLL_MAX_SPEED,
        Math.ceil((x - (rect.right - AUTO_SCROLL_EDGE)) / 3)
      );
    }
    g.speed = speed;
    if (speed !== 0 && !g.raf) {
      const tick = () => {
        const cur = gesture.current;
        const c = tabContainerRef.current;
        if (!cur || !c || !cur.dragging || cur.speed === 0) {
          if (cur) cur.raf = 0;
          return;
        }
        c.scrollLeft += cur.speed;
        cur.raf = 0;
        updateDrop(cur.x);
        if (cur.speed !== 0 && !cur.raf) {
          cur.raf = window.requestAnimationFrame(tick);
        }
      };
      g.raf = window.requestAnimationFrame(tick);
    }
  }, []);

  const endDrag = useCallback(
    (commit: boolean, copy = false) => {
      const g = gesture.current;
      if (!g) return;
      gesture.current = null;
      g.cleanup();
      if (g.raf) window.cancelAnimationFrame(g.raf);
      try {
        if (g.el.hasPointerCapture?.(g.pointerId)) {
          g.el.releasePointerCapture(g.pointerId);
        }
      } catch (e) {
        // the element is gone
      }
      if (!g.dragging) return;
      setDrag(null);
      suppressNextClick();
      updateScrollState();
      if (!commit || g.beforeId === undefined) return;
      const { setContext: set, refs: r } = latest.current;
      const { sheetId, beforeId } = g;
      // the dragged sheet is (or becomes) the active one
      set((draftCtx) => {
        activateSheetTab(draftCtx, sheetId, r.globalCache, r.cellInput.current);
      });
      r.cellInput.current?.focus({ preventScroll: true });
      if (copy) {
        // Ctrl+drag: a copy goes there (Excel)
        set(
          (draftCtx) => {
            const id = duplicateSheet(draftCtx, sheetId, {
              beforeSheetId: beforeId,
            });
            if (id) {
              draftCtx.groupedSheetIds = undefined;
              activateSheetTab(draftCtx, id, r.globalCache);
            }
          },
          { addSheetOp: true }
        );
      } else {
        set((draftCtx) => {
          const grouped = getGroupedSheetIds(draftCtx);
          moveSheets(
            draftCtx,
            grouped.includes(sheetId) ? grouped : [sheetId],
            beforeId
          );
        });
      }
    },
    [updateScrollState]
  );

  useEffect(() => () => endDrag(false), [endDrag]);

  const onTabPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || e.pointerType === "touch") return;
      const container = tabContainerRef.current;
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>(".luckysheet-sheets-item");
      if (!container || !item || !container.contains(item)) return;
      if (
        target.isContentEditable ||
        target.closest(".luckysheet-sheets-item-function")
      ) {
        return;
      }
      const { context: ctx, refs: r } = latest.current;
      if (
        ctx.allowEdit === false ||
        isWorkbookStructureProtected(ctx) ||
        // Point mode: a click on a tab shows the sheet to pick references
        isEditingFormula(ctx, r.cellInput.current) ||
        isEditingFormula(ctx, r.fxInput.current)
      ) {
        return;
      }
      const sheetId = item.dataset.sheetId;
      if (!sheetId) return;
      endDrag(false);
      const { pointerId } = e;
      const onMove = (ev: PointerEvent) => {
        const g = gesture.current;
        if (!g || ev.pointerId !== g.pointerId) return;
        g.x = ev.clientX;
        if (!g.dragging) {
          if (
            Math.abs(ev.clientX - g.startX) < DRAG_THRESHOLD &&
            Math.abs(ev.clientY - g.startY) < DRAG_THRESHOLD
          ) {
            return;
          }
          g.dragging = true;
          try {
            g.el.setPointerCapture(g.pointerId);
          } catch (err) {
            // the pointer is already gone: the up/cancel ends the drag
          }
          window.getSelection()?.removeAllRanges();
        }
        ev.preventDefault();
        updateDrop(ev.clientX);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const g = gesture.current;
        if (g?.dragging) updateDrop(ev.clientX);
        endDrag(true, ev.ctrlKey || ev.metaKey);
      };
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId === pointerId) endDrag(false);
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape" || !gesture.current?.dragging) return;
        ev.preventDefault();
        ev.stopPropagation();
        endDrag(false);
      };
      const onBlur = () => endDrag(false);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("blur", onBlur);
      gesture.current = {
        pointerId,
        sheetId,
        el: item,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        dragging: false,
        beforeId: undefined,
        speed: 0,
        raf: 0,
        cleanup: () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("keydown", onKey, true);
          window.removeEventListener("blur", onBlur);
        },
      };
    },
    [endDrag, updateDrop]
  );

  const { overflow, atStart, atEnd } = scrollState;

  return (
    <div
      className="luckysheet-sheet-area luckysheet-noselected-text"
      onContextMenu={(e) => e.preventDefault()}
      id="luckysheet-sheet-area"
    >
      <div id="luckysheet-sheet-content">
        {context.allowEdit && (
          <div
            className="fortune-sheettab-button"
            onClick={onAddSheetClick}
            onKeyDown={activateOnKey}
            tabIndex={0}
            aria-label={info.newSheet}
            title={info.newSheet}
            role="button"
          >
            <SVGIcon name="plus" width={16} height={16} />
          </div>
        )}
        {context.allowEdit && (
          <div className="sheet-list-container">
            <div
              id="all-sheets"
              className="fortune-sheettab-button"
              onMouseDown={(e) => {
                e.stopPropagation();
                setContext((ctx) => {
                  ctx.showSheetList = !ctx.showSheetList;
                  ctx.sheetTabContextMenu = {};
                });
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                setContext((ctx) => {
                  ctx.showSheetList = !ctx.showSheetList;
                  ctx.sheetTabContextMenu = {};
                });
              }}
              tabIndex={0}
              role="button"
              aria-label={info.allSheets}
              title={info.allSheets}
              aria-haspopup="menu"
              aria-expanded={!!context.showSheetList}
            >
              <SVGIcon name="all-sheets" width={16} height={16} />
            </div>
          </div>
        )}
        <div
          className="fortune-sheettab-container"
          id="fortune-sheettab-container"
        >
          {overflow && !atStart && <div className="boundary boundary-left" />}
          <div
            className={`fortune-sheettab-container-c${
              drag ? " fortune-sheettab-dragging" : ""
            }`}
            id="fortune-sheettab-container-c"
            ref={tabContainerRef}
            role="tablist"
            aria-label={info.sheetTabs}
            onPointerDown={onTabPointerDown}
            onScroll={updateScrollState}
            onWheel={(e) => {
              const el = tabContainerRef.current;
              if (!el || !overflow) return;
              el.scrollLeft += e.deltaX || e.deltaY;
            }}
          >
            {_.sortBy(context.luckysheetfile, (s) => Number(s.order)).map(
              (sheet) => {
                return (
                  <SheetItem
                    key={sheet.id}
                    sheet={sheet}
                    dragging={drag?.sheetId === sheet.id}
                  />
                );
              }
            )}
            {drag && drag.indicator != null && (
              <div
                className="fortune-sheettab-drop-indicator"
                style={{ left: drag.indicator }}
                aria-hidden="true"
              />
            )}
          </div>
          {overflow && !atEnd && <div className="boundary boundary-right" />}
        </div>
        {overflow && (
          <div
            id="fortune-sheettab-leftscroll"
            className={`fortune-sheettab-scroll${atStart ? " disabled" : ""}`}
            onClick={() => {
              scrollBy(-scrollDelta);
            }}
            onKeyDown={activateOnKey}
            tabIndex={0}
            role="button"
            aria-label={info.scrollTabsLeft}
            aria-disabled={atStart}
            title={info.scrollTabsLeft}
          >
            <SVGIcon name="arrow-doubleleft" width={12} height={12} />
          </div>
        )}
        {overflow && (
          <div
            id="fortune-sheettab-rightscroll"
            className={`fortune-sheettab-scroll${atEnd ? " disabled" : ""}`}
            onClick={() => {
              scrollBy(scrollDelta);
            }}
            onKeyDown={activateOnKey}
            tabIndex={0}
            role="button"
            aria-label={info.scrollTabsRight}
            aria-disabled={atEnd}
            title={info.scrollTabsRight}
          >
            <SVGIcon name="arrow-doubleright" width={12} height={12} />
          </div>
        )}
      </div>
      <div className="fortune-sheet-area-right">
        <ZoomControl />
      </div>
    </div>
  );
};

export default SheetTab;
