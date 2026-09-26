import { defaultContext } from "../../src/context";
import { defaultSettings } from "../../src/settings";
import {
  DEFAULT_FONT_FAMILY,
  cellFontName,
  defaultFont,
  defaultFontFamily,
  fontDisplayName,
  getFontSet,
} from "../../src/modules";
import {
  currencySymbol,
  defaultCurrencySymbol,
} from "../../src/modules/toolbar";

describe("default cell font (settings.defaultFontFamily)", () => {
  const ctx = (extra = {}) => ({ ...defaultContext({}), lang: "en", ...extra });

  test("defaults: Calibri-like sans at 11pt", () => {
    expect(DEFAULT_FONT_FAMILY).toBe(
      'Calibri, Carlito, "Segoe UI", Arial, sans-serif'
    );
    expect(defaultSettings.defaultFontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(defaultSettings.defaultFontSize).toBe(11);
    expect(defaultContext({}).defaultFontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(defaultContext({}).defaultFontSize).toBe(11);
  });

  test("a cell without a font uses the default family, not fontarray[0]", () => {
    const font = getFontSet({ v: "x" }, 11, ctx());
    expect(font).toMatch(/^normal normal normal 11pt Calibri, Carlito/);
    expect(font).not.toContain("Times New Roman");
    // no cell at all
    expect(getFontSet(null, 11, ctx())).toContain("11pt Calibri, Carlito");
    expect(defaultFont(11)).toContain("11pt Calibri, Carlito");
  });

  test("stored numeric ff indexes keep their meaning", () => {
    expect(getFontSet({ ff: 0 }, 11, ctx())).toContain("Times New Roman");
    expect(getFontSet({ ff: "0" }, 11, ctx())).toContain("Times New Roman");
    expect(getFontSet({ ff: 1 }, 11, ctx())).toMatch(/11pt Arial,/);
    expect(getFontSet({ ff: "Georgia" }, 11, ctx())).toMatch(/11pt Georgia,/);
    expect(getFontSet({ ff: "Aptos Narrow" }, 11, ctx())).toContain(
      '11pt "Aptos Narrow",'
    );
  });

  test("a custom default family is used for unset fonts only", () => {
    const c = ctx({ defaultFontFamily: "Georgia, serif" });
    expect(defaultFontFamily(c)).toBe("Georgia, serif");
    expect(getFontSet({ fs: 14 }, 11, c)).toMatch(/14pt Georgia, serif,/);
    expect(getFontSet({ ff: 1 }, 11, c)).toMatch(/Arial,/);
  });

  test("font box name", () => {
    expect(fontDisplayName(DEFAULT_FONT_FAMILY)).toBe("Calibri");
    expect(fontDisplayName('"Segoe UI", sans-serif')).toBe("Segoe UI");
    expect(cellFontName(ctx(), {})).toBe("Calibri");
    expect(cellFontName(ctx(), null)).toBe("Calibri");
    expect(cellFontName(ctx(), { ff: 1 })).toBe("Arial");
    expect(cellFontName(ctx(), { ff: "0" })).toBe("Times New Roman");
    expect(cellFontName(ctx(), { ff: "Aptos" })).toBe("Aptos");
    expect(
      cellFontName(ctx({ defaultFontFamily: "Georgia, serif" }), { v: 1 })
    ).toBe("Georgia");
  });
});

describe("default currency", () => {
  test("follows the language when settings.currency is unset", () => {
    expect(defaultCurrencySymbol("en")).toBe("$");
    expect(defaultCurrencySymbol("en-GB")).toBe("$");
    expect(defaultCurrencySymbol(null)).toBe("$");
    expect(defaultCurrencySymbol("zh-CN")).toBe("¥");
    // Taiwan: the New Taiwan dollar, as Excel shows it
    expect(defaultCurrencySymbol("zh-TW")).toBe("NT$");
    expect(defaultCurrencySymbol("ja")).toBe("¥");
    expect(defaultCurrencySymbol("de-DE")).toBe("€");
    expect(defaultCurrencySymbol("ru")).toBe("₽");
    expect(defaultCurrencySymbol("hi")).toBe("₹");
    expect(defaultCurrencySymbol("es")).toBe("€");
    expect(defaultSettings.currency).toBe("");
    expect(defaultContext({}).currency).toBe("");
    expect(currencySymbol({ currency: "", lang: "en" })).toBe("$");
    expect(currencySymbol({ currency: "€", lang: "en" })).toBe("€");
  });
});
