import Parser from "../../../../src/parser";
import { attachSheet, plain } from "./sheet-fixture.mjs";

describe(".parse() lazily evaluated functions", () => {
  let parser;
  let log;
  let sideEffects;

  beforeEach(() => {
    parser = new Parser();
    log = attachSheet(parser);
    sideEffects = 0;
    parser.setFunction("BOOM", () => {
      sideEffects += 1;

      return "boom";
    });
  });

  const value = (formula) => {
    const { error, result } = parser.parse(formula);

    return error === null ? plain(result) : error;
  };

  describe("IF", () => {
    it("evaluates only the taken branch", () => {
      expect(value("IF(TRUE, 1, 1/0)")).toBe(1);
      expect(value("IF(FALSE, 1/0, 2)")).toBe(2);
      expect(value("IF(TRUE, 1, BOOM())")).toBe(1);
      expect(sideEffects).toBe(0);
      expect(value("IF(A1 > 0, A2, A3)")).toBe(2);
      expect(log.map((entry) => entry[1])).toEqual(["A1", "A2"]);
    });

    it("follows Excel's defaults for missing branches", () => {
      expect(value("IF(FALSE, 1)")).toBe(false);
      expect(value("IF(TRUE, , 2)")).toBe(0);
      expect(value("IF(FALSE, 1, )")).toBe(0);
    });

    it("coerces the condition like Excel", () => {
      expect(value('IF("TRUE", 1, 2)')).toBe(1);
      expect(value('IF("false", 1, 2)')).toBe(2);
      expect(value("IF(2, 1, 2)")).toBe(1);
      expect(value("IF(C1, 1, 2)")).toBe(2);
      expect(value('IF("abc", 1, 2)')).toBe("#VALUE!");
      expect(value("IF(1/0, 1, 2)")).toBe("#DIV/0!");
      expect(value("IF(C2, 1, 2)")).toBe("#N/A");
    });

    it("returns references from the branches", () => {
      expect(value("SUM(IF(TRUE, A1:A3, A4:A5))")).toBe(6);
    });
  });

  describe("IFS", () => {
    it("returns the value of the first TRUE condition", () => {
      expect(value("IFS(FALSE, 1/0, TRUE, 2, TRUE, BOOM())")).toBe(2);
      expect(sideEffects).toBe(0);
      expect(value('IFS(A1 > 5, "big", A1 > 0, "small")')).toBe("small");
    });

    it("returns #N/A when nothing matches", () => {
      expect(value("IFS(FALSE, 1)")).toBe("#N/A");
    });

    it("works element-wise over arrays", () => {
      expect(
        value('IFS({1,5,9} > 6, "hi", {1,5,9} > 3, "mid", TRUE, "lo")')
      ).toEqual([["lo", "mid", "hi"]]);
    });
  });

  describe("IFERROR / IFNA", () => {
    it("evaluates the fallback only for errors", () => {
      expect(value('IFERROR(1/0, "x")')).toBe("x");
      expect(value("IFERROR(5, 1/0)")).toBe(5);
      expect(value("IFERROR(5, BOOM())")).toBe(5);
      expect(sideEffects).toBe(0);
      expect(value("IFERROR(#REF!, 1)")).toBe(1);
      expect(value("IFERROR(1/0, )")).toBe(0);
      expect(value("IFERROR(NOSUCHNAME, 3)")).toBe(3);
    });

    it("replaces errors inside arrays", () => {
      expect(value("IFERROR({1,#N/A,3}, 0)")).toEqual([[1, 0, 3]]);
      expect(value("IFERROR(1/{1,0}, -1)")).toEqual([[1, -1]]);
      expect(value("IFERROR({1,2}, BOOM())")).toEqual([[1, 2]]);
      expect(sideEffects).toBe(0);
    });

    it("IFNA only catches #N/A", () => {
      expect(value('IFNA(#N/A, "na")')).toBe("na");
      expect(value('IFNA(C2, "na")')).toBe("na");
      expect(value('IFNA(1/0, "na")')).toBe("#DIV/0!");
      expect(value("IFNA({1,#N/A,#VALUE!}, 0)")).toEqual([[1, 0, "#VALUE!"]]);
    });
  });

  describe("CHOOSE", () => {
    it("evaluates only the chosen value", () => {
      expect(value('CHOOSE(2, 1/0, "b", BOOM())')).toBe("b");
      expect(sideEffects).toBe(0);
      expect(value('CHOOSE(1.9, "a", "b")')).toBe("a");
      expect(value("SUM(CHOOSE(2, A1:A2, A3:A5))")).toBe(12);
    });

    it("rejects out-of-range indexes", () => {
      expect(value('CHOOSE(3, "a", "b")')).toBe("#VALUE!");
      expect(value('CHOOSE(0, "a")')).toBe("#VALUE!");
      expect(value('CHOOSE("x", "a")')).toBe("#VALUE!");
    });

    it("works element-wise over an array of indexes", () => {
      expect(value('CHOOSE({1,2,1}, "a", "b")')).toEqual([["a", "b", "a"]]);
    });
  });

  describe("SWITCH", () => {
    it("compares like Excel's = and evaluates only the match", () => {
      expect(value('SWITCH("b", "a", 1, "B", 2, BOOM())')).toBe(2);
      expect(value('SWITCH(1, 1, "one", 2, 1/0)')).toBe("one");
      expect(sideEffects).toBe(0);
      expect(value('SWITCH(3, 1, "a", 2, "b", "none")')).toBe("none");
      expect(value('SWITCH(3, 1, "a", 2, "b")')).toBe("#N/A");
      expect(value('SWITCH(C1, 0, "blank is 0")')).toBe("blank is 0");
    });

    it("works element-wise over arrays", () => {
      expect(value('SWITCH({1,2,3}, 1, "a", 2, "b", "?")')).toEqual([
        ["a", "b", "?"],
      ]);
    });
  });

  it("uses a function registered with setFunction instead of the lazy form", () => {
    parser.setFunction("IF", () => "custom");

    expect(value("IF(TRUE, 1, 2)")).toBe("custom");
  });

  it("does not emit callFunction for lazy forms but does for eager calls", () => {
    const names = [];

    parser.on("callFunction", (name) => names.push(name));
    value("IF(TRUE, SUM(1), 2)");

    expect(names).toEqual(["SUM"]);
  });
});
