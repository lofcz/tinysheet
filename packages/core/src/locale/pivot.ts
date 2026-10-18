import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type PivotLocale = LocaleSection<"pivot">;
export function pivotLocale(ctx: { lang?: string | null }): PivotLocale {
  return getLocaleSection(ctx.lang, "pivot");
}
/** Replace {name} placeholders. */
export function pivotText(
  text: string,
  values: Record<string, string | number>
) {
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in values ? `${values[k]}` : m
  );
}
