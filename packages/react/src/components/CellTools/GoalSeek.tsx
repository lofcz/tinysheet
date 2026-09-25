import {
  cellToolsLocale,
  finishGoalSeek,
  formatLocaleText,
  getFlowdata,
  parseRefText,
  refText,
  runGoalSeekCommand,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import { RefField, startRefPick } from "./refPick";

type Fields = { setCell: string; toValue: string; changingCell: string };

/** Like Excel's General format in the status dialog: 10 significant digits. */
const fmt = (n: number) =>
  Number.isFinite(n) ? `${Number(n.toPrecision(10))}` : "#VALUE!";

/** Goal Seek result: OK keeps the solution, Cancel restores the value. */
export const GoalSeekStatus: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = cellToolsLocale(context).goalSeek;
  const status = context.goalSeekStatus;

  const close = useCallback(
    (apply: boolean) => {
      hideDialog();
      setContext(
        (ctx) => {
          finishGoalSeek(ctx, "restore");
          if (!apply) delete ctx.goalSeekStatus;
        },
        { noHistory: true }
      );
      if (apply) setContext((ctx) => finishGoalSeek(ctx, "apply"));
    },
    [hideDialog, setContext]
  );

  if (!status) return null;
  const cellName = refText(context, {
    row: [status.setCell.r, status.setCell.r],
    column: [status.setCell.c, status.setCell.c],
    sheetId: status.setSheetId,
  }).replace(/\$/g, "");
  let error = "";
  if (status.error === "setCellNotFormula") error = t.errSetCell;
  else if (status.error === "changingCellFormula") error = t.errChangingCell;
  else if (status.error) error = t.errValue;

  return (
    <div className="fortune-dt-dialog fortune-goal-seek-status">
      <div className="fortune-dt-title">{t.statusTitle}</div>
      {error ? (
        <div className="fortune-dt-error">{error}</div>
      ) : (
        <>
          <div className="fortune-cell-tools-message">
            {formatLocaleText(status.found ? t.found : t.notFound, {
              cell: cellName,
            })}
          </div>
          <table className="fortune-cell-tools-summary">
            <tbody>
              <tr>
                <th scope="row">{t.targetValue}</th>
                <td data-testid="goal-seek-target">{fmt(status.toValue)}</td>
              </tr>
              <tr>
                <th scope="row">{t.currentValue}</th>
                <td data-testid="goal-seek-current">{fmt(status.result)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      <div
        className="fortune-dt-buttons"
        style={{ justifyContent: "flex-end" }}
      >
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onKeyDown={activateOnKey}
          onClick={() => close(!error)}
        >
          {t.ok}
        </div>
        {!error && (
          <div
            className="button-basic button-default"
            role="button"
            tabIndex={0}
            onKeyDown={activateOnKey}
            onClick={() => close(false)}
          >
            {t.cancel}
          </div>
        )}
      </div>
    </div>
  );
};

/** What-If Analysis › Goal Seek. */
const GoalSeek: React.FC<{ initial?: Fields }> = ({ initial }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = cellToolsLocale(context).goalSeek;
  const [fields, setFields] = useState<Fields>(() => {
    if (initial) return initial;
    const sel = context.luckysheet_select_save?.[0];
    const data = getFlowdata(context);
    const r = sel?.row_focus ?? sel?.row[0];
    const c = sel?.column_focus ?? sel?.column[0];
    const hasFormula = r != null && c != null && !!data?.[r]?.[c]?.f;
    return {
      setCell:
        r != null && c != null && hasFormula
          ? refText(context, { row: [r, r], column: [c, c] })
          : "",
      toValue: "",
      changingCell: "",
    };
  });
  const [error, setError] = useState("");
  const set = (patch: Partial<Fields>) => {
    setError("");
    setFields((f) => ({ ...f, ...patch }));
  };

  const pick = (field: keyof Fields, label: string) => {
    hideDialog();
    startRefPick({
      label,
      onDone: (ref) =>
        showDialog(
          <GoalSeek
            initial={{ ...fields, ...(ref != null ? { [field]: ref } : {}) }}
          />
        ),
    });
  };

  const onOk = () => {
    const setRef = parseRefText(context, fields.setCell);
    if (
      !setRef ||
      setRef.row[0] !== setRef.row[1] ||
      setRef.column[0] !== setRef.column[1]
    ) {
      setError(t.errSetCellRef);
      return;
    }
    const setSheet = context.luckysheetfile.find(
      (s) => s.id === setRef.sheetId
    );
    if (!setSheet?.data?.[setRef.row[0]]?.[setRef.column[0]]?.f) {
      setError(t.errSetCell);
      return;
    }
    const toValue = Number(fields.toValue.trim().replace(/,/g, ""));
    if (fields.toValue.trim() === "" || !Number.isFinite(toValue)) {
      setError(t.errValue);
      return;
    }
    const changing = parseRefText(context, fields.changingCell);
    const data = getFlowdata(context);
    if (
      !changing ||
      changing.sheetId !== context.currentSheetId ||
      changing.row[0] !== changing.row[1] ||
      changing.column[0] !== changing.column[1] ||
      data?.[changing.row[0]]?.[changing.column[0]]?.f
    ) {
      setError(t.errChangingCell);
      return;
    }
    const options = {
      setCell: { r: setRef.row[0], c: setRef.column[0] },
      setSheetId: setRef.sheetId,
      toValue,
      changingCell: { r: changing.row[0], c: changing.column[0] },
    };
    // seek without an undo step; OK in the status dialog records one
    setContext((ctx) => runGoalSeekCommand(ctx, options), { noHistory: true });
    showDialog(<GoalSeekStatus />, undefined, undefined, () => {
      hideDialog();
      setContext(
        (ctx) => {
          finishGoalSeek(ctx, "restore");
          delete ctx.goalSeekStatus;
        },
        { noHistory: true }
      );
    });
  };

  return (
    <div
      className="fortune-dt-dialog fortune-goal-seek"
      onKeyDown={(e) => {
        if (e.key === "Enter") onOk();
      }}
    >
      <div className="fortune-dt-title">{t.title}</div>
      <RefField
        id="fortune-goal-seek-set"
        label={t.setCell}
        value={fields.setCell}
        onChange={(v) => set({ setCell: v })}
        onPick={() => pick("setCell", t.setCell)}
      />
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-goal-seek-to">
          {t.toValue}
        </label>
        <input
          id="fortune-goal-seek-to"
          className="fortune-dt-input"
          value={fields.toValue}
          inputMode="decimal"
          onChange={(e) => set({ toValue: e.target.value })}
        />
      </div>
      <RefField
        id="fortune-goal-seek-changing"
        label={t.changingCell}
        value={fields.changingCell}
        onChange={(v) => set({ changingCell: v })}
        onPick={() => pick("changingCell", t.changingCell)}
      />
      {error && <div className="fortune-dt-error">{error}</div>}
      <div
        className="fortune-dt-buttons"
        style={{ justifyContent: "flex-end" }}
      >
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onKeyDown={activateOnKey}
          onClick={onOk}
        >
          {t.ok}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onKeyDown={activateOnKey}
          onClick={hideDialog}
        >
          {t.cancel}
        </div>
      </div>
    </div>
  );
};

export default GoalSeek;
