import { getLocaleSection, supportedLocales } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type ExcelIoLocale = LocaleSection<"excelIo">;
export function excelIoLocale(
  lang?: string | null | { lang?: string | null }
): ExcelIoLocale {
  return getLocaleSection(
    typeof lang === "string" ? lang : lang?.lang,
    "excelIo"
  );
}
export const excelIoLocales = Object.fromEntries(
  supportedLocales.map((lang) => [lang, excelIoLocale(lang)])
);
