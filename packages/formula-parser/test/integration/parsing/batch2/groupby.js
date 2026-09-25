import Parser from "../../../../src/parser";
import { etaLambda, functionByName } from "../../../../src/functions/eta";
import { isLambda } from "../../../../src/functions/lambda";
import { workbook, plain } from "./workbook.mjs";

//     A        B         C
// 1   Region   Product   Sales
// 2   East     A         10
// 3   West     B         20
// 4   East     B         5
// 5   West     A         7
// 6   east     A         3
const SHEET = [
  ["Region", "Product", "Sales"],
  ["East", "A", 10],
  ["West", "B", 20],
  ["East", "B", 5],
  ["West", "A", 7],
  ["east", "A", 3],
];

describe(".parse() GROUPBY", () => {
  const value = workbook(SHEET);

  it("groups, aggregates and adds a grand total", () => {
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM")')).toEqual([
      ["East", 18],
      ["West", 27],
      ["Total", 45],
    ]);
  });

  it("detects and optionally shows headers", () => {
    // "Sales" over a number: headers detected, not shown.
    expect(value('GROUPBY(A1:A6,C1:C6,"SUM")')).toEqual([
      ["East", 18],
      ["West", 27],
      ["Total", 45],
    ]);
    expect(value('GROUPBY(A1:A6,C1:C6,"SUM",3)')).toEqual([
      ["Region", "Sales"],
      ["East", 18],
      ["West", 27],
      ["Total", 45],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",2,0)')).toEqual([
      ["Row Field 1", "Value 1"],
      ["East", 18],
      ["West", 27],
    ]);
  });

  it("total_depth", () => {
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,0)')).toEqual([
      ["East", 18],
      ["West", 27],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,-1)')).toEqual([
      ["Total", 45],
      ["East", 18],
      ["West", 27],
    ]);
    expect(value('GROUPBY(A2:B6,C2:C6,"SUM",0,2)')).toEqual([
      ["East", "A", 13],
      ["East", "B", 5],
      ["East", null, 18],
      ["West", "A", 7],
      ["West", "B", 20],
      ["West", null, 27],
      ["Total", null, 45],
    ]);
    expect(value('GROUPBY(A2:B6,C2:C6,"SUM",0,-2)')).toEqual([
      ["Total", null, 45],
      ["East", null, 18],
      ["East", "A", 13],
      ["East", "B", 5],
      ["West", null, 27],
      ["West", "A", 7],
      ["West", "B", 20],
    ]);
  });

  it("sort_order", () => {
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,0,-2)')).toEqual([
      ["West", 27],
      ["East", 18],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,0,-1)')).toEqual([
      ["West", 27],
      ["East", 18],
    ]);
    // Hierarchy: products sorted by sales descending within each region.
    expect(value('GROUPBY(A2:B6,C2:C6,"SUM",0,0,-3)')).toEqual([
      ["West", "B", 20],
      ["West", "A", 7],
      ["East", "A", 13],
      ["East", "B", 5],
    ]);
    expect(value('GROUPBY(A2:B6,C2:C6,"SUM",0,0,{1,-2})')).toEqual([
      ["East", "B", 5],
      ["East", "A", 13],
      ["West", "B", 20],
      ["West", "A", 7],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,0,3)')).toBe("#VALUE!");
  });

  it("filter_array", () => {
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,1,,B2:B6="A")')).toEqual([
      ["East", 13],
      ["West", 7],
      ["Total", 20],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,1,,B2:B6="Z")')).toBe("#CALC!");
    expect(value('GROUPBY(A2:A6,C2:C6,"SUM",0,1,,{TRUE,FALSE})')).toBe(
      "#VALUE!"
    );
  });

  it("field_relationship = table", () => {
    expect(value('GROUPBY(A2:B6,C2:C6,"SUM",0,2,-2,,1)')).toEqual([
      ["East", "B", 5],
      ["West", "B", 20],
      ["East", "A", 13],
      ["West", "A", 7],
      ["Total", null, 45],
    ]);
  });

  it("accepts LAMBDAs, including two-argument ones", () => {
    expect(value("GROUPBY(A2:A6,C2:C6,LAMBDA(x,MAX(x)),0)")).toEqual([
      ["East", 10],
      ["West", 20],
      ["Total", 20],
    ]);
    expect(
      value("GROUPBY(A2:A6,C2:C6,LAMBDA(x,all,SUM(x)/SUM(all)),0,0)")
    ).toEqual([
      ["East", 0.4],
      ["West", 0.6],
    ]);
    expect(value("GROUPBY(A2:A6,B2:B6,LAMBDA(x,ARRAYTOTEXT(x)),0,0)")).toEqual([
      ["East", "A, B, A"],
      ["West", "B, A"],
    ]);
    // A LAMBDA returning an array is #CALC! in its cell.
    expect(value("GROUPBY(A2:A6,C2:C6,LAMBDA(x,x),0,0)")).toEqual([
      ["East", "#CALC!"],
      ["West", "#CALC!"],
    ]);
  });

  it("PERCENTOF, COUNT, AVERAGE and several functions", () => {
    expect(value('GROUPBY(A2:A6,C2:C6,"PERCENTOF",0)')).toEqual([
      ["East", 0.4],
      ["West", 0.6],
      ["Total", 1],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,{"SUM","COUNT"},0,0)')).toEqual([
      [null, "SUM", "COUNT"],
      ["East", 18, 3],
      ["West", 27, 2],
    ]);
    expect(
      value('GROUPBY(A2:A6,C2:C6,{"Total","Mean";"SUM","AVERAGE"},0,0)')
    ).toEqual([
      [null, "Total", "Mean"],
      ["East", 18, 6],
      ["West", 27, 13.5],
    ]);
    expect(value('GROUPBY(A2:A6,C2:C6,"NOSUCH")')).toBe("#VALUE!");
  });

  it("multiple value columns", () => {
    expect(value('GROUPBY(A1:A6,B1:C6,"COUNTA",3,0)')).toEqual([
      ["Region", "Product", "Sales"],
      ["East", 3, 3],
      ["West", 2, 2],
    ]);
  });

  it("mismatched sizes are #VALUE!", () => {
    expect(value('GROUPBY(A2:A6,C2:C5,"SUM")')).toBe("#VALUE!");
  });
});

describe(".parse() PIVOTBY", () => {
  const value = workbook(SHEET);

  it("cross-tabulates with row and column totals", () => {
    expect(value('PIVOTBY(A2:A6,B2:B6,C2:C6,"SUM")')).toEqual([
      [null, "A", "B", "Total"],
      ["East", 13, 5, 18],
      ["West", 7, 20, 27],
      ["Total", 20, 25, 45],
    ]);
  });

  it("totals, sorting and blank intersections", () => {
    expect(value('PIVOTBY(A2:A6,B2:B6,C2:C6,"SUM",0,0,-1,0,-1)')).toEqual([
      [null, "B", "A"],
      ["West", 20, 7],
      ["East", 5, 13],
    ]);
    expect(
      value('PIVOTBY(A2:A6,B2:B6,C2:C6,"SUM",0,0,,0,,B2:B6<>"B")')
    ).toEqual([
      [null, "A"],
      ["East", 13],
      ["West", 7],
    ]);
    expect(value('PIVOTBY({"x";"y"},{"p";"q"},{1;2},"SUM",0,0,,0)')).toEqual([
      [null, "p", "q"],
      ["x", 1, null],
      ["y", null, 2],
    ]);
  });

  it("headers and relative_to", () => {
    expect(value('PIVOTBY(A1:A6,B1:B6,C1:C6,"SUM",3,0,,0)')).toEqual([
      ["Product", "A", "B"],
      ["Region", "Sales", "Sales"],
      ["East", 13, 5],
      ["West", 7, 20],
    ]);
    // Share of each column.
    expect(value('PIVOTBY(A2:A6,B2:B6,C2:C6,"PERCENTOF",0,0,,0)')).toEqual([
      [null, "A", "B"],
      ["East", 13 / 20, 5 / 25],
      ["West", 7 / 20, 20 / 25],
    ]);
    // Share of each row.
    expect(value('PIVOTBY(A2:A6,B2:B6,C2:C6,"PERCENTOF",0,0,,0,,,1)')).toEqual([
      [null, "A", "B"],
      ["East", 13 / 18, 5 / 18],
      ["West", 7 / 27, 20 / 27],
    ]);
    // Share of the grand total.
    expect(value('PIVOTBY(A2:A6,B2:B6,C2:C6,"PERCENTOF",0,0,,0,,,2)')).toEqual([
      [null, "A", "B"],
      ["East", 13 / 45, 5 / 45],
      ["West", 7 / 45, 20 / 45],
    ]);
  });

  it("several functions add a header row", () => {
    expect(value('PIVOTBY(A2:A6,B2:B6,C2:C6,{"SUM","COUNT"},0,0,,0)')).toEqual([
      [null, "A", "A", "B", "B"],
      [null, "SUM", "COUNT", "SUM", "COUNT"],
      ["East", 13, 2, 5, 1],
      ["West", 7, 1, 20, 1],
    ]);
  });
});

describe("eta-reduced functions", () => {
  it("functionByName resolves custom and formulajs functions", () => {
    expect(functionByName("sum")([[1], [2]])).toBe(3);
    expect(functionByName("FISHER")(0.5)).toBeCloseTo(0.5493061443, 9);
    expect(functionByName("NOSUCH")).toBeUndefined();
  });

  it("etaLambda builds a LAMBDA value", () => {
    const sum = etaLambda("sum", (args) => functionByName("SUM")(...args));

    expect(isLambda(sum)).toBe(true);
    expect(sum.functionName).toBe("SUM");
    expect(sum.params).toEqual(["VALUE"]);
    expect(sum([[1], [2]])).toBe(3);
    expect(etaLambda("PERCENTOF", () => 0).params.length).toBe(2);
  });

  it("GROUPBY/PIVOTBY accept eta LAMBDAs as values", () => {
    // Simulates an evaluator that turns a bare `SUM` into an eta LAMBDA.
    const parser = new Parser();
    const eta = (name) =>
      etaLambda(name, (args) => functionByName(name)(...args));

    parser.setVariable("SUM", eta("SUM"));
    parser.setVariable("AVERAGE", eta("AVERAGE"));
    parser.setVariable("PERCENTOF", eta("PERCENTOF"));
    const run = (formula) => {
      const { error, result } = parser.parse(formula);

      return error || plain(result);
    };

    expect(run('GROUPBY({"a";"b";"a"},{1;2;3},SUM)')).toEqual([
      ["a", 4],
      ["b", 2],
      ["Total", 6],
    ]);
    expect(run('GROUPBY({"a";"b";"a"},{1;2;4},PERCENTOF,0,0)')).toEqual([
      ["a", 5 / 7],
      ["b", 2 / 7],
    ]);
    expect(
      run('GROUPBY({"a";"b";"a"},{1;2;3},HSTACK(SUM,AVERAGE),0,0)')
    ).toEqual([
      [null, "SUM", "AVERAGE"],
      ["a", 4, 2],
      ["b", 2, 2],
    ]);
    expect(run('PIVOTBY({"a";"b"},{"x";"x"},{1;2},SUM,0,0,,0)')).toEqual([
      [null, "x"],
      ["a", 1],
      ["b", 2],
    ]);
  });
});
