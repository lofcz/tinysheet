/**
 * Recalculation benchmarks.
 *
 * Skipped by default. Run with:
 *   TINYSHEET_BENCH=1 npx jest packages/core/test/formula/perf-recalc
 * Optionally scale the sheets with TINYSHEET_BENCH_SCALE (default 1).
 *
 * A small smoke version always runs with a generous time bound so an
 * accidental O(n^2) regression still fails CI.
 */
import { produce } from "immer";
import {
  makeSheet,
  makeCtx,
  putFormula,
  putValue,
  loadWorkbook,
  edit,
  val,
} from "./recalc-helpers";
import { jfrefreshgrid, groupValuesRefresh } from "../../src";

const BENCH = !!process.env.TINYSHEET_BENCH;
const SCALE = Number(process.env.TINYSHEET_BENCH_SCALE || 1);
const REPS = Number(process.env.TINYSHEET_BENCH_REPS || 3);

function time(fn) {
  const t0 = performance.now();
  const res = fn();
  return [performance.now() - t0, res];
}

function fmt(ms) {
  return `${ms.toFixed(1)} ms`;
}

/** A1 = 1, A2 = A1+1, ... A{n} = A{n-1}+1 ; B column untouched values */
function chainWorkbook(n) {
  const s = makeSheet("Sheet1", "s1", n + 1, 3);
  putValue(s, 0, 0, 1);
  for (let r = 1; r < n; r += 1) putFormula(s, r, 0, `=A${r}+1`, r + 1);
  putValue(s, 0, 1, 1);
  return makeCtx([s]);
}

/**
 * A1:A{m} values, C1 = SUM(A1:A{m}), D{r} = $C$1 + B{r} for r in 1..n
 * (one big range formula fanned out to n dependents).
 */
function fanoutWorkbook(m, n) {
  const rows = Math.max(m, n) + 1;
  const s = makeSheet("Sheet1", "s1", rows, 5);
  for (let r = 0; r < m; r += 1) putValue(s, r, 0, 1);
  for (let r = 0; r < n; r += 1) putValue(s, r, 1, r);
  putFormula(s, 0, 2, `=SUM(A1:A${m})`, m);
  for (let r = 0; r < n; r += 1) putFormula(s, r, 3, `=$C$1+B${r + 1}`, m + r);
  return makeCtx([s]);
}

/** Sheet2!A{r} = Sheet1!A{r}*2 for r in 1..n */
function crossSheetWorkbook(n) {
  const s1 = makeSheet("Sheet1", "s1", n + 1, 2, 0);
  const s2 = makeSheet("Sheet2", "s2", n + 1, 2, 1);
  for (let r = 0; r < n; r += 1) {
    putValue(s1, r, 0, r);
    putFormula(s2, r, 0, `=Sheet1!A${r + 1}*2`, r * 2);
  }
  return makeCtx([s1, s2]);
}

/** B{r} = A{r}*2 for r in 1..n; many independent formulas */
function columnWorkbook(n) {
  const s = makeSheet("Sheet1", "s1", n + 1, 4);
  for (let r = 0; r < n; r += 1) {
    putValue(s, r, 0, r);
    putFormula(s, r, 1, `=A${r + 1}*2`, r * 2);
  }
  return makeCtx([s]);
}

function paste(ctx, r0, r1, c, v) {
  const s = ctx.luckysheetfile[0];
  for (let r = r0; r <= r1; r += 1) putValue(s, r, c, v);
  jfrefreshgrid(ctx, null, [{ row: [r0, r1], column: [c, c] }]);
  groupValuesRefresh(ctx);
}

function runSuite(n) {
  const results = {};

  // --- chain ---
  {
    const ctx = chainWorkbook(n);
    const [tLoad] = time(() => loadWorkbook(ctx));
    const [tFirst] = time(() => edit(ctx, 0, 0, "2"));
    const [tSecond] = time(() => edit(ctx, 0, 0, "3"));
    expect(val(ctx, n - 1, 0)).toBe(n + 2);
    const [tUnrelated] = time(() => edit(ctx, 0, 1, "5"));
    const [tTail] = time(() => edit(ctx, n - 2, 0, "=A1+100"));
    expect(val(ctx, n - 1, 0)).toBe(104);
    results[`chain ${n}: load`] = tLoad;
    results[`chain ${n}: edit head (1st)`] = tFirst;
    results[`chain ${n}: edit head (2nd)`] = tSecond;
    results[`chain ${n}: edit unrelated cell`] = tUnrelated;
    results[`chain ${n}: edit formula near tail`] = tTail;
  }

  // --- fan-out ---
  {
    const m = Math.min(5000, n);
    const ctx = fanoutWorkbook(m, n);
    const [tLoad] = time(() => loadWorkbook(ctx));
    const [tFirst] = time(() => edit(ctx, 4, 0, "2")); // A5 in SUM(A1:Am)
    expect(val(ctx, 0, 2)).toBe(m + 1);
    expect(val(ctx, n - 1, 3)).toBe(m + 1 + n - 1);
    const [tLeaf] = time(() => edit(ctx, 6, 1, "1000")); // B7 -> only D7
    expect(val(ctx, 6, 3)).toBe(m + 1 + 1000);
    results[`fan-out SUM(A1:A${m}) x${n}: load`] = tLoad;
    results[`fan-out: edit A5 (1st)`] = tFirst;
    results[`fan-out: edit leaf input B7`] = tLeaf;
  }

  // --- cross-sheet ---
  {
    const ctx = crossSheetWorkbook(n);
    const [tLoad] = time(() => loadWorkbook(ctx));
    const [tFirst] = time(() => edit(ctx, 9, 0, "1000", "s1"));
    const [tSecond] = time(() => edit(ctx, 10, 0, "1000", "s1"));
    expect(val(ctx, 9, 0, "s2")).toBe(2000);
    expect(val(ctx, 10, 0, "s2")).toBe(2000);
    results[`cross-sheet ${n}: load`] = tLoad;
    results[`cross-sheet: edit (1st)`] = tFirst;
    results[`cross-sheet: edit (2nd)`] = tSecond;
  }

  // --- many independent formulas: unrelated edit + paste ---
  {
    const big = n * 5;
    const ctx = columnWorkbook(big);
    const [tLoad] = time(() => loadWorkbook(ctx));
    const [tFirst] = time(() => edit(ctx, 0, 3, "1")); // D1: no dependents
    const [tSecond] = time(() => edit(ctx, 1, 3, "1"));
    const [tPaste] = time(() => paste(ctx, 100, 1099, 0, 7));
    expect(val(ctx, 100, 1)).toBe(14);
    expect(val(ctx, 1099, 1)).toBe(14);
    expect(val(ctx, 1100, 1)).toBe(2200);
    results[`${big} formulas: load`] = tLoad;
    results[`${big} formulas: unrelated edit (1st)`] = tFirst;
    results[`${big} formulas: unrelated edit (2nd)`] = tSecond;
    results[`${big} formulas: paste 1000 inputs`] = tPaste;
  }

  // --- same edits inside immer produce() (default autoFreeze), like the
  // React Workbook does ---
  {
    let ctx = chainWorkbook(n);
    loadWorkbook(ctx);
    const [tChain] = time(() => {
      ctx = produce(ctx, (d) => edit(d, 0, 0, "2"));
    });
    const [tChain2] = time(() => {
      ctx = produce(ctx, (d) => edit(d, 0, 0, "3"));
    });
    expect(val(ctx, n - 1, 0)).toBe(n + 2);
    let ctx2 = columnWorkbook(n * 5);
    loadWorkbook(ctx2);
    const [tUnrelated] = time(() => {
      ctx2 = produce(ctx2, (d) => edit(d, 0, 3, "1"));
    });
    const [tUnrelated2] = time(() => {
      ctx2 = produce(ctx2, (d) => edit(d, 1, 3, "1"));
    });
    const [tPaste] = time(() => {
      ctx2 = produce(ctx2, (d) => paste(d, 100, 1099, 0, 7));
    });
    expect(val(ctx2, 1099, 1)).toBe(14);
    results[`immer: chain ${n} edit head (1st)`] = tChain;
    results[`immer: chain ${n} edit head (2nd)`] = tChain2;
    results[`immer: ${n * 5} formulas unrelated edit (1st)`] = tUnrelated;
    results[`immer: ${n * 5} formulas unrelated edit (2nd)`] = tUnrelated2;
    results[`immer: ${n * 5} formulas paste 1000 inputs`] = tPaste;
  }

  return results;
}

describe("recalc performance smoke", () => {
  test("2k-formula workbook stays well within bounds", () => {
    const results = runSuite(2000);
    const total = Object.values(results).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(60000);
  }, 120000);
});

(BENCH ? describe : describe.skip)("recalc benchmark", () => {
  test(
    "10k formulas",
    () => {
      // best of REPS runs: the machine may be noisy
      const best = {};
      for (let i = 0; i < REPS; i += 1) {
        const results = runSuite(10000 * SCALE);
        Object.entries(results).forEach(([k, v]) => {
          best[k] = Math.min(best[k] ?? Infinity, v);
        });
      }
      // eslint-disable-next-line no-console
      console.log(
        Object.entries(best)
          .map(([k, v]) => `${k.padEnd(44)} ${fmt(v)}`)
          .join("\n")
      );
      expect(Object.keys(best).length).toBeGreaterThan(0);
    },
    30 * 60 * 1000
  );
});
