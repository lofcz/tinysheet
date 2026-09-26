/**
 * Shared pieces of the Insert, Page Layout and View commands: the `Cmd`
 * button (large or small per the ribbon's scaling, with an optional menu
 * or panel), the strings, and a few glyphs lucide does not have (drawn
 * with `createLucideIcon`, so they share its grid and stroke).
 */
import React, { useContext } from "react";
import {
  Check,
  createLucideIcon,
  BookOpen,
  FileCog,
  Scaling,
  Type,
  ZoomIn,
} from "lucide-react";
import { ribbonTabsLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import {
  IconButton,
  registerIcon,
  LargeButton,
  MenuButton,
  MenuItem,
  SplitButton,
} from "../../ui";
import type { LucideIcon } from "../../ui";
import type { RibbonItemSize } from "../types";
import "./tabs.css";

/** Strings of the Insert, Page Layout and View commands. */
export function useTabsText() {
  const { context } = useContext(WorkbookContext);
  return ribbonTabsLocale(context);
}

/** "{n} pages" → "3 pages". */
export function fill(text: string, values: Record<string, unknown>) {
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in values ? String(values[k]) : m
  );
}

type IconSource = string | LucideIcon;

export type CmdProps = {
  size: RibbonItemSize;
  icon: IconSource;
  /** Name: the large button's caption, the tooltip title, aria-label. */
  label: string;
  /** Visible text of the small form (default: icon only). */
  text?: string;
  shortcut?: string;
  /** Screen tip help line. */
  description?: React.ReactNode;
  /** The action; with a menu / panel too the button is split. */
  onClick?: () => void;
  menu?: MenuItem[];
  popover?: (close: () => void) => React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * A ribbon command button: Excel's large button (icon over caption) or,
 * when the layout or scaling asks for the small form, a 32px icon button.
 * With a menu (or a panel) and an action it is a split button, with only a
 * menu the whole button opens it.
 */
export const Cmd: React.FC<CmdProps> = ({
  size,
  icon,
  label,
  text,
  shortcut,
  description,
  onClick,
  menu,
  popover,
  pressed,
  disabled,
  className,
}) => {
  let dropdown:
    | { menu: MenuItem[] }
    | { popover: (close: () => void) => React.ReactNode }
    | null = null;
  if (menu) dropdown = { menu };
  else if (popover) dropdown = { popover };
  if (size === "large") {
    return (
      <LargeButton
        icon={icon}
        label={label}
        shortcut={shortcut}
        description={description}
        onClick={onClick}
        pressed={pressed}
        disabled={disabled}
        className={className}
        {...(dropdown ?? {})}
      />
    );
  }
  if (dropdown && onClick) {
    return (
      <SplitButton
        icon={icon}
        label={label}
        shortcut={shortcut}
        description={description}
        onClick={onClick}
        pressed={pressed}
        disabled={disabled}
        text={text}
        className={className}
        {...dropdown}
      />
    );
  }
  if (dropdown) {
    return (
      <MenuButton
        icon={icon}
        label={label}
        shortcut={shortcut}
        description={description}
        disabled={disabled}
        text={text}
        className={className}
        // MenuButtonProps' `popover` clashes with the HTML attribute's type
        {...(dropdown as { menu: MenuItem[] })}
      />
    );
  }
  return (
    <IconButton
      icon={icon}
      label={label}
      shortcut={shortcut}
      description={description}
      pressed={pressed}
      disabled={disabled}
      text={text}
      className={className}
      onClick={onClick}
    />
  );
};

/** Menu entry label with a help line under it (Freeze Panes, Margins). */
export const RichLabel: React.FC<{
  title: React.ReactNode;
  detail?: React.ReactNode;
}> = ({ title, detail }) => (
  <span className="ts-tabs-rich">
    <span className="ts-tabs-rich-title">{title}</span>
    {detail != null && <span className="ts-tabs-rich-detail">{detail}</span>}
  </span>
);

/**
 * The check of a chosen menu entry that shows an icon (the icon column
 * then has no room for it): right-aligned.
 */
export const checkHint = (on: boolean) =>
  on ? (
    <Check
      className="ts-tabs-check"
      size={16}
      strokeWidth={2}
      aria-hidden="true"
    />
  ) : undefined;

// ---------------------------------------------------------------------------
// Glyphs (24px grid, drawn with the lucide stroke).

/** Recommended Charts: columns on axes with a sparkle. */
export const RecommendedChartIcon = createLucideIcon({
  name: "ts-recommended-chart",
  size: 24,
  node: [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "axis" }],
    ["path", { d: "M8 17v-4", key: "b1" }],
    ["path", { d: "M12 17v-7", key: "b2" }],
    ["path", { d: "M16 17v-3", key: "b3" }],
    [
      "path",
      {
        d: "M18 2.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z",
        key: "spark",
      },
    ],
  ],
});

/** Win/Loss sparkline: bars above and below an axis. */
export const WinLossIcon = createLucideIcon({
  name: "ts-win-loss",
  size: 24,
  node: [
    ["path", { d: "M2 12h20", key: "axis" }],
    ["rect", { x: "4", y: "5", width: "3", height: "7", rx: "1", key: "w1" }],
    [
      "rect",
      { x: "10.5", y: "12", width: "3", height: "6", rx: "1", key: "l" },
    ],
    ["rect", { x: "17", y: "7", width: "3", height: "5", rx: "1", key: "w2" }],
  ],
});

/** Margins: a page with its printable area dashed. */
export const MarginsIcon = createLucideIcon({
  name: "ts-margins",
  size: 24,
  node: [
    ["rect", { x: "4", y: "2", width: "16", height: "20", rx: "2", key: "p" }],
    [
      "rect",
      {
        x: "8",
        y: "6",
        width: "8",
        height: "12",
        strokeDasharray: "2 2",
        key: "m",
      },
    ],
  ],
});

/** Page Break Preview: a page divided by a dashed break. */
export const PageBreakIcon = createLucideIcon({
  name: "ts-page-break-preview",
  size: 24,
  node: [
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "p" }],
    ["path", { d: "M12 3v18", strokeDasharray: "2.5 2", key: "v" }],
    ["path", { d: "M3 12h9", key: "h" }],
  ],
});

/** Zoom 100%: a magnifier with 1:1 in the lens. */
export const Zoom100Icon = createLucideIcon({
  name: "ts-zoom-100",
  size: 24,
  node: [
    ["circle", { cx: "11", cy: "11", r: "8", key: "lens" }],
    ["path", { d: "m21 21-4.3-4.3", key: "handle" }],
    ["path", { d: "M7.5 9 8.5 8v6", key: "one" }],
    ["path", { d: "M13.5 9l1-1v6", key: "two" }],
    ["path", { d: "M11 9.5h.01", key: "d1" }],
    ["path", { d: "M11 12.5h.01", key: "d2" }],
  ],
});

/** Print Area: a sheet grid with the printed block marked. */
export const PrintAreaIcon = createLucideIcon({
  name: "ts-print-area",
  size: 24,
  node: [
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "p" }],
    ["path", { d: "M3 9h18", key: "r" }],
    ["path", { d: "M9 3v18", key: "c" }],
    [
      "rect",
      {
        x: "9",
        y: "9",
        width: "8",
        height: "8",
        strokeDasharray: "2 2",
        key: "a",
      },
    ],
  ],
});

/** Icons of the collapsed Insert / Page Layout / View groups. */
export function registerTabGroupIcons() {
  registerIcon("ts-text", Type);
  registerIcon("ts-page-setup", FileCog);
  registerIcon("ts-scale-to-fit", Scaling);
  registerIcon("ts-workbook-views", BookOpen);
  registerIcon("ts-zoom", ZoomIn);
}
