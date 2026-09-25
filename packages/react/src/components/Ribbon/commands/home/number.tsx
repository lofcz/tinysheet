/**
 * Home › Number: the Number Format box (General … Text, More Number
 * Formats…), Accounting Number Format (split: the currencies), Percent
 * Style, Comma Style, Increase / Decrease Decimal.
 */
import React, { useContext } from "react";
import {
  Banknote,
  Calendar,
  CalendarDays,
  Clock,
  DecimalsArrowLeft,
  DecimalsArrowRight,
  DollarSign,
  Euro,
  Hash,
  IndianRupee,
  JapaneseYen,
  Percent,
  PoundSterling,
  RussianRuble,
  SquareSlash,
  Superscript,
  SwissFranc,
  Type,
  Sigma,
} from "lucide-react";
import {
  buildFormatCode,
  formatValue,
  getFlowdata,
  getFormatCategory,
  handleNumberDecrease,
  handleNumberIncrease,
  handlePercentageFormat,
  locale,
  NumberFormatOptions,
  openFormatCells,
  updateFormat,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import { IconButton, LucideIcon, MenuItem, SplitButton } from "../../../ui";
import type { RibbonCommandProps } from "../../registry";
import { shortcutText } from "../helpers";
import { CommaStyle } from "./glyphs";
import {
  currencySymbolFor,
  FieldMenu,
  Home,
  moreLabel,
  useHome,
} from "./shared";

function applyFormat(home: Home, code: string) {
  home.run((ctx) => {
    const d = getFlowdata(ctx);
    if (d) updateFormat(ctx, home.input(), d, "ct", code);
  });
}

function useCurrency(home: Home) {
  const { settings } = useContext(WorkbookContext);
  return currencySymbolFor(
    home.context,
    home.context.currency || settings.currency
  );
}

const NUMBER_FORMATS: {
  key: string;
  icon: LucideIcon;
  code: (symbol: string) => string;
}[] = [
  { key: "general", icon: Sigma, code: () => "General" },
  { key: "number", icon: Hash, code: () => "0.00" },
  {
    key: "currency",
    icon: Banknote,
    code: (symbol) => buildFormatCode("currency", { decimals: 2, symbol }),
  },
  {
    key: "accounting",
    icon: DollarSign,
    code: (symbol) => buildFormatCode("accounting", { decimals: 2, symbol }),
  },
  { key: "shortDate", icon: Calendar, code: () => "m/d/yyyy" },
  { key: "longDate", icon: CalendarDays, code: () => "dddd, mmmm d, yyyy" },
  { key: "time", icon: Clock, code: () => "h:mm:ss AM/PM" },
  { key: "percentage", icon: Percent, code: () => "0.00%" },
  { key: "fraction", icon: SquareSlash, code: () => "# ?/?" },
  { key: "scientific", icon: Superscript, code: () => "0.00E+00" },
  { key: "text", icon: Type, code: () => "@" },
];

export const NumberFormatCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t, cell } = home;
  const { numberFormatMenu, formatCells } = locale(home.context);
  const menuText = numberFormatMenu as unknown as Record<string, string>;
  const symbol = useCurrency(home);
  const fa = cell?.ct?.fa;
  const category = getFormatCategory(fa);
  let current: string =
    menuText[category] ??
    (formatCells.categories as Record<string, string>)[category] ??
    category;
  if (category === "date") {
    current =
      fa === "dddd, mmmm d, yyyy" ? menuText.longDate : menuText.shortDate;
  } else if (category === "custom") {
    current = menuText.custom;
  }
  const raw = cell?.v;
  const hasValue = raw != null && raw !== "";
  const numeric =
    hasValue && typeof raw !== "boolean" && Number.isFinite(Number(raw));
  const preview = (code: string, key: string) => {
    if (!hasValue) return key === "general" ? menuText.noSpecificFormat : "";
    if (key === "text" || !numeric) return `${raw}`;
    return formatValue(code, Number(raw));
  };
  const items: MenuItem[] = NUMBER_FORMATS.map(({ key, icon, code }) => {
    const value = code(symbol);
    return {
      id: `number-format-${key}`,
      label: (
        <span className="ts-home-format-item" data-format={key}>
          <span>{menuText[key]}</span>
          <span className="ts-home-format-preview">{preview(value, key)}</span>
        </span>
      ),
      icon,
      onSelect: () => applyFormat(home, value),
    };
  });
  items.push({ type: "separator" });
  items.push({
    id: "number-format-more",
    label: numberFormatMenu.moreFormats.replace(/\.\.\.$/, "…"),
    onSelect: () =>
      home.run((ctx) => openFormatCells(ctx, "number"), { noHistory: true }),
  });
  return (
    <FieldMenu
      label={t.numberFormat}
      value={current}
      items={items}
      width={122}
      disabled={!home.editable}
      menuClassName="ts-home-format-menu"
    />
  );
};

type Currency = {
  id: string;
  symbol: string;
  icon: LucideIcon;
  options?: NumberFormatOptions;
};

const CURRENCIES: Currency[] = [
  { id: "enUS", symbol: "$", icon: DollarSign },
  { id: "enGB", symbol: "£", icon: PoundSterling },
  { id: "euro", symbol: "€", icon: Euro },
  { id: "zh", symbol: "¥", icon: JapaneseYen },
  { id: "chf", symbol: "CHF", icon: SwissFranc },
  {
    id: "ru",
    symbol: "₽",
    icon: RussianRuble,
    options: { symbolPosition: "after" },
  },
  { id: "hi", symbol: "₹", icon: IndianRupee },
];

const currencyIcon = (symbol: string): LucideIcon =>
  CURRENCIES.find((c) => c.symbol === symbol)?.icon ?? Banknote;

export const AccountingCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  const { t } = home;
  const symbol = useCurrency(home);
  const apply = (sym: string, options: NumberFormatOptions = {}) =>
    applyFormat(
      home,
      buildFormatCode("accounting", { decimals: 2, symbol: sym, ...options })
    );
  // the workbook's currency first, then Excel's list
  const list = [
    ...CURRENCIES.filter((c) => c.symbol === symbol),
    ...CURRENCIES.filter((c) => c.symbol !== symbol),
  ];
  if (!CURRENCIES.some((c) => c.symbol === symbol)) {
    list.unshift({ id: "workbook", symbol, icon: Banknote });
  }
  const menu: MenuItem[] = list.map((c) => ({
    id: `accounting-${c.id}`,
    label: `${c.symbol} ${t.currencies[c.id] ?? ""}`.trim(),
    icon: c.icon,
    onSelect: () => apply(c.symbol, c.options),
  }));
  menu.push({ type: "separator" });
  menu.push({
    id: "accounting-more",
    label: t.moreAccounting,
    onSelect: () =>
      home.run((ctx) => openFormatCells(ctx, "number"), { noHistory: true }),
  });
  return (
    <SplitButton
      icon={currencyIcon(symbol)}
      label={t.accounting}
      description={t.accountingDescription}
      arrowLabel={moreLabel(t, t.accounting)}
      disabled={!home.editable}
      onClick={() => apply(symbol)}
      menu={menu}
    />
  );
};

export const PercentCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  return (
    <IconButton
      icon={Percent}
      label={home.t.percentStyle}
      shortcut={shortcutText(home.t.percentShortcut)}
      disabled={!home.editable}
      onClick={() =>
        home.run((ctx) => handlePercentageFormat(ctx, home.input()))
      }
    />
  );
};

export const CommaCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  return (
    <IconButton
      icon={CommaStyle}
      label={home.t.commaStyle}
      disabled={!home.editable}
      onClick={() =>
        applyFormat(
          home,
          buildFormatCode("accounting", { decimals: 2, symbol: "" })
        )
      }
    />
  );
};

export const IncreaseDecimalCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  return (
    <IconButton
      icon={DecimalsArrowRight}
      label={home.t.increaseDecimal}
      disabled={!home.editable}
      onClick={() => home.run((ctx) => handleNumberIncrease(ctx, home.input()))}
    />
  );
};

export const DecreaseDecimalCommand: React.FC<RibbonCommandProps> = () => {
  const home = useHome();
  return (
    <IconButton
      icon={DecimalsArrowLeft}
      label={home.t.decreaseDecimal}
      disabled={!home.editable}
      onClick={() => home.run((ctx) => handleNumberDecrease(ctx, home.input()))}
    />
  );
};
