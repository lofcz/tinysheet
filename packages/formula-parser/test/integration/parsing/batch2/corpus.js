// Excel-parity corpus (T10): every entry of ./corpus-data.mjs is evaluated
// and compared with the result Microsoft documents.
import { CORPUS, KNOWN_FAILURES, SHEET } from "./corpus-data.mjs";
import { workbook } from "./workbook.mjs";

const COMPLEX_RE =
  /^([+-]?(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?)?(?:([+-]?(?:\d+\.?\d*|\.\d+)?(?:E[+-]?\d+)?)([ij]))?$/i;

/** Parse "3+4i" into [re, im]; null for other text. */
function parseComplex(text) {
  if (typeof text !== "string" || text === "") return null;
  const m = COMPLEX_RE.exec(text);
  if (!m || (m[1] === undefined && m[3] === undefined)) return null;
  const re = m[1] === undefined ? 0 : Number(m[1]);
  let im = 0;
  if (m[3] !== undefined) {
    im = m[2] === "" || m[2] === "+" ? 1 : m[2] === "-" ? -1 : Number(m[2]);
  }
  return [re, im];
}

function decimalsOf(n) {
  const text = String(n);
  if (/e/i.test(text)) {
    const [mantissa, exp] = text.toLowerCase().split("e");
    const frac = (mantissa.split(".")[1] || "").length;
    return Math.max(0, frac - Number(exp));
  }
  return (text.split(".")[1] || "").length;
}

function closeNumber(actual, expected) {
  if (typeof actual !== "number") return false;
  if (actual === expected) return true;
  // Documented results are rounded to the digits shown.
  const tolerance = Math.max(
    10 ** -decimalsOf(expected) * 1.0001,
    Math.abs(expected) * 1e-8
  );
  return Math.abs(actual - expected) <= tolerance;
}

function matches(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      // A 1x1 array result is equivalent to its element.
      return (
        expected.length === 1 &&
        expected[0].length === 1 &&
        matches(actual, expected[0][0])
      );
    }
    const rows = Array.isArray(actual[0]) ? actual : [actual];
    return (
      rows.length === expected.length &&
      expected.every(
        (row, i) =>
          rows[i].length === row.length &&
          row.every((v, j) => matches(rows[i][j], v))
      )
    );
  }
  if (Array.isArray(actual) && actual.length === 1) {
    const row = Array.isArray(actual[0]) ? actual[0] : actual;
    return row.length === 1 && matches(row[0], expected);
  }
  if (typeof expected === "number") return closeNumber(actual, expected);
  if (expected === null) return actual === null || actual === undefined;
  if (typeof expected === "string" && actual !== expected) {
    const e = parseComplex(expected);
    const a = parseComplex(actual);
    if (e && a && /[ij]$/.test(expected)) {
      return e.every(
        (x, i) => Math.abs(a[i] - x) <= Math.max(1e-13, Math.abs(x) * 1e-13)
      );
    }
    return false;
  }
  return actual === expected;
}

describe("Excel-parity corpus", () => {
  const evaluate = workbook(SHEET);
  const entries = [];

  Object.keys(CORPUS).forEach((category) => {
    CORPUS[category].forEach(([formula, expected]) =>
      entries.push([category, formula, expected])
    );
  });

  it("has at least 500 documented examples", () => {
    expect(entries.length).toBeGreaterThanOrEqual(500);
  });

  it("has no duplicate formulas", () => {
    const seen = new Set();
    const duplicates = entries
      .map(([, formula]) => formula)
      .filter((f) => (seen.has(f) ? true : (seen.add(f), false)));
    expect(duplicates).toEqual([]);
  });

  Object.keys(CORPUS).forEach((category) => {
    describe(category, () => {
      CORPUS[category].forEach(([formula, expected]) => {
        const known = KNOWN_FAILURES[formula];

        if (known) {
          it(`${formula} [known failure: ${known}]`, () => {
            expect(matches(evaluate(formula), expected)).toBe(false);
          });
        } else {
          it(formula, () => {
            const actual = evaluate(formula);

            if (!matches(actual, expected)) {
              expect(actual).toEqual(expected);
            }
          });
        }
      });
    });
  });

  it("known failures refer to corpus entries", () => {
    const formulas = new Set(entries.map(([, formula]) => formula));
    expect(Object.keys(KNOWN_FAILURES).filter((f) => !formulas.has(f))).toEqual(
      []
    );
  });
});
