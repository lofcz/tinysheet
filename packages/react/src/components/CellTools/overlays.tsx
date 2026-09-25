import {
  applyDataTableUpdates,
  Context,
  cellToolsLocale,
  dataTableUpdates,
  formatLocaleText,
  hasDataTables,
} from "@lofcz/tinysheet-core";
import produce from "immer";
import React, { useContext, useEffect, useRef, useState } from "react";
import WorkbookContext from "../../context";
import { activateOnKey } from "../Toolbar/Button";

/**
 * The result of Flash Fill / Advanced Filter next to the cells: how many
 * cells changed (with Undo) or records were found, or why nothing happened.
 */
export const CellToolsNotice: React.FC = () => {
  const { context, handleUndo } = useContext(WorkbookContext);
  const notice = context.cellToolsNotice;
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return undefined;
    setShown(notice.id);
    const timer = setTimeout(() => setShown(null), notice.error ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice || shown !== notice.id) return null;
  const t = cellToolsLocale(context);
  const sel = context.luckysheet_select_save?.[0];
  const range = notice.range ?? (sel && { row: sel.row, column: sel.column });
  if (!range) return null;
  const top =
    range.row[0] === 0 ? 0 : (context.visibledatarow[range.row[0] - 1] ?? 0);
  const left = context.visibledatacolumn[range.column[1]] ?? 0;

  let text: string;
  let undo = false;
  if (notice.kind === "flashFill") {
    if (notice.error === "noPattern") text = t.flashFill.noPattern;
    else if (notice.error) text = t.flashFill.noData;
    else {
      text =
        notice.count === 1
          ? t.flashFill.filledOne
          : formatLocaleText(t.flashFill.filled, { count: notice.count });
      undo = true;
    }
  } else if (notice.error) {
    text =
      {
        invalidList: t.advancedFilter.errList,
        invalidCriteria: t.advancedFilter.errCriteria,
        copyOverlapsList: t.advancedFilter.errOverlap,
      }[notice.error] ?? t.advancedFilter.errCopyTo;
  } else {
    text = formatLocaleText(t.advancedFilter.result, {
      matched: notice.count,
      total: notice.total ?? notice.count,
    });
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={`fortune-cell-tools-notice${notice.error ? " error" : ""}`}
      role="status"
      style={{ top, left: left + 6 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span>{text}</span>
      {undo && (
        <span
          className="fortune-cell-tools-notice-action"
          role="button"
          tabIndex={0}
          onKeyDown={activateOnKey}
          onClick={() => {
            setShown(null);
            handleUndo();
          }}
        >
          {t.flashFill.undo}
        </span>
      )}
    </div>
  );
};

/**
 * Keeps data table bodies up to date: after a workbook change, recompute
 * the tables on a throw-away draft and write the values that differ (no
 * undo step: the bodies follow the model, also after undo / redo).
 */
export const DataTableAutoRecalc: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const files = context.luckysheetfile;
  const latest = useRef(context);
  latest.current = context;
  const active = hasDataTables(context);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => {
      let updates: ReturnType<typeof dataTableUpdates> = [];
      produce(latest.current, (draft) => {
        updates = dataTableUpdates(draft as Context);
      });
      if (updates.length > 0) {
        setContext((ctx) => applyDataTableUpdates(ctx, updates), {
          noHistory: true,
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [files, active, setContext]);

  return null;
};
