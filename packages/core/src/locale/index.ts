import en from "./en";
import zh from "./zh";
import es from "./es";
import hi from "./hi";
import ru from "./ru";
import zh_tw from "./zh_tw";
import esFunctions from "./functions/es";
import hiFunctions from "./functions/hi";
import ruFunctions from "./functions/ru";
import zhFunctions from "./functions/zh";
import zhTwFunctions from "./functions/zh_tw";
import { mergeFunctionList } from "./functions/merge";
import type { FunctionListTranslation } from "./functions/types";
import { Context } from "..";
import { chartLocales, ChartLocale } from "./chart";

type Locale = typeof zh &
  Pick<typeof en, "functionlist"> & { chart: ChartLocale };

// Every locale lists every function of the English catalog; translated
// texts are merged in by function name.
function withFunctionList<T extends object>(
  base: T,
  translations: FunctionListTranslation[]
) {
  return {
    ...base,
    functionlist: mergeFunctionList(en.functionlist, translations),
  };
}

const baseLocaleObj: Record<string, Omit<Locale, "chart">> = {
  // @ts-ignore
  en,
  zh: withFunctionList(zh, zhFunctions),
  // @ts-ignore
  es: withFunctionList(es, esFunctions),
  // @ts-ignore
  "zh-TW": withFunctionList(zh_tw, zhTwFunctions),
  // @ts-ignore
  hi: withFunctionList(hi, hiFunctions),
  // @ts-ignore
  ru: withFunctionList(ru, ruFunctions),
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v);

/**
 * `over` with every key it lacks taken from `base`, recursively through plain
 * objects (arrays and values of another shape are kept as they are).
 */
function withFallback(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const out: Record<string, unknown> = { ...over };
  Object.keys(base).forEach((key) => {
    out[key] = withFallback(base[key], over[key]);
  });
  return out;
}

// Every language falls back to English key by key, so strings added to en
// show in English until translated. Chart strings live in ./chart.ts;
// attach them to every locale.
const localeObj: Record<string, Locale> = {};
Object.keys(baseLocaleObj).forEach((lang) => {
  localeObj[lang] = {
    ...(withFallback(baseLocaleObj.en, baseLocaleObj[lang]) as Omit<
      Locale,
      "chart"
    >),
    chart: withFallback(
      chartLocales.en,
      chartLocales[lang] || chartLocales.en
    ) as ChartLocale,
  };
});

function locale(ctx: Context) {
  const langsToTry = [ctx.lang || "", ctx.lang?.split("-")[0] || ""];
  for (let i = 0; i < langsToTry.length; i += 1) {
    if (langsToTry[i] in localeObj) {
      return localeObj[langsToTry[i]];
    }
  }
  return localeObj.en;
}

export { locale };
export { cellToolsLocale } from "./cellTools";
export type { CellToolsLocale } from "./cellTools";
export { FUNCTION_CATEGORIES } from "./functions/types";
export type { ChartLocale } from "./chart";
export type {
  FunctionListEntry,
  FunctionListParam,
  FunctionParamType,
} from "./functions/types";
