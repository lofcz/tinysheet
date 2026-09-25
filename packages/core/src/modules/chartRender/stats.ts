/**
 * Chart statistics: trendline regressions (Excel's six trendline types with
 * R²), error-bar amounts and histogram binning. Pure functions, unit tested
 * in `packages/core/test/chart/stats.test.js`.
 */
import type {
  ChartErrorBars,
  ChartHistogramBinning,
  ChartTrendline,
} from "./types";

export type TrendlineFit = {
  /** Value of the fitted curve at `x` (NaN outside its domain). */
  predict: (x: number) => number;
  /** Coefficient of determination (undefined for moving averages). */
  rSquared?: number;
  /** Excel-style equation text, e.g. `y = 2x + 1`. */
  equation?: string;
  /** Moving averages: the averaged points instead of a curve. */
  points?: [number, number][];
};

function isNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

/** Excel-like short coefficient text (4 significant digits). */
export function formatCoefficient(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e6 || abs < 1e-4) {
    return value
      .toExponential(3)
      .replace(/\.?0+e/, "e")
      .replace("e+", "e")
      .replace("e", "E");
  }
  const digits = Math.max(0, 4 - Math.floor(Math.log10(abs)) - 1);
  return String(parseFloat(value.toFixed(Math.min(digits, 10))));
}

/** Solve `a · x = b` by Gaussian elimination with partial pivoting. */
export function solveLinearSystem(a: number[][], b: number[]) {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r += 1) {
      if (r !== col) {
        const f = m[r][col] / m[col][col];
        for (let k = col; k <= n; k += 1) m[r][k] -= f * m[col][k];
      }
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

function rSquared(ys: number[], fitted: number[]) {
  const mean = ys.reduce((s, y) => s + y, 0) / ys.length;
  let ssTot = 0;
  let ssRes = 0;
  ys.forEach((y, i) => {
    ssTot += (y - mean) ** 2;
    ssRes += (y - fitted[i]) ** 2;
  });
  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}

/** Least-squares polynomial of `order` (1 = linear); intercept optional. */
function polyFit(
  xs: number[],
  ys: number[],
  order: number,
  intercept?: number
) {
  const fixed = intercept != null && Number.isFinite(intercept);
  const powers: number[] = [];
  for (let p = fixed ? 1 : 0; p <= order; p += 1) powers.push(p);
  const target = fixed ? ys.map((y) => y - intercept!) : ys;
  const a = powers.map((pi) =>
    powers.map((pj) => xs.reduce((s, x) => s + x ** (pi + pj), 0))
  );
  const b = powers.map((pi) =>
    xs.reduce((s, x, k) => s + x ** pi * target[k], 0)
  );
  const solved = solveLinearSystem(a, b);
  if (!solved) return null;
  const coef: number[] = new Array(order + 1).fill(0);
  if (fixed) coef[0] = intercept!;
  powers.forEach((p, i) => {
    coef[p] = solved[i];
  });
  return coef;
}

function polyText(coef: number[], variable = "x") {
  let out = "";
  // floating-point noise is not a term
  const scale = Math.max(1, ...coef.map((c) => Math.abs(c)));
  for (let p = coef.length - 1; p >= 0; p -= 1) {
    const c = Math.abs(coef[p]) < scale * 1e-9 ? 0 : coef[p];
    if (c === 0 && !(p === 0 && out === "")) continue;
    const text = formatCoefficient(Math.abs(c));
    let term: string;
    if (p === 0) term = text;
    else {
      const coefText = text === "1" ? "" : text;
      term = `${coefText}${variable}${p > 1 ? `^${p}` : ""}`;
    }
    if (out === "") out = c < 0 ? `-${term}` : term;
    else out += c < 0 ? ` - ${term}` : ` + ${term}`;
  }
  return `y = ${out || "0"}`;
}

/**
 * Fit a trendline to the points (x, y). Returns null when the data does not
 * suit the type (too few points, non-positive values for log/exp/power).
 */
export function fitTrendline(
  trend: ChartTrendline,
  xsIn: (number | null)[],
  ysIn: (number | null)[]
): TrendlineFit | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < ysIn.length; i += 1) {
    const x = xsIn[i];
    const y = ysIn[i];
    if (isNum(x) && isNum(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  const { type } = trend;
  if (type === "movingAverage") {
    const period = Math.max(2, Math.round(trend.period ?? 2));
    if (ys.length < period) return null;
    const points: [number, number][] = [];
    // Excel averages the last `period` points of the series order.
    for (let i = period - 1; i < ys.length; i += 1) {
      let sum = 0;
      for (let k = i - period + 1; k <= i; k += 1) sum += ys[k];
      points.push([xs[i], sum / period]);
    }
    return { predict: () => NaN, points };
  }
  if (xs.length < 2) return null;

  if (type === "linear" || type === "polynomial") {
    const order =
      type === "linear"
        ? 1
        : Math.min(6, Math.max(2, Math.round(trend.order ?? 2)));
    if (xs.length <= (trend.intercept != null ? order - 1 : order)) return null;
    const coef = polyFit(xs, ys, order, trend.intercept);
    if (!coef) return null;
    const predict = (x: number) => coef.reduce((s, c, p) => s + c * x ** p, 0);
    return {
      predict,
      rSquared: rSquared(
        ys,
        xs.map((x) => predict(x))
      ),
      equation: polyText(coef),
    };
  }

  if (type === "exponential") {
    if (ys.some((y) => y <= 0)) return null;
    const ly = ys.map((y) => Math.log(y));
    let coef: number[] | null;
    if (trend.intercept != null && trend.intercept > 0) {
      coef = polyFit(xs, ly, 1, Math.log(trend.intercept));
    } else coef = polyFit(xs, ly, 1);
    if (!coef) return null;
    const c = Math.exp(coef[0]);
    const b = coef[1];
    return {
      predict: (x) => c * Math.exp(b * x),
      // Excel reports R² of the linearised fit.
      rSquared: rSquared(
        ly,
        xs.map((x) => coef![0] + b * x)
      ),
      equation: `y = ${formatCoefficient(c)}e^${formatCoefficient(b)}x`,
    };
  }

  if (type === "logarithmic") {
    if (xs.some((x) => x <= 0)) return null;
    const lx = xs.map((x) => Math.log(x));
    const coef = polyFit(lx, ys, 1);
    if (!coef) return null;
    const [a, b] = coef;
    const sign = a < 0 ? "-" : "+";
    return {
      predict: (x) => (x > 0 ? a + b * Math.log(x) : NaN),
      rSquared: rSquared(
        ys,
        lx.map((x) => a + b * x)
      ),
      equation: `y = ${formatCoefficient(b)}ln(x) ${sign} ${formatCoefficient(
        Math.abs(a)
      )}`,
    };
  }

  // power
  if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) return null;
  const lx = xs.map((x) => Math.log(x));
  const ly = ys.map((y) => Math.log(y));
  const coef = polyFit(lx, ly, 1);
  if (!coef) return null;
  const c = Math.exp(coef[0]);
  const b = coef[1];
  return {
    predict: (x) => (x > 0 ? c * x ** b : NaN),
    rSquared: rSquared(
      ly,
      lx.map((x) => coef[0] + b * x)
    ),
    equation: `y = ${formatCoefficient(c)}x^${formatCoefficient(b)}`,
  };
}

export type ErrorAmount = { plus: number; minus: number; center: number };

/** Sample standard deviation (n - 1). */
export function sampleStdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const ss = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(ss / (values.length - 1));
}

/**
 * Error amounts for every point of a series, Excel's way:
 * fixed and percentage around each point; standard deviation around the
 * series mean (value × stdev); standard error around each point; custom
 * from the plus/minus values.
 */
export function computeErrorAmounts(
  bars: ChartErrorBars & {
    plusValues?: (number | null)[];
    minusValues?: (number | null)[];
  },
  values: (number | null)[]
): (ErrorAmount | null)[] {
  const nums = values.filter(isNum);
  const include = bars.include ?? "both";
  const plusOn = include !== "minus";
  const minusOn = include !== "plus";
  const mean = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
  const sd = sampleStdDev(nums);
  const amount = bars.value ?? (bars.type === "percentage" ? 5 : 1);
  return values.map((v, i) => {
    if (!isNum(v)) return null;
    let plus = 0;
    let minus = 0;
    let center = v;
    switch (bars.type) {
      case "percentage":
        plus = Math.abs(v) * (amount / 100);
        minus = plus;
        break;
      case "stdDev":
        center = mean;
        plus = sd * amount;
        minus = plus;
        break;
      case "stdErr":
        plus = nums.length > 0 ? sd / Math.sqrt(nums.length) : 0;
        minus = plus;
        break;
      case "custom": {
        const p = bars.plusValues?.[i];
        const m = bars.minusValues?.[i];
        plus = isNum(p) ? Math.abs(p) : 0;
        minus = isNum(m) ? Math.abs(m) : 0;
        break;
      }
      default:
        plus = Math.abs(amount);
        minus = plus;
    }
    return {
      center,
      plus: plusOn ? plus : 0,
      minus: minusOn ? minus : 0,
    };
  });
}

export type HistogramBin = {
  label: string;
  count: number;
  /** Lower / upper bound (null for the overflow / underflow bins). */
  from: number | null;
  to: number | null;
};

function edgeText(v: number) {
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toFixed(Math.abs(v) >= 100 ? 1 : 2)));
}

/**
 * Excel's histogram bins: `[a, b]` for the first bin and `(a, b]` for the
 * rest; optional `≤ underflow` and `> overflow` bins. Automatic bin width
 * follows Scott's normal reference rule, like Excel.
 */
export function computeHistogramBins(
  valuesIn: (number | null)[],
  binning: ChartHistogramBinning = {}
): HistogramBin[] {
  const values = valuesIn.filter(isNum);
  if (values.length === 0) return [];
  const overflow = isNum(binning.overflow) ? binning.overflow : undefined;
  const underflow = isNum(binning.underflow) ? binning.underflow : undefined;
  const inner = values.filter(
    (v) =>
      (overflow == null || v <= overflow) &&
      (underflow == null || v > underflow)
  );
  const bins: HistogramBin[] = [];
  if (underflow != null) {
    bins.push({
      label: `≤${edgeText(underflow)}`,
      count: values.filter((v) => v <= underflow).length,
      from: null,
      to: underflow,
    });
  }
  if (inner.length > 0) {
    let min = underflow ?? Math.min(...inner);
    const max = overflow ?? Math.max(...inner);
    if (underflow == null) min = Math.min(...inner);
    let width: number;
    if (binning.mode === "width" && isNum(binning.width) && binning.width > 0) {
      ({ width } = binning);
    } else if (
      binning.mode === "count" &&
      isNum(binning.count) &&
      binning.count > 0
    ) {
      width = (max - min) / Math.round(binning.count) || 1;
    } else {
      const sd = sampleStdDev(inner);
      width = (3.5 * sd) / Math.cbrt(inner.length);
      if (!(width > 0)) width = 1;
    }
    let count = Math.max(1, Math.ceil((max - min) / width - 1e-9));
    if (binning.mode === "count" && isNum(binning.count) && binning.count > 0)
      count = Math.round(binning.count);
    count = Math.min(count, 1000);
    for (let b = 0; b < count; b += 1) {
      const from = min + b * width;
      const to = min + (b + 1) * width;
      const open = b === 0 && underflow == null ? "[" : "(";
      bins.push({
        label: `${open}${edgeText(from)}, ${edgeText(to)}]`,
        count: 0,
        from,
        to,
      });
    }
    const first = underflow != null ? 1 : 0;
    inner.forEach((v) => {
      let b = Math.ceil((v - min) / width - 1e-9) - 1;
      if (b < 0) b = 0;
      if (b >= count) b = count - 1;
      bins[first + b].count += 1;
    });
  }
  if (overflow != null) {
    bins.push({
      label: `>${edgeText(overflow)}`,
      count: values.filter((v) => v > overflow).length,
      from: overflow,
      to: null,
    });
  }
  return bins;
}
