import React, { useContext, useId, useMemo, useReducer, useState } from "react";
import {
  CalcMode,
  createFormulaEvaluation,
  ERROR_RULE_KEYS,
  ErrorRuleKey,
  evaluateNextStep,
  formulaAuditLocale,
  getCalcSettings,
  getErrorCheckingOptions,
  getEvaluationView,
  resetIgnoredErrors,
  restartEvaluation,
  setCalcSettings,
  setErrorCheckingOptions,
  stepIn,
  stepOut,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { Button, DialogShell } from "../ui";

const TextButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, primary, disabled, children }) => (
  <Button
    variant={primary ? "primary" : "secondary"}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </Button>
);

/** Formulas > Calculation Options (mode and iterative calculation). */
export const CalcOptionsDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = formulaAuditLocale(context).calc;
  const uid = useId();
  const initial = useMemo(() => getCalcSettings(context), [context]);
  const [mode, setMode] = useState<CalcMode>(initial.mode);
  const [iterate, setIterate] = useState(initial.iterate);
  const [maxIterations, setMaxIterations] = useState(
    String(initial.maxIterations)
  );
  const [maxChange, setMaxChange] = useState(String(initial.maxChange));
  const modes: [CalcMode, string][] = [
    ["auto", t.automatic],
    ["autoNoTable", t.automaticExceptTables],
    ["manual", t.manual],
  ];
  const save = () => {
    const iterations = Number(maxIterations);
    const change = Number(maxChange);
    setContext((ctx) => {
      setCalcSettings(ctx, {
        mode,
        iterate,
        ...(Number.isFinite(iterations) ? { maxIterations: iterations } : {}),
        ...(Number.isFinite(change) && change >= 0
          ? { maxChange: change }
          : {}),
      });
    });
    hideDialog();
  };
  return (
    <DialogShell
      title={t.options}
      className="fortune-audit-dialog fortune-calc-options"
      footer={
        <>
          <TextButton onClick={hideDialog}>{t.cancel}</TextButton>
          <TextButton primary onClick={save}>
            {t.ok}
          </TextButton>
        </>
      }
    >
      <fieldset className="fortune-audit-fieldset">
        <legend>{t.workbookCalculation}</legend>
        {modes.map(([value, label]) => (
          <label
            key={value}
            className="fortune-audit-check"
            htmlFor={`${uid}-${value}`}
          >
            <input
              id={`${uid}-${value}`}
              type="radio"
              name="fortune-calc-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="fortune-audit-check" htmlFor={`${uid}-iterate`}>
        <input
          id={`${uid}-iterate`}
          type="checkbox"
          checked={iterate}
          onChange={(e) => setIterate(e.target.checked)}
          data-testid="calc-iterate"
        />
        {t.enableIterative}
      </label>
      <div className="fortune-audit-grid">
        <label htmlFor={`${uid}-iterations`}>{t.maxIterations}</label>
        <input
          id={`${uid}-iterations`}
          type="number"
          min={1}
          max={32767}
          disabled={!iterate}
          value={maxIterations}
          onChange={(e) => setMaxIterations(e.target.value)}
        />
        <label htmlFor={`${uid}-change`}>{t.maxChange}</label>
        <input
          id={`${uid}-change`}
          type="number"
          min={0}
          step="any"
          disabled={!iterate}
          value={maxChange}
          onChange={(e) => setMaxChange(e.target.value)}
        />
      </div>
    </DialogShell>
  );
};

/** Error Checking options: background checking and its rules. */
export const ErrorCheckingOptionsDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const all = formulaAuditLocale(context);
  const t = all.errors;
  const uid = useId();
  const initial = useMemo(() => getErrorCheckingOptions(context), [context]);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [rules, setRules] = useState(initial.rules);
  const save = () => {
    setContext(
      (ctx) => {
        setErrorCheckingOptions(ctx, { enabled, rules });
      },
      { noHistory: true }
    );
    hideDialog();
  };
  return (
    <DialogShell
      title={t.checking}
      className="fortune-audit-dialog fortune-error-options"
      footer={
        <>
          <TextButton
            onClick={() => {
              setContext((ctx) => resetIgnoredErrors(ctx));
            }}
          >
            {t.resetIgnored}
          </TextButton>
          <span className="fortune-audit-spacer" />
          <TextButton onClick={hideDialog}>{all.calc.cancel}</TextButton>
          <TextButton primary onClick={save}>
            {all.calc.ok}
          </TextButton>
        </>
      }
    >
      <label className="fortune-audit-check" htmlFor={`${uid}-enabled`}>
        <input
          id={`${uid}-enabled`}
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t.enable}
      </label>
      <fieldset className="fortune-audit-fieldset" disabled={!enabled}>
        <legend>{t.rulesTitle}</legend>
        {ERROR_RULE_KEYS.map((key: ErrorRuleKey) => (
          <label
            key={key}
            className="fortune-audit-check"
            htmlFor={`${uid}-${key}`}
          >
            <input
              id={`${uid}-${key}`}
              type="checkbox"
              checked={rules[key]}
              data-rule={key}
              onChange={(e) =>
                setRules((cur) => ({ ...cur, [key]: e.target.checked }))
              }
            />
            {t.rules[key]}
          </label>
        ))}
      </fieldset>
    </DialogShell>
  );
};

/** Formulas > Evaluate Formula. */
export const EvaluateFormulaDialog: React.FC<{
  sheetId: string;
  r: number;
  c: number;
}> = ({ sheetId, r, c }) => {
  const { context } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = formulaAuditLocale(context).evaluate;
  // the session is created once; the dialog reads the live workbook
  const [session] = useState(() =>
    createFormulaEvaluation(context, sheetId, r, c)
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  if (!session) {
    return (
      <DialogShell
        title={t.title}
        className="fortune-audit-dialog"
        footer={
          <>
            <TextButton onClick={hideDialog}>{t.close}</TextButton>
          </>
        }
      >
        <p>{t.noFormula}</p>
      </DialogShell>
    );
  }
  const view = getEvaluationView(context, session);
  const act = (fn: () => void) => {
    fn();
    rerender();
  };
  return (
    <DialogShell
      title={t.title}
      className="fortune-audit-dialog fortune-evaluate"
      footer={
        <>
          <TextButton
            primary
            onClick={() =>
              act(() =>
                view.finished
                  ? restartEvaluation(context, session)
                  : evaluateNextStep(context, session)
              )
            }
            disabled={!view.finished && !view.canEvaluate}
          >
            {view.finished ? t.restart : t.evaluate}
          </TextButton>
          <TextButton
            disabled={!view.canStepIn}
            onClick={() => act(() => stepIn(context, session))}
          >
            {t.stepIn}
          </TextButton>
          <TextButton
            disabled={!view.canStepOut}
            onClick={() => act(() => stepOut(context, session))}
          >
            {t.stepOut}
          </TextButton>
          <span className="fortune-audit-spacer" />
          <TextButton onClick={hideDialog}>{t.close}</TextButton>
        </>
      }
    >
      <div className="fortune-evaluate-head">
        <span>{t.reference}</span>
        <span>{t.evaluation}</span>
      </div>
      {view.levels.map((level, i) => (
        <div className="fortune-evaluate-row" key={i}>
          <div className="fortune-evaluate-ref">{level.reference}</div>
          <div
            className="fortune-evaluate-text"
            data-testid={`evaluate-level-${i}`}
            aria-live={i === view.levels.length - 1 ? "polite" : undefined}
          >
            {i > 0 && "= "}
            {level.segments.map((s, j) => (
              <span
                key={j}
                className={[
                  s.evaluated ? "fortune-evaluate-value" : "",
                  s.next ? "fortune-evaluate-next" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {s.text}
              </span>
            ))}
          </div>
        </div>
      ))}
      <p className="fortune-evaluate-hint">{t.hint}</p>
    </DialogShell>
  );
};
