import { makeContext, input, values } from "../formula/helpers";
import {
  learnFlashFill,
  runFlashFill,
  flashFill,
} from "../../src/modules/flashFill";

const src = (...texts) => texts.map((text) => ({ text }));

/** Learn from `examples` ([inputs, output]) and run on `rows` (inputs). */
function fill(examples, rows) {
  const program = learnFlashFill(
    examples.map(([inputs, output]) => ({
      inputs: src(...[].concat(inputs)),
      output,
    }))
  );
  expect(program).not.toBeNull();
  return rows.map((r) => runFlashFill(program, src(...[].concat(r))));
}

// Examples from Microsoft's "Using Flash Fill in Excel" article and the
// Flash Fill tutorial workbook.
describe("Flash Fill: Excel's documented examples", () => {
  test("split names: first name", () => {
    expect(
      fill(
        [["Nancy Davolio", "Nancy"]],
        ["Andrew Fuller", "Janet Leverling", "Margaret Peacock"]
      )
    ).toEqual(["Andrew", "Janet", "Margaret"]);
  });

  test("split names: last name", () => {
    expect(
      fill(
        [["Nancy Davolio", "Davolio"]],
        ["Andrew Fuller", "Janet Leverling", "Steven Buchanan"]
      )
    ).toEqual(["Fuller", "Leverling", "Buchanan"]);
  });

  test("last name with middle names needs a second example", () => {
    expect(
      fill(
        [
          ["Nancy Davolio", "Davolio"],
          ["Mary Ann Smith", "Smith"],
        ],
        ["Andrew Fuller", "John Paul Jones"]
      )
    ).toEqual(["Fuller", "Jones"]);
  });

  test("combine first and last name columns", () => {
    expect(
      fill(
        [[["Nancy", "Davolio"], "Nancy Davolio"]],
        [
          ["Andrew", "Fuller"],
          ["Janet", "Leverling"],
        ]
      )
    ).toEqual(["Andrew Fuller", "Janet Leverling"]);
  });

  test("last, first with a comma", () => {
    expect(
      fill([[["Nancy", "Davolio"], "Davolio, Nancy"]], [["Andrew", "Fuller"]])
    ).toEqual(["Fuller, Andrew"]);
  });

  test("email addresses to names", () => {
    expect(
      fill(
        [["nancy.davolio@contoso.com", "Nancy Davolio"]],
        ["andrew.fuller@contoso.com", "janet.leverling@fabrikam.com"]
      )
    ).toEqual(["Andrew Fuller", "Janet Leverling"]);
  });

  test("email addresses to user names", () => {
    expect(
      fill(
        [["nancy.davolio@contoso.com", "nancy.davolio"]],
        ["andrew.fuller@contoso.com"]
      )
    ).toEqual(["andrew.fuller"]);
  });

  test("email domain", () => {
    expect(
      fill(
        [["nancy.davolio@contoso.com", "contoso.com"]],
        ["janet.leverling@fabrikam.com"]
      )
    ).toEqual(["fabrikam.com"]);
  });

  test("phone number formatting", () => {
    expect(
      fill([["2065551234", "(206) 555-1234"]], ["4255550187", "3605559876"])
    ).toEqual(["(425) 555-0187", "(360) 555-9876"]);
  });

  test("phone numbers in mixed notations", () => {
    expect(
      fill(
        [
          ["425.555.0123", "(425) 555-0123"],
          ["206-555-0187", "(206) 555-0187"],
        ],
        ["360 555 1234", "(509) 555.9876"]
      )
    ).toEqual(["(360) 555-1234", "(509) 555-9876"]);
  });

  test("initials", () => {
    expect(
      fill([["Nancy Davolio", "ND"]], ["Andrew Fuller", "Janet Leverling"])
    ).toEqual(["AF", "JL"]);
  });

  test("initials with periods", () => {
    expect(fill([["Nancy Davolio", "N.D."]], ["Andrew Fuller"])).toEqual([
      "A.F.",
    ]);
  });

  test("first name and last initial", () => {
    expect(fill([["Nancy Davolio", "Nancy D."]], ["Andrew Fuller"])).toEqual([
      "Andrew F.",
    ]);
  });

  test("upper-case last name", () => {
    expect(fill([["Nancy Davolio", "DAVOLIO"]], ["Andrew Fuller"])).toEqual([
      "FULLER",
    ]);
  });

  test("proper-case a lower-case name", () => {
    expect(
      fill([["nancy davolio", "Nancy Davolio"]], ["andrew fuller"])
    ).toEqual(["Andrew Fuller"]);
  });

  test("extract numbers from product codes", () => {
    expect(fill([["SKU-1234-XL", "1234"]], ["SKU-98-S", "SKU-555-M"])).toEqual([
      "98",
      "555",
    ]);
  });

  test("reformat text dates", () => {
    expect(
      fill([["2024-03-05", "03/05/2024"]], ["2023-12-31", "2025-01-09"])
    ).toEqual(["12/31/2023", "01/09/2025"]);
  });

  test("dates to month names through their serial value", () => {
    const program = learnFlashFill([
      {
        inputs: [{ text: "3/5/2024", num: 45356, isDate: true }],
        output: "March",
      },
    ]);
    expect(
      runFlashFill(program, [{ text: "12/31/2023", num: 45291, isDate: true }])
    ).toBe("December");
  });

  test("city from 'City, ST ZIP'", () => {
    expect(
      fill(
        [["Seattle, WA 98052", "Seattle"]],
        ["Redmond, WA 98073", "New York, NY 10001"]
      )
    ).toEqual(["Redmond", "New York"]);
  });

  test("missing pieces leave the row blank", () => {
    expect(
      fill([["2065551234", "(206) 555-1234"]], ["555", "4255550187"])
    ).toEqual([null, "(425) 555-0187"]);
  });

  test("no pattern: examples that can't be reproduced", () => {
    expect(
      learnFlashFill([
        { inputs: src("Nancy"), output: "Nancy" },
        { inputs: src("Andrew"), output: "Janet" },
      ])
    ).toBeNull();
  });
});

describe("Flash Fill on the sheet", () => {
  test("fills the column below the example with text results", () => {
    const ctx = makeContext({ rows: 10, cols: 4 });
    [
      ["A1", "Full name"],
      ["B1", "First"],
      ["A2", "Nancy Davolio"],
      ["B2", "Nancy"],
      ["A3", "Andrew Fuller"],
      ["A4", "Janet Leverling"],
      ["A5", "Robert King"],
    ].forEach(([a1, text]) => input(ctx, a1, text));
    ctx.luckysheet_select_save = [
      { row: [2, 2], column: [1, 1], row_focus: 2, column_focus: 1 },
    ];
    const res = flashFill(ctx);
    expect(res.filled).toBe(3);
    expect(res.range).toEqual({ row: [2, 4], column: [1, 1] });
    expect(values(ctx, "B1", "B5")).toEqual([
      ["First"],
      ["Nancy"],
      ["Andrew"],
      ["Janet"],
      ["Robert"],
    ]);
  });

  test("reports when no pattern is found", () => {
    const ctx = makeContext({ rows: 6, cols: 3 });
    input(ctx, "A1", "abc");
    input(ctx, "B1", "zzz9");
    input(ctx, "A2", "def");
    input(ctx, "A3", "ghi");
    input(ctx, "B2", "q");
    ctx.luckysheet_select_save = [
      { row: [2, 2], column: [1, 1], row_focus: 2, column_focus: 1 },
    ];
    expect(flashFill(ctx).error).toBe("noPattern");
  });
});
