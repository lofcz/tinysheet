import { parseToAst } from "../../../src/grammar-parser/grammar-parser";
import {
  builtinArrayParams,
  normalizeArrayParams,
  unionPolicy,
  wrapsReference,
} from "../../../src/grammar-parser/function-traits";
import { normalizeNumber } from "../../../src/helper/value";

describe("reference syntax", () => {
  it("parses a parenthesized comma list as a union", () => {
    const ast = parseToAst("SUM((A1:A2,C1))");

    expect(ast.args[0].type).toBe("union");
    expect(ast.args[0].items.map((n) => n.type)).toEqual(["range", "cell"]);
    expect(parseToAst("(A1)").type).toBe("cell");
  });

  it("parses `:` after a non-cell operand as a range operator", () => {
    expect(parseToAst("A1:A3").type).toBe("range");

    const dynamic = parseToAst("A1:INDEX(B:B,5)");

    expect(dynamic.type).toBe("rangeRef");
    expect(dynamic.left.type).toBe("cell");
    expect(dynamic.right.type).toBe("call");

    const chained = parseToAst("A1:B2:C3");

    expect(chained.type).toBe("rangeRef");
    expect(chained.left.type).toBe("range");
  });

  it("binds `:` tighter than the intersection space", () => {
    const ast = parseToAst("A1:INDEX(A:A,3) A2:C2");

    expect(ast.type).toBe("intersect");
    expect(ast.left.type).toBe("rangeRef");
  });
});

describe("function traits", () => {
  it("lifts every parameter of an unlisted built-in", () => {
    const spec = builtinArrayParams("ABS");

    expect(typeof spec).toBe("function");
    expect(spec(0)).toBe(false);
  });

  it("never lifts aggregates and self-lifting functions", () => {
    expect(builtinArrayParams("SUM")).toBe(true);
    expect(builtinArrayParams("SUMPRODUCT")).toBe(true);
    expect(builtinArrayParams("LEN")).toBe(true);
    expect(builtinArrayParams("VAR_S")).toBe(true);
  });

  it("marks the array parameters of scalar functions", () => {
    const npv = builtinArrayParams("NPV");

    expect([0, 1, 2].map(npv)).toEqual([false, true, true]);

    const sumifs = builtinArrayParams("SUMIFS");

    expect([0, 1, 2, 3, 4].map(sumifs)).toEqual([
      true,
      true,
      false,
      true,
      false,
    ]);
    expect([0, 1].map(builtinArrayParams("RANK_EQ"))).toEqual([false, true]);
  });

  it("normalizes declared array parameters", () => {
    expect(normalizeArrayParams(true)).toBe(true);
    expect(normalizeArrayParams([1])(1)).toBe(true);
    expect(normalizeArrayParams([1])(0)).toBe(false);
    expect(normalizeArrayParams(false)(0)).toBe(false);
    expect(normalizeArrayParams("x")).toBe(null);
  });

  it("knows how unions and single-cell references are passed", () => {
    expect(unionPolicy("SUM")).toBe("spread");
    expect(unionPolicy("LARGE")).toBe("flatten");
    expect(unionPolicy("ABS")).toBe(null);
    expect(wrapsReference("SUM", 0)).toBe(true);
    expect(wrapsReference("SUBTOTAL", 0)).toBe(false);
    expect(wrapsReference("SUBTOTAL", 1)).toBe(true);
    expect(wrapsReference("ABS", 0)).toBe(false);
  });
});

describe("normalizeNumber", () => {
  it("removes 15-digit noise, keeps precise values", () => {
    expect(normalizeNumber(0.1 + 0.2)).toBe(0.3);
    expect(normalizeNumber(1.15 * 100)).toBe(115);
    expect(normalizeNumber(1 / 3)).toBe(1 / 3);
    expect(normalizeNumber(Math.PI)).toBe(Math.PI);
    expect(normalizeNumber(12345.678)).toBe(12345.678);
  });

  it("maps -0 to 0 and non-finite numbers to #NUM!", () => {
    expect(Object.is(normalizeNumber(-0), 0)).toBe(true);
    expect(normalizeNumber(Infinity).message).toBe("NUM");
    expect(normalizeNumber(NaN).message).toBe("NUM");
  });
});
