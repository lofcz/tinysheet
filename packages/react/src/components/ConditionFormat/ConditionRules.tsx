import React, { useCallback, useContext, useId, useState } from "react";
import "./index.css";
import { addHighlightRule, locale } from "@lofcz/tinysheet-core";
import type { CFRule, CFStyle } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import FormatEditor, { FORMAT_PRESETS } from "./FormatEditor";
import { CFText, DATE_PERIODS, datePeriodText } from "./previews";

/** Quick rules of the Highlight Cells and Top/Bottom menus. */
export const QUICK_RULES = [
  "greaterThan",
  "lessThan",
  "between",
  "equal",
  "textContains",
  "occurrenceDate",
  "duplicateValue",
  "top10",
  "top10_percent",
  "last10",
  "last10_percent",
  "aboveAverage",
  "belowAverage",
] as const;

function activate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

function initialValues(type: string): string[] {
  if (type === "between") return ["", ""];
  if (type === "occurrenceDate") return ["yesterday"];
  if (type === "duplicateValue") return ["0"];
  if (type.startsWith("top10") || type.startsWith("last10")) return ["10"];
  if (type === "aboveAverage" || type === "belowAverage") return [];
  return [""];
}

/**
 * Excel's quick dialog: "Format cells that are GREATER THAN: [value] with
 * [Light Red Fill with Dark Red Text]". The rule applies to the selection.
 */
const ConditionRules: React.FC<{ type: string }> = ({ type }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const loc = locale(context);
  const text = loc.conditionformat as unknown as CFText;
  const { button } = loc;
  const id = useId();
  const [values, setValues] = useState<string[]>(() => initialValues(type));
  const [preset, setPreset] = useState("presetLightRed");
  const [custom, setCustom] = useState<CFStyle>(FORMAT_PRESETS[0].style);
  const [error, setError] = useState("");

  const setValue = (i: number, v: string) => {
    setValues((vs) => vs.map((x, j) => (j === i ? v : x)));
    setError("");
  };

  const confirm = useCallback(() => {
    const isRank = type.startsWith("top10") || type.startsWith("last10");
    if (isRank) {
      const n = Number(values[0]);
      const max = type.endsWith("_percent") ? 100 : 1000;
      if (!Number.isInteger(n) || n < 1 || n > max) {
        setError(text.pleaseEnterInteger);
        return;
      }
    } else if (
      ["greaterThan", "lessThan", "equal", "textContains", "between"].includes(
        type
      ) &&
      values.some((v) => `${v}`.trim() === "")
    ) {
      setError(text.enterValue);
      return;
    }
    const style =
      preset === "custom"
        ? custom
        : FORMAT_PRESETS.find((p) => p.key === preset)!.style;
    setContext((ctx) => {
      addHighlightRule(
        ctx,
        type as CFRule["conditionName"],
        isRank ? [Number(values[0])] : values,
        style
      );
    });
    hideDialog();
  }, [custom, hideDialog, preset, setContext, text, type, values]);

  const rank = type.startsWith("top10") || type.startsWith("last10");

  return (
    <div className="fortune-cf-dialog fortune-cf-quick">
      <div className="fortune-cf-title">{text[`qt_${type}`]}</div>
      <div className="fortune-cf-section-title">{text[`qd_${type}`]}</div>
      <div className="fortune-cf-inline fortune-cf-wrap">
        {(type === "greaterThan" ||
          type === "lessThan" ||
          type === "equal" ||
          type === "textContains") && (
          <input
            className="fortune-cf-input"
            type="text"
            aria-label={text.valueLabel}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={values[0]}
            onChange={(e) => setValue(0, e.target.value)}
          />
        )}
        {type === "between" && (
          <>
            <input
              className="fortune-cf-input"
              type="text"
              aria-label={text.valueLabel}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={values[0]}
              onChange={(e) => setValue(0, e.target.value)}
            />
            <span>{text.andLabel}</span>
            <input
              className="fortune-cf-input"
              type="text"
              aria-label={text.valueLabel}
              value={values[1]}
              onChange={(e) => setValue(1, e.target.value)}
            />
          </>
        )}
        {type === "occurrenceDate" && (
          <select
            className="fortune-cf-select"
            aria-label={text.datesOccurringOpt}
            value={values[0]}
            onChange={(e) => setValue(0, e.target.value)}
          >
            {DATE_PERIODS.map((p) => (
              <option key={p} value={p}>
                {datePeriodText(p, text)}
              </option>
            ))}
          </select>
        )}
        {type === "duplicateValue" && (
          <>
            <select
              className="fortune-cf-select"
              aria-label={text.formatAll}
              value={values[0]}
              onChange={(e) => setValue(0, e.target.value)}
            >
              <option value="0">{text.duplicateValue}</option>
              <option value="1">{text.uniqueValue}</option>
            </select>
            <span>{text.valuesWith}</span>
          </>
        )}
        {rank && (
          <>
            <input
              className="fortune-cf-input fortune-cf-input-narrow"
              type="number"
              min={1}
              aria-label={text.valueLabel}
              value={values[0]}
              onChange={(e) => setValue(0, e.target.value)}
            />
            {type.endsWith("_percent") && <span>%</span>}
          </>
        )}
        {(type === "aboveAverage" || type === "belowAverage") && (
          <span>{text.forSelectedRange}</span>
        )}
        <label htmlFor={`${id}-preset`}>{text.withLabel}</label>
        <select
          id={`${id}-preset`}
          className="fortune-cf-select fortune-cf-select-wide"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        >
          {FORMAT_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {text[p.key]}
            </option>
          ))}
          <option value="custom">{text.presetCustom}</option>
        </select>
      </div>
      {preset === "custom" && (
        <FormatEditor value={custom} onChange={setCustom} text={text} />
      )}
      {error && (
        <div className="fortune-cf-error" role="alert">
          {error}
        </div>
      )}
      <div className="fortune-cf-buttons">
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={confirm}
          onKeyDown={activate(confirm)}
        >
          {button.confirm}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={hideDialog}
          onKeyDown={activate(hideDialog)}
        >
          {button.cancel}
        </div>
      </div>
    </div>
  );
};

export default ConditionRules;
