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

// Chart strings live in ./chart.ts; attach them to every locale.
const localeObj: Record<string, Locale> = {};
Object.keys(baseLocaleObj).forEach((lang) => {
  localeObj[lang] = {
    ...baseLocaleObj[lang],
    chart: chartLocales[lang] || chartLocales.en,
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
export { FUNCTION_CATEGORIES } from "./functions/types";
export type { ChartLocale } from "./chart";
export type {
  FunctionListEntry,
  FunctionListParam,
  FunctionParamType,
} from "./functions/types";
