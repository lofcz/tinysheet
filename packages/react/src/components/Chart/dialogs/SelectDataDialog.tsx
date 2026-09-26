/**
 * Excel's Select Data Source dialog and the dialogs it opens:
 *
 * - "Chart data range" (a reference box: type, or select on the sheet,
 *   any sheet, with the dialog open or collapsed), Switch Row/Column;
 * - Legend Entries (Series): Add / Edit / Remove, Move Up / Move Down, a
 *   check box per series (the Chart Filters);
 * - Horizontal (Category) Axis Labels: Edit, a check box per category;
 * - Hidden and Empty Cells (Hidden and Empty Cell Settings);
 * - Edit Series (Series name / values, X / Y values, bubble size) and
 *   Axis Labels (Axis label range), each with `= …` previews.
 *
 * Every change shows on the chart at once (not recorded); OK makes the
 * whole edit one undo step, Cancel puts the chart back as it was.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  Chart,
  chartRangeFromAreas,
  chartRangeToText,
  chartToolsLocale,
  chartFieldPreview,
  Context,
  findChart,
  getChartDataRange,
  moveChartSeries,
  newSeriesDefaults,
  parseChartRange,
  resolveChartModel,
  seriesCategoriesText,
  seriesNameText,
  seriesSizesText,
  seriesValuesText,
  setChartDataRange,
  setSeriesCategories,
  setSeriesName,
  setSeriesSizes,
  setSeriesValues,
  switchChartDataRowColumn,
  canSwitchChartRowColumn,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import { Button, Checkbox, Dialog, ICON_STROKE, Radio } from "../../ui";
import { activateSheetTab } from "../../SheetTab/activate";
import RefEdit from "./RefEdit";
import { setChartRefEditActive } from "./store";
import "./dialogs.css";

/** Fields of a chart that the data dialogs change. */
const DATA_KEYS = [
  "series",
  "source",
  "seriesInRows",
  "hiddenCategories",
  "displayBlanksAs",
  "plotVisibleOnly",
  "displayNaAsBlank",
] as const;

/** Put the data fields of `from` into the chart `id` of the draft. */
export function assignChartData(ctx: Context, id: string, from: Chart) {
  const found = findChart(ctx, id);
  if (!found) return;
  const target = found.chart as unknown as Record<string, unknown>;
  DATA_KEYS.forEach((key) => {
    const value = (from as unknown as Record<string, unknown>)[key];
    if (value === undefined) delete target[key];
    else target[key] = _.cloneDeep(value);
  });
}

/** The sheet's selection as a reference (`=Sheet1!$A$1:$B$5`). */
export function selectionReference(
  ctx: Context,
  options: { parens?: boolean } = {}
) {
  const sel = ctx.luckysheet_select_save ?? [];
  const sheetId = ctx.currentSheetId;
  if (!sel.length) return "";
  const areas = sel.map((s) => ({
    sheetId,
    row: [s.row[0], s.row[1]] as [number, number],
    column: [s.column[0], s.column[1]] as [number, number],
  }));
  const range = chartRangeFromAreas(areas);
  if (!range) return "";
  const text = chartRangeToText(ctx, range);
  // Chart data range lists a union without parentheses (Excel)
  if (!options.parens && range.areas?.length) return `=${text.slice(1, -1)}`;
  return `=${text}`;
}

type Target = React.MutableRefObject<{
  set: (text: string) => void;
  parens: boolean;
  input: HTMLInputElement | null;
} | null>;

type Sub =
  | null
  | { kind: "series"; index: number | null }
  | { kind: "axisLabels" }
  | { kind: "hiddenEmpty" };

const isXY = (chart: Chart) =>
  chart.type === "scatter" || chart.type === "bubble";

export const SelectDataDialog: React.FC<{
  chartId: string;
  onDone: () => void;
}> = ({ chartId, onDone }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const found = findChart(context, chartId);
  const [original] = useState<Chart | null>(() =>
    found ? _.cloneDeep(found.chart) : null
  );
  const [chartSheetId] = useState(() => found?.sheet.id ?? "");
  const [draft, setDraft] = useState<Chart | null>(() =>
    found ? _.cloneDeep(found.chart) : null
  );
  const derived = draft ? getChartDataRange(draft) : null;
  const [rangeText, setRangeText] = useState(() =>
    derived ? `=${chartRangeToText(context, derived)}` : ""
  );
  const [rangeInvalid, setRangeInvalid] = useState(false);
  const [selected, setSelected] = useState(0);
  const [sub, setSub] = useState<Sub>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [subCollapsed, setSubCollapsed] = useState(false);
  const rangeInput = useRef<HTMLInputElement | null>(null);
  const target: Target = useRef(null);

  // the sheet takes clicks for the reference boxes while the dialog is open
  useEffect(() => {
    setChartRefEditActive(true);
    const container = refs.workbookContainer.current;
    container?.classList.add("fortune-chart-refedit");
    return () => {
      setChartRefEditActive(false);
      container?.classList.remove("fortune-chart-refedit");
    };
  }, [refs.workbookContainer]);

  /** Show `next` on the chart (not recorded) and keep it as the draft. */
  const preview = useCallback(
    (next: Chart) => {
      setDraft(next);
      setContext((ctx) => assignChartData(ctx, chartId, next), {
        noHistory: true,
      });
    },
    [chartId, setContext]
  );

  const syncRange = (next: Chart) => {
    const r = getChartDataRange(next);
    setRangeText(r ? `=${chartRangeToText(context, r)}` : "");
    setRangeInvalid(false);
  };

  const change = (recipe: (c: Chart) => void, keepRange = false) => {
    if (!draft) return;
    const next = _.cloneDeep(draft);
    recipe(next);
    preview(next);
    if (!keepRange) syncRange(next);
  };

  const onRangeText = (text: string) => {
    setRangeText(text);
    if (!draft) return;
    const trimmed = text.trim();
    const range = trimmed
      ? parseChartRange(
          context,
          trimmed.replace(/^=/, ""),
          context.currentSheetId
        )
      : null;
    if (!range) {
      setRangeInvalid(trimmed !== "");
      return;
    }
    setRangeInvalid(false);
    const next = _.cloneDeep(draft);
    setChartDataRange(context, next, range);
    preview(next);
  };

  // cells selected on the sheet go to the active reference box
  const lastSel = useRef(context.luckysheet_select_save);
  const lastSheet = useRef(context.currentSheetId);
  useEffect(() => {
    if (
      context.luckysheet_select_save === lastSel.current &&
      context.currentSheetId === lastSheet.current
    )
      return;
    lastSel.current = context.luckysheet_select_save;
    lastSheet.current = context.currentSheetId;
    const to = target.current;
    if (!to) return;
    const text = selectionReference(context, { parens: to.parens });
    if (text) to.set(text);
  }, [context, context.luckysheet_select_save, context.currentSheetId]);

  // after a click on the sheet the keyboard goes back to the box, and
  // double-clicks do not start editing a cell (Excel's reference mode)
  useEffect(() => {
    const container = refs.workbookContainer.current;
    if (!container) return undefined;
    const inSheet = (e: Event) =>
      !!(e.target as HTMLElement | null)?.closest?.(
        ".fortune-sheet-overlay, .fortune-sheettab-container, .fortune-sheet-container"
      );
    const onUp = (e: MouseEvent) => {
      if (!inSheet(e)) return;
      setTimeout(() => target.current?.input?.focus({ preventScroll: true }));
    };
    const onDblClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.(".fortune-cell-area"))
        return;
      e.stopPropagation();
      e.preventDefault();
    };
    document.addEventListener("mouseup", onUp, true);
    container.addEventListener("dblclick", onDblClick, true);
    return () => {
      document.removeEventListener("mouseup", onUp, true);
      container.removeEventListener("dblclick", onDblClick, true);
    };
  }, [refs.workbookContainer]);

  const activateRange = () => {
    target.current = {
      set: onRangeTextRef.current,
      parens: false,
      input: rangeInput.current,
    };
  };
  const onRangeTextRef = useRef(onRangeText);
  onRangeTextRef.current = onRangeText;
  useEffect(() => {
    // Chart data range takes the selection first (Excel)
    activateRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Back to the chart's sheet with the chart selected. */
  const finish = useCallback(() => {
    setContext(
      (ctx) => {
        if (ctx.currentSheetId !== chartSheetId && chartSheetId) {
          activateSheetTab(ctx, chartSheetId, refs.globalCache);
        }
        ctx.activeChart = chartId;
      },
      { noHistory: true }
    );
    onDone();
  }, [chartId, chartSheetId, onDone, refs.globalCache, setContext]);

  const cancel = useCallback(() => {
    if (original) {
      setContext((ctx) => assignChartData(ctx, chartId, original), {
        noHistory: true,
      });
    }
    finish();
  }, [chartId, finish, original, setContext]);

  const ok = () => {
    if (!original || !draft) {
      finish();
      return;
    }
    if (rangeInvalid) return;
    // one undo step from the chart as it was
    setContext((ctx) => assignChartData(ctx, chartId, original), {
      noHistory: true,
    });
    const final = draft;
    setContext((ctx) => assignChartData(ctx, chartId, final));
    finish();
  };

  const model = useMemo(
    () => (draft ? resolveChartModel(context, draft) : null),
    [context, draft]
  );

  if (!draft || !model || !original) return null;
  const xy = isXY(draft);
  const count = Math.max(
    model.categories.length,
    ...model.series.map((s) => s.values.length),
    0
  );
  const labels = Array.from({ length: count }, (_x, i) => {
    if (xy) {
      const xs = model.series[selected]?.xValues;
      return xs?.[i] != null ? String(xs[i]) : String(i + 1);
    }
    const c = model.categories[i];
    return c != null && c !== "" ? c : String(i + 1);
  });
  const hidden = new Set(draft.hiddenCategories ?? []);
  const sel = Math.min(selected, Math.max(0, draft.series.length - 1));
  const canSwitch = canSwitchChartRowColumn(draft);
  const complex = !getChartDataRange(draft) && draft.series.length > 0;

  const listKeys =
    (length: number, current: number, onMove: (i: number) => void) =>
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const next = Math.max(
        0,
        Math.min(length - 1, current + (e.key === "ArrowDown" ? 1 : -1))
      );
      onMove(next);
      (
        (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
          "[role=option]"
        )[next] as HTMLElement | undefined
      )?.focus();
    };

  const hideMain = subCollapsed;
  const collapsedStyle = collapsedPosition(refs.cellArea.current);

  return (
    <>
      <Dialog
        open
        modal={false}
        title={t.selectData.title}
        onClose={cancel}
        width={collapsed ? 460 : 660}
        className={`ts-chart-data-dialog${
          collapsed ? " ts-refedit-dialog--collapsed" : ""
        }`}
        data-testid="chart-select-data"
        style={{
          ...(hideMain ? { display: "none" } : {}),
          ...(collapsed ? collapsedStyle : {}),
        }}
        footerStart={
          collapsed ? undefined : (
            <Button onClick={() => setSub({ kind: "hiddenEmpty" })}>
              {t.selectData.hiddenAndEmpty}
            </Button>
          )
        }
        footer={
          collapsed ? undefined : (
            <>
              <Button onClick={cancel}>{t.selectData.cancel}</Button>
              <Button variant="primary" onClick={ok} disabled={rangeInvalid}>
                {t.selectData.ok}
              </Button>
            </>
          )
        }
      >
        <div
          className="ts-chart-data-body"
          // the other dialogs open over this one
          inert={sub != null ? true : undefined}
        >
          <RefEdit
            label={t.selectData.chartDataRange}
            value={rangeText}
            onChange={onRangeText}
            onActivate={activateRange}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            collapsed={collapsed}
            invalid={rangeInvalid}
            collapseLabel={t.selectData.collapse}
            expandLabel={t.selectData.expand}
            inputRef={rangeInput}
            autoFocus
            testId="chart-data-range"
          />
          {!collapsed && (
            <>
              {complex && !rangeText && (
                <p className="ts-chart-data-note">{t.selectData.tooComplex}</p>
              )}
              <div className="ts-chart-data-switch">
                <Button
                  icon={ArrowLeftRight}
                  onClick={() => {
                    change((c) => switchChartDataRowColumn(context, c));
                    setSelected(0);
                  }}
                  disabled={!canSwitch}
                >
                  {t.selectData.switchRowColumn}
                </Button>
              </div>
              <div className="ts-chart-data-lists">
                <section className="ts-chart-data-list-box">
                  <h3 className="ts-chart-data-list-title">
                    {t.selectData.legendEntries}
                  </h3>
                  <div
                    className="ts-chart-data-toolbar"
                    role="toolbar"
                    aria-label={t.selectData.legendEntries}
                  >
                    <Button
                      icon={Plus}
                      size="sm"
                      onClick={() => setSub({ kind: "series", index: null })}
                    >
                      {t.selectData.add}
                    </Button>
                    <Button
                      icon={Pencil}
                      size="sm"
                      disabled={draft.series.length === 0}
                      onClick={() => setSub({ kind: "series", index: sel })}
                    >
                      {t.selectData.edit}
                    </Button>
                    <Button
                      icon={X}
                      size="sm"
                      disabled={draft.series.length === 0}
                      onClick={() => {
                        change((c) => {
                          c.series.splice(sel, 1);
                        });
                        setSelected(Math.max(0, sel - 1));
                      }}
                    >
                      {t.selectData.remove}
                    </Button>
                    <span className="ts-chart-data-toolbar-gap" />
                    <button
                      type="button"
                      className="ts-icon-btn"
                      aria-label={t.selectData.moveUp}
                      title={t.selectData.moveUp}
                      disabled={sel <= 0}
                      onClick={() => {
                        change((c) => moveChartSeries(c, sel, sel - 1));
                        setSelected(sel - 1);
                      }}
                    >
                      <ChevronUp
                        size={16}
                        strokeWidth={ICON_STROKE}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className="ts-icon-btn"
                      aria-label={t.selectData.moveDown}
                      title={t.selectData.moveDown}
                      disabled={sel >= draft.series.length - 1}
                      onClick={() => {
                        change((c) => moveChartSeries(c, sel, sel + 1));
                        setSelected(sel + 1);
                      }}
                    >
                      <ChevronDown
                        size={16}
                        strokeWidth={ICON_STROKE}
                        aria-hidden
                      />
                    </button>
                  </div>
                  <div
                    className="ts-chart-data-list"
                    role="listbox"
                    aria-label={t.selectData.legendEntries}
                    data-testid="chart-series-list"
                    onKeyDown={listKeys(draft.series.length, sel, setSelected)}
                  >
                    {model.series.map((s, i) => (
                      <div
                        // eslint-disable-next-line react/no-array-index-key
                        key={i}
                        role="option"
                        aria-selected={i === sel}
                        tabIndex={i === sel ? 0 : -1}
                        className="ts-chart-data-item"
                        data-series={i}
                        onClick={() => setSelected(i)}
                        onDoubleClick={() => {
                          setSelected(i);
                          setSub({ kind: "series", index: i });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " ") {
                            e.preventDefault();
                            change((c) => {
                              c.series[i].filtered = !c.series[i].filtered;
                              if (!c.series[i].filtered)
                                delete c.series[i].filtered;
                            }, true);
                          }
                        }}
                      >
                        <Checkbox
                          checked={!draft.series[i]?.filtered}
                          aria-label={s.name}
                          onChange={(on) =>
                            change((c) => {
                              if (on) delete c.series[i].filtered;
                              else c.series[i].filtered = true;
                            }, true)
                          }
                        />
                        <span className="ts-chart-data-item-label">
                          {s.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="ts-chart-data-list-box">
                  <h3 className="ts-chart-data-list-title">
                    {xy ? t.selectData.xValues : t.selectData.categoryLabels}
                  </h3>
                  <div className="ts-chart-data-toolbar">
                    <Button
                      icon={Pencil}
                      size="sm"
                      disabled={xy || draft.series.length === 0}
                      onClick={() => setSub({ kind: "axisLabels" })}
                    >
                      {t.selectData.edit}
                    </Button>
                  </div>
                  <div
                    className="ts-chart-data-list"
                    role="listbox"
                    aria-label={t.selectData.categoryLabels}
                    data-testid="chart-category-list"
                  >
                    {labels.map((label, i) => (
                      <div
                        // eslint-disable-next-line react/no-array-index-key
                        key={i}
                        role="option"
                        aria-selected={false}
                        tabIndex={i === 0 ? 0 : -1}
                        className="ts-chart-data-item"
                        data-category={i}
                      >
                        <Checkbox
                          checked={!hidden.has(i)}
                          aria-label={label}
                          disabled={xy}
                          onChange={(on) =>
                            change((c) => {
                              const set = new Set(c.hiddenCategories ?? []);
                              if (on) set.delete(i);
                              else set.add(i);
                              if (set.size)
                                c.hiddenCategories = Array.from(set).sort(
                                  (a, b) => a - b
                                );
                              else delete c.hiddenCategories;
                            }, true)
                          }
                        />
                        <span className="ts-chart-data-item-label">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </Dialog>
      {sub?.kind === "series" && (
        <EditSeriesDialog
          base={draft}
          index={sub.index}
          target={target}
          preview={preview}
          onCollapsedChange={setSubCollapsed}
          onDone={(next) => {
            setSub(null);
            setSubCollapsed(false);
            activateRange();
            if (next) {
              syncRange(next);
              if (sub.index == null) setSelected(next.series.length - 1);
            }
          }}
        />
      )}
      {sub?.kind === "axisLabels" && (
        <AxisLabelsDialog
          base={draft}
          index={sel}
          target={target}
          preview={preview}
          onCollapsedChange={setSubCollapsed}
          onDone={(next) => {
            setSub(null);
            setSubCollapsed(false);
            activateRange();
            if (next) syncRange(next);
          }}
        />
      )}
      {sub?.kind === "hiddenEmpty" && (
        <HiddenEmptyDialog
          base={draft}
          onDone={(next) => {
            setSub(null);
            activateRange();
            if (next) preview(next);
          }}
        />
      )}
    </>
  );
};

/**
 * Where a collapsed dialog sits: at the top right of the grid, clear of
 * the data most sheets start with.
 */
function collapsedPosition(cellArea: HTMLElement | null): React.CSSProperties {
  const rect = cellArea?.getBoundingClientRect();
  const width = 460;
  const right = rect ? rect.right : window.innerWidth;
  return {
    position: "fixed",
    top: Math.max(8, (rect?.top ?? 80) + 8),
    left: Math.max(8, right - width - 24),
  };
}

type SubProps = {
  base: Chart;
  target: Target;
  preview: (next: Chart) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  /** The chart after OK, or null after Cancel. */
  onDone: (next: Chart | null) => void;
};

/** Edit Series: Series name / values (X / Y values, bubble size). */
const EditSeriesDialog: React.FC<SubProps & { index: number | null }> = ({
  base: baseProp,
  index,
  target,
  preview,
  onCollapsedChange,
  onDone,
}) => {
  const { context, refs } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  // the chart as it was when the dialog opened (its previews change the
  // parent's draft)
  const [base] = useState(baseProp);
  const sheetId = context.currentSheetId;
  const xy = isXY(base);
  const bubble = base.type === "bubble";
  const adding = index == null;
  const seriesIndex = adding ? base.series.length : index;
  const initial = adding ? newSeriesDefaults(base) : base.series[index];
  const [fields, setFields] = useState(() => ({
    name: adding ? "" : seriesNameText(context, initial),
    values: adding ? "={1}" : seriesValuesText(context, initial),
    x: adding ? "" : seriesCategoriesText(context, initial),
    sizes: adding ? "={1}" : seriesSizesText(context, initial),
  }));
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  /** The chart with the series as the fields say (null: a field is bad). */
  const build = (f: typeof fields) => {
    const next = _.cloneDeep(base);
    const s = adding ? _.cloneDeep(initial) : next.series[seriesIndex];
    const bad: Record<string, boolean> = {};
    if (setSeriesName(context, s, f.name, sheetId)) bad.name = true;
    if (setSeriesValues(context, s, f.values, sheetId)) bad.values = true;
    if (xy && setSeriesCategories(context, s, f.x, sheetId)) bad.x = true;
    if (bubble && setSeriesSizes(context, s, f.sizes, sheetId))
      bad.sizes = true;
    if (adding) next.series.push(s);
    return { next, bad };
  };

  const update = (key: keyof typeof fields, text: string) => {
    const f = { ...fields, [key]: text };
    setFields(f);
    const { next, bad } = build(f);
    setErrors(bad);
    if (Object.keys(bad).length === 0) preview(next);
  };

  // a new series shows at once (Excel adds "Series3" = {1})
  useEffect(() => {
    if (adding) preview(build(fields).next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = (key: keyof typeof fields) => () => {
    target.current = {
      set: (text) => updateRef.current(key, text),
      parens: true,
      input: inputs.current[key] ?? null,
    };
  };
  const updateRef = useRef(update);
  updateRef.current = update;

  useEffect(() => {
    onCollapsedChange(collapsed != null);
  }, [collapsed, onCollapsedChange]);

  const cancel = () => {
    preview(base);
    onDone(null);
  };
  const ok = () => {
    const { next, bad } = build(fields);
    setErrors(bad);
    if (Object.keys(bad).length) return;
    preview(next);
    onDone(next);
  };

  const field = (
    key: keyof typeof fields,
    label: string,
    options: { name?: boolean } = {}
  ) =>
    (collapsed == null || collapsed === key) && (
      <RefEdit
        key={key}
        label={label}
        value={fields[key]}
        onChange={(text) => update(key, text)}
        onActivate={activate(key)}
        onToggleCollapse={() => setCollapsed((c) => (c === key ? null : key))}
        collapsed={collapsed === key}
        invalid={!!errors[key]}
        preview={chartFieldPreview(context, fields[key], sheetId, options)}
        collapseLabel={t.selectData.collapse}
        expandLabel={t.selectData.expand}
        inputRef={(el) => {
          inputs.current[key] = el;
        }}
        autoFocus={key === "name"}
        testId={`series-${key}`}
      />
    );

  return (
    <Dialog
      open
      modal={false}
      title={t.editSeries.title}
      onClose={cancel}
      width={collapsed ? 460 : 520}
      className={`ts-chart-data-dialog ts-edit-series${
        collapsed ? " ts-refedit-dialog--collapsed" : ""
      }`}
      data-testid="chart-edit-series"
      style={collapsed ? collapsedPosition(refs.cellArea.current) : undefined}
      footer={
        collapsed ? undefined : (
          <>
            <Button onClick={cancel}>{t.selectData.cancel}</Button>
            <Button variant="primary" onClick={ok}>
              {t.selectData.ok}
            </Button>
          </>
        )
      }
    >
      <div className="ts-chart-data-body">
        {field("name", t.editSeries.seriesName, { name: true })}
        {xy && field("x", t.editSeries.seriesX)}
        {field("values", xy ? t.editSeries.seriesY : t.editSeries.seriesValues)}
        {bubble && field("sizes", t.editSeries.bubbleSize)}
        {!collapsed && Object.keys(errors).length > 0 && (
          <p className="ts-chart-data-error" role="alert">
            {t.selectData.invalidReference}
          </p>
        )}
      </div>
    </Dialog>
  );
};

/** Axis Labels: the category labels of every series. */
const AxisLabelsDialog: React.FC<SubProps & { index: number }> = ({
  base: baseProp,
  index,
  target,
  preview,
  onCollapsedChange,
  onDone,
}) => {
  const { context, refs } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const [base] = useState(baseProp);
  const sheetId = context.currentSheetId;
  const [text, setText] = useState(() =>
    seriesCategoriesText(context, base.series[index] ?? base.series[0])
  );
  const [invalid, setInvalid] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const build = (value: string) => {
    const next = _.cloneDeep(base);
    let bad = false;
    next.series.forEach((s) => {
      if (setSeriesCategories(context, s, value, sheetId)) bad = true;
    });
    return { next, bad };
  };
  const update = (value: string) => {
    setText(value);
    const { next, bad } = build(value);
    setInvalid(bad);
    if (!bad) preview(next);
  };
  const updateRef = useRef(update);
  updateRef.current = update;
  const activate = () => {
    target.current = {
      set: (value) => updateRef.current(value),
      parens: true,
      input: input.current,
    };
  };
  useEffect(() => {
    onCollapsedChange(collapsed);
  }, [collapsed, onCollapsedChange]);

  const cancel = () => {
    preview(base);
    onDone(null);
  };
  const ok = () => {
    const { next, bad } = build(text);
    if (bad) {
      setInvalid(true);
      return;
    }
    preview(next);
    onDone(next);
  };
  return (
    <Dialog
      open
      modal={false}
      title={t.axisLabels.title}
      onClose={cancel}
      width={collapsed ? 460 : 480}
      className={`ts-chart-data-dialog${
        collapsed ? " ts-refedit-dialog--collapsed" : ""
      }`}
      data-testid="chart-axis-labels"
      style={collapsed ? collapsedPosition(refs.cellArea.current) : undefined}
      footer={
        collapsed ? undefined : (
          <>
            <Button onClick={cancel}>{t.selectData.cancel}</Button>
            <Button variant="primary" onClick={ok}>
              {t.selectData.ok}
            </Button>
          </>
        )
      }
    >
      <div className="ts-chart-data-body">
        <RefEdit
          label={t.axisLabels.range}
          value={text}
          onChange={update}
          onActivate={activate}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          collapsed={collapsed}
          invalid={invalid}
          preview={chartFieldPreview(context, text, sheetId, {
            plainList: true,
          })}
          collapseLabel={t.selectData.collapse}
          expandLabel={t.selectData.expand}
          inputRef={input}
          autoFocus
          testId="axis-label-range"
        />
        {invalid && !collapsed && (
          <p className="ts-chart-data-error" role="alert">
            {t.selectData.invalidReference}
          </p>
        )}
      </div>
    </Dialog>
  );
};

/** Hidden and Empty Cell Settings. */
const HiddenEmptyDialog: React.FC<{
  base: Chart;
  onDone: (next: Chart | null) => void;
}> = ({ base, onDone }) => {
  const { context } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const [blanks, setBlanks] = useState(base.displayBlanksAs ?? "gap");
  const [showHidden, setShowHidden] = useState(base.plotVisibleOnly === false);
  const [naBlank, setNaBlank] = useState(!!base.displayNaAsBlank);
  // markers-only scatter charts cannot connect points (Excel)
  const noLines =
    (base.type === "scatter" && !base.scatterLines) ||
    base.type === "column" ||
    base.type === "bar" ||
    base.type === "pie" ||
    base.type === "doughnut";
  const ok = () => {
    const next = _.cloneDeep(base);
    if (blanks === "gap") delete next.displayBlanksAs;
    else next.displayBlanksAs = blanks;
    if (showHidden) next.plotVisibleOnly = false;
    else delete next.plotVisibleOnly;
    if (naBlank) next.displayNaAsBlank = true;
    else delete next.displayNaAsBlank;
    onDone(next);
  };
  return (
    <Dialog
      open
      modal={false}
      title={t.hiddenEmpty.title}
      onClose={() => onDone(null)}
      width={400}
      className="ts-chart-data-dialog"
      data-testid="chart-hidden-empty"
      footer={
        <>
          <Button onClick={() => onDone(null)}>{t.selectData.cancel}</Button>
          <Button variant="primary" onClick={ok}>
            {t.selectData.ok}
          </Button>
        </>
      }
    >
      <fieldset className="ts-chart-hidden-empty" role="radiogroup">
        <legend>{t.hiddenEmpty.showEmptyAs}</legend>
        <Radio
          name="blanks"
          checked={blanks === "gap"}
          onChange={() => setBlanks("gap")}
          label={t.hiddenEmpty.gaps}
        />
        <Radio
          name="blanks"
          checked={blanks === "zero"}
          onChange={() => setBlanks("zero")}
          label={t.hiddenEmpty.zero}
        />
        <Radio
          name="blanks"
          checked={blanks === "span"}
          disabled={noLines}
          onChange={() => setBlanks("span")}
          label={t.hiddenEmpty.connect}
        />
      </fieldset>
      <div className="ts-chart-hidden-empty-checks">
        <Checkbox
          checked={showHidden}
          onChange={setShowHidden}
          label={t.hiddenEmpty.showHidden}
        />
        <Checkbox
          checked={naBlank}
          onChange={setNaBlank}
          label={t.hiddenEmpty.naAsEmpty}
        />
      </div>
    </Dialog>
  );
};

export default SelectDataDialog;
