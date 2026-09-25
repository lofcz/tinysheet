// Eta-reduced functions: a bare built-in function name used as a value,
// e.g. the `SUM` in `GROUPBY(A2:A9, B2:B9, SUM)` or `BYROW(A1:C3, SUM)`.
//
// `etaLambda(name, call)` wraps a function name into a LAMBDA value (see
// ./lambda.js) so every LAMBDA consumer accepts it. `call(args)` invokes the
// named function with the argument list.
//
// Consumers that take an aggregation function (GROUPBY, PIVOTBY) also accept
// the function name as text ("SUM") and resolve it with `functionByName`.
// That is the fallback for hosts whose evaluator does not yet produce eta
// LAMBDAs for bare names (a bare `SUM` is looked up as a variable → #NAME?).

import { createLambda } from "./lambda";
import { toFormulajsError } from "../helper/value";

// Functions whose eta form takes two arguments (subset, all).
const TWO_ARGUMENT_ETA = new Set(["PERCENTOF"]);

/**
 * LAMBDA value for an eta-reduced function name.
 *
 * @param {String} name Function name (any case).
 * @param {Function} call (argsArray) => result.
 * @returns {Function} A LAMBDA value with a `functionName` property.
 */
export function etaLambda(name, call) {
  const upper = String(name).toUpperCase();
  const params = TWO_ARGUMENT_ETA.has(upper) ? ["SUBSET", "ALL"] : ["VALUE"];
  const fn = createLambda(params, (args) =>
    call(args.filter((arg) => arg !== undefined))
  );

  Object.defineProperty(fn, "functionName", { value: upper });

  return fn;
}

let registry = null;
let fallback = null;

/**
 * Wire the function registry (done by ./index.js; avoids an import cycle).
 *
 * @param {Object} functions Custom functions map.
 * @param {Function} resolve (name) => function|undefined for everything else.
 */
export function setFunctionRegistry(functions, resolve) {
  registry = functions;
  fallback = resolve;
}

/**
 * Built-in implementation of a function name, or undefined.
 *
 * @param {String} name
 * @returns {Function|undefined}
 */
export function functionByName(name) {
  const upper = String(name).trim().toUpperCase();

  if (!upper || !registry) {
    return void 0;
  }
  if (typeof registry[upper] === "function") {
    return registry[upper];
  }
  const external = fallback ? fallback(upper) : void 0;

  if (typeof external !== "function") {
    return void 0;
  }

  // formulajs recognises error arguments by identity and returns errors.
  return (...params) => {
    const result = external(...params.map(toFormulajsError));

    if (result instanceof Error) {
      throw result;
    }

    return result;
  };
}
