import Emitter from "tiny-emitter";
import evaluateByOperator from "./evaluate-by-operator/evaluate-by-operator";
import {
  Parser as GrammarParser,
  parseToAst,
} from "./grammar-parser/grammar-parser";
import { collectReferences } from "./grammar-parser/references";
import { isLambda } from "./functions/lambda";
import { isReference } from "./helper/reference";
import { trimEdges } from "./helper/string";
import { toNumber, invertNumber } from "./helper/number";
import errorParser, {
  isValidStrict as isErrorValid,
  ERROR,
  ERROR_CALC,
  ERROR_NAME,
  ERROR_VALUE,
} from "./error";
import {
  extractLabel,
  toLabel,
  columnIndexToLabel,
  rowIndexToLabel,
} from "./helper/cell";

/**
 * @class Parser
 */
class Parser extends Emitter {
  constructor() {
    super();
    this.parser = new GrammarParser();
    this.parser.yy = {
      toNumber,
      trimEdges,
      invertNumber,
      throwError: (errorName) => this._throwError(errorName),
      callVariable: (variable) => this._callVariable(variable),
      evaluateByOperator,
      callFunction: (name, params, refs) =>
        this._callFunction(name, params, refs),
      cellValue: (value) => this._callCellValue(value),
      rangeValue: (start, end) => this._callRangeValue(start, end),
      wholeRangeValue: (kind, sheetName, start, startAbs, end, endAbs) =>
        this._callWholeRangeValue(
          kind,
          sheetName,
          start,
          startAbs,
          end,
          endAbs
        ),
      hasFunction: (name) => this.getFunction(name) !== void 0,
      getFunction: (name) => this.getFunction(name),
      resolveReference: (value) => this._resolveReference(value),
      getLambdaVariable: (name) => this._getLambdaVariable(name),
      getOptions: () => this.options,
    };
    this.variables = Object.create(null);
    this.functions = Object.create(null);
    this.options = Object.create(null);

    this.setVariable("TRUE", true)
      .setVariable("FALSE", false)
      .setVariable("NULL", null);
  }

  /**
   * Parse formula expression.
   *
   * @param {string} expression to parse.
   * @param {object} options additional params.
   * @param {string} options.sheetId id of sheet which the formula expression belongs to.
   * @return {*} Returns an object with tow properties `error` and `result`.
   */
  parse(expression, options) {
    let result = null;
    let error = null;
    this.options = options;

    try {
      if (expression === "") {
        result = "";
      } else {
        result = this.parser.parse(expression);
      }
    } catch (ex) {
      const message = errorParser(ex.message);

      if (message) {
        error = message;
      } else {
        error = errorParser(ERROR);
      }
    }

    if (result instanceof Error) {
      error = errorParser(result.message) || errorParser(ERROR);
      result = null;
    } else if (isLambda(result)) {
      // A LAMBDA that is never called cannot be a cell value.
      error = errorParser(ERROR_CALC);
      result = null;
    }

    return {
      error,
      result,
    };
  }

  /**
   * Set predefined variable name which can be visible while parsing formula expression.
   *
   * @param {String} name Variable name.
   * @param {*} value Variable value.
   * @returns {Parser}
   */
  setVariable(name, value) {
    this.variables[name] = value;

    return this;
  }

  /**
   * Get variable name.
   *
   * @param {String} name Variable name.
   * @returns {*}
   */
  getVariable(name) {
    return this.variables[name];
  }

  /**
   * Retrieve variable value by its name.
   *
   * @param name Variable name.
   * @returns {*}
   * @private
   */
  _callVariable(name) {
    let value = this.getVariable(name);

    this.emit("callVariable", name, (newValue) => {
      if (newValue !== void 0) {
        value = newValue;
      }
    });

    if (value === void 0) {
      throw Error(ERROR_NAME);
    }

    return value;
  }

  /**
   * LAMBDA stored as a variable (e.g. a named function), callable as `NAME(...)`.
   *
   * @param {String} name
   * @returns {Function|undefined}
   * @private
   */
  _getLambdaVariable(name) {
    let value = this.variables[name];

    if (value === void 0) {
      value = this.variables[name.toUpperCase()];
    }

    return isLambda(value) ? value : void 0;
  }

  /**
   * Parse a formula into its (cached) AST without evaluating it.
   * Throws on syntax errors.
   *
   * @param {String} expression Formula without the leading "=".
   * @returns {Object}
   */
  getAst(expression) {
    return parseToAst(expression);
  }

  /**
   * List the cell/range references of a formula (without evaluating it).
   * LET/LAMBDA names that shadow cell-like names are excluded.
   * Indexes are 0-based; -1 marks a whole-row/column span.
   *
   * @param {String} expression Formula without the leading "=".
   * @returns {Array<{sheetName: string|null, startRow: number, startColumn: number, endRow: number, endColumn: number}>}
   */
  getReferences(expression) {
    return collectReferences(parseToAst(expression));
  }

  /**
   * Set custom function which can be visible while parsing formula expression.
   *
   * @param {String} name Custom function name.
   * @param {Function} fn Custom function.
   * @returns {Parser}
   */
  setFunction(name, fn) {
    this.functions[name] = fn;

    return this;
  }

  /**
   * Get custom function.
   *
   * @param {String} name Custom function name.
   * @returns {*}
   */
  getFunction(name) {
    const fn = this.functions[name];

    // Function names are case-insensitive: `=text(...)` finds `TEXT`.
    return fn === void 0 && typeof name === "string"
      ? this.functions[name.toUpperCase()]
      : fn;
  }

  /**
   * Call function with provided params.
   *
   * Custom functions and `callFunction` listeners receive, after the usual
   * arguments, `refs`: one entry per param, `null` or the reference the
   * argument was written as ({sheetName, startRow, startColumn, endRow,
   * endColumn}, 0-based, -1 = whole row/column).
   *
   * @param name Function name.
   * @param params Function params.
   * @param refs Reference descriptors of the params.
   * @returns {*}
   * @private
   */
  _callFunction(name, params = [], refs = []) {
    const fn = this.getFunction(name);
    let value;

    if (fn) {
      value = fn(params, refs);
    }

    this.emit(
      "callFunction",
      name,
      params,
      (newValue) => {
        if (newValue !== void 0) {
          value = newValue;
        }
      },
      refs
    );

    return value === void 0 ? evaluateByOperator(name, params) : value;
  }

  /**
   * Resolve a host value (e.g. a reference marker string returned by a
   * host function or variable) to a reference descriptor, through the
   * `resolveReference` event: `(value, options, done(descriptor))`.
   * Values made with `createReference` need no listener.
   *
   * @param {*} value
   * @returns {Object|null} {sheetName, startRow, startColumn, endRow,
   *   endColumn} or null when the value is not a reference.
   * @private
   */
  _resolveReference(value) {
    if (isReference(value)) {
      return value;
    }
    let info = null;

    this.emit("resolveReference", value, this.options, (descriptor) => {
      if (descriptor) {
        info = descriptor;
      }
    });

    return info;
  }

  /**
   * Retrieve value by its label (`B3`, `B$3`, `B$3`, `$B$3`).
   *
   * @param {String} label Coordinates.
   * @returns {*}
   * @private
   */
  _callCellValue(label) {
    const [row, column, sheetName] = extractLabel(label);
    if (column?.index === -1) {
      if (row.isAbsolute || column.isAbsolute) {
        throw Error(ERROR_NAME);
      }
      return row.index + 1;
    } else if (row?.index === -1) {
      throw Error(ERROR_NAME);
    }
    let value = void 0;
    const normalizedLabel = toLabel(row, column);

    this.emit(
      "callCellValue",
      { label: normalizedLabel, row, column, sheetName },
      this.options,
      (_value) => {
        value = _value;
      }
    );

    return value;
  }

  /**
   * Retrieve value by its label (`B3:A1`, `B$3:A1`, `B$3:$A1`, `$B$3:A$1`).
   *
   * @param {String} startLabel Coordinates of the first cell.
   * @param {String} endLabel Coordinates of the last cell.
   * @returns {Array} Returns an array of mixed values.
   * @private
   */
  _callRangeValue(startLabel, endLabel) {
    const [startRow, startColumn, startSheetName] = extractLabel(startLabel);
    const [endRow, endColumn, endSheetName] = extractLabel(endLabel);
    // oxlint-disable-next-line eqeqeq -- null and undefined sheet names are equal
    if (endSheetName != null && startSheetName != endSheetName) {
      throw Error(ERROR_VALUE);
    }
    const startCell = {};
    const endCell = {};
    startCell.sheetName = startSheetName;

    if (startRow.index <= endRow.index) {
      startCell.row = startRow;
      endCell.row = endRow;
    } else {
      startCell.row = endRow;
      endCell.row = startRow;
    }

    if (startColumn.index <= endColumn.index) {
      startCell.column = startColumn;
      endCell.column = endColumn;
    } else {
      startCell.column = endColumn;
      endCell.column = startColumn;
    }

    return this._emitRangeValue(startCell, endCell);
  }

  /**
   * Retrieve whole columns (`A:C`) or rows (`2:5`). Emitted through
   * `callRangeValue` with row (columns) or column (rows) indexes set to -1.
   *
   * @param {String} kind "columns" or "rows".
   * @param {String|null} sheetName Sheet name or null for the current sheet.
   * @param {Number} start First column/row index (0-based).
   * @param {Boolean} startAbsolute
   * @param {Number} end Last column/row index (0-based).
   * @param {Boolean} endAbsolute
   * @returns {Array}
   * @private
   */
  _callWholeRangeValue(
    kind,
    sheetName,
    start,
    startAbsolute,
    end,
    endAbsolute
  ) {
    const whole = (isAbsolute = false) => ({
      index: -1,
      label: "",
      isAbsolute,
    });
    const coord = (index, isAbsolute) => ({
      index,
      label:
        kind === "columns" ? columnIndexToLabel(index) : rowIndexToLabel(index),
      isAbsolute,
    });
    const startCell = { sheetName };
    const endCell = {};

    if (kind === "columns") {
      startCell.row = whole();
      endCell.row = whole();
      startCell.column = coord(start, startAbsolute);
      endCell.column = coord(end, endAbsolute);
    } else {
      startCell.row = coord(start, startAbsolute);
      endCell.row = coord(end, endAbsolute);
      startCell.column = whole();
      endCell.column = whole();
    }

    return this._emitRangeValue(startCell, endCell);
  }

  /**
   * @param {Object} startCell Top-left coordinates.
   * @param {Object} endCell Bottom-right coordinates.
   * @returns {Array}
   * @private
   */
  _emitRangeValue(startCell, endCell) {
    startCell.label = toLabel(startCell.row, startCell.column);
    endCell.label = toLabel(endCell.row, endCell.column);

    let value = [];

    this.emit(
      "callRangeValue",
      startCell,
      endCell,
      this.options,
      (_value = []) => {
        value = _value;
      }
    );

    return value;
  }

  /**
   * Try to throw error by its name.
   *
   * @param {String} errorName Error name.
   * @returns {String}
   * @private
   */
  _throwError(errorName) {
    if (isErrorValid(errorName)) {
      throw Error(errorName);
    }

    throw Error(ERROR);
  }
}

export default Parser;
