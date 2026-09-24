import Parser from "../../../src/parser";
import {
  clearAstCache,
  parseToAst,
} from "../../../src/grammar-parser/grammar-parser";
import { tokenize } from "../../../src/grammar-parser/lexer";
import LruCache from "../../../src/grammar-parser/lru-cache";

describe("grammar parser", () => {
  describe("AST cache", () => {
    beforeEach(() => clearAstCache());

    it("parses each formula string once", () => {
      const first = parseToAst("SUM(A1:B2) * 2");

      expect(parseToAst("SUM(A1:B2) * 2")).toBe(first);
      expect(parseToAst("SUM(A1:B2)*2")).not.toBe(first);
    });

    it("shares the cache between Parser instances", () => {
      const a = new Parser();
      const b = new Parser();

      expect(a.getAst("1+1")).toBe(b.getAst("1+1"));
    });

    it("caches syntax errors too", () => {
      expect(() => parseToAst("1+")).toThrow();
      expect(() => parseToAst("1+")).toThrow();
    });

    it("re-evaluates cached formulas against fresh values", () => {
      const parser = new Parser();
      let cell = 1;

      parser.on("callCellValue", (_cell, _options, done) => done(cell));

      expect(parser.parse("A1*10").result).toBe(10);
      cell = 2;
      expect(parser.parse("A1*10").result).toBe(20);
    });
  });

  describe("LruCache", () => {
    it("evicts the least recently used entry", () => {
      const cache = new LruCache(2);

      cache.set("a", 1);
      cache.set("b", 2);
      expect(cache.get("a")).toBe(1);
      cache.set("c", 3);

      expect(cache.get("b")).toBe(void 0);
      expect(cache.get("a")).toBe(1);
      expect(cache.get("c")).toBe(3);
      expect(cache.size).toBe(2);

      cache.set("a", 10);
      expect(cache.get("a")).toBe(10);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe("tokenize()", () => {
    const types = (input) => tokenize(input).map((t) => t.tokenType.name);

    it("inserts intersections only between references", () => {
      expect(types("A1:B2 C3")).toEqual([
        "RelativeCell",
        "Colon",
        "RelativeCell",
        "Intersect",
        "RelativeCell",
      ]);
      expect(types("A1 + B2")).toEqual([
        "RelativeCell",
        "OpPlus",
        "RelativeCell",
      ]);
      expect(types("SUM( A1 )")).toEqual([
        "FunctionName",
        "LParen",
        "RelativeCell",
        "RParen",
      ]);
    });

    it("recognises whole-row and whole-column references", () => {
      expect(types("A:A")).toEqual(["ColumnRange"]);
      expect(types("$1:$3")).toEqual(["RowRange"]);
      expect(types("'Q1 ''24'!B:C")).toEqual(["ColumnRange"]);
    });

    it("does not split identifiers that start like cells", () => {
      expect(types("ABC1x")).toEqual(["Variable"]);
      expect(types("A1_b")).toEqual(["Variable"]);
      expect(types("LOG10(")).toEqual(["FunctionName", "LParen"]);
    });
  });
});
