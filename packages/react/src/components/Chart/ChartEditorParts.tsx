import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Chart,
  CHART_PALETTES,
  CHART_STYLES,
  ChartErrorBarType,
  ChartLocale,
  ChartRange,
  ChartSeries,
  ChartTrendline,
  ChartTrendlineType,
  chartRangeToText,
  chartThemeFor,
  Context,
  renderChartToSvg,
} from "@lofcz/tinysheet-core";

type CommitProps = {
  label: string;
  value: string;
  placeholder?: string;
  /** Returns an error message to keep the draft, or undefined when applied. */
  onCommit: (text: string) => string | undefined;
};

/** Text field that applies its value on Enter / blur (one undo step each). */
export const CommitField: React.FC<CommitProps> = ({
  label,
  value,
  placeholder,
  onCommit,
}) => {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  const id = useId();
  useEffect(() => {
    setDraft(value);
    setError(undefined);
  }, [value]);
  const commit = () => {
    if (draft === value) {
      setError(undefined);
      return;
    }
    setError(onCommit(draft));
  };
  return (
    <label className="fortune-chart-editor-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setError(undefined);
          }
        }}
      />
      {error && <span className="fortune-chart-editor-error">{error}</span>}
    </label>
  );
};

/** Numeric field; an empty value commits `undefined`. */
export const NumberField: React.FC<{
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number | undefined) => void;
}> = ({ label, value, min, max, step, disabled, onCommit }) => {
  const text = value == null ? "" : String(value);
  const [draft, setDraft] = useState(text);
  const id = useId();
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    if (draft === text) return;
    if (draft.trim() === "") {
      onCommit(undefined);
      return;
    }
    let n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(text);
      return;
    }
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    onCommit(n);
  };
  return (
    <label
      className="fortune-chart-editor-field fortune-chart-editor-number"
      htmlFor={id}
    >
      <span>{label}</span>
      <input
        id={id}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
    </label>
  );
};

export const SelectField: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, options, disabled, onChange }) => {
  const id = useId();
  return (
    <label className="fortune-chart-editor-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export const CheckField: React.FC<{
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, disabled, onChange }) => {
  const id = useId();
  return (
    <label className="fortune-chart-editor-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
};

const TREND_TYPES: [ChartTrendlineType, keyof ChartLocale][] = [
  ["linear", "trendlineLinear"],
  ["exponential", "trendlineExponential"],
  ["logarithmic", "trendlineLogarithmic"],
  ["polynomial", "trendlinePolynomial"],
  ["power", "trendlinePower"],
  ["movingAverage", "trendlineMovingAverage"],
];

const ERROR_TYPES: [ChartErrorBarType, keyof ChartLocale][] = [
  ["fixed", "errorFixed"],
  ["percentage", "errorPercentage"],
  ["stdDev", "errorStdDev"],
  ["stdErr", "errorStdErr"],
  ["custom", "errorCustom"],
];

type SeriesUpdate = (recipe: (s: ChartSeries) => void) => void;

/** Trendline and error-bar options of one series. */
export const SeriesAnalysis: React.FC<{
  t: ChartLocale;
  ctx: Context;
  series: ChartSeries;
  readonly: boolean;
  update: SeriesUpdate;
  parseRange: (text: string) => ChartRange | null | "invalid";
}> = ({ t, ctx, series, readonly, update, parseRange }) => {
  const trend: ChartTrendline | undefined = series.trendlines?.[0];
  const bars = series.errorBars;
  const setTrend = (patch: Partial<ChartTrendline>) =>
    update((s) => {
      const cur = s.trendlines?.[0];
      if (!cur) return;
      s.trendlines = [{ ...cur, ...patch }, ...(s.trendlines ?? []).slice(1)];
    });
  return (
    <details className="fortune-chart-series-analysis">
      <summary>
        {t.trendline} · {t.errorBars}
      </summary>
      <SelectField
        label={t.trendline}
        value={trend?.type ?? ""}
        disabled={readonly}
        options={[
          { value: "", label: t.none },
          ...TREND_TYPES.map(([value, key]) => ({ value, label: t[key] })),
        ]}
        onChange={(v) =>
          update((s) => {
            if (!v) delete s.trendlines;
            else
              s.trendlines = [
                {
                  ...(s.trendlines?.[0] ?? {}),
                  type: v as ChartTrendlineType,
                },
              ];
          })
        }
      />
      {trend && (
        <>
          {trend.type === "polynomial" && (
            <NumberField
              label={t.trendlineOrder}
              value={trend.order ?? 2}
              min={2}
              max={6}
              step={1}
              disabled={readonly}
              onCommit={(order) => setTrend({ order: order ?? 2 })}
            />
          )}
          {trend.type === "movingAverage" ? (
            <NumberField
              label={t.trendlinePeriod}
              value={trend.period ?? 2}
              min={2}
              step={1}
              disabled={readonly}
              onCommit={(period) => setTrend({ period: period ?? 2 })}
            />
          ) : (
            <div className="fortune-chart-editor-row">
              <NumberField
                label={t.forecastForward}
                value={trend.forward}
                min={0}
                disabled={readonly}
                onCommit={(forward) => setTrend({ forward })}
              />
              <NumberField
                label={t.forecastBackward}
                value={trend.backward}
                min={0}
                disabled={readonly}
                onCommit={(backward) => setTrend({ backward })}
              />
            </div>
          )}
          {trend.type !== "movingAverage" && (
            <>
              <CheckField
                label={t.displayEquation}
                checked={!!trend.displayEquation}
                disabled={readonly}
                onChange={(displayEquation) => setTrend({ displayEquation })}
              />
              <CheckField
                label={t.displayRSquared}
                checked={!!trend.displayRSquared}
                disabled={readonly}
                onChange={(displayRSquared) => setTrend({ displayRSquared })}
              />
            </>
          )}
        </>
      )}
      <SelectField
        label={t.errorBars}
        value={bars?.type ?? ""}
        disabled={readonly}
        options={[
          { value: "", label: t.none },
          ...ERROR_TYPES.map(([value, key]) => ({ value, label: t[key] })),
        ]}
        onChange={(v) =>
          update((s) => {
            if (!v) delete s.errorBars;
            else
              s.errorBars = {
                ...(s.errorBars ?? {}),
                type: v as ChartErrorBarType,
              };
          })
        }
      />
      {bars && (
        <>
          {bars.type !== "stdErr" && bars.type !== "custom" && (
            <NumberField
              label={
                bars.type === "percentage"
                  ? `${t.errorAmount} (%)`
                  : t.errorAmount
              }
              value={bars.value ?? (bars.type === "percentage" ? 5 : 1)}
              min={0}
              disabled={readonly}
              onCommit={(value) =>
                update((s) => {
                  if (s.errorBars) s.errorBars.value = value;
                })
              }
            />
          )}
          {bars.type === "custom" &&
            (["plus", "minus"] as const).map((side) => (
              <CommitField
                key={side}
                label={side === "plus" ? t.errorPlus : t.errorMinus}
                value={
                  bars[side] ? `=${chartRangeToText(ctx, bars[side])}` : ""
                }
                onCommit={(text) => {
                  const range = parseRange(text);
                  if (range === "invalid") return t.invalidRange;
                  update((s) => {
                    if (!s.errorBars) return;
                    if (range) s.errorBars[side] = range;
                    else delete s.errorBars[side];
                  });
                  return undefined;
                }}
              />
            ))}
          <SelectField
            label={t.errorDirection}
            value={bars.include ?? "both"}
            disabled={readonly}
            options={[
              { value: "both", label: t.errorBoth },
              { value: "plus", label: t.errorPlusOnly },
              { value: "minus", label: t.errorMinusOnly },
            ]}
            onChange={(v) =>
              update((s) => {
                if (s.errorBars)
                  s.errorBars.include = v as "both" | "plus" | "minus";
              })
            }
          />
          <CheckField
            label={t.endCap}
            checked={bars.endCap !== false}
            disabled={readonly}
            onChange={(on) =>
              update((s) => {
                if (s.errorBars) s.errorBars.endCap = on;
              })
            }
          />
        </>
      )}
    </details>
  );
};

/** Excel-like style and colour galleries with live thumbnails. */
export const ChartGalleries: React.FC<{
  t: ChartLocale;
  ctx: Context;
  chart: Chart;
  readonly: boolean;
  onStyle: (id: number) => void;
  onPalette: (id: string) => void;
}> = ({ t, ctx, chart, readonly, onStyle, onPalette }) => {
  const themeName = ctx.theme || "light";
  // thumbnails of this chart in every style (no title, legend or labels)
  const thumbs = useMemo(
    () =>
      CHART_STYLES.map((style) => {
        const preview: Chart = {
          ...chart,
          style: style.id,
          title: "",
          categoryAxisTitle: "",
          valueAxisTitle: "",
          legend: "none",
          dataLabels: style.flags?.dataLabels ?? chart.dataLabels,
          gridlines: style.flags?.gridlines ?? chart.gridlines,
        };
        return {
          id: style.id,
          svg: renderChartToSvg(
            {
              luckysheetfile: ctx.luckysheetfile,
              lang: ctx.lang,
              theme: themeName,
            },
            preview,
            chartThemeFor(preview, themeName),
            { width: 240, height: 154 }
          ),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, ctx.luckysheetfile, themeName, ctx.lang]
  );
  const current = chart.style ?? 1;
  const palette = chart.palette ?? "colorful1";
  const kinds = ["colorful", "monochromatic"] as const;
  return (
    <>
      <h3>{t.chartStyles}</h3>
      <div
        className="fortune-chart-style-gallery"
        role="listbox"
        aria-label={t.chartStyles}
      >
        {thumbs.map((thumb) => (
          <button
            key={thumb.id}
            type="button"
            role="option"
            aria-selected={thumb.id === current}
            className={`fortune-chart-style-tile${
              thumb.id === current ? " fortune-chart-style-tile-active" : ""
            }`}
            title={`${t.style} ${thumb.id}`}
            aria-label={`${t.style} ${thumb.id}`}
            disabled={readonly}
            onClick={() => onStyle(thumb.id)}
            // SVG produced by the chart renderer; every text is XML-escaped.
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: thumb.svg }}
          />
        ))}
      </div>
      <h3>{t.colors}</h3>
      {kinds.map((kind) => (
        <div key={kind} className="fortune-chart-palette-group">
          <span className="fortune-chart-palette-kind">{t[kind]}</span>
          <div
            className="fortune-chart-palettes"
            role="listbox"
            aria-label={`${t.colors}: ${t[kind]}`}
          >
            {CHART_PALETTES.filter((p) => p.kind === kind).map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === palette}
                aria-label={`${t[kind]} ${i + 1}`}
                title={`${t[kind]} ${i + 1}`}
                disabled={readonly}
                className={`fortune-chart-palette${
                  p.id === palette ? " fortune-chart-palette-active" : ""
                }`}
                onClick={() => onPalette(p.id)}
              >
                {p.colors.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};
