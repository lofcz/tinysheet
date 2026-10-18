import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type CellToolsLocale = LocaleSection<"cellTools">;
export function cellToolsLocale(ctx: {
  lang?: string | null;
}): CellToolsLocale {
  return getLocaleSection(ctx.lang, "cellTools");
}
