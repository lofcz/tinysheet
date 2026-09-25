import React, { useCallback, useId, useMemo, useState } from "react";
import {
  CF_ICON_SET_GROUPS,
  makeDataBar,
  makeIconSet,
  normalizeRule,
  parseSqref,
  formatSqref,
  iconSetSize,
} from "@lofcz/tinysheet-core";
import type {
  CFColorScaleStop,
  CFDataBar,
  CFIconSet,
  CFIconSetName,
  CFRule,
  CFValueObject,
  CFValueType,
  CFStyle,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import { Button, DialogShell } from "../ui";
import FormatEditor from "./FormatEditor";
import { CFText, DATE_PERIODS, IconCanvas, datePeriodText } from "./previews";

type Kind =
  | "values"
  | "contains"
  | "topBottom"
  | "average"
  | "unique"
  | "formula";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "values", label: "ruleTypeItem1" },
  { kind: "contains", label: "ruleTypeItem2" },
  { kind: "topBottom", label: "ruleTypeItem3" },
  { kind: "average", label: "ruleTypeItem4" },
  { kind: "unique", label: "ruleTypeItem5" },
  { kind: "formula", label: "ruleTypeItem6" },
];

const VALUE_OPERATORS: { name: string; label: string }[] = [
  { name: "between", label: "opBetween" },
  { name: "notBetween", label: "opNotBetween" },
  { name: "equal", label: "opEqual" },
  { name: "notEqual", label: "opNotEqual" },
  { name: "greaterThan", label: "opGreater" },
  { name: "lessThan", label: "opLess" },
  { name: "greaterThanOrEqual", label: "opGreaterEq" },
  { name: "lessThanOrEqual", label: "opLessEq" },
];

const TEXT_OPERATORS: { name: string; label: string }[] = [
  { name: "textContains", label: "opContaining" },
  { name: "textNotContains", label: "opNotContaining" },
  { name: "textBeginsWith", label: "opBeginsWith" },
  { name: "textEndsWith", label: "opEndsWith" },
];

const CONTAINS_GROUPS: { key: string; label: string }[] = [
  { key: "value", label: "cellValueOpt" },
  { key: "text", label: "specificTextOpt" },
  { key: "occurrenceDate", label: "datesOccurringOpt" },
  { key: "blanks", label: "blanksOpt" },
  { key: "noBlanks", label: "noBlanksOpt" },
  { key: "errors", label: "errorsOpt" },
  { key: "noErrors", label: "noErrorsOpt" },
];

const AVERAGE_OPTIONS: {
  key: string;
  name: "aboveAverage" | "belowAverage";
  equal?: boolean;
  std?: number;
}[] = [
  { key: "avgAbove", name: "aboveAverage" },
  { key: "avgBelow", name: "belowAverage" },
  { key: "avgEqualAbove", name: "aboveAverage", equal: true },
  { key: "avgEqualBelow", name: "belowAverage", equal: true },
  { key: "std1a", name: "aboveAverage", std: 1 },
  { key: "std2a", name: "aboveAverage", std: 2 },
  { key: "std3a", name: "aboveAverage", std: 3 },
  { key: "std1b", name: "belowAverage", std: 1 },
  { key: "std2b", name: "belowAverage", std: 2 },
  { key: "std3b", name: "belowAverage", std: 3 },
];

function kindOf(rule: CFRule): Kind {
  if (rule.type !== "default") return "values";
  const n = rule.conditionName ?? "";
  if (n.startsWith("top10") || n.startsWith("last10")) return "topBottom";
  if (n === "aboveAverage" || n === "belowAverage") return "average";
  if (n === "duplicateValue") return "unique";
  if (n === "formula") return "formula";
  return "contains";
}

function containsGroup(name = "") {
  if (VALUE_OPERATORS.some((o) => o.name === name)) return "value";
  if (TEXT_OPERATORS.some((o) => o.name === name)) return "text";
  return name;
}

const DEFAULT_STYLE: CFStyle = { cellColor: "#FFC7CE", textColor: "#9C0006" };

function defaultRule(kind: Kind, base: CFRule): CFRule {
  const common = {
    cellrange: base.cellrange,
    stopIfTrue: base.stopIfTrue,
  };
  const format =
    base.type === "default" && base.format && !Array.isArray(base.format)
      ? base.format
      : DEFAULT_STYLE;
  switch (kind) {
    case "values":
      return {
        ...common,
        type: "colorGradation",
        colorScale: {
          stops: [
            { type: "min", color: "#F8696B" },
            { type: "max", color: "#63BE7B" },
          ],
        },
      };
    case "contains":
      return {
        ...common,
        type: "default",
        conditionName: "between",
        conditionValue: ["", ""],
        format,
      };
    case "topBottom":
      return {
        ...common,
        type: "default",
        conditionName: "top10",
        conditionValue: [10],
        format,
      };
    case "average":
      return {
        ...common,
        type: "default",
        conditionName: "aboveAverage",
        conditionValue: [],
        format,
      };
    case "unique":
      return {
        ...common,
        type: "default",
        conditionName: "duplicateValue",
        conditionValue: ["0"],
        format,
      };
    default:
      return {
        ...common,
        type: "default",
        conditionName: "formula",
        conditionValue: [""],
        format,
      };
  }
}

const ValueTypeSelect: React.FC<{
  value: CFValueType;
  options: CFValueType[];
  onChange: (t: CFValueType) => void;
  text: CFText;
  label: string;
}> = ({ value, options, onChange, text, label }) => {
  const labels: Record<CFValueType, string> = {
    min: text.vtLowest,
    max: text.vtHighest,
    autoMin: text.vtAutomatic,
    autoMax: text.vtAutomatic,
    num: text.vtNumber,
    percent: text.vtPercent,
    percentile: text.vtPercentile,
    formula: text.vtFormula,
  };
  return (
    <select
      className="fortune-cf-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as CFValueType)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o]}
        </option>
      ))}
    </select>
  );
};

function needsValue(t: CFValueType) {
  return (
    t === "num" || t === "percent" || t === "percentile" || t === "formula"
  );
}

function defaultValueFor(t: CFValueType, pos: "min" | "mid" | "max") {
  if (t === "num") return 0;
  if (t === "formula") return "";
  if (pos === "min") return 0;
  if (pos === "max") return 100;
  return 50;
}

const ValueInput: React.FC<{
  vo: CFValueObject;
  onChange: (vo: CFValueObject) => void;
  label: string;
}> = ({ vo, onChange, label }) => (
  <input
    className="fortune-cf-input"
    type="text"
    aria-label={label}
    disabled={!needsValue(vo.type)}
    value={needsValue(vo.type) ? `${vo.value ?? ""}` : ""}
    onChange={(e) => {
      const raw = e.target.value;
      const n = Number(raw);
      onChange({
        ...vo,
        value:
          vo.type !== "formula" && raw.trim() !== "" && !Number.isNaN(n)
            ? n
            : raw,
      });
    }}
  />
);

const ColorScaleEditor: React.FC<{
  stops: CFColorScaleStop[];
  onChange: (s: CFColorScaleStop[]) => void;
  text: CFText;
}> = ({ stops, onChange, text }) => {
  const positions = stops.length === 3 ? ["min", "mid", "max"] : ["min", "max"];
  const heads: Record<string, string> = {
    min: text.minimum,
    mid: text.midpoint,
    max: text.maximum,
  };
  const optionsFor = (pos: string): CFValueType[] => {
    if (pos === "min")
      return ["min", "num", "percent", "percentile", "formula"];
    if (pos === "max")
      return ["max", "num", "percent", "percentile", "formula"];
    return ["num", "percent", "percentile", "formula"];
  };
  const update = (i: number, patch: Partial<CFColorScaleStop>) => {
    const next = stops.map((s, j) => (i === j ? { ...s, ...patch } : s));
    onChange(next);
  };
  return (
    <div className="fortune-cf-columns">
      <div className="fortune-cf-column fortune-cf-column-labels">
        <span />
        <span>{text.typeLabel}</span>
        <span>{text.valueLabel}</span>
        <span>{text.colorLabel}</span>
      </div>
      {positions.map((pos, i) => (
        <div className="fortune-cf-column" key={pos}>
          <span className="fortune-cf-label">{heads[pos]}</span>
          <ValueTypeSelect
            value={stops[i].type}
            options={optionsFor(pos)}
            text={text}
            label={`${heads[pos]} ${text.typeLabel}`}
            onChange={(t) =>
              update(i, {
                type: t,
                value: needsValue(t)
                  ? defaultValueFor(t, pos as "min" | "mid" | "max")
                  : undefined,
              })
            }
          />
          <ValueInput
            vo={stops[i]}
            label={`${heads[pos]} ${text.valueLabel}`}
            onChange={(vo) => update(i, { value: vo.value })}
          />
          <input
            type="color"
            className="fortune-cf-color"
            aria-label={`${heads[pos]} ${text.colorLabel}`}
            value={stops[i].color}
            onChange={(e) => update(i, { color: e.target.value.toUpperCase() })}
          />
        </div>
      ))}
    </div>
  );
};

const DataBarEditor: React.FC<{
  bar: CFDataBar;
  onChange: (b: CFDataBar) => void;
  text: CFText;
}> = ({ bar, onChange, text }) => {
  const id = useId();
  const set = (patch: Partial<CFDataBar>) => onChange({ ...bar, ...patch });
  const minVo = bar.min ?? { type: "autoMin" };
  const maxVo = bar.max ?? { type: "autoMax" };
  return (
    <div className="fortune-cf-databar">
      <div className="fortune-cf-columns">
        <div className="fortune-cf-column fortune-cf-column-labels">
          <span />
          <span>{text.typeLabel}</span>
          <span>{text.valueLabel}</span>
        </div>
        {(
          [
            ["min", minVo, text.minimum],
            ["max", maxVo, text.maximum],
          ] as const
        ).map(([pos, vo, head]) => (
          <div className="fortune-cf-column" key={pos}>
            <span className="fortune-cf-label">{head}</span>
            <ValueTypeSelect
              value={vo.type}
              text={text}
              label={`${head} ${text.typeLabel}`}
              options={[
                pos === "min" ? "autoMin" : "autoMax",
                pos === "min" ? "min" : "max",
                "num",
                "percent",
                "percentile",
                "formula",
              ]}
              onChange={(t) =>
                set({
                  [pos]: {
                    type: t,
                    value: needsValue(t) ? defaultValueFor(t, pos) : undefined,
                  },
                })
              }
            />
            <ValueInput
              vo={vo}
              label={`${head} ${text.valueLabel}`}
              onChange={(next) => set({ [pos]: next })}
            />
          </div>
        ))}
      </div>
      <div className="fortune-cf-section-title">{text.barAppearance}</div>
      <div className="fortune-cf-grid2">
        <label htmlFor={`${id}-fill`}>{text.fillLabel}</label>
        <span className="fortune-cf-inline">
          <select
            id={`${id}-fill`}
            className="fortune-cf-select"
            value={bar.gradient ? "gradient" : "solid"}
            onChange={(e) => set({ gradient: e.target.value === "gradient" })}
          >
            <option value="gradient">{text.gradientFill}</option>
            <option value="solid">{text.solidFill}</option>
          </select>
          <input
            type="color"
            className="fortune-cf-color"
            aria-label={text.colorLabel}
            value={bar.color}
            onChange={(e) =>
              set({
                color: e.target.value.toUpperCase(),
                borderColor: e.target.value.toUpperCase(),
              })
            }
          />
        </span>
        <label htmlFor={`${id}-border`}>{text.borderLabel}</label>
        <span className="fortune-cf-inline">
          <select
            id={`${id}-border`}
            className="fortune-cf-select"
            value={(bar.border ?? bar.gradient) ? "solid" : "none"}
            onChange={(e) => set({ border: e.target.value === "solid" })}
          >
            <option value="none">{text.noBorder}</option>
            <option value="solid">{text.solidBorder}</option>
          </select>
          <input
            type="color"
            className="fortune-cf-color"
            aria-label={text.borderLabel}
            disabled={!(bar.border ?? bar.gradient)}
            value={bar.borderColor ?? bar.color}
            onChange={(e) => set({ borderColor: e.target.value.toUpperCase() })}
          />
        </span>
        <label htmlFor={`${id}-neg`}>{text.negativeBarColor}</label>
        <span className="fortune-cf-inline">
          <input
            id={`${id}-neg`}
            type="color"
            className="fortune-cf-color"
            disabled={!!bar.sameNegativeColor}
            value={bar.negativeColor ?? "#FF0000"}
            onChange={(e) =>
              set({
                negativeColor: e.target.value.toUpperCase(),
                negativeBorderColor: e.target.value.toUpperCase(),
              })
            }
          />
          <label className="fortune-cf-check" htmlFor={`${id}-c1`}>
            <input
              id={`${id}-c1`}
              type="checkbox"
              checked={!!bar.sameNegativeColor}
              onChange={(e) => set({ sameNegativeColor: e.target.checked })}
            />
            {text.sameAsPositive}
          </label>
        </span>
        <label htmlFor={`${id}-axis`}>{text.axisSetting}</label>
        <span className="fortune-cf-inline">
          <select
            id={`${id}-axis`}
            className="fortune-cf-select fortune-cf-select-wide"
            value={bar.axisPosition ?? "automatic"}
            onChange={(e) =>
              set({ axisPosition: e.target.value as CFDataBar["axisPosition"] })
            }
          >
            <option value="automatic">{text.axisAutomatic}</option>
            <option value="midpoint">{text.axisMidpoint}</option>
            <option value="none">{text.axisNone}</option>
          </select>
          <input
            type="color"
            className="fortune-cf-color"
            aria-label={text.axisColor}
            value={bar.axisColor ?? "#000000"}
            onChange={(e) => set({ axisColor: e.target.value.toUpperCase() })}
          />
        </span>
        <label htmlFor={`${id}-dir`}>{text.barDirection}</label>
        <select
          id={`${id}-dir`}
          className="fortune-cf-select"
          value={bar.direction ?? "context"}
          onChange={(e) =>
            set({ direction: e.target.value as CFDataBar["direction"] })
          }
        >
          <option value="context">{text.dirContext}</option>
          <option value="leftToRight">{text.dirLTR}</option>
          <option value="rightToLeft">{text.dirRTL}</option>
        </select>
      </div>
      <label className="fortune-cf-check" htmlFor={`${id}-c2`}>
        <input
          id={`${id}-c2`}
          type="checkbox"
          checked={bar.showValue === false}
          onChange={(e) => set({ showValue: !e.target.checked })}
        />
        {text.showBarOnly}
      </label>
    </div>
  );
};

const IconSetEditor: React.FC<{
  set: CFIconSet;
  onChange: (s: CFIconSet) => void;
  text: CFText;
}> = ({ set, onChange, text }) => {
  const id = useId();
  const n = iconSetSize(set.name);
  const update = (k: number, vo: CFValueObject) =>
    onChange({
      ...set,
      thresholds: set.thresholds.map((t, i) => (i === k ? vo : t)),
    });
  const iconAt = (level: number) => (set.reverse ? n - 1 - level : level);
  const rows = Array.from({ length: n - 1 }, (_v, i) => n - 2 - i);
  return (
    <div className="fortune-cf-iconsets">
      <div className="fortune-cf-grid2">
        <label htmlFor={`${id}-style`}>{text.iconStyle}</label>
        <span className="fortune-cf-inline">
          <select
            id={`${id}-style`}
            className="fortune-cf-select fortune-cf-select-wide"
            value={set.name}
            onChange={(e) =>
              onChange(
                makeIconSet(e.target.value as CFIconSetName, {
                  reverse: set.reverse,
                  showValue: set.showValue,
                })
              )
            }
          >
            {CF_ICON_SET_GROUPS.map((g) => (
              <optgroup key={g.key} label={text[`isGroup_${g.key}`]}>
                {g.sets.map((name) => (
                  <option key={name} value={name}>
                    {text[`is_${name}`] ?? name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </span>
      </div>
      <div className="fortune-cf-inline">
        <label className="fortune-cf-check" htmlFor={`${id}-c3`}>
          <input
            id={`${id}-c3`}
            type="checkbox"
            checked={!!set.reverse}
            onChange={(e) => onChange({ ...set, reverse: e.target.checked })}
          />
          {text.reverseIconOrder}
        </label>
        <label className="fortune-cf-check" htmlFor={`${id}-c4`}>
          <input
            id={`${id}-c4`}
            type="checkbox"
            checked={set.showValue === false}
            onChange={(e) => onChange({ ...set, showValue: !e.target.checked })}
          />
          {text.showIconOnly}
        </label>
      </div>
      <div className="fortune-cf-section-title">{text.displayIcon}</div>
      <table className="fortune-cf-icon-table">
        <thead>
          <tr>
            <th>{text.iconLabel}</th>
            <th aria-label={text.operatorLabel} />
            <th>{text.valueLabel}</th>
            <th>{text.typeLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => {
            const vo = set.thresholds[k] ?? { type: "percent", value: 0 };
            return (
              <tr key={k}>
                <td>
                  <IconCanvas set={set.name} index={iconAt(k + 1)} size={16} />
                </td>
                <td>
                  <select
                    className="fortune-cf-select fortune-cf-select-narrow"
                    aria-label={text.whenValueIs}
                    value={vo.gte === false ? ">" : ">="}
                    onChange={(e) =>
                      update(k, { ...vo, gte: e.target.value === ">=" })
                    }
                  >
                    <option value=">=">&gt;=</option>
                    <option value=">">&gt;</option>
                  </select>
                </td>
                <td>
                  <ValueInput
                    vo={vo}
                    label={text.valueLabel}
                    onChange={(next) => update(k, next)}
                  />
                </td>
                <td>
                  <ValueTypeSelect
                    value={vo.type}
                    text={text}
                    label={text.typeLabel}
                    options={["num", "percent", "percentile", "formula"]}
                    onChange={(t) =>
                      update(k, {
                        ...vo,
                        type: t,
                        value: t === "formula" ? "" : (vo.value ?? 0),
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              <IconCanvas set={set.name} index={iconAt(0)} size={16} />
            </td>
            <td colSpan={3} className="fortune-cf-muted">
              {text.otherwise}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/**
 * New / Edit Formatting Rule. Works on a local copy and hands the finished
 * rule to `onOk`; the caller stores it (one undo step).
 */
const RuleEditor: React.FC<{
  rule: CFRule;
  isNew: boolean;
  text: CFText;
  buttons: { confirm: string; cancel: string };
  onOk: (rule: CFRule) => void;
  onCancel: () => void;
}> = ({ rule: initial, isNew, text, buttons, onOk, onCancel }) => {
  const id = useId();
  const [rule, setRule] = useState<CFRule>(() =>
    _.cloneDeep(normalizeRule(initial))
  );
  const [range, setRange] = useState(() => formatSqref(initial.cellrange));
  const [error, setError] = useState("");
  const kind = kindOf(rule);
  const patch = useCallback(
    (p: Partial<CFRule>) => setRule((r) => ({ ...r, ...p })),
    []
  );

  const valueStyle = useMemo(() => {
    if (rule.type === "dataBar") return "dataBar";
    if (rule.type === "icons") return "icons";
    return (rule.colorScale?.stops.length ?? 2) === 3 ? "3color" : "2color";
  }, [rule.type, rule.colorScale]);

  const setValueStyle = (style: string) => {
    const base = { cellrange: rule.cellrange, stopIfTrue: rule.stopIfTrue };
    if (style === "dataBar") {
      setRule({
        ...base,
        type: "dataBar",
        dataBar: makeDataBar("#638EC6", true),
      });
    } else if (style === "icons") {
      setRule({
        ...base,
        type: "icons",
        iconSet: makeIconSet("3TrafficLights1"),
      });
    } else {
      setRule({
        ...base,
        type: "colorGradation",
        colorScale: {
          stops:
            style === "3color"
              ? [
                  { type: "min", color: "#F8696B" },
                  { type: "percentile", value: 50, color: "#FFEB84" },
                  { type: "max", color: "#63BE7B" },
                ]
              : [
                  { type: "min", color: "#F8696B" },
                  { type: "max", color: "#63BE7B" },
                ],
        },
      });
    }
  };

  const values = rule.conditionValue ?? [];
  const setValue = (i: number, v: any) => {
    const next = values.slice();
    next[i] = v;
    patch({ conditionValue: next });
  };

  const validate = (): string => {
    const ranges = parseSqref(range);
    if (!ranges) return text.invalidRange;
    if (rule.type === "default") {
      const name = rule.conditionName ?? "";
      const empty = (v: any) =>
        v === undefined || v === null || `${v}`.trim() === "";
      if (
        (containsGroup(name) === "value" || containsGroup(name) === "text") &&
        empty(values[0])
      ) {
        return text.enterValue;
      }
      if ((name === "between" || name === "notBetween") && empty(values[1])) {
        return text.enterValue;
      }
      if (name === "formula" && empty(values[0])) return text.enterFormula;
      if (kind === "topBottom") {
        const n = Number(values[0]);
        const max = name.endsWith("_percent") ? 100 : 1000;
        if (!Number.isInteger(n) || n < 1 || n > max) {
          return text.pleaseEnterInteger;
        }
      }
    }
    return "";
  };

  const confirm = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const out: CFRule = { ...rule, cellrange: parseSqref(range)! };
    if (out.type === "default") {
      delete out.dataBar;
      delete out.colorScale;
      delete out.iconSet;
    }
    onOk(out);
  };

  const group = containsGroup(rule.conditionName);
  const top = (rule.conditionName ?? "").startsWith("top10");
  const percent = (rule.conditionName ?? "").endsWith("_percent");
  const avgKey =
    AVERAGE_OPTIONS.find(
      (o) =>
        o.name === rule.conditionName &&
        !!o.equal === !!rule.equalAverage &&
        (o.std ?? 0) === (rule.stdDev ?? 0)
    )?.key ?? "avgAbove";

  return (
    <DialogShell
      title={isNew ? text.newFormatRule : text.editFormatRule}
      className="fortune-cf-dialog fortune-cf-editor"
      onClose={onCancel}
      onConfirm={confirm}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {buttons.cancel}
          </Button>
          <Button variant="primary" onClick={confirm}>
            {buttons.confirm}
          </Button>
        </>
      }
    >
      <div className="fortune-cf-section-title">{text.selectRuleType}</div>
      <div
        className="fortune-cf-kinds"
        role="listbox"
        aria-label={text.selectRuleType}
      >
        {KINDS.map((k) => (
          <div
            key={k.kind}
            role="option"
            tabIndex={0}
            aria-selected={kind === k.kind}
            className={`fortune-cf-kind${kind === k.kind ? " selected" : ""}`}
            onClick={() => {
              if (kind !== k.kind) setRule(defaultRule(k.kind, rule));
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && kind !== k.kind) {
                e.preventDefault();
                setRule(defaultRule(k.kind, rule));
              }
            }}
          >
            {text[k.label]}
          </div>
        ))}
      </div>

      <div className="fortune-cf-section-title">{text.editRuleDescription}</div>
      <div className="fortune-cf-description">
        {kind === "values" && (
          <>
            <div className="fortune-cf-inline">
              <label htmlFor={`${id}-vstyle`}>{text.formatStyleLabel}</label>
              <select
                id={`${id}-vstyle`}
                className="fortune-cf-select"
                value={valueStyle}
                onChange={(e) => setValueStyle(e.target.value)}
              >
                <option value="2color">{text.twoColorScale}</option>
                <option value="3color">{text.threeColorScale}</option>
                <option value="dataBar">{text.dataBarStyle}</option>
                <option value="icons">{text.iconSetStyle}</option>
              </select>
            </div>
            {rule.type === "colorGradation" && rule.colorScale && (
              <ColorScaleEditor
                stops={rule.colorScale.stops}
                text={text}
                onChange={(stops) => patch({ colorScale: { stops } })}
              />
            )}
            {rule.type === "dataBar" && rule.dataBar && (
              <DataBarEditor
                bar={rule.dataBar}
                text={text}
                onChange={(dataBar) =>
                  patch({ dataBar, format: [dataBar.color] })
                }
              />
            )}
            {rule.type === "icons" && rule.iconSet && (
              <IconSetEditor
                set={rule.iconSet}
                text={text}
                onChange={(iconSet) => patch({ iconSet })}
              />
            )}
          </>
        )}

        {kind === "contains" && (
          <div className="fortune-cf-inline fortune-cf-wrap">
            <span>{text.formatOnlyCellsWith}</span>
            <select
              className="fortune-cf-select"
              aria-label={text.formatOnlyCellsWith}
              value={group}
              onChange={(e) => {
                const g = e.target.value;
                if (g === "value") {
                  patch({ conditionName: "between", conditionValue: ["", ""] });
                } else if (g === "text") {
                  patch({
                    conditionName: "textContains",
                    conditionValue: [""],
                  });
                } else if (g === "occurrenceDate") {
                  patch({
                    conditionName: "occurrenceDate",
                    conditionValue: ["yesterday"],
                  });
                } else {
                  patch({
                    conditionName: g as CFRule["conditionName"],
                    conditionValue: [],
                  });
                }
              }}
            >
              {CONTAINS_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {text[g.label]}
                </option>
              ))}
            </select>
            {(group === "value" || group === "text") && (
              <select
                className="fortune-cf-select"
                aria-label={text.operatorLabel}
                value={rule.conditionName}
                onChange={(e) =>
                  patch({
                    conditionName: e.target.value as CFRule["conditionName"],
                  })
                }
              >
                {(group === "value" ? VALUE_OPERATORS : TEXT_OPERATORS).map(
                  (o) => (
                    <option key={o.name} value={o.name}>
                      {text[o.label]}
                    </option>
                  )
                )}
              </select>
            )}
            {(group === "value" || group === "text") && (
              <input
                className="fortune-cf-input"
                type="text"
                aria-label={text.valueLabel}
                value={values[0] ?? ""}
                onChange={(e) => setValue(0, e.target.value)}
              />
            )}
            {(rule.conditionName === "between" ||
              rule.conditionName === "notBetween") && (
              <>
                <span>{text.andLabel}</span>
                <input
                  className="fortune-cf-input"
                  type="text"
                  aria-label={text.valueLabel}
                  value={values[1] ?? ""}
                  onChange={(e) => setValue(1, e.target.value)}
                />
              </>
            )}
            {group === "occurrenceDate" && (
              <select
                className="fortune-cf-select"
                aria-label={text.datesOccurringOpt}
                value={values[0] ?? "yesterday"}
                onChange={(e) => setValue(0, e.target.value)}
              >
                {DATE_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {datePeriodText(p, text)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {kind === "topBottom" && (
          <div className="fortune-cf-inline fortune-cf-wrap">
            <span>{text.formatValuesRanked}</span>
            <select
              className="fortune-cf-select"
              aria-label={text.formatValuesRanked}
              value={top ? "top" : "bottom"}
              onChange={(e) =>
                patch({
                  conditionName: `${
                    e.target.value === "top" ? "top10" : "last10"
                  }${percent ? "_percent" : ""}` as CFRule["conditionName"],
                })
              }
            >
              <option value="top">{text.topLabel}</option>
              <option value="bottom">{text.bottomLabel}</option>
            </select>
            <input
              className="fortune-cf-input fortune-cf-input-narrow"
              type="number"
              min={1}
              aria-label={text.valueLabel}
              value={values[0] ?? 10}
              onChange={(e) => setValue(0, e.target.value)}
            />
            <label className="fortune-cf-check" htmlFor={`${id}-c5`}>
              <input
                id={`${id}-c5`}
                type="checkbox"
                checked={percent}
                onChange={(e) =>
                  patch({
                    conditionName: `${top ? "top10" : "last10"}${
                      e.target.checked ? "_percent" : ""
                    }` as CFRule["conditionName"],
                  })
                }
              />
              {text.percentOfRange}
            </label>
          </div>
        )}

        {kind === "average" && (
          <div className="fortune-cf-inline fortune-cf-wrap">
            <span>{text.formatValuesThatAre}</span>
            <select
              className="fortune-cf-select"
              aria-label={text.formatValuesThatAre}
              value={avgKey}
              onChange={(e) => {
                const o = AVERAGE_OPTIONS.find(
                  (x) => x.key === e.target.value
                )!;
                patch({
                  conditionName: o.name,
                  equalAverage: o.equal || undefined,
                  stdDev: o.std,
                });
              }}
            >
              {AVERAGE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.std
                    ? (o.name === "aboveAverage"
                        ? text.stdDevAbove
                        : text.stdDevBelow
                      ).replace("{n}", `${o.std}`)
                    : text[o.key]}
                </option>
              ))}
            </select>
            <span>{text.averageOfRange}</span>
          </div>
        )}

        {kind === "unique" && (
          <div className="fortune-cf-inline fortune-cf-wrap">
            <span>{text.formatAll}</span>
            <select
              className="fortune-cf-select"
              aria-label={text.formatAll}
              value={`${values[0] ?? "0"}`}
              onChange={(e) => setValue(0, e.target.value)}
            >
              <option value="0">{text.duplicateValue}</option>
              <option value="1">{text.uniqueValue}</option>
            </select>
            <span>{text.valuesInRange}</span>
          </div>
        )}

        {kind === "formula" && (
          <div className="fortune-cf-formula">
            <label htmlFor={`${id}-formula`}>{text.formatWhereFormula}</label>
            <input
              id={`${id}-formula`}
              className="fortune-cf-input fortune-cf-input-wide"
              type="text"
              placeholder="=$A1>0"
              value={values[0] ?? ""}
              onChange={(e) => setValue(0, e.target.value)}
            />
          </div>
        )}

        {rule.type === "default" && (
          <FormatEditor
            value={(rule.format as CFStyle) ?? {}}
            text={text}
            onChange={(format) => patch({ format })}
          />
        )}
      </div>

      <div className="fortune-cf-grid2 fortune-cf-applies">
        <label htmlFor={`${id}-range`}>{text.appliesTo}</label>
        <input
          id={`${id}-range`}
          className="fortune-cf-input fortune-cf-input-wide"
          type="text"
          value={range}
          onChange={(e) => {
            setRange(e.target.value);
            setError("");
          }}
        />
      </div>
      {rule.type === "default" && (
        <label className="fortune-cf-check" htmlFor={`${id}-c6`}>
          <input
            id={`${id}-c6`}
            type="checkbox"
            checked={!!rule.stopIfTrue}
            onChange={(e) =>
              patch({ stopIfTrue: e.target.checked || undefined })
            }
          />
          {text.stopIfTrue}
        </label>
      )}
      {error && (
        <div className="fortune-cf-error" role="alert">
          {error}
        </div>
      )}
    </DialogShell>
  );
};

export default RuleEditor;
