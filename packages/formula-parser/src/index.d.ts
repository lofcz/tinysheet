export const ERROR: "ERROR";
export const ERROR_DIV_ZERO: "DIV/0";
export const ERROR_NAME: "NAME";
export const ERROR_NOT_AVAILABLE: "N/A";
export const ERROR_NULL: "NULL";
export const ERROR_NUM: "NUM";
export const ERROR_REF: "REF";
export const ERROR_VALUE: "VALUE";
export const ERROR_SPILL: "SPILL";
export const ERROR_CALC: "CALC";

export const SUPPORTED_FORMULAS: string[];

export function error(type: string): string | null;

export type CellCoord = {
  index: number;
  label: string;
  isAbsolute: boolean;
};

export function extractLabel(
  label: string
): [CellCoord, CellCoord, string | null] | [];
export function toLabel(
  row: { index: number; isAbsolute?: boolean },
  column: { index: number; isAbsolute?: boolean }
): string;
export function columnIndexToLabel(column: number): string;
export function columnLabelToIndex(label: string): number;
export function rowIndexToLabel(row: number): string;
export function rowLabelToIndex(label: string): number;

export type ParseResult = {
  error: string | null;
  result: unknown;
};

/**
 * Options passed to `Parser#parse` and forwarded to the cell/range events.
 * `row`/`column` (0-based) of the formula cell enable `@` implicit
 * intersection over multi-cell references.
 */
export type ParseOptions = {
  sheetId?: string;
  row?: number;
  column?: number;
  [key: string]: unknown;
};

/**
 * A reference written in a formula: 0-based inclusive indexes, `-1` marks a
 * whole-column (`startRow`/`endRow`) or whole-row (`startColumn`/`endColumn`)
 * span. Passed to custom functions and `callFunction` listeners as `refs`,
 * and returned by `Parser#getReferences`.
 */
export type ReferenceInfo = {
  sheetName: string | null;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
};

/**
 * A LAMBDA value: call it with the arguments; formula errors are thrown as
 * `Error` values. Missing trailing arguments are "omitted" (ISOMITTED).
 */
export type LambdaValue = ((...args: unknown[]) => unknown) & {
  readonly params: string[];
};

export function isLambda(value: unknown): value is LambdaValue;

/** A reference descriptor made by `createReference`. */
export type ReferenceValue = Readonly<ReferenceInfo>;

/**
 * Make a reference a host function (`callFunction` listener, `setFunction`)
 * or variable can return instead of values: the evaluator then uses it as a
 * reference (range operand `MYREF():C5`, `ROWS(MYREF())`, INDEX/CELL/SUM
 * arguments with `refs`) and reads it through callCellValue/callRangeValue
 * where a value is needed. `endRow`/`endColumn` default to the start.
 */
export function createReference(info: {
  sheetName?: string | null;
  startRow: number;
  startColumn: number;
  endRow?: number;
  endColumn?: number;
}): ReferenceValue;

export function isReference(value: unknown): value is ReferenceValue;

/**
 * A picture value (IMAGE(), a cell holding a picture). `sizing`: 0 fit
 * keeping the aspect ratio, 1 fill, 2 original size, 3 custom `h` x `w`
 * pixels. Its text form (`String(value)`) is the alt text.
 */
export type ImageValue = {
  readonly type: "image";
  src: string;
  alt: string;
  sizing: 0 | 1 | 2 | 3;
  h?: number;
  w?: number;
};

export function isImageValue(value: unknown): value is ImageValue;
export function createImageValue(props: {
  src: string;
  alt?: string;
  sizing?: number;
  h?: number;
  w?: number;
}): ImageValue;
export function imageValueText(value: ImageValue): string;
/** Only absolute http(s) URLs and data:image URLs may be loaded. */
export function isAllowedImageSource(src: unknown): boolean;

/**
 * A function registered with `Parser#setFunction`.
 *
 * `arrayParams` opts into Excel's array lifting: `true` means every
 * parameter accepts arrays (never lifted), an index list names the
 * parameters that accept arrays; any other parameter receiving an array
 * makes the evaluator call the function once per element and return an
 * array of the results. Without it a custom function whose name is not an
 * Excel function receives arrays unchanged; one overriding an Excel
 * function (e.g. TEXT) follows that function's traits.
 */
export type CustomFunction = ((
  params: unknown[],
  refs: Array<ReferenceInfo | null>
) => unknown) & {
  arrayParams?: boolean | number[] | ((index: number) => boolean);
  /**
   * Parameters that take a reference: a reference argument there is passed
   * unread, as a `createReference` descriptor (`isReference(params[i])`),
   * so no cell is read and errors in the referenced cells do not abort the
   * call. Other arguments arrive as values. `true` means every parameter.
   */
  referenceParams?: boolean | number[] | ((index: number) => boolean);
  /**
   * The function may return `createReference` values: calls to it are then
   * reference-capable (range operands, `ROWS(...)`, `INDEX(...)`, ...).
   */
  returnsReference?: boolean;
};

export declare class Parser {
  constructor();
  parse(expression: string, options?: ParseOptions): ParseResult;
  /** Parse to the cached AST without evaluating; throws on syntax errors. */
  getAst(expression: string): unknown;
  /** Cell/range references of a formula, in source order. */
  getReferences(expression: string): ReferenceInfo[];
  setVariable(name: string, value: unknown): this;
  getVariable(name: string): unknown;
  /**
   * Register a function (it takes precedence over built-ins and special
   * forms of the same name). `refs[i]` describes argument `i` when it was
   * written as (or evaluated to) a reference: `A1:A3`, `INDEX(...)`, one
   * area of a union `(A1,B2)` spread over several params, ...
   */
  setFunction(name: string, fn: CustomFunction): this;
  /** Registered function (names are matched case-insensitively). */
  getFunction(name: string): CustomFunction | undefined;
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener?: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): this;
}

export { Parser as default };

/** Old underscore-style names (e.g. RANK_EQ) mapped to their Excel names. */
export const LEGACY_FUNCTION_NAMES: Readonly<Record<string, string>>;

/**
 * Excel database criteria (D-functions, Advanced Filter): a predicate for
 * one criteria cell value, or null when the condition is empty. Text
 * without an operator matches values beginning with it, "=text" matches
 * exactly, wildcards and comparison operators work like COUNTIF.
 */
export function databaseCriterion(
  value: unknown
): ((candidate: unknown) => boolean) | null;
