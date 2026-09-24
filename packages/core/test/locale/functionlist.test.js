import { SUPPORTED_FORMULAS } from "@lofcz/tinysheet-formula-parser";
import { locale, FUNCTION_CATEGORIES } from "../../src/locale";
import englishCatalog from "../../src/locale/functions/en";
import { WORKBOOK_FUNCTION_NAMES } from "../../src/modules/formulaFunctions";
import { LEGACY_FUNCTION_NAMES } from "../../src/locale/functions/legacy";
import { mergeFunctionList } from "../../src/locale/functions/merge";

const LANGS = ["en", "zh", "zh-TW", "es", "hi", "ru"];
const PARAM_TYPES = [
  "range",
  "rangeall",
  "rangenumber",
  "rangestring",
  "rangedate",
  "rangedatetime",
  "string",
];
const CATEGORY_IDS = FUNCTION_CATEGORIES.map((c) => c.t);

const names = (list) => list.map((f) => f.n);
const duplicates = (list) => list.filter((item, i) => list.indexOf(item) !== i);

describe("function catalog", () => {
  const catalog = locale({ lang: "en" }).functionlist;

  test("the English locale uses the English catalog", () => {
    expect(catalog).toBe(englishCatalog);
    expect(catalog.length).toBeGreaterThan(400);
  });

  test("every function is supported by the engine or core", () => {
    const known = new Set([...SUPPORTED_FORMULAS, ...WORKBOOK_FUNCTION_NAMES]);
    expect(names(catalog).filter((n) => !known.has(n))).toEqual([]);
  });

  test("every core workbook function has a catalog entry", () => {
    const catalogNames = new Set(names(catalog));
    expect(WORKBOOK_FUNCTION_NAMES.filter((n) => !catalogNames.has(n))).toEqual(
      []
    );
  });

  test("names are unique, upper-case Excel names", () => {
    expect(duplicates(names(catalog))).toEqual([]);
    names(catalog).forEach((n) => {
      expect(n).toMatch(/^[A-Z][A-Z0-9]*(\.[A-Z0-9]+)*$/);
    });
  });

  test("legacy underscore names are aliases, not catalog entries", () => {
    const catalogNames = new Set(names(catalog));
    Object.entries(LEGACY_FUNCTION_NAMES).forEach(([legacy, current]) => {
      expect(catalogNames.has(legacy)).toBe(false);
      expect(catalogNames.has(current)).toBe(true);
    });
  });

  test.each(englishCatalog.map((f) => [f.n, f]))(
    "%s has a valid entry",
    (_, fn) => {
      expect(CATEGORY_IDS).toContain(fn.t);
      expect(typeof fn.d).toBe("string");
      expect(fn.d.length).toBeGreaterThan(0);
      expect(typeof fn.a).toBe("string");
      expect(fn.a.length).toBeGreaterThan(0);

      expect(Array.isArray(fn.p)).toBe(true);
      fn.p.forEach((param) => {
        expect(typeof param.name).toBe("string");
        expect(param.name.length).toBeGreaterThan(0);
        expect(typeof param.detail).toBe("string");
        expect(param.detail.length).toBeGreaterThan(0);
        expect(typeof param.example).toBe("string");
        expect(param.example.length).toBeGreaterThan(0);
        expect(["m", "o"]).toContain(param.require);
        expect(["y", "n"]).toContain(param.repeat);
        expect(PARAM_TYPES).toContain(param.type);
      });
      // The hint card uses parameter names as React keys.
      expect(duplicates(fn.p.map((p) => p.name))).toEqual([]);

      const [min, max] = fn.m;
      expect(Number.isInteger(min)).toBe(true);
      expect(Number.isInteger(max)).toBe(true);
      expect(min).toBe(fn.p.filter((p) => p.require === "m").length);
      expect(max).toBeLessThanOrEqual(255);
      // Repeatable parameters allow more arguments than listed; otherwise
      // the maximum is exactly the number of listed parameters.
      const repeats = fn.p.some((p) => p.repeat === "y");
      expect(repeats ? max > fn.p.length : max === fn.p.length).toBe(true);
    }
  );

  test.each(LANGS)(
    "the %s locale lists every English function with English structure",
    (lang) => {
      const list = locale({ lang }).functionlist;
      expect(names(list)).toEqual(names(catalog));
      list.forEach((fn, i) => {
        const en = catalog[i];
        expect(fn.t).toBe(en.t);
        expect(fn.m).toEqual(en.m);
        expect(fn.d.length).toBeGreaterThan(0);
        expect(fn.a.length).toBeGreaterThan(0);
        expect(fn.p.length).toBe(en.p.length);
        fn.p.forEach((param, j) => {
          expect(param.require).toBe(en.p[j].require);
          expect(param.repeat).toBe(en.p[j].repeat);
          expect(param.type).toBe(en.p[j].type);
          expect(param.example).toBe(en.p[j].example);
          expect(param.name.length).toBeGreaterThan(0);
        });
        expect(duplicates(fn.p.map((p) => p.name))).toEqual([]);
      });
    }
  );

  test("translations keep their texts and fall back to English", () => {
    const english = [
      {
        n: "SUM",
        t: 0,
        d: "Adds.",
        a: "Sum.",
        m: [1, 255],
        p: [
          {
            name: "number1",
            detail: "First.",
            example: "A1",
            require: "m",
            repeat: "n",
            type: "rangeall",
          },
          {
            name: "number2",
            detail: "More.",
            example: "2",
            require: "o",
            repeat: "y",
            type: "rangeall",
          },
        ],
      },
      { n: "PI", t: 0, d: "Pi.", a: "Pi.", m: [0, 0], p: [] },
    ];
    const merged = mergeFunctionList(english, [
      {
        n: "SUM",
        d: "Suma.",
        a: "Suma",
        p: [
          { name: "número1", detail: "Primero." },
          { name: "número2", detail: "Más." },
        ],
      },
      { n: "UNKNOWN", d: "x", a: "x" },
    ]);
    expect(names(merged)).toEqual(["SUM", "PI"]);
    expect(merged[0].d).toBe("Suma.");
    expect(merged[0].p[1]).toEqual({
      ...english[0].p[1],
      name: "número2",
      detail: "Más.",
    });
    expect(merged[1]).toBe(english[1]);

    const mismatched = mergeFunctionList(english, [
      { n: "SUM", d: "Suma.", a: "Suma", p: [{ name: "x", detail: "y" }] },
    ]);
    expect(mismatched[0].d).toBe("Suma.");
    expect(mismatched[0].p).toBe(english[0].p);
  });
});
