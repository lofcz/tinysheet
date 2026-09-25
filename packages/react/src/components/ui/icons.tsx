/**
 * Icons of the workbook chrome: lucide-react, 16px, stroke 1.75
 * (docs/DESIGN.md). One map from a command / legacy icon name to a lucide
 * icon, so every surface (ribbon, menus, dialogs, the legacy `SVGIcon`
 * sprite names) draws the same glyph for the same command.
 *
 *   <Icon name="bold" />                 // by name (falls back to nothing)
 *   <Icon icon={Sigma} size={20} />      // a lucide component directly
 *   registerIcon("my-command", Rocket);  // features add their own names
 *
 * `SVGIcon` (the old sprite) renders the lucide icon for every name mapped
 * here, so legacy toolbar items and menus pick the new icons up without
 * changes. Names without a good lucide equivalent (borders, text rotation,
 * the currency symbol, ...) keep their sprite glyph until a follow-up
 * replaces them.
 */
import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowDownZA,
  ArrowUpDown,
  ArrowUpToLine,
  Baseline,
  Bold,
  Calculator,
  Camera,
  ChartSpline,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Columns2,
  Copy,
  Crosshair,
  DecimalsArrowLeft,
  DecimalsArrowRight,
  Ellipsis,
  Eraser,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FolderOpen,
  FoldVertical,
  Funnel,
  Grid2x2,
  Group,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Minus,
  Monitor,
  Moon,
  PaintBucket,
  Paintbrush,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Pencil,
  Percent,
  Plus,
  Printer,
  Redo2,
  RemoveFormatting,
  Rows2,
  Save,
  Scissors,
  Search,
  Sigma,
  Snowflake,
  Square,
  SquareCheck,
  SquareDashed,
  StickyNote,
  Strikethrough,
  Sun,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  TableColumnsSplit,
  Tag,
  Underline,
  Undo2,
  Unlink,
  WrapText,
  X,
} from "lucide-react";
import "./ui.css";

export type { LucideIcon };

/** Default glyph size (px) and stroke of chrome icons. */
export const ICON_SIZE = 16;
export const ICON_LARGE_SIZE = 20;
export const ICON_STROKE = 1.75;

const icons = new Map<string, LucideIcon>(
  Object.entries({
    // clipboard / history
    undo: Undo2,
    redo: Redo2,
    paste: ClipboardPaste,
    cut: Scissors,
    copy: Copy,
    "format-painter": Paintbrush,
    // font
    bold: Bold,
    italic: Italic,
    underline: Underline,
    "strike-through": Strikethrough,
    "font-color": Baseline,
    background: PaintBucket,
    // borders (the diagonal / inside variants keep their sprite)
    "border-all": Grid2x2,
    "border-outside": Square,
    "border-none": SquareDashed,
    "border-top": PanelTop,
    "border-bottom": PanelBottom,
    "border-left": PanelLeft,
    "border-right": PanelRight,
    "border-horizontal": Rows2,
    "border-vertical": Columns2,
    // alignment
    "align-top": ArrowUpToLine,
    "align-middle": FoldVertical,
    "align-bottom": ArrowDownToLine,
    "align-left": AlignLeft,
    "align-center": AlignCenter,
    "align-right": AlignRight,
    "align-justify": AlignJustify,
    "text-wrap": WrapText,
    "merge-all": TableCellsMerge,
    "merge-cancel": TableCellsSplit,
    // number
    "percentage-format": Percent,
    "number-increase": DecimalsArrowRight,
    "number-decrease": DecimalsArrowLeft,
    // styles / editing
    conditionFormat: Highlighter,
    "clear-format": RemoveFormatting,
    eraser: Eraser,
    "formula-sum": Sigma,
    sort: ArrowUpDown,
    "sort-asc": ArrowDownAZ,
    "sort-desc": ArrowDownZA,
    filter: Funnel,
    filter1: Funnel,
    search: Search,
    locationCondition: Crosshair,
    // insert / data
    image: Image,
    link: Link,
    unlink: Unlink,
    comment: MessageSquare,
    "new-comment": MessageSquarePlus,
    chart: ChartColumn,
    table: Table2,
    sparkline: ChartSpline,
    checkbox: SquareCheck,
    tag: Tag,
    calculator: Calculator,
    group: Group,
    "sticky-note": StickyNote,
    lock: Lock,
    eye: Eye,
    splitColumn: TableColumnsSplit,
    dataVerification: ListChecks,
    screenshot: Camera,
    // view
    "freeze-row-col": Snowflake,
    hidden: EyeOff,
    "all-sheets": List,
    "side-pane": PanelRight,
    "fortune-theme-light": Sun,
    "fortune-theme-dark": Moon,
    "fortune-theme-auto": Monitor,
    // file
    "file-new": FileSpreadsheet,
    "file-open": FolderOpen,
    "file-save": Save,
    print: Printer,
    // generic
    add: Plus,
    plus: Plus,
    minus: Minus,
    close: X,
    check: Check,
    more: Ellipsis,
    pencil: Pencil,
    "combo-arrow": ChevronDown,
    downArrow: ChevronDown,
    rightArrow: ChevronRight,
    "chevron-up": ChevronUp,
  })
);

/**
 * Map a command or icon name to a lucide icon (features call this for their
 * own commands). Returns a function that restores the previous mapping.
 */
export function registerIcon(name: string, icon: LucideIcon) {
  const prev = icons.get(name);
  icons.set(name, icon);
  return () => {
    if (icons.get(name) !== icon) return;
    if (prev) icons.set(name, prev);
    else icons.delete(name);
  };
}

/** The lucide icon registered for `name`, if any. */
export function getIcon(name: string | undefined): LucideIcon | undefined {
  return name ? icons.get(name) : undefined;
}

type IconProps = {
  /** A registered name (see `registerIcon`). */
  name?: string;
  /** Or a lucide component (wins over `name`). */
  icon?: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * A chrome icon: decorative (`aria-hidden`), `currentColor`, 16px / 1.75
 * stroke by default. Renders nothing for an unknown name.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  icon,
  size = ICON_SIZE,
  strokeWidth = ICON_STROKE,
  className,
  style,
}) => {
  const Glyph = icon ?? getIcon(name);
  if (!Glyph) return null;
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className ? `ts-icon ${className}` : "ts-icon"}
      style={style}
      aria-hidden="true"
      focusable="false"
    />
  );
};

export default Icon;
