/**
 * The chart's contextual tabs (Excel 365):
 *
 * - Chart Design: Chart Layouts (Add Chart Element, Quick Layout) · Chart
 *   Styles (Change Colors, the style gallery) · Data (Switch Row/Column,
 *   Select Data) · Type (Change Chart Type) · Location (Move Chart).
 * - Format: Current Selection (element list, Format Selection, Reset to
 *   Match Style) · Shape Styles (styles, Shape Fill / Outline / Effects) ·
 *   WordArt Styles (Text Fill / Outline) · Arrange (Bring Forward, Send
 *   Backward, Align, Group, Rotate) · Size (height, width).
 *
 * Layout in ../../tabs/chart.ts; the tabs show while a chart is selected.
 */
import React, { useMemo, useState } from "react";
import _ from "lodash";
import {
  AlignStartVertical,
  ArrowRightLeft,
  Baseline,
  BringToFront,
  ChartColumnBig,
  createLucideIcon,
  Group,
  Highlighter,
  LayoutPanelTop,
  Move,
  MoveHorizontal,
  MoveVertical,
  Palette,
  PaintBucket,
  PenLine,
  RotateCcw,
  RotateCw,
  SendToBack,
  Sparkles,
  SquareMousePointer,
  TableProperties,
} from "lucide-react";
import {
  applyChartQuickLayout,
  canSwitchChartRowColumn,
  CHART_QUICK_LAYOUTS,
  CHART_STYLES,
  chartQuickLayoutElements,
  chartSelectableElements,
  chartToolsLocale,
  Context,
  reorderChart,
  resetChartElementFormat,
  switchChartDataRowColumn,
  updateChart,
} from "@lofcz/tinysheet-core";
import type { ChartFormatKey } from "@lofcz/tinysheet-core";
import {
  ColorPicker,
  Gallery,
  MenuItem,
  NumberInput,
  Select,
  Tooltip,
} from "../../../ui";
import { registerRibbonCommand } from "../../registry";
import type { RibbonCommandProps } from "../../registry";
import { registerContextualTabs } from "../../contextual";
import { RibbonButton } from "../kit";
import { chartDesignTab, chartFormatTab } from "../../tabs/chart";
import {
  applyChartElementOption,
  chartElementLabel,
  chartElementsMenu,
  elementCaps,
  setElementFormat,
  useChartTools,
} from "../../../Chart/chartTools";
import { ChartThumb } from "../../../Chart/ChartThumb";
import {
  applyChartPalette,
  applyChartStyle,
  fill,
  PaletteList,
  styleThumb,
  variant,
} from "../../../Chart/chartGalleries";
import { setChartPreview } from "../../../Chart/chartPreview";
import { openChartDialog } from "../../../Chart/dialogs/store";
import { useChangeChartTypeDialog } from "../../../Chart/dialogs";
import "./chart.css";

// ---------------------------------------------------------------------------
// Glyphs

/** Add Chart Element: a chart with a plus. */
export const AddChartElementIcon = createLucideIcon({
  name: "ts-add-chart-element",
  size: 24,
  node: [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h9", key: "axis" }],
    ["path", { d: "M8 17v-5", key: "b1" }],
    ["path", { d: "M12 17V8", key: "b2" }],
    ["path", { d: "M16 11V5", key: "b3" }],
    ["path", { d: "M19 15v6", key: "p1" }],
    ["path", { d: "M16 18h6", key: "p2" }],
  ],
});

/** Chart Styles: a chart with a brush stroke. */
export const ChartStyleIcon = createLucideIcon({
  name: "ts-chart-style",
  size: 24,
  node: [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "axis" }],
    ["path", { d: "M7 16l4-5 3 3 5-6", key: "line" }],
  ],
});

// ---------------------------------------------------------------------------
// Style and palette helpers

// ---------------------------------------------------------------------------
// Chart Design › Chart Layouts

const AddChartElementCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const tools = useChartTools();
  const { chart, t, readonly, update, element, openPane, labels } = tools;
  const menu = useMemo(
    () =>
      chart
        ? chartElementsMenu(chart, t, {
            apply: (el, option) =>
              applyChartElementOption(
                update,
                chart,
                element,
                el,
                option,
                labels
              ),
            more: (el) => openPane(el),
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, t, element]
  );
  return (
    <RibbonButton
      size={size}
      icon={AddChartElementIcon}
      label={t.design.addChartElement}
      description={t.design.addChartElementTip}
      disabled={!chart || readonly}
      menu={menu}
    />
  );
};

const QuickLayoutCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, labels } = useChartTools();
  const layoutTip = (n: number) =>
    chartQuickLayoutElements(n)
      .map((el) => {
        const [name, opt] = el.split(":");
        const e = t.elements as Record<string, string>;
        const nm = t.names as Record<string, string>;
        const base =
          e[name] ??
          nm[name.replace(/^categoryAxis$/, "horizontalCategoryAxis")] ??
          name;
        return opt ? `${base} (${e[opt] ?? opt})` : base;
      })
      .join(", ");
  return (
    <RibbonButton
      size={size}
      icon={LayoutPanelTop}
      label={t.design.quickLayout}
      description={t.design.quickLayoutTip}
      disabled={!chart || readonly}
      popover={(close) =>
        chart && (
          <Gallery
            aria-label={t.design.quickLayout}
            columns={3}
            itemWidth={78}
            itemHeight={58}
            items={CHART_QUICK_LAYOUTS.map((_l, i) => ({
              id: String(i + 1),
              label: fill(t.design.layout, i + 1),
              description: layoutTip(i + 1),
              preview: (
                <ChartThumb
                  chart={variant(chart, (c) =>
                    applyChartQuickLayout(c, i + 1, labels)
                  )}
                  width={74}
                  height={54}
                  detail={3.2}
                />
              ),
            }))}
            onPreview={(id) =>
              setChartPreview(
                id
                  ? variant(chart, (c) =>
                      applyChartQuickLayout(c, Number(id), labels)
                    )
                  : null
              )
            }
            onPick={(id) => {
              setChartPreview(null);
              update((c) => applyChartQuickLayout(c, Number(id), labels));
            }}
            onClose={() => {
              setChartPreview(null);
              close();
            }}
            autoFocus
          />
        )
      }
    />
  );
};

// ---------------------------------------------------------------------------
// Chart Design › Chart Styles

const ChangeColorsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update } = useChartTools();
  return (
    <RibbonButton
      size={size}
      icon={Palette}
      label={t.design.changeColors}
      description={t.design.changeColorsTip}
      disabled={!chart || readonly}
      popover={(close) =>
        chart && (
          <PaletteList
            chart={chart}
            onPreview={(id) =>
              setChartPreview(
                id ? variant(chart, (c) => applyChartPalette(c, id)) : null
              )
            }
            onPick={(id) => {
              setChartPreview(null);
              update((c) => applyChartPalette(c, id));
              close();
            }}
          />
        )
      }
    />
  );
};

/** The Chart Styles gallery: an inline strip and the full gallery. */
const ChartStylesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update } = useChartTools();
  const [offset, setOffset] = useState(0);
  if (!chart) return null;
  const current = chart.style ?? 1;
  const pick = (id: number) => {
    setChartPreview(null);
    update((c) => applyChartStyle(c, id));
  };
  const gallery = (close: () => void) => (
    <Gallery
      aria-label={t.design.chartStyles}
      columns={4}
      itemWidth={92}
      itemHeight={64}
      selectedId={String(current)}
      items={CHART_STYLES.map((s) => ({
        id: String(s.id),
        label: fill(t.design.style, s.id),
        preview: (
          <ChartThumb chart={styleThumb(chart, s.id)} width={88} height={60} />
        ),
      }))}
      onPreview={(id) =>
        setChartPreview(
          id ? variant(chart, (c) => applyChartStyle(c, Number(id))) : null
        )
      }
      onPick={(id) => pick(Number(id))}
      onClose={() => {
        setChartPreview(null);
        close();
      }}
      autoFocus
    />
  );
  if (size !== "large") {
    return (
      <RibbonButton
        size="small"
        icon={ChartStyleIcon}
        label={t.design.chartStyles}
        description={t.design.chartStylesTip}
        disabled={readonly}
        popover={gallery}
      />
    );
  }
  const visible = 4;
  const shown = CHART_STYLES.slice(offset, offset + visible);
  return (
    <div
      className="ts-chart-style-strip"
      role="listbox"
      aria-label={t.design.chartStyles}
      onMouseLeave={() => setChartPreview(null)}
    >
      <div className="ts-chart-style-strip-tiles">
        {shown.map((s) => (
          <Tooltip key={s.id} label={fill(t.design.style, s.id)}>
            <button
              type="button"
              role="option"
              aria-selected={s.id === current}
              aria-label={fill(t.design.style, s.id)}
              className="ts-chart-style-strip-tile"
              data-style={s.id}
              disabled={readonly}
              onMouseEnter={() =>
                setChartPreview(variant(chart, (c) => applyChartStyle(c, s.id)))
              }
              onClick={() => pick(s.id)}
            >
              <ChartThumb
                chart={styleThumb(chart, s.id)}
                width={62}
                height={44}
              />
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="ts-chart-style-strip-scroll">
        <button
          type="button"
          className="ts-chart-style-strip-arrow"
          aria-label="▲"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - visible))}
        >
          ▴
        </button>
        <button
          type="button"
          className="ts-chart-style-strip-arrow"
          aria-label="▼"
          disabled={offset + visible >= CHART_STYLES.length}
          onClick={() =>
            setOffset(Math.min(CHART_STYLES.length - visible, offset + visible))
          }
        >
          ▾
        </button>
        <RibbonButton
          size="small"
          icon={ChartStyleIcon}
          label={t.design.moreStyles}
          description={t.design.chartStylesTip}
          disabled={readonly}
          popover={gallery}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chart Design › Data, Type, Location

const SwitchRowColumnCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update } = useChartTools();
  return (
    <RibbonButton
      size={size}
      icon={ArrowRightLeft}
      label={t.design.switchRowColumn}
      description={t.design.switchRowColumnTip}
      disabled={!chart || readonly || !canSwitchChartRowColumn(chart)}
      onClick={() => update((c, ctx) => switchChartDataRowColumn(ctx, c))}
    />
  );
};

const SelectDataCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly } = useChartTools();
  return (
    <RibbonButton
      size={size}
      icon={TableProperties}
      label={t.design.selectData}
      description={t.design.selectDataTip}
      disabled={!chart || readonly}
      onClick={() =>
        chart && openChartDialog({ kind: "selectData", chartId: chart.id })
      }
    />
  );
};

const ChangeChartTypeCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly } = useChartTools();
  const open = useChangeChartTypeDialog();
  return (
    <RibbonButton
      size={size}
      icon={ChartColumnBig}
      label={t.design.changeChartType}
      description={t.design.changeChartTypeTip}
      disabled={!chart || readonly}
      onClick={() => chart && open(chart.id)}
    />
  );
};

const MoveChartCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly } = useChartTools();
  return (
    <RibbonButton
      size={size}
      icon={Move}
      label={t.design.moveChart}
      description={t.design.moveChartTip}
      disabled={!chart || readonly}
      onClick={() =>
        chart && openChartDialog({ kind: "moveChart", chartId: chart.id })
      }
    />
  );
};

// ---------------------------------------------------------------------------
// Format › Current Selection

const ElementSelectCommand: React.FC<RibbonCommandProps> = () => {
  const { chart, t, element, selectElement, context } = useChartTools();
  if (!chart) return null;
  const ids = chartSelectableElements(chart);
  const value = ids.includes(element) ? element : "chartArea";
  return (
    <div className="ts-chart-element-select" data-testid="chart-element-select">
      <Select
        aria-label={t.format.chartElements}
        tooltip
        value={value}
        width={176}
        size="sm"
        options={ids.map((id) => ({
          value: id,
          label: chartElementLabel(context, chart, id, t),
        }))}
        onChange={selectElement}
      />
    </div>
  );
};

const FormatSelectionCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, openPane } = useChartTools();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={SquareMousePointer}
      label={t.format.formatSelection}
      description={t.format.formatSelectionTip}
      disabled={!chart}
      onClick={() => openPane()}
    />
  );
};

const ResetStyleCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={RotateCcw}
      label={t.format.resetToMatchStyle}
      description={t.format.resetToMatchStyleTip}
      disabled={!chart || readonly}
      onClick={() => update((c) => resetChartElementFormat(c, element))}
    />
  );
};

// ---------------------------------------------------------------------------
// Format › Shape Styles, WordArt Styles

const THEME_ACCENTS = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];

const ShapeStylesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  const caps = elementCaps(element);
  return (
    <RibbonButton
      size={size}
      icon={Sparkles}
      label={t.format.shapeStyleGallery}
      description={t.format.shapeFillTip}
      disabled={!chart || readonly || !caps.fill}
      popover={(close) => (
        <Gallery
          aria-label={t.format.shapeStyleGallery}
          columns={6}
          itemWidth={44}
          itemHeight={32}
          items={[
            ...THEME_ACCENTS.map((color, i) => ({
              id: `fill-${i}`,
              label: t.format.themeStyle.replace(
                "{color}",
                fill(t.format.accent, i + 1)
              ),
              preview: (
                <span
                  className="ts-shape-style-tile"
                  style={{ background: color, borderColor: color }}
                />
              ),
            })),
            ...THEME_ACCENTS.map((color, i) => ({
              id: `outline-${i}`,
              label: fill(t.format.accent, i + 1),
              preview: (
                <span
                  className="ts-shape-style-tile ts-shape-style-tile--outline"
                  style={{ borderColor: color }}
                />
              ),
            })),
          ]}
          onPick={(id) => {
            const [kind, i] = id.split("-");
            const color = THEME_ACCENTS[Number(i)];
            update((c) =>
              setElementFormat(
                c,
                element,
                kind === "fill"
                  ? { fill: color, line: color }
                  : { fill: null, line: color }
              )
            );
            close();
          }}
          onClose={close}
          autoFocus
        />
      )}
    />
  );
};

const ShapeFillCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={PaintBucket}
      label={t.format.shapeFill}
      description={t.format.shapeFillTip}
      disabled={!chart || readonly || !elementCaps(element).fill}
      popover={(close) => (
        <ColorPicker
          aria-label={t.format.shapeFill}
          automaticLabel={t.format.noFill}
          moreColors
          onChange={(color) => {
            update((c) => setElementFormat(c, element, { fill: color }));
            close();
          }}
        />
      )}
    />
  );
};

const ShapeOutlineCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={PenLine}
      label={t.format.shapeOutline}
      description={t.format.shapeOutlineTip}
      disabled={!chart || readonly}
      popover={(close) => (
        <ColorPicker
          aria-label={t.format.shapeOutline}
          automaticLabel={t.format.noOutline}
          moreColors
          onChange={(color) => {
            update((c) => setElementFormat(c, element, { line: color }));
            close();
          }}
        />
      )}
    />
  );
};

const ShapeEffectsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  const seriesIndex = /^series:(\d+)$/.exec(element)?.[1];
  const on =
    seriesIndex != null
      ? !!chart?.series[Number(seriesIndex)]?.shadow
      : !!chart?.formats?.[element as ChartFormatKey]?.shadow;
  const menu: MenuItem[] = [
    {
      id: "shadow",
      label: t.format.shadow,
      checked: on,
      onSelect: () =>
        update((c) =>
          setElementFormat(c, element, { shadow: on ? undefined : true })
        ),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Sparkles}
      label={t.format.shapeEffects}
      description={t.format.shapeEffectsTip}
      disabled={!chart || readonly || !elementCaps(element).effects}
      menu={menu}
    />
  );
};

const TextFillCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Baseline}
      label={t.format.textFill}
      description={t.format.textFillTip}
      disabled={!chart || readonly || !elementCaps(element).text}
      popover={(close) => (
        <ColorPicker
          aria-label={t.format.textFill}
          automaticLabel={t.format.automatic}
          automaticColor="#595959"
          moreColors
          onChange={(color) => {
            update((c) =>
              setElementFormat(c, element, { text: color ?? undefined })
            );
            close();
          }}
        />
      )}
    />
  );
};

const TextOutlineCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Highlighter}
      label={t.format.textOutline}
      description={t.format.textOutlineTip}
      disabled={
        !chart || readonly || (element !== "title" && element !== "chartArea")
      }
      popover={(close) => (
        <ColorPicker
          aria-label={t.format.textOutline}
          automaticLabel={t.format.noOutline}
          moreColors
          onChange={(color) => {
            update((c) =>
              setElementFormat(c, "title", {
                textOutline: color ?? undefined,
              })
            );
            close();
          }}
        />
      )}
    />
  );
};

// ---------------------------------------------------------------------------
// Format › Arrange, Size

const BringForwardCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, setContext } = useChartTools();
  const run = (to: "forward" | "front") =>
    chart && setContext((ctx) => reorderChart(ctx, chart.id, to));
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={BringToFront}
      label={t.format.bringForward}
      description={t.format.bringForwardTip}
      disabled={!chart || readonly}
      onClick={() => run("forward")}
      menu={[
        {
          id: "forward",
          label: t.format.bringForward,
          onSelect: () => run("forward"),
        },
        {
          id: "front",
          label: t.format.bringToFront,
          onSelect: () => run("front"),
        },
      ]}
    />
  );
};

const SendBackwardCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, setContext } = useChartTools();
  const run = (to: "backward" | "back") =>
    chart && setContext((ctx) => reorderChart(ctx, chart.id, to));
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={SendToBack}
      label={t.format.sendBackward}
      description={t.format.sendBackwardTip}
      disabled={!chart || readonly}
      onClick={() => run("backward")}
      menu={[
        {
          id: "backward",
          label: t.format.sendBackward,
          onSelect: () => run("backward"),
        },
        { id: "back", label: t.format.sendToBack, onSelect: () => run("back") },
      ]}
    />
  );
};

const disabledCommand = (
  icon: typeof Group,
  label: keyof ReturnType<typeof chartToolsLocale>["format"],
  tip: keyof ReturnType<typeof chartToolsLocale>["format"]
) => {
  const C: React.FC<RibbonCommandProps> = ({ size }) => {
    const { t } = useChartTools();
    return (
      <RibbonButton
        size={size}
        small="labeled"
        icon={icon}
        label={t.format[label]}
        description={t.format[tip]}
        disabled
      />
    );
  };
  return C;
};

/** Height / width in inches (Excel's Size group). */
const SizeCommand: React.FC<
  RibbonCommandProps & { dim: "height" | "width" }
> = ({ dim }) => {
  const { chart, t, readonly, setContext } = useChartTools();
  if (!chart) return null;
  const px = dim === "height" ? chart.height : chart.width;
  const inches = Math.round((px / 96) * 100) / 100;
  return (
    <Tooltip label={dim === "height" ? t.format.height : t.format.width}>
      <div className="ts-chart-size-field" data-testid={`chart-size-${dim}`}>
        {dim === "height" ? (
          <MoveVertical size={16} aria-hidden />
        ) : (
          <MoveHorizontal size={16} aria-hidden />
        )}
        <NumberInput
          aria-label={dim === "height" ? t.format.height : t.format.width}
          value={inches}
          min={0.1}
          max={50}
          step={0.1}
          precision={2}
          size="sm"
          width={92}
          suffix={t.format.sizeUnit}
          disabled={readonly}
          onChange={(v) =>
            setContext((ctx: Context) =>
              updateChart(ctx, chart.id, {
                [dim]: Math.max(dim === "height" ? 60 : 80, Math.round(v * 96)),
              })
            )
          }
        />
      </div>
    </Tooltip>
  );
};

const HeightCommand: React.FC<RibbonCommandProps> = (p) => (
  <SizeCommand {...p} dim="height" />
);
const WidthCommand: React.FC<RibbonCommandProps> = (p) => (
  <SizeCommand {...p} dim="width" />
);

// ---------------------------------------------------------------------------

let registered = false;

/** The chart commands and the Chart Design / Format contextual tabs. */
export function registerChartCommands() {
  if (registered) return;
  registered = true;
  registerRibbonCommand("chart-add-element", AddChartElementCommand);
  registerRibbonCommand("chart-quick-layout", QuickLayoutCommand);
  registerRibbonCommand("chart-change-colors", ChangeColorsCommand);
  registerRibbonCommand("chart-styles", ChartStylesCommand);
  registerRibbonCommand("chart-switch-row-column", SwitchRowColumnCommand);
  registerRibbonCommand("chart-select-data", SelectDataCommand);
  registerRibbonCommand("chart-change-type", ChangeChartTypeCommand);
  registerRibbonCommand("chart-move", MoveChartCommand);
  registerRibbonCommand("chart-element-select", ElementSelectCommand);
  registerRibbonCommand("chart-format-selection", FormatSelectionCommand);
  registerRibbonCommand("chart-reset-style", ResetStyleCommand);
  registerRibbonCommand("chart-shape-styles", ShapeStylesCommand);
  registerRibbonCommand("chart-shape-fill", ShapeFillCommand);
  registerRibbonCommand("chart-shape-outline", ShapeOutlineCommand);
  registerRibbonCommand("chart-shape-effects", ShapeEffectsCommand);
  registerRibbonCommand("chart-text-fill", TextFillCommand);
  registerRibbonCommand("chart-text-outline", TextOutlineCommand);
  registerRibbonCommand("chart-bring-forward", BringForwardCommand);
  registerRibbonCommand("chart-send-backward", SendBackwardCommand);
  registerRibbonCommand(
    "chart-align",
    disabledCommand(AlignStartVertical, "align", "alignTip")
  );
  registerRibbonCommand(
    "chart-group",
    disabledCommand(Group, "group", "groupTip")
  );
  registerRibbonCommand(
    "chart-rotate",
    disabledCommand(RotateCw, "rotate", "rotateTip")
  );
  registerRibbonCommand("chart-height", HeightCommand);
  registerRibbonCommand("chart-width", WidthCommand);
  registerContextualTabs({
    id: "chartTools",
    label: (ctx) => chartToolsLocale(ctx).contextual.chartTools,
    isActive: (ctx) =>
      !!ctx.activeChart &&
      !!ctx.luckysheetfile
        .find((s) => s.id === ctx.currentSheetId)
        ?.charts?.some((c) => c.id === ctx.activeChart),
    tabs: (ctx) => {
      const t = chartToolsLocale(ctx);
      return [chartDesignTab(t), chartFormatTab(t)];
    },
  });
}
