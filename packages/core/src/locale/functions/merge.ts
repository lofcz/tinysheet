import type { FunctionListEntry, FunctionListTranslation } from "./types";

/**
 * Builds a locale's function list from the English catalog and that
 * locale's translations, matched by function name. Every locale therefore
 * lists exactly the English functions, in the same order; untranslated
 * functions (and untranslated parameter lists) fall back to English.
 */
export function mergeFunctionList(
  english: FunctionListEntry[],
  translations: FunctionListTranslation[]
): FunctionListEntry[] {
  const byName = new Map<string, FunctionListTranslation>();
  translations.forEach((tr) => byName.set(tr.n, tr));

  return english.map((entry) => {
    const tr = byName.get(entry.n);
    if (!tr) return entry;
    const trParams = tr.p;
    const params =
      trParams && trParams.length === entry.p.length
        ? entry.p.map((param, i) => ({
            ...param,
            name: trParams[i].name || param.name,
            detail: trParams[i].detail || param.detail,
          }))
        : entry.p;
    return {
      ...entry,
      d: tr.d || entry.d,
      a: tr.a || entry.a,
      p: params,
    };
  });
}
