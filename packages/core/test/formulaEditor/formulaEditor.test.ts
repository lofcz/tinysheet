import {
  tokenizeFormula,
  getCallContext,
  resolveParamIndex,
  getFunctionQuery,
  rankFunctions,
  insertFunctionName,
  cycleReference,
  cycleReferenceAtCaret,
  findBracketPair,
  autoCloseFormula,
  parseReference,
  referenceKey,
  assignReferenceColors,
  formulaTextToHTML,
  collectColumnValues,
  matchColumnValues,
  getCaretOffset,
  setCaretOffset,
  highlightBracketPair,
  BRACKET_MATCH_CLASS,
} from "../../src/modules/formulaEditor";
import { locale } from "../../src/locale";

const types = (text: string) =>
  tokenizeFormula(text).map((t) => `${t.type}:${t.text}`);

/** caret position marked with `|` */
const at = (s: string): [string, number] => [
  s.replace("|", ""),
  s.indexOf("|"),
];

describe("tokenizeFormula", () => {
  it("covers every character", () => {
    const text = `=IF(SUM(A1:B2, 'My Sheet'!$C$3)>=10, "a,b""c", {1,2;3,4})`;
    const tokens = tokenizeFormula(text);
    expect(tokens.map((t) => t.text).join("")).toBe(text);
    expect(tokens.slice(1).map((t) => t.start)).toEqual(
      tokens.slice(0, -1).map((t) => t.end)
    );
  });

  it("classifies tokens", () => {
    expect(types(`=SUM(A1,"x")`)).toEqual([
      "operator:=",
      "function:SUM",
      "lparen:(",
      "reference:A1",
      "comma:,",
      'string:"x"',
      "rparen:)",
    ]);
    expect(types("=LOG10(2)+TRUE")).toEqual([
      "operator:=",
      "function:LOG10",
      "lparen:(",
      "number:2",
      "rparen:)",
      "operator:+",
      "bool:TRUE",
    ]);
    expect(types("=NORM.S.DIST(1,#N/A)")[1]).toBe("function:NORM.S.DIST");
    expect(types("=NORM.S.DIST(1,#N/A)")[5]).toBe("error:#N/A");
  });

  it("recognises every kind of reference", () => {
    [
      "A1",
      "$A$1",
      "A$1:$B2",
      "A:A",
      "$B:D",
      "1:3",
      "Sheet2!A1",
      "Sheet2!B:D",
      "'My Sheet'!A1:B2",
      "'It''s'!A1",
    ].forEach((ref) => {
      expect(types(`=${ref}`)).toEqual(["operator:=", `reference:${ref}`]);
    });
  });

  it("does not treat names as references", () => {
    expect(types("=ABCD1")[1]).toBe("name:ABCD1");
    expect(types("=SUM")[1]).toBe("name:SUM");
  });
});

describe("getCallContext", () => {
  it("finds the argument the caret is in", () => {
    expect(getCallContext(...at("=SUM(|"))).toMatchObject({
      name: "SUM",
      argIndex: 0,
    });
    expect(getCallContext(...at("=SUM(A1,|"))).toMatchObject({
      name: "SUM",
      argIndex: 1,
    });
    expect(getCallContext(...at("=IF(A1>0,|B1,C1)"))).toMatchObject({
      name: "IF",
      argIndex: 1,
    });
  });

  it("ignores commas in nested calls, strings and arrays", () => {
    expect(getCallContext(...at(`=IF(SUM(1,2,3),"a,b",{1,2},|`))).toMatchObject(
      { name: "IF", argIndex: 3 }
    );
    expect(getCallContext(...at("=IF(A1,SUM(1,|2),3)"))).toMatchObject({
      name: "SUM",
      argIndex: 1,
    });
    expect(getCallContext(...at("=IF(A1,SUM(1,2),|3)"))).toMatchObject({
      name: "IF",
      argIndex: 2,
    });
  });

  it("uses the enclosing function inside plain parentheses", () => {
    expect(getCallContext(...at("=SUM(1,(2+|"))).toMatchObject({
      name: "SUM",
      argIndex: 1,
    });
  });

  it("returns null outside of calls", () => {
    expect(getCallContext(...at("=SUM(1)|"))).toBeNull();
    expect(getCallContext(...at("=A1+|"))).toBeNull();
    expect(getCallContext(...at("=SUM|("))).toBeNull();
  });
});

describe("resolveParamIndex", () => {
  const sum = [{ name: "value1" }, { name: "value2", repeat: "y" }];
  const sumifs = [
    { name: "sum_range" },
    { name: "criteria_range1" },
    { name: "criterion1" },
    { name: "criteria_range2", repeat: "y" },
    { name: "criterion2", repeat: "y" },
  ];
  it("maps repeating arguments", () => {
    expect(resolveParamIndex(sum, 0)).toBe(0);
    expect(resolveParamIndex(sum, 5)).toBe(1);
    expect(resolveParamIndex(sumifs, 5)).toBe(3);
    expect(resolveParamIndex(sumifs, 6)).toBe(4);
    expect(resolveParamIndex([{ name: "x" }], 3)).toBe(-1);
  });
});

describe("getFunctionQuery", () => {
  it("returns the identifier being typed", () => {
    expect(getFunctionQuery(...at("=SU|"))).toEqual({
      query: "SU",
      start: 1,
      end: 3,
    });
    expect(getFunctionQuery(...at("=IF(su|"))?.query).toBe("SU");
    expect(getFunctionQuery(...at("=1+VL|"))?.query).toBe("VL");
    expect(getFunctionQuery(...at("=A1*LOG1|"))?.query).toBe("LOG1");
  });

  it("returns null elsewhere", () => {
    expect(getFunctionQuery(...at("SU|"))).toBeNull();
    expect(getFunctionQuery(...at("=S|UM"))).toBeNull();
    expect(getFunctionQuery(...at('="SU|"'))).toBeNull();
    expect(getFunctionQuery(...at("=A1:B|"))).toBeNull();
    expect(getFunctionQuery(...at("=$A$1|"))).toBeNull();
    expect(getFunctionQuery(...at("=SUM(|"))).toBeNull();
  });
});

describe("rankFunctions", () => {
  const list = [
    "SUBSTITUTE",
    "SUBTOTAL",
    "SUM",
    "SUMIF",
    "SUMSQ",
    "DSUM",
    "NORM.S.DIST",
    "NORM.DIST",
    "T.DIST",
    "DISTINCT_X",
    "VLOOKUP",
    "ISURL",
    "SUM",
  ].map((n) => ({ n }));
  const names = (q: string, limit?: number) =>
    rankFunctions(list, q, limit).map((r) => r.item.n);

  it("puts exact and prefix matches first, popular ones before the rest", () => {
    expect(names("su")).toEqual([
      "SUM",
      "SUMIF",
      "SUBSTITUTE",
      "SUBTOTAL",
      "SUMSQ",
      "DSUM",
      "ISURL",
    ]);
    expect(names("sum")[0]).toBe("SUM");
  });

  it("matches dotted segments", () => {
    expect(names("DIST")).toEqual([
      "DISTINCT_X",
      "NORM.DIST",
      "NORM.S.DIST",
      "T.DIST",
    ]);
    const r = rankFunctions(list, "DIST").find(
      (x) => x.item.n === "NORM.S.DIST"
    );
    expect(r?.tier).toBe(2);
    expect(r?.matches).toEqual([[7, 11]]);
  });

  it("falls back to fuzzy matching and respects the limit", () => {
    expect(names("VLKP")).toEqual(["VLOOKUP"]);
    expect(
      rankFunctions(list, "VLKP")[0].matches.map(([s, e]) => [s, e])
    ).toEqual([
      [0, 2],
      [4, 5],
      [6, 7],
    ]);
    expect(names("S", 2)).toEqual(["SUM", "SUMIF"]);
  });

  it("only offers prefix matches for reference-like queries", () => {
    expect(names("M2")).toEqual([]);
  });
});

describe("rankFunctions with the English catalog", () => {
  const { functionlist } = locale({ lang: "en" } as any);
  const names = (q: string) =>
    rankFunctions(functionlist, q).map((r) => r.item.n);

  it("handles names with digits and dots", () => {
    expect(names("LOG1")).toContain("LOG10");
    expect(names("ATAN")).toEqual(expect.arrayContaining(["ATAN", "ATAN2"]));
    expect(names("NORM.S")).toEqual(
      expect.arrayContaining(["NORM.S.DIST", "NORM.S.INV"])
    );
    expect(
      rankFunctions(functionlist, "DIST", 100).map((r) => r.item.n)
    ).toContain("NORM.S.DIST");
    expect(names("SU")[0]).toBe("SUM");
    expect(names("VLOOKUP")[0]).toBe("VLOOKUP");
  });

  it("returns at most 12 suggestions", () => {
    expect(names("S").length).toBe(12);
  });
});

describe("insertFunctionName", () => {
  it("replaces the query and adds a paren", () => {
    expect(insertFunctionName(...at("=IF(su|"), "SUM")).toEqual({
      text: "=IF(SUM(",
      caret: 8,
    });
    expect(insertFunctionName(...at("=su|(A1)"), "SUM")).toEqual({
      text: "=SUM(A1)",
      caret: 5,
    });
  });
});

describe("cycleReference", () => {
  it("cycles cells like Excel's F4", () => {
    const seq = ["A1"];
    for (let i = 0; i < 4; i += 1) seq.push(cycleReference(seq[i]));
    expect(seq).toEqual(["A1", "$A$1", "A$1", "$A1", "A1"]);
  });

  it("cycles ranges based on the first cell", () => {
    expect(cycleReference("A1:B2")).toBe("$A$1:$B$2");
    expect(cycleReference("$A$1:B2")).toBe("A$1:B$2");
    expect(cycleReference("Sheet2!A$1:$B$2")).toBe("Sheet2!$A1:$B2");
    expect(cycleReference("'a!b'!$A1")).toBe("'a!b'!A1");
  });

  it("toggles whole columns and rows", () => {
    expect(cycleReference("A:C")).toBe("$A:$C");
    expect(cycleReference("$A:$C")).toBe("A:C");
    expect(cycleReference("1:3")).toBe("$1:$3");
  });

  it("works on the reference under or left of the caret", () => {
    expect(cycleReferenceAtCaret(...at("=SUM(A1|,B2)"))).toMatchObject({
      text: "=SUM($A$1,B2)",
      caret: 9,
    });
    expect(cycleReferenceAtCaret(...at("=SUM(A1,B|2)"))?.text).toBe(
      "=SUM(A1,$B$2)"
    );
    expect(cycleReferenceAtCaret(...at("=SUM(|1)"))).toBeNull();
  });
});

describe("brackets", () => {
  it("finds the pair next to or around the caret", () => {
    // `=SUM(ABS(1),2)`: parens at 4, 8, 10, 13
    const text = "=SUM(ABS(1),2)";
    expect(findBracketPair(text, 11)).toEqual([8, 10]);
    expect(findBracketPair(text, 8)).toEqual([8, 10]);
    expect(findBracketPair(text, 12)).toEqual([4, 13]);
    expect(findBracketPair("=SUM(1", 6)).toEqual([4, -1]);
    expect(findBracketPair('=")"', 3)).toBeNull();
  });

  it("closes missing parens", () => {
    expect(autoCloseFormula("=SUM(ABS(1")).toBe("=SUM(ABS(1))");
    expect(autoCloseFormula('=IF(A1,"(",')).toBe('=IF(A1,"(",)');
    expect(autoCloseFormula("=SUM(1)")).toBe("=SUM(1)");
    expect(autoCloseFormula("(abc")).toBe("(abc");
  });
});

describe("references", () => {
  it("parses references", () => {
    expect(parseReference("$B$2:A1")).toEqual({
      sheetName: null,
      row: [0, 1],
      column: [0, 1],
    });
    expect(parseReference("'My ''x'''!C:A")).toEqual({
      sheetName: "My 'x'",
      row: null,
      column: [0, 2],
    });
    expect(parseReference("Sheet1!3:2")).toEqual({
      sheetName: "Sheet1",
      row: [1, 2],
      column: null,
    });
    expect(parseReference("SUM")).toBeNull();
  });

  it("gives equal references the same colour", () => {
    expect(referenceKey("$a$1")).toBe("A1");
    expect(assignReferenceColors(["A1", "B2", "$A$1", "Sheet2!A1"])).toEqual([
      0, 1, 0, 2,
    ]);
  });

  it("renders formula html", () => {
    const { html, refCount } = formulaTextToHTML(`=SUM(A1,$A$1,"<b>")`);
    expect(refCount).toBe(2);
    const div = document.createElement("div");
    div.innerHTML = html;
    expect(div.textContent).toBe(`=SUM(A1,$A$1,"<b>")`);
    const refs = div.querySelectorAll(
      "span.fortune-formula-functionrange-cell"
    );
    expect(refs).toHaveLength(2);
    expect(refs[0].getAttribute("rangeindex")).toBe("0");
    expect(refs[1].getAttribute("rangeindex")).toBe("1");
    expect((refs[0] as HTMLElement).style.color).toBe(
      (refs[1] as HTMLElement).style.color
    );
    expect(div.querySelector("b")).toBeNull();
    expect(
      div.querySelector(".luckysheet-formula-text-func")?.textContent
    ).toBe("SUM");
  });

  it("keeps preserved range indexes", () => {
    const { html, nextRangeIndex } = formulaTextToHTML("=A1+B1+C1", [3, 1]);
    const div = document.createElement("div");
    div.innerHTML = html;
    const idx = Array.from(
      div.querySelectorAll("span.fortune-formula-functionrange-cell")
    ).map((e) => e.getAttribute("rangeindex"));
    expect(idx).toEqual(["3", "1", "4"]);
    expect(nextRangeIndex).toBe(5);
  });
});

describe("value autocomplete", () => {
  const data: any[][] = [
    [{ v: "Apple" }],
    [null],
    [{ v: "Banana" }],
    [{ v: "apple pie" }],
    [{ v: 12, ct: { t: "n" } }],
    [{ v: "Blueberry" }],
    [null],
    [{ v: "Cherry", f: '="Cherry"' }],
    [{ v: "Avocado" }],
    [{ v: "Blackberry" }],
  ];
  it("scans only the contiguous block around the active cell", () => {
    expect(collectColumnValues(data, 6, 0)).toEqual([
      "Blueberry",
      "apple pie",
      "Banana",
      "Avocado",
      "Blackberry",
    ]);
  });

  it("matches case-insensitive prefixes, not numbers or formulas", () => {
    const values = collectColumnValues(data, 6, 0);
    expect(matchColumnValues(values, "b")).toEqual([
      "Banana",
      "Blackberry",
      "Blueberry",
    ]);
    expect(matchColumnValues(values, "APPLE")).toEqual(["apple pie"]);
    expect(matchColumnValues(values, "banana")).toEqual([]);
    expect(matchColumnValues(values, "=b")).toEqual([]);
    expect(matchColumnValues(["1234"], "12")).toEqual([]);
  });
});

describe("DOM helpers", () => {
  it("gets and sets the caret across spans", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    document.body.appendChild(el);
    el.innerHTML = formulaTextToHTML("=SUM(ABS(1),2)").html;
    setCaretOffset(el, 11);
    expect(getCaretOffset(el)).toBe(11);
    highlightBracketPair(el, 11);
    const matched = Array.from(
      el.querySelectorAll(`.${BRACKET_MATCH_CLASS}`)
    ).map((e) => e.textContent);
    expect(matched).toEqual(["(", ")"]);
    const lpars = el.querySelectorAll(".luckysheet-formula-text-lpar");
    expect(lpars[1].classList.contains(BRACKET_MATCH_CLASS)).toBe(true);
    el.remove();
  });
});
