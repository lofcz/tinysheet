/**
 * Host-created references.
 *
 * A host function (`callFunction` listener, `setFunction`) or variable can
 * return `createReference({...})` instead of values: the evaluator then
 * treats the result as a reference, so it can be a range operand
 * (`MYREF():C5`), an INDEX/ROWS/CELL argument or a reference argument of
 * another function, and it is read through `callCellValue` /
 * `callRangeValue` where a value is needed.
 *
 * Descriptor indexes are 0-based and inclusive; -1 marks a whole row
 * (`startColumn`/`endColumn`) or whole column (`startRow`/`endRow`) span,
 * as in the `refs` passed to functions.
 */
const REFERENCE_BRAND = Symbol.for("tinysheet.formula-parser.reference");

/**
 * @param {{sheetName?: string|null, startRow: number, startColumn: number,
 *   endRow?: number, endColumn?: number}} info
 * @returns {Object} A frozen, branded reference descriptor.
 */
export function createReference(info) {
  const startRow = Math.trunc(info.startRow);
  const startColumn = Math.trunc(info.startColumn);

  return Object.freeze({
    [REFERENCE_BRAND]: true,
    sheetName: info.sheetName == null ? null : info.sheetName,
    startRow,
    startColumn,
    endRow: info.endRow == null ? startRow : Math.trunc(info.endRow),
    endColumn:
      info.endColumn == null ? startColumn : Math.trunc(info.endColumn),
  });
}

/**
 * @param {*} value
 * @returns {Boolean} Whether the value was made by `createReference`.
 */
export function isReference(value) {
  return !!(value && typeof value === "object" && value[REFERENCE_BRAND]);
}
