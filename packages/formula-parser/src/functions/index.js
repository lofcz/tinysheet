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
import database from "./database";
import regression from "./regression";
import groupby from "./groupby";
import engineering from "./engineering";
import financial from "./financial";
import misc from "./misc";
import statistical from "./statistical";
import { setFunctionRegistry } from "./eta";
import LEGACY_FUNCTION_NAMES from "./legacy";
import formulajs from "../formulajs";

const CUSTOM_FUNCTIONS = Object.assign(
  Object.create(null),
  lookupArray,
  text,
  mathStats,
  dateFinancial,
  lambda
);
// Functions batch 2 (phase 2, stream P2).
Object.assign(CUSTOM_FUNCTIONS, database, regression, groupby);
Object.assign(CUSTOM_FUNCTIONS, engineering, financial, misc, statistical);

function resolveFunction(name) {
  if (CUSTOM_FUNCTIONS[name]) {
    return CUSTOM_FUNCTIONS[name];
  }
  return name
    .split(".")
    .reduce((scope, part) => (scope ? scope[part] : undefined), formulajs);
}

setFunctionRegistry(CUSTOM_FUNCTIONS, resolveFunction);

// Resolved on call so aliases follow whichever implementation wins.
Object.keys(LEGACY_FUNCTION_NAMES).forEach((legacyName) => {
  const target = LEGACY_FUNCTION_NAMES[legacyName];
  CUSTOM_FUNCTIONS[legacyName] = (...args) => resolveFunction(target)(...args);
});

export { LEGACY_FUNCTION_NAMES };
export default CUSTOM_FUNCTIONS;
