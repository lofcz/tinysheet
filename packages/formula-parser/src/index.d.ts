export const ERROR: "ERROR";
export const ERROR_DIV_ZERO: "DIV/0";
export const ERROR_NAME: "NAME";
export const ERROR_NOT_AVAILABLE: "N/A";
export const ERROR_NULL: "NULL";
export const ERROR_NUM: "NUM";
export const ERROR_REF: "REF";
export const ERROR_VALUE: "VALUE";

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

export declare class Parser {
  constructor();
  parse(expression: string, options?: Record<string, unknown>): ParseResult;
  setVariable(name: string, value: unknown): this;
  getVariable(name: string): unknown;
  setFunction(name: string, fn: (...args: unknown[]) => unknown): this;
  getFunction(name: string): ((...args: unknown[]) => unknown) | undefined;
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener?: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): this;
}

export { Parser as default };
