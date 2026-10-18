import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type TableToolsLocale = LocaleSection<"tableTools">;
export function tableToolsLocale(ctx: {
  lang?: string | null;
}): TableToolsLocale {
  return getLocaleSection(ctx.lang, "tableTools");
}
