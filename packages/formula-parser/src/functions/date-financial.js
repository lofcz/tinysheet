// See ./index.js for the calling convention.
//
// Date & financial functions with Excel-exact semantics.
//
// Dates are Excel serial numbers in the 1900 date system (serial 1 is
// 1900-01-01, serial 60 is Excel's fictitious 1900-02-29). That is how the
// sheet stores date cells, so every date function here accepts serial numbers
// or date text ("2020-03-15", "3/15/2020", "15-Mar-2020", ...) and returns
// serial numbers (formulajs returns JavaScript Date objects instead).
//
// Bond functions follow Excel's day-count bases:
//   0 = US (NASD) 30/360, 1 = actual/actual, 2 = actual/360,
//   3 = actual/365, 4 = European 30/360.

import { ERROR_DIV_ZERO, ERROR_NUM, ERROR_VALUE } from "../error";
import {
  MAX_SERIAL,
  collectNumbers,
  clean15,
  dateToSerial,
  daysInMonth,
  fail,
  flatten,
  isErrorValue,
  isLeapYear,
  optNumber,
  parseDateTimeParts,
  scalar,
  serialFromYMD,
  toBoolean,
  toError,
  toNumber,
  weekdayOf,
  withArity,
  ymdFromSerial,
} from "./math-stats";

/* -------------------------------------------------------------------------- */
/* Argument helpers                                                           */
/* -------------------------------------------------------------------------- */

/** A date/time argument as a serial number (fraction = time of day). */
function dateArg(v) {
  const n = toNumber(v);
  if (n < 0 || n >= MAX_SERIAL + 1) fail(ERROR_NUM);
  return n;
}

/** A date argument truncated to whole days. */
function dayArg(v) {
  return Math.floor(dateArg(v));
}

function intArg(v) {
  return Math.trunc(toNumber(v));
}

function checkSerial(n) {
  if (n < 0 || n > MAX_SERIAL) fail(ERROR_NUM);
  return n;
}

/** [year, month] `months` months after year/month; #NUM! before 1900. */
function addMonths(y, m, months) {
  const target = m + months;
  const ty = y + Math.floor((target - 1) / 12);
  if (ty < 1900 || ty > 9999) fail(ERROR_NUM);
  return [ty, ((((target - 1) % 12) + 12) % 12) + 1];
}

function textArg(v) {
  const x = scalar(v);
  if (isErrorValue(x)) throw toError(x);
  if (typeof x !== "string") fail(ERROR_VALUE);
  return x;
}

/* -------------------------------------------------------------------------- */
/* Day counting                                                               */
/* -------------------------------------------------------------------------- */

/** DAYS360: US (NASD) method when `us`, else the European method. */
function days360(start, end, us) {
  const [y1, m1, day1] = ymdFromSerial(start);
  let [y2, m2, d2] = ymdFromSerial(end);
  let d1 = day1;
  if (d1 === 31) d1 = 30;
  else if (us && m1 === 2 && d1 === daysInMonth(y1, 2)) d1 = 30;
  if (d2 === 31) {
    if (us && d1 !== 30) {
      d2 = 1;
      m2 += 1;
      if (m2 > 12) {
        m2 = 1;
        y2 += 1;
      }
    } else {
      d2 = 30;
    }
  }
  return d2 + m2 * 30 + y2 * 360 - (d1 + m1 * 30 + y1 * 360);
}

function feb29Between(s, e) {
  const [y1] = ymdFromSerial(s);
  const mar1y1 = serialFromYMD(y1, 3, 1);
  if (isLeapYear(y1) && s < mar1y1 && e >= mar1y1) return true;
  const [y2] = ymdFromSerial(e);
  const mar1y2 = serialFromYMD(y2, 3, 1);
  return isLeapYear(y2) && e >= mar1y2 && s < mar1y2;
}

/** Excel's YEARFRAC for whole-day serials, basis 0-4. */
function yearFrac(start, end, basis) {
  let s = start;
  let e = end;
  if (s > e) [s, e] = [e, s];
  if (s === e) return 0;
  const [sy, sm, sday] = ymdFromSerial(s);
  const [ey, em, eday] = ymdFromSerial(e);
  let sd = sday;
  let ed = eday;
  switch (basis) {
    case 0:
      if (sd === 31 && ed === 31) {
        sd = 30;
        ed = 30;
      } else if (sd === 31) {
        sd = 30;
      } else if (sd === 30 && ed === 31) {
        ed = 30;
      } else if (
        sm === 2 &&
        em === 2 &&
        sd === daysInMonth(sy, 2) &&
        ed === daysInMonth(ey, 2)
      ) {
        sd = 30;
        ed = 30;
      } else if (sm === 2 && sd === daysInMonth(sy, 2)) {
        sd = 30;
      }
      return (ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) / 360;
    case 1: {
      if (
        sy === ey ||
        (ey === sy + 1 && (sm > em || (sm === em && sd >= ed)))
      ) {
        let yearLength = 365;
        if (sy === ey && isLeapYear(sy)) yearLength = 366;
        else if (feb29Between(s, e) || (em === 2 && ed === 29))
          yearLength = 366;
        return (e - s) / yearLength;
      }
      const years = ey - sy + 1;
      const days = serialFromYMD(ey + 1, 1, 1) - serialFromYMD(sy, 1, 1);
      return (e - s) / (days / years);
    }
    case 2:
      return (e - s) / 360;
    case 3:
      return (e - s) / 365;
    default:
      sd = Math.min(sd, 30);
      ed = Math.min(ed, 30);
      return (ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) / 360;
  }
}

function basisArg(v) {
  const b = Math.trunc(optNumber(v, 0));
  if (b < 0 || b > 4) fail(ERROR_NUM);
  return b;
}

/* -------------------------------------------------------------------------- */
/* Weekends & holidays                                                        */
/* -------------------------------------------------------------------------- */

/** isWeekend[dow] (0 = Sunday) for a NETWORKDAYS.INTL/WORKDAY.INTL code. */
function weekendMask(v) {
  const x = scalar(v);
  const mask = [false, false, false, false, false, false, false];
  if (x === undefined || x === null) {
    mask[0] = true;
    mask[6] = true;
    return mask;
  }
  if (typeof x === "string" && !isErrorValue(x)) {
    if (!/^[01]{7}$/.test(x)) fail(ERROR_VALUE);
    for (let i = 0; i < 7; i++) mask[(i + 1) % 7] = x[i] === "1"; // Mon..Sun
    return mask;
  }
  const code = toNumber(x);
  if (code >= 1 && code <= 7 && Number.isInteger(code)) {
    mask[(6 + code - 1) % 7] = true;
    mask[(code - 1) % 7] = true;
  } else if (code >= 11 && code <= 17 && Number.isInteger(code)) {
    mask[code - 11] = true;
  } else {
    fail(ERROR_NUM);
  }
  return mask;
}

function holidaySet(v) {
  const set = new Set();
  if (v === undefined) return set;
  flatten(v).forEach((h) => {
    if (h === null || h === undefined || h === "") return;
    if (isErrorValue(h)) throw toError(h);
    if (typeof h === "boolean") fail(ERROR_VALUE);
    set.add(dayArg(h));
  });
  return set;
}

function networkDays(start, end, mask, holidays) {
  const s = dayArg(start);
  const e = dayArg(end);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  const perWeek = mask.filter((w) => !w).length;
  const weeks = Math.floor((hi - lo + 1) / 7);
  let count = weeks * perWeek;
  for (let d = lo + weeks * 7; d <= hi; d++) if (!mask[weekdayOf(d)]) count++;
  holidays.forEach((h) => {
    if (h >= lo && h <= hi && !mask[weekdayOf(h)]) count--;
  });
  return s <= e ? count : -count;
}

function workDay(start, days, mask, holidays) {
  const s = dayArg(start);
  const n = intArg(days);
  if (mask.every(Boolean)) fail(ERROR_VALUE);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  let d = s;
  while (left > 0) {
    d += step;
    if (d < 0 || d > MAX_SERIAL) fail(ERROR_NUM);
    if (!mask[weekdayOf(d)] && !holidays.has(d)) left--;
  }
  return d;
}

/* -------------------------------------------------------------------------- */
/* Weeks                                                                      */
/* -------------------------------------------------------------------------- */

function isoWeekNum(serial) {
  const n = Math.floor(serial);
  const dowMon = (weekdayOf(n) + 6) % 7; // Monday = 0
  const thursday = n - dowMon + 3;
  const [y] = ymdFromSerial(Math.max(thursday, 1));
  return Math.floor((thursday - serialFromYMD(y, 1, 1)) / 7) + 1;
}

const WEEK_START = {
  1: 0,
  2: 1,
  11: 1,
  12: 2,
  13: 3,
  14: 4,
  15: 5,
  16: 6,
  17: 0,
};

/* -------------------------------------------------------------------------- */
/* Coupons & bonds                                                            */
/* -------------------------------------------------------------------------- */

function bondArgs(settlement, maturity, frequency, basis) {
  const s = dayArg(settlement);
  const m = dayArg(maturity);
  const f = intArg(frequency);
  const b = basisArg(basis);
  if (![1, 2, 4].includes(f) || s >= m) fail(ERROR_NUM);
  return { s, m, f, b };
}

/**
 * Coupon schedule around the settlement date: coupons are paid every 12/f
 * months counting back from maturity (month-end maturities pay month-end).
 */
function couponInfo({ s, m, f, b }) {
  const [my, mm, md] = ymdFromSerial(m);
  const endOfMonth = md === daysInMonth(my, mm);
  const step = 12 / f;
  const at = (k) => {
    const t = mm - k * step;
    const y = my + Math.floor((t - 1) / 12);
    const mo = ((((t - 1) % 12) + 12) % 12) + 1;
    const dim = daysInMonth(y, mo);
    return serialFromYMD(y, mo, endOfMonth ? dim : Math.min(md, dim));
  };
  let k = 1;
  while (at(k) > s) k++;
  const pcd = at(k);
  const ncd = at(k - 1);
  let A;
  if (b === 0) A = days360(pcd, s, true);
  else if (b === 4) A = days360(pcd, s, false);
  else A = s - pcd;
  let E;
  if (b === 1) E = ncd - pcd;
  else if (b === 3) E = 365 / f;
  else E = 360 / f;
  const DSC = b === 0 || b === 4 ? E - A : ncd - s;
  return { pcd, ncd, N: k, A, E, DSC };
}

function bond(settlement, maturity, frequency, basis) {
  const args = bondArgs(settlement, maturity, frequency, basis);
  return { ...args, ...couponInfo(args) };
}

function bondPrice(c, rate, yld, redemption) {
  const { A, E, DSC, N, f } = c;
  const coupon = (100 * rate) / f;
  if (N === 1) {
    return (
      (redemption + coupon) / (1 + (DSC / E) * (yld / f)) - (coupon * A) / E
    );
  }
  const base = 1 + yld / f;
  const t0 = DSC / E;
  let p = redemption / base ** (N - 1 + t0);
  for (let k = 1; k <= N; k++) p += coupon / base ** (k - 1 + t0);
  return p - (coupon * A) / E;
}

/** Solve decreasing fn(y) = target by bracketing + bisection. */
function solveDecreasing(fn, target, lower) {
  let lo = lower;
  let hi = 1;
  let guard = 0;
  while (fn(hi) > target) {
    lo = hi;
    hi *= 2;
    if (++guard > 60) fail(ERROR_NUM);
  }
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Macaulay duration over the remaining coupon flows (in years). */
function duration(settlement, maturity, coupon, yld, frequency, basis) {
  const c = bond(settlement, maturity, frequency, basis);
  const cpn = toNumber(coupon);
  const y = toNumber(yld);
  if (cpn < 0 || y < 0) fail(ERROR_NUM);
  const cf = (cpn * 100) / c.f;
  const base = 1 + y / c.f;
  const t0 = c.DSC / c.E;
  let weighted = 0;
  let pv = 0;
  for (let k = 1; k <= c.N; k++) {
    const t = k - 1 + t0;
    const flow = (k === c.N ? cf + 100 : cf) / base ** t;
    weighted += t * flow;
    pv += flow;
  }
  return { dur: weighted / pv / c.f, y, f: c.f };
}

/** settlement/maturity pair for the discount-security functions. */
function discountArgs(settlement, maturity, basis) {
  const s = dayArg(settlement);
  const m = dayArg(maturity);
  const b = basisArg(basis);
  if (s >= m) fail(ERROR_NUM);
  return { s, m, b, yf: yearFrac(s, m, b) };
}

function tbillDays(settlement, maturity) {
  const s = dayArg(settlement);
  const m = dayArg(maturity);
  const [y, mo, d] = ymdFromSerial(s);
  if (s >= m || m > serialFromYMD(y + 1, mo, d)) fail(ERROR_NUM);
  return m - s;
}

function positive(...values) {
  values.forEach((v) => {
    if (v <= 0) fail(ERROR_NUM);
  });
}

/* -------------------------------------------------------------------------- */
/* Functions                                                                  */
/* -------------------------------------------------------------------------- */

const FUNCTIONS = {
  // Construction & conversion
  DATE: (year, month, day) => {
    let y = intArg(year);
    if (y < 0 || y >= 10000) fail(ERROR_NUM);
    if (y < 1900) y += 1900;
    return checkSerial(serialFromYMD(y, intArg(month), intArg(day)));
  },
  DATEVALUE: (text) => {
    const parts = parseDateTimeParts(textArg(text));
    if (parts === undefined) fail(ERROR_VALUE);
    return parts.date;
  },
  TIME: (hour, minute, second) => {
    const h = intArg(hour);
    const m = intArg(minute);
    const s = intArg(second);
    if (h > 32767 || m > 32767 || s > 32767) fail(ERROR_NUM);
    const total = h * 3600 + m * 60 + s;
    if (total < 0) fail(ERROR_NUM);
    return (total % 86400) / 86400;
  },
  TIMEVALUE: (text) => {
    const parts = parseDateTimeParts(textArg(text));
    if (parts === undefined) fail(ERROR_VALUE);
    return parts.time % 1;
  },
  TODAY: () => {
    const now = new Date();
    return serialFromYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
  },
  NOW: () => dateToSerial(new Date()),

  // Parts
  YEAR: (serial) => ymdFromSerial(dateArg(serial))[0],
  MONTH: (serial) => ymdFromSerial(dateArg(serial))[1],
  DAY: (serial) => ymdFromSerial(dateArg(serial))[2],
  HOUR: (serial) => {
    const n = dateArg(serial);
    return (
      Math.floor(Math.round(clean15(n - Math.floor(n)) * 86400) / 3600) % 24
    );
  },
  MINUTE: (serial) => {
    const n = dateArg(serial);
    return Math.floor(Math.round(clean15(n - Math.floor(n)) * 86400) / 60) % 60;
  },
  SECOND: (serial) => {
    const n = dateArg(serial);
    return Math.round(clean15(n - Math.floor(n)) * 86400) % 60;
  },
  WEEKDAY: (serial, returnType) => {
    const dow = weekdayOf(dateArg(serial));
    const type = Math.trunc(optNumber(returnType, 1));
    if (type === 1) return dow + 1;
    if (type === 2) return ((dow + 6) % 7) + 1;
    if (type === 3) return (dow + 6) % 7;
    if (type >= 11 && type <= 17)
      return ((dow - ((type - 10) % 7) + 7) % 7) + 1;
    return fail(ERROR_NUM);
  },
  WEEKNUM: (serial, returnType) => {
    const n = dayArg(serial);
    const type = Math.trunc(optNumber(returnType, 1));
    if (type === 21) return isoWeekNum(n);
    const start = WEEK_START[type];
    if (start === undefined) fail(ERROR_NUM);
    const jan1 = Math.max(serialFromYMD(ymdFromSerial(n)[0], 1, 1), 1);
    const offset = (weekdayOf(jan1) - start + 7) % 7;
    return Math.floor((n - jan1 + offset) / 7) + 1;
  },
  ISOWEEKNUM: (serial) => isoWeekNum(dayArg(serial)),

  // Arithmetic
  EDATE: (start, months) => {
    const [y, m, d] = ymdFromSerial(dayArg(start));
    const [ty, tm] = addMonths(y, m, intArg(months));
    return checkSerial(serialFromYMD(ty, tm, Math.min(d, daysInMonth(ty, tm))));
  },
  EOMONTH: (start, months) => {
    const [y, m] = ymdFromSerial(dayArg(start));
    const [ty, tm] = addMonths(y, m, intArg(months));
    return checkSerial(serialFromYMD(ty, tm, daysInMonth(ty, tm)));
  },
  DAYS: (end, start) => dayArg(end) - dayArg(start),
  DAYS360: (start, end, method) =>
    days360(
      dayArg(start),
      dayArg(end),
      !(method !== undefined && toBoolean(method))
    ),
  YEARFRAC: (start, end, basis) =>
    yearFrac(dayArg(start), dayArg(end), basisArg(basis)),
  DATEDIF: (start, end, unit) => {
    const s = dayArg(start);
    const e = dayArg(end);
    if (s > e) fail(ERROR_NUM);
    const [sy, sm, sd] = ymdFromSerial(s);
    const [ey, em, ed] = ymdFromSerial(e);
    let months = (ey - sy) * 12 + em - sm;
    if (ed < sd) months -= 1;
    switch (textArg(unit).toUpperCase()) {
      case "Y":
        return Math.floor(months / 12);
      case "M":
        return months;
      case "D":
        return e - s;
      case "MD":
        return ed >= sd ? ed - sd : e - serialFromYMD(ey, em - 1, sd);
      case "YM":
        return months % 12;
      case "YD": {
        let anchor = serialFromYMD(ey, sm, sd);
        if (anchor > e) anchor = serialFromYMD(ey - 1, sm, sd);
        return e - anchor;
      }
      default:
        return fail(ERROR_NUM);
    }
  },

  // Working days
  NETWORKDAYS: (start, end, holidays) =>
    networkDays(start, end, weekendMask(1), holidaySet(holidays)),
  "NETWORKDAYS.INTL": (start, end, weekend, holidays) =>
    networkDays(start, end, weekendMask(weekend), holidaySet(holidays)),
  WORKDAY: (start, days, holidays) =>
    workDay(start, days, weekendMask(1), holidaySet(holidays)),
  "WORKDAY.INTL": (start, days, weekend, holidays) =>
    workDay(start, days, weekendMask(weekend), holidaySet(holidays)),

  // Cash flows
  NPV: (rate, ...values) => {
    const r = toNumber(rate);
    if (r === -1) fail(ERROR_DIV_ZERO);
    return collectNumbers(values).reduce(
      (acc, v, i) => acc + v / (1 + r) ** (i + 1),
      0
    );
  },

  // Coupons
  COUPDAYBS: (settlement, maturity, frequency, basis) =>
    bond(settlement, maturity, frequency, basis).A,
  COUPDAYS: (settlement, maturity, frequency, basis) =>
    bond(settlement, maturity, frequency, basis).E,
  COUPDAYSNC: (settlement, maturity, frequency, basis) =>
    bond(settlement, maturity, frequency, basis).DSC,
  COUPNCD: (settlement, maturity, frequency, basis) =>
    bond(settlement, maturity, frequency, basis).ncd,
  COUPPCD: (settlement, maturity, frequency, basis) =>
    bond(settlement, maturity, frequency, basis).pcd,
  COUPNUM: (settlement, maturity, frequency, basis) =>
    bond(settlement, maturity, frequency, basis).N,

  // Coupon bonds
  PRICE: (settlement, maturity, rate, yld, redemption, frequency, basis) => {
    const c = bond(settlement, maturity, frequency, basis);
    const r = toNumber(rate);
    const y = toNumber(yld);
    const red = toNumber(redemption);
    if (r < 0 || y < 0 || red <= 0) fail(ERROR_NUM);
    return bondPrice(c, r, y, red);
  },
  YIELD: (settlement, maturity, rate, pr, redemption, frequency, basis) => {
    const c = bond(settlement, maturity, frequency, basis);
    const r = toNumber(rate);
    const price = toNumber(pr);
    const red = toNumber(redemption);
    if (r < 0) fail(ERROR_NUM);
    positive(price, red);
    if (c.N === 1) {
      const { A, E, DSC, f } = c;
      const paid = price / 100 + (A / E) * (r / f);
      return ((red / 100 + r / f - paid) / paid) * ((f * E) / DSC);
    }
    return solveDecreasing((y) => bondPrice(c, r, y, red), price, -c.f + 1e-10);
  },
  DURATION: (settlement, maturity, coupon, yld, frequency, basis) =>
    duration(settlement, maturity, coupon, yld, frequency, basis).dur,
  MDURATION: (settlement, maturity, coupon, yld, frequency, basis) => {
    const { dur, y, f } = duration(
      settlement,
      maturity,
      coupon,
      yld,
      frequency,
      basis
    );
    return dur / (1 + y / f);
  },
  ACCRINT: (
    issue,
    firstInterest,
    settlement,
    rate,
    par,
    frequency,
    basis,
    calcMethod
  ) => {
    const iss = dayArg(issue);
    const first = dayArg(firstInterest);
    const s = dayArg(settlement);
    const r = toNumber(rate);
    const p = optNumber(par, 1000);
    const f = intArg(frequency);
    const b = basisArg(basis);
    const fromIssue =
      calcMethod === undefined || calcMethod === null || toBoolean(calcMethod);
    positive(r, p);
    if (![1, 2, 4].includes(f) || iss >= s) fail(ERROR_NUM);
    const from = !fromIssue && s > first ? first : iss;
    return p * r * yearFrac(from, s, b);
  },
  ACCRINTM: (issue, settlement, rate, par, basis) => {
    const iss = dayArg(issue);
    const s = dayArg(settlement);
    const r = toNumber(rate);
    const p = optNumber(par, 1000);
    const b = basisArg(basis);
    positive(r, p);
    if (iss >= s) fail(ERROR_NUM);
    return p * r * yearFrac(iss, s, b);
  },

  // Discounted & at-maturity securities
  PRICEDISC: (settlement, maturity, discount, redemption, basis) => {
    const { yf } = discountArgs(settlement, maturity, basis);
    const d = toNumber(discount);
    const red = toNumber(redemption);
    positive(d, red);
    return red * (1 - d * yf);
  },
  YIELDDISC: (settlement, maturity, pr, redemption, basis) => {
    const { yf } = discountArgs(settlement, maturity, basis);
    const price = toNumber(pr);
    const red = toNumber(redemption);
    positive(price, red);
    return (red / price - 1) / yf;
  },
  DISC: (settlement, maturity, pr, redemption, basis) => {
    const { yf } = discountArgs(settlement, maturity, basis);
    const price = toNumber(pr);
    const red = toNumber(redemption);
    positive(price, red);
    return (1 - price / red) / yf;
  },
  INTRATE: (settlement, maturity, investment, redemption, basis) => {
    const { yf } = discountArgs(settlement, maturity, basis);
    const inv = toNumber(investment);
    const red = toNumber(redemption);
    positive(inv, red);
    return (red / inv - 1) / yf;
  },
  RECEIVED: (settlement, maturity, investment, discount, basis) => {
    const { yf } = discountArgs(settlement, maturity, basis);
    const inv = toNumber(investment);
    const d = toNumber(discount);
    positive(inv, d);
    const denom = 1 - d * yf;
    if (denom <= 0) fail(ERROR_NUM);
    return inv / denom;
  },
  PRICEMAT: (settlement, maturity, issue, rate, yld, basis) => {
    const { s, m, b, yf: setMat } = discountArgs(settlement, maturity, basis);
    const iss = dayArg(issue);
    const r = toNumber(rate);
    const y = toNumber(yld);
    if (r < 0 || y < 0 || iss > s) fail(ERROR_NUM);
    const issMat = yearFrac(iss, m, b);
    const issSet = yearFrac(iss, s, b);
    return ((1 + issMat * r) / (1 + setMat * y) - issSet * r) * 100;
  },
  YIELDMAT: (settlement, maturity, issue, rate, pr, basis) => {
    const { s, m, b, yf: setMat } = discountArgs(settlement, maturity, basis);
    const iss = dayArg(issue);
    const r = toNumber(rate);
    const price = toNumber(pr);
    if (r < 0 || iss > s) fail(ERROR_NUM);
    positive(price);
    const issMat = yearFrac(iss, m, b);
    const issSet = yearFrac(iss, s, b);
    return ((1 + issMat * r) / (price / 100 + issSet * r) - 1) / setMat;
  },

  // Treasury bills
  TBILLPRICE: (settlement, maturity, discount) => {
    const dsm = tbillDays(settlement, maturity);
    const d = toNumber(discount);
    positive(d);
    const price = 100 * (1 - (d * dsm) / 360);
    positive(price);
    return price;
  },
  TBILLYIELD: (settlement, maturity, pr) => {
    const dsm = tbillDays(settlement, maturity);
    const price = toNumber(pr);
    positive(price);
    return ((100 - price) / price) * (360 / dsm);
  },
  TBILLEQ: (settlement, maturity, discount) => {
    const dsm = tbillDays(settlement, maturity);
    const d = toNumber(discount);
    positive(d);
    if (dsm <= 182) return (365 * d) / (360 - d * dsm);
    const price = 100 * (1 - (d * dsm) / 360);
    positive(price);
    const t = dsm / 365;
    return (
      (-t + Math.sqrt(t * t - (2 * t - 1) * (1 - 100 / price))) / (t - 0.5)
    );
  },
};

export default withArity(FUNCTIONS, {
  DATE: 3,
  DATEVALUE: 1,
  TIME: 3,
  TIMEVALUE: 1,
  YEAR: 1,
  MONTH: 1,
  DAY: 1,
  HOUR: 1,
  MINUTE: 1,
  SECOND: 1,
  WEEKDAY: 1,
  WEEKNUM: 1,
  ISOWEEKNUM: 1,
  EDATE: 2,
  EOMONTH: 2,
  DAYS: 2,
  DAYS360: 2,
  YEARFRAC: 2,
  DATEDIF: 3,
  NETWORKDAYS: 2,
  "NETWORKDAYS.INTL": 2,
  WORKDAY: 2,
  "WORKDAY.INTL": 2,
  NPV: 2,
  COUPDAYBS: 3,
  COUPDAYS: 3,
  COUPDAYSNC: 3,
  COUPNCD: 3,
  COUPPCD: 3,
  COUPNUM: 3,
  PRICE: 6,
  YIELD: 6,
  DURATION: 5,
  MDURATION: 5,
  ACCRINT: 6,
  ACCRINTM: 3,
  PRICEDISC: 4,
  YIELDDISC: 4,
  DISC: 4,
  INTRATE: 4,
  RECEIVED: 4,
  PRICEMAT: 5,
  YIELDMAT: 5,
  TBILLPRICE: 3,
  TBILLYIELD: 3,
  TBILLEQ: 3,
});
