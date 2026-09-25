import _ from "lodash";
import { checkProtection } from "./protection";
import { execfunction, functionCopy, update } from ".";
import { Cell, CellMatrix, Context, getFlowdata, isRealNull } from "..";
import { locale } from "../locale";
import { getSheetIndex, rgbToHex } from "../utils";
import { normalizedAttr } from "./cell";
import { checkCF, getComputeMap } from "./ConditionFormat";
import { jfrefreshgrid } from "./refresh";
import { reconcileSpills } from "./spill";

/*
 * Sorting with Excel's semantics.
 *
 * Ascending order is numbers (and dates) < text < FALSE < TRUE < errors, and
 * blank cells always go last, in both directions. Text compares
 * case-insensitively unless `caseSensitive` is set. The sort is stable, and
 * formulas that move keep pointing at the same relative cells (their relative
 * references shift with them, like a copy).
 */

export type SortOn = "value" | "cellColor" | "fontColor";

export type SortLevel = {
  /** Absolute column index (row index when sorting left to right). */
  index: number;
  sortOn?: SortOn;
  order?: "asc" | "desc";
  /** Colour to put on top (or bottom) for colour sorts, as a hex string. */
  color?: string;
  position?: "top" | "bottom";
  /** Custom order for value sorts, e.g. ["Low", "Medium", "High"]. */
  customList?: string[];
};

export type SortOptions = {
  range: { row: number[]; column: number[] };
  levels: SortLevel[];
  hasHeader?: boolean;
  /** "columns" sorts left to right (reorders columns by a row's values). */
  orientation?: "rows" | "columns";
  caseSensitive?: boolean;
};

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Excel's built-in custom lists. */
export const BUILTIN_CUSTOM_LISTS: string[][] = [
  WEEKDAYS_SHORT,
  WEEKDAYS,
  MONTHS_SHORT,
  MONTHS,
];

/** Rank of a value's type in an ascending sort; blanks are handled apart. */
function typeRank(cell: Cell | null | undefined): number {
  const v = cell?.v;
  if (cell?.ct?.t === "e") return 3;
  if (typeof v === "boolean") return 2;
  if (typeof v === "number") return 0;
  return 1;
}

export function isBlankCell(cell: Cell | null | undefined) {
  if (cell == null) return true;
  if (cell.ct?.t === "inlineStr") {
    return !cell.ct.s?.some((s: any) => `${s?.v ?? ""}`.length > 0);
  }
  return isRealNull(cell.v) || cell.v === "";
}

/** The text a cell shows, used for text comparisons and custom lists. */
export function cellText(cell: Cell | null | undefined): string {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
  }
  const v = cell.v ?? cell.m;
  return v == null ? "" : `${v}`;
}

const collators: Record<string, Intl.Collator> = {};
function collator(caseSensitive: boolean) {
  const key = caseSensitive ? "cs" : "ci";
  if (!collators[key]) {
    collators[key] = new Intl.Collator(undefined, {
      sensitivity: caseSensitive ? "variant" : "accent",
      caseFirst: "lower",
    });
  }
  return collators[key];
}

/**
 * Compare two non-blank cells in ascending order (numbers < text < booleans
 * < errors). Errors are all equal.
 */
export function compareCellValues(
  a: Cell | null | undefined,
  b: Cell | null | undefined,
  caseSensitive = false
): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return (a!.v as number) - (b!.v as number);
  if (ra === 2) return Number(a!.v) - Number(b!.v);
  if (ra === 3) return 0;
  return collator(caseSensitive).compare(cellText(a), cellText(b));
}

function normalizeHex(color: string | null | undefined): string | null {
  if (color == null || color === "") return null;
  let c = `${color}`.trim().toLowerCase();
  if (c.indexOf("rgb") > -1) c = rgbToHex(c);
  if (/^#[0-9a-f]{3}$/.test(c)) {
    c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return c;
}

/**
 * The fill and font colours a cell shows (conditional formats included), as
 * lowercase hex. No fill is "#ffffff" and the default font is "#000000".
 */
export function getCellDisplayColors(
  data: CellMatrix,
  r: number,
  c: number,
  cfCompute?: any
): { bg: string; fc: string } {
  let bg = normalizedAttr(data, r, c, "bg");
  let fc = normalizedAttr(data, r, c, "fc");
  const cf = checkCF(r, c, cfCompute);
  if (cf?.cellColor != null) bg = cf.cellColor;
  if (cf?.textColor != null) fc = cf.textColor;
  return {
    bg: normalizeHex(bg) ?? "#ffffff",
    fc: normalizeHex(fc) ?? "#000000",
  };
}

function customListRank(list: string[], cell: Cell | null | undefined) {
  const text = cellText(cell).toLowerCase();
  for (let i = 0; i < list.length; i += 1) {
    if (`${list[i]}`.toLowerCase() === text) return i;
  }
  return -1;
}

/** Find the built-in custom list a set of values belongs to, if any. */
export function matchBuiltinCustomList(values: string[]): string[] | null {
  const lower = values.map((v) => v.toLowerCase()).filter((v) => v !== "");
  if (lower.length === 0) return null;
  return (
    BUILTIN_CUSTOM_LISTS.find((list) => {
      const l = list.map((v) => v.toLowerCase());
      return lower.every((v) => l.includes(v));
    }) ?? null
  );
}

function cellAt(
  data: CellMatrix,
  byColumns: boolean,
  line: number,
  key: number
): Cell | null {
  return (byColumns ? data[key]?.[line] : data[line]?.[key]) ?? null;
}

/**
 * Does the first row of a range look like a header? Excel's guess: a column
 * whose first cell is text while the cell below holds a number, date or
 * boolean, or a bold first row over a non-bold second row.
 */
export function detectHeaderRow(
  data: CellMatrix,
  range: { row: number[]; column: number[] },
  orientation: "rows" | "columns" = "rows"
): boolean {
  const byColumns = orientation === "columns";
  const [l1, l2] = byColumns ? range.column : range.row;
  const [k1, k2] = byColumns ? range.row : range.column;
  if (l2 - l1 < 1) return false;
  let firstAllText = true;
  let firstBold = false;
  let secondBold = false;
  for (let k = k1; k <= k2; k += 1) {
    const h = cellAt(data, byColumns, l1, k);
    const d = cellAt(data, byColumns, l1 + 1, k);
    const hBlank = isBlankCell(h);
    if (!hBlank && typeRank(h) === 1 && !isBlankCell(d) && typeRank(d) !== 1) {
      return true;
    }
    if (hBlank || typeRank(h) !== 1) firstAllText = false;
    if (h?.bl) firstBold = true;
    if (d?.bl) secondBold = true;
  }
  return firstAllText && firstBold && !secondBold;
}

/** The current region (contiguous non-blank block) around a cell. */
export function getSortRegion(data: CellMatrix, r: number, c: number) {
  let r1 = r;
  let r2 = r;
  let c1 = c;
  let c2 = c;
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const filled = (rr: number, cc: number) =>
    rr >= 0 && cc >= 0 && rr < rows && cc < cols && !isBlankCell(data[rr][cc]);
  const lineFilled = (
    fixed: number,
    from: number,
    to: number,
    horizontal: boolean
  ) => {
    for (let i = from; i <= to; i += 1) {
      if (horizontal ? filled(fixed, i) : filled(i, fixed)) return true;
    }
    return false;
  };
  let grew = true;
  while (grew) {
    grew = false;
    if (r1 > 0 && lineFilled(r1 - 1, Math.max(c1 - 1, 0), c2 + 1, true)) {
      r1 -= 1;
      grew = true;
    }
    if (
      r2 < rows - 1 &&
      lineFilled(r2 + 1, Math.max(c1 - 1, 0), c2 + 1, true)
    ) {
      r2 += 1;
      grew = true;
    }
    if (c1 > 0 && lineFilled(c1 - 1, Math.max(r1 - 1, 0), r2 + 1, false)) {
      c1 -= 1;
      grew = true;
    }
    if (
      c2 < cols - 1 &&
      lineFilled(c2 + 1, Math.max(r1 - 1, 0), r2 + 1, false)
    ) {
      c2 += 1;
      grew = true;
    }
  }
  return { row: [r1, r2], column: [c1, c2] };
}

/** Blank cells sort last whatever the order. */
function blankOrder(aBlank: boolean, bBlank: boolean) {
  if (aBlank === bBlank) return 0;
  return aBlank ? 1 : -1;
}

type LevelComparator = (a: number, b: number) => number;

function makeLevelComparator(
  data: CellMatrix,
  byColumns: boolean,
  level: SortLevel,
  caseSensitive: boolean,
  cfCompute: any
): LevelComparator {
  const key = level.index;
  const desc = level.order === "desc";
  const sortOn = level.sortOn ?? "value";
  if (sortOn === "cellColor" || sortOn === "fontColor") {
    const target = normalizeHex(level.color) ?? "#ffffff";
    const onTop = level.position !== "bottom";
    return (a, b) => {
      const colorOf = (line: number) => {
        const [r, c] = byColumns ? [key, line] : [line, key];
        const colors = getCellDisplayColors(data, r, c, cfCompute);
        if (sortOn === "fontColor" && isBlankCell(data[r]?.[c])) return null;
        return sortOn === "cellColor" ? colors.bg : colors.fc;
      };
      const ma = colorOf(a) === target ? 0 : 1;
      const mb = colorOf(b) === target ? 0 : 1;
      return onTop ? ma - mb : mb - ma;
    };
  }
  const list = level.customList?.length ? level.customList : null;
  return (a, b) => {
    const ca = cellAt(data, byColumns, a, key);
    const cb = cellAt(data, byColumns, b, key);
    const ba = isBlankCell(ca);
    const bb = isBlankCell(cb);
    // blanks always last
    if (ba || bb) return blankOrder(ba, bb);
    let res = 0;
    if (list) {
      const ia = customListRank(list, ca);
      const ib = customListRank(list, cb);
      if (ia >= 0 || ib >= 0) {
        // listed values come first, in list order
        if (ia < 0) return 1;
        if (ib < 0) return -1;
        res = ia - ib;
        return desc ? -res : res;
      }
    }
    res = compareCellValues(ca, cb, caseSensitive);
    return desc ? -res : res;
  };
}

function hasMergeInRange(
  data: CellMatrix,
  r1: number,
  r2: number,
  c1: number,
  c2: number
) {
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      if (data[r]?.[c]?.mc != null) return true;
    }
  }
  return false;
}

/** Move a formula by (dr, dc), shifting its relative references. */
export function shiftFormula(ctx: Context, f: string, dr: number, dc: number) {
  let func = f;
  if (dr > 0) func = `=${functionCopy(ctx, func, "down", dr)}`;
  else if (dr < 0) func = `=${functionCopy(ctx, func, "up", -dr)}`;
  if (dc > 0) func = `=${functionCopy(ctx, func, "right", dc)}`;
  else if (dc < 0) func = `=${functionCopy(ctx, func, "left", -dc)}`;
  return func;
}

/**
 * Sort a range in place. Returns an error message, or null on success.
 * Hidden rows (columns when sorting left to right) keep their place.
 */
export function sortRange(ctx: Context, options: SortOptions): string | null {
  if (
    !checkProtection(ctx, "sort") ||
    !checkProtection(ctx, "editCells", [options.range])
  )
    return null;
  const { sort: sortLocale } = locale(ctx);
  if (ctx.allowEdit === false) return null;
  const data = getFlowdata(ctx);
  if (data == null) return null;
  const byColumns = options.orientation === "columns";
  const [r1, r2] = options.range.row;
  const [c1, c2] = options.range.column;
  if (hasMergeInRange(data, r1, r2, c1, c2)) return sortLocale.mergeError;
  const levels = options.levels.filter((l) => l != null && l.index != null);
  if (levels.length === 0) return null;

  // the lines (rows, or columns for left-to-right) that take part
  const [first, l2] = byColumns ? [c1, c2] : [r1, r2];
  let l1 = first;
  if (options.hasHeader) l1 += 1;
  if (l1 > l2) return null;
  const hidden: Record<string, number> = byColumns
    ? ctx.config?.colhidden || {}
    : ctx.config?.rowhidden || {};
  const lines: number[] = [];
  for (let l = l1; l <= l2; l += 1) if (!(l in hidden)) lines.push(l);
  if (lines.length < 2) return null;

  const needsColors = levels.some(
    (l) => l.sortOn === "cellColor" || l.sortOn === "fontColor"
  );
  const cfCompute = needsColors ? getComputeMap(ctx) : null;
  const comparators = levels.map((l) =>
    makeLevelComparator(data, byColumns, l, !!options.caseSensitive, cfCompute)
  );
  const order = lines.slice().sort((a, b) => {
    for (let i = 0; i < comparators.length; i += 1) {
      const res = comparators[i](a, b);
      if (res !== 0) return res;
    }
    return a - b; // stable
  });
  if (order.every((l, i) => l === lines[i])) return null;

  // snapshot the moving lines, then write them to their new places
  const [k1, k2] = byColumns ? [r1, r2] : [c1, c2];
  const snapshot: Record<number, (Cell | null)[]> = {};
  lines.forEach((l) => {
    const row: (Cell | null)[] = [];
    for (let k = k1; k <= k2; k += 1) row.push(cellAt(data, byColumns, l, k));
    snapshot[l] = row;
  });
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const file = sheetIndex == null ? null : ctx.luckysheetfile[sheetIndex];
  const moveKeyed = (map: Record<string, any> | undefined | null) => {
    if (!map) return map;
    const next = { ...map };
    const moved: Record<string, any> = {};
    lines.forEach((l) => {
      for (let k = k1; k <= k2; k += 1) {
        const key = byColumns ? `${k}_${l}` : `${l}_${k}`;
        delete next[key];
      }
    });
    order.forEach((from, i) => {
      const to = lines[i];
      for (let k = k1; k <= k2; k += 1) {
        const fromKey = byColumns ? `${k}_${from}` : `${from}_${k}`;
        const toKey = byColumns ? `${k}_${to}` : `${to}_${k}`;
        if (map[fromKey] != null) moved[toKey] = map[fromKey];
      }
    });
    return { ...next, ...moved };
  };

  const formulaCells: { r: number; c: number }[] = [];
  order.forEach((from, i) => {
    const to = lines[i];
    const src = snapshot[from];
    for (let k = k1; k <= k2; k += 1) {
      let cell = src[k - k1];
      const [r, c] = byColumns ? [k, to] : [to, k];
      if (cell?.f && from !== to) {
        const offset = to - from;
        cell = {
          ...cell,
          f: shiftFormula(
            ctx,
            cell.f,
            byColumns ? 0 : offset,
            byColumns ? offset : 0
          ),
        };
      }
      if (cell?.f) formulaCells.push({ r, c });
      data[r][c] = cell;
    }
  });

  formulaCells.forEach(({ r, c }) => {
    const cell = data[r][c];
    if (!cell?.f) return;
    const res = execfunction(
      ctx,
      cell.f,
      r,
      c,
      undefined,
      undefined,
      false,
      true
    );
    const [, v, f] = res;
    cell.v = v;
    cell.f = f;
    cell.m = update(cell.ct?.fa || "General", v);
  });

  if (file) {
    if (file.dataVerification) {
      file.dataVerification = moveKeyed(file.dataVerification);
    }
    if (file.hyperlink) file.hyperlink = moveKeyed(file.hyperlink) as any;
  }

  jfrefreshgrid(ctx, data, [{ row: [r1, r2], column: [c1, c2] }]);
  reconcileSpills(ctx, ctx.currentSheetId, {
    changed: [{ row: [r1, r2], column: [c1, c2] }],
  });
  return null;
}

/** Build the single-level sort of a quick A→Z / Z→A command. */
function quickSortOptions(
  ctx: Context,
  data: CellMatrix,
  isAsc: boolean,
  colIndex?: number
): SortOptions | null {
  const sel = ctx.luckysheet_select_save?.[0];
  if (!sel) return null;
  const focusCol = sel.column_focus ?? sel.column[0];
  let range: { row: number[]; column: number[] } = {
    row: sel.row.slice(),
    column: sel.column.slice(),
  };
  if (sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1]) {
    // a single cell sorts its current region, like Excel
    range = getSortRegion(data, sel.row[0], sel.column[0]);
  }
  const index =
    colIndex != null
      ? range.column[0] + colIndex
      : _.clamp(focusCol, range.column[0], range.column[1]);
  return {
    range,
    hasHeader: detectHeaderRow(data, range),
    levels: [{ index, order: isAsc ? "asc" : "desc" }],
  };
}

/**
 * Sort the selection A→Z or Z→A by the active cell's column (or by
 * `colIndex`, an offset in the selection). Header rows are detected.
 */
export function sortSelection(ctx: Context, isAsc: boolean, colIndex?: number) {
  if (ctx.allowEdit === false) return null;
  if (ctx.luckysheet_select_save == null) return null;
  if (ctx.luckysheet_select_save.length > 1) {
    return locale(ctx).sort.noRangeError;
  }
  const data = getFlowdata(ctx);
  if (data == null) return null;
  const options = quickSortOptions(ctx, data, isAsc ?? true, colIndex);
  if (!options) return null;
  return sortRange(ctx, options);
}

/**
 * Legacy single-key sort of `dataRange` (the rows str..edr, columns stc..edc
 * of the sheet), kept for API compatibility.
 */
export function sortDataRange(
  ctx: Context,
  sheetData: CellMatrix,
  dataRange: CellMatrix,
  index: number,
  isAsc: boolean,
  str: number,
  edr: number,
  stc: number,
  edc: number
) {
  sortRange(ctx, {
    range: { row: [str, edr], column: [stc, edc] },
    levels: [{ index: stc + index, order: isAsc ? "asc" : "desc" }],
  });
}

/**
 * Legacy helper: sort a row matrix by one column, Excel ordering. Returns
 * the sorted rows and each row's offset from its original position.
 */
export function orderbydata(
  isAsc: boolean,
  index: number,
  data: (Cell | null)[][]
) {
  const rows = data.map((row, i) => ({ row, i }));
  rows.sort((x, y) => {
    const a = x.row[index];
    const b = y.row[index];
    const ba = isBlankCell(a);
    const bb = isBlankCell(b);
    if (ba || bb) return blankOrder(ba, bb) || x.i - y.i;
    const res = compareCellValues(a, b);
    return (isAsc === false ? -res : res) || x.i - y.i;
  });
  return {
    sortedData: rows.map((r) => r.row),
    rowOffsets: rows.map((r, i) => i - r.i),
  };
}
