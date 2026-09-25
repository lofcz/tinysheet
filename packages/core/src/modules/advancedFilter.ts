/**
 * Excel's Data › Advanced Filter.
 *
 * A list range (first row: column labels) is filtered by a criteria range:
 * its first row holds labels, the rows below hold conditions. Conditions on
 * one row must all match (AND), any row may match (OR). Condition cells
 * follow Excel's database criteria (shared with DSUM & co., see the
 * formula parser's `databaseCriterion`): "Dav" matches values beginning
 * with it, "=Davolio" matches exactly, wildcards * ? ~, comparisons ">100".
 *
 * Computed criteria: a formula under a label that is blank or not a column
 * of the list is evaluated for every record, relative to the first record
 * (`=C7>AVERAGE($C$7:$C$20)` written for the first data row, C7, is
 * evaluated with C8, C9, ... for the next records). TRUE keeps the record.
 *
 * Results either hide the other rows of the list (filter in place, undone
 * by Clear) or are copied to another place of the sheet; a copy-to range
 * whose first row holds column labels of the list copies only those
 * columns, in that order. "Unique records only" drops repeated records.
 */
import { databaseCriterion } from "@lofcz/tinysheet-formula-parser";
import type { Context } from "../context";
import { getFlowdata } from "../context";
import type { Cell, CellMatrix, Sheet } from "../types";
import { getSheetIndex } from "../utils";
import { execfunction } from "./formula";
import { jfrefreshgrid } from "./refresh";
import { shiftFormula } from "./sort";

type Range = { row: number[]; column: number[] };

export type AdvancedFilterOptions = {
  /** The list, its first row holding the column labels. */
  list: Range;
  /** Criteria range (labels + condition rows); omit to match every record. */
  criteria?: Range | null;
  /** "copy": copy the matches to `copyTo` instead of hiding rows. */
  action?: "inPlace" | "copy";
  /** Top-left cell, or the header row with the columns to extract. */
  copyTo?: Range | null;
  /** Drop repeated records. */
  unique?: boolean;
};

export type AdvancedFilterResult = {
  /** Records shown / copied. */
  matched: number;
  /** Records in the list. */
  total: number;
  error?:
    | "invalidList"
    | "invalidCriteria"
    | "invalidCopyTo"
    | "copyOverlapsList"
    | "readOnly";
};

/** State of an in-place advanced filter, kept on the sheet. */
export type AdvancedFilterState = {
  list: { row: [number, number]; column: [number, number] };
  /** Rows hidden by the filter (restored by Clear). */
  hidden: number[];
};

function text(cell: Cell | null | undefined) {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
  }
  const v = cell.m ?? cell.v;
  return v == null ? "" : `${v}`;
}

function label(cell: Cell | null | undefined) {
  return text(cell).trim().toUpperCase();
}

/** The value criteria compare against (numbers stay numbers). */
function value(cell: Cell | null | undefined): unknown {
  if (cell == null) return null;
  if (cell.ct?.t === "inlineStr") return text(cell);
  if (cell.v == null || cell.v === "") return null;
  return cell.v;
}

function truthy(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.toUpperCase() === "TRUE";
  return false;
}

type RecordTest = (r: number) => boolean;

/**
 * `(row) => matches` for a criteria range, or null when it is invalid (no
 * condition row).
 */
export function compileAdvancedCriteria(
  ctx: Context,
  data: CellMatrix,
  list: Range,
  criteria: Range
): RecordTest | null {
  const [lr1] = list.row;
  const [lc1, lc2] = list.column;
  const [cr1, cr2] = criteria.row;
  const [cc1, cc2] = criteria.column;
  if (cr2 <= cr1) return null;
  const headers: string[] = [];
  for (let c = lc1; c <= lc2; c += 1) headers.push(label(data[lr1]?.[c]));
  const firstRecord = lr1 + 1;

  const rows: RecordTest[] = [];
  for (let r = cr1 + 1; r <= cr2; r += 1) {
    const tests: RecordTest[] = [];
    for (let c = cc1; c <= cc2; c += 1) {
      const cell = data[r]?.[c];
      const name = label(data[cr1]?.[c]);
      const column = name ? headers.indexOf(name) : -1;
      if (column < 0) {
        // computed criterion: a formula evaluated for every record
        if (cell?.f) {
          const { f } = cell;
          const cr = r;
          const ccol = c;
          tests.push((rec) => {
            const shifted =
              rec === firstRecord
                ? f
                : shiftFormula(ctx, f, rec - firstRecord, 0);
            const res = execfunction(
              ctx,
              shifted,
              cr,
              ccol,
              undefined,
              undefined,
              false,
              true
            );
            return truthy(res[1]);
          });
        } else if (cell != null && value(cell) != null) {
          // a constant under an unknown label: TRUE keeps, FALSE rejects
          const keep = truthy(value(cell));
          tests.push(() => keep);
        }
        continue;
      }
      const v = value(cell);
      if (v == null) continue;
      const pred = databaseCriterion(v);
      if (!pred) continue;
      const col = lc1 + column;
      tests.push((rec) => pred(value(data[rec]?.[col])));
    }
    rows.push((rec) => tests.every((t) => t(rec)));
  }
  return (rec) => rows.some((t) => t(rec));
}

function sheetOf(ctx: Context): Sheet | null {
  const idx = getSheetIndex(ctx, ctx.currentSheetId);
  return idx == null ? null : ctx.luckysheetfile[idx];
}

function setRowHidden(ctx: Context, sheet: Sheet, rowhidden: any) {
  const cfg = { ...(ctx.config || {}), rowhidden };
  ctx.config = cfg;
  sheet.config = cfg;
}

/** Show the rows an in-place advanced filter hid. */
export function clearAdvancedFilter(ctx: Context) {
  const sheet = sheetOf(ctx);
  const state = (sheet as any)?.advancedFilter as
    | AdvancedFilterState
    | undefined;
  if (!sheet || !state) return false;
  const rowhidden = { ...(ctx.config?.rowhidden || {}) };
  state.hidden.forEach((r) => {
    delete rowhidden[r];
  });
  setRowHidden(ctx, sheet, rowhidden);
  delete (sheet as any).advancedFilter;
  return true;
}

/** The in-place advanced filter of the current sheet, if any. */
export function getAdvancedFilter(
  ctx: Context
): AdvancedFilterState | undefined {
  return (sheetOf(ctx) as any)?.advancedFilter;
}

function recordKey(data: CellMatrix, r: number, cols: number[]) {
  return cols.map((c) => text(data[r]?.[c]).toLowerCase()).join("\u0000");
}

function overlaps(a: Range, b: Range) {
  return !(
    a.row[1] < b.row[0] ||
    b.row[1] < a.row[0] ||
    a.column[1] < b.column[0] ||
    b.column[1] < a.column[0]
  );
}

/** Run Advanced Filter on the current sheet. */
export function advancedFilter(
  ctx: Context,
  options: AdvancedFilterOptions
): AdvancedFilterResult {
  const data = getFlowdata(ctx);
  const sheet = sheetOf(ctx);
  const { list } = options;
  if (ctx.allowEdit === false)
    return { matched: 0, total: 0, error: "readOnly" };
  if (
    !data ||
    !sheet ||
    !list ||
    list.row[1] <= list.row[0] ||
    list.row[0] < 0 ||
    list.column[0] < 0
  ) {
    return { matched: 0, total: 0, error: "invalidList" };
  }
  const [lr1, lr2] = list.row;
  const [lc1, lc2] = list.column;
  const total = lr2 - lr1;
  let test: RecordTest = () => true;
  if (options.criteria) {
    const compiled = compileAdvancedCriteria(ctx, data, list, options.criteria);
    if (!compiled) return { matched: 0, total, error: "invalidCriteria" };
    test = compiled;
  }

  const copy = options.action === "copy";
  // extracted columns: the labels in the copy-to row, else every column
  let columns: number[] = [];
  for (let c = lc1; c <= lc2; c += 1) columns.push(c);
  let dest: { r: number; c: number } | null = null;
  let withHeader = true;
  if (copy) {
    const to = options.copyTo;
    if (!to) return { matched: 0, total, error: "invalidCopyTo" };
    dest = { r: to.row[0], c: to.column[0] };
    const labels: string[] = [];
    for (let c = to.column[0]; c <= to.column[1]; c += 1) {
      labels.push(label(data[to.row[0]]?.[c]));
    }
    if (labels.some((l) => l !== "")) {
      const headers = columns.map((c) => label(data[lr1]?.[c]));
      const picked = labels.map((l) => headers.indexOf(l));
      if (picked.some((i) => i < 0)) {
        return { matched: 0, total, error: "invalidCopyTo" };
      }
      columns = picked.map((i) => lc1 + i);
      withHeader = false; // the labels are already there
    }
    const width = columns.length;
    if (
      overlaps(
        { row: [dest.r, dest.r], column: [dest.c, dest.c + width - 1] },
        list
      )
    ) {
      return { matched: 0, total, error: "copyOverlapsList" };
    }
  }

  // matching records
  const keys = new Set<string>();
  const matches: number[] = [];
  const uniqueCols = copy ? columns : columns.map((_, i) => lc1 + i);
  for (let r = lr1 + 1; r <= lr2; r += 1) {
    if (!test(r)) continue;
    if (options.unique) {
      const key = recordKey(data, r, uniqueCols);
      if (keys.has(key)) continue;
      keys.add(key);
    }
    matches.push(r);
  }

  if (!copy) {
    clearAdvancedFilter(ctx);
    const rowhidden = { ...(ctx.config?.rowhidden || {}) };
    const hidden: number[] = [];
    const keep = new Set(matches);
    for (let r = lr1 + 1; r <= lr2; r += 1) {
      if (!keep.has(r) && rowhidden[r] == null) {
        rowhidden[r] = 0;
        hidden.push(r);
      }
    }
    setRowHidden(ctx, sheet, rowhidden);
    const state: AdvancedFilterState = {
      list: { row: [lr1, lr2], column: [lc1, lc2] },
      hidden,
    };
    (sheet as any).advancedFilter = state;
    return { matched: matches.length, total };
  }

  // copy to: clear the old extract below the header, then write
  const d = dest!;
  const width = columns.length;
  const startRow = withHeader ? d.r : d.r + 1;
  const neededRows = startRow + matches.length + (withHeader ? 1 : 0);
  if (neededRows > data.length || d.c + width > (data[0]?.length ?? 0)) {
    return { matched: 0, total, error: "invalidCopyTo" };
  }
  const copyCell = (cell: Cell | null | undefined): Cell | null => {
    if (cell == null) return null;
    const out: any = { ...cell };
    delete out.f;
    delete out.spl;
    delete out.mc;
    return out;
  };
  for (let r = d.r + 1; r < data.length; r += 1) {
    for (let i = 0; i < width; i += 1) {
      const prev = data[r][d.c + i];
      if (prev && (prev.v != null || prev.f)) {
        data[r][d.c + i] = null;
      }
    }
  }
  let row = startRow;
  if (withHeader) {
    columns.forEach((c, i) => {
      data[row][d.c + i] = copyCell(data[lr1]?.[c]);
    });
    row += 1;
  }
  matches.forEach((r) => {
    columns.forEach((c, i) => {
      data[row][d.c + i] = copyCell(data[r]?.[c]);
    });
    row += 1;
  });
  jfrefreshgrid(ctx, data, [
    {
      row: [d.r, Math.max(d.r, data.length - 1)],
      column: [d.c, d.c + width - 1],
    },
  ]);
  return { matched: matches.length, total };
}

/** Advanced Filter from the dialog; the result goes to ctx.cellToolsNotice. */
export function runAdvancedFilterCommand(
  ctx: Context,
  options: AdvancedFilterOptions
) {
  const res = advancedFilter(ctx, options);
  ctx.cellToolsNotice = {
    id: (ctx.cellToolsNotice?.id ?? 0) + 1,
    kind: "advancedFilter",
    count: res.matched,
    total: res.total,
    range: {
      row: [options.list.row[0], options.list.row[1]],
      column: [options.list.column[0], options.list.column[1]],
    },
    error: res.error,
  };
  if (!res.error && options.action !== "copy") {
    // the list stays selected, like Excel
    ctx.luckysheet_select_save = [
      {
        row: [options.list.row[0], options.list.row[1]],
        column: [options.list.column[0], options.list.column[1]],
        row_focus: options.list.row[0],
        column_focus: options.list.column[0],
      },
    ];
  }
  return res;
}
