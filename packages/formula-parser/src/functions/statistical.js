// Statistical functions whose formulajs versions disagree with Excel (found
// by the parity corpus, test/integration/parsing/batch2/corpus-data.mjs):
// Student's t family (T.DIST, T.INV, TDIST, TINV, CONFIDENCE.T and T.TEST
// at full precision), BETA.DIST density on [A, B], CHISQ.TEST, F.TEST,
// INTERCEPT, and the compatibility names whose formulajs aliases pointed at
// the left-tail/density variants (CHIDIST, CHIINV, FDIST, FINV, LOGNORMDIST,
// NORMSDIST, CHITEST, FTEST, TTEST).
// See ./index.js for the calling convention.

import {
  ERROR_DIV_ZERO,
  ERROR_NOT_AVAILABLE as ERROR_NA,
  ERROR_NUM,
  ERROR_VALUE,
} from "../error";
import {
  collectNumbers,
  fail,
  isErrorValue,
  optNumber,
  toBoolean,
  toError,
  toGrid,
  toNumber,
} from "./math-stats";
import { functionByName } from "./eta";

/* -------------------------------------------------------------------------- */
/* Special functions                                                          */
/* -------------------------------------------------------------------------- */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) for x > 0. */
export function logGamma(x) {
  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x)
    );
  }
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
  );
}

function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

// Continued fraction for the incomplete beta (modified Lentz).
function betaFraction(x, a, b) {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
  if (x < (a + 1) / (a + b + 2)) return (front * betaFraction(x, a, b)) / a;
  return 1 - (front * betaFraction(1 - x, b, a)) / b;
}

/** Regularized upper incomplete gamma Q(a, x). */
function upperGamma(a, x) {
  if (x <= 0) return 1;
  const lnFront = a * Math.log(x) - x - logGamma(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-17) break;
    }
    return 1 - sum * Math.exp(lnFront);
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(lnFront) * h;
}

/** Upper tail of Student's t: P(T > t). */
function tUpper(t, df) {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? tail : 1 - tail;
}

function tDensity(t, df) {
  return Math.exp(
    logGamma((df + 1) / 2) -
      logGamma(df / 2) -
      0.5 * Math.log(df * Math.PI) -
      ((df + 1) / 2) * Math.log(1 + (t * t) / df)
  );
}

/** t such that P(T > t) = p (0 < p < 1). */
function tUpperInverse(p, df) {
  if (p === 0.5) return 0;
  if (p > 0.5) return -tUpperInverse(1 - p, df);
  // Bracket then bisect/Newton on the monotone upper tail.
  let lo = 0;
  let hi = 1;
  while (tUpper(hi, df) > p) {
    lo = hi;
    hi *= 2;
    if (hi > 1e300) return Infinity;
  }
  let t = (lo + hi) / 2;
  for (let i = 0; i < 200; i++) {
    const f = tUpper(t, df) - p;
    if (f > 0) lo = t;
    else hi = t;
    const newton = t + f / tDensity(t, df);
    t = newton > lo && newton < hi ? newton : (lo + hi) / 2;
    if (hi - lo < 1e-15 * Math.max(1, t) || Math.abs(f) < 1e-17) break;
  }
  return t;
}

function fUpper(x, d1, d2) {
  if (x <= 0) return 1;
  return incompleteBeta(d2 / (d2 + d1 * x), d2 / 2, d1 / 2);
}

function chiUpper(x, df) {
  return upperGamma(df / 2, x / 2);
}

/* -------------------------------------------------------------------------- */
/* Argument helpers                                                           */
/* -------------------------------------------------------------------------- */

function required(...values) {
  values.forEach((v) => {
    if (v === undefined) fail(ERROR_VALUE);
  });
}

function degrees(v) {
  const df = Math.trunc(toNumber(v));
  if (df < 1) fail(ERROR_NUM);
  return df;
}

function probability(v) {
  const p = toNumber(v);
  if (p <= 0 || p > 1) fail(ERROR_NUM);
  return p;
}

/** Numeric values of an array argument (text, logicals, blanks skipped). */
function numbers(v) {
  return collectNumbers([toGrid(v)]);
}

/** Pairs (x, y) where both are numbers, from two same-size arrays. */
function pairs(ys, xs) {
  const gy = toGrid(ys);
  const gx = toGrid(xs);
  const fy = [];
  const fx = [];
  gy.forEach((row) => row.forEach((v) => fy.push(v)));
  gx.forEach((row) => row.forEach((v) => fx.push(v)));
  if (fy.length !== fx.length) fail(ERROR_NA);
  const out = [];
  for (let i = 0; i < fy.length; i++) {
    if (isErrorValue(fy[i])) throw toError(fy[i]);
    if (isErrorValue(fx[i])) throw toError(fx[i]);
    if (typeof fy[i] === "number" && typeof fx[i] === "number") {
      out.push([fx[i], fy[i]]);
    }
  }
  return out;
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sampleVariance(xs) {
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

/* -------------------------------------------------------------------------- */
/* Functions                                                                  */
/* -------------------------------------------------------------------------- */

function T_DIST(x, dfArg, cumulative) {
  required(x, dfArg, cumulative);
  const t = toNumber(x);
  const df = degrees(dfArg);
  return toBoolean(cumulative) ? 1 - tUpper(t, df) : tDensity(t, df);
}

function T_DIST_2T(x, dfArg) {
  required(x, dfArg);
  const t = toNumber(x);
  const df = degrees(dfArg);
  if (t < 0) fail(ERROR_NUM);
  return 2 * tUpper(t, df);
}

function T_DIST_RT(x, dfArg) {
  required(x, dfArg);
  return tUpper(toNumber(x), degrees(dfArg));
}

function T_INV(p, dfArg) {
  required(p, dfArg);
  const prob = toNumber(p);
  const df = degrees(dfArg);
  if (prob <= 0 || prob >= 1) fail(ERROR_NUM);
  return tUpperInverse(1 - prob, df);
}

function T_INV_2T(p, dfArg) {
  required(p, dfArg);
  const prob = probability(p);
  const df = degrees(dfArg);
  return tUpperInverse(prob / 2, df);
}

function TDIST(x, dfArg, tailsArg) {
  required(x, dfArg, tailsArg);
  const t = toNumber(x);
  const df = degrees(dfArg);
  const tails = Math.trunc(toNumber(tailsArg));
  if (t < 0 || (tails !== 1 && tails !== 2)) fail(ERROR_NUM);
  return tails * tUpper(t, df);
}

function CONFIDENCE_T(alphaArg, sdArg, sizeArg) {
  required(alphaArg, sdArg, sizeArg);
  const alpha = toNumber(alphaArg);
  const sd = toNumber(sdArg);
  const n = Math.trunc(toNumber(sizeArg));
  if (alpha <= 0 || alpha >= 1 || sd <= 0) fail(ERROR_NUM);
  if (n === 1) fail(ERROR_DIV_ZERO);
  if (n < 1) fail(ERROR_NUM);
  return (tUpperInverse(alpha / 2, n - 1) * sd) / Math.sqrt(n);
}

function T_TEST(array1, array2, tailsArg, typeArg) {
  required(array1, array2, tailsArg, typeArg);
  const tails = Math.trunc(toNumber(tailsArg));
  const type = Math.trunc(toNumber(typeArg));
  if ((tails !== 1 && tails !== 2) || type < 1 || type > 3) fail(ERROR_NUM);
  let t;
  let df;
  if (type === 1) {
    const g1 = toGrid(array1);
    const g2 = toGrid(array2);
    const f1 = [];
    const f2 = [];
    g1.forEach((row) => row.forEach((v) => f1.push(v)));
    g2.forEach((row) => row.forEach((v) => f2.push(v)));
    if (f1.length !== f2.length) fail(ERROR_NA);
    const diffs = [];
    for (let i = 0; i < f1.length; i++) {
      if (isErrorValue(f1[i])) throw toError(f1[i]);
      if (isErrorValue(f2[i])) throw toError(f2[i]);
      if (typeof f1[i] === "number" && typeof f2[i] === "number") {
        diffs.push(f1[i] - f2[i]);
      }
    }
    if (diffs.length < 2) fail(ERROR_DIV_ZERO);
    const variance = sampleVariance(diffs);
    if (variance === 0) fail(ERROR_DIV_ZERO);
    t = mean(diffs) / Math.sqrt(variance / diffs.length);
    df = diffs.length - 1;
  } else {
    const a = numbers(array1);
    const b = numbers(array2);
    if (a.length < 2 || b.length < 2) fail(ERROR_DIV_ZERO);
    const va = sampleVariance(a);
    const vb = sampleVariance(b);
    const na = a.length;
    const nb = b.length;
    if (type === 2) {
      df = na + nb - 2;
      const pooled = ((na - 1) * va + (nb - 1) * vb) / df;
      t = (mean(a) - mean(b)) / Math.sqrt(pooled * (1 / na + 1 / nb));
    } else {
      const sa = va / na;
      const sb = vb / nb;
      t = (mean(a) - mean(b)) / Math.sqrt(sa + sb);
      df = (sa + sb) ** 2 / (sa ** 2 / (na - 1) + sb ** 2 / (nb - 1));
    }
    if (!Number.isFinite(t)) fail(ERROR_DIV_ZERO);
  }
  return tails * tUpper(Math.abs(t), df);
}

function BETA_DIST(x, alphaArg, betaArg, cumulative, lower, upper) {
  required(x, alphaArg, betaArg, cumulative);
  const value = toNumber(x);
  const alpha = toNumber(alphaArg);
  const beta = toNumber(betaArg);
  const a = optNumber(lower, 0);
  const b = optNumber(upper, 1);
  if (alpha <= 0 || beta <= 0 || value < a || value > b || a === b) {
    fail(ERROR_NUM);
  }
  const z = (value - a) / (b - a);
  if (toBoolean(cumulative)) return incompleteBeta(z, alpha, beta);
  if ((z === 0 && alpha < 1) || (z === 1 && beta < 1)) fail(ERROR_NUM);
  const density = Math.exp(
    (alpha - 1) * Math.log(z) +
      (beta - 1) * Math.log(1 - z) -
      logBeta(alpha, beta)
  );
  return density / (b - a);
}

function CHISQ_TEST(actual, expected) {
  required(actual, expected);
  const ga = toGrid(actual);
  const ge = toGrid(expected);
  const rows = ga.length;
  const cols = ga[0].length;
  if (ge.length !== rows || ge[0].length !== cols) fail(ERROR_NA);
  let chi = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const o = ga[i][j];
      const e = ge[i][j];
      if (isErrorValue(o)) throw toError(o);
      if (isErrorValue(e)) throw toError(e);
      if (typeof o !== "number" || typeof e !== "number") continue;
      if (e === 0) fail(ERROR_DIV_ZERO);
      chi += (o - e) ** 2 / e;
    }
  }
  let df;
  if (rows > 1 && cols > 1) df = (rows - 1) * (cols - 1);
  else df = rows * cols - 1;
  if (df < 1) fail(ERROR_NA);
  return chiUpper(chi, df);
}

function F_TEST(array1, array2) {
  required(array1, array2);
  const a = numbers(array1);
  const b = numbers(array2);
  if (a.length < 2 || b.length < 2) fail(ERROR_DIV_ZERO);
  const va = sampleVariance(a);
  const vb = sampleVariance(b);
  if (va === 0 || vb === 0) fail(ERROR_DIV_ZERO);
  const upperTail = fUpper(va / vb, a.length - 1, b.length - 1);
  return 2 * Math.min(upperTail, 1 - upperTail);
}

function INTERCEPT(knownY, knownX) {
  required(knownY, knownX);
  const data = pairs(knownY, knownX);
  if (!data.length) fail(ERROR_DIV_ZERO);
  const mx = mean(data.map((p) => p[0]));
  const my = mean(data.map((p) => p[1]));
  let sxy = 0;
  let sxx = 0;
  data.forEach(([x, y]) => {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  });
  if (sxx === 0) fail(ERROR_DIV_ZERO);
  return my - (sxy / sxx) * mx;
}

function delegate(name, count) {
  return (...args) => {
    required(
      ...args.slice(0, count),
      ...new Array(Math.max(0, count - args.length))
    );
    return functionByName(name)(...args.slice(0, count));
  };
}

export default {
  "T.DIST": T_DIST,
  "T.DIST.2T": T_DIST_2T,
  "T.DIST.RT": T_DIST_RT,
  "T.INV": T_INV,
  "T.INV.2T": T_INV_2T,
  TDIST,
  TINV: T_INV_2T,
  "CONFIDENCE.T": CONFIDENCE_T,
  "T.TEST": T_TEST,
  TTEST: T_TEST,
  "BETA.DIST": BETA_DIST,
  "CHISQ.TEST": CHISQ_TEST,
  CHITEST: CHISQ_TEST,
  "F.TEST": F_TEST,
  FTEST: F_TEST,
  INTERCEPT,
  CHIDIST: delegate("CHISQ.DIST.RT", 2),
  CHIINV: delegate("CHISQ.INV.RT", 2),
  FDIST: delegate("F.DIST.RT", 3),
  FINV: delegate("F.INV.RT", 3),
  LOGNORMDIST: (x, m, s) => {
    required(x, m, s);
    return functionByName("LOGNORM.DIST")(x, m, s, true);
  },
  NORMSDIST: (z) => {
    required(z);
    return functionByName("NORM.S.DIST")(z, true);
  },
};
