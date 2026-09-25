import React, { useContext, useRef, useState } from "react";
import {
  addWatchesForSelection,
  deleteWatches,
  formulaAuditLocale,
  getWatchRows,
  openWatchWindow,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/**
 * Watch Window: a floating panel listing watched cells (book, sheet, name,
 * cell, value, formula) with live values. Drag it by its title.
 */
const WatchWindow: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const t = formulaAuditLocale(context).watch;
  const [selected, setSelected] = useState<string[]>([]);
  const [pos, setPos] = useState<{ right: number; bottom: number }>({
    right: 24,
    bottom: 48,
  });
  const drag = useRef<{
    x: number;
    y: number;
    right: number;
    bottom: number;
  } | null>(null);
  const rows = getWatchRows(context);

  const update = (fn: Parameters<typeof setContext>[0]) =>
    setContext(fn, { noHistory: true });

  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, ...pos };
    const move = (ev: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      setPos({
        right: Math.max(0, d.right - (ev.clientX - d.x)),
        bottom: Math.max(0, d.bottom - (ev.clientY - d.y)),
      });
    };
    const up = () => {
      drag.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  return (
    // the panel keeps its mouse and key events from the grid underneath
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-watch-window"
      role="dialog"
      aria-label={t.title}
      style={{ right: pos.right, bottom: pos.bottom }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Delete" && selected.length > 0) {
          update((ctx) => deleteWatches(ctx, selected));
          setSelected([]);
        }
      }}
    >
      <div className="fortune-watch-window-title" onMouseDown={onDragStart}>
        <span>{t.title}</span>
        <button
          type="button"
          className="fortune-watch-window-close"
          aria-label={t.close}
          title={t.close}
          onClick={() => {
            update((ctx) => openWatchWindow(ctx, false));
            setTimeout(() => refs.cellInput.current?.focus());
          }}
        >
          ×
        </button>
      </div>
      <div className="fortune-watch-window-toolbar">
        <button
          type="button"
          className="fortune-watch-window-button"
          onClick={() => update((ctx) => addWatchesForSelection(ctx))}
        >
          {t.addWatch}
        </button>
        <button
          type="button"
          className="fortune-watch-window-button"
          disabled={selected.length === 0}
          onClick={() => {
            update((ctx) => deleteWatches(ctx, selected));
            setSelected([]);
          }}
        >
          {t.deleteWatch}
        </button>
      </div>
      <div className="fortune-watch-window-table-wrap">
        <table className="fortune-watch-window-table">
          <thead>
            <tr>
              <th>{t.book}</th>
              <th>{t.sheet}</th>
              <th>{t.name}</th>
              <th>{t.cell}</th>
              <th>{t.value}</th>
              <th>{t.formula}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selected.includes(row.key);
              return (
                <tr
                  key={row.key}
                  tabIndex={0}
                  aria-selected={isSelected}
                  data-testid="watch-row"
                  onClick={(e) =>
                    setSelected((cur) => {
                      if (e.ctrlKey || e.metaKey) {
                        return isSelected
                          ? cur.filter((k) => k !== row.key)
                          : [...cur, row.key];
                      }
                      return [row.key];
                    })
                  }
                >
                  <td>{t.bookName}</td>
                  <td title={row.sheet}>{row.sheet}</td>
                  <td title={row.name}>{row.name}</td>
                  <td>{row.cell}</td>
                  <td title={row.value} data-testid="watch-value">
                    {row.value}
                  </td>
                  <td title={row.formula}>{row.formula}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="fortune-watch-window-empty">{t.empty}</div>
        )}
      </div>
    </div>
  );
};

export default WatchWindow;
