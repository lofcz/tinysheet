/**
 * Excel operator semantics used by the formula evaluator.
 *
 * - Arithmetic (`+ - * / ^`) coerces blanks to 0, logicals to 1/0 and
 *   numeric text to numbers ("1"+1 = 2); other text is #VALUE!.
 * - `&` joins the text forms (TRUE → "TRUE", 0.1+0.2 → "0.3").
 * - Comparisons are case-insensitive and follow Excel's type ordering.
 * - Errors win: the left operand's error is returned before the right one's.
 * - Arrays are lifted element-wise with Excel broadcasting; errors inside
 *   arrays stay per element.
 *
 * The legacy operator modules in ./operator stay registered for
 * `evaluateByOperator` (and the callFunction fallback) unchanged.
 */
import { compare, fail, toNumber, toText, toErrorValue } from "../helper/value";
import { broadcast, broadcast2 } from "../helper/array";

function checkNumber(result) {
  if (isNaN(result) || !isFinite(result)) {
    fail("NUM");
  }

  return result;
}

function add(a, b) {
  return checkNumber(toNumber(a) + toNumber(b));
}

function subtract(a, b) {
  return checkNumber(toNumber(a) - toNumber(b));
}

function multiply(a, b) {
  return checkNumber(toNumber(a) * toNumber(b));
}

function divide(a, b) {
  const x = toNumber(a);
  const y = toNumber(b);

  if (y === 0) {
    fail("DIV/0");
  }

  return checkNumber(x / y);
}

function power(a, b) {
  const x = toNumber(a);
  const y = toNumber(b);

  if (x === 0) {
    if (y === 0) {
      fail("NUM");
    }
    if (y < 0) {
      fail("DIV/0");
    }
  }

  return checkNumber(Math.pow(x, y));
}

function concat(a, b) {
  const left = toText(a);

  return left + toText(b);
}

const SCALAR_OPERATORS = {
  "+": add,
  "-": subtract,
  "*": multiply,
  "/": divide,
  "^": power,
  "&": concat,
  "=": (a, b) => compare(a, b) === 0,
  "<>": (a, b) => compare(a, b) !== 0,
  "<": (a, b) => compare(a, b) < 0,
  ">": (a, b) => compare(a, b) > 0,
  "<=": (a, b) => compare(a, b) <= 0,
  ">=": (a, b) => compare(a, b) >= 0,
};

function checkErrors(a, b) {
  if (a instanceof Error) {
    throw a;
  }
  if (b instanceof Error) {
    throw b;
  }
}

function safe(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (ex) {
      return toErrorValue(ex);
    }
  };
}

const LIFTED_OPERATORS = Object.create(null);

Object.keys(SCALAR_OPERATORS).forEach((op) => {
  const fn = SCALAR_OPERATORS[op];

  LIFTED_OPERATORS[op] = (a, b) => {
    try {
      checkErrors(a, b);

      return fn(a, b);
    } catch (ex) {
      return toErrorValue(ex);
    }
  };
});

/**
 * Evaluate a binary operator with Excel semantics.
 *
 * @param {String} op One of + - * / ^ & = <> < > <= >=.
 * @param {*} a Left operand (scalar or 2D array).
 * @param {*} b Right operand (scalar or 2D array).
 * @returns {*}
 */
export function binaryOperation(op, a, b) {
  const fn = SCALAR_OPERATORS[op];

  if (!fn) {
    fail("NAME");
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return broadcast2(a, b, LIFTED_OPERATORS[op]);
  }
  checkErrors(a, b);

  return fn(a, b);
}

const negateScalar = (value) => {
  const number = toNumber(value);

  return number === 0 ? 0 : -number;
};

const percentScalar = (value) => toNumber(value) / 100;

const negateLifted = safe(negateScalar);
const percentLifted = safe(percentScalar);

/**
 * Unary minus (`-A1`, `-{1,2}`).
 *
 * @param {*} value
 * @returns {*}
 */
export function negate(value) {
  if (Array.isArray(value)) {
    return broadcast([value], negateLifted);
  }

  return negateScalar(value);
}

/**
 * Postfix percent (`50%`, `A1%`).
 *
 * @param {*} value
 * @returns {*}
 */
export function percent(value) {
  if (Array.isArray(value)) {
    return broadcast([value], percentLifted);
  }

  return percentScalar(value);
}

export const BINARY_OPERATORS = Object.keys(SCALAR_OPERATORS);
