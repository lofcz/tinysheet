/**
 * Format Axis › Number (Excel): Category, the category's options (decimal
 * places, 1000 separator, symbol, type), Format Code with Add, and the
 * "Linked to source" check box. Linked (the default), the axis shows the
 * source cells' number format; any change here unlinks it.
 */
import React, { useEffect, useId, useState } from "react";
import {
  buildFormatCode,
  chartToolsLocale,
  Context,
  CURRENCY_SYMBOLS,
  DATE_FORMATS,
  describeFormat,
  FORMAT_CATEGORIES,
  FRACTION_FORMATS,
  isValidFormatCode,
  locale,
  SPECIAL_FORMATS,
  TIME_FORMATS,
} from "@lofcz/tinysheet-core";
import type {
  ChartAxisNumberFormat,
  FormatCategory,
  NumberFormatOptions,
} from "@lofcz/tinysheet-core";
import { CheckField, NumberField, SelectField } from "./ChartEditorParts";

const DECIMAL_CATEGORIES: FormatCategory[] = [
  "number",
  "currency",
  "accounting",
  "percentage",
  "scientific",
];

const TYPE_LISTS: Partial<Record<FormatCategory, string[]>> = {
  date: DATE_FORMATS,
  time: TIME_FORMATS,
  fraction: FRACTION_FORMATS,
  special: SPECIAL_FORMATS,
};

export const ChartNumberFormat: React.FC<{
  context: Context;
  /** The axis' own settings. */
  value: ChartAxisNumberFormat | undefined;
  /** The format of the source cells (shown while linked). */
  source: string | undefined;
  disabled?: boolean;
  onChange: (next: ChartAxisNumberFormat) => void;
}> = ({ context, value, source, disabled, onChange }) => {
  const t = chartToolsLocale(context).names;
  const fc = locale(context).formatCells;
  const linked = value?.sourceLinked !== false;
  const code = (linked ? source : value?.numberFormat) || "General";
  const described = describeFormat(code);
  const [draft, setDraft] = useState(code);
  const codeId = useId();
  useEffect(() => setDraft(code), [code]);

  const set = (next: string) =>
    onChange({ numberFormat: next, sourceLinked: false });
  const setOptions = (category: FormatCategory, options: NumberFormatOptions) =>
    set(buildFormatCode(category, options));

  const { category, options } = described;
  const list = TYPE_LISTS[category];
  return (
    <section
      className="fortune-chart-editor-section"
      data-testid="chart-number-format"
    >
      <h3>{t.number}</h3>
      <SelectField
        label={t.category}
        value={category}
        disabled={disabled}
        options={FORMAT_CATEGORIES.map((c) => ({
          value: c,
          label: fc.categories[c],
        }))}
        onChange={(c) => {
          const next = c as FormatCategory;
          const decimals = options.decimals ?? 2;
          if (next === "custom") set(code);
          else if (next === "number") {
            setOptions(next, { decimals, thousands: true });
          } else {
            setOptions(next, {
              decimals,
              code: TYPE_LISTS[next]?.[0],
            });
          }
        }}
      />
      {DECIMAL_CATEGORIES.includes(category) && (
        <NumberField
          label={t.decimalPlaces}
          value={options.decimals ?? 0}
          min={0}
          max={30}
          step={1}
          disabled={disabled}
          onCommit={(decimals) =>
            setOptions(category, { ...options, decimals: decimals ?? 0 })
          }
        />
      )}
      {category === "number" && (
        <CheckField
          label={t.useThousands}
          checked={!!options.thousands}
          disabled={disabled}
          onChange={(thousands) =>
            setOptions(category, { ...options, thousands })
          }
        />
      )}
      {(category === "currency" || category === "accounting") && (
        <SelectField
          label={t.symbol}
          value={options.symbol ?? "$"}
          disabled={disabled}
          options={[
            { value: "", label: fc.none },
            ...CURRENCY_SYMBOLS.map((s) => ({
              value: s.symbol,
              label: `${s.symbol} (${s.code})`,
            })),
          ].filter(
            (o, i, all) => all.findIndex((x) => x.value === o.value) === i
          )}
          onChange={(symbol) =>
            setOptions(category, {
              ...options,
              symbol,
              symbolPosition:
                CURRENCY_SYMBOLS.find((x) => x.symbol === symbol)?.position ??
                "before",
            })
          }
        />
      )}
      {list && (
        <SelectField
          label={t.type}
          value={list.includes(code) ? code : list[0]}
          disabled={disabled}
          options={list.map((c) => ({ value: c, label: c }))}
          onChange={(c) => set(c)}
        />
      )}
      <div className="fortune-chart-editor-field fortune-chart-editor-code">
        <label htmlFor={codeId}>{t.formatCode}</label>
        <div className="fortune-chart-editor-row">
          <input
            id={codeId}
            type="text"
            value={draft}
            disabled={disabled}
            spellCheck={false}
            aria-invalid={isValidFormatCode(draft) ? undefined : true}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && isValidFormatCode(draft)) set(draft);
            }}
          />
          <button
            type="button"
            className="button-basic button-default"
            disabled={disabled || !isValidFormatCode(draft)}
            onClick={() => set(draft)}
          >
            {t.addFormat}
          </button>
        </div>
      </div>
      <CheckField
        label={t.linkedToSource}
        checked={linked}
        disabled={disabled}
        onChange={(on) =>
          onChange(
            on ? {} : { numberFormat: source || "General", sourceLinked: false }
          )
        }
      />
    </section>
  );
};

export default ChartNumberFormat;
