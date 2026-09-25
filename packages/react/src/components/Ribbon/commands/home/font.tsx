/**
 * Home › Font: font and size boxes, Increase / Decrease Font Size, Bold,
 * Italic, Underline (single / double), Strikethrough, Borders, Fill Color
 * and Font Color. Every control shows the active cell's formatting.
 */
import React from "react";
import {
  AArrowDown,
  AArrowUp,
  Baseline,
  Bold,
  Grid2x2,
  Italic,
  PaintBucket,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  applyFormatCells,
  cellFontName,
  defaultFontFamily,
  fontDisplayName,
  getFlowdata,
  handleBold,
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
  applyBorderPreset,
  BorderGlyph,
  BorderPicker,
  Combo,
  IconButton,
  LucideIcon,
  MenuItem,
  SplitButton,
  SelectOption,
  useBorderLine,
  useLastBorderPreset,
} from "../../../ui";
import type { BorderPickerLabels } from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { shortcutText } from "../helpers";
import { ColorPanel } from "./ColorPanel";
import { DoubleUnderline } from "./glyphs";
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

/**
 * The font name the grid draws the active cell in: its own font, else the
 * workbook's default font (`settings.defaultFontFamily`, Calibri).
 */
export function effectiveFont(home: Home) {
  return cellFontName(home.context, home.cell);
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
  const defaultName = fontDisplayName(defaultFontFamily(home.context));
  const names = Array.from(
    new Set([...fontarray, ...COMMON_FONTS, defaultName, current])
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

/** The shared Borders drop-down's labels in the workbook's language. */
function borderLabels(t: HomeText): Partial<BorderPickerLabels> {
  return {
    borders: t.bordersHeader,
    "border-bottom": t.borderBottom,
    "border-top": t.borderTop,
    "border-left": t.borderLeft,
    "border-right": t.borderRight,
    "border-none": t.borderNone,
    "border-all": t.borderAll,
    "border-outside": t.borderOutside,
    "border-thick-outside": t.borderThickBox,
    "border-bottom-double": t.borderBottomDouble,
    "border-bottom-thick": t.borderBottomThick,
    "border-top-bottom": t.borderTopBottom,
    "border-top-bottom-thick": t.borderTopThickBottom,
    "border-top-bottom-double": t.borderTopDoubleBottom,
    "border-inside": t.borderInside,
    drawBorders: t.drawBordersHeader,
    lineColor: t.lineColor,
    lineStyle: t.lineStyle,
    automatic: t.automatic,
    moreBorders: t.moreBorders,
  };
}

/**
 * Borders: the shared Excel Borders drop-down (components/ui/BorderPicker);
 * the main part repeats the border picked last with the current line
 * colour and style, like Excel.
 */
export const BordersCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const last = useLastBorderPreset();
  const [line] = useBorderLine();
  const labels = borderLabels(t);
  return (
    <SplitButton
      icon={Grid2x2}
      label={`${t.borders}: ${labels[last] ?? last}`}
      description={t.bordersDescription}
      arrowLabel={moreLabel(t, t.borders)}
      disabled={!home.editable}
      onClick={() => home.run((ctx) => applyBorderPreset(ctx, last, line))}
      popover={(close) => (
        <BorderPicker
          labels={labels}
          autoFocus
          onApply={(preset, lineSetting) =>
            home.run((ctx) => applyBorderPreset(ctx, preset, lineSetting))
          }
          onMoreBorders={() =>
            home.run((ctx) => openFormatCells(ctx, "border"), {
              noHistory: true,
            })
          }
          onClose={close}
        />
      )}
    >
      <BorderGlyph preset={last} />
    </SplitButton>
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
