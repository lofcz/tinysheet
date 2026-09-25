/**
 * Home › Font: font and size boxes, Increase / Decrease Font Size, Bold,
 * Italic, Underline (single / double), Strikethrough, Borders, Fill Color
 * and Font Color. Every control shows the active cell's formatting.
 */
import React, { useState } from "react";
import {
  AArrowDown,
  AArrowUp,
  Baseline,
  Bold,
  Italic,
  PaintBucket,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  applyFormatCells,
  getFlowdata,
  handleBold,
  handleBorder,
  handleItalic,
  handleStrikeThrough,
  handleTextBackground,
  handleTextColor,
  handleTextSize,
  handleUnderline,
  locale,
  normalizedCellAttr,
  openFormatCells,
  updateFormat,
} from "@lofcz/tinysheet-core";
import {
  Combo,
  IconButton,
  LucideIcon,
  MenuItem,
  SplitButton,
  SelectOption,
} from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { shortcutText } from "../helpers";
import { ColorPanel } from "./ColorPanel";
import {
  BorderAll,
  BorderBottom,
  BorderBottomDouble,
  BorderBottomThick,
  BorderDiagonal,
  BorderInside,
  BorderLeft,
  BorderNone,
  BorderOutside,
  BorderRight,
  BorderThickBox,
  BorderTop,
  BorderTopBottom,
  BorderTopDoubleBottom,
  BorderTopThickBottom,
  DoubleUnderline,
  LineSample,
} from "./glyphs";
import { ColorGlyph, Home, moreLabel, useHome } from "./shared";
import type { HomeText } from "./strings";

/** Excel's font size list. */
export const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

/** Fonts offered besides the locale's list (all widely installed). */
const COMMON_FONTS = [
  "Arial",
  "Calibri",
  "Cambria",
  "Candara",
  "Consolas",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];

/** The font name the grid draws the active cell in. */
export function effectiveFont(home: Home) {
  const { fontarray } = locale(home.context);
  const ff = home.cell?.ff;
  if (ff == null || ff === "") return fontarray[0];
  return /^\d+$/.test(String(ff))
    ? (fontarray[Number(ff)] ?? fontarray[0])
    : String(ff);
}

export function effectiveFontSize(home: Home) {
  const { cell, context } = home;
  return Number(
    cell
      ? normalizedCellAttr(cell, "fs", context.defaultFontSize)
      : context.defaultFontSize
  );
}

/** The next size of Excel's list up (or down) from `size`. */
export function stepFontSize(size: number, dir: 1 | -1) {
  if (dir > 0) {
    const next = FONT_SIZES.find((s) => s > size);
    return next ?? Math.min(409, Math.floor(size / 10) * 10 + 10);
  }
  const prev = [...FONT_SIZES].reverse().find((s) => s < size);
  if (prev != null) return prev;
  return Math.max(1, Math.ceil(size) - 1);
}

function applySize(home: Home, size: number) {
  home.run((ctx) =>
    handleTextSize(ctx, home.input(), size, home.canvas() as any)
  );
}

export const FontFamilyCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { fontarray } = locale(home.context);
  const current = effectiveFont(home);
  const names = Array.from(
    new Set([...fontarray, ...COMMON_FONTS, current])
  ).sort((a, b) => a.localeCompare(b));
  const options: SelectOption[] = names.map((name) => ({
    value: name,
    label: name,
    // each name in its own typeface, as in Excel
    style: { fontFamily: `"${name}"` },
  }));
  return (
    <Combo
      className="ts-home-font"
      aria-label={home.t.font}
      tooltip
      width={128}
      value={current}
      options={options}
      disabled={!home.editable}
      onCommit={(value) => {
        const name = value.trim();
        if (!name) return;
        home.run((ctx) => {
          const d = getFlowdata(ctx);
          if (d) updateFormat(ctx, home.input(), d, "ff", name);
        });
      }}
      onDone={() => home.h.focusSheet()}
    />
  );
};

export const FontSizeCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const size = effectiveFontSize(home);
  const options: SelectOption[] = FONT_SIZES.map((s) => ({
    value: String(s),
    label: String(s),
  }));
  return (
    <Combo
      className="ts-home-size"
      aria-label={home.t.fontSize}
      tooltip
      width={58}
      value={String(size)}
      options={options}
      disabled={!home.editable}
      onCommit={(typed) => {
        // Excel takes 1 to 409 points, in halves
        const num = Math.round(Number(typed.trim()) * 2) / 2;
        if (Number.isFinite(num) && num >= 1 && num <= 409) {
          applySize(home, num);
        }
      }}
      onDone={() => home.h.focusSheet()}
    />
  );
};

export const GrowFontCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  return (
    <IconButton
      icon={AArrowUp}
      label={home.t.growFont}
      shortcut={shortcutText(home.t.growFontShortcut)}
      disabled={!home.editable}
      onClick={() => applySize(home, stepFontSize(effectiveFontSize(home), 1))}
    />
  );
};

export const ShrinkFontCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  return (
    <IconButton
      icon={AArrowDown}
      label={home.t.shrinkFont}
      shortcut={shortcutText(home.t.shrinkFontShortcut)}
      disabled={!home.editable}
      onClick={() => applySize(home, stepFontSize(effectiveFontSize(home), -1))}
    />
  );
};

const on = (v: unknown) => v != null && `${v}` !== "0" && `${v}` !== "";

/** A toggle for one font attribute (Bold, Italic, Strikethrough). */
function toggleCommand(
  attr: "bl" | "it" | "cl",
  icon: LucideIcon,
  label: (t: HomeText) => string,
  shortcut: (t: HomeText) => string,
  handler: (ctx: any, input: HTMLDivElement) => void
): React.FC<RibbonCommandProps> {
  const Command: React.FC<RibbonCommandProps> = () => {
    const home = useHome();
    return (
      <IconButton
        icon={icon}
        label={label(home.t)}
        shortcut={shortcutText(shortcut(home.t))}
        pressed={on(home.cell?.[attr])}
        disabled={!home.editable}
        onClick={() => home.run((ctx) => handler(ctx, home.input()))}
      />
    );
  };
  return Command;
}

export const BoldCommand = toggleCommand(
  "bl",
  Bold,
  (t) => t.bold,
  (t) => t.boldShortcut,
  handleBold
);
export const ItalicCommand = toggleCommand(
  "it",
  Italic,
  (t) => t.italic,
  (t) => t.italicShortcut,
  handleItalic
);
export const StrikethroughCommand = toggleCommand(
  "cl",
  Strikethrough,
  (t) => t.strikethrough,
  (t) => t.strikethroughShortcut,
  handleStrikeThrough
);

export const UnderlineCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const un = Number(home.cell?.un ?? 0) || 0;
  const setUnderline = (value: 1 | 2) =>
    home.run((ctx) => {
      // choosing the style that is on turns underlining off, like Excel
      if (value === 1) handleUnderline(ctx, home.input());
      else applyFormatCells(ctx, { un: un === 2 ? 0 : 2 });
    });
  const menu: MenuItem[] = [
    {
      id: "underline",
      label: t.underline,
      icon: Underline,
      shortcut: shortcutText(t.underlineShortcut),
      checked: un === 1,
      onSelect: () => setUnderline(1),
    },
    {
      id: "double-underline",
      label: t.doubleUnderline,
      icon: DoubleUnderline,
      checked: un === 2,
      onSelect: () => setUnderline(2),
    },
  ];
  return (
    <SplitButton
      icon={un === 2 ? DoubleUnderline : Underline}
      label={t.underline}
      shortcut={shortcutText(t.underlineShortcut)}
      arrowLabel={moreLabel(t, t.underline)}
      pressed={un > 0}
      disabled={!home.editable}
      onClick={() => setUnderline(un === 2 ? 2 : 1)}
      menu={menu}
    />
  );
};

/* ---------------- Borders ---------------- */

type BorderKind =
  | "bottom"
  | "top"
  | "left"
  | "right"
  | "none"
  | "all"
  | "outside"
  | "thickBox"
  | "inside"
  | "bottomDouble"
  | "bottomThick"
  | "topBottom"
  | "topThickBottom"
  | "topDoubleBottom"
  | "diagonal";

const THIN = "1";
const THICK = "13";
const DOUBLE = "7";

/** The core border calls of each entry: [type, style or null (current)]. */
const BORDER_STEPS: Record<BorderKind, [string, string | null][]> = {
  bottom: [["border-bottom", null]],
  top: [["border-top", null]],
  left: [["border-left", null]],
  right: [["border-right", null]],
  none: [["border-none", null]],
  all: [["border-all", null]],
  outside: [["border-outside", null]],
  thickBox: [["border-outside", THICK]],
  inside: [["border-inside", null]],
  bottomDouble: [["border-bottom", DOUBLE]],
  bottomThick: [["border-bottom", THICK]],
  topBottom: [
    ["border-top", null],
    ["border-bottom", null],
  ],
  topThickBottom: [
    ["border-top", THIN],
    ["border-bottom", THICK],
  ],
  topDoubleBottom: [
    ["border-top", THIN],
    ["border-bottom", DOUBLE],
  ],
  diagonal: [["border-slash", null]],
};

const BORDER_ICONS: Record<BorderKind, LucideIcon> = {
  bottom: BorderBottom,
  top: BorderTop,
  left: BorderLeft,
  right: BorderRight,
  none: BorderNone,
  all: BorderAll,
  outside: BorderOutside,
  thickBox: BorderThickBox,
  inside: BorderInside,
  bottomDouble: BorderBottomDouble,
  bottomThick: BorderBottomThick,
  topBottom: BorderTopBottom,
  topThickBottom: BorderTopThickBottom,
  topDoubleBottom: BorderTopDoubleBottom,
  diagonal: BorderDiagonal,
};

const borderLabel = (t: HomeText, kind: BorderKind) =>
  ({
    bottom: t.borderBottom,
    top: t.borderTop,
    left: t.borderLeft,
    right: t.borderRight,
    none: t.borderNone,
    all: t.borderAll,
    outside: t.borderOutside,
    thickBox: t.borderThickBox,
    inside: t.borderInside,
    bottomDouble: t.borderBottomDouble,
    bottomThick: t.borderBottomThick,
    topBottom: t.borderTopBottom,
    topThickBottom: t.borderTopThickBottom,
    topDoubleBottom: t.borderTopDoubleBottom,
    diagonal: t.borderDiagonal,
  })[kind];

/** Excel's Line Style list: [core style code, dash, thickness, double]. */
const LINE_STYLES: [string, string | undefined, number, boolean][] = [
  ["1", undefined, 1, false],
  ["2", "1 2", 1, false],
  ["3", "1 3", 1.5, false],
  ["4", "4 3", 1.5, false],
  ["5", "8 3 2 3", 1.5, false],
  ["8", undefined, 2, false],
  ["9", "5 3", 2, false],
  ["13", undefined, 3, false],
  ["7", undefined, 1, true],
];

// the last used border and the pen, for the whole session (like Excel)
const pen = {
  last: "bottom" as BorderKind,
  color: "#000000",
  style: THIN,
};

export const BordersCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const [, rerender] = useState(0);
  const apply = (kind: BorderKind) => {
    pen.last = kind;
    rerender((n) => n + 1);
    home.run((ctx) => {
      BORDER_STEPS[kind].forEach(([type, style]) =>
        handleBorder(ctx, type, pen.color, style ?? pen.style)
      );
    });
  };
  const entry = (kind: BorderKind): MenuItem => ({
    id: `border-${kind}`,
    label: borderLabel(t, kind),
    icon: BORDER_ICONS[kind],
    onSelect: () => apply(kind),
  });
  const menu: MenuItem[] = [
    { type: "header", label: t.bordersHeader },
    entry("bottom"),
    entry("top"),
    entry("left"),
    entry("right"),
    { type: "separator" },
    entry("none"),
    entry("all"),
    entry("outside"),
    entry("thickBox"),
    entry("inside"),
    { type: "separator" },
    entry("bottomDouble"),
    entry("bottomThick"),
    entry("topBottom"),
    entry("topThickBottom"),
    entry("topDoubleBottom"),
    entry("diagonal"),
    { type: "header", label: t.drawBordersHeader },
    {
      id: "line-color",
      label: t.lineColor,
      leading: (
        <span
          className="ts-home-swatch-static"
          style={{ background: pen.color }}
        />
      ),
      children: [
        {
          type: "custom",
          id: "line-color-panel",
          render: (close) => (
            <ColorPanel
              t={t}
              value={pen.color}
              reset={{ label: t.automatic, kind: "automatic" }}
              onPick={(color) => {
                pen.color = color ?? "#000000";
                rerender((n) => n + 1);
              }}
              close={close}
            />
          ),
        },
      ],
    },
    {
      id: "line-style",
      label: t.lineStyle,
      children: LINE_STYLES.map(([code, dash, thickness, double]) => ({
        id: `line-style-${code}`,
        label: <LineSample dash={dash} thickness={thickness} double={double} />,
        checked: pen.style === code,
        radio: true,
        onSelect: () => {
          pen.style = code;
          rerender((n) => n + 1);
        },
      })),
    },
    { type: "separator" },
    {
      id: "more-borders",
      label: t.moreBorders,
      onSelect: () =>
        home.run((ctx) => openFormatCells(ctx, "border"), { noHistory: true }),
    },
  ];
  return (
    <SplitButton
      icon={BORDER_ICONS[pen.last]}
      label={`${t.borders}: ${borderLabel(t, pen.last)}`}
      description={t.bordersDescription}
      arrowLabel={moreLabel(t, t.borders)}
      disabled={!home.editable}
      onClick={() => apply(pen.last)}
      menu={menu}
    />
  );
};

/* ---------------- Fill / font colour ---------------- */

export const FillColorCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, h } = home;
  const cache = h.refs.globalCache;
  const recent = cache.recentBackgroundColor ?? "#FFFF00";
  const apply = (color: string | null) => {
    if (color) cache.recentBackgroundColor = color;
    home.run((ctx) =>
      handleTextBackground(ctx, home.input(), color as unknown as string)
    );
  };
  return (
    <SplitButton
      icon={PaintBucket}
      label={t.fillColor}
      description={t.fillDescription}
      arrowLabel={moreLabel(t, t.fillColor)}
      disabled={!home.editable}
      onClick={() => apply(recent)}
      popover={(close) => (
        <ColorPanel
          t={t}
          value={home.cell?.bg}
          reset={{ label: t.noFill, kind: "none" }}
          onPick={apply}
          close={close}
        />
      )}
    >
      <ColorGlyph icon={PaintBucket} color={recent} />
    </SplitButton>
  );
};

export const FontColorCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, h } = home;
  const cache = h.refs.globalCache;
  const recent = cache.recentTextColor ?? "#FF0000";
  const apply = (color: string | null) => {
    if (color) cache.recentTextColor = color;
    home.run((ctx) =>
      handleTextColor(ctx, home.input(), color as unknown as string)
    );
  };
  return (
    <SplitButton
      icon={Baseline}
      label={t.fontColor}
      description={t.fontColorDescription}
      arrowLabel={moreLabel(t, t.fontColor)}
      disabled={!home.editable}
      onClick={() => apply(recent)}
      popover={(close) => (
        <ColorPanel
          t={t}
          value={home.cell?.fc}
          reset={{ label: t.automatic, kind: "automatic" }}
          onPick={apply}
          close={close}
        />
      )}
    >
      <ColorGlyph icon={Baseline} color={recent} />
    </SplitButton>
  );
};
