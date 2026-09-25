// Remaining Excel functions from the function-list audit (see
// ../../FUNCTIONS.md): text (BAHTTEXT, ASC, DBCS, JIS, PHONETIC, the
// byte-counting "B" variants), web (ENCODEURL), information (INFO), add-in
// (EUROCONVERT), lookup (IMAGE placeholder, AREAS) and the compatibility
// names CONFIDENCE, PERCENTRANK, POISSON and WEIBULL.
// See ./index.js for the calling convention.
//
// Documented approximations:
// * The "B" functions (LENB, LEFTB, ...) behave like their character
//   versions, which is what Excel does unless a DBCS language (Japanese,
//   Chinese, Korean) is the default editing language.
// * ASC/DBCS/JIS convert between half- and full-width forms of ASCII,
//   the ideographic space and katakana, whatever the editing language.
// * PHONETIC returns the text itself (cells carry no furigana here).
// * INFO answers with fixed values describing a web host.
// * IMAGE cannot produce an in-cell picture yet: it returns its alt text (or
//   the source URL) so dependent formulas still see a value.
// * AREAS only sees values, so every reference counts as one area.

import { ERROR_NUM, ERROR_VALUE } from "../error";
import {
  fail,
  isErrorValue,
  optNumber,
  toBoolean,
  toError,
  toNumber,
} from "./math-stats";
import { functionByName } from "./eta";

function scalarOf(v) {
  let x = v;
  while (Array.isArray(x)) x = x[0];
  if (isErrorValue(x)) throw toError(x);
  return x;
}

function text(v) {
  const x = scalarOf(v);
  if (x === null || x === undefined) return "";
  if (typeof x === "boolean") return x ? "TRUE" : "FALSE";
  if (typeof x === "number") return functionByName("VALUETOTEXT")(x);
  return String(x);
}

// Alias of another function; fewer than `required` arguments is #VALUE!.
function delegate(name, required = 0) {
  return (...args) => {
    if (args.length < required || args.slice(0, required).includes(undefined)) {
      fail(ERROR_VALUE);
    }
    return functionByName(name)(...args);
  };
}

/* -------------------------------------------------------------------------- */
/* BAHTTEXT                                                                   */
/* -------------------------------------------------------------------------- */

const THAI_DIGITS = [
  "ศูนย์",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const THAI_MILLION = "ล้าน";

// Words for 0 < n < 1,000,000; `higher` tells whether larger groups exist.
function thaiGroup(n, higher) {
  const digits = String(n).split("").map(Number);
  const len = digits.length;
  let out = "";
  digits.forEach((d, i) => {
    const place = len - 1 - i;
    if (d === 0) return;
    if (place === 0) {
      out += d === 1 && (len > 1 || higher) ? "เอ็ด" : THAI_DIGITS[d];
    } else if (place === 1) {
      if (d === 1) out += "สิบ";
      else if (d === 2) out += "ยี่สิบ";
      else out += THAI_DIGITS[d] + "สิบ";
    } else {
      out += THAI_DIGITS[d] + THAI_PLACES[place];
    }
  });
  return out;
}

function thaiNumber(n) {
  if (n === 0) return THAI_DIGITS[0];
  const groups = [];
  let rest = n;
  while (rest > 0) {
    groups.unshift(rest % 1000000);
    rest = Math.floor(rest / 1000000);
  }
  let out = "";
  groups.forEach((g, i) => {
    if (g > 0) out += thaiGroup(g, i > 0);
    if (i < groups.length - 1) out += THAI_MILLION;
  });
  return out;
}

function BAHTTEXT(value) {
  if (value === undefined) fail(ERROR_VALUE);
  const number = toNumber(value);
  const negative = number < 0;
  const cents = Math.round(Math.abs(number) * 100);
  const baht = Math.floor(cents / 100);
  const satang = cents % 100;
  let out = "";
  if (baht > 0 || satang === 0) out += `${thaiNumber(baht)}บาท`;
  out += satang === 0 ? "ถ้วน" : `${thaiNumber(satang)}สตางค์`;
  return (negative ? "ลบ" : "") + out;
}

/* -------------------------------------------------------------------------- */
/* Width conversion (ASC / DBCS / JIS)                                        */
/* -------------------------------------------------------------------------- */

const HALF_KANA =
  "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ";
const FULL_KANA =
  "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜";
const VOICED_BASE = "カキクケコサシスセソタチツテトハヒフヘホウ";
const VOICED = "ガギグゲゴザジズゼゾダヂヅデドバビブベボヴ";
const SEMI_BASE = "ハヒフヘホ";
const SEMI = "パピプペポ";

function toHalfWidth(str) {
  let out = "";
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0);
    } else if (code === 0x3000) {
      out += " ";
    } else if (VOICED.includes(ch)) {
      const base = VOICED_BASE[VOICED.indexOf(ch)];
      out += HALF_KANA[FULL_KANA.indexOf(base)] + "ﾞ";
    } else if (SEMI.includes(ch)) {
      const base = SEMI_BASE[SEMI.indexOf(ch)];
      out += HALF_KANA[FULL_KANA.indexOf(base)] + "ﾟ";
    } else if (FULL_KANA.includes(ch)) {
      out += HALF_KANA[FULL_KANA.indexOf(ch)];
    } else {
      out += ch;
    }
  }
  return out;
}

function toFullWidth(str) {
  const chars = Array.from(str);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.codePointAt(0);
    if (code >= 0x21 && code <= 0x7e) {
      out += String.fromCharCode(code + 0xfee0);
    } else if (code === 0x20) {
      out += "　";
    } else if (HALF_KANA.includes(ch)) {
      let full = FULL_KANA[HALF_KANA.indexOf(ch)];
      const next = chars[i + 1];
      if (next === "ﾞ" && VOICED_BASE.includes(full)) {
        full = VOICED[VOICED_BASE.indexOf(full)];
        i++;
      } else if (next === "ﾟ" && SEMI_BASE.includes(full)) {
        full = SEMI[SEMI_BASE.indexOf(full)];
        i++;
      }
      out += full;
    } else {
      out += ch;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* ENCODEURL                                                                  */
/* -------------------------------------------------------------------------- */

function ENCODEURL(value) {
  if (value === undefined) fail(ERROR_VALUE);
  return encodeURIComponent(text(value)).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/* -------------------------------------------------------------------------- */
/* INFO                                                                       */
/* -------------------------------------------------------------------------- */

const INFO_VALUES = {
  directory: "/",
  numfile: 1,
  origin: "$A:$A$1",
  osversion: "Web",
  recalc: "Automatic",
  release: "16.0",
  system: "pcdos",
};

function INFO(type) {
  if (type === undefined) fail(ERROR_VALUE);
  const key = text(type).toLowerCase();
  if (!(key in INFO_VALUES)) fail(ERROR_VALUE);
  return INFO_VALUES[key];
}

/* -------------------------------------------------------------------------- */
/* EUROCONVERT                                                                */
/* -------------------------------------------------------------------------- */

// [units per euro, rounding decimals]
const EURO_RATES = {
  EUR: [1, 2],
  BEF: [40.3399, 0],
  LUF: [40.3399, 0],
  DEM: [1.95583, 2],
  ESP: [166.386, 0],
  FRF: [6.55957, 2],
  IEP: [0.787564, 2],
  ITL: [1936.27, 0],
  NLG: [2.20371, 2],
  ATS: [13.7603, 2],
  PTE: [200.482, 2],
  FIM: [5.94573, 2],
  GRD: [340.75, 2],
  SIT: [239.64, 2],
  CYP: [0.585274, 2],
  MTL: [0.4293, 2],
  SKK: [30.126, 2],
  EEK: [15.6466, 2],
  LVL: [0.702804, 2],
  LTL: [3.4528, 2],
};

function roundTo(x, digits) {
  const f = 10 ** digits;
  return (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9)) / f;
}

function EUROCONVERT(number, source, target, fullPrecision, triangulation) {
  if (target === undefined) fail(ERROR_VALUE);
  const value = toNumber(number);
  const from = EURO_RATES[text(source).toUpperCase()];
  const to = EURO_RATES[text(target).toUpperCase()];
  if (!from || !to) fail(ERROR_VALUE);
  const full =
    fullPrecision === undefined || fullPrecision === null
      ? false
      : toBoolean(fullPrecision);
  let euros = value / from[0];
  if (triangulation !== undefined && triangulation !== null) {
    const digits = Math.trunc(toNumber(triangulation));
    if (digits < 3) fail(ERROR_VALUE);
    if (from[0] !== 1 && to[0] !== 1) euros = roundTo(euros, digits);
  }
  const result = euros * to[0];
  return full ? result : roundTo(result, to[1]);
}

/* -------------------------------------------------------------------------- */
/* Math and text fixes (formulajs disagrees with Excel)                       */
/* -------------------------------------------------------------------------- */

const ROMAN_CHARS = ["M", "D", "C", "L", "X", "V", "I"];
const ROMAN_VALUES = [1000, 500, 100, 50, 10, 5, 1];

// ROMAN with Excel's forms 0 (classic) to 4 (simplified), the algorithm
// LibreOffice documents as Excel-compatible.
function ROMAN(number, form) {
  if (number === undefined) fail(ERROR_VALUE);
  let mode = 0;
  if (form !== undefined && form !== null) {
    const f = scalarOf(form);
    if (typeof f === "boolean") mode = f ? 0 : 4;
    else mode = Math.floor(toNumber(f));
  }
  let value = Math.floor(toNumber(number));
  if (mode < 0 || mode > 4 || value < 0 || value > 3999) fail(ERROR_VALUE);
  const maxIndex = ROMAN_VALUES.length - 1;
  let out = "";
  for (let i = 0; i <= maxIndex / 2; i++) {
    let index = 2 * i;
    const digit = Math.floor(value / ROMAN_VALUES[index]);
    if (digit % 5 === 4) {
      const index2 = digit === 4 ? index - 1 : index - 2;
      let steps = 0;
      while (steps < mode && index < maxIndex) {
        steps++;
        if (ROMAN_VALUES[index2] - ROMAN_VALUES[index + 1] <= value) index++;
        else steps = mode;
      }
      out += ROMAN_CHARS[index] + ROMAN_CHARS[index2];
      value += ROMAN_VALUES[index] - ROMAN_VALUES[index2];
    } else {
      if (digit > 4) out += ROMAN_CHARS[index - 1];
      out += ROMAN_CHARS[index].repeat(digit % 5);
      value %= ROMAN_VALUES[index];
    }
  }
  return out;
}

const ARABIC_VALUES = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };

function ARABIC(textArg) {
  if (textArg === undefined) fail(ERROR_VALUE);
  let str = text(textArg).trim().toUpperCase();
  if (str.length > 255) fail(ERROR_VALUE);
  let sign = 1;
  if (str[0] === "-") {
    sign = -1;
    str = str.slice(1);
  }
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const v = ARABIC_VALUES[str[i]];
    if (!v) fail(ERROR_VALUE);
    const next = ARABIC_VALUES[str[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return sign * total;
}

function FACT(number) {
  if (number === undefined) fail(ERROR_VALUE);
  const n = Math.trunc(toNumber(number));
  if (n < 0 || n > 170) fail(ERROR_NUM);
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function SERIESSUM(x, n, m, coefficients) {
  if (coefficients === undefined) fail(ERROR_VALUE);
  const base = toNumber(x);
  const start = toNumber(n);
  const step = toNumber(m);
  const list = Array.isArray(coefficients)
    ? coefficients.flat(Infinity)
    : [coefficients];
  let sum = 0;
  list.forEach((c, i) => {
    if (isErrorValue(c)) throw toError(c);
    if (typeof c !== "number") fail(ERROR_VALUE);
    sum += c * base ** (start + i * step);
  });
  return sum;
}

function roundHalfAway(x, digits) {
  const f = 10 ** Math.abs(digits);
  const scaled = digits >= 0 ? Math.abs(x) * f : Math.abs(x) / f;
  const r = Math.round(Number(scaled.toPrecision(15)));
  return Math.sign(x) * (digits >= 0 ? r / f : r * f);
}

// DOLLAR in the en-US currency format: $#,##0.00 with (negatives).
function DOLLAR(number, decimals) {
  if (number === undefined) fail(ERROR_VALUE);
  const value = toNumber(number);
  const d = Math.trunc(optNumber(decimals, 2));
  if (d > 127) fail(ERROR_VALUE);
  const rounded = roundHalfAway(value, d);
  const body = Math.abs(rounded)
    .toFixed(Math.max(0, d))
    .replace(/^(\d+)/, (int) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  return rounded < 0 ? `($${body})` : `$${body}`;
}

/* -------------------------------------------------------------------------- */
/* IMAGE / AREAS                                                              */
/* -------------------------------------------------------------------------- */

function IMAGE(source, altText, sizing, height, width) {
  if (source === undefined) fail(ERROR_VALUE);
  const src = scalarOf(source);
  if (typeof src !== "string" || src === "") fail(ERROR_VALUE);
  const mode = Math.trunc(optNumber(sizing, 0));
  if (mode < 0 || mode > 3) fail(ERROR_VALUE);
  if (mode === 3) {
    const h = optNumber(height, 0);
    const w = optNumber(width, 0);
    if (h <= 0 && w <= 0) fail(ERROR_VALUE);
  }
  const alt = altText === undefined || altText === null ? "" : text(altText);
  return alt || src;
}

function AREAS(reference) {
  if (reference === undefined) fail(ERROR_VALUE);
  return 1;
}

export default {
  ROMAN,
  ARABIC,
  FACT,
  SERIESSUM,
  DOLLAR,
  BAHTTEXT,
  ASC: (v) => {
    if (v === undefined) fail(ERROR_VALUE);
    return toHalfWidth(text(v));
  },
  DBCS: (v) => {
    if (v === undefined) fail(ERROR_VALUE);
    return toFullWidth(text(v));
  },
  JIS: (v) => {
    if (v === undefined) fail(ERROR_VALUE);
    return toFullWidth(text(v));
  },
  PHONETIC: (v) => {
    if (v === undefined) fail(ERROR_VALUE);
    return text(v);
  },
  FINDB: delegate("FIND", 2),
  SEARCHB: delegate("SEARCH", 2),
  LEFTB: delegate("LEFT", 1),
  RIGHTB: delegate("RIGHT", 1),
  MIDB: delegate("MID", 3),
  LENB: delegate("LEN", 1),
  REPLACEB: delegate("REPLACE", 4),
  ENCODEURL,
  INFO,
  EUROCONVERT,
  IMAGE,
  AREAS,
  CONFIDENCE: delegate("CONFIDENCE.NORM", 3),
  PERCENTRANK: delegate("PERCENTRANK.INC", 2),
  POISSON: delegate("POISSON.DIST", 3),
  WEIBULL: delegate("WEIBULL.DIST", 4),
};

export { toHalfWidth, toFullWidth };
