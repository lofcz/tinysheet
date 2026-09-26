import {
  applyFilterCondition,
  dataToolsLocale,
  FilterCondition,
  FilterOperator,
  getColumnFilterCondition,
  getFlowdata,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useContext, useMemo, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import "../DataVerification/dataTools.css";
import { Button, DialogShell } from "../ui";

const TEXT_OPERATORS: FilterOperator[] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterOrEqual",
  "lessThan",
  "lessOrEqual",
  "beginsWith",
  "notBeginsWith",
  "endsWith",
  "notEndsWith",
  "contains",
  "notContains",
];

const DATE_OPERATORS: FilterOperator[] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterOrEqual",
  "lessThan",
  "lessOrEqual",
];

type Props = {
  col: number;
  startRow: number;
  endRow: number;
  kind: "text" | "number" | "date";
  op1?: FilterOperator;
  op2?: FilterOperator;
};

const DialogButtons: React.FC<{
  okText: string;
  cancelText: string;
  onOk: () => void;
  onCancel: () => void;
}> = ({ okText, cancelText, onOk, onCancel }) => (
  <>
    <Button variant="secondary" onClick={onCancel}>
      {cancelText}
    </Button>
    <Button variant="primary" onClick={onOk}>
      {okText}
    </Button>
  </>
);

/** Excel's Custom AutoFilter: two criteria joined by And / Or. */
export const CustomFilterDialog: React.FC<Props> = ({
  col,
  startRow,
  endRow,
  kind,
  op1,
  op2,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = dataToolsLocale(context).filter;
  const existing = useMemo(() => {
    const c = getColumnFilterCondition(context, col);
    return c?.type === "custom" ? c : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [first, setFirst] = useState<FilterOperator>(
    op1 ?? existing?.op1 ?? "equals"
  );
  const [value1, setValue1] = useState(op1 ? "" : (existing?.value1 ?? ""));
  const [join, setJoin] = useState<"and" | "or">(
    op1 ? "and" : (existing?.join ?? "and")
  );
  const [second, setSecond] = useState<FilterOperator | "">(
    op2 ?? (op1 ? "" : (existing?.op2 ?? ""))
  );
  const [value2, setValue2] = useState(op1 ? "" : (existing?.value2 ?? ""));

  const operators = kind === "date" ? DATE_OPERATORS : TEXT_OPERATORS;
  const labels = kind === "date" ? t.dateOperators : t.operators;

  // the column's distinct values, offered as suggestions
  const suggestions = useMemo(() => {
    const data = getFlowdata(context);
    const out: string[] = [];
    for (let r = startRow + 1; r <= endRow; r += 1) {
      const cell = data?.[r]?.[col];
      const text = cell?.m ?? cell?.v;
      if (text != null && text !== "") out.push(`${text}`);
    }
    return _.uniq(out).slice(0, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const listId = `fortune-filter-values-${col}`;

  const row = (
    op: FilterOperator | "",
    setOp: (v: any) => void,
    value: string,
    setValue: (v: string) => void,
    allowNone: boolean
  ) => (
    <div className="fortune-dt-row" style={{ marginBottom: 8 }}>
      <select
        className="fortune-dt-select"
        style={{ flex: "0 0 220px" }}
        aria-label={t.showRowsWhere}
        value={op}
        onChange={(e) => setOp(e.target.value)}
      >
        {allowNone && <option value="">—</option>}
        {operators.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
      <input
        className="fortune-dt-input"
        list={listId}
        aria-label={labels[op] ?? t.showRowsWhere}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );

  const onOk = () => {
    const condition: FilterCondition = {
      type: "custom",
      op1: first,
      value1,
      join,
      ...(second ? { op2: second, value2 } : {}),
    };
    setContext((ctx) => {
      applyFilterCondition(ctx, col, condition);
    });
    hideDialog();
  };

  return (
    <DialogShell
      title={t.customTitle}
      className="fortune-dt-dialog fortune-custom-filter"
      onClose={hideDialog}
      footer={
        <DialogButtons
          okText={t.ok}
          cancelText={t.cancel}
          onOk={onOk}
          onCancel={hideDialog}
        />
      }
    >
      <div className="fortune-dt-subtitle">{t.showRowsWhere}</div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </datalist>
      {row(first, setFirst, value1, setValue1, false)}
      <div className="fortune-dt-row" style={{ margin: "4px 0 10px 8px" }}>
        {(["and", "or"] as const).map((j) => (
          <label
            key={j}
            className="fortune-dt-check"
            htmlFor={`fortune-filter-join-${j}`}
            style={{ margin: 0 }}
          >
            <input
              id={`fortune-filter-join-${j}`}
              type="radio"
              name="fortune-filter-join"
              checked={join === j}
              onChange={() => setJoin(j)}
            />
            {t[j]}
          </label>
        ))}
      </div>
      {row(second, setSecond, value2, setValue2, true)}
      {kind !== "number" && kind !== "date" && (
        <div className="fortune-dt-hint">{t.wildcardHint}</div>
      )}
    </DialogShell>
  );
};

/** Excel's Top 10 AutoFilter: top/bottom N items or percent. */
export const Top10Dialog: React.FC<{ col: number }> = ({ col }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = dataToolsLocale(context).filter;
  const existing = useMemo(() => {
    const c = getColumnFilterCondition(context, col);
    return c?.type === "top10" ? c : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [bottom, setBottom] = useState(!!existing?.bottom);
  const [count, setCount] = useState(`${existing?.count ?? 10}`);
  const [percent, setPercent] = useState(!!existing?.percent);

  const onOk = () => {
    const n = Math.max(1, Math.floor(Number(count) || 0));
    setContext((ctx) => {
      applyFilterCondition(ctx, col, {
        type: "top10",
        bottom,
        count: percent ? Math.min(n, 100) : Math.min(n, 500),
        percent,
      });
    });
    hideDialog();
  };

  return (
    <DialogShell
      title={t.top10Title}
      className="fortune-dt-dialog fortune-top10-filter"
      onClose={hideDialog}
      footer={
        <DialogButtons
          okText={t.ok}
          cancelText={t.cancel}
          onOk={onOk}
          onCancel={hideDialog}
        />
      }
    >
      <div className="fortune-dt-subtitle">{t.show}</div>
      <div className="fortune-dt-row">
        <select
          className="fortune-dt-select"
          aria-label={t.show}
          value={bottom ? "bottom" : "top"}
          onChange={(e) => setBottom(e.target.value === "bottom")}
        >
          <option value="top">{t.top}</option>
          <option value="bottom">{t.bottom}</option>
        </select>
        <input
          className="fortune-dt-input"
          type="number"
          min={1}
          aria-label={t.items}
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <select
          className="fortune-dt-select"
          aria-label={t.items}
          value={percent ? "percent" : "items"}
          onChange={(e) => setPercent(e.target.value === "percent")}
        >
          <option value="items">{t.items}</option>
          <option value="percent">{t.percent}</option>
        </select>
      </div>
    </DialogShell>
  );
};
