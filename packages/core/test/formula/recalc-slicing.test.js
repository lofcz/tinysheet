/**
 * Time-sliced recalculation (recalcScheduler.ts): with a host scheduler, a
 * long recalculation evaluates what fits in its budget and queues the rest;
 * slices finish it in order. The results must be those of a synchronous
 * recalculation, whatever happens in between.
 */
import {
  makeHost,
  type,
  val,
  parseA1,
  sheetOf,
} from "../editing/historyHarness";
import {
  setRecalcScheduler,
  setRecalcBudget,
  getRecalcBudget,
  hasPendingRecalc,
  getRecalcProgress,
} from "../../src/modules/recalcScheduler";
import { runRecalcSlice, flushRecalc } from "../../src/modules/formulaHelper";
import { groupValuesRefresh } from "../../src/modules/formula";

const N = 400;
const initialBudget = getRecalcBudget();

/** A1 = 1, A2 = A1+1, ..., A{N} = A{N-1}+1; B{r} = A{r}*2 (fan-out). */
function chainHost() {
  const host = makeHost({ rows: N + 5, cols: 4 });
  type(host, "A1", "1");
  for (let r = 2; r <= N; r += 1) type(host, `A${r}`, `=A${r - 1}+1`);
  for (let r = 1; r <= N; r += 10) type(host, `B${r}`, `=A${r}*2`);
  host.cache.undoList = [];
  return host;
}

function sliced(host) {
  let requests = 0;
  setRecalcScheduler(host.ctx, () => {
    requests += 1;
  });
  // a tiny budget: every slice evaluates only a few formulas
  setRecalcBudget(0.0001);
  return {
    get requests() {
      return requests;
    },
    /** Runs one slice as the Workbook does (a state update). */
    slice() {
      host.act((d) => runRecalcSlice(d), { noHistory: true });
    },
    finish() {
      let guard = 0;
      while (hasPendingRecalc(host.ctx) && guard < 10000) {
        guard += 1;
        this.slice();
      }
      expect(hasPendingRecalc(host.ctx)).toBe(false);
    },
  };
}

function columnValues(ctx, col, rows = N) {
  const out = [];
  for (let r = 1; r <= rows; r += 1) out.push(val(ctx, `${col}${r}`));
  return out;
}

afterEach(() => {
  setRecalcBudget(initialBudget);
});

describe("time-sliced recalculation", () => {
  test("without a scheduler recalculation stays synchronous", () => {
    const host = chainHost();
    type(host, "A1", "10");
    expect(hasPendingRecalc(host.ctx)).toBe(false);
    expect(val(host.ctx, `A${N}`)).toBe(N + 9);
  });

  test("a long chain is evaluated in slices, in order, with progress", () => {
    const host = chainHost();
    const s = sliced(host);
    type(host, "A1", "10");
    expect(hasPendingRecalc(host.ctx)).toBe(true);
    expect(s.requests).toBe(1);
    // not there yet
    expect(val(host.ctx, `A${N}`)).toBe(N);
    expect(host.ctx.recalcProgress).toBeGreaterThanOrEqual(0);
    expect(host.ctx.recalcProgress).toBeLessThan(1);
    const progress = [];
    let slices = 0;
    while (hasPendingRecalc(host.ctx)) {
      s.slice();
      slices += 1;
      progress.push(getRecalcProgress(host.ctx) ?? 1);
    }
    expect(progress).toEqual(progress.slice().sort((a, b) => a - b));
    expect(slices).toBeGreaterThan(3);
    expect(host.ctx.recalcProgress).toBeUndefined();
    expect(columnValues(host.ctx, "A")).toEqual(
      Array.from({ length: N }, (_v, i) => i + 10)
    );
    expect(val(host.ctx, "B391")).toBe((391 + 9) * 2);
  });

  test("results equal a synchronous recalculation after interleaved edits", () => {
    const ref = chainHost();
    type(ref, "A1", "10");
    type(ref, "A200", "5");
    type(ref, "C1", "=A400+A100");
    type(ref, "A1", "7");

    const host = chainHost();
    const s = sliced(host);
    type(host, "A1", "10");
    s.slice();
    // edit in the middle of the chain while the first recalculation is queued
    type(host, "A200", "5");
    s.slice();
    type(host, "C1", "=A400+A100");
    s.slice();
    type(host, "A1", "7");
    s.finish();
    ["A", "B"].forEach((col) => {
      expect(columnValues(host.ctx, col)).toEqual(columnValues(ref.ctx, col));
    });
    expect(val(host.ctx, "C1")).toBe(val(ref.ctx, "C1"));
  });

  test("flushRecalc finishes the queue synchronously", () => {
    const host = chainHost();
    sliced(host);
    type(host, "A1", "3");
    expect(hasPendingRecalc(host.ctx)).toBe(true);
    host.act(
      (d) => {
        flushRecalc(d);
        groupValuesRefresh(d);
      },
      { noHistory: true }
    );
    expect(hasPendingRecalc(host.ctx)).toBe(false);
    expect(host.ctx.recalcProgress).toBeUndefined();
    expect(val(host.ctx, `A${N}`)).toBe(N + 2);
  });

  test("undo and redo of a sliced edit leave consistent values", () => {
    const host = chainHost();
    const s = sliced(host);
    type(host, "A1", "10");
    s.finish();
    expect(val(host.ctx, `A${N}`)).toBe(N + 9);
    host.undo();
    s.finish();
    expect(val(host.ctx, "A1")).toBe(1);
    expect(columnValues(host.ctx, "A")).toEqual(
      Array.from({ length: N }, (_v, i) => i + 1)
    );
    host.redo();
    s.finish();
    expect(columnValues(host.ctx, "A")).toEqual(
      Array.from({ length: N }, (_v, i) => i + 10)
    );
    // undo while the slices are still running
    type(host, "A1", "100");
    s.slice();
    host.undo();
    s.finish();
    expect(columnValues(host.ctx, "A")).toEqual(
      Array.from({ length: N }, (_v, i) => i + 10)
    );
  });

  test("inserting rows drops the queue and recalculates everything", () => {
    const host = chainHost();
    const s = sliced(host);
    type(host, "A1", "10");
    expect(hasPendingRecalc(host.ctx)).toBe(true);
    const { r } = parseA1("A50");
    host.act(
      (d) => {
        // eslint-disable-next-line global-require
        const { insertRowCol } = require("../../src/modules/rowcol");
        insertRowCol(d, {
          type: "row",
          index: r,
          count: 2,
          direction: "lefttop",
          id: "id_1",
        });
      },
      {
        insertRowColOp: {
          type: "row",
          index: r,
          count: 2,
          direction: "lefttop",
          id: "id_1",
        },
      }
    );
    s.finish();
    expect(val(host.ctx, `A${N + 2}`)).toBe(N + 9);
    expect(sheetOf(host.ctx).data[49][0]).toBeNull();
  });
});
