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
import { activateOnKey } from "../Toolbar/Button";

const TextButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, primary, disabled, children }) => (
  <div
    className={`button-basic ${primary ? "button-primary" : "button-default"}`}
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled || undefined}
    onClick={() => {
      if (!disabled) onClick();
    }}
    onKeyDown={activateOnKey}
  >
    {children}
  </div>
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
    <div className="fortune-audit-dialog fortune-calc-options">
      <div className="fortune-audit-dialog-title">{t.options}</div>
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
      <div className="fortune-audit-footer">
        <TextButton primary onClick={save}>
          {t.ok}
        </TextButton>
        <TextButton onClick={hideDialog}>{t.cancel}</TextButton>
      </div>
    </div>
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
    <div className="fortune-audit-dialog fortune-error-options">
      <div className="fortune-audit-dialog-title">{t.checking}</div>
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
      <div className="fortune-audit-footer">
        <TextButton
          onClick={() => {
            setContext((ctx) => resetIgnoredErrors(ctx));
          }}
        >
          {t.resetIgnored}
        </TextButton>
        <span className="fortune-audit-spacer" />
        <TextButton primary onClick={save}>
          {all.calc.ok}
        </TextButton>
        <TextButton onClick={hideDialog}>{all.calc.cancel}</TextButton>
      </div>
    </div>
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
      <div className="fortune-audit-dialog">
        <div className="fortune-audit-dialog-title">{t.title}</div>
        <p>{t.noFormula}</p>
        <div className="fortune-audit-footer">
          <TextButton onClick={hideDialog}>{t.close}</TextButton>
        </div>
      </div>
    );
  }
  const view = getEvaluationView(context, session);
  const act = (fn: () => void) => {
    fn();
    rerender();
  };
  return (
    <div className="fortune-audit-dialog fortune-evaluate" role="document">
      <div className="fortune-audit-dialog-title">{t.title}</div>
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
      <div className="fortune-audit-footer">
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
      </div>
    </div>
  );
};
