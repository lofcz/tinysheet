import type { Locales, Namespaces, TranslationFunctions } from "./i18n-types";
import { i18nObject, loadedLocales, locales } from "./i18n-util";
import { loadAllLocales } from "./i18n-util.sync";

export type { Locales } from "./i18n-types";
export const supportedLocales = locales;

/** Host locale tags are scoped to each workbook; unsupported languages use English. */
export function normalizeLocale(locale?: string | null): Locales {
  const language = locale?.toLowerCase().split(/[-_]/)[0];
  return locales.find((candidate) => candidate === language) ?? "en";
}

const functions: Partial<Record<Locales, TranslationFunctions>> = {};

/** The same typesafe-i18n runtime/fork used by ScioBot and Fika. */
export function getLL(locale?: string | null): TranslationFunctions {
  loadAllLocales();
  const language = normalizeLocale(locale);
  return (functions[language] ??= i18nObject(language));
}

type EnglishSections = {
  home: typeof import("./en/home").default;
  grid: typeof import("./en/grid").default;
  ribbon: typeof import("./en/ribbon").default;
  ribbonTabs: typeof import("./en/ribbonTabs").default;
  ribbonFormulasDataReview: typeof import("./en/ribbonFormulasDataReview").default;
  cellTools: typeof import("./en/cellTools").default;
  dialogs: typeof import("./en/dialogs").default;
  excelIo: typeof import("./en/excelIo").default;
  chart: typeof import("./en/chart").default;
  chartTools: typeof import("./en/chartTools").default;
  pivot: typeof import("./en/pivot").default;
  pageLayout: typeof import("./en/pageLayout").default;
  outline: typeof import("./en/outline").default;
  sparkline: typeof import("./en/sparkline").default;
  tableTools: typeof import("./en/tableTools").default;
  formulaAudit: typeof import("./en/formulaAudit").default;
  protection: typeof import("./en/protection").default;
  dataTools: typeof import("./en/dataTools").default;
  threadedComments: typeof import("./en/threadedComments").default;
};
type StringCatalog<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? StringCatalog<Item>[]
    : T extends Record<string, string>
      ? { -readonly [Key in keyof T]: string } & Record<string, string>
      : { -readonly [Key in keyof T]: StringCatalog<T[Key]> };
export type LocaleSection<Name extends Namespaces> = StringCatalog<
  EnglishSections[Name]
>;

const sections: Partial<Record<Locales, Partial<Record<Namespaces, unknown>>>> =
  {};

/**
 * Compatibility view for the grid's existing string-based APIs. All messages
 * run through the generated runtime once per section/locale. Keep named and
 * positional placeholders intact for existing formatLocaleText consumers.
 * New code can use getLL() directly with typed interpolation parameters.
 */
export function getLocaleSection<Name extends Namespaces>(
  locale: string | null | undefined,
  name: Name
): LocaleSection<Name> {
  const language = normalizeLocale(locale);
  const LL = getLL(language);
  const cache = (sections[language] ??= {});
  if (!cache[name]) {
    const materialize = (raw: unknown, translated: any): unknown => {
      if (typeof raw === "string") {
        const parameters = Object.fromEntries(
          [...raw.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], match[0]])
        );
        return translated(parameters);
      }
      if (Array.isArray(raw))
        return raw.map((entry, index) => materialize(entry, translated[index]));
      return Object.fromEntries(
        Object.entries(raw as object).map(([key, value]) => [
          key,
          materialize(value, translated[key]),
        ])
      );
    };
    cache[name] = materialize(loadedLocales[language][name], LL[name]);
  }
  return cache[name] as LocaleSection<Name>;
}
