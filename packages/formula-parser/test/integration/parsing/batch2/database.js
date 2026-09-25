import { workbook } from "./workbook.mjs";

// Microsoft's database-function example sheet.
//     A        B        C     D      E        F
// 1   Tree     Height   Age   Yield  Profit   Height
// 2   =Apple   >10                            <16
// 3   =Pear
// 4
// 5   Tree     Height   Age   Yield  Profit
// 6   Apple    18       20    14     105
// 7   Pear     12       12    10     96
// 8   Cherry   13       14    9      105
// 9   Apple    14       15    10     75
// 10  Pear     9        8     8      76.8
// 11  Apple    8        9     6      45
const SHEET = [
  ["Tree", "Height", "Age", "Yield", "Profit", "Height"],
  ["=Apple", ">10", null, null, null, "<16"],
  ["=Pear"],
  [],
  ["Tree", "Height", "Age", "Yield", "Profit"],
  ["Apple", 18, 20, 14, 105],
  ["Pear", 12, 12, 10, 96],
  ["Cherry", 13, 14, 9, 105],
  ["Apple", 14, 15, 10, 75],
  ["Pear", 9, 8, 8, 76.8],
  ["Apple", 8, 9, 6, 45],
  [],
  // Row 13+: extra criteria blocks.
  ["Tree", "Profit", "Tree", "Total"],
  ["A", ">=100", "<>Apple", true],
];

describe(".parse() database functions", () => {
  const value = workbook(SHEET);

  it("matches Microsoft's documented examples", () => {
    expect(value('DCOUNT(A5:E11,"Age",A1:F2)')).toBe(1);
    expect(value('DCOUNTA(A5:E11,"Profit",A1:F2)')).toBe(1);
    expect(value('DMAX(A5:E11,"Profit",A1:A3)')).toBe(105);
    expect(value('DMIN(A5:E11,"Profit",A1:B2)')).toBe(75);
    expect(value('DAVERAGE(A5:E11,"Yield",A1:B2)')).toBe(12);
    expect(value("DAVERAGE(A5:E11,3,A5:E11)")).toBe(13);
    expect(value('DSUM(A5:E11,"Profit",A1:A2)')).toBe(225);
    expect(value('DSUM(A5:E11,"Profit",A1:F2)')).toBe(75);
    expect(value('DPRODUCT(A5:E11,"Yield",A1:F3)')).toBe(800);
    expect(value('DSTDEV(A5:E11,"Yield",A1:A3)')).toBeCloseTo(2.96647939, 7);
    expect(value('DSTDEVP(A5:E11,"Yield",A1:A3)')).toBeCloseTo(2.65329983, 7);
    expect(value('DVAR(A5:E11,"Yield",A1:A3)')).toBeCloseTo(8.8, 10);
    expect(value('DVARP(A5:E11,"Yield",A1:A3)')).toBeCloseTo(7.04, 10);
    expect(value('DGET(A5:E11,"Yield",A1:A3)')).toBe("#NUM!");
  });

  it("DGET returns the single match or #VALUE!", () => {
    expect(value('DGET(A5:E11,"Yield",A1:F2)')).toBe(10);
    expect(value('DGET(A5:E11,"Yield",{"Tree";"Plum"})')).toBe("#VALUE!");
  });

  it("text criteria match by prefix, =text exactly", () => {
    // "A" matches Apple (x3); nothing else starts with A.
    expect(value('DCOUNTA(A5:E11,"Tree",A13:A14)')).toBe(3);
    expect(value('DCOUNTA(A5:E11,"Tree",{"Tree";"=App"})')).toBe(0);
    expect(value('DCOUNTA(A5:E11,"Tree",{"Tree";"=App*"})')).toBe(3);
    expect(value('DCOUNTA(A5:E11,"Tree",{"Tree";"?ear"})')).toBe(2);
    expect(value('DCOUNTA(A5:E11,"Tree",{"Tree";"CHER"})')).toBe(1);
  });

  it("columns AND, rows OR", () => {
    // Tree begins with A and profit >= 100.
    expect(value('DSUM(A5:E11,"Profit",A13:B14)')).toBe(105);
    // Tree <> Apple.
    expect(value('DSUM(A5:E11,"Profit",C13:C14)')).toBeCloseTo(277.8, 10);
    // Two rows: apples OR profit < 80.
    expect(
      value('DSUM(A5:E11,"Profit",{"Tree","Profit";"=Apple","";"","<80"})')
    ).toBeCloseTo(301.8, 10);
  });

  it("a blank criteria row matches everything", () => {
    expect(value('DCOUNT(A5:E11,"Age",{"Tree";""})')).toBe(6);
    expect(value("DSUM(A5:E11,5,A5:E11)")).toBeCloseTo(502.8, 10);
  });

  it("DCOUNT and DCOUNTA accept an omitted field", () => {
    expect(value("DCOUNT(A5:E11,,A1:A3)")).toBe(5);
    expect(value("DCOUNTA(A5:E11,,A1:A2)")).toBe(3);
  });

  it("computed criteria columns act as constants", () => {
    // Label "Total" is not a field: TRUE keeps every record.
    expect(value('DCOUNT(A5:E11,"Age",D13:D14)')).toBe(6);
    expect(value('DCOUNT(A5:E11,"Age",{"Calc";FALSE})')).toBe(0);
    expect(value('DCOUNT(A5:E11,"Age",{"";TRUE})')).toBe(6);
  });

  it("empty results and bad fields", () => {
    expect(value('DAVERAGE(A5:E11,"Yield",{"Tree";"=Plum"})')).toBe("#DIV/0!");
    expect(value('DMAX(A5:E11,"Yield",{"Tree";"=Plum"})')).toBe(0);
    expect(value('DSTDEV(A5:E11,"Yield",{"Tree";"=Cherry"})')).toBe("#DIV/0!");
    expect(value('DSUM(A5:E11,"Weight",A1:A2)')).toBe("#VALUE!");
    expect(value("DSUM(A5:E11,9,A1:A2)")).toBe("#VALUE!");
    expect(value('DSUM(A5:E11,"Profit",A1)')).toBe("#VALUE!");
  });

  it("numeric and operator criteria", () => {
    expect(value('DCOUNT(A5:E11,"Age",{"Height";12})')).toBe(1);
    expect(value('DCOUNT(A5:E11,"Age",{"Height";"12"})')).toBe(1);
    expect(value('DSUM(A5:E11,"Yield",{"Age","Age";">=9","<15"})')).toBe(25);
    expect(value('DCOUNT(A5:E11,"Age",{"profit";"<>105"})')).toBe(4);
  });
});
