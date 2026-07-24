/** Excel-like value-axis scale (nice 1–2–5 steps and padded extents). */

export type AxisScale = {
  min: number;
  max: number;
  step: number;
  ticks: number[];
};

/** Explicit value-axis bounds / major unit from chart XML (c:scaling / c:majorUnit). */
export type AxisScaleOverrides = {
  min?: number;
  max?: number;
  majorUnit?: number;
};

const CLUSTER_RATIO = 1 / 6;
const PAD = 0.05;
const MAX_TICKS = 40;

function getFirstDegree(val: number): { val: number; numPow: number } {
  if (!isFinite(val) || val === 0) {
    return { val: 1, numPow: 1 };
  }

  let abs = Math.abs(val);
  let numPow = 1;

  if (abs >= 1) {
    numPow = Math.pow(10, String(Math.floor(abs)).length - 1);
    return { val: abs / numPow, numPow };
  }

  let scaled = abs;
  let exp = 0;
  while (scaled < 1) {
    scaled *= 10;
    exp -= 1;
  }
  numPow = Math.pow(10, exp);
  return { val: scaled, numPow };
}

/** Snap mantissa into Excel-like 1–2–5 buckets. */
function getStepMantissa(step: number): number {
  if (step > 1 && step <= 2) return 2;
  if (step > 2 && step <= 5) return 5;
  if (step > 5 && step <= 10) return 10;
  if (step > 10 && step <= 20) return 20;
  return step;
}

/**
 * Padded data range before nice-step snapping.
 * All-positive: usually min=0 and max = dataMax * 1.05 unless values are
 * tightly clustered near the top ((max-min)/max < 1/6).
 */
export function getTrueMinMax(
  dataMin: number,
  dataMax: number
): { min: number; max: number } {
  let yMin = dataMin;
  let yMax = dataMax;
  if (!isFinite(yMin) || !isFinite(yMax)) {
    return { min: 0, max: 1 };
  }
  if (yMin === yMax) {
    if (yMin === 0) return { min: 0, max: 1 };
    if (yMin > 0) return { min: 0, max: yMax + PAD * yMax };
    return { min: yMin + PAD * yMin, max: 0 };
  }

  let axisMin: number;
  let axisMax: number;

  if (yMin >= 0 && yMax >= 0) {
    const diffMaxMin = (yMax - yMin) / yMax;
    if (CLUSTER_RATIO > diffMaxMin) {
      axisMin = yMin - (yMax - yMin) / 2;
      axisMax = yMax + PAD * (yMax - yMin);
    } else {
      axisMin = 0;
      axisMax = yMax + PAD * (yMax - 0);
    }
  } else if (yMin <= 0 && yMax <= 0) {
    const diffMaxMin = (yMin - yMax) / yMin;
    axisMin = yMin + PAD * (yMin - yMax);
    if (CLUSTER_RATIO < diffMaxMin) {
      axisMax = 0;
    } else {
      axisMax = yMax - (yMin - yMax) / 2;
    }
  } else {
    axisMax = yMax + PAD * (yMax - yMin);
    axisMin = yMin + PAD * (yMin - yMax);
  }

  if (axisMin === axisMax) {
    if (axisMin < 0) axisMax = 0;
    else axisMin = 0;
  }

  return { min: axisMin, max: axisMax };
}

export function computeAxisStep(axisMin: number, axisMax: number): number {
  const span = Math.abs(axisMax - axisMin);
  if (!(span > 0) || !isFinite(span)) {
    return 1;
  }
  const first = getFirstDegree(span / 10);
  return getStepMantissa(first.val) * first.numPow;
}

function finiteOverride(value: number | undefined): number | undefined {
  return value != null && isFinite(value) ? value : undefined;
}

export function buildAxisTicks(
  axisMin: number,
  axisMax: number,
  step: number,
  overrides?: Pick<AxisScaleOverrides, "min" | "max">
): number[] {
  if (!(step > 0) || !isFinite(step)) {
    return [0, 1];
  }

  const manualMin = finiteOverride(overrides?.min);
  const manualMax = finiteOverride(overrides?.max);

  let minUnit: number;
  if (manualMin != null) {
    minUnit = manualMin;
  } else if (manualMax != null && manualMax > axisMin && manualMax >= 0) {
    const stepCount = Math.ceil((manualMax - axisMin) / step);
    minUnit = manualMax - stepCount * step;
  } else {
    minUnit = Math.floor(axisMin / step) * step;
  }

  const ticks: number[] = [];
  for (let i = 0; i < MAX_TICKS; i++) {
    const cleaned = roundAxisValue(minUnit + step * i, step);
    ticks.push(cleaned);

    if (axisMax === 0 && cleaned === 0 && i > 0) {
      break;
    }

    // Explicit max: stop on >=. Auto max: include the first tick past the padded bound.
    if (manualMax != null) {
      if (cleaned >= axisMax) break;
    } else if (cleaned > axisMax) {
      break;
    }
  }

  if (ticks.length === 0) {
    return [0, 1];
  }
  return ticks;
}

function roundAxisValue(value: number, step: number): number {
  if (!isFinite(value)) return 0;
  if (Math.abs(value) < 1e-12) return 0;
  const decimals = decimalsForStep(step) + 2;
  const factor = Math.pow(10, Math.min(12, Math.max(0, decimals)));
  return Math.round(value * factor) / factor;
}

function decimalsForStep(step: number): number {
  if (!(step > 0) || step >= 1) return 0;
  let t = step;
  let d = 0;
  while (d < 10 && Math.abs(Math.round(t) - t) > 1e-8) {
    t *= 10;
    d += 1;
  }
  return d;
}

/**
 * General-like tick label: show only the decimals needed for the step grid
 * (0.5 → one decimal; 1 → integers), strip trailing zeros.
 */
export function formatAxisTick(value: number, step: number): string {
  if (!isFinite(value)) return "";
  if (Math.abs(value) < 1e-12) return "0";

  const decimals = decimalsForStep(step);
  if (decimals === 0) {
    return String(Math.round(value));
  }
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  return rounded
    .toFixed(decimals)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
}

/** Full Excel-like scale from raw data extents, with optional chart XML overrides. */
export function computeAxisScale(
  dataMin: number,
  dataMax: number,
  overrides?: AxisScaleOverrides
): AxisScale {
  let min = dataMin;
  let max = dataMax;
  if (!isFinite(min) || !isFinite(max)) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }

  const manualMin = finiteOverride(overrides?.min);
  const manualMax = finiteOverride(overrides?.max);
  const majorUnit = finiteOverride(overrides?.majorUnit);

  let padMin = min;
  let padMax = max;
  if (manualMin != null && manualMin < padMin) padMin = manualMin;
  if (manualMax != null && manualMax > padMax) padMax = manualMax;

  const padded = getTrueMinMax(padMin, padMax);
  let axisMin = manualMin != null ? manualMin : padded.min;
  let axisMax = manualMax != null ? manualMax : padded.max;

  if (manualMin != null && manualMax != null && manualMax < manualMin) {
    if (manualMax < 0) {
      axisMax = 0;
    } else {
      axisMin = 0;
    }
  }

  if (axisMax < axisMin) {
    if (axisMax > 0) {
      axisMax = 2 * axisMin;
    } else {
      axisMin = 2 * axisMax;
    }
  }

  const step =
    majorUnit != null && majorUnit > 0
      ? majorUnit
      : computeAxisStep(axisMin, axisMax);

  const ticks = buildAxisTicks(axisMin, axisMax, step, {
    min: manualMin,
    max: manualMax,
  });

  // Auto bounds snap to the generated tick ends; explicit min/max stay exact.
  const plotMin = manualMin != null ? axisMin : ticks[0];
  const plotMax =
    manualMax != null ? axisMax : ticks[ticks.length - 1];

  return {
    min: plotMin,
    max: plotMax,
    step,
    ticks,
  };
}

/** Convenience: top tick for all-positive series (data min treated as 0). */
export function computeNiceAxisMax(dataMax: number): number {
  const scale = computeAxisScale(0, dataMax > 0 ? dataMax : 1);
  return scale.max;
}
