import React, { useContext, useMemo } from "react";
import {
  locale,
  buildFormatCode,
  customFormatList,
  formatValue,
  getFormatColor,
  CURRENCY_SYMBOLS,
  DATE_FORMATS,
  FORMAT_CATEGORIES,
  FRACTION_FORMATS,
  MAX_DECIMALS,
  NEGATIVE_STYLES,
  SAMPLE_DATE_SERIAL,
  SPECIAL_FORMATS,
  TIME_FORMATS,
} from "@lofcz/tinysheet-core";
import type {
  FormatCategory,
  NumberFormatOptions,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

export type NumberState = {
  category: FormatCategory;
  options: NumberFormatOptions;
};

/** The format code a Number tab state stands for. */
export function numberStateCode(state: NumberState) {
  return buildFormatCode(state.category, state.options);
}

/** Options a category starts with when picked (Excel's defaults). */
export function defaultOptions(
  category: FormatCategory,
  prev: NumberState,
  currency: string
): NumberFormatOptions {
  const decimals = prev.options.decimals ?? 2;
  const known = CURRENCY_SYMBOLS.find((s) => s.symbol === currency);
  const symbol = prev.options.symbol ?? currency;
  const symbolPosition =
    prev.options.symbolPosition ?? known?.position ?? "before";
  switch (category) {
    case "number":
      return { decimals, thousands: false, negative: "minus" };
    case "currency":
      return { decimals, symbol, symbolPosition, negative: "minus" };
    case "accounting":
      return { decimals, symbol, symbolPosition };
    case "percentage":
    case "scientific":
      return { decimals };
    case "date":
      return { code: DATE_FORMATS[0] };
    case "time":
      return { code: TIME_FORMATS[0] };
    case "fraction":
      return { code: FRACTION_FORMATS[0] };
    case "special":
      return { code: SPECIAL_FORMATS[0] };
    case "custom":
      return { code: numberStateCode(prev) };
    default:
      return {};
  }
}

type Props = {
  value: unknown;
  state: NumberState;
  onChange: (state: NumberState) => void;
  currency: string;
  usedFormats: string[];
  invalid: boolean;
};

/** A list box of choices (role=listbox), Excel-style. */
type ListBoxProps<T extends string> = {
  items: T[];
  value: T | undefined;
  onSelect: (v: T) => void;
  label: string;
  render: (v: T, i: number) => React.ReactNode;
  className?: string;
};

const ListBox = <T extends string>({
  items,
  value,
  onSelect,
  label,
  render,
  className,
}: ListBoxProps<T>) => {
  return (
    <div
      className={`fortune-fc-listbox ${className ?? ""}`}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        const i = items.indexOf(value as T);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const next =
            e.key === "ArrowDown"
              ? Math.min(items.length - 1, i + 1)
              : Math.max(0, i - 1);
          onSelect(items[next]);
        }
      }}
    >
      {items.map((item, i) => (
        <div
          key={`${item}-${i}`}
          role="option"
          aria-selected={item === value}
          className={`fortune-fc-option${item === value ? " selected" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(item)}
        >
          {render(item, i)}
        </div>
      ))}
    </div>
  );
};

/** Formatted text and its format colour for a code and value. */
function sampleOf(code: string, value: unknown) {
  if (value == null || value === "") return { text: "", color: null };
  const v = typeof value === "number" ? value : value;
  return {
    text: formatValue(code, v),
    color: getFormatColor(code, v),
  };
}

const NumberTab: React.FC<Props> = ({
  value,
  state,
  onChange,
  currency,
  usedFormats,
  invalid,
}) => {
  const { context } = useContext(WorkbookContext);
  const { formatCells } = locale(context);
  const { category, options } = state;
  const code = numberStateCode(state);
  const sample = sampleOf(code, value);
  const customList = useMemo(
    () => customFormatList(usedFormats, currency),
    [usedFormats, currency]
  );

  const set = (patch: NumberFormatOptions) =>
    onChange({ category, options: { ...options, ...patch } });

  const decimals = (
    <label className="fortune-fc-field" htmlFor="fortune-fc-number-1">
      <span>{formatCells.decimalPlaces}:</span>
      <input
        id="fortune-fc-number-1"
        type="number"
        min={0}
        max={MAX_DECIMALS}
        value={options.decimals ?? 2}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          set({
            decimals: Number.isNaN(n)
              ? 0
              : Math.max(0, Math.min(MAX_DECIMALS, n)),
          });
        }}
      />
    </label>
  );

  const symbolSelect = (
    <label className="fortune-fc-field" htmlFor="fortune-fc-number-2">
      <span>{formatCells.symbol}:</span>
      <select
        id="fortune-fc-number-2"
        value={options.symbol ?? ""}
        onChange={(e) => {
          const known = CURRENCY_SYMBOLS.find(
            (s) => s.symbol === e.target.value
          );
          set({
            symbol: e.target.value,
            symbolPosition: known?.position ?? "before",
          });
        }}
      >
        <option value="">{formatCells.none}</option>
        {!CURRENCY_SYMBOLS.some((s) => s.symbol === options.symbol) &&
          options.symbol && (
            <option value={options.symbol}>{options.symbol}</option>
          )}
        {CURRENCY_SYMBOLS.map((s) => (
          <option key={s.symbol} value={s.symbol}>
            {s.symbol} ({s.code})
          </option>
        ))}
      </select>
    </label>
  );

  const negativeList = (
    <div className="fortune-fc-group">
      <div className="fortune-fc-label">{formatCells.negativeNumbers}</div>
      <ListBox
        className="fortune-fc-listbox-short"
        label={formatCells.negativeNumbers}
        items={NEGATIVE_STYLES}
        value={options.negative ?? "minus"}
        onSelect={(negative) => set({ negative })}
        render={(style) => {
          const c = buildFormatCode(category, {
            ...options,
            negative: style,
          });
          const s = sampleOf(c, -1234.1);
          return (
            <span style={s.color ? { color: s.color } : undefined}>
              {s.text}
            </span>
          );
        }}
      />
    </div>
  );

  const typeList = (
    codes: string[],
    labels?: string[],
    sampleValue?: number
  ) => (
    <div className="fortune-fc-group">
      <div className="fortune-fc-label">{formatCells.type}</div>
      <ListBox
        label={formatCells.type}
        items={codes}
        value={codes.find((c) => c === options.code)}
        onSelect={(c) => set({ code: c })}
        render={(c, i) =>
          labels ? labels[i] : formatValue(c, sampleValue ?? SAMPLE_DATE_SERIAL)
        }
      />
    </div>
  );

  let body: React.ReactNode = null;
  switch (category) {
    case "number":
      body = (
        <>
          {decimals}
          <label className="fortune-fc-check" htmlFor="fortune-fc-number-3">
            <input
              id="fortune-fc-number-3"
              type="checkbox"
              checked={!!options.thousands}
              onChange={(e) => set({ thousands: e.target.checked })}
            />
            {formatCells.useThousands}
          </label>
          {negativeList}
        </>
      );
      break;
    case "currency":
      body = (
        <>
          {decimals}
          {symbolSelect}
          {negativeList}
        </>
      );
      break;
    case "accounting":
      body = (
        <>
          {decimals}
          {symbolSelect}
        </>
      );
      break;
    case "percentage":
    case "scientific":
      body = decimals;
      break;
    case "date":
      body = typeList(DATE_FORMATS);
      break;
    case "time":
      body = typeList(TIME_FORMATS);
      break;
    case "fraction":
      body = typeList(FRACTION_FORMATS, formatCells.fractionTypes);
      break;
    case "special":
      body = typeList(SPECIAL_FORMATS, formatCells.specialTypes);
      break;
    case "custom":
      body = (
        <div className="fortune-fc-group">
          <label className="fortune-fc-label" htmlFor="fortune-fc-custom-code">
            {formatCells.type}:
          </label>
          <input
            id="fortune-fc-custom-code"
            className={`fortune-fc-code${invalid ? " invalid" : ""}`}
            type="text"
            spellCheck={false}
            value={options.code ?? ""}
            aria-invalid={invalid}
            onChange={(e) => set({ code: e.target.value })}
          />
          {invalid && (
            <div className="fortune-fc-error" role="alert">
              {formatCells.invalidFormat}
            </div>
          )}
          <ListBox
            label={formatCells.type}
            items={customList}
            value={customList.find((c) => c === options.code)}
            onSelect={(c) => set({ code: c })}
            render={(c) => c}
          />
        </div>
      );
      break;
    default:
      break;
  }

  return (
    <div className="fortune-fc-number">
      <div className="fortune-fc-group fortune-fc-categories">
        <div className="fortune-fc-label">{formatCells.category}</div>
        <ListBox
          label={formatCells.category}
          items={FORMAT_CATEGORIES}
          value={category}
          onSelect={(next) => {
            if (next === category) return;
            onChange({
              category: next,
              options: defaultOptions(next, state, currency),
            });
          }}
          render={(c) => formatCells.categories[c]}
        />
      </div>
      <div className="fortune-fc-number-options">
        <fieldset className="fortune-fc-sample">
          <legend>{formatCells.sample}</legend>
          <div
            className="fortune-fc-sample-text"
            data-testid="format-cells-sample"
            style={sample.color ? { color: sample.color } : undefined}
          >
            {sample.text || " "}
          </div>
        </fieldset>
        {body}
        <p className="fortune-fc-description">
          {formatCells.descriptions[category]}
        </p>
      </div>
    </div>
  );
};

export default NumberTab;
