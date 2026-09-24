/**
 * Formula tokens (Chevrotain).
 *
 * Token order matters: Chevrotain picks the first pattern that matches, so
 * function names come before cell references (`LOG10(`), references before
 * strings (`'My Sheet'!A1` vs `'text'`) and numbers (`1:3`).
 */
import { createToken, createTokenInstance, Lexer } from "chevrotain";

const nameStart = "A-Za-z_\\\\À-ʯ";
const nameChar = "A-Za-z0-9_.À-ʯ";
const simpleSheetName = "[A-Za-z0-9_À-ʯ]+";
const quotedSheetName = "'(?:[^']|'')*'";
export const SHEET_PREFIX = `(?:(?:${simpleSheetName}|${quotedSheetName})!)?`;

// A reference must not be the prefix of a longer identifier (`ABC1x`, `A1_b`).
const END_OF_REF = `(?![${nameChar}(!])`;
const COL = "[A-Za-z]{1,3}";
const ROW = "[0-9]{1,7}";

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const FunctionName = createToken({
  name: "FunctionName",
  pattern: new RegExp(`[${nameStart}][${nameChar}]*(?=\\()`),
});

export const ColumnRange = createToken({
  name: "ColumnRange",
  pattern: new RegExp(`${SHEET_PREFIX}\\$?${COL}:\\$?${COL}${END_OF_REF}`),
});

export const RowRange = createToken({
  name: "RowRange",
  pattern: new RegExp(
    `${SHEET_PREFIX}\\$?${ROW}:\\$?${ROW}(?![${nameChar}(!:])`
  ),
});

export const CellReference = createToken({
  name: "CellReference",
  pattern: Lexer.NA,
});

export const AbsoluteCell = createToken({
  name: "AbsoluteCell",
  pattern: new RegExp(`${SHEET_PREFIX}\\$${COL}\\$${ROW}${END_OF_REF}`),
  categories: [CellReference],
});

export const MixedCell = createToken({
  name: "MixedCell",
  pattern: new RegExp(
    `${SHEET_PREFIX}(?:\\$${COL}${ROW}|${COL}\\$${ROW})${END_OF_REF}`
  ),
  categories: [CellReference],
});

export const RelativeCell = createToken({
  name: "RelativeCell",
  pattern: new RegExp(`${SHEET_PREFIX}${COL}${ROW}${END_OF_REF}`),
  categories: [CellReference],
});

// Excel strings double quotes to escape them ("say ""hi"""). Single-quoted
// strings are a legacy extension of this parser.
export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:""|[^"])*"|'(?:\\[']|[^'])*'/,
});

export const ErrorLiteral = createToken({
  name: "ErrorLiteral",
  pattern: /#[A-Z0-9/_]+[!?]?/,
});

// Legacy `SUM([1,2,3])` argument list.
export const ArrayLiteral = createToken({
  name: "ArrayLiteral",
  pattern: /\[[^\]]*]/,
});

export const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/,
});

export const CompareOperator = createToken({
  name: "CompareOperator",
  pattern: Lexer.NA,
});
export const AdditiveOperator = createToken({
  name: "AdditiveOperator",
  pattern: Lexer.NA,
});
export const MultiplicativeOperator = createToken({
  name: "MultiplicativeOperator",
  pattern: Lexer.NA,
});

export const OpNe = createToken({
  name: "OpNe",
  pattern: /<>/,
  categories: [CompareOperator],
});
export const OpLe = createToken({
  name: "OpLe",
  pattern: /<=/,
  categories: [CompareOperator],
});
export const OpGe = createToken({
  name: "OpGe",
  pattern: />=/,
  categories: [CompareOperator],
});
export const OpEq = createToken({
  name: "OpEq",
  pattern: /=/,
  categories: [CompareOperator],
});
export const OpLt = createToken({
  name: "OpLt",
  pattern: /</,
  categories: [CompareOperator],
});
export const OpGt = createToken({
  name: "OpGt",
  pattern: />/,
  categories: [CompareOperator],
});
export const OpPlus = createToken({
  name: "OpPlus",
  pattern: /\+/,
  categories: [AdditiveOperator],
});
export const OpMinus = createToken({
  name: "OpMinus",
  pattern: /-/,
  categories: [AdditiveOperator],
});
export const OpMul = createToken({
  name: "OpMul",
  pattern: /\*/,
  categories: [MultiplicativeOperator],
});
export const OpDiv = createToken({
  name: "OpDiv",
  pattern: /\//,
  categories: [MultiplicativeOperator],
});
export const OpPow = createToken({ name: "OpPow", pattern: /\^/ });
export const OpConcat = createToken({ name: "OpConcat", pattern: /&/ });
export const OpPercent = createToken({ name: "OpPercent", pattern: /%/ });
export const At = createToken({ name: "At", pattern: /@/ });
export const LParen = createToken({ name: "LParen", pattern: /\(/ });
export const RParen = createToken({ name: "RParen", pattern: /\)/ });
export const LCurly = createToken({ name: "LCurly", pattern: /\{/ });
export const RCurly = createToken({ name: "RCurly", pattern: /\}/ });
export const Colon = createToken({ name: "Colon", pattern: /:/ });
export const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
export const Comma = createToken({ name: "Comma", pattern: /,/ });

export const Variable = createToken({
  name: "Variable",
  pattern: new RegExp(`[${nameStart}][${nameChar}]*`),
});

// Range intersection (a space between two references); never produced by
// the lexer itself, inserted by `tokenize` below.
export const Intersect = createToken({
  name: "Intersect",
  pattern: Lexer.NA,
});

export const allTokens = [
  WhiteSpace,
  FunctionName,
  ColumnRange,
  RowRange,
  AbsoluteCell,
  MixedCell,
  RelativeCell,
  StringLiteral,
  ErrorLiteral,
  ArrayLiteral,
  NumberLiteral,
  OpNe,
  OpLe,
  OpGe,
  OpEq,
  OpLt,
  OpGt,
  OpPlus,
  OpMinus,
  OpMul,
  OpDiv,
  OpPow,
  OpConcat,
  OpPercent,
  At,
  LParen,
  RParen,
  LCurly,
  RCurly,
  Colon,
  Semicolon,
  Comma,
  Variable,
  Intersect,
  CellReference,
  CompareOperator,
  AdditiveOperator,
  MultiplicativeOperator,
];

const FormulaLexer = new Lexer(allTokens, {
  positionTracking: "onlyOffset",
  ensureOptimizations: false,
});

const REFERENCE_END = new Set([
  AbsoluteCell,
  MixedCell,
  RelativeCell,
  ColumnRange,
  RowRange,
  RParen,
]);
const REFERENCE_START = new Set([
  AbsoluteCell,
  MixedCell,
  RelativeCell,
  ColumnRange,
  RowRange,
  LParen,
  FunctionName,
]);

/**
 * Tokenize a formula. Whitespace between two reference-like tokens becomes
 * an `Intersect` token (`A1:C3 B2:D4`).
 *
 * @param {String} input
 * @returns {Array} Chevrotain tokens.
 */
export function tokenize(input) {
  const result = FormulaLexer.tokenize(input);

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message || "Lexer error");
  }
  const tokens = result.tokens;
  let output = null;

  for (let i = 1; i < tokens.length; i++) {
    const prev = tokens[i - 1];
    const next = tokens[i];

    const prevEnd = prev.startOffset + prev.image.length;

    if (
      next.startOffset > prevEnd &&
      REFERENCE_END.has(prev.tokenType) &&
      REFERENCE_START.has(next.tokenType)
    ) {
      if (!output) {
        output = tokens.slice(0, i);
      }
      output.push(
        createTokenInstance(
          Intersect,
          " ",
          prevEnd,
          next.startOffset - 1,
          NaN,
          NaN,
          NaN,
          NaN
        )
      );
    }
    if (output) {
      output.push(next);
    }
  }

  return output || tokens;
}
