import type { Context } from "../context";
import { getLocaleSection, normalizeLocale } from "../i18n/runtime";
import type { Locales } from "../i18n/runtime";
import functionlist from "./functions/en";
import { gridMetadata } from "./gridMetadata";
function createLocale(lang: Locales) {
  const strings = getLocaleSection(lang, "grid");
  return {
    ...strings,
    ...gridMetadata(strings),
    functionlist,
    chart: getLocaleSection(lang, "chart"),
  };
}
const cache: Partial<Record<Locales, ReturnType<typeof createLocale>>> = {};
export function locale(ctx: Pick<Context, "lang">) {
  const lang = normalizeLocale(ctx.lang);
  return (cache[lang] ??= createLocale(lang));
}
export { excelIoLocale } from "./excelIo";
export type { ExcelIoLocale } from "./excelIo";
export { cellToolsLocale } from "./cellTools";
export { ribbonLocale } from "./ribbon";
export { dialogsLocale } from "./dialogs";
export type { DialogsLocale } from "./dialogs";
export type { RibbonLocale } from "./ribbon";
export { ribbonFormulasDataReviewLocale } from "./ribbonFormulasDataReview";
export type { RibbonFormulasDataReviewLocale } from "./ribbonFormulasDataReview";
export { ribbonTabsLocale } from "./ribbonTabs";
export { chartToolsLocale } from "./chartTools";
export type { ChartToolsLocale } from "./chartTools";
export type { RibbonTabsLocale } from "./ribbonTabs";
export type { CellToolsLocale } from "./cellTools";
export { FUNCTION_CATEGORIES } from "./functions/types";
export type { ChartLocale } from "./chart";
export { pivotLocale, pivotText } from "./pivot";
export type { PivotLocale } from "./pivot";
export type {
  FunctionListEntry,
  FunctionListParam,
  FunctionParamType,
} from "./functions/types";
export { pageLayoutLocale } from "./pageLayout";
export type { PageLayoutLocale } from "./pageLayout";
