import { locale } from "../../src/locale";
import {
  getLL,
  getLocaleSection,
  normalizeLocale,
  supportedLocales,
} from "../../src/i18n/runtime";
import { namespaces } from "../../src/i18n/i18n-util";
import {
  CHART_SHADOW_PRESETS,
  CHART_BEVEL_PRESETS,
  CHART_ROTATION_PRESETS,
  CHART_REFLECTION_PRESETS,
  CHART_ACCENTS,
  CHART_WORDART_STYLES,
} from "../../src/modules/chartRender/effects";

function leaves(value, path = "") {
  if (typeof value === "string") return { [path]: value };
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, item]) =>
      leaves(item, `${path}.${key}`)
    )
  );
}

describe("typesafe-i18n catalogs", () => {
  test("every chart effect has a catalog label matching its stable preset id", () => {
    const labels = getLocaleSection("en", "chartTools").effects;
    const expected = {
      shadow: Object.fromEntries(
        CHART_SHADOW_PRESETS.flatMap((g) => g.items).map((p) => [p.id, p.label])
      ),
      bevel: Object.fromEntries(
        CHART_BEVEL_PRESETS.map((p) => [p.id, p.label])
      ),
      rotation: Object.fromEntries(
        CHART_ROTATION_PRESETS.flatMap((g) => g.items).map((p) => [
          p.id,
          p.label,
        ])
      ),
      reflection: Object.fromEntries(
        CHART_REFLECTION_PRESETS.map((p) => [p.id, p.label])
      ),
      accents: Object.fromEntries(
        CHART_ACCENTS.map((p, i) => [`accent${i + 1}`, p.label])
      ),
      wordArt: Object.fromEntries(
        CHART_WORDART_STYLES.map((p) => [`style${p.id}`, p.label])
      ),
    };
    expect(leaves(labels)).toEqual(leaves(expected));
  });
  test.each(["cs", "sk", "pl"])(
    "%s has no English fallback messages and preserves workbook metadata",
    (lang) => {
      // Reviewed shared spellings, proper names and notation. All other
      // English text must have a translation, including newly added keys.
      const common = new Set([
        "OK",
        "TinySheet",
        "Luckysheet",
        "SUM",
        "ESC",
        "AaBbCcYyZz",
        "Histogram",
        "Pareto",
        "Plus",
        "Log",
        "Euro",
      ]);
      const shared = {
        cs: new Set(["Text", "Minimum", "Maximum", "Symbol", "Data", "Web"]),
        sk: new Set([
          "Text",
          "Minimum",
          "Maximum",
          "Symbol",
          "Filter",
          "Web",
          "Filter: {column}",
        ]),
        pl: new Set([
          "Symbol",
          "Minus",
          "Zero",
          "Operator",
          "Parser",
          "Link…",
          "Format {element}",
        ]),
      };
      const metadata = (name, key) =>
        name === "grid" &&
        (/^\.(currencyDetail|numberFmtList|dateFmtList|linkTypeList)\.\d+\.(value|pos)$/.test(
          key
        ) ||
          /^\.splitText\.splitSymbols\.\d+\.value$/.test(key) ||
          /^\.(fontarray|fontFamily)\./.test(key) ||
          /^\.dateFmtList\.\d+\.name$/.test(key));
      const untranslated = [];
      for (const name of namespaces) {
        const base = leaves(getLocaleSection("en", name));
        const translated = leaves(getLocaleSection(lang, name));
        for (const [key, text] of Object.entries(base)) {
          if (metadata(name, key)) {
            expect({ name, key, text: translated[key] }).toEqual({
              name,
              key,
              text,
            });
            continue;
          }
          if (
            translated[key] !== text ||
            common.has(text) ||
            shared[lang].has(text)
          )
            continue;
          if (!/[A-Za-z]{2}/.test(text.replace(/\$?\{\w+\}/g, ""))) continue;
          if (/^(?:Ctrl|Alt|Shift)\+\S+$|^F\d+$/.test(text)) continue;
          untranslated.push(`${name}${key}: ${text}`);
        }
      }
      expect(untranslated).toEqual([]);
    }
  );
  test.each(["cs", "sk", "pl"])(
    "%s translates formula warnings and auditing controls",
    (lang) => {
      const english = leaves(getLocaleSection("en", "formulaAudit"));
      const translated = leaves(getLocaleSection(lang, "formulaAudit"));
      for (const key of Object.keys(english)) {
        // The confirmation button uses the same conventional spelling.
        if (key === ".calc.ok") continue;
        expect({ key, text: translated[key] }).not.toEqual({
          key,
          text: english[key],
        });
      }
      expect(
        getLocaleSection(lang, "ribbonFormulasDataReview").formulas
          .circularReferences
      ).toBe(getLocaleSection(lang, "formulaAudit").calc.circularReferences);
    }
  );
  test("only host-supported languages are registered", () => {
    expect([...supportedLocales].sort()).toEqual(["cs", "en", "pl", "sk"]);
    expect(normalizeLocale("CS-cz")).toBe("cs");
    expect(normalizeLocale("sk_SK")).toBe("sk");
    for (const lang of ["zh", "zh-TW", "es", "hi", "ru", "constructor", null]) {
      expect(normalizeLocale(lang)).toBe("en");
    }
  });
  test.each(supportedLocales)(
    "%s retains every key and interpolation token",
    (lang) => {
      for (const name of namespaces) {
        const base = leaves(getLocaleSection("en", name));
        const translated = leaves(getLocaleSection(lang, name));
        expect(Object.keys(translated)).toEqual(Object.keys(base));
        for (const key of Object.keys(base)) {
          const tokens = (text) => (text.match(/\$?\{\w+\}/g) ?? []).sort();
          expect(tokens(translated[key])).toEqual(tokens(base[key]));
        }
      }
    }
  );
  test("typed interpolation and legacy placeholders agree", () => {
    expect(getLL("cs-CZ").ribbon.groupOptions({ group: "Písmo" })).toBe(
      "Písmo: zobrazit příkazy"
    );
    expect(getLocaleSection("cs", "ribbon").groupOptions).toBe(
      "{group}: zobrazit příkazy"
    );
    expect(locale({ lang: "cs" }).defaultFmt("Kč")[0].text).toBe("Automatický");
    expect(locale({ lang: "cs" }).defaultFmt("Kč")[0].value).toBe("General");
  });
});
