import { locale } from "../../src/locale";
import {
  FORMAT_CATEGORIES,
  FRACTION_FORMATS,
  SPECIAL_FORMATS,
} from "../../src/modules/numberFormat";
import { getCellStyles } from "../../src/modules/formatCells";

const LANGS = ["en", "zh", "zh-TW", "es", "hi", "ru"];
const KEYS = ["formatCells", "numberFormatMenu", "cellStyles"];

/** Every leaf path of an object, e.g. "tabs.number". */
function paths(obj, prefix = "") {
  return Object.keys(obj).flatMap((k) => {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? paths(v, p) : [p];
  });
}

describe("Format Cells / cell styles locale strings", () => {
  const en = locale({ lang: "en" });

  test.each(LANGS)("%s has every English key", (lang) => {
    const l = locale({ lang });
    KEYS.forEach((key) => {
      expect(paths(l[key]).sort()).toEqual(paths(en[key]).sort());
    });
    expect(l.formatCells.fractionTypes).toHaveLength(FRACTION_FORMATS.length);
    expect(l.formatCells.specialTypes).toHaveLength(SPECIAL_FORMATS.length);
  });

  test("every category and cell style has a name", () => {
    FORMAT_CATEGORIES.forEach((c) => {
      expect(en.formatCells.categories[c]).toBeTruthy();
      expect(en.formatCells.descriptions[c]).toBeTruthy();
    });
    getCellStyles().forEach((s) => {
      expect(en.cellStyles.names[s.id]).toBeTruthy();
      expect(en.cellStyles.groups[s.group]).toBeTruthy();
    });
  });
});
