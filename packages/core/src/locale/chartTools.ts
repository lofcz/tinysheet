import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type ChartToolsLocale = LocaleSection<"chartTools">;
export function chartToolsLocale(ctx: {
  lang?: string | null;
}): ChartToolsLocale {
  return getLocaleSection(ctx.lang, "chartTools");
}
