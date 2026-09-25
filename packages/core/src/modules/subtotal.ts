/**
 * Data › Subtotal (Excel): insert a SUBTOTAL row after (or before) every
 * group of equal values in a column, plus a grand total row, and outline
 * the list; Remove All takes them out again. Rows are inserted through
 * insertRowCol / deleteRowCol, so references, merges, formats, filters and
 * the outline itself follow the change.
 */
import _ from "lodash";
import { current, isDraft } from "immer";
import type { Context } from "../context";
import type { Cell, CellMatrix, SheetConfig } from "../types";
import { getSheetIndex } from "../utils";
import { formatLocaleText } from "../locale/dataTools";
import { outlineLocale } from "../locale/outline";
import { deleteRowCol, insertRowCol } from "./rowcol";
import { execfunction } from "./formula";
import { update } from "./format";
import { cellText, getSortRegion } from "./sort";
import { indexToColumn } from "./refAdjust";
import { MAX_OUTLINE_LEVEL, getCollapsedIndices } from "./outline";
import { refreshFilterFormulas } from "./filter";

export type SubtotalFunction =
  | "sum"
  | "count"
  | "average"
  | "max"
  | "min"
  | "product"
  | "countNums"
  | "stdDev"
  | "stdDevp"
  | "var"
  | "varp";

/** SUBTOTAL function numbers of the Subtotal dialog's functions. */
export const SUBTOTAL_FUNCTION_CODES: Record<SubtotalFunction, number> = {
  average: 1,
  countNums: 2,
  count: 3,
  max: 4,
  min: 5,
  product: 6,
  stdDev: 7,
  stdDevp: 8,
  sum: 9,
  var: 10,
  varp: 11,
};

/** The functions in the dialog's order. */
export const SUBTOTAL_FUNCTIONS: SubtotalFunction[] = [
  "sum",
  "count",
  "average",
  "max",
  "min",
  "product",
  "countNums",
  "stdDev",
  "stdDevp",
  "var",
  "varp",
];

export type SubtotalRange = { row: [number, number]; column: [number, number] };

export type SubtotalOptions = {
  /** The list, header row first. */
  range: SubtotalRange;
  /** "At each change in" column (sheet column index). */
  groupBy: number;
  fn: SubtotalFunction;
  /** "Add subtotal to" columns (sheet column indexes). */
  columns: number[];
  /** Replace the current subtotals (default true); false nests new ones. */
  replace?: boolean;
  /** Record a page break before each group but the first. */
  pageBreaks?: boolean;
  /** Summary rows below the data (default true). */
  summaryBelow?: boolean;
};

export type SubtotalResult =
  | { ok: true; range: SubtotalRange }
  | {
      ok: false;
      error: "noData" | "noColumns" | "tooManyLevels" | "tooManyRows";
    };

const SUBTOTAL_RE = /(^|[^A-Za-z0-9_.])SUBTOTAL\s*\(/i;

function sheetData(ctx: Context, sheetId: string) {
  const i = getSheetIndex(ctx, sheetId);
  return i == null ? null : ctx.luckysheetfile[i];
}

function configOf(ctx: Context, sheetId: string): SheetConfig {
  const file = sheetData(ctx, sheetId);
  if (sheetId === ctx.currentSheetId && ctx.config) return ctx.config;
  return file?.config ?? {};
}

function storeConfig(ctx: Context, sheetId: string, cfg: SheetConfig) {
  const file = sheetData(ctx, sheetId);
  if (!file) return;
  file.config = cfg;
  if (sheetId === ctx.currentSheetId) ctx.config = cfg;
}

/**
 * Run `fn` on a plain (non-immer) copy of the workbook and write back the
 * sheets it changed. Subtotals insert or delete a row per group; on immer
 * drafts every one of those structural edits walks the sheet through
 * proxies (minutes for a few hundred groups), on plain objects it takes
 * milliseconds. The result is still a single undo step.
 */
function onPlainCopy<T>(ctx: Context, fn: (work: Context) => T): T {
  if (!isDraft(ctx)) return fn(ctx);
  const base = current(ctx) as Context;
  const files = _.cloneDeep(base.luckysheetfile);
  const work: Context = {
    ...base,
    luckysheetfile: files,
    groupValuesRefreshData: _.cloneDeep(base.groupValuesRefreshData ?? []),
    luckysheet_select_save: _.cloneDeep(base.luckysheet_select_save),
    filter: _.cloneDeep(base.filter),
  };
  const idx = getSheetIndex(work, work.currentSheetId);
  if (idx != null) {
    // the context's working copy of the current sheet's config
    const cfg = _.cloneDeep(base.config ?? files[idx].config ?? {});
    files[idx].config = cfg;
    work.config = cfg;
  }
  const result = fn(work);
  files.forEach((file, i) => {
    if (!_.isEqual(file, base.luckysheetfile[i])) ctx.luckysheetfile[i] = file;
  });
  if (idx != null && !_.isEqual(work.config, base.config)) {
    ctx.config = ctx.luckysheetfile[idx].config!;
  }
  if (!_.isEqual(work.groupValuesRefreshData, base.groupValuesRefreshData)) {
    ctx.groupValuesRefreshData = work.groupValuesRefreshData;
  }
  if (!_.isEqual(work.luckysheet_select_save, base.luckysheet_select_save)) {
    ctx.luckysheet_select_save = work.luckysheet_select_save;
  }
  if (!_.isEqual(work.filter, base.filter)) ctx.filter = work.filter;
  return result;
}

/**
 * The list the Subtotal dialog works on: the selection when it spans
 * several cells, else the current region around the active cell.
 */
export function getSubtotalRange(ctx: Context): SubtotalRange | null {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  const data = sheetData(ctx, ctx.currentSheetId)?.data;
  if (!sel || !data) return null;
  let range: SubtotalRange;
  if (sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1]) {
    const region = getSortRegion(data, sel.row[0], sel.column[0]);
    range = {
      row: [region.row[0], region.row[1]],
      column: [region.column[0], region.column[1]],
    };
  } else {
    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    range = {
      row: [Math.max(0, sel.row[0]), Math.min(rows - 1, sel.row[1])],
      column: [Math.max(0, sel.column[0]), Math.min(cols - 1, sel.column[1])],
    };
    // whole columns / rows: trim to the used part
    let last = range.row[0];
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        if (cellText(data[r]?.[c]) !== "" || data[r]?.[c]?.f) {
          last = r;
          break;
        }
      }
    }
    range.row[1] = last;
  }
  if (range.row[1] - range.row[0] < 1) return null;
  return range;
}

/** Rows of `range` (below its header) holding a SUBTOTAL formula. */
export function findSubtotalRows(
  data: CellMatrix,
  range: SubtotalRange
): number[] {
  const rows: number[] = [];
  for (let r = range.row[0] + 1; r <= range.row[1]; r += 1) {
    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      const f = data[r]?.[c]?.f;
      if (typeof f === "string" && SUBTOTAL_RE.test(f)) {
        rows.push(r);
        break;
      }
    }
  }
  return rows;
}

/** Delete rows (sorted ascending) bottom-up, in consecutive blocks. */
function deleteRows(ctx: Context, sheetId: string, rows: number[]) {
  for (let k = rows.length - 1; k >= 0; ) {
    const end = rows[k];
    let start = end;
    while (k - 1 >= 0 && rows[k - 1] === start - 1) {
      k -= 1;
      start -= 1;
    }
    k -= 1;
    deleteRowCol(ctx, { type: "row", start, end, id: sheetId });
  }
}

/** Forget the outline, collapsed state and page breaks of `from..to`. */
function clearRowOutline(
  ctx: Context,
  sheetId: string,
  from: number,
  to: number
) {
  const cfg = configOf(ctx, sheetId);
  const collapsed = getCollapsedIndices(cfg, "row");
  const drop = (map: Record<string, number> | undefined, last: number) => {
    if (!map) return undefined;
    const next = { ...map };
    Object.keys(next).forEach((k) => {
      if (+k >= from && +k <= last) delete next[k];
    });
    return Object.keys(next).length ? next : undefined;
  };
  const next: SheetConfig = { ...cfg };
  next.rowOutlineLevel = drop(cfg.rowOutlineLevel, to);
  // collapsed flags sit on summary rows, which may follow the list
  next.rowOutlineCollapsed = drop(cfg.rowOutlineCollapsed, to + 1);
  if (!next.rowOutlineLevel) delete next.rowOutlineLevel;
  if (!next.rowOutlineCollapsed) delete next.rowOutlineCollapsed;
  if (cfg.rowhidden) {
    const hidden = { ...cfg.rowhidden };
    collapsed.forEach((r) => {
      if (r >= from && r <= to) delete hidden[r];
    });
    next.rowhidden = hidden;
  }
  if (cfg.rowPageBreaks) {
    const breaks = cfg.rowPageBreaks.filter((r) => r < from || r > to);
    if (breaks.length) next.rowPageBreaks = breaks;
    else delete next.rowPageBreaks;
  }
  storeConfig(ctx, sheetId, next);
}

function removeSubtotalRows(
  ctx: Context,
  range: SubtotalRange,
  sheetId: string
): SubtotalRange {
  const data = sheetData(ctx, sheetId)?.data;
  if (!data) return range;
  const selection = ctx.luckysheet_select_save;
  const rows = findSubtotalRows(data, range);
  // outline first (collapsed groups show their rows), then the rows
  clearRowOutline(ctx, sheetId, range.row[0], range.row[1]);
  deleteRows(ctx, sheetId, rows);
  const next: SubtotalRange = {
    row: [range.row[0], range.row[1] - rows.length],
    column: [range.column[0], range.column[1]],
  };
  if (sheetId === ctx.currentSheetId) {
    ctx.luckysheet_select_save = selection ?? [
      { row: next.row, column: next.column },
    ];
    refreshFilterFormulas(ctx);
  }
  return next;
}

function setText(data: CellMatrix, r: number, c: number, text: string) {
  const cell: Cell = { ...(data[r]?.[c] ?? {}) };
  delete cell.f;
  cell.v = text;
  cell.m = text;
  cell.ct = { fa: "General", t: "g" };
  cell.bl = 1;
  data[r][c] = cell;
}

function setFormula(
  ctx: Context,
  sheetId: string,
  data: CellMatrix,
  r: number,
  c: number,
  f: string
) {
  const cell: Cell = { ...(data[r]?.[c] ?? {}) };
  cell.f = f;
  delete cell.v;
  delete cell.m;
  data[r][c] = cell;
  const res = execfunction(ctx, f, r, c, sheetId);
  const v = res[1];
  const next: Cell = { ...data[r][c], f: res[2] as string };
  if (v == null || v === "") {
    delete next.v;
    delete next.m;
  } else {
    next.v = v as any;
    if (typeof v === "number") {
      const fa = next.ct?.fa && next.ct.fa !== "@" ? next.ct.fa : "General";
      next.ct = { fa, t: "n" };
      next.m = update(fa, v);
    } else {
      next.ct = { fa: "General", t: typeof v === "boolean" ? "b" : "g" };
      next.m = String(v);
    }
  }
  data[r][c] = next;
}

type SubGroup = {
  start: number;
  end: number;
  key: string;
  label: string;
  /** Outline level of the new subtotal row. */
  level: number;
};

function addSubtotals(
  ctx: Context,
  options: SubtotalOptions,
  sheetId: string
): SubtotalResult {
  const file = sheetData(ctx, sheetId);
  if (!file?.data) return { ok: false, error: "noData" };
  const columns = [...new Set(options.columns)]
    .filter((c) => c >= options.range.column[0] && c <= options.range.column[1])
    .sort((a, b) => a - b);
  if (columns.length === 0) return { ok: false, error: "noColumns" };
  const below = options.summaryBelow !== false;
  const replace = options.replace !== false;
  const code = SUBTOTAL_FUNCTION_CODES[options.fn] ?? 9;
  const t = outlineLocale(ctx).subtotal;
  const word = t.labels[options.fn] ?? t.labels.sum;
  const selection = ctx.luckysheet_select_save;

  let range: SubtotalRange = {
    row: [options.range.row[0], options.range.row[1]],
    column: [options.range.column[0], options.range.column[1]],
  };
  const existing = findSubtotalRows(file.data, range);
  const nest = !replace && existing.length > 0;
  if (!nest && existing.length > 0) {
    range = removeSubtotalRows(ctx, range, sheetId);
  }

  const header = range.row[0];
  if (range.row[1] <= header) return { ok: false, error: "noData" };

  // segments of detail rows: the whole list, or (nesting) the runs between
  // the existing subtotal rows
  const cfg0 = configOf(ctx, sheetId);
  const levels0 = cfg0.rowOutlineLevel || {};
  const segments: { start: number; end: number; level: number }[] = [];
  if (nest) {
    const skip = new Set(existing);
    let start = -1;
    for (let r = header + 1; r <= range.row[1] + 1; r += 1) {
      const detail = r <= range.row[1] && !skip.has(r);
      if (detail && start < 0) start = r;
      if (!detail && start >= 0) {
        segments.push({
          start,
          end: r - 1,
          level: Math.max(1, levels0[start] ?? 1),
        });
        start = -1;
      }
    }
  } else {
    segments.push({ start: header + 1, end: range.row[1], level: 1 });
  }
  if (segments.some((s) => s.level + 1 > MAX_OUTLINE_LEVEL)) {
    return { ok: false, error: "tooManyLevels" };
  }

  // groups of equal keys inside every segment
  const { data: data0 } = file;
  const groups: SubGroup[] = [];
  segments.forEach((seg) => {
    let { start } = seg;
    const keyOf = (r: number) =>
      cellText(data0[r]?.[options.groupBy]).toLowerCase();
    for (let r = seg.start + 1; r <= seg.end + 1; r += 1) {
      if (r > seg.end || keyOf(r) !== keyOf(start)) {
        const cell = data0[start]?.[options.groupBy];
        const shown = cell?.m ?? cellText(cell);
        groups.push({
          start,
          end: r - 1,
          key: keyOf(start),
          label: formatLocaleText(t.groupLabel, {
            value: `${shown ?? ""}`,
            label: word,
          }).trim(),
          level: seg.level,
        });
        start = r;
      }
    }
  });
  const addGrand = !nest;
  const inserted = groups.length + (addGrand ? 1 : 0);
  if (file.data.length + inserted >= 10000) {
    return { ok: false, error: "tooManyRows" };
  }

  // insert the rows bottom-up, so the original row numbers stay valid
  const dataStart = header + 1;
  const dataEnd = range.row[1];
  // one new row that becomes row `index` (after row index - 1: that also
  // works past the last row)
  const insertAt = (index: number) =>
    insertRowCol(
      ctx,
      index > 0
        ? {
            type: "row",
            index: index - 1,
            count: 1,
            direction: "rightbottom",
            id: sheetId,
          }
        : { type: "row", index, count: 1, direction: "lefttop", id: sheetId },
      false
    );
  if (below) {
    if (addGrand) insertAt(dataEnd + 1);
    for (let k = groups.length - 1; k >= 0; k -= 1) insertAt(groups[k].end + 1);
  } else {
    for (let k = groups.length - 1; k >= 0; k -= 1) insertAt(groups[k].start);
    if (addGrand) insertAt(dataStart);
  }

  // final positions
  const placed: (SubGroup & { row: number })[] = [];
  let offset = !below && addGrand ? 1 : 0;
  groups.forEach((g) => {
    if (below) {
      placed.push({
        ...g,
        start: g.start + offset,
        end: g.end + offset,
        row: g.end + offset + 1,
      });
      offset += 1;
    } else {
      const row = g.start + offset;
      offset += 1;
      placed.push({ ...g, start: g.start + offset, end: g.end + offset, row });
    }
  });
  const lastRow = dataEnd + inserted;
  const grandRow = below ? lastRow : dataStart;

  // labels and formulas
  const data = sheetData(ctx, sheetId)!.data!;
  const labelCol = columns.includes(options.groupBy)
    ? [...Array(range.column[1] - range.column[0] + 1).keys()]
        .map((k) => range.column[0] + k)
        .find((c) => !columns.includes(c))
    : options.groupBy;
  const formula = (c: number, from: number, to: number) => {
    const col = indexToColumn(c);
    return `=SUBTOTAL(${code},${col}${from + 1}:${col}${to + 1})`;
  };
  placed.forEach((g) => {
    if (labelCol != null) setText(data, g.row, labelCol, g.label);
    columns.forEach((c) =>
      setFormula(ctx, sheetId, data, g.row, c, formula(c, g.start, g.end))
    );
  });
  if (addGrand) {
    const from = below ? dataStart : dataStart + 1;
    const to = below ? lastRow - 1 : lastRow;
    if (labelCol != null) {
      setText(
        data,
        grandRow,
        labelCol,
        formatLocaleText(t.grandLabel, { label: word })
      );
    }
    columns.forEach((c) =>
      setFormula(ctx, sheetId, data, grandRow, c, formula(c, from, to))
    );
  }

  // outline: subtotal rows one level below their segment, details below them
  const cfg: SheetConfig = { ...configOf(ctx, sheetId) };
  const levels = { ...(cfg.rowOutlineLevel || {}) };
  placed.forEach((g) => {
    levels[g.row] = g.level;
    for (let r = g.start; r <= g.end; r += 1) levels[r] = g.level + 1;
  });
  if (addGrand) delete levels[grandRow];
  cfg.rowOutlineLevel = levels;
  if (below) delete cfg.outlineSummaryBelow;
  else cfg.outlineSummaryBelow = false;
  if (options.pageBreaks) {
    const breaks = new Set(cfg.rowPageBreaks || []);
    placed.forEach((g, k) => {
      if (k === 0) return;
      breaks.add(below ? g.start : g.row);
    });
    cfg.rowPageBreaks = [...breaks].sort((a, b) => a - b);
  }
  storeConfig(ctx, sheetId, cfg);

  const result: SubtotalRange = {
    row: [header, lastRow],
    column: [range.column[0], range.column[1]],
  };
  if (sheetId === ctx.currentSheetId) {
    ctx.luckysheet_select_save = selection?.length
      ? selection
      : [{ row: result.row, column: result.column }];
    refreshFilterFormulas(ctx);
  }
  return { ok: true, range: result };
}

/**
 * Remove All: delete the SUBTOTAL rows of the list and its row outline.
 * Returns the list's range afterwards.
 */
export function removeSubtotals(
  ctx: Context,
  range: SubtotalRange,
  sheetId: string = ctx.currentSheetId
): SubtotalRange {
  return onPlainCopy(ctx, (work) => removeSubtotalRows(work, range, sheetId));
}

/**
 * Data › Subtotal. Inserts the subtotal rows (and, unless nesting under
 * existing subtotals, a grand total row) and builds the row outline. Run it
 * inside one setContext call: it is one undo step.
 */
export function applySubtotals(
  ctx: Context,
  options: SubtotalOptions,
  sheetId: string = ctx.currentSheetId
): SubtotalResult {
  return onPlainCopy(ctx, (work) => addSubtotals(work, options, sheetId));
}
