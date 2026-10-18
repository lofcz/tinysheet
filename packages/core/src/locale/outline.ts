import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type OutlineLocale = LocaleSection<"outline">;
export function outlineLocale(ctx: { lang?: string | null }): OutlineLocale {
  return getLocaleSection(ctx.lang, "outline");
}
