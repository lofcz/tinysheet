import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type DataToolsLocale = LocaleSection<"dataTools">;
export function dataToolsLocale(ctx: {
  lang?: string | null;
}): DataToolsLocale {
  return getLocaleSection(ctx.lang, "dataTools");
}
export function formatLocaleText(
  text: string,
  values: Record<string, string | number>
) {
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in values ? `${values[k]}` : m
  );
}
