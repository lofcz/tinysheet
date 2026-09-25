/**
 * AST evaluator.
 *
 * Talks to the host (parser.js) through `owner.yy`:
 *   cellValue(label), rangeValue(startLabel, endLabel),
 *   wholeRangeValue(kind, sheetName, start, startAbsolute, end, endAbsolute),
 *   callVariable(name), callFunction(name, params, refs), throwError(image),
 *   hasFunction(name), getFunction(name), getLambdaVariable(name),
 *   getOptions().
 *
 * Errors: formula errors are thrown as `Error`s and abort the evaluation
 * (the first error wins), except where Excel treats them as values: LET
 * bindings, LAMBDA arguments, array elements, IFERROR/IFNA and the
 * information functions in ERROR_TOLERANT receive error values.
 *
 * References: reference-valued expressions evaluate to an internal
 * `Reference` (one or more areas) that is read ("dereferenced") only where a
 * value is needed. Besides literal references, `A1:INDEX(B:B,5)` (range
 * operator), `B1:B5 A3:D3` (intersection), `(A1:A2,C1:C2)` (union), INDEX,
 * CHOOSE, IF, IFS, SWITCH and LET results, and OFFSET/INDIRECT used as range
 * operands are references, as are host results made with `createReference`
 * (../helper/reference.js) and variables or range operands the host resolves
 * through `yy.resolveReference` (the parser's "resolveReference" event).
 * Function arguments that are references reach `callFunction` as values
 * plus a `refs` descriptor; references never leak out of the evaluator.
 *
 * Lazy special forms: LET, LAMBDA, ISOMITTED, IF, IFS, IFERROR, IFNA,
 * CHOOSE and SWITCH evaluate only the arguments they need; INDEX, ROW,
 * COLUMN, ROWS, COLUMNS, ISREF, AREAS, OFFSET and INDIRECT are evaluated
 * here when their argument is a reference the evaluator can resolve (other
 * arguments, e.g. a host's reference markers, go through `callFunction`).
 * Special forms do not emit the `callFunction` event; a function registered
 * with `Parser#setFunction` under the same name takes precedence over them.
 *
 * Array lifting: a built-in function receiving an array where it expects a
 * scalar is called once per element (see ./function-traits.js).
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
  normalizeNumber,
  toBoolean,
  toErrorValue,
  toNumber,
} from "../helper/value";
import { broadcast, columnCount, firstElement, to2D } from "../helper/array";
import { toLabel } from "../helper/cell";
import { isReference } from "../helper/reference";
import {
  MISSING,
  MAX_COLUMN_INDEX,
  MAX_ROW_INDEX,
  isReferenceNode,
} from "./ast";
import {
  builtinArrayParams,
  normalizeArrayParams,
  unionPolicy,
  wrapsReference,
} from "./function-traits";

const OMITTED = Symbol("omitted");
const NOT_FOUND = Symbol("notFound");
const FALLBACK = Symbol("fallback");
const MAX_LAMBDA_DEPTH = 256;
const NA = toErrorValue("N/A");

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

// Calls that may evaluate to a reference (when not shadowed or overridden).
const REFERENCE_CALLS = new Set([
  "INDEX",
  "CHOOSE",
  "IF",
  "IFS",
  "SWITCH",
  "LET",
  "OFFSET",
  "INDIRECT",
]);

/**
 * A reference value: one or more areas ({sheetName, r1, c1, r2, c2}).
 * `node` is the literal reference node it came from, read through the
 * original labels so hosts see `$` markers and sheet names as written.
 */
class Reference {
  constructor(areas, node = null) {
    this.areas = areas;
    this.node = node;
    this.hasValue = false;
    this.value = void 0;
  }
}

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

function checkSameSheet(areas) {
  for (let i = 1; i < areas.length; i++) {
    if (!sameSheet(areas[0].sheetName, areas[i].sheetName)) {
      fail("VALUE");
    }
  }
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

/**
 * Formula results: 15-significant-digit noise removed, -0 → 0 and
 * non-finite numbers → #NUM! (also inside arrays).
 */
function normalizeResult(value) {
  if (typeof value === "number") {
    return normalizeNumber(value);
  }
  if (!Array.isArray(value)) {
    return value;
  }
  let copy = null;

  for (let i = 0; i < value.length; i++) {
    const row = value[i];

    if (Array.isArray(row)) {
      let rowCopy = null;

      for (let j = 0; j < row.length; j++) {
        if (typeof row[j] === "number") {
          const number = normalizeNumber(row[j]);

          if (!Object.is(number, row[j])) {
            rowCopy = rowCopy || row.slice();
            rowCopy[j] = number;
          }
        }
      }
      if (rowCopy) {
        copy = copy || value.slice();
        copy[i] = rowCopy;
      }
    } else if (typeof row === "number") {
      const number = normalizeNumber(row);

      if (!Object.is(number, row)) {
        copy = copy || value.slice();
        copy[i] = number;
      }
    }
  }

  return copy || value;
}

// Function results: overflowed numbers (Infinity / NaN) are #NUM!.
function checkResult(value) {
  if (typeof value === "number" && !isFinite(value)) {
    fail("NUM");
  }

  return value;
}

function elementResult(value) {
  const scalar = Array.isArray(value) ? firstElement(value) : value;

  return typeof scalar === "number" && !isFinite(scalar)
    ? toErrorValue("NUM")
    : scalar;
}

// Per-element `refs` of a lifted call: lifted reference args point at the cell.
function elementRefs(refs, positions, grids, i, j) {
  if (refs.length === 0) {
    return refs;
  }
  let copy = null;

  for (let p = 0; p < positions.length; p++) {
    const ref = refs[positions[p]];

    if (ref && ref.startRow >= 0 && ref.startColumn >= 0) {
      const grid = grids[p];
      const r = grid.rows === 1 ? 0 : i;
      const c = grid.cols === 1 ? 0 : j;

      copy = copy || refs.slice();
      copy[positions[p]] = {
        sheetName: ref.sheetName,
        startRow: ref.startRow + r,
        startColumn: ref.startColumn + c,
        endRow: ref.startRow + r,
        endColumn: ref.startColumn + c,
      };
    }
  }

  return copy || refs;
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

    return normalizeResult(this.evaluate(node, null));
  }

  /**
   * Evaluate a node to a value (references are read).
   */
  evaluate(node, scope) {
    switch (node.type) {
      case "number":
        return isFinite(node.value) ? node.value : fail("NUM");
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
      case "wholeRange":
        return this.readNode(node);
      case "call":
        return this.deref(this.evaluateCall(node, scope, false));
      case "name":
        return this.deref(this.evaluateName(node, scope));
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
      case "union":
      case "rangeRef":
        return this.deref(this.evaluateRef(node, scope));
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

  /**
   * Evaluate a node, keeping references as `Reference` values.
   *
   * @param {Object} node
   * @param {Object|null} scope
   * @param {Boolean} refMode The caller needs a reference (range operand,
   *   ROW argument, ...): OFFSET/INDIRECT are then resolved here.
   */
  evaluateAny(node, scope, refMode) {
    switch (node.type) {
      case "cell":
        if (scope && node.key) {
          const bound = lookup(scope, node.key);

          if (bound !== NOT_FOUND) {
            return bound === OMITTED ? null : bound;
          }
        }

        return new Reference([node.rect], node);
      case "range":
      case "wholeRange":
        return new Reference([node.rect], node);
      case "intersect":
      case "union":
      case "rangeRef":
        return this.evaluateRef(node, scope);
      case "call":
        return this.evaluateCall(node, scope, refMode);
      case "name":
        return this.evaluateName(node, scope);
      default:
        return this.evaluate(node, scope);
    }
  }

  evaluateAnySafe(node, scope, refMode) {
    try {
      return this.evaluateAny(node, scope, refMode);
    } catch (ex) {
      return toErrorValue(ex);
    }
  }

  /**
   * Evaluate a node that must be a reference.
   *
   * @returns {Reference}
   */
  evaluateRef(node, scope) {
    switch (node.type) {
      case "intersect": {
        const left = this.evaluateRef(node.left, scope);
        const right = this.evaluateRef(node.right, scope);
        const areas = [];

        left.areas.forEach((a) => {
          right.areas.forEach((b) => {
            if (!sameSheet(a.sheetName, b.sheetName)) {
              fail("VALUE");
            }
            const rect = intersectRects(a, b);

            if (rect) {
              areas.push(rect);
            }
          });
        });

        return areas.length ? new Reference(areas) : fail("NULL");
      }
      case "union": {
        const areas = [];

        node.items.forEach((item) => {
          areas.push(...this.evaluateRef(item, scope).areas);
        });
        checkSameSheet(areas);

        return new Reference(areas);
      }
      case "rangeRef": {
        const areas = this.evaluateRef(node.left, scope).areas.concat(
          this.evaluateRef(node.right, scope).areas
        );

        checkSameSheet(areas);

        return new Reference([boundingRect(areas)]);
      }
      default: {
        const value = this.evaluateAny(node, scope, true);

        if (value instanceof Reference) {
          return value;
        }
        if (value instanceof Error) {
          throw value;
        }
        const hosted = this.hostReference(value, true);

        return hosted || fail("VALUE");
      }
    }
  }

  /**
   * A host value standing for a reference (e.g. a host's reference marker
   * string returned by its OFFSET), resolved through `yy.resolveReference`.
   *
   * @returns {Reference|null}
   */
  hostReference(value, ask) {
    let info = null;

    if (isReference(value)) {
      info = value;
    } else if (
      ask &&
      this.yy.resolveReference &&
      (typeof value === "string" ||
        (typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          !(value instanceof Error)))
    ) {
      info = this.yy.resolveReference(value);
    }
    if (!info) {
      return null;
    }
    const whole = (index, max) => (index < 0 ? max : index);

    return new Reference([
      {
        sheetName: info.sheetName == null ? null : info.sheetName,
        r1: info.startRow < 0 ? 0 : info.startRow,
        c1: info.startColumn < 0 ? 0 : info.startColumn,
        r2: whole(info.endRow, MAX_ROW_INDEX),
        c2: whole(info.endColumn, MAX_COLUMN_INDEX),
      },
    ]);
  }

  /**
   * Whether a node can evaluate to a reference (without evaluating it).
   */
  isReferenceCapable(node, scope) {
    switch (node.type) {
      case "cell":
        if (scope && node.key) {
          const bound = lookup(scope, node.key);

          if (bound !== NOT_FOUND) {
            return bound instanceof Reference;
          }
        }

        return true;
      case "range":
      case "wholeRange":
      case "intersect":
      case "union":
      case "rangeRef":
        return true;
      case "name": {
        // Host variables may resolve to references (createReference).
        const bound = scope ? lookup(scope, node.key) : NOT_FOUND;

        return bound === NOT_FOUND || bound instanceof Reference;
      }
      case "call":
        return (
          REFERENCE_CALLS.has(node.key) &&
          !this.hasCustomFunction(node.name) &&
          !(scope && lookup(scope, node.key) !== NOT_FOUND)
        );
      default:
        return false;
    }
  }

  /**
   * Value of a reference (other values pass through).
   */
  deref(value) {
    if (!(value instanceof Reference)) {
      return value;
    }
    if (value.hasValue) {
      return value.value;
    }
    if (value.areas.length !== 1) {
      fail("VALUE");
    }
    const result = value.node
      ? this.readNode(value.node)
      : this.readRect(value.areas[0]);

    value.hasValue = true;
    value.value = result;

    return result;
  }

  // Read a literal reference node through its original labels.
  readNode(node) {
    switch (node.type) {
      case "cell": {
        const value = this.yy.cellValue(node.image);

        return isErrorString(value) ? toErrorValue(value) : value;
      }
      case "range":
        return normalizeRange(this.yy.rangeValue(node.start, node.end));
      default:
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
    }
  }

  evaluateCell(node, scope) {
    if (scope && node.key) {
      const bound = lookup(scope, node.key);

      if (bound !== NOT_FOUND) {
        return bound === OMITTED ? null : this.deref(bound);
      }
    }

    return this.readNode(node);
  }

  evaluateName(node, scope) {
    if (scope) {
      const bound = lookup(scope, node.key);

      if (bound !== NOT_FOUND) {
        return bound === OMITTED ? null : bound;
      }
    }

    const value = this.yy.callVariable(node.name);

    return this.hostReference(value, true) || value;
  }

  hasCustomFunction(name) {
    return !!(this.yy.hasFunction && this.yy.hasFunction(name));
  }

  evaluateCall(node, scope, refMode) {
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
      const result = special.call(this, node.args, scope, node, refMode);

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

  /**
   * Call a function with its evaluated arguments.
   *
   * @param {Object} node Call node.
   * @param {Object|null} scope
   * @param {Map} [preset] Arguments a special form already evaluated
   *   (index → value, possibly a Reference).
   */
  callEager(node, scope, preset) {
    const args = node.args;

    if (args.length === 1 && args[0].type === "legacyArray") {
      const items = args[0].items;

      // `[]` is an empty argument list.
      return this.finishCall(
        node,
        items.length === 1 && items[0] === "" ? [] : items.slice(),
        []
      );
    }
    const key = node.key;
    const tolerant = isTolerant(key);
    const params = [];
    const refs = [];
    let hasRefs = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === MISSING) {
        params.push(void 0);
        refs.push(null);
        continue;
      }
      let value;

      if (preset && preset.has(i)) {
        value = preset.get(i);
      } else if (tolerant) {
        value = this.evaluateAnySafe(arg, scope, false);
      } else {
        value = this.evaluateAny(arg, scope, false);
      }
      if (value instanceof Reference) {
        hasRefs = true;
        this.pushReference(params, refs, value, key, tolerant);
      } else {
        if (!tolerant && value instanceof Error) {
          throw value;
        }
        params.push(value);
        refs.push(null);
      }
    }

    return this.finishCall(node, params, hasRefs ? refs : []);
  }

  /**
   * Append a reference argument (value + descriptor). Multi-area references
   * follow the function's union policy.
   */
  pushReference(params, refs, ref, key, tolerant) {
    const areas = ref.areas;

    if (areas.length > 1) {
      const policy = unionPolicy(key);

      if (policy === "spread") {
        areas.forEach((area) => {
          this.pushReference(
            params,
            refs,
            new Reference([area]),
            key,
            tolerant
          );
        });

        return;
      }
      let value;

      try {
        if (policy !== "flatten") {
          fail("VALUE");
        }
        const row = [];

        areas.forEach((area) => {
          to2D(this.readRect(area)).forEach((line) => row.push(...line));
        });
        value = [row];
      } catch (ex) {
        if (!tolerant) {
          throw ex;
        }
        value = toErrorValue(ex);
      }
      params.push(value);
      refs.push(null);

      return;
    }
    let value;

    try {
      value = this.deref(ref);
    } catch (ex) {
      if (!tolerant) {
        throw ex;
      }
      value = toErrorValue(ex);
    }
    if (!tolerant && value instanceof Error) {
      throw value;
    }
    if (!Array.isArray(value) && wrapsReference(key, params.length)) {
      value = [[value]];
    }
    params.push(value);
    refs.push(referenceInfo(areas[0]));
  }

  finishCall(node, params, refs) {
    const acceptsArrays = this.arrayParams(node);

    if (acceptsArrays) {
      const positions = [];

      for (let i = 0; i < params.length; i++) {
        if (Array.isArray(params[i]) && !acceptsArrays(i)) {
          positions.push(i);
        }
      }
      if (positions.length > 0) {
        return this.callLifted(node, params, refs, positions);
      }
    }

    const result = this.yy.callFunction(node.name, params, refs);

    return this.hostReference(result, false) || checkResult(result);
  }

  /**
   * Array-parameter predicate of a call, or null when nothing is lifted.
   */
  arrayParams(node) {
    const key = node.key;
    let spec;
    const custom =
      this.yy.getFunction && this.hasCustomFunction(node.name)
        ? this.yy.getFunction(node.name)
        : null;

    if (custom && custom.arrayParams !== void 0) {
      spec = normalizeArrayParams(custom.arrayParams);
    } else if (BUILTIN_FUNCTIONS.has(key)) {
      const own = CUSTOM_FUNCTIONS[key];

      spec =
        own && own.arrayParams !== void 0
          ? normalizeArrayParams(own.arrayParams)
          : builtinArrayParams(key);
    } else {
      return null;
    }

    return typeof spec === "function" ? spec : null;
  }

  /**
   * Call a scalar function once per element of its array arguments (at
   * `positions`), with Excel broadcasting: single rows/columns repeat,
   * positions outside a smaller array are #N/A.
   */
  callLifted(node, params, refs, positions) {
    const tolerant = isTolerant(node.key);
    const grids = positions.map((k) => {
      const matrix = to2D(params[k]);

      return { matrix, rows: matrix.length, cols: columnCount(matrix) };
    });
    let rows = 1;
    let cols = 1;

    grids.forEach((grid) => {
      rows = Math.max(rows, grid.rows);
      cols = Math.max(cols, grid.cols);
    });
    const result = new Array(rows);

    for (let i = 0; i < rows; i++) {
      const line = new Array(cols);

      for (let j = 0; j < cols; j++) {
        const args = params.slice();
        let element = null;

        for (let p = 0; p < positions.length; p++) {
          const grid = grids[p];
          const r = grid.rows === 1 ? 0 : i;
          const c = grid.cols === 1 ? 0 : j;
          const row = grid.matrix[r];

          if (!row || c >= row.length) {
            element = NA;
            break;
          }
          const value = row[c];

          if (!tolerant && value instanceof Error && element === null) {
            element = value;
          }
          args[positions[p]] = value;
        }
        if (element === null) {
          try {
            element = elementResult(
              this.yy.callFunction(
                node.name,
                args,
                elementRefs(refs, positions, grids, i, j)
              )
            );
          } catch (ex) {
            element = toErrorValue(ex);
          }
        }
        line[j] = element;
      }
      result[i] = line;
    }

    return rows === 1 && cols === 1 ? result[0][0] : result;
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

  // Selected branch of a lazy form: may be a reference.
  evaluateBranch(node, scope, refMode) {
    return node === MISSING ? 0 : this.evaluateAny(node, scope, refMode);
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

  evaluateImplicit(node, scope) {
    if (!this.isReferenceCapable(node.value, scope)) {
      return firstElement(this.evaluate(node.value, scope));
    }
    const ref = this.evaluateAny(node.value, scope, true);

    if (!(ref instanceof Reference)) {
      return firstElement(ref);
    }
    if (ref.areas.length !== 1) {
      return fail("VALUE");
    }
    const rect = ref.areas[0];

    if (rect.r1 === rect.r2 && rect.c1 === rect.c2) {
      return this.deref(ref);
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

function boundingRect(areas) {
  const rect = { ...areas[0] };

  for (let i = 1; i < areas.length; i++) {
    const area = areas[i];

    rect.r1 = Math.min(rect.r1, area.r1);
    rect.c1 = Math.min(rect.c1, area.c1);
    rect.r2 = Math.max(rect.r2, area.r2);
    rect.c2 = Math.max(rect.c2, area.c2);
  }

  return rect;
}

function singleArea(ref) {
  return ref.areas.length === 1 ? ref.areas[0] : fail("REF");
}

// Optional integer argument (blank → `fallback`).
function integerArg(value, fallback) {
  if (value === void 0 || value === null) {
    return fallback;
  }

  return Math.trunc(toNumber(value));
}

/**
 * INDEX(reference, row, [column], [area]) as a reference.
 */
function indexReference(ref, rowArg, columnArg, areaArg, columnOmitted) {
  const area = integerArg(areaArg, 1);

  if (area < 1) {
    fail("VALUE");
  }
  if (area > ref.areas.length) {
    fail("REF");
  }
  const rect = ref.areas[area - 1];
  const rows = rect.r2 - rect.r1 + 1;
  const cols = rect.c2 - rect.c1 + 1;
  let row = integerArg(rowArg, 0);
  let column = integerArg(columnArg, 0);

  if (row < 0 || column < 0) {
    fail("VALUE");
  }
  if (columnOmitted && rows === 1 && cols > 1) {
    // A single row with one index: the index selects the column.
    column = row;
    row = 0;
  }
  if (row > rows || column > cols) {
    fail("REF");
  }

  return new Reference([
    {
      sheetName: rect.sheetName,
      r1: row ? rect.r1 + row - 1 : rect.r1,
      r2: row ? rect.r1 + row - 1 : rect.r2,
      c1: column ? rect.c1 + column - 1 : rect.c1,
      c2: column ? rect.c1 + column - 1 : rect.c2,
    },
  ]);
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
      return this.evaluateBranch(args[1], scope, false);
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

/**
 * ROW/COLUMN/ROWS/COLUMNS-style form: computed from the reference when the
 * single argument is one the evaluator resolves; other arguments (arrays,
 * host reference markers, no argument) go through callFunction.
 */
function referenceForm(compute) {
  return function form(args, scope, node) {
    if (
      args.length !== 1 ||
      args[0] === MISSING ||
      !this.isReferenceCapable(args[0], scope)
    ) {
      return FALLBACK;
    }
    const value = this.evaluateAny(args[0], scope, true);

    if (value instanceof Reference) {
      return compute(value);
    }

    return this.callEager(node, scope, new Map([[0, value]]));
  };
}

const CELL_INFO = ["row", "col", "address", "contents"];

function sheetPrefix(sheetName) {
  const name = String(sheetName);

  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)
    ? name
    : `'${name.replace(/'/g, "''")}'`;
}

function numbersBetween(start, end, vertical) {
  if (start === end) {
    return start + 1;
  }
  const out = [];

  for (let i = start; i <= end; i++) {
    out.push(i + 1);
  }

  return vertical ? out.map((n) => [n]) : [out];
}

const SPECIAL_FORMS = Object.assign(Object.create(null), {
  LET(args, scope, node, refMode) {
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
        args[i + 1] === MISSING
          ? null
          : this.evaluateAnySafe(args[i + 1], inner, false);

      inner = { vars: new Map([[key, value]]), parent: inner };
    }

    return this.evaluateAny(args[count - 1], inner, refMode);
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

  IF(args, scope, node, refMode) {
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

    return this.evaluateBranch(branch, scope, refMode);
  },

  IFS(args, scope, node, refMode) {
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
        return this.evaluateBranch(args[i + 1], scope, refMode);
      }
    }

    return fail("N/A");
  },

  IFERROR: makeIfError(isAnyError),

  IFNA: makeIfError(isNA),

  CHOOSE(args, scope, node, refMode) {
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
      scope,
      refMode
    );
  },

  SWITCH(args, scope, node, refMode) {
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
        return this.evaluateBranch(args[2 + 2 * p], scope, refMode);
      }
    }
    if (hasDefault) {
      return this.evaluateBranch(args[count - 1], scope, refMode);
    }

    return fail("N/A");
  },

  /**
   * INDEX over a reference returns a reference (A1:INDEX(B:B,5),
   * ROW(INDEX(A1:C5,2,0)), INDEX((A1:B2,D1:E2),1,1,2)). Array row/column
   * arguments and non-reference arrays use the INDEX function.
   */
  INDEX(args, scope, node) {
    const count = args.length;

    if (
      count < 2 ||
      count > 4 ||
      args[0] === MISSING ||
      !this.isReferenceCapable(args[0], scope)
    ) {
      return FALLBACK;
    }
    const first = this.evaluateAny(args[0], scope, true);
    const preset = new Map([[0, first]]);
    const numbers = [];

    for (let k = 1; k < count; k++) {
      const value =
        args[k] === MISSING ? void 0 : this.evaluateStrict(args[k], scope);

      preset.set(k, value);
      numbers.push(value);
    }
    if (!(first instanceof Reference) || numbers.some(Array.isArray)) {
      return this.callEager(node, scope, preset);
    }

    return indexReference(
      first,
      numbers[0],
      numbers[1],
      numbers[2],
      count < 3 || args[2] === MISSING
    );
  },

  /**
   * OFFSET where a reference is needed (`OFFSET(A1,1,1):C5`, `ROWS(...)`);
   * elsewhere it is left to the host's OFFSET.
   */
  OFFSET(args, scope, node, refMode) {
    const count = args.length;

    if (
      !refMode ||
      count < 3 ||
      count > 5 ||
      args[0] === MISSING ||
      !this.isReferenceCapable(args[0], scope)
    ) {
      return FALLBACK;
    }
    const rect = singleArea(this.evaluateRef(args[0], scope));
    const number = (k, fallback) =>
      k < count && args[k] !== MISSING
        ? integerArg(this.evaluateStrict(args[k], scope), fallback)
        : fallback;
    const rows = number(1, 0);
    const cols = number(2, 0);
    const height = number(3, rect.r2 - rect.r1 + 1);
    const width = number(4, rect.c2 - rect.c1 + 1);

    if (height === 0 || width === 0) {
      fail("REF");
    }
    const top = rect.r1 + rows;
    const left = rect.c1 + cols;
    const area = {
      sheetName: rect.sheetName,
      r1: height > 0 ? top : top + height + 1,
      r2: height > 0 ? top + height - 1 : top,
      c1: width > 0 ? left : left + width + 1,
      c2: width > 0 ? left + width - 1 : left,
    };

    if (
      area.r1 < 0 ||
      area.c1 < 0 ||
      area.r2 > MAX_ROW_INDEX ||
      area.c2 > MAX_COLUMN_INDEX
    ) {
      fail("REF");
    }

    return new Reference([area]);
  },

  /**
   * INDIRECT (A1 style) where a reference is needed; elsewhere it is left
   * to the host's INDIRECT.
   */
  INDIRECT(args, scope, node, refMode) {
    if (!refMode || args.length < 1 || args.length > 2 || args[0] === MISSING) {
      return FALLBACK;
    }
    const text = firstElement(this.evaluateStrict(args[0], scope));

    if (
      args.length === 2 &&
      args[1] !== MISSING &&
      !toBoolean(firstElement(this.evaluateStrict(args[1], scope)))
    ) {
      // R1C1 text is resolved by the host only.
      fail("REF");
    }
    if (typeof text !== "string") {
      fail("REF");
    }
    let target;

    try {
      target = this.owner.parseToAst(text.trim());
    } catch (ex) {
      target = null;
    }
    if (!target || !isReferenceNode(target)) {
      fail("REF");
    }

    return new Reference([target.rect]);
  },

  ROW: referenceForm((ref) => {
    const rect = singleArea(ref);

    return numbersBetween(rect.r1, rect.r2, true);
  }),

  COLUMN: referenceForm((ref) => {
    const rect = singleArea(ref);

    return numbersBetween(rect.c1, rect.c2, false);
  }),

  ROWS: referenceForm((ref) => {
    const rect = singleArea(ref);

    return rect.r2 - rect.r1 + 1;
  }),

  COLUMNS: referenceForm((ref) => {
    const rect = singleArea(ref);

    return rect.c2 - rect.c1 + 1;
  }),

  /**
   * CELL("row" | "col" | "address" | "contents", reference) for references
   * the evaluator resolves (CELL("row", INDEX(A1:C5,2,0))); other info
   * types and other arguments are left to the host's CELL.
   */
  CELL(args, scope, node) {
    if (
      args.length !== 2 ||
      args[1] === MISSING ||
      !this.isReferenceCapable(args[1], scope)
    ) {
      return FALLBACK;
    }
    const info = args[0] === MISSING ? void 0 : this.evaluate(args[0], scope);
    const ref = this.evaluateAny(args[1], scope, true);
    const kind = typeof info === "string" ? info.toLowerCase() : null;

    if (
      !(ref instanceof Reference) ||
      ref.areas.length !== 1 ||
      CELL_INFO.indexOf(kind) === -1
    ) {
      return this.callEager(
        node,
        scope,
        new Map([
          [0, info],
          [1, ref],
        ])
      );
    }
    const { sheetName, r1, c1 } = ref.areas[0];

    switch (kind) {
      case "row":
        return r1 + 1;
      case "col":
        return c1 + 1;
      case "contents":
        return this.readRect({ sheetName, r1, c1, r2: r1, c2: c1 });
      default:
        return (
          (sheetName == null ? "" : `${sheetPrefix(sheetName)}!`) +
          toLabel(
            { index: r1, isAbsolute: true },
            { index: c1, isAbsolute: true }
          )
        );
    }
  },

  ISREF(args, scope) {
    if (
      args.length !== 1 ||
      args[0] === MISSING ||
      !this.isReferenceCapable(args[0], scope)
    ) {
      return FALLBACK;
    }

    return this.evaluateAnySafe(args[0], scope, true) instanceof Reference;
  },

  AREAS(args, scope) {
    if (
      args.length !== 1 ||
      args[0] === MISSING ||
      !this.isReferenceCapable(args[0], scope)
    ) {
      return fail("VALUE");
    }

    return this.evaluateRef(args[0], scope).areas.length;
  },
});

export const SPECIAL_FORM_NAMES = Object.keys(SPECIAL_FORMS);
