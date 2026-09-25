/**
 * Excel's calculation options (Formulas > Calculation Options) and the
 * explicit recalculation commands.
 *
 * - Mode: `auto` (recalculate dependents after every change), `autoNoTable`
 *   (automatic except data tables: data-table owners ask
 *   `isDataTableRecalcDeferred`) and `manual` (changes only mark the
 *   workbook dirty; F9 / Shift+F9 / Ctrl+Alt+F9 recalculate).
 * - Iterative calculation: formulas on a reference cycle are evaluated
 *   repeatedly (at most `maxIterations` passes, until no value changes by
 *   more than `maxChange`) instead of once.
 *
 * Storage: the options are part of the workbook JSON, on every sheet as
 * `calcSettings` (read from the first sheet carrying them, so deleting or
 * reordering sheets is harmless). `ctx.calcDefaults` (from the
 * `calculation` setting) applies while no sheet carries options. xlsx maps
 * them to `<calcPr>` (see the excel package).
 *
 * Engine hooks (formulaHelper.ts): `recalculate()` asks
 * `shouldDeferRecalculation` at its entry point and hands the changed cells
 * to `deferRecalculation` in manual mode; the commands below replay them.
 */
import type { Context } from "../context";
import type { CalcMode, CalcSettings } from "../types";
import { peek } from "./dependencyGraph";
import { groupValuesRefresh } from "./formula";
import {
  ChangedCell,
  getDependencyGraph,
  invalidateDependencyGraph,
  recalculate,
} from "./formulaHelper";

export type { CalcMode, CalcSettings } from "../types";

export const DEFAULT_CALC_SETTINGS: Required<CalcSettings> = {
  mode: "auto",
  iterate: false,
  maxIterations: 100,
  maxChange: 0.001,
  fullCalcOnLoad: false,
};

/** More pending cells than this: F9 recalculates everything instead. */
const MAX_PENDING = 20000;

const CALC_MODES: CalcMode[] = ["auto", "autoNoTable", "manual"];

/** Options with defaults filled in and out-of-range values clamped. */
export function normalizeCalcSettings(
  s: Partial<CalcSettings> | null | undefined
): Required<CalcSettings> {
  const out = { ...DEFAULT_CALC_SETTINGS };
  if (!s) return out;
  if (s.mode && CALC_MODES.includes(s.mode)) out.mode = s.mode;
  if (s.iterate != null) out.iterate = !!s.iterate;
  const n = Number(s.maxIterations);
  if (Number.isFinite(n)) out.maxIterations = Math.max(1, Math.min(32767, n));
  out.maxIterations = Math.round(out.maxIterations);
  const d = Number(s.maxChange);
  if (Number.isFinite(d) && d >= 0) out.maxChange = d;
  if (s.fullCalcOnLoad != null) out.fullCalcOnLoad = !!s.fullCalcOnLoad;
  return out;
}

/** The workbook's calculation options (never null). */
export function getCalcSettings(ctx: Context): Required<CalcSettings> {
  const c = peek(ctx);
  const files = peek(c.luckysheetfile) || [];
  for (let i = 0; i < files.length; i += 1) {
    const s = peek(files[i])?.calcSettings;
    if (s) return normalizeCalcSettings(peek(s));
  }
  return normalizeCalcSettings(peek(c.calcDefaults));
}

/**
 * Change the calculation options (merged into the current ones) and store
 * them on every sheet. Switching back to an automatic mode recalculates
 * what changed meanwhile, like Excel.
 */
export function setCalcSettings(ctx: Context, patch: Partial<CalcSettings>) {
  const before = getCalcSettings(ctx);
  const next = normalizeCalcSettings({ ...before, ...patch });
  ctx.luckysheetfile.forEach((sheet) => {
    sheet.calcSettings = { ...next };
  });
  if (before.mode === "manual" && next.mode !== "manual") {
    calculateNow(ctx); // eslint-disable-line no-use-before-define
  } else if (!before.iterate && next.iterate) {
    // cycles evaluated once so far: let them converge now
    calculateFull(ctx); // eslint-disable-line no-use-before-define
  }
  return next;
}

export function getCalcMode(ctx: Context): CalcMode {
  return getCalcSettings(ctx).mode;
}

/** Whether data tables wait for an explicit recalculation (F9). */
export function isDataTableRecalcDeferred(ctx: Context) {
  return getCalcSettings(ctx).mode !== "auto";
}

/** Set while an explicit recalculation (F9, ...) runs. */
let forcing = 0;

/**
 * Gate at the recalculation entry point: true when dependents must not be
 * evaluated now (manual mode outside an explicit recalculation).
 */
export function shouldDeferRecalculation(ctx: Context) {
  return forcing === 0 && getCalcMode(ctx) === "manual";
}

/** Remember cells whose dependents wait for the next F9. */
export function deferRecalculation(ctx: Context, changed: ChangedCell[]) {
  const fc = ctx.formulaCache;
  if (!fc.pendingRecalc) fc.pendingRecalc = { cells: new Map(), full: false };
  const pending = fc.pendingRecalc;
  pending.token = pending.token ?? fc.formulaCellInfoMap;
  if (pending.token !== fc.formulaCellInfoMap) {
    // rows/columns moved since: the remembered positions are stale
    pending.full = true;
  }
  if (!pending.full) {
    for (let i = 0; i < changed.length; i += 1) {
      const { r, c, id } = changed[i];
      pending.cells.set(`${r}_${c}_${id}`, { r, c, id });
    }
    if (pending.cells.size > MAX_PENDING) pending.full = true;
  }
  if (pending.full) pending.cells.clear();
  // the status bar's "Calculate" (plain boolean so React sees the change)
  if (!ctx.calculationPending) ctx.calculationPending = true;
}

/** Whether recalculation is pending (manual mode, "Calculate" shown). */
export function isCalculationPending(ctx: Context) {
  return !!ctx.calculationPending;
}

function clearPending(ctx: Context) {
  ctx.formulaCache.pendingRecalc = undefined;
  if (ctx.calculationPending) ctx.calculationPending = false;
}

function runForced(ctx: Context, fn: () => void) {
  const fc = ctx.formulaCache;
  forcing += 1;
  fc.execFunctionGlobalData = {};
  try {
    fn();
  } finally {
    forcing -= 1;
  }
  groupValuesRefresh(ctx);
  fc.execFunctionGlobalData = null;
}

/**
 * F9: recalculate the formulas that depend on cells changed since the last
 * calculation (plus volatile formulas) in every sheet.
 */
export function calculateNow(ctx: Context) {
  const pending = ctx.formulaCache.pendingRecalc;
  runForced(ctx, () => {
    if (
      pending &&
      (pending.full || pending.token !== ctx.formulaCache.formulaCellInfoMap)
    ) {
      recalculate(ctx, [], null, { isForce: true });
    } else {
      recalculate(ctx, pending ? Array.from(pending.cells.values()) : [], null);
    }
  });
  clearPending(ctx);
}

/** Shift+F9: recalculate every formula of the active sheet. */
export function calculateSheet(ctx: Context, sheetId = ctx.currentSheetId) {
  runForced(ctx, () => {
    recalculate(ctx, [], null, { isForce: true, sheetIds: [sheetId] });
  });
  const pending = ctx.formulaCache.pendingRecalc;
  if (pending && !pending.full) {
    Array.from(pending.cells.keys()).forEach((key) => {
      if (pending.cells.get(key)!.id === sheetId) pending.cells.delete(key);
    });
    if (pending.cells.size === 0) clearPending(ctx);
  }
}

/**
 * Ctrl+Alt+F9: rebuild the dependency graph and recalculate every formula
 * of the workbook.
 */
export function calculateFull(ctx: Context) {
  invalidateDependencyGraph(ctx);
  getDependencyGraph(ctx);
  runForced(ctx, () => {
    recalculate(ctx, [], null, { isForce: true });
  });
  clearPending(ctx);
}
