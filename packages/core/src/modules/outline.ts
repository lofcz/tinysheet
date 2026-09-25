/**
 * Outlines (Data › Group / Ungroup, Show / Hide Detail, Auto Outline, Clear
 * Outline and the outline settings), Excel style.
 *
 * Model (per sheet, in `sheet.config`):
 *
 * - `rowOutlineLevel` / `colOutlineLevel`: the outline level (1–7) of every
 *   grouped row / column. A group of level L is a maximal run of adjacent
 *   rows whose level is at least L, so levels nest like Excel's.
 * - `rowOutlineCollapsed` / `colOutlineCollapsed`: collapsed groups, keyed by
 *   the group's summary row (the row after the group, or the row before it
 *   when summaries sit above the detail), as a bit mask of levels.
 * - `outlineSummaryBelow` / `outlineSummaryRight`: where summaries sit.
 *
 * Collapsing hides the group's rows through the ordinary hidden-row
 * machinery (`config.rowhidden` / `colhidden`), so SUBTOTAL(10x), filters,
 * copying visible cells and the renderer need nothing special. Expanding
 * shows them again, except rows of nested groups that stay collapsed and
 * rows hidden by a filter.
 */
import type { Context } from "../context";
import type { SheetConfig } from "../types";
import { getSheetIndex } from "../utils";
import { outlineLocale } from "../locale/outline";
import { registerShortcut } from "./extensions";
import { getFormulaReferences, registerReferenceAdjuster } from "./refAdjust";
import { refreshFilterFormulas } from "./filter";

export { outlineLocale } from "../locale/outline";
export type { OutlineLocale } from "../locale/outline";

export type OutlineAxis = "row" | "column";

/** Deepest group level (Excel: 7 group levels, 8 level buttons). */
export const MAX_OUTLINE_LEVEL = 7;

export type OutlineGroup = {
  axis: OutlineAxis;
  /** 1 = outermost. */
  level: number;
  start: number;
  end: number;
  /** The summary row / column (may lie outside the sheet). */
  summary: number;
  collapsed: boolean;
};

type Levels = Record<string, number>;

const LEVEL_KEY = {
  row: "rowOutlineLevel",
  column: "colOutlineLevel",
} as const;
const COLLAPSED_KEY = {
  row: "rowOutlineCollapsed",
  column: "colOutlineCollapsed",
} as const;
const HIDDEN_KEY = { row: "rowhidden", column: "colhidden" } as const;

const bit = (level: number) => 1 << (level - 1);

/* -------------------------------------------------------------------------- */
/*                                  Reading                                   */
/* -------------------------------------------------------------------------- */

/** The config of a sheet as the UI sees it (the working copy when current). */
export function getOutlineConfig(
  ctx: Context,
  sheetId: string = ctx.currentSheetId
): SheetConfig | undefined {
  if (sheetId === ctx.currentSheetId && ctx.config) return ctx.config;
  const i = getSheetIndex(ctx, sheetId);
  return i == null ? undefined : ctx.luckysheetfile[i]?.config;
}

/** Whether summaries sit after (below / right of) their detail. */
export function isSummaryAfter(
  cfg: SheetConfig | undefined,
  axis: OutlineAxis
) {
  const v =
    axis === "row" ? cfg?.outlineSummaryBelow : cfg?.outlineSummaryRight;
  return v !== false;
}

/** Deepest outline level of an axis (0 when there is no outline). */
export function getOutlineMaxLevel(
  cfg: SheetConfig | undefined,
  axis: OutlineAxis
) {
  const levels = cfg?.[LEVEL_KEY[axis]];
  let max = 0;
  if (levels) {
    Object.keys(levels).forEach((k) => {
      const v = levels[k];
      if (v > max) max = v;
    });
  }
  return Math.min(max, MAX_OUTLINE_LEVEL);
}

/** Every outline group of an axis, outermost level first, in order. */
export function getOutlineGroups(
  cfg: SheetConfig | undefined,
  axis: OutlineAxis
): OutlineGroup[] {
  const levels = cfg?.[LEVEL_KEY[axis]];
  if (!levels) return [];
  const idx = Object.keys(levels)
    .map(Number)
    .filter((i) => levels[i] > 0 && Number.isInteger(i) && i >= 0)
    .sort((a, b) => a - b);
  if (idx.length === 0) return [];
  const max = getOutlineMaxLevel(cfg, axis);
  const after = isSummaryAfter(cfg, axis);
  const flags = cfg?.[COLLAPSED_KEY[axis]] || {};
  const groups: OutlineGroup[] = [];
  for (let L = 1; L <= max; L += 1) {
    let start = -1;
    let prev = -2;
    const close = () => {
      if (start >= 0) {
        const summary = after ? prev + 1 : start - 1;
        groups.push({
          axis,
          level: L,
          start,
          end: prev,
          summary,
          collapsed: ((flags[summary] ?? 0) & bit(L)) !== 0,
        });
      }
      start = -1;
    };
    for (let k = 0; k < idx.length; k += 1) {
      const i = idx[k];
      if (levels[i] >= L) {
        if (start >= 0 && i === prev + 1) prev = i;
        else {
          close();
          start = i;
          prev = i;
        }
      } else close();
    }
    close();
  }
  return groups;
}

/** Rows / columns hidden because a group containing them is collapsed. */
export function getCollapsedIndices(
  cfg: SheetConfig | undefined,
  axis: OutlineAxis
) {
  const set = new Set<number>();
  getOutlineGroups(cfg, axis).forEach((g) => {
    if (!g.collapsed) return;
    for (let i = g.start; i <= g.end; i += 1) set.add(i);
  });
  return set;
}

/** Rows hidden by an autofilter (they stay hidden when a group expands). */
function filteredIndices(ctx: Context, sheetId: string, axis: OutlineAxis) {
  const set = new Set<number>();
  if (axis !== "row") return set;
  const add = (filter: any) => {
    if (!filter) return;
    Object.keys(filter).forEach((k) => {
      Object.keys(filter[k]?.rowhidden || {}).forEach((r) => set.add(+r));
    });
  };
  const i = getSheetIndex(ctx, sheetId);
  if (i != null) add(ctx.luckysheetfile[i]?.filter);
  if (sheetId === ctx.currentSheetId) add(ctx.filter);
  return set;
}

/** Width / height (px) of the outline gutters of the current sheet. */
export const OUTLINE_LEVEL_SIZE = 16;

export function getOutlineGutterSize(ctx: Context) {
  const cfg = getOutlineConfig(ctx);
  const rows = getOutlineMaxLevel(cfg, "row");
  const cols = getOutlineMaxLevel(cfg, "column");
  return {
    /** Width of the gutter left of the row headers (0: none). */
    left: rows > 0 ? (rows + 1) * OUTLINE_LEVEL_SIZE + 4 : 0,
    /** Height of the gutter above the column headers (0: none). */
    top: cols > 0 ? (cols + 1) * OUTLINE_LEVEL_SIZE + 4 : 0,
    rowLevels: rows,
    colLevels: cols,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Writing                                   */
/* -------------------------------------------------------------------------- */

/**
 * Run `fn` on a sheet's config and store it back on the sheet (and the
 * context's working copy when the sheet is current), like the other
 * config writers do.
 */
function editConfig<T>(
  ctx: Context,
  sheetId: string,
  fn: (cfg: SheetConfig) => T
): T | undefined {
  const i = getSheetIndex(ctx, sheetId);
  if (i == null) return undefined;
  const file = ctx.luckysheetfile[i];
  const current = sheetId === ctx.currentSheetId;
  const cfg: SheetConfig = (current ? ctx.config : file.config) ?? {};
  const res = fn(cfg);
  file.config = cfg;
  if (current) ctx.config = cfg;
  return res;
}

function setMap(
  cfg: SheetConfig,
  key: keyof SheetConfig,
  map: Record<string, number>
) {
  if (Object.keys(map).length === 0) delete cfg[key];
  else (cfg as any)[key] = map;
}

/** Keep the collapsed flags of groups that still exist after a change. */
function normalizeFlags(
  cfg: SheetConfig,
  axis: OutlineAxis,
  oldFlags: Record<string, number>
) {
  const flags: Record<string, number> = {};
  const saved = cfg[COLLAPSED_KEY[axis]];
  cfg[COLLAPSED_KEY[axis]] = oldFlags;
  getOutlineGroups(cfg, axis).forEach((g) => {
    if (g.collapsed) flags[g.summary] = (flags[g.summary] ?? 0) | bit(g.level);
  });
  cfg[COLLAPSED_KEY[axis]] = saved;
  setMap(cfg, COLLAPSED_KEY[axis], flags);
}

/** Show `indices` again unless still collapsed or filtered out. */
function unhide(
  ctx: Context,
  sheetId: string,
  cfg: SheetConfig,
  axis: OutlineAxis,
  indices: Iterable<number>
) {
  const hidden = cfg[HIDDEN_KEY[axis]];
  if (!hidden) return;
  const collapsed = getCollapsedIndices(cfg, axis);
  const filtered = filteredIndices(ctx, sheetId, axis);
  let changed = false;
  const next = { ...hidden };
  // eslint-disable-next-line no-restricted-syntax
  for (const i of indices) {
    if (i in next && !collapsed.has(i) && !filtered.has(i)) {
      delete next[i];
      changed = true;
    }
  }
  if (changed) cfg[HIDDEN_KEY[axis]] = next;
}

function hide(cfg: SheetConfig, axis: OutlineAxis, from: number, to: number) {
  const next = { ...(cfg[HIDDEN_KEY[axis]] || {}) };
  for (let i = from; i <= to; i += 1) next[i] = 0;
  cfg[HIDDEN_KEY[axis]] = next;
}

/** Recalculate SUBTOTAL(10x) & co. after rows were shown or hidden. */
function afterVisibilityChange(ctx: Context, sheetId: string) {
  if (sheetId === ctx.currentSheetId) refreshFilterFormulas(ctx);
}

/**
 * Change the outline levels of an axis through `fn`, keeping the collapsed
 * flags of surviving groups and showing rows that no collapsed group hides
 * any more.
 */
function changeLevels(
  ctx: Context,
  sheetId: string,
  axis: OutlineAxis,
  fn: (levels: Levels, cfg: SheetConfig) => void
) {
  editConfig(ctx, sheetId, (cfg) => {
    const before = getCollapsedIndices(cfg, axis);
    const oldFlags = { ...(cfg[COLLAPSED_KEY[axis]] || {}) };
    const levels: Levels = { ...(cfg[LEVEL_KEY[axis]] || {}) };
    fn(levels, cfg);
    Object.keys(levels).forEach((k) => {
      if (!(levels[k] > 0)) delete levels[k];
    });
    setMap(cfg, LEVEL_KEY[axis], levels);
    normalizeFlags(cfg, axis, oldFlags);
    const after = getCollapsedIndices(cfg, axis);
    const gone = [...before].filter((i) => !after.has(i));
    if (gone.length > 0) unhide(ctx, sheetId, cfg, axis, gone);
  });
  afterVisibilityChange(ctx, sheetId);
}

export type OutlineResult = { ok: true } | { ok: false; error: string };

/** Group rows / columns `start..end` one level deeper (Data › Group). */
export function groupOutline(
  ctx: Context,
  axis: OutlineAxis,
  start: number,
  end: number,
  sheetId: string = ctx.currentSheetId
): OutlineResult {
  const cfg = getOutlineConfig(ctx, sheetId);
  const levels = cfg?.[LEVEL_KEY[axis]] || {};
  for (let i = start; i <= end; i += 1) {
    if ((levels[i] ?? 0) >= MAX_OUTLINE_LEVEL) {
      return { ok: false, error: "maxLevel" };
    }
  }
  changeLevels(ctx, sheetId, axis, (next) => {
    for (let i = start; i <= end; i += 1) next[i] = (next[i] ?? 0) + 1;
  });
  return { ok: true };
}

/** Remove one outline level from rows / columns `start..end` (Ungroup). */
export function ungroupOutline(
  ctx: Context,
  axis: OutlineAxis,
  start: number,
  end: number,
  sheetId: string = ctx.currentSheetId
): OutlineResult {
  const cfg = getOutlineConfig(ctx, sheetId);
  const levels = cfg?.[LEVEL_KEY[axis]] || {};
  let any = false;
  for (let i = start; i <= end && !any; i += 1) any = (levels[i] ?? 0) > 0;
  if (!any) return { ok: false, error: "notGrouped" };
  changeLevels(ctx, sheetId, axis, (next) => {
    for (let i = start; i <= end; i += 1) {
      if ((next[i] ?? 0) > 0) next[i] -= 1;
    }
  });
  return { ok: true };
}

/**
 * Remove the outline (Clear Outline): of the whole sheet, or of the given
 * rows and columns only. Rows hidden by collapsed groups are shown again.
 */
export function clearOutline(
  ctx: Context,
  range?: { row?: number[]; column?: number[] },
  sheetId: string = ctx.currentSheetId
) {
  (["row", "column"] as const).forEach((axis) => {
    const span = range?.[axis];
    changeLevels(ctx, sheetId, axis, (levels) => {
      Object.keys(levels).forEach((k) => {
        const i = Number(k);
        if (!span || (i >= span[0] && i <= span[1])) delete levels[k];
      });
    });
  });
}

function findGroup(
  cfg: SheetConfig | undefined,
  axis: OutlineAxis,
  level: number,
  start: number
) {
  return getOutlineGroups(cfg, axis).find(
    (g) => g.level === level && g.start === start
  );
}

/** Collapse or expand one group (the gutter's +/− buttons). */
export function setOutlineGroupCollapsed(
  ctx: Context,
  axis: OutlineAxis,
  group: { level: number; start: number },
  collapsed: boolean,
  sheetId: string = ctx.currentSheetId
) {
  const done = editConfig(ctx, sheetId, (cfg) => {
    const g = findGroup(cfg, axis, group.level, group.start);
    if (!g || g.collapsed === collapsed) return false;
    const flags = { ...(cfg[COLLAPSED_KEY[axis]] || {}) };
    flags[g.summary] = (flags[g.summary] ?? 0) ^ bit(g.level);
    if (!flags[g.summary]) delete flags[g.summary];
    setMap(cfg, COLLAPSED_KEY[axis], flags);
    if (collapsed) hide(cfg, axis, g.start, g.end);
    else {
      const range: number[] = [];
      for (let i = g.start; i <= g.end; i += 1) range.push(i);
      unhide(ctx, sheetId, cfg, axis, range);
    }
    return true;
  });
  if (done) afterVisibilityChange(ctx, sheetId);
  return !!done;
}

/**
 * Show outline level `n` (the gutter's level buttons): groups of level n
 * and deeper collapse, shallower ones expand. `n` above the deepest level
 * expands everything.
 */
export function showOutlineLevel(
  ctx: Context,
  axis: OutlineAxis,
  n: number,
  sheetId: string = ctx.currentSheetId
) {
  editConfig(ctx, sheetId, (cfg) => {
    const flags: Record<string, number> = {};
    getOutlineGroups(cfg, axis).forEach((g) => {
      if (g.level >= n)
        flags[g.summary] = (flags[g.summary] ?? 0) | bit(g.level);
    });
    setMap(cfg, COLLAPSED_KEY[axis], flags);
    const levels = cfg[LEVEL_KEY[axis]] || {};
    const filtered = filteredIndices(ctx, sheetId, axis);
    const next = { ...(cfg[HIDDEN_KEY[axis]] || {}) };
    Object.keys(levels).forEach((k) => {
      if (levels[k] >= n) next[k] = 0;
      else if (!filtered.has(Number(k))) delete next[k];
    });
    cfg[HIDDEN_KEY[axis]] = next;
  });
  afterVisibilityChange(ctx, sheetId);
}

/* -------------------------------------------------------------------------- */
/*                           Selection-based commands                         */
/* -------------------------------------------------------------------------- */

/** "row" / "column" when the selection is whole rows / columns, else null. */
export function selectionOutlineAxis(ctx: Context): OutlineAxis | null {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return null;
  const i = getSheetIndex(ctx, ctx.currentSheetId);
  const data = i == null ? null : ctx.luckysheetfile[i]?.data;
  const rows = data?.length ?? 0;
  const cols = data?.[0]?.length ?? 0;
  const wholeRows =
    sel.row_select || (sel.column[0] === 0 && sel.column[1] >= cols - 1);
  const wholeCols =
    sel.column_select || (sel.row[0] === 0 && sel.row[1] >= rows - 1);
  if (wholeRows && !wholeCols) return "row";
  if (wholeCols && !wholeRows) return "column";
  if (wholeRows && wholeCols) return "row";
  return null;
}

function selectionSpan(ctx: Context, axis: OutlineAxis): [number, number] {
  const sel =
    ctx.luckysheet_select_save![ctx.luckysheet_select_save!.length - 1];
  const span = axis === "row" ? sel.row : sel.column;
  return [Math.min(span[0], span[1]), Math.max(span[0], span[1])];
}

function reportError(ctx: Context, error: string) {
  const t = outlineLocale(ctx).errors as Record<string, string>;
  ctx.warnDialog = t[error] ?? error;
}

/**
 * Data › Group / Ungroup for the selection. Without `axis`, whole rows or
 * columns decide; for any other range the UI is asked (`ctx.outlinePrompt`).
 * Returns false when nothing was done.
 */
export function groupSelection(
  ctx: Context,
  ungroup = false,
  axis: OutlineAxis | null = selectionOutlineAxis(ctx)
) {
  if (!ctx.luckysheet_select_save?.length || ctx.allowEdit === false) {
    return false;
  }
  if (!axis) {
    ctx.outlinePrompt = ungroup ? "ungroup" : "group";
    return true;
  }
  const [a, b] = selectionSpan(ctx, axis);
  const res = ungroup
    ? ungroupOutline(ctx, axis, a, b)
    : groupOutline(ctx, axis, a, b);
  if (!res.ok) reportError(ctx, res.error);
  return res.ok;
}

/** The group Show / Hide Detail acts on for the active cell. */
function detailGroup(ctx: Context, show: boolean): OutlineGroup | null {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return null;
  const cfg = getOutlineConfig(ctx);
  const axes: OutlineAxis[] =
    selectionOutlineAxis(ctx) === "column"
      ? ["column", "row"]
      : ["row", "column"];
  for (let k = 0; k < axes.length; k += 1) {
    const axis = axes[k];
    const at =
      axis === "row"
        ? sel.row_focus ?? sel.row[0]
        : sel.column_focus ?? sel.column[0];
    const groups = getOutlineGroups(cfg, axis);
    if (show) {
      // the outermost collapsed group summarised by (or containing) the cell
      const hit =
        groups.find((g) => g.collapsed && g.summary === at) ??
        [...groups]
          .reverse()
          .find((g) => g.collapsed && at >= g.start && at <= g.end);
      if (hit) return hit;
    } else {
      // the innermost expanded group containing (or summarised by) the cell
      const hit = [...groups]
        .reverse()
        .find(
          (g) =>
            !g.collapsed && ((at >= g.start && at <= g.end) || g.summary === at)
        );
      if (hit) return hit;
    }
  }
  return null;
}

/** Data › Show Detail / Hide Detail for the active cell. */
export function showHideDetail(ctx: Context, show: boolean) {
  const g = detailGroup(ctx, show);
  if (!g) {
    reportError(ctx, "noDetail");
    return false;
  }
  return setOutlineGroupCollapsed(ctx, g.axis, g, !show);
}

/* -------------------------------------------------------------------------- */
/*                                Auto Outline                                */
/* -------------------------------------------------------------------------- */

type Candidate = { start: number; end: number; after: boolean };

/** Levels from nested candidate ranges (partial overlaps are skipped). */
function levelsFromCandidates(candidates: Candidate[]): Levels {
  const sorted = [...candidates].sort(
    (x, y) => y.end - y.start - (x.end - x.start) || x.start - y.start
  );
  const accepted: Candidate[] = [];
  sorted.forEach((c) => {
    const ok = accepted.every(
      (a) =>
        c.end < a.start ||
        c.start > a.end ||
        (c.start >= a.start && c.end <= a.end) ||
        (a.start >= c.start && a.end <= c.end)
    );
    if (ok) accepted.push(c);
  });
  const levels: Levels = {};
  accepted.forEach((c) => {
    for (let i = c.start; i <= c.end; i += 1) {
      levels[i] = Math.min((levels[i] ?? 0) + 1, MAX_OUTLINE_LEVEL);
    }
  });
  return levels;
}

/**
 * Data › Auto Outline: build row and column groups from the summary
 * formulas of the sheet (SUM, SUBTOTAL, ... over the rows directly above /
 * below, or the columns directly left / right, of the formula). Replaces the
 * existing outline. Returns false (and reports) when nothing was found.
 */
export function autoOutline(
  ctx: Context,
  sheetId: string = ctx.currentSheetId
) {
  const i = getSheetIndex(ctx, sheetId);
  const data = i == null ? null : ctx.luckysheetfile[i]?.data;
  if (!data) return false;
  const sheetName = ctx.luckysheetfile[i!].name?.toLowerCase();
  const found: Record<OutlineAxis, Map<string, Candidate>> = {
    row: new Map(),
    column: new Map(),
  };
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    for (let c = 0; row && c < row.length; c += 1) {
      const f = row[c]?.f;
      if (typeof f === "string" && f.length > 1) {
        getFormulaReferences(f).forEach((ref) => {
          if (ref.sheet && ref.sheet.toLowerCase() !== sheetName) return;
          if (ref.kind !== "range") return;
          const add = (
            axis: OutlineAxis,
            s: number,
            e: number,
            after: boolean
          ) =>
            found[axis].set(`${s}:${e}:${after}`, { start: s, end: e, after });
          if (ref.c1 === c && ref.c2 === c && ref.r2 > ref.r1) {
            if (ref.r2 === r - 1) add("row", ref.r1, ref.r2, true);
            else if (ref.r1 === r + 1) add("row", ref.r1, ref.r2, false);
          } else if (ref.r1 === r && ref.r2 === r && ref.c2 > ref.c1) {
            if (ref.c2 === c - 1) add("column", ref.c1, ref.c2, true);
            else if (ref.c1 === c + 1) add("column", ref.c1, ref.c2, false);
          }
        });
      }
    }
  }
  if (found.row.size === 0 && found.column.size === 0) {
    reportError(ctx, "noAutoOutline");
    return false;
  }
  (["row", "column"] as const).forEach((axis) => {
    const list = [...found[axis].values()];
    if (list.length === 0) return;
    // summaries go one way per axis: the majority wins (ties: after)
    const afterCount = list.filter((c) => c.after).length;
    const after = afterCount * 2 >= list.length;
    const levels = levelsFromCandidates(list.filter((c) => c.after === after));
    editConfig(ctx, sheetId, (cfg) => {
      if (axis === "row") {
        if (after) delete cfg.outlineSummaryBelow;
        else cfg.outlineSummaryBelow = false;
      } else if (after) delete cfg.outlineSummaryRight;
      else cfg.outlineSummaryRight = false;
    });
    changeLevels(ctx, sheetId, axis, (next) => {
      Object.keys(next).forEach((k) => delete next[k]);
      Object.assign(next, levels);
    });
  });
  return true;
}

/* -------------------------------------------------------------------------- */
/*                                  Settings                                  */
/* -------------------------------------------------------------------------- */

/**
 * Outline settings: summary rows below / columns right of their detail.
 * Collapsed groups stay collapsed (their flags move to the new summary).
 */
export function setOutlineSettings(
  ctx: Context,
  settings: { summaryBelow?: boolean; summaryRight?: boolean },
  sheetId: string = ctx.currentSheetId
) {
  editConfig(ctx, sheetId, (cfg) => {
    (["row", "column"] as const).forEach((axis) => {
      const want =
        axis === "row" ? settings.summaryBelow : settings.summaryRight;
      if (want == null || want === isSummaryAfter(cfg, axis)) return;
      const collapsed = getOutlineGroups(cfg, axis).filter((g) => g.collapsed);
      const key =
        axis === "row" ? "outlineSummaryBelow" : "outlineSummaryRight";
      if (want) delete cfg[key];
      else cfg[key] = false;
      const flags: Record<string, number> = {};
      collapsed.forEach((g) => {
        const s = want ? g.end + 1 : g.start - 1;
        flags[s] = (flags[s] ?? 0) | bit(g.level);
      });
      setMap(cfg, COLLAPSED_KEY[axis], flags);
    });
  });
}

/* -------------------------------------------------------------------------- */
/*                   Structural changes and keyboard shortcuts                */
/* -------------------------------------------------------------------------- */

function shiftMap(
  map: Record<string, number> | undefined,
  change:
    | { type: "insert"; index: number; count: number }
    | { type: "delete"; start: number; end: number },
  fillLevel: boolean
) {
  if (!map) return undefined;
  const out: Record<string, number> = {};
  Object.keys(map).forEach((k) => {
    const i = Number(k);
    if (change.type === "insert") {
      out[i >= change.index ? i + change.count : i] = map[k];
    } else if (i < change.start) out[i] = map[k];
    else if (i > change.end) out[i - (change.end - change.start + 1)] = map[k];
  });
  if (fillLevel && change.type === "insert") {
    // rows inserted inside a group join it (Excel copies the row format)
    const level = Math.min(map[change.index - 1] ?? 0, map[change.index] ?? 0);
    if (level > 0) {
      for (let n = 0; n < change.count; n += 1) out[change.index + n] = level;
    }
  }
  return out;
}

registerReferenceAdjuster("outline", (ctx, change) => {
  if (change.type !== "insert" && change.type !== "delete") return;
  const file = ctx.luckysheetfile.find((f) => f.id === change.sheetId);
  const cfg = file?.config;
  if (!cfg) return;
  const { axis } = change;
  const op =
    change.type === "insert"
      ? { type: "insert" as const, index: change.index, count: change.count }
      : { type: "delete" as const, start: change.start, end: change.end };
  const levelKey = LEVEL_KEY[axis];
  const flagKey = COLLAPSED_KEY[axis];
  if (cfg[levelKey]) cfg[levelKey] = shiftMap(cfg[levelKey], op, true);
  if (cfg[flagKey]) cfg[flagKey] = shiftMap(cfg[flagKey], op, false);
  if (axis === "row" && cfg.rowPageBreaks?.length) {
    const map: Record<string, number> = {};
    cfg.rowPageBreaks.forEach((r) => {
      map[r] = 1;
    });
    const next = Object.keys(shiftMap(map, op, false) || {})
      .map(Number)
      .sort((a, b) => a - b);
    if (next.length) cfg.rowPageBreaks = next;
    else delete cfg.rowPageBreaks;
  }
});

registerShortcut("outline.group", {
  key: "ArrowRight",
  shift: true,
  alt: true,
  handler: (ctx) => {
    groupSelection(ctx, false);
  },
});

registerShortcut("outline.ungroup", {
  key: "ArrowLeft",
  shift: true,
  alt: true,
  handler: (ctx) => {
    groupSelection(ctx, true);
  },
});
