import { workbook } from "./workbook.mjs";

// Microsoft's LINEST example 3/4 (office building valuation), A1:E12.
const BUILDINGS = [
  ["Floor space", "Offices", "Entrances", "Age", "Value"],
  [2310, 2, 2, 20, 142000],
  [2333, 2, 2, 12, 144000],
  [2356, 3, 1.5, 33, 151000],
  [2379, 3, 2, 43, 150000],
  [2402, 2, 3, 53, 139000],
  [2425, 4, 2, 23, 169000],
  [2448, 2, 1.5, 99, 126000],
  [2471, 2, 2, 34, 142900],
  [2494, 3, 3, 23, 163000],
  [2517, 4, 4, 55, 169000],
  [2540, 2, 3, 22, 149000],
];

// G1:H12 month / cost (TREND example), I1:J6 month / units (GROWTH, LOGEST).
const COSTS = [
  133890, 135000, 135790, 137300, 138130, 139100, 139900, 141120, 141890,
  143230, 144000, 145290,
];
const UNITS = [33100, 47300, 69000, 102000, 150000, 220000];
const SHEET = BUILDINGS.map((row, i) => [
  ...row,
  null,
  i + 1,
  COSTS[i] ?? null,
  i < 6 ? i + 11 : null,
  i < 6 ? UNITS[i] : null,
]);

function expectClose(actual, expected, digits = 6) {
  expect(Array.isArray(actual)).toBe(true);
  expect(actual.length).toBe(expected.length);
  expected.forEach((row, i) => {
    expect(actual[i].length).toBe(row.length);
    row.forEach((v, j) => {
      if (typeof v === "number") {
        const scale = Math.max(1, Math.abs(v));
        expect(Math.abs(actual[i][j] - v) / scale).toBeLessThan(10 ** -digits);
      } else {
        expect(actual[i][j]).toBe(v);
      }
    });
  });
}

describe(".parse() regression functions", () => {
  const value = workbook(SHEET);

  describe("LINEST", () => {
    it("returns slope and intercept", () => {
      expect(value("LINEST({1,9,5,7},{0,4,2,3})")).toEqual([[2, 1]]);
      expect(
        value(
          "SUM(LINEST({3100;4500;4400;5400;7500;8100},{1;2;3;4;5;6})*{9,1})"
        )
      ).toBeCloseTo(11000, 6);
      expectClose(value("LINEST({3,5,7})"), [[2, 1]]);
    });

    it("multiple regression with statistics (Microsoft example)", () => {
      expectClose(value("LINEST(E2:E12,A2:D12,TRUE,TRUE)"), [
        [-234.2371645, 2553.21066, 12529.76817, 27.64138737, 52317.83051],
        [13.26801148, 530.6691519, 400.0668382, 5.429374042, 12237.3616],
        [0.996747993, 970.5784629, "#N/A", "#N/A", "#N/A"],
        [459.7536742, 6, "#N/A", "#N/A", "#N/A"],
        [1732393319, 5652135.316, "#N/A", "#N/A", "#N/A"],
      ]);
    });

    it("const = FALSE forces the line through the origin", () => {
      expectClose(value("LINEST({2,4,6.5},{1,2,3},FALSE)"), [
        [(2 + 8 + 19.5) / 14, 0],
      ]);
      const stats = value("LINEST({2,4,6.5},{1,2,3},FALSE,TRUE)");
      expect(stats[1][1]).toBe("#N/A");
      expect(stats[3][1]).toBe(2);
    });

    it("drops collinear variables", () => {
      const result = value("LINEST({3;5;7;10},{1,2;2,4;3,6;4.5,9},TRUE,TRUE)");
      // The second column is 2x the first: coefficient 0, se 0.
      expect(result[0][0]).toBe(0);
      expect(result[1][0]).toBe(0);
      expect(result[3][1]).toBe(2);
    });

    it("row-oriented data and errors", () => {
      expectClose(value("LINEST({1,9,5,7},{0,4,2,3})"), [[2, 1]]);
      expect(value('LINEST({1,"a",3})')).toBe("#VALUE!");
      expect(value("LINEST({1,2,3},{1,2})")).toBe("#REF!");
    });
  });

  describe("LOGEST", () => {
    it("fits y = b*m^x (Microsoft example)", () => {
      const result = value("LOGEST(J1:J6,I1:I6,TRUE,TRUE)");
      expectClose([result[0]], [[1.463275628, 495.3047702]]);
      expect(result[2][0]).toBeGreaterThan(0.9998);
      expect(result[3][1]).toBe(4);
    });

    it("requires positive y values", () => {
      expect(value("LOGEST({1,-2,3})")).toBe("#NUM!");
    });
  });

  describe("TREND", () => {
    it("fits the known points (Microsoft example)", () => {
      const fitted = value("TREND(H1:H12,G1:G12)");
      expect(fitted.length).toBe(12);
      expect(fitted[0][0]).toBeCloseTo(133953.3333, 3);
      expect(fitted[11][0]).toBeCloseTo(145153.3333, 3);
    });

    it("predicts new x values", () => {
      expectClose(value("TREND(H1:H12,G1:G12,{13;14;15;16;17})"), [
        [146171.5152],
        [147189.697],
        [148207.8788],
        [149226.0606],
        [150244.2424],
      ]);
      expectClose(value("TREND({1,2,3},{1,2,3},{4,5})"), [[4, 5]]);
      expectClose(value("TREND({2;4;6},,{4})"), [[8]]);
    });

    it("multiple variables", () => {
      const predicted = value("TREND(E2:E12,A2:D12,{2500,3,2,25})");
      expect(predicted.length).toBe(1);
      expect(predicted[0][0]).toBeCloseTo(
        52317.83051 +
          27.64138737 * 2500 +
          12529.76817 * 3 +
          2553.21066 * 2 -
          234.2371645 * 25,
        2
      );
    });
  });

  describe("GROWTH", () => {
    it("matches Microsoft's example", () => {
      expectClose(
        value("GROWTH(J1:J6,I1:I6)"),
        [
          [32618.20377],
          [47729.42261],
          [69841.30086],
          [102197.0734],
          [149542.4867],
          [218821.8762],
        ],
        8
      );
      expectClose(
        value("GROWTH(J1:J6,I1:I6,{17;18})"),
        [[320196.7184], [468536.0512]],
        8
      );
    });
  });

  describe("FREQUENCY", () => {
    it("counts values per bin plus an overflow bin", () => {
      expect(
        value("FREQUENCY({79;85;78;85;50;81;95;88;97},{70;79;89})")
      ).toEqual([[1], [2], [4], [2]]);
    });

    it("handles unsorted bins, text and empty bins", () => {
      expect(value("FREQUENCY({1,2,3,4,5},{4,2})")).toEqual([[2], [2], [1]]);
      expect(value('FREQUENCY({1,"a",3,TRUE},{2})')).toEqual([[1], [1]]);
      expect(value('FREQUENCY({1,2,3},{"x"})')).toEqual([[3]]);
      expect(value("FREQUENCY({1,2,2,3},{2,2})")).toEqual([[3], [0], [1]]);
    });
  });

  describe("FORECAST.ETS", () => {
    it("continues a linear trend exactly", () => {
      expect(
        value(
          "FORECAST.ETS(15,{5;7;9;11;13;15;17;19;21;23;25;27},{1;2;3;4;5;6;7;8;9;10;11;12})"
        )
      ).toBeCloseTo(33, 6);
    });

    it("continues a seasonal pattern with trend", () => {
      // y = 10 + t + season{0,5,-3,-2}, 4 seasons of 4.
      const t = Array.from({ length: 16 }, (_, i) => i + 1);
      const season = [0, 5, -3, -2];
      const y = t.map((x, i) => 10 + x + season[i % 4]);
      const values = `{${y.join(";")}}`;
      const timeline = `{${t.join(";")}}`;

      expect(value(`FORECAST.ETS.SEASONALITY(${values},${timeline})`)).toBe(4);
      expect(value(`FORECAST.ETS(18,${values},${timeline})`)).toBeCloseTo(
        10 + 18 + 5,
        4
      );
      expect(value(`FORECAST.ETS(19,${values},${timeline},4)`)).toBeCloseTo(
        10 + 19 - 3,
        4
      );
      expect(value(`FORECAST.ETS.STAT(${values},${timeline},8)`)).toBe(1);
      expect(
        value(`FORECAST.ETS.CONFINT(18,${values},${timeline})`)
      ).toBeCloseTo(0, 4);
    });

    it("validates the timeline and target", () => {
      expect(value("FORECAST.ETS(2,{1;2;3;4},{1;2;3;4})")).toBe("#NUM!");
      expect(value("FORECAST.ETS(9,{1;2;3;4},{1;2;3})")).toBe("#VALUE!");
      expect(value("FORECAST.ETS(9,{1;2;3;4},{1;2;3.3;4})")).toBe("#NUM!");
      expect(value("FORECAST.ETS.STAT({1;2;3;4},{1;2;3;4},9)")).toBe("#NUM!");
    });

    it("fills gaps and aggregates duplicates", () => {
      // Missing t=3 is interpolated; duplicate t=2 is averaged.
      expect(
        value("FORECAST.ETS(7,{1;1;3;4;5;6},{1;2;2;4;5;6},0)")
      ).toBeCloseTo(7, 4);
      expect(
        value("FORECAST.ETS.CONFINT(8,{1;2;3;4},{1;2;3;4},0.95,0)")
      ).toBeCloseTo(0, 6);
    });
  });
});
