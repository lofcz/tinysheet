// Regression and forecasting array functions: LINEST, LOGEST, TREND, GROWTH,
// FREQUENCY, FORECAST.ETS, FORECAST.ETS.CONFINT, FORECAST.ETS.SEASONALITY,
// FORECAST.ETS.STAT.
// See ./index.js for the calling convention.
//
// LINEST/LOGEST/TREND/GROWTH use ordinary least squares on centred data
// (Gauss-Jordan with pivot detection). As in Excel, a variable that is
// collinear with the previous ones is dropped: its coefficient and standard
// error are 0 and it does not count towards the degrees of freedom.
//
// FORECAST.ETS* implement additive Holt-Winters (level, trend, season: the
// "AAA" exponential smoothing model Excel documents) with the smoothing
// parameters chosen by minimising the one-step squared error on a grid, and
// seasonality detected from the autocorrelation of the detrended series.
// Excel's exact optimiser is undocumented, so results agree with Excel on
// data with an exact trend/season and are close (not digit-exact) otherwise.

import {
  ERROR_DIV_ZERO,
  ERROR_NOT_AVAILABLE,
  ERROR_NUM,
  ERROR_REF,
  ERROR_VALUE,
} from "../error";
import {
  dateToSerial,
  fail,
  isErrorValue,
  optNumber,
  toBoolean,
  toError,
  toGrid,
  toNumber,
} from "./math-stats";

const NA = () => new Error(ERROR_NOT_AVAILABLE);

function isOmitted(v) {
  return v === undefined || v === null;
}

function numericGrid(v) {
  if (isErrorValue(v)) throw toError(v);
  const grid = toGrid(v);
  return grid.map((row) =>
    row.map((x) => {
      if (isErrorValue(x)) throw toError(x);
      if (x instanceof Date) return dateToSerial(x);
      if (typeof x === "boolean") return x ? 1 : 0;
      if (typeof x !== "number") {
        if (typeof x === "string") {
          const n = Number(x);
          if (x.trim() !== "" && Number.isFinite(n)) return n;
        }
        fail(ERROR_VALUE);
      }
      return x;
    })
  );
}

function flat(grid) {
  const out = [];
  grid.forEach((row) => row.forEach((x) => out.push(x)));
  return out;
}

/**
 * Normalise (known_y's, known_x's) into y (n) and X (n x k).
 * orientation: "col" (variables are columns), "row" (variables are rows) or
 * "flat" (single variable, any shape).
 */
function design(knownY, knownX) {
  const gy = numericGrid(knownY);
  const ry = gy.length;
  const cy = gy[0].length;
  const y = flat(gy);
  const n = y.length;
  if (n === 0) fail(ERROR_VALUE);
  if (isOmitted(knownX)) {
    return {
      y,
      X: y.map((_, i) => [i + 1]),
      k: 1,
      orientation: "flat",
      shapeY: [ry, cy],
    };
  }
  const gx = numericGrid(knownX);
  const rx = gx.length;
  const cx = gx[0].length;
  if (rx === ry && cx === cy) {
    return {
      y,
      X: flat(gx).map((x) => [x]),
      k: 1,
      orientation: "flat",
      shapeY: [ry, cy],
    };
  }
  if (cy === 1 && rx === ry) {
    return { y, X: gx.map((row) => row.slice()), k: cx, orientation: "col" };
  }
  if (ry === 1 && cx === cy) {
    const X = [];
    for (let i = 0; i < cy; i++) X.push(gx.map((row) => row[i]));
    return { y, X, k: rx, orientation: "row" };
  }
  if ((ry === 1 || cy === 1) && (rx === 1 || cx === 1) && rx * cx === n) {
    return {
      y,
      X: flat(gx).map((x) => [x]),
      k: 1,
      orientation: "flat",
      shapeY: [ry, cy],
    };
  }
  return fail(ERROR_REF);
}

/**
 * Least squares fit of y on the columns of X.
 * Returns coefficients m (k), intercept b, standard errors and statistics.
 */
function leastSquares(y, X, useConst) {
  const n = y.length;
  const k = X[0].length;
  const meanX = new Array(k).fill(0);
  let meanY = 0;
  if (useConst) {
    for (let i = 0; i < n; i++) {
      meanY += y[i];
      for (let j = 0; j < k; j++) meanX[j] += X[i][j];
    }
    meanY /= n;
    for (let j = 0; j < k; j++) meanX[j] /= n;
  }
  // Normal equations on centred data: A = Xc'Xc, v = Xc'yc.
  const A = [];
  const v = new Array(k).fill(0);
  for (let a = 0; a < k; a++) A.push(new Array(k).fill(0));
  for (let i = 0; i < n; i++) {
    const yi = y[i] - meanY;
    for (let a = 0; a < k; a++) {
      const xa = X[i][a] - meanX[a];
      v[a] += xa * yi;
      for (let b = a; b < k; b++) A[a][b] += xa * (X[i][b] - meanX[b]);
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a];

  // Gauss-Jordan inverse restricted to the non-collinear variables.
  const inv = [];
  for (let a = 0; a < k; a++) {
    inv.push(new Array(k).fill(0));
    inv[a][a] = 1;
  }
  const M = A.map((row) => row.slice());
  const active = new Array(k).fill(true);
  for (let p = 0; p < k; p++) {
    const pivot = M[p][p];
    // A pivot that vanished relative to the variable's own sum of squares
    // means the variable is a combination of the previous ones.
    if (!(Math.abs(pivot) > 1e-10 * Math.abs(A[p][p])) || pivot === 0) {
      active[p] = false;
      for (let j = 0; j < k; j++) {
        M[p][j] = 0;
        M[j][p] = 0;
        inv[p][j] = 0;
        inv[j][p] = 0;
      }
      continue;
    }
    for (let j = 0; j < k; j++) {
      M[p][j] /= pivot;
      inv[p][j] /= pivot;
    }
    for (let r = 0; r < k; r++) {
      if (r === p) continue;
      const f = M[r][p];
      if (f === 0) continue;
      for (let j = 0; j < k; j++) {
        M[r][j] -= f * M[p][j];
        inv[r][j] -= f * inv[p][j];
      }
    }
  }
  const m = new Array(k).fill(0);
  for (let a = 0; a < k; a++) {
    if (!active[a]) continue;
    for (let b = 0; b < k; b++) if (active[b]) m[a] += inv[a][b] * v[b];
  }
  let b0 = 0;
  if (useConst) {
    b0 = meanY;
    for (let j = 0; j < k; j++) b0 -= m[j] * meanX[j];
  }
  let ssresid = 0;
  let sstot = 0;
  for (let i = 0; i < n; i++) {
    let fit = b0;
    for (let j = 0; j < k; j++) fit += m[j] * X[i][j];
    ssresid += (y[i] - fit) ** 2;
    sstot += useConst ? (y[i] - meanY) ** 2 : y[i] ** 2;
  }
  const kEff = active.filter(Boolean).length;
  const df = n - kEff - (useConst ? 1 : 0);
  const ssreg = sstot - ssresid;
  const sigma2 = df > 0 ? ssresid / df : NaN;
  const se = m.map((_, a) => (active[a] ? Math.sqrt(sigma2 * inv[a][a]) : 0));
  let seB = NaN;
  if (useConst) {
    let q = 0;
    for (let a = 0; a < k; a++)
      for (let b = 0; b < k; b++) q += meanX[a] * inv[a][b] * meanX[b];
    seB = Math.sqrt(sigma2 * (1 / n + q));
  }
  return {
    m,
    b: b0,
    se,
    seB,
    r2: sstot === 0 ? NaN : ssreg / sstot,
    sey: Math.sqrt(sigma2),
    F: kEff > 0 && df > 0 ? ssreg / kEff / (ssresid / df) : NaN,
    df,
    ssreg,
    ssresid,
    k,
  };
}

function finiteOr(x, code) {
  return Number.isFinite(x) ? x : new Error(code);
}

/** LINEST/LOGEST output table. `transform` maps coefficients (exp for LOGEST). */
function regressionTable(fit, useConst, stats, transform) {
  const { k } = fit;
  const first = [];
  for (let j = k - 1; j >= 0; j--) first.push(transform(fit.m[j]));
  first.push(useConst ? transform(fit.b) : transform(0));
  if (!stats) return [first];
  const width = k + 1;
  const pad = (row) => {
    while (row.length < width) row.push(NA());
    return row;
  };
  const seRow = [];
  for (let j = k - 1; j >= 0; j--) seRow.push(finiteOr(fit.se[j], ERROR_NUM));
  seRow.push(useConst ? finiteOr(fit.seB, ERROR_NUM) : NA());
  return [
    first,
    seRow,
    pad([finiteOr(fit.r2, ERROR_NUM), finiteOr(fit.sey, ERROR_NUM)]),
    pad([finiteOr(fit.F, ERROR_NUM), fit.df]),
    pad([fit.ssreg, fit.ssresid]),
  ];
}

function flag(value, def) {
  return isOmitted(value) ? def : toBoolean(value);
}

function logValues(y) {
  return y.map((v) => {
    if (!(v > 0)) fail(ERROR_NUM);
    return Math.log(v);
  });
}

function linest(knownY, knownX, constArg, statsArg, log) {
  const d = design(knownY, knownX);
  const useConst = flag(constArg, true);
  const stats = flag(statsArg, false);
  const y = log ? logValues(d.y) : d.y;
  if (y.length < 1) fail(ERROR_VALUE);
  const fit = leastSquares(y, d.X, useConst);
  return regressionTable(fit, useConst, stats, log ? Math.exp : (x) => x);
}

/** New x's for TREND/GROWTH as rows of variables plus the result shape. */
function newPoints(d, newX) {
  if (isOmitted(newX)) {
    if (d.orientation === "flat") {
      return { points: d.X, shape: d.shapeY };
    }
    if (d.orientation === "col") {
      return { points: d.X, shape: [d.X.length, 1] };
    }
    return { points: d.X, shape: [1, d.X.length] };
  }
  const g = numericGrid(newX);
  if (d.k === 1 && d.orientation !== "row" && d.orientation !== "col") {
    return {
      points: flat(g).map((x) => [x]),
      shape: [g.length, g[0].length],
    };
  }
  if (d.k === 1) {
    return {
      points: flat(g).map((x) => [x]),
      shape: [g.length, g[0].length],
    };
  }
  if (d.orientation === "col") {
    if (g[0].length !== d.k) fail(ERROR_REF);
    return { points: g, shape: [g.length, 1] };
  }
  if (g.length !== d.k) fail(ERROR_REF);
  const points = [];
  for (let i = 0; i < g[0].length; i++) points.push(g.map((row) => row[i]));
  return { points, shape: [1, g[0].length] };
}

function predict(knownY, knownX, newX, constArg, log) {
  const d = design(knownY, knownX);
  const useConst = flag(constArg, true);
  const y = log ? logValues(d.y) : d.y;
  const fit = leastSquares(y, d.X, useConst);
  const { points, shape } = newPoints(d, newX);
  const values = points.map((p) => {
    let v = fit.b;
    for (let j = 0; j < d.k; j++) v += fit.m[j] * p[j];
    return log ? Math.exp(v) : v;
  });
  const out = [];
  for (let r = 0; r < shape[0]; r++) {
    out.push(values.slice(r * shape[1], (r + 1) * shape[1]));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* FREQUENCY                                                                  */
/* -------------------------------------------------------------------------- */

function numbersOnly(v) {
  if (isErrorValue(v)) throw toError(v);
  if (!Array.isArray(v)) {
    if (typeof v === "number") return [v];
    if (typeof v === "boolean" || v === null || v === undefined) return [];
    if (typeof v === "string") {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) ? [n] : [];
    }
    return [];
  }
  const out = [];
  toGrid(v).forEach((row) =>
    row.forEach((x) => {
      if (isErrorValue(x)) throw toError(x);
      if (typeof x === "number") out.push(x);
      else if (x instanceof Date) out.push(dateToSerial(x));
    })
  );
  return out;
}

function FREQUENCY(data, bins) {
  if (bins === undefined) fail(ERROR_VALUE);
  const values = numbersOnly(data);
  const edges = numbersOnly(bins);
  if (!edges.length) return [[values.length]];
  const sorted = edges
    .map((edge, index) => ({ edge, index }))
    .sort((a, b) => a.edge - b.edge || a.index - b.index);
  const counts = new Array(edges.length + 1).fill(0);
  values.forEach((x) => {
    // First sorted edge >= x.
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].edge < x) lo = mid + 1;
      else hi = mid;
    }
    counts[lo < sorted.length ? sorted[lo].index : edges.length] += 1;
  });
  return counts.map((c) => [c]);
}

/* -------------------------------------------------------------------------- */
/* FORECAST.ETS                                                               */
/* -------------------------------------------------------------------------- */

const AGGREGATORS = {
  1: (xs) => xs.reduce((a, b) => a + b, 0) / xs.length,
  2: (xs) => xs.length,
  3: (xs) => xs.length,
  4: (xs) => Math.max(...xs),
  5: (xs) => {
    const s = xs.slice().sort((a, b) => a - b);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  },
  6: (xs) => Math.min(...xs),
  7: (xs) => xs.reduce((a, b) => a + b, 0),
};

/**
 * Regularise (values, timeline) into an evenly spaced series.
 * Returns { series, start, step }.
 */
function prepareSeries(values, timeline, completion, aggregation) {
  const vs = flat(toGrid(values));
  const ts = flat(toGrid(timeline));
  if (vs.length !== ts.length) fail(ERROR_VALUE);
  if (vs.length < 3) fail(ERROR_NUM);
  const complete = isOmitted(completion) ? 1 : Math.trunc(toNumber(completion));
  if (complete !== 0 && complete !== 1) fail(ERROR_NUM);
  const agg = isOmitted(aggregation) ? 1 : Math.trunc(toNumber(aggregation));
  if (!AGGREGATORS[agg]) fail(ERROR_NUM);

  const byTime = new Map();
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (isErrorValue(t)) throw toError(t);
    if (typeof t !== "number" && !(t instanceof Date)) fail(ERROR_VALUE);
    const time = t instanceof Date ? dateToSerial(t) : t;
    const v = vs[i];
    if (isErrorValue(v)) throw toError(v);
    if (!byTime.has(time)) byTime.set(time, []);
    if (typeof v === "number") byTime.get(time).push(v);
    else if (agg === 3 && v !== null && v !== undefined)
      byTime.get(time).push(0);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  if (times.length < 3) fail(ERROR_NUM);
  let step = Infinity;
  for (let i = 1; i < times.length; i++) {
    step = Math.min(step, times[i] - times[i - 1]);
  }
  if (!(step > 0)) fail(ERROR_NUM);
  for (let i = 1; i < times.length; i++) {
    const q = (times[i] - times[0]) / step;
    if (Math.abs(q - Math.round(q)) > 1e-9) fail(ERROR_NUM);
  }
  const length = Math.round((times[times.length - 1] - times[0]) / step) + 1;
  const series = new Array(length).fill(null);
  times.forEach((t) => {
    const xs = byTime.get(t);
    if (xs.length)
      series[Math.round((t - times[0]) / step)] = AGGREGATORS[agg](xs);
  });
  // Missing points: linear interpolation (completion 1) or zero.
  for (let i = 0; i < length; i++) {
    if (series[i] !== null) continue;
    if (complete === 0) {
      series[i] = 0;
      continue;
    }
    let prev = i - 1;
    while (prev >= 0 && series[prev] === null) prev--;
    let next = i + 1;
    while (next < length && series[next] === null) next++;
    if (prev < 0 && next >= length) series[i] = 0;
    else if (prev < 0) series[i] = series[next];
    else if (next >= length) series[i] = series[prev];
    else
      series[i] =
        series[prev] +
        ((series[next] - series[prev]) * (i - prev)) / (next - prev);
  }
  return { series, start: times[0], step, end: times[times.length - 1] };
}

function detectSeasonality(series) {
  const n = series.length;
  // Detrend with a least-squares line.
  const X = series.map((_, i) => [i]);
  const fit = leastSquares(series, X, true);
  const r = series.map((y, i) => y - (fit.b + fit.m[0] * i));
  const mean = r.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (r[i] - mean) ** 2;
  if (denom < 1e-12) return 1;
  const maxLag = Math.min(Math.floor(n / 2), 8760);
  let best = 1;
  let bestAcf = 0.3;
  const acf = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += (r[i] - mean) * (r[i - lag] - mean);
    acf[lag] = s / denom;
  }
  for (let lag = 2; lag <= maxLag; lag++) {
    const isPeak =
      acf[lag] >= acf[lag - 1] && (lag === maxLag || acf[lag] >= acf[lag + 1]);
    if (isPeak && acf[lag] > bestAcf + 1e-9) {
      best = lag;
      bestAcf = acf[lag];
    }
  }
  return best;
}

function seasonLength(seasonality, series) {
  if (isOmitted(seasonality)) return detectSeasonality(series);
  const s = Math.trunc(toNumber(seasonality));
  if (s < 0 || s > 8760) fail(ERROR_NUM);
  if (s === 1) return detectSeasonality(series);
  if (s === 0) return 1;
  if (s * 2 > series.length) fail(ERROR_NUM);
  return s;
}

/** Run Holt-Winters additive smoothing; returns state and one-step errors. */
function holtWinters(series, m, alpha, beta, gamma) {
  const n = series.length;
  const seasonal = m > 1;
  let level;
  let trend;
  const season = new Array(Math.max(m, 1)).fill(0);
  let start;
  if (seasonal) {
    let first = 0;
    let second = 0;
    for (let i = 0; i < m; i++) {
      first += series[i];
      second += series[i + m];
    }
    first /= m;
    second /= m;
    trend = (second - first) / m;
    level = first + (trend * (m - 1)) / 2;
    for (let i = 0; i < m; i++) {
      season[i] = series[i] - (first + trend * (i - (m - 1) / 2));
    }
    // Level at time m-1 (end of the first season).
    level = first + (trend * (m - 1)) / 2;
    start = m;
  } else {
    level = series[0];
    trend = series[1] - series[0];
    start = 1;
  }
  const errors = [];
  for (let t = start; t < n; t++) {
    const s = seasonal ? season[t % m] : 0;
    const forecast = level + trend + s;
    const y = series[t];
    errors.push(y - forecast);
    const prevLevel = level;
    level = alpha * (y - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    if (seasonal) season[t % m] = gamma * (y - level) + (1 - gamma) * s;
  }
  return { level, trend, season, errors, n };
}

function sse(errors) {
  return errors.reduce((a, e) => a + e * e, 0);
}

function fitEts(series, m) {
  const grid = [0.001, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];
  const gammas = m > 1 ? grid : [0];
  let best = null;
  grid.forEach((alpha) =>
    grid.forEach((beta) =>
      gammas.forEach((gamma) => {
        const run = holtWinters(series, m, alpha, beta, gamma);
        const cost = sse(run.errors);
        if (!best || cost < best.cost - 1e-12) {
          best = { alpha, beta, gamma, cost, run };
        }
      })
    )
  );
  // Local refinement around the best grid point (coordinate search).
  const keys = m > 1 ? ["alpha", "beta", "gamma"] : ["alpha", "beta"];
  let stepSize = 0.05;
  for (let iter = 0; iter < 30 && stepSize > 1e-4; iter++) {
    let improved = false;
    for (let k = 0; k < keys.length; k++) {
      for (let sign = -1; sign <= 1; sign += 2) {
        const key = keys[k];
        const value = best[key] + sign * stepSize;
        if (value >= 0.001 && value <= 0.999) {
          const trial = { ...best, [key]: value };
          const run = holtWinters(
            series,
            m,
            trial.alpha,
            trial.beta,
            trial.gamma
          );
          const cost = sse(run.errors);
          if (cost < best.cost - 1e-12) {
            best = { ...trial, cost, run };
            improved = true;
          }
        }
      }
    }
    if (!improved) stepSize /= 2;
  }
  return best;
}

function etsModel(values, timeline, seasonality, completion, aggregation) {
  const { series, step, end, start } = prepareSeries(
    values,
    timeline,
    completion,
    aggregation
  );
  const m = seasonLength(seasonality, series);
  if (m > 1 && series.length < 2 * m) fail(ERROR_NUM);
  const fit = fitEts(series, m);
  return { series, step, end, start, m, fit };
}

function horizon(model, target) {
  const t = toNumber(target);
  const h = (t - model.end) / model.step;
  if (h < 0) fail(ERROR_NUM);
  return h;
}

function etsForecast(model, h) {
  const { run } = model.fit;
  const { m } = model;
  const n = model.series.length;
  const whole = Math.max(1, Math.ceil(h - 1e-9));
  const s = m > 1 ? run.season[(n - 1 + whole) % m] : 0;
  return run.level + h * run.trend + s;
}

function FORECAST_ETS(
  target,
  values,
  timeline,
  seasonality,
  completion,
  aggregation
) {
  if (timeline === undefined) fail(ERROR_VALUE);
  const model = etsModel(
    values,
    timeline,
    seasonality,
    completion,
    aggregation
  );
  const h = horizon(model, target);
  if (h === 0) return model.series[model.series.length - 1];
  return etsForecast(model, h);
}

// Inverse of the standard normal CDF (Acklam's algorithm).
function normSInv(p) {
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269,
    -30.6647980661472, 2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197,
    -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878,
  ];
  const d = [
    0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742,
  ];
  const plow = 0.02425;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - plow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

function FORECAST_ETS_CONFINT(
  target,
  values,
  timeline,
  confidence,
  seasonality,
  completion,
  aggregation
) {
  if (timeline === undefined) fail(ERROR_VALUE);
  const level = optNumber(confidence, 0.95);
  if (!(level > 0 && level < 1)) fail(ERROR_NUM);
  const model = etsModel(
    values,
    timeline,
    seasonality,
    completion,
    aggregation
  );
  const h = Math.max(1, Math.ceil(horizon(model, target) - 1e-9));
  const { alpha, beta, gamma, run } = model.fit;
  const mse = run.errors.length ? sse(run.errors) / run.errors.length : 0;
  let variance = 1;
  for (let j = 1; j < h; j++) {
    const seasonalTerm = model.m > 1 && j % model.m === 0 ? gamma : 0;
    variance += (alpha * (1 + j * beta) + seasonalTerm) ** 2;
  }
  return normSInv(0.5 + level / 2) * Math.sqrt(mse * variance);
}

function FORECAST_ETS_SEASONALITY(values, timeline, completion, aggregation) {
  if (timeline === undefined) fail(ERROR_VALUE);
  const { series } = prepareSeries(values, timeline, completion, aggregation);
  const m = detectSeasonality(series);
  return m;
}

function FORECAST_ETS_STAT(
  values,
  timeline,
  statistic,
  seasonality,
  completion,
  aggregation
) {
  if (statistic === undefined) fail(ERROR_VALUE);
  const type = Math.trunc(toNumber(statistic));
  if (type < 1 || type > 8) fail(ERROR_NUM);
  const model = etsModel(
    values,
    timeline,
    seasonality,
    completion,
    aggregation
  );
  const { alpha, beta, gamma, run } = model.fit;
  const errs = run.errors;
  const count = errs.length || 1;
  const offset = model.series.length - errs.length;
  switch (type) {
    case 1:
      return alpha;
    case 2:
      return beta;
    case 3:
      return model.m > 1 ? gamma : 0;
    case 4: {
      // MASE: MAE over the in-sample naive (seasonal) forecast MAE.
      const lag = model.m > 1 ? model.m : 1;
      let naive = 0;
      let terms = 0;
      for (let i = lag; i < model.series.length; i++) {
        naive += Math.abs(model.series[i] - model.series[i - lag]);
        terms++;
      }
      const mae = errs.reduce((a, e) => a + Math.abs(e), 0) / count;
      if (!terms || naive === 0) fail(ERROR_DIV_ZERO);
      return mae / (naive / terms);
    }
    case 5: {
      let total = 0;
      errs.forEach((e, i) => {
        const actual = model.series[i + offset];
        const forecast = actual - e;
        const denom = (Math.abs(actual) + Math.abs(forecast)) / 2;
        total += denom === 0 ? 0 : Math.abs(e) / denom;
      });
      return total / count;
    }
    case 6:
      return errs.reduce((a, e) => a + Math.abs(e), 0) / count;
    case 7:
      return Math.sqrt(sse(errs) / count);
    default:
      return model.step;
  }
}

export default {
  LINEST: (knownY, knownX, constArg, stats) => {
    if (knownY === undefined) fail(ERROR_VALUE);
    return linest(knownY, knownX, constArg, stats, false);
  },
  LOGEST: (knownY, knownX, constArg, stats) => {
    if (knownY === undefined) fail(ERROR_VALUE);
    return linest(knownY, knownX, constArg, stats, true);
  },
  TREND: (knownY, knownX, newX, constArg) => {
    if (knownY === undefined) fail(ERROR_VALUE);
    return predict(knownY, knownX, newX, constArg, false);
  },
  GROWTH: (knownY, knownX, newX, constArg) => {
    if (knownY === undefined) fail(ERROR_VALUE);
    return predict(knownY, knownX, newX, constArg, true);
  },
  FREQUENCY,
  "FORECAST.ETS": FORECAST_ETS,
  "FORECAST.ETS.CONFINT": FORECAST_ETS_CONFINT,
  "FORECAST.ETS.SEASONALITY": FORECAST_ETS_SEASONALITY,
  "FORECAST.ETS.STAT": FORECAST_ETS_STAT,
};
