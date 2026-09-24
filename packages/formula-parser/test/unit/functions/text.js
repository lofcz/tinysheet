import text from "../../../src/functions/text";
import Parser from "../../../src/parser";

const F = text;

/** Run a function and return its result, or "#CODE" when it errors. */
function run(name, ...args) {
  try {
    const result = F[name](...args);
    return result instanceof Error ? `#${result.message}` : result;
  } catch (e) {
    return `#${e.message}`;
  }
}

/** Map Error elements of a 2D result to "#CODE" strings. */
function grid(result) {
  if (!Array.isArray(result)) {
    return result instanceof Error ? `#${result.message}` : result;
  }
  return result.map((row) =>
    row.map((v) => (v instanceof Error ? `#${v.message}` : v))
  );
}

const NA = "#N/A";
const VALUE = "#VALUE";
const NUM = "#NUM";

describe("text functions", () => {
  describe("TEXTBEFORE", () => {
    it("returns text before the first delimiter by default", () => {
      expect(run("TEXTBEFORE", "Red riding hood's, red hood", "hood")).toBe(
        "Red riding "
      );
      expect(run("TEXTBEFORE", "a-b-c", "-")).toBe("a");
    });

    it("supports positive and negative instance_num", () => {
      expect(run("TEXTBEFORE", "a-b-c", "-", 2)).toBe("a-b");
      expect(run("TEXTBEFORE", "a-b-c", "-", -1)).toBe("a-b");
      expect(run("TEXTBEFORE", "a-b-c", "-", -2)).toBe("a");
      expect(run("TEXTBEFORE", "a-b-c", "-", 3)).toBe(NA);
      expect(run("TEXTBEFORE", "a-b-c", "-", -3)).toBe(NA);
    });

    it("returns #VALUE! for instance_num 0 or longer than text", () => {
      expect(run("TEXTBEFORE", "a-b", "-", 0)).toBe(VALUE);
      expect(run("TEXTBEFORE", "a-b", "-", 4)).toBe(VALUE);
      expect(run("TEXTBEFORE", "a-b", "-", -4)).toBe(VALUE);
    });

    it("is case-sensitive unless match_mode is 1", () => {
      expect(run("TEXTBEFORE", "abXcd", "x")).toBe(NA);
      expect(run("TEXTBEFORE", "abXcd", "x", 1, 1)).toBe("ab");
      expect(run("TEXTBEFORE", "abXcd", "x", 1, 2)).toBe(VALUE);
    });

    it("treats end of text as delimiter with match_end", () => {
      expect(run("TEXTBEFORE", "abc", "-", 1, 0, 1)).toBe("abc");
      expect(run("TEXTBEFORE", "a-b", "-", 2, 0, 1)).toBe("a-b");
      expect(run("TEXTBEFORE", "a-b", "-", 3, 0, 1)).toBe(NA);
      expect(run("TEXTBEFORE", "abc", "-", -1, 0, 1)).toBe("");
    });

    it("returns if_not_found when no match", () => {
      expect(run("TEXTBEFORE", "abc", "-", 1, 0, 0, "none")).toBe("none");
      expect(run("TEXTBEFORE", "abc", "-", 1, 0, 0, 0)).toBe(0);
    });

    it("matches an empty delimiter immediately", () => {
      expect(run("TEXTBEFORE", "abc", "")).toBe("");
      expect(run("TEXTBEFORE", "abc", "", -1)).toBe("abc");
    });

    it("accepts an array of delimiters", () => {
      expect(run("TEXTBEFORE", "a,b;c", [[";", ","]])).toBe("a");
      expect(run("TEXTBEFORE", "a,b;c", [[";", ","]], 2)).toBe("a,b");
      expect(run("TEXTBEFORE", "a,b;c", [[";", ","]], -1)).toBe("a,b");
    });

    it("treats skipped optional arguments as defaults", () => {
      expect(run("TEXTBEFORE", "aXb", "x", undefined, 1)).toBe("a");
    });

    it("coerces numbers and booleans", () => {
      expect(run("TEXTBEFORE", 12.5, ".")).toBe("12");
      expect(run("TEXTBEFORE", true, "U")).toBe("TR");
    });

    it("lifts over an array of texts", () => {
      expect(grid(F.TEXTBEFORE([["a-b"], ["c"], ["d-e"]], "-"))).toEqual([
        ["a"],
        [NA],
        ["d"],
      ]);
    });

    it("propagates errors in the text argument", () => {
      expect(run("TEXTBEFORE", new Error("DIV/0"), "-")).toBe("#DIV/0");
    });
  });

  describe("TEXTAFTER", () => {
    it("returns text after the delimiter", () => {
      expect(run("TEXTAFTER", "Red riding hood's, red hood", "hood")).toBe(
        "'s, red hood"
      );
      expect(run("TEXTAFTER", "a-b-c", "-")).toBe("b-c");
      expect(run("TEXTAFTER", "a-b-c", "-", 2)).toBe("c");
      expect(run("TEXTAFTER", "a-b-c", "-", -1)).toBe("c");
      expect(run("TEXTAFTER", "a-b-c", "-", -2)).toBe("b-c");
    });

    it("searches backwards from the end for negative instances", () => {
      expect(run("TEXTAFTER", "aaa", "aa", -1)).toBe("");
      expect(run("TEXTAFTER", "aaa", "aa", 1)).toBe("a");
    });

    it("supports match_mode and match_end", () => {
      expect(run("TEXTAFTER", "abXcd", "x", 1, 1)).toBe("cd");
      expect(run("TEXTAFTER", "abc", "-", 1, 0, 1)).toBe("");
      expect(run("TEXTAFTER", "abc", "-", -1, 0, 1)).toBe("abc");
      expect(run("TEXTAFTER", "a-b", "-", -2, 0, 1)).toBe("a-b");
    });

    it("handles empty delimiters and if_not_found", () => {
      expect(run("TEXTAFTER", "abc", "")).toBe("abc");
      expect(run("TEXTAFTER", "abc", "", -1)).toBe("");
      expect(run("TEXTAFTER", "abc", "x")).toBe(NA);
      expect(run("TEXTAFTER", "abc", "x", 1, 0, 0, "-")).toBe("-");
    });
  });

  describe("TEXTSPLIT", () => {
    it("splits into columns", () => {
      expect(grid(F.TEXTSPLIT("a,b,c", ","))).toEqual([["a", "b", "c"]]);
    });

    it("splits into rows and columns, padding with #N/A", () => {
      expect(grid(F.TEXTSPLIT("a,b;c", ",", ";"))).toEqual([
        ["a", "b"],
        ["c", NA],
      ]);
    });

    it("splits only rows when the column delimiter is omitted", () => {
      expect(grid(F.TEXTSPLIT("a;b", undefined, ";"))).toEqual([["a"], ["b"]]);
    });

    it("keeps empty values unless ignore_empty", () => {
      expect(grid(F.TEXTSPLIT("a,,b", ","))).toEqual([["a", "", "b"]]);
      expect(grid(F.TEXTSPLIT("a,,b", ",", undefined, true))).toEqual([
        ["a", "b"],
      ]);
      expect(grid(F.TEXTSPLIT("a;;b", ",", ";", true))).toEqual([["a"], ["b"]]);
    });

    it("accepts arrays of delimiters", () => {
      expect(grid(F.TEXTSPLIT("a,b;c d", [[",", ";", " "]]))).toEqual([
        ["a", "b", "c", "d"],
      ]);
      expect(grid(F.TEXTSPLIT("a, b", [[",", ", "]]))).toEqual([["a", "b"]]);
    });

    it("supports match_mode", () => {
      expect(grid(F.TEXTSPLIT("aXbxc", "x"))).toEqual([["aXb", "c"]]);
      expect(grid(F.TEXTSPLIT("aXbxc", "x", undefined, false, 1))).toEqual([
        ["a", "b", "c"],
      ]);
    });

    it("pads with pad_with", () => {
      expect(grid(F.TEXTSPLIT("a,b;c", ",", ";", false, 0, ""))).toEqual([
        ["a", "b"],
        ["c", ""],
      ]);
      expect(grid(F.TEXTSPLIT("1=2;3", "=", ";", false, 0, 0))).toEqual([
        ["1", "2"],
        ["3", 0],
      ]);
    });

    it("returns the text unsplit when no delimiter occurs", () => {
      expect(grid(F.TEXTSPLIT("abc", ","))).toEqual([["abc"]]);
      expect(grid(F.TEXTSPLIT("", ","))).toEqual([[""]]);
    });

    it("errors on missing delimiters or empty results", () => {
      expect(run("TEXTSPLIT", "abc")).toBe(VALUE);
      expect(run("TEXTSPLIT", "abc", undefined, undefined)).toBe(VALUE);
      expect(run("TEXTSPLIT", ",,", ",", undefined, true)).toBe("#CALC");
    });

    it("returns the first split value per element when given a range", () => {
      expect(grid(F.TEXTSPLIT([["a,b"], ["c,d"]], ","))).toEqual([
        ["a"],
        ["c"],
      ]);
    });
  });

  describe("REGEXTEST", () => {
    it("tests a pattern", () => {
      expect(run("REGEXTEST", "abc123", "[0-9]+")).toBe(true);
      expect(run("REGEXTEST", "abc", "[0-9]+")).toBe(false);
      expect(run("REGEXTEST", "ABC", "^abc$")).toBe(false);
      expect(run("REGEXTEST", "ABC", "^abc$", 1)).toBe(true);
      expect(run("REGEXTEST", "ABC", "(?i)^abc$")).toBe(true);
    });

    it("supports PCRE anchors and unicode classes", () => {
      expect(run("REGEXTEST", "abc", "\\Aabc\\z")).toBe(true);
      expect(run("REGEXTEST", "xabc", "\\Aabc")).toBe(false);
      expect(run("REGEXTEST", "Žluťoučký", "^\\p{L}+$")).toBe(true);
    });

    it("returns #VALUE! for invalid patterns or options", () => {
      expect(run("REGEXTEST", "abc", "(")).toBe(VALUE);
      expect(run("REGEXTEST", "abc", "a", 2)).toBe(VALUE);
    });

    it("lifts over arrays", () => {
      expect(grid(F.REGEXTEST([["a1"], ["b"], [3]], "\\d"))).toEqual([
        [true],
        [false],
        [true],
      ]);
    });
  });

  describe("REGEXEXTRACT", () => {
    it("returns the first match by default", () => {
      expect(run("REGEXEXTRACT", "pressure 12.21bar", "[0-9]+\\.[0-9]+")).toBe(
        "12.21"
      );
      expect(run("REGEXEXTRACT", "abc", "\\d")).toBe(NA);
    });

    it("returns all matches as a column for return_mode 1", () => {
      expect(grid(F.REGEXEXTRACT("DylanWilliams", "[A-Z][a-z]+", 1))).toEqual([
        ["Dylan"],
        ["Williams"],
      ]);
    });

    it("returns capture groups as a row for return_mode 2", () => {
      expect(grid(F.REGEXEXTRACT("John Smith", "(\\w+)\\s(\\w+)", 2))).toEqual([
        ["John", "Smith"],
      ]);
      expect(grid(F.REGEXEXTRACT("ab", "(a)(x)?(b)", 2))).toEqual([
        ["a", "", "b"],
      ]);
    });

    it("supports case_sensitivity and validates return_mode", () => {
      expect(run("REGEXEXTRACT", "ABC", "b", 0, 1)).toBe("B");
      expect(run("REGEXEXTRACT", "ABC", "b")).toBe(NA);
      expect(run("REGEXEXTRACT", "ABC", "b", 3)).toBe(VALUE);
    });

    it("supports named groups in PCRE syntax", () => {
      expect(run("REGEXEXTRACT", "x=5", "(?P<v>\\d)")).toBe("5");
    });
  });

  describe("REGEXREPLACE", () => {
    it("replaces all matches by default", () => {
      expect(run("REGEXREPLACE", "a1b22c", "\\d+", "#")).toBe("a#b#c");
    });

    it("replaces a given occurrence, counting from the end if negative", () => {
      expect(run("REGEXREPLACE", "a1b2c3", "\\d", "#", 2)).toBe("a1b#c3");
      expect(run("REGEXREPLACE", "a1b2c3", "\\d", "#", -1)).toBe("a1b2c#");
      expect(run("REGEXREPLACE", "a1b2c3", "\\d", "#", 4)).toBe("a1b2c3");
    });

    it("expands group references", () => {
      expect(run("REGEXREPLACE", "John Smith", "(\\w+) (\\w+)", "$2, $1")).toBe(
        "Smith, John"
      );
      expect(
        run("REGEXREPLACE", "John Smith", "(?<f>\\w+) (\\w+)", "${2} ${f}")
      ).toBe("Smith John");
      expect(run("REGEXREPLACE", "5", "\\d", "$$$0")).toBe("$5");
    });

    it("supports case_sensitivity", () => {
      expect(run("REGEXREPLACE", "aAa", "a", "x")).toBe("xAx");
      expect(run("REGEXREPLACE", "aAa", "a", "x", 0, 1)).toBe("xxx");
    });

    it("handles empty matches", () => {
      expect(run("REGEXREPLACE", "abc", "x*", "-")).toBe("-a-b-c-");
    });
  });

  describe("ARRAYTOTEXT", () => {
    const data = [
      [1, "a", true],
      [null, new Error("N/A"), 2.5],
    ];

    it("concise format", () => {
      expect(run("ARRAYTOTEXT", data)).toBe("1, a, TRUE, , #N/A, 2.5");
      expect(run("ARRAYTOTEXT", "x")).toBe("x");
    });

    it("strict format", () => {
      expect(run("ARRAYTOTEXT", data, 1)).toBe('{1,"a",TRUE;,#N/A,2.5}');
      expect(run("ARRAYTOTEXT", [['say "hi"']], 1)).toBe('{"say ""hi"""}');
    });

    it("rejects other formats", () => {
      expect(run("ARRAYTOTEXT", data, 2)).toBe(VALUE);
    });
  });

  describe("VALUETOTEXT", () => {
    it("converts values", () => {
      expect(run("VALUETOTEXT", "abc")).toBe("abc");
      expect(run("VALUETOTEXT", "abc", 1)).toBe('"abc"');
      expect(run("VALUETOTEXT", 1234.5, 1)).toBe("1234.5");
      expect(run("VALUETOTEXT", false)).toBe("FALSE");
      expect(run("VALUETOTEXT", new Error("DIV/0"))).toBe("#DIV/0!");
      expect(run("VALUETOTEXT", null)).toBe("");
      expect(run("VALUETOTEXT", 1, 3)).toBe(VALUE);
    });

    it("lifts over arrays", () => {
      expect(grid(F.VALUETOTEXT([["a", 1]], 1))).toEqual([['"a"', "1"]]);
    });
  });

  describe("NUMBERVALUE", () => {
    it("parses with locale separators", () => {
      expect(run("NUMBERVALUE", "2.500,27", ",", ".")).toBe(2500.27);
      expect(run("NUMBERVALUE", "3.5%")).toBe(0.035);
      expect(run("NUMBERVALUE", "1,234.5")).toBe(1234.5);
      expect(run("NUMBERVALUE", "1'234.5", ".", "'")).toBe(1234.5);
    });

    it("ignores spaces and repeated percent signs", () => {
      expect(run("NUMBERVALUE", " 3 000 ")).toBe(3000);
      expect(run("NUMBERVALUE", "9%%")).toBeCloseTo(0.0009, 12);
      expect(run("NUMBERVALUE", "")).toBe(0);
    });

    it("uses only the first character of the separators", () => {
      expect(run("NUMBERVALUE", "1;5", ";x", "|")).toBe(1.5);
    });

    it("errors on invalid input", () => {
      expect(run("NUMBERVALUE", "1.000,5", ".", ",")).toBe(VALUE);
      expect(run("NUMBERVALUE", "1.2.3")).toBe(VALUE);
      expect(run("NUMBERVALUE", "1,5", ".", ".")).toBe(VALUE);
      expect(run("NUMBERVALUE", "abc")).toBe(VALUE);
      expect(run("NUMBERVALUE", true)).toBe(VALUE);
    });

    it("passes numbers through and treats a comma decimal sensibly", () => {
      expect(run("NUMBERVALUE", 42)).toBe(42);
      expect(run("NUMBERVALUE", "1,5", ",")).toBe(1.5);
    });
  });

  describe("UNICHAR / UNICODE", () => {
    it("UNICHAR", () => {
      expect(run("UNICHAR", 66)).toBe("B");
      expect(run("UNICHAR", 128512)).toBe("😀");
      expect(run("UNICHAR", 65.9)).toBe("A");
      expect(run("UNICHAR", 0)).toBe(VALUE);
      expect(run("UNICHAR", 0x110000)).toBe(VALUE);
      expect(run("UNICHAR", 0xd800)).toBe(NA);
      expect(run("UNICHAR", "x")).toBe(VALUE);
    });

    it("UNICODE", () => {
      expect(run("UNICODE", "B")).toBe(66);
      expect(run("UNICODE", "😀x")).toBe(128512);
      expect(run("UNICODE", 5)).toBe(53);
      expect(run("UNICODE", "")).toBe(VALUE);
    });

    it("lifts over arrays", () => {
      expect(grid(F.UNICODE([["a", "b"]]))).toEqual([[97, 98]]);
    });
  });

  describe("CONCAT / TEXTJOIN", () => {
    it("CONCAT flattens ranges", () => {
      expect(
        run(
          "CONCAT",
          [
            ["a", "b"],
            [null, 1],
          ],
          true,
          "!"
        )
      ).toBe("ab1TRUE!");
      expect(run("CONCAT", [["a", new Error("N/A")]])).toBe(NA);
      expect(run("CONCAT", "x".repeat(32767), "y")).toBe(VALUE);
    });

    it("TEXTJOIN with and without ignore_empty", () => {
      const range = [
        ["a", null],
        ["", "b"],
      ];
      expect(run("TEXTJOIN", ",", true, range, "c")).toBe("a,b,c");
      expect(run("TEXTJOIN", ",", false, range, "c")).toBe("a,,,b,c");
    });

    it("TEXTJOIN cycles through an array of delimiters", () => {
      expect(run("TEXTJOIN", [["-", "+"]], true, [[1, 2, 3, 4]])).toBe(
        "1-2+3-4"
      );
    });

    it("TEXTJOIN errors", () => {
      expect(run("TEXTJOIN", ",", true)).toBe(VALUE);
      expect(run("TEXTJOIN", ",", true, [["a", new Error("REF")]])).toBe(
        "#REF"
      );
      expect(run("TEXTJOIN", "", true, "x".repeat(32767), "y")).toBe(VALUE);
    });
  });

  describe("FIND / SEARCH", () => {
    it("FIND is case-sensitive", () => {
      expect(run("FIND", "M", "Miriam McGovern")).toBe(1);
      expect(run("FIND", "m", "Miriam McGovern")).toBe(6);
      expect(run("FIND", "M", "Miriam McGovern", 3)).toBe(8);
      expect(run("FIND", "x", "abc")).toBe(VALUE);
    });

    it("FIND does not treat wildcards specially", () => {
      expect(run("FIND", "*", "a*b")).toBe(2);
      expect(run("FIND", "?", "abc")).toBe(VALUE);
    });

    it("FIND validates start_num", () => {
      expect(run("FIND", "a", "abc", 0)).toBe(VALUE);
      expect(run("FIND", "a", "abc", 5)).toBe(VALUE);
      expect(run("FIND", "", "abc")).toBe(1);
      expect(run("FIND", "", "abc", 3)).toBe(3);
    });

    it("SEARCH is case-insensitive", () => {
      expect(run("SEARCH", "e", "Statements", 6)).toBe(7);
      expect(run("SEARCH", "MARGIN", "Profit Margin")).toBe(8);
      expect(run("SEARCH", "x", "abc")).toBe(VALUE);
      expect(run("SEARCH", "a", "abc", 0)).toBe(VALUE);
      expect(run("SEARCH", "a", "abc", 5)).toBe(VALUE);
    });

    it("SEARCH supports wildcards and ~ escapes", () => {
      expect(run("SEARCH", "b?d", "abcde")).toBe(2);
      expect(run("SEARCH", "b*e", "abcde")).toBe(2);
      expect(run("SEARCH", "*", "abc")).toBe(1);
      expect(run("SEARCH", "~*", "ab*c")).toBe(3);
      expect(run("SEARCH", "~?", "ab?c")).toBe(3);
      expect(run("SEARCH", "~~", "a~b")).toBe(2);
      expect(run("SEARCH", "~a", "b~a")).toBe(2);
      expect(run("SEARCH", "(.)", "x(.)")).toBe(2);
    });

    it("SEARCH lifts over arrays", () => {
      expect(grid(F.SEARCH("b", [["abc", "xyz"]]))).toEqual([[2, VALUE]]);
    });
  });

  describe("SUBSTITUTE", () => {
    it("replaces all or the nth instance", () => {
      expect(run("SUBSTITUTE", "Sales Data", "Sales", "Cost")).toBe(
        "Cost Data"
      );
      expect(run("SUBSTITUTE", "Quarter 1, 2008", "1", "2", 1)).toBe(
        "Quarter 2, 2008"
      );
      expect(run("SUBSTITUTE", "Quarter 1, 2011", "1", "2", 3)).toBe(
        "Quarter 1, 2012"
      );
      expect(run("SUBSTITUTE", "aaa", "a", "b", 5)).toBe("aaa");
    });

    it("is case-sensitive and ignores an empty old_text", () => {
      expect(run("SUBSTITUTE", "aA", "a", "x")).toBe("xA");
      expect(run("SUBSTITUTE", "abc", "", "x")).toBe("abc");
    });

    it("validates instance_num", () => {
      expect(run("SUBSTITUTE", "abc", "a", "x", 0)).toBe(VALUE);
      expect(run("SUBSTITUTE", "abc", "a", "x", -1)).toBe(VALUE);
    });

    it("coerces numbers", () => {
      expect(run("SUBSTITUTE", 1231, 1, 9)).toBe("9239");
    });
  });

  describe("PROPER / CLEAN / TRIM", () => {
    it("PROPER capitalises after any non-letter", () => {
      expect(run("PROPER", "this is a TITLE")).toBe("This Is A Title");
      expect(run("PROPER", "o'neil")).toBe("O'Neil");
      expect(run("PROPER", "2-way street")).toBe("2-Way Street");
      expect(run("PROPER", "76BudGet")).toBe("76Budget");
      expect(run("PROPER", "élan vital")).toBe("Élan Vital");
      expect(run("PROPER", true)).toBe("True");
    });

    it("CLEAN removes only the first 32 ASCII codes", () => {
      expect(run("CLEAN", "\x09Monthly report\x0a")).toBe("Monthly report");
      expect(run("CLEAN", "a\x00b\x1fc\x7fd e")).toBe("abc\x7fd e");
    });

    it("TRIM collapses runs of spaces only", () => {
      expect(run("TRIM", "  First   Quarter  Earnings ")).toBe(
        "First Quarter Earnings"
      );
      expect(run("TRIM", "a\t\tb")).toBe("a\t\tb");
      expect(run("TRIM", " a ")).toBe(" a ");
    });

    it("lift over arrays", () => {
      expect(grid(F.TRIM([[" a ", "b  c"]]))).toEqual([["a", "b c"]]);
    });
  });

  describe("LEFT / RIGHT / MID", () => {
    it("LEFT and RIGHT", () => {
      expect(run("LEFT", "Sale Price", 4)).toBe("Sale");
      expect(run("LEFT", "Sweden")).toBe("S");
      expect(run("LEFT", "abc", 10)).toBe("abc");
      expect(run("LEFT", "abc", 0)).toBe("");
      expect(run("LEFT", "abc", 1.9)).toBe("a");
      expect(run("LEFT", "abc", -1)).toBe(VALUE);
      expect(run("LEFT", "abc", "x")).toBe(VALUE);
      expect(run("LEFT", 1234.5, 2)).toBe("12");
      expect(run("RIGHT", "Sale Price", 5)).toBe("Price");
      expect(run("RIGHT", "Stock Number")).toBe("r");
      expect(run("RIGHT", "abc", 0)).toBe("");
      expect(run("RIGHT", "abc", 10)).toBe("abc");
      expect(run("RIGHT", "abc", -1)).toBe(VALUE);
      expect(run("RIGHT", false, 2)).toBe("SE");
    });

    it("MID", () => {
      expect(run("MID", "Fluid Flow", 1, 5)).toBe("Fluid");
      expect(run("MID", "Fluid Flow", 7, 20)).toBe("Flow");
      expect(run("MID", "Fluid Flow", 20, 5)).toBe("");
      expect(run("MID", "abc", 0, 1)).toBe(VALUE);
      expect(run("MID", "abc", 1, -1)).toBe(VALUE);
      expect(run("MID", "abc", 2)).toBe(VALUE);
    });

    it("lift over arrays with broadcasting", () => {
      expect(grid(F.LEFT([["abc"], ["de"]], [[1, 2]]))).toEqual([
        ["a", "ab"],
        ["d", "de"],
      ]);
      expect(grid(F.LEFT([["abc", "de"]], [[1, 2, 3]]))).toEqual([
        ["a", "de", NA],
      ]);
    });
  });

  describe("REPT / EXACT / LEN", () => {
    it("REPT", () => {
      expect(run("REPT", "*-", 3)).toBe("*-*-*-");
      expect(run("REPT", "ab", 2.9)).toBe("abab");
      expect(run("REPT", "ab", 0)).toBe("");
      expect(run("REPT", "ab", -1)).toBe(VALUE);
      expect(run("REPT", "ab", 16384)).toBe(VALUE);
      expect(run("REPT", "ab", 16383)).toHaveLength(32766);
    });

    it("EXACT", () => {
      expect(run("EXACT", "word", "word")).toBe(true);
      expect(run("EXACT", "Word", "word")).toBe(false);
      expect(run("EXACT", "w ord", "word")).toBe(false);
      expect(run("EXACT", true, "TRUE")).toBe(true);
      expect(run("EXACT", 1.5, "1.5")).toBe(true);
      expect(run("EXACT", null, "")).toBe(true);
    });

    it("LEN", () => {
      expect(run("LEN", "Phoenix, AZ")).toBe(11);
      expect(run("LEN", "")).toBe(0);
      expect(run("LEN", null)).toBe(0);
      expect(run("LEN", true)).toBe(4);
      expect(run("LEN", false)).toBe(5);
      expect(run("LEN", 1023)).toBe(4);
      expect(run("LEN", 1 / 3)).toBe(17);
      expect(run("LEN", -0.5)).toBe(4);
      expect(
        grid(
          F.LEN([
            ["a", "bb"],
            [null, 123],
          ])
        )
      ).toEqual([
        [1, 2],
        [0, 3],
      ]);
    });

    it("stringifies numbers like Excel", () => {
      expect(run("CONCAT", 1 / 3)).toBe("0.333333333333333");
      expect(run("CONCAT", 0.1 + 0.2)).toBe("0.3");
      expect(run("CONCAT", 1e15)).toBe("1E+15");
      expect(run("CONCAT", 123456789012345)).toBe("123456789012345");
      expect(run("CONCAT", 123456789012345680)).toBe("1.23456789012346E+17");
      expect(run("CONCAT", 0.000001)).toBe("0.000001");
      expect(run("CONCAT", 1.5e-10)).toBe("1.5E-10");
      expect(run("CONCAT", -42)).toBe("-42");
      expect(run("CONCAT", NaN)).toBe(NUM);
    });
  });

  describe("VALUE", () => {
    it("parses numbers", () => {
      expect(run("VALUE", "$1,000")).toBe(1000);
      expect(run("VALUE", "1,234.5")).toBe(1234.5);
      expect(run("VALUE", " 42 ")).toBe(42);
      expect(run("VALUE", "50%")).toBe(0.5);
      expect(run("VALUE", "-$12")).toBe(-12);
      expect(run("VALUE", "$-12")).toBe(-12);
      expect(run("VALUE", "(1,000)")).toBe(-1000);
      expect(run("VALUE", "1.5E3")).toBe(1500);
      expect(run("VALUE", ".5")).toBe(0.5);
      expect(run("VALUE", "1 1/2")).toBe(1.5);
      expect(run("VALUE", 7)).toBe(7);
      expect(run("VALUE", null)).toBe(0);
    });

    it("parses dates and times to serial numbers", () => {
      expect(run("VALUE", "2024-01-15")).toBe(45306);
      expect(run("VALUE", "1/15/2024")).toBe(45306);
      expect(run("VALUE", "15-Jan-2024")).toBe(45306);
      expect(run("VALUE", "January 15, 2024")).toBe(45306);
      expect(run("VALUE", "Jan 15 2024")).toBe(45306);
      expect(run("VALUE", "1/1/1900")).toBe(1);
      expect(run("VALUE", "2/29/1900")).toBe(60);
      expect(run("VALUE", "3/1/1900")).toBe(61);
      expect(run("VALUE", "12/31/99")).toBe(36525);
      expect(run("VALUE", "16:48:00")).toBeCloseTo(0.7, 12);
      expect(run("VALUE", "12:00 PM")).toBe(0.5);
      expect(run("VALUE", "12:00 AM")).toBe(0);
      expect(run("VALUE", "6 PM")).toBe(0.75);
      expect(run("VALUE", "2024-01-15 06:00")).toBe(45306.25);
    });

    it("returns #VALUE! for non-numeric text", () => {
      expect(run("VALUE", "foo")).toBe(VALUE);
      expect(run("VALUE", "")).toBe(VALUE);
      expect(run("VALUE", true)).toBe(VALUE);
      expect(run("VALUE", "1,23")).toBe(VALUE);
      expect(run("VALUE", "2/30/2024")).toBe(VALUE);
      expect(run("VALUE", "12:60")).toBe(VALUE);
      expect(run("VALUE", "-(5)")).toBe(VALUE);
    });

    it("coerces numeric text in numeric arguments", () => {
      expect(run("LEFT", "abcdef", "2")).toBe("ab");
      expect(run("REPT", "a", "3")).toBe("aaa");
    });
  });
});

describe("text functions through the Parser", () => {
  let parser;

  beforeEach(() => {
    parser = new Parser();
    parser.on("callRangeValue", (start, end, options, done) => {
      done([["alpha-1"], ["beta"], ["gamma-3"]]);
    });
  });

  it("evaluates modern text functions", () => {
    expect(parser.parse('TEXTBEFORE("a-b","-")')).toEqual({
      error: null,
      result: "a",
    });
    expect(parser.parse('TEXTAFTER("a-b-c","-",-1)')).toEqual({
      error: null,
      result: "c",
    });
    expect(parser.parse('TEXTBEFORE("abc","-")')).toEqual({
      error: "#N/A",
      result: null,
    });
    expect(parser.parse('TEXTSPLIT("a,b;c,d",",",";")')).toEqual({
      error: null,
      result: [
        ["a", "b"],
        ["c", "d"],
      ],
    });
    expect(parser.parse('REGEXTEST("abc123","\\d+")')).toEqual({
      error: null,
      result: true,
    });
    expect(parser.parse('REGEXREPLACE("a1b2","[0-9]","#")')).toEqual({
      error: null,
      result: "a#b#",
    });
    expect(parser.parse('TEXTJOIN(", ",TRUE,"a","","b")')).toEqual({
      error: null,
      result: "a, b",
    });
    expect(parser.parse('PROPER("o\'neil")')).toEqual({
      error: null,
      result: "O'Neil",
    });
    expect(parser.parse('SEARCH("b*d","abcde")')).toEqual({
      error: null,
      result: 2,
    });
    expect(parser.parse('VALUE("50%")')).toEqual({ error: null, result: 0.5 });
    expect(parser.parse("UNICHAR(0)")).toEqual({
      error: "#VALUE!",
      result: null,
    });
  });

  it("lifts scalar functions over ranges", () => {
    expect(parser.parse("LEN(A1:A3)")).toEqual({
      error: null,
      result: [[7], [4], [7]],
    });
    const { result } = parser.parse('TEXTAFTER(A1:A3,"-")');
    expect(grid(result)).toEqual([["1"], [NA], ["3"]]);
    expect(parser.parse('TEXTJOIN(";",TRUE,A1:A3)')).toEqual({
      error: null,
      result: "alpha-1;beta;gamma-3",
    });
    expect(parser.parse('CONCAT(A1:A3,"!")')).toEqual({
      error: null,
      result: "alpha-1betagamma-3!",
    });
  });
});
