import Parser from "../../../../src/parser";
import { isLambda } from "../../../../src/index";
import { attachSheet, plain } from "./sheet-fixture.mjs";

describe(".parse() LET and LAMBDA", () => {
  let parser;
  let log;

  beforeEach(() => {
    parser = new Parser();
    log = attachSheet(parser);
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  // Capture a LAMBDA value through a custom function.
  const lambdaOf = (formula) => {
    let captured;

    parser.setFunction("CAPTURE", ([fn]) => {
      captured = fn;

      return 1;
    });
    parser.parse(`CAPTURE(${formula})`);

    return captured;
  };

  describe("LET", () => {
    it("binds names sequentially", () => {
      expect(value("LET(x, 5, x + 1)")).toBe(6);
      expect(value("LET(x, 1, y, x + 1, x + y)")).toBe(3);
      expect(value("LET(a, 2, b, a * 3, c, a + b, c * 10)")).toBe(80);
    });

    it("is case-insensitive", () => {
      expect(value("LET(Total, 2, total * TOTAL)")).toBe(4);
    });

    it("shadows outer names and variables lexically", () => {
      parser.setVariable("x", 100);

      expect(value("LET(x, 1, LET(x, 2, x) + x)")).toBe(3);
      expect(value("LET(x, 1, x) + x")).toBe(101);
      expect(value("LET(a, 1, b, a + 1, LET(a, 10, a + b))")).toBe(12);
    });

    it("does not leak names out of its scope", () => {
      expect(value("LET(x, 1, x) + x")).toBe("#NAME?");
      expect(value("SUM(LET(y, 2, y), y)")).toBe("#NAME?");
    });

    it("lets names shadow cell-like identifiers without reading the cell", () => {
      expect(value("LET(x1, 5, x1 * 2)")).toBe(10);
      expect(value("LET(A1, 100, A1 + A2)")).toBe(102);
      expect(log).toEqual([["cell", "A2", null]]);
      expect(value("A1")).toBe(1);
    });

    it("does not shadow absolute or sheet-qualified references", () => {
      expect(value("LET(A1, 100, $A$1 + Sheet2!A1)")).toBe(101);
    });

    it("binds ranges and arrays", () => {
      expect(value("LET(r, A1:A5, SUM(r) / ROWS(r))")).toBe(3);
      expect(value("LET(v, {1,2,3}, v * 2)")).toEqual([[2, 4, 6]]);
    });

    it("keeps errors in bindings until they are used", () => {
      expect(value("LET(x, 1/0, 5)")).toBe(5);
      expect(value("LET(x, 1/0, IFERROR(x, 0))")).toBe(0);
      expect(value("LET(x, 1/0, x + 1)")).toBe("#DIV/0!");
      expect(value("LET(x, 1/0, x)")).toBe("#DIV/0!");
    });

    it("does not let a binding see itself", () => {
      expect(value("LET(x, x + 1, x)")).toBe("#NAME?");
      expect(
        value("LET(f, LAMBDA(n, IF(n <= 1, 1, n * f(n - 1))), f(3))")
      ).toBe("#NAME?");
    });

    it("rejects malformed calls with #VALUE!", () => {
      expect(value("LET(x)")).toBe("#VALUE!");
      expect(value("LET(x, 1)")).toBe("#VALUE!");
      expect(value("LET(x, 1, y, 2)")).toBe("#VALUE!");
      expect(value("LET(1, 2, 3)")).toBe("#VALUE!");
      expect(value('LET("x", 2, 3)')).toBe("#VALUE!");
      expect(value("LET(x, 1, x, 2, x)")).toBe("#VALUE!");
      expect(value("LET($A$1, 1, 2)")).toBe("#VALUE!");
    });

    it("honours a custom LET registered with setFunction", () => {
      parser.setFunction("LET", () => "custom");

      expect(value("LET(x, 1, x)")).toBe("#NAME?");
      expect(value("LET(1, 2, 3)")).toBe("custom");
    });
  });

  describe("LAMBDA", () => {
    it("can be invoked directly", () => {
      expect(value("LAMBDA(x, x + 1)(5)")).toBe(6);
      expect(value("LAMBDA(x, y, x * y)(3, 4)")).toBe(12);
      expect(value("LAMBDA(42)()")).toBe(42);
      expect(value("(LAMBDA(x, x * 2))(21)")).toBe(42);
    });

    it("can be stored in LET and called by name", () => {
      expect(value("LET(f, LAMBDA(a, b, a * b), f(3, 4))")).toBe(12);
      expect(value("LET(add, LAMBDA(a, b, a + b), add(add(1, 2), 3))")).toBe(6);
      expect(value("LET(sq, LAMBDA(x, x^2), SUM(sq(3), sq(4)))")).toBe(25);
    });

    it("captures its defining scope (lexical closures)", () => {
      expect(value("LET(n, 10, f, LAMBDA(x, x + n), LET(n, 100, f(1)))")).toBe(
        11
      );
      expect(value("LET(x, 5, LAMBDA(y, x + y))(1)")).toBe(6);
    });

    it("supports currying", () => {
      expect(value("LAMBDA(a, LAMBDA(b, a + b))(1)(2)")).toBe(3);
      expect(
        value(
          "LET(adder, LAMBDA(n, LAMBDA(x, x + n)), add5, adder(5), add5(10))"
        )
      ).toBe(15);
    });

    it("defers evaluation of the body", () => {
      let calls = 0;

      parser.setFunction("COUNT_CALLS", () => {
        calls += 1;

        return calls;
      });

      expect(value("LET(f, LAMBDA(x, COUNT_CALLS()), 1)")).toBe(1);
      expect(calls).toBe(0);
      expect(value("LET(f, LAMBDA(x, COUNT_CALLS()), f(1) + f(2))")).toBe(3);
    });

    it("passes errors as argument values", () => {
      expect(value('LAMBDA(x, IFERROR(x, "err"))(1/0)')).toBe("err");
      expect(value("LAMBDA(x, x + 1)(#N/A)")).toBe("#N/A");
    });

    it("lets parameters shadow cells and names", () => {
      parser.setVariable("x", 100);

      expect(value("LAMBDA(x, x * 2)(3)")).toBe(6);
      expect(value("LAMBDA(a1, a1 + A2)(10)")).toBe(12);
      expect(value("LAMBDA(x, x)(1) + x")).toBe(101);
    });

    it("accepts the _xlpm. parameter prefix of saved workbooks", () => {
      expect(value("LAMBDA(_xlpm.x, _xlpm.x * 2)(4)")).toBe(8);
      expect(value("_xlfn.LAMBDA(_xlpm.n, n + 1)(1)")).toBe(2);
    });

    it("is #CALC! when returned uncalled", () => {
      expect(value("LAMBDA(x, x)")).toBe("#CALC!");
      expect(value("LET(f, LAMBDA(x, x), f)")).toBe("#CALC!");
    });

    it("rejects bad parameter lists and arity", () => {
      expect(value("LAMBDA()")).toBe("#VALUE!");
      expect(value("LAMBDA(1, 2)")).toBe("#VALUE!");
      expect(value("LAMBDA(x, x, x)")).toBe("#VALUE!");
      expect(value("LAMBDA(x, x)(1, 2)")).toBe("#VALUE!");
      expect(value("LAMBDA(x, x) + 1")).toBe("#VALUE!");
    });

    it("rejects calling something that is not a LAMBDA", () => {
      expect(value("(1)(2)")).toBe("#VALUE!");
      expect(value("LET(x, 1, x(2))")).toBe("#VALUE!");
      expect(value("A1(2)")).toBe("#NAME?");
    });
  });

  describe("ISOMITTED", () => {
    it("detects omitted trailing and empty arguments", () => {
      const f = 'LAMBDA(a, b, IF(ISOMITTED(b), "no b", a + b))';

      expect(value(`${f}(1)`)).toBe("no b");
      expect(value(`${f}(1,)`)).toBe("no b");
      expect(value(`${f}(1, 2)`)).toBe(3);
      expect(value("LAMBDA(a, b, ISOMITTED(a))(, 2)")).toBe(true);
    });

    it("reads omitted parameters as blank", () => {
      expect(value("LAMBDA(a, b, a + b)(1)")).toBe(1);
      expect(value('LAMBDA(a, b, a & b)("x")')).toBe("x");
    });

    it("is FALSE for anything that is not an omitted parameter", () => {
      expect(value("ISOMITTED(1)")).toBe(false);
      expect(value("LET(x, 1, ISOMITTED(x))")).toBe(false);
      expect(value("LAMBDA(x, ISOMITTED(x))(0)")).toBe(false);
      expect(value("ISOMITTED()")).toBe("#VALUE!");
    });
  });

  describe("LAMBDA values in JavaScript", () => {
    it("are detected with isLambda and callable", () => {
      const fn = lambdaOf("LAMBDA(x, y, x * 10 + y)");

      expect(isLambda(fn)).toBe(true);
      expect(isLambda(() => 1)).toBe(false);
      expect(isLambda(null)).toBe(false);
      expect(fn.params).toEqual(["X", "Y"]);
      expect(fn(4, 2)).toBe(42);
      expect(() => fn(1, 2, 3)).toThrow("#VALUE!");
    });

    it("can be registered as named functions (with recursion)", () => {
      parser.setVariable("DOUBLE", lambdaOf("LAMBDA(x, x * 2)"));
      parser.setVariable(
        "FACT2",
        lambdaOf("LAMBDA(n, IF(n <= 1, 1, n * FACT2(n - 1)))")
      );

      expect(value("DOUBLE(21)")).toBe(42);
      expect(value("double(2) + FACT2(5)")).toBe(124);
      expect(value("DOUBLE")).toBe("#CALC!");
    });

    it("stops runaway recursion with #NUM!", () => {
      parser.setVariable("LOOP", lambdaOf("LAMBDA(n, LOOP(n + 1))"));

      expect(value("LOOP(1)")).toBe("#NUM!");
      expect(value("IFERROR(LOOP(1), 7)")).toBe(7);
    });

    it("does not let a variable lambda hide a built-in function", () => {
      parser.setVariable("SUM", lambdaOf("LAMBDA(x, 0)"));

      expect(value("SUM(1, 2)")).toBe(3);
    });
  });
});
