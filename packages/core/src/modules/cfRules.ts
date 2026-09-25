import _ from "lodash";
import type { SingleRange } from "../types";
import type {
  CFColorScaleStop,
  CFDataBar,
  CFIconSet,
  CFIconSetName,
  CFRule,
  CFValueObject,
} from "./cfTypes";

/* Presets (the galleries of Excel's Conditional Formatting menu) */

/** Data bar colours: blue, green, red, orange, light blue, purple. */
export const CF_DATA_BAR_COLORS = [
  "#638EC6",
  "#63C384",
  "#FF555A",
  "#FFB628",
  "#008AEF",
  "#D6007B",
];

const GREEN = "#63BE7B";
const YELLOW = "#FFEB84";
const RED = "#F8696B";
const WHITE = "#FCFCFF";
const BLUE = "#5A8AC6";
const LIGHT_YELLOW = "#FFEF9C";

/**
 * Colour-scale presets in Excel's gallery order, as [highest, (middle),
 * lowest] like Excel's names ("Green - Yellow - Red": green is the top).
 */
export const CF_COLOR_SCALE_PRESETS: string[][] = [
  [GREEN, YELLOW, RED],
  [RED, YELLOW, GREEN],
  [GREEN, WHITE, RED],
  [RED, WHITE, GREEN],
  [BLUE, WHITE, RED],
  [RED, WHITE, BLUE],
  [WHITE, RED],
  [RED, WHITE],
  [GREEN, WHITE],
  [WHITE, GREEN],
  [GREEN, LIGHT_YELLOW],
  [LIGHT_YELLOW, GREEN],
];

/** Icon-set gallery, grouped like Excel's menu. */
export const CF_ICON_SET_GROUPS: {
  key: "directional" | "shapes" | "indicators" | "ratings";
  sets: CFIconSetName[];
}[] = [
  {
    key: "directional",
    sets: [
      "3Arrows",
      "3ArrowsGray",
      "3Triangles",
      "4Arrows",
      "4ArrowsGray",
      "5Arrows",
      "5ArrowsGray",
    ],
  },
  {
    key: "shapes",
    sets: [
      "3TrafficLights1",
      "3TrafficLights2",
      "3Signs",
      "4TrafficLights",
      "4RedToBlack",
    ],
  },
  { key: "indicators", sets: ["3Symbols", "3Symbols2", "3Flags"] },
  {
    key: "ratings",
    sets: ["3Stars", "4Rating", "5Quarters", "5Rating", "5Boxes"],
  },
];

/* Icons */

export type CFIconShape =
  | "arrowUp"
  | "arrowDown"
  | "arrowRight"
  | "arrowUpRight"
  | "arrowDownRight"
  | "triangleUp"
  | "triangleDown"
  | "dash"
  | "circle"
  | "circleRim"
  | "diamond"
  | "triangle"
  | "check"
  | "cross"
  | "exclamation"
  | "checkCircle"
  | "crossCircle"
  | "exclamationCircle"
  | "flag"
  | "star"
  | "quarter"
  | "rating"
  | "boxes";

export interface CFIconDef {
  shape: CFIconShape;
  color: string;
  /** stars: 0 empty, 1 half, 2 full; quarters: 0-4; rating bars: 0-4; boxes: 0-4 */
  level?: number;
}

export const CF_ICON_COLORS = {
  red: "#E0443C",
  yellow: "#F5B800",
  green: "#2EA24B",
  gray: "#808080",
  black: "#333333",
  pink: "#F4A09C",
  lightGray: "#B8B8B8",
  gold: "#F2B01E",
  blue: "#3F6FB5",
};

const IC = CF_ICON_COLORS;

/** The icons of every set, lowest value first (Excel's order). */
export const CF_ICON_SETS: Record<CFIconSetName, CFIconDef[]> = {
  "3Arrows": [
    { shape: "arrowDown", color: IC.red },
    { shape: "arrowRight", color: IC.yellow },
    { shape: "arrowUp", color: IC.green },
  ],
  "3ArrowsGray": [
    { shape: "arrowDown", color: IC.gray },
    { shape: "arrowRight", color: IC.gray },
    { shape: "arrowUp", color: IC.gray },
  ],
  "3Flags": [
    { shape: "flag", color: IC.red },
    { shape: "flag", color: IC.yellow },
    { shape: "flag", color: IC.green },
  ],
  "3TrafficLights1": [
    { shape: "circle", color: IC.red },
    { shape: "circle", color: IC.yellow },
    { shape: "circle", color: IC.green },
  ],
  "3TrafficLights2": [
    { shape: "circleRim", color: IC.red },
    { shape: "circleRim", color: IC.yellow },
    { shape: "circleRim", color: IC.green },
  ],
  "3Signs": [
    { shape: "diamond", color: IC.red },
    { shape: "triangle", color: IC.yellow },
    { shape: "circle", color: IC.green },
  ],
  "3Symbols": [
    { shape: "crossCircle", color: IC.red },
    { shape: "exclamationCircle", color: IC.yellow },
    { shape: "checkCircle", color: IC.green },
  ],
  "3Symbols2": [
    { shape: "cross", color: IC.red },
    { shape: "exclamation", color: IC.yellow },
    { shape: "check", color: IC.green },
  ],
  "3Stars": [
    { shape: "star", color: IC.gold, level: 0 },
    { shape: "star", color: IC.gold, level: 1 },
    { shape: "star", color: IC.gold, level: 2 },
  ],
  "3Triangles": [
    { shape: "triangleDown", color: IC.red },
    { shape: "dash", color: IC.yellow },
    { shape: "triangleUp", color: IC.green },
  ],
  "4Arrows": [
    { shape: "arrowDown", color: IC.red },
    { shape: "arrowDownRight", color: IC.yellow },
    { shape: "arrowUpRight", color: IC.yellow },
    { shape: "arrowUp", color: IC.green },
  ],
  "4ArrowsGray": [
    { shape: "arrowDown", color: IC.gray },
    { shape: "arrowDownRight", color: IC.gray },
    { shape: "arrowUpRight", color: IC.gray },
    { shape: "arrowUp", color: IC.gray },
  ],
  "4RedToBlack": [
    { shape: "circle", color: IC.black },
    { shape: "circle", color: IC.lightGray },
    { shape: "circle", color: IC.pink },
    { shape: "circle", color: IC.red },
  ],
  "4Rating": [
    { shape: "rating", color: IC.blue, level: 1 },
    { shape: "rating", color: IC.blue, level: 2 },
    { shape: "rating", color: IC.blue, level: 3 },
    { shape: "rating", color: IC.blue, level: 4 },
  ],
  "4TrafficLights": [
    { shape: "circleRim", color: IC.black },
    { shape: "circleRim", color: IC.red },
    { shape: "circleRim", color: IC.yellow },
    { shape: "circleRim", color: IC.green },
  ],
  "5Arrows": [
    { shape: "arrowDown", color: IC.red },
    { shape: "arrowDownRight", color: IC.yellow },
    { shape: "arrowRight", color: IC.yellow },
    { shape: "arrowUpRight", color: IC.yellow },
    { shape: "arrowUp", color: IC.green },
  ],
  "5ArrowsGray": [
    { shape: "arrowDown", color: IC.gray },
    { shape: "arrowDownRight", color: IC.gray },
    { shape: "arrowRight", color: IC.gray },
    { shape: "arrowUpRight", color: IC.gray },
    { shape: "arrowUp", color: IC.gray },
  ],
  "5Rating": [
    { shape: "rating", color: IC.blue, level: 0 },
    { shape: "rating", color: IC.blue, level: 1 },
    { shape: "rating", color: IC.blue, level: 2 },
    { shape: "rating", color: IC.blue, level: 3 },
    { shape: "rating", color: IC.blue, level: 4 },
  ],
  "5Quarters": [
    { shape: "quarter", color: IC.black, level: 0 },
    { shape: "quarter", color: IC.black, level: 1 },
    { shape: "quarter", color: IC.black, level: 2 },
    { shape: "quarter", color: IC.black, level: 3 },
    { shape: "quarter", color: IC.black, level: 4 },
  ],
  "5Boxes": [
    { shape: "boxes", color: IC.blue, level: 0 },
    { shape: "boxes", color: IC.blue, level: 1 },
    { shape: "boxes", color: IC.blue, level: 2 },
    { shape: "boxes", color: IC.blue, level: 3 },
    { shape: "boxes", color: IC.blue, level: 4 },
  ],
};

export const CF_ICON_SET_NAMES = Object.keys(CF_ICON_SETS) as CFIconSetName[];

export function iconSetSize(name: CFIconSetName) {
  return CF_ICON_SETS[name]?.length ?? 3;
}

/** Excel's default thresholds: 33/67, 25/50/75 or 20/40/60/80 percent. */
export function defaultIconThresholds(n: number): CFValueObject[] {
  const out: CFValueObject[] = [];
  for (let i = 1; i < n; i += 1) {
    out.push({
      type: "percent",
      value: n === 3 ? [33, 67][i - 1] : Math.round((100 * i) / n),
      gte: true,
    });
  }
  return out;
}

/* Rule factories */

export function makeDataBar(
  color: string,
  gradient: boolean,
  overrides: Partial<CFDataBar> = {}
): CFDataBar {
  return {
    color,
    gradient,
    border: gradient,
    borderColor: color,
    negativeColor: "#FF0000",
    negativeBorderColor: "#FF0000",
    sameNegativeColor: false,
    direction: "context",
    axisPosition: "automatic",
    axisColor: "#000000",
    min: { type: "autoMin" },
    max: { type: "autoMax" },
    showValue: true,
    minLength: 0,
    maxLength: 100,
    ...overrides,
  };
}

/** Colour-scale stops from a preset ([highest, (middle), lowest]). */
export function colorScaleFromPreset(colors: string[]): CFColorScaleStop[] {
  if (colors.length >= 3) {
    return [
      { type: "min", color: colors[2] },
      { type: "percentile", value: 50, color: colors[1] },
      { type: "max", color: colors[0] },
    ];
  }
  return [
    { type: "min", color: colors[1] ?? colors[0] },
    { type: "max", color: colors[0] },
  ];
}

export function makeIconSet(
  name: CFIconSetName,
  overrides: Partial<CFIconSet> = {}
): CFIconSet {
  return {
    name,
    thresholds: defaultIconThresholds(iconSetSize(name)),
    reverse: false,
    showValue: true,
    ...overrides,
  };
}

/* Legacy (Luckysheet) rules */

/** Luckysheet's icon sprite rows ("top_leftMin") to Excel icon sets. */
const LEGACY_ICONS: Record<string, CFIconSetName> = {
  "0_0": "3Arrows",
  "0_5": "3ArrowsGray",
  "1_0": "4Arrows",
  "1_5": "4ArrowsGray",
  "2_0": "5Arrows",
  "2_5": "5ArrowsGray",
  "3_0": "3Triangles",
  "4_0": "3TrafficLights1",
  "4_5": "3TrafficLights2",
  "5_0": "3Signs",
  "5_5": "4RedToBlack",
  "6_0": "4TrafficLights",
  "7_0": "3Symbols",
  "7_5": "3Symbols2",
  "8_0": "3Flags",
  "9_0": "3Stars",
  "9_5": "4Rating",
  "10_0": "5Quarters",
  "10_5": "5Rating",
  "11_0": "5Boxes",
};

const normalizedCache = new WeakMap<object, CFRule>();

/**
 * The rule with its visual settings in the current model. Legacy data bars
 * (`format: [color, (color2)]`), colour scales (`format: [top, (mid), low]`)
 * and icon sets (`format: {len, leftMin, top}`) are converted. The input is
 * never mutated (it may be frozen state).
 */
export function normalizeRule(rule: CFRule): CFRule {
  if (!rule || typeof rule !== "object") return rule;
  const hit = normalizedCache.get(rule);
  if (hit) return hit;
  let out = rule;
  if (rule.type === "dataBar" && !rule.dataBar) {
    const fmt = Array.isArray(rule.format) ? rule.format : [];
    out = {
      ...rule,
      dataBar: makeDataBar(fmt[0] || CF_DATA_BAR_COLORS[0], fmt.length > 1),
    };
  } else if (rule.type === "colorGradation" && !rule.colorScale) {
    const fmt = Array.isArray(rule.format) ? rule.format : [];
    out = {
      ...rule,
      colorScale: {
        stops: colorScaleFromPreset(
          fmt.length >= 2 ? fmt : CF_COLOR_SCALE_PRESETS[0]
        ),
      },
    };
  } else if (rule.type === "icons" && !rule.iconSet) {
    const fmt = rule.format || {};
    let name = LEGACY_ICONS[`${fmt.top}_${fmt.leftMin}`];
    if (!name) {
      const byLength: Record<number, CFIconSetName> = {
        4: "4Arrows",
        5: "5Arrows",
      };
      name = byLength[Number(fmt.len)] ?? "3Arrows";
    }
    out = { ...rule, iconSet: makeIconSet(name) };
  }
  normalizedCache.set(rule, out);
  return out;
}

/** Rules of a sheet, highest priority first (Excel's rule order). */
export function rulesByPriority(rules: CFRule[] | null | undefined) {
  return (rules ?? []).slice().reverse();
}

/* A1 ranges (applies-to) */

export const CF_MAX_ROW = 1048575;
export const CF_MAX_COL = 16383;

export function cfColumnToIndex(letters: string) {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i += 1) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function cfIndexToColumn(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const CELL_RE = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;
const COL_RE = /^\$?([A-Za-z]{1,3})$/;
const ROW_RE = /^\$?(\d+)$/;

function parseRangePart(part: string): SingleRange | null {
  const txt = part.replace(/^.*!/, "").trim();
  if (!txt) return null;
  const [a, b = a] = txt.split(":");
  let m1 = CELL_RE.exec(a);
  let m2 = CELL_RE.exec(b);
  if (m1 && m2) {
    const r1 = parseInt(m1[2], 10) - 1;
    const r2 = parseInt(m2[2], 10) - 1;
    const c1 = cfColumnToIndex(m1[1]);
    const c2 = cfColumnToIndex(m2[1]);
    if (r1 < 0 || r2 < 0) return null;
    return {
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  m1 = COL_RE.exec(a);
  m2 = COL_RE.exec(b);
  if (m1 && m2 && txt.includes(":")) {
    const c1 = cfColumnToIndex(m1[1]);
    const c2 = cfColumnToIndex(m2[1]);
    return {
      row: [0, CF_MAX_ROW],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  m1 = ROW_RE.exec(a);
  m2 = ROW_RE.exec(b);
  if (m1 && m2 && txt.includes(":")) {
    const r1 = parseInt(m1[1], 10) - 1;
    const r2 = parseInt(m2[1], 10) - 1;
    if (r1 < 0 || r2 < 0) return null;
    return {
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [0, CF_MAX_COL],
    };
  }
  return null;
}

/**
 * Parse an applies-to text such as `A1:B5,D2` or xlsx's `A1:B5 D2`.
 * Returns null when any part is invalid.
 */
export function parseSqref(text: string): SingleRange[] | null {
  const parts = `${text ?? ""}`
    .replace(/^=/, "")
    .split(/[\s,;]+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const out: SingleRange[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const range = parseRangePart(parts[i]);
    if (!range) return null;
    out.push(range);
  }
  return out;
}

export function formatCFRange(range: SingleRange) {
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;
  if (r1 === 0 && r2 >= CF_MAX_ROW) {
    return `${cfIndexToColumn(c1)}:${cfIndexToColumn(c2)}`;
  }
  if (c1 === 0 && c2 >= CF_MAX_COL) return `${r1 + 1}:${r2 + 1}`;
  const a = `${cfIndexToColumn(c1)}${r1 + 1}`;
  if (r1 === r2 && c1 === c2) return a;
  return `${a}:${cfIndexToColumn(c2)}${r2 + 1}`;
}

/** Applies-to text; `sep` is "," for the UI and " " for xlsx. */
export function formatSqref(
  ranges: SingleRange[] | null | undefined,
  sep = ","
) {
  return (ranges ?? []).map(formatCFRange).join(sep);
}

export function cfRangesIntersect(a: SingleRange, b: SingleRange) {
  return (
    a.row[0] <= b.row[1] &&
    b.row[0] <= a.row[1] &&
    a.column[0] <= b.column[1] &&
    b.column[0] <= a.column[1]
  );
}

/** Plain copy of the fields a rule needs (drops selection extras). */
export function cleanCFRanges(ranges: any[] | null | undefined): SingleRange[] {
  return (ranges ?? [])
    .filter((r) => r?.row && r?.column)
    .map((r) => ({
      // selections may carry a single index for a one-cell range
      row: [r.row[0], r.row[1] ?? r.row[0]],
      column: [r.column[0], r.column[1] ?? r.column[0]],
    }));
}

export function cloneCFRule<T extends CFRule>(rule: T): T {
  return _.cloneDeep(rule);
}
