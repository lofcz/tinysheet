import React, { useContext, useEffect, useId, useRef, useState } from "react";
import {
  Chart,
  ChartLegendPosition,
  ChartRange,
  ChartSeries,
  chartPaletteColor,
  chartRangeToText,
  Context,
  findChart,
  inferChartSource,
  locale,
  parseChartRange,
  resolveChartModel,
  setChartSource,
  setChartType,
  switchChartRowColumn,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import { CHART_TYPE_OPTIONS, chartTypeOptionFor } from "./chartTypes";

type CommitProps = {
  label: string;
  value: string;
  placeholder?: string;
  /** Returns an error message to keep the draft, or undefined when applied. */
  onCommit: (text: string) => string | undefined;
};

/** Text field that applies its value on Enter / blur (one undo step each). */
const CommitField: React.FC<CommitProps> = ({
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

function seriesNameText(ctx: Context, s: ChartSeries) {
  if (s.name != null) return s.name;
  if (s.nameRef) return `=${chartRangeToText(ctx, s.nameRef)}`;
  return "";
}

const LEGEND_POSITIONS: ChartLegendPosition[] = [
  "right",
  "bottom",
  "top",
  "left",
  "none",
];

const ChartEditor: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { chart: t } = locale(context);
  const rootRef = useRef<HTMLDivElement>(null);
  const idBase = useId();

  // Keep wheel scrolling inside the panel (the sheet listens on an ancestor).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop);
    return () => el.removeEventListener("wheel", stop);
  });

  const found = context.chartEditorOpen
    ? findChart(context, context.activeChart)
    : null;
  if (!found) return null;
  const { chart } = found;
  const sheetId = found.sheet.id as string;
  const readonly = context.allowEdit === false;
  const model = resolveChartModel(context, chart);
  const cartesian = chart.type !== "pie" && chart.type !== "doughnut";
  const option = chartTypeOptionFor(chart);

  const update = (recipe: (ctx: Context, c: Chart) => void) => {
    if (readonly) return;
    setContext((ctx) => {
      const target = findChart(ctx, chart.id);
      if (target) recipe(ctx, target.chart);
    });
  };

  const parseRange = (text: string): ChartRange | null | "invalid" => {
    if (text.trim() === "") return null;
    return parseChartRange(context, text, sheetId) ?? "invalid";
  };

  const source = chart.source ?? inferChartSource(chart);
  const categoriesRef = chart.series.find((s) => s.categories)?.categories;

  const close = () =>
    setContext((ctx) => {
      ctx.chartEditorOpen = false;
    });

  return (
    // Keys, clicks and pastes stay in the panel (the grid listens on ancestors).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      ref={rootRef}
      className="fortune-chart-editor"
      aria-label={t.editor}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" && (e.target as HTMLElement).tagName !== "INPUT")
          close();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
    >
      <div className="fortune-chart-editor-header">
        <span>{t.editor}</span>
        <button
          type="button"
          className="fortune-chart-editor-close"
          aria-label={t.close}
          title={t.close}
          onClick={close}
        >
          <SVGIcon name="close" width={18} height={18} />
        </button>
      </div>
      <div className="fortune-chart-editor-body">
        <section className="fortune-chart-editor-section">
          <label
            className="fortune-chart-editor-field"
            htmlFor={`${idBase}-type`}
          >
            <span>{t.chartType}</span>
            <select
              id={`${idBase}-type`}
              value={option.key}
              disabled={readonly}
              onChange={(e) => {
                const next = CHART_TYPE_OPTIONS.find(
                  (o) => o.key === e.target.value
                );
                if (!next) return;
                update((ctx, c) => {
                  setChartType(ctx, c.id, next.type, next.grouping);
                  if (next.markers != null) c.markers = next.markers;
                  if (next.type === "scatter")
                    c.scatterLines = !!next.scatterLines;
                });
              }}
            >
              {CHART_TYPE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {t[o.key]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="fortune-chart-editor-section">
          <h3>{t.data}</h3>
          <CommitField
            label={t.dataRange}
            value={source ? chartRangeToText(context, source) : ""}
            onCommit={(text) => {
              const range = parseRange(text);
              if (range === "invalid" || range === null) return t.invalidRange;
              update((ctx, c) => setChartSource(ctx, c.id, range));
              return undefined;
            }}
          />
          <button
            type="button"
            className="button-basic button-default"
            disabled={readonly || !source}
            onClick={() => update((ctx, c) => switchChartRowColumn(ctx, c.id))}
          >
            {t.switchRowColumn}
          </button>
        </section>

        <section className="fortune-chart-editor-section">
          <h3>{t.series}</h3>
          <CommitField
            label={t.categories}
            value={
              categoriesRef ? chartRangeToText(context, categoriesRef) : ""
            }
            onCommit={(text) => {
              const range = parseRange(text);
              if (range === "invalid") return t.invalidRange;
              update((_ctx, c) => {
                c.series.forEach((s) => {
                  if (range) s.categories = range;
                  else delete s.categories;
                });
              });
              return undefined;
            }}
          />
          {chart.series.map((s, i) => {
            const color = s.color || chartPaletteColor(i);
            const colorValue = /^#[0-9a-f]{6}$/i.test(color)
              ? color
              : "#4472c4";
            return (
              // eslint-disable-next-line react/no-array-index-key
              <div className="fortune-chart-series" key={i}>
                <div className="fortune-chart-series-head">
                  <input
                    type="color"
                    value={colorValue}
                    disabled={readonly}
                    aria-label={`${t.color}: ${model.series[i]?.name}`}
                    title={t.color}
                    onChange={(e) => {
                      const next = e.target.value;
                      update((_ctx, c) => {
                        c.series[i].color = next;
                      });
                    }}
                  />
                  <span className="fortune-chart-series-title">
                    {model.series[i]?.name}
                  </span>
                  <button
                    type="button"
                    className="fortune-chart-editor-close"
                    aria-label={t.removeSeries}
                    title={t.removeSeries}
                    disabled={readonly}
                    onClick={() =>
                      update((_ctx, c) => {
                        c.series.splice(i, 1);
                      })
                    }
                  >
                    <SVGIcon name="close" width={14} height={14} />
                  </button>
                </div>
                <CommitField
                  label={t.seriesName}
                  value={seriesNameText(context, s)}
                  onCommit={(text) => {
                    if (text.trim().startsWith("=")) {
                      const range = parseRange(text);
                      if (range === "invalid" || range === null)
                        return t.invalidRange;
                      update((_ctx, c) => {
                        delete c.series[i].name;
                        c.series[i].nameRef = range;
                      });
                    } else {
                      update((_ctx, c) => {
                        c.series[i].name = text;
                        delete c.series[i].nameRef;
                      });
                    }
                    return undefined;
                  }}
                />
                <CommitField
                  label={t.seriesValues}
                  value={s.values ? chartRangeToText(context, s.values) : ""}
                  onCommit={(text) => {
                    const range = parseRange(text);
                    if (range === "invalid" || range === null)
                      return t.invalidRange;
                    update((_ctx, c) => {
                      c.series[i].values = range;
                    });
                    return undefined;
                  }}
                />
              </div>
            );
          })}
          <button
            type="button"
            className="button-basic button-default"
            disabled={readonly}
            onClick={() =>
              update((_ctx, c) => {
                const last = c.series[c.series.length - 1];
                c.series.push({
                  name: `Series${c.series.length + 1}`,
                  values: null,
                  ...(last?.categories ? { categories: last.categories } : {}),
                });
              })
            }
          >
            {t.addSeries}
          </button>
        </section>

        <section className="fortune-chart-editor-section">
          <h3>{t.titles}</h3>
          <CommitField
            label={t.chartTitle}
            value={chart.title ?? ""}
            onCommit={(text) => {
              update((_ctx, c) => {
                c.title = text;
              });
              return undefined;
            }}
          />
          {cartesian && (
            <>
              <CommitField
                label={t.categoryAxisTitle}
                value={chart.categoryAxisTitle ?? ""}
                onCommit={(text) => {
                  update((_ctx, c) => {
                    c.categoryAxisTitle = text;
                  });
                  return undefined;
                }}
              />
              <CommitField
                label={t.valueAxisTitle}
                value={chart.valueAxisTitle ?? ""}
                onCommit={(text) => {
                  update((_ctx, c) => {
                    c.valueAxisTitle = text;
                  });
                  return undefined;
                }}
              />
            </>
          )}
        </section>

        <section className="fortune-chart-editor-section">
          <h3>{t.options}</h3>
          <label
            className="fortune-chart-editor-field"
            htmlFor={`${idBase}-legend`}
          >
            <span>{t.legend}</span>
            <select
              id={`${idBase}-legend`}
              value={chart.legend ?? "right"}
              disabled={readonly}
              onChange={(e) => {
                const legend = e.target.value as ChartLegendPosition;
                update((_ctx, c) => {
                  c.legend = legend;
                });
              }}
            >
              {LEGEND_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {
                    t[
                      `legend${p[0].toUpperCase()}${p.slice(
                        1
                      )}` as keyof typeof t
                    ]
                  }
                </option>
              ))}
            </select>
          </label>
          <label
            className="fortune-chart-editor-check"
            htmlFor={`${idBase}-dataLabels`}
          >
            <input
              id={`${idBase}-dataLabels`}
              type="checkbox"
              checked={!!chart.dataLabels}
              disabled={readonly}
              onChange={(e) => {
                const on = e.target.checked;
                update((_ctx, c) => {
                  c.dataLabels = on;
                });
              }}
            />
            {t.dataLabels}
          </label>
          {cartesian && (
            <label
              className="fortune-chart-editor-check"
              htmlFor={`${idBase}-gridlines`}
            >
              <input
                id={`${idBase}-gridlines`}
                type="checkbox"
                checked={chart.gridlines !== false}
                disabled={readonly}
                onChange={(e) => {
                  const on = e.target.checked;
                  update((_ctx, c) => {
                    c.gridlines = on;
                  });
                }}
              />
              {t.gridlines}
            </label>
          )}
          {(chart.type === "line" || chart.type === "scatter") && (
            <label
              className="fortune-chart-editor-check"
              htmlFor={`${idBase}-markers`}
            >
              <input
                id={`${idBase}-markers`}
                type="checkbox"
                checked={chart.markers !== false}
                disabled={readonly}
                onChange={(e) => {
                  const on = e.target.checked;
                  update((_ctx, c) => {
                    c.markers = on;
                  });
                }}
              />
              {t.markers}
            </label>
          )}
        </section>
      </div>
    </aside>
  );
};

export default ChartEditor;
