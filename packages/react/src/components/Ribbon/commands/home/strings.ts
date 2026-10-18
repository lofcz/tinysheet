import { getLocaleSection } from "@lofcz/tinysheet-core";
import type { LocaleSection } from "@lofcz/tinysheet-core";
export type HomeText = LocaleSection<"home">;
export function homeText(ctx: { lang?: string | null }): HomeText {
  return getLocaleSection(ctx.lang, "home");
}
