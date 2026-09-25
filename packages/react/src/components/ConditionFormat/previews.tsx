import React, { useEffect, useRef } from "react";
import {
  CF_ICON_SETS,
  drawCFIcon,
  normalizeRule,
  formatSqref,
  mixCFColors,
} from "@lofcz/tinysheet-core";
import type {
  CFIconSetName,
  CFRule,
  CFValueObject,
} from "@lofcz/tinysheet-core";

export type CFText = Record<string, string>;

/** One icon of a set, drawn with the same code as the grid. */
export const IconCanvas: React.FC<{
  set: CFIconSetName;
  index: number;
  size?: number;
}> = ({ set, index, size = 16 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const rc = canvas?.getContext("2d");
    if (!canvas || !rc) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    rc.setTransform(ratio, 0, 0, ratio, 0, 0);
    rc.clearRect(0, 0, size, size);
    drawCFIcon(rc, { set, index }, 0, 0, size);
  }, [set, index, size]);
  return (
    <canvas
      ref={ref}
      className="fortune-cf-icon"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
};

/** The icons of a set, highest value first (as Excel's gallery shows them). */
export const IconSetPreview: React.FC<{
  name: CFIconSetName;
  size?: number;
  reverse?: boolean;
}> = ({ name, size = 16, reverse = false }) => {
  const n = CF_ICON_SETS[name]?.length ?? 0;
  const order = Array.from({ length: n }, (_v, i) => n - 1 - i);
  if (reverse) order.reverse();
  return (
    <span className="fortune-cf-iconset">
      {order.map((i) => (
        <IconCanvas key={i} set={name} index={i} size={size} />
      ))}
    </span>
  );
};

/** A data bar swatch: three bars of growing length. */
export const DataBarSwatch: React.FC<{ color: string; gradient: boolean }> = ({
  color,
  gradient,
}) => {
  const fill = gradient
    ? `linear-gradient(to right, ${color}, ${mixCFColors(
        color,
        "#FFFFFF",
        0.88
      )})`
    : color;
  return (
    <span className="fortune-cf-bar-swatch" aria-hidden="true">
      {[45, 75, 100].map((w) => (
        <span
          key={w}
          style={{
            width: `${w}%`,
            background: fill,
            border: gradient ? `1px solid ${color}` : undefined,
          }}
        />
      ))}
    </span>
  );
};

/** A colour-scale swatch: highest colour on top. */
export const ColorScaleSwatch: React.FC<{ colors: string[] }> = ({
  colors,
}) => (
  <span className="fortune-cf-scale-swatch" aria-hidden="true">
    {colors.length === 2 ? (
      <>
        <span style={{ background: colors[0] }} />
        <span style={{ background: mixCFColors(colors[0], colors[1], 0.5) }} />
        <span style={{ background: colors[1] }} />
      </>
    ) : (
      colors.map((c, i) => <span key={i} style={{ background: c }} />)
    )}
  </span>
);

/** How a rule's format looks (Manage Rules "Format" column). */
export const RuleFormatPreview: React.FC<{ rule: CFRule; text: CFText }> = ({
  rule: raw,
  text,
}) => {
  const rule = normalizeRule(raw);
  if (rule.type === "dataBar" && rule.dataBar) {
    const { color, gradient } = rule.dataBar;
    return (
      <span className="fortune-cf-preview">
        <span
          className="fortune-cf-preview-bar"
          style={{
            background: gradient
              ? `linear-gradient(to right, ${color}, ${mixCFColors(
                  color,
                  "#FFFFFF",
                  0.88
                )})`
              : color,
            borderColor:
              rule.dataBar.border ?? gradient ? color : "transparent",
          }}
        />
      </span>
    );
  }
  if (rule.type === "colorGradation" && rule.colorScale) {
    const stops = rule.colorScale.stops.map((s) => s.color);
    return (
      <span
        className="fortune-cf-preview"
        style={{ background: `linear-gradient(to right, ${stops.join(", ")})` }}
      />
    );
  }
  if (rule.type === "icons" && rule.iconSet) {
    return (
      <span className="fortune-cf-preview fortune-cf-preview-icons">
        <IconSetPreview
          name={rule.iconSet.name}
          size={14}
          reverse={!!rule.iconSet.reverse}
        />
      </span>
    );
  }
  const f = (rule.format ?? {}) as any;
  const hasFormat = Object.keys(f).some(
    (k) => f[k] !== null && f[k] !== undefined && f[k] !== false && f[k] !== ""
  );
  return (
    <span
      className="fortune-cf-preview"
      style={{
        background: f.cellColor || undefined,
        color: f.textColor || undefined,
        fontWeight: f.bold ? 700 : undefined,
        fontStyle: f.italic ? "italic" : undefined,
        textDecoration:
          [
            f.underline ? "underline" : "",
            f.strikethrough ? "line-through" : "",
          ]
            .join(" ")
            .trim() || undefined,
        outline: f.borderColor ? `1px solid ${f.borderColor}` : undefined,
        outlineOffset: -1,
      }}
    >
      {hasFormat ? text.sampleText : text.noFormatSet}
    </span>
  );
};

function valueText(v: any) {
  if (v === null || v === undefined) return "";
  return `${v}`;
}

export function valueObjectText(vo: CFValueObject | undefined, text: CFText) {
  if (!vo) return "";
  switch (vo.type) {
    case "min":
      return text.vtLowest;
    case "max":
      return text.vtHighest;
    case "autoMin":
    case "autoMax":
      return text.vtAutomatic;
    case "percent":
      return `${valueText(vo.value)}%`;
    case "percentile":
      return `${text.vtPercentile} ${valueText(vo.value)}`;
    default:
      return valueText(vo.value);
  }
}

const OPERATOR_KEYS: Record<string, string> = {
  greaterThan: "opGreater",
  lessThan: "opLess",
  greaterThanOrEqual: "opGreaterEq",
  lessThanOrEqual: "opLessEq",
  equal: "opEqual",
  notEqual: "opNotEqual",
  between: "opBetween",
  notBetween: "opNotBetween",
  textContains: "opContaining",
  textNotContains: "opNotContaining",
  textBeginsWith: "opBeginsWith",
  textEndsWith: "opEndsWith",
};

export const DATE_PERIODS = [
  "yesterday",
  "today",
  "tomorrow",
  "last7Days",
  "lastWeek",
  "thisWeek",
  "nextWeek",
  "lastMonth",
  "thisMonth",
  "nextMonth",
];

export function datePeriodText(period: string, text: CFText) {
  const key = `dp_${period}`;
  return text[key] ?? period;
}

/** One-line description of a rule (Manage Rules "Rule" column). */
export function describeRule(raw: CFRule, text: CFText): string {
  const rule = normalizeRule(raw);
  const v = rule.conditionValue ?? [];
  if (rule.type === "dataBar") return text.descDataBar;
  if (rule.type === "colorGradation") return text.descColorScale;
  if (rule.type === "icons") return text.descIconSet;
  const name = rule.conditionName ?? "";
  if (OPERATOR_KEYS[name]) {
    const op = text[OPERATOR_KEYS[name]];
    if (name.startsWith("text")) {
      return `${text.specificTextOpt} ${op} "${valueText(v[0])}"`;
    }
    if (name === "between" || name === "notBetween") {
      return `${text.cellValueOpt} ${op} ${valueText(v[0])} ${
        text.andLabel
      } ${valueText(v[1])}`;
    }
    return `${text.cellValueOpt} ${op} ${valueText(v[0])}`;
  }
  switch (name) {
    case "occurrenceDate":
      return `${text.datesOccurringOpt}: ${datePeriodText(
        valueText(v[0]),
        text
      )}`;
    case "blanks":
      return text.blanksOpt;
    case "noBlanks":
      return text.noBlanksOpt;
    case "errors":
      return text.errorsOpt;
    case "noErrors":
      return text.noErrorsOpt;
    case "duplicateValue":
      return `${v[0]}` === "1" ? text.descUnique : text.descDuplicate;
    case "top10":
      return `${text.topLabel} ${valueText(v[0])}`;
    case "top10_percent":
      return `${text.topLabel} ${valueText(v[0])}%`;
    case "last10":
      return `${text.bottomLabel} ${valueText(v[0])}`;
    case "last10_percent":
      return `${text.bottomLabel} ${valueText(v[0])}%`;
    case "aboveAverage":
    case "belowAverage": {
      const above = name === "aboveAverage";
      if (rule.stdDev) {
        return (above ? text.stdDevAbove : text.stdDevBelow).replace(
          "{n}",
          `${rule.stdDev}`
        );
      }
      if (rule.equalAverage) {
        return above ? text.avgEqualAbove : text.avgEqualBelow;
      }
      return above ? text.avgAbove : text.avgBelow;
    }
    case "formula": {
      const f = valueText(v[0]);
      return `${text.descFormula}: ${f.startsWith("=") ? f : `=${f}`}`;
    }
    default:
      return name;
  }
}

export function appliesToText(rule: CFRule) {
  return formatSqref(rule.cellrange);
}
