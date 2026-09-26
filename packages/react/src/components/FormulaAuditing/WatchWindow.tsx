import React, { useContext, useState } from "react";
import {
  addWatchesForSelection,
  deleteWatches,
  formulaAuditLocale,
  getWatchRows,
} from "@lofcz/tinysheet-core";
import { Eye, Trash2 } from "lucide-react";
import WorkbookContext from "../../context";
import { Button, ICON_STROKE } from "../ui";

/**
 * Watch Window, docked in the side pane: the watched cells (sheet, name,
 * cell, formula) with live values. Click selects a watch (Ctrl+click adds
 * to the selection), Delete removes the selected ones.
 */
const WatchWindow: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = formulaAuditLocale(context).watch;
  const [selected, setSelected] = useState<string[]>([]);
  const rows = getWatchRows(context);

  const update = (fn: Parameters<typeof setContext>[0]) =>
    setContext(fn, { noHistory: true });

  const remove = () => {
    update((ctx) => deleteWatches(ctx, selected));
    setSelected([]);
  };

  return (
    // the list takes Delete like Excel's watch list
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-watch-window ts-pane-content ts-pane-padded"
      onKeyDown={(e) => {
        if (e.key === "Delete" && selected.length > 0) {
          e.preventDefault();
          remove();
        }
      }}
    >
      <div className="ts-pane-actions fortune-watch-window-toolbar">
        <Button
          size="sm"
          icon="plus"
          className="fortune-watch-window-button"
          onClick={() => update((ctx) => addWatchesForSelection(ctx))}
        >
          {t.addWatch}
        </Button>
        <Button
          size="sm"
          icon={Trash2}
          className="fortune-watch-window-button"
          disabled={selected.length === 0}
          onClick={remove}
        >
          {t.deleteWatch}
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="ts-pane-empty fortune-watch-window-empty">
          <Eye size={28} strokeWidth={ICON_STROKE} aria-hidden />
          <p>{t.empty}</p>
        </div>
      ) : (
        <div
          className="fortune-watch-window-list"
          role="listbox"
          aria-label={t.title}
          aria-multiselectable="true"
        >
          {rows.map((row) => {
            const isSelected = selected.includes(row.key);
            const pick = (additive: boolean) =>
              setSelected((cur) => {
                if (additive) {
                  return isSelected
                    ? cur.filter((k) => k !== row.key)
                    : [...cur, row.key];
                }
                return [row.key];
              });
            return (
              <div
                key={row.key}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                className="fortune-watch-window-row"
                data-testid="watch-row"
                onClick={(e) => pick(e.ctrlKey || e.metaKey)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    pick(e.ctrlKey || e.metaKey);
                  }
                }}
              >
                <div className="fortune-watch-window-row-top">
                  <span
                    className="fortune-watch-window-cell"
                    title={`${t.bookName} / ${row.sheet}`}
                  >
                    {row.sheet}!{row.cell}
                  </span>
                  {row.name && (
                    <span
                      className="fortune-watch-window-name"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )}
                  <span
                    className="fortune-watch-window-value"
                    title={row.value}
                    data-testid="watch-value"
                  >
                    {row.value}
                  </span>
                </div>
                {row.formula && (
                  <div
                    className="fortune-watch-window-formula"
                    title={row.formula}
                  >
                    {row.formula}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WatchWindow;
