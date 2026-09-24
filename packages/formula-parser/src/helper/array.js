/**
 * 2D array helpers implementing Excel's array broadcasting rules.
 *
 * Arrays are row-major `[[r1c1, r1c2], [r2c1, r2c2]]`. A 1D JS array is
 * treated as a single row.
 */
import { toErrorValue } from "./value";

const NA = toErrorValue("N/A");

/**
 * @param {*} value
 * @returns {Boolean}
 */
export function isArray(value) {
  return Array.isArray(value);
}

/**
 * Normalize a value to a 2D array (scalars become 1x1, 1D arrays one row).
 *
 * @param {*} value
 * @returns {Array<Array>}
 */
export function to2D(value) {
  if (!Array.isArray(value)) {
    return [[value]];
  }
  if (value.length === 0) {
    return [[]];
  }
  if (!Array.isArray(value[0])) {
    return [value];
  }

  return value;
}

/**
 * @param {Array<Array>} matrix 2D array.
 * @returns {Number} Column count (widest row).
 */
export function columnCount(matrix) {
  let cols = 0;

  for (let i = 0; i < matrix.length; i++) {
    if (matrix[i].length > cols) {
      cols = matrix[i].length;
    }
  }

  return cols;
}

function broadcastSize(sizes) {
  let size = 1;

  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] !== 1) {
      size = Math.max(size === 1 ? 0 : size, sizes[i]);
    }
  }

  return size;
}

function pick(matrix, rows, cols, i, j) {
  const r = rows === 1 ? 0 : i;
  const c = cols === 1 ? 0 : j;

  if (r >= rows || c >= cols) {
    return NA;
  }
  const row = matrix[r];

  return c < row.length ? row[c] : NA;
}

/**
 * Apply `fn` element-wise over any number of values using Excel broadcasting:
 * scalars and single rows/columns are repeated, positions outside a smaller
 * array yield #N/A. `fn` receives one scalar per input.
 *
 * @param {Array} values Scalars or arrays.
 * @param {Function} fn (...scalars) => result.
 * @returns {Array<Array>}
 */
export function broadcast(values, fn) {
  const matrices = values.map(to2D);
  const rowSizes = matrices.map((m) => m.length);
  const colSizes = matrices.map(columnCount);
  const rows = broadcastSize(rowSizes);
  const cols = broadcastSize(colSizes);
  const result = new Array(rows);
  const args = new Array(values.length);

  for (let i = 0; i < rows; i++) {
    const row = new Array(cols);

    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < matrices.length; k++) {
        args[k] = pick(matrices[k], rowSizes[k], colSizes[k], i, j);
      }
      row[j] = fn(...args);
    }
    result[i] = row;
  }

  return result;
}

/**
 * Two-input `broadcast` without the variadic overhead (operators hot path).
 *
 * @param {*} a
 * @param {*} b
 * @param {Function} fn (a, b) => result.
 * @returns {Array<Array>}
 */
export function broadcast2(a, b, fn) {
  const ma = to2D(a);
  const mb = to2D(b);
  const ra = ma.length;
  const rb = mb.length;
  const ca = columnCount(ma);
  const cb = columnCount(mb);
  const rows = broadcastSize([ra, rb]);
  const cols = broadcastSize([ca, cb]);
  const result = new Array(rows);

  for (let i = 0; i < rows; i++) {
    const row = new Array(cols);

    for (let j = 0; j < cols; j++) {
      row[j] = fn(pick(ma, ra, ca, i, j), pick(mb, rb, cb, i, j));
    }
    result[i] = row;
  }

  return result;
}

/**
 * Map every element of an array (normalized to 2D).
 *
 * @param {*} value
 * @param {Function} fn (element, rowIndex, columnIndex) => result.
 * @returns {Array<Array>}
 */
export function map2D(value, fn) {
  const matrix = to2D(value);
  const result = new Array(matrix.length);

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    const out = new Array(row.length);

    for (let j = 0; j < row.length; j++) {
      out[j] = fn(row[j], i, j);
    }
    result[i] = out;
  }

  return result;
}

/**
 * Top-left element of an array, or the value itself.
 *
 * @param {*} value
 * @returns {*}
 */
export function firstElement(value) {
  if (!Array.isArray(value)) {
    return value;
  }
  const first = value[0];

  return Array.isArray(first) ? first[0] : first;
}
