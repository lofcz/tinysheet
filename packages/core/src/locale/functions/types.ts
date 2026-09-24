/**
 * Shape of the function catalog that drives formula autocomplete, the
 * formula hint card and the function search dialog.
 */

export type FunctionParamType =
  | "range"
  | "rangeall"
  | "rangenumber"
  | "rangestring"
  | "rangedate"
  | "rangedatetime"
  | "string";

export type FunctionListParam = {
  name: string;
  detail: string;
  /** Sample argument shown in the hint card's example call. */
  example: string;
  /** "m" mandatory, "o" optional. */
  require: "m" | "o";
  /** "y" when the parameter can be repeated (value1, value2, ...). */
  repeat: "y" | "n";
  type: FunctionParamType;
};

export type FunctionListEntry = {
  /** Upper-case Excel name, exactly as the formula engine accepts it. */
  n: string;
  /** Category id, see FUNCTION_CATEGORIES. */
  t: number;
  /** Description. */
  d: string;
  /** Short abstract used in search results. */
  a: string;
  /** [minimum, maximum] number of arguments. */
  m: [number, number];
  p: FunctionListParam[];
};

/**
 * A translated catalog entry. Only texts are translated; everything
 * structural comes from the English entry with the same name, and any text
 * left out falls back to English. `p` is used only when it has as many items
 * as the English parameter list.
 */
export type FunctionListTranslation = {
  n: string;
  d?: string;
  a?: string;
  p?: { name?: string; detail?: string }[];
};

/**
 * Function categories (Excel's grouping). `key` is the label key in the
 * locale's `formulaMore` section. Ids 3, 4, 7, 11, 13 and 14 belonged to
 * Luckysheet-only groups and are no longer used by any function.
 */
export const FUNCTION_CATEGORIES = [
  { t: 0, key: "Math" },
  { t: 1, key: "Statistical" },
  { t: 2, key: "Lookup" },
  { t: 5, key: "Database" },
  { t: 6, key: "Date" },
  { t: 8, key: "Financial" },
  { t: 9, key: "Engineering" },
  { t: 10, key: "Logical" },
  { t: 12, key: "Text" },
  { t: 15, key: "Information" },
  { t: 16, key: "Compatibility" },
] as const;
