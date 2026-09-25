/**
 * Time-sliced recalculation: the scheduler API.
 *
 * A recalculation that affects many formulas (a long dependency chain, a
 * range read by thousands of formulas) would block the UI for as long as it
 * takes. When a host (the React Workbook) registers a scheduler with
 * `setRecalcScheduler`, a top-level recalculation evaluates formulas for at
 * most `getRecalcBudget()` ms, then leaves the rest of its topological order
 * in a queue and asks the host to continue (`runRecalcSlice`, in a state
 * update per animation frame) until the queue is empty. Meanwhile
 * `ctx.recalcProgress` holds the share done (0..1) for the status bar.
 *
 * Correctness does not depend on how the work is sliced:
 *
 * - the queue keeps the topological order, so a formula is evaluated after
 *   the formulas it reads;
 * - a recalculation started while another is queued removes the keys it
 *   evaluates from the old queue and appends its whole order: every formula
 *   still comes after its precedents (a formula that depends on a new root is
 *   in the new order);
 * - a recalculation of everything (after rows or columns moved) drops the
 *   queue;
 * - the first slice is part of the edit that caused it (one undo step);
 *   later slices are applied without an undo step, and undo/redo of an edit
 *   whose recalculation was sliced recalculates the formulas that depend on
 *   the cells it restored (see history.ts).
 *
 * Without a scheduler (headless use, tests) recalculation stays synchronous.
 * `flushRecalc` finishes a queued recalculation synchronously, for callers
 * that need values right away (the Workbook's `getCellValue`).
 *
 * The queue lives next to the formula cache (it survives state updates, like
 * the dependency graph). Calculation modes (automatic/manual) gate whether a
 * recalculation starts at all; slicing only splits the one that runs.
 */
import type { Context } from "../context";

/** Asks the host to call `runRecalcSlice` in a state update soon. */
export type RecalcScheduler = () => void;

type RecalcJob = {
  /** formula keys in evaluation order */
  queue: string[];
  /** position of the next key in `queue` */
  pos: number;
  /** keys evaluated since the job started (progress) */
  done: number;
  /** a slice has been requested from the host and has not run yet */
  requested: boolean;
  /** the dependency graph (formulaCellInfoMap) the keys were queued with */
  token: unknown;
};

const jobs = new WeakMap<object, RecalcJob>();
const schedulers = new WeakMap<object, RecalcScheduler>();
let budgetMs = 8;
let suspended = 0;
let epoch = 0;

function cacheOf(ctx: Context | null | undefined): object | null {
  const fc = ctx?.formulaCache as unknown;
  return fc && typeof fc === "object" ? (fc as object) : null;
}

/**
 * Registers (or with null removes) the host scheduler of the workbook whose
 * formula cache `ctx` uses. With a scheduler, long recalculations are
 * sliced.
 */
export function setRecalcScheduler(
  ctx: Context,
  scheduler: RecalcScheduler | null
) {
  const fc = cacheOf(ctx);
  if (!fc) return;
  if (scheduler) schedulers.set(fc, scheduler);
  else schedulers.delete(fc);
}

/** Time budget (ms) of a recalculation slice; 0 disables slicing. */
export function setRecalcBudget(ms: number) {
  budgetMs = Math.max(0, ms);
}

export function getRecalcBudget() {
  return budgetMs;
}

export function recalcNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * The time (performance.now()) by which a top-level recalculation should
 * stop and queue the rest, or null when it must run to completion.
 */
export function recalcDeadline(ctx: Context): number | null {
  const fc = cacheOf(ctx);
  if (!fc || suspended > 0 || budgetMs <= 0 || !schedulers.has(fc)) {
    return null;
  }
  return recalcNow() + budgetMs;
}

function progressOf(job: RecalcJob | undefined) {
  if (!job || job.pos >= job.queue.length) return undefined;
  return job.done / (job.done + job.queue.length - job.pos);
}

function setProgress(ctx: Context, job: RecalcJob | undefined) {
  const p = progressOf(job);
  // whole percents: the status bar does not re-render for every slice
  const progress = p === undefined ? undefined : Math.floor(p * 100) / 100;
  if (ctx.recalcProgress !== progress) ctx.recalcProgress = progress;
}

function requestSlice(ctx: Context, job: RecalcJob) {
  if (job.requested) return;
  const scheduler = schedulers.get(cacheOf(ctx)!);
  if (!scheduler) return;
  job.requested = true;
  scheduler();
}

/**
 * Queue `keys` (formula keys in evaluation order) to be evaluated in later
 * slices, after the keys already queued (see the module comment).
 */
export function deferRecalc(ctx: Context, keys: string[]) {
  const fc = cacheOf(ctx);
  if (!fc || keys.length === 0) return;
  epoch += 1;
  let job = jobs.get(fc);
  if (!job || job.pos >= job.queue.length) {
    job = {
      queue: keys.slice(),
      pos: 0,
      done: 0,
      requested: false,
      token: ctx.formulaCache?.formulaCellInfoMap,
    };
    jobs.set(fc, job);
  } else {
    // a key queued again moves to its new place: after its new precedents
    const incoming = new Set(keys);
    job.queue = job.queue
      .slice(job.pos)
      .filter((k) => !incoming.has(k))
      .concat(keys);
    job.pos = 0;
  }
  setProgress(ctx, job);
  requestSlice(ctx, job);
}

/** Whether a recalculation is queued. */
export function hasPendingRecalc(ctx: Context | null | undefined) {
  const job = jobs.get(cacheOf(ctx)!);
  return !!job && job.pos < job.queue.length;
}

/** Share of the queued recalculation done (0..1), or undefined. */
export function getRecalcProgress(ctx: Context): number | undefined {
  return progressOf(jobs.get(cacheOf(ctx)!));
}

/** Drop the queued recalculation (everything is being recalculated). */
export function cancelRecalc(ctx: Context) {
  const fc = cacheOf(ctx);
  if (!fc) return;
  jobs.delete(fc);
  if (ctx.recalcProgress !== undefined) ctx.recalcProgress = undefined;
}

/**
 * Counter increased whenever work is queued: callers compare it before and
 * after an update to know whether the update left a recalculation queued.
 */
export function recalcEpoch() {
  return epoch;
}

/**
 * The queue of the pending recalculation: evaluate `keys` from `from` on,
 * then report how far with `advanceRecalc`. `token` is the dependency graph
 * the keys were queued with (a rebuilt graph must index their sheets).
 * Not a copy: do not modify.
 */
export function recalcQueue(
  ctx: Context
): { keys: readonly string[]; from: number; token: unknown } | null {
  const fc = cacheOf(ctx);
  const job = fc ? jobs.get(fc) : undefined;
  if (!job || job.pos >= job.queue.length) return null;
  job.requested = false;
  return { keys: job.queue, from: job.pos, token: job.token };
}

/** The queue's keys now belong to the dependency graph `token`. */
export function setRecalcQueueToken(ctx: Context, token: unknown) {
  const job = jobs.get(cacheOf(ctx)!);
  if (job) job.token = token;
}

/**
 * After a slice evaluated `count` keys of the queue: moves on, updates
 * `ctx.recalcProgress` and asks for the next slice (or ends the job).
 */
export function advanceRecalc(ctx: Context, count: number) {
  const fc = cacheOf(ctx);
  if (!fc) return;
  const job = jobs.get(fc);
  if (!job) return;
  job.pos += count;
  job.done += count;
  if (job.pos >= job.queue.length) {
    jobs.delete(fc);
    setProgress(ctx, undefined);
    return;
  }
  setProgress(ctx, job);
  requestSlice(ctx, job);
}

/** Runs `fn` with slicing off (everything is evaluated right away). */
export function withoutRecalcSlicing<T>(fn: () => T): T {
  suspended += 1;
  try {
    return fn();
  } finally {
    suspended -= 1;
  }
}
