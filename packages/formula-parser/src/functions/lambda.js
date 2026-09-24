/**
 * LAMBDA values and the higher-order functions that consume them
 * (MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY).
 *
 * See ./index.js for the general calling convention.
 *
 * ## LAMBDA value representation
 *
 * `LAMBDA(x, y, x + y)` evaluates (in the grammar evaluator) to a plain JS
 * function branded with `LAMBDA_BRAND`; use `isLambda(value)` to detect one.
 *
 *   - `fn(...args)` evaluates the body with the arguments bound to the
 *     parameters and returns the result (scalar or 2D array). Formula errors
 *     are thrown as `Error` values, exactly like any other function. Use
 *     `callLambdaSafe(fn, args)` to get the error back as a value instead.
 *   - Passing fewer arguments than parameters (or `undefined`) leaves the
 *     trailing parameters "omitted": `ISOMITTED(param)` is TRUE and the
 *     parameter reads as blank. Passing more arguments is #VALUE!.
 *   - `fn.params` is the upper-case parameter name list, `fn.length` is not
 *     meaningful; use `fn.params.length` for the arity.
 *
 * The special forms LET, LAMBDA and ISOMITTED are implemented by the
 * evaluator (they need unevaluated arguments). The stubs exported below only
 * make them visible in SUPPORTED_FORMULAS.
 */
import { ERROR_CALC, ERROR_VALUE } from "../error";
import { toErrorValue, toNumber } from "../helper/value";
import { columnCount, to2D } from "../helper/array";

export const LAMBDA_BRAND = Symbol.for("tinysheet.formula-parser.lambda");

/**
 * Create a LAMBDA value.
 *
 * @param {String[]} params Upper-case parameter names.
 * @param {Function} invoke (argsArray) => result.
 * @returns {Function}
 */
export function createLambda(params, invoke) {
  const fn = function lambda(...args) {
    return invoke(args);
  };

  Object.defineProperty(fn, LAMBDA_BRAND, { value: true });
  Object.defineProperty(fn, "params", { value: params.slice() });

  return fn;
}

/**
 * Whether a value is a LAMBDA produced by the formula grammar.
 *
 * @param {*} value
 * @returns {Boolean}
 */
export function isLambda(value) {
  return typeof value === "function" && value[LAMBDA_BRAND] === true;
}

/**
 * Call a LAMBDA, returning formula errors as error values instead of throwing.
 *
 * @param {Function} fn LAMBDA value.
 * @param {Array} args Arguments.
 * @returns {*}
 */
export function callLambdaSafe(fn, args) {
  try {
    return fn(...args);
  } catch (ex) {
    return toErrorValue(ex);
  }
}

function requireLambda(fn, arity) {
  if (!isLambda(fn) || fn.params.length !== arity) {
    throw Error(ERROR_VALUE);
  }

  return fn;
}

// A LAMBDA result stored into a single element must be a scalar;
// 1x1 arrays are unwrapped, anything bigger is #CALC! (nested arrays).
function toElement(value) {
  if (Array.isArray(value)) {
    const matrix = to2D(value);

    if (matrix.length === 1 && matrix[0].length === 1) {
      return matrix[0][0];
    }

    return toErrorValue(ERROR_CALC);
  }
  if (isLambda(value)) {
    return toErrorValue(ERROR_CALC);
  }

  return value;
}

function throwIfError(value) {
  if (value instanceof Error) {
    throw value;
  }

  return value;
}

function positiveInteger(value) {
  const number = Math.trunc(toNumber(throwIfError(value)));

  if (!(number >= 1)) {
    throw Error(ERROR_VALUE);
  }

  return number;
}

const MAX_ELEMENTS = 1048576 * 16;

/**
 * MAP(array1, [array2, ...], lambda) → array of lambda(array1[i], array2[i], ...).
 * Arrays of different sizes are padded with #N/A.
 */
function MAP(...args) {
  if (args.length < 2) {
    throw Error(ERROR_VALUE);
  }
  const fn = args[args.length - 1];
  const arrays = args.slice(0, -1).map((value) => to2D(throwIfError(value)));

  requireLambda(fn, arrays.length);

  const rows = Math.max(...arrays.map((m) => m.length));
  const cols = Math.max(...arrays.map(columnCount));
  const na = toErrorValue("N/A");
  const result = [];

  for (let i = 0; i < rows; i++) {
    const row = [];

    for (let j = 0; j < cols; j++) {
      const values = arrays.map((m) =>
        i < m.length && j < m[i].length ? m[i][j] : na
      );

      row.push(toElement(callLambdaSafe(fn, values)));
    }
    result.push(row);
  }

  return result;
}

function reduceArgs(args) {
  if (args.length === 2) {
    return [null, args[0], args[1]];
  }
  if (args.length !== 3) {
    throw Error(ERROR_VALUE);
  }

  return [args[0] === void 0 ? null : args[0], args[1], args[2]];
}

/**
 * REDUCE([initial_value], array, lambda(accumulator, value)).
 */
function REDUCE(...args) {
  const [initial, array, fn] = reduceArgs(args);

  requireLambda(fn, 2);
  const matrix = to2D(throwIfError(array));
  let accumulator = initial;

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];

    for (let j = 0; j < row.length; j++) {
      accumulator = callLambdaSafe(fn, [accumulator, row[j]]);
    }
  }

  return throwIfError(accumulator);
}

/**
 * SCAN([initial_value], array, lambda(accumulator, value)) → array of the
 * intermediate accumulator values, same shape as `array`.
 */
function SCAN(...args) {
  const [initial, array, fn] = reduceArgs(args);

  requireLambda(fn, 2);
  const matrix = to2D(throwIfError(array));
  let accumulator = initial;

  return matrix.map((row) =>
    row.map((value) => {
      accumulator = toElement(callLambdaSafe(fn, [accumulator, value]));

      return accumulator;
    })
  );
}

/**
 * BYROW(array, lambda(row)) → column of one result per row.
 */
function BYROW(array, fn) {
  requireLambda(fn, 1);
  const matrix = to2D(throwIfError(array));

  return matrix.map((row) => [toElement(callLambdaSafe(fn, [[row.slice()]]))]);
}

/**
 * BYCOL(array, lambda(column)) → row of one result per column.
 */
function BYCOL(array, fn) {
  requireLambda(fn, 1);
  const matrix = to2D(throwIfError(array));
  const cols = columnCount(matrix);
  const result = [];

  for (let j = 0; j < cols; j++) {
    const column = matrix.map((row) => [row[j]]);

    result.push(toElement(callLambdaSafe(fn, [column])));
  }

  return [result];
}

/**
 * MAKEARRAY(rows, columns, lambda(row, column)) with 1-based indexes.
 */
function MAKEARRAY(rows, cols, fn) {
  const rowCount = positiveInteger(rows);
  const colCount = positiveInteger(cols);

  requireLambda(fn, 2);
  if (rowCount * colCount > MAX_ELEMENTS) {
    throw Error(ERROR_VALUE);
  }
  const result = [];

  for (let i = 1; i <= rowCount; i++) {
    const row = [];

    for (let j = 1; j <= colCount; j++) {
      row.push(toElement(callLambdaSafe(fn, [i, j])));
    }
    result.push(row);
  }

  return result;
}

// Special forms handled by the evaluator; reaching these means the call
// bypassed the grammar (e.g. evaluateByOperator("LET", ...)).
function specialForm() {
  throw Error(ERROR_VALUE);
}

export default {
  MAP,
  REDUCE,
  SCAN,
  BYROW,
  BYCOL,
  MAKEARRAY,
  LET: specialForm,
  LAMBDA: specialForm,
  ISOMITTED: specialForm,
};
