import { locale } from "../../src/locale";
import {
  getLL,
  getLocaleSection,
  normalizeLocale,
  supportedLocales,
} from "../../src/i18n/runtime";
import { namespaces } from "../../src/i18n/i18n-util";

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
