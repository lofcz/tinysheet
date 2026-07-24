import { createToken, Lexer, EmbeddedActionsParser } from "chevrotain";

const simpleSheetName = "[A-Za-z0-9_\u00C0-\u02AF]+";
const quotedSheetName = "'(?:(?!').|'')*'";
const sheetNameRegexp = `(?:${simpleSheetName}|${quotedSheetName})!`;

const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:\\["]|[^"])*"|'(?:\\[']|[^'])*'/,
});

const ErrorLiteral = createToken({
  name: "ErrorLiteral",
  pattern: /#[A-Z0-9/]+[!?]?/,
});

const FunctionName = createToken({
  name: "FunctionName",
  pattern: /[A-Za-z][A-Za-z0-9_.]*(?=\()/,
});

const AbsoluteCell = createToken({
  name: "AbsoluteCell",
  pattern: new RegExp(`(?:${sheetNameRegexp})?\\$[A-Za-z]+\\$[0-9]+`),
});

const MixedCell = createToken({
  name: "MixedCell",
  pattern: new RegExp(
    `(?:${sheetNameRegexp})?(?:\\$[A-Za-z]+[0-9]+|[A-Za-z]+\\$[0-9]+)`
  ),
});

const RelativeCell = createToken({
  name: "RelativeCell",
  pattern: new RegExp(`(?:${sheetNameRegexp})?[A-Za-z]+[0-9]+`),
});

const ArrayLiteral = createToken({
  name: "ArrayLiteral",
  pattern: /\[[^\]]*]/,
});

const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /(?:\d+\.?\d*|\.\d+)/,
});

const Variable = createToken({
  name: "Variable",
  pattern: /[A-Za-z_][A-Za-z0-9_.]*/,
});

const NotOp = createToken({
  name: "NotOp",
  pattern: /NOT/,
  longer_alt: Variable,
});

const OpNe = createToken({ name: "OpNe", pattern: /<>/ });
const OpLe = createToken({ name: "OpLe", pattern: /<=/ });
const OpGe = createToken({ name: "OpGe", pattern: />=/ });
const OpEq = createToken({ name: "OpEq", pattern: /=/ });
const OpLt = createToken({ name: "OpLt", pattern: /</ });
const OpGt = createToken({ name: "OpGt", pattern: />/ });
const OpPlus = createToken({ name: "OpPlus", pattern: /\+/ });
const OpMinus = createToken({ name: "OpMinus", pattern: /-/ });
const OpMul = createToken({ name: "OpMul", pattern: /\*/ });
const OpDiv = createToken({ name: "OpDiv", pattern: /\// });
const OpPow = createToken({ name: "OpPow", pattern: /\^/ });
const OpConcat = createToken({ name: "OpConcat", pattern: /&/ });
const OpPercent = createToken({ name: "OpPercent", pattern: /%/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const Colon = createToken({ name: "Colon", pattern: /:/ });
const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Dot = createToken({ name: "Dot", pattern: /\./ });

const allTokens = [
  WhiteSpace,
  StringLiteral,
  ErrorLiteral,
  FunctionName,
  AbsoluteCell,
  MixedCell,
  RelativeCell,
  ArrayLiteral,
  NumberLiteral,
  OpNe,
  OpLe,
  OpGe,
  NotOp,
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
  LParen,
  RParen,
  Colon,
  Semicolon,
  Comma,
  Dot,
  Variable,
];

const FormulaLexer = new Lexer(allTokens);

class FormulaParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens);
    const $ = this;

    // jison precedence (low → high): =, rel, +−, */, ^, &, unary
    $.RULE("expression", () => $.SUBRULE($.equality));

    $.RULE("equality", () => {
      let left = $.SUBRULE($.relational);
      $.MANY(() => {
        $.CONSUME(OpEq);
        const right = $.SUBRULE2($.relational);
        left = $.yy.evaluateByOperator("=", [left, right]);
      });
      return left;
    });

    $.RULE("relational", () => {
      let left = $.SUBRULE($.additive);
      $.MANY(() => {
        const op = $.OR([
          {
            ALT: () => {
              $.CONSUME(OpLe);
              return "<=";
            },
          },
          {
            ALT: () => {
              $.CONSUME(OpGe);
              return ">=";
            },
          },
          {
            ALT: () => {
              $.CONSUME(OpNe);
              return "<>";
            },
          },
          {
            ALT: () => {
              $.CONSUME(NotOp);
              return "NOT";
            },
          },
          {
            ALT: () => {
              $.CONSUME(OpLt);
              return "<";
            },
          },
          {
            ALT: () => {
              $.CONSUME(OpGt);
              return ">";
            },
          },
        ]);
        const right = $.SUBRULE2($.additive);
        left = $.yy.evaluateByOperator(op, [left, right]);
      });
      return left;
    });

    $.RULE("additive", () => {
      let left = $.SUBRULE($.multiplicative);
      $.MANY(() => {
        const op = $.OR([
          {
            ALT: () => {
              $.CONSUME(OpPlus);
              return "+";
            },
          },
          {
            ALT: () => {
              $.CONSUME(OpMinus);
              return "-";
            },
          },
        ]);
        const right = $.SUBRULE2($.multiplicative);
        left = $.yy.evaluateByOperator(op, [left, right]);
      });
      return left;
    });

    $.RULE("multiplicative", () => {
      let left = $.SUBRULE($.power);
      $.MANY(() => {
        const op = $.OR([
          {
            ALT: () => {
              $.CONSUME(OpMul);
              return "*";
            },
          },
          {
            ALT: () => {
              $.CONSUME(OpDiv);
              return "/";
            },
          },
        ]);
        const right = $.SUBRULE2($.power);
        left = $.yy.evaluateByOperator(op, [left, right]);
      });
      return left;
    });

    $.RULE("power", () => {
      let left = $.SUBRULE($.concat);
      $.MANY(() => {
        $.CONSUME(OpPow);
        const right = $.SUBRULE2($.concat);
        left = $.yy.evaluateByOperator("^", [left, right]);
      });
      return left;
    });

    $.RULE("concat", () => {
      let left = $.SUBRULE($.unary);
      $.MANY(() => {
        $.CONSUME(OpConcat);
        const right = $.SUBRULE2($.unary);
        left = $.yy.evaluateByOperator("&", [left, right]);
      });
      return left;
    });

    $.RULE("unary", () =>
      $.OR([
        {
          ALT: () => {
            $.CONSUME(OpMinus);
            const value = $.SUBRULE($.unary);
            let n1 = $.yy.invertNumber(value);
            if (isNaN(n1)) n1 = 0;
            return n1;
          },
        },
        {
          ALT: () => {
            $.CONSUME(OpPlus);
            let n1 = $.yy.toNumber($.SUBRULE2($.unary));
            if (isNaN(n1)) n1 = 0;
            return n1;
          },
        },
        { ALT: () => $.SUBRULE($.primary) },
      ])
    );

    $.RULE("primary", () =>
      $.OR([
        { ALT: () => $.SUBRULE($.number) },
        {
          ALT: () => {
            const tok = $.CONSUME(StringLiteral);
            return $.yy.trimEdges(tok.image);
          },
        },
        { ALT: () => $.SUBRULE($.cell) },
        { ALT: () => $.SUBRULE($.functionCall) },
        { ALT: () => $.SUBRULE($.variableSequence) },
        {
          ALT: () => {
            $.CONSUME(LParen);
            const value = $.SUBRULE($.expression);
            $.CONSUME(RParen);
            return value;
          },
        },
        { ALT: () => $.SUBRULE($.error) },
      ])
    );

    $.RULE("number", () => {
      let value = $.yy.toNumber($.CONSUME(NumberLiteral).image);
      $.OPTION(() => {
        $.CONSUME(OpPercent);
        value *= 0.01;
      });
      return value;
    });

    $.RULE("cell", () => {
      const start = $.OR([
        { ALT: () => $.CONSUME(AbsoluteCell).image },
        { ALT: () => $.CONSUME(MixedCell).image },
        { ALT: () => $.CONSUME(RelativeCell).image },
      ]);
      const end = $.OPTION(() => {
        $.CONSUME(Colon);
        return $.OR2([
          { ALT: () => $.CONSUME2(AbsoluteCell).image },
          { ALT: () => $.CONSUME2(MixedCell).image },
          { ALT: () => $.CONSUME2(RelativeCell).image },
        ]);
      });
      if (end) return $.yy.rangeValue(start, end);
      return $.yy.cellValue(start);
    });

    $.RULE("functionCall", () => {
      const name = $.CONSUME(FunctionName).image;
      $.CONSUME(LParen);
      const args = $.OPTION(() => $.SUBRULE($.expseq));
      $.CONSUME(RParen);
      return args ? $.yy.callFunction(name, args) : $.yy.callFunction(name);
    });

    $.RULE("expseq", () =>
      $.OR([
        {
          ALT: () => {
            const tok = $.CONSUME(ArrayLiteral);
            return $.yy.trimEdges(tok.image).split(",");
          },
        },
        {
          ALT: () => {
            const args = [$.SUBRULE($.expression)];
            $.MANY(() => {
              $.OR2([
                { ALT: () => $.CONSUME(Comma) },
                { ALT: () => $.CONSUME(Semicolon) },
              ]);
              args.push($.SUBRULE2($.expression));
            });
            return args;
          },
        },
      ])
    );

    $.RULE("variableSequence", () => {
      const parts = [$.CONSUME(Variable).image];
      $.MANY(() => {
        $.CONSUME(Dot);
        parts.push($.CONSUME2(Variable).image);
      });
      return $.yy.callVariable(parts[0]);
    });

    $.RULE("error", () => {
      const tok = $.CONSUME(ErrorLiteral);
      $.OPTION(() => $.CONSUME2(ErrorLiteral));
      return $.yy.throwError(tok.image);
    });

    // Stubs so embedded actions are safe during grammar recording.
    this.yy = {
      evaluateByOperator: () => null,
      toNumber: (v) => v,
      invertNumber: (v) => v,
      trimEdges: (v) => v,
      throwError: () => null,
      callVariable: () => null,
      callFunction: () => null,
      cellValue: () => null,
      rangeValue: () => null,
    };

    this.performSelfAnalysis();
  }
}

/**
 * Drop-in replacement for the old jison GrammarParser.
 * Exposes `.yy` hooks and `.parse(input)`.
 */
export function Parser() {
  this.yy = {};
  this._parser = new FormulaParser();
}

Parser.prototype.parse = function parse(input) {
  if (typeof input !== "string") {
    throw new Error("Parser error");
  }

  const lexResult = FormulaLexer.tokenize(input);
  if (lexResult.errors.length > 0) {
    throw new Error(lexResult.errors[0].message || "Lexer error");
  }

  this._parser.yy = this.yy;
  this._parser.input = lexResult.tokens;
  const result = this._parser.expression();

  if (this._parser.errors.length > 0) {
    const err = this._parser.errors[0];
    throw new Error(err.message || "Parser error");
  }

  return result;
};

Parser.prototype.Parser = Parser;
