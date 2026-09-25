import {
  createSelectionStatsTask,
  DEFAULT_STATUS_BAR_STATS,
  emptySelectionStats,
  formatSelectionStat,
  getActiveCellNumberFormat,
  getFlowdata,
  locale,
  SelectionStats,
  STATUS_BAR_STAT_KEYS,
  StatusBarStatKey,
  visibleSelectionStats,
} from "@lofcz/tinysheet-core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import WorkbookContext from "../../context";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import "./index.css";

/** localStorage key for the aggregates the user chose to show. */
export const STATUS_BAR_STORAGE_KEY = "tinysheet.statusBar.stats";

/** Selections up to this many cells are scanned in one go. */
const SYNC_CELL_LIMIT = 100000;
/** Cells scanned per slice for larger selections. */
const CHUNK_CELLS = 200000;
/** Wait for the selection to settle while drag-selecting. */
const DEBOUNCE_MS = 80;

function loadEnabled(): StatusBarStatKey[] {
  try {
    const raw = window.localStorage?.getItem(STATUS_BAR_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return STATUS_BAR_STAT_KEYS.filter((k) => list.includes(k));
      }
    }
  } catch (e) {
    // unavailable or corrupt storage: fall back to Excel's defaults
  }
  return DEFAULT_STATUS_BAR_STATS;
}

function saveEnabled(list: StatusBarStatKey[]) {
  try {
    window.localStorage?.setItem(STATUS_BAR_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // private mode etc.: the choice lasts for this session only
  }
}

function selectionSize(
  ranges: { row: number[]; column: number[] }[] | undefined,
  rows: number,
  cols: number
) {
  let total = 0;
  (ranges || []).forEach(({ row, column }) => {
    const h = Math.max(0, Math.min(row[1], rows - 1) - row[0] + 1);
    const w = Math.max(0, Math.min(column[1], cols - 1) - column[0] + 1);
    total += h * w;
  });
  return total;
}

type MenuState = { x: number; y: number } | null;

/**
 * Excel-style status bar: selection aggregates (right-click to choose which),
 * formatted like the active cell; click a value to copy it.
 */
const StatusBar: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const { statusBar } = locale(context);
  const [enabled, setEnabled] = useState<StatusBarStatKey[]>(loadEnabled);
  const [stats, setStats] = useState<SelectionStats>(emptySelectionStats);
  const [calculating, setCalculating] = useState(false);
  const [menu, setMenu] = useState<MenuState>(null);
  const [copied, setCopied] = useState<StatusBarStatKey | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const data = getFlowdata(context);
  const selection = context.luckysheet_select_save;
  const numberFormat = getActiveCellNumberFormat(context);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const task = createSelectionStatsTask(data, selection);
    const size = selectionSize(
      selection,
      data?.length ?? 0,
      data?.[0]?.length ?? 0
    );
    const run = () => {
      if (cancelled) return;
      if (task.step(CHUNK_CELLS)) {
        setStats(task.result());
        setCalculating(false);
      } else {
        setCalculating(true);
        timer = window.setTimeout(run, 0);
      }
    };
    timer = window.setTimeout(
      () => {
        if (size <= SYNC_CELL_LIMIT) task.step(Infinity);
        run();
      },
      // re-scan quickly after edits, debounce drag-selection
      size <= SYNC_CELL_LIMIT ? DEBOUNCE_MS : DEBOUNCE_MS * 2
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, selection]);

  useOutsideClick(menuRef, () => setMenu(null), [menuRef]);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    menuRef.current
      ?.querySelector<HTMLElement>(".fortune-status-bar-menu-item")
      ?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const toggle = useCallback((key: StatusBarStatKey) => {
    setEnabled((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : STATUS_BAR_STAT_KEYS.filter((k) => k === key || prev.includes(k));
      saveEnabled(next);
      return next;
    });
  }, []);

  const copy = useCallback((key: StatusBarStatKey, text: string) => {
    const done = () => {
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1200);
    };
    try {
      const p = navigator.clipboard?.writeText(text);
      if (p) p.then(done, () => {});
      else done();
    } catch (e) {
      // clipboard blocked
    }
  }, []);

  const shown = calculating ? [] : visibleSelectionStats(stats, enabled);
  const allVisible = visibleSelectionStats(stats, STATUS_BAR_STAT_KEYS);

  return (
    <div
      className="fortune-stat-area fortune-status-bar"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* left side: reserved for mode indicators (Ready / Enter / Edit) */}
      <div className="fortune-status-bar-left" />
      <div
        className="fortune-status-bar-stats"
        role="status"
        aria-live="polite"
      >
        {calculating && (
          <span className="fortune-status-bar-calculating">
            {statusBar.calculating}
          </span>
        )}
        {shown.map((key) => {
          const text = formatSelectionStat(key, stats, numberFormat);
          return (
            <button
              type="button"
              key={key}
              className="fortune-status-bar-item"
              data-stat={key}
              title={copied === key ? statusBar.copied : statusBar.clickToCopy}
              onClick={() => copy(key, text)}
            >
              <span className="fortune-status-bar-label">
                {statusBar[key]}:
              </span>{" "}
              <span className="fortune-status-bar-value">{text}</span>
              {copied === key && (
                <span className="fortune-status-bar-copied">
                  {statusBar.copied}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {menu && (
        <div
          ref={menuRef}
          className="fortune-status-bar-menu"
          role="menu"
          aria-label={statusBar.customize}
          style={{ left: menu.x, bottom: window.innerHeight - menu.y }}
        >
          <div className="fortune-status-bar-menu-title">
            {statusBar.customize}
          </div>
          {STATUS_BAR_STAT_KEYS.map((key) => {
            const checked = enabled.includes(key);
            return (
              <div
                key={key}
                role="menuitemcheckbox"
                aria-checked={checked}
                tabIndex={0}
                className="fortune-status-bar-menu-item"
                data-stat={key}
                onClick={() => toggle(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(key);
                  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const next =
                      e.key === "ArrowDown"
                        ? el.nextElementSibling
                        : el.previousElementSibling;
                    if (
                      next instanceof HTMLElement &&
                      next.classList.contains("fortune-status-bar-menu-item")
                    ) {
                      next.focus();
                    }
                  }
                }}
              >
                <span className="fortune-status-bar-check" aria-hidden="true">
                  {checked ? "✓" : ""}
                </span>
                <span className="fortune-status-bar-menu-label">
                  {statusBar[key]}
                </span>
                <span className="fortune-status-bar-menu-value">
                  {allVisible.includes(key)
                    ? formatSelectionStat(key, stats, numberFormat)
                    : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatusBar;
