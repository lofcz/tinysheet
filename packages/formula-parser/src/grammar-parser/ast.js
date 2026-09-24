/**
 * AST node constructors used by the grammar. Nodes are plain immutable
 * objects (they are cached and shared between evaluations).
 *
 * Node types:
 *   number {value}            string {value}          error {image}
 *   array {rows}              legacyArray {items}     missing
 *   name {name, key}          cell {image, key, rect} range {start, end, rect}
 *   wholeRange {kind, sheetName, start, startAbsolute, end, endAbsolute, rect}
 *   refError                  negate {value}          plus {value}
 *   percent {value}           binary {op, left, right}
 *   call {name, key, args}    invoke {callee, args}
 *   intersect {left, right}   implicit {value}
 *
 * `key` is the upper-case name used for LET/LAMBDA scope lookups. A plain
 * relative cell token (`x1`) also carries a key, so a LET/LAMBDA name that
 * looks like a cell reference shadows the cell inside its scope.
 *
 * `rect` = {sheetName, r1, c1, r2, c2} (0-based, inclusive) describes the
 * referenced area; whole columns span every row and vice versa.
 */
import { extractLabel, columnLabelToIndex } from "../helper/cell";
import { isValidStrict as isValidError } from "../error";
import { toErrorValue } from "../helper/value";

export const MAX_ROW_INDEX = 1048575;
export const MAX_COLUMN_INDEX = 16383;

export const MISSING = Object.freeze({ type: "missing" });

const FUNCTION_PREFIX = /^_xl(?:fn|ws)\./i;
const PARAM_PREFIX = /^_xlpm\./i;

function syntaxError(message) {
  return new Error(`Parser error: ${message}`);
}

export function number(image) {
  return { type: "number", value: Number(image) };
}

export function stringValue(image) {
  const inner = image.slice(1, -1);

  return image[0] === '"' ? inner.replace(/""/g, '"') : inner;
}

export function string(image) {
  return { type: "string", value: stringValue(image) };
}

export function error(image) {
  return { type: "error", image };
}

export function binary(op, left, right) {
  return { type: "binary", op, left, right };
}

export function unary(op, value) {
  return { type: op === "-" ? "negate" : "plus", value };
}

export function percent(value) {
  return { type: "percent", value };
}

export function intersect(left, right) {
  return { type: "intersect", left, right };
}

export function invoke(callee, args) {
  return { type: "invoke", callee, args };
}

export function implicitIntersection(value) {
  return { type: "implicit", value };
}

export function name(image) {
  const stripped = image.replace(PARAM_PREFIX, "");

  return { type: "name", name: stripped, key: stripped.toUpperCase() };
}

export function call(image, args) {
  const stripped = image.replace(FUNCTION_PREFIX, "");

  return { type: "call", name: stripped, key: stripped.toUpperCase(), args };
}

export function legacyArray(image) {
  return { type: "legacyArray", items: image.slice(1, -1).split(",") };
}

function unquoteSheetName(sheet) {
  if (sheet == null) {
    return null;
  }

  return sheet[0] === "'" ? sheet.slice(1, -1).replace(/''/g, "'") : sheet;
}

function splitSheet(image) {
  const bang = image.lastIndexOf("!");

  if (bang === -1) {
    return [null, image];
  }

  return [unquoteSheetName(image.slice(0, bang)), image.slice(bang + 1)];
}

function cellCoordinates(image) {
  const [row, column, sheetName] = extractLabel(image);

  if (!row || !column) {
    return null;
  }

  return { sheetName, row: row.index, column: column.index };
}

function isValidCoordinate(coords) {
  return (
    coords &&
    coords.row >= 0 &&
    coords.row <= MAX_ROW_INDEX &&
    coords.column >= 0 &&
    coords.column <= MAX_COLUMN_INDEX
  );
}

export function cell(image) {
  const coords = cellCoordinates(image);
  const plain = image.indexOf("$") === -1 && image.indexOf("!") === -1;

  if (!isValidCoordinate(coords)) {
    // Beyond the grid (XFE1, A0, A2000000) it is a name, not a reference.
    return plain ? name(image) : { type: "refError" };
  }

  return {
    type: "cell",
    image,
    key: plain ? image.toUpperCase() : null,
    rect: {
      sheetName: coords.sheetName,
      r1: coords.row,
      c1: coords.column,
      r2: coords.row,
      c2: coords.column,
    },
  };
}

export function range(start, end) {
  const a = cellCoordinates(start);
  const b = cellCoordinates(end);

  if (!isValidCoordinate(a) || !isValidCoordinate(b)) {
    return { type: "refError" };
  }

  return {
    type: "range",
    start,
    end,
    rect: {
      sheetName: a.sheetName,
      r1: Math.min(a.row, b.row),
      c1: Math.min(a.column, b.column),
      r2: Math.max(a.row, b.row),
      c2: Math.max(a.column, b.column),
    },
  };
}

/**
 * Whole columns (`A:C`, `$A:$A`, `Sheet2!B:D`) or rows (`1:3`, `'My Sheet'!2:2`).
 */
export function wholeRange(kind, image) {
  const [sheetName, body] = splitSheet(image);
  const [first, second] = body.split(":");
  const startAbsolute = first[0] === "$";
  const endAbsolute = second[0] === "$";
  const toIndex =
    kind === "columns"
      ? (label) => columnLabelToIndex(label.replace("$", ""))
      : (label) => parseInt(label.replace("$", ""), 10) - 1;
  const max = kind === "columns" ? MAX_COLUMN_INDEX : MAX_ROW_INDEX;
  let start = toIndex(first);
  let end = toIndex(second);

  if (start < 0 || end < 0 || start > max || end > max) {
    return { type: "refError" };
  }
  let absStart = startAbsolute;
  let absEnd = endAbsolute;

  if (start > end) {
    [start, end] = [end, start];
    [absStart, absEnd] = [absEnd, absStart];
  }
  const rect =
    kind === "columns"
      ? { sheetName, r1: 0, c1: start, r2: MAX_ROW_INDEX, c2: end }
      : { sheetName, r1: start, c1: 0, r2: end, c2: MAX_COLUMN_INDEX };

  return {
    type: "wholeRange",
    kind,
    sheetName,
    start,
    end,
    startAbsolute: absStart,
    endAbsolute: absEnd,
    rect,
  };
}

// Array constant elements are plain values.
export function arrayNumber(sign, image, isPercent) {
  let value = Number(image);

  if (isPercent) {
    value /= 100;
  }

  return sign === "-" ? -value : value;
}

export function arrayError(image) {
  if (!isValidError(image)) {
    throw syntaxError(`unknown error literal ${image}`);
  }

  return toErrorValue(image);
}

export function arrayLogical(image) {
  const upper = image.toUpperCase();

  if (upper === "TRUE") {
    return true;
  }
  if (upper === "FALSE") {
    return false;
  }
  throw syntaxError(`invalid array constant element ${image}`);
}

export function arrayConstant(rows) {
  const width = rows[0].length;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== width) {
      throw syntaxError("array constant rows must have the same length");
    }
  }

  return { type: "array", rows };
}

const REFERENCE_TYPES = new Set(["cell", "range", "wholeRange"]);

/**
 * @param {Object} node
 * @returns {Boolean} Whether the node is a static reference.
 */
export function isReferenceNode(node) {
  return REFERENCE_TYPES.has(node.type);
}
