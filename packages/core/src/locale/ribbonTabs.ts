import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type RibbonTabsLocale = LocaleSection<"ribbonTabs">;
export function ribbonTabsLocale(ctx: {
  lang?: string | null;
}): RibbonTabsLocale {
  return getLocaleSection(ctx.lang, "ribbonTabs");
}
