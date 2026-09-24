import fns from "../../../src/functions/lookup-array";
import {
  ERROR_CALC,
  ERROR_NOT_AVAILABLE,
  ERROR_NUM,
  ERROR_REF,
  ERROR_VALUE,
} from "../../../src/error";

const {
  XLOOKUP,
  XMATCH,
  MATCH,
  VLOOKUP,
  HLOOKUP,
  LOOKUP,
  INDEX,
  FILTER,
  SORT,
  SORTBY,
  UNIQUE,
  SEQUENCE,
  RANDARRAY,
  TAKE,
  DROP,
  EXPAND,
  TOCOL,
  TOROW,
  WRAPROWS,
  WRAPCOLS,
  CHOOSEROWS,
  CHOOSECOLS,
  HSTACK,
  VSTACK,
  TRIMRANGE,
} = fns;

/** Error code thrown or returned by `fn`, or undefined when it succeeds. */
function errorOf(fn) {
  try {
    const v = fn();
    return v instanceof Error ? v.message : undefined;
  } catch (e) {
    return e.message;
  }
}

/** Replace Error instances inside an array result by their code. */
function codes(v) {
  if (Array.isArray(v)) return v.map(codes);
  return v instanceof Error ? `#${v.message}` : v;
}

const col = (...values) => values.map((v) => [v]);
const row = (...values) => [values];

describe("lookup-array module", () => {
  it("exports every workstream function", () => {
    [
      "XLOOKUP",
      "XMATCH",
      "FILTER",
      "SORTBY",
      "SEQUENCE",
      "RANDARRAY",
      "TAKE",
      "DROP",
      "EXPAND",
      "TOCOL",
      "TOROW",
      "WRAPCOLS",
      "WRAPROWS",
      "CHOOSEROWS",
      "CHOOSECOLS",
      "HSTACK",
      "VSTACK",
      "TRIMRANGE",
      "UNIQUE",
      "SORT",
      "VLOOKUP",
      "HLOOKUP",
      "MATCH",
      "INDEX",
      "LOOKUP",
    ].forEach((name) => expect(typeof fns[name]).toBe("function"));
  });
});

describe("XLOOKUP", () => {
  const keys = col("a", "b", "c");
  const vals = col(1, 2, 3);

  it("finds an exact match, case-insensitively", () => {
    expect(XLOOKUP("b", keys, vals)).toBe(2);
    expect(XLOOKUP("C", keys, vals)).toBe(3);
  });

  it("returns #N/A or if_not_found when nothing matches", () => {
    expect(errorOf(() => XLOOKUP("z", keys, vals))).toBe(ERROR_NOT_AVAILABLE);
    expect(XLOOKUP("z", keys, vals, "none")).toBe("none");
    expect(XLOOKUP("z", keys, vals, 0)).toBe(0);
    expect(errorOf(() => XLOOKUP("z", keys, vals, null))).toBe(
      ERROR_NOT_AVAILABLE
    );
  });

  it("does not coerce between text and numbers", () => {
    expect(errorOf(() => XLOOKUP("1", col(1, 2), col("x", "y")))).toBe(
      ERROR_NOT_AVAILABLE
    );
    expect(XLOOKUP(true, col(1, true), col("x", "y"))).toBe("y");
  });

  it("returns a whole row for a vertical lookup", () => {
    const table = [
      [1, "x", 10],
      [2, "y", 20],
    ];
    expect(XLOOKUP(2, col(1, 2), table)).toEqual([[2, "y", 20]]);
  });

  it("returns a whole column for a horizontal lookup", () => {
    expect(
      XLOOKUP("b", row("a", "b", "c"), [
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toEqual([[2], [5]]);
  });

  it("rejects mismatched or two-dimensional arrays with #VALUE!", () => {
    expect(errorOf(() => XLOOKUP("a", keys, col(1, 2)))).toBe(ERROR_VALUE);
    expect(errorOf(() => XLOOKUP("a", row("a", "b"), row(1, 2, 3)))).toBe(
      ERROR_VALUE
    );
    expect(
      errorOf(() =>
        XLOOKUP(
          1,
          [
            [1, 2],
            [3, 4],
          ],
          col(1, 2)
        )
      )
    ).toBe(ERROR_VALUE);
  });

  it("validates match_mode and search_mode", () => {
    expect(errorOf(() => XLOOKUP("a", keys, vals, "x", 3))).toBe(ERROR_VALUE);
    expect(errorOf(() => XLOOKUP("a", keys, vals, "x", 0, 0))).toBe(
      ERROR_VALUE
    );
    expect(errorOf(() => XLOOKUP("a", keys, vals, "x", 0, 3))).toBe(
      ERROR_VALUE
    );
    // Wildcards are not allowed with binary search.
    expect(errorOf(() => XLOOKUP("a", keys, vals, "x", 2, 2))).toBe(
      ERROR_VALUE
    );
    expect(errorOf(() => XLOOKUP("a", keys, vals, "x", 2, -2))).toBe(
      ERROR_VALUE
    );
  });

  it("match_mode -1 / 1 find the next smaller / larger item", () => {
    const nums = col(30, 10, 20, 40);
    const ret = col("thirty", "ten", "twenty", "forty");
    expect(XLOOKUP(25, nums, ret, "none", -1)).toBe("twenty");
    expect(XLOOKUP(25, nums, ret, "none", 1)).toBe("thirty");
    expect(XLOOKUP(20, nums, ret, "none", 1)).toBe("twenty");
    expect(XLOOKUP(5, nums, ret, "none", -1)).toBe("none");
    expect(XLOOKUP(50, nums, ret, "none", 1)).toBe("none");
    expect(XLOOKUP(25, nums, ret, "none", 0)).toBe("none");
  });

  it("match_mode -1 / 1 ignore values of a different type", () => {
    expect(
      XLOOKUP(2, col(1, "a", 3, true), col("w", "x", "y", "z"), "", 1)
    ).toBe("y");
    expect(XLOOKUP("b", col("a", 5, "c"), col(1, 2, 3), "", 1)).toBe(3);
  });

  it("match_mode 2 supports * ? and ~ wildcards", () => {
    const words = col("apple", "banana", "a*b", "axb");
    const idx = col(1, 2, 3, 4);
    expect(XLOOKUP("b*", words, idx, "", 2)).toBe(2);
    expect(XLOOKUP("?PPLE", words, idx, "", 2)).toBe(1);
    expect(XLOOKUP("a~*b", words, idx, "", 2)).toBe(3);
    expect(XLOOKUP("a?b", words, idx, "", 2)).toBe(3);
    expect(XLOOKUP("*na*", words, idx, "", 2)).toBe(2);
    expect(XLOOKUP("b*", words, idx, "none", 0)).toBe("none");
  });

  it("search_mode -1 searches from the end", () => {
    const k = col(1, 2, 1);
    const r = col("first", "second", "third");
    expect(XLOOKUP(1, k, r)).toBe("first");
    expect(XLOOKUP(1, k, r, "", 0, -1)).toBe("third");
    // Ties in approximate matching keep the first hit in search order.
    expect(XLOOKUP(1.5, k, r, "", -1, -1)).toBe("third");
    expect(XLOOKUP(1.5, k, r, "", -1, 1)).toBe("first");
  });

  it("search_mode 2 performs a binary search on ascending data", () => {
    const k = col(1, 3, 5, 7);
    const r = col("one", "three", "five", "seven");
    expect(XLOOKUP(5, k, r, "none", 0, 2)).toBe("five");
    expect(XLOOKUP(4, k, r, "none", 0, 2)).toBe("none");
    expect(XLOOKUP(4, k, r, "none", -1, 2)).toBe("three");
    expect(XLOOKUP(4, k, r, "none", 1, 2)).toBe("five");
    expect(XLOOKUP(0, k, r, "none", -1, 2)).toBe("none");
    expect(XLOOKUP(8, k, r, "none", 1, 2)).toBe("none");
    expect(XLOOKUP(8, k, r, "none", -1, 2)).toBe("seven");
  });

  it("search_mode -2 performs a binary search on descending data", () => {
    const k = col(7, 5, 3, 1);
    const r = col("seven", "five", "three", "one");
    expect(XLOOKUP(5, k, r, "none", 0, -2)).toBe("five");
    expect(XLOOKUP(4, k, r, "none", -1, -2)).toBe("three");
    expect(XLOOKUP(4, k, r, "none", 1, -2)).toBe("five");
    expect(XLOOKUP(9, k, r, "none", 1, -2)).toBe("none");
    expect(XLOOKUP(0, k, r, "none", -1, -2)).toBe("none");
  });

  it("binary search compares text case-insensitively", () => {
    const k = col("apple", "Banana", "cherry");
    expect(XLOOKUP("BANANA", k, col(1, 2, 3), "", 0, 2)).toBe(2);
    expect(XLOOKUP("blueberry", k, col(1, 2, 3), "", -1, 2)).toBe(2);
  });

  it("returns 0 when the matched cell is blank", () => {
    expect(XLOOKUP("b", keys, col(1, null, 3))).toBe(0);
  });

  it("skips blank and error cells in the lookup array", () => {
    expect(XLOOKUP(2, col(null, "#N/A", 2), col("a", "b", "c"))).toBe("c");
  });

  it("propagates an error lookup value", () => {
    expect(errorOf(() => XLOOKUP("#DIV/0!", keys, vals))).toBe("DIV/0");
    expect(errorOf(() => XLOOKUP(new Error(ERROR_REF), keys, vals))).toBe(
      ERROR_REF
    );
  });

  it("lifts over an array of lookup values", () => {
    expect(codes(XLOOKUP(col("c", "a", "q"), keys, vals))).toEqual([
      [3],
      [1],
      ["#N/A"],
    ]);
    expect(XLOOKUP(row("a", "b"), keys, vals)).toEqual([[1, 2]]);
  });

  it("accepts single-cell lookup and return arrays", () => {
    expect(XLOOKUP(1, [[1]], [["x"]])).toBe("x");
    expect(XLOOKUP(1, [[1]], row("x", "y"))).toEqual([["x", "y"]]);
    expect(XLOOKUP(1, [[1]], col("x", "y"))).toEqual([["x"], ["y"]]);
  });

  it("requires three arguments", () => {
    expect(errorOf(() => XLOOKUP(1, col(1)))).toBe(ERROR_VALUE);
  });
});

describe("XMATCH", () => {
  const list = col("Apple", "Banana", "Cherry", "Banana");

  it("returns the 1-based position of an exact match", () => {
    expect(XMATCH("banana", list)).toBe(2);
    expect(XMATCH("banana", list, 0, -1)).toBe(4);
    expect(XMATCH("cherry", row("apple", "cherry"))).toBe(2);
    expect(errorOf(() => XMATCH("kiwi", list))).toBe(ERROR_NOT_AVAILABLE);
  });

  it("supports approximate, wildcard and binary modes", () => {
    const nums = col(10, 20, 30, 40);
    expect(XMATCH(25, nums, -1)).toBe(2);
    expect(XMATCH(25, nums, 1)).toBe(3);
    expect(XMATCH(40, nums, 0, 2)).toBe(4);
    expect(XMATCH(35, nums, 1, 2)).toBe(4);
    expect(XMATCH("c*", list, 2)).toBe(3);
    expect(XMATCH("*an*", list, 2, -1)).toBe(4);
  });

  it("rejects two-dimensional arrays and invalid modes", () => {
    expect(
      errorOf(() =>
        XMATCH(1, [
          [1, 2],
          [3, 4],
        ])
      )
    ).toBe(ERROR_VALUE);
    expect(errorOf(() => XMATCH(1, col(1), 5))).toBe(ERROR_VALUE);
    expect(errorOf(() => XMATCH(1, col(1), 0, 3))).toBe(ERROR_VALUE);
  });

  it("lifts over an array of lookup values", () => {
    expect(codes(XMATCH(row("cherry", "kiwi", "apple"), list))).toEqual([
      [3, "#N/A", 1],
    ]);
  });
});

describe("MATCH", () => {
  it("keeps legacy behaviour for missing arguments", () => {
    expect(errorOf(() => MATCH())).toBe(ERROR_NOT_AVAILABLE);
    expect(errorOf(() => MATCH(1))).toBe(ERROR_NOT_AVAILABLE);
  });

  it("match_type 1 (default) finds the largest value <= lookup_value", () => {
    const sorted = col(10, 20, 30, 40);
    expect(MATCH(25, sorted)).toBe(2);
    expect(MATCH(30, sorted, 1)).toBe(3);
    expect(MATCH(99, sorted, 1)).toBe(4);
    expect(errorOf(() => MATCH(5, sorted, 1))).toBe(ERROR_NOT_AVAILABLE);
    // With duplicates the last one is returned, as in Excel.
    expect(MATCH(2, row(1, 2, 2, 2, 3), 1)).toBe(4);
    // Any positive match_type behaves like 1.
    expect(MATCH(25, sorted, 2)).toBe(2);
  });

  it("match_type -1 finds the smallest value >= lookup_value", () => {
    const desc = col(40, 30, 20, 10);
    expect(MATCH(25, desc, -1)).toBe(2);
    expect(MATCH(20, desc, -1)).toBe(3);
    expect(MATCH(5, desc, -1)).toBe(4);
    expect(errorOf(() => MATCH(45, desc, -1))).toBe(ERROR_NOT_AVAILABLE);
  });

  it("match_type 0 is exact, case-insensitive and supports wildcards", () => {
    const names = col("jima", "jimb", "jimc", "bernie");
    expect(MATCH("JIMB", names, 0)).toBe(2);
    expect(MATCH("b*", names, 0)).toBe(4);
    expect(MATCH("jim?", names, 0)).toBe(1);
    expect(errorOf(() => MATCH("j?b", names, 0))).toBe(ERROR_NOT_AVAILABLE);
    expect(MATCH("a~?", col("ab", "a?"), 0)).toBe(2);
    expect(errorOf(() => MATCH("1", col(1, 2), 0))).toBe(ERROR_NOT_AVAILABLE);
  });

  it("approximate matching ignores other types", () => {
    expect(MATCH(3, col(1, "x", 2, true, 4), 1)).toBe(3);
    expect(MATCH("m", col("a", 5, "k", "z"), 1)).toBe(3);
  });

  it("works on 1D arrays and rejects 2D arrays with #N/A", () => {
    expect(MATCH(1, [0, 1, 2, 3, 4, 100, 7])).toBe(2);
    expect(MATCH(4, [0, 1, 2, 3, 4, 100, 7], 1)).toBe(5);
    expect(
      errorOf(() =>
        MATCH(1, [
          [1, 2],
          [3, 4],
        ])
      )
    ).toBe(ERROR_NOT_AVAILABLE);
  });

  it("lifts over an array of lookup values", () => {
    expect(codes(MATCH(row(20, 5), col(10, 20, 30), 0))).toEqual([[2, "#N/A"]]);
  });
});

describe("VLOOKUP / HLOOKUP", () => {
  const table = [
    [1, "one", "I"],
    [2, "two", null],
    [3, "three", "III"],
  ];

  it("VLOOKUP exact match", () => {
    expect(VLOOKUP(2, table, 2, false)).toBe("two");
    expect(VLOOKUP(3, table, 3, 0)).toBe("III");
    expect(errorOf(() => VLOOKUP(4, table, 2, false))).toBe(
      ERROR_NOT_AVAILABLE
    );
  });

  it("VLOOKUP approximate match is the default", () => {
    expect(VLOOKUP(2.5, table, 2)).toBe("two");
    expect(VLOOKUP(10, table, 2, true)).toBe("three");
    expect(errorOf(() => VLOOKUP(0.5, table, 2))).toBe(ERROR_NOT_AVAILABLE);
  });

  it("VLOOKUP validates col_index_num", () => {
    expect(errorOf(() => VLOOKUP(2, table, 0, false))).toBe(ERROR_VALUE);
    expect(errorOf(() => VLOOKUP(2, table, 4, false))).toBe(ERROR_REF);
    expect(errorOf(() => VLOOKUP(99, table, 4, false))).toBe(ERROR_REF);
  });

  it("VLOOKUP returns 0 for a blank result cell", () => {
    expect(VLOOKUP(2, table, 3, false)).toBe(0);
  });

  it("VLOOKUP exact match is case-insensitive and supports wildcards", () => {
    const t = [
      ["Alpha", 1],
      ["Beta", 2],
    ];
    expect(VLOOKUP("beta", t, 2, false)).toBe(2);
    expect(VLOOKUP("b*", t, 2, false)).toBe(2);
    expect(VLOOKUP("?lpha", t, 2, false)).toBe(1);
  });

  it("VLOOKUP lifts over col_index_num arrays", () => {
    expect(VLOOKUP(3, table, row(2, 3), false)).toEqual([["three", "III"]]);
  });

  it("HLOOKUP", () => {
    const h = [
      ["a", "b", "c"],
      [1, 2, 3],
      [10, 20, 30],
    ];
    expect(HLOOKUP("b", h, 3, false)).toBe(20);
    expect(HLOOKUP("bb", h, 2)).toBe(2);
    expect(errorOf(() => HLOOKUP("z", h, 2, false))).toBe(ERROR_NOT_AVAILABLE);
    expect(errorOf(() => HLOOKUP("b", h, 4, false))).toBe(ERROR_REF);
    expect(errorOf(() => HLOOKUP("b", h, 0, false))).toBe(ERROR_VALUE);
  });
});

describe("LOOKUP", () => {
  it("vector form", () => {
    const k = col(4.14, 4.19, 5.17, 5.77, 6.39);
    const r = col("red", "orange", "yellow", "green", "blue");
    expect(LOOKUP(4.19, k, r)).toBe("orange");
    expect(LOOKUP(5.75, k, r)).toBe("yellow");
    expect(LOOKUP(7.66, k, r)).toBe("blue");
    expect(errorOf(() => LOOKUP(0, k, r))).toBe(ERROR_NOT_AVAILABLE);
    // The result vector may have a different orientation.
    expect(LOOKUP(5.2, k, row("a", "b", "c", "d", "e"))).toBe("c");
  });

  it("array form searches the longer dimension", () => {
    const wide = [
      ["a", "b", "c", "d"],
      [1, 2, 3, 4],
    ];
    expect(LOOKUP("c", wide)).toBe(3);
    const tall = [
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ];
    expect(LOOKUP("bump", tall)).toBe(2);
    expect(LOOKUP(3, col(1, 2, 3))).toBe(3);
  });
});

describe("INDEX", () => {
  const a = [
    [1, 2, 3],
    [4, 5, 6],
  ];

  it("returns a single cell", () => {
    expect(INDEX(a, 2, 3)).toBe(6);
    expect(INDEX(a, 1, 1)).toBe(1);
  });

  it("row 0 / column 0 return a whole column / row", () => {
    expect(INDEX(a, 0, 2)).toEqual([[2], [5]]);
    expect(INDEX(a, 1, 0)).toEqual([[1, 2, 3]]);
    expect(INDEX(a, 0, 0)).toEqual(a);
    expect(INDEX(a, 2)).toEqual([[4, 5, 6]]);
  });

  it("uses the only index as the column for a single-row array", () => {
    expect(INDEX(row(10, 20, 30), 2)).toBe(20);
    expect(INDEX(col(10, 20, 30), 3)).toBe(30);
    expect(INDEX([10, 20, 30], 3)).toBe(30);
  });

  it("returns #REF! out of range and #VALUE! for negatives", () => {
    expect(errorOf(() => INDEX(a, 3, 1))).toBe(ERROR_REF);
    expect(errorOf(() => INDEX(a, 1, 4))).toBe(ERROR_REF);
    expect(errorOf(() => INDEX(a, -1, 1))).toBe(ERROR_VALUE);
  });

  it("supports area_num 1 only", () => {
    expect(INDEX(a, 1, 2, 1)).toBe(2);
    expect(errorOf(() => INDEX(a, 1, 2, 2))).toBe(ERROR_REF);
    expect(errorOf(() => INDEX(a, 1, 2, 0))).toBe(ERROR_VALUE);
  });

  it("returns 0 for a blank cell and lifts over index arrays", () => {
    expect(INDEX(col(null, 1), 1)).toBe(0);
    expect(INDEX(a, col(1, 2), row(1, 3))).toEqual([
      [1, 3],
      [4, 6],
    ]);
  });
});

describe("FILTER", () => {
  const data = [
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ];

  it("filters rows with a column include array", () => {
    expect(FILTER(data, col(true, false, true))).toEqual([
      ["a", 1],
      ["c", 3],
    ]);
    expect(FILTER(data, col(0, 5, null))).toEqual([["b", 2]]);
  });

  it("filters columns with a row include array", () => {
    expect(FILTER(data, row(false, true))).toEqual([[1], [2], [3]]);
  });

  it("returns if_empty or #CALC! when nothing is kept", () => {
    expect(errorOf(() => FILTER(data, col(false, false, false)))).toBe(
      ERROR_CALC
    );
    expect(FILTER(data, col(false, false, false), "none")).toBe("none");
    expect(errorOf(() => FILTER(data, row(false, 0)))).toBe(ERROR_CALC);
  });

  it("rejects size mismatches and text, and propagates errors", () => {
    expect(errorOf(() => FILTER(data, col(true, false)))).toBe(ERROR_VALUE);
    expect(errorOf(() => FILTER(data, col(true, "x", true)))).toBe(ERROR_VALUE);
    expect(errorOf(() => FILTER(data, col(true, "#DIV/0!", true)))).toBe(
      "DIV/0"
    );
  });

  it("returns a scalar for a single kept cell", () => {
    expect(FILTER(col(1, 2, 3), col(false, true, false))).toBe(2);
  });
});

describe("SORT", () => {
  it("sorts a column ascending and descending", () => {
    expect(SORT(col(3, 1, 2))).toEqual(col(1, 2, 3));
    expect(SORT(col(3, 1, 2), 1, -1)).toEqual(col(3, 2, 1));
  });

  it("orders numbers < text < logicals < errors with blanks last", () => {
    const mixed = col(3, "b", true, null, "#N/A", "A", 1, false);
    expect(SORT(mixed)).toEqual(col(1, 3, "A", "b", false, true, "#N/A", null));
    expect(SORT(mixed, 1, -1)).toEqual(
      col("#N/A", true, false, "b", "A", 3, 1, null)
    );
  });

  it("sorts rows by sort_index and keeps equal keys stable", () => {
    const t = [
      ["b", 2],
      ["a", 2],
      ["c", 1],
    ];
    expect(SORT(t, 2)).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 2],
    ]);
  });

  it("supports multiple sort keys", () => {
    const t = [
      ["x", 1],
      ["y", 2],
      ["x", 3],
      ["y", 1],
    ];
    expect(SORT(t, row(1, 2), row(1, -1))).toEqual([
      ["x", 3],
      ["x", 1],
      ["y", 2],
      ["y", 1],
    ]);
  });

  it("sorts columns when by_col is TRUE", () => {
    expect(
      SORT(
        [
          [3, 1, 2],
          ["c", "a", "b"],
        ],
        1,
        1,
        true
      )
    ).toEqual([
      [1, 2, 3],
      ["a", "b", "c"],
    ]);
  });

  it("validates sort_index and sort_order", () => {
    expect(errorOf(() => SORT(col(1, 2), 2))).toBe(ERROR_VALUE);
    expect(errorOf(() => SORT(col(1, 2), 0))).toBe(ERROR_VALUE);
    expect(errorOf(() => SORT(col(1, 2), 1, 0))).toBe(ERROR_VALUE);
    expect(errorOf(() => SORT(col(1, 2), 1, 2))).toBe(ERROR_VALUE);
  });
});

describe("SORTBY", () => {
  const names = col("Tom", "Fred", "Amy", "Sal");
  const ages = col(52, 65, 22, 65);

  it("sorts rows by another column", () => {
    expect(SORTBY(names, ages)).toEqual(col("Amy", "Tom", "Fred", "Sal"));
    expect(SORTBY(names, ages, -1)).toEqual(col("Fred", "Sal", "Tom", "Amy"));
  });

  it("supports several keys", () => {
    expect(SORTBY(names, ages, -1, names, 1)).toEqual(
      col("Fred", "Sal", "Tom", "Amy")
    );
    expect(SORTBY(names, ages, -1, names, -1)).toEqual(
      col("Sal", "Fred", "Tom", "Amy")
    );
  });

  it("sorts columns with a row key", () => {
    expect(
      SORTBY(
        [
          ["a", "b", "c"],
          [1, 2, 3],
        ],
        row(3, 1, 2)
      )
    ).toEqual([
      ["b", "c", "a"],
      [2, 3, 1],
    ]);
  });

  it("rejects bad keys and orders", () => {
    expect(errorOf(() => SORTBY(names))).toBe(ERROR_VALUE);
    expect(errorOf(() => SORTBY(names, col(1, 2)))).toBe(ERROR_VALUE);
    expect(errorOf(() => SORTBY(names, ages, 2))).toBe(ERROR_VALUE);
    expect(
      errorOf(() =>
        SORTBY(
          [
            [1, 2],
            [3, 4],
          ],
          col(1, 2),
          1,
          row(1, 2)
        )
      )
    ).toBe(ERROR_VALUE);
  });
});

describe("UNIQUE", () => {
  it("removes duplicate rows case-insensitively, keeping the first", () => {
    expect(UNIQUE(col("a", "B", "A", "b", "c"))).toEqual(col("a", "B", "c"));
    expect(
      UNIQUE([
        [1, "x"],
        [1, "y"],
        [1, "X"],
      ])
    ).toEqual([
      [1, "x"],
      [1, "y"],
    ]);
  });

  it("distinguishes numbers from numeric text", () => {
    expect(UNIQUE(col(1, "1", 1))).toEqual(col(1, "1"));
  });

  it("supports by_col", () => {
    expect(
      UNIQUE(
        [
          [1, 2, 1],
          ["a", "b", "a"],
        ],
        true
      )
    ).toEqual([
      [1, 2],
      ["a", "b"],
    ]);
  });

  it("supports exactly_once", () => {
    expect(UNIQUE(col(1, 2, 1, 3), false, true)).toEqual(col(2, 3));
    expect(errorOf(() => UNIQUE(col(1, 1), false, true))).toBe(ERROR_CALC);
  });

  it("returns a scalar when one value remains", () => {
    expect(UNIQUE(col(5, 5, 5))).toBe(5);
  });
});

describe("SEQUENCE", () => {
  it("builds row-major sequences", () => {
    expect(SEQUENCE(3)).toEqual(col(1, 2, 3));
    expect(SEQUENCE(2, 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(SEQUENCE(2, 2, 10, -2)).toEqual([
      [10, 8],
      [6, 4],
    ]);
    expect(SEQUENCE(1, 3, 0.5, 0.25)).toEqual([[0.5, 0.75, 1]]);
    expect(SEQUENCE(1)).toBe(1);
    expect(SEQUENCE(2.9)).toEqual(col(1, 2));
  });

  it("returns #CALC! for zero and #VALUE! for negative sizes", () => {
    expect(errorOf(() => SEQUENCE(0))).toBe(ERROR_CALC);
    expect(errorOf(() => SEQUENCE(2, 0))).toBe(ERROR_CALC);
    expect(errorOf(() => SEQUENCE(-1))).toBe(ERROR_VALUE);
    expect(errorOf(() => SEQUENCE("x"))).toBe(ERROR_VALUE);
    expect(errorOf(() => SEQUENCE(2000000))).toBe(ERROR_VALUE);
    expect(errorOf(() => SEQUENCE(1048576, 100))).toBe(ERROR_NUM);
  });
});

describe("RANDARRAY", () => {
  it("fills the requested shape with values in range", () => {
    const r = RANDARRAY(3, 2, 5, 10);
    expect(r).toHaveLength(3);
    r.forEach((line) => {
      expect(line).toHaveLength(2);
      line.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
      });
    });
    const one = RANDARRAY();
    expect(one).toBeGreaterThanOrEqual(0);
    expect(one).toBeLessThan(1);
  });

  it("returns whole numbers when asked", () => {
    const r = RANDARRAY(50, 1, 1, 3, true);
    r.forEach(([v]) => {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
    });
  });

  it("validates arguments", () => {
    expect(errorOf(() => RANDARRAY(2, 2, 5, 1))).toBe(ERROR_VALUE);
    expect(errorOf(() => RANDARRAY(0))).toBe(ERROR_CALC);
    expect(errorOf(() => RANDARRAY(-1))).toBe(ERROR_VALUE);
    expect(errorOf(() => RANDARRAY(1, 1, 1.2, 1.8, true))).toBe(ERROR_VALUE);
  });
});

describe("TAKE / DROP", () => {
  const a = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  it("TAKE from the start or the end", () => {
    expect(TAKE(a, 2)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(TAKE(a, -1)).toEqual([[7, 8, 9]]);
    expect(TAKE(a, 2, -2)).toEqual([
      [2, 3],
      [5, 6],
    ]);
    expect(TAKE(a, null, 1)).toEqual(col(1, 4, 7));
    expect(TAKE(a, 10)).toEqual(a);
    expect(TAKE(a, -1, -1)).toBe(9);
  });

  it("TAKE with zero is #CALC!", () => {
    expect(errorOf(() => TAKE(a, 0))).toBe(ERROR_CALC);
    expect(errorOf(() => TAKE(a, 1, 0))).toBe(ERROR_CALC);
    expect(errorOf(() => TAKE(a))).toBe(ERROR_VALUE);
  });

  it("DROP from the start or the end", () => {
    expect(DROP(a, 2)).toEqual([[7, 8, 9]]);
    expect(DROP(a, -2)).toEqual([[1, 2, 3]]);
    expect(DROP(a, 1, 1)).toEqual([
      [5, 6],
      [8, 9],
    ]);
    expect(DROP(a, 0, -2)).toEqual(col(1, 4, 7));
    expect(DROP(a, null, 2)).toEqual(col(3, 6, 9));
  });

  it("DROP everything is #CALC!", () => {
    expect(errorOf(() => DROP(a, 3))).toBe(ERROR_CALC);
    expect(errorOf(() => DROP(a, -5))).toBe(ERROR_CALC);
    expect(errorOf(() => DROP(a, 0, 3))).toBe(ERROR_CALC);
  });
});

describe("EXPAND", () => {
  it("pads with #N/A by default", () => {
    expect(codes(EXPAND(row(1, 2), 2, 3))).toEqual([
      [1, 2, "#N/A"],
      ["#N/A", "#N/A", "#N/A"],
    ]);
  });

  it("pads with pad_with and keeps omitted dimensions", () => {
    expect(EXPAND(col(1, 2), 3, null, 0)).toEqual(col(1, 2, 0));
    expect(EXPAND(col(1, 2), null, 2, "")).toEqual([
      [1, ""],
      [2, ""],
    ]);
  });

  it("rejects shrinking with #VALUE!", () => {
    expect(errorOf(() => EXPAND(col(1, 2), 1))).toBe(ERROR_VALUE);
    expect(errorOf(() => EXPAND(row(1, 2), 1, 1))).toBe(ERROR_VALUE);
  });
});

describe("TOCOL / TOROW", () => {
  const a = [
    [1, null, 3],
    ["#N/A", 5, 6],
  ];

  it("flattens by row or by column", () => {
    expect(TOCOL(a)).toEqual(col(1, null, 3, "#N/A", 5, 6));
    expect(TOROW(a, 0, true)).toEqual([[1, "#N/A", null, 5, 3, 6]]);
  });

  it("ignores blanks and/or errors", () => {
    expect(TOROW(a, 1)).toEqual([[1, 3, "#N/A", 5, 6]]);
    expect(TOROW(a, 2)).toEqual([[1, null, 3, 5, 6]]);
    expect(TOCOL(a, 3)).toEqual(col(1, 3, 5, 6));
    expect(TOROW([[1, new Error(ERROR_NUM)]], 2)).toBe(1);
  });

  it("validates ignore and empty results", () => {
    expect(errorOf(() => TOCOL(a, 4))).toBe(ERROR_VALUE);
    expect(errorOf(() => TOCOL(a, -1))).toBe(ERROR_VALUE);
    expect(errorOf(() => TOCOL([[null, null]], 1))).toBe(ERROR_CALC);
  });
});

describe("WRAPROWS / WRAPCOLS", () => {
  it("WRAPROWS", () => {
    expect(codes(WRAPROWS(row(1, 2, 3, 4, 5), 2))).toEqual([
      [1, 2],
      [3, 4],
      [5, "#N/A"],
    ]);
    expect(WRAPROWS(col(1, 2, 3, 4), 2, 0)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("WRAPCOLS", () => {
    expect(WRAPCOLS(row(1, 2, 3, 4, 5), 2, "x")).toEqual([
      [1, 3, 5],
      [2, 4, "x"],
    ]);
  });

  it("validates arguments", () => {
    expect(
      errorOf(() =>
        WRAPROWS(
          [
            [1, 2],
            [3, 4],
          ],
          2
        )
      )
    ).toBe(ERROR_VALUE);
    expect(errorOf(() => WRAPCOLS(row(1, 2), 0))).toBe(ERROR_NUM);
  });
});

describe("CHOOSEROWS / CHOOSECOLS", () => {
  const a = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  it("CHOOSEROWS picks rows, negatives count from the end", () => {
    expect(CHOOSEROWS(a, 3, 1)).toEqual([
      [7, 8, 9],
      [1, 2, 3],
    ]);
    expect(CHOOSEROWS(a, -1)).toEqual([[7, 8, 9]]);
    expect(CHOOSEROWS(a, row(2, 2))).toEqual([
      [4, 5, 6],
      [4, 5, 6],
    ]);
  });

  it("CHOOSECOLS picks columns", () => {
    expect(CHOOSECOLS(a, 1, -1)).toEqual([
      [1, 3],
      [4, 6],
      [7, 9],
    ]);
    expect(CHOOSECOLS(a, col(2))).toEqual(col(2, 5, 8));
  });

  it("rejects zero and out-of-range indices", () => {
    expect(errorOf(() => CHOOSEROWS(a, 0))).toBe(ERROR_VALUE);
    expect(errorOf(() => CHOOSEROWS(a, 4))).toBe(ERROR_VALUE);
    expect(errorOf(() => CHOOSECOLS(a, -4))).toBe(ERROR_VALUE);
    expect(errorOf(() => CHOOSECOLS(a))).toBe(ERROR_VALUE);
  });
});

describe("HSTACK / VSTACK", () => {
  it("HSTACK appends columns and pads short arrays with #N/A", () => {
    expect(HSTACK(col(1, 2), col("a", "b"))).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
    expect(codes(HSTACK(col(1, 2), "x"))).toEqual([
      [1, "x"],
      [2, "#N/A"],
    ]);
  });

  it("VSTACK appends rows and pads narrow arrays with #N/A", () => {
    expect(VSTACK(row(1, 2), row(3, 4))).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(codes(VSTACK(row(1, 2), 3))).toEqual([
      [1, 2],
      [3, "#N/A"],
    ]);
    expect(VSTACK(5)).toBe(5);
    expect(errorOf(() => VSTACK())).toBe(ERROR_VALUE);
  });
});

describe("TRIMRANGE", () => {
  const a = [
    [null, null, null, null],
    [null, 1, null, null],
    [null, null, 2, null],
    [null, null, null, null],
  ];

  it("trims blank outer rows and columns", () => {
    expect(TRIMRANGE(a)).toEqual([
      [1, null],
      [null, 2],
    ]);
  });

  it("honours trim_rows / trim_cols modes", () => {
    expect(TRIMRANGE(a, 0, 0)).toEqual(a);
    expect(TRIMRANGE(a, 1, 0)).toEqual(a.slice(1));
    expect(TRIMRANGE(a, 2, 0)).toEqual(a.slice(0, 3));
    expect(TRIMRANGE(a, 0, 2)).toEqual(a.map((r) => r.slice(0, 3)));
  });

  it("validates arguments", () => {
    expect(errorOf(() => TRIMRANGE(a, 4))).toBe(ERROR_VALUE);
    expect(errorOf(() => TRIMRANGE([[null]]))).toBe(ERROR_REF);
  });
});
