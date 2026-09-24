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

export declare class Parser {
  constructor();
  parse(expression: string, options?: ParseOptions): ParseResult;
  /** Parse to the cached AST without evaluating; throws on syntax errors. */
  getAst(expression: string): unknown;
  /** Cell/range references of a formula, in source order. */
  getReferences(expression: string): ReferenceInfo[];
  setVariable(name: string, value: unknown): this;
  getVariable(name: string): unknown;
  setFunction(
    name: string,
    fn: (params: unknown[], refs: Array<ReferenceInfo | null>) => unknown
  ): this;
  getFunction(name: string): ((...args: unknown[]) => unknown) | undefined;
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener?: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): this;
}

export { Parser as default };
