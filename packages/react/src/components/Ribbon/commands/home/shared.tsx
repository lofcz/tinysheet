/**
 * What the Home commands share: the active cell, a `run` that applies a
 * change and gives the keyboard back to the grid, the strings, and small
 * building blocks (a select-like field with any menu, a colour bar under a
 * glyph).
 */
import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Cell,
  Context,
  defaultSettings,
  getFlowdata,
} from "@lofcz/tinysheet-core";
import type { SetContextOptions } from "../../../../context";
import { useDialog } from "../../../../hooks/useDialog";
import {
  DropdownMenu,
  Icon,
  ICON_STROKE,
  LucideIcon,
  MenuItem,
  Tooltip,
} from "../../../ui";
import { RibbonCommandHelpers, useRibbonCommandHelpers } from "../helpers";
import { homeText, HomeText } from "./strings";
import "./home.css";

export type ActiveCell = {
  r: number;
  c: number;
  cell: Cell | null | undefined;
};

/** The active cell (Excel's: the focus of the last selected range). */
export function activeCellOf(ctx: Context): ActiveCell | null {
  const sel = ctx.luckysheet_select_save;
  const last = sel?.[sel.length - 1];
  if (!last) return null;
  const r = last.row_focus ?? last.row[0];
  const c = last.column_focus ?? last.column[0];
  if (r == null || c == null) return null;
  return { r, c, cell: getFlowdata(ctx)?.[r]?.[c] };
}

export type Home = {
  h: RibbonCommandHelpers;
  t: HomeText;
  context: Context;
  active: ActiveCell | null;
  cell: Cell | null | undefined;
  /** The sheet can be edited at all (settings.allowEdit). */
  editable: boolean;
  /** Apply `recipe` (one undo step) and give the keyboard to the grid. */
  run: (recipe: (ctx: Context) => void, options?: SetContextOptions) => void;
  /** The cell editor element the core formatting functions take. */
  input: () => HTMLDivElement;
  /** The grid's 2D context (row heights follow font size changes). */
  canvas: () => CanvasRenderingContext2D | undefined;
  /** A message with an OK button ("No cells were found."). */
  alert: (message: React.ReactNode) => void;
};

export function useHome(): Home {
  const h = useRibbonCommandHelpers();
  const { context } = h;
  const active = activeCellOf(context);
  const { showDialog } = useDialog();
  return {
    h,
    t: homeText(context),
    context,
    active,
    cell: active?.cell,
    editable: context.allowEdit !== false,
    run: (recipe, options) => {
      h.setContext(recipe, options);
      h.focusSheet();
    },
    input: () => h.refs.cellInput.current as HTMLDivElement,
    canvas: () => h.refs.canvas.current?.getContext("2d") ?? undefined,
    alert: (message) => showDialog(message, "ok"),
  };
}

/** "More options for Borders". */
export const moreLabel = (t: HomeText, name: string) =>
  t.more.replace("{name}", name);

/**
 * The workbook's currency symbol: `settings.currency` when the host set
 * one, else the language's ($ for English).
 */
export function currencySymbolFor(ctx: Context, settingsCurrency?: string) {
  if (settingsCurrency && settingsCurrency !== defaultSettings.currency) {
    return settingsCurrency;
  }
  const lang = (ctx.lang || "en").toLowerCase();
  if (lang === "zh-tw") return "NT$";
  const base = lang.split("-")[0];
  const byLang: Record<string, string> = {
    en: "$",
    zh: "¥",
    ja: "¥",
    es: "€",
    fr: "€",
    de: "€",
    it: "€",
    ru: "₽",
    hi: "₹",
  };
  return byLang[base] ?? "$";
}

/** A glyph with a colour bar under it (Fill Color, Font Color). */
export const ColorGlyph: React.FC<{ icon: LucideIcon; color: string }> = ({
  icon,
  color,
}) => (
  <span className="ts-home-color-glyph">
    <Icon icon={icon} />
    <span
      className="ts-home-color-bar"
      data-color={color}
      style={{ background: color }}
    />
  </span>
);

/**
 * A select-like field (Number Format) that opens any menu: icons, hints,
 * headers and a footer entry, which the plain Select does not take.
 */
export const FieldMenu: React.FC<{
  label: string;
  value: string;
  items: MenuItem[];
  width: number;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
}> = ({ label, value, items, width, disabled, className, menuClassName }) => {
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Tooltip label={label} disabled={open}>
        <button
          ref={anchorRef}
          type="button"
          className={`ts-select ts-home-field${open ? " ts-open" : ""}${
            className ? ` ${className}` : ""
          }`}
          style={{ width }}
          aria-label={`${label}: ${value}`}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={(e) => {
            setByKeyboard(e.detail === 0);
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
              e.preventDefault();
              setByKeyboard(true);
              setOpen(true);
            }
          }}
        >
          <span className="ts-select-value">{value}</span>
          <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </Tooltip>
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        items={items}
        autoFocus={byKeyboard}
        minWidth={Math.max(width, 220)}
        aria-label={label}
        className={menuClassName}
      />
    </>
  );
};
