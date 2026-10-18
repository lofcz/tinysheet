import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type ProtectionLocale = LocaleSection<"protection">;
export function protectionLocale(ctx: {
  lang?: string | null;
}): ProtectionLocale {
  return getLocaleSection(ctx.lang, "protection");
}
