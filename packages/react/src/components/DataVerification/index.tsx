import _ from "lodash";
import {
  confirmMessage,
  clearDataVerificationDialog,
  confirmDataVerification,
  dataToolsLocale,
  initDataVerificationDialog,
  locale,
  toAbsoluteReference,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useEffect, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import SVGIcon from "../SVGIcon";
import "./index.css";
import "./dataTools.css";
import DtCheck from "./DtCheck";

const NUMERIC_TYPES = [
  "number",
  "number_integer",
  "number_decimal",
  "date",
  "time",
  "text_length",
];

const OPERATORS = [
  "between",
  "notBetween",
  "equal",
  "notEqualTo",
  "moreThanThe",
  "lessThan",
  "greaterOrEqualTo",
  "lessThanOrEqualTo",
];

const DATE_ALIASES: Record<string, string> = {
  earlierThan: "lessThan",
  noEarlierThan: "greaterOrEqualTo",
  laterThan: "moreThanThe",
  noLaterThan: "lessThanOrEqualTo",
};

const ALLOW_TYPES = [
  "any",
  "number_integer",
  "number_decimal",
  "dropdown",
  "date",
  "time",
  "text_length",
  "custom",
  "checkbox",
  "text_content",
  "validity",
];

type Field = "rangeTxt" | "value1" | "value2";

/**
 * Excel's Data Validation dialog: Settings, Input Message and Error Alert
 * tabs over `ctx.dataVerification.dataRegulation`.
 *
 * `keepState` keeps the settings already in the context (the rules sidebar
 * prepares them before opening the dialog).
 */
const DataVerification: React.FC<{ keepState?: boolean }> = ({ keepState }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { dataVerification: dvLocale, generalDialog } = locale(context);
  const t = dataToolsLocale(context).dataValidation;
  const [tab, setTab] = useState<"settings" | "input" | "error">("settings");
  const [error, setError] = useState<string>("");
  const reg = context.dataVerification?.dataRegulation as any;

  useEffect(() => {
    setContext((ctx) => {
      const pick = ctx.rangeDialog?.type ?? "";
      const regulation = ctx.dataVerification?.dataRegulation as any;
      if (pick.startsWith("dv:") && regulation) {
        // back from the range picker: fill the field it was opened for
        const field = pick.slice(3) as Field;
        const picked = ctx.rangeDialog!.rangeTxt;
        if (picked) {
          regulation[field] =
            field === "rangeTxt" ? picked : `=${toAbsoluteReference(picked)}`;
        }
        ctx.rangeDialog!.type = "";
        ctx.rangeDialog!.rangeTxt = "";
        return;
      }
      if (!keepState || !regulation) initDataVerificationDialog(ctx);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (patch: Record<string, any>) => {
      setError("");
      setContext((ctx) => {
        const regulation = ctx.dataVerification?.dataRegulation as any;
        if (regulation) Object.assign(regulation, patch);
      });
    },
    [setContext]
  );

  const pickRange = useCallback(
    (field: Field) => {
      hideDialog();
      setContext((ctx) => {
        ctx.rangeDialog = {
          show: true,
          type: `dv:${field}`,
          rangeTxt: "",
          singleSelect: false,
        };
      });
    },
    [hideDialog, setContext]
  );

  const onOk = useCallback(() => {
    // check on a copy first so errors show inline, keeping the dialog open
    const probe = { ...context, warnDialog: undefined } as any;
    if (!confirmMessage(probe, generalDialog, dvLocale)) {
      setError(probe.warnDialog || t.invalidValue);
      return;
    }
    setContext((ctx) => {
      confirmDataVerification(ctx, generalDialog, dvLocale);
    });
    hideDialog();
  }, [context, dvLocale, generalDialog, hideDialog, setContext, t]);

  const onClearAll = useCallback(() => {
    setContext((ctx) => {
      clearDataVerificationDialog(ctx);
    });
    hideDialog();
  }, [hideDialog, setContext]);

  const onCancel = useCallback(() => {
    setContext((ctx) => {
      if (ctx.dataVerification) ctx.dataVerification.editingRuleId = undefined;
    });
    hideDialog();
  }, [hideDialog, setContext]);

  if (!reg) return null;

  const type: string = reg.type ?? "any";
  const op = DATE_ALIASES[reg.type2] ?? reg.type2;
  const twoValues = op === "between" || op === "notBetween";

  const rangeInput = (
    field: Field,
    value: string,
    placeholder?: string,
    id?: string
  ) => (
    <div className="fortune-dt-input-group">
      <input
        id={id}
        className="fortune-dt-input"
        spellCheck={false}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => update({ [field]: e.target.value })}
      />
      <div
        className="fortune-dt-picker"
        role="button"
        tabIndex={0}
        aria-label={dvLocale.selectCellRange}
        title={dvLocale.selectCellRange}
        onClick={() => pickRange(field)}
      >
        <SVGIcon name="tab" width={16} height={16} />
      </div>
    </div>
  );

  const boundLabels = (() => {
    if (type === "date") return [t.startDate, t.endDate, t.date];
    if (type === "time") return [t.startTime, t.endTime, t.time];
    if (type === "text_length") return [t.minimum, t.maximum, t.length];
    return [t.minimum, t.maximum, t.value];
  })();

  const settings = (
    <>
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-dv-range">
          {t.appliesTo}
        </label>
        {rangeInput("rangeTxt", reg.rangeTxt, "A1:A10", "fortune-dv-range")}
      </div>
      <div className="fortune-dt-row">
        <div className="fortune-dt-field">
          <label className="fortune-dt-label" htmlFor="fortune-dv-allow">
            {t.allow}
          </label>
          <select
            id="fortune-dv-allow"
            className="fortune-dt-select"
            value={type}
            onChange={(e) => {
              const next = e.target.value;
              let type2 = "";
              if (NUMERIC_TYPES.includes(next)) type2 = "between";
              else if (next === "text_content") type2 = "include";
              else if (next === "validity") type2 = "identificationNumber";
              update({ type: next, type2, value1: "", value2: "" });
            }}
          >
            {(ALLOW_TYPES.includes(type)
              ? ALLOW_TYPES
              : [...ALLOW_TYPES, type]
            ).map((v) => (
              <option key={v} value={v}>
                {t.types[v] ?? (dvLocale as any)[v] ?? v}
              </option>
            ))}
          </select>
        </div>
        {NUMERIC_TYPES.includes(type) && (
          <div className="fortune-dt-field">
            <label className="fortune-dt-label" htmlFor="fortune-dv-op">
              {t.data}
            </label>
            <select
              id="fortune-dv-op"
              className="fortune-dt-select"
              value={op}
              onChange={(e) => update({ type2: e.target.value })}
            >
              {OPERATORS.map((v) => (
                <option key={v} value={v}>
                  {t.operators[v]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {type !== "any" && type !== "checkbox" && (
        <DtCheck
          checked={reg.ignoreBlank !== false}
          onChange={(v) => update({ ignoreBlank: v })}
        >
          {t.ignoreBlank}
        </DtCheck>
      )}

      {NUMERIC_TYPES.includes(type) &&
        (twoValues ? (
          <div className="fortune-dt-row">
            <div className="fortune-dt-field">
              <span className="fortune-dt-label">{boundLabels[0]}</span>
              {rangeInput("value1", reg.value1, t.valueHint)}
            </div>
            <div className="fortune-dt-field">
              <span className="fortune-dt-label">{boundLabels[1]}</span>
              {rangeInput("value2", reg.value2, t.valueHint)}
            </div>
          </div>
        ) : (
          <div className="fortune-dt-field">
            <span className="fortune-dt-label">{boundLabels[2]}</span>
            {rangeInput("value1", reg.value1, t.valueHint)}
          </div>
        ))}

      {type === "dropdown" && (
        <>
          <div className="fortune-dt-field">
            <span className="fortune-dt-label">{t.source}</span>
            {rangeInput("value1", reg.value1, dvLocale.placeholder1)}
            <span className="fortune-dt-hint">{t.sourceHint}</span>
          </div>
          <DtCheck
            checked={reg.showDropdown !== false}
            onChange={(v) => update({ showDropdown: v })}
          >
            {t.inCellDropdown}
          </DtCheck>
          <DtCheck
            checked={reg.type2 === "true"}
            onChange={(v) => update({ type2: `${v}` })}
          >
            {dvLocale.allowMultiSelect}
          </DtCheck>
        </>
      )}

      {type === "custom" && (
        <div className="fortune-dt-field">
          <span className="fortune-dt-label">{t.formula}</span>
          <input
            className="fortune-dt-input"
            spellCheck={false}
            value={reg.value1 ?? ""}
            placeholder="=A1>0"
            onChange={(e) => update({ value1: e.target.value })}
          />
          <span className="fortune-dt-hint">{t.formulaHint}</span>
        </div>
      )}

      {type === "checkbox" && (
        <div className="fortune-dt-row">
          <div className="fortune-dt-field">
            <span className="fortune-dt-label">{dvLocale.selected}</span>
            <input
              className="fortune-dt-input"
              value={reg.value1 ?? ""}
              placeholder={dvLocale.placeholder2}
              onChange={(e) => update({ value1: e.target.value })}
            />
          </div>
          <div className="fortune-dt-field">
            <span className="fortune-dt-label">{dvLocale.notSelected}</span>
            <input
              className="fortune-dt-input"
              value={reg.value2 ?? ""}
              placeholder={dvLocale.placeholder2}
              onChange={(e) => update({ value2: e.target.value })}
            />
          </div>
        </div>
      )}

      {type === "text_content" && (
        <div className="fortune-dt-row">
          <div className="fortune-dt-field">
            <span className="fortune-dt-label">{t.data}</span>
            <select
              className="fortune-dt-select"
              value={reg.type2}
              onChange={(e) => update({ type2: e.target.value })}
            >
              {["include", "exclude", "equal"].map((v) => (
                <option key={v} value={v}>
                  {(dvLocale as any)[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="fortune-dt-field">
            <span className="fortune-dt-label">{t.value}</span>
            <input
              className="fortune-dt-input"
              value={reg.value1 ?? ""}
              placeholder={dvLocale.placeholder4}
              onChange={(e) => update({ value1: e.target.value })}
            />
          </div>
        </div>
      )}

      {type === "validity" && (
        <div className="fortune-dt-field">
          <span className="fortune-dt-label">{t.data}</span>
          <select
            className="fortune-dt-select"
            value={reg.type2}
            onChange={(e) => update({ type2: e.target.value })}
          >
            {["identificationNumber", "phoneNumber"].map((v) => (
              <option key={v} value={v}>
                {(dvLocale as any)[v]}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );

  const inputMessage = (
    <>
      <DtCheck
        checked={!!reg.hintShow}
        onChange={(v) => update({ hintShow: v })}
      >
        {t.showInputMessage}
      </DtCheck>
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-dv-hint-title">
          {t.messageTitle}
        </label>
        <input
          id="fortune-dv-hint-title"
          className="fortune-dt-input"
          value={reg.hintTitle ?? ""}
          onChange={(e) => update({ hintTitle: e.target.value })}
        />
      </div>
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-dv-hint">
          {t.message}
        </label>
        <textarea
          id="fortune-dv-hint"
          className="fortune-dt-textarea"
          value={reg.hintValue ?? ""}
          placeholder={dvLocale.placeholder5}
          onChange={(e) => update({ hintValue: e.target.value })}
        />
      </div>
      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-dv-placeholder">
          {t.placeholder}
        </label>
        <input
          id="fortune-dv-placeholder"
          className="fortune-dt-input"
          value={reg.placeholder ?? ""}
          onChange={(e) => update({ placeholder: e.target.value })}
        />
      </div>
    </>
  );

  const style = reg.errorStyle ?? "stop";
  const errorAlert = (
    <>
      <DtCheck
        checked={!!reg.prohibitInput}
        onChange={(v) => update({ prohibitInput: v })}
      >
        {t.showErrorAlert}
      </DtCheck>
      <div className="fortune-dt-row" style={{ alignItems: "flex-start" }}>
        <div className="fortune-dt-field" style={{ flex: "0 0 150px" }}>
          <label className="fortune-dt-label" htmlFor="fortune-dv-style">
            {t.style}
          </label>
          <select
            id="fortune-dv-style"
            className="fortune-dt-select"
            value={style}
            onChange={(e) => update({ errorStyle: e.target.value })}
          >
            {["stop", "warning", "information"].map((v) => (
              <option key={v} value={v}>
                {t.styles[v]}
              </option>
            ))}
          </select>
          <div
            className={`fortune-dt-alert-icon ${style}`}
            style={{ marginTop: 12, marginLeft: 8 }}
            aria-hidden="true"
          >
            {{ stop: "×", warning: "!", information: "i" }[style as string]}
          </div>
        </div>
        <div className="fortune-dt-field">
          <label className="fortune-dt-label" htmlFor="fortune-dv-err-title">
            {t.errorTitle}
          </label>
          <input
            id="fortune-dv-err-title"
            className="fortune-dt-input"
            value={reg.errorTitle ?? ""}
            onChange={(e) => update({ errorTitle: e.target.value })}
          />
          <label
            className="fortune-dt-label"
            htmlFor="fortune-dv-err-message"
            style={{ marginTop: 8 }}
          >
            {t.errorMessage}
          </label>
          <textarea
            id="fortune-dv-err-message"
            className="fortune-dt-textarea"
            value={reg.errorMessage ?? ""}
            onChange={(e) => update({ errorMessage: e.target.value })}
          />
        </div>
      </div>
    </>
  );

  return (
    <div id="fortune-data-verification" className="fortune-dt-dialog">
      <div className="fortune-dt-title">{t.title}</div>
      <div className="fortune-dt-tabs" role="tablist">
        {(
          [
            ["settings", t.settings],
            ["input", t.inputMessage],
            ["error", t.errorAlert],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            role="tab"
            tabIndex={0}
            aria-selected={tab === key}
            className={`fortune-dt-tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setTab(key);
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{ minHeight: 260 }}>
        {tab === "settings" && settings}
        {tab === "input" && inputMessage}
        {tab === "error" && errorAlert}
      </div>
      {!_.isEmpty(error) && <div className="fortune-dt-error">{error}</div>}
      <div className="fortune-dt-buttons">
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={onClearAll}
        >
          {t.clearAll}
        </div>
        <div className="fortune-dt-spacer" />
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={onOk}
        >
          {t.ok}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={onCancel}
        >
          {t.cancel}
        </div>
      </div>
    </div>
  );
};

export default DataVerification;
