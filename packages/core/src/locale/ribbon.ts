import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type RibbonLocale = LocaleSection<"ribbon">;
export function ribbonLocale(ctx: { lang?: string | null }): RibbonLocale {
  return getLocaleSection(ctx.lang, "ribbon");
}
