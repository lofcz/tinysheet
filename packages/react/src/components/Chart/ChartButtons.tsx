/**
 * The three buttons at the top right, outside a selected chart (Excel):
 *
 * - Chart Elements (+): a check box per element, and its submenu (the one
 *   of Add Chart Element) behind the arrow of its row;
 * - Chart Styles (brush): Style and Color tabs, previewed on hover;
 * - Chart Filters (funnel): Values (series and categories to plot, Apply)
 *   and Names; Select Data… opens the Select Data Source dialog.
 */
import React, { useContext, useMemo, useRef, useState } from "react";
import { ChevronRight, Filter, Paintbrush, Plus } from "lucide-react";
import {
  Chart,
  CHART_STYLES,
  chartElementAvailable,
  chartElementShown,
  ChartElementName,
  chartToolsLocale,
  findChart,
  resolveChartModel,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import {
  Button,
  Checkbox,
  ICON_STROKE,
  MenuList,
  Popover,
  Tabs,
  Tooltip,
} from "../ui";
import {
  applyChartElementOption,
  CHART_ELEMENTS,
  chartElementSubmenu,
} from "./chartTools";
import {
  applyChartPalette,
  applyChartStyle,
  fill,
  PaletteList,
  styleThumb,
  variant,
} from "./chartGalleries";
import { ChartThumb } from "./ChartThumb";
import { setChartPreview } from "./chartPreview";
import { openChartDialog } from "./dialogs/store";

type Flyout = "elements" | "styles" | "filters" | null;

/** Default option when an element's check box is ticked. */
const DEFAULT_ON: Record<ChartElementName, string> = {
  axes: "all",
  axisTitles: "all",
  chartTitle: "above",
  dataLabels: "show",
  dataTable: "keys",
  errorBars: "stdErr",
  gridlines: "majorHorizontal",
  legend: "right",
  lines: "dropLines",
  trendline: "linear",
  upDownBars: "on",
};

export const ChartButtons: React.FC<{
  chartId: string;
  /** Hover on a series in the Chart Filters: emphasise it on the chart. */
  onFocusSeries: (index: number | null) => void;
}> = ({ chartId, onFocusSeries }) => {
  const { context } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const [open, setOpen] = useState<Flyout>(null);
  const refs = {
    elements: useRef<HTMLButtonElement>(null),
    styles: useRef<HTMLButtonElement>(null),
    filters: useRef<HTMLButtonElement>(null),
  };
  const found = findChart(context, chartId);
  if (!found) return null;
  const { chart } = found;
  const button = (
    id: Exclude<Flyout, null>,
    Icon: typeof Plus,
    label: string,
    tip: string
  ) => (
    <Tooltip label={label} description={tip} placement="right-start">
      <button
        ref={refs[id]}
        type="button"
        className={`fortune-chart-action${open === id ? " ts-open" : ""}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open === id}
        data-chart-button={id}
        onClick={() => setOpen((o) => (o === id ? null : id))}
      >
        <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </Tooltip>
  );
  const close = () => {
    setOpen(null);
    setChartPreview(null);
    onFocusSeries(null);
  };
  return (
    <>
      {button(
        "elements",
        Plus,
        t.buttons.chartElements,
        t.buttons.chartElementsTip
      )}
      {button(
        "styles",
        Paintbrush,
        t.buttons.chartStyles,
        t.buttons.chartStylesTip
      )}
      {button(
        "filters",
        Filter,
        t.buttons.chartFilters,
        t.buttons.chartFiltersTip
      )}
      {open && (
        <Popover
          open
          onOpenChange={(o) => {
            if (!o) close();
          }}
          anchorRef={refs[open]}
          placement="right-start"
          variant="panel"
          className={`fortune-chart-flyout fortune-chart-flyout--${open}`}
          role="dialog"
          aria-label={
            open === "elements"
              ? t.buttons.chartElements
              : open === "styles"
                ? t.buttons.chartStyles
                : t.buttons.chartFilters
          }
        >
          {open === "elements" && <ElementsFlyout chart={chart} />}
          {open === "styles" && <StylesFlyout chart={chart} />}
          {open === "filters" && (
            <FiltersFlyout
              chart={chart}
              onFocusSeries={onFocusSeries}
              onDone={close}
            />
          )}
        </Popover>
      )}
    </>
  );
};

/** The Chart Elements flyout. */
const ElementsFlyout: React.FC<{ chart: Chart }> = ({ chart }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const [sub, setSub] = useState<ChartElementName | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const subAnchor = useRef<HTMLElement | null>(null);
  const element = context.chartElement ?? "chartArea";
  const readonly = context.allowEdit === false;
  const update = (recipe: (c: Chart) => void) => {
    if (readonly) return;
    setContext((ctx) => {
      const f = findChart(ctx, chart.id);
      if (f) recipe(f.chart);
    });
  };
  const labels = {
    chartTitle: t.elements.chartTitleDefault,
    axisTitle: t.elements.axisTitleDefault,
  };
  const apply = (el: ChartElementName, option: string) =>
    applyChartElementOption(update, chart, element, el, option, labels);
  const list = CHART_ELEMENTS.filter(
    (el) => el !== "lines" && chartElementAvailable(chart, el)
  );
  return (
    <div className="fortune-chart-elements" data-testid="chart-elements">
      <div className="fortune-chart-flyout-title">
        {t.elements.chartElementsHeader}
      </div>
      {list.map((el) => {
        const on = chartElementShown(chart, el);
        return (
          <div
            key={el}
            ref={(n) => {
              if (n) rowRefs.current.set(el, n);
              else rowRefs.current.delete(el);
            }}
            className={`fortune-chart-element-row${
              sub === el ? " ts-open" : ""
            }`}
            data-element={el}
          >
            <Checkbox
              checked={on}
              disabled={readonly}
              label={t.elements[el]}
              onChange={(next) => apply(el, next ? DEFAULT_ON[el] : "none")}
            />
            <button
              type="button"
              className="fortune-chart-element-more"
              aria-label={t.elements[el]}
              aria-haspopup="menu"
              aria-expanded={sub === el}
              onClick={(e) => {
                subAnchor.current = e.currentTarget;
                setSub((s) => (s === el ? null : el));
              }}
            >
              <ChevronRight size={14} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </div>
        );
      })}
      {sub && (
        <Popover
          open
          onOpenChange={(o) => {
            if (!o) setSub(null);
          }}
          anchorRef={subAnchor}
          placement="right-start"
          variant="menu"
          exclusive={false}
          className="fortune-chart-element-submenu"
        >
          <MenuList
            aria-label={t.elements[sub]}
            autoFocus
            items={chartElementSubmenu(chart, sub, t, {
              apply,
              more: (el) =>
                setContext(
                  (ctx) => {
                    ctx.chartEditorOpen = true;
                    ctx.chartElement = el;
                  },
                  { noHistory: true }
                ),
            })}
            onClose={() => setSub(null)}
            onCloseSubmenu={() => setSub(null)}
          />
        </Popover>
      )}
    </div>
  );
};

/** The Chart Styles flyout: Style and Color tabs. */
const StylesFlyout: React.FC<{ chart: Chart }> = ({ chart }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const [tab, setTab] = useState<"style" | "color">("style");
  const readonly = context.allowEdit === false;
  const update = (recipe: (c: Chart) => void) => {
    if (readonly) return;
    setChartPreview(null);
    setContext((ctx) => {
      const f = findChart(ctx, chart.id);
      if (f) recipe(f.chart);
    });
  };
  const current = chart.style ?? 1;
  return (
    <div className="fortune-chart-styles" data-testid="chart-styles-flyout">
      <Tabs
        tabs={[
          { id: "style", label: t.buttons.style },
          { id: "color", label: t.buttons.color },
        ]}
        value={tab}
        onChange={(id) => setTab(id as "style" | "color")}
        fill
        size="sm"
        aria-label={t.buttons.chartStyles}
      />
      {tab === "style" ? (
        <div
          className="fortune-chart-styles-list"
          role="listbox"
          aria-label={t.buttons.style}
          onMouseLeave={() => setChartPreview(null)}
        >
          {CHART_STYLES.map((s) => (
            <Tooltip
              key={s.id}
              label={fill(t.design.style, s.id)}
              placement="right-start"
            >
              <button
                type="button"
                role="option"
                aria-selected={s.id === current}
                aria-label={fill(t.design.style, s.id)}
                className="fortune-chart-styles-item"
                data-style={s.id}
                disabled={readonly}
                onMouseEnter={() =>
                  setChartPreview(
                    variant(chart, (c) => applyChartStyle(c, s.id))
                  )
                }
                onFocus={() =>
                  setChartPreview(
                    variant(chart, (c) => applyChartStyle(c, s.id))
                  )
                }
                onClick={() => update((c) => applyChartStyle(c, s.id))}
              >
                <ChartThumb
                  chart={styleThumb(chart, s.id)}
                  width={164}
                  height={96}
                  detail={1.6}
                />
              </button>
            </Tooltip>
          ))}
        </div>
      ) : (
        <PaletteList
          chart={chart}
          onPreview={(id) =>
            setChartPreview(
              id ? variant(chart, (c) => applyChartPalette(c, id)) : null
            )
          }
          onPick={(id) => update((c) => applyChartPalette(c, id))}
        />
      )}
    </div>
  );
};

/** The Chart Filters flyout: Values (Apply) and Names. */
const FiltersFlyout: React.FC<{
  chart: Chart;
  onFocusSeries: (index: number | null) => void;
  onDone: () => void;
}> = ({ chart, onFocusSeries, onDone }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const [tab, setTab] = useState<"values" | "names">("values");
  const model = useMemo(
    () => resolveChartModel(context, chart),
    [context, chart]
  );
  const count = Math.max(
    model.categories.length,
    ...model.series.map((s) => s.values.length),
    0
  );
  const categories = Array.from({ length: count }, (_x, i) => {
    const c = model.categories[i];
    return c != null && c !== "" ? c : String(i + 1);
  });
  const [series, setSeries] = useState(() =>
    chart.series.map((s) => !s.filtered)
  );
  const [cats, setCats] = useState(() => {
    const hidden = new Set(chart.hiddenCategories ?? []);
    return categories.map((_c, i) => !hidden.has(i));
  });
  const readonly = context.allowEdit === false;
  const all = (list: boolean[]) =>
    list.every(Boolean) ? true : list.some(Boolean) ? "mixed" : false;
  const apply = () => {
    if (readonly) return;
    setContext((ctx) => {
      const f = findChart(ctx, chart.id);
      if (!f) return;
      f.chart.series.forEach((s, i) => {
        if (series[i] === false) s.filtered = true;
        else delete s.filtered;
      });
      const hidden = cats.map((on, i) => (on ? -1 : i)).filter((i) => i >= 0);
      if (hidden.length) f.chart.hiddenCategories = hidden;
      else delete f.chart.hiddenCategories;
    });
  };
  const xy = chart.type === "scatter" || chart.type === "bubble";
  return (
    <div className="fortune-chart-filters" data-testid="chart-filters">
      <Tabs
        tabs={[
          { id: "values", label: t.buttons.values },
          { id: "names", label: t.buttons.names },
        ]}
        value={tab}
        onChange={(id) => setTab(id as "values" | "names")}
        fill
        size="sm"
        aria-label={t.buttons.chartFilters}
      />
      <div className="fortune-chart-filters-body">
        <div className="fortune-chart-filters-section">
          <div className="fortune-chart-flyout-title">{t.buttons.series}</div>
          {tab === "values" && (
            <Checkbox
              checked={all(series)}
              label={t.buttons.selectAll}
              onChange={(on) => setSeries(series.map(() => on))}
            />
          )}
          {model.series.map((s, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="fortune-chart-filters-item"
              data-series={i}
              onMouseEnter={() => onFocusSeries(i)}
              onMouseLeave={() => onFocusSeries(null)}
            >
              {tab === "values" ? (
                <Checkbox
                  checked={series[i] ?? true}
                  label={
                    <>
                      <span
                        className="fortune-chart-filters-key"
                        style={{ background: s.color }}
                      />
                      {s.name}
                    </>
                  }
                  onChange={(on) =>
                    setSeries(series.map((v, j) => (j === i ? on : v)))
                  }
                />
              ) : (
                <span className="fortune-chart-filters-name">
                  <span
                    className="fortune-chart-filters-key"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </span>
              )}
            </div>
          ))}
        </div>
        {!xy && (
          <div className="fortune-chart-filters-section">
            <div className="fortune-chart-flyout-title">
              {t.buttons.categories}
            </div>
            {tab === "values" && (
              <Checkbox
                checked={all(cats)}
                label={t.buttons.selectAll}
                onChange={(on) => setCats(cats.map(() => on))}
              />
            )}
            {categories.map((c, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="fortune-chart-filters-item"
                data-category={i}
              >
                {tab === "values" ? (
                  <Checkbox
                    checked={cats[i] ?? true}
                    label={c}
                    onChange={(on) =>
                      setCats(cats.map((v, j) => (j === i ? on : v)))
                    }
                  />
                ) : (
                  <span className="fortune-chart-filters-name">{c}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="fortune-chart-filters-footer">
        {tab === "values" && (
          <Button
            variant="primary"
            size="sm"
            disabled={readonly}
            onClick={apply}
          >
            {t.buttons.apply}
          </Button>
        )}
        <button
          type="button"
          className="fortune-chart-filters-link"
          disabled={readonly}
          onClick={() => {
            onDone();
            openChartDialog({ kind: "selectData", chartId: chart.id });
          }}
        >
          {t.buttons.selectData}
        </button>
      </div>
    </div>
  );
};

export default ChartButtons;
