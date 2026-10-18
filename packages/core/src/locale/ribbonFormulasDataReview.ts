import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type RibbonFormulasDataReviewLocale =
  LocaleSection<"ribbonFormulasDataReview">;
export function ribbonFormulasDataReviewLocale(ctx: {
  lang?: string | null;
}): RibbonFormulasDataReviewLocale {
  return getLocaleSection(ctx.lang, "ribbonFormulasDataReview");
}
