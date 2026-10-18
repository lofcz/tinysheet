import { getLocaleSection, supportedLocales } from "../i18n/runtime";
import type { LocaleSection, Locales } from "../i18n/runtime";
export type ChartLocale = LocaleSection<"chart">;
export const chartLocales = Object.fromEntries(
  supportedLocales.map((lang) => [lang, getLocaleSection(lang, "chart")])
) as Record<Locales, ChartLocale> & Record<string, ChartLocale>;
