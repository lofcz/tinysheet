import { getLocaleSection } from "../i18n/runtime";
import type { LocaleSection } from "../i18n/runtime";
export type ThreadedCommentsLocale = LocaleSection<"threadedComments">;
export function threadedCommentsLocale(ctx: {
  lang?: string | null;
}): ThreadedCommentsLocale {
  return getLocaleSection(ctx.lang, "threadedComments");
}
