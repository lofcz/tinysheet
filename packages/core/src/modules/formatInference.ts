/**
 * Excel's automatic number format for formula results.
 *
 * When a formula is entered in a General cell, Excel gives the result the
 * number format of the value it is "made of": `=A1+7` over a date shows a
 * date, `=B1*1.2` over a currency amount shows currency, `=SUM(C1:C9)` over
 * percentages shows a percentage. Excel does not document the rule; the
 * table below reproduces its observable behaviour:
 *
 * | formula shape                               | result format              |
 * | ------------------------------------------- | -------------------------- |
 * | `=A1`, `=(A1)`, `=-A1`, `=A1%`              | A1's                       |
 * | `a + b`, `a - b`, `a * b`, `a / b`          | the first of a, b that has |
 * |                                             | one (formula order)        |
 * | `date - date`                               | none: a number of days     |
 * | `a ^ b`, comparisons, `&`                   | none                       |
 * | `DATE`, `TODAY`, `NOW`, `TIME`, `EDATE`...  | that function's date/time  |
 * | `SUM`, `AVERAGE`, `MIN`, `MAX`, `MEDIAN`,   | the first formatted cell   |
 * | `ROUND*`, `CEILING*`, `FLOOR*`, `ABS`,      | among the value arguments  |
 * | `INT`, `TRUNC`, `LARGE`, `SMALL`, `SUMIF(S)`,|                           |
 * | `AVERAGEIF(S)`, `MAXIFS`, `MINIFS`,         |                            |
 * | `SUBTOTAL`, `AGGREGATE`                     |                            |
 * | `IF`, `IFS`, `IFERROR`, `IFNA`, `CHOOSE`,   | the first formatted result |
 * | `SWITCH`                                    | branch                     |
 * | `INDEX`, `LOOKUP`, `XLOOKUP`                | the result range's         |
 * | anything else (`COUNT`, `LEN`, ...)         | none                       |
 *
 * "Has a format" means a date, time, currency/accounting or percent code;
 * plain number codes (`0.00`, `#,##0`) are not carried over. A range
 * contributes its first non-empty cell. The inferred code is copied
 * verbatim (`"$"#,##0.00_);("$"#,##0.00)` stays exactly that).
 */
import { parseReference, tokenizeFormula } from "./formulaEditor";
import type { FormulaToken } from "./formulaEditor";
import { getFormatCategory } from "./numberFormat";
import type { Cell } from "../types";

/** Reads a cell of the formula's sheet (sheet null) or of a named sheet. */
export type FormatLookup = (
  sheet: string | null,
  r: number,
  c: number
) => Cell | null | undefined;

type FormatClass = "date" | "time" | "currency" | "percent";
type Inferred = { fa: string; cls: FormatClass } | null;

// Like Excel, a General cell whose formula is a date/time function takes
// that function's format, so =TODAY() shows a date, not a serial.
export const FORMULA_RESULT_FORMATS: Record<string, string> = {
  DATE: "m/d/yyyy",
  DATEVALUE: "m/d/yyyy",
  TODAY: "m/d/yyyy",
  EDATE: "m/d/yyyy",
  EOMONTH: "m/d/yyyy",
  WORKDAY: "m/d/yyyy",
  "WORKDAY.INTL": "m/d/yyyy",
  NOW: "m/d/yyyy h:mm",
  TIME: "h:mm AM/PM",
  TIMEVALUE: "h:mm AM/PM",
};

/**
 * Functions whose result is in the unit of (some of) their arguments, and
 * which arguments carry it: "all" or a list of argument indexes (a trailing
 * "+" in the spec means "and every argument after it").
 */
const PASS_THROUGH: Record<string, number[] | "all" | string> = {
  SUM: "all",
  AVERAGE: "all",
  AVERAGEA: "all",
  MIN: "all",
  MAX: "all",
  MINA: "all",
  MAXA: "all",
  MEDIAN: "all",
  MODE: "all",
  "MODE.SNGL": "all",
  ROUND: [0],
  ROUNDUP: [0],
  ROUNDDOWN: [0],
  MROUND: [0],
  CEILING: [0],
  "CEILING.MATH": [0],
  "CEILING.PRECISE": [0],
  FLOOR: [0],
  "FLOOR.MATH": [0],
  "FLOOR.PRECISE": [0],
  TRUNC: [0],
  INT: [0],
  ABS: [0],
  LARGE: [0],
  SMALL: [0],
  PERCENTILE: [0],
  "PERCENTILE.INC": [0],
  "PERCENTILE.EXC": [0],
  QUARTILE: [0],
  "QUARTILE.INC": [0],
  "QUARTILE.EXC": [0],
  TRIMMEAN: [0],
  SUMIF: [2, 0],
  SUMIFS: [0],
  AVERAGEIF: [2, 0],
  AVERAGEIFS: [0],
  MAXIFS: [0],
  MINIFS: [0],
  SUBTOTAL: "1+",
  AGGREGATE: "2+",
  IF: [1, 2],
  IFERROR: [0, 1],
  IFNA: [0, 1],
  IFS: "odd",
  CHOOSE: "1+",
  SWITCH: "switch",
  INDEX: [0],
  LOOKUP: [2, 1],
  XLOOKUP: [2],
};

/** Longest range scanned for its first non-empty cell. */
const MAX_SCAN = 2000;

function formatClass(fa: string | null | undefined): FormatClass | null {
  if (!fa || fa === "General" || fa === "@") return null;
  const category = getFormatCategory(fa);
  switch (category) {
    case "date":
      return "date";
    case "time":
      return "time";
    case "percentage":
      return "percent";
    case "currency":
    case "accounting":
      return "currency";
    case "custom":
      return /[$€£¥₹₩₽₺₪₫]|\[\$[^\]-]+/.test(fa.replace(/\\./g, ""))
        ? "currency"
        : null;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* A tiny expression parser over the editor's tokens                   */
/* ------------------------------------------------------------------ */

type Node =
  | { k: "ref"; text: string }
  | { k: "fn"; name: string; args: Node[] }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "un"; a: Node }
  | { k: "none" };

const NONE: Node = { k: "none" };

class Parser {
  private i = 0;

  private tokens: FormulaToken[];

  constructor(tokens: FormulaToken[]) {
    this.tokens = tokens;
  }

  private peek() {
    return this.tokens[this.i];
  }

  private isOp(...ops: string[]) {
    const t = this.peek();
    return !!t && t.type === "operator" && ops.indexOf(t.text) > -1;
  }

  parse(): Node {
    const node = this.comparison();
    return this.i === this.tokens.length ? node : NONE;
  }

  private comparison(): Node {
    let a = this.concat();
    while (this.isOp("=", "<>", "<", ">", "<=", ">=")) {
      this.i += 1;
      this.concat();
      a = NONE;
    }
    return a;
  }

  private concat(): Node {
    let a = this.additive();
    while (this.isOp("&")) {
      this.i += 1;
      this.additive();
      a = NONE;
    }
    return a;
  }

  private additive(): Node {
    let a = this.multiplicative();
    while (this.isOp("+", "-")) {
      const op = this.peek().text;
      this.i += 1;
      a = { k: "bin", op, a, b: this.multiplicative() };
    }
    return a;
  }

  private multiplicative(): Node {
    let a = this.power();
    while (this.isOp("*", "/")) {
      const op = this.peek().text;
      this.i += 1;
      a = { k: "bin", op, a, b: this.power() };
    }
    return a;
  }

  private power(): Node {
    let a = this.unary();
    while (this.isOp("^")) {
      this.i += 1;
      this.unary();
      a = NONE;
    }
    return a;
  }

  private unary(): Node {
    if (this.isOp("+", "-")) {
      this.i += 1;
      return { k: "un", a: this.unary() };
    }
    let a = this.postfix();
    while (this.isOp("%")) {
      this.i += 1;
      a = { k: "un", a };
    }
    return a;
  }

  private postfix(): Node {
    const a = this.primary();
    // A1:INDEX(...) style ranges: the first operand stands for the range
    while (this.isOp(":")) {
      this.i += 1;
      this.primary();
    }
    return a;
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) return NONE;
    this.i += 1;
    switch (t.type) {
      case "reference":
        return { k: "ref", text: t.text };
      case "lparen": {
        const inner = this.comparison();
        if (this.peek()?.type === "rparen") this.i += 1;
        return inner;
      }
      case "function": {
        const name = t.text.toUpperCase().replace(/^_XLFN\./, "");
        const args: Node[] = [];
        if (this.peek()?.type === "lparen") {
          this.i += 1;
          if (this.peek()?.type === "rparen") {
            this.i += 1;
          } else {
            for (;;) {
              if (this.peek()?.type === "comma") args.push(NONE);
              else args.push(this.comparison());
              const next = this.peek();
              if (!next) break;
              this.i += 1;
              if (next.type === "rparen") break;
              if (next.type !== "comma") {
                this.i = this.tokens.length + 1;
                return NONE;
              }
            }
          }
        }
        return { k: "fn", name, args };
      }
      default:
        // numbers, strings, booleans, errors, arrays, names
        return NONE;
    }
  }
}

const astCache = new Map<string, Node>();

function parseFormula(formula: string): Node {
  const hit = astCache.get(formula);
  if (hit) return hit;
  const body = formula.replace(/^\s*=/, "");
  const tokens = tokenizeFormula(body).filter((t) => t.type !== "whitespace");
  let node: Node;
  try {
    node = new Parser(tokens).parse();
  } catch (e) {
    node = NONE;
  }
  if (astCache.size > 5000) astCache.clear();
  astCache.set(formula, node);
  return node;
}

/* ------------------------------------------------------------------ */
/* Evaluating the format of a node                                     */
/* ------------------------------------------------------------------ */

function refFormat(text: string, lookup: FormatLookup): Inferred {
  const ref = parseReference(text);
  if (!ref) return null;
  const rows = ref.row ?? [0, MAX_SCAN - 1];
  const cols = ref.column ?? [0, 255];
  let scanned = 0;
  for (let r = rows[0]; r <= rows[1]; r += 1) {
    for (let c = cols[0]; c <= cols[1]; c += 1) {
      scanned += 1;
      if (scanned > MAX_SCAN) return null;
      const cell = lookup(ref.sheetName, r, c);
      if (cell && (cell.v != null || cell.f != null)) {
        const fa = cell.ct?.fa;
        const cls = formatClass(fa);
        return cls ? { fa: fa as string, cls } : null;
      }
    }
  }
  return null;
}

function passThroughArgs(spec: number[] | "all" | string, args: Node[]) {
  if (spec === "all") return args;
  if (spec === "odd") return args.filter((_a, i) => i % 2 === 1);
  if (spec === "switch") {
    // SWITCH(expr, v1, r1, v2, r2, ..., [default])
    return args.filter(
      (_a, i) => i > 0 && (i % 2 === 0 || i === args.length - 1)
    );
  }
  if (typeof spec === "string") return args.slice(parseInt(spec, 10));
  return spec.map((i) => args[i]).filter(Boolean);
}

function infer(node: Node, lookup: FormatLookup): Inferred {
  switch (node.k) {
    case "ref":
      return refFormat(node.text, lookup);
    case "un":
      return infer(node.a, lookup);
    case "bin": {
      const a = infer(node.a, lookup);
      const b = infer(node.b, lookup);
      if (node.op === "-" && a?.cls === "date" && b?.cls === "date") {
        return null; // difference of two dates: a number of days
      }
      return a ?? b;
    }
    case "fn": {
      const dateFa = FORMULA_RESULT_FORMATS[node.name];
      if (dateFa) {
        return { fa: dateFa, cls: /[dy]/.test(dateFa) ? "date" : "time" };
      }
      const spec = PASS_THROUGH[node.name];
      if (!spec) return null;
      const args = passThroughArgs(spec, node.args);
      for (let i = 0; i < args.length; i += 1) {
        const f = infer(args[i], lookup);
        if (f) return f;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * The number format Excel gives the result of `formula` in a General cell,
 * or undefined when the result stays General (see the table above).
 */
export function inferFormulaFormat(
  formula: string | null | undefined,
  lookup: FormatLookup
): string | undefined {
  if (!formula) return undefined;
  return infer(parseFormula(formula), lookup)?.fa;
}
