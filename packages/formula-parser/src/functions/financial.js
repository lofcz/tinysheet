// Financial functions missing from phase 1: VDB, AMORLINC, AMORDEGRC,
// ODDFPRICE, ODDFYIELD, ODDLPRICE, ODDLYIELD.
// See ./index.js for the calling convention.
//
// VDB, AMORLINC and AMORDEGRC follow the published algorithms (the ones
// LibreOffice documents as Excel-compatible). The odd-period bond functions
// implement Microsoft's quasi-coupon formulas: the odd period is split into
// quasi-coupon periods (NC), each contributing DCi/NLi to the odd coupon
// and Ai/NLi to the accrued interest; ODDFYIELD solves ODDFPRICE for the
// yield numerically.

import { ERROR_NUM, ERROR_VALUE } from "../error";
import {
  MAX_SERIAL,
  daysInMonth,
  fail,
  optNumber,
  serialFromYMD,
  toBoolean,
  toNumber,
  ymdFromSerial,
} from "./math-stats";
import { functionByName } from "./eta";

function required(...values) {
  values.forEach((v) => {
    if (v === undefined) fail(ERROR_VALUE);
  });
}

function day(v) {
  const n = Math.floor(toNumber(v));
  if (n < 0 || n > MAX_SERIAL) fail(ERROR_NUM);
  return n;
}

function basisArg(v) {
  const b = Math.trunc(optNumber(v, 0));
  if (b < 0 || b > 4) fail(ERROR_NUM);
  return b;
}

function frequencyArg(v) {
  const f = Math.trunc(toNumber(v));
  if (![1, 2, 4].includes(f)) fail(ERROR_NUM);
  return f;
}

/* -------------------------------------------------------------------------- */
/* VDB                                                                        */
/* -------------------------------------------------------------------------- */

function ddbPeriod(cost, salvage, life, period, factor) {
  let rate = factor / life;
  let oldValue;
  if (rate >= 1) {
    rate = 1;
    oldValue = period === 1 ? cost : 0;
  } else {
    oldValue = cost * (1 - rate) ** (period - 1);
  }
  const newValue = cost * (1 - rate) ** period;
  const ddb = newValue < salvage ? oldValue - salvage : oldValue - newValue;
  return ddb < 0 ? 0 : ddb;
}

// Depreciation over [0, period] switching to straight line when larger.
function interVdb(cost, salvage, life, life1, period, factor) {
  let vdb = 0;
  const intEnd = Math.ceil(period);
  let remaining = cost - salvage;
  let nowSln = false;
  let sln = 0;
  for (let i = 1; i <= intEnd; i++) {
    let term;
    if (!nowSln) {
      const ddb = ddbPeriod(cost, salvage, life, i, factor);
      sln = remaining / (life1 - (i - 1));
      if (sln > ddb) {
        term = sln;
        nowSln = true;
      } else {
        term = ddb;
        remaining -= ddb;
      }
    } else {
      term = sln;
    }
    if (i === intEnd) term *= period + 1 - intEnd;
    vdb += term;
  }
  return vdb;
}

function near(a, b) {
  return Math.abs(a - b) < 1e-12 * Math.max(1, Math.abs(a));
}

function VDB(
  costArg,
  salvageArg,
  lifeArg,
  startArg,
  endArg,
  factorArg,
  noSwitchArg
) {
  required(costArg, salvageArg, lifeArg, startArg, endArg);
  let cost = toNumber(costArg);
  const salvage = toNumber(salvageArg);
  const life = toNumber(lifeArg);
  const start = toNumber(startArg);
  const end = toNumber(endArg);
  const factor = optNumber(factorArg, 2);
  const noSwitch =
    noSwitchArg === undefined || noSwitchArg === null
      ? false
      : toBoolean(noSwitchArg);
  if (
    start < 0 ||
    end < start ||
    end > life ||
    cost < 0 ||
    salvage < 0 ||
    factor <= 0 ||
    life <= 0
  ) {
    fail(ERROR_NUM);
  }
  const intStart = Math.floor(start);
  const intEnd = Math.ceil(end);
  if (noSwitch) {
    let vdb = 0;
    for (let i = intStart + 1; i <= intEnd; i++) {
      let term = ddbPeriod(cost, salvage, life, i, factor);
      if (i === intStart + 1) term *= Math.min(end, intStart + 1) - start;
      else if (i === intEnd) term *= end + 1 - intEnd;
      vdb += term;
    }
    return vdb;
  }
  let part = 0;
  if (!near(start, intStart)) {
    const value = cost - interVdb(cost, salvage, life, life, intStart, factor);
    part +=
      (start - intStart) *
      interVdb(value, salvage, life, life - intStart, 1, factor);
  }
  if (!near(end, intEnd)) {
    const tempStart = intEnd - 1;
    const value = cost - interVdb(cost, salvage, life, life, tempStart, factor);
    part +=
      (intEnd - end) *
      interVdb(
        value,
        salvage,
        life,
        life - tempStart,
        intEnd - tempStart,
        factor
      );
  }
  cost -= interVdb(cost, salvage, life, life, intStart, factor);
  return (
    interVdb(cost, salvage, life, life - intStart, intEnd - intStart, factor) -
    part
  );
}

/* -------------------------------------------------------------------------- */
/* DB                                                                         */
/* -------------------------------------------------------------------------- */

// Fixed-declining balance with Excel's 3-decimal rate and partial first and
// last (life + 1) years.
function DB(costArg, salvageArg, lifeArg, periodArg, monthArg) {
  required(costArg, salvageArg, lifeArg, periodArg);
  const cost = toNumber(costArg);
  const salvage = toNumber(salvageArg);
  const life = toNumber(lifeArg);
  const period = Math.trunc(toNumber(periodArg));
  const month = Math.trunc(optNumber(monthArg, 12));
  if (
    cost < 0 ||
    salvage < 0 ||
    life <= 0 ||
    period < 1 ||
    month < 1 ||
    month > 12 ||
    period > life + (month === 12 ? 0 : 1)
  ) {
    fail(ERROR_NUM);
  }
  if (cost === 0) return 0;
  const rate = Math.round((1 - (salvage / cost) ** (1 / life)) * 1000) / 1000;
  let total = (cost * rate * month) / 12;
  if (period === 1) return total;
  let depreciation = 0;
  for (let p = 2; p <= period; p++) {
    depreciation =
      p === Math.floor(life) + 1
        ? ((cost - total) * rate * (12 - month)) / 12
        : (cost - total) * rate;
    total += depreciation;
  }
  return depreciation;
}

/* -------------------------------------------------------------------------- */
/* AMORLINC / AMORDEGRC                                                       */
/* -------------------------------------------------------------------------- */

function amorArgs(cost, purchased, firstPeriod, salvage, period, rate, basis) {
  required(cost, purchased, firstPeriod, salvage, period, rate);
  const args = {
    cost: toNumber(cost),
    purchased: day(purchased),
    first: day(firstPeriod),
    salvage: toNumber(salvage),
    period: Math.trunc(toNumber(period)),
    rate: toNumber(rate),
    basis: basisArg(basis),
  };
  if (
    args.cost < 0 ||
    args.salvage < 0 ||
    args.salvage > args.cost ||
    args.period < 0 ||
    args.rate <= 0 ||
    args.basis === 2 ||
    args.purchased > args.first
  ) {
    fail(ERROR_NUM);
  }
  args.yearFrac = functionByName("YEARFRAC")(
    args.purchased,
    args.first,
    args.basis
  );
  return args;
}

function AMORLINC(...params) {
  const { cost, salvage, period, rate, yearFrac } = amorArgs(...params);
  const oneRate = cost * rate;
  const firstRate = yearFrac * rate * cost;
  const fullPeriods = Math.floor((cost - salvage - firstRate) / oneRate);
  let result = 0;
  if (period === 0) result = firstRate;
  else if (period <= fullPeriods) result = oneRate;
  else if (period === fullPeriods + 1)
    result = cost - salvage - oneRate * fullPeriods - firstRate;
  return result > 0 ? result : 0;
}

function roundHalfUp(x) {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}

function AMORDEGRC(...params) {
  const args = amorArgs(...params);
  let { cost, rate } = args;
  const { salvage, period, yearFrac } = args;
  const usePeriods = 1 / rate;
  let coefficient;
  if (usePeriods < 3) coefficient = 1;
  else if (usePeriods < 5) coefficient = 1.5;
  else if (usePeriods <= 6) coefficient = 2;
  else coefficient = 2.5;
  rate *= coefficient;
  let depreciation = roundHalfUp(yearFrac * rate * cost);
  cost -= depreciation;
  let rest = cost - salvage;
  for (let n = 0; n < period; n++) {
    depreciation = roundHalfUp(rate * cost);
    rest -= depreciation;
    if (rest < 0) {
      return period - n <= 1 ? roundHalfUp(cost * 0.5) : 0;
    }
    cost -= depreciation;
  }
  return depreciation;
}

/* -------------------------------------------------------------------------- */
/* Odd-period bonds                                                           */
/* -------------------------------------------------------------------------- */

function isLastOfFeb(serial) {
  const [y, m, d] = ymdFromSerial(serial);
  return m === 2 && d === daysInMonth(y, 2);
}

/** Days between two serials under a day-count basis. */
function dayCount(start, end, basis) {
  if (basis !== 0 && basis !== 4) return end - start;
  const [y1, m1, day1] = ymdFromSerial(start);
  const [y2, m2, day2] = ymdFromSerial(end);
  let d1 = day1;
  let d2 = day2;
  if (basis === 0) {
    if (isLastOfFeb(start) && isLastOfFeb(end)) d2 = 30;
    if (isLastOfFeb(start)) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;
    if (d1 === 31) d1 = 30;
  } else {
    d1 = Math.min(d1, 30);
    d2 = Math.min(d2, 30);
  }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/** Coupon date `k` periods of 12/f months from `anchor` (end-of-month aware). */
function couponDate(anchor, f, k) {
  const [y, m, d] = ymdFromSerial(anchor);
  const endOfMonth = d === daysInMonth(y, m);
  const t = m + k * (12 / f);
  const yy = y + Math.floor((t - 1) / 12);
  const mm = ((((t - 1) % 12) + 12) % 12) + 1;
  const dim = daysInMonth(yy, mm);
  return serialFromYMD(yy, mm, endOfMonth ? dim : Math.min(d, dim));
}

function periodLength(start, end, f, basis) {
  if (basis === 1) return end - start;
  if (basis === 3) return 365 / f;
  return 360 / f;
}

function overlap(a1, a2, b1, b2, basis) {
  const s = Math.max(a1, b1);
  const e = Math.min(a2, b2);
  return e > s ? dayCount(s, e, basis) : 0;
}

/** Everything ODDFPRICE needs apart from rate and yield. */
function oddFirst(settlement, maturity, issue, firstCoupon, frequency, basis) {
  required(settlement, maturity, issue, firstCoupon, frequency);
  const s = day(settlement);
  const m = day(maturity);
  const iss = day(issue);
  const fc = day(firstCoupon);
  const f = frequencyArg(frequency);
  const b = basisArg(basis);
  if (!(m > fc && fc > s && s > iss)) fail(ERROR_NUM);
  // Quasi-coupon periods covering the odd first period.
  let k = 0;
  while (couponDate(fc, f, -k - 1) > iss) k++;
  const nc = k + 1;
  let dcSum = 0;
  let aSum = 0;
  let nq = 0;
  let dsc = 0;
  let e = 0;
  for (let i = nc; i >= 1; i--) {
    const qs = couponDate(fc, f, -i);
    const qe = couponDate(fc, f, -i + 1);
    const nl = periodLength(qs, qe, f, b);
    dcSum += overlap(iss, fc, qs, qe, b) / nl;
    aSum += overlap(iss, s, qs, qe, b) / nl;
    if (s >= qs && s < qe) {
      e = nl;
      dsc = b === 0 || b === 4 ? nl - dayCount(qs, s, b) : qe - s;
      nq = i - 1;
    }
  }
  // Regular coupons after the first coupon.
  let n = 0;
  while (couponDate(fc, f, n + 1) <= m) n++;
  return { f, dcSum, aSum, nq, dsc, e, n };
}

function oddFirstPrice(o, rate, yld, redemption) {
  const coupon = (100 * rate) / o.f;
  const base = 1 + yld / o.f;
  const t0 = o.nq + o.dsc / o.e;
  let price = (coupon * o.dcSum) / base ** t0;
  for (let k = 1; k <= o.n; k++) price += coupon / base ** (t0 + k);
  price += redemption / base ** (t0 + o.n);
  return price - coupon * o.aSum;
}

function ODDFPRICE(
  settlement,
  maturity,
  issue,
  firstCoupon,
  rate,
  yld,
  redemption,
  frequency,
  basis
) {
  required(rate, yld, redemption);
  const o = oddFirst(
    settlement,
    maturity,
    issue,
    firstCoupon,
    frequency,
    basis
  );
  const r = toNumber(rate);
  const y = toNumber(yld);
  const red = toNumber(redemption);
  if (r < 0 || y < 0 || red <= 0) fail(ERROR_NUM);
  return oddFirstPrice(o, r, y, red);
}

function ODDFYIELD(
  settlement,
  maturity,
  issue,
  firstCoupon,
  rate,
  price,
  redemption,
  frequency,
  basis
) {
  required(rate, price, redemption);
  const o = oddFirst(
    settlement,
    maturity,
    issue,
    firstCoupon,
    frequency,
    basis
  );
  const r = toNumber(rate);
  const pr = toNumber(price);
  const red = toNumber(redemption);
  if (r < 0 || pr <= 0 || red <= 0) fail(ERROR_NUM);
  // Price decreases with the yield: bracket, then bisect/secant.
  let lo = -o.f + 1e-9;
  let hi = 1;
  while (oddFirstPrice(o, r, hi, red) > pr) {
    hi *= 2;
    if (hi > 1e6) fail(ERROR_NUM);
  }
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (oddFirstPrice(o, r, mid, red) > pr) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-15) break;
  }
  return (lo + hi) / 2;
}

function oddLast(settlement, maturity, lastInterest, frequency, basis) {
  required(settlement, maturity, lastInterest, frequency);
  const s = day(settlement);
  const m = day(maturity);
  const li = day(lastInterest);
  const f = frequencyArg(frequency);
  const b = basisArg(basis);
  if (!(m > s && s > li)) fail(ERROR_NUM);
  let dcSum = 0;
  let aSum = 0;
  let dscSum = 0;
  for (let i = 1; couponDate(li, f, i - 1) < m; i++) {
    const qs = couponDate(li, f, i - 1);
    const qe = couponDate(li, f, i);
    const nl = periodLength(qs, qe, f, b);
    dcSum += overlap(li, m, qs, qe, b) / nl;
    aSum += overlap(li, s, qs, qe, b) / nl;
    dscSum += overlap(s, m, qs, qe, b) / nl;
  }
  return { f, dcSum, aSum, dscSum };
}

function ODDLPRICE(
  settlement,
  maturity,
  lastInterest,
  rate,
  yld,
  redemption,
  frequency,
  basis
) {
  required(rate, yld, redemption);
  const o = oddLast(settlement, maturity, lastInterest, frequency, basis);
  const r = toNumber(rate);
  const y = toNumber(yld);
  const red = toNumber(redemption);
  if (r < 0 || y < 0 || red <= 0) fail(ERROR_NUM);
  const coupon = (100 * r) / o.f;
  return (
    (red + coupon * o.dcSum) / (1 + (y / o.f) * o.dscSum) - coupon * o.aSum
  );
}

function ODDLYIELD(
  settlement,
  maturity,
  lastInterest,
  rate,
  price,
  redemption,
  frequency,
  basis
) {
  required(rate, price, redemption);
  const o = oddLast(settlement, maturity, lastInterest, frequency, basis);
  const r = toNumber(rate);
  const pr = toNumber(price);
  const red = toNumber(redemption);
  if (r < 0 || pr <= 0 || red <= 0) fail(ERROR_NUM);
  const coupon = (100 * r) / o.f;
  const paid = pr + coupon * o.aSum;
  return ((red + coupon * o.dcSum - paid) / paid) * (o.f / o.dscSum);
}

export default {
  DB,
  VDB,
  AMORLINC,
  AMORDEGRC,
  ODDFPRICE,
  ODDFYIELD,
  ODDLPRICE,
  ODDLYIELD,
};
