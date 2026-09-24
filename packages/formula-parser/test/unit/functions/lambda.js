import lambdaFunctions, {
  callLambdaSafe,
  createLambda,
  isLambda,
} from "../../../src/functions/lambda";
import SUPPORTED_FORMULAS from "../../../src/supported-formulas";

const { MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY } = lambdaFunctions;

// A LAMBDA built directly from JavaScript.
const lambda = (params, fn) => createLambda(params, (args) => fn(...args));

describe("functions/lambda", () => {
  it("brands LAMBDA values", () => {
    const fn = lambda(["X"], (x) => x + 1);

    expect(isLambda(fn)).toBe(true);
    expect(fn(1)).toBe(2);
    expect(fn.params).toEqual(["X"]);
    expect(isLambda(function plain() {})).toBe(false);
    expect(isLambda({})).toBe(false);
  });

  it("callLambdaSafe() returns errors as values", () => {
    const fn = lambda(["X"], () => {
      throw Error("DIV/0");
    });

    expect(callLambdaSafe(fn, [1]).message).toBe("#DIV/0!");
  });

  it("registers the functions in SUPPORTED_FORMULAS", () => {
    [
      "MAP",
      "REDUCE",
      "SCAN",
      "BYROW",
      "BYCOL",
      "MAKEARRAY",
      "LET",
      "LAMBDA",
      "ISOMITTED",
    ].forEach((name) => expect(SUPPORTED_FORMULAS).toContain(name));
  });

  it("MAP / REDUCE / SCAN accept scalars as 1x1 arrays", () => {
    const double = lambda(["X"], (x) => x * 2);
    const add = lambda(["A", "B"], (a, b) => (a || 0) + b);

    expect(MAP(4, double)).toEqual([[8]]);
    expect(REDUCE(1, 4, add)).toBe(5);
    expect(SCAN(null, [[1, 2]], add)).toEqual([[1, 3]]);
  });

  it("BYROW / BYCOL pass 2D slices", () => {
    const shape = lambda(["V"], (v) => `${v.length}x${v[0].length}`);

    expect(
      BYROW(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        shape
      )
    ).toEqual([["1x3"], ["1x3"]]);
    expect(
      BYCOL(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        shape
      )
    ).toEqual([["2x1", "2x1", "2x1"]]);
  });

  it("MAKEARRAY passes 1-based indexes", () => {
    expect(
      MAKEARRAY(
        2,
        2,
        lambda(["R", "C"], (r, c) => `${r},${c}`)
      )
    ).toEqual([
      ["1,1", "1,2"],
      ["2,1", "2,2"],
    ]);
  });

  it("rejects non-LAMBDA arguments", () => {
    expect(() => MAP([[1]], (x) => x)).toThrow("VALUE");
    expect(() => BYROW([[1]], null)).toThrow("VALUE");
    expect(() => lambdaFunctions.LET()).toThrow("VALUE");
  });
});
