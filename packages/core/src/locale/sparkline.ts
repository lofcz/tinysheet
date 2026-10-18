import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type SparklineLocale = LocaleSection<"sparkline">;
export function sparklineLocale(ctx: {
  lang?: string | null;
}): SparklineLocale {
  return getLocaleSection(ctx.lang, "sparkline");
}
