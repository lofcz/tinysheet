import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type DialogsLocale = LocaleSection<"dialogs">;
export function dialogsLocale(ctx: { lang?: string | null }): DialogsLocale {
  return getLocaleSection(ctx.lang, "dialogs");
}
