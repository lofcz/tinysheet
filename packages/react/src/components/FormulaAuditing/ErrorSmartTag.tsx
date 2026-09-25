import React, { useContext, useEffect, useRef, useState } from "react";
import _ from "lodash";
import {
  convertToNumber,
  copyFormulaFromSource,
  fixColumnStyleOverflowInFreeze,
  fixRowStyleOverflowInFreeze,
  formulaAuditLocale,
  getCellError,
  ignoreCellError,
  isAllowEdit,
  lockCell,
  tracePrecedents,
  updateFormulaToIncludeCells,
} from "@lofcz/tinysheet-core";
import type { Context, ErrorInfo } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { ErrorCheckingOptionsDialog } from "./Dialogs";

const TAG_SIZE = 18;

type Action = {
  key: string;
  label: string;
  run: (ctx: Context) => void;
  edit?: boolean;
};

function actionsFor(
  info: ErrorInfo,
  r: number,
  c: number,
  t: ReturnType<typeof formulaAuditLocale>["errors"]
): Action[] {
  switch (info.rule) {
    case "numberAsText":
      return [
        {
          key: "convert",
          label: t.convertToNumber,
          edit: true,
          run: (ctx) => {
            convertToNumber(ctx, r, c);
          },
        },
      ];
    case "inconsistentFormula":
      return [
        {
          key: "copy",
          label:
            info.source?.direction === "left"
              ? t.copyFromLeft
              : t.copyFromAbove,
          edit: true,
          run: (ctx) => {
            copyFormulaFromSource(ctx, r, c);
          },
        },
      ];
    case "omitsCells":
      return [
        {
          key: "include",
          label: t.includeCells,
          edit: true,
          run: (ctx) => {
            updateFormulaToIncludeCells(ctx, r, c);
          },
        },
      ];
    case "unlockedFormula":
      return [
        {
          key: "lock",
          label: t.lockCell,
          edit: true,
          run: (ctx) => lockCell(ctx, r, c),
        },
      ];
    default:
      return [
        {
          key: "trace",
          label: t.traceError,
          run: (ctx) => {
            tracePrecedents(ctx);
          },
        },
      ];
  }
}

/**
 * Excel's error smart tag: a "!" button left of the active cell when the
 * cell shows an error-checking triangle, with the fixes for that error.
 */
const ErrorSmartTag: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), [ref]);

  const sel = context.luckysheet_select_save;
  const last = _.last(sel);
  const r = last?.row_focus ?? last?.row[0];
  const c = last?.column_focus ?? last?.column[0];
  const editing = context.luckysheetCellUpdate.length > 0;
  const info =
    r == null || c == null || editing || (sel?.length ?? 0) !== 1
      ? null
      : getCellError(context, r, c);

  useEffect(() => {
    setOpen(false);
  }, [r, c, info?.rule]);

  if (!info || r == null || c == null) return null;
  const { visibledatarow: rows, visibledatacolumn: cols } = context;
  if (r >= rows.length || c >= cols.length) return null;
  const t = formulaAuditLocale(context).errors;
  const top = r === 0 ? 0 : rows[r - 1];
  const left = c === 0 ? 0 : cols[c - 1];
  const freeze = refs.globalCache.freezen?.[context.currentSheetId];
  const pos = _.assign(
    { left, top },
    fixRowStyleOverflowInFreeze(context, r, r, freeze),
    fixColumnStyleOverflowInFreeze(context, c, c, freeze)
  );
  // left of the cell, or right of it in column A
  const tagLeft =
    (pos.left ?? left) >= TAG_SIZE + 2
      ? (pos.left ?? left) - TAG_SIZE - 2
      : cols[c] + 2;
  const editable = isAllowEdit(context);
  const run = (action: Action) => {
    setOpen(false);
    setContext((ctx) => action.run(ctx));
    setTimeout(() => refs.cellInput.current?.focus());
  };
  const actions = actionsFor(info, r, c, t);

  return (
    <div
      ref={ref}
      className="fortune-error-tag"
      style={{ left: tagLeft, top: (pos.top ?? top) + 1, display: pos.display }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="fortune-error-tag-button"
        aria-label={`${t.tagLabel}: ${t.titles[info.rule]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t.titles[info.rule]}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        !
      </button>
      {open && (
        <div className="fortune-error-tag-menu" role="menu">
          <div className="fortune-error-tag-title">{t.titles[info.rule]}</div>
          <div className="fortune-error-tag-detail">{t.details[info.rule]}</div>
          {actions.map((a) => (
            <button
              type="button"
              role="menuitem"
              key={a.key}
              className="fortune-error-tag-item"
              disabled={a.edit && !editable}
              onClick={() => run(a)}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="fortune-error-tag-item"
            disabled={!editable}
            onClick={() =>
              run({
                key: "ignore",
                label: t.ignore,
                run: (ctx) => ignoreCellError(ctx, r, c, info.rule),
              })
            }
          >
            {t.ignore}
          </button>
          <button
            type="button"
            role="menuitem"
            className="fortune-error-tag-item fortune-error-tag-options"
            onClick={() => {
              setOpen(false);
              showDialog(<ErrorCheckingOptionsDialog />);
            }}
          >
            {t.options}
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorSmartTag;
