import React, { useContext, useId, useMemo, useState } from "react";
import {
  copySparklineOptions,
  getSparklineGroups,
  locale,
  parseSparklineRange,
  qualifiedSparklineRange,
  setSparklineGroupOptions,
  sparklineColor,
  sparklineLocale,
} from "@lofcz/tinysheet-core";
import type {
  SparklineAxisType,
  SparklineColorKey,
  SparklineEmptyCells,
  SparklineGroupOptions,
  SparklineLocale,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import { startRangePick } from "./rangePicker";
import { RangeField } from "./SparklineDataDialog";
import { SparklineTypeIcon, SPARKLINE_TYPES } from "./icons";
import SparklinePreview from "./SparklinePreview";
import { SPARKLINE_STYLES } from "./styles";

export type SparklineSettingsDialogProps = {
  sheetId: string;
  /** Groups edited together (the selected ones); the first gives the options. */
  groupIds: string[];
  /** Options being edited (kept while a range is picked on the sheet). */
  options?: SparklineGroupOptions;
  /** Data of the active sparkline, for the preview. */
  values?: (number | null)[];
};

/** Every option key a group can have (for a full replacement patch). */
const OPTION_KEYS: (keyof SparklineGroupOptions)[] = [
  "type",
  "colors",
  "markers",
  "high",
  "low",
  "first",
  "last",
  "negative",
  "displayXAxis",
  "displayEmptyCellsAs",
  "displayHidden",
  "rightToLeft",
  "minAxisType",
  "maxAxisType",
  "manualMin",
  "manualMax",
  "lineWeight",
  "dateAxis",
];

const POINTS: {
  key: keyof SparklineGroupOptions;
  label: keyof SparklineLocale;
}[] = [
  { key: "high", label: "high" },
  { key: "low", label: "low" },
  { key: "negative", label: "negative" },
  { key: "first", label: "first" },
  { key: "last", label: "last" },
  { key: "markers", label: "markers" },
];

const MARKER_COLORS: {
  key: SparklineColorKey;
  label: keyof SparklineLocale;
}[] = [
  { key: "markers", label: "markers" },
  { key: "negative", label: "negative" },
  { key: "high", label: "high" },
  { key: "low", label: "low" },
  { key: "first", label: "first" },
  { key: "last", label: "last" },
];

const WEIGHTS = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];

const Check: React.FC<{
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, disabled, onChange }) => {
  const id = useId();
  return (
    <div className="fortune-sparkline-check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};

const ColorInput: React.FC<{
  label: string;
  /** Accessible name, when the visible label is ambiguous. */
  name?: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, name, value, onChange }) => {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div className="fortune-sparkline-color">
      <input
        type="color"
        aria-label={name ?? label}
        value={hex.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      <span aria-hidden="true">{label}</span>
    </div>
  );
};

const AxisSelect: React.FC<{
  t: SparklineLocale;
  label: string;
  type: SparklineAxisType | undefined;
  value: number | undefined;
  onType: (t: SparklineAxisType) => void;
  onValue: (v: number | undefined) => void;
}> = ({ t, label, type, value, onType, onValue }) => {
  const id = useId();
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <div className="fortune-sparkline-field">
      <label htmlFor={id}>{label}</label>
      <div className="fortune-sparkline-row">
        <select
          id={id}
          className="fortune-sparkline-select"
          value={type ?? "individual"}
          onChange={(e) => onType(e.target.value as SparklineAxisType)}
        >
          <option value="individual">{t.axisIndividual}</option>
          <option value="group">{t.axisGroup}</option>
          <option value="custom">{t.axisCustom}</option>
        </select>
        {type === "custom" && (
          <input
            className="fortune-sparkline-input fortune-sparkline-number"
            type="number"
            aria-label={`${label}: ${t.axisCustom}`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = parseFloat(e.target.value);
              onValue(Number.isFinite(n) ? n : undefined);
            }}
          />
        )}
      </div>
    </div>
  );
};

/** Sparkline settings: type, shown points, style, colours, axis, cells. */
const SparklineSettingsDialog: React.FC<SparklineSettingsDialogProps> = (
  props
) => {
  const { sheetId, groupIds, values, options } = props;
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = sparklineLocale(context);
  const { button } = locale(context);
  const initial = useMemo(() => {
    if (options) return options;
    const group = getSparklineGroups(context, sheetId).find(
      (g) => g.id === groupIds[0]
    );
    return group ? copySparklineOptions(group) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [opts, setOpts] = useState<SparklineGroupOptions | null>(initial);
  const [dateText, setDateText] = useState(initial?.dateAxis ?? "");
  const [useDates, setUseDates] = useState(!!initial?.dateAxis);
  const [error, setError] = useState<string | null>(null);
  const emptyId = useId();

  if (!opts) {
    return (
      <div className="fortune-sparkline-dialog">
        <div>{t.noSparkline}</div>
      </div>
    );
  }
  const set = (patch: Partial<SparklineGroupOptions>) =>
    setOpts((o) => ({ ...(o as SparklineGroupOptions), ...patch }));
  const setColor = (key: SparklineColorKey, value: string) =>
    set({ colors: { ...(opts.colors ?? {}), [key]: value } });
  const color = (key: SparklineColorKey) => sparklineColor(opts, key);

  const current = (): SparklineGroupOptions => ({
    ...opts,
    dateAxis: useDates ? dateText : undefined,
  });

  const pickDates = () => {
    hideDialog();
    const reopen = (text?: string) =>
      showDialog(
        <SparklineSettingsDialog
          {...props}
          options={{ ...opts, dateAxis: text ?? (useDates ? dateText : "") }}
        />
      );
    startRangePick({
      title: t.dateRange,
      sheetId,
      onDone: (text) => reopen(text),
      onCancel: () => reopen(),
    });
  };

  const ok = () => {
    if (context.allowEdit === false) return;
    const next = current();
    if (useDates) {
      const range = parseSparklineRange(context, dateText, sheetId);
      if (!range) {
        setError(t.errorData);
        return;
      }
      next.dateAxis = qualifiedSparklineRange(context, range);
    }
    const patch: Partial<SparklineGroupOptions> = {};
    OPTION_KEYS.forEach((k) => {
      (patch as any)[k] = (next as any)[k];
    });
    if (next.minAxisType !== "custom") patch.manualMin = undefined;
    if (next.maxAxisType !== "custom") patch.manualMax = undefined;
    setContext((ctx) => {
      setSparklineGroupOptions(ctx, sheetId, groupIds, patch);
    });
    hideDialog();
  };

  const isLine = opts.type === "line";

  return (
    <div
      className="fortune-sparkline-dialog fortune-sparkline-settings"
      aria-label={t.settingsTitle}
    >
      <div className="fortune-sparkline-dialog-title">{t.settingsTitle}</div>
      <div className="fortune-sparkline-scroll">
        <div className="fortune-sparkline-row">
          <div
            className="fortune-sparkline-types"
            role="radiogroup"
            aria-label={t.type}
          >
            {SPARKLINE_TYPES.map(({ type, label }) => (
              <div
                key={type}
                role="radio"
                tabIndex={0}
                aria-checked={opts.type === type}
                className={`fortune-sparkline-type${
                  opts.type === type ? " fortune-sparkline-type-selected" : ""
                }`}
                onClick={() => set({ type })}
                onKeyDown={activateOnKey}
              >
                <SparklineTypeIcon type={type} />
                <span>{t[label]}</span>
              </div>
            ))}
          </div>
          <SparklinePreview
            className="fortune-sparkline-preview"
            options={current()}
            values={values}
            width={150}
            height={40}
          />
        </div>

        <fieldset className="fortune-sparkline-section">
          <legend>{t.show}</legend>
          <div className="fortune-sparkline-grid3">
            {POINTS.map(({ key, label }) => (
              <Check
                key={key}
                label={t[label]}
                checked={!!opts[key]}
                disabled={key === "markers" && !isLine}
                onChange={(v) => set({ [key]: v || undefined })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="fortune-sparkline-section">
          <legend>{t.style}</legend>
          <div className="fortune-sparkline-styles" role="listbox">
            {SPARKLINE_STYLES.map((style, i) => {
              const label = t.styleN.replace("{n}", String(i + 1));
              const selected =
                color("series") === style.series &&
                color("negative") === style.negative &&
                color("high") === style.high;
              return (
                <div
                  key={label}
                  role="option"
                  tabIndex={0}
                  aria-selected={selected}
                  aria-label={label}
                  title={label}
                  className={`fortune-sparkline-style${
                    selected ? " fortune-sparkline-style-selected" : ""
                  }`}
                  onClick={() =>
                    set({ colors: { ...(opts.colors ?? {}), ...style } })
                  }
                  onKeyDown={activateOnKey}
                >
                  <SparklinePreview
                    options={{
                      ...opts,
                      colors: { ...(opts.colors ?? {}), ...style },
                      high: true,
                      low: true,
                      negative: true,
                      markers: isLine,
                    }}
                    width={44}
                    height={22}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="fortune-sparkline-section">
          <legend>{t.colors}</legend>
          <div className="fortune-sparkline-row">
            <ColorInput
              label={t.sparklineColor}
              value={color("series")}
              onChange={(v) => setColor("series", v)}
            />
            {isLine && (
              <div className="fortune-sparkline-color">
                <select
                  className="fortune-sparkline-select"
                  aria-label={t.weight}
                  value={String(opts.lineWeight ?? 0.75)}
                  onChange={(e) =>
                    set({
                      lineWeight:
                        e.target.value === "0.75"
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                >
                  {WEIGHTS.map((w) => (
                    <option key={w} value={String(w)}>
                      {w}
                    </option>
                  ))}
                </select>
                <span>{t.weight}</span>
              </div>
            )}
            <ColorInput
              label={t.axisColor}
              value={color("axis")}
              onChange={(v) => setColor("axis", v)}
            />
          </div>
          <div className="fortune-sparkline-subtitle">{t.markerColors}</div>
          <div className="fortune-sparkline-grid3">
            {MARKER_COLORS.map(({ key, label }) => (
              <ColorInput
                key={key}
                label={t[label]}
                name={`${t.markerColors}: ${t[label]}`}
                value={color(key)}
                onChange={(v) => setColor(key, v)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="fortune-sparkline-section">
          <legend>{t.axis}</legend>
          <div className="fortune-sparkline-grid2">
            <Check
              label={t.showAxis}
              checked={!!opts.displayXAxis}
              onChange={(v) => set({ displayXAxis: v || undefined })}
            />
            <Check
              label={t.rightToLeft}
              checked={!!opts.rightToLeft}
              onChange={(v) => set({ rightToLeft: v || undefined })}
            />
          </div>
          <AxisSelect
            t={t}
            label={t.minAxis}
            type={opts.minAxisType}
            value={opts.manualMin}
            onType={(v) =>
              set({ minAxisType: v === "individual" ? undefined : v })
            }
            onValue={(v) => set({ manualMin: v })}
          />
          <AxisSelect
            t={t}
            label={t.maxAxis}
            type={opts.maxAxisType}
            value={opts.manualMax}
            onType={(v) =>
              set({ maxAxisType: v === "individual" ? undefined : v })
            }
            onValue={(v) => set({ manualMax: v })}
          />
          <Check
            label={t.dateAxis}
            checked={useDates}
            onChange={(v) => {
              setUseDates(v);
              setError(null);
            }}
          />
          {useDates && (
            <RangeField
              label={t.dateRange}
              value={dateText}
              pickLabel={t.selectRange}
              onChange={(v) => {
                setDateText(v);
                setError(null);
              }}
              onPick={pickDates}
            />
          )}
        </fieldset>

        <fieldset className="fortune-sparkline-section">
          <legend>{t.hiddenEmpty}</legend>
          <div
            className="fortune-sparkline-radios"
            role="radiogroup"
            aria-label={t.emptyCells}
          >
            <span>{t.emptyCells}</span>
            {(
              [
                ["gap", t.emptyGap],
                ["zero", t.emptyZero],
                ["span", t.emptySpan],
              ] as [SparklineEmptyCells, string][]
            ).map(([value, label]) => (
              <div key={value} className="fortune-sparkline-check">
                <input
                  id={`${emptyId}-${value}`}
                  type="radio"
                  name={emptyId}
                  checked={(opts.displayEmptyCellsAs ?? "gap") === value}
                  onChange={() => set({ displayEmptyCellsAs: value })}
                />
                <label htmlFor={`${emptyId}-${value}`}>{label}</label>
              </div>
            ))}
          </div>
          <Check
            label={t.showHidden}
            checked={!!opts.displayHidden}
            onChange={(v) => set({ displayHidden: v || undefined })}
          />
        </fieldset>
      </div>
      {error && (
        <div className="fortune-sparkline-error" role="alert">
          {error}
        </div>
      )}
      <div className="fortune-sparkline-footer">
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={ok}
          onKeyDown={activateOnKey}
        >
          {button.confirm}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={hideDialog}
          onKeyDown={activateOnKey}
        >
          {button.cancel}
        </div>
      </div>
    </div>
  );
};

export default SparklineSettingsDialog;
