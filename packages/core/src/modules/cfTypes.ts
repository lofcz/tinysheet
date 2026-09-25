import type { SingleRange } from "../types";

/**
 * Conditional-formatting data model.
 *
 * Rules live in `sheet.luckysheet_conditionformat_save` (the Luckysheet
 * field, so old workbooks keep loading). The array is ordered by ascending
 * priority: the LAST rule has the highest priority, exactly as in the legacy
 * engine where a later rule overwrote an earlier one. Excel's "rule 1" is
 * therefore the last element; `rulesByPriority` returns them in Excel order.
 */

/** How a threshold (data bar end, colour-scale stop, icon boundary) is set. */
export type CFValueType =
  | "min" // lowest value in the range
  | "max" // highest value in the range
  | "autoMin" // data bars: MIN(0, lowest value)
  | "autoMax" // data bars: MAX(0, highest value)
  | "num"
  | "percent"
  | "percentile"
  | "formula";

export interface CFValueObject {
  type: CFValueType;
  /** number, percent (0-100), percentile (0-100) or formula text */
  value?: number | string;
  /** icon sets: `>=` when true (default), `>` when false */
  gte?: boolean;
}

/** Differential format applied by highlight rules (Excel's dxf). */
export interface CFStyle {
  textColor?: string | null;
  cellColor?: string | null;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  /** outline border drawn around each matching cell */
  borderColor?: string | null;
  /** number format code, e.g. `0.00%` */
  numberFormat?: string | null;
}

export type CFBarDirection = "context" | "leftToRight" | "rightToLeft";
export type CFAxisPosition = "automatic" | "midpoint" | "none";

export interface CFDataBar {
  color: string;
  gradient: boolean;
  /** draw a border round the bar (default: true for gradient fills) */
  border?: boolean;
  borderColor?: string;
  negativeColor?: string;
  negativeBorderColor?: string;
  /** use the positive colours for negative bars */
  sameNegativeColor?: boolean;
  direction?: CFBarDirection;
  axisPosition?: CFAxisPosition;
  axisColor?: string;
  /** default: automatic (MIN(0, lowest) .. MAX(0, highest)) */
  min?: CFValueObject;
  max?: CFValueObject;
  /** false: show the bar only */
  showValue?: boolean;
  /** shortest / longest bar in percent of the cell width (default 0 / 100) */
  minLength?: number;
  maxLength?: number;
}

export interface CFColorScaleStop {
  type: CFValueType;
  value?: number | string;
  color: string;
}

export interface CFColorScale {
  /** two or three stops, lowest first */
  stops: CFColorScaleStop[];
}

export type CFIconSetName =
  | "3Arrows"
  | "3ArrowsGray"
  | "3Flags"
  | "3TrafficLights1"
  | "3TrafficLights2"
  | "3Signs"
  | "3Symbols"
  | "3Symbols2"
  | "3Stars"
  | "3Triangles"
  | "4Arrows"
  | "4ArrowsGray"
  | "4RedToBlack"
  | "4Rating"
  | "4TrafficLights"
  | "5Arrows"
  | "5ArrowsGray"
  | "5Rating"
  | "5Quarters"
  | "5Boxes";

export interface CFIconSet {
  name: CFIconSetName;
  /**
   * Lower bounds of icons 2..n (n-1 entries, ascending). A value gets the
   * highest icon whose bound it reaches.
   */
  thresholds: CFValueObject[];
  reverse?: boolean;
  /** false: show the icon only */
  showValue?: boolean;
}

export type CFConditionName =
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"
  | "equal"
  | "notEqual"
  | "between"
  | "notBetween"
  | "textContains"
  | "textNotContains"
  | "textBeginsWith"
  | "textEndsWith"
  | "occurrenceDate"
  | "blanks"
  | "noBlanks"
  | "errors"
  | "noErrors"
  | "duplicateValue"
  | "top10"
  | "top10_percent"
  | "last10"
  | "last10_percent"
  | "aboveAverage"
  | "belowAverage"
  | "formula";

/** Excel's "dates occurring" periods. */
export type CFTimePeriod =
  | "yesterday"
  | "today"
  | "tomorrow"
  | "last7Days"
  | "lastWeek"
  | "thisWeek"
  | "nextWeek"
  | "lastMonth"
  | "thisMonth"
  | "nextMonth";

export type CFRuleType = "default" | "dataBar" | "colorGradation" | "icons";

export interface CFRule {
  type: CFRuleType;
  /** applies-to range */
  cellrange: SingleRange[];
  stopIfTrue?: boolean;
  /**
   * `default` rules: CFStyle. Legacy data bars / colour scales stored colour
   * arrays here; they are still read.
   */
  format?: any;
  // --- highlight rules (type "default")
  conditionName?: CFConditionName;
  /**
   * Operands. Numbers, text, or formulas starting with "=" (evaluated
   * relative to the top-left cell of the applies-to range). duplicateValue:
   * "0" duplicates / "1" unique. top10*: N. occurrenceDate: a CFTimePeriod.
   * formula: the formula.
   */
  conditionValue?: any[];
  conditionRange?: any[];
  /** above/below average: include values equal to the average */
  equalAverage?: boolean;
  /** above/below average: number of standard deviations (1-3) */
  stdDev?: number;
  // --- visual rules
  dataBar?: CFDataBar;
  colorScale?: CFColorScale;
  iconSet?: CFIconSet;
}

export interface CFDataBarResult {
  /** bar start and end as fractions of the cell width, start <= end */
  start: number;
  end: number;
  color: string;
  borderColor: string | null;
  gradient: boolean;
  /** the end at which the gradient is solid ("left" or "right") */
  solidSide: "left" | "right";
  /** axis position as a fraction of the cell width, or null */
  axis: number | null;
  axisColor: string;
}

/** What conditional formatting does to one cell. */
export interface CFCellResult extends CFStyle {
  dataBar?: CFDataBarResult;
  icon?: { set: CFIconSetName; index: number };
  /** data bar / icon set with "show bar/icon only" */
  hideValue?: boolean;
}

export type CFComputeMap = Record<string, CFCellResult>;
