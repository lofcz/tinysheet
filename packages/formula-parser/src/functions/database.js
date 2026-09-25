// Database functions: DSUM, DAVERAGE, DCOUNT, DCOUNTA, DGET, DMAX, DMIN,
// DPRODUCT, DSTDEV, DSTDEVP, DVAR, DVARP.
// See ./index.js for the calling convention.
//
// D-function(database, field, criteria)
//
// * `database` is a range whose first row holds the field labels.
// * `field` is a label (case-insensitive) or a 1-based column number. DCOUNT
//   and DCOUNTA accept an omitted field and then count matching records.
// * `criteria` is a range whose first row holds labels and whose other rows
//   hold conditions. Conditions on one row are AND-ed, rows are OR-ed. The
//   same label may appear twice on a row (e.g. ">3" and "<9"). A blank
//   condition row matches every record.
//
// Condition cells follow Excel's database criteria (Advanced Filter) rules:
//   - text without an operator matches values that *begin with* it
//     ("Ap" matches "Apple"), wildcards * ? ~ are honoured;
//   - "=text" matches exactly (with wildcards), "=" alone matches blanks,
//     "<>" alone matches non-blanks;
//   - numbers, booleans and comparison operators work like COUNTIF criteria.
//
// Computed criteria: in Excel a criteria column whose label is blank or not a
// field name holds a formula evaluated for every record (relative to the
// first data row). Formulas reach this module as already-computed values, so
// such a condition is applied as a constant: TRUE (or a non-zero number)
// keeps every record, FALSE/0 rejects every record, a blank cell is ignored.
// This matches Excel whenever the formula does not depend on the record.

import { ERROR_DIV_ZERO, ERROR_NUM, ERROR_VALUE } from "../error";
import {
  collectNumbers,
  fail,
  isErrorValue,
  makeCriteria,
  parseNumberText,
  toError,
  toGrid,
} from "./math-stats";

function isBlank(v) {
  return v === null || v === undefined;
}

function label(v) {
  if (isBlank(v)) return "";
  if (isErrorValue(v)) return null;
  return String(v).trim().toUpperCase();
}

function asTable(database) {
  if (isErrorValue(database)) throw toError(database);
  const grid = toGrid(database);
  if (grid.length < 1 || !grid[0].length) fail(ERROR_VALUE);
  return grid;
}

/** 0-based column index of `field` in the database header, or -1 if omitted. */
function fieldIndex(header, field, optional) {
  if (field === undefined || field === null) {
    if (optional) return -1;
    fail(ERROR_VALUE);
  }
  let f = field;
  while (Array.isArray(f)) f = f[0];
  if (isErrorValue(f)) throw toError(f);
  if (typeof f === "number" || typeof f === "boolean") {
    const n = Math.trunc(Number(f));
    if (n < 1 || n > header.length) fail(ERROR_VALUE);
    return n - 1;
  }
  const name = label(f);
  const index = header.findIndex((h) => label(h) === name);
  if (index < 0) fail(ERROR_VALUE);
  return index;
}

/** Predicate for one database criteria cell. */
function databaseCriterion(value) {
  if (typeof value === "string" && !isErrorValue(value)) {
    const text = value;
    if (text === "") return null;
    const hasOperator = /^(<=|>=|<>|<|>|=)/.test(text);
    if (!hasOperator && parseNumberText(text) === undefined) {
      const upper = text.trim().toUpperCase();
      if (upper !== "TRUE" && upper !== "FALSE") {
        // Plain text: "begins with".
        return makeCriteria(`${text}*`);
      }
    }
    return makeCriteria(text);
  }
  return makeCriteria(value);
}

function constantCriterion(value) {
  if (isErrorValue(value)) throw toError(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}

/** Build `(record) => boolean` from a criteria range. */
function compileCriteria(header, criteria) {
  if (isErrorValue(criteria)) throw toError(criteria);
  const grid = toGrid(criteria);
  if (grid.length < 2) fail(ERROR_VALUE);
  const labels = grid[0];
  const columns = labels.map((l) => {
    const name = label(l);
    if (name === null) return -1;
    if (name === "") return -1;
    return header.findIndex((h) => label(h) === name);
  });
  const rows = [];
  for (let r = 1; r < grid.length; r++) {
    const tests = [];
    let constant = true;
    for (let c = 0; c < labels.length; c++) {
      const value = grid[r][c];
      if (isBlank(value) || value === "") continue;
      const column = columns[c];
      if (column < 0) {
        constant = constant && constantCriterion(value);
        continue;
      }
      const pred = databaseCriterion(value);
      if (pred) tests.push([column, pred]);
    }
    rows.push({ constant, tests });
  }
  return (record) =>
    rows.some(
      (row) =>
        row.constant &&
        row.tests.every(([column, pred]) => pred(record[column]))
    );
}

/**
 * Values of `field` for the records matching `criteria`. With an omitted
 * field (DCOUNT/DCOUNTA) the whole records are returned.
 */
function select(database, field, criteria, optionalField) {
  const table = asTable(database);
  const header = table[0];
  const index = fieldIndex(header, field, optionalField);
  const matches = compileCriteria(header, criteria);
  const out = [];
  for (let r = 1; r < table.length; r++) {
    const record = table[r];
    if (matches(record)) out.push(index < 0 ? record : record[index]);
  }
  return { values: out, whole: index < 0 };
}

function numbers(values) {
  return collectNumbers([values.map((v) => [v])]);
}

function sum(nums) {
  let s = 0;
  for (let i = 0; i < nums.length; i++) s += nums[i];
  return s;
}

function variance(nums, sample) {
  const n = nums.length;
  if (n === 0 || (sample && n === 1)) fail(ERROR_DIV_ZERO);
  const mean = sum(nums) / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (nums[i] - mean) ** 2;
  return ss / (sample ? n - 1 : n);
}

function aggregate(reduce) {
  return (database, field, criteria) => {
    if (criteria === undefined) fail(ERROR_VALUE);
    return reduce(numbers(select(database, field, criteria, false).values));
  };
}

function isCountable(v) {
  return typeof v === "number" && Number.isFinite(v);
}

const FUNCTIONS = {
  DSUM: aggregate(sum),
  DAVERAGE: aggregate((nums) => {
    if (!nums.length) fail(ERROR_DIV_ZERO);
    return sum(nums) / nums.length;
  }),
  DMAX: aggregate((nums) => (nums.length ? Math.max(...nums) : 0)),
  DMIN: aggregate((nums) => (nums.length ? Math.min(...nums) : 0)),
  DPRODUCT: aggregate((nums) =>
    nums.length ? nums.reduce((p, x) => p * x, 1) : 0
  ),
  DSTDEV: aggregate((nums) => Math.sqrt(variance(nums, true))),
  DSTDEVP: aggregate((nums) => Math.sqrt(variance(nums, false))),
  DVAR: aggregate((nums) => variance(nums, true)),
  DVARP: aggregate((nums) => variance(nums, false)),
  DCOUNT: (database, field, criteria) => {
    if (criteria === undefined) fail(ERROR_VALUE);
    const { values, whole } = select(database, field, criteria, true);
    if (whole) {
      // Omitted field: count the matching records.
      return values.length;
    }
    return values.filter(isCountable).length;
  },
  DCOUNTA: (database, field, criteria) => {
    if (criteria === undefined) fail(ERROR_VALUE);
    const { values, whole } = select(database, field, criteria, true);
    if (whole) return values.length;
    return values.filter((v) => !isBlank(v) && v !== "").length;
  },
  DGET: (database, field, criteria) => {
    if (criteria === undefined) fail(ERROR_VALUE);
    const { values } = select(database, field, criteria, false);
    if (values.length === 0) fail(ERROR_VALUE);
    if (values.length > 1) fail(ERROR_NUM);
    const v = values[0];
    if (isErrorValue(v)) throw toError(v);
    return isBlank(v) ? 0 : v;
  },
};

export default FUNCTIONS;
