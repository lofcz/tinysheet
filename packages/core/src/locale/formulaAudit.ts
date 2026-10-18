import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type FormulaAuditLocale = LocaleSection<"formulaAudit">;
export function formulaAuditLocale(ctx: {
  lang?: string | null;
}): FormulaAuditLocale {
  return getLocaleSection(ctx.lang, "formulaAudit");
}
