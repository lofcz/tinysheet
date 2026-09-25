import {
  computeErrorAmounts,
  computeHistogramBins,
  fitTrendline,
  formatCoefficient,
  sampleStdDev,
  solveLinearSystem,
  paletteColor,
  shadeColor,
  getChartStyle,
  CHART_PALETTES,
  CHART_STYLES,
} from "../../src";

const xs = [1, 2, 3, 4, 5];

describe("trendlines", () => {
  test("linear fit, equation and R² (Excel's LINEST / RSQ)", () => {
    const fit = fitTrendline({ type: "linear" }, xs, [2, 4, 6, 8, 10]);
    expect(fit.predict(6)).toBeCloseTo(12);
    expect(fit.rSquared).toBeCloseTo(1);
    expect(fit.equation).toBe("y = 2x");
    const noisy = fitTrendline({ type: "linear" }, xs, [1, 3, 2, 5, 4]);
    // slope 0.8, intercept 0.6, R² 0.64
    expect(noisy.predict(0)).toBeCloseTo(0.6);
    expect(noisy.predict(1) - noisy.predict(0)).toBeCloseTo(0.8);
    expect(noisy.rSquared).toBeCloseTo(0.64);
    expect(noisy.equation).toBe("y = 0.8x + 0.6");
  });

  test("forced intercept", () => {
    const fit = fitTrendline(
      { type: "linear", intercept: 0 },
      xs,
      [1, 3, 2, 5, 4]
    );
    expect(fit.predict(0)).toBe(0);
    // slope = Σxy / Σx² = 53 / 55
    expect(fit.predict(1)).toBeCloseTo(53 / 55);
  });

  test("polynomial of order 2 is exact on a parabola", () => {
    const fit = fitTrendline(
      { type: "polynomial", order: 2 },
      xs,
      [2, 5, 10, 17, 26]
    );
    expect(fit.predict(6)).toBeCloseTo(37);
    expect(fit.rSquared).toBeCloseTo(1);
    expect(fit.equation).toBe("y = x^2 + 1");
    // too few points for the order
    expect(fitTrendline({ type: "polynomial", order: 6 }, xs, xs)).toBeNull();
  });

  test("exponential, logarithmic and power fits", () => {
    const exp = fitTrendline(
      { type: "exponential" },
      xs,
      xs.map((x) => 3 * Math.exp(0.5 * x))
    );
    expect(exp.predict(2)).toBeCloseTo(3 * Math.exp(1));
    expect(exp.equation).toBe("y = 3e^0.5x");
    expect(
      fitTrendline({ type: "exponential" }, xs, [1, -1, 2, 3, 4])
    ).toBeNull();
    const log = fitTrendline(
      { type: "logarithmic" },
      xs,
      xs.map((x) => 2 * Math.log(x) + 1)
    );
    expect(log.predict(10)).toBeCloseTo(2 * Math.log(10) + 1);
    expect(log.equation).toBe("y = 2ln(x) + 1");
    const pow = fitTrendline(
      { type: "power" },
      xs,
      xs.map((x) => 4 * x ** 1.5)
    );
    expect(pow.predict(9)).toBeCloseTo(108);
    expect(pow.rSquared).toBeCloseTo(1);
  });

  test("moving average averages the last n points", () => {
    const fit = fitTrendline(
      { type: "movingAverage", period: 3 },
      xs,
      [3, 6, 9, 12, 3]
    );
    expect(fit.points).toEqual([
      [3, 6],
      [4, 9],
      [5, 8],
    ]);
    expect(fit.rSquared).toBeUndefined();
  });

  test("helpers", () => {
    expect(
      solveLinearSystem(
        [
          [2, 0],
          [0, 4],
        ],
        [2, 8]
      )
    ).toEqual([1, 2]);
    expect(
      solveLinearSystem(
        [
          [1, 1],
          [1, 1],
        ],
        [1, 1]
      )
    ).toBeNull();
    expect(formatCoefficient(1234.5678)).toBe("1235");
    expect(formatCoefficient(0.012346)).toBe("0.01235");
    expect(formatCoefficient(0.00001234)).toBe("1.234E-5");
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });
});

describe("error bars", () => {
  const values = [10, 20, null, 40];
  test("fixed and percentage around each point", () => {
    expect(computeErrorAmounts({ type: "fixed", value: 2 }, values)).toEqual([
      { center: 10, plus: 2, minus: 2 },
      { center: 20, plus: 2, minus: 2 },
      null,
      { center: 40, plus: 2, minus: 2 },
    ]);
    const pct = computeErrorAmounts(
      { type: "percentage", value: 10, include: "plus" },
      values
    );
    expect(pct[3]).toEqual({ center: 40, plus: 4, minus: 0 });
  });

  test("standard deviation around the mean, standard error per point", () => {
    const sd = sampleStdDev([10, 20, 40]);
    const dev = computeErrorAmounts({ type: "stdDev", value: 2 }, values);
    expect(dev[0].center).toBeCloseTo(70 / 3);
    expect(dev[0].plus).toBeCloseTo(2 * sd);
    const se = computeErrorAmounts({ type: "stdErr" }, values);
    expect(se[1].center).toBe(20);
    expect(se[1].plus).toBeCloseTo(sd / Math.sqrt(3));
  });

  test("custom amounts", () => {
    const custom = computeErrorAmounts(
      { type: "custom", plusValues: [1, 2, 3, 4], minusValues: [-5] },
      values
    );
    expect(custom[0]).toEqual({ center: 10, plus: 1, minus: 5 });
    expect(custom[3]).toEqual({ center: 40, plus: 4, minus: 0 });
  });
});

describe("histogram bins", () => {
  const data = [1, 2, 2, 3, 5, 8, 9, 10];
  test("bin width and bin count", () => {
    const byWidth = computeHistogramBins(data, { mode: "width", width: 3 });
    expect(byWidth.map((b) => b.label)).toEqual([
      "[1, 4]",
      "(4, 7]",
      "(7, 10]",
    ]);
    expect(byWidth.map((b) => b.count)).toEqual([4, 1, 3]);
    const byCount = computeHistogramBins(data, { mode: "count", count: 2 });
    expect(byCount.map((b) => b.count)).toEqual([5, 3]);
  });

  test("overflow and underflow bins", () => {
    const bins = computeHistogramBins(data, {
      mode: "width",
      width: 2,
      underflow: 2,
      overflow: 8,
    });
    expect(bins[0]).toMatchObject({ label: "≤2", count: 3 });
    expect(bins[bins.length - 1]).toMatchObject({ label: ">8", count: 2 });
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(data.length);
  });

  test("automatic width (Scott's rule) keeps every value", () => {
    const bins = computeHistogramBins(data);
    expect(bins.length).toBeGreaterThan(0);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(data.length);
    expect(computeHistogramBins([null])).toEqual([]);
  });
});

describe("palettes and styles", () => {
  test("palette colours cycle with shades", () => {
    expect(paletteColor(undefined, 0)).toBe("#4472C4");
    expect(paletteColor("colorful2", 0)).toBe("#ED7D31");
    expect(paletteColor("monochrome1", 6)).toBe(shadeColor("#4472C4", -0.4));
    expect(shadeColor("#000000", 0.5)).toBe("#808080");
    expect(CHART_PALETTES.length).toBeGreaterThanOrEqual(8);
  });

  test("styles resolve per theme", () => {
    expect(CHART_STYLES).toHaveLength(8);
    const dark = getChartStyle(6).theme("dark");
    const light = getChartStyle(6).theme("light");
    expect(dark.background).not.toBe(light.background);
    expect(getChartStyle(99).id).toBe(1);
  });
});
