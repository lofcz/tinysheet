import { expect, it, describe, vi } from "vitest";

// Compatibility for tests that still reference jest.fn / jest mocks
globalThis.jest = vi;
globalThis.xit = it.skip;
globalThis.xdescribe = describe.skip;
globalThis.fit = it.only;
globalThis.fdescribe = describe.only;

function tolerance(precision) {
  if (precision === void 0 || precision === null) {
    precision = 7;
  }
  return 0.5 * Math.pow(10, -precision);
}

function closelyEqual(a, e, precision) {
  if (a === e) return true;
  if (typeof a === "number" && typeof e === "number") {
    if (isNaN(a) && isNaN(e)) return true;
    return Math.abs(a - e) < tolerance(precision);
  }
  return false;
}

expect.extend({
  toBeMatchCloseTo(actual, expected, precision) {
    const keys = Object.keys(expected);
    const pass = keys.every((key) =>
      closelyEqual(actual?.[key], expected[key], precision)
    );

    return {
      pass,
      message: () =>
        `Expected ${JSON.stringify(actual)} to be closely equal to ${JSON.stringify(expected)}`,
    };
  },
});
