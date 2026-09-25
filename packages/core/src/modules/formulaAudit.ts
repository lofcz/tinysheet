/**
 * Formula auditing (Excel's Formulas > Formula Auditing group):
 *
 * - Trace Precedents / Trace Dependents: arrows between cells, one more
 *   level per repeated command, kept in `ctx.traceArrows` and drawn by the
 *   React overlay (TraceArrows). Precedent ranges get a box, references to
 *   other sheets a dashed arrow to a worksheet icon, arrows from cells
 *   holding an error are red. Remove Arrows clears them.
 * - Show Formulas (Ctrl+`): formula cells display their formula text (a
 *   cell decorator), per sheet in `ctx.showFormulas`.
 * - Watch Window: cells whose value and formula are listed live
 *   (`ctx.watchWindow`).
 *
 * Evaluate Formula lives in evaluateFormula.ts, error checking in
 * errorChecking.ts and the calculation options in calculation.ts.
 */
import type { Context } from "../context";
import type { Cell } from "../types";
import { getSheetIndex } from "../utils";
import { buildFormulaCellInfo, getDirectDependents } from "./formulaHelper";
import { getCanvasTheme } from "../theme";
import { getFontSet } from "./text";
import { indexToColumn } from "./refAdjust";
import { nameOfRange, sheetNameById } from "./names";
import { quoteSheetName } from "./formulaFunctions";
import {
  calculateFull,
  calculateNow,
  calculateSheet,
  getCalcMode,
} from "./calculation";
import { registerCellDecorator, registerShortcut } from "./extensions";

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

const ERROR_RE =
  /^#(?:DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|SPILL!|CALC!|GETTING_DATA)$/;

/** Whether a cell value is an Excel error (#DIV/0!, #N/A, ...). */
export function isErrorValue(v: unknown) {
  return typeof v === "string" && ERROR_RE.test(v);
}

function sheetData(ctx: Context, sheetId: string) {
  const i = getSheetIndex(ctx, sheetId);
  return i == null ? null : (ctx.luckysheetfile[i]?.data ?? null);
}

function cellAt(ctx: Context, sheetId: string, r: number, c: number) {
  return sheetData(ctx, sheetId)?.[r]?.[c] ?? null;
}

function formulaOf(cell: Cell | null | undefined) {
  const f = cell?.f;
  return typeof f === "string" && f.length > 1 && f.charAt(0) === "="
    ? f
    : null;
}

/** The active cell of the current sheet. */
export function activeCell(ctx: Context) {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return null;
  return {
    r: sel.row_focus ?? sel.row[0],
    c: sel.column_focus ?? sel.column[0],
  };
}

/** `A1` / `$A$1` address of a cell. */
export function cellAddress(r: number, c: number, absolute = false) {
  const d = absolute ? "$" : "";
  return `${d}${indexToColumn(c)}${d}${r + 1}`;
}

/** `Sheet1!$A$1` (sheet names quoted when needed). */
export function qualifiedCellAddress(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
) {
  const name = sheetNameById(ctx, sheetId) ?? "";
  return `${quoteSheetName(name)}!${cellAddress(r, c, true)}`;
}

/* ------------------------------------------------------------------------ */
/* Precedents / dependents                                                  */
/* ------------------------------------------------------------------------ */

export type AuditRange = {
  sheetId: string;
  row: [number, number];
  column: [number, number];
};

/**
 * Direct precedents of the formula in (r, c): literal references, names
 * and tables resolved to their cells, INDIRECT/OFFSET targets seen by the
 * last calculation. The cell's own spill area is not a precedent.
 */
export function getFormulaPrecedents(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): AuditRange[] {
  const cell = cellAt(ctx, sheetId, r, c) as any;
  const f = formulaOf(cell);
  if (!f) return [];
  const info = buildFormulaCellInfo(ctx, r, c, sheetId, f);
  const sp = cell?.spill as { rs: number; cs: number } | undefined;
  const seen = new Set<string>();
  const out: AuditRange[] = [];
  info.formulaDependency.forEach((dep) => {
    if (dep.sheetId == null) return;
    const row: [number, number] = [dep.row[0], dep.row[1]];
    const column: [number, number] = [dep.column[0], dep.column[1]];
    if (
      sp &&
      dep.sheetId === sheetId &&
      row[0] >= r &&
      row[1] < r + sp.rs &&
      column[0] >= c &&
      column[1] < c + sp.cs
    ) {
      return;
    }
    const key = `${dep.sheetId}|${row}|${column}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ sheetId: dep.sheetId, row, column });
  });
  return out;
}

/** Formula cells reading (r, c) directly. */
export function getCellDependents(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
) {
  return getDirectDependents(ctx, sheetId, [r, r], [c, c]).filter(
    (d) => !(d.id === sheetId && d.r === r && d.c === c)
  );
}

/** Whether a block holds an error value (scans at most `limit` cells). */
function rangeHasError(ctx: Context, range: AuditRange, limit = 4096) {
  const data = sheetData(ctx, range.sheetId);
  if (!data) return false;
  let n = 0;
  const r1 = Math.min(range.row[1], data.length - 1);
  for (let r = range.row[0]; r <= r1; r += 1) {
    const row = data[r];
    if (row) {
      const c1 = Math.min(range.column[1], row.length - 1);
      for (let c = range.column[0]; c <= c1; c += 1) {
        if (isErrorValue(row[c]?.v)) return true;
        n += 1;
        if (n >= limit) return false;
      }
    }
  }
  return false;
}

/** Formula cells inside a block (at most `limit` cells scanned). */
function formulaCellsIn(ctx: Context, range: AuditRange, limit = 10000) {
  const data = sheetData(ctx, range.sheetId);
  const out: { r: number; c: number }[] = [];
  if (!data) return out;
  let n = 0;
  const r1 = Math.min(range.row[1], data.length - 1);
  for (let r = range.row[0]; r <= r1 && n < limit; r += 1) {
    const row = data[r];
    if (row) {
      const c1 = Math.min(range.column[1], row.length - 1);
      for (let c = range.column[0]; c <= c1 && n < limit; c += 1) {
        if (formulaOf(row[c])) out.push({ r, c });
        n += 1;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Trace arrows                                                             */
/* ------------------------------------------------------------------------ */

export type TraceArrowKind = "precedent" | "dependent";

/**
 * An arrow in data-flow direction: from a precedent (cell or range) to the
 * formula reading it.
 */
export type TraceArrow = {
  kind: TraceArrowKind;
  from: AuditRange;
  to: { sheetId: string; r: number; c: number };
  /** the source holds an error value (drawn red) */
  error?: boolean;
};

export type TraceArrowsState = {
  arrows: TraceArrow[];
  /** cells ("id!r_c") whose precedents / dependents are drawn */
  expanded: Record<TraceArrowKind, string[]>;
};

export type TraceResult = "added" | "noFormula" | "none";

const cellKey = (sheetId: string, r: number, c: number) =>
  `${sheetId}!${r}_${c}`;

function arrowKey(a: TraceArrow) {
  return `${a.kind}|${a.from.sheetId}|${a.from.row}|${a.from.column}|${a.to.sheetId}|${a.to.r}|${a.to.c}`;
}

function traceState(ctx: Context): TraceArrowsState {
  if (!ctx.traceArrows) {
    ctx.traceArrows = {
      arrows: [],
      expanded: { precedent: [], dependent: [] },
    };
  }
  return ctx.traceArrows;
}

function addArrows(ctx: Context, arrows: TraceArrow[]) {
  const state = traceState(ctx);
  const keys = new Set(state.arrows.map(arrowKey));
  let added = 0;
  arrows.forEach((a) => {
    const k = arrowKey(a);
    if (!keys.has(k)) {
      keys.add(k);
      state.arrows.push(a);
      added += 1;
    }
  });
  return added;
}

function precedentArrowsOf(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): TraceArrow[] {
  return getFormulaPrecedents(ctx, sheetId, r, c).map((from) => ({
    kind: "precedent",
    from,
    to: { sheetId, r, c },
    error: rangeHasError(ctx, from) || undefined,
  }));
}

function dependentArrowsOf(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): TraceArrow[] {
  const from: AuditRange = { sheetId, row: [r, r], column: [c, c] };
  const error = isErrorValue(cellAt(ctx, sheetId, r, c)?.v) || undefined;
  return getCellDependents(ctx, sheetId, r, c).map((d) => ({
    kind: "dependent",
    from,
    to: { sheetId: d.id, r: d.r, c: d.c },
    error,
  }));
}

/**
 * Trace Precedents from the active cell: its direct precedents first, then
 * (repeated) the precedents of the formulas found at the previous level.
 */
export function tracePrecedents(ctx: Context): TraceResult {
  const at = activeCell(ctx);
  if (!at) return "none";
  const sheetId = ctx.currentSheetId;
  if (!formulaOf(cellAt(ctx, sheetId, at.r, at.c))) return "noFormula";
  const state = traceState(ctx);
  const expanded = new Set(state.expanded.precedent);
  const originKey = cellKey(sheetId, at.r, at.c);
  let targets: { sheetId: string; r: number; c: number }[] = [];
  if (!expanded.has(originKey)) {
    targets = [{ sheetId, r: at.r, c: at.c }];
  } else {
    // one level further: formulas among the sources reachable backwards
    const seen = new Set<string>([originKey]);
    const queue = [{ sheetId, r: at.r, c: at.c }];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      state.arrows.forEach((a) => {
        if (
          a.kind !== "precedent" ||
          a.to.sheetId !== cur.sheetId ||
          a.to.r !== cur.r ||
          a.to.c !== cur.c
        ) {
          return;
        }
        formulaCellsIn(ctx, a.from).forEach(({ r, c }) => {
          const k = cellKey(a.from.sheetId, r, c);
          if (seen.has(k)) return;
          seen.add(k);
          const next = { sheetId: a.from.sheetId, r, c };
          if (expanded.has(k)) queue.push(next);
          else targets.push(next);
        });
      });
    }
  }
  let added = 0;
  targets.forEach((t) => {
    state.expanded.precedent.push(cellKey(t.sheetId, t.r, t.c));
    added += addArrows(ctx, precedentArrowsOf(ctx, t.sheetId, t.r, t.c));
  });
  return added > 0 ? "added" : "none";
}

/**
 * Trace Dependents from the active cell: the formulas reading it, then
 * (repeated) the formulas reading those.
 */
export function traceDependents(ctx: Context): TraceResult {
  const at = activeCell(ctx);
  if (!at) return "none";
  const sheetId = ctx.currentSheetId;
  const state = traceState(ctx);
  const expanded = new Set(state.expanded.dependent);
  const originKey = cellKey(sheetId, at.r, at.c);
  let targets: { sheetId: string; r: number; c: number }[] = [];
  if (!expanded.has(originKey)) {
    targets = [{ sheetId, r: at.r, c: at.c }];
  } else {
    const seen = new Set<string>([originKey]);
    const queue = [{ sheetId, r: at.r, c: at.c }];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      state.arrows.forEach((a) => {
        if (
          a.kind !== "dependent" ||
          a.from.sheetId !== cur.sheetId ||
          a.from.row[0] !== cur.r ||
          a.from.column[0] !== cur.c
        ) {
          return;
        }
        const k = cellKey(a.to.sheetId, a.to.r, a.to.c);
        if (seen.has(k)) return;
        seen.add(k);
        if (expanded.has(k)) queue.push(a.to);
        else targets.push(a.to);
      });
    }
  }
  let added = 0;
  targets.forEach((t) => {
    state.expanded.dependent.push(cellKey(t.sheetId, t.r, t.c));
    added += addArrows(ctx, dependentArrowsOf(ctx, t.sheetId, t.r, t.c));
  });
  return added > 0 ? "added" : "none";
}

/** Remove Arrows (all), Remove Precedent Arrows or Remove Dependent Arrows. */
export function removeTraceArrows(ctx: Context, kind?: TraceArrowKind) {
  if (!ctx.traceArrows) return;
  if (!kind) {
    ctx.traceArrows = undefined;
    return;
  }
  const arrows = ctx.traceArrows.arrows.filter((a) => a.kind !== kind);
  const expanded = { ...ctx.traceArrows.expanded, [kind]: [] };
  ctx.traceArrows =
    arrows.length > 0 || expanded.precedent.length || expanded.dependent.length
      ? { arrows, expanded }
      : undefined;
}

/** Arrows touching the given sheet (what the overlay draws). */
export function getTraceArrows(ctx: Context, sheetId = ctx.currentSheetId) {
  return (ctx.traceArrows?.arrows ?? []).filter(
    (a) => a.from.sheetId === sheetId || a.to.sheetId === sheetId
  );
}

/* ------------------------------------------------------------------------ */
/* Show Formulas                                                            */
/* ------------------------------------------------------------------------ */

export function isShowFormulas(ctx: Context, sheetId = ctx.currentSheetId) {
  return !!ctx.showFormulas?.[sheetId];
}

/** Show Formulas on/off for the current sheet (Ctrl+`). */
export function toggleShowFormulas(ctx: Context, on?: boolean) {
  const id = ctx.currentSheetId;
  const next = on ?? !isShowFormulas(ctx, id);
  ctx.showFormulas = { ...(ctx.showFormulas ?? {}), [id]: next };
}

/* ------------------------------------------------------------------------ */
/* Watch Window                                                             */
/* ------------------------------------------------------------------------ */

export type WatchEntry = { sheetId: string; r: number; c: number };

export type WatchRow = WatchEntry & {
  key: string;
  sheet: string;
  name: string;
  cell: string;
  value: string;
  formula: string;
};

/** Most watches Excel keeps. */
const MAX_WATCHES = 1000;

export function openWatchWindow(ctx: Context, open = true) {
  ctx.watchWindow = {
    watches: ctx.watchWindow?.watches ?? [],
    open,
  };
}

/** Add Watch: every cell of the selection (of the current sheet). */
export function addWatchesForSelection(ctx: Context) {
  const sheetId = ctx.currentSheetId;
  const watches = [...(ctx.watchWindow?.watches ?? [])];
  const have = new Set(watches.map((w) => cellKey(w.sheetId, w.r, w.c)));
  (ctx.luckysheet_select_save ?? []).forEach((s) => {
    for (let r = s.row[0]; r <= s.row[1]; r += 1) {
      for (let c = s.column[0]; c <= s.column[1]; c += 1) {
        const k = cellKey(sheetId, r, c);
        if (!have.has(k) && watches.length < MAX_WATCHES) {
          have.add(k);
          watches.push({ sheetId, r, c });
        }
      }
    }
  });
  ctx.watchWindow = { open: true, watches };
}

export function deleteWatches(ctx: Context, keys: string[]) {
  if (!ctx.watchWindow) return;
  const drop = new Set(keys);
  ctx.watchWindow = {
    ...ctx.watchWindow,
    watches: ctx.watchWindow.watches.filter(
      (w) => !drop.has(cellKey(w.sheetId, w.r, w.c))
    ),
  };
}

function displayValue(cell: Cell | null) {
  if (!cell) return "";
  const m = cell.m ?? cell.v;
  if (m == null) return "";
  if (typeof m === "boolean") return m ? "TRUE" : "FALSE";
  return String(m);
}

/** Watch Window rows with live values (deleted sheets are skipped). */
export function getWatchRows(ctx: Context): WatchRow[] {
  const out: WatchRow[] = [];
  (ctx.watchWindow?.watches ?? []).forEach((w) => {
    const sheet = sheetNameById(ctx, w.sheetId);
    if (sheet == null) return;
    const cell = cellAt(ctx, w.sheetId, w.r, w.c);
    out.push({
      ...w,
      key: cellKey(w.sheetId, w.r, w.c),
      sheet,
      name:
        nameOfRange(ctx, {
          sheetId: w.sheetId,
          row: [w.r, w.r],
          column: [w.c, w.c],
        }) ?? "",
      cell: cellAddress(w.r, w.c, true),
      value: displayValue(cell),
      formula: formulaOf(cell) ?? "",
    });
  });
  return out;
}

/* ------------------------------------------------------------------------ */
/* Canvas: Show Formulas decorator, shortcuts                               */
/* ------------------------------------------------------------------------ */

function drawFormulaText(args: {
  ctx: Context;
  renderCtx: CanvasRenderingContext2D;
  cell: Cell | null | undefined;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}) {
  const { ctx, renderCtx, cell, x, y, w, h, zoom } = args;
  if (!ctx.showFormulas || !isShowFormulas(ctx)) return false;
  const f = formulaOf(cell);
  if (!f) return false;
  renderCtx.beginPath();
  renderCtx.rect(x, y, w, h);
  renderCtx.clip();
  renderCtx.scale(zoom, zoom);
  renderCtx.font = getFontSet(
    { ...cell, bl: 0, it: 0 },
    ctx.defaultFontSize || 10,
    ctx
  );
  renderCtx.fillStyle = cell?.fc || getCanvasTheme(ctx).cellText;
  renderCtx.textBaseline = "middle";
  renderCtx.textAlign = "left";
  renderCtx.fillText(f, (x + 2 * zoom) / zoom, (y + h / 2) / zoom);
  return true;
}

let coreRegistered: (() => void) | null = null;

/**
 * Register the auditing and calculation pieces that live in the grid:
 * the Show Formulas cell decorator and the Ctrl+`, F9, Shift+F9 and
 * Ctrl+Alt+F9 shortcuts. Idempotent; returns an unregister function.
 */
export function registerFormulaAuditingCore() {
  if (coreRegistered) return coreRegistered;
  const offs = [
    registerCellDecorator("showFormulas", {
      drawContent: (args) => drawFormulaText(args),
    }),
    registerShortcut("showFormulas", {
      key: "`",
      mod: true,
      handler: (ctx) => {
        toggleShowFormulas(ctx);
      },
    }),
    registerShortcut("calculateNow", {
      key: "F9",
      handler: (ctx) => {
        calculateNow(ctx);
      },
    }),
    registerShortcut("calculateSheet", {
      key: "F9",
      shift: true,
      handler: (ctx) => {
        calculateSheet(ctx);
      },
    }),
    registerShortcut("calculateFull", {
      key: "F9",
      mod: true,
      alt: true,
      handler: (ctx) => {
        calculateFull(ctx);
      },
    }),
  ];
  coreRegistered = () => {
    offs.forEach((off) => off());
    coreRegistered = null;
  };
  return coreRegistered;
}

/** For status displays: whether the workbook calculates manually. */
export function isManualCalculation(ctx: Context) {
  return getCalcMode(ctx) === "manual";
}
