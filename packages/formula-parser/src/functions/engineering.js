// Engineering functions: CONVERT (Excel's full unit table), ERF, ERF.PRECISE,
// ERFC, ERFC.PRECISE. See ./index.js for the calling convention.
//
// CONVERT follows Excel's documented unit list. Unit names and prefixes are
// case-sensitive; a unit name matches before a prefixed reading ("mi" is a
// mile, "min" a minute, "pc" a parsec). Metric prefixes (Y ... y, "da"/"e")
// apply to the units Excel marks as metric; binary prefixes (ki ... Yi) only
// to "bit" and "byte". Squared and cubed metric units scale the prefix too
// ("km2" is a square kilometre). Temperatures are converted through kelvin.
// Unknown units or units of different groups → #N/A.

import { ERROR_NOT_AVAILABLE, ERROR_NUM, ERROR_VALUE } from "../error";
import { fail, isErrorValue, toError, toNumber } from "./math-stats";

const LY = 9460730472580800;
const PICA_POINT = 0.0254 / 72;
const MILE = 1609.344;
const NMI = 1852;

// [group, factor to the group's base unit, accepts metric prefixes, names...]
const UNITS = [
  // Mass (gram)
  ["mass", 1, true, "g"],
  ["mass", 14593.9029372064, false, "sg"],
  ["mass", 453.59237, false, "lbm"],
  ["mass", 1.660538782e-24, true, "u"],
  ["mass", 28.349523125, false, "ozm"],
  ["mass", 0.06479891, false, "grain"],
  ["mass", 45359.237, false, "cwt", "shweight"],
  ["mass", 50802.34544, false, "uk_cwt", "lcwt", "hweight"],
  ["mass", 6350.29318, false, "stone"],
  ["mass", 907184.74, false, "ton"],
  ["mass", 1016046.9088, false, "uk_ton", "LTON", "brton"],
  // Distance (metre)
  ["length", 1, true, "m"],
  ["length", MILE, false, "mi"],
  ["length", NMI, false, "Nmi"],
  ["length", 0.0254, false, "in"],
  ["length", 0.3048, false, "ft"],
  ["length", 0.9144, false, "yd"],
  ["length", 1e-10, true, "ang"],
  ["length", 1.143, false, "ell"],
  ["length", LY, true, "ly"],
  ["length", 30856775812815500, true, "parsec", "pc"],
  ["length", PICA_POINT, false, "Picapt", "Pica"],
  ["length", 0.0254 / 6, false, "pica"],
  ["length", (5280 * 1200) / 3937, false, "survey_mi"],
  // Time (second)
  ["time", 31557600, true, "yr"],
  ["time", 86400, true, "day", "d"],
  ["time", 3600, true, "hr"],
  ["time", 60, true, "mn", "min"],
  ["time", 1, true, "sec", "s"],
  // Pressure (pascal)
  ["pressure", 1, true, "Pa", "p"],
  ["pressure", 101325, true, "atm", "at"],
  ["pressure", 133.322, true, "mmHg"],
  ["pressure", 6894.75729316836, true, "psi"],
  ["pressure", 101325 / 760, true, "Torr"],
  // Force (newton)
  ["force", 1, true, "N"],
  ["force", 1e-5, true, "dyn", "dy"],
  ["force", 4.4482216152605, false, "lbf"],
  ["force", 0.00980665, true, "pond"],
  // Energy (joule)
  ["energy", 1, true, "J"],
  ["energy", 1e-7, true, "e"],
  ["energy", 4.184, true, "c"],
  ["energy", 4.1868, true, "cal"],
  ["energy", 1.602176487e-19, true, "eV", "ev"],
  ["energy", 2684519.53769617, false, "HPh", "hh"],
  ["energy", 3600, true, "Wh", "wh"],
  ["energy", 0.0421401100938048, false, "flb"],
  ["energy", 1055.05585262, false, "BTU", "btu"],
  // Power (watt)
  ["power", 745.69987158227, false, "HP", "h"],
  ["power", 735.49875, false, "PS"],
  ["power", 1, true, "W", "w"],
  // Magnetism (tesla)
  ["magnetism", 1, true, "T"],
  ["magnetism", 1e-4, true, "ga"],
  // Temperature (handled separately; factor unused)
  ["temperature", 1, false, "C", "cel"],
  ["temperature", 1, false, "F", "fah"],
  ["temperature", 1, true, "K", "kel"],
  ["temperature", 1, false, "Rank"],
  ["temperature", 1, false, "Reau"],
  // Volume (cubic metre)
  ["volume", 4.92892159375e-6, false, "tsp"],
  ["volume", 5e-6, false, "tspm"],
  ["volume", 1.478676478125e-5, false, "tbs"],
  ["volume", 2.95735295625e-5, false, "oz"],
  ["volume", 2.365882365e-4, false, "cup"],
  ["volume", 4.73176473e-4, false, "pt", "us_pt"],
  ["volume", 5.6826125e-4, false, "uk_pt"],
  ["volume", 9.46352946e-4, false, "qt"],
  ["volume", 1.1365225e-3, false, "uk_qt"],
  ["volume", 3.785411784e-3, false, "gal"],
  ["volume", 4.54609e-3, false, "uk_gal"],
  ["volume", 1e-3, true, "l", "L", "lt"],
  ["volume", 1e-30, true, "ang3", "ang^3", 3],
  ["volume", 0.158987294928, false, "barrel"],
  ["volume", 0.03523907016688, false, "bushel"],
  ["volume", 0.028316846592, false, "ft3", "ft^3"],
  ["volume", 1.6387064e-5, false, "in3", "in^3"],
  ["volume", LY ** 3, false, "ly3", "ly^3"],
  ["volume", 1, true, "m3", "m^3", 3],
  ["volume", MILE ** 3, false, "mi3", "mi^3"],
  ["volume", 0.764554857984, false, "yd3", "yd^3"],
  ["volume", NMI ** 3, false, "Nmi3", "Nmi^3"],
  ["volume", PICA_POINT ** 3, false, "Picapt3", "Picapt^3", "Pica3", "Pica^3"],
  ["volume", 2.8316846592, false, "GRT", "regton"],
  ["volume", 1.13267386368, false, "MTON"],
  // Area (square metre)
  ["area", 4046.8564224, false, "uk_acre"],
  ["area", 4046.87260987425, false, "us_acre"],
  ["area", 1e-20, true, "ang2", "ang^2", 2],
  ["area", 100, true, "ar"],
  ["area", 0.09290304, false, "ft2", "ft^2"],
  ["area", 10000, false, "ha"],
  ["area", 6.4516e-4, false, "in2", "in^2"],
  ["area", LY ** 2, false, "ly2", "ly^2"],
  ["area", 1, true, "m2", "m^2", 2],
  ["area", 2500, false, "Morgen"],
  ["area", MILE ** 2, false, "mi2", "mi^2"],
  ["area", NMI ** 2, false, "Nmi2", "Nmi^2"],
  ["area", PICA_POINT ** 2, false, "Picapt2", "Pica2", "Pica^2", "Picapt^2"],
  ["area", 0.83612736, false, "yd2", "yd^2"],
  // Information (bit)
  ["information", 1, true, "bit"],
  ["information", 8, true, "byte"],
  // Speed (metre per second)
  ["speed", (6080 * 0.3048) / 3600, false, "admkn"],
  ["speed", NMI / 3600, false, "kn"],
  ["speed", 1 / 3600, true, "m/h", "m/hr"],
  ["speed", 1, true, "m/s", "m/sec"],
  ["speed", 0.44704, false, "mph"],
];

const UNIT_MAP = new Map();
UNITS.forEach((entry) => {
  const [group, factor, prefixable, ...names] = entry;
  const power = typeof names[names.length - 1] === "number" ? names.pop() : 1;
  names.forEach((name) =>
    UNIT_MAP.set(name, { group, factor, prefixable, power, name: names[0] })
  );
});

const PREFIXES = [
  ["da", 10],
  ["Y", 1e24],
  ["Z", 1e21],
  ["E", 1e18],
  ["P", 1e15],
  ["T", 1e12],
  ["G", 1e9],
  ["M", 1e6],
  ["k", 1e3],
  ["h", 1e2],
  ["e", 10],
  ["d", 1e-1],
  ["c", 1e-2],
  ["m", 1e-3],
  ["u", 1e-6],
  ["n", 1e-9],
  ["p", 1e-12],
  ["f", 1e-15],
  ["a", 1e-18],
  ["z", 1e-21],
  ["y", 1e-24],
];

const BINARY_PREFIXES = [
  ["Yi", 2 ** 80],
  ["Zi", 2 ** 70],
  ["Ei", 2 ** 60],
  ["Pi", 2 ** 50],
  ["Ti", 2 ** 40],
  ["Gi", 2 ** 30],
  ["Mi", 2 ** 20],
  ["ki", 2 ** 10],
];

/** Resolve a unit string into { group, factor, name, scale }. */
function resolveUnit(text) {
  const exact = UNIT_MAP.get(text);
  if (exact) return { ...exact, scale: 1 };
  for (let i = 0; i < BINARY_PREFIXES.length; i++) {
    const [prefix, value] = BINARY_PREFIXES[i];
    if (text.startsWith(prefix)) {
      const unit = UNIT_MAP.get(text.slice(prefix.length));
      if (unit && unit.group === "information")
        return { ...unit, scale: value };
    }
  }
  for (let i = 0; i < PREFIXES.length; i++) {
    const [prefix, value] = PREFIXES[i];
    if (text.length > prefix.length && text.startsWith(prefix)) {
      const unit = UNIT_MAP.get(text.slice(prefix.length));
      if (unit && unit.prefixable) {
        return { ...unit, scale: value ** unit.power };
      }
    }
  }
  return null;
}

function toKelvin(value, unit) {
  switch (unit.name) {
    case "C":
      return value + 273.15;
    case "F":
      return ((value - 32) * 5) / 9 + 273.15;
    case "Rank":
      return (value * 5) / 9;
    case "Reau":
      return value * 1.25 + 273.15;
    default:
      return value * unit.scale;
  }
}

function fromKelvin(value, unit) {
  switch (unit.name) {
    case "C":
      return value - 273.15;
    case "F":
      return ((value - 273.15) * 9) / 5 + 32;
    case "Rank":
      return (value * 9) / 5;
    case "Reau":
      return (value - 273.15) / 1.25;
    default:
      return value / unit.scale;
  }
}

function unitText(v) {
  let x = v;
  while (Array.isArray(x)) x = x[0];
  if (isErrorValue(x)) throw toError(x);
  if (typeof x !== "string") fail(ERROR_NOT_AVAILABLE);
  return x;
}

// Excel shows CONVERT results with 15 significant digits.
function clean(x) {
  if (!Number.isFinite(x)) fail(ERROR_NUM);
  return x === 0 ? 0 : Number(x.toPrecision(15));
}

function CONVERT(number, fromUnit, toUnit) {
  if (toUnit === undefined) fail(ERROR_VALUE);
  const value = toNumber(number);
  const from = resolveUnit(unitText(fromUnit));
  const to = resolveUnit(unitText(toUnit));
  if (!from || !to || from.group !== to.group) fail(ERROR_NOT_AVAILABLE);
  if (from.group === "temperature") {
    return clean(fromKelvin(toKelvin(value, from), to));
  }
  return clean((value * from.factor * from.scale) / (to.factor * to.scale));
}

/* -------------------------------------------------------------------------- */
/* Error function                                                             */
/* -------------------------------------------------------------------------- */

// erf with ~1e-16 accuracy: series for small |x|, continued fraction for
// the complement otherwise.
function erf(x) {
  if (x < 0) return -erf(-x);
  if (x === 0) return 0;
  if (x < 2.5) {
    // Maclaurin series: 2/sqrt(pi) * sum (-1)^n x^(2n+1) / (n! (2n+1)).
    let term = x;
    let sum = x;
    const x2 = x * x;
    for (let n = 1; n < 200; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return (2 / Math.sqrt(Math.PI)) * sum;
  }
  return 1 - erfc(x);
}

function erfc(x) {
  if (x < 2.5) return 1 - erf(x);
  if (x > 27) return 0;
  // Lentz continued fraction for erfc(x) * exp(x^2) * sqrt(pi).
  const tiny = 1e-300;
  let f = x;
  let C = x;
  let D = 0;
  for (let n = 1; n < 500; n++) {
    const a = n / 2;
    D = x + a * D;
    D = Math.abs(D) < tiny ? 1 / tiny : 1 / D;
    C = x + a / C;
    if (Math.abs(C) < tiny) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / (f * Math.sqrt(Math.PI));
}

function ERF(lower, upper) {
  if (lower === undefined) fail(ERROR_VALUE);
  const a = toNumber(lower);
  if (upper === undefined || upper === null) return erf(a);
  return erf(toNumber(upper)) - erf(a);
}

function ERFC(x) {
  if (x === undefined) fail(ERROR_VALUE);
  const v = toNumber(x);
  return v < 0 ? 2 - erfc(-v) : erfc(v);
}

/* -------------------------------------------------------------------------- */
/* Base conversion (BIN2DEC, DEC2HEX, ...)                                    */
/* -------------------------------------------------------------------------- */

// Ten-digit two's complement per base; results must fit the target range.
const BASES = {
  2: { digits: /^[01]{0,10}$/, min: -512, max: 511 },
  8: { digits: /^[0-7]{0,10}$/, min: -536870912, max: 536870911 },
  16: {
    digits: /^[0-9A-Fa-f]{0,10}$/,
    min: -549755813888,
    max: 549755813887,
  },
};

function baseText(v) {
  let x = v;
  while (Array.isArray(x)) x = x[0];
  if (isErrorValue(x)) throw toError(x);
  if (x === null || x === undefined) return "0";
  if (typeof x === "boolean") fail(ERROR_VALUE);
  if (typeof x === "number") {
    if (x < 0 || x !== Math.floor(x)) fail(ERROR_NUM);
    return String(x);
  }
  return String(x).trim();
}

function parseBase(v, base) {
  const text = baseText(v);
  if (!BASES[base].digits.test(text)) fail(ERROR_NUM);
  if (text === "") return 0;
  const value = parseInt(text, base);
  const full = base ** 10;
  return value >= full / 2 ? value - full : value;
}

function formatBase(value, base, places) {
  const { min, max } = BASES[base];
  if (value < min || value > max) fail(ERROR_NUM);
  if (value < 0) return (base ** 10 + value).toString(base).toUpperCase();
  const text = value.toString(base).toUpperCase();
  if (places === undefined || places === null) return text;
  let p = places;
  while (Array.isArray(p)) p = p[0];
  if (isErrorValue(p)) throw toError(p);
  if (typeof p === "string" && Number.isNaN(Number(p))) fail(ERROR_VALUE);
  const n = Math.trunc(toNumber(p));
  if (n < 0 || n > 10 || text.length > n) fail(ERROR_NUM);
  return text.padStart(n, "0");
}

function decimalArg(v) {
  if (v === undefined) fail(ERROR_VALUE);
  return Math.trunc(toNumber(v));
}

function fromBase(base) {
  return (number) => {
    if (number === undefined) fail(ERROR_VALUE);
    return parseBase(number, base);
  };
}

function toBase(base) {
  return (number, places) => formatBase(decimalArg(number), base, places);
}

function baseToBase(from, to) {
  return (number, places) => {
    if (number === undefined) fail(ERROR_VALUE);
    return formatBase(parseBase(number, from), to, places);
  };
}

const BASE_FUNCTIONS = {
  BIN2DEC: fromBase(2),
  OCT2DEC: fromBase(8),
  HEX2DEC: fromBase(16),
  DEC2BIN: toBase(2),
  DEC2OCT: toBase(8),
  DEC2HEX: toBase(16),
  BIN2OCT: baseToBase(2, 8),
  BIN2HEX: baseToBase(2, 16),
  OCT2BIN: baseToBase(8, 2),
  OCT2HEX: baseToBase(8, 16),
  HEX2BIN: baseToBase(16, 2),
  HEX2OCT: baseToBase(16, 8),
};

export { erf, erfc };

export default {
  ...BASE_FUNCTIONS,
  CONVERT,
  ERF,
  "ERF.PRECISE": (x) => {
    if (x === undefined) fail(ERROR_VALUE);
    return erf(toNumber(x));
  },
  ERFC,
  "ERFC.PRECISE": ERFC,
};
