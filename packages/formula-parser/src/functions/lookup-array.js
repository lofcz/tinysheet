// Lookup & dynamic-array functions with Excel semantics.
// See ./index.js for the calling convention.
//
// Conventions used throughout this module:
// * Ranges / arrays arrive as 2D row-major arrays (a 1D JS array is treated
//   as a single row). Scalars arrive as plain JS values; blank cells are
//   null/undefined.
// * Array results are returned as 2D arrays. A 1x1 result is unwrapped to a
//   scalar, as Excel treats single-element arrays as scalars.
// * Whole-formula errors are thrown as `Error(ERROR_X)`. Errors that live
//   inside an array result (EXPAND/HSTACK padding, lifted lookups, …) are
//   `Error(ERROR_X)` instances placed in the array. Error values read from
//   cells arrive as display strings ("#N/A") and are recognised as errors.
// * An argument that is null/undefined is treated as omitted.
import {
  ERROR_CALC,
  ERROR_NOT_AVAILABLE,
  ERROR_NUM,
  ERROR_REF,
  ERROR_VALUE,
  isValidStrict,
} from "../error";

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

const MAX_ROWS = 1048576;
const MAX_COLS = 16384;
// Guard against runaway allocations (e.g. SEQUENCE(1048576, 16384)).
const MAX_CELLS = 10000000;

function fail(code) {
  throw new Error(code);
}

function isBlank(v) {
  return v === null || v === undefined;
}

function isOmitted(v) {
  return v === null || v === undefined;
}

function isErrorValue(v) {
  return v instanceof Error || (typeof v === "string" && isValidStrict(v));
}

function toError(v) {
  if (v instanceof Error) {
    return v;
  }
  return new Error(String(v).replace(/[#!?]/g, ""));
}

/** Normalise any value into a rectangular 2D array (ragged rows padded). */
function to2D(v) {
  if (!Array.isArray(v)) {
    return [[v]];
  }
  if (v.length === 0) {
    return [[null]];
  }
  let nested = false;
  for (let i = 0; i < v.length; i += 1) {
    if (Array.isArray(v[i])) {
      nested = true;
      break;
    }
  }
  if (!nested) {
    return [v.slice()];
  }
  let width = 0;
  for (let i = 0; i < v.length; i += 1) {
    const len = Array.isArray(v[i]) ? v[i].length : 1;
    if (len > width) width = len;
  }
  if (width === 0) {
    return [[null]];
  }
  return v.map((r) => {
    const row = Array.isArray(r) ? r.slice() : [r];
    while (row.length < width) row.push(null);
    return row;
  });
}

function transpose(a) {
  const rows = a.length;
  const cols = a[0].length;
  const out = new Array(cols);
  for (let c = 0; c < cols; c += 1) {
    const row = new Array(rows);
    for (let r = 0; r < rows; r += 1) row[r] = a[r][c];
    out[c] = row;
  }
  return out;
}

function flatten(a, byCol = false) {
  const out = [];
  if (byCol) {
    for (let c = 0; c < a[0].length; c += 1) {
      for (let r = 0; r < a.length; r += 1) out.push(a[r][c]);
    }
  } else {
    for (let r = 0; r < a.length; r += 1) {
      for (let c = 0; c < a[r].length; c += 1) out.push(a[r][c]);
    }
  }
  return out;
}

/** Return a 2D array, or its only element when it is 1x1. */
function result(a) {
  if (a.length === 1 && a[0].length === 1) {
    return a[0][0];
  }
  return a;
}

/** Single value of a (possibly 1x1 array) argument; bigger arrays are #VALUE!. */
function single(v) {
  if (Array.isArray(v)) {
    const a = to2D(v);
    if (a.length === 1 && a[0].length === 1) {
      return a[0][0];
    }
    fail(ERROR_VALUE);
  }
  return v;
}

/** Like single(), but error values propagate. */
function scalarArg(v) {
  const s = single(v);
  if (isErrorValue(s)) {
    throw toError(s);
  }
  return s;
}

function num(v, def = 0) {
  if (isOmitted(v)) {
    return def;
  }
  const s = scalarArg(v);
  if (isBlank(s)) return 0;
  if (typeof s === "number") {
    if (!Number.isFinite(s)) fail(ERROR_NUM);
    return s;
  }
  if (typeof s === "boolean") return s ? 1 : 0;
  if (typeof s === "string") {
    const t = s.trim();
    if (t !== "") {
      const n = Number(t);
      if (Number.isFinite(n)) return n;
    }
  }
  return fail(ERROR_VALUE);
}

function int(v, def = 0) {
  if (isOmitted(v)) {
    return def;
  }
  return Math.trunc(num(v));
}

function bool(v, def) {
  if (isOmitted(v)) {
    return def;
  }
  const s = scalarArg(v);
  if (isBlank(s)) return false;
  if (typeof s === "boolean") return s;
  if (typeof s === "number") return s !== 0;
  if (typeof s === "string") {
    const u = s.trim().toUpperCase();
    if (u === "TRUE") return true;
    if (u === "FALSE") return false;
  }
  return fail(ERROR_VALUE);
}

function blankTo0(v) {
  return isBlank(v) ? 0 : v;
}

/**
 * Result of a lookup: like result(), but a single blank cell reads as 0, the
 * way Excel displays a lookup that lands on an empty cell.
 */
function lookupResult(a) {
  if (a.length === 1 && a[0].length === 1) {
    return blankTo0(a[0][0]);
  }
  return a;
}

function isMulti(v) {
  if (!Array.isArray(v)) return false;
  const a = to2D(v);
  return a.length > 1 || a[0].length > 1;
}

function safeCall(fn, args) {
  try {
    const v = fn(...args);
    if (Array.isArray(v)) {
      return to2D(v)[0][0];
    }
    return v;
  } catch (e) {
    return e instanceof Error ? e : new Error(ERROR_VALUE);
  }
}

/**
 * Excel "lifting": when any of `values` is a multi-cell array, evaluate `fn`
 * element-wise with broadcasting (1-wide dimensions stretch, out-of-range
 * positions become #N/A) and return the array of results.
 */
function lift(values, fn) {
  if (!values.some(isMulti)) {
    return fn(...values.map((v) => (Array.isArray(v) ? single(v) : v)));
  }
  const grids = values.map((v) => (Array.isArray(v) ? to2D(v) : [[v]]));
  let rows = 1;
  let cols = 1;
  grids.forEach((g) => {
    rows = Math.max(rows, g.length);
    cols = Math.max(cols, g[0].length);
  });
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      const args = [];
      let outOfRange = false;
      grids.forEach((g) => {
        const rr = g.length === 1 ? 0 : r;
        const cc = g[0].length === 1 ? 0 : c;
        if (rr >= g.length || cc >= g[0].length) {
          outOfRange = true;
        } else {
          args.push(g[rr][cc]);
        }
      });
      row.push(
        outOfRange ? new Error(ERROR_NOT_AVAILABLE) : safeCall(fn, args)
      );
    }
    out.push(row);
  }
  return out;
}

/* ----------------------------- comparison ------------------------------- */

const collator =
  typeof Intl !== "undefined" && Intl.Collator
    ? new Intl.Collator("en", { numeric: false })
    : null;

/**
 * Type rank used by Excel for ordering: numbers < text < logicals < errors,
 * blanks last.
 */
function typeRank(v) {
  if (isBlank(v)) return 4;
  if (isErrorValue(v)) return 3;
  if (typeof v === "number") return 0;
  if (typeof v === "string") return 1;
  if (typeof v === "boolean") return 2;
  if (v instanceof Date) return 0;
  return 1;
}

function compareText(a, b) {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 0;
  if (collator) {
    const c = collator.compare(la, lb);
    if (c !== 0) return c < 0 ? -1 : 1;
  }
  return la < lb ? -1 : 1;
}

/** Compare two values of the same rank (0..2). */
function compareSame(a, b) {
  if (typeof a === "string") return compareText(a, String(b));
  const x = Number(a);
  const y = Number(b);
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

/** Excel sort order: numbers, text, logicals, errors; blanks always last. */
function sortCompare(a, b, order) {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra === 4 || rb === 4) {
    if (ra === rb) return 0;
    return ra === 4 ? 1 : -1;
  }
  if (ra !== rb) return (ra - rb) * order;
  if (ra === 3) return 0;
  return compareSame(a, b) * order;
}

function escapeRegExp(ch) {
  return ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** Convert an Excel wildcard pattern (* ? with ~ escape) into a RegExp. */
function wildcardToRegExp(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (
      ch === "~" &&
      i + 1 < pattern.length &&
      "*?~".includes(pattern[i + 1])
    ) {
      re += escapeRegExp(pattern[i + 1]);
      i += 1;
    } else if (ch === "*") {
      re += "[\\s\\S]*";
    } else if (ch === "?") {
      re += "[\\s\\S]";
    } else {
      re += escapeRegExp(ch);
    }
  }
  return new RegExp(`^${re}$`, "i");
}

/** Normalise a lookup value: errors propagate, blank looks up "". */
function lookupValueOf(v) {
  const s = single(v);
  if (isErrorValue(s)) throw toError(s);
  return isBlank(s) ? "" : s;
}

/** Predicate testing a cell for an exact (optionally wildcard) match. */
function exactMatcher(value, wildcard) {
  if (wildcard && typeof value === "string" && /[*?~]/.test(value)) {
    const re = wildcardToRegExp(value);
    return (cell) =>
      typeof cell === "string" && !isErrorValue(cell) && re.test(cell);
  }
  const rank = typeRank(value);
  return (cell) => typeRank(cell) === rank && compareSame(cell, value) === 0;
}

/** Indices of the entries sharing value's type (used by binary searches). */
function sameTypeIndices(vec, value) {
  const rank = typeRank(value);
  const idx = [];
  for (let i = 0; i < vec.length; i += 1) {
    if (typeRank(vec[i]) === rank) idx.push(i);
  }
  return idx;
}

/**
 * Classic approximate search used by MATCH(1/-1), VLOOKUP/HLOOKUP(TRUE) and
 * LOOKUP: binary search over values of the same type, returning the last
 * position whose value is <= (type 1, ascending data) or >= (type -1,
 * descending data) the lookup value; -1 when there is none.
 */
function approxIndex(value, vec, type) {
  const idx = sameTypeIndices(vec, value);
  // Inclusive-bounds bisection, as Excel probes unsorted data: e.g.
  // MATCH(40,{25,38,40,41},-1) is #N/A in Excel.
  let lo = 0;
  let hi = idx.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = compareSame(vec[idx[mid]], value);
    if (type > 0 ? c <= 0 : c >= 0) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best >= 0 ? idx[best] : -1;
}

function exactIndex(value, vec, wildcard) {
  const matches = exactMatcher(value, wildcard);
  for (let i = 0; i < vec.length; i += 1) {
    if (matches(vec[i])) return i;
  }
  return -1;
}

/** XLOOKUP / XMATCH search: returns a 0-based index or -1. */
function xIndex(value, vec, matchMode, searchMode) {
  if (searchMode === 2 || searchMode === -2) {
    const desc = searchMode === -2;
    const idx = sameTypeIndices(vec, value);
    let lo = 0;
    let hi = idx.length;
    // First position whose value is >= value (asc) / <= value (desc).
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const c = compareSame(vec[idx[mid]], value);
      if (desc ? c > 0 : c < 0) lo = mid + 1;
      else hi = mid;
    }
    if (lo < idx.length && compareSame(vec[idx[lo]], value) === 0) {
      return idx[lo];
    }
    if (matchMode === 0) return -1;
    const smaller = desc ? lo : lo - 1;
    const larger = desc ? lo - 1 : lo;
    const pick = matchMode === -1 ? smaller : larger;
    return pick >= 0 && pick < idx.length ? idx[pick] : -1;
  }

  const n = vec.length;
  const reverse = searchMode === -1;
  const matches =
    matchMode === 2 ? exactMatcher(value, true) : exactMatcher(value, false);
  const rank = typeRank(value);
  let best = -1;
  for (let k = 0; k < n; k += 1) {
    const i = reverse ? n - 1 - k : k;
    const cell = vec[i];
    if (matches(cell)) return i;
    if (matchMode === -1 || matchMode === 1) {
      if (typeRank(cell) === rank) {
        const c = compareSame(cell, value);
        if (matchMode === -1 && c < 0) {
          if (best < 0 || compareSame(cell, vec[best]) > 0) best = i;
        } else if (matchMode === 1 && c > 0) {
          if (best < 0 || compareSame(cell, vec[best]) < 0) best = i;
        }
      }
    }
  }
  return best;
}

function parseMatchMode(v) {
  const mm = int(v, 0);
  if (mm !== 0 && mm !== -1 && mm !== 1 && mm !== 2) fail(ERROR_VALUE);
  return mm;
}

function parseSearchMode(v, matchMode) {
  const sm = int(v, 1);
  if (sm !== 1 && sm !== -1 && sm !== 2 && sm !== -2) fail(ERROR_VALUE);
  if (matchMode === 2 && (sm === 2 || sm === -2)) fail(ERROR_VALUE);
  return sm;
}

/** Row or column vector of a 2D array; null when it is 2D. */
function vectorOf(a) {
  if (a.length === 1) return a[0];
  if (a[0].length === 1) return a.map((r) => r[0]);
  return null;
}

function checkSize(rows, cols) {
  if (rows > MAX_ROWS || cols > MAX_COLS) fail(ERROR_VALUE);
  if (rows * cols > MAX_CELLS) fail(ERROR_NUM);
}

function padValue(v) {
  if (isOmitted(v)) return new Error(ERROR_NOT_AVAILABLE);
  return single(v);
}

/* -------------------------------------------------------------------------- */
/* Lookup functions                                                           */
/* -------------------------------------------------------------------------- */

function XLOOKUP(
  lookupValue,
  lookupArray,
  returnArray,
  ifNotFound,
  matchMode,
  searchMode
) {
  if (arguments.length < 3) fail(ERROR_VALUE);
  const mm = parseMatchMode(matchMode);
  const sm = parseSearchMode(searchMode, mm);
  const la = to2D(lookupArray);
  const ra = to2D(returnArray);
  let vertical;
  if (la.length === 1 && la[0].length === 1) {
    if (ra.length === 1) vertical = true;
    else if (ra[0].length === 1) vertical = false;
    else fail(ERROR_VALUE);
  } else if (la[0].length === 1) {
    vertical = true;
    if (ra.length !== la.length) fail(ERROR_VALUE);
  } else if (la.length === 1) {
    vertical = false;
    if (ra[0].length !== la[0].length) fail(ERROR_VALUE);
  } else {
    fail(ERROR_VALUE);
  }
  const vec = vectorOf(la);

  return lift([lookupValue], (v) => {
    const idx = xIndex(lookupValueOf(v), vec, mm, sm);
    if (idx < 0) {
      if (!isOmitted(ifNotFound)) return ifNotFound;
      return fail(ERROR_NOT_AVAILABLE);
    }
    return lookupResult(vertical ? [ra[idx].slice()] : ra.map((r) => [r[idx]]));
  });
}

function XMATCH(lookupValue, lookupArray, matchMode, searchMode) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  const mm = parseMatchMode(matchMode);
  const sm = parseSearchMode(searchMode, mm);
  const vec = vectorOf(to2D(lookupArray));
  if (!vec) fail(ERROR_VALUE);
  return lift([lookupValue], (v) => {
    const idx = xIndex(lookupValueOf(v), vec, mm, sm);
    return idx < 0 ? fail(ERROR_NOT_AVAILABLE) : idx + 1;
  });
}

function MATCH(lookupValue, lookupArray, matchType) {
  if (arguments.length < 2) fail(ERROR_NOT_AVAILABLE);
  const vec = vectorOf(to2D(lookupArray));
  if (!vec) fail(ERROR_NOT_AVAILABLE);
  const mt = Math.sign(int(matchType, 1));
  return lift([lookupValue], (v) => {
    const value = lookupValueOf(v);
    const idx =
      mt === 0 ? exactIndex(value, vec, true) : approxIndex(value, vec, mt);
    return idx < 0 ? fail(ERROR_NOT_AVAILABLE) : idx + 1;
  });
}

function tableLookup(lookupValue, table, index, rangeLookup, horizontal) {
  const t = to2D(table);
  const approx = bool(rangeLookup, true);
  const keys = horizontal ? t[0] : t.map((r) => r[0]);
  const size = horizontal ? t.length : t[0].length;
  return lift([lookupValue, index], (v, i) => {
    const n = int(i);
    if (n < 1) fail(ERROR_VALUE);
    if (n > size) fail(ERROR_REF);
    const value = lookupValueOf(v);
    const idx = approx
      ? approxIndex(value, keys, 1)
      : exactIndex(value, keys, true);
    if (idx < 0) fail(ERROR_NOT_AVAILABLE);
    return blankTo0(horizontal ? t[n - 1][idx] : t[idx][n - 1]);
  });
}

function VLOOKUP(lookupValue, tableArray, colIndexNum, rangeLookup) {
  if (arguments.length < 3) fail(ERROR_NOT_AVAILABLE);
  return tableLookup(lookupValue, tableArray, colIndexNum, rangeLookup, false);
}

function HLOOKUP(lookupValue, tableArray, rowIndexNum, rangeLookup) {
  if (arguments.length < 3) fail(ERROR_NOT_AVAILABLE);
  return tableLookup(lookupValue, tableArray, rowIndexNum, rangeLookup, true);
}

function LOOKUP(lookupValue, lookupVector, resultVector) {
  if (arguments.length < 2) fail(ERROR_NOT_AVAILABLE);
  const lv = to2D(lookupVector);
  let keys;
  let results;
  if (isOmitted(resultVector)) {
    // Array form: search the first row/column along the longer dimension,
    // return from the last row/column.
    if (lv[0].length > lv.length) {
      [keys] = lv;
      results = lv[lv.length - 1];
    } else {
      keys = lv.map((r) => r[0]);
      results = lv.map((r) => r[r.length - 1]);
    }
  } else {
    keys = vectorOf(lv);
    results = vectorOf(to2D(resultVector));
    if (!keys || !results) fail(ERROR_NOT_AVAILABLE);
  }
  return lift([lookupValue], (v) => {
    const idx = approxIndex(lookupValueOf(v), keys, 1);
    if (idx < 0 || idx >= results.length) fail(ERROR_NOT_AVAILABLE);
    return blankTo0(results[idx]);
  });
}

function INDEX(array, rowNum, columnNum, areaNum) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  if (!isOmitted(areaNum)) {
    const area = int(areaNum);
    if (area < 1) fail(ERROR_VALUE);
    // Multi-area references are not supported by the grammar: only area 1.
    if (area !== 1) fail(ERROR_REF);
  }
  const a = to2D(array);
  const rows = a.length;
  const cols = a[0].length;
  const colOmitted = isOmitted(columnNum);
  return lift([rowNum, columnNum], (r, c) => {
    let ri = isOmitted(r) ? 0 : int(r);
    let ci = colOmitted || isOmitted(c) ? 0 : int(c);
    if (ri < 0 || ci < 0) fail(ERROR_VALUE);
    if (colOmitted && rows === 1 && cols > 1) {
      // A single row with one index: the index selects the column.
      ci = ri;
      ri = 0;
    }
    if (ri > rows || ci > cols) fail(ERROR_REF);
    let out;
    if (ri === 0 && ci === 0) out = a.map((row) => row.slice());
    else if (ri === 0) out = a.map((row) => [row[ci - 1]]);
    else if (ci === 0) out = [a[ri - 1].slice()];
    else out = [[a[ri - 1][ci - 1]]];
    return lookupResult(out);
  });
}

/* -------------------------------------------------------------------------- */
/* Dynamic-array functions                                                    */
/* -------------------------------------------------------------------------- */

function includeFlag(v) {
  if (isErrorValue(v)) throw toError(v);
  if (isBlank(v)) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return fail(ERROR_VALUE);
}

function FILTER(array, include, ifEmpty) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  const a = to2D(array);
  const inc = to2D(include);
  const rows = a.length;
  const cols = a[0].length;
  let out;
  if (inc[0].length === 1 && inc.length === rows) {
    out = a.filter((_, r) => includeFlag(inc[r][0]));
  } else if (inc.length === 1 && inc[0].length === cols) {
    const keep = inc[0].map(includeFlag);
    out = a.map((row) => row.filter((_, c) => keep[c]));
    if (out[0].length === 0) out = [];
  } else {
    fail(ERROR_VALUE);
  }
  if (out.length === 0) {
    if (!isOmitted(ifEmpty)) return ifEmpty;
    fail(ERROR_CALC);
  }
  return result(out);
}

function parseOrder(v) {
  const o = int(v, 1);
  if (o !== 1 && o !== -1) fail(ERROR_VALUE);
  return o;
}

function stableSort(items, compare) {
  return items
    .map((item, i) => ({ item, i }))
    .sort((x, y) => compare(x.item, y.item) || x.i - y.i)
    .map((x) => x.item);
}

function SORT(array, sortIndex, sortOrder, byCol) {
  if (arguments.length < 1) fail(ERROR_VALUE);
  const byColumn = bool(byCol, false);
  const a = byColumn ? transpose(to2D(array)) : to2D(array);
  const width = a[0].length;
  const indices = isOmitted(sortIndex)
    ? [1]
    : flatten(to2D(sortIndex)).map((v) => int(v));
  let orders = isOmitted(sortOrder)
    ? [1]
    : flatten(to2D(sortOrder)).map(parseOrder);
  indices.forEach((i) => {
    if (i < 1 || i > width) fail(ERROR_VALUE);
  });
  if (orders.length !== indices.length) {
    if (orders.length === 1) orders = indices.map(() => orders[0]);
    else fail(ERROR_VALUE);
  }
  const sorted = stableSort(a, (x, y) => {
    for (let k = 0; k < indices.length; k += 1) {
      const c = sortCompare(x[indices[k] - 1], y[indices[k] - 1], orders[k]);
      if (c !== 0) return c;
    }
    return 0;
  });
  return result(byColumn ? transpose(sorted) : sorted);
}

function SORTBY(array, ...rest) {
  if (rest.length < 1) fail(ERROR_VALUE);
  const a = to2D(array);
  const rows = a.length;
  const cols = a[0].length;
  const keys = [];
  let byRows = null;
  for (let i = 0; i < rest.length; i += 2) {
    const b = to2D(rest[i]);
    const order = parseOrder(rest[i + 1]);
    let vertical;
    if (b[0].length === 1 && b.length === rows) vertical = true;
    else if (b.length === 1 && b[0].length === cols) vertical = false;
    else fail(ERROR_VALUE);
    if (byRows === null) byRows = vertical;
    else if (byRows !== vertical) fail(ERROR_VALUE);
    keys.push({ values: vertical ? b.map((r) => r[0]) : b[0], order });
  }
  const positions = [];
  const count = byRows ? rows : cols;
  for (let i = 0; i < count; i += 1) positions.push(i);
  const order = stableSort(positions, (x, y) => {
    for (let k = 0; k < keys.length; k += 1) {
      const c = sortCompare(
        keys[k].values[x],
        keys[k].values[y],
        keys[k].order
      );
      if (c !== 0) return c;
    }
    return 0;
  });
  if (byRows) return result(order.map((r) => a[r].slice()));
  return result(a.map((row) => order.map((c) => row[c])));
}

function uniqueKey(line) {
  return line
    .map((v) => {
      if (isBlank(v)) return "e:";
      if (v instanceof Error) return `x:${toError(v).message}`;
      if (typeof v === "number") return `n:${v}`;
      if (typeof v === "boolean") return `b:${v}`;
      return `s:${String(v).toLowerCase()}`;
    })
    .join("\u0000");
}

function UNIQUE(array, byCol, exactlyOnce) {
  if (arguments.length < 1) fail(ERROR_VALUE);
  const byColumn = bool(byCol, false);
  const once = bool(exactlyOnce, false);
  const a = to2D(array);
  const lines = byColumn ? transpose(a) : a;
  const counts = new Map();
  const keys = lines.map((line) => {
    const key = uniqueKey(line);
    counts.set(key, (counts.get(key) || 0) + 1);
    return key;
  });
  const seen = new Set();
  const out = [];
  lines.forEach((line, i) => {
    const key = keys[i];
    if (once) {
      if (counts.get(key) === 1) out.push(line.slice());
    } else if (!seen.has(key)) {
      seen.add(key);
      out.push(line.slice());
    }
  });
  if (out.length === 0) fail(ERROR_CALC);
  return result(byColumn ? transpose(out) : out);
}

function dimension(v, def) {
  const n = int(v, def);
  if (n < 0) fail(ERROR_VALUE);
  if (n === 0) fail(ERROR_CALC);
  return n;
}

function SEQUENCE(rows, columns, start, step) {
  const r = dimension(rows, 1);
  const c = dimension(columns, 1);
  checkSize(r, c);
  const s = num(start, 1);
  const st = num(step, 1);
  const out = new Array(r);
  for (let i = 0; i < r; i += 1) {
    const row = new Array(c);
    for (let j = 0; j < c; j += 1) row[j] = s + st * (i * c + j);
    out[i] = row;
  }
  return result(out);
}

function RANDARRAY(rows, columns, min, max, wholeNumber) {
  const r = dimension(rows, 1);
  const c = dimension(columns, 1);
  checkSize(r, c);
  const lo = num(min, 0);
  const hi = num(max, 1);
  const whole = bool(wholeNumber, false);
  if (lo > hi) fail(ERROR_VALUE);
  const ilo = Math.ceil(lo);
  const ihi = Math.floor(hi);
  if (whole && ilo > ihi) fail(ERROR_VALUE);
  const out = new Array(r);
  for (let i = 0; i < r; i += 1) {
    const row = new Array(c);
    for (let j = 0; j < c; j += 1) {
      row[j] = whole
        ? ilo + Math.floor(Math.random() * (ihi - ilo + 1))
        : lo + Math.random() * (hi - lo);
    }
    out[i] = row;
  }
  return result(out);
}

/** [start, end) of the slice kept by TAKE (count > 0 from the start). */
function takeSpan(count, size) {
  if (count === 0) fail(ERROR_CALC);
  const n = Math.min(Math.abs(count), size);
  return count > 0 ? [0, n] : [size - n, size];
}

function dropSpan(count, size) {
  const n = Math.min(Math.abs(count), size);
  const span = count >= 0 ? [n, size] : [0, size - n];
  if (span[0] >= span[1]) fail(ERROR_CALC);
  return span;
}

function slice2D(a, [r0, r1], [c0, c1]) {
  return a.slice(r0, r1).map((row) => row.slice(c0, c1));
}

function TAKE(array, rows, columns) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  const a = to2D(array);
  const rs = isOmitted(rows) ? [0, a.length] : takeSpan(int(rows), a.length);
  const cs = isOmitted(columns)
    ? [0, a[0].length]
    : takeSpan(int(columns), a[0].length);
  return result(slice2D(a, rs, cs));
}

function DROP(array, rows, columns) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  const a = to2D(array);
  const rs = isOmitted(rows) ? [0, a.length] : dropSpan(int(rows), a.length);
  const cs = isOmitted(columns)
    ? [0, a[0].length]
    : dropSpan(int(columns), a[0].length);
  return result(slice2D(a, rs, cs));
}

function EXPAND(array, rows, columns, padWith) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  const a = to2D(array);
  const r = isOmitted(rows) ? a.length : int(rows);
  const c = isOmitted(columns) ? a[0].length : int(columns);
  if (r < a.length || c < a[0].length) fail(ERROR_VALUE);
  checkSize(r, c);
  const pad = padValue(padWith);
  const out = new Array(r);
  for (let i = 0; i < r; i += 1) {
    const row = new Array(c);
    for (let j = 0; j < c; j += 1) {
      row[j] = i < a.length && j < a[0].length ? a[i][j] : pad;
    }
    out[i] = row;
  }
  return result(out);
}

function toVector(array, ignore, scanByColumn) {
  const mode = int(ignore, 0);
  if (mode < 0 || mode > 3) fail(ERROR_VALUE);
  const byCol = bool(scanByColumn, false);
  const values = flatten(to2D(array), byCol).filter((v) => {
    if ((mode === 1 || mode === 3) && isBlank(v)) return false;
    if ((mode === 2 || mode === 3) && isErrorValue(v)) return false;
    return true;
  });
  if (values.length === 0) fail(ERROR_CALC);
  return values;
}

function TOCOL(array, ignore, scanByColumn) {
  if (arguments.length < 1) fail(ERROR_VALUE);
  return result(toVector(array, ignore, scanByColumn).map((v) => [v]));
}

function TOROW(array, ignore, scanByColumn) {
  if (arguments.length < 1) fail(ERROR_VALUE);
  return result([toVector(array, ignore, scanByColumn)]);
}

function wrap(vector, wrapCount, padWith, byCol) {
  const vec = vectorOf(to2D(vector));
  if (!vec) fail(ERROR_VALUE);
  const count = int(wrapCount);
  if (count < 1) fail(ERROR_NUM);
  const pad = padValue(padWith);
  const lines = Math.ceil(vec.length / count);
  const out = [];
  for (let i = 0; i < lines; i += 1) {
    const line = [];
    for (let j = 0; j < count; j += 1) {
      const k = i * count + j;
      line.push(k < vec.length ? vec[k] : pad);
    }
    out.push(line);
  }
  return result(byCol ? transpose(out) : out);
}

function WRAPROWS(vector, wrapCount, padWith) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  return wrap(vector, wrapCount, padWith, false);
}

function WRAPCOLS(vector, wrapCount, padWith) {
  if (arguments.length < 2) fail(ERROR_VALUE);
  return wrap(vector, wrapCount, padWith, true);
}

function chosenIndices(args, size) {
  if (args.length === 0) fail(ERROR_VALUE);
  const out = [];
  args.forEach((arg) => {
    flatten(to2D(arg)).forEach((v) => {
      const n = int(isBlank(v) ? 0 : v);
      if (n === 0 || Math.abs(n) > size) fail(ERROR_VALUE);
      out.push(n > 0 ? n - 1 : size + n);
    });
  });
  return out;
}

function CHOOSEROWS(array, ...rowNums) {
  const a = to2D(array);
  const idx = chosenIndices(rowNums, a.length);
  return result(idx.map((r) => a[r].slice()));
}

function CHOOSECOLS(array, ...colNums) {
  const a = to2D(array);
  const idx = chosenIndices(colNums, a[0].length);
  return result(a.map((row) => idx.map((c) => row[c])));
}

function HSTACK(...arrays) {
  if (arrays.length === 0) fail(ERROR_VALUE);
  const parts = arrays.map(to2D);
  const rows = Math.max(...parts.map((p) => p.length));
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    parts.forEach((p) => {
      for (let c = 0; c < p[0].length; c += 1) {
        row.push(r < p.length ? p[r][c] : new Error(ERROR_NOT_AVAILABLE));
      }
    });
    out.push(row);
  }
  return result(out);
}

function VSTACK(...arrays) {
  if (arrays.length === 0) fail(ERROR_VALUE);
  const parts = arrays.map(to2D);
  const cols = Math.max(...parts.map((p) => p[0].length));
  const out = [];
  parts.forEach((p) => {
    p.forEach((line) => {
      const row = line.slice();
      while (row.length < cols) row.push(new Error(ERROR_NOT_AVAILABLE));
      out.push(row);
    });
  });
  return result(out);
}

function TRIMRANGE(range, trimRows, trimCols) {
  if (arguments.length < 1) fail(ERROR_VALUE);
  const tr = int(trimRows, 3);
  const tc = int(trimCols, 3);
  if (tr < 0 || tr > 3 || tc < 0 || tc > 3) fail(ERROR_VALUE);
  const a = to2D(range);
  const rows = a.length;
  const cols = a[0].length;
  let r0 = rows;
  let r1 = -1;
  let c0 = cols;
  let c1 = -1;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!isBlank(a[r][c])) {
        if (r < r0) r0 = r;
        if (r > r1) r1 = r;
        if (c < c0) c0 = c;
        if (c > c1) c1 = c;
      }
    }
  }
  if (r1 < 0) fail(ERROR_REF);
  const rs = [tr & 1 ? r0 : 0, tr & 2 ? r1 + 1 : rows];
  const cs = [tc & 1 ? c0 : 0, tc & 2 ? c1 + 1 : cols];
  return result(slice2D(a, rs, cs));
}

export default {
  XLOOKUP,
  XMATCH,
  MATCH,
  VLOOKUP,
  HLOOKUP,
  LOOKUP,
  INDEX,
  FILTER,
  SORT,
  SORTBY,
  UNIQUE,
  SEQUENCE,
  RANDARRAY,
  TAKE,
  DROP,
  EXPAND,
  TOCOL,
  TOROW,
  WRAPROWS,
  WRAPCOLS,
  CHOOSEROWS,
  CHOOSECOLS,
  HSTACK,
  VSTACK,
  TRIMRANGE,
};
