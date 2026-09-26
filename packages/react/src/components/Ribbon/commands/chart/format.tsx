/**
 * The chart Format tab's drawing commands (Excel 365):
 *
 * - Insert Shapes: the shape gallery (pick, then drag in the chart), Edit
 *   Shape › Change Shape, Text Box — shapes drawn in the chart belong to it
 *   (xlsx chart drawing, see core chartShapes.ts);
 * - Shape Effects: Preset, Shadow, Glow, Soft Edges, Bevel, 3-D Rotation;
 * - WordArt Styles: the style gallery and Text Effects (Shadow,
 *   Reflection, Glow, Bevel, 3-D Rotation);
 * - Arrange › Align, Group, Rotate over the selected charts and shapes
 *   (also the Shape Format tab of a multi-selection).
 */
import React, { useContext, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Grid3x3,
  Magnet,
  PenTool,
  RotateCcw,
  RotateCw,
  Shapes,
  Sparkles,
  TextCursorInput,
  Ungroup,
  WandSparkles,
} from "lucide-react";
import {
  alignObjects,
  canGroupObjects,
  canRegroupObjects,
  canRotateObjects,
  canUngroupObjects,
  changeChartShape,
  CHART_WORDART_STYLES,
  chartShapeOf,
  chartToolsLocale,
  Context,
  distributeObjects,
  findChart,
  getSheetIndex,
  groupObjects,
  insertChartShape,
  locale,
  regroupObjects,
  rotateObjects,
  selectedObjects,
  setShowGridLines,
  SHAPE_GALLERY,
  sheetShowsGridLines,
  ungroupObjects,
} from "@lofcz/tinysheet-core";
import type {
  Chart,
  ChartWordArtStyle,
  ShapeGalleryItem,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { Gallery, MenuItem, Tooltip } from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { RibbonButton } from "../kit";
import { ShapePresetIcon } from "../../../Shapes/ShapePresetIcon";
import {
  elementCaps,
  setElementFormat,
  useChartTools,
} from "../../../Chart/chartTools";
import { effectsMenu } from "../../../Chart/ChartEffectsMenu";
import { setChartPreview } from "../../../Chart/chartPreview";
import { variant } from "../../../Chart/chartGalleries";
import {
  setPendingChartShape,
  usePendingChartShape,
} from "../../../Chart/chartShapeDraw";

const SHAPE_CATEGORIES: ShapeGalleryItem["category"][] = [
  "lines",
  "basic",
  "arrows",
  "callouts",
  "stars",
  "text",
];

/** The shape gallery (Insert Shapes, Change Shape). */
const ShapeGallery: React.FC<{
  label: string;
  onPick: (key: string, byKeyboard: boolean) => void;
  exclude?: (item: ShapeGalleryItem) => boolean;
}> = ({ label, onPick, exclude }) => {
  const { context } = useContext(WorkbookContext);
  const st = locale(context).shape as Record<string, string>;
  return (
    <div
      className="ts-shape-gallery"
      role="menu"
      aria-label={label}
      data-testid="chart-shape-gallery"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const tiles = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")
        );
        const i = tiles.indexOf(e.target as HTMLElement);
        if (i < 0) return;
        e.preventDefault();
        const next = e.key === "ArrowRight" ? i + 1 : i - 1;
        tiles[(next + tiles.length) % tiles.length]?.focus();
      }}
    >
      {SHAPE_CATEGORIES.map((category) => {
        const items = SHAPE_GALLERY.filter(
          (g) => g.category === category && !exclude?.(g)
        );
        if (!items.length) return null;
        return (
          <div key={category} className="ts-shape-gallery-section">
            <div className="ts-chart-gallery-title">{st[category]}</div>
            <div className="ts-shape-gallery-tiles">
              {items.map((item) => (
                <Tooltip key={item.key} label={st[item.key] ?? item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    className="ts-shape-gallery-tile"
                    aria-label={st[item.key] ?? item.key}
                    data-shape-key={item.key}
                    onClick={(e) => onPick(item.key, e.detail === 0)}
                  >
                    <ShapePresetIcon item={item} />
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Insert Shapes

/** Insert a shape into the chart now (keyboard: in the middle). */
function insertNow(
  update: ReturnType<typeof useChartTools>["update"],
  setContext: (recipe: (ctx: Context) => void) => void,
  chartId: string,
  key: string
) {
  update((c) => {
    insertChartShape(c, key);
  });
  setContext((ctx) => {
    const f = findChart(ctx, chartId);
    const last = f?.chart.shapes?.[f.chart.shapes.length - 1];
    if (last) ctx.chartElement = `shape:${last.id}`;
  });
}

export const InsertShapesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, setContext } = useChartTools();
  const pending = usePendingChartShape();
  return (
    <RibbonButton
      size={size}
      icon={Shapes}
      label={t.format.shapes}
      description={t.format.shapesTip}
      disabled={!chart || readonly}
      pressed={!!pending && pending !== "textBox"}
      popover={(close) =>
        chart && (
          <ShapeGallery
            label={t.format.shapes}
            onPick={(key, byKeyboard) => {
              close();
              if (byKeyboard) insertNow(update, setContext, chart.id, key);
              else setPendingChartShape(key);
            }}
          />
        )
      }
    />
  );
};

export const TextBoxCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly } = useChartTools();
  const pending = usePendingChartShape();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={TextCursorInput}
      label={t.format.textBox}
      description={t.format.textBoxTip}
      disabled={!chart || readonly}
      pressed={pending === "textBox"}
      onClick={() =>
        setPendingChartShape(pending === "textBox" ? null : "textBox")
      }
    />
  );
};

export const EditShapeCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  const shape = chart ? chartShapeOf(chart, element) : undefined;
  const menu: MenuItem[] = [
    {
      id: "change",
      label: t.format.changeShape,
      disabled: !shape,
      children: [
        {
          type: "custom",
          id: "change-gallery",
          render: (close) => (
            <ShapeGallery
              label={t.format.changeShape}
              exclude={(g) => !!g.textBox}
              onPick={(key) => {
                close();
                if (shape) update((c) => changeChartShape(c, shape.id, key));
              }}
            />
          ),
        },
      ],
    },
    // custom geometry is not supported: Excel's Edit Points needs it
    { id: "points", label: t.format.editPoints, disabled: true },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={PenTool}
      label={t.format.editShape}
      description={t.format.editShapeTip}
      disabled={!shape || readonly}
      menu={menu}
    />
  );
};

// ---------------------------------------------------------------------------
// Shape Effects, Text Effects, WordArt Styles

export const ShapeEffectsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  const caps = elementCaps(element);
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Sparkles}
      label={t.format.shapeEffects}
      description={t.format.shapeEffectsTip}
      disabled={!chart || readonly}
      menu={
        chart
          ? effectsMenu(t, chart, element, false, (r) => update(r), caps)
          : []
      }
    />
  );
};

export const TextEffectsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { chart, t, readonly, update, element } = useChartTools();
  const caps = elementCaps(element);
  const target = element.startsWith("shape:") ? "chartArea" : element;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={WandSparkles}
      label={t.format.textEffects}
      description={t.format.textEffectsTip}
      disabled={
        !chart || readonly || !caps.text || element.startsWith("series:")
      }
      menu={chart ? effectsMenu(t, chart, target, true, (r) => update(r)) : []}
    />
  );
};

/** Apply a WordArt style (null: clear) to an element's text. */
export function applyWordArt(
  c: Chart,
  element: string,
  style: ChartWordArtStyle | null
) {
  if (!style) {
    setElementFormat(c, element, {
      text: undefined,
      textOutline: undefined,
      textEffects: undefined,
      wordArt: undefined,
    });
    return;
  }
  setElementFormat(c, element, {
    text: style.fill,
    textOutline: style.outline,
    textEffects: style.effects,
    wordArt: style.id,
  });
}

/** A tile of the WordArt gallery: "A" drawn in the style. */
function wordArtTile(style: ChartWordArtStyle) {
  const e = style.effects ?? {};
  const shadows: string[] = [];
  if (e.shadow) {
    const rad = (e.shadow.dir * Math.PI) / 180;
    shadows.push(
      `${Math.round(Math.cos(rad) * e.shadow.dist)}px ${Math.round(
        Math.sin(rad) * e.shadow.dist
      )}px ${e.shadow.blur}px ${e.shadow.color ?? "rgba(0,0,0,0.45)"}`
    );
  }
  if (e.glow)
    shadows.push(`0 0 4px ${e.glow.color}`, `0 0 2px ${e.glow.color}`);
  if (e.bevel) {
    shadows.push(
      "-1px -1px 0 rgba(255,255,255,0.6)",
      "1px 1px 1px rgba(0,0,0,0.5)"
    );
  }
  return (
    <span
      className="ts-wordart-tile"
      style={{
        color: style.fill,
        WebkitTextStroke: style.outline ? `1px ${style.outline}` : undefined,
        textShadow: shadows.join(", ") || undefined,
        ...(e.reflection
          ? ({
              WebkitBoxReflect:
                "below -4px linear-gradient(transparent 55%, rgba(0,0,0,0.35))",
            } as React.CSSProperties)
          : {}),
      }}
    >
      A
    </span>
  );
}

export const WordArtStylesCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const { chart, t, readonly, update, element } = useChartTools();
  const [offset, setOffset] = useState(0);
  const caps = elementCaps(element);
  const disabled =
    !chart || readonly || !caps.text || element.startsWith("series:");
  const current = chart
    ? (chart.formats as Record<string, { wordArt?: number }> | undefined)?.[
        element === "chartArea" ? "title" : element
      ]?.wordArt
    : undefined;
  const pick = (id: number | null) => {
    setChartPreview(null);
    update((c) =>
      applyWordArt(
        c,
        element,
        id == null ? null : (CHART_WORDART_STYLES[id - 1] ?? null)
      )
    );
  };
  const preview = (id: number | null) =>
    chart &&
    setChartPreview(
      id == null
        ? null
        : variant(chart, (c) =>
            applyWordArt(c, element, CHART_WORDART_STYLES[id - 1] ?? null)
          )
    );
  const gallery = (close: () => void) => (
    <Gallery
      aria-label={t.format.wordArtStyles}
      columns={5}
      itemWidth={48}
      itemHeight={48}
      selectedId={current ? String(current) : undefined}
      items={CHART_WORDART_STYLES.map((s) => ({
        id: String(s.id),
        label: s.label,
        preview: wordArtTile(s),
      }))}
      onPreview={(id) => preview(id ? Number(id) : null)}
      onPick={(id) => pick(Number(id))}
      footer={[
        {
          id: "clear",
          label: t.format.clearWordArt,
          onSelect: () => pick(null),
        },
      ]}
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
        icon={WandSparkles}
        label={t.format.wordArtStyles}
        description={t.format.wordArtTip}
        disabled={disabled}
        popover={gallery}
      />
    );
  }
  const visible = 3;
  const shown = CHART_WORDART_STYLES.slice(offset, offset + visible);
  return (
    <div
      className="ts-chart-style-strip ts-wordart-strip"
      role="listbox"
      aria-label={t.format.wordArtStyles}
      data-testid="chart-wordart-strip"
      onMouseLeave={() => setChartPreview(null)}
    >
      <div className="ts-chart-style-strip-tiles">
        {shown.map((s) => (
          <Tooltip key={s.id} label={s.label}>
            <button
              type="button"
              role="option"
              aria-selected={s.id === current}
              aria-label={s.label}
              className="ts-chart-style-strip-tile ts-wordart-strip-tile"
              data-wordart={s.id}
              disabled={disabled}
              onMouseEnter={() => preview(s.id)}
              onClick={() => pick(s.id)}
            >
              {wordArtTile(s)}
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="ts-chart-style-strip-scroll">
        <button
          type="button"
          className="ts-chart-style-strip-arrow"
          aria-label="▲"
          disabled={offset === 0 || disabled}
          onClick={() => setOffset(Math.max(0, offset - visible))}
        >
          ▴
        </button>
        <button
          type="button"
          className="ts-chart-style-strip-arrow"
          aria-label="▼"
          disabled={offset + visible >= CHART_WORDART_STYLES.length || disabled}
          onClick={() =>
            setOffset(
              Math.min(CHART_WORDART_STYLES.length - visible, offset + visible)
            )
          }
        >
          ▾
        </button>
        <RibbonButton
          size="small"
          icon={WandSparkles}
          label={t.format.wordArtStyles}
          description={t.format.wordArtTip}
          disabled={disabled}
          popover={gallery}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Arrange: Align, Group, Rotate (charts and shapes selected together)

function useObjects() {
  const { context, setContext } = useContext(WorkbookContext);
  const t = chartToolsLocale(context);
  const refs = selectedObjects(context);
  const readonly = context.allowEdit === false;
  const run = (recipe: (ctx: Context) => void) =>
    !readonly && setContext(recipe);
  return { context, setContext, t, refs, readonly, run };
}

export const AlignCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, setContext, t, refs, readonly, run } = useObjects();
  const f = t.format;
  const two = refs.length >= 2 && !readonly;
  const three = refs.length >= 3 && !readonly;
  const i = getSheetIndex(context, context.currentSheetId);
  const sheet = i == null ? null : context.luckysheetfile[i];
  const menu: MenuItem[] = [
    ...(
      [
        ["left", f.alignLeft, AlignStartVertical],
        ["center", f.alignCenter, AlignCenterVertical],
        ["right", f.alignRight, AlignEndVertical],
        ["top", f.alignTop, AlignStartHorizontal],
        ["middle", f.alignMiddle, AlignCenterHorizontal],
        ["bottom", f.alignBottom, AlignEndHorizontal],
      ] as const
    ).map(([how, label, icon]) => ({
      id: how,
      label,
      icon,
      disabled: !two,
      onSelect: () => run((ctx) => alignObjects(ctx, how)),
    })),
    { type: "separator" as const },
    {
      id: "distributeH",
      label: f.distributeHorizontally,
      icon: AlignHorizontalDistributeCenter,
      disabled: !three,
      onSelect: () => run((ctx) => distributeObjects(ctx, "horizontal")),
    },
    {
      id: "distributeV",
      label: f.distributeVertically,
      icon: AlignVerticalDistributeCenter,
      disabled: !three,
      onSelect: () => run((ctx) => distributeObjects(ctx, "vertical")),
    },
    { type: "separator" as const },
    {
      id: "snapGrid",
      label: f.snapToGrid,
      icon: Grid3x3,
      checked: !!context.snapToGrid,
      onSelect: () =>
        setContext(
          (ctx) => {
            ctx.snapToGrid = !ctx.snapToGrid || undefined;
          },
          { noHistory: true }
        ),
    },
    {
      id: "snapShape",
      label: f.snapToShape,
      icon: Magnet,
      checked: !!context.snapToShape,
      onSelect: () =>
        setContext(
          (ctx) => {
            ctx.snapToShape = !ctx.snapToShape || undefined;
          },
          { noHistory: true }
        ),
    },
    {
      id: "viewGridlines",
      label: f.viewGridlines,
      checked: sheetShowsGridLines(sheet),
      disabled: readonly,
      onSelect: () =>
        setContext((ctx) => setShowGridLines(ctx, !sheetShowsGridLines(sheet))),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={AlignStartVertical}
      label={f.align}
      description={f.alignTip}
      disabled={refs.length === 0}
      menu={menu}
    />
  );
};

export const GroupCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, t, refs, readonly, run } = useObjects();
  const f = t.format;
  const menu: MenuItem[] = [
    {
      id: "group",
      label: f.group,
      icon: Group,
      disabled: readonly || !canGroupObjects(context),
      onSelect: () => run((ctx) => groupObjects(ctx)),
    },
    {
      id: "regroup",
      label: f.regroup,
      disabled: readonly || !canRegroupObjects(context),
      onSelect: () => run((ctx) => regroupObjects(ctx)),
    },
    {
      id: "ungroup",
      label: f.ungroup,
      icon: Ungroup,
      disabled: readonly || !canUngroupObjects(context),
      onSelect: () => run((ctx) => ungroupObjects(ctx)),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Group}
      label={f.group}
      description={f.groupTip}
      disabled={
        refs.length === 0 ||
        (!canGroupObjects(context) &&
          !canUngroupObjects(context) &&
          !canRegroupObjects(context))
      }
      menu={menu}
    />
  );
};

export const RotateCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context, t, readonly, run } = useObjects();
  const f = t.format;
  // charts cannot be rotated or flipped (Excel greys Rotate for them)
  const can = !readonly && canRotateObjects(context);
  const menu: MenuItem[] = (
    [
      ["right", f.rotateRight, RotateCw],
      ["left", f.rotateLeft, RotateCcw],
      ["flipV", f.flipVertical, FlipVertical2],
      ["flipH", f.flipHorizontal, FlipHorizontal2],
    ] as const
  ).map(([how, label, icon]) => ({
    id: how,
    label,
    icon,
    disabled: !can,
    onSelect: () => run((ctx) => rotateObjects(ctx, how)),
  }));
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={RotateCw}
      label={f.rotate}
      description={f.rotateChartTip}
      disabled={!can}
      menu={menu}
    />
  );
};
