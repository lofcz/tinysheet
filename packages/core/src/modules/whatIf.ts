/**
 * What-If Analysis: Goal Seek and Data Tables.
 *
 * Goal Seek finds the value of an input cell ("by changing cell", a
 * constant) for which a formula cell ("set cell") reaches a target value.
 * It runs Newton steps with a numerical derivative, falls back to bisection
 * once a sign change brackets the root, and widens the search when the
 * formula is flat. It stops when the result is within `tolerance` of the
 * target (Excel: 0.001) or after `maxIterations` (Excel: 100).
 *
 * Data tables follow Excel's `{=TABLE(row_input, col_input)}`: in the
 * table range the first row and first column hold input values and
 * formulas, and each body cell is the formula's value with the input
 * cell(s) replaced by the body cell's row / column values:
 *
 * - column input only: values down the first column, formulas across the
 *   first row (right of the top-left cell);
 * - row input only: values across the first row, formulas down the first
 *   column;
 * - both: the formula in the top-left cell, row values across, column
 *   values down.
 *
 * The body is read-only as a unit: editing part of it is refused (see the
 * edit guard below); clearing all of it removes the table.
 * `recalcDataTables` refreshes the bodies (the UI calls it after workbook
 * changes; a calculation mode that skips data tables can call it on F9).
 */
import { Context, getFlowdata } from "../context";
import type { Cell, CellMatrix, DataTableSpec, Sheet } from "../types";
import { getSheetIndex } from "../utils";
import { registerEditGuard } from "./extensions";
import { update } from "./format";
import { groupValuesRefresh } from "./formula";
import { jfrefreshgrid } from "./refresh";
import { cellToolsLocale } from "../locale/cellTools";

type CellPos = { r: number; c: number };

function sheetById(ctx: Context, sheetId?: string): Sheet | null {
  const idx = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  return idx == null ? null : ctx.luckysheetfile[idx];
}

function numeric(cell: Cell | null | undefined): number | null {
  const v = cell?.v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

/** Recalculate what depends on the given cells of the current sheet. */
function recalcFrom(ctx: Context, data: CellMatrix, cells: CellPos[]) {
  jfrefreshgrid(
    ctx,
    data,
    cells.map(({ r, c }) => ({ row: [r, r], column: [c, c] }))
  );
  if (ctx.groupValuesRefreshData?.length) groupValuesRefresh(ctx);
}

/** Put a constant into a cell, keeping its format. */
function putValue(data: CellMatrix, { r, c }: CellPos, value: unknown) {
  const prev = data[r][c];
  const cell: Cell = prev ? { ...prev } : {};
  delete cell.f;
  if (value == null || value === "") {
    delete cell.v;
    delete cell.m;
  } else if (typeof value === "number") {
    const fa = cell.ct?.fa && cell.ct.t !== "s" ? cell.ct.fa : "General";
    cell.v = value;
    cell.m = `${update(fa, value)}`;
    cell.ct = { fa, t: cell.ct?.t === "d" ? "d" : "n" };
  } else if (typeof value === "boolean") {
    cell.v = value;
    cell.m = value ? "TRUE" : "FALSE";
    cell.ct = { fa: cell.ct?.fa || "General", t: "b" };
  } else {
    cell.v = `${value}`;
    cell.m = `${value}`;
    cell.ct = { fa: cell.ct?.fa || "General", t: "g" };
  }
  data[r][c] = cell;
}

/* ------------------------------------------------------------------ */
/* Goal Seek                                                           */
/* ------------------------------------------------------------------ */

export type GoalSeekOptions = {
  /** The formula cell (current sheet unless `setSheetId`). */
  setCell: CellPos;
  setSheetId?: string;
  toValue: number;
  /** The input cell on the current sheet (a constant). */
  changingCell: CellPos;
  maxIterations?: number;
  tolerance?: number;
};

export type GoalSeekResult = {
  found: boolean;
  /** The changing cell's value found (last tried when not found). */
  value: number;
  /** The set cell's value for `value`. */
  result: number;
  iterations: number;
  /** The changing cell before Goal Seek (to restore on Cancel). */
  original: Cell | null;
  error?: "setCellNotFormula" | "changingCellFormula" | "notNumeric";
};

/**
 * Goal Seek. Leaves the solution (or the last value tried) in the changing
 * cell; `restoreGoalSeek` puts the original back.
 */
export function goalSeek(
  ctx: Context,
  options: GoalSeekOptions
): GoalSeekResult {
  const data = getFlowdata(ctx);
  const setSheet = sheetById(ctx, options.setSheetId);
  const { setCell, changingCell, toValue } = options;
  const maxIterations = options.maxIterations ?? 100;
  const tolerance = options.tolerance ?? 0.001;
  const original = data?.[changingCell.r]?.[changingCell.c] ?? null;
  const fail = (error: GoalSeekResult["error"]): GoalSeekResult => ({
    found: false,
    value: numeric(original) ?? 0,
    result: NaN,
    iterations: 0,
    original,
    error,
  });
  if (!data || !setSheet?.data) return fail("notNumeric");
  if (!setSheet.data[setCell.r]?.[setCell.c]?.f) {
    return fail("setCellNotFormula");
  }
  if (original?.f) return fail("changingCellFormula");
  const start =
    original?.v == null || original.v === "" ? 0 : numeric(original);
  if (start == null || !Number.isFinite(toValue)) return fail("notNumeric");

  const f = (x: number) => {
    putValue(data, changingCell, x);
    recalcFrom(ctx, data, [changingCell]);
    const y = numeric(setSheet.data![setCell.r]?.[setCell.c]);
    return y == null ? NaN : y - toValue;
  };

  let x = start;
  let fx = f(x);
  let best = { x, fx };
  let lo: { x: number; fx: number } | null = null;
  let hi: { x: number; fx: number } | null = null;
  const note = (px: number, pf: number) => {
    if (!Number.isFinite(pf)) return;
    if (!Number.isFinite(best.fx) || Math.abs(pf) < Math.abs(best.fx)) {
      best = { x: px, fx: pf };
    }
    // keep a bracketing pair (opposite signs) once one is seen
    if (pf < 0 && (!lo || Math.abs(pf) < Math.abs(lo.fx)))
      lo = { x: px, fx: pf };
    if (pf > 0 && (!hi || Math.abs(pf) < Math.abs(hi.fx)))
      hi = { x: px, fx: pf };
  };
  note(x, fx);
  let iterations = 0;
  let widen = 1;
  while (iterations < maxIterations) {
    if (Number.isFinite(fx) && Math.abs(fx) <= tolerance) break;
    iterations += 1;
    let next: number;
    const bracketed = lo != null && hi != null;
    if (Number.isFinite(fx)) {
      const h = Math.max(Math.abs(x) * 1e-6, 1e-7);
      const fh = f(x + h);
      const slope = (fh - fx) / h;
      next =
        Number.isFinite(slope) && slope !== 0 ? x - fx / slope : Number.NaN;
    } else {
      next = Number.NaN;
    }
    if (bracketed) {
      const a = lo!.x;
      const b = hi!.x;
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      if (!Number.isFinite(next) || next <= min || next >= max) {
        next = (a + b) / 2;
      }
    } else if (!Number.isFinite(next)) {
      // flat or undefined: look further away, alternating directions
      const step = (Math.abs(start) + 1) * widen;
      next = start + (iterations % 2 ? step : -step);
      widen *= 2;
    }
    x = next;
    fx = f(x);
    note(x, fx);
    if (!Number.isFinite(fx)) {
      // stepped outside the formula's domain: go back half way
      x = (x + best.x) / 2;
      fx = f(x);
      note(x, fx);
    }
  }
  // settle on the best value tried
  if (!Number.isFinite(fx) || Math.abs(best.fx) < Math.abs(fx)) {
    x = best.x;
    fx = f(x);
  }
  const found = Number.isFinite(fx) && Math.abs(fx) <= tolerance;
  return {
    found,
    value: x,
    result: fx + toValue,
    iterations,
    original,
  };
}

/** Put the changing cell's original content back and recalculate. */
export function restoreGoalSeek(
  ctx: Context,
  changingCell: CellPos,
  original: Cell | null
) {
  const data = getFlowdata(ctx);
  if (!data) return;
  data[changingCell.r][changingCell.c] = original ? { ...original } : null;
  recalcFrom(ctx, data, [changingCell]);
}

/** Set a number into a cell and recalculate (Goal Seek's OK). */
export function setGoalSeekValue(
  ctx: Context,
  changingCell: CellPos,
  value: number
) {
  const data = getFlowdata(ctx);
  if (!data) return;
  putValue(data, changingCell, value);
  recalcFrom(ctx, data, [changingCell]);
}

/**
 * Goal Seek from the dialog: seek, leave the solution in the changing cell
 * and the result in \`ctx.goalSeekStatus\` until OK / Cancel (run it
 * without recording history; OK then records the change as one step).
 */
export function runGoalSeekCommand(ctx: Context, options: GoalSeekOptions) {
  const res = goalSeek(ctx, options);
  ctx.goalSeekStatus = {
    id: (ctx.goalSeekStatus?.id ?? 0) + 1,
    setCell: options.setCell,
    setSheetId: options.setSheetId,
    changingCell: options.changingCell,
    toValue: options.toValue,
    found: res.found,
    value: res.value,
    result: res.result,
    iterations: res.iterations,
    original: res.original,
    error: res.error,
  };
  return res;
}

/**
 * Close Goal Seek: "restore" puts the original value back (Cancel, and the
 * first half of OK, run without history); "apply" writes the solution
 * (OK, recorded as one undo step).
 */
export function finishGoalSeek(ctx: Context, mode: "restore" | "apply") {
  const status = ctx.goalSeekStatus;
  if (!status) return;
  if (mode === "restore") {
    if (!status.error) {
      restoreGoalSeek(ctx, status.changingCell, status.original);
    }
    if (status.error) delete ctx.goalSeekStatus;
    return;
  }
  setGoalSeekValue(ctx, status.changingCell, status.value);
  delete ctx.goalSeekStatus;
}

/* ------------------------------------------------------------------ */
/* Data tables                                                         */
/* ------------------------------------------------------------------ */

export type DataTableOptions = {
  range: { row: number[]; column: number[] };
  rowInput?: CellPos | null;
  colInput?: CellPos | null;
};

export type DataTableError =
  | "tooSmall"
  | "noInput"
  | "inputInTable"
  | "overlapsTable";

function inRange(
  range: { row: number[]; column: number[] },
  r: number,
  c: number
) {
  return (
    r >= range.row[0] &&
    r <= range.row[1] &&
    c >= range.column[0] &&
    c <= range.column[1]
  );
}

function bodyOf(t: { range: { row: number[]; column: number[] } }) {
  return {
    row: [t.range.row[0] + 1, t.range.row[1]],
    column: [t.range.column[0] + 1, t.range.column[1]],
  };
}

/** Why a data table can't be created, or null. */
export function validateDataTable(
  ctx: Context,
  options: DataTableOptions
): DataTableError | null {
  const { range, rowInput, colInput } = options;
  if (
    range.row[1] - range.row[0] < 1 ||
    range.column[1] - range.column[0] < 1
  ) {
    return "tooSmall";
  }
  if (!rowInput && !colInput) return "noInput";
  const body = bodyOf({ range });
  if (
    (rowInput && inRange(body, rowInput.r, rowInput.c)) ||
    (colInput && inRange(body, colInput.r, colInput.c))
  ) {
    return "inputInTable";
  }
  const sheet = sheetById(ctx);
  const clash = (sheet?.dataTables ?? []).some((t) => {
    const b = t.range;
    return !(
      b.row[1] < range.row[0] ||
      range.row[1] < b.row[0] ||
      b.column[1] < range.column[0] ||
      range.column[1] < b.column[0]
    );
  });
  return clash ? "overlapsTable" : null;
}

/** Body values of one table, computed by substitution. */
function computeTable(
  ctx: Context,
  data: CellMatrix,
  t: DataTableSpec
): { r: number; c: number; v: unknown; fa?: string }[] {
  const [r1, r2] = t.range.row;
  const [c1, c2] = t.range.column;
  const inputs = [t.rowInput, t.colInput].filter(Boolean) as CellPos[];
  const saved = inputs.map((p) => data[p.r]?.[p.c] ?? null);
  const out: { r: number; c: number; v: unknown; fa?: string }[] = [];
  const valueOf = (cell: Cell | null | undefined) =>
    cell?.v === undefined ? null : cell.v;
  for (let r = r1 + 1; r <= r2; r += 1) {
    for (let c = c1 + 1; c <= c2; c += 1) {
      let formula: CellPos;
      if (t.rowInput && t.colInput) {
        putValue(data, t.rowInput, valueOf(data[r1][c]));
        putValue(data, t.colInput, valueOf(data[r][c1]));
        formula = { r: r1, c: c1 };
      } else if (t.colInput) {
        putValue(data, t.colInput, valueOf(data[r][c1]));
        formula = { r: r1, c };
      } else {
        putValue(data, t.rowInput!, valueOf(data[r1][c]));
        formula = { r, c: c1 };
      }
      recalcFrom(ctx, data, inputs);
      const fcell = data[formula.r]?.[formula.c];
      out.push({
        r,
        c,
        v: fcell?.f ? fcell.v : null,
        fa: fcell?.ct?.fa,
      });
    }
  }
  // restore the inputs
  inputs.forEach((p, i) => {
    data[p.r][p.c] = saved[i] ? { ...saved[i]! } : null;
  });
  recalcFrom(ctx, data, inputs);
  return out;
}

function displayOf(v: unknown, fa: string) {
  if (v == null) return undefined;
  if (typeof v === "number") return `${update(fa, v)}`;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `${v}`;
}

function typeOf(v: unknown) {
  if (typeof v === "number") return "n";
  if (typeof v === "boolean") return "b";
  if (typeof v === "string" && /^#/.test(v)) return "e";
  return "g";
}

type BodyValue = { r: number; c: number; v: unknown; fa?: string };

/** The body cell showing `v`, or null when `prev` already shows it. */
function bodyCell(prev: Cell | null | undefined, v: unknown, fa?: string) {
  const bodyFa =
    prev?.ct?.fa && prev.ct.fa !== "General" ? prev.ct.fa : fa || "General";
  const m = displayOf(v, bodyFa);
  if (prev && !prev.f && prev.v === v && prev.m === m) return null;
  if (!prev && v == null) return null;
  const cell: Cell = prev ? { ...prev } : {};
  delete cell.f;
  if (v == null) {
    delete cell.v;
    delete cell.m;
  } else {
    cell.v = v as any;
    cell.m = m;
    cell.ct = { fa: bodyFa, t: typeOf(v) };
  }
  return cell;
}

function writeBody(data: CellMatrix, values: BodyValue[]) {
  let changed = false;
  values.forEach(({ r, c, v, fa }) => {
    const cell = bodyCell(data[r]?.[c], v, fa);
    if (!cell) return;
    data[r][c] = cell;
    changed = true;
  });
  return changed;
}

function bodyCells(t: DataTableSpec) {
  const b = bodyOf(t);
  const cells: CellPos[] = [];
  for (let r = b.row[0]; r <= b.row[1]; r += 1) {
    for (let c = b.column[0]; c <= b.column[1]; c += 1) cells.push({ r, c });
  }
  return cells;
}

let nextTableId = 1;

/** Create a data table on the current sheet. Returns an error or null. */
export function createDataTable(
  ctx: Context,
  options: DataTableOptions
): DataTableError | null {
  const err = validateDataTable(ctx, options);
  if (err) return err;
  const data = getFlowdata(ctx);
  const sheet = sheetById(ctx);
  if (!data || !sheet) return "tooSmall";
  const spec: DataTableSpec = {
    id: `dt_${Date.now().toString(36)}_${nextTableId}`,
    range: {
      row: [options.range.row[0], options.range.row[1]],
      column: [options.range.column[0], options.range.column[1]],
    },
    rowInput: options.rowInput ?? null,
    colInput: options.colInput ?? null,
  };
  nextTableId += 1;
  sheet.dataTables = [...(sheet.dataTables ?? []), spec];
  if (writeBody(data, computeTable(ctx, data, spec))) {
    recalcFrom(ctx, data, bodyCells(spec));
  }
  return null;
}

/** The data table whose body contains the cell, if any. */
export function dataTableAt(
  ctx: Context,
  r: number,
  c: number,
  sheetId?: string
): DataTableSpec | undefined {
  return sheetById(ctx, sheetId)?.dataTables?.find((t) =>
    inRange(bodyOf(t), r, c)
  );
}

/** `=TABLE(row_input, col_input)` as Excel shows it for a body cell. */
export function dataTableFormula(t: DataTableSpec) {
  const ref = (p?: CellPos | null) => {
    if (!p) return "";
    let n = p.c;
    let s = "";
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return `${s}${p.r + 1}`;
  };
  return `{=TABLE(${ref(t.rowInput)},${ref(t.colInput)})}`;
}

export type DataTableUpdate = {
  sheetId: string;
  tableId: string;
  values: BodyValue[];
};

function withSheet<T>(ctx: Context, sheetId: string, fn: () => T): T {
  const prev = ctx.currentSheetId;
  ctx.currentSheetId = sheetId;
  try {
    return fn();
  } finally {
    ctx.currentSheetId = prev;
  }
}

/**
 * Body values of the data tables (of one sheet, or every loaded sheet)
 * that differ from what the sheet shows. Computing them substitutes the
 * inputs and restores them, so it can run on a throw-away draft.
 */
export function dataTableUpdates(
  ctx: Context,
  sheetId?: string
): DataTableUpdate[] {
  const out: DataTableUpdate[] = [];
  ctx.luckysheetfile.forEach((sheet) => {
    const { data, id } = sheet;
    if (!sheet.dataTables?.length || !data || id == null) return;
    if (sheetId != null && id !== sheetId) return;
    withSheet(ctx, id, () => {
      sheet.dataTables!.forEach((t) => {
        const values = computeTable(ctx, data, t).filter(
          ({ r, c, v, fa }) => bodyCell(data[r]?.[c], v, fa) != null
        );
        if (values.length) out.push({ sheetId: id, tableId: t.id, values });
      });
    });
  });
  return out;
}

/** Write computed body values and recalculate what depends on them. */
export function applyDataTableUpdates(
  ctx: Context,
  updates: DataTableUpdate[]
) {
  updates.forEach((u) => {
    const sheet = sheetById(ctx, u.sheetId);
    if (!sheet?.data) return;
    const { data } = sheet;
    withSheet(ctx, u.sheetId, () => {
      if (writeBody(data, u.values)) {
        recalcFrom(
          ctx,
          data,
          u.values.map(({ r, c }) => ({ r, c }))
        );
      }
    });
  });
}

/**
 * Recompute the data tables of a sheet (default: every loaded sheet with
 * data tables). Returns true when a body value changed.
 */
export function recalcDataTables(ctx: Context, sheetId?: string) {
  const updates = dataTableUpdates(ctx, sheetId);
  applyDataTableUpdates(ctx, updates);
  return updates.length > 0;
}

/** Whether any loaded sheet has data tables. */
export function hasDataTables(ctx: Context) {
  return ctx.luckysheetfile.some((s) => (s.dataTables?.length ?? 0) > 0);
}

/** Remove the data table whose body contains the cell (values stay). */
export function removeDataTable(ctx: Context, id: string) {
  const sheet = sheetById(ctx);
  if (!sheet?.dataTables) return false;
  const next = sheet.dataTables.filter((t) => t.id !== id);
  if (next.length === sheet.dataTables.length) return false;
  if (next.length) sheet.dataTables = next;
  else delete sheet.dataTables;
  return true;
}

registerEditGuard("dataTable", (ctx, ranges, kind) => {
  const sheet = sheetById(ctx);
  if (!sheet?.dataTables?.length) return null;
  const covered: string[] = [];
  for (let i = 0; i < sheet.dataTables.length; i += 1) {
    const t = sheet.dataTables[i];
    const body = bodyOf(t);
    const hits = ranges.some(
      (rg) =>
        !(
          rg.row[1] < body.row[0] ||
          body.row[1] < rg.row[0] ||
          rg.column[1] < body.column[0] ||
          body.column[1] < rg.column[0]
        )
    );
    if (!hits) continue;
    const whole = ranges.some(
      (rg) =>
        rg.row[0] <= body.row[0] &&
        rg.row[1] >= body.row[1] &&
        rg.column[0] <= body.column[0] &&
        rg.column[1] >= body.column[1]
    );
    if (kind === "clear" && whole) {
      covered.push(t.id);
    } else {
      return cellToolsLocale(ctx).dataTable.partError;
    }
  }
  covered.forEach((id) => removeDataTable(ctx, id));
  return null;
});
