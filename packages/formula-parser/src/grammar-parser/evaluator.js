/**
 * AST evaluator.
 *
 * Talks to the host (parser.js) through `owner.yy`:
 *   cellValue(label), rangeValue(startLabel, endLabel),
 *   wholeRangeValue(kind, sheetName, start, startAbsolute, end, endAbsolute),
 *   callVariable(name), callFunction(name, params, refs), throwError(image),
 *   hasFunction(name), getLambdaVariable(name), getOptions().
 *
 * Errors: formula errors are thrown as `Error`s and abort the evaluation
 * (the first error wins), except where Excel treats them as values: LET
 * bindings, LAMBDA arguments, array elements, IFERROR/IFNA and the
 * information functions in ERROR_TOLERANT receive error values.
 *
 * Lazy special forms: LET, LAMBDA, ISOMITTED, IF, IFS, IFERROR, IFNA,
 * CHOOSE and SWITCH evaluate only the arguments they need. They do not emit
 * the `callFunction` event; a function registered with `Parser#setFunction`
 * under the same name takes precedence over them.
 */
import { createLambda, isLambda } from "../functions/lambda";
import CUSTOM_FUNCTIONS from "../functions";
import SUPPORTED_FORMULAS from "../supported-formulas";
import {
  binaryOperation,
  negate,
  percent,
} from "../evaluate-by-operator/excel-operators";
import {
  compare,
  errorCode,
  fail,
  isErrorString,
  toBoolean,
  toErrorValue,
  toNumber,
} from "../helper/value";
import { broadcast, firstElement } from "../helper/array";
import { toLabel } from "../helper/cell";
import {
  MISSING,
  MAX_COLUMN_INDEX,
  MAX_ROW_INDEX,
  isReferenceNode,
} from "./ast";

const OMITTED = Symbol("omitted");
const NOT_FOUND = Symbol("notFound");
const FALLBACK = Symbol("fallback");
const MAX_LAMBDA_DEPTH = 256;

const BUILTIN_FUNCTIONS = new Set(
  SUPPORTED_FORMULAS.map((n) => n.toUpperCase())
);

/**
 * Functions whose arguments may be error values instead of aborting the
 * formula. Custom functions can opt in with `fn.acceptsErrors = true`.
 */
export const ERROR_TOLERANT = new Set([
  "ISERROR",
  "ISREF",
  "ISERR",
  "ISNA",
  "ERROR.TYPE",
  "TYPE",
  "ISBLANK",
  "ISLOGICAL",
  "ISNUMBER",
  "ISTEXT",
  "ISNONTEXT",
  "COUNT",
  "COUNTA",
]);

function lookup(scope, key) {
  while (scope) {
    const value = scope.vars.get(key);

    if (value !== void 0 || scope.vars.has(key)) {
      return value;
    }
    scope = scope.parent;
  }

  return NOT_FOUND;
}

// LET / LAMBDA parameter name of an argument node, or null.
function bindingName(node) {
  if (node.type === "name" || (node.type === "cell" && node.key)) {
    return node.key;
  }

  return null;
}

function normalizeRange(value) {
  if (!Array.isArray(value)) {
    return isErrorString(value) ? toErrorValue(value) : value;
  }
  let copy = null;

  for (let i = 0; i < value.length; i++) {
    const row = value[i];

    if (!Array.isArray(row)) {
      if (isErrorString(row)) {
        copy = copy || value.slice();
        copy[i] = toErrorValue(row);
      }
      continue;
    }
    let rowCopy = null;

    for (let j = 0; j < row.length; j++) {
      if (isErrorString(row[j])) {
        rowCopy = rowCopy || row.slice();
        rowCopy[j] = toErrorValue(row[j]);
      }
    }
    if (rowCopy) {
      copy = copy || value.slice();
      copy[i] = rowCopy;
    }
  }

  return copy || value;
}

function quoteSheet(sheetName) {
  return sheetName == null ? "" : `'${String(sheetName).replace(/'/g, "''")}'!`;
}

function cellLabel(sheetName, row, column) {
  return quoteSheet(sheetName) + toLabel({ index: row }, { index: column });
}

function sameSheet(a, b) {
  if (a == null || b == null) {
    return a == null && b == null;
  }

  return String(a).toUpperCase() === String(b).toUpperCase();
}

/**
 * Plain description of a reference: 0-based inclusive indexes, -1 marks a
 * whole row/column span (as in the callRangeValue contract).
 */
export function referenceInfo(rect) {
  const wholeColumns = rect.r1 === 0 && rect.r2 === MAX_ROW_INDEX;
  const wholeRows = rect.c1 === 0 && rect.c2 === MAX_COLUMN_INDEX;

  return {
    sheetName: rect.sheetName,
    startRow: wholeColumns ? -1 : rect.r1,
    startColumn: wholeRows ? -1 : rect.c1,
    endRow: wholeColumns ? -1 : rect.r2,
    endColumn: wholeRows ? -1 : rect.c2,
  };
}

function isTolerant(key) {
  if (ERROR_TOLERANT.has(key)) {
    return true;
  }
  const custom = CUSTOM_FUNCTIONS[key];

  return !!(custom && custom.acceptsErrors);
}

function safeScalar(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (ex) {
      return toErrorValue(ex);
    }
  };
}

export default class Evaluator {
  constructor(owner) {
    this.owner = owner;
    this.yy = owner.yy;
    this.depth = 0;
  }

  /**
   * Evaluate a root node with fresh state.
   */
  evaluateRoot(node) {
    this.yy = this.owner.yy;
    this.depth = 0;

    return this.evaluate(node, null);
  }

  evaluate(node, scope) {
    switch (node.type) {
      case "number":
      case "string":
        return node.value;
      case "binary": {
        const left = this.evaluate(node.left, scope);
        const right = this.evaluate(node.right, scope);

        return binaryOperation(node.op, left, right);
      }
      case "cell":
        return this.evaluateCell(node, scope);
      case "range":
        return normalizeRange(this.yy.rangeValue(node.start, node.end));
      case "wholeRange":
        return normalizeRange(
          this.yy.wholeRangeValue(
            node.kind,
            node.sheetName,
            node.start,
            node.startAbsolute,
            node.end,
            node.endAbsolute
          )
        );
      case "call":
        return this.evaluateCall(node, scope);
      case "name":
        return this.evaluateName(node, scope);
      case "negate":
        return negate(this.evaluate(node.value, scope));
      case "plus":
        // Excel's unary plus is a no-op (=+"a" is "a").
        return this.evaluate(node.value, scope);
      case "percent":
        return percent(this.evaluate(node.value, scope));
      case "array":
        return node.rows.map((row) => row.slice());
      case "error":
        return this.yy.throwError(node.image);
      case "invoke": {
        const callee = this.evaluate(node.callee, scope);

        if (!isLambda(callee)) {
          fail("VALUE");
        }

        return this.invokeLambda(callee, node.args, scope);
      }
      case "intersect":
        return this.evaluateIntersection(node, scope);
      case "implicit":
        return this.evaluateImplicit(node, scope);
      case "refError":
        return fail("REF");
      case "missing":
        return void 0;
      default:
        // legacyArray outside of a function call and unknown nodes.
        return fail("ERROR");
    }
  }

  /**
   * Evaluate, returning an error value instead of throwing.
   */
  evaluateSafe(node, scope) {
    try {
      return this.evaluate(node, scope);
    } catch (ex) {
      return toErrorValue(ex);
    }
  }

  /**
   * Evaluate, throwing when the result is an error value.
   */
  evaluateStrict(node, scope) {
    const value = this.evaluate(node, scope);

    if (value instanceof Error) {
      throw value;
    }

    return value;
  }

  evaluateCell(node, scope) {
    if (scope && node.key) {
      const bound = lookup(scope, node.key);

      if (bound !== NOT_FOUND) {
        return bound === OMITTED ? null : bound;
      }
    }
    const value = this.yy.cellValue(node.image);

    return isErrorString(value) ? toErrorValue(value) : value;
  }

  evaluateName(node, scope) {
    if (scope) {
      const bound = lookup(scope, node.key);

      if (bound !== NOT_FOUND) {
        return bound === OMITTED ? null : bound;
      }
    }

    return this.yy.callVariable(node.name);
  }

  hasCustomFunction(name) {
    return !!(this.yy.hasFunction && this.yy.hasFunction(name));
  }

  evaluateCall(node, scope) {
    const key = node.key;

    if (scope) {
      const bound = lookup(scope, key);

      if (bound !== NOT_FOUND) {
        if (isLambda(bound)) {
          return this.invokeLambda(bound, node.args, scope);
        }

        return fail("VALUE");
      }
    }
    const special = SPECIAL_FORMS[key];

    if (special && !this.hasCustomFunction(node.name)) {
      const result = special.call(this, node.args, scope, node);

      if (result !== FALLBACK) {
        return result;
      }
    } else if (
      !special &&
      !BUILTIN_FUNCTIONS.has(key) &&
      this.yy.getLambdaVariable &&
      !this.hasCustomFunction(node.name)
    ) {
      const named = this.yy.getLambdaVariable(node.name);

      if (named) {
        return this.invokeLambda(named, node.args, scope);
      }
    }

    return this.callEager(node, scope);
  }

  callEager(node, scope) {
    const args = node.args;
    let params;

    if (args.length === 1 && args[0].type === "legacyArray") {
      params = args[0].items.slice();
    } else {
      const tolerant = isTolerant(node.key);

      params = new Array(args.length);
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === MISSING) {
          params[i] = void 0;
        } else {
          params[i] = tolerant
            ? this.evaluateSafe(arg, scope)
            : this.evaluateStrict(arg, scope);
        }
      }
    }

    return this.yy.callFunction(
      node.name,
      params,
      this.referencesOf(args, scope)
    );
  }

  /**
   * Reference descriptors of call arguments (null for non-references).
   */
  referencesOf(args, scope) {
    let refs = null;

    for (let i = 0; i < args.length; i++) {
      const rect = isReferenceNode(args[i])
        ? this.referenceRect(args[i], scope)
        : null;

      if (rect) {
        refs = refs || new Array(args.length).fill(null);
        refs[i] = referenceInfo(rect);
      }
    }

    return refs || [];
  }

  makeLambda(params, body, closure) {
    return createLambda(params, (args) => {
      if (args.length > params.length) {
        fail("VALUE");
      }
      if (this.depth >= MAX_LAMBDA_DEPTH) {
        fail("NUM");
      }
      const vars = new Map();

      for (let i = 0; i < params.length; i++) {
        const value = args[i];

        vars.set(
          params[i],
          value === void 0 || value === OMITTED ? OMITTED : value
        );
      }
      this.depth += 1;
      try {
        return this.evaluate(body, { vars, parent: closure });
      } finally {
        this.depth -= 1;
      }
    });
  }

  invokeLambda(fn, argNodes, scope) {
    const values = argNodes.map((arg) =>
      arg === MISSING ? OMITTED : this.evaluateSafe(arg, scope)
    );

    return fn(...values);
  }

  // Value of an optional branch argument: missing → 0 (Excel).
  branchValue(node, scope) {
    return node === MISSING ? 0 : this.evaluateSafe(node, scope);
  }

  evaluateBranch(node, scope) {
    return node === MISSING ? 0 : this.evaluate(node, scope);
  }

  /**
   * Area referenced by a node, or null when the node is not a reference.
   */
  referenceRect(node, scope) {
    switch (node.type) {
      case "cell":
        if (scope && node.key && lookup(scope, node.key) !== NOT_FOUND) {
          return null;
        }

        return node.rect;
      case "range":
      case "wholeRange":
        return node.rect;
      case "intersect": {
        const left = this.referenceRect(node.left, scope);
        const right = this.referenceRect(node.right, scope);

        return left && right ? intersectRects(left, right) : null;
      }
      default:
        return null;
    }
  }

  readRect(rect) {
    const { sheetName, r1, c1, r2, c2 } = rect;
    const wholeColumns = r1 === 0 && r2 === MAX_ROW_INDEX;
    const wholeRows = c1 === 0 && c2 === MAX_COLUMN_INDEX;

    if (wholeColumns && !wholeRows) {
      return normalizeRange(
        this.yy.wholeRangeValue("columns", sheetName, c1, false, c2, false)
      );
    }
    if (wholeRows && !wholeColumns) {
      return normalizeRange(
        this.yy.wholeRangeValue("rows", sheetName, r1, false, r2, false)
      );
    }
    if (r1 === r2 && c1 === c2) {
      const value = this.yy.cellValue(cellLabel(sheetName, r1, c1));

      return isErrorString(value) ? toErrorValue(value) : value;
    }

    return normalizeRange(
      this.yy.rangeValue(cellLabel(sheetName, r1, c1), cellLabel(null, r2, c2))
    );
  }

  evaluateIntersection(node, scope) {
    const left = this.referenceRect(node.left, scope);
    const right = this.referenceRect(node.right, scope);

    if (!left || !right || !sameSheet(left.sheetName, right.sheetName)) {
      return fail("VALUE");
    }
    const rect = intersectRects(left, right);

    if (!rect) {
      return fail("NULL");
    }

    return this.readRect(rect);
  }

  evaluateImplicit(node, scope) {
    const rect = this.referenceRect(node.value, scope);

    if (!rect) {
      return firstElement(this.evaluate(node.value, scope));
    }
    if (rect.r1 === rect.r2 && rect.c1 === rect.c2) {
      return this.readRect(rect);
    }
    const options = (this.yy.getOptions && this.yy.getOptions()) || {};
    const row = pickNumber(options.row, options.r);
    const column = pickNumber(options.column, options.col, options.c);
    const rowInside = row !== null && row >= rect.r1 && row <= rect.r2;
    const columnInside =
      column !== null && column >= rect.c1 && column <= rect.c2;

    if (rect.c1 === rect.c2 && rowInside) {
      return this.readRect({ ...rect, r1: row, r2: row });
    }
    if (rect.r1 === rect.r2 && columnInside) {
      return this.readRect({ ...rect, c1: column, c2: column });
    }
    if (rowInside && columnInside) {
      return this.readRect({
        ...rect,
        r1: row,
        r2: row,
        c1: column,
        c2: column,
      });
    }

    return fail("VALUE");
  }
}

function pickNumber(...values) {
  for (let i = 0; i < values.length; i++) {
    if (typeof values[i] === "number" && isFinite(values[i])) {
      return values[i];
    }
  }

  return null;
}

function intersectRects(a, b) {
  if (!sameSheet(a.sheetName, b.sheetName)) {
    return null;
  }
  const rect = {
    sheetName: a.sheetName,
    r1: Math.max(a.r1, b.r1),
    c1: Math.max(a.c1, b.c1),
    r2: Math.min(a.r2, b.r2),
    c2: Math.min(a.c2, b.c2),
  };

  return rect.r1 > rect.r2 || rect.c1 > rect.c2 ? null : rect;
}

const pickBoolean = safeScalar((condition, whenTrue, whenFalse) => {
  if (condition instanceof Error) {
    return condition;
  }

  return toBoolean(condition) ? whenTrue : whenFalse;
});

function isNA(value) {
  return value instanceof Error && errorCode(value) === "#N/A";
}

function isAnyError(value) {
  return value instanceof Error;
}

function containsError(value, test) {
  for (let i = 0; i < value.length; i++) {
    const row = value[i];

    if (Array.isArray(row)) {
      for (let j = 0; j < row.length; j++) {
        if (test(row[j])) {
          return true;
        }
      }
    } else if (test(row)) {
      return true;
    }
  }

  return false;
}

function makeIfError(test) {
  return function ifError(args, scope) {
    if (args.length !== 2) {
      return FALLBACK;
    }
    const value = args[0] === MISSING ? 0 : this.evaluateSafe(args[0], scope);

    if (Array.isArray(value)) {
      if (!containsError(value, test)) {
        return value;
      }
      const alternative = this.branchValue(args[1], scope);

      return broadcast([value, alternative], (v, alt) => (test(v) ? alt : v));
    }
    if (test(value)) {
      return this.evaluateBranch(args[1], scope);
    }

    return value;
  };
}

function chooseIndex(index, count) {
  const n = Math.trunc(toNumber(index));

  if (n < 1 || n > count) {
    fail("VALUE");
  }

  return n;
}

const SPECIAL_FORMS = Object.assign(Object.create(null), {
  LET(args, scope) {
    const count = args.length;

    if (count < 3 || count % 2 === 0) {
      return fail("VALUE");
    }
    const names = new Set();
    let inner = scope;

    // One frame per binding: a value (and any LAMBDA it creates) only sees
    // the names bound before it, so a LET name cannot refer to itself.
    for (let i = 0; i < count - 1; i += 2) {
      const key = bindingName(args[i]);

      if (!key || names.has(key)) {
        fail("VALUE");
      }
      names.add(key);
      const value =
        args[i + 1] === MISSING ? null : this.evaluateSafe(args[i + 1], inner);

      inner = { vars: new Map([[key, value]]), parent: inner };
    }

    return this.evaluate(args[count - 1], inner);
  },

  LAMBDA(args, scope) {
    const count = args.length;

    if (count < 1 || args[count - 1] === MISSING) {
      return fail("VALUE");
    }
    const params = [];

    for (let i = 0; i < count - 1; i++) {
      const key = bindingName(args[i]);

      if (!key || params.indexOf(key) !== -1) {
        fail("VALUE");
      }
      params.push(key);
    }

    return this.makeLambda(params, args[count - 1], scope);
  },

  ISOMITTED(args, scope) {
    if (args.length !== 1) {
      return fail("VALUE");
    }
    const key = bindingName(args[0]);

    return !!(key && scope && lookup(scope, key) === OMITTED);
  },

  IF(args, scope) {
    if (args.length < 2 || args.length > 3) {
      return FALLBACK;
    }
    const condition =
      args[0] === MISSING ? false : this.evaluateStrict(args[0], scope);

    if (Array.isArray(condition)) {
      const whenTrue = this.branchValue(args[1], scope);
      const whenFalse =
        args.length === 3 ? this.branchValue(args[2], scope) : false;

      return broadcast([condition, whenTrue, whenFalse], pickBoolean);
    }
    const branch = toBoolean(condition) ? args[1] : args[2];

    if (branch === void 0) {
      return false;
    }

    return this.evaluateBranch(branch, scope);
  },

  IFS(args, scope) {
    const count = args.length;

    if (count < 2 || count % 2 !== 0) {
      return FALLBACK;
    }
    for (let i = 0; i < count; i += 2) {
      const condition = this.evaluateStrict(args[i], scope);

      if (Array.isArray(condition)) {
        const values = [condition, this.branchValue(args[i + 1], scope)];

        for (let k = i + 2; k < count; k++) {
          values.push(this.branchValue(args[k], scope));
        }

        return broadcast(
          values,
          safeScalar((...items) => {
            for (let k = 0; k < items.length; k += 2) {
              if (items[k] instanceof Error) {
                return items[k];
              }
              if (toBoolean(items[k])) {
                return items[k + 1];
              }
            }

            return toErrorValue("N/A");
          })
        );
      }
      if (toBoolean(condition)) {
        return this.evaluateBranch(args[i + 1], scope);
      }
    }

    return fail("N/A");
  },

  IFERROR: makeIfError(isAnyError),

  IFNA: makeIfError(isNA),

  CHOOSE(args, scope) {
    if (args.length < 2) {
      return FALLBACK;
    }
    const index = this.evaluateStrict(args[0], scope);

    if (Array.isArray(index)) {
      const values = args.slice(1).map((arg) => this.branchValue(arg, scope));

      return broadcast(
        [index, ...values],
        safeScalar((i, ...items) => {
          if (i instanceof Error) {
            return i;
          }

          return items[chooseIndex(i, items.length) - 1];
        })
      );
    }

    return this.evaluateBranch(
      args[chooseIndex(index, args.length - 1)],
      scope
    );
  },

  SWITCH(args, scope) {
    const count = args.length;

    if (count < 2) {
      return FALLBACK;
    }
    const rest = count - 1;
    const pairs = Math.floor(rest / 2);
    const hasDefault = rest % 2 === 1;
    const value = this.evaluateStrict(args[0], scope);

    if (Array.isArray(value)) {
      const values = args.slice(1).map((arg) => this.branchValue(arg, scope));

      return broadcast(
        [value, ...values],
        safeScalar((v, ...items) => {
          if (v instanceof Error) {
            return v;
          }
          for (let p = 0; p < pairs; p++) {
            if (items[2 * p] instanceof Error) {
              return items[2 * p];
            }
            if (compare(v, items[2 * p]) === 0) {
              return items[2 * p + 1];
            }
          }

          return hasDefault ? items[items.length - 1] : toErrorValue("N/A");
        })
      );
    }
    for (let p = 0; p < pairs; p++) {
      const candidate = firstElement(
        this.evaluateStrict(args[1 + 2 * p], scope)
      );

      if (compare(value, candidate) === 0) {
        return this.evaluateBranch(args[2 + 2 * p], scope);
      }
    }
    if (hasDefault) {
      return this.evaluateBranch(args[count - 1], scope);
    }

    return fail("N/A");
  },
});

export const SPECIAL_FORM_NAMES = Object.keys(SPECIAL_FORMS);
