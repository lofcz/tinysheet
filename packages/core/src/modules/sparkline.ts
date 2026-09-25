/**
 * Sparklines (Excel's Insert › Sparklines): tiny line, column and win/loss
 * charts drawn inside cells.
 *
 * Model: every sheet keeps `sheet.sparklineGroups`. A group shares its type
 * and options (colours, markers, axis, empty/hidden cell handling) between
 * its sparklines; each sparkline has a location cell on the group's sheet
 * and a data reference (`Sheet1!A2:E2`, always sheet-qualified, like
 * Excel's `x14:sparkline/xm:f`).
 *
 * This module holds the model and the editing operations (insert, edit the
 * data/location, change options, group/ungroup, clear); every operation
 * mutates the context it is given, so running it inside `setContext` makes
 * it one undo step. The references follow structural edits through the
 * reference-adjuster registry (see modelSync.ts), and the drawing lives in
 * sparklineRender.ts (a cell decorator).
 */
import type { Context } from "../context";
import type { Sheet } from "../types";
import { indexToColumnChar } from "../utils";
import { peek } from "./dependencyGraph";
import { quoteSheetName } from "./formulaFunctions";
import { parseRangeText } from "./names";
import type { ReferenceAdjusterApi, ReferenceChange } from "./refAdjust";

export { sparklineLocale } from "../locale/sparkline";
export type { SparklineLocale } from "../locale/sparkline";

export type SparklineType = "line" | "column" | "winloss";

/** How the vertical axis minimum / maximum is chosen. */
export type SparklineAxisType = "individual" | "group" | "custom";

/** How empty cells are plotted: a gap, as zero, or connected (lines). */
export type SparklineEmptyCells = "gap" | "zero" | "span";

export type Sparkline = {
  /** Location cell on the group's sheet. */
  r: number;
  c: number;
  /**
   * The data, as a sheet-qualified reference without "=" (`Sheet1!A2:E2`);
   * `#REF!` once the data was deleted, "" when there is none.
   */
  f: string;
};

export type SparklineColorKey =
  | "series"
  | "negative"
  | "axis"
  | "markers"
  | "first"
  | "last"
  | "high"
  | "low";

export type SparklineColors = Record<SparklineColorKey, string>;

export type SparklineGroup = {
  id: string;
  type: SparklineType;
  sparklines: Sparkline[];
  /** Colours by role; missing ones use {@link DEFAULT_SPARKLINE_COLORS}. */
  colors?: Partial<SparklineColors>;
  /** Line: a marker on every point. */
  markers?: boolean;
  high?: boolean;
  low?: boolean;
  first?: boolean;
  last?: boolean;
  negative?: boolean;
  /** Draw the horizontal axis (lines/columns: when the data crosses 0). */
  displayXAxis?: boolean;
  /** @default "gap" */
  displayEmptyCellsAs?: SparklineEmptyCells;
  /** Plot the data of hidden rows and columns. */
  displayHidden?: boolean;
  rightToLeft?: boolean;
  /** @default "individual" */
  minAxisType?: SparklineAxisType;
  /** @default "individual" */
  maxAxisType?: SparklineAxisType;
  manualMin?: number;
  manualMax?: number;
  /** Line weight in points. @default 0.75 */
  lineWeight?: number;
  /**
   * Date axis: a sheet-qualified reference to the dates the points are
   * plotted at (one per data point); evenly spaced when unset.
   */
  dateAxis?: string;
};

/** Options of a group (everything but its identity and sparklines). */
export type SparklineGroupOptions = Omit<SparklineGroup, "id" | "sparklines">;

export const DEFAULT_SPARKLINE_COLORS: SparklineColors = {
  series: "#376092",
  negative: "#D00000",
  axis: "#000000",
  markers: "#376092",
  first: "#95B3D7",
  last: "#95B3D7",
  high: "#4F81BD",
  low: "#4F81BD",
};

export const DEFAULT_SPARKLINE_LINE_WEIGHT = 0.75;

export function sparklineColor(
  group: Pick<SparklineGroup, "colors">,
  key: SparklineColorKey
) {
  return group.colors?.[key] || DEFAULT_SPARKLINE_COLORS[key];
}

let idSeed = 0;

export function generateSparklineGroupId() {
  idSeed += 1;
  return `spk_${Date.now().toString(36)}_${idSeed}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/** Options of a new group of `type` (Excel's defaults). */
export function defaultSparklineOptions(
  type: SparklineType
): SparklineGroupOptions {
  return {
    type,
    colors: { ...DEFAULT_SPARKLINE_COLORS },
    displayEmptyCellsAs: "gap",
    // Excel's win/loss sparklines show losses in the negative colour
    ...(type === "winloss" ? { negative: true } : {}),
  };
}

/** The options of `group`, deep-copied (for a new group). */
export function copySparklineOptions(
  group: SparklineGroup
): SparklineGroupOptions {
  const options: Partial<SparklineGroup> = { ...group };
  delete options.id;
  delete options.sparklines;
  return JSON.parse(JSON.stringify(options)) as SparklineGroupOptions;
}

/* -------------------------------------------------------------------------- */
/*                                   Lookup                                   */
/* -------------------------------------------------------------------------- */

type Rect = { row: number[]; column: number[] };

function sheetOf(ctx: Pick<Context, "luckysheetfile">, sheetId: string) {
  return ctx.luckysheetfile.find((s) => s.id === sheetId);
}

/** The sparkline groups of a sheet (read-only view, draft-safe). */
export function getSparklineGroups(
  ctx: Pick<Context, "luckysheetfile">,
  sheetId: string
): SparklineGroup[] {
  const files = peek(peek(ctx).luckysheetfile) ?? [];
  for (let i = 0; i < files.length; i += 1) {
    const sheet = peek(files[i]);
    if (sheet?.id === sheetId) return peek(sheet.sparklineGroups) ?? [];
  }
  return [];
}

type CellIndex = Map<number, [number, number]>;

const indexCache = new WeakMap<SparklineGroup[], CellIndex>();

const cellKey = (r: number, c: number) => r * 16384 + c;

function buildIndex(groups: SparklineGroup[]): CellIndex {
  let index = indexCache.get(groups);
  if (index) return index;
  index = new Map();
  for (let g = 0; g < groups.length; g += 1) {
    const list = peek(peek(groups[g])?.sparklines) ?? [];
    for (let s = 0; s < list.length; s += 1) {
      const sp = peek(list[s]);
      if (sp) index.set(cellKey(sp.r, sp.c), [g, s]);
    }
  }
  indexCache.set(groups, index);
  return index;
}

export type SparklineHit = {
  group: SparklineGroup;
  sparkline: Sparkline;
  groupIndex: number;
  index: number;
};

/** The sparkline whose location is (r, c) on `sheetId`, if any. */
export function sparklineAt(
  ctx: Pick<Context, "luckysheetfile">,
  sheetId: string,
  r: number,
  c: number
): SparklineHit | null {
  const groups = getSparklineGroups(ctx, sheetId);
  if (groups.length === 0) return null;
  const hit = buildIndex(groups).get(cellKey(r, c));
  if (!hit) return null;
  const group = peek(groups[hit[0]]);
  const sparkline = peek(group?.sparklines?.[hit[1]]);
  if (!group || !sparkline) return null;
  return { group, sparkline, groupIndex: hit[0], index: hit[1] };
}

function inRects(r: number, c: number, rects: Rect[]) {
  return rects.some(
    (s) =>
      r >= s.row[0] && r <= s.row[1] && c >= s.column[0] && c <= s.column[1]
  );
}

/** Sparklines located in `ranges` (e.g. the selection) on `sheetId`. */
export function sparklinesInRanges(
  ctx: Pick<Context, "luckysheetfile">,
  sheetId: string,
  ranges: Rect[] | undefined
): SparklineHit[] {
  const out: SparklineHit[] = [];
  if (!ranges?.length) return out;
  getSparklineGroups(ctx, sheetId).forEach((g, gi) => {
    const group = peek(g);
    (peek(group.sparklines) ?? []).forEach((s, si) => {
      const sp = peek(s);
      if (inRects(sp.r, sp.c, ranges)) {
        out.push({ group, sparkline: sp, groupIndex: gi, index: si });
      }
    });
  });
  return out;
}

/** Whether the ranges (e.g. the selection) contain a sparkline. */
export function rangesHaveSparklines(
  ctx: Pick<Context, "luckysheetfile">,
  sheetId: string,
  ranges: Rect[] | undefined
) {
  if (!ranges?.length) return false;
  const groups = getSparklineGroups(ctx, sheetId);
  if (groups.length === 0) return false;
  const index = buildIndex(groups);
  // small selections: probe the cells; large ones: scan the sparklines
  let cells = 0;
  ranges.forEach((s) => {
    cells += (s.row[1] - s.row[0] + 1) * (s.column[1] - s.column[0] + 1);
  });
  if (cells <= index.size) {
    return ranges.some((s) => {
      for (let r = s.row[0]; r <= s.row[1]; r += 1) {
        for (let c = s.column[0]; c <= s.column[1]; c += 1) {
          if (index.has(cellKey(r, c))) return true;
        }
      }
      return false;
    });
  }
  return sparklinesInRanges(ctx, sheetId, ranges).length > 0;
}

/* -------------------------------------------------------------------------- */
/*                              Ranges and checks                             */
/* -------------------------------------------------------------------------- */

export type SparklineRange = {
  sheetId: string;
  row: [number, number];
  column: [number, number];
};

/** A1 text of a rectangle (relative), with a sheet prefix when given. */
export function sparklineRangeText(
  sheet: string | null,
  r1: number,
  c1: number,
  r2: number,
  c2: number
) {
  const a = `${indexToColumnChar(c1)}${r1 + 1}`;
  const b = `${indexToColumnChar(c2)}${r2 + 1}`;
  const body = r1 === r2 && c1 === c2 ? a : `${a}:${b}`;
  return sheet == null ? body : `${quoteSheetName(sheet)}!${body}`;
}

function sheetName(ctx: Pick<Context, "luckysheetfile">, sheetId: string) {
  return sheetOf(ctx, sheetId)?.name ?? null;
}

/** Parse a range typed by the user (`A1:E1`, `=Sheet2!A1:A9`). */
export function parseSparklineRange(
  ctx: Context,
  text: string | null | undefined,
  defaultSheetId: string
): SparklineRange | null {
  const t = (text ?? "").trim().replace(/^=/, "");
  if (!t || t.indexOf("#REF!") >= 0 || t.indexOf(",") >= 0) return null;
  const range = parseRangeText(ctx, t, defaultSheetId);
  return range
    ? { sheetId: range.sheetId, row: range.row, column: range.column }
    : null;
}

/** The sheet-qualified reference text of a range. */
export function qualifiedSparklineRange(ctx: Context, range: SparklineRange) {
  return sparklineRangeText(
    sheetName(ctx, range.sheetId),
    range.row[0],
    range.column[0],
    range.row[1],
    range.column[1]
  );
}

export type SparklineRangeError =
  | "data"
  | "location"
  | "locationShape"
  | "locationSheet"
  | "mismatch"
  | "dataShape";

const MAX_SPARKLINES = 100000;

/**
 * Pair a data range with a location range, Excel's way: the location is a
 * single row or column; a single location cell takes a one-dimensional data
 * range, otherwise the data is split into one row (or column) per location
 * cell, whichever dimension matches the number of location cells.
 */
export function planSparklines(
  ctx: Context,
  dataText: string,
  locationText: string,
  sheetId: string
): { sparklines: Sparkline[] } | { error: SparklineRangeError } {
  const location = parseSparklineRange(ctx, locationText, sheetId);
  if (!location) return { error: "location" };
  if (location.sheetId !== sheetId) return { error: "locationSheet" };
  const data = parseSparklineRange(ctx, dataText, sheetId);
  if (!data) return { error: "data" };
  const lr = location.row[1] - location.row[0] + 1;
  const lc = location.column[1] - location.column[0] + 1;
  if (lr > 1 && lc > 1) return { error: "locationShape" };
  const n = lr * lc;
  if (n > MAX_SPARKLINES) return { error: "location" };
  const dr = data.row[1] - data.row[0] + 1;
  const dc = data.column[1] - data.column[0] + 1;
  const name = sheetName(ctx, data.sheetId);
  const cellAt = (i: number) =>
    lr > 1
      ? { r: location.row[0] + i, c: location.column[0] }
      : { r: location.row[0], c: location.column[0] + i };
  if (n === 1) {
    if (dr > 1 && dc > 1) return { error: "dataShape" };
    return {
      sparklines: [
        {
          ...cellAt(0),
          f: sparklineRangeText(
            name,
            data.row[0],
            data.column[0],
            data.row[1],
            data.column[1]
          ),
        },
      ],
    };
  }
  // one data row per location cell, or one data column
  let byRow: boolean;
  if (lr > 1) {
    if (dr === n) byRow = true;
    else if (dc === n) byRow = false;
    else return { error: "mismatch" };
  } else if (dc === n) byRow = false;
  else if (dr === n) byRow = true;
  else return { error: "mismatch" };
  const sparklines: Sparkline[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = byRow
      ? sparklineRangeText(
          name,
          data.row[0] + i,
          data.column[0],
          data.row[0] + i,
          data.column[1]
        )
      : sparklineRangeText(
          name,
          data.row[0],
          data.column[0] + i,
          data.row[1],
          data.column[0] + i
        );
    sparklines.push({ ...cellAt(i), f });
  }
  return { sparklines };
}

/* -------------------------------------------------------------------------- */
/*                                 Operations                                 */
/* -------------------------------------------------------------------------- */

/** Remove the sparklines located at `cells` ("r_c") from every group. */
function removeAtCells(sheet: Sheet, cells: Set<string>, keepGroup?: string) {
  const groups = sheet.sparklineGroups;
  if (!groups?.length || cells.size === 0) return;
  const next: SparklineGroup[] = [];
  groups.forEach((group) => {
    if (group.id === keepGroup) {
      next.push(group);
      return;
    }
    const kept = group.sparklines.filter((s) => !cells.has(`${s.r}_${s.c}`));
    if (kept.length === group.sparklines.length) next.push(group);
    else if (kept.length > 0) {
      group.sparklines = kept;
      next.push(group);
    }
  });
  if (next.length !== groups.length) sheet.sparklineGroups = next;
  if (sheet.sparklineGroups?.length === 0) delete sheet.sparklineGroups;
}

export type InsertSparklinesOptions = {
  type: SparklineType;
  /** Data range text (`A2:E5`, `Sheet2!B1:B9`). */
  data: string;
  /** Location range text on `sheetId` (`F2:F5`). */
  location: string;
  /** Sheet of the location (default: the current sheet). */
  sheetId?: string;
  /** Options overriding the defaults. */
  options?: Partial<SparklineGroupOptions>;
};

/**
 * Insert a group of sparklines (Insert › Sparklines). Sparklines already at
 * the location cells are replaced, as in Excel.
 */
export function insertSparklines(
  ctx: Context,
  opts: InsertSparklinesOptions
): { group: SparklineGroup } | { error: SparklineRangeError } {
  const sheetId = opts.sheetId ?? ctx.currentSheetId;
  const plan = planSparklines(ctx, opts.data, opts.location, sheetId);
  if ("error" in plan) return plan;
  const sheet = sheetOf(ctx, sheetId);
  if (!sheet) return { error: "location" };
  removeAtCells(sheet, new Set(plan.sparklines.map((s) => `${s.r}_${s.c}`)));
  const group: SparklineGroup = {
    ...defaultSparklineOptions(opts.type),
    ...(opts.options ?? {}),
    type: opts.type,
    id: generateSparklineGroupId(),
    sparklines: plan.sparklines,
  };
  sheet.sparklineGroups = [...(sheet.sparklineGroups ?? []), group];
  return { group };
}

function findGroup(ctx: Context, sheetId: string, groupId: string) {
  const sheet = sheetOf(ctx, sheetId);
  const group = sheet?.sparklineGroups?.find((g) => g.id === groupId);
  return sheet && group ? { sheet, group } : null;
}

/** Edit Group Location & Data: new data and location for a whole group. */
export function editSparklineGroup(
  ctx: Context,
  sheetId: string,
  groupId: string,
  dataText: string,
  locationText: string
): { error: SparklineRangeError } | null {
  const found = findGroup(ctx, sheetId, groupId);
  if (!found) return { error: "location" };
  const plan = planSparklines(ctx, dataText, locationText, sheetId);
  if ("error" in plan) return plan;
  removeAtCells(
    found.sheet,
    new Set(plan.sparklines.map((s) => `${s.r}_${s.c}`)),
    groupId
  );
  found.group.sparklines = plan.sparklines;
  return null;
}

/** Edit Single Sparkline's Data: the data of the sparkline at (r, c). */
export function editSparklineData(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number,
  dataText: string
): { error: SparklineRangeError } | null {
  const range = parseSparklineRange(ctx, dataText, sheetId);
  if (!range) return { error: "data" };
  if (range.row[1] > range.row[0] && range.column[1] > range.column[0]) {
    return { error: "dataShape" };
  }
  const sheet = sheetOf(ctx, sheetId);
  const group = sheet?.sparklineGroups?.find((g) =>
    g.sparklines.some((s) => s.r === r && s.c === c)
  );
  const sparkline = group?.sparklines.find((s) => s.r === r && s.c === c);
  if (!sparkline) return { error: "location" };
  sparkline.f = qualifiedSparklineRange(ctx, range);
  return null;
}

/**
 * Change options of groups (type, colours, markers, axis, ...). `colors`
 * is merged; `undefined` values remove an option.
 */
export function setSparklineGroupOptions(
  ctx: Context,
  sheetId: string,
  groupIds: string[],
  patch: Partial<SparklineGroupOptions>
) {
  const sheet = sheetOf(ctx, sheetId);
  if (!sheet?.sparklineGroups) return;
  const ids = new Set(groupIds);
  sheet.sparklineGroups.forEach((group) => {
    if (!ids.has(group.id)) return;
    Object.keys(patch).forEach((k) => {
      const key = k as keyof SparklineGroupOptions;
      const value = patch[key];
      if (key === "colors") {
        group.colors = { ...(group.colors ?? {}), ...(value as object) };
      } else if (value === undefined) {
        delete (group as any)[key];
      } else {
        (group as any)[key] = value;
      }
    });
  });
}

/** Ids of the groups with a sparkline in `ranges`. */
export function sparklineGroupIdsInRanges(
  ctx: Context,
  sheetId: string,
  ranges: Rect[] | undefined
) {
  const ids: string[] = [];
  sparklinesInRanges(ctx, sheetId, ranges).forEach(({ group }) => {
    if (ids.indexOf(group.id) < 0) ids.push(group.id);
  });
  return ids;
}

/**
 * Group: the sparklines in `ranges` become one group, taking the options of
 * the group of the active cell (or of the first selected sparkline).
 */
export function groupSparklines(
  ctx: Context,
  sheetId: string,
  ranges: Rect[] | undefined,
  active?: { r: number; c: number }
): SparklineGroup | null {
  const hits = sparklinesInRanges(ctx, sheetId, ranges);
  const sheet = sheetOf(ctx, sheetId);
  if (hits.length === 0 || !sheet) return null;
  const base =
    (active &&
      hits.find(
        (h) => h.sparkline.r === active.r && h.sparkline.c === active.c
      )) ||
    hits[0];
  const group: SparklineGroup = {
    ...copySparklineOptions(base.group),
    id: generateSparklineGroupId(),
    sparklines: hits.map((h) => ({ ...h.sparkline })),
  };
  removeAtCells(
    sheet,
    new Set(hits.map((h) => `${h.sparkline.r}_${h.sparkline.c}`))
  );
  sheet.sparklineGroups = [...(sheet.sparklineGroups ?? []), group];
  return group;
}

/** Ungroup: every group touching `ranges` becomes one group per sparkline. */
export function ungroupSparklines(
  ctx: Context,
  sheetId: string,
  ranges: Rect[] | undefined
) {
  const ids = new Set(sparklineGroupIdsInRanges(ctx, sheetId, ranges));
  const sheet = sheetOf(ctx, sheetId);
  if (ids.size === 0 || !sheet?.sparklineGroups) return 0;
  const next: SparklineGroup[] = [];
  let count = 0;
  sheet.sparklineGroups.forEach((group) => {
    if (!ids.has(group.id) || group.sparklines.length < 2) {
      next.push(group);
      return;
    }
    const options = copySparklineOptions(group);
    group.sparklines.forEach((s, i) => {
      count += 1;
      next.push({
        ...(i === 0 ? options : JSON.parse(JSON.stringify(options))),
        id: i === 0 ? group.id : generateSparklineGroupId(),
        sparklines: [{ ...s }],
      });
    });
  });
  sheet.sparklineGroups = next;
  return count;
}

/** Clear Selected Sparklines. Returns how many were removed. */
export function clearSparklines(
  ctx: Context,
  sheetId: string,
  ranges: Rect[] | undefined
) {
  const hits = sparklinesInRanges(ctx, sheetId, ranges);
  const sheet = sheetOf(ctx, sheetId);
  if (hits.length === 0 || !sheet) return 0;
  removeAtCells(
    sheet,
    new Set(hits.map((h) => `${h.sparkline.r}_${h.sparkline.c}`))
  );
  return hits.length;
}

/** Clear Selected Sparkline Groups. Returns how many groups were removed. */
export function clearSparklineGroups(
  ctx: Context,
  sheetId: string,
  ranges: Rect[] | undefined
) {
  const ids = new Set(sparklineGroupIdsInRanges(ctx, sheetId, ranges));
  const sheet = sheetOf(ctx, sheetId);
  if (ids.size === 0 || !sheet?.sparklineGroups) return 0;
  sheet.sparklineGroups = sheet.sparklineGroups.filter((g) => !ids.has(g.id));
  if (sheet.sparklineGroups.length === 0) delete sheet.sparklineGroups;
  return ids.size;
}

/* -------------------------------------------------------------------------- */
/*                             Structural changes                             */
/* -------------------------------------------------------------------------- */

/**
 * Reference adjuster (registered by modelSync.ts): data and date-axis
 * references are rewritten like formulas (deleted data becomes `#REF!`),
 * location cells move with their cells (deleted locations remove the
 * sparkline, cells moved to another sheet take their sparkline along).
 */
export function adjustSparklinesForChange(
  ctx: Context,
  change: ReferenceChange,
  api: Pick<ReferenceAdjusterApi, "rewriteFormula" | "locateRange">
) {
  const files = ctx.luckysheetfile || [];
  const moved: { sheetId: string; group: SparklineGroup }[] = [];
  files.forEach((sheet) => {
    const hostId = sheet.id;
    if (hostId == null || !sheet.sparklineGroups?.length) return;
    if (change.type === "deleteSheet" && hostId === change.sheetId) return;
    const locations =
      change.type !== "renameSheet" &&
      change.type !== "deleteSheet" &&
      change.sheetId === hostId;
    const groups: SparklineGroup[] = [];
    sheet.sparklineGroups.forEach((group) => {
      const kept: Sparkline[] = [];
      const away = new Map<string, Sparkline[]>();
      group.sparklines.forEach((s) => {
        const f = s.f ? api.rewriteFormula(s.f, hostId) : s.f;
        if (f !== s.f) s.f = f;
        if (!locations) {
          kept.push(s);
          return;
        }
        const loc = api.locateRange(
          { row: [s.r, s.r], column: [s.c, s.c] },
          hostId
        );
        if (!loc) return;
        const [r] = loc.range.row;
        const [c] = loc.range.column;
        if (r !== s.r) s.r = r;
        if (c !== s.c) s.c = c;
        if (loc.sheetId === hostId) kept.push(s);
        else away.set(loc.sheetId, [...(away.get(loc.sheetId) ?? []), s]);
      });
      if (group.dateAxis) {
        const d = api.rewriteFormula(group.dateAxis, hostId);
        if (d !== group.dateAxis) group.dateAxis = d;
      }
      away.forEach((list, sheetId) => {
        moved.push({
          sheetId,
          group: {
            ...copySparklineOptions(group),
            id: generateSparklineGroupId(),
            sparklines: list.map((s) => ({ ...s })),
          },
        });
      });
      if (kept.length === group.sparklines.length) groups.push(group);
      else if (kept.length > 0) {
        group.sparklines = kept;
        groups.push(group);
      }
    });
    if (groups.length !== sheet.sparklineGroups.length) {
      if (groups.length) sheet.sparklineGroups = groups;
      else delete sheet.sparklineGroups;
    }
  });
  moved.forEach(({ sheetId, group }) => {
    const sheet = sheetOf(ctx, sheetId);
    if (!sheet) return;
    // the moved cells overwrite the destination, sparklines included
    removeAtCells(sheet, new Set(group.sparklines.map((s) => `${s.r}_${s.c}`)));
    sheet.sparklineGroups = [...(sheet.sparklineGroups ?? []), group];
  });
}

/**
 * Sparklines of a duplicated sheet: new group ids, and data references go
 * through `rewrite` (references to the original sheet point at the copy).
 */
export function remapDuplicatedSparklines(
  groups: SparklineGroup[] | undefined,
  rewrite: (ref: string) => string
): SparklineGroup[] | undefined {
  if (!groups?.length) return groups;
  return groups.map((group) => ({
    ...group,
    id: generateSparklineGroupId(),
    ...(group.dateAxis ? { dateAxis: rewrite(group.dateAxis) } : {}),
    sparklines: group.sparklines.map((s) => ({
      ...s,
      f: s.f ? rewrite(s.f) : s.f,
    })),
  }));
}
