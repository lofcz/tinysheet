import {
  applySubtotals,
  cellText,
  formatLocaleText,
  getFlowdata,
  getSubtotalRange,
  groupSelection,
  indexToColumnChar,
  isSummaryAfter,
  outlineLocale,
  OutlineAxis,
  removeSubtotals,
  setOutlineSettings,
  SUBTOTAL_FUNCTIONS,
  SubtotalFunction,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useMemo, useState } from "react";
import WorkbookContext from "../../context";
import { outlineStep } from "./history";
import { useDialog } from "../../hooks/useDialog";
import DtCheck from "../DataVerification/DtCheck";
import "../DataVerification/dataTools.css";

/** Close the dialog and give the keyboard back to the grid. */
export function useCloseDialog() {
  const { refs } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  return useCallback(() => {
    hideDialog();
    setTimeout(() => refs.cellInput.current?.focus());
  }, [hideDialog, refs.cellInput]);
}

const Buttons: React.FC<{
  ok: string;
  cancel: string;
  onOk: () => void;
  onCancel: () => void;
  extra?: React.ReactNode;
}> = ({ ok, cancel, onOk, onCancel, extra }) => (
  <div className="fortune-dt-buttons">
    {extra}
    <div className="fortune-dt-spacer" />
    <div
      className="button-basic button-primary"
      role="button"
      tabIndex={0}
      onClick={onOk}
      onKeyDown={(e) => e.key === "Enter" && onOk()}
    >
      {ok}
    </div>
    <div
      className="button-basic button-default"
      role="button"
      tabIndex={0}
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Enter" && onCancel()}
    >
      {cancel}
    </div>
  </div>
);

/** Group / Ungroup for a range that is neither whole rows nor columns. */
export const GroupDialog: React.FC<{ ungroup?: boolean }> = ({ ungroup }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const hideDialog = useCloseDialog();
  const t = outlineLocale(context);
  const [axis, setAxis] = useState<OutlineAxis>("row");
  const name = `fortune-outline-axis-${ungroup ? "u" : "g"}`;
  const onOk = () => {
    hideDialog();
    setContext((ctx) => {
      groupSelection(ctx, !!ungroup, axis);
    }, outlineStep());
  };
  return (
    <div
      className="fortune-dt-dialog fortune-outline-dialog"
      data-testid="outline-group-dialog"
    >
      <div className="fortune-dt-title">
        {ungroup ? t.groupDialog.ungroup : t.groupDialog.group}
      </div>
      <div className="fortune-outline-radios" role="radiogroup">
        {(["row", "column"] as const).map((a) => (
          <label key={a} htmlFor={`${name}-${a}`}>
            <input
              id={`${name}-${a}`}
              type="radio"
              name={name}
              checked={axis === a}
              onChange={() => setAxis(a)}
            />
            {a === "row" ? t.groupDialog.rows : t.groupDialog.columns}
          </label>
        ))}
      </div>
      <Buttons
        ok={t.settings.ok}
        cancel={t.settings.cancel}
        onOk={onOk}
        onCancel={hideDialog}
      />
    </div>
  );
};

/** Outline settings: where summary rows and columns sit. */
export const OutlineSettingsDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const hideDialog = useCloseDialog();
  const t = outlineLocale(context).settings;
  const [below, setBelow] = useState(() =>
    isSummaryAfter(context.config, "row")
  );
  const [right, setRight] = useState(() =>
    isSummaryAfter(context.config, "column")
  );
  return (
    <div
      className="fortune-dt-dialog fortune-outline-dialog"
      data-testid="outline-settings-dialog"
    >
      <div className="fortune-dt-title">{t.title}</div>
      <div className="fortune-dt-label" style={{ marginBottom: 8 }}>
        {t.direction}
      </div>
      <DtCheck checked={below} onChange={setBelow}>
        {t.summaryBelow}
      </DtCheck>
      <DtCheck checked={right} onChange={setRight}>
        {t.summaryRight}
      </DtCheck>
      <Buttons
        ok={t.ok}
        cancel={t.cancel}
        onOk={() => {
          hideDialog();
          setContext(
            (ctx) =>
              setOutlineSettings(ctx, {
                summaryBelow: below,
                summaryRight: right,
              }),
            outlineStep()
          );
        }}
        onCancel={hideDialog}
      />
    </div>
  );
};

/** Data › Subtotal. */
export const SubtotalDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const hideDialog = useCloseDialog();
  const t = outlineLocale(context).subtotal;
  const data = getFlowdata(context);
  const range = useMemo(
    () => getSubtotalRange(context),
    // the list is taken when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const columns = useMemo(() => {
    if (!range) return [];
    const out: number[] = [];
    for (let c = range.column[0]; c <= range.column[1]; c += 1) out.push(c);
    return out;
  }, [range]);
  const [groupBy, setGroupBy] = useState(columns[0] ?? 0);
  const [fn, setFn] = useState<SubtotalFunction>("sum");
  const [addTo, setAddTo] = useState<number[]>(
    columns.length ? [columns[columns.length - 1]] : []
  );
  const [replace, setReplace] = useState(true);
  const [pageBreaks, setPageBreaks] = useState(false);
  const [below, setBelow] = useState(() =>
    isSummaryAfter(context.config, "row")
  );
  const [error, setError] = useState("");

  if (!range || !data) {
    return (
      <div className="fortune-dt-dialog fortune-outline-dialog">
        <div className="fortune-dt-title">{t.title}</div>
        <div className="fortune-dt-error">{t.noData}</div>
        <Buttons
          ok={t.ok}
          cancel={t.cancel}
          onOk={hideDialog}
          onCancel={hideDialog}
        />
      </div>
    );
  }

  const label = (c: number) =>
    cellText(data[range.row[0]]?.[c]) ||
    formatLocaleText(t.column, { name: indexToColumnChar(c) });

  const onOk = () => {
    if (addTo.length === 0) {
      setError(t.noColumns);
      return;
    }
    hideDialog();
    setContext((ctx) => {
      const res = applySubtotals(ctx, {
        range,
        groupBy,
        fn,
        columns: addTo,
        replace,
        pageBreaks,
        summaryBelow: below,
      });
      // shown by the sheet overlay once this dialog is gone
      if ("error" in res) ctx.warnDialog = t[res.error];
    }, outlineStep());
  };

  const onRemoveAll = () => {
    hideDialog();
    setContext((ctx) => {
      removeSubtotals(ctx, range);
    }, outlineStep());
  };

  return (
    <div
      className="fortune-dt-dialog fortune-outline-dialog"
      data-testid="subtotal-dialog"
    >
      <div className="fortune-dt-title">{t.title}</div>
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-subtotal-by">
          {t.atEachChange}
        </label>
        <select
          id="fortune-subtotal-by"
          className="fortune-dt-select"
          value={groupBy}
          onChange={(e) => setGroupBy(Number(e.target.value))}
        >
          {columns.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
      </div>
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-subtotal-fn">
          {t.useFunction}
        </label>
        <select
          id="fortune-subtotal-fn"
          className="fortune-dt-select"
          value={fn}
          onChange={(e) => setFn(e.target.value as SubtotalFunction)}
        >
          {SUBTOTAL_FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {t.functions[f]}
            </option>
          ))}
        </select>
      </div>
      <div className="fortune-dt-label" style={{ marginBottom: 4 }}>
        {t.addTo}
      </div>
      <div
        className="fortune-dt-scroll"
        style={{ padding: "6px 10px", marginBottom: 12 }}
        role="group"
        aria-label={t.addTo}
      >
        {columns.map((c) => (
          <DtCheck
            key={c}
            checked={addTo.includes(c)}
            onChange={(v) => {
              setError("");
              setAddTo((prev) =>
                v
                  ? [...prev, c].sort((a, b) => a - b)
                  : prev.filter((x) => x !== c)
              );
            }}
          >
            {label(c)}
          </DtCheck>
        ))}
      </div>
      <DtCheck checked={replace} onChange={setReplace}>
        {t.replace}
      </DtCheck>
      <DtCheck checked={pageBreaks} onChange={setPageBreaks}>
        {t.pageBreaks}
      </DtCheck>
      <DtCheck checked={below} onChange={setBelow}>
        {t.summaryBelow}
      </DtCheck>
      {error && <div className="fortune-dt-error">{error}</div>}
      <Buttons
        ok={t.ok}
        cancel={t.cancel}
        onOk={onOk}
        onCancel={hideDialog}
        extra={
          <div
            className="button-basic button-default"
            role="button"
            tabIndex={0}
            onClick={onRemoveAll}
            onKeyDown={(e) => e.key === "Enter" && onRemoveAll()}
          >
            {t.removeAll}
          </div>
        }
      />
    </div>
  );
};
