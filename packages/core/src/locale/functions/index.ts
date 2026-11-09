import type { Locales } from "../../i18n/runtime";
import english from "./en";
import cs from "./cs";
import sk from "./sk";
import pl from "./pl";
import { mergeFunctionList } from "./merge";
import type { FunctionListEntry } from "./types";

const translations = { cs, sk, pl };
const catalogs: Partial<Record<Locales, FunctionListEntry[]>> = { en: english };

/** Share immutable help catalogs; construct only the language being used. */
export function functionCatalog(lang: Locales): FunctionListEntry[] {
  if (lang === "en") return english;
  return (catalogs[lang] ??= mergeFunctionList(english, translations[lang]));
}
