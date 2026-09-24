/**
 * Functions implemented by TinySheet itself (on top of formulajs).
 *
 * Every module exports a plain object `{ NAME: (...args) => result }` where
 * NAME is the upper-case Excel name (dotted names such as "FORECAST.LINEAR"
 * are plain keys). Entries here take precedence over formulajs, so a module
 * may also override a formulajs function whose behaviour differs from Excel.
 *
 * Arguments arrive exactly as the grammar produces them: scalars, or 2D
 * arrays (row-major) for ranges and array literals. Errors are signalled by
 * returning or throwing an Error whose message is an error code from
 * ../error.js (e.g. ERROR_VALUE, ERROR_NOT_AVAILABLE).
 */
import lookupArray from "./lookup-array";
import text from "./text";
import mathStats from "./math-stats";
import dateFinancial from "./date-financial";
import lambda from "./lambda";

const CUSTOM_FUNCTIONS = Object.assign(
  Object.create(null),
  lookupArray,
  text,
  mathStats,
  dateFinancial,
  lambda
);

export default CUSTOM_FUNCTIONS;
