import Parser from "../../src/parser";

describe("eta-reduced function names", () => {
  const parser = new Parser();
  const calc = (formula) => parser.parse(formula);

  it("pass a bare function name to LAMBDA helpers", () => {
    expect(calc("BYROW({1,2;3,4}, SUM)").result).toEqual([[3], [7]]);
    expect(calc("MAP({-1,2}, ABS)").result).toEqual([[1, 2]]);
    expect(calc("REDUCE(0, {1,2,3}, LAMBDA(a,b,a+b))").result).toBe(6);
  });

  it("aggregate in GROUPBY", () => {
    const { result, error } = calc(
      'GROUPBY({"a";"b";"a"}, {1;2;3}, SUM, 0, 0)'
    );
    expect(error).toBeNull();
    expect(result).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
  });

  it("a bare function name as a result is #CALC!", () => {
    expect(calc("SUM").error).toBe("#CALC!");
  });

  it("unknown bare names are still #NAME?", () => {
    expect(calc("NOT_A_FUNCTION_NAME").error).toBe("#NAME?");
  });
});
