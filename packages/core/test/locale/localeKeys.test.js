import { locale } from "../../src/locale";
import { dataToolsLocale } from "../../src/locale/dataTools";
import en from "../../src/locale/en";
import zh from "../../src/locale/zh";
import zhTW from "../../src/locale/zh_tw";
import es from "../../src/locale/es";
import ru from "../../src/locale/ru";
import hi from "../../src/locale/hi";

const LANGS = ["zh", "zh-TW", "es", "ru", "hi"];

/** Dotted paths of every leaf (strings, numbers, arrays) of a locale. */
function leafPaths(obj, prefix = "") {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return [prefix];
  }
  return Object.keys(obj).flatMap((k) =>
    leafPaths(obj[k], prefix ? `${prefix}.${k}` : k)
  );
}

const get = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

function missingKeys(base, other) {
  return leafPaths(base).filter((path) => {
    const want = get(base, path);
    const have = get(other, path);
    if (have === undefined) return true;
    // a string must stay a string (a translation, or the English fallback)
    return typeof want === "string" && typeof have !== "string";
  });
}

describe("locales", () => {
  const english = locale({ lang: "en" });

  test.each(LANGS)("%s has every English key after merging", (lang) => {
    const merged = locale({ lang });
    const { functionlist, ...rest } = english;
    expect(missingKeys(rest, merged)).toEqual([]);
    expect(merged.functionlist).toHaveLength(functionlist.length);
  });

  test.each(LANGS)("%s data tools strings cover every English key", (lang) => {
    expect(
      missingKeys(dataToolsLocale({ lang: "en" }), dataToolsLocale({ lang }))
    ).toEqual([]);
  });

  test("a string missing from a language falls back to English", () => {
    // es has no dedicated "format.tipDecimalPlaces" text
    expect(es.format.tipDecimalPlaces).toBeUndefined();
    expect(locale({ lang: "es" }).format.tipDecimalPlaces).toBe(
      en.format.tipDecimalPlaces
    );
    // its own texts win
    expect(locale({ lang: "es" }).toolbar.undo).toBe(es.toolbar.undo);
  });

  // the UI sections added in phase 2 are translated, not English copies
  const SECTIONS = [
    "definedNames",
    "tables",
    "editMode",
    "spill",
    "pasteSpecial",
  ];
  test.each([
    ["zh", zh],
    ["zh_tw", zhTW],
    ["es", es],
    ["ru", ru],
    ["hi", hi],
  ])("%s translates the phase 2 sections", (_name, raw) => {
    SECTIONS.forEach((section) => {
      expect(missingKeys(en[section], raw[section])).toEqual([]);
      const copies = Object.keys(en[section]).filter(
        (k) =>
          raw[section][k] === en[section][k] &&
          /[a-z]{4}/.test(en[section][k]) &&
          // proper names and abbreviations are the same in every language
          !["fnVar", "fnStdDev"].includes(k)
      );
      expect(copies).toEqual([]);
    });
  });
});
