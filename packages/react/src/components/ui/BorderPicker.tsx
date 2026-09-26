import React, { useContext, useSyncExternalStore } from "react";
import { Context, handleBorder, openFormatCells } from "@lofcz/tinysheet-core";
import { Grid2x2Plus, PenLine } from "lucide-react";
import WorkbookContext from "../../context";
import { MenuItem, MenuList } from "./Menu";
import { ColorPicker } from "./ColorPicker";
import "./ui.css";
import "./pickers.css";

/** The presets of Excel's Borders drop-down (Home › Font › Borders). */
export type BorderPreset =
  | "border-bottom"
  | "border-top"
  | "border-left"
  | "border-right"
  | "border-none"
  | "border-all"
  | "border-outside"
  | "border-thick-outside"
  | "border-bottom-double"
  | "border-bottom-thick"
  | "border-top-bottom"
  | "border-top-bottom-thick"
  | "border-top-bottom-double"
  | "border-inside"
  | "border-horizontal"
  | "border-vertical";

/** Line of the borders drawn next: colour and canvas style id ("1" thin). */
export type BorderLineSetting = { color: string; style: string };

export type BorderPickerLabels = Record<BorderPreset, string> & {
  borders: string;
  drawBorders: string;
  lineColor: string;
  lineStyle: string;
  automatic: string;
  moreBorders: string;
};

const DEFAULT_LABELS: BorderPickerLabels = {
  borders: "Borders",
  "border-bottom": "Bottom Border",
  "border-top": "Top Border",
  "border-left": "Left Border",
  "border-right": "Right Border",
  "border-none": "No Border",
  "border-all": "All Borders",
  "border-outside": "Outside Borders",
  "border-thick-outside": "Thick Outside Borders",
  "border-bottom-double": "Bottom Double Border",
  "border-bottom-thick": "Thick Bottom Border",
  "border-top-bottom": "Top and Bottom Border",
  "border-top-bottom-thick": "Top and Thick Bottom Border",
  "border-top-bottom-double": "Top and Double Bottom Border",
  "border-inside": "Inside Borders",
  "border-horizontal": "Inside Horizontal Borders",
  "border-vertical": "Inside Vertical Borders",
  drawBorders: "Draw Borders",
  lineColor: "Line Color",
  lineStyle: "Line Style",
  automatic: "Automatic",
  moreBorders: "More Borders…",
};

/** Excel's line styles, in its Line Style menu order (canvas style ids). */
export const BORDER_LINE_STYLES: {
  style: string;
  name: string;
  width: number;
  dash?: string;
  double?: boolean;
}[] = [
  { style: "1", name: "Thin", width: 1 },
  { style: "2", name: "Hair", width: 1, dash: "1 1" },
  { style: "3", name: "Dotted", width: 1, dash: "2 2" },
  { style: "4", name: "Dashed", width: 1, dash: "4 2" },
  { style: "5", name: "Dash Dot", width: 1, dash: "6 2 2 2" },
  { style: "6", name: "Dash Dot Dot", width: 1, dash: "6 2 2 2 2 2" },
  { style: "8", name: "Medium", width: 2 },
  { style: "9", name: "Medium Dashed", width: 2, dash: "6 3" },
  { style: "10", name: "Medium Dash Dot", width: 2, dash: "8 3 3 3" },
  { style: "11", name: "Medium Dash Dot Dot", width: 2, dash: "8 3 3 3 3 3" },
  { style: "12", name: "Slanted Dash Dot", width: 2, dash: "8 2 3 2" },
  { style: "13", name: "Thick", width: 3 },
  { style: "7", name: "Double", width: 1, double: true },
];

/* ---------- shared line setting (kept between openings) ---------- */

let line: BorderLineSetting = { color: "#000000", style: "1" };
let lastPreset: BorderPreset = "border-bottom";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getLine = () => line;
const getLast = () => lastPreset;

/** The line colour / style the border presets draw with (shared). */
export function useBorderLine(): [
  BorderLineSetting,
  (next: Partial<BorderLineSetting>) => void,
] {
  const value = useSyncExternalStore(subscribe, getLine, getLine);
  return [
    value,
    (next) => {
      line = { ...line, ...next };
      emit();
    },
  ];
}

/** The preset applied last (Excel's split button repeats it). */
export function useLastBorderPreset(): BorderPreset {
  return useSyncExternalStore(subscribe, getLast, getLast);
}

/**
 * Apply a border preset to the selection of `ctx` with `lineSetting`
 * (the composite presets — thick box, double bottom, top and bottom —
 * are several borders in one step).
 */
export function applyBorderPreset(
  ctx: Context,
  preset: BorderPreset,
  lineSetting: BorderLineSetting = line
) {
  const { color, style } = lineSetting;
  switch (preset) {
    case "border-thick-outside":
      handleBorder(ctx, "border-outside", color, "13");
      break;
    case "border-bottom-double":
      handleBorder(ctx, "border-bottom", color, "7");
      break;
    case "border-bottom-thick":
      handleBorder(ctx, "border-bottom", color, "13");
      break;
    case "border-top-bottom":
      handleBorder(ctx, "border-top", color, style);
      handleBorder(ctx, "border-bottom", color, style);
      break;
    case "border-top-bottom-thick":
      handleBorder(ctx, "border-top", color, style);
      handleBorder(ctx, "border-bottom", color, "13");
      break;
    case "border-top-bottom-double":
      handleBorder(ctx, "border-top", color, style);
      handleBorder(ctx, "border-bottom", color, "7");
      break;
    default:
      handleBorder(ctx, preset, color, style);
  }
}

type Edge = "t" | "b" | "l" | "r" | "h" | "v";
const GLYPH: Record<
  BorderPreset,
  { edges: Edge[]; thick?: Edge[]; double?: Edge[] }
> = {
  "border-bottom": { edges: ["b"] },
  "border-top": { edges: ["t"] },
  "border-left": { edges: ["l"] },
  "border-right": { edges: ["r"] },
  "border-none": { edges: [] },
  "border-all": { edges: ["t", "b", "l", "r", "h", "v"] },
  "border-outside": { edges: ["t", "b", "l", "r"] },
  "border-thick-outside": {
    edges: [],
    thick: ["t", "b", "l", "r"],
  },
  "border-bottom-double": { edges: [], double: ["b"] },
  "border-bottom-thick": { edges: [], thick: ["b"] },
  "border-top-bottom": { edges: ["t", "b"] },
  "border-top-bottom-thick": { edges: ["t"], thick: ["b"] },
  "border-top-bottom-double": { edges: ["t"], double: ["b"] },
  "border-inside": { edges: ["h", "v"] },
  "border-horizontal": { edges: ["h"] },
  "border-vertical": { edges: ["v"] },
};

const SEG: Record<Edge, [number, number, number, number]> = {
  t: [2, 2.5, 14, 2.5],
  b: [2, 13.5, 14, 13.5],
  l: [2.5, 2, 2.5, 14],
  r: [13.5, 2, 13.5, 14],
  h: [2, 8, 14, 8],
  v: [8, 2, 8, 14],
};

/** 2px edges, kept on whole pixels. */
const THICK_SEG: Record<Edge, [number, number, number, number]> = {
  t: [1, 3, 15, 3],
  b: [1, 13, 15, 13],
  l: [3, 1, 3, 15],
  r: [13, 1, 13, 15],
  h: [2, 8, 14, 8],
  v: [8, 2, 8, 14],
};

/**
 * 16px glyph of a border preset, Excel style: the cell grid dotted, the
 * preset's edges solid (thick / double where it draws those). Pixel-aligned
 * so it stays crisp at any device pixel ratio.
 */
export const BorderGlyph: React.FC<{ preset: BorderPreset; size?: number }> = ({
  preset,
  size = 16,
}) => {
  const g = GLYPH[preset];
  const all: Edge[] = ["t", "b", "l", "r", "h", "v"];
  const solid = new Set([...g.edges, ...(g.thick ?? []), ...(g.double ?? [])]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      className="ts-border-glyph"
      shapeRendering="crispEdges"
    >
      {all
        .filter((e) => !solid.has(e))
        .map((e) => {
          const [x1, y1, x2, y2] = SEG[e];
          return (
            <line
              key={`d${e}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={1}
              strokeDasharray="1 1"
              opacity={0.4}
            />
          );
        })}
      {g.edges.map((e) => {
        const [x1, y1, x2, y2] = SEG[e];
        return (
          <line key={`s${e}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} />
        );
      })}
      {(g.thick ?? []).map((e) => {
        const [x1, y1, x2, y2] = THICK_SEG[e];
        return (
          <line key={`t${e}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2} />
        );
      })}
      {(g.double ?? []).map((e) => (
        <g key={`w${e}`} strokeWidth={1}>
          <line x1={2} y1={11.5} x2={14} y2={11.5} />
          <line x1={2} y1={13.5} x2={14} y2={13.5} />
        </g>
      ))}
    </svg>
  );
};

/** Preview of a line style (menu rows, the Line Style entry). */
export const BorderLinePreview: React.FC<{
  style: string;
  color?: string;
  width?: number;
}> = ({ style, color = "currentColor", width = 96 }) => {
  const def =
    BORDER_LINE_STYLES.find((s) => s.style === style) ?? BORDER_LINE_STYLES[0];
  return (
    <svg
      width={width}
      height={8}
      viewBox={`0 0 ${width} 8`}
      aria-hidden="true"
      focusable="false"
      className="ts-border-line-preview"
      shapeRendering="crispEdges"
    >
      {def.double ? (
        <g stroke={color} strokeWidth={1}>
          <line x1={0} y1={2.5} x2={width} y2={2.5} />
          <line x1={0} y1={5.5} x2={width} y2={5.5} />
        </g>
      ) : (
        <line
          x1={0}
          y1={4}
          x2={width}
          y2={4}
          stroke={color}
          strokeWidth={def.width}
          strokeDasharray={def.dash}
        />
      )}
    </svg>
  );
};

export type BorderPickerProps = {
  /**
   * Called with the picked preset and the current line setting. Without
   * it the picker applies the preset to the workbook's selection itself.
   */
  onApply?: (preset: BorderPreset, line: BorderLineSetting) => void;
  /** More Borders… (default: Format Cells › Border). */
  onMoreBorders?: () => void;
  /** Called after a preset or More Borders… was picked (close a popover). */
  onClose?: () => void;
  labels?: Partial<BorderPickerLabels>;
  /** Also list Inside / Inside Horizontal / Inside Vertical (default false, as Excel). */
  insideBorders?: boolean;
  autoFocus?: boolean;
};

/**
 * Excel's Borders drop-down: Bottom / Top / Left / Right, No / All /
 * Outside / Thick Outside, the double and thick bottom presets, then Draw
 * Borders: Line Color ▸ (colour picker) and Line Style ▸ (13 styles), and
 * More Borders…. The line colour / style are shared by every border
 * picker and kept between openings.
 *
 *   <Popover …><BorderPicker onClose={close} /></Popover>
 *   <SplitButton … popover={(close) => <BorderPicker onClose={close} />} />
 */
export const BorderPicker: React.FC<BorderPickerProps> = ({
  onApply,
  onMoreBorders,
  onClose,
  labels: labelOverrides,
  insideBorders = false,
  autoFocus,
}) => {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const { setContext, refs } = useContext(WorkbookContext);
  const [current, setLine] = useBorderLine();

  const apply = (preset: BorderPreset) => {
    lastPreset = preset;
    emit();
    if (onApply) onApply(preset, current);
    else {
      setContext((ctx) => applyBorderPreset(ctx, preset, current));
      refs?.cellInput?.current?.focus({ preventScroll: true });
    }
  };
  const preset = (id: BorderPreset): MenuItem => ({
    id,
    label: labels[id],
    leading: <BorderGlyph preset={id} />,
    onSelect: () => apply(id),
  });

  const items: MenuItem[] = [
    { type: "header", id: "h-borders", label: labels.borders },
    preset("border-bottom"),
    preset("border-top"),
    preset("border-left"),
    preset("border-right"),
    { type: "separator", id: "s1" },
    preset("border-none"),
    preset("border-all"),
    preset("border-outside"),
    preset("border-thick-outside"),
    { type: "separator", id: "s2" },
    preset("border-bottom-double"),
    preset("border-bottom-thick"),
    preset("border-top-bottom"),
    preset("border-top-bottom-thick"),
    preset("border-top-bottom-double"),
  ];
  if (insideBorders) {
    items.push(
      { type: "separator", id: "s3" },
      preset("border-inside"),
      preset("border-horizontal"),
      preset("border-vertical")
    );
  }
  items.push(
    { type: "header", id: "h-draw", label: labels.drawBorders },
    {
      id: "line-color",
      label: labels.lineColor,
      leading: (
        <span
          className="ts-border-color-chip"
          style={{ backgroundColor: current.color }}
        />
      ),
      children: [
        {
          type: "custom",
          id: "line-color-picker",
          render: (close) => (
            <ColorPicker
              value={current.color}
              automaticLabel={labels.automatic}
              automaticColor="#000000"
              aria-label={labels.lineColor}
              onChange={(c) => {
                setLine({ color: c ?? "#000000" });
                close();
              }}
            />
          ),
        },
      ],
    },
    {
      id: "line-style",
      label: labels.lineStyle,
      hint: <BorderLinePreview style={current.style} width={40} />,
      icon: PenLine,
      children: BORDER_LINE_STYLES.map((s) => ({
        id: `line-style-${s.style}`,
        label: (
          <>
            <BorderLinePreview style={s.style} />
            <span className="ts-visually-hidden">{s.name}</span>
          </>
        ),
        checked: current.style === s.style,
        radio: true,
        onSelect: () => setLine({ style: s.style }),
      })),
    },
    { type: "separator", id: "s4" },
    {
      id: "more-borders",
      label: labels.moreBorders,
      icon: Grid2x2Plus,
      onSelect: () => {
        if (onMoreBorders) onMoreBorders();
        else setContext((ctx) => openFormatCells(ctx, "border"));
      },
    }
  );

  return (
    <MenuList
      items={items}
      className="ts-border-picker"
      aria-label={labels.borders}
      autoFocus={autoFocus}
      onClose={() => onClose?.()}
    />
  );
};

export default BorderPicker;
