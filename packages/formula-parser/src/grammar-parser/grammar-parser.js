/**
 * Formula grammar: Chevrotain parser producing an AST, evaluated by
 * ./evaluator.js through the `yy` hooks.
 *
 * Operator precedence (lowest → highest), matching Excel:
 *   comparison (= <> < > <= >=) → & → + - → * / → ^ → % (postfix)
 *   → unary - + → call suffix `f(...)(...)` → intersection (space)
 *   → reference / literal / (expression)
 *
 * so `-2^2` = 4, `1+2&3` = "33" and `2^3^2` = 64 (left associative).
 *
 * Parsed ASTs are cached per formula string (LRU), so recalculating the same
 * formula does not lex or parse again.
 */
import { EmbeddedActionsParser } from "chevrotain";
import {
  allTokens,
  tokenize,
  At,
  ArrayLiteral,
  AdditiveOperator,
  CellReference,
  Colon,
  ColumnRange,
  Comma,
  CompareOperator,
  ErrorLiteral,
  FunctionName,
  Intersect,
  LCurly,
  LParen,
  MultiplicativeOperator,
  NumberLiteral,
  OpConcat,
  OpPercent,
  OpPow,
  RCurly,
  RParen,
  RowRange,
  Semicolon,
  StringLiteral,
  Variable,
} from "./lexer";
import * as ast from "./ast";
import Evaluator from "./evaluator";
import LruCache from "./lru-cache";

class FormulaParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens, { maxLookahead: 2 });
    const $ = this;

    $.RULE("expression", () => $.SUBRULE($.comparison));

    $.RULE("comparison", () => {
      let left = $.SUBRULE($.concat);

      $.MANY(() => {
        const op = $.CONSUME(CompareOperator);
        const right = $.SUBRULE2($.concat);

        left = $.ACTION(() => ast.binary(op.image, left, right));
      });

      return left;
    });

    $.RULE("concat", () => {
      let left = $.SUBRULE($.additive);

      $.MANY(() => {
        $.CONSUME(OpConcat);
        const right = $.SUBRULE2($.additive);

        left = $.ACTION(() => ast.binary("&", left, right));
      });

      return left;
    });

    $.RULE("additive", () => {
      let left = $.SUBRULE($.multiplicative);

      $.MANY(() => {
        const op = $.CONSUME(AdditiveOperator);
        const right = $.SUBRULE2($.multiplicative);

        left = $.ACTION(() => ast.binary(op.image, left, right));
      });

      return left;
    });

    $.RULE("multiplicative", () => {
      let left = $.SUBRULE($.power);

      $.MANY(() => {
        const op = $.CONSUME(MultiplicativeOperator);
        const right = $.SUBRULE2($.power);

        left = $.ACTION(() => ast.binary(op.image, left, right));
      });

      return left;
    });

    $.RULE("power", () => {
      let left = $.SUBRULE($.percent);

      $.MANY(() => {
        $.CONSUME(OpPow);
        const right = $.SUBRULE2($.percent);

        left = $.ACTION(() => ast.binary("^", left, right));
      });

      return left;
    });

    $.RULE("percent", () => {
      let value = $.SUBRULE($.unary);

      $.MANY(() => {
        $.CONSUME(OpPercent);
        value = $.ACTION(() => ast.percent(value));
      });

      return value;
    });

    $.RULE("unary", () =>
      $.OR([
        {
          ALT: () => {
            const op = $.CONSUME(AdditiveOperator);
            const value = $.SUBRULE($.unary);

            return $.ACTION(() => ast.unary(op.image, value));
          },
        },
        { ALT: () => $.SUBRULE($.intersection) },
      ])
    );

    $.RULE("intersection", () => {
      let left = $.SUBRULE($.postfix);

      $.MANY(() => {
        $.CONSUME(Intersect);
        const right = $.SUBRULE2($.postfix);

        left = $.ACTION(() => ast.intersect(left, right));
      });

      return left;
    });

    $.RULE("postfix", () => {
      let value = $.SUBRULE($.primary);

      $.MANY(() => {
        $.CONSUME(LParen);
        const args = $.SUBRULE($.args);

        $.CONSUME(RParen);
        value = $.ACTION(() => ast.invoke(value, args));
      });

      return value;
    });

    $.RULE("primary", () =>
      $.OR([
        {
          ALT: () => {
            const tok = $.CONSUME(NumberLiteral);

            return $.ACTION(() => ast.number(tok.image));
          },
        },
        {
          ALT: () => {
            const tok = $.CONSUME(StringLiteral);

            return $.ACTION(() => ast.string(tok.image));
          },
        },
        { ALT: () => $.SUBRULE($.reference) },
        { ALT: () => $.SUBRULE($.functionCall) },
        {
          ALT: () => {
            const tok = $.CONSUME(Variable);

            return $.ACTION(() => ast.name(tok.image));
          },
        },
        {
          ALT: () => {
            $.CONSUME(LParen);
            const value = $.SUBRULE($.expression);

            $.CONSUME(RParen);

            return value;
          },
        },
        { ALT: () => $.SUBRULE($.arrayConstant) },
        {
          ALT: () => {
            const tok = $.CONSUME(ArrayLiteral);

            return $.ACTION(() => ast.legacyArray(tok.image));
          },
        },
        {
          ALT: () => {
            $.CONSUME(At);
            const value = $.SUBRULE($.primary);

            return $.ACTION(() => ast.implicitIntersection(value));
          },
        },
        { ALT: () => $.SUBRULE($.error) },
      ])
    );

    $.RULE("reference", () =>
      $.OR([
        {
          ALT: () => {
            const start = $.CONSUME(CellReference);
            const end = $.OPTION(() => {
              $.CONSUME(Colon);

              return $.CONSUME2(CellReference);
            });

            return $.ACTION(() =>
              end ? ast.range(start.image, end.image) : ast.cell(start.image)
            );
          },
        },
        {
          ALT: () => {
            const tok = $.CONSUME(ColumnRange);

            return $.ACTION(() => ast.wholeRange("columns", tok.image));
          },
        },
        {
          ALT: () => {
            const tok = $.CONSUME(RowRange);

            return $.ACTION(() => ast.wholeRange("rows", tok.image));
          },
        },
      ])
    );

    $.RULE("functionCall", () => {
      const tok = $.CONSUME(FunctionName);

      $.CONSUME(LParen);
      const args = $.SUBRULE($.args);

      $.CONSUME(RParen);

      return $.ACTION(() => ast.call(tok.image, args));
    });

    // Comma or semicolon separated, possibly empty arguments: f(), f(1,,3).
    $.RULE("args", () => {
      const args = [];
      let current = $.OPTION(() => $.SUBRULE($.expression));

      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Comma) },
          { ALT: () => $.CONSUME(Semicolon) },
        ]);
        args.push(current);
        current = $.OPTION2(() => $.SUBRULE2($.expression));
      });

      return $.ACTION(() => {
        args.push(current);

        if (args.length === 1 && args[0] === void 0) {
          return [];
        }

        return args.map((arg) => (arg === void 0 ? ast.MISSING : arg));
      });
    });

    // {1,2;3,4}: commas separate columns, semicolons separate rows.
    $.RULE("arrayConstant", () => {
      $.CONSUME(LCurly);
      const rows = [[]];

      rows[0].push($.SUBRULE($.arrayElement));
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Comma) },
          {
            ALT: () => {
              $.CONSUME(Semicolon);
              rows.push([]);
            },
          },
        ]);
        rows[rows.length - 1].push($.SUBRULE2($.arrayElement));
      });
      $.CONSUME(RCurly);

      return $.ACTION(() => ast.arrayConstant(rows));
    });

    $.RULE("arrayElement", () =>
      $.OR([
        {
          ALT: () => {
            const sign = $.OPTION(() => $.CONSUME(AdditiveOperator));
            const tok = $.CONSUME(NumberLiteral);
            const pct = $.OPTION2(() => $.CONSUME(OpPercent));

            return $.ACTION(() =>
              ast.arrayNumber(sign ? sign.image : "", tok.image, !!pct)
            );
          },
        },
        {
          ALT: () => {
            const tok = $.CONSUME(StringLiteral);

            return $.ACTION(() => ast.stringValue(tok.image));
          },
        },
        {
          ALT: () => {
            const tok = $.CONSUME(ErrorLiteral);

            return $.ACTION(() => ast.arrayError(tok.image));
          },
        },
        {
          ALT: () => {
            const tok = $.CONSUME(Variable);

            return $.ACTION(() => ast.arrayLogical(tok.image));
          },
        },
      ])
    );

    $.RULE("error", () => {
      const tok = $.CONSUME(ErrorLiteral);

      $.OPTION(() => $.CONSUME2(ErrorLiteral));

      return $.ACTION(() => ast.error(tok.image));
    });

    this.performSelfAnalysis();
  }
}

let sharedParser = null;

function getSharedParser() {
  if (!sharedParser) {
    sharedParser = new FormulaParser();
  }

  return sharedParser;
}

const AST_CACHE_SIZE = 2000;
const astCache = new LruCache(AST_CACHE_SIZE);

/**
 * Parse a formula into an AST (cached). Throws on syntax errors.
 *
 * @param {String} input Formula without the leading "=".
 * @returns {Object} AST root node.
 */
export function parseToAst(input) {
  const cached = astCache.get(input);

  if (cached !== void 0) {
    if (cached instanceof Error) {
      throw cached;
    }

    return cached;
  }
  let result;

  try {
    const parser = getSharedParser();

    parser.input = tokenize(input);
    result = parser.expression();

    if (parser.errors.length > 0) {
      throw new Error(parser.errors[0].message || "Parser error");
    }
  } catch (ex) {
    result = ex instanceof Error ? ex : new Error(String(ex));
  }
  astCache.set(input, result);

  if (result instanceof Error) {
    throw result;
  }

  return result;
}

/**
 * Clear the shared AST cache.
 */
export function clearAstCache() {
  astCache.clear();
}

/**
 * Drop-in replacement for the old jison GrammarParser.
 * Exposes `.yy` hooks and `.parse(input)`.
 */
export function Parser() {
  this.yy = {};
  this.evaluator = new Evaluator(this);
}

Parser.prototype.parse = function parse(input) {
  if (typeof input !== "string") {
    throw new Error("Parser error");
  }

  return this.evaluator.evaluateRoot(parseToAst(input));
};

Parser.prototype.parseToAst = function parseAst(input) {
  if (typeof input !== "string") {
    throw new Error("Parser error");
  }

  return parseToAst(input);
};

Parser.prototype.Parser = Parser;
