import React, { useContext, useEffect, useId, useRef, useState } from "react";
import {
  absoluteRangeText,
  checkNewPivotTable,
  createPivotTable,
  findTable,
  parseRangeText,
  pivotLocale,
  sheetNameById,
  suggestPivotSource,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  CreatePivotOptions,
  PivotSource,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { useAlert } from "../../hooks/useAlert";
import { Button, DialogShell } from "../ui";
import { pivotErrorText } from "./usePivotUpdate";

export const PivotButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, primary, children, className }) => (
  <Button
    variant={primary ? "primary" : "secondary"}
    className={className}
    onClick={onClick}
  >
    {children}
  </Button>
);

/** A check box or radio button with its label. */
export const PivotCheck: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: React.ReactNode;
    className?: string;
  }
> = ({ label, className, ...input }) => {
  const id = useId();
  return (
    <div className={className ?? "fortune-pivot-dialog-check"}>
      <input id={id} {...input} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};

function sourceText(ctx: Context, source: PivotSource | null) {
  if (!source) return "";
  if (source.table) return source.table;
  if (!source.sheetId || !source.range) return "";
  const { row, column } = source.range;
  return absoluteRangeText(
    sheetNameById(ctx, source.sheetId),
    row[0],
    column[0],
    row[1],
    column[1]
  );
}

/** Table name or range text -> source. */
export function parsePivotSource(
  ctx: Context,
  text: string
): PivotSource | null {
  const t = text.trim().replace(/^=/, "");
  if (!t) return null;
  const table = findTable(ctx, t);
  if (table) return { table: table.table.name };
  const range = parseRangeText(ctx, t, ctx.currentSheetId);
  if (!range) return null;
  return {
    sheetId: range.sheetId,
    range: { row: range.row, column: range.column },
  };
}

/** Insert › PivotTable: source and destination. */
const CreatePivotDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { showAlert, hideAlert } = useAlert();
  const t = pivotLocale(context);
  const uid = useId();
  const [source, setSource] = useState(() =>
    sourceText(context, suggestPivotSource(context))
  );
  const [newSheet, setNewSheet] = useState(true);
  const [location, setLocation] = useState(() => {
    const sel = context.luckysheet_select_save?.[0];
    const r = sel?.row_focus ?? sel?.row[0] ?? 0;
    const c = sel?.column_focus ?? sel?.column[0] ?? 0;
    return absoluteRangeText(
      sheetNameById(context, context.currentSheetId),
      r,
      c,
      r,
      c
    );
  });
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  useEffect(() => sourceRef.current?.select(), []);

  const ok = () => {
    const src = parsePivotSource(context, source);
    if (!src) {
      setError(t.errorSource);
      return;
    }
    const options: CreatePivotOptions = { newSheet };
    if (!newSheet) {
      const loc = parseRangeText(
        context,
        location.trim().replace(/^=/, ""),
        context.currentSheetId
      );
      if (!loc) {
        setError(t.errorLocation);
        return;
      }
      options.sheetId = loc.sheetId;
      options.anchor = { r: loc.row[0], c: loc.column[0] };
    }
    const create = (force: boolean) =>
      setContext((ctx) => {
        createPivotTable(ctx, src, { ...options, force });
      });
    const err = checkNewPivotTable(context, src, options);
    if (err === "replaceData") {
      hideDialog();
      showAlert(t.confirmReplace, "yesno", () => {
        hideAlert();
        create(true);
      });
      return;
    }
    if (err) {
      setError(pivotErrorText(t, err));
      return;
    }
    create(false);
    hideDialog();
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ok();
    }
  };

  return (
    <DialogShell
      title={t.createTitle}
      className="fortune-pivot-dialog"
      data-testid="pivot-create-dialog"
      footer={
        <>
          <PivotButton onClick={hideDialog}>{t.cancel}</PivotButton>
          <PivotButton primary onClick={ok}>
            {t.ok}
          </PivotButton>
        </>
      }
    >
      <fieldset className="fortune-pivot-dialog-group">
        <legend>{t.chooseData}</legend>
        <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-src`}>
          <span>{t.tableOrRange}</span>
          <input
            id={`${uid}-src`}
            ref={sourceRef}
            type="text"
            spellCheck={false}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
          />
        </label>
      </fieldset>
      <fieldset className="fortune-pivot-dialog-group">
        <legend>{t.chooseLocation}</legend>
        <PivotCheck
          type="radio"
          name={`${uid}-dest`}
          checked={newSheet}
          onChange={() => setNewSheet(true)}
          label={t.newWorksheet}
        />
        <PivotCheck
          type="radio"
          name={`${uid}-dest`}
          checked={!newSheet}
          onChange={() => setNewSheet(false)}
          label={t.existingWorksheet}
        />
        <label className="fortune-pivot-dialog-field" htmlFor={`${uid}-loc`}>
          <span>{t.location}</span>
          <input
            id={`${uid}-loc`}
            type="text"
            spellCheck={false}
            disabled={newSheet}
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
          />
        </label>
      </fieldset>
      {error && (
        <div className="fortune-pivot-dialog-error" role="alert">
          {error}
        </div>
      )}
    </DialogShell>
  );
};

export default CreatePivotDialog;
