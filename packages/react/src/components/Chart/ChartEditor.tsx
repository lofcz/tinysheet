import React, { useContext, useEffect, useId, useRef } from "react";
import {
  Chart,
  ChartDataLabelPosition,
  ChartLegendPosition,
  ChartLocale,
  ChartPlacement,
  ChartRange,
  ChartSeries,
  ChartSeriesType,
  chartColor,
  chartHasAxes,
  chartRangeToText,
  chartSupportsSecondaryAxis,
  chartSupportsTrendlines,
  Context,
  findChart,
  getChartStyle,
  inferChartSource,
  locale,
  parseChartRange,
  resolveChartModel,
  setChartPlacement,
  setChartSource,
  setChartType,
  switchChartRowColumn,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import {
  applyChartTypeOption,
  CHART_TYPE_GROUPS,
  CHART_TYPE_OPTIONS,
  chartTypeOptionFor,
} from "./chartTypes";
import {
  ChartGalleries,
  CheckField,
  CommitField,
  NumberField,
  SelectField,
  SeriesAnalysis,
} from "./ChartEditorParts";

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

const POSITION_KEYS: Record<ChartDataLabelPosition, keyof ChartLocale> = {
  auto: "posAuto",
  center: "posCenter",
  insideEnd: "posInsideEnd",
  insideBase: "posInsideBase",
  outsideEnd: "posOutsideEnd",
  above: "posAbove",
  below: "posBelow",
  left: "posLeft",
  right: "posRight",
  bestFit: "posAuto",
};

/** Label positions Excel offers for a chart family. */
function labelPositions(chart: Chart): ChartDataLabelPosition[] {
  switch (chart.type) {
    case "pie":
      return ["auto", "center", "insideEnd", "outsideEnd"];
    case "column":
    case "bar":
    case "waterfall":
    case "histogram":
    case "pareto":
      return ["auto", "center", "insideEnd", "insideBase", "outsideEnd"];
    case "line":
    case "scatter":
    case "bubble":
    case "radar":
    case "combo":
      return ["auto", "center", "left", "right", "above", "below"];
    default:
      return [];
  }
}

const PLACEMENTS: [ChartPlacement, keyof ChartLocale][] = [
  ["twoCell", "placementTwoCell"],
  ["oneCell", "placementOneCell"],
  ["absolute", "placementAbsolute"],
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
  const axes = chartHasAxes(chart.type);
  const option = chartTypeOptionFor(chart);
  const pieLike = chart.type === "pie" || chart.type === "doughnut";

  const update = (recipe: (ctx: Context, c: Chart) => void) => {
    if (readonly) return;
    setContext((ctx) => {
      const target = findChart(ctx, chart.id);
      if (target) recipe(ctx, target.chart);
    });
  };
  const updateSeries = (i: number) => (recipe: (s: ChartSeries) => void) =>
    update((_ctx, c) => {
      if (c.series[i]) recipe(c.series[i]);
    });

  const parseRange = (text: string): ChartRange | null | "invalid" => {
    if (text.trim() === "") return null;
    return parseChartRange(context, text, sheetId) ?? "invalid";
  };

  const source = chart.source ?? inferChartSource(chart);
  const categoriesRef = chart.series.find((s) => s.categories)?.categories;
  const labelOpts = chart.dataLabelOptions ?? {};
  const positions = labelPositions(chart);
  const hasSecondary = chart.series.some((s) => s.secondary);

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
                  applyChartTypeOption(c, next);
                });
              }}
            >
              {CHART_TYPE_GROUPS.map((group) => (
                <optgroup key={group} label={t[group]}>
                  {CHART_TYPE_OPTIONS.filter((o) => o.group === group).map(
                    (o) => (
                      <option key={o.key} value={o.key}>
                        {t[o.key]}
                      </option>
                    )
                  )}
                </optgroup>
              ))}
            </select>
          </label>
        </section>

        <section className="fortune-chart-editor-section">
          <ChartGalleries
            t={t}
            ctx={context}
            chart={chart}
            readonly={readonly}
            onStyle={(id) =>
              update((_ctx, c) => {
                c.style = id;
                const { flags } = getChartStyle(id);
                if (flags?.gridlines != null && chartHasAxes(c.type))
                  c.gridlines = flags.gridlines;
                if (flags?.dataLabels != null) c.dataLabels = flags.dataLabels;
                if (flags?.legend) c.legend = flags.legend;
              })
            }
            onPalette={(id) =>
              update((_ctx, c) => {
                c.palette = id;
                // explicit colours give way to the palette
                c.series.forEach((s) => {
                  delete s.color;
                  delete s.pointColors;
                });
              })
            }
          />
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
            const color = s.color || chartColor(chart, i);
            const colorValue = /^#[0-9a-f]{6}$/i.test(color)
              ? color
              : "#4472c4";
            const upd = updateSeries(i);
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
                      upd((x) => {
                        x.color = next;
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
                      upd((x) => {
                        delete x.name;
                        x.nameRef = range;
                      });
                    } else {
                      upd((x) => {
                        x.name = text;
                        delete x.nameRef;
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
                    upd((x) => {
                      x.values = range;
                    });
                    return undefined;
                  }}
                />
                {chart.type === "bubble" && (
                  <CommitField
                    label={t.bubbleSizes}
                    value={s.sizes ? chartRangeToText(context, s.sizes) : ""}
                    onCommit={(text) => {
                      const range = parseRange(text);
                      if (range === "invalid") return t.invalidRange;
                      upd((x) => {
                        if (range) x.sizes = range;
                        else delete x.sizes;
                      });
                      return undefined;
                    }}
                  />
                )}
                {chart.type === "combo" && (
                  <SelectField
                    label={t.seriesType}
                    value={s.type ?? "column"}
                    disabled={readonly}
                    options={[
                      { value: "column", label: t.seriesTypeColumn },
                      { value: "line", label: t.seriesTypeLine },
                      { value: "area", label: t.seriesTypeArea },
                    ]}
                    onChange={(v) =>
                      upd((x) => {
                        x.type = v as ChartSeriesType;
                      })
                    }
                  />
                )}
                {chartSupportsSecondaryAxis(chart.type) && (
                  <CheckField
                    label={t.secondaryAxis}
                    checked={!!s.secondary}
                    disabled={readonly}
                    onChange={(on) =>
                      upd((x) => {
                        if (on) x.secondary = true;
                        else delete x.secondary;
                      })
                    }
                  />
                )}
                {chartSupportsTrendlines(chart.type) && (
                  <SeriesAnalysis
                    t={t}
                    ctx={context}
                    series={s}
                    readonly={readonly}
                    update={upd}
                    parseRange={parseRange}
                  />
                )}
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
                  ...(c.type === "combo" ? { type: "line" as const } : {}),
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
          {axes && chart.type !== "radar" && (
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
              {(hasSecondary || chart.type === "pareto") && (
                <CommitField
                  label={t.secondaryAxisTitle}
                  value={chart.secondaryValueAxisTitle ?? ""}
                  onCommit={(text) => {
                    update((_ctx, c) => {
                      c.secondaryValueAxisTitle = text;
                    });
                    return undefined;
                  }}
                />
              )}
            </>
          )}
        </section>

        <section className="fortune-chart-editor-section">
          <h3>{t.options}</h3>
          <SelectField
            label={t.legend}
            value={chart.legend ?? "right"}
            disabled={readonly}
            options={LEGEND_POSITIONS.map((p) => ({
              value: p,
              label:
                t[
                  `legend${p[0].toUpperCase()}${p.slice(
                    1
                  )}` as keyof ChartLocale
                ],
            }))}
            onChange={(v) =>
              update((_ctx, c) => {
                c.legend = v as ChartLegendPosition;
              })
            }
          />
          <CheckField
            label={t.dataLabels}
            checked={
              chart.type === "funnel"
                ? chart.dataLabels !== false
                : !!chart.dataLabels
            }
            disabled={readonly}
            onChange={(on) =>
              update((_ctx, c) => {
                c.dataLabels = on;
              })
            }
          />
          {(chart.type === "funnel"
            ? chart.dataLabels !== false
            : chart.dataLabels) && (
            <div className="fortune-chart-editor-sub">
              <span className="fortune-chart-editor-label">
                {t.labelContains}
              </span>
              <CheckField
                label={t.labelValue}
                checked={labelOpts.showValue !== false}
                disabled={readonly}
                onChange={(on) =>
                  update((_ctx, c) => {
                    c.dataLabelOptions = {
                      ...c.dataLabelOptions,
                      showValue: on,
                    };
                  })
                }
              />
              <CheckField
                label={t.labelCategory}
                checked={!!labelOpts.showCategory}
                disabled={readonly}
                onChange={(on) =>
                  update((_ctx, c) => {
                    c.dataLabelOptions = {
                      ...c.dataLabelOptions,
                      showCategory: on,
                    };
                  })
                }
              />
              <CheckField
                label={t.labelSeriesName}
                checked={!!labelOpts.showSeriesName}
                disabled={readonly}
                onChange={(on) =>
                  update((_ctx, c) => {
                    c.dataLabelOptions = {
                      ...c.dataLabelOptions,
                      showSeriesName: on,
                    };
                  })
                }
              />
              {pieLike && (
                <CheckField
                  label={t.labelPercent}
                  checked={!!labelOpts.showPercent}
                  disabled={readonly}
                  onChange={(on) =>
                    update((_ctx, c) => {
                      c.dataLabelOptions = {
                        ...c.dataLabelOptions,
                        showPercent: on,
                      };
                    })
                  }
                />
              )}
              {positions.length > 0 && (
                <SelectField
                  label={t.labelPosition}
                  value={labelOpts.position ?? "auto"}
                  disabled={readonly}
                  options={positions.map((p) => ({
                    value: p,
                    label: t[POSITION_KEYS[p]],
                  }))}
                  onChange={(v) =>
                    update((_ctx, c) => {
                      c.dataLabelOptions = {
                        ...c.dataLabelOptions,
                        position: v as ChartDataLabelPosition,
                      };
                    })
                  }
                />
              )}
              <CommitField
                label={t.numberFormat}
                value={labelOpts.numberFormat ?? ""}
                placeholder="General"
                onCommit={(text) => {
                  update((_ctx, c) => {
                    const next = { ...c.dataLabelOptions };
                    if (text.trim()) next.numberFormat = text.trim();
                    else delete next.numberFormat;
                    c.dataLabelOptions = next;
                  });
                  return undefined;
                }}
              />
            </div>
          )}
          {axes && (
            <CheckField
              label={t.gridlines}
              checked={chart.gridlines !== false}
              disabled={readonly}
              onChange={(on) =>
                update((_ctx, c) => {
                  c.gridlines = on;
                })
              }
            />
          )}
          {(chart.type === "line" ||
            chart.type === "scatter" ||
            chart.type === "combo") && (
            <CheckField
              label={t.markers}
              checked={chart.markers !== false}
              disabled={readonly}
              onChange={(on) =>
                update((_ctx, c) => {
                  c.markers = on;
                })
              }
            />
          )}
          {chart.type === "bubble" && (
            <NumberField
              label={t.bubbleScale}
              value={chart.bubbleScale ?? 100}
              min={0}
              max={300}
              disabled={readonly}
              onCommit={(v) =>
                update((_ctx, c) => {
                  c.bubbleScale = v;
                })
              }
            />
          )}
          {(chart.type === "histogram" || chart.type === "pareto") && (
            <div className="fortune-chart-editor-sub">
              <SelectField
                label={t.bins}
                value={chart.binning?.mode ?? "auto"}
                disabled={readonly}
                options={[
                  { value: "auto", label: t.binsAuto },
                  { value: "width", label: t.binsWidth },
                  { value: "count", label: t.binsCount },
                ]}
                onChange={(v) =>
                  update((_ctx, c) => {
                    c.binning = {
                      ...c.binning,
                      mode: v as "auto" | "width" | "count",
                    };
                  })
                }
              />
              {chart.binning?.mode === "width" && (
                <NumberField
                  label={t.binsWidth}
                  value={chart.binning.width}
                  min={0}
                  disabled={readonly}
                  onCommit={(width) =>
                    update((_ctx, c) => {
                      c.binning = { ...c.binning, width };
                    })
                  }
                />
              )}
              {chart.binning?.mode === "count" && (
                <NumberField
                  label={t.binsCount}
                  value={chart.binning.count}
                  min={1}
                  step={1}
                  disabled={readonly}
                  onCommit={(count) =>
                    update((_ctx, c) => {
                      c.binning = { ...c.binning, count };
                    })
                  }
                />
              )}
              <div className="fortune-chart-editor-row">
                <NumberField
                  label={t.overflowBin}
                  value={chart.binning?.overflow}
                  disabled={readonly}
                  onCommit={(overflow) =>
                    update((_ctx, c) => {
                      c.binning = { ...c.binning, overflow };
                    })
                  }
                />
                <NumberField
                  label={t.underflowBin}
                  value={chart.binning?.underflow}
                  disabled={readonly}
                  onCommit={(underflow) =>
                    update((_ctx, c) => {
                      c.binning = { ...c.binning, underflow };
                    })
                  }
                />
              </div>
            </div>
          )}
          {chart.type === "waterfall" && (
            <div className="fortune-chart-editor-sub">
              <CheckField
                label={t.connectors}
                checked={chart.waterfallConnectors !== false}
                disabled={readonly}
                onChange={(on) =>
                  update((_ctx, c) => {
                    c.waterfallConnectors = on;
                  })
                }
              />
              <span className="fortune-chart-editor-label">{t.setAsTotal}</span>
              <div className="fortune-chart-editor-totals">
                {(model.series[0]?.values ?? []).map((_, p) => (
                  <CheckField
                    // eslint-disable-next-line react/no-array-index-key
                    key={p}
                    label={model.categories[p] || String(p + 1)}
                    checked={!!chart.waterfallTotals?.includes(p)}
                    disabled={readonly}
                    onChange={(on) =>
                      update((_ctx, c) => {
                        const set = new Set(c.waterfallTotals ?? []);
                        if (on) set.add(p);
                        else set.delete(p);
                        c.waterfallTotals = Array.from(set).sort(
                          (a, b) => a - b
                        );
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="fortune-chart-editor-section">
          <h3>{t.properties}</h3>
          <div role="radiogroup" aria-label={t.properties}>
            {PLACEMENTS.map(([value, key]) => (
              <label
                key={value}
                className="fortune-chart-editor-check"
                htmlFor={`${idBase}-place-${value}`}
              >
                <input
                  id={`${idBase}-place-${value}`}
                  type="radio"
                  name={`${idBase}-placement`}
                  checked={(chart.placement ?? "twoCell") === value}
                  disabled={readonly}
                  onChange={() =>
                    update((ctx, c) => setChartPlacement(ctx, c.id, value))
                  }
                />
                {t[key]}
              </label>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};

export default ChartEditor;
