import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type PageLayoutLocale = LocaleSection<"pageLayout">;
export function pageLayoutLocale(ctx: {
  lang?: string | null;
}): PageLayoutLocale {
  return getLocaleSection(ctx.lang, "pageLayout");
}
